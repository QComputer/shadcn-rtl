import "server-only";

import type {
  BusinessEntityRelationType,
  InternalBusinessEntityType,
  Prisma,
  SocialNetwork,
} from "@prisma/client";
import { ApiError } from "@/lib/api-guards";
import prisma from "@/lib/db";
import { sanitizeIntegrationConfig } from "@/lib/integrations/organization-integrations";

function sanitizeJson(input: unknown): Prisma.InputJsonObject {
  return sanitizeIntegrationConfig(input) as Prisma.InputJsonObject;
}

async function assertOrganization(organizationId: string) {
  const organization = await prisma.organization.findFirst({
    where: { id: organizationId, isActive: true, deletedAt: null },
    select: { id: true },
  });
  if (!organization) throw new ApiError(404, "Organization not found");
}

async function requireEntity(organizationId: string, entityId: string) {
  const entity = await prisma.businessEntity.findFirst({
    where: { id: entityId, organizationId, status: { not: "ARCHIVED" } },
  });
  if (!entity) throw new ApiError(404, "Business entity not found");
  return entity;
}

export async function upsertBusinessEntity(input: {
  organizationId: string;
  entityType: InternalBusinessEntityType;
  entityId: string;
  title: string;
  slug?: string | null;
  status?: "ACTIVE" | "DRAFT" | "ARCHIVED";
  metadata?: unknown;
  tx?: Prisma.TransactionClient;
}) {
  await assertOrganization(input.organizationId);
  const db = input.tx ?? prisma;
  return db.businessEntity.upsert({
    where: {
      organizationId_entityType_entityId: {
        organizationId: input.organizationId,
        entityType: input.entityType,
        entityId: input.entityId,
      },
    },
    update: {
      title: input.title,
      slug: input.slug ?? null,
      status: input.status ?? "ACTIVE",
      metadata: input.metadata ? sanitizeJson(input.metadata) : undefined,
    },
    create: {
      organizationId: input.organizationId,
      entityType: input.entityType,
      entityId: input.entityId,
      title: input.title,
      slug: input.slug ?? null,
      status: input.status ?? "ACTIVE",
      metadata: input.metadata ? sanitizeJson(input.metadata) : undefined,
    },
  });
}

export async function createBusinessEntityRelation(input: {
  organizationId: string;
  sourceEntityId: string;
  targetEntityId: string;
  relationType: BusinessEntityRelationType;
  metadata?: unknown;
}) {
  await assertOrganization(input.organizationId);
  if (input.sourceEntityId === input.targetEntityId) throw new ApiError(400, "Self-relations are not supported");
  await Promise.all([
    requireEntity(input.organizationId, input.sourceEntityId),
    requireEntity(input.organizationId, input.targetEntityId),
  ]);
  return prisma.businessEntityRelation.upsert({
    where: {
      organizationId_sourceEntityId_targetEntityId_relationType: {
        organizationId: input.organizationId,
        sourceEntityId: input.sourceEntityId,
        targetEntityId: input.targetEntityId,
        relationType: input.relationType,
      },
    },
    update: {
      metadata: input.metadata ? sanitizeJson(input.metadata) : undefined,
    },
    create: {
      organizationId: input.organizationId,
      sourceEntityId: input.sourceEntityId,
      targetEntityId: input.targetEntityId,
      relationType: input.relationType,
      metadata: input.metadata ? sanitizeJson(input.metadata) : undefined,
    },
  });
}

export async function upsertBusinessEntityMetadata(input: {
  organizationId: string;
  entityId: string;
  locale?: string;
  seoTitle?: string | null;
  seoDescription?: string | null;
  schemaType?: string | null;
  keywords?: string[];
  metadata?: unknown;
}) {
  await assertOrganization(input.organizationId);
  await requireEntity(input.organizationId, input.entityId);
  const locale = input.locale ?? "fa";
  return prisma.businessEntityMetadata.upsert({
    where: {
      organizationId_entityId_locale: {
        organizationId: input.organizationId,
        entityId: input.entityId,
        locale,
      },
    },
    update: {
      seoTitle: input.seoTitle,
      seoDescription: input.seoDescription,
      schemaType: input.schemaType,
      keywords: input.keywords ? input.keywords : undefined,
      metadata: input.metadata ? sanitizeJson(input.metadata) : undefined,
    },
    create: {
      organizationId: input.organizationId,
      entityId: input.entityId,
      locale,
      seoTitle: input.seoTitle,
      seoDescription: input.seoDescription,
      schemaType: input.schemaType,
      keywords: input.keywords ?? [],
      metadata: input.metadata ? sanitizeJson(input.metadata) : undefined,
    },
  });
}

export async function createSocialConnection(input: {
  organizationId: string;
  network: SocialNetwork;
  handle?: string | null;
  externalAccountId?: string | null;
  metadata?: unknown;
}) {
  await assertOrganization(input.organizationId);
  return prisma.socialConnection.create({
    data: {
      organizationId: input.organizationId,
      network: input.network,
      handle: input.handle ?? null,
      externalAccountId: input.externalAccountId ?? null,
      status: "DRAFT",
      metadata: input.metadata ? sanitizeJson(input.metadata) : undefined,
    },
  });
}

export async function createSocialPostPlaceholder(input: {
  organizationId: string;
  businessEntityId?: string | null;
  connectionId?: string | null;
  network: SocialNetwork;
  caption?: string | null;
  metadata?: unknown;
}) {
  await assertOrganization(input.organizationId);
  if (input.businessEntityId) await requireEntity(input.organizationId, input.businessEntityId);
  return prisma.socialPost.create({
    data: {
      organizationId: input.organizationId,
      businessEntityId: input.businessEntityId ?? null,
      connectionId: input.connectionId ?? null,
      network: input.network,
      caption: input.caption ?? null,
      status: "DRAFT",
      metadata: input.metadata ? sanitizeJson(input.metadata) : undefined,
    },
  });
}

export async function getBusinessEntityGraph(input: {
  organizationId: string;
  rootEntityId?: string;
  limit?: number;
}) {
  await assertOrganization(input.organizationId);
  const limit = Math.min(Math.max(input.limit ?? 100, 1), 250);
  if (input.rootEntityId) await requireEntity(input.organizationId, input.rootEntityId);
  const where = input.rootEntityId
    ? {
        organizationId: input.organizationId,
        OR: [{ sourceEntityId: input.rootEntityId }, { targetEntityId: input.rootEntityId }],
      }
    : { organizationId: input.organizationId };
  const [entities, relations] = await Promise.all([
    prisma.businessEntity.findMany({
      where: {
        organizationId: input.organizationId,
        status: { not: "ARCHIVED" },
        ...(input.rootEntityId
          ? {
              OR: [
                { id: input.rootEntityId },
                { incomingRelations: { some: { organizationId: input.organizationId, sourceEntityId: input.rootEntityId } } },
                { outgoingRelations: { some: { organizationId: input.organizationId, targetEntityId: input.rootEntityId } } },
              ],
            }
          : {}),
      },
      include: { metadataEntries: true, seoOpportunities: true, socialPosts: true },
      take: limit,
      orderBy: { updatedAt: "desc" },
    }),
    prisma.businessEntityRelation.findMany({
      where,
      include: { sourceEntity: true, targetEntity: true },
      take: limit,
      orderBy: { createdAt: "desc" },
    }),
  ]);
  return { entities, relations };
}

export async function ensureOrganizationBusinessEntity(input: { organizationId: string }) {
  const organization = await prisma.organization.findFirst({
    where: { id: input.organizationId, isActive: true, deletedAt: null },
    select: { id: true, name: true, slug: true, description: true, address: true, logo: true, coverImage: true },
  });
  if (!organization) throw new ApiError(404, "Organization not found");
  return upsertBusinessEntity({
    organizationId: organization.id,
    entityType: "ORGANIZATION",
    entityId: organization.id,
    title: organization.name,
    slug: organization.slug,
    metadata: {
      descriptionPresent: Boolean(organization.description),
      addressPresent: Boolean(organization.address),
      imagePresent: Boolean(organization.logo || organization.coverImage),
    },
  });
}
