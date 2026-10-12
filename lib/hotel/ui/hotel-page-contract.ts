/**
 * Reusable hotel page contract (H1 foundation).
 *
 * This is a *contract*, not an implementation. It describes the section model
 * a hotel public experience needs so the Landing Page Engine can render typed
 * blocks without any hotel-specific component tree.
 *
 * Constraints that shaped it:
 *  - Typed discriminated sections, never free-form HTML or executable blocks.
 *  - No invented hotel content. Every text field is nullable and the UI is
 *    expected to render a marked placeholder when content is unverified, so a
 *    partially-filled draft can never imply amenities or prices that do not
 *    exist.
 *  - Presentation only. This module imports no Prisma, no auth, and is safe to
 *    import from client components.
 */

export type HotelPageSectionKind =
  | "HERO"
  | "BOOKING_SEARCH"
  | "ROOM_SHOWCASE"
  | "GALLERY"
  | "VTOUR"
  | "AMENITIES"
  | "DINING"
  | "EXPERIENCES"
  | "OFFERS"
  | "TESTIMONIALS"
  | "FAQ"
  | "LOCATION"
  | "CONTACT"
  | "POLICIES";

export type HotelMediaRef = {
  /** Resolved by the media layer; never a raw external URL from user input. */
  readonly mediaAssetId: string;
  readonly alt: string;
  readonly width: number;
  readonly height: number;
};

export type HotelSectionBase = {
  readonly id: string;
  readonly kind: HotelPageSectionKind;
  readonly visible: boolean;
  /** Draft vs published is a page-level concern; sections inherit it. */
  readonly order: number;
};

export type HeroSection = HotelSectionBase & {
  readonly kind: "HERO";
  readonly eyebrow?: string;
  readonly heading: string;
  readonly subheading?: string;
  readonly desktopImage?: HotelMediaRef;
  readonly mobileImage?: HotelMediaRef;
  readonly primaryAction?: { readonly label: string; readonly href: string };
  readonly secondaryAction?: { readonly label: string; readonly href: string };
};

export type BookingSearchSection = HotelSectionBase & {
  readonly kind: "BOOKING_SEARCH";
  readonly heading?: string;
  readonly defaultGuests: number;
  readonly showAvailabilityCalendar: boolean;
  /** Which rate plan families to surface. */
  readonly ratePlanFamilies: readonly string[];
};

export type RoomShowcaseSection = HotelSectionBase & {
  readonly kind: "ROOM_SHOWCASE";
  readonly heading: string;
  readonly description?: string;
  /**
   * Room type references. Empty means "derive from live availability" rather
   * than a hand-picked list, so a sold-out room type disappears automatically.
   */
  readonly roomTypeRefs: readonly string[];
  readonly layout: "GRID" | "SCROLL";
};

export type GallerySection = HotelSectionBase & {
  readonly kind: "GALLERY";
  readonly heading?: string;
  readonly mediaRefs: readonly HotelMediaRef[];
};

export type VTourSection = HotelSectionBase & {
  readonly kind: "VTOUR";
  readonly heading?: string;
  /** Scans resolve from the media library; no inline panorama markup. */
  readonly scanRefs: readonly string[];
};

export type AmenitiesSection = HotelSectionBase & {
  readonly kind: "AMENITIES";
  readonly heading: string;
  /**
   * Only verified amenities. Anything absent here must not be implied by copy,
   * which is why hotel content is explicitly gated in the pilot plan.
   */
  readonly amenities: ReadonlyArray<{ readonly key: string; readonly label: string }>;
};

export type DiningSection = HotelSectionBase & {
  readonly kind: "DINING";
  readonly heading: string;
  readonly description?: string;
  readonly outlets: ReadonlyArray<{ readonly name: string; readonly description?: string; readonly image?: HotelMediaRef }>;
};

export type ExperiencesSection = HotelSectionBase & {
  readonly kind: "EXPERIENCES";
  readonly heading: string;
  readonly items: ReadonlyArray<{ readonly title: string; readonly description?: string }>;
};

export type OffersSection = HotelSectionBase & {
  readonly kind: "OFFERS";
  readonly heading: string;
  readonly items: ReadonlyArray<{ readonly title: string; readonly description?: string }>;
};

export type TestimonialsSection = HotelSectionBase & {
  readonly kind: "TESTIMONIALS";
  readonly heading?: string;
  /** Reviews only. Never hand-written quotes attributed to real people. */
  readonly source: "REVIEWS" | "NONE";
};

export type FaqSection = HotelSectionBase & {
  readonly kind: "FAQ";
  readonly heading?: string;
  readonly items: ReadonlyArray<{ readonly question: string; readonly answer: string }>;
};

export type LocationSection = HotelSectionBase & {
  readonly kind: "LOCATION";
  readonly heading?: string;
  readonly address?: string;
  readonly latitude?: number;
  readonly longitude?: number;
};

export type ContactSection = HotelSectionBase & {
  readonly kind: "CONTACT";
  readonly heading?: string;
  readonly phone?: string;
  readonly email?: string;
  readonly address?: string;
};

export type PoliciesSection = HotelSectionBase & {
  readonly kind: "POLICIES";
  readonly heading?: string;
  readonly cancellationPolicyKeys: readonly string[];
};

export type HotelPageSection =
  | HeroSection
  | BookingSearchSection
  | RoomShowcaseSection
  | GallerySection
  | VTourSection
  | AmenitiesSection
  | DiningSection
  | ExperiencesSection
  | OffersSection
  | TestimonialsSection
  | FaqSection
  | LocationSection
  | ContactSection
  | PoliciesSection;

export type HotelPageStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

export type HotelPage = {
  readonly id: string
  readonly organizationId: string
  readonly propertyId: string
  readonly slug: string
  readonly status: HotelPageStatus
  readonly locale: string
  readonly seo: {
    readonly title: string
    readonly description: string
    readonly ogImage?: HotelMediaRef
    /** Emitted as Hotel JSON-LD only when the page is PUBLISHED. */
    readonly structuredDataEnabled: boolean
  }
  readonly sections: readonly HotelPageSection[]
  readonly updatedAt: string
}

/**
 * Sections a hotel page is expected to provide. Used by the renderer to warn
 * about structural gaps and by tests to assert IA completeness.
 */
export const REQUIRED_HOTEL_PAGE_SECTION_KINDS: readonly HotelPageSectionKind[] = [
  "HERO",
  "BOOKING_SEARCH",
  "ROOM_SHOWCASE",
  "POLICIES",
];

export function orderHotelSections(sections: readonly HotelPageSection[]): HotelPageSection[] {
  return [...sections].sort((left, right) => {
    if (left.order !== right.order) return left.order - right.order;
    return left.id.localeCompare(right.id);
  });
}

export type HotelPageValidation =
  | { readonly isValid: true; readonly sections: readonly HotelPageSection[] }
  | { readonly isValid: false; readonly issues: readonly string[] };

export function validateHotelPage(page: HotelPage): HotelPageValidation {
  const issues: string[] = [];
  const kinds = new Set(page.sections.map((section) => section.kind));

  for (const required of REQUIRED_HOTEL_PAGE_SECTION_KINDS) {
    if (!kinds.has(required)) issues.push(`MISSING_REQUIRED_SECTION:${required}`);
  }

  const ids = new Set<string>();
  for (const section of page.sections) {
    if (ids.has(section.id)) issues.push(`DUPLICATE_SECTION_ID:${section.id}`);
    ids.add(section.id);
  }

  if (page.status === "PUBLISHED") {
    if (!page.seo.title.trim()) issues.push("PUBLISHED_PAGE_REQUIRES_SEO_TITLE");
    if (!page.seo.description.trim()) issues.push("PUBLISHED_PAGE_REQUIRES_SEO_DESCRIPTION");
    const testimonials = page.sections.find((section) => section.kind === "TESTIMONIALS");
    if (testimonials && testimonials.kind === "TESTIMONIALS" && testimonials.source === "NONE") {
      // Safer to omit than to fabricate: the renderer skips the section.
      issues.push("TESTIMONIALS_WITHOUT_SOURCE_WILL_BE_OMITTED");
    }
  }

  return issues.length === 0
    ? { isValid: true, sections: orderHotelSections(page.sections) }
    : { isValid: false, issues };
}