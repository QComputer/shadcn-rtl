import "server-only";

import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/db-runtime";
import { CANONICAL_PLATFORM_HOST, normalizeDomainHost } from "@/lib/custom-domain-routing";
import { hotelWebsiteContentSchema } from "@/lib/hotel/content/hotel-website-contract";
import { hotelWebsitePublicContentSchema } from "@/lib/hotel/content/hotel-website-public-contract";
import { isCurrentHotelPublicationApproved } from "@/lib/hotel/services/hotel-publication.service";
import type { HotelPublicLocale } from "@/lib/hotel/public-api-contract";

type Db = PrismaClient;
type Tx = Prisma.TransactionClient;
type EligibleImage = { id: string; organizationId: string | null; filename: string | null; url: string; mimeType: string | null; access: "PUBLIC" | "PRIVATE" };

export type HotelWebsitePublicDependencies = {
  resolveTenant(host: string | null | undefined, tx: Tx, organizationSlug?: string | null): Promise<{ organizationId: string } | null>;
  isRoomApproved(input: { organizationId: string; propertyId: string; resourceType: "ROOM_TYPE"; resourceId: string; scope: "availability" }, tx: Tx): Promise<boolean>;
};

const defaultDependencies: HotelWebsitePublicDependencies = {
  resolveTenant: resolveHotelWebsiteTenantForHost,
  isRoomApproved: isCurrentHotelPublicationApproved,
};

export function isEligibleHotelWebsiteImage(image: EligibleImage, organizationId: string): boolean {
  if (image.organizationId !== organizationId || image.access !== "PUBLIC") return false;
  if (!image.filename || !/^[A-Za-z0-9_.-]+$/.test(image.filename)) return false;
  if (!image.mimeType || !["image/jpeg", "image/png", "image/webp", "image/gif"].includes(image.mimeType)) return false;
  if (image.url === `/uploads/${image.filename}`) return true;
  try {
    const url = new URL(image.url);
    return url.protocol === "https:" && url.hostname.endsWith(".public.blob.vercel-storage.com") && url.pathname.split("/").at(-1) === image.filename;
  } catch { return false; }
}

export async function resolveHotelWebsiteTenantForHost(host: string | null | undefined, db: Tx | Db = defaultPrisma, organizationSlug?: string | null) {
  const normalizedDomain = normalizeDomainHost(host);
  if (!normalizedDomain) return null;
  if (organizationSlug) {
    // A platform-hosted public organization path may name its tenant by its
    // public slug. This is allowed only on the canonical platform origin; a
    // custom/unknown host must continue resolving exclusively by verified
    // OrganizationDomain records.
    if (normalizedDomain !== CANONICAL_PLATFORM_HOST || !/^[a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?$/.test(organizationSlug)) return null;
    const organization = await db.organization.findFirst({
      where: {
        slug: organizationSlug,
        isActive: true,
        deletedAt: null,
        vertical: "HOTEL",
        capabilities: {
          some: { key: "HOTEL_WEBSITE", status: "ACTIVE", enabledAt: { not: null }, disabledAt: null },
        },
      },
      select: { id: true },
    });
    return organization ? { organizationId: organization.id } : null;
  }
  const domain = await db.organizationDomain.findUnique({
    where: { normalizedDomain },
    select: {
      status: true,
      organization: {
        select: {
          id: true,
          isActive: true,
          deletedAt: true,
          vertical: true,
          capabilities: {
            where: { key: "HOTEL_WEBSITE", status: "ACTIVE", enabledAt: { not: null }, disabledAt: null },
            select: { id: true },
          },
        },
      },
    },
  });
  if (!domain || domain.status !== "ACTIVE" || !domain.organization.isActive || domain.organization.deletedAt || domain.organization.vertical !== "HOTEL" || domain.organization.capabilities.length !== 1) return null;
  return { organizationId: domain.organization.id };
}

function localize(value: Prisma.JsonValue, locale: HotelPublicLocale): unknown {
  if (Array.isArray(value)) return value.map((item) => localize(item, locale));
  if (!value || typeof value !== "object") return value;
  const record = value as Record<string, Prisma.JsonValue>;
  const keys = Object.keys(record);
  if (keys.length === 0) return null;
  if (keys.length > 0 && keys.every((key) => key === "fa" || key === "en" || key === "ar") && keys.every((key) => typeof record[key] === "string")) {
    return typeof record[locale] === "string" && record[locale].trim() ? record[locale] : null;
  }
  return Object.fromEntries(Object.entries(record).map(([key, child]) => [key, localize(child, locale)]));
}

function localizedScalar(value: Prisma.JsonValue | null, locale: HotelPublicLocale): string | null {
  if (typeof value === "string") return safePlainText(value);
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const selected = (value as Record<string, Prisma.JsonValue>)[locale];
  return typeof selected === "string" ? safePlainText(selected) : null;
}

function safePlainText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed && !/<\/?[a-z!][\s\S]*>/i.test(trimmed) ? trimmed : null;
}

function safeBeds(value: Prisma.JsonValue): Array<{ kind: "single" | "double" | "queen" | "king" | "sofa" | "bunk" | "crib"; count: number; widthCm?: number }> | undefined {
  if (!Array.isArray(value)) return undefined;
  const allowed = new Set(["single", "double", "queen", "king", "sofa", "bunk", "crib"]);
  const result = value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const candidate = item as Record<string, Prisma.JsonValue>;
    if (typeof candidate.kind !== "string" || !allowed.has(candidate.kind) || typeof candidate.count !== "number" || !Number.isSafeInteger(candidate.count) || candidate.count < 1) return [];
    if (candidate.widthCm !== undefined && (typeof candidate.widthCm !== "number" || !Number.isSafeInteger(candidate.widthCm) || candidate.widthCm < 1)) return [];
    return [{ kind: candidate.kind as "single" | "double" | "queen" | "king" | "sofa" | "bunk" | "crib", count: candidate.count, ...(typeof candidate.widthCm === "number" ? { widthCm: candidate.widthCm } : {}) }];
  });
  return result.length === value.length ? result : undefined;
}

function safeContent(value: Prisma.JsonValue, locale: HotelPublicLocale) {
  const parsed = hotelWebsiteContentSchema.safeParse(value);
  if (!parsed.success) return null;
  const localized = localize(parsed.data as unknown as Prisma.JsonValue, locale) as Record<string, unknown>;
  const sections = Array.isArray(localized.sections) ? localized.sections.filter((section): section is Record<string, unknown> => Boolean(section && typeof section === "object" && !Array.isArray(section) && (section as Record<string, unknown>).visible === true)).sort((left, right) => Number(left.order) - Number(right.order)) : [];
  return hotelWebsitePublicContentSchema.safeParse({
    ...localized,
    sections,
    contact: { phone: parsed.data.contact.phone, email: parsed.data.contact.email },
  }).data ?? null;
}

async function findCurrentPublication(tx: Tx, organizationId: string, propertyId: string) {
  return tx.hotelWebsitePublication.findFirst({
    where: {
      organizationId,
      propertyId,
      revokedAt: null,
      page: { pageKey: "HOME" },
      revision: { status: "APPROVED" },
    },
    orderBy: { publishedAt: "desc" },
    select: {
      id: true,
      revision: {
        select: {
          id: true,
          revisionNumber: true,
          content: true,
          media: {
            orderBy: [{ scope: "asc" }, { roomTypeId: "asc" }, { slot: "asc" }, { sortOrder: "asc" }, { id: "asc" }],
            select: {
              id: true,
              scope: true,
              roomTypeId: true,
              slot: true,
              sortOrder: true,
              altText: true,
              image: { select: { id: true, organizationId: true, access: true, filename: true, url: true, mimeType: true } },
              roomType: { select: { id: true, slug: true, isActive: true, deletedAt: true } },
            },
          },
        },
      },
    },
  });
}

async function activeProperty(tx: Tx, organizationId: string, propertySlug: string) {
  return tx.hotelProperty.findFirst({
    where: { organizationId, slug: propertySlug, isActive: true, deletedAt: null },
    select: { id: true, slug: true },
  });
}

function eligibleMedia(publication: NonNullable<Awaited<ReturnType<typeof findCurrentPublication>>>, organizationId: string) {
  return publication.revision.media.filter((item) =>
    isEligibleHotelWebsiteImage(item.image, organizationId) &&
    (item.scope !== "ROOM_CATEGORY" || Boolean(item.roomType?.isActive && !item.roomType.deletedAt && item.roomTypeId === item.roomType.id)),
  );
}

function serializeGallery(items: ReturnType<typeof eligibleMedia>, scope: "PROPERTY" | "ROOM_CATEGORY", locale: HotelPublicLocale, organizationSlug?: string | null) {
  return items.filter((item) => item.scope === scope).map((item) => ({
    src: `/api/hotel/v1/website/media/${encodeURIComponent(item.id)}${organizationSlug ? `?organizationSlug=${encodeURIComponent(organizationSlug)}` : ""}`,
    altText: localizedScalar(item.altText, locale),
    sortOrder: item.sortOrder,
    slot: item.slot,
  }));
}

export async function getPublishedHotelWebsite(input: { host: string | null; propertySlug: string; locale: HotelPublicLocale; organizationSlug?: string | null; db?: Db }, dependencies: HotelWebsitePublicDependencies = defaultDependencies) {
  const db = input.db ?? defaultPrisma;
  return db.$transaction((tx) => getPublishedHotelWebsiteInTransaction(tx, input, dependencies), { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
}

async function getPublishedHotelWebsiteInTransaction(tx: Tx, input: Parameters<typeof getPublishedHotelWebsite>[0], dependencies: HotelWebsitePublicDependencies) {
    const tenant = await dependencies.resolveTenant(input.host, tx, input.organizationSlug);
    if (!tenant) return null;
    const property = await activeProperty(tx, tenant.organizationId, input.propertySlug);
    if (!property) return null;
    const publication = await findCurrentPublication(tx, tenant.organizationId, property.id);
    if (!publication) return { mode: "UNPUBLISHED" as const, locale: input.locale, propertySlug: property.slug, content: null, propertyGallery: [], roomGalleries: [] };

    const media = eligibleMedia(publication, tenant.organizationId);
    const roomTypes = await tx.hotelRoomType.findMany({ where: { organizationId: tenant.organizationId, propertyId: property.id, isActive: true, deletedAt: null }, select: { id: true } });
    const approvedRoomIds = new Set<string>();
    for (const room of roomTypes) {
      if (await dependencies.isRoomApproved({ organizationId: tenant.organizationId, propertyId: property.id, resourceType: "ROOM_TYPE", resourceId: room.id, scope: "availability" }, tx)) approvedRoomIds.add(room.id);
    }
    const propertyGallery = serializeGallery(media, "PROPERTY", input.locale, input.organizationSlug);
    const roomGalleries = [...new Set(media.flatMap((item) => item.roomTypeId && approvedRoomIds.has(item.roomTypeId) && item.roomType?.slug ? [item.roomType.slug] : []))]
      .map((roomTypeSlug) => ({ roomTypeSlug, items: serializeGallery(media.filter((item) => item.roomType?.slug === roomTypeSlug), "ROOM_CATEGORY", input.locale, input.organizationSlug) }));
    const content = safeContent(publication.revision.content, input.locale);
    if (!content) return null;
    return { mode: "PUBLISHED" as const, locale: input.locale, propertySlug: property.slug, revisionNumber: publication.revision.revisionNumber, content, propertyGallery, roomGalleries };
}

export async function listPublishedHotelWebsiteRoomCategories(input: { host: string | null; propertySlug: string; locale: HotelPublicLocale; organizationSlug?: string | null; db?: Db }, dependencies: HotelWebsitePublicDependencies = defaultDependencies) {
  const db = input.db ?? defaultPrisma;
  return db.$transaction((tx) => listPublishedHotelWebsiteRoomCategoriesInTransaction(tx, input, dependencies), { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
}

async function listPublishedHotelWebsiteRoomCategoriesInTransaction(tx: Tx, input: Parameters<typeof listPublishedHotelWebsiteRoomCategories>[0], dependencies: HotelWebsitePublicDependencies) {
    const tenant = await dependencies.resolveTenant(input.host, tx, input.organizationSlug);
    if (!tenant) return null;
    const property = await activeProperty(tx, tenant.organizationId, input.propertySlug);
    if (!property) return null;
    const publication = await findCurrentPublication(tx, tenant.organizationId, property.id);
    if (!publication) return { mode: "UNPUBLISHED" as const, locale: input.locale, propertySlug: property.slug, roomCategories: [] };
    const media = eligibleMedia(publication, tenant.organizationId);
    const candidates = await tx.hotelRoomType.findMany({ where: { organizationId: tenant.organizationId, propertyId: property.id, isActive: true, deletedAt: null }, orderBy: [{ sortOrder: "asc" }, { slug: "asc" }], select: { id: true, slug: true, name: true, description: true, localizedContent: true, maxAdults: true, maxChildren: true, maxOccupancy: true, beds: true, sizeSqm: true } });
    const roomCategories = [];
    for (const room of candidates) {
      if (!(await dependencies.isRoomApproved({ organizationId: tenant.organizationId, propertyId: property.id, resourceType: "ROOM_TYPE", resourceId: room.id, scope: "availability" }, tx))) continue;
      const name = safePlainText(room.name);
      if (!name) continue;
      const roomMedia = serializeGallery(media.filter((item) => item.roomTypeId === room.id), "ROOM_CATEGORY", input.locale, input.organizationSlug);
      const beds = safeBeds(room.beds);
      roomCategories.push({ slug: room.slug, name, description: room.description ? safePlainText(room.description) : null, localizedText: localizedScalar(room.localizedContent, input.locale), maxAdults: room.maxAdults, maxChildren: room.maxChildren, maxOccupancy: room.maxOccupancy, ...(beds ? { beds } : {}), sizeSqm: room.sizeSqm, gallery: roomMedia });
    }
    return { mode: "PUBLISHED" as const, locale: input.locale, propertySlug: property.slug, roomCategories };
}

/** One database snapshot for server-rendered content, rooms and metadata. The
 * expected ID is trusted server context; URL slugs never establish authority. */
export async function getPublishedHotelOrganizationSnapshot(
  input: Parameters<typeof getPublishedHotelWebsite>[0] & { expectedOrganizationId: string },
  dependencies: HotelWebsitePublicDependencies = defaultDependencies,
) {
  const db = input.db ?? defaultPrisma;
  return db.$transaction(async (tx) => {
    const tenant = await dependencies.resolveTenant(input.host, tx, input.organizationSlug);
    if (!tenant || tenant.organizationId !== input.expectedOrganizationId) return null;
    const website = await getPublishedHotelWebsiteInTransaction(tx, input, dependencies);
    const rooms = await listPublishedHotelWebsiteRoomCategoriesInTransaction(tx, input, dependencies);
    return website && rooms ? { website, rooms } : null;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
}

export async function getPublishedHotelWebsiteMedia(input: { host: string | null; associationId: string; organizationSlug?: string | null; db?: Db }) {
  const db = input.db ?? defaultPrisma;
  return db.$transaction(async (tx) => {
    const tenant = await resolveHotelWebsiteTenantForHost(input.host, tx, input.organizationSlug);
    if (!tenant) return null;
    const association = await tx.hotelWebsiteMediaAssociation.findFirst({
      where: {
        id: input.associationId,
        organizationId: tenant.organizationId,
        page: { property: { isActive: true, deletedAt: null, organization: { isActive: true, deletedAt: null, vertical: "HOTEL" } } },
        revision: { status: "APPROVED", publications: { some: { organizationId: tenant.organizationId, revokedAt: null, page: { pageKey: "HOME" } } } },
      },
      select: { propertyId: true, roomTypeId: true, image: { select: { id: true, organizationId: true, access: true, filename: true, url: true, mimeType: true } }, roomType: { select: { isActive: true, deletedAt: true } }, scope: true },
    });
    if (!association || (association.scope === "ROOM_CATEGORY" && (!association.roomType?.isActive || association.roomType.deletedAt)) || !isEligibleHotelWebsiteImage(association.image, tenant.organizationId)) return null;
    if (association.scope === "ROOM_CATEGORY" && (!association.roomTypeId || !(await isCurrentHotelPublicationApproved({ organizationId: tenant.organizationId, propertyId: association.propertyId, resourceType: "ROOM_TYPE", resourceId: association.roomTypeId, scope: "availability" }, tx)))) return null;
    return { url: association.image.url, filename: association.image.filename!, mimeType: association.image.mimeType! };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
}
