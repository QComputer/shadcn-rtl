import { hotelPublicLocaleSchema, type HotelPublicLocale } from "@/lib/hotel/public-api-contract";

export function publicHotelJson(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { "cache-control": "no-store, max-age=0" },
  });
}

export function parsePublicHotelLocale(url: string): { locale: HotelPublicLocale } | { error: true } {
  const locales = new URL(url).searchParams.getAll("locale");
  if (locales.length === 0) return { locale: "fa" };
  if (locales.length !== 1) return { error: true };
  const raw = locales[0];
  const parsed = hotelPublicLocaleSchema.safeParse(raw);
  return parsed.success ? { locale: parsed.data } : { error: true };
}
