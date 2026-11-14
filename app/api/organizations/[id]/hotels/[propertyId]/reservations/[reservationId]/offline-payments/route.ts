import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { ApiError, jsonError, requireAuthSession, requireSameOriginMutation } from "@/lib/api-guards";
import { prisma } from "@/lib/db-runtime";
import { authorizeHotelBookingActor } from "@/lib/hotel/services/booking-context";
import { createHotelOfflinePaymentService } from "@/lib/hotel/offline-payments/service";
import { createPrismaHotelOfflinePaymentRepository } from "@/lib/hotel/offline-payments/prisma-repository";
import { readBoundedJson } from "@/lib/security/bounded-json";

const command = z.discriminatedUnion("action", [
  z.object({ action: z.literal("RECORD_CASH"), amountToman: z.string().regex(/^[1-9][0-9]{0,14}$/) }).strict(),
  z.object({ action: z.literal("VERIFY_BANK_TRANSFER"), ledgerEntryId: z.string().min(1).max(200) }).strict(),
  z.object({ action: z.literal("SUBMIT_BANK_TRANSFER"), amountToman: z.string().regex(/^[1-9][0-9]{0,14}$/), bankReference: z.string().trim().min(1).max(160) }).strict(),
]);
type Params = { params: Promise<{ id: string; propertyId: string; reservationId: string }> };

async function authorize(request: NextRequest, params: Params) {
  if (process.env.HOTEL_OPERATIONAL_RESERVATIONS_ENABLED !== "1" || process.env.HOTEL_OFFLINE_PAYMENT_OPERATIONAL_ENABLED !== "1") {
    throw new ApiError(503, "Offline hotel payments are not enabled");
  }
  const { id, propertyId, reservationId } = await params.params;
  const session = await requireAuthSession(request);
  if (!["ADMIN", "MANAGER", "STAFF", "CUSTOMER"].includes(session.user.role)) throw new ApiError(403, "Hotel access required");
  await authorizeHotelBookingActor(prisma, { userId: session.user.id, role: session.user.role, organizationId: session.user.organizationId, customerContextVerified: session.user.role === "CUSTOMER" && session.customerContext?.organizationId === id }, id, propertyId);
  return { organizationId: id, propertyId, reservationId, userId: session.user.id, role: session.user.role };
}

export async function GET(request: NextRequest, params: Params) {
  try {
    const scope = await authorize(request, params);
    const reservation = await prisma.hotelReservation.findFirst({ where: { id: scope.reservationId, organizationId: scope.organizationId, propertyId: scope.propertyId }, select: { totalAmount: true, paidAmount: true, guestCustomerId: true } });
    if (!reservation) throw new ApiError(404, "Reservation not found");
    if (scope.role === "CUSTOMER" && (!reservation.guestCustomerId || !await prisma.customerIdentity.findFirst({ where: { organizationId: scope.organizationId, userId: scope.userId, guestCustomerId: reservation.guestCustomerId, status: "ACTIVE" }, select: { id: true } }))) throw new ApiError(404, "Reservation not found");
    const entries = await prisma.$queryRaw<Array<{ id: string; method: string; status: string; amountToman: bigint; createdAt: Date; verifiedAt: Date | null }>>(Prisma.sql`
      SELECT "id", "method"::text, "status"::text, "amountToman", "createdAt", "verifiedAt"
      FROM "HotelOfflinePayment" WHERE "organizationId" = ${scope.organizationId} AND "reservationId" = ${scope.reservationId}
      ORDER BY "createdAt" DESC LIMIT 100
    `);
    return NextResponse.json({ totalToman: reservation.totalAmount.toString(), paidToman: reservation.paidAmount.toString(), outstandingToman: (reservation.totalAmount > reservation.paidAmount ? reservation.totalAmount - reservation.paidAmount : BigInt(0)).toString(), entries: entries.map((entry) => ({ ...entry, amountToman: entry.amountToman.toString() })) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return jsonError(error); }
}

export async function POST(request: NextRequest, params: Params) {
  try {
    requireSameOriginMutation(request);
    const scope = await authorize(request, params);
    if (!await prisma.hotelReservation.findFirst({ where: { id: scope.reservationId, organizationId: scope.organizationId, propertyId: scope.propertyId }, select: { id: true } })) throw new ApiError(404, "Reservation not found");
    const body = command.parse(await readBoundedJson(request, { maxBytes: 8 * 1024 }));
    const key = request.headers.get("idempotency-key") ?? "";
    const service = createHotelOfflinePaymentService({ repository: createPrismaHotelOfflinePaymentRepository(prisma), now: () => new Date() });
    if (body.action === "SUBMIT_BANK_TRANSFER" && scope.role !== "CUSTOMER") throw new ApiError(403, "Guest access required");
    if (body.action === "RECORD_CASH" && scope.role === "CUSTOMER") throw new ApiError(403, "Reception access required");
    if (body.action === "VERIFY_BANK_TRANSFER" && !["ADMIN", "MANAGER"].includes(scope.role)) throw new ApiError(403, "Management access required");
    const permissions = body.action === "RECORD_CASH" ? ["hotel:offline-payment:record-cash" as const] : body.action === "VERIFY_BANK_TRANSFER" ? ["hotel:offline-payment:verify-transfer" as const] : ["hotel:offline-payment:submit-transfer" as const];
    const actor = { organizationId: scope.organizationId, userId: scope.userId, permissions };
    const result = body.action === "RECORD_CASH" ? await service.recordCash({ actor, reservationId: scope.reservationId, idempotencyKey: key, amountToman: BigInt(body.amountToman) }) : body.action === "VERIFY_BANK_TRANSFER" ? await service.verifyBankTransfer({ actor, reservationId: scope.reservationId, idempotencyKey: key, ledgerEntryId: body.ledgerEntryId }) : await service.submitBankTransfer({ actor, reservationId: scope.reservationId, idempotencyKey: key, amountToman: BigInt(body.amountToman), bankReference: body.bankReference });
    if (result.outcome !== "APPLIED" && result.outcome !== "REPLAY") throw new ApiError(result.outcome === "NOT_FOUND" ? 404 : result.outcome === "UNAUTHORIZED" ? 403 : 409, result.outcome);
    return NextResponse.json({ outcome: result.outcome, entry: { ...result.entry, amountToman: result.entry.amountToman.toString() } }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return jsonError(error); }
}
