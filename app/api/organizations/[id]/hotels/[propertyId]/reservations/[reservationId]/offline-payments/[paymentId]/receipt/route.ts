import { NextRequest, NextResponse } from "next/server";
import { ApiError, jsonError, requireAuthSession, requireSameOriginMutation } from "@/lib/api-guards";
import { prisma } from "@/lib/db-runtime";
import { authorizeHotelBookingActor } from "@/lib/hotel/services/booking-context";
import { readHotelPaymentReceipt, removeHotelPaymentReceipt, storeHotelPaymentReceipt } from "@/lib/hotel/offline-payments/receipt-storage.server";

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_MULTIPART_BYTES = MAX_FILE_BYTES + 64 * 1024;
const receiptTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
type Params = { params: Promise<{ id: string; propertyId: string; reservationId: string; paymentId: string }> };
type HotelOfflinePaymentRow = {
  id: string;
  method: string;
  status: string;
  receiptKey: string | null;
  reservation: { guestCustomerId: string | null };
};
type HotelOfflinePaymentDelegate = {
  findFirst(args: unknown): Promise<HotelOfflinePaymentRow | null>;
  updateMany(args: unknown): Promise<{ count: number }>;
};

function offlinePaymentDelegate(): HotelOfflinePaymentDelegate {
  return (prisma as unknown as { hotelOfflinePayment: HotelOfflinePaymentDelegate }).hotelOfflinePayment;
}

async function authorizedScope(request: NextRequest, params: Params) {
  if (process.env.HOTEL_OPERATIONAL_RESERVATIONS_ENABLED !== "1" || process.env.HOTEL_OFFLINE_PAYMENT_OPERATIONAL_ENABLED !== "1") {
    throw new ApiError(503, "Offline hotel payments are not enabled");
  }
  const { id, propertyId, reservationId, paymentId } = await params.params;
  const session = await requireAuthSession(request);
  if (!["ADMIN", "MANAGER", "STAFF", "CUSTOMER"].includes(session.user.role)) throw new ApiError(403, "Hotel access required");
  const customerContextVerified = session.user.role === "CUSTOMER" && session.customerContext?.organizationId === id;
  await authorizeHotelBookingActor(prisma, {
    userId: session.user.id,
    role: session.user.role,
    organizationId: session.user.organizationId,
    customerContextVerified,
  }, id, propertyId);
  if (session.user.role === "CUSTOMER" && !customerContextVerified) throw new ApiError(403, "Customer context required");
  return { organizationId: id, propertyId, reservationId, paymentId, userId: session.user.id, role: session.user.role };
}

async function findPayment(scope: Awaited<ReturnType<typeof authorizedScope>>) {
  return offlinePaymentDelegate().findFirst({
    where: {
      id: scope.paymentId,
      organizationId: scope.organizationId,
      reservationId: scope.reservationId,
      method: "BANK_TRANSFER",
      reservation: { organizationId: scope.organizationId, propertyId: scope.propertyId },
    },
    select: { id: true, method: true, status: true, receiptKey: true, reservation: { select: { guestCustomerId: true } } },
  });
}

async function assertGuestOwnsReservation(scope: Awaited<ReturnType<typeof authorizedScope>>, payment: HotelOfflinePaymentRow) {
  if (!payment.reservation.guestCustomerId) throw new ApiError(404, "Payment not found");
  const identity = await prisma.customerIdentity.findFirst({
    where: { organizationId: scope.organizationId, userId: scope.userId, guestCustomerId: payment.reservation.guestCustomerId, status: "ACTIVE" },
    select: { id: true },
  });
  if (!identity) throw new ApiError(404, "Payment not found");
}

async function readBoundedForm(request: NextRequest) {
  if (!(request.headers.get("content-type") ?? "").toLowerCase().startsWith("multipart/form-data;")) {
    throw new ApiError(415, "A multipart receipt image is required");
  }
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_MULTIPART_BYTES) throw new ApiError(413, "Receipt upload is too large");
  if (!request.body) throw new ApiError(400, "Receipt image is required");

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > MAX_MULTIPART_BYTES) {
      await reader.cancel();
      throw new ApiError(413, "Receipt upload is too large");
    }
    chunks.push(value);
  }
  const boundedRequest = new Request(request.url, {
    method: "POST",
    headers: request.headers,
    body: Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))),
  });
  try { return await boundedRequest.formData(); }
  catch { throw new ApiError(400, "Invalid receipt upload"); }
}

export async function POST(request: NextRequest, params: Params) {
  try {
    requireSameOriginMutation(request);
    const scope = await authorizedScope(request, params);
    if (scope.role !== "CUSTOMER") throw new ApiError(403, "Guest receipt upload required");
    const payment = await findPayment(scope);
    if (!payment || payment.method !== "BANK_TRANSFER") throw new ApiError(404, "Payment not found");
    if (payment.status !== "SUBMITTED") throw new ApiError(409, "Receipt can only be attached to a submitted transfer");
    await assertGuestOwnsReservation(scope, payment);
    if (payment.receiptKey) throw new ApiError(409, "A receipt is already attached");

    const form = await readBoundedForm(request);
    if ([...form.keys()].some((key) => key !== "receipt") || form.getAll("receipt").length !== 1) throw new ApiError(400, "Upload one receipt image");
    const file = form.get("receipt");
    if (!(file instanceof File)) throw new ApiError(400, "Receipt image is required");
    if (!file.size || file.size > MAX_FILE_BYTES) throw new ApiError(413, "Receipt image must be 5 MB or smaller");
    if (!receiptTypes.has(file.type)) throw new ApiError(415, "Unsupported receipt image type");
    const key = await storeHotelPaymentReceipt(scope.organizationId, Buffer.from(await file.arrayBuffer()), file.type);
    const updated = await offlinePaymentDelegate().updateMany({
      where: { id: scope.paymentId, organizationId: scope.organizationId, reservationId: scope.reservationId, method: "BANK_TRANSFER", status: "SUBMITTED", receiptKey: null },
      data: { receiptKey: key },
    });
    if (updated.count !== 1) {
      // Only delete after a definite zero-row update; a database error can have an unknown commit outcome.
      await removeHotelPaymentReceipt(scope.organizationId, key).catch(() => undefined);
      throw new ApiError(409, "Receipt could not be attached");
    }
    return NextResponse.json({ attached: true }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return jsonError(error); }
}

export async function GET(request: NextRequest, params: Params) {
  try {
    const scope = await authorizedScope(request, params);
    const payment = await findPayment(scope);
    if (!payment || payment.method !== "BANK_TRANSFER" || !payment.receiptKey) throw new ApiError(404, "Receipt not found");
    if (scope.role === "CUSTOMER") await assertGuestOwnsReservation(scope, payment);
    const receipt = await readHotelPaymentReceipt(scope.organizationId, payment.receiptKey);
    if (!receiptTypes.has(receipt.contentType)) throw new ApiError(404, "Receipt not found");
    return new NextResponse(new Uint8Array(receipt.buffer), { headers: {
      "Cache-Control": "private, no-store",
      "Content-Type": receipt.contentType,
      "Content-Disposition": "inline",
      "X-Content-Type-Options": "nosniff",
    } });
  } catch (error) { return jsonError(error); }
}
