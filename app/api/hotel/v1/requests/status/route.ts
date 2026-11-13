import { ApiError, jsonError, requireSameOriginMutation } from "@/lib/api-guards";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { parseJsonObject } from "@/lib/hotel/management/api-adapter";
import { hotelGuestBookingRequestStatusSchema } from "@/lib/hotel/validation/hotel-contracts";
import { readHotelGuestBookingRequestStatus } from "@/lib/hotel/guest-booking-request.server";

export async function POST(request: Request) {
  try {
    requireSameOriginMutation(request);
    const host = request.headers.get("host") ?? "unknown";
    const rate = checkRateLimit({ key: `hotel-guest-request:status:${host}:${getClientIp(request.headers)}`, limit: 12, windowMs: 10 * 60_000 });
    if (!rate.allowed) return Response.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds), "Cache-Control": "no-store" } });
    const input = hotelGuestBookingRequestStatusSchema.parse(parseJsonObject(await request.json()));
    const status = await readHotelGuestBookingRequestStatus(input.reference, request.headers.get("host"));
    return Response.json(status, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return jsonError(error);
  }
}
