import "server-only";
import { randomUUID } from "node:crypto";
import type { HotelProperty, Prisma } from "@prisma/client";
import { ApiError } from "@/lib/api-guards";
import { enumerateStayNights, validateOccupancyFitsRoom } from "@/lib/hotel/domain/stay-dates";
import { resolveNightlyRatesForWindow, quoteCancellation } from "@/lib/hotel/domain/rate";
import { BED_CAPACITY, type BedConfiguration, type CancellationTier, type ReservationCancellationPolicySnapshot } from "@/lib/hotel/domain/types";
export type HotelPricedQuote = { id: string; actorUserId: string; propertyId: string; roomTypeId: string; ratePlanId: string; checkIn: string; checkOut: string; adults: number; childAges: number[]; nightlyRates: number[]; totalAmount: string; currency: string; expiresAt: string; policyVersion: number; policy: ReservationCancellationPolicySnapshot; holdId?: string; reservationId?: string };
type Quote = HotelPricedQuote;
export type HotelStayCriteria = { action: "search" | "quote"; roomTypeId: string; ratePlanId: string; checkIn: string; checkOut: string; adults: number; childAges: number[] };
const date = (value: string) => new Date(value + "T00:00:00.000Z");
const dateOnly = (value: Date) => value.toISOString().slice(0, 10);
const fail = (message: string, status = 409): never => { throw new ApiError(status, message); };
/** Server-only pricing; no hold, reservation, payment or inventory mutation. */
export async function priceHotelStay(tx: Prisma.TransactionClient, property: HotelProperty, actorUserId: string, command: HotelStayCriteria, now: Date): Promise<{ quote?: HotelPricedQuote; available?: boolean; remaining?: number }> {
const organizationId = property.organizationId; const propertyId = property.id;
        const count = (date(command.checkOut).getTime() - date(command.checkIn).getTime()) / 86_400_000;
        if (!Number.isInteger(count) || count < 1 || count > 31) fail("Stay must be 1 to 31 nights", 422);
        const room = await tx.hotelRoomType.findFirst({ where: { id: command.roomTypeId, organizationId, propertyId, isActive: true, deletedAt: null } });
        const plan = await tx.hotelRatePlan.findFirst({ where: { id: command.ratePlanId, organizationId, propertyId, roomTypeId: command.roomTypeId, isActive: true }, include: { nightlyRates: true, cancellationPolicy: true } });
        if (!room || !plan || plan.currency !== property.currency || plan.currency !== "TOMAN") fail("Room, rate plan or currency not available", 422);
        if (!Array.isArray(room!.beds) || !room!.beds.length || room!.beds.some(bed => !bed || typeof bed !== "object" ||
          !Object.hasOwn(BED_CAPACITY, String((bed as { kind?: unknown }).kind)) ||
          !Number.isSafeInteger((bed as { count?: number }).count) || Number((bed as { count?: number }).count) < 1)) fail("Room bed configuration is invalid", 422);
        const fits = validateOccupancyFitsRoom({ adults: command.adults, children: command.childAges.length, childAges: command.childAges }, room!, room!.beds as unknown as BedConfiguration[]);
        if (!fits.isValid) fail(fits.reason, 422);
        const safeMoney = (value: bigint) => { const amount = Number(value); if (!Number.isSafeInteger(amount) || amount < 0) fail("Unsupported amount", 422); return amount; };
        const resolution = resolveNightlyRatesForWindow({ property: { ...property, policies: {} } as never,
          ratePlan: { ...plan!, baseNightlyRate: safeMoney(plan!.baseNightlyRate), validFrom: plan!.validFrom ? dateOnly(plan!.validFrom) : undefined, validTo: plan!.validTo ? dateOnly(plan!.validTo) : undefined } as never,
          seasonalRates: plan!.nightlyRates.map(rate => ({ ...rate, from: dateOnly(rate.from), to: dateOnly(new Date(rate.to.getTime() - 86_400_000)), nightlyRate: rate.nightlyRate === null ? undefined : safeMoney(rate.nightlyRate) })), checkIn: command.checkIn, checkOut: command.checkOut });
        if (!resolution.isResolved || !Number.isSafeInteger(resolution.total)) fail(resolution.reason ?? "Unsupported total", 422);
        const nights = enumerateStayNights(command.checkIn, command.checkOut);
        const inventory = await tx.hotelInventory.findMany({ where: { organizationId, propertyId, roomTypeId: room!.id, date: { in: nights.map(date) } } });
        const remaining = inventory.length === nights.length ? Math.max(0, Math.min(...inventory.map(row => row.closedToArrival || row.closedToDeparture ? 0 : row.allotment - row.booked - row.held - row.outOfService))) : 0;
        if (command.action === "search") return { available: remaining > 0, remaining };
          if (!remaining) fail("No inventory");
          const policy = plan!.cancellationPolicy;
          if (!policy || !policy.isActive || policy.organizationId !== organizationId || policy.propertyId !== propertyId) fail("A configured cancellation policy is required");
          if (policy!.cancellationTiers !== null && (!Array.isArray(policy!.cancellationTiers) || policy!.cancellationTiers.some(tier => !tier || typeof tier !== "object"))) fail("Invalid cancellation policy", 422);
          const quote: Quote = { id: randomUUID(), actorUserId: actorUserId, propertyId, roomTypeId: room!.id, ratePlanId: plan!.id,
            checkIn: command.checkIn, checkOut: command.checkOut, adults: command.adults, childAges: command.childAges,
            totalAmount: String(resolution.total), nightlyRates: resolution.nights!.map(night => night.amount), currency: plan!.currency,
            expiresAt: new Date(now.getTime() + 10 * 60_000).toISOString(), policyVersion: policy!.version,
            policy: { id: policy!.id, key: policy!.key, name: policy!.name, description: policy!.description ?? "", freeCancellationCutoffHours: policy!.freeCancellationCutoffHours, fullCancellationRetention: policy!.fullCancellationRetention / 10000, cancellationTiers: Array.isArray(policy!.cancellationTiers) ? policy!.cancellationTiers as CancellationTier[] : undefined, organizationId, version: policy!.version, policyVersion: policy!.version, capturedAt: now.toISOString() } };
          const policyCheck = quoteCancellation({ totalAmount: Number(quote.totalAmount), cancelledAt: now, checkInAt: date(quote.checkIn), firstNightAmount: quote.nightlyRates[0], policy: quote.policy });
          if (policyCheck.reason === "INVALID_POLICY") fail("Invalid cancellation policy", 422);

return { quote };
}
