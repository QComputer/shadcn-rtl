import { ApiError, jsonError, requireSameOriginMutation } from "@/lib/api-guards";
import { checkHotelGuestRequestRateLimit } from "@/lib/hotel/guest-request-rate-limit.server";
import { hotelGuestBookingRequestSchema } from "@/lib/hotel/validation/hotel-contracts";
import { parseJsonObject } from "@/lib/hotel/management/api-adapter";
import { readBoundedJson } from "@/lib/security/bounded-json";
import { submitHotelGuestBookingRequest } from "@/lib/hotel/guest-booking-request.server";
import { resolveHotelTenantForHost } from "@/lib/hotel/services/hotel-publication.service";

export async function POST(request: Request) {
  try {
    requireSameOriginMutation(request);
    const idempotencyKey = request.headers.get("idempotency-key")?.trim();
    if (!idempotencyKey || idempotencyKey.length < 16 || idempotencyKey.length > 128) throw new ApiError(400, "A valid Idempotency-Key is required");
    const body = parseJsonObject(await readBoundedJson(request, { maxBytes: 24 * 1024 }));
    const tenant = await resolveHotelTenantForHost(request.headers.get("host"));
    if (!tenant) throw new ApiError(404, "Hotel is not available");
    const rate = await checkHotelGuestRequestRateLimit({ organizationId: tenant.organizationId, endpoint: "create" });
    if (rate.storeUnavailable) return Response.json({ error: "Guest request protection is temporarily unavailable" }, { status: 503, headers: { "Retry-After": "1", "Cache-Control": "no-store" } });
    if (!rate.allowed) return Response.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds), "Cache-Control": "no-store" } });
    const input = hotelGuestBookingRequestSchema.parse(body);
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
