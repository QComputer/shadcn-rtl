import { Prisma } from "@prisma/client";
import { ApiError, jsonError } from "@/lib/api-guards";
import prisma from "@/lib/db";
import { parseJsonObject } from "@/lib/hotel/management/api-adapter";
import { z } from "zod";
import { hotelSandboxPaymentsEnabled, verifyHotelSandboxPaymentTicket } from "@/lib/hotel/services/hotel-sandbox-payment";

const schema = z.object({ ticket: z.string().min(32).max(2048) });

export async function POST(request: Request) {
  try {
    if (!hotelSandboxPaymentsEnabled()) throw new ApiError(503, "Hotel sandbox payment is not enabled for this environment");
    const { ticket } = schema.parse(parseJsonObject(await request.json()));
    const payload = verifyHotelSandboxPaymentTicket(ticket, Date.now(), true);
    if (!payload) throw new ApiError(400, "Sandbox payment ticket is invalid or expired");
    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "HotelReservation" WHERE "id"=${payload.reservationId} AND "organizationId"=${payload.organizationId} FOR UPDATE`);
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "PaymentRequest" WHERE "publicId"=${payload.paymentId} AND "organizationId"=${payload.organizationId} FOR UPDATE`);
      const payment = await tx.paymentRequest.findFirst({ where: { publicId: payload.paymentId, organizationId: payload.organizationId, orderId: null, appointmentId: null } });
      const metadata = payment?.metadata && typeof payment.metadata === "object" && !Array.isArray(payment.metadata) ? payment.metadata as { simulated?: boolean; hotelSandbox?: boolean; hotelReservationId?: string; hotelPropertyId?: string } : null;
      if (!payment || !metadata || metadata.simulated !== true || metadata.hotelSandbox !== true || metadata.hotelReservationId !== payload.reservationId || payment.purpose !== "RESERVATION_BALANCE" || payment.providerIntegrationId || payment.amountToman <= BigInt(0) || payment.currency !== "TOMAN") throw new ApiError(409, "Sandbox payment is not eligible for verification");
      const reservation = await tx.hotelReservation.findFirst({ where: { id: payload.reservationId, organizationId: payload.organizationId }, include: { hold: true } });
      if (!reservation || metadata.hotelPropertyId !== reservation.propertyId || reservation.totalAmount !== payment.amountToman) throw new ApiError(409, "Reservation is not eligible for sandbox payment");
      if (payment.status === "PAID") {
        const allocation = await tx.hotelPaymentAllocation.findUnique({ where: { paymentRequestPublicId: payment.publicId } });
        if (!allocation || allocation.organizationId !== payload.organizationId || allocation.hotelReservationId !== reservation.id || allocation.kind !== "BALANCE" || allocation.amountToman !== payment.amountToman || reservation.paidAmount < payment.amountToman) throw new ApiError(409, "Sandbox payment replay does not match the reservation");
        return { isReplay: true, reservationStatus: reservation.status };
      }
      if (payload.expiresAt <= Date.now() || (payment.expiresAt && payment.expiresAt.getTime() < Date.now()) || !reservation.hold || reservation.hold.expiresAt.getTime() < Date.now()) throw new ApiError(409, "Sandbox payment ticket or reservation expired");
      if (payment.status !== "AWAITING_CUSTOMER" || reservation.status !== "PENDING_PAYMENT" || reservation.paidAmount !== BigInt(0)) throw new ApiError(409, "Reservation or payment status changed");
      const paidAt = new Date();
      await tx.hotelPaymentAllocation.create({ data: { organizationId: payload.organizationId, hotelReservationId: reservation.id, paymentRequestPublicId: payment.publicId, kind: "BALANCE", amountToman: payment.amountToman } });
      await tx.paymentRequest.update({ where: { id: payment.id }, data: { status: "PAID", paidAt } });
      await tx.hotelReservation.update({ where: { id: reservation.id }, data: { paidAmount: payment.amountToman, version: { increment: 1 } } });
      return { isReplay: false, reservationStatus: "PENDING_PAYMENT" };
    }, { isolationLevel: "Serializable" });
    return Response.json({ paymentStatus: "PAID", reservationStatus: result.reservationStatus, receptionConfirmationRequired: true, simulated: true, idempotentReplay: result.isReplay });
  } catch (error) { return jsonError(error); }
}
