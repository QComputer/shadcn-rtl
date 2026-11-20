import { createHash, createHmac } from "node:crypto";
import { Prisma } from "@prisma/client";
import { ApiError } from "@/lib/api-guards";
import { prisma } from "@/lib/db-runtime";
import type { HotelGuestBookingRequestInput } from "@/lib/hotel/validation/hotel-contracts";
import { resolveHotelTenantForHost } from "@/lib/hotel/services/hotel-publication.service";
import { searchPublishedHotelAvailability } from "@/lib/hotel/services/public-availability.service";
import { isApprovedHotelPublicationAvailable } from "@/lib/hotel/services/public-publication-gate";

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

function referenceFor(organizationId: string, idempotencyHash: string) {
  const secret = process.env.AUTH_SECRET;
  if (!secret || Buffer.byteLength(secret, "utf8") < 32) throw new ApiError(503, "Guest request tracking is unavailable");
  return createHmac("sha256", secret).update(`hotel-guest-request:v1:${organizationId}:${idempotencyHash}`).digest("base64url");
}

function fingerprint(input: HotelGuestBookingRequestInput) {
  return sha256(JSON.stringify({
    property: input.property,
    ...(input.kind === "coordination" ? { kind: input.kind } : { roomType: input.roomType, ratePlan: input.ratePlan }),
    checkIn: input.checkIn,
    checkOut: input.checkOut,
    occupancy: { adults: input.occupancy.adults, children: input.occupancy.children, childAges: input.occupancy.childAges ?? [] },
    contact: { fullName: input.contact.fullName.trim(), phone: input.contact.phone.trim(), email: input.contact.email?.trim().toLowerCase() ?? "" },
    specialRequests: input.specialRequests?.trim() ?? "",
  }));
}

export async function submitHotelGuestBookingRequest(input: HotelGuestBookingRequestInput, headers: Headers, idempotencyKey: string) {
  const tenant = await resolveHotelTenantForHost(headers.get("host"));
  if (!tenant) throw new ApiError(404, "Hotel is not available");
  if ((input.occupancy.children ?? 0) > 0 && input.occupancy.childAges?.length !== input.occupancy.children) {
    throw new ApiError(400, "Enter one age for each child");
  }

  const idempotencyHash = sha256(`${tenant.organizationId}\u0000${idempotencyKey}`);
  const requestFingerprint = fingerprint(input);
  const reference = referenceFor(tenant.organizationId, idempotencyHash);
  const trackingReferenceHash = sha256(reference);
  const coordination = input.kind === "coordination";
  const where = { organizationId: tenant.organizationId, idempotencyHash };
  const findExisting = () => prisma.hotelGuestBookingRequest.findFirst({
    where,
    select: { requestFingerprint: true, trackingReferenceHash: true, status: true, availabilityHint: true },
  });
  const replay = (existing: NonNullable<Awaited<ReturnType<typeof findExisting>>>) => {
    if (existing.requestFingerprint !== requestFingerprint || existing.trackingReferenceHash !== trackingReferenceHash) {
      throw new ApiError(409, "Idempotency-Key was used with a different request");
    }
    return { reference, status: existing.status, availabilityHint: coordination ? undefined : existing.availabilityHint, replay: true };
  };

  const existing = await findExisting();
  if (existing) return replay(existing);
  if (process.env.HOTEL_GUEST_BOOKING_REQUEST_ENABLED !== "1") throw new ApiError(503, "Guest booking requests are not operationally enabled");

  const data = {
    ...where,
    trackingReferenceHash,
    requestFingerprint,
    checkIn: new Date(`${input.checkIn}T00:00:00.000Z`),
    checkOut: new Date(`${input.checkOut}T00:00:00.000Z`),
    adults: input.occupancy.adults,
    children: input.occupancy.children ?? 0,
    childAges: input.occupancy.childAges ?? [],
    guestName: input.contact.fullName.trim(),
    guestPhone: input.contact.phone.trim(),
    guestEmail: input.contact.email?.trim().toLowerCase() || null,
    guestNote: input.specialRequests?.trim() || null,
  };

  try {
    if (coordination) {
      await prisma.$transaction(async (tx) => {
        // Serialize submission with property disablement and scope the property to the verified host.
        const [property] = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
          SELECT "id" FROM "HotelProperty"
          WHERE "organizationId" = ${tenant.organizationId} AND "slug" = ${input.property}
            AND "isActive" AND "deletedAt" IS NULL AND "operationalMode" = 'REQUEST_ONLY'
          FOR SHARE
        `);
        if (!property) throw new ApiError(404, "Stay requests are not enabled for this property");
        await tx.hotelGuestBookingRequest.create({ data: { ...data, propertyId: property.id } });
      });
    } else {
      if (!isApprovedHotelPublicationAvailable()) throw new ApiError(503, "Hotel availability is not operationally enabled");

      const availability = await searchPublishedHotelAvailability(headers.get("host"), {
        property: input.property,
        checkIn: input.checkIn,
        checkOut: input.checkOut,
        occupancy: input.occupancy,
      });
      const option = availability?.options.find((candidate) => candidate.roomType.slug === input.roomType && candidate.ratePlan.code === input.ratePlan && candidate.isAvailable);
      if (!availability || !option) throw new ApiError(409, "The selected room is not currently listed as available. Check the dates and request again.");

      await prisma.hotelGuestBookingRequest.create({
        data: {
          ...data,
          propertyId: availability.property.id,
          roomTypeSlug: option.roomType.slug,
          ratePlanCode: option.ratePlan.code,
          availabilityHint: "AVAILABLE",
        },
      });
    }
  } catch (error) {
    // Concurrent identical submissions resolve to the single tenant-scoped row.
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;
    const concurrent = await findExisting();
    if (!concurrent) throw error;
    return replay(concurrent);
  }

  return { reference, status: "RECEIVED" as const, availabilityHint: coordination ? undefined : "AVAILABLE", replay: false };
}

export async function readHotelGuestBookingRequestStatus(reference: string, host: string | null) {
  const tenant = await resolveHotelTenantForHost(host);
  if (!tenant) throw new ApiError(404, "Hotel is not available");
  const trackingReferenceHash = sha256(reference);
  const request = await prisma.hotelGuestBookingRequest.findFirst({
    where: { organizationId: tenant.organizationId, trackingReferenceHash },
    select: { status: true, availabilityHint: true, managerMessage: true, roomTypeSlug: true, ratePlanCode: true, createdAt: true, updatedAt: true },
  });
  if (!request) throw new ApiError(404, "Request not found");
  // This capability lookup deliberately returns no name, contact, dates, room,
  // price, note, or organization data before guest OTP is activated.
  const status = { status: request.status, createdAt: request.createdAt.toISOString(), updatedAt: request.updatedAt.toISOString() };
  if (request.roomTypeSlug === null && request.ratePlanCode === null) return status;
  return { ...status, availabilityHint: request.availabilityHint, managerMessage: request.managerMessage };
}
