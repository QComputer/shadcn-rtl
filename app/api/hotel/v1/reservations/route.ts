import { createHash, randomUUID } from "node:crypto";
import { ApiError, jsonError } from "@/lib/api-guards";
import prisma from "@/lib/db";
import { parseJsonObject } from "@/lib/hotel/management/api-adapter";
import { createPrismaHotelRepositories } from "@/lib/hotel/persistence/prisma-hotel-repositories";
import { confirmBookingHold } from "@/lib/hotel/services/hotel-booking.service";
import { resolveHotelTenantForHost } from "@/lib/hotel/services/hotel-publication.service";
import { resolveDamoonDemoProperty } from "@/lib/hotel/services/damoon-demo-booking.server";
import { hashCustomerIdentifier, normalizeCustomerPhone, resolveCustomerIdentity } from "@/lib/customer-identity/customer-identity.service";
import { bookingRequestSchema } from "@/lib/hotel/validation/hotel-contracts";
import { z } from "zod";

const requestSchema = bookingRequestSchema.extend({
  holdId: z.string().uuid(),
  holdIdempotencyKey: z.string().min(8).max(128),
});

export async function POST(request: Request) {
  try {
    const body = requestSchema.parse(parseJsonObject(await request.json()));
    const host = request.headers.get("host");
    const tenant = await resolveHotelTenantForHost(host);
    if (!tenant) throw new ApiError(404, "Hotel is not available");
    const demo = await resolveDamoonDemoProperty(host, body.property);
    if (!demo && process.env.HOTEL_ANONYMOUS_RESERVATION_OPERATIONAL_ENABLED !== "1") throw new ApiError(503, "Anonymous hotel reservations are not operationally enabled.");
    if (body.idempotencyKey !== body.holdIdempotencyKey) throw new ApiError(409, "Reservation retry key does not match the hold");

    const phone = demo ? null : normalizeCustomerPhone(body.contact.phone);
    if (!demo && !phone) throw new ApiError(400, "A valid guest mobile number is required");
    const phoneHash = hashCustomerIdentifier(tenant.organizationId, demo ? `demo:${body.idempotencyKey}` : phone!);
    const scope = { organizationId: tenant.organizationId };
    const repositories = createPrismaHotelRepositories();
    const existing = await prisma.hotelReservation.findFirst({
      where: { organizationId: tenant.organizationId, holdId: body.holdId },
      include: { nights: true, guests: true },
    });
    if (existing) {
      const primary = existing.guests.find((guest) => guest.isPrimary);
      if (existing.idempotencyKey !== body.idempotencyKey || primary?.phoneHash !== phoneHash) throw new ApiError(404, "Reservation is not available");
      return Response.json({ reference: existing.reference, status: existing.status, paymentStatus: demo ? (existing.status === "CONFIRMED" ? "SIMULATED" : "PENDING_SIMULATION") : Number(existing.paidAmount) >= Number(existing.totalAmount) ? "PAID" : "UNPAID", totalAmount: String(existing.totalAmount), currency: existing.currency, ...(demo ? { mode: "DEMO_BOOKING", synthetic: true } : {}) }, { status: 200 });
    }

    const inputForFingerprint = {
      property: body.property,
      roomType: body.roomType,
      ratePlan: body.ratePlan,
      checkIn: body.checkIn,
      checkOut: body.checkOut,
      occupancy: body.occupancy,
      guests: body.guests,
      contact: body.contact,
      idempotencyKey: body.holdIdempotencyKey,
      specialRequests: body.specialRequests,
      acceptedCancellationPolicyKey: body.acceptedCancellationPolicyKey,
      acceptedCancellationPolicyVersion: body.acceptedCancellationPolicyVersion,
      acceptedTotalRate: body.acceptedTotalRate,
      acceptedCurrency: body.acceptedCurrency,
    };
    const fingerprint = createHash("sha256").update(JSON.stringify({
      organizationId: tenant.organizationId,
      property: body.property,
      roomType: body.roomType,
      ratePlan: body.ratePlan,
      input: { ...inputForFingerprint, contact: { fullName: body.contact.fullName.trim(), phone: body.contact.phone.trim(), email: body.contact.email?.trim().toLowerCase() } },
    })).digest("hex");
    const replay = await repositories.findAnonymousHoldReplay({ scope, idempotencyKey: body.holdIdempotencyKey, requestFingerprint: fingerprint, propertySlug: body.property, roomTypeSlug: body.roomType, ratePlanCode: body.ratePlan, ...(demo ? { publicationApprovalBypass: "DAMOON_DEMO_BOOKING" as const } : {}) });
    if (!replay || !("isReplay" in replay) || !replay.isReplay || replay.result.holdId !== body.holdId) throw new ApiError(409, "The booking hold expired or does not match this request");

    const hold = await repositories.findHold(scope, body.holdId);
    if (!hold || hold.status !== "ACTIVE" || hold.checkIn !== body.checkIn || hold.checkOut !== body.checkOut) throw new ApiError(409, "The booking hold is no longer active");
    const property = await prisma.hotelProperty.findFirst({ where: { id: hold.propertyId, organizationId: tenant.organizationId, slug: body.property, isActive: true, deletedAt: null }, select: { id: true } });
    const plan = property ? await prisma.hotelRatePlan.findFirst({ where: { organizationId: tenant.organizationId, propertyId: property.id, roomTypeId: hold.roomTypeId, code: body.ratePlan, isActive: true }, select: { id: true } }) : null;
    if (!property || !plan) throw new ApiError(409, "The selected room or rate is no longer available");

    if (!demo) await resolveCustomerIdentity({ organizationId: tenant.organizationId, phone: phone!, email: body.contact.email, metadata: { source: "HOTEL_ANONYMOUS_RESERVATION" } });
    const guests = demo
      ? [{ fullName: "Demo Guest", isPrimary: true, isChild: false, phoneHash }]
      : body.guests.map((guest) => ({ ...guest, ...(guest.isPrimary ? { phoneHash } : {}) }));
    if (!demo && !guests.some((guest) => guest.isPrimary)) guests.unshift({ fullName: body.contact.fullName, isPrimary: true, isChild: false, phoneHash });
    const result = await confirmBookingHold({ booking: repositories, payments: repositories, now: () => new Date() }, {
      scope,
      holdId: body.holdId,
      reservationId: randomUUID(),
      ratePlanId: plan.id,
      guests,
      occupancy: body.occupancy,
      policySnapshot: replay.result.policySnapshot,
      nightlyRates: replay.result.nightlyRates.map(Number),
      totalAmount: Number(replay.result.totalAmount),
      currency: replay.result.currency,
      idempotencyKey: body.idempotencyKey,
    });
    if (!result.isConfirmed) throw new ApiError(409, "The booking hold can no longer be converted to a reservation");
    return Response.json({ reference: result.reservation.reference, status: result.reservation.status, paymentStatus: demo ? "PENDING_SIMULATION" : "UNPAID", totalAmount: String(result.reservation.totalAmount), currency: result.reservation.currency, ...(demo ? { mode: "DEMO_BOOKING", synthetic: true } : {}) }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
