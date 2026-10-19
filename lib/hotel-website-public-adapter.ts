import {
  hotelWebsiteResponseSchema,
  hotelWebsiteRoomCategoriesResponseSchema,
  publishedHotelWebsiteResponseSchema,
} from "@/lib/hotel-website-public-contract";
import type { PublishedHotelWebsiteResponse } from "@/lib/hotel-website-public-contract";
import type { HotelPublicLocale } from "@/lib/hotel/public-api-contract";
import type { PublishedRoomCardData } from "@/lib/rooms/room-showcase-model";

export class PublishedHotelWebsiteContractError extends Error {
  constructor() {
    super("Published Hotel website response does not match the requested scope");
    this.name = "PublishedHotelWebsiteContractError";
  }
}

export type PublishedHotelWebsite = Omit<PublishedHotelWebsiteResponse, "propertyGallery"> & Readonly<{
  roomCards: readonly PublishedRoomCardData[];
  heroDesktop: Readonly<{ src: string; alt: string }> | null;
  heroMobile: Readonly<{ src: string; alt: string }> | null;
  propertyGallery: readonly Readonly<{ src: string; alt: string; sortOrder: number }>[];
}>;
export type HotelWebsiteSnapshot = Readonly<{ status: "PUBLISHED"; value: PublishedHotelWebsite }>
  | Readonly<{ status: "UNPUBLISHED" }>;

function roomFacts(room: { maxOccupancy: number; sizeSqm?: number | null }, locale: HotelPublicLocale) {
  const labels = {
    fa: { guests: "حداکثر ظرفیت ثبت‌شده", size: "مساحت ثبت‌شده" },
    en: { guests: "Recorded maximum occupancy", size: "Recorded area" },
    ar: { guests: "السعة القصوى المسجلة", size: "المساحة المسجلة" },
  }[locale];
  return [
    { label: labels.guests, value: new Intl.NumberFormat(locale).format(room.maxOccupancy) },
    ...(typeof room.sizeSqm === "number" ? [{ label: labels.size, value: `${new Intl.NumberFormat(locale).format(room.sizeSqm)} m²` }] : []),
  ];
}

function toImage(image: { src: string; altText?: string | null }) {
  return { src: image.src, alt: image.altText ?? "" };
}

/** Validates current C1B2 responses. This is shape/scope validation, not authorization. */
export function adaptPublishedHotelWebsite(
  websiteRaw: unknown,
  roomsRaw: unknown,
  expected: Readonly<{ propertySlug: string; locale: HotelPublicLocale }>,
): HotelWebsiteSnapshot {
  const websiteResult = hotelWebsiteResponseSchema.safeParse(websiteRaw);
  const roomsResult = hotelWebsiteRoomCategoriesResponseSchema.safeParse(roomsRaw);
  if (!websiteResult.success || !roomsResult.success
    || websiteResult.data.propertySlug !== expected.propertySlug
    || roomsResult.data.propertySlug !== expected.propertySlug
    || websiteResult.data.locale !== expected.locale
    || roomsResult.data.locale !== expected.locale) {
    throw new PublishedHotelWebsiteContractError();
  }
  if (websiteResult.data.mode === "UNPUBLISHED") return { status: "UNPUBLISHED" };

  const published = publishedHotelWebsiteResponseSchema.safeParse(websiteResult.data);
  if (!published.success) throw new PublishedHotelWebsiteContractError();

  const roomCards: PublishedRoomCardData[] = roomsResult.data.mode === "PUBLISHED"
    ? roomsResult.data.roomCategories.map((room) => ({
      kind: "published",
      id: room.slug,
      title: room.name,
      description: room.localizedText,
      facts: roomFacts(room, expected.locale),
      images: room.gallery.filter((image) => image.slot === "GALLERY").map(toImage),
    }))
    : [];

  const roomGalleryBySlug = new Map(published.data.roomGalleries.map((entry) => [entry.roomTypeSlug, entry.items.filter((image) => image.slot === "GALLERY").map(toImage)]));
  const reconciledRooms = roomCards.map((room) => ({
    ...room,
    // Prefer the dedicated room-category response gallery; both URLs are opaque
    // API src values and remain unchanged. No fixture/media fallback is allowed.
    images: room.images.length ? room.images : roomGalleryBySlug.get(room.id) ?? [],
  }));
  const propertyImages = published.data.propertyGallery;
  const heroDesktopRaw = propertyImages.find((image) => image.slot === "HERO_DESKTOP") ?? propertyImages.find((image) => image.slot === "HERO_MOBILE") ?? null;
  const heroMobileRaw = propertyImages.find((image) => image.slot === "HERO_MOBILE") ?? heroDesktopRaw;

  return {
    status: "PUBLISHED",
    value: {
      ...published.data,
      roomCards: reconciledRooms,
      heroDesktop: heroDesktopRaw ? toImage(heroDesktopRaw) : null,
      heroMobile: heroMobileRaw ? toImage(heroMobileRaw) : null,
      propertyGallery: propertyImages.filter((image) => image.slot === "GALLERY").map((image) => ({ ...toImage(image), sortOrder: image.sortOrder })),
    },
  };
}

export function publishedHotelWebsiteErrorState(status: number, body: unknown): "UNAVAILABLE_PROPERTY" | "PUBLICATION_DISABLED" | "TEMPORARY_UNAVAILABLE" {
  if (!body || typeof body !== "object" || Array.isArray(body)) return "TEMPORARY_UNAVAILABLE";
  const record = body as Record<string, unknown>;
  if (status === 404 && record.error === "NOT_FOUND") return "UNAVAILABLE_PROPERTY";
  if (status === 503 && record.error === "WEBSITE_DISABLED") return "PUBLICATION_DISABLED";
  return "TEMPORARY_UNAVAILABLE";
}
