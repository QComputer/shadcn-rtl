import "server-only";

import type {
  ContentDistributionTarget,
  IntegrationProvider,
  Prisma,
  SeoContentType,
  SeoOpportunityPriority,
  SeoOpportunityType,
} from "@prisma/client";
import { ApiError } from "@/lib/api-guards";
import prisma from "@/lib/db";
import { sanitizeIntegrationConfig } from "@/lib/integrations/organization-integrations";
import { getContentProviderAdapter } from "@/lib/seo-content/content-provider-adapters";

const ACTIVE_REQUEST_STATUSES = [
  "DETECTED",
  "DRAFT",
  "READY_FOR_REVIEW",
  "APPROVED",
  "QUEUED",
  "SENT_TO_PROVIDER",
  "PROVIDER_PROCESSING",
  "RESULT_RECEIVED",
] as const;

function sanitizeJson(input: unknown): Prisma.InputJsonObject {
  return sanitizeIntegrationConfig(input) as Prisma.InputJsonObject;
}

function asStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
}

function contentTypeForOpportunity(type: SeoOpportunityType): SeoContentType {
  switch (type) {
    case "PRODUCT_DESCRIPTION_MISSING":
      return "PRODUCT_CONTENT";
    case "SERVICE_DESCRIPTION_MISSING":
      return "SERVICE_CONTENT";
    case "FAQ_MISSING":
      return "FAQ";
    case "LOCATION_PAGE_MISSING":
      return "LOCAL_LANDING_PAGE";
    case "BUSINESS_DESCRIPTION_MISSING":
      return "BUSINESS_DESCRIPTION";
    case "SOCIAL_CONTENT_MISSING":
      return "SOCIAL_POST";
    default:
      return "ARTICLE";
  }
}

function contentGoalForType(contentType: SeoContentType) {
  switch (contentType) {
    case "PRODUCT_CONTENT":
      return "Create factual product content from verified catalog data.";
    case "SERVICE_CONTENT":
      return "Create factual service content from verified appointment/service data.";
    case "FAQ":
      return "Create a draft FAQ brief using only verified business facts.";
    case "LOCAL_LANDING_PAGE":
      return "Create a local SEO landing-page brief from verified organization and location data.";
    case "BUSINESS_DESCRIPTION":
      return "Create a business description brief from verified organization data.";
    case "SOCIAL_POST":
      return "Create a social copy brief for future manual social distribution.";
    case "VIDEO_SCRIPT":
      return "Create a short video script brief for future media enrichment.";
    case "CAMPAIGN_COPY":
      return "Create campaign copy from verified campaign and business context.";
    default:
      return "Create an article brief from verified Bazarbaaz data.";
  }
}

async function requireOrganization(organizationId: string) {
  const organization = await prisma.organization.findFirst({
    where: { id: organizationId, isActive: true, deletedAt: null },
    select: {
      id: true,
      name: true,
      slug: true,
      locale: true,
      description: true,
      address: true,
      phone: true,
      email: true,
    },
  });
  if (!organization) throw new ApiError(404, "Organization not found");
  return organization;
}

async function requireBusinessEntity(organizationId: string, businessEntityId: string) {
  const entity = await prisma.businessEntity.findFirst({
    where: { id: businessEntityId, organizationId, status: { not: "ARCHIVED" } },
    include: {
      metadataEntries: true,
      incomingRelations: { include: { sourceEntity: true }, take: 25 },
      outgoingRelations: { include: { targetEntity: true }, take: 25 },
    },
  });
  if (!entity) throw new ApiError(404, "Business entity not found");
  return entity;
}

async function requireOpportunity(organizationId: string, opportunityId: string) {
  const opportunity = await prisma.seoOpportunity.findFirst({
    where: { id: opportunityId, organizationId },
    include: { entity: true },
  });
  if (!opportunity) throw new ApiError(404, "SEO opportunity not found");
  return opportunity;
}

async function buildStructuredBrief(input: {
  organizationId: string;
  businessEntityId: string;
  contentRequestId: string;
  contentType: SeoContentType;
  locale?: string;
  targetKeywords?: string[];
  targetLocation?: string | null;
  metadata?: unknown;
}) {
  const [organization, entity] = await Promise.all([
    requireOrganization(input.organizationId),
    requireBusinessEntity(input.organizationId, input.businessEntityId),
  ]);
  const schemaType = entity.metadataEntries.find((entry) => entry.schemaType)?.schemaType ?? null;
  const metadata = entity.metadata && typeof entity.metadata === "object" && !Array.isArray(entity.metadata)
    ? entity.metadata as Record<string, unknown>
    : {};
  const entityMetadata = sanitizeJson(metadata);
  const factualContext = {
    organization: {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      descriptionPresent: Boolean(organization.description),
      address: organization.address,
      phonePresent: Boolean(organization.phone),
      emailPresent: Boolean(organization.email),
    },
    entity: {
      id: entity.id,
      entityType: entity.entityType,
      title: entity.title,
      slug: entity.slug,
      metadata: entityMetadata,
    },
  } as Prisma.InputJsonObject;
  const relatedEntities = [
    ...entity.outgoingRelations.map((relation) => relation.targetEntity.title),
    ...entity.incomingRelations.map((relation) => relation.sourceEntity.title),
  ].filter((value, index, values) => values.indexOf(value) === index).slice(0, 20);
  const inferredKeywords = input.targetKeywords?.length
    ? input.targetKeywords
    : [entity.title, organization.address ? `${entity.title} ${organization.address}` : null]
      .filter((value): value is string => Boolean(value));
  const primaryKeyword = inferredKeywords[0] ?? entity.title;
  const secondaryKeywords = inferredKeywords.slice(1);
  const location = input.targetLocation ?? organization.address ?? null;

  return prisma.seoContentBrief.upsert({
    where: { contentRequestId: input.contentRequestId },
    update: {
      businessEntityId: input.businessEntityId,
      contentType: input.contentType,
      locale: input.locale ?? organization.locale ?? "fa",
      contentGoal: contentGoalForType(input.contentType),
      primaryKeyword,
      secondaryKeywords,
      location,
      desiredSchemaType: schemaType,
      factualContext,
      relatedEntities,
      requiredReferences: ["BusinessEntity", "SeoOpportunity", "BusinessEntityMetadata"],
      prohibitedClaims: [
        "Do not invent addresses.",
        "Do not invent opening hours.",
        "Do not invent ratings or reviews.",
        "Do not invent certifications.",
        "Do not include customer identity information.",
      ],
      toneHints: ["clear", "local", "factual"],
      suggestedTitle: primaryKeyword,
      suggestedOutline: [
        "Verified business context",
        "Relevant products or services",
        "Local context where available",
        "Manual review checklist",
      ],
      metadata: input.metadata ? sanitizeJson(input.metadata) : { keywordMetricsVerified: false },
    },
    create: {
      organizationId: input.organizationId,
      contentRequestId: input.contentRequestId,
      businessEntityId: input.businessEntityId,
      contentType: input.contentType,
      locale: input.locale ?? organization.locale ?? "fa",
      contentGoal: contentGoalForType(input.contentType),
      primaryKeyword,
      secondaryKeywords,
      location,
      audience: "Local customers",
      desiredSchemaType: schemaType,
      factualContext,
      relatedEntities,
      requiredReferences: ["BusinessEntity", "SeoOpportunity", "BusinessEntityMetadata"],
      prohibitedClaims: [
        "Do not invent addresses.",
        "Do not invent opening hours.",
        "Do not invent ratings or reviews.",
        "Do not invent certifications.",
        "Do not include customer identity information.",
      ],
      toneHints: ["clear", "local", "factual"],
      suggestedTitle: primaryKeyword,
      suggestedOutline: [
        "Verified business context",
        "Relevant products or services",
        "Local context where available",
        "Manual review checklist",
      ],
      metadata: input.metadata ? sanitizeJson(input.metadata) : { keywordMetricsVerified: false },
    },
  });
}

export async function listSeoOpportunities(input: { organizationId: string }) {
  await requireOrganization(input.organizationId);
  return prisma.seoOpportunity.findMany({
    where: { organizationId: input.organizationId },
    include: { entity: true, contentRequests: { orderBy: { createdAt: "desc" }, take: 3 } },
    orderBy: [{ status: "asc" }, { priority: "desc" }, { updatedAt: "desc" }],
  });
}

export async function updateSeoOpportunityStatus(input: {
  organizationId: string;
  opportunityId: string;
  status: "ACCEPTED" | "DISMISSED" | "RESOLVED";
}) {
  await requireOpportunity(input.organizationId, input.opportunityId);
  return prisma.seoOpportunity.update({
    where: { id: input.opportunityId },
    data: { status: input.status },
  });
}

export async function createSeoContentRequest(input: {
  organizationId: string;
  businessEntityId: string;
  seoOpportunityId?: string | null;
  contentType?: SeoContentType;
  locale?: string;
  targetKeywords?: string[];
  targetLocation?: string | null;
  priority?: SeoOpportunityPriority;
  provider?: IntegrationProvider;
  createdByUserId?: string | null;
  metadata?: unknown;
}) {
  await requireOrganization(input.organizationId);
  const entity = await requireBusinessEntity(input.organizationId, input.businessEntityId);
  const opportunity = input.seoOpportunityId ? await requireOpportunity(input.organizationId, input.seoOpportunityId) : null;
  if (opportunity && opportunity.entityId !== entity.id) {
    throw new ApiError(400, "SEO opportunity does not belong to the target business entity");
  }
  if (opportunity?.status === "DISMISSED") {
    throw new ApiError(409, "Dismissed SEO opportunities cannot be requested without reopening");
  }
  const contentType = input.contentType ?? (opportunity ? contentTypeForOpportunity(opportunity.opportunityType) : "ARTICLE");
  if (opportunity) {
    const existing = await prisma.seoContentRequest.findFirst({
      where: {
        organizationId: input.organizationId,
        seoOpportunityId: opportunity.id,
        status: { in: [...ACTIVE_REQUEST_STATUSES] },
      },
      include: { brief: true, contentAssets: true },
    });
    if (existing) return existing;
  }

  const request = await prisma.seoContentRequest.create({
    data: {
      organizationId: input.organizationId,
      businessEntityId: entity.id,
      seoOpportunityId: opportunity?.id ?? null,
      contentType,
      locale: input.locale ?? "fa",
      targetKeywords: input.targetKeywords ?? [],
      targetLocation: input.targetLocation ?? null,
      priority: input.priority ?? opportunity?.priority ?? "MEDIUM",
      provider: input.provider ?? "INOTI_IAM",
      createdByUserId: input.createdByUserId ?? null,
      status: "READY_FOR_REVIEW",
      metadata: input.metadata ? sanitizeJson(input.metadata) : { source: "seo-content-workflow" },
    },
  });
  await buildStructuredBrief({
    organizationId: input.organizationId,
    businessEntityId: entity.id,
    contentRequestId: request.id,
    contentType,
    locale: request.locale,
    targetKeywords: input.targetKeywords,
    targetLocation: input.targetLocation,
    metadata: { generatedFrom: opportunity?.opportunityType ?? "manual" },
  });
  if (opportunity) {
    await prisma.seoOpportunity.update({
      where: { id: opportunity.id },
      data: { status: "ACCEPTED" },
    });
  }
  return prisma.seoContentRequest.findFirstOrThrow({
    where: { id: request.id, organizationId: input.organizationId },
    include: { brief: true, contentAssets: true, seoOpportunity: true, businessEntity: true },
  });
}

export async function listSeoContentRequests(input: { organizationId: string }) {
  await requireOrganization(input.organizationId);
  return prisma.seoContentRequest.findMany({
    where: { organizationId: input.organizationId },
    include: { brief: true, contentAssets: true, businessEntity: true, seoOpportunity: true },
    orderBy: { updatedAt: "desc" },
  });
}

export async function getSeoContentRequest(input: { organizationId: string; requestId: string }) {
  const request = await prisma.seoContentRequest.findFirst({
    where: { id: input.requestId, organizationId: input.organizationId },
    include: { brief: true, contentAssets: { include: { distributions: true } }, businessEntity: true, seoOpportunity: true },
  });
  if (!request) throw new ApiError(404, "SEO content request not found");
  return request;
}

export async function approveSeoContentRequest(input: {
  organizationId: string;
  requestId: string;
  approvedByUserId?: string | null;
}) {
  const request = await getSeoContentRequest(input);
  if (["REJECTED", "CANCELLED", "FAILED"].includes(request.status)) {
    throw new ApiError(409, "SEO content request cannot be approved in its current state");
  }
  return prisma.seoContentRequest.update({
    where: { id: request.id },
    data: {
      status: "APPROVED",
      approvalState: "GENERATION_APPROVED",
      approvedByUserId: input.approvedByUserId ?? null,
      approvedAt: new Date(),
    },
    include: { brief: true, contentAssets: true, businessEntity: true, seoOpportunity: true },
  });
}

export async function runSeoContentRequestDryRun(input: {
  organizationId: string;
  requestId: string;
}) {
  const request = await getSeoContentRequest(input);
  if (request.status !== "APPROVED" || request.approvalState !== "GENERATION_APPROVED") {
    throw new ApiError(409, "Generation approval is required before provider dry-run");
  }
  if (!request.brief) throw new ApiError(409, "SEO content brief is required before provider dry-run");
  const provider = request.provider ?? "INOTI_IAM";
  const adapter = getContentProviderAdapter(provider);
  if (!adapter) throw new ApiError(409, "Content provider is not supported");
  const readiness = adapter.getReadiness();
  if (!readiness.ready || !readiness.dryRun) throw new ApiError(409, "Content provider is not ready for dry-run");

  const result = await adapter.createContentRequest({
    organizationId: input.organizationId,
    contentRequestId: request.id,
    provider,
    contentType: request.contentType,
    locale: request.locale,
    brief: {
      contentGoal: request.brief.contentGoal,
      targetEntity: request.businessEntity.title,
      primaryKeyword: request.brief.primaryKeyword,
      secondaryKeywords: asStringArray(request.brief.secondaryKeywords),
      location: request.brief.location,
      desiredSchemaType: request.brief.desiredSchemaType,
      factualContext: request.brief.factualContext && typeof request.brief.factualContext === "object" && !Array.isArray(request.brief.factualContext)
        ? request.brief.factualContext as Record<string, unknown>
        : {},
      prohibitedClaims: asStringArray(request.brief.prohibitedClaims),
      suggestedTitle: request.brief.suggestedTitle,
      suggestedOutline: asStringArray(request.brief.suggestedOutline),
    },
  });

  const asset = await prisma.contentAsset.create({
    data: {
      organizationId: input.organizationId,
      contentRequestId: request.id,
      businessEntityId: request.businessEntityId,
      source: "PROVIDER_DRY_RUN",
      contentType: request.contentType,
      title: result.title,
      body: result.body,
      locale: request.locale,
      status: "REVIEW_REQUIRED",
      sourceProvider: provider,
      providerResultReference: result.providerResultReference,
      seoTitle: result.seoTitle,
      seoDescription: result.seoDescription,
      schemaType: result.schemaType,
      keywords: request.targetKeywords ?? [],
      metadata: sanitizeJson(result.metadata),
    },
  });
  await prisma.contentDistribution.createMany({
    data: [
      { organizationId: input.organizationId, contentAssetId: asset.id, target: "WEBSITE", status: "PLANNED", metadata: { publicationRequiresApproval: true } },
      { organizationId: input.organizationId, contentAssetId: asset.id, target: "IAM", status: "PLANNED", provider, metadata: { dryRunOnly: true } },
    ],
    skipDuplicates: true,
  });
  const updated = await prisma.seoContentRequest.update({
    where: { id: request.id },
    data: {
      status: "RESULT_RECEIVED",
      approvalState: "RESULT_REVIEW_REQUIRED",
      providerRequestReference: result.providerRequestReference,
      submittedAt: new Date(),
      resultReceivedAt: new Date(),
    },
    include: { brief: true, contentAssets: { include: { distributions: true } }, businessEntity: true, seoOpportunity: true },
  });
  if (request.seoOpportunityId) {
    await prisma.seoOpportunity.update({
      where: { id: request.seoOpportunityId },
      data: { status: "CONTENT_REQUESTED" },
    });
  }
  return updated;
}

export async function reviewSeoContentResult(input: {
  organizationId: string;
  requestId: string;
  assetId: string;
  approved: boolean;
  reviewerUserId?: string | null;
  metadata?: unknown;
}) {
  const request = await getSeoContentRequest(input);
  const asset = request.contentAssets.find((candidate) => candidate.id === input.assetId);
  if (!asset) throw new ApiError(404, "Content asset not found");
  const reviewedAt = new Date();
  const updatedAsset = await prisma.contentAsset.update({
    where: { id: asset.id },
    data: {
      status: input.approved ? "APPROVED" : "REJECTED",
      reviewedByUserId: input.reviewerUserId ?? null,
      reviewedAt,
      approvedByUserId: input.approved ? input.reviewerUserId ?? null : null,
      approvedAt: input.approved ? reviewedAt : null,
      metadata: input.metadata ? sanitizeJson(input.metadata) : asset.metadata ?? undefined,
    },
  });
  await prisma.seoContentRequest.update({
    where: { id: request.id },
    data: {
      approvalState: input.approved ? "RESULT_APPROVED" : "REJECTED",
      status: input.approved ? "RESULT_RECEIVED" : "REJECTED",
      reviewedByUserId: input.reviewerUserId ?? null,
      reviewedAt,
    },
  });
  return updatedAsset;
}

export async function approveContentPublication(input: {
  organizationId: string;
  requestId: string;
  approvedByUserId?: string | null;
}) {
  const request = await getSeoContentRequest(input);
  const approvedAsset = request.contentAssets.find((asset) => asset.status === "APPROVED");
  if (!approvedAsset) throw new ApiError(409, "A reviewed content asset is required before publication approval");
  return prisma.seoContentRequest.update({
    where: { id: request.id },
    data: {
      approvalState: "PUBLICATION_APPROVED",
      publicationApprovedByUserId: input.approvedByUserId ?? null,
      publicationApprovedAt: new Date(),
    },
    include: { brief: true, contentAssets: { include: { distributions: true } }, businessEntity: true, seoOpportunity: true },
  });
}

export async function planContentDistribution(input: {
  organizationId: string;
  contentAssetId: string;
  target: ContentDistributionTarget;
  provider?: IntegrationProvider | null;
  metadata?: unknown;
}) {
  const asset = await prisma.contentAsset.findFirst({
    where: { id: input.contentAssetId, organizationId: input.organizationId },
  });
  if (!asset) throw new ApiError(404, "Content asset not found");
  return prisma.contentDistribution.upsert({
    where: {
      organizationId_contentAssetId_target: {
        organizationId: input.organizationId,
        contentAssetId: asset.id,
        target: input.target,
      },
    },
    update: {
      status: "PLANNED",
      provider: input.provider ?? null,
      metadata: input.metadata ? sanitizeJson(input.metadata) : undefined,
    },
    create: {
      organizationId: input.organizationId,
      contentAssetId: asset.id,
      target: input.target,
      status: "PLANNED",
      provider: input.provider ?? null,
      metadata: input.metadata ? sanitizeJson(input.metadata) : undefined,
    },
  });
}

export async function getDemoSeoContentReadiness() {
  const [organizationsWithOpportunities, requestsByStatus, assetsByStatus] = await Promise.all([
    prisma.seoOpportunity.groupBy({
      by: ["organizationId"],
      where: {
        organization: { settings: { settings: { path: ["demo", "enabled"], equals: true } } },
      },
    }),
    prisma.seoContentRequest.groupBy({
      by: ["status"],
      where: {
        organization: { settings: { settings: { path: ["demo", "enabled"], equals: true } } },
      },
      _count: { _all: true },
    }),
    prisma.contentAsset.groupBy({
      by: ["status"],
      where: {
        organization: { settings: { settings: { path: ["demo", "enabled"], equals: true } } },
      },
      _count: { _all: true },
    }),
  ]);
  return {
    demoOrganizationsWithSeoOpportunities: organizationsWithOpportunities.length,
    requestsByStatus: requestsByStatus.map((row) => ({ status: row.status, count: row._count._all })),
    assetsByStatus: assetsByStatus.map((row) => ({ status: row.status, count: row._count._all })),
    providerReadiness: getContentProviderAdapter("INOTI_IAM")?.getReadiness() ?? null,
  };
}
