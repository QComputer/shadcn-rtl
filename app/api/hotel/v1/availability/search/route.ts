import { ApiError, jsonError } from "@/lib/api-guards";
import { parseJsonObject } from "@/lib/hotel/management/api-adapter";
import { availabilitySearchSchema } from "@/lib/hotel/validation/hotel-contracts";
import { searchPublicHotelAvailability, searchPublishedHotelAvailability, serializePublicAvailability } from "@/lib/hotel/services/public-availability.service";
import { HOTEL_PUBLICATION_GATE_MESSAGE, isApprovedHotelPublicationAvailable } from "@/lib/hotel/services/public-publication-gate";
import { resolveDamoonDemoProperty } from "@/lib/hotel/services/damoon-demo-booking.server";

export async function POST(request: Request) {
  try {
    const body = availabilitySearchSchema.parse(parseJsonObject(await request.json()));
    const host = request.headers.get("host");
    const demo = await resolveDamoonDemoProperty(host, body.property);
    if (!demo && !isApprovedHotelPublicationAvailable()) throw new ApiError(503, HOTEL_PUBLICATION_GATE_MESSAGE);
    const result = demo
      ? await searchPublicHotelAvailability({ scope: { organizationId: demo.organizationId }, propertySlug: demo.propertySlug, query: {
        propertyId: demo.propertyId,
        window: { checkIn: body.checkIn, checkOut: body.checkOut },
        occupancy: body.occupancy,
        roomTypeIds: body.roomTypes,
        ratePlanId: body.ratePlan,
        requiredAmenities: body.amenities,
        maxNightlyRate: body.maxNightlyRate,
      } })
      : await searchPublishedHotelAvailability(host, body);
    if (!result) throw new ApiError(404, "Hotel availability is not available");
    return Response.json({ ...serializePublicAvailability(result), ...(demo ? { mode: "DEMO_BOOKING", synthetic: true } : {}) });
  } catch (error) { return jsonError(error); }
}
