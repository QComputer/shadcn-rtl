import { createHash, randomUUID } from "node:crypto";
import { ApiError, jsonError } from "@/lib/api-guards";
import { parseJsonObject } from "@/lib/hotel/management/api-adapter";
import { createPrismaHotelRepositories } from "@/lib/hotel/persistence/prisma-hotel-repositories";
import { resolveHotelTenantForHost } from "@/lib/hotel/services/hotel-publication.service";
import { searchPublishedHotelAvailability } from "@/lib/hotel/services/public-availability.service";
import { anonymousHoldRequestSchema } from "@/lib/hotel/validation/hotel-contracts";

const HOLD_GATE = "Anonymous hotel holds are not operationally enabled.";

export async function POST(request: Request) {
  try {
    if (process.env.HOTEL_ANONYMOUS_HOLD_OPERATIONAL_ENABLED !== "1") throw new ApiError(503, HOLD_GATE);
    const idempotencyKey = request.headers.get("idempotency-key")?.trim();
    if (!idempotencyKey || idempotencyKey.length < 8 || idempotencyKey.length > 128) throw new ApiError(400, "A valid Idempotency-Key is required");
    const input = anonymousHoldRequestSchema.parse({ ...parseJsonObject(await request.json()), idempotencyKey });
    const host = request.headers.get("host");
    const tenant = await resolveHotelTenantForHost(host);
    if (!tenant) throw new ApiError(404, "Hotel is not available");
    const repositories = createPrismaHotelRepositories();
    const fingerprint = createHash("sha256").update(JSON.stringify({ organizationId: tenant.organizationId, property: input.property, roomType: input.roomType, ratePlan: input.ratePlan, input: { ...input, contact: { fullName: input.contact.fullName.trim(), phone: input.contact.phone.trim(), email: input.contact.email?.trim().toLowerCase() } } })).digest("hex");
    const replay = await repositories.findAnonymousHoldReplay({ scope: { organizationId: tenant.organizationId }, idempotencyKey, requestFingerprint: fingerprint, propertySlug: input.property, roomTypeSlug: input.roomType, ratePlanCode: input.ratePlan });
    if (replay?.isConflict) throw new ApiError(409, "Idempotency-Key was used with a different request");
    if (replay?.isReplay) return Response.json({ holdId: replay.result.holdId, reference: replay.result.reference, status: "ACTIVE", expiresAt: replay.result.expiresAt.toISOString(), currency: replay.result.currency, totalRate: String(replay.result.totalAmount), nightlyRates: replay.result.nightlyRates.map(String), cancellationPolicy: replay.result.policySnapshot, inventoryReserved: true }, { status: 200 });
    const availability = await searchPublishedHotelAvailability(host, {
      property: input.property,
      checkIn: input.checkIn,
      checkOut: input.checkOut,
      occupancy: input.occupancy,
    });
    const option = availability?.options.find((candidate) => candidate.roomType.slug === input.roomType && candidate.ratePlan.code === input.ratePlan && candidate.isAvailable);
    if (!availability || !option) throw new ApiError(409, "The requested hotel inventory is not available");

    const now = new Date();
    const hold = await repositories.createAnonymousHoldAtomically({
      scope: { organizationId: tenant.organizationId },
      propertyId: availability.property.id,
      roomTypeId: option.roomType.id,
      ratePlanId: option.ratePlan.id,
      idempotencyKey,
      requestFingerprint: fingerprint,
      now,
      query: { propertyId: availability.property.id, window: { checkIn: input.checkIn, checkOut: input.checkOut }, occupancy: input.occupancy },
      reference: `H-${randomUUID().replaceAll("-", "").slice(0, 20).toUpperCase()}`,
      holdId: randomUUID(),
    });
    if (hold.isHeld !== true) throw new ApiError(409, hold.reason === "IDEMPOTENCY_CONFLICT" ? "Idempotency-Key was used with a different request" : hold.reason === "IDEMPOTENCY_REPLAY_INACTIVE" ? "The original hold is no longer active" : "The requested hotel inventory is not available");
    return Response.json({ holdId: hold.holdId, reference: hold.reference, status: "ACTIVE", expiresAt: hold.expiresAt.toISOString(), currency: hold.currency, totalRate: String(hold.totalAmount), nightlyRates: hold.nightlyRates.map(String), cancellationPolicy: hold.policySnapshot, inventoryReserved: true }, { status: hold.replay ? 200 : 201 });
  } catch (error) {
    return jsonError(error);
  }
}
