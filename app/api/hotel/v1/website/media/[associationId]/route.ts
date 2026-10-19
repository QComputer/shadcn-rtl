import { publicHotelJson } from "@/lib/hotel/public-api-http";
import { getPublishedHotelWebsiteMedia } from "@/lib/hotel/content/hotel-website-public.service";
import { HOTEL_WEBSITE_PUBLIC_GATE_MESSAGE, isHotelWebsitePublicReadAvailable } from "@/lib/hotel/services/public-website-gate";

export async function GET(request: Request, { params }: { params: Promise<{ associationId: string }> }) {
  if (!isHotelWebsitePublicReadAvailable()) return publicHotelJson({ error: "WEBSITE_DISABLED", message: HOTEL_WEBSITE_PUBLIC_GATE_MESSAGE }, 503);
  const { associationId } = await params;
  if (!/^[A-Za-z0-9_-]{8,128}$/.test(associationId)) return publicHotelJson({ error: "NOT_FOUND" }, 404);
  const organizationSlug = new URL(request.url).searchParams.get("organizationSlug");
  if (organizationSlug !== null && !/^[a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?$/.test(organizationSlug)) return publicHotelJson({ error: "INVALID_REQUEST" }, 400);
  try {
    const asset = await getPublishedHotelWebsiteMedia({ host: request.headers.get("host"), associationId, organizationSlug });
    if (!asset) return publicHotelJson({ error: "NOT_FOUND" }, 404);
    return new Response(null, {
      status: 302,
      headers: {
        location: asset.url,
        "cache-control": "no-store, max-age=0",
        "referrer-policy": "no-referrer",
        "x-content-type-options": "nosniff",
      },
    });
  } catch {
    return publicHotelJson({ error: "UNAVAILABLE" }, 500);
  }
}
