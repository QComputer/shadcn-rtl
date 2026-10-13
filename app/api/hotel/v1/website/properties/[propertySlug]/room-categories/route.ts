import { propertySlugSchema } from "@/lib/hotel/validation/hotel-contracts";
import { parsePublicHotelLocale, publicHotelJson } from "@/lib/hotel/public-api-http";
import { listPublishedHotelWebsiteRoomCategories } from "@/lib/hotel/content/hotel-website-public.service";
import { hotelWebsiteRoomCategoriesResponseSchema } from "@/lib/hotel/content/hotel-website-public-contract";

export async function GET(request: Request, { params }: { params: Promise<{ propertySlug: string }> }) {
  const locale = parsePublicHotelLocale(request.url);
  if ("error" in locale) return publicHotelJson({ error: "INVALID_REQUEST" }, 400);
  const { propertySlug } = await params;
  const parsed = propertySlugSchema.safeParse(propertySlug);
  if (!parsed.success) return publicHotelJson({ error: "INVALID_REQUEST" }, 400);
  try {
    const result = await listPublishedHotelWebsiteRoomCategories({ host: request.headers.get("host"), propertySlug: parsed.data, locale: locale.locale });
    if (!result) return publicHotelJson({ error: "NOT_FOUND" }, 404);
    return publicHotelJson(hotelWebsiteRoomCategoriesResponseSchema.parse(result));
  } catch {
    return publicHotelJson({ error: "UNAVAILABLE" }, 500);
  }
}
