import { ApiError, jsonError, requireSameOriginMutation } from "@/lib/api-guards";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { hotelGuestBookingRequestSchema } from "@/lib/hotel/validation/hotel-contracts";
import { parseJsonObject } from "@/lib/hotel/management/api-adapter";
import { submitHotelGuestBookingRequest } from "@/lib/hotel/guest-booking-request.server";

export async function POST(request: Request) {
  try {
    requireSameOriginMutation(request);
    const idempotencyKey = request.headers.get("idempotency-key")?.trim();
    if (!idempotencyKey || idempotencyKey.length < 16 || idempotencyKey.length > 128) throw new ApiError(400, "A valid Idempotency-Key is required");
    const host = request.headers.get("host") ?? "unknown";
    const rate = checkRateLimit({ key: `hotel-guest-request:create:${host}:${getClientIp(request.headers)}`, limit: 5, windowMs: 15 * 60_000 });
    if (!rate.allowed) return Response.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds), "Cache-Control": "no-store" } });
    const input = hotelGuestBookingRequestSchema.parse(parseJsonObject(await request.json()));
    const result = await submitHotelGuestBookingRequest(input, request.headers, idempotencyKey);
    return Response.json({
      reference: result.reference,
      status: result.status,
      availabilityHint: result.availabilityHint,
      inventoryReserved: false,
      bookingConfirmed: false,
    }, { status: result.replay ? 200 : 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return jsonError(error);
  }
}
