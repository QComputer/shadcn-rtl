import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/db-runtime";
import type { HotelPublicLocale } from "@/lib/hotel/public-api-contract";
import { isCurrentHotelPublicationApproved, resolveHotelTenantForHost, type HotelPublicationResource } from "@/lib/hotel/services/hotel-publication.service";

type ReadClient = PrismaClient;
type PublicationScope = "availability" | "quote" | "policies";
export type PublicHotelCatalogDependencies = {
  readonly resolveTenant: typeof resolveHotelTenantForHost;
  readonly isApproved: (input: { organizationId: string; propertyId: string; resourceType: HotelPublicationResource; resourceId: string; scope: PublicationScope }, db: Prisma.TransactionClient) => Promise<boolean>;
};

const defaultDependencies: PublicHotelCatalogDependencies = {
  resolveTenant: resolveHotelTenantForHost,
  isApproved: isCurrentHotelPublicationApproved,
};

function localizedText(value: Prisma.JsonValue | null, locale: HotelPublicLocale): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const text = (value as Record<string, Prisma.JsonValue>)[locale];
  return typeof text === "string" && text.trim() ? text : null;
}

function publicBeds(value: Prisma.JsonValue): Array<{ kind: "single" | "double" | "queen" | "king" | "sofa" | "bunk" | "crib"; count: number; widthCm?: number }> | undefined {
  if (!Array.isArray(value)) return undefined;
  const allowed = new Set(["single", "double", "queen", "king", "sofa", "bunk", "crib"]);
  const beds = value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const candidate = item as Record<string, Prisma.JsonValue>;
    if (typeof candidate.kind !== "string" || !allowed.has(candidate.kind) || typeof candidate.count !== "number" || !Number.isSafeInteger(candidate.count) || candidate.count < 1) return [];
    const widthCm = candidate.widthCm;
    if (widthCm !== undefined && (typeof widthCm !== "number" || !Number.isSafeInteger(widthCm) || widthCm < 1)) return [];
    return [{ kind: candidate.kind as "single" | "double" | "queen" | "king" | "sofa" | "bunk" | "crib", count: candidate.count, ...(typeof widthCm === "number" ? { widthCm } : {}) }];
  });
  return beds.length === value.length ? beds : undefined;
}

async function withPublishedProperty<T>(input: { host: string | null; propertySlug: string; locale: HotelPublicLocale; db: ReadClient }, read: (tx: Prisma.TransactionClient, organizationId: string, property: NonNullable<Awaited<ReturnType<typeof findActiveProperty>>>) => Promise<T>, dependencies: PublicHotelCatalogDependencies): Promise<T | null> {
  return input.db.$transaction(async (tx) => {
    const tenant = await dependencies.resolveTenant(input.host, tx);
    if (!tenant) return null;
    const property = await findActiveProperty(tx, tenant.organizationId, input.propertySlug);
    if (!property) return null;
    const approved = await dependencies.isApproved({ organizationId: tenant.organizationId, propertyId: property.id, resourceType: "PROPERTY", resourceId: property.id, scope: "availability" }, tx);
    if (!approved) return null;
    return read(tx, tenant.organizationId, property);
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
}

async function findActiveProperty(tx: Prisma.TransactionClient, organizationId: string, propertySlug: string) {
  return tx.hotelProperty.findFirst({
    where: { organizationId, slug: propertySlug, isActive: true, deletedAt: null },
    select: { id: true, slug: true, name: true, description: true, localizedContent: true, timezone: true, currency: true, checkInTime: true, checkOutTime: true, minStayNights: true, maxStayNights: true },
  });
}

export async function getPublishedHotelProperty(input: { host: string | null; propertySlug: string; locale: HotelPublicLocale; db?: ReadClient }, dependencies: PublicHotelCatalogDependencies = defaultDependencies) {
  return withPublishedProperty({ ...input, db: input.db ?? defaultPrisma }, async (_tx, _organizationId, property) => ({
    source: "PUBLISHED" as const,
    locale: input.locale,
    property: {
      slug: property.slug,
      name: property.name,
      description: property.description,
      localizedText: localizedText(property.localizedContent, input.locale),
      timezone: property.timezone,
      currency: property.currency,
      checkInTime: property.checkInTime,
      checkOutTime: property.checkOutTime,
      minStayNights: property.minStayNights,
      maxStayNights: property.maxStayNights,
    },
  }), dependencies);
}

export async function listPublishedHotelRoomCategories(input: { host: string | null; propertySlug: string; locale: HotelPublicLocale; db?: ReadClient }, dependencies: PublicHotelCatalogDependencies = defaultDependencies) {
  return withPublishedProperty({ ...input, db: input.db ?? defaultPrisma }, async (tx, organizationId, property) => {
    const candidates = await tx.hotelRoomType.findMany({
      where: { organizationId, propertyId: property.id, isActive: true, deletedAt: null },
      orderBy: [{ sortOrder: "asc" }, { slug: "asc" }],
      select: { id: true, slug: true, name: true, description: true, localizedContent: true, maxAdults: true, maxChildren: true, maxOccupancy: true, beds: true, sizeSqm: true },
    });
    const roomCategories = [];
    for (const room of candidates) {
      const roomApproved = await dependencies.isApproved({ organizationId, propertyId: property.id, resourceType: "ROOM_TYPE", resourceId: room.id, scope: "availability" }, tx);
      if (!roomApproved) continue;

      const activePlans = await tx.hotelRatePlan.findMany({
        where: { organizationId, propertyId: property.id, roomTypeId: room.id, isActive: true },
        select: { id: true },
      });
      let hasPublishedPlan = false;
      for (const plan of activePlans) {
        if (await dependencies.isApproved({ organizationId, propertyId: property.id, resourceType: "RATE_PLAN", resourceId: plan.id, scope: "availability" }, tx)) {
          hasPublishedPlan = true;
          break;
        }
      }
      if (!hasPublishedPlan) continue;

      const beds = publicBeds(room.beds);
      roomCategories.push({
        slug: room.slug,
        name: room.name,
        description: room.description,
        localizedText: localizedText(room.localizedContent, input.locale),
        maxAdults: room.maxAdults,
        maxChildren: room.maxChildren,
        maxOccupancy: room.maxOccupancy,
        ...(beds ? { beds } : {}),
        sizeSqm: room.sizeSqm,
      });
    }
    return { source: "PUBLISHED" as const, locale: input.locale, property: { slug: property.slug }, roomCategories };
  }, dependencies);
}

function publicCancellationTiers(value: Prisma.JsonValue | null): Array<{ cutoffHours: number; retentionBasisPoints: number; penaltyBasis: "RESERVATION_TOTAL" | "FIRST_NIGHT" }> | undefined {
  if (value === null) return undefined;
  if (!Array.isArray(value)) return undefined;
  const tiers = value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const candidate = item as Record<string, Prisma.JsonValue>;
    if (!Number.isSafeInteger(candidate.cutoffHours) || typeof candidate.cutoffHours !== "number" || candidate.cutoffHours < 0) return [];
    if (!Number.isSafeInteger(candidate.retentionBasisPoints) || typeof candidate.retentionBasisPoints !== "number" || candidate.retentionBasisPoints < 0 || candidate.retentionBasisPoints > 10000) return [];
    if (candidate.penaltyBasis !== "RESERVATION_TOTAL" && candidate.penaltyBasis !== "FIRST_NIGHT") return [];
    const penaltyBasis: "RESERVATION_TOTAL" | "FIRST_NIGHT" = candidate.penaltyBasis;
    return [{ cutoffHours: candidate.cutoffHours, retentionBasisPoints: candidate.retentionBasisPoints, penaltyBasis }];
  });
  return tiers.length === value.length ? tiers : undefined;
}

export async function listPublishedHotelRoomPolicies(input: { host: string | null; propertySlug: string; roomTypeSlug: string; locale: HotelPublicLocale; db?: ReadClient }, dependencies: PublicHotelCatalogDependencies = defaultDependencies) {
  return withPublishedProperty({ ...input, db: input.db ?? defaultPrisma }, async (tx, organizationId, property) => {
    const room = await tx.hotelRoomType.findFirst({
      where: { organizationId, propertyId: property.id, slug: input.roomTypeSlug, isActive: true, deletedAt: null },
      select: { id: true, slug: true },
    });
    if (!room || !(await dependencies.isApproved({ organizationId, propertyId: property.id, resourceType: "ROOM_TYPE", resourceId: room.id, scope: "availability" }, tx))) return null;

    const plans = await tx.hotelRatePlan.findMany({
      where: { organizationId, propertyId: property.id, roomTypeId: room.id, isActive: true },
      select: {
        id: true,
        cancellationPolicy: {
          select: { id: true, key: true, name: true, description: true, localizedContent: true, freeCancellationCutoffHours: true, fullCancellationRetention: true, cancellationTiers: true, isActive: true },
        },
      },
    });
    const policies = new Map<string, {
      key: string;
      name: string;
      description: string | null;
      localizedText: string | null;
      freeCancellationCutoffHours: number;
      fullCancellationRetention: number;
      cancellationTiers?: Array<{ cutoffHours: number; retentionBasisPoints: number; penaltyBasis: "RESERVATION_TOTAL" | "FIRST_NIGHT" }>;
    }>();

    for (const plan of plans) {
      const policy = plan.cancellationPolicy;
      if (!policy?.isActive) continue;
      if (!(await dependencies.isApproved({ organizationId, propertyId: property.id, resourceType: "RATE_PLAN", resourceId: plan.id, scope: "availability" }, tx))) continue;
      if (!(await dependencies.isApproved({ organizationId, propertyId: property.id, resourceType: "CANCELLATION_POLICY", resourceId: policy.id, scope: "policies" }, tx))) continue;
      const fullCancellationRetention = policy.fullCancellationRetention / 10000;
      const cancellationTiers = publicCancellationTiers(policy.cancellationTiers);
      if (!Number.isFinite(fullCancellationRetention) || fullCancellationRetention < 0 || fullCancellationRetention > 1) continue;
      if (policy.cancellationTiers !== null && !cancellationTiers) continue;
      policies.set(policy.id, {
        key: policy.key,
        name: policy.name,
        description: policy.description,
        localizedText: localizedText(policy.localizedContent, input.locale),
        freeCancellationCutoffHours: policy.freeCancellationCutoffHours,
        fullCancellationRetention,
        ...(cancellationTiers ? { cancellationTiers } : {}),
      });
    }

    const cancellationPolicies = [...policies.values()].sort((left, right) => left.key.localeCompare(right.key));
    return { source: "PUBLISHED" as const, locale: input.locale, property: { slug: property.slug }, roomCategory: { slug: room.slug }, cancellationPolicies };
  }, dependencies);
}
