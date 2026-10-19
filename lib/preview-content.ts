import type { HotelPage } from "./hotel/ui/hotel-page-contract";

/** Read-only F1 design fixture. It is not publishable hotel content. */
export const DAMOON_F1_PAGE: HotelPage = {
  id: "f1-design-preview",
  organizationId: "preview-only",
  propertyId: "preview-only",
  slug: "damoon-hotel",
  status: "DRAFT",
  locale: "fa",
  seo: {
    title: "هتل دامون | پیش‌نمایش طراحی",
    description: "پیش‌نمایش داخلی؛ محتوای واقعی هتل در انتظار تأیید است.",
    structuredDataEnabled: false,
  },
  updatedAt: "2026-10-12T00:00:00.000Z",
  sections: [
    { id: "hero", kind: "HERO", visible: true, order: 10, heading: "هتل دامون" },
    {
      id: "booking-search",
      kind: "BOOKING_SEARCH",
      visible: true,
      order: 20,
      defaultGuests: 1,
      showAvailabilityCalendar: false,
      ratePlanFamilies: [],
    },
    {
      id: "rooms",
      kind: "ROOM_SHOWCASE",
      visible: true,
      order: 30,
      heading: "پیش‌نمایش دسته‌های اقامت",
      roomTypeRefs: [],
      layout: "GRID",
    },
    { id: "policies", kind: "POLICIES", visible: true, order: 40, cancellationPolicyKeys: [] },
  ],
};

export const DESIGN_PREVIEW_ONLY = true as const;
export const OFFICIAL_LOGO_STATUS = "NOT_PROVIDED" as const;

export const conceptRooms = [
  { id: "concept-1", label: "نمونه‌ی تصویری یک", image: "/images/room-concept-1.webp" },
  { id: "concept-2", label: "نمونه‌ی تصویری دو", image: "/images/room-concept-2.webp" },
  { id: "concept-3", label: "نمونه‌ی تصویری سه", image: "/images/room-concept-3.webp" },
] as const;

export const conceptGallery = [
  { id: "gallery-1", label: "جزئیات مفهومی فضای داخلی", image: "/images/gallery-concept-1.webp" },
  { id: "gallery-2", label: "نمای مفهومی فضای نشیمن", image: "/images/gallery-concept-2.webp" },
  { id: "gallery-3", label: "جزئیات مفهومی نور و چوب", image: "/images/gallery-concept-3.webp" },
] as const;
