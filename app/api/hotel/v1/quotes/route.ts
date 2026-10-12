import { ApiError, jsonError } from "@/lib/api-guards";
import { parseJsonObject } from "@/lib/hotel/management/api-adapter";
import { availabilitySearchSchema } from "@/lib/hotel/validation/hotel-contracts";
import { searchPublishedHotelAvailability, serializePublicAvailability } from "@/lib/hotel/services/public-availability.service";
import { HOTEL_PUBLICATION_GATE_MESSAGE, isApprovedHotelPublicationAvailable } from "@/lib/hotel/services/public-publication-gate";

export async function POST(request: Request) {
  try {
    if (!isApprovedHotelPublicationAvailable()) throw new ApiError(503, HOTEL_PUBLICATION_GATE_MESSAGE);
    const body = availabilitySearchSchema.parse(parseJsonObject(await request.json()));
    const result = await searchPublishedHotelAvailability(request.headers.get("host"), body);
    if (!result) throw new ApiError(404, "Hotel quote is not available");
    return Response.json(serializePublicAvailability(result));
  } catch (error) { return jsonError(error); }
}
