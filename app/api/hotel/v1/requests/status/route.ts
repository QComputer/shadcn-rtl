import { ApiError, jsonError, requireSameOriginMutation } from "@/lib/api-guards";
import { checkHotelGuestRequestRateLimit } from "@/lib/hotel/guest-request-rate-limit.server";
import { parseJsonObject } from "@/lib/hotel/management/api-adapter";
import { readBoundedJson } from "@/lib/security/bounded-json";
import { hotelGuestBookingRequestStatusSchema } from "@/lib/hotel/validation/hotel-contracts";
import { readHotelGuestBookingRequestStatus } from "@/lib/hotel/guest-booking-request.server";
import { resolveHotelTenantForHost } from "@/lib/hotel/services/hotel-publication.service";

export async function POST(request: Request) {
  try {
    requireSameOriginMutation(request);
    const body = parseJsonObject(await readBoundedJson(request, { maxBytes: 24 * 1024 }));
    const tenant = await resolveHotelTenantForHost(request.headers.get("host"));
    if (!tenant) throw new ApiError(404, "Hotel is not available");
    const rate = await checkHotelGuestRequestRateLimit({ organizationId: tenant.organizationId, endpoint: "status" });
    if (rate.storeUnavailable) return Response.json({ error: "Guest request protection is temporarily unavailable" }, { status: 503, headers: { "Retry-After": "1", "Cache-Control": "no-store" } });
    if (!rate.allowed) return Response.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds), "Cache-Control": "no-store" } });
    const input = hotelGuestBookingRequestStatusSchema.parse(body);
    const status = await readHotelGuestBookingRequestStatus(input.reference, request.headers.get("host"));
    return Response.json(status, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return jsonError(error);
  }
}
