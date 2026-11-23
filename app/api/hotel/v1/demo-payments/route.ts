import { Prisma } from "@prisma/client";
import { z } from "zod";
import { ApiError, jsonError } from "@/lib/api-guards";
import prisma from "@/lib/db";
import { parseJsonObject } from "@/lib/hotel/management/api-adapter";
import { guardReservationTransition } from "@/lib/hotel/domain/booking-state";
import { resolveDamoonDemoProperty } from "@/lib/hotel/services/damoon-demo-booking.server";

const schema = z.object({
  property: z.literal("damoon-demo"),
  reference: z.string().min(8).max(40),
  outcome: z.enum(["SUCCESS", "FAILURE"]),
  idempotencyKey: z.string().min(8).max(128),
});

/** A no-charge demonstration outcome. It never creates PaymentRequest or payment-allocation rows. */
export async function POST(request: Request) {
  try {
    const input = schema.parse(parseJsonObject(await request.json()));
    const demo = await resolveDamoonDemoProperty(request.headers.get("host"), input.property);
    if (!demo) throw new ApiError(404, "Demo booking is not available");
    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "HotelReservation" WHERE "organizationId"=${demo.organizationId} AND "propertyId"=${demo.propertyId} AND "reference"=${input.reference} FOR UPDATE`);
      const reservation = await tx.hotelReservation.findFirst({
        where: { organizationId: demo.organizationId, propertyId: demo.propertyId, reference: input.reference },
        include: { hold: true },
      });
      if (!reservation) throw new ApiError(404, "Demo reservation is not available");
      if (input.outcome === "FAILURE") {
        if (reservation.status !== "PENDING_PAYMENT") throw new ApiError(409, "Demo reservation is no longer awaiting simulated payment");
        return { outcome: "SIMULATED_FAILURE" as const, status: reservation.status, replay: false };
      }
      if (reservation.status === "CONFIRMED") return { outcome: "SIMULATED_SUCCESS" as const, status: reservation.status, replay: true };
      // Reservation creation consumes the active inventory hold. The consumed
      // hold remains the proof that this pending demo reservation came through
      // the atomic hold flow; it is payable only until that original expiry.
      if (reservation.status !== "PENDING_PAYMENT" || !reservation.hold || reservation.hold.status !== "CONSUMED" || reservation.hold.expiresAt <= new Date()) {
        throw new ApiError(409, "Demo hold expired or is no longer payable");
      }
      const now = new Date();
      const transition = guardReservationTransition({ current: "PENDING_PAYMENT", transition: "CONFIRM", event: { type: "DEMO_PAYMENT_VERIFIED" }, now: now.toISOString(), isDemoBooking: true });
      if (!transition.allows) throw new ApiError(409, transition.reason || "Demo confirmation is not allowed");
      const updated = await tx.hotelReservation.updateMany({
        where: { id: reservation.id, organizationId: demo.organizationId, propertyId: demo.propertyId, status: "PENDING_PAYMENT", paidAmount: BigInt(0) },
        data: { status: "CONFIRMED", confirmedAt: now, version: { increment: 1 } },
      });
      if (updated.count !== 1) throw new ApiError(409, "Demo reservation changed; retry the same demonstration");
      return { outcome: "SIMULATED_SUCCESS" as const, status: "CONFIRMED", replay: false };
    }, { isolationLevel: "Serializable" });
    return Response.json({ mode: "DEMO_BOOKING", synthetic: true, payment: result.outcome, reservationStatus: result.status, idempotentReplay: result.replay, charged: false });
  } catch (error) {
    return jsonError(error);
  }
}
