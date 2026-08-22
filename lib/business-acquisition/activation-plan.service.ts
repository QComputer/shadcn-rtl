import "server-only";

import type {
  OrganizationActivationPlanStatus,
  OrganizationCapabilityKey,
  OrganizationIndustryKey,
  Prisma,
  SeoOpportunityPriority,
  SeoOpportunityType,
} from "@prisma/client";
import prisma from "@/lib/db";
import { ApiError } from "@/lib/api-guards";
import { ensureOrganizationBusinessEntity } from "@/lib/business-entity/business-entity.service";
import { getIndustryTemplate } from "@/lib/business-acquisition/industry-templates";

type DbClient = Prisma.TransactionClient | typeof prisma;

export type ActivationActionCategory = "PROFILE" | "CAPABILITY" | "SEO" | "IAM" | "CUSTOMER_JOURNEY" | "INTEGRATION";

export type ActivationAction = {
  key: string;
  title: string;
  description: string;
  category: ActivationActionCategory;
  priority: "LOW" | "MEDIUM" | "HIGH";
  relatedCapability?: OrganizationCapabilityKey | null;
  artifact?: {
    type: "ORGANIZATION" | "BUSINESS_ENTITY" | "SEO_OPPORTUNITY" | "INTEGRATION_READINESS" | "OWNER_ONBOARDING";
    id?: string;
    label: string;
  };
};

export type ActivationGrowthOpportunities = {
  seo: Array<{ id: string; publicId: string; type: string; priority: string; status: string }>;
  iamPageBlueprintHints: string[];
  customerJourneySuggestions: string[];
  recommendedInotiServices: string[];
  businessEntityReadiness: {
    rootEntityId: string;
    rootEntityPublicId: string;
    ready: boolean;
  };
};

export type OwnerOnboardingReadModel = {
  organization: {
    id: string;
    name: string;
    slug: string;
  };
  businessProfileCompleteness: {
    score: number;
    completedItems: string[];
    missingItems: string[];
  };
  recommendedGrowthActions: Array<{ key: string; title: string; category: ActivationActionCategory; priority: "LOW" | "MEDIUM" | "HIGH" }>;
  enabledCapabilities: OrganizationCapabilityKey[];
  missingSetupItems: string[];
};

type OrganizationForActivation = {
  id: string;
  name: string;
  slug: string;
  type: "SHOP" | "APPOINTMENT";
  description: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  logo: string | null;
  coverImage: string | null;
  acquisition: { industryKey: OrganizationIndustryKey } | null;
  capabilities: Array<{ key: OrganizationCapabilityKey; status: "ACTIVE" | "INACTIVE" }>;
};

function jsonObject(input: unknown): Prisma.InputJsonObject {
  return input as Prisma.InputJsonObject;
}

function jsonArray<T>(input: T[]): Prisma.InputJsonArray {
  return input as Prisma.InputJsonArray;
}

function activeCapabilities(organization: OrganizationForActivation): OrganizationCapabilityKey[] {
  const capabilities = organization.capabilities.filter((capability) => capability.status === "ACTIVE").map((capability) => capability.key);
  if (capabilities.length > 0) return capabilities;
  return organization.type === "APPOINTMENT" ? ["APPOINTMENT"] : ["SHOP"];
}

function industryForOrganization(organization: OrganizationForActivation, fallback?: OrganizationIndustryKey): OrganizationIndustryKey {
  return fallback ?? organization.acquisition?.industryKey ?? "OTHER";
}

function seoTypeForAction(key: string, capabilities: OrganizationCapabilityKey[]): SeoOpportunityType {
  if (key.includes("faq")) return "FAQ_MISSING";
  if (key.includes("service") || capabilities.includes("APPOINTMENT")) return "SERVICE_DESCRIPTION_MISSING";
  if (key.includes("product") || key.includes("category") || capabilities.includes("SHOP")) return "PRODUCT_DESCRIPTION_MISSING";
  if (key.includes("local") || key.includes("profile")) return "LOCATION_PAGE_MISSING";
  return "BUSINESS_DESCRIPTION_MISSING";
}

function profileCompleteness(organization: OrganizationForActivation) {
  const items = [
    { key: "description", complete: Boolean(organization.description?.trim()) },
    { key: "address", complete: Boolean(organization.address?.trim()) },
    { key: "phone", complete: Boolean(organization.phone?.trim()) },
    { key: "email", complete: Boolean(organization.email?.trim()) },
    { key: "visualIdentity", complete: Boolean(organization.logo || organization.coverImage) },
  ];
  const completed = items.filter((item) => item.complete).length;
  return {
    score: Math.round((completed / items.length) * 100),
    completedItems: items.filter((item) => item.complete).map((item) => item.key),
    missingItems: items.filter((item) => !item.complete).map((item) => item.key),
  };
}

function buildActivationActions(input: {
  organization: OrganizationForActivation;
  industryKey: OrganizationIndustryKey;
  capabilities: OrganizationCapabilityKey[];
}): ActivationAction[] {
  const template = getIndustryTemplate(input.industryKey);
  const actions: ActivationAction[] = [
    {
      key: "complete-public-profile",
      title: "Complete public business profile",
      description: "Fill missing public profile fields before owner handoff.",
      category: "PROFILE",
      priority: "HIGH",
      artifact: { type: "ORGANIZATION", id: input.organization.id, label: input.organization.name },
    },
    ...template.growthIntelligence.activationChecklist.map((item, index): ActivationAction => ({
      key: `template-checklist-${index + 1}`,
      title: item,
      description: "Template-derived activation task for this industry.",
      category: "CAPABILITY",
      priority: index < 2 ? "HIGH" : "MEDIUM",
      relatedCapability: input.capabilities[index % Math.max(input.capabilities.length, 1)] ?? null,
    })),
    ...template.growthIntelligence.seoOpportunities.map((opportunity): ActivationAction => ({
      key: `seo-${opportunity.key}`,
      title: opportunity.title,
      description: opportunity.description,
      category: "SEO",
      priority: opportunity.priority,
      relatedCapability: input.capabilities.includes("APPOINTMENT") ? "APPOINTMENT" : input.capabilities.includes("SHOP") ? "SHOP" : null,
      artifact: { type: "SEO_OPPORTUNITY", label: opportunity.key },
    })),
    ...template.growthIntelligence.iamPageBlueprintHints.map((hint, index): ActivationAction => ({
      key: `iam-blueprint-${index + 1}`,
      title: `Prepare iAM page hint: ${hint}`,
      description: "Recommendation only. No iAM publication or provider call is performed.",
      category: "IAM",
      priority: index === 0 ? "HIGH" : "MEDIUM",
      relatedCapability: "IAM",
      artifact: { type: "INTEGRATION_READINESS", label: "iAM readiness" },
    })),
    ...template.growthIntelligence.customerJourneySuggestions.map((suggestion, index): ActivationAction => ({
      key: `customer-journey-${index + 1}`,
      title: suggestion,
      description: "Suggested journey step for future owner/customer onboarding.",
      category: "CUSTOMER_JOURNEY",
      priority: "MEDIUM",
      relatedCapability: input.capabilities.includes("CRM") ? "CRM" : null,
      artifact: { type: "OWNER_ONBOARDING", label: "customer journey" },
    })),
    ...template.growthIntelligence.recommendedInotiServices.map((service): ActivationAction => ({
      key: `integration-${service.toLowerCase()}`,
      title: `${service} readiness`,
      description: "Conceptual integration readiness only; no external provider call is made.",
      category: "INTEGRATION",
      priority: service === "USSD" ? "HIGH" : "MEDIUM",
      relatedCapability: service === "USSD" ? "USSD" : service === "iAM" ? "IAM" : service === "iCV" ? "ICV" : service === "EBC" ? "EBC" : null,
      artifact: { type: "INTEGRATION_READINESS", label: service },
    })),
  ];

  return actions.filter((action, index, all) => all.findIndex((candidate) => candidate.key === action.key) === index);
}

function buildOwnerOnboardingReadModel(input: {
  organization: OrganizationForActivation;
  capabilities: OrganizationCapabilityKey[];
  actions: ActivationAction[];
  completedActions: string[];
}) {
  const completeness = profileCompleteness(input.organization);
  const missingSetupItems = [
    ...completeness.missingItems.map((item) => `profile.${item}`),
    ...input.actions.filter((action) => !input.completedActions.includes(action.key)).slice(0, 8).map((action) => action.key),
  ];

  return {
    organization: {
      id: input.organization.id,
      name: input.organization.name,
      slug: input.organization.slug,
    },
    businessProfileCompleteness: completeness,
    recommendedGrowthActions: input.actions
      .filter((action) => action.category === "SEO" || action.category === "CUSTOMER_JOURNEY" || action.category === "INTEGRATION")
      .map((action) => ({ key: action.key, title: action.title, category: action.category, priority: action.priority })),
    enabledCapabilities: input.capabilities,
    missingSetupItems,
  };
}

function serializePlan(plan: {
  id: string;
  organizationId: string;
  industryKey: OrganizationIndustryKey;
  status: OrganizationActivationPlanStatus;
  generatedFromTemplate: string;
  recommendedActions: Prisma.JsonValue;
  completedActions: Prisma.JsonValue;
  growthOpportunities: Prisma.JsonValue;
  ownerOnboardingReadModel: Prisma.JsonValue;
  generatedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: plan.id,
    organizationId: plan.organizationId,
    industryKey: plan.industryKey,
    status: plan.status,
    generatedFromTemplate: plan.generatedFromTemplate,
    recommendedActions: (Array.isArray(plan.recommendedActions) ? plan.recommendedActions : []) as ActivationAction[],
    completedActions: (Array.isArray(plan.completedActions) ? plan.completedActions : []) as string[],
    growthOpportunities: plan.growthOpportunities as unknown as ActivationGrowthOpportunities,
    ownerOnboardingReadModel: plan.ownerOnboardingReadModel as unknown as OwnerOnboardingReadModel,
    generatedAt: plan.generatedAt.toISOString(),
    createdAt: plan.createdAt.toISOString(),
    updatedAt: plan.updatedAt.toISOString(),
  };
}

async function requireOrganization(input: { organizationId: string; db?: DbClient }) {
  const db = input.db ?? prisma;
  const organization = await db.organization.findFirst({
    where: { id: input.organizationId, isActive: true, deletedAt: null },
    select: {
      id: true,
      name: true,
      slug: true,
      type: true,
      description: true,
      address: true,
      phone: true,
      email: true,
      logo: true,
      coverImage: true,
      acquisition: { select: { industryKey: true } },
      capabilities: { select: { key: true, status: true }, orderBy: { key: "asc" } },
    },
  });
  if (!organization) throw new ApiError(404, "Organization not found");
  return organization;
}

export async function generateActivationPlan(input: {
  organizationId: string;
  industryKey?: OrganizationIndustryKey;
  generatedByUserId?: string | null;
  db?: DbClient;
}) {
  const db = input.db ?? prisma;
  const organization = await requireOrganization({ organizationId: input.organizationId, db });
  const industryKey = industryForOrganization(organization, input.industryKey);
  const capabilities = activeCapabilities(organization);
  const template = getIndustryTemplate(industryKey);
  const actions = buildActivationActions({ organization, industryKey, capabilities });
  const existingPlan = await db.organizationActivationPlan.findUnique({
    where: { organizationId: organization.id },
    select: { completedActions: true },
  });
  const completedActions = Array.isArray(existingPlan?.completedActions)
    ? existingPlan.completedActions.filter((item): item is string => typeof item === "string")
    : [];
  const ownerOnboardingReadModel = buildOwnerOnboardingReadModel({ organization, capabilities, actions, completedActions });

  const rootEntity = await ensureOrganizationBusinessEntity({ organizationId: organization.id });
  const seoOpportunities = await Promise.all(template.growthIntelligence.seoOpportunities.map((opportunity) =>
    db.seoOpportunity.upsert({
      where: {
        organizationId_entityId_opportunityType: {
          organizationId: organization.id,
          entityId: rootEntity.id,
          opportunityType: seoTypeForAction(opportunity.key, capabilities),
        },
      },
      update: {
        priority: opportunity.priority as SeoOpportunityPriority,
        metadata: jsonObject({
          source: "ACTIVATION_PLAN",
          template: industryKey,
          recommendationKey: opportunity.key,
          title: opportunity.title,
          description: opportunity.description,
          publishesContent: false,
        }),
      },
      create: {
        organizationId: organization.id,
        entityId: rootEntity.id,
        opportunityType: seoTypeForAction(opportunity.key, capabilities),
        priority: opportunity.priority as SeoOpportunityPriority,
        status: "OPEN",
        metadata: jsonObject({
          source: "ACTIVATION_PLAN",
          template: industryKey,
          recommendationKey: opportunity.key,
          title: opportunity.title,
          description: opportunity.description,
          publishesContent: false,
        }),
      },
    }),
  ));

  const growthOpportunities = {
    seo: seoOpportunities.map((opportunity) => ({
      id: opportunity.id,
      publicId: opportunity.publicId,
      type: opportunity.opportunityType,
      priority: opportunity.priority,
      status: opportunity.status,
    })),
    iamPageBlueprintHints: template.growthIntelligence.iamPageBlueprintHints,
    customerJourneySuggestions: template.growthIntelligence.customerJourneySuggestions,
    recommendedInotiServices: template.growthIntelligence.recommendedInotiServices,
    businessEntityReadiness: {
      rootEntityId: rootEntity.id,
      rootEntityPublicId: rootEntity.publicId,
      ready: true,
    },
  };

  const plan = await db.organizationActivationPlan.upsert({
    where: { organizationId: organization.id },
    update: {
      industryKey,
      status: completedActions.length >= actions.length ? "COMPLETED" : "ACTIVE",
      generatedFromTemplate: industryKey,
      recommendedActions: jsonArray(actions),
      completedActions: jsonArray(completedActions),
      growthOpportunities: jsonObject(growthOpportunities),
      ownerOnboardingReadModel: jsonObject(ownerOnboardingReadModel),
      metadata: jsonObject({
        generatedByUserId: input.generatedByUserId ?? null,
        externalProviderCalls: false,
        publishesSeoContent: false,
      }),
      generatedAt: new Date(),
    },
    create: {
      organizationId: organization.id,
      industryKey,
      status: "ACTIVE",
      generatedFromTemplate: industryKey,
      recommendedActions: jsonArray(actions),
      completedActions: jsonArray(completedActions),
      growthOpportunities: jsonObject(growthOpportunities),
      ownerOnboardingReadModel: jsonObject(ownerOnboardingReadModel),
      metadata: jsonObject({
        generatedByUserId: input.generatedByUserId ?? null,
        externalProviderCalls: false,
        publishesSeoContent: false,
      }),
    },
  });

  return serializePlan(plan);
}

export async function getActivationPlan(input: { organizationId: string; db?: DbClient }) {
  const db = input.db ?? prisma;
  const plan = await db.organizationActivationPlan.findUnique({ where: { organizationId: input.organizationId } });
  if (plan) return serializePlan(plan);
  return generateActivationPlan(input);
}

export async function completeActivationStep(input: {
  organizationId: string;
  actionKey: string;
  completedByUserId?: string | null;
  db?: DbClient;
}) {
  const db = input.db ?? prisma;
  const plan = await getActivationPlan({ organizationId: input.organizationId, db });
  const actions = Array.isArray(plan.recommendedActions) ? plan.recommendedActions as ActivationAction[] : [];
  if (!actions.some((action) => action.key === input.actionKey)) throw new ApiError(404, "Activation step not found");
  const completedActions = Array.isArray(plan.completedActions)
    ? Array.from(new Set([...plan.completedActions.filter((item): item is string => typeof item === "string"), input.actionKey]))
    : [input.actionKey];
  const status = completedActions.length >= actions.length ? "COMPLETED" : "ACTIVE";
  const organization = await requireOrganization({ organizationId: input.organizationId, db });
  const ownerOnboardingReadModel = buildOwnerOnboardingReadModel({
    organization,
    capabilities: activeCapabilities(organization),
    actions,
    completedActions,
  });

  const updated = await db.organizationActivationPlan.update({
    where: { organizationId: input.organizationId },
    data: {
      completedActions: jsonArray(completedActions),
      status,
      ownerOnboardingReadModel: jsonObject(ownerOnboardingReadModel),
      metadata: jsonObject({
        completedByUserId: input.completedByUserId ?? null,
        lastCompletedActionKey: input.actionKey,
        externalProviderCalls: false,
      }),
    },
  });

  return serializePlan(updated);
}

export async function getOwnerOnboardingReadModel(input: { organizationId: string; db?: DbClient }) {
  const plan = await getActivationPlan(input);
  return {
    organizationId: plan.organizationId,
    activationPlanId: plan.id,
    status: plan.status,
    ownerOnboardingReadModel: plan.ownerOnboardingReadModel,
  };
}
