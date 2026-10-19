import { propertySlugSchema, roomTypeSlugSchema } from "@/lib/hotel/validation/hotel-contracts";
import { publicHotelRoomPoliciesResponseSchema } from "@/lib/hotel/public-api-contract";
import { parsePublicHotelLocale, publicHotelJson } from "@/lib/hotel/public-api-http";
import { listPublishedHotelRoomPolicies } from "@/lib/hotel/services/public-catalog.service";
import { isApprovedHotelPublicationAvailable } from "@/lib/hotel/services/public-publication-gate";

export async function GET(request: Request, { params }: { params: Promise<{ propertySlug: string; roomTypeSlug: string }> }) {
  const locale = parsePublicHotelLocale(request.url);
  if ("error" in locale) return publicHotelJson({ error: "INVALID_REQUEST" }, 400);
  if (!isApprovedHotelPublicationAvailable()) return publicHotelJson({ error: "PUBLICATION_DISABLED" }, 503);

  const { propertySlug, roomTypeSlug } = await params;
  const parsedPropertySlug = propertySlugSchema.safeParse(propertySlug);
  const parsedRoomTypeSlug = roomTypeSlugSchema.safeParse(roomTypeSlug);
  if (!parsedPropertySlug.success || !parsedRoomTypeSlug.success) return publicHotelJson({ error: "INVALID_REQUEST" }, 400);

  try {
    const result = await listPublishedHotelRoomPolicies({
      host: request.headers.get("host"),
      propertySlug: parsedPropertySlug.data,
      roomTypeSlug: parsedRoomTypeSlug.data,
      locale: locale.locale,
    });
    if (!result) return publicHotelJson({ error: "NOT_FOUND" }, 404);
    return publicHotelJson(publicHotelRoomPoliciesResponseSchema.parse(result));
  } catch {
    return publicHotelJson({ error: "UNAVAILABLE" }, 500);
  }
}
