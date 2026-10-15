import { z } from "zod";
import { hotelWebsiteContentSchema } from "@/lib/hotel/content/hotel-website-contract";
import { hotelWebsitePublicContentSchema } from "@/lib/hotel/content/hotel-website-public-contract";
import type { HotelPublicLocale } from "@/lib/hotel/public-api-contract";
import {
  adaptPublishedHotelWebsite,
  type PublishedHotelWebsite,
} from "@/lib/hotel-website-public-adapter";

export type HotelOrganizationSitePresentation =
  | Readonly<{
      status: "PUBLISHED";
      source: "PUBLIC_API";
      organizationId: string;
      organizationSlug: string;
      contentProvenance: "OWNER_APPROVED" | "SYNTHETIC" | "UNKNOWN";
      locale: HotelPublicLocale;
      propertySlug: string;
      website: PublishedHotelWebsite;
    }>
  | Readonly<{
      status: "PREVIEW";
      source: "AUTHENTICATED_CMS_PREVIEW" | "SYNTHETIC_PREVIEW";
      organizationId: string;
      organizationSlug: string;
      locale: HotelPublicLocale;
      propertySlug: string;
      revisionStatus: "DRAFT" | "IN_REVIEW" | "APPROVED" | "REJECTED";
      website: PublishedHotelWebsite;
    }>
  | Readonly<{ status: "UNPUBLISHED"; locale: HotelPublicLocale; propertySlug: string }>
  | Readonly<{
      status: "UNAVAILABLE";
      locale: HotelPublicLocale;
      propertySlug: string;
      code: "UNAVAILABLE_PROPERTY" | "PUBLICATION_DISABLED" | "TEMPORARY_UNAVAILABLE" | "MISSING_TRANSLATION";
    }>;

type PreviewStatus = Extract<HotelOrganizationSitePresentation, { status: "PREVIEW" }>;
const eligiblePreviewImageSource = z.string().refine((value) => {
  if (/^\/uploads\/[A-Za-z0-9_.-]+$/.test(value)) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:"
      && url.hostname.endsWith(".public.blob.vercel-storage.com")
      && /^[A-Za-z0-9_.-]+$/.test(url.pathname.split("/").at(-1) ?? "");
  } catch { return false; }
});
const previewSourceSchema = z.object({
  mode: z.literal("PREVIEW"),
  locale: z.enum(["fa", "en", "ar"]),
  revisionId: z.string().min(1),
  revisionNumber: z.number().int().positive(),
  status: z.enum(["DRAFT", "IN_REVIEW", "APPROVED", "REJECTED"]),
  pageKey: z.literal("HOME"),
  content: hotelWebsiteContentSchema,
  media: z.array(z.object({
    imageId: z.string().min(1),
    src: eligiblePreviewImageSource,
    scope: z.enum(["PROPERTY", "ROOM_CATEGORY"]),
    roomTypeId: z.string().nullable(),
    slot: z.enum(["GALLERY", "HERO_DESKTOP", "HERO_MOBILE"]),
    sortOrder: z.number().int().nonnegative(),
    altText: z.record(z.string(), z.string().optional()),
  }).strict()),
}).strict();

function localized(value: unknown, locale: HotelPublicLocale): unknown {
  if (Array.isArray(value)) return value.map((entry) => localized(entry, locale));
  if (!value || typeof value !== "object") return value;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record);
  if (keys.length && keys.every((key) => key === "fa" || key === "en" || key === "ar")) {
    const selected = record[locale];
    return typeof selected === "string" && selected.trim() ? selected : null;
  }
  return Object.fromEntries(Object.entries(record).map(([key, child]) => [key, localized(child, locale)]));
}

function previewWebsite(preview: z.infer<typeof previewSourceSchema>, propertySlug: string): PublishedHotelWebsite | null {
  const content = localized(preview.content, preview.locale);
  const raw = content && typeof content === "object" ? content as Record<string, unknown> : null;
  if (!raw) return null;
  const parsedContent = hotelWebsitePublicContentSchema.safeParse({
    ...raw,
    sections: Array.isArray(raw.sections) ? raw.sections.filter((section) => Boolean(section && typeof section === "object" && (section as Record<string, unknown>).visible === true)) : [],
    contact: {
      phone: typeof raw.contact === "object" && raw.contact !== null ? (raw.contact as Record<string, unknown>).phone : undefined,
      email: typeof raw.contact === "object" && raw.contact !== null ? (raw.contact as Record<string, unknown>).email : undefined,
    },
  });
  if (!parsedContent.success) return null;
  const publicContent = parsedContent.data;
  const propertyMedia = preview.media.filter((item) => item.scope === "PROPERTY").map((item) => ({
    src: item.src,
    altText: typeof item.altText[preview.locale] === "string" ? item.altText[preview.locale]! : null,
    sortOrder: item.sortOrder,
    slot: item.slot,
  }));
  const desktop = propertyMedia.find((item) => item.slot === "HERO_DESKTOP") ?? propertyMedia.find((item) => item.slot === "HERO_MOBILE") ?? null;
  const mobile = propertyMedia.find((item) => item.slot === "HERO_MOBILE") ?? desktop;
  return {
    mode: "PUBLISHED",
    locale: preview.locale,
    propertySlug,
    revisionNumber: preview.revisionNumber,
    content: publicContent,
    roomGalleries: [],
    roomCards: [],
    heroDesktop: desktop ? { src: desktop.src, alt: desktop.altText ?? "" } : null,
    heroMobile: mobile ? { src: mobile.src, alt: mobile.altText ?? "" } : null,
    propertyGallery: propertyMedia.filter((item) => item.slot === "GALLERY").map((item) => ({ src: item.src, alt: item.altText ?? "", sortOrder: item.sortOrder })),
  };
}

/** Shape/scope adapter only. The caller must obtain the payload from the F5
 * preview route, which enforces authenticated Hotel membership and preview policy. */
export function adaptAuthenticatedHotelWebsitePreview(
  raw: unknown,
  expected: Readonly<{ organizationId: string; organizationSlug: string; propertySlug: string; locale: HotelPublicLocale }>,
): PreviewStatus {
  if (!expected.organizationId || !expected.organizationSlug || !expected.propertySlug) throw new Error("Trusted Hotel organization and property scope are required");
  const parsed = previewSourceSchema.safeParse(raw);
  if (!parsed.success || parsed.data.locale !== expected.locale) {
    throw new Error("Hotel CMS preview does not match the requested organization property and locale");
  }
  const website = previewWebsite(parsed.data, expected.propertySlug);
  if (!website?.content.title || !website.content.hero.heading || !website.content.introduction.body) {
    throw new Error("Hotel CMS preview has no usable translation for the requested locale");
  }
  return {
    status: "PREVIEW",
    source: "AUTHENTICATED_CMS_PREVIEW",
    organizationId: expected.organizationId,
    organizationSlug: expected.organizationSlug,
    locale: expected.locale,
    propertySlug: expected.propertySlug,
    revisionStatus: parsed.data.status,
    website,
  };
}

/** Adapter for already-validated F5 public responses supplied by a trusted server route. */
export function adaptHotelOrganizationPublicRead(
  websiteRaw: unknown,
  roomsRaw: unknown,
  expected: Readonly<{ organizationId: string; organizationSlug: string; propertySlug: string; locale: HotelPublicLocale; contentProvenance: "OWNER_APPROVED" | "SYNTHETIC" | "UNKNOWN" }>,
): HotelOrganizationSitePresentation {
  if (!expected.organizationId || !expected.organizationSlug) throw new Error("Trusted Platform organization context is required");
  const snapshot = adaptPublishedHotelWebsite(websiteRaw, roomsRaw, expected);
  return snapshot.status === "UNPUBLISHED"
    ? { status: "UNPUBLISHED", locale: expected.locale, propertySlug: expected.propertySlug }
    : { status: "PUBLISHED", source: "PUBLIC_API", organizationId: expected.organizationId, organizationSlug: expected.organizationSlug, contentProvenance: expected.contentProvenance, locale: expected.locale, propertySlug: expected.propertySlug, website: snapshot.value };
}

/** A status-only helper for Platform generateMetadata; public indexing is opt-in. */
export function hotelOrganizationRobots(input: Readonly<{
  status: HotelOrganizationSitePresentation["status"];
  source?: "PUBLIC_API" | "AUTHENTICATED_CMS_PREVIEW" | "SYNTHETIC_PREVIEW";
  contentProvenance?: "OWNER_APPROVED" | "SYNTHETIC" | "UNKNOWN";
  approvedForIndexing?: boolean;
  websiteCapabilityActive?: boolean;
  organizationActive?: boolean;
}>): Readonly<{ index: boolean; follow: boolean }> {
  const index = input.status === "PUBLISHED"
    && input.source === "PUBLIC_API"
    && input.contentProvenance === "OWNER_APPROVED"
    && input.approvedForIndexing === true
    && input.websiteCapabilityActive === true
    && input.organizationActive === true;
  return { index, follow: index };
}

/** Builds a labeled browser-test-only preview after the same response validation. */
export function adaptSyntheticHotelPreview(
  websiteRaw: unknown,
  roomsRaw: unknown,
  expected: Readonly<{ organizationId: string; organizationSlug: string; propertySlug: string; locale: HotelPublicLocale; contentProvenance: "OWNER_APPROVED" | "SYNTHETIC" | "UNKNOWN" }>,
): PreviewStatus {
  const adapted = adaptHotelOrganizationPublicRead(websiteRaw, roomsRaw, expected);
  if (adapted.status !== "PUBLISHED") throw new Error("Synthetic preview requires a complete explicitly supplied fixture");
  return { status: "PREVIEW", source: "SYNTHETIC_PREVIEW", organizationId: adapted.organizationId, organizationSlug: adapted.organizationSlug, locale: adapted.locale, propertySlug: adapted.propertySlug, revisionStatus: "DRAFT", website: adapted.website };
}
