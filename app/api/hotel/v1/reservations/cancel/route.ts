import { Prisma } from "@prisma/client";
import { z } from "zod";
import { ApiError, jsonError } from "@/lib/api-guards";
import prisma from "@/lib/db";
import { parseJsonObject } from "@/lib/hotel/management/api-adapter";
import { createPrismaHotelRepositories } from "@/lib/hotel/persistence/prisma-hotel-repositories";
import { hashCustomerIdentifier, normalizeCustomerPhone } from "@/lib/customer-identity/customer-identity.service";
import { resolveHotelTenantForHost } from "@/lib/hotel/services/hotel-publication.service";

const schema = z.object({ reference: z.string().min(8).max(40), contactPhone: z.string().min(8).max(24) });

export async function POST(request: Request) {
  try {
    if (process.env.HOTEL_ANONYMOUS_RESERVATION_OPERATIONAL_ENABLED !== "1") throw new ApiError(503, "Anonymous hotel reservations are not operationally enabled");
    const input = schema.parse(parseJsonObject(await request.json()));
    const tenant = await resolveHotelTenantForHost(request.headers.get("host"));
    const phone = normalizeCustomerPhone(input.contactPhone);
    if (!tenant || !phone) throw new ApiError(404, "Reservation is not available");
    const phoneHash = hashCustomerIdentifier(tenant.organizationId, phone);
    const repository = createPrismaHotelRepositories();
    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "HotelReservation" WHERE "organizationId"=${tenant.organizationId} AND "reference"=${input.reference} FOR UPDATE`);
      const booking = await tx.hotelReservation.findFirst({ where: { organizationId: tenant.organizationId, reference: input.reference }, include: { guests: true } });
      const primary = booking?.guests.find((guest) => guest.isPrimary);
      if (!booking || primary?.phoneHash !== phoneHash) throw new ApiError(404, "Reservation is not available");
      if (booking.status === "CANCELLED") return { status: "CANCELLED", replay: true };
      if (booking.status !== "PENDING_PAYMENT" || booking.paidAmount !== BigInt(0)) throw new ApiError(409, "Paid or reception-confirmed reservations must be cancelled by reception");
      const cancelled = await repository.cancelReservationAndReleaseInventory({ scope: { organizationId: tenant.organizationId }, reservationId: booking.id, expectedStatus: ["PENDING_PAYMENT"], now: new Date() }, tx);
      if (!cancelled.isUpdated) throw new ApiError(409, "Reservation status changed; refresh its status");
      await tx.paymentRequest.updateMany({ where: { organizationId: tenant.organizationId, purpose: "RESERVATION_BALANCE", status: { in: ["CREATED", "AWAITING_CUSTOMER"] }, metadata: { path: ["hotelReservationId"], equals: booking.id } }, data: { status: "CANCELLED", cancelledAt: new Date() } });
      return { status: "CANCELLED", replay: false };
    }, { isolationLevel: "Serializable" });
    return Response.json({ reference: input.reference, status: result.status, idempotentReplay: result.replay });
  } catch (error) { return jsonError(error); }
}
