import { z } from "zod";
import { ApiError, jsonError } from "@/lib/api-guards";
import prisma from "@/lib/db";
import { Prisma } from "@prisma/client";
import { parseJsonObject } from "@/lib/hotel/management/api-adapter";
import { hashCustomerIdentifier, normalizeCustomerPhone } from "@/lib/customer-identity/customer-identity.service";
import { resolveHotelTenantForHost } from "@/lib/hotel/services/hotel-publication.service";
import { hotelSandboxPaymentsEnabled, issueHotelSandboxPaymentTicket } from "@/lib/hotel/services/hotel-sandbox-payment";

const schema = z.object({ reference: z.string().min(8).max(40), contactPhone: z.string().min(8).max(24), idempotencyKey: z.string().min(8).max(128) });

export async function POST(request: Request) {
  try {
    if (!hotelSandboxPaymentsEnabled()) throw new ApiError(503, "Hotel sandbox payment is not enabled for this environment");
    const body = schema.parse(parseJsonObject(await request.json()));
    const tenant = await resolveHotelTenantForHost(request.headers.get("host"));
    if (!tenant) throw new ApiError(404, "Hotel is not available");
    const phone = normalizeCustomerPhone(body.contactPhone);
    if (!phone) throw new ApiError(400, "A valid guest mobile number is required");
    const phoneHash = hashCustomerIdentifier(tenant.organizationId, phone);
    const reservation = await prisma.hotelReservation.findFirst({ where: { organizationId: tenant.organizationId, reference: body.reference }, select: { id: true } });
    if (!reservation) throw new ApiError(404, "Reservation is not available");
    const payment = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "HotelReservation" WHERE "id"=${reservation.id} AND "organizationId"=${tenant.organizationId} FOR UPDATE`);
      const current = await tx.hotelReservation.findFirst({ where: { id: reservation.id, organizationId: tenant.organizationId, reference: body.reference }, include: { guests: true, hold: true } });
      const guest = current?.guests.find((item) => item.isPrimary);
      if (!current || guest?.phoneHash !== phoneHash) throw new ApiError(404, "Reservation is not available");
      if (current.status !== "PENDING_PAYMENT" || current.totalAmount <= BigInt(0) || current.paidAmount > BigInt(0) || !current.hold || current.hold.expiresAt <= new Date()) throw new ApiError(409, "Reservation is not eligible for sandbox payment");
      const identity = await tx.customerIdentity.findFirst({ where: { organizationId: tenant.organizationId, phoneHash }, select: { id: true } });
      if (!identity) throw new ApiError(404, "Reservation is not available");
      const lockKey = JSON.stringify([tenant.organizationId, body.idempotencyKey]);
      await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`);
      const existing = await tx.paymentRequest.findFirst({ where: { organizationId: tenant.organizationId, purpose: "RESERVATION_BALANCE", metadata: { path: ["hotelSandboxIdempotencyKey"], equals: body.idempotencyKey } } });
      if (existing) {
        const metadata = existing.metadata as { hotelReservationId?: string } | null;
        if (metadata?.hotelReservationId !== current.id || existing.amountToman !== current.totalAmount) throw new ApiError(409, "Payment idempotency key conflicts with another request");
        return existing;
      }
      return tx.paymentRequest.create({ data: {
        organizationId: tenant.organizationId,
        customerIdentityId: identity.id,
        amountToman: current.totalAmount,
        currency: current.currency,
        purpose: "RESERVATION_BALANCE",
        status: "AWAITING_CUSTOMER",
        expiresAt: current.hold.expiresAt,
        metadata: { simulated: true, hotelSandbox: true, hotelReservationId: current.id, hotelPropertyId: current.propertyId, hotelSandboxIdempotencyKey: body.idempotencyKey },
      } });
    }, { isolationLevel: "Serializable" });
    if (payment.expiresAt && payment.expiresAt <= new Date()) throw new ApiError(409, "Reservation payment window expired");
    const ticketExpiresAt = Math.min(payment.expiresAt?.getTime() ?? Date.now(), Date.now() + 5 * 60_000);
    const ticket = issueHotelSandboxPaymentTicket({ paymentId: payment.publicId, reservationId: reservation.id, organizationId: tenant.organizationId, expiresAt: ticketExpiresAt });
    return Response.json({ ticket, paymentStatus: payment.status, amountToman: String(payment.amountToman), currency: payment.currency, expiresAt: new Date(ticketExpiresAt).toISOString(), simulated: true }, { status: 201 });
  } catch (error) { return jsonError(error); }
}
