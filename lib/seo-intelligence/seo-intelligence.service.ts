import "server-only";

import type { InternalBusinessEntityType, Prisma, SeoOpportunityType } from "@prisma/client";
import { ApiError } from "@/lib/api-guards";
import prisma from "@/lib/db";
import {
  createBusinessEntityRelation,
  ensureOrganizationBusinessEntity,
  upsertBusinessEntity,
  upsertBusinessEntityMetadata,
} from "@/lib/business-entity/business-entity.service";
import { getReviewSeoReadiness } from "@/lib/customer-reputation/customer-reputation.service";

export type SchemaHintType = "Restaurant" | "LocalBusiness" | "Product" | "Service" | "FAQPage" | "Menu";

function schemaTypeForEntity(entityType: InternalBusinessEntityType, organizationType?: "SHOP" | "APPOINTMENT"): SchemaHintType {
  if (entityType === "PRODUCT") return "Product";
  if (entityType === "SERVICE") return "Service";
  if (entityType === "CATEGORY" || entityType === "PRODUCT_CATEGORY") return "Menu";
  if (entityType === "ORGANIZATION" && organizationType === "SHOP") return "Restaurant";
  return "LocalBusiness";
}

function opportunityPriority(type: SeoOpportunityType) {
  if (type === "LOCATION_PAGE_MISSING" || type === "PRODUCT_DESCRIPTION_MISSING") return "HIGH" as const;
  if (type === "FAQ_MISSING" || type === "SCHEMA_HINT_MISSING") return "MEDIUM" as const;
  return "LOW" as const;
}

async function upsertOpportunity(input: {
  organizationId: string;
  entityId: string;
  opportunityType: SeoOpportunityType;
  metadata?: Prisma.InputJsonObject;
}) {
  const where = {
    organizationId_entityId_opportunityType: {
      organizationId: input.organizationId,
      entityId: input.entityId,
      opportunityType: input.opportunityType,
    },
  };
  const existing = await prisma.seoOpportunity.findUnique({ where });
  if (existing && ["DISMISSED", "CONTENT_REQUESTED", "RESOLVED"].includes(existing.status)) {
    return existing;
  }
  return prisma.seoOpportunity.upsert({
    where: {
      organizationId_entityId_opportunityType: {
        organizationId: input.organizationId,
        entityId: input.entityId,
        opportunityType: input.opportunityType,
      },
    },
    update: {
      status: "OPEN",
      priority: opportunityPriority(input.opportunityType),
      metadata: input.metadata,
    },
    create: {
      organizationId: input.organizationId,
      entityId: input.entityId,
      opportunityType: input.opportunityType,
      priority: opportunityPriority(input.opportunityType),
      metadata: input.metadata,
    },
  });
}

export async function indexOrganizationBusinessGraph(organizationId: string) {
  const organization = await prisma.organization.findFirst({
    where: { id: organizationId, isActive: true, deletedAt: null },
    include: {
      productCategories: { where: { deletedAt: null }, take: 100 },
      products: { where: { deletedAt: null }, take: 250 },
      serviceCategories: { where: { deletedAt: null }, take: 100 },
      services: { where: { deletedAt: null }, take: 250 },
      locations: { take: 50 },
      campaigns: { take: 50 },
      fanpagePosts: { take: 50 },
      images: { take: 50 },
    },
  });
  if (!organization) throw new ApiError(404, "Organization not found");

  const root = await ensureOrganizationBusinessEntity({ organizationId });
  const indexed = [root];

  for (const category of organization.productCategories) {
    const entity = await upsertBusinessEntity({
      organizationId,
      entityType: "CATEGORY",
      entityId: category.id,
      title: category.name,
      slug: category.slug,
      metadata: { sourceModel: "ProductCategory", descriptionPresent: Boolean(category.description), imagePresent: Boolean(category.image) },
    });
    await createBusinessEntityRelation({ organizationId, sourceEntityId: root.id, targetEntityId: entity.id, relationType: "HAS_CATEGORY" });
    indexed.push(entity);
  }

  for (const product of organization.products) {
    const entity = await upsertBusinessEntity({
      organizationId,
      entityType: "PRODUCT",
      entityId: product.id,
      title: product.name,
      slug: product.slug,
      metadata: { descriptionPresent: Boolean(product.description), imagePresent: Boolean(product.image), price: Number(product.basePrice) },
    });
    await createBusinessEntityRelation({ organizationId, sourceEntityId: root.id, targetEntityId: entity.id, relationType: "HAS_PRODUCT" });
    indexed.push(entity);
  }

  for (const category of organization.serviceCategories) {
    const entity = await upsertBusinessEntity({
      organizationId,
      entityType: "CATEGORY",
      entityId: category.id,
      title: category.name,
      slug: category.slug,
      metadata: { sourceModel: "ServiceCategory", descriptionPresent: Boolean(category.description), imagePresent: Boolean(category.image) },
    });
    await createBusinessEntityRelation({ organizationId, sourceEntityId: root.id, targetEntityId: entity.id, relationType: "HAS_CATEGORY" });
    indexed.push(entity);
  }

  for (const service of organization.services) {
    const entity = await upsertBusinessEntity({
      organizationId,
      entityType: "SERVICE",
      entityId: service.id,
      title: service.name,
      slug: service.slug,
      metadata: { descriptionPresent: Boolean(service.description), imagePresent: Boolean(service.image), price: Number(service.price), duration: service.duration },
    });
    await createBusinessEntityRelation({ organizationId, sourceEntityId: root.id, targetEntityId: entity.id, relationType: "HAS_SERVICE" });
    indexed.push(entity);
  }

  for (const location of organization.locations) {
    const entity = await upsertBusinessEntity({
      organizationId,
      entityType: "LOCATION",
      entityId: location.id,
      title: organization.address || organization.name,
      metadata: { sourceModel: "Location", latitude: location.latitude, longitude: location.longitude },
    });
    await createBusinessEntityRelation({ organizationId, sourceEntityId: root.id, targetEntityId: entity.id, relationType: "LOCATED_AT" });
    indexed.push(entity);
  }

  for (const campaign of organization.campaigns) {
    const entity = await upsertBusinessEntity({
      organizationId,
      entityType: "CAMPAIGN",
      entityId: campaign.id,
      title: campaign.title,
      metadata: { sourceModel: "Campaign", status: campaign.status },
    });
    await createBusinessEntityRelation({ organizationId, sourceEntityId: root.id, targetEntityId: entity.id, relationType: "PART_OF_CAMPAIGN" });
    indexed.push(entity);
  }

  for (const post of organization.fanpagePosts) {
    const entity = await upsertBusinessEntity({
      organizationId,
      entityType: "CONTENT",
      entityId: post.id,
      title: post.title || "Fanpage content",
      metadata: { sourceModel: "FanpagePost", isPublished: post.isPublished },
    });
    await createBusinessEntityRelation({ organizationId, sourceEntityId: root.id, targetEntityId: entity.id, relationType: "HAS_CONTENT" });
    indexed.push(entity);
  }

  for (const image of organization.images) {
    const entity = await upsertBusinessEntity({
      organizationId,
      entityType: "MEDIA",
      entityId: image.id,
      title: image.filename || image.url,
      metadata: { sourceModel: "Image", purpose: image.purpose, access: image.access },
    });
    await createBusinessEntityRelation({ organizationId, sourceEntityId: root.id, targetEntityId: entity.id, relationType: "HAS_MEDIA" });
    indexed.push(entity);
  }

  return { root, indexedCount: indexed.length };
}

export async function detectEntityCompleteness(input: { organizationId: string; entityId: string }) {
  const entity = await prisma.businessEntity.findFirst({
    where: { id: input.entityId, organizationId: input.organizationId },
    include: { metadataEntries: true, outgoingRelations: true, incomingRelations: true, socialPosts: true },
  });
  if (!entity) throw new ApiError(404, "Business entity not found");
  const metadata = entity.metadata && typeof entity.metadata === "object" && !Array.isArray(entity.metadata)
    ? entity.metadata as Record<string, unknown>
    : {};
  return {
    hasDescription: metadata.descriptionPresent === true || entity.metadataEntries.some((entry) => Boolean(entry.seoDescription)),
    hasImage: metadata.imagePresent === true || entity.outgoingRelations.some((relation) => relation.relationType === "HAS_MEDIA"),
    hasSchemaHint: entity.metadataEntries.some((entry) => Boolean(entry.schemaType)),
    hasSocialPost: entity.socialPosts.length > 0 || entity.outgoingRelations.some((relation) => relation.relationType === "HAS_SOCIAL_POST"),
    relationCount: entity.outgoingRelations.length + entity.incomingRelations.length,
  };
}

export async function generateSchemaHints(input: { organizationId: string; entityId?: string }) {
  const organization = await prisma.organization.findFirst({
    where: { id: input.organizationId, isActive: true, deletedAt: null },
    select: { id: true, type: true, name: true, address: true, phone: true, email: true },
  });
  if (!organization) throw new ApiError(404, "Organization not found");
  const entities = await prisma.businessEntity.findMany({
    where: {
      organizationId: input.organizationId,
      status: { not: "ARCHIVED" },
      ...(input.entityId ? { id: input.entityId } : {}),
    },
    take: 250,
  });
  const hints = entities.map((entity) => ({
    entityId: entity.id,
    entityType: entity.entityType,
    schemaType: schemaTypeForEntity(entity.entityType, organization.type),
    requiredFields: entity.entityType === "PRODUCT"
      ? ["name", "offers.price", "image", "description"]
      : entity.entityType === "SERVICE"
        ? ["name", "provider", "areaServed", "description"]
        : ["name", "address", "telephone"],
    availableFields: {
      name: Boolean(entity.title),
      slug: Boolean(entity.slug),
      organizationPhone: Boolean(organization.phone),
      organizationEmail: Boolean(organization.email),
      organizationAddress: Boolean(organization.address),
    },
  }));
  for (const hint of hints) {
    await upsertBusinessEntityMetadata({
      organizationId: input.organizationId,
      entityId: hint.entityId,
      schemaType: hint.schemaType,
      metadata: { schemaHint: hint },
    });
  }
  return hints;
}

export async function suggestSeoOpportunities(input: { organizationId: string; entityId?: string }) {
  const entities = await prisma.businessEntity.findMany({
    where: {
      organizationId: input.organizationId,
      status: { not: "ARCHIVED" },
      ...(input.entityId ? { id: input.entityId } : {}),
    },
    include: { metadataEntries: true },
    take: 250,
  });
  if (entities.length === 0) throw new ApiError(404, "Business entities not found");
  const opportunities = [];
  for (const entity of entities) {
    const completeness = await detectEntityCompleteness({ organizationId: input.organizationId, entityId: entity.id });
    if (entity.entityType === "PRODUCT" && !completeness.hasDescription) {
      opportunities.push(await upsertOpportunity({
        organizationId: input.organizationId,
        entityId: entity.id,
        opportunityType: "PRODUCT_DESCRIPTION_MISSING",
        metadata: { entityType: entity.entityType, title: entity.title },
      }));
    }
    if (entity.entityType === "SERVICE" && !completeness.hasDescription) {
      opportunities.push(await upsertOpportunity({
        organizationId: input.organizationId,
        entityId: entity.id,
        opportunityType: "SERVICE_DESCRIPTION_MISSING",
        metadata: { entityType: entity.entityType, title: entity.title },
      }));
    }
    if (entity.entityType === "ORGANIZATION" && !completeness.hasDescription) {
      opportunities.push(await upsertOpportunity({
        organizationId: input.organizationId,
        entityId: entity.id,
        opportunityType: "BUSINESS_DESCRIPTION_MISSING",
        metadata: { title: entity.title },
      }));
      opportunities.push(await upsertOpportunity({
        organizationId: input.organizationId,
        entityId: entity.id,
        opportunityType: "FAQ_MISSING",
        metadata: { title: entity.title },
      }));
    }
    if (!completeness.hasImage && ["PRODUCT", "SERVICE", "ORGANIZATION"].includes(entity.entityType)) {
      opportunities.push(await upsertOpportunity({
        organizationId: input.organizationId,
        entityId: entity.id,
        opportunityType: "IMAGE_MISSING",
        metadata: { entityType: entity.entityType, title: entity.title },
      }));
    }
    if (!completeness.hasSchemaHint) {
      opportunities.push(await upsertOpportunity({
        organizationId: input.organizationId,
        entityId: entity.id,
        opportunityType: "SCHEMA_HINT_MISSING",
        metadata: { entityType: entity.entityType, title: entity.title },
      }));
    }
    if (!completeness.hasSocialPost && ["PRODUCT", "SERVICE", "ORGANIZATION"].includes(entity.entityType)) {
      opportunities.push(await upsertOpportunity({
        organizationId: input.organizationId,
        entityId: entity.id,
        opportunityType: "SOCIAL_CONTENT_MISSING",
        metadata: { entityType: entity.entityType, title: entity.title },
      }));
    }
  }
  return opportunities;
}

export async function analyzeOrganizationEntity(organizationId: string) {
  const indexed = await indexOrganizationBusinessGraph(organizationId);
  const [schemaHints, opportunities, graph, reviewSeoReadiness] = await Promise.all([
    generateSchemaHints({ organizationId }),
    suggestSeoOpportunities({ organizationId }),
    prisma.businessEntityRelation.findMany({
      where: { organizationId },
      take: 250,
    }),
    getReviewSeoReadiness({ organizationId }),
  ]);
  return {
    root: indexed.root,
    indexedCount: indexed.indexedCount,
    graph: {
      relationCount: graph.length,
      relationTypes: Array.from(new Set(graph.map((relation) => relation.relationType))),
    },
    schemaHints,
    reviewSeoReadiness,
    opportunities,
  };
}
