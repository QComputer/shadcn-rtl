import { publicHotelJson } from "@/lib/hotel/public-api-http";
import { getPublishedHotelWebsiteMedia } from "@/lib/hotel/content/hotel-website-public.service";

export async function GET(request: Request, { params }: { params: Promise<{ associationId: string }> }) {
  const { associationId } = await params;
  if (!/^[A-Za-z0-9_-]{8,128}$/.test(associationId)) return publicHotelJson({ error: "NOT_FOUND" }, 404);
  try {
    const asset = await getPublishedHotelWebsiteMedia({ host: request.headers.get("host"), associationId });
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
