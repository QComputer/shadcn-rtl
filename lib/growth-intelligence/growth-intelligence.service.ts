import "server-only";

import type {
  BusinessGrowthProfileStatus,
  GrowthRecommendationStatus,
  GrowthRecommendationType,
  KeywordClusterSource,
  KeywordClusterStatus,
  KeywordIntent,
  OrganizationCapabilityKey,
  OrganizationIndustryKey,
  Prisma,
  SeoOpportunityPriority,
  SeoOpportunityType,
} from "@prisma/client";
import prisma from "@/lib/db";
import { ApiError } from "@/lib/api-guards";
import { getIndustryTemplate } from "@/lib/business-acquisition/industry-templates";
import { ensureOrganizationBusinessEntity } from "@/lib/business-entity/business-entity.service";
import { indexOrganizationBusinessGraph, suggestSeoOpportunities } from "@/lib/seo-intelligence/seo-intelligence.service";
import { getOrganizationReputationOverview } from "@/lib/customer-reputation/customer-reputation.service";

type DbClient = Prisma.TransactionClient | typeof prisma;

type GrowthProfileInput = {
  organizationId: string;
  primaryGoals?: string[];
  targetAudience?: string[];
  preferredKeywords?: string[];
  preferredLocations?: string[];
  notes?: string | null;
  status?: BusinessGrowthProfileStatus;
  actorUserId?: string | null;
  db?: DbClient;
};

type OrganizationForGrowth = {
  id: string;
  name: string;
  slug: string;
  type: "SHOP" | "APPOINTMENT";
  address: string | null;
  description: string | null;
  acquisition: { industryKey: OrganizationIndustryKey } | null;
  capabilities: Array<{ key: OrganizationCapabilityKey; status: string }>;
  productCategories: Array<{ id: string; name: string; slug: string | null }>;
  products: Array<{ id: string; name: string; slug: string | null }>;
  serviceCategories: Array<{ id: string; name: string; slug: string | null }>;
  services: Array<{ id: string; name: string; slug: string | null }>;
  pilotWorkspace: { seoGrowthPlanner: Prisma.JsonValue | null } | null;
};

export type GrowthPlanReadModel = {
  organization: {
    id: string;
    name: string;
    slug: string;
    industry: OrganizationIndustryKey;
    capabilities: OrganizationCapabilityKey[];
    location: string | null;
  };
  profile: {
    id: string;
    status: BusinessGrowthProfileStatus;
    primaryGoals: string[];
    targetAudience: string[];
    preferredKeywords: string[];
    preferredLocations: string[];
    notes: string | null;
  };
  keywordClusters: Array<{
    id: string;
    keyword: string;
    intent: KeywordIntent;
    priority: SeoOpportunityPriority;
    source: KeywordClusterSource;
    status: KeywordClusterStatus;
  }>;
  recommendations: Array<{
    id: string;
    type: GrowthRecommendationType;
    title: string;
    reason: string;
    priority: SeoOpportunityPriority;
    status: GrowthRecommendationStatus;
    relatedKeywords: string[];
    iamRecommendation: unknown;
    contentBlueprint: unknown;
    futureIntegrationHooks: string[];
  }>;
  ownerNextActions: Array<{ title: string; reason: string; priority: SeoOpportunityPriority }>;
  readiness: {
    seoStrategyStatus: "READY" | "NOT_READY";
    seoScore: number;
    keywordPlanCount: number;
    iamRecommendationCount: number;
    contentOpportunityCount: number;
    trust: { reputationScore: number; reviewCount: number };
    missing: string[];
    nextAction: string | null;
    externalProviderCalls: false;
  };
};

function asJsonObject(value: unknown): Prisma.InputJsonObject {
  return value as Prisma.InputJsonObject;
}

function asJsonArray<T>(value: T[]): Prisma.InputJsonArray {
  return value as Prisma.InputJsonArray;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? Array.from(new Set(value.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim())))
    : [];
}

function normalizeKeyword(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function activeCapabilities(organization: OrganizationForGrowth): OrganizationCapabilityKey[] {
  const capabilities = organization.capabilities.filter((capability) => capability.status === "ACTIVE").map((capability) => capability.key);
  if (capabilities.length > 0) return capabilities;
  return organization.type === "APPOINTMENT" ? ["APPOINTMENT"] : ["SHOP"];
}

function industryForOrganization(organization: OrganizationForGrowth): OrganizationIndustryKey {
  if (organization.acquisition?.industryKey) return organization.acquisition.industryKey;
  if (organization.type === "APPOINTMENT") return "DENTAL_CLINIC";
  if (/کفش|shoe|aka/i.test(organization.name)) return "RETAIL_SHOP";
  return "RESTAURANT";
}

function plannerFromPilot(value: Prisma.JsonValue | null | undefined) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  return {
    businessGoals: stringArray(source.businessGoals),
    targetAudience: stringArray(source.targetAudience),
    preferredKeywords: stringArray(source.preferredKeywords),
    cityLocation: typeof source.cityLocation === "string" ? source.cityLocation.trim() : null,
  };
}

async function requireOrganization(organizationId: string, db: DbClient = prisma): Promise<OrganizationForGrowth> {
  const organization = await db.organization.findFirst({
    where: { id: organizationId, isActive: true, deletedAt: null },
    select: {
      id: true,
      name: true,
      slug: true,
      type: true,
      address: true,
      description: true,
      acquisition: { select: { industryKey: true } },
      capabilities: { select: { key: true, status: true }, orderBy: { key: "asc" } },
      productCategories: { where: { deletedAt: null }, select: { id: true, name: true, slug: true }, take: 20 },
      products: { where: { deletedAt: null }, select: { id: true, name: true, slug: true }, take: 30 },
      serviceCategories: { where: { deletedAt: null }, select: { id: true, name: true, slug: true }, take: 20 },
      services: { where: { deletedAt: null }, select: { id: true, name: true, slug: true }, take: 30 },
      pilotWorkspace: { select: { seoGrowthPlanner: true } },
    },
  });
  if (!organization) throw new ApiError(404, "Organization not found");
  return organization;
}

async function audit(input: {
  db: DbClient;
  action: "CREATE" | "UPDATE";
  entityId: string;
  organizationId: string;
  actorUserId?: string | null;
  description: string;
  newValue?: Prisma.InputJsonValue;
}) {
  await input.db.auditLog.create({
    data: {
      action: input.action,
      entityType: "BusinessGrowthProfile",
      entityId: input.entityId,
      organizationId: input.organizationId,
      userId: input.actorUserId ?? null,
      description: input.description,
      newValue: input.newValue,
    },
  });
}

function profileDefaults(organization: OrganizationForGrowth) {
  const planner = plannerFromPilot(organization.pilotWorkspace?.seoGrowthPlanner);
  const industry = industryForOrganization(organization);
  const template = getIndustryTemplate(industry);
  return {
    primaryGoals: planner.businessGoals.length ? planner.businessGoals : template.growthIntelligence.customerJourneySuggestions,
    targetAudience: planner.targetAudience.length ? planner.targetAudience : ["local customers"],
    preferredKeywords: planner.preferredKeywords.length ? planner.preferredKeywords : template.growthIntelligence.iamPageBlueprintHints,
    preferredLocations: [planner.cityLocation, organization.address].filter((item): item is string => Boolean(item)),
  };
}

export async function upsertBusinessGrowthProfile(input: GrowthProfileInput) {
  const db = input.db ?? prisma;
  const organization = await requireOrganization(input.organizationId, db);
  const defaults = profileDefaults(organization);
  const existing = await db.businessGrowthProfile.findUnique({ where: { organizationId: input.organizationId } });
  const primaryGoals = input.primaryGoals ? stringArray(input.primaryGoals) : existing ? stringArray(existing.primaryGoals) : defaults.primaryGoals;
  const targetAudience = input.targetAudience ? stringArray(input.targetAudience) : existing ? stringArray(existing.targetAudience) : defaults.targetAudience;
  const preferredKeywords = input.preferredKeywords ? stringArray(input.preferredKeywords) : existing ? stringArray(existing.preferredKeywords) : defaults.preferredKeywords;
  const preferredLocations = input.preferredLocations ? stringArray(input.preferredLocations) : existing ? stringArray(existing.preferredLocations) : defaults.preferredLocations;

  const profile = await db.businessGrowthProfile.upsert({
    where: { organizationId: input.organizationId },
    update: {
      status: input.status ?? (preferredKeywords.length > 0 ? "ACTIVE" : "DRAFT"),
      primaryGoals: asJsonArray(primaryGoals),
      targetAudience: asJsonArray(targetAudience),
      preferredKeywords: asJsonArray(preferredKeywords),
      preferredLocations: asJsonArray(preferredLocations),
      notes: input.notes === undefined ? undefined : input.notes,
      metadata: asJsonObject({ source: "GROWTH_INTELLIGENCE_V1", externalProviderCalls: false }),
    },
    create: {
      organizationId: input.organizationId,
      status: input.status ?? (preferredKeywords.length > 0 ? "ACTIVE" : "DRAFT"),
      primaryGoals: asJsonArray(primaryGoals),
      targetAudience: asJsonArray(targetAudience),
      preferredKeywords: asJsonArray(preferredKeywords),
      preferredLocations: asJsonArray(preferredLocations),
      notes: input.notes ?? null,
      metadata: asJsonObject({ source: "GROWTH_INTELLIGENCE_V1", externalProviderCalls: false }),
    },
  });

  await audit({
    db,
    action: existing ? "UPDATE" : "CREATE",
    entityId: profile.id,
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    description: existing ? "Business growth profile updated" : "Business growth profile created",
    newValue: asJsonObject({ status: profile.status, primaryGoals, preferredKeywords, preferredLocations, externalProviderCalls: false }),
  });
  return serializeProfile(profile);
}

function serializeProfile(profile: {
  id: string;
  status: BusinessGrowthProfileStatus;
  primaryGoals: Prisma.JsonValue;
  targetAudience: Prisma.JsonValue;
  preferredKeywords: Prisma.JsonValue;
  preferredLocations: Prisma.JsonValue;
  notes: string | null;
}) {
  return {
    id: profile.id,
    status: profile.status,
    primaryGoals: stringArray(profile.primaryGoals),
    targetAudience: stringArray(profile.targetAudience),
    preferredKeywords: stringArray(profile.preferredKeywords),
    preferredLocations: stringArray(profile.preferredLocations),
    notes: profile.notes,
  };
}

function intentForKeyword(keyword: string, goals: string[], locations: string[]): KeywordIntent {
  const lower = keyword.toLowerCase();
  if (locations.some((location) => lower.includes(location.toLowerCase()))) return "LOCAL";
  if (/buy|order|رزرو|خرید|سفارش|booking/i.test(lower + " " + goals.join(" "))) return "TRANSACTIONAL";
  if (/price|قیمت|بهترین|best/i.test(lower)) return "COMMERCIAL";
  return "INFORMATIONAL";
}

function priorityForKeyword(keyword: string, source: KeywordClusterSource, intent: KeywordIntent): SeoOpportunityPriority {
  if (source === "OWNER_INPUT" || intent === "LOCAL" || intent === "TRANSACTIONAL") return "HIGH";
  if (/faq|راهنما|guide|benefit|مزیت/i.test(keyword)) return "MEDIUM";
  return "MEDIUM";
}

function buildKeywordSeeds(input: {
  organization: OrganizationForGrowth;
  profile: ReturnType<typeof serializeProfile>;
  industry: OrganizationIndustryKey;
}) {
  const template = getIndustryTemplate(input.industry);
  const locations = input.profile.preferredLocations.length ? input.profile.preferredLocations : [input.organization.address].filter((item): item is string => Boolean(item));
  const entityNames = [
    ...input.organization.products.map((product) => product.name),
    ...input.organization.productCategories.map((category) => category.name),
    ...input.organization.services.map((service) => service.name),
    ...input.organization.serviceCategories.map((category) => category.name),
  ].slice(0, 8);
  const seeds: Array<{ keyword: string; source: KeywordClusterSource; entityTitle?: string | null }> = [];

  for (const keyword of input.profile.preferredKeywords) seeds.push({ keyword, source: "OWNER_INPUT" });
  for (const hint of template.growthIntelligence.iamPageBlueprintHints) seeds.push({ keyword: hint, source: "INDUSTRY_TEMPLATE" });
  for (const opportunity of template.growthIntelligence.seoOpportunities) seeds.push({ keyword: opportunity.title, source: "INDUSTRY_TEMPLATE" });
  for (const entityName of entityNames) seeds.push({ keyword: entityName, source: "INDUSTRY_TEMPLATE", entityTitle: entityName });
  for (const location of locations.slice(0, 3)) {
    for (const keyword of [...input.profile.preferredKeywords.slice(0, 4), ...entityNames.slice(0, 4), input.organization.name]) {
      seeds.push({ keyword: `${keyword} ${location}`, source: "OWNER_INPUT" });
    }
  }

  return seeds.filter((seed) => seed.keyword.trim().length > 0);
}

async function entityByTitle(input: { organizationId: string; title?: string | null; db: DbClient }) {
  if (!input.title) return null;
  return input.db.businessEntity.findFirst({
    where: { organizationId: input.organizationId, title: input.title, status: { not: "ARCHIVED" } },
    select: { id: true, title: true, entityType: true },
  });
}

export async function generateKeywordClusters(input: { organizationId: string; actorUserId?: string | null; db?: DbClient }) {
  const db = input.db ?? prisma;
  const organization = await requireOrganization(input.organizationId, db);
  await indexOrganizationBusinessGraph(input.organizationId);
  const profile = await upsertBusinessGrowthProfile({ organizationId: input.organizationId, actorUserId: input.actorUserId, db });
  const industry = industryForOrganization(organization);
  const seeds = buildKeywordSeeds({ organization, profile, industry });
  const clusters = [];

  for (const seed of seeds) {
    const keyword = normalizeKeyword(seed.keyword);
    const intent = intentForKeyword(keyword, profile.primaryGoals, profile.preferredLocations);
    const relatedEntity = await entityByTitle({ organizationId: input.organizationId, title: seed.entityTitle, db });
    const cluster = await db.keywordCluster.upsert({
      where: { organizationId_keyword_intent: { organizationId: input.organizationId, keyword, intent } },
      update: {
        profileId: profile.id,
        source: seed.source,
        relatedEntityId: relatedEntity?.id ?? undefined,
        priority: priorityForKeyword(keyword, seed.source, intent),
        status: "ACTIVE",
        metadata: asJsonObject({ deterministic: true, externalProviderCalls: false }),
      },
      create: {
        organizationId: input.organizationId,
        profileId: profile.id,
        relatedEntityId: relatedEntity?.id ?? null,
        keyword,
        intent,
        priority: priorityForKeyword(keyword, seed.source, intent),
        source: seed.source,
        status: "ACTIVE",
        metadata: asJsonObject({ deterministic: true, externalProviderCalls: false }),
      },
    });
    clusters.push(cluster);
  }
  return clusters;
}

function schemaTypesForIndustry(industry: OrganizationIndustryKey, capabilities: OrganizationCapabilityKey[]) {
  if (industry === "RESTAURANT") return ["Restaurant", "LocalBusiness", "Product", "FAQPage"];
  if (capabilities.includes("APPOINTMENT")) return ["LocalBusiness", "Service", "FAQPage"];
  return ["LocalBusiness", "Product", "FAQPage"];
}

function iamTitle(keyword: string, organization: OrganizationForGrowth, location: string | null) {
  const normalized = keyword.replace(/\s+/g, " ").trim();
  if (location && !normalized.toLowerCase().includes(location.toLowerCase())) return `${normalized} ${location}`;
  if (!normalized.includes(organization.name)) return normalized;
  return normalized;
}

function blueprint(input: {
  title: string;
  industry: OrganizationIndustryKey;
  capabilities: OrganizationCapabilityKey[];
  relatedKeywords: string[];
  relatedEntities: string[];
}) {
  return {
    contentWorkflow: "SEO_CONTENT_WORKFLOW_BLUEPRINT_ONLY",
    publishesContent: false,
    provider: "INOTI_IAM",
    pageStructure: ["introduction", "services/products", "benefits", "prices", "FAQ", "reviews", "location"],
    relatedSchema: schemaTypesForIndustry(input.industry, input.capabilities),
    suggestedTitle: input.title,
    targetKeywords: input.relatedKeywords,
    relatedEntities: input.relatedEntities,
    prohibitedClaims: ["no invented rankings", "no invented reviews", "no invented prices", "no customer PII"],
  };
}

function opportunityTypeForRecommendation(industry: OrganizationIndustryKey, capabilities: OrganizationCapabilityKey[]): SeoOpportunityType {
  if (industry === "RESTAURANT" || capabilities.includes("SHOP")) return "LOCATION_PAGE_MISSING";
  if (capabilities.includes("APPOINTMENT")) return "SERVICE_DESCRIPTION_MISSING";
  return "BUSINESS_DESCRIPTION_MISSING";
}

async function upsertSeoOpportunityForGrowth(input: {
  organizationId: string;
  entityId: string;
  industry: OrganizationIndustryKey;
  capabilities: OrganizationCapabilityKey[];
  title: string;
  db: DbClient;
}) {
  const opportunityType = opportunityTypeForRecommendation(input.industry, input.capabilities);
  return input.db.seoOpportunity.upsert({
    where: { organizationId_entityId_opportunityType: { organizationId: input.organizationId, entityId: input.entityId, opportunityType } },
    update: {
      status: "OPEN",
      priority: "HIGH",
      metadata: asJsonObject({ source: "GROWTH_INTELLIGENCE_V1", title: input.title, externalProviderCalls: false }),
    },
    create: {
      organizationId: input.organizationId,
      entityId: input.entityId,
      opportunityType,
      priority: "HIGH",
      status: "OPEN",
      metadata: asJsonObject({ source: "GROWTH_INTELLIGENCE_V1", title: input.title, externalProviderCalls: false }),
    },
  });
}

export async function generateGrowthRecommendations(input: { organizationId: string; actorUserId?: string | null; db?: DbClient }) {
  const db = input.db ?? prisma;
  const organization = await requireOrganization(input.organizationId, db);
  const capabilities = activeCapabilities(organization);
  const industry = industryForOrganization(organization);
  const profile = await upsertBusinessGrowthProfile({ organizationId: input.organizationId, actorUserId: input.actorUserId, db });
  await suggestSeoOpportunities({ organizationId: input.organizationId }).catch(() => undefined);
  const root = await ensureOrganizationBusinessEntity({ organizationId: input.organizationId });
  const clusters = await generateKeywordClusters({ organizationId: input.organizationId, actorUserId: input.actorUserId, db });
  const reputation = await getOrganizationReputationOverview({ organizationId: input.organizationId }).catch(() => null);
  const topClusters = clusters
    .filter((cluster) => cluster.status === "ACTIVE")
    .sort((a, b) => (a.priority === "HIGH" ? -1 : 1) - (b.priority === "HIGH" ? -1 : 1))
    .slice(0, 4);
  const location = profile.preferredLocations[0] ?? organization.address ?? null;
  const recommendations = [];

  for (const cluster of topClusters) {
    const relatedKeywords = [cluster.keyword, ...profile.preferredKeywords].filter((keyword, index, all) => all.indexOf(keyword) === index).slice(0, 6);
    const entity = cluster.relatedEntityId
      ? await db.businessEntity.findFirst({ where: { id: cluster.relatedEntityId, organizationId: input.organizationId }, select: { id: true, title: true, entityType: true } })
      : root;
    const relatedEntities = [entity?.title ?? organization.name, organization.name].filter((item, index, all) => all.indexOf(item) === index);
    const title = iamTitle(cluster.keyword, organization, location);
    const seoOpportunity = await upsertSeoOpportunityForGrowth({
      organizationId: input.organizationId,
      entityId: entity?.id ?? root.id,
      industry,
      capabilities,
      title,
      db,
    });
    const contentBlueprint = blueprint({ title, industry, capabilities, relatedKeywords, relatedEntities });

    recommendations.push(await db.growthRecommendation.upsert({
      where: { organizationId_recommendationType_title: { organizationId: input.organizationId, recommendationType: "IAM_RECOMMENDATION", title } },
      update: {
        profileId: profile.id,
        keywordClusterId: cluster.id,
        businessEntityId: entity?.id ?? root.id,
        seoOpportunityId: seoOpportunity.id,
        reason: "Deterministic match between business profile, local intent, catalog/service entities, and SEO opportunity readiness.",
        priority: cluster.priority,
        relatedKeywords: asJsonArray(relatedKeywords),
        relatedEntities: asJsonArray(relatedEntities),
        iamRecommendation: asJsonObject({ title, purpose: "Local SEO", createsIamPage: false, externalProviderCalls: false }),
        contentBlueprint: asJsonObject(contentBlueprint),
        futureIntegrationHooks: asJsonArray(["Google Trends", "Google Search Console", "SERP providers", "DataForSEO", "SerpApi"]),
        metadata: asJsonObject({ deterministic: true, publishesContent: false, externalProviderCalls: false }),
      },
      create: {
        organizationId: input.organizationId,
        profileId: profile.id,
        keywordClusterId: cluster.id,
        businessEntityId: entity?.id ?? root.id,
        seoOpportunityId: seoOpportunity.id,
        recommendationType: "IAM_RECOMMENDATION",
        title,
        reason: "Deterministic match between business profile, local intent, catalog/service entities, and SEO opportunity readiness.",
        priority: cluster.priority,
        relatedKeywords: asJsonArray(relatedKeywords),
        relatedEntities: asJsonArray(relatedEntities),
        iamRecommendation: asJsonObject({ title, purpose: "Local SEO", createsIamPage: false, externalProviderCalls: false }),
        contentBlueprint: asJsonObject(contentBlueprint),
        futureIntegrationHooks: asJsonArray(["Google Trends", "Google Search Console", "SERP providers", "DataForSEO", "SerpApi"]),
        metadata: asJsonObject({ deterministic: true, publishesContent: false, externalProviderCalls: false }),
      },
    }));

    recommendations.push(await db.growthRecommendation.upsert({
      where: { organizationId_recommendationType_title: { organizationId: input.organizationId, recommendationType: "CONTENT_BLUEPRINT", title: `Blueprint: ${title}` } },
      update: {
        profileId: profile.id,
        keywordClusterId: cluster.id,
        businessEntityId: entity?.id ?? root.id,
        seoOpportunityId: seoOpportunity.id,
        reason: "Prepare a reviewable SEO content blueprint using the existing SEO Content Workflow; no generation or publication is performed.",
        priority: cluster.priority,
        relatedKeywords: asJsonArray(relatedKeywords),
        relatedEntities: asJsonArray(relatedEntities),
        contentBlueprint: asJsonObject(contentBlueprint),
        futureIntegrationHooks: asJsonArray(["iAM recommendations"]),
        metadata: asJsonObject({ deterministic: true, seoContentWorkflow: "BLUEPRINT_ONLY", externalProviderCalls: false }),
      },
      create: {
        organizationId: input.organizationId,
        profileId: profile.id,
        keywordClusterId: cluster.id,
        businessEntityId: entity?.id ?? root.id,
        seoOpportunityId: seoOpportunity.id,
        recommendationType: "CONTENT_BLUEPRINT",
        title: `Blueprint: ${title}`,
        reason: "Prepare a reviewable SEO content blueprint using the existing SEO Content Workflow; no generation or publication is performed.",
        priority: cluster.priority,
        relatedKeywords: asJsonArray(relatedKeywords),
        relatedEntities: asJsonArray(relatedEntities),
        contentBlueprint: asJsonObject(contentBlueprint),
        futureIntegrationHooks: asJsonArray(["iAM recommendations"]),
        metadata: asJsonObject({ deterministic: true, seoContentWorkflow: "BLUEPRINT_ONLY", externalProviderCalls: false }),
      },
    }));
  }

  const trustTitle = "Prepare review and FAQ trust signals";
  recommendations.push(await db.growthRecommendation.upsert({
    where: { organizationId_recommendationType_title: { organizationId: input.organizationId, recommendationType: "TRUST_ACTION", title: trustTitle } },
    update: {
      profileId: profile.id,
      businessEntityId: root.id,
      reason: reputation && reputation.reviewCount > 0 ? "Reviews exist; prepare FAQ and response workflow for growth pages." : "No public reviews yet; review request readiness should feed future local SEO pages.",
      priority: reputation && reputation.reviewCount > 0 ? "MEDIUM" : "HIGH",
      relatedKeywords: asJsonArray(profile.preferredKeywords.slice(0, 5)),
      relatedEntities: asJsonArray([organization.name, "Reviews", "FAQ"]),
      contentBlueprint: asJsonObject({ pageStructure: ["FAQ", "reviews", "location"], publishesContent: false }),
      metadata: asJsonObject({ reputationScore: reputation?.reputationScore ?? 0, reviewCount: reputation?.reviewCount ?? 0, externalProviderCalls: false }),
    },
    create: {
      organizationId: input.organizationId,
      profileId: profile.id,
      businessEntityId: root.id,
      recommendationType: "TRUST_ACTION",
      title: trustTitle,
      reason: reputation && reputation.reviewCount > 0 ? "Reviews exist; prepare FAQ and response workflow for growth pages." : "No public reviews yet; review request readiness should feed future local SEO pages.",
      priority: reputation && reputation.reviewCount > 0 ? "MEDIUM" : "HIGH",
      relatedKeywords: asJsonArray(profile.preferredKeywords.slice(0, 5)),
      relatedEntities: asJsonArray([organization.name, "Reviews", "FAQ"]),
      contentBlueprint: asJsonObject({ pageStructure: ["FAQ", "reviews", "location"], publishesContent: false }),
      metadata: asJsonObject({ reputationScore: reputation?.reputationScore ?? 0, reviewCount: reputation?.reviewCount ?? 0, externalProviderCalls: false }),
    },
  }));

  return recommendations;
}

function serializeRecommendation(recommendation: {
  id: string;
  recommendationType: GrowthRecommendationType;
  title: string;
  reason: string;
  priority: SeoOpportunityPriority;
  status: GrowthRecommendationStatus;
  relatedKeywords: Prisma.JsonValue;
  iamRecommendation: Prisma.JsonValue | null;
  contentBlueprint: Prisma.JsonValue | null;
  futureIntegrationHooks: Prisma.JsonValue | null;
}) {
  return {
    id: recommendation.id,
    type: recommendation.recommendationType,
    title: recommendation.title,
    reason: recommendation.reason,
    priority: recommendation.priority,
    status: recommendation.status,
    relatedKeywords: stringArray(recommendation.relatedKeywords),
    iamRecommendation: recommendation.iamRecommendation,
    contentBlueprint: recommendation.contentBlueprint,
    futureIntegrationHooks: stringArray(recommendation.futureIntegrationHooks),
  };
}

export async function getGrowthPlan(input: { organizationId: string; refresh?: boolean; actorUserId?: string | null; db?: DbClient }): Promise<GrowthPlanReadModel> {
  const db = input.db ?? prisma;
  const organization = await requireOrganization(input.organizationId, db);
  if (input.refresh) await generateGrowthRecommendations({ organizationId: input.organizationId, actorUserId: input.actorUserId, db });
  const profile = await upsertBusinessGrowthProfile({ organizationId: input.organizationId, actorUserId: input.actorUserId, db });
  const [clusters, recommendations, reputation] = await Promise.all([
    db.keywordCluster.findMany({ where: { organizationId: input.organizationId }, orderBy: [{ priority: "desc" }, { updatedAt: "desc" }], take: 50 }),
    db.growthRecommendation.findMany({ where: { organizationId: input.organizationId }, orderBy: [{ priority: "desc" }, { updatedAt: "desc" }], take: 50 }),
    getOrganizationReputationOverview({ organizationId: input.organizationId }).catch(() => null),
  ]);
  const capabilities = activeCapabilities(organization);
  const industry = industryForOrganization(organization);
  const iamRecommendationCount = recommendations.filter((recommendation) => recommendation.recommendationType === "IAM_RECOMMENDATION").length;
  const contentOpportunityCount = recommendations.filter((recommendation) => recommendation.recommendationType === "CONTENT_BLUEPRINT").length;
  const missing = [
    clusters.length === 0 ? "Keyword plan" : null,
    iamRecommendationCount === 0 ? "iAM recommendations" : null,
    contentOpportunityCount === 0 ? "Content blueprints" : null,
    (reputation?.reviewCount ?? 0) === 0 ? "Reviews" : null,
  ].filter((item): item is string => Boolean(item));
  const seoScore = Math.min(100, Math.round((clusters.length > 0 ? 35 : 0) + (iamRecommendationCount > 0 ? 30 : 0) + (contentOpportunityCount > 0 ? 20 : 0) + ((reputation?.reviewCount ?? 0) > 0 ? 15 : 0)));
  const serializedRecommendations = recommendations.map(serializeRecommendation);

  return {
    organization: {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      industry,
      capabilities,
      location: profile.preferredLocations[0] ?? organization.address,
    },
    profile,
    keywordClusters: clusters.map((cluster) => ({
      id: cluster.id,
      keyword: cluster.keyword,
      intent: cluster.intent,
      priority: cluster.priority,
      source: cluster.source,
      status: cluster.status,
    })),
    recommendations: serializedRecommendations,
    ownerNextActions: serializedRecommendations.slice(0, 5).map((recommendation) => ({
      title: recommendation.title,
      reason: recommendation.reason,
      priority: recommendation.priority,
    })),
    readiness: {
      seoStrategyStatus: seoScore >= 60 ? "READY" : "NOT_READY",
      seoScore,
      keywordPlanCount: clusters.length,
      iamRecommendationCount,
      contentOpportunityCount,
      trust: { reputationScore: reputation?.reputationScore ?? 0, reviewCount: reputation?.reviewCount ?? 0 },
      missing,
      nextAction: serializedRecommendations[0]?.title ?? null,
      externalProviderCalls: false,
    },
  };
}

export async function getOwnerGrowthReadModel(input: { organizationId: string; db?: DbClient }) {
  const plan = await getGrowthPlan({ organizationId: input.organizationId, db: input.db });
  return {
    organization: plan.organization,
    growthStatus: plan.readiness.seoStrategyStatus,
    nextActions: plan.ownerNextActions,
    recommendedKeywords: plan.keywordClusters.slice(0, 10).map((cluster) => ({ keyword: cluster.keyword, intent: cluster.intent, priority: cluster.priority })),
    iamRecommendations: plan.recommendations.filter((recommendation) => recommendation.type === "IAM_RECOMMENDATION").slice(0, 5),
    contentBlueprints: plan.recommendations.filter((recommendation) => recommendation.type === "CONTENT_BLUEPRINT").slice(0, 5),
    safety: { externalProviderCalls: false, publishesContent: false, exposesPrivateCustomerData: false },
  };
}
