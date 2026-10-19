import { propertySlugSchema } from "@/lib/hotel/validation/hotel-contracts";
import { publicHotelPropertyResponseSchema } from "@/lib/hotel/public-api-contract";
import { parsePublicHotelLocale, publicHotelJson } from "@/lib/hotel/public-api-http";
import { getPublishedHotelProperty } from "@/lib/hotel/services/public-catalog.service";
import { isApprovedHotelPublicationAvailable } from "@/lib/hotel/services/public-publication-gate";

export async function GET(request: Request, { params }: { params: Promise<{ propertySlug: string }> }) {
  const locale = parsePublicHotelLocale(request.url);
  if ("error" in locale) return publicHotelJson({ error: "INVALID_REQUEST" }, 400);
  if (!isApprovedHotelPublicationAvailable()) return publicHotelJson({ error: "PUBLICATION_DISABLED" }, 503);

  const { propertySlug } = await params;
  const parsedSlug = propertySlugSchema.safeParse(propertySlug);
  if (!parsedSlug.success) return publicHotelJson({ error: "INVALID_REQUEST" }, 400);

  try {
    const result = await getPublishedHotelProperty({ host: request.headers.get("host"), propertySlug: parsedSlug.data, locale: locale.locale });
    if (!result) return publicHotelJson({ error: "NOT_FOUND" }, 404);
    return publicHotelJson(publicHotelPropertyResponseSchema.parse(result));
  } catch {
    return publicHotelJson({ error: "UNAVAILABLE" }, 500);
  }
}
