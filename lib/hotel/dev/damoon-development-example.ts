import type { HotelPage } from "@/lib/hotel/ui/hotel-page-contract";

/**
 * DEVELOPMENT PLACEHOLDER — NOT PUBLISHABLE CONTENT.
 *
 * Hotel Damoon has no verified content yet: no confirmed room categories,
 * amenities, policies, rates or photography. This fixture exists purely so the
 * hotel page contract, section ordering and validation have something concrete
 * to exercise in development and unit tests.
 *
 * Hard rules for anything in this file:
 *  - Every hotel-specific claim is a visibly generic placeholder.
 *  - No prices, no room names, no amenity lists, no policies are invented.
 *  - It must never be imported by a route handler, a service, or any code
 *    reachable from a public request.
 *
 * `isPublishablePlaceholder` is asserted false by the tests so this cannot be
 * promoted to production by accident.
 */

export const DAMOON_PROPERTY_SLUG = "damoon-hotel";
export const DAMOON_CANONICAL_DOMAIN = "damoon-hotel.ir";

export const DAMOON_DEVELOPMENT_PLACEHOLDER_PAGE: HotelPage = {
  id: "dev_damoon_placeholder_page",
  organizationId: "dev_placeholder_organization",
  propertyId: "dev_placeholder_property",
  slug: DAMOON_PROPERTY_SLUG,
  status: "DRAFT",
  locale: "fa",
  seo: {
    title: "هتل دامون | صفحه توسعه",
    description: "محتوای این صفحه در حال توسعه است و اطلاعات رسمی هتل در آن درج نشده است.",
    structuredDataEnabled: false,
  },
  updatedAt: "1970-01-01T00:00:00.000Z",
  sections: [
    {
      id: "dev_hero",
      kind: "HERO",
      visible: true,
      order: 10,
      eyebrow: "قابل تکمیل",
      heading: "نام رسمی هتل هنوز تأیید نشده است",
      subheading: "این عنوان صرفاً جای‌نگهدار است و جایگزین محتوای رسمی نیست.",
    },
    {
      id: "dev_search",
      kind: "BOOKING_SEARCH",
      visible: true,
      order: 20,
      defaultGuests: 2,
      showAvailabilityCalendar: true,
      ratePlanFamilies: [],
    },
    {
      id: "dev_rooms",
      kind: "ROOM_SHOWCASE",
      visible: true,
      order: 30,
      heading: "انواع اتاق — در انتظار داده رسمی",
      roomTypeRefs: [],
      layout: "GRID",
    },
    {
      id: "dev_policies",
      kind: "POLICIES",
      visible: true,
      order: 40,
      cancellationPolicyKeys: [],
    },
  ],
};

export function isPublishablePlaceholder(page: HotelPage): boolean {
  return page.status === "PUBLISHED";
}