import "server-only";

import type {
  ExternalImportSourceStatus,
  ExternalImportSourceType,
  IntegrationProvider,
  OrganizationCapabilityKey,
  OrganizationIndustryKey,
  OrganizationIntegrationStatus,
  PilotChecklistCategory,
  PilotWorkspaceStatus,
  Prisma,
} from "@prisma/client";
import prisma from "@/lib/db";
import { ApiError } from "@/lib/api-guards";
import { getActivationPlan } from "@/lib/business-acquisition/activation-plan.service";
import { getIndustryTemplate } from "@/lib/business-acquisition/industry-templates";
import { getGrowthPlan } from "@/lib/growth-intelligence/growth-intelligence.service";
import { getInotiAccountReadModel } from "@/lib/integrations/inoti-account-management";
import { getOrganizationReputationOverview, getReviewSeoReadiness } from "@/lib/customer-reputation/customer-reputation.service";

type DbClient = Prisma.TransactionClient | typeof prisma;

export type PilotChecklistItem = {
  key: string;
  category: PilotChecklistCategory;
  title: string;
  description: string;
  required: boolean;
  source: "ACTIVATION_TASK" | "PILOT_OPERATIONS";
  activationTaskKey?: string;
  recommendedAction?: string;
  targetRoute?: string;
};

export type PilotReadinessSummary = {
  progressPercent: number;
  completedCount: number;
  totalCount: number;
  missingItems: Array<{ key: string; title: string; category: PilotChecklistCategory }>;
  recommendedNextAction: string | null;
  profile: { complete: boolean; missing: string[] };
  catalog: { ready: boolean; productCount: number; productCategoryCount: number; serviceCount: number; staffCount: number };
  integrations: { inotiStatus: string; externalCatalogConnections: number; dryRunOnly: true };
  seo: {
    opportunities: number;
    entityCompleteness: string;
    keywordStrategyStatus: string;
    iamReadiness: string;
    seoStrategyStatus: string;
    seoScore: number;
    keywordPlanCount: number;
    iamRecommendationCount: number;
    contentOpportunityCount: number;
    nextGrowthAction: string | null;
  };
  trust: { reviewReadiness: string; reputationScore: number; reviewCount: number };
  engagement: { customerClubReady: boolean; ebcReady: boolean };
};

export type PilotWorkspaceReadModel = {
  id: string;
  organizationId: string;
  status: PilotWorkspaceStatus;
  assignedOperator: { id: string; name: string; email: string | null } | null;
  notes: string | null;
  organization: {
    id: string;
    name: string;
    slug: string;
    type: string;
    industry: OrganizationIndustryKey;
    capabilities: OrganizationCapabilityKey[];
  };
  checklist: Array<PilotChecklistItem & { completed: boolean }>;
  readinessSummary: PilotReadinessSummary;
  growthPlanner: {
    businessGoals: string[];
    targetAudience: string[];
    preferredKeywords: string[];
    cityLocation: string | null;
    futureHooks: string[];
  };
  setupFlow: {
    businessKind: "RESTAURANT" | "CAFE" | "RETAIL" | "APPOINTMENT" | "GENERAL";
    sourceLabel: string;
    externalProvider: "SNAPPFOOD" | "WEBSITE" | "INSTAGRAM_FUTURE" | "NONE";
    externalUrl: string | null;
    steps: Array<{ key: string; title: string; status: "READY" | "WAITING" | "DONE"; externalProviderCalls: false }>;
  };
  timestamps: { createdAt: string; updatedAt: string };
};

const PILOT_STATUSES = new Set<PilotWorkspaceStatus>(["DISCOVERY", "ONBOARDING", "CONFIGURATION", "READY_FOR_LAUNCH", "LIVE", "PAUSED"]);

function asJsonObject(value: unknown): Prisma.InputJsonObject {
  return value as Prisma.InputJsonObject;
}

function asJsonArray<T>(value: T[]): Prisma.InputJsonArray {
  return value as Prisma.InputJsonArray;
}

function jsonArray(value: Prisma.JsonValue | null | undefined): unknown[] {
  return Array.isArray(value) ? value : [];
}

function activeCapabilities(organization: { type: "SHOP" | "APPOINTMENT"; capabilities: Array<{ key: OrganizationCapabilityKey; status: string }> }) {
  const capabilities = organization.capabilities.filter((capability) => capability.status === "ACTIVE").map((capability) => capability.key);
  if (capabilities.length > 0) return capabilities;
  return organization.type === "APPOINTMENT" ? ["APPOINTMENT" as const] : ["SHOP" as const];
}

function industryForOrganization(organization: { type: "SHOP" | "APPOINTMENT"; acquisition: { industryKey: OrganizationIndustryKey } | null; name: string }): OrganizationIndustryKey {
  if (organization.acquisition?.industryKey) return organization.acquisition.industryKey;
  if (organization.type === "APPOINTMENT") return "DENTAL_CLINIC";
  if (/کفش|shoe|retail/i.test(organization.name)) return "RETAIL_SHOP";
  if (/سالن|salon|beauty|تیکال/i.test(organization.name)) return "FASHION_BOUTIQUE";
  return "RESTAURANT";
}

function profileMissing(organization: { description: string | null; address: string | null; phone: string | null; email: string | null; logo: string | null; coverImage: string | null }) {
  return [
    ["logo", Boolean(organization.logo || organization.coverImage)],
    ["description", Boolean(organization.description?.trim())],
    ["address", Boolean(organization.address?.trim())],
    ["contact info", Boolean(organization.phone?.trim() || organization.email?.trim())],
  ].filter(([, complete]) => !complete).map(([key]) => String(key));
}

function categoryForActivation(category: PilotChecklistCategory): "PROFILE" | "OPERATIONS" | "CUSTOMER" | "GROWTH" | "INTEGRATIONS" {
  if (category === "BUSINESS_PROFILE") return "PROFILE";
  if (category === "INTEGRATIONS") return "INTEGRATIONS";
  if (category === "SEO") return "GROWTH";
  if (category === "TRUST") return "CUSTOMER";
  return "OPERATIONS";
}

function businessKind(input: { organizationName: string; industry: OrganizationIndustryKey; capabilities: OrganizationCapabilityKey[] }) {
  if (/کافه|cafe|leo/i.test(input.organizationName)) return "CAFE" as const;
  if (input.industry === "RESTAURANT") return "RESTAURANT" as const;
  if (input.capabilities.includes("APPOINTMENT")) return "APPOINTMENT" as const;
  if (input.industry === "RETAIL_SHOP" || input.industry === "FASHION_BOUTIQUE") return "RETAIL" as const;
  return "GENERAL" as const;
}

function buildChecklist(input: {
  organizationName: string;
  industry: OrganizationIndustryKey;
  capabilities: OrganizationCapabilityKey[];
  activationActions: Array<{ key: string; title: string; category: string }>;
}): PilotChecklistItem[] {
  const kind = businessKind(input);
  const catalogItems: PilotChecklistItem[] =
    kind === "APPOINTMENT"
      ? [
          { key: "catalog-services", category: "CATALOG", title: "Services prepared", description: "Service list and categories are ready for public booking.", required: true, source: "PILOT_OPERATIONS", recommendedAction: "Add services", targetRoute: "/dashboard/services" },
          { key: "catalog-staff", category: "CATALOG", title: "Staff prepared", description: "Staff/provider setup is ready for appointment operations.", required: true, source: "PILOT_OPERATIONS", recommendedAction: "Add staff", targetRoute: "/dashboard/members" },
          { key: "catalog-schedules", category: "CATALOG", title: "Schedules prepared", description: "Booking schedule and availability are configured.", required: true, source: "PILOT_OPERATIONS", recommendedAction: "Configure schedules", targetRoute: "/dashboard/calendar" },
        ]
      : [
          { key: "catalog-categories", category: "CATALOG", title: kind === "RESTAURANT" || kind === "CAFE" ? "Menu categories prepared" : "Product categories prepared", description: "Catalog categories exist for public discovery.", required: true, source: "PILOT_OPERATIONS", recommendedAction: kind === "RETAIL" ? "Prepare product catalog" : "Import menu", targetRoute: "/dashboard/product-categories" },
          { key: "catalog-items", category: "CATALOG", title: kind === "RESTAURANT" || kind === "CAFE" ? "Menu items prepared" : "Products prepared", description: "Products/menu items are ready for public presentation.", required: true, source: "PILOT_OPERATIONS", recommendedAction: kind === "RETAIL" ? "Add products" : "Map menu items", targetRoute: "/dashboard/products" },
          { key: "catalog-images", category: "CATALOG", title: "Catalog media prepared", description: "Images or media readiness is tracked for the pilot catalog.", required: false, source: "PILOT_OPERATIONS", recommendedAction: "Prepare product images", targetRoute: "/dashboard/creative-studio" },
        ];

  const items: PilotChecklistItem[] = [
    { key: "profile-logo", category: "BUSINESS_PROFILE", title: "Logo or cover image", description: "Public visual identity is ready.", required: true, source: "PILOT_OPERATIONS", recommendedAction: "Add logo" },
    { key: "profile-description", category: "BUSINESS_PROFILE", title: "Public description", description: "Public business description is complete.", required: true, source: "PILOT_OPERATIONS", recommendedAction: "Complete business profile" },
    { key: "profile-address-contact", category: "BUSINESS_PROFILE", title: "Address and contact info", description: "Address, phone, or email are ready for public contact.", required: true, source: "PILOT_OPERATIONS", recommendedAction: "Complete contact fields" },
    ...catalogItems,
    { key: "integration-inoti-readiness", category: "INTEGRATIONS", title: "iNoti readiness", description: "iMenu/iAM/iCV/EBC/USSD readiness is represented as dry-run only.", required: false, source: "PILOT_OPERATIONS", recommendedAction: "Prepare iNoti connection", targetRoute: "/dashboard/organizations" },
    { key: "integration-external-catalog", category: "INTEGRATIONS", title: "External catalog readiness", description: "Mock external catalog connection can be previewed and mapped.", required: false, source: "PILOT_OPERATIONS", recommendedAction: kind === "CAFE" ? "Prepare website import" : kind === "RETAIL" ? "Prepare social/catalog source" : "Create mock catalog connection" },
    { key: "seo-entity", category: "SEO", title: "Business entity completeness", description: "Business entity graph exists for SEO readiness.", required: true, source: "PILOT_OPERATIONS", recommendedAction: "Review entity graph" },
    { key: "seo-keywords", category: "SEO", title: "Keyword strategy prepared", description: "Goals, audience, city, and preferred keywords are captured for the future SEO planner.", required: false, source: "PILOT_OPERATIONS", recommendedAction: "Add SEO planner inputs" },
    { key: "seo-iam-readiness", category: "SEO", title: "iAM readiness", description: "iAM page recommendations are prepared without publication.", required: false, source: "PILOT_OPERATIONS", recommendedAction: "Prepare iAM planning" },
    { key: "trust-review-system", category: "TRUST", title: "Review system readiness", description: "Review request and reputation foundation are available.", required: false, source: "PILOT_OPERATIONS", recommendedAction: "Prepare review request flow" },
    { key: "launch-public-page", category: "LAUNCH", title: "Public page ready", description: "The public business page can represent the pilot business.", required: true, source: "PILOT_OPERATIONS", recommendedAction: "Review public page", targetRoute: "/dashboard/settings/organization" },
    { key: "launch-owner-access", category: "LAUNCH", title: "Owner access prepared", description: "Owner invitation/access is ready through the acquisition foundation.", required: true, source: "PILOT_OPERATIONS", recommendedAction: "Invite owner" },
    { key: "launch-final-review", category: "LAUNCH", title: "Final launch review", description: "Internal operator final review before launch.", required: true, source: "PILOT_OPERATIONS", recommendedAction: "Run final review" },
    ...input.activationActions.slice(0, 6).map((action): PilotChecklistItem => ({
      key: `activation-${action.key}`,
      category: action.category === "SEO" || action.category === "IAM" ? "SEO" : action.category === "INTEGRATION" ? "INTEGRATIONS" : "BUSINESS_PROFILE",
      title: action.title,
      description: "Linked to the existing organization activation plan.",
      required: false,
      source: "ACTIVATION_TASK",
      activationTaskKey: action.key,
      recommendedAction: action.title,
    })),
  ];

  return items.filter((item, index, all) => all.findIndex((candidate) => candidate.key === item.key) === index);
}

function setupFlow(input: { organizationName: string; industry: OrganizationIndustryKey; capabilities: OrganizationCapabilityKey[]; completed: Set<string> }): PilotWorkspaceReadModel["setupFlow"] {
  const kind = businessKind(input);
  const provider = kind === "RESTAURANT" ? "SNAPPFOOD" : kind === "CAFE" ? "WEBSITE" : kind === "RETAIL" ? "INSTAGRAM_FUTURE" : "NONE";
  const sourceLabel = kind === "RESTAURANT" ? "SNAPPFOOD mock" : kind === "CAFE" ? "Cafe Leo website mock" : kind === "RETAIL" ? "Future Instagram/social connector" : "Manual appointment setup";
  const externalUrl = kind === "CAFE" ? "https://iran.cafeleo.vip/" : null;
  const stepTitles = kind === "APPOINTMENT"
    ? [["appointment-capability", "Confirm appointment capability"], ["services", "Prepare services"], ["staff", "Prepare staff"], ["portfolio", "Prepare portfolio/media readiness"]]
    : [["connection", "Create mock connection"], ["preview", "Preview source"], ["mapping", "Review mapping"], ["approval", "Approve preparation"], ["ready", "Ready for import"]];

  return {
    businessKind: kind,
    sourceLabel,
    externalProvider: provider,
    externalUrl,
    steps: stepTitles.map(([key, title]) => ({
      key,
      title,
      status: input.completed.has(`flow-${key}`) ? "DONE" : key === stepTitles[0]?.[0] ? "READY" : "WAITING",
      externalProviderCalls: false,
    })),
  };
}

function growthPlanner(value: Prisma.JsonValue | null | undefined, organization: { address: string | null }) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  return {
    businessGoals: Array.isArray(source.businessGoals) ? source.businessGoals.filter((item): item is string => typeof item === "string") : [],
    targetAudience: Array.isArray(source.targetAudience) ? source.targetAudience.filter((item): item is string => typeof item === "string") : [],
    preferredKeywords: Array.isArray(source.preferredKeywords) ? source.preferredKeywords.filter((item): item is string => typeof item === "string") : [],
    cityLocation: typeof source.cityLocation === "string" ? source.cityLocation : organization.address,
    futureHooks: ["Google Trends", "keyword intelligence", "iAM recommendations"],
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

async function buildReadModel(workspaceId: string, db: DbClient = prisma): Promise<PilotWorkspaceReadModel> {
  const workspace = await db.pilotWorkspace.findUnique({
    where: { id: workspaceId },
    include: {
      assignedOperator: { select: { id: true, name: true, email: true } },
      organization: {
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
          productCategories: { select: { id: true }, where: { deletedAt: null } },
          products: { select: { id: true }, where: { deletedAt: null } },
          services: { select: { id: true }, where: { deletedAt: null } },
          members: { select: { id: true }, where: { isActive: true } },
          externalCatalogConnections: { select: { id: true } },
          seoOpportunities: { select: { id: true } },
        },
      },
    },
  });
  if (!workspace) throw new ApiError(404, "Pilot workspace not found");

  const organization = workspace.organization;
  const capabilities = activeCapabilities(organization);
  const industry = industryForOrganization(organization);
  const activationPlan = await getActivationPlan({ organizationId: organization.id, db });
  const activationActions = Array.isArray(activationPlan.recommendedActions) ? activationPlan.recommendedActions as Array<{ key: string; title: string; category: string }> : [];
  const checklist = (jsonArray(workspace.checklist).length > 0 ? jsonArray(workspace.checklist) : buildChecklist({ organizationName: organization.name, industry, capabilities, activationActions })) as PilotChecklistItem[];
  const completed = new Set(jsonArray(workspace.completedChecklist).filter((item): item is string => typeof item === "string"));
  for (const task of jsonArray(activationPlan.completedActions).filter((item): item is string => typeof item === "string")) {
    completed.add(`activation-${task}`);
  }

  const missingProfile = profileMissing(organization);
  const [inoti, reputation, reviewSeo, growthPlan] = await Promise.all([
    getInotiAccountReadModel(organization.id).catch(() => null),
    getOrganizationReputationOverview({ organizationId: organization.id }).catch(() => null),
    getReviewSeoReadiness({ organizationId: organization.id }).catch(() => null),
    getGrowthPlan({ organizationId: organization.id }).catch(() => null),
  ]);

  const checklistWithState = checklist.map((item) => ({ ...item, completed: completed.has(item.key) }));
  const missingItems = checklistWithState.filter((item) => !item.completed && item.required).map((item) => ({ key: item.key, title: item.title, category: item.category }));
  const completedCount = checklistWithState.filter((item) => item.completed).length;
  const totalCount = Math.max(checklistWithState.length, 1);
  const template = getIndustryTemplate(industry);
  const readinessSummary: PilotReadinessSummary = {
    progressPercent: Math.round((completedCount / totalCount) * 100),
    completedCount,
    totalCount,
    missingItems,
    recommendedNextAction: checklistWithState.find((item) => !item.completed)?.recommendedAction ?? null,
    profile: { complete: missingProfile.length === 0, missing: missingProfile },
    catalog: {
      ready: capabilities.includes("APPOINTMENT") ? organization.services.length > 0 : organization.products.length > 0,
      productCount: organization.products.length,
      productCategoryCount: organization.productCategories.length,
      serviceCount: organization.services.length,
      staffCount: organization.members.length,
    },
    integrations: {
      inotiStatus: inoti?.account.status ?? "NOT_CONNECTED",
      externalCatalogConnections: organization.externalCatalogConnections.length,
      dryRunOnly: true,
    },
    seo: {
      opportunities: organization.seoOpportunities.length,
      entityCompleteness: reviewSeo?.seoSignals.businessEntitySchemaReady ? "READY" : "NEEDS_REVIEW",
      keywordStrategyStatus: growthPlan && growthPlan.readiness.keywordPlanCount > 0 ? "PREPARED" : growthPlanner(workspace.seoGrowthPlanner, organization).preferredKeywords.length > 0 ? "PREPARED" : "NOT_STARTED",
      iamReadiness: growthPlan && growthPlan.readiness.iamRecommendationCount > 0 ? "RECOMMENDED" : template.growthIntelligence.iamPageBlueprintHints.length > 0 ? "RECOMMENDED" : "OPTIONAL",
      seoStrategyStatus: growthPlan?.readiness.seoStrategyStatus ?? "NOT_READY",
      seoScore: growthPlan?.readiness.seoScore ?? 0,
      keywordPlanCount: growthPlan?.readiness.keywordPlanCount ?? 0,
      iamRecommendationCount: growthPlan?.readiness.iamRecommendationCount ?? 0,
      contentOpportunityCount: growthPlan?.readiness.contentOpportunityCount ?? 0,
      nextGrowthAction: growthPlan?.readiness.nextAction ?? null,
    },
    trust: {
      reviewReadiness: reviewSeo?.seoSignals.reviewSchemaReady ? "READY" : "FOUNDATION_READY",
      reputationScore: reputation?.reputationScore ?? 0,
      reviewCount: reputation?.reviewCount ?? 0,
    },
    engagement: {
      customerClubReady: capabilities.includes("CRM") || capabilities.includes("LOYALTY"),
      ebcReady: template.growthIntelligence.recommendedInotiServices.includes("EBC"),
    },
  };

  return {
    id: workspace.id,
    organizationId: workspace.organizationId,
    status: workspace.status,
    assignedOperator: workspace.assignedOperator,
    notes: workspace.notes,
    organization: {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      type: organization.type,
      industry,
      capabilities,
    },
    checklist: checklistWithState,
    readinessSummary,
    growthPlanner: growthPlanner(workspace.seoGrowthPlanner, organization),
    setupFlow: setupFlow({ organizationName: organization.name, industry, capabilities, completed }),
    timestamps: { createdAt: workspace.createdAt.toISOString(), updatedAt: workspace.updatedAt.toISOString() },
  };
}

async function audit(input: {
  db: DbClient;
  action: "CREATE" | "UPDATE" | "CHANGE_STATUS";
  workspaceId: string;
  organizationId: string;
  actorUserId: string;
  description: string;
  previousValue?: Prisma.InputJsonValue;
  newValue?: Prisma.InputJsonValue;
}) {
  await input.db.auditLog.create({
    data: {
      action: input.action,
      entityType: "PilotWorkspace",
      entityId: input.workspaceId,
      organizationId: input.organizationId,
      userId: input.actorUserId,
      description: input.description,
      previousValue: input.previousValue,
      newValue: input.newValue,
    },
  });
}

export async function createOrRefreshPilotWorkspace(input: {
  organizationId: string;
  actorUserId: string;
  status?: PilotWorkspaceStatus;
  assignedOperatorId?: string | null;
  notes?: string | null;
  seoGrowthPlanner?: {
    businessGoals?: string[];
    targetAudience?: string[];
    preferredKeywords?: string[];
    cityLocation?: string | null;
  };
  db?: DbClient;
}) {
  const db = input.db ?? prisma;
  const organization = await requireOrganization({ organizationId: input.organizationId, db });
  const capabilities = activeCapabilities(organization);
  const industry = industryForOrganization(organization);
  const activationPlan = await getActivationPlan({ organizationId: organization.id, db });
  const activationActions = Array.isArray(activationPlan.recommendedActions) ? activationPlan.recommendedActions as Array<{ key: string; title: string; category: string }> : [];
  const checklist = buildChecklist({ organizationName: organization.name, industry, capabilities, activationActions });

  const workspace = await db.pilotWorkspace.upsert({
    where: { organizationId: organization.id },
    update: {
      status: input.status,
      assignedOperatorId: input.assignedOperatorId === undefined ? undefined : input.assignedOperatorId,
      notes: input.notes === undefined ? undefined : input.notes,
      checklist: asJsonArray(checklist),
      readinessSummary: asJsonObject({ refreshedAt: new Date().toISOString(), externalProviderCalls: false }),
      seoGrowthPlanner: input.seoGrowthPlanner ? asJsonObject(input.seoGrowthPlanner) : undefined,
      metadata: asJsonObject({ generatedFromExistingActivationTasks: true, externalProviderCalls: false }),
    },
    create: {
      organizationId: organization.id,
      status: input.status ?? "DISCOVERY",
      assignedOperatorId: input.assignedOperatorId ?? null,
      notes: input.notes ?? null,
      checklist: asJsonArray(checklist),
      readinessSummary: asJsonObject({ createdAt: new Date().toISOString(), externalProviderCalls: false }),
      seoGrowthPlanner: input.seoGrowthPlanner ? asJsonObject(input.seoGrowthPlanner) : asJsonObject({ businessGoals: [], targetAudience: [], preferredKeywords: [], cityLocation: organization.address }),
      metadata: asJsonObject({ generatedFromExistingActivationTasks: true, externalProviderCalls: false }),
    },
  });

  for (const item of checklist) {
    await db.organizationActivationTask.upsert({
      where: { organizationId_taskKey: { organizationId: organization.id, taskKey: `pilot-${item.key}` } },
      update: {
        title: item.title,
        description: item.description,
        category: categoryForActivation(item.category),
        targetRoute: item.targetRoute,
        metadata: asJsonObject({ pilotChecklistKey: item.key, source: item.source, externalProviderCalls: false }),
      },
      create: {
        organizationId: organization.id,
        activationPlanId: activationPlan.id,
        taskKey: `pilot-${item.key}`,
        title: item.title,
        description: item.description,
        category: categoryForActivation(item.category),
        targetRoute: item.targetRoute,
        metadata: asJsonObject({ pilotChecklistKey: item.key, source: item.source, externalProviderCalls: false }),
      },
    });
  }

  await audit({
    db,
    action: "CREATE",
    workspaceId: workspace.id,
    organizationId: organization.id,
    actorUserId: input.actorUserId,
    description: "Pilot workspace created or refreshed",
    newValue: asJsonObject({ status: workspace.status, checklistItems: checklist.length }),
  });

  return buildReadModel(workspace.id, db);
}

export async function getPilotWorkspace(input: { organizationId: string; db?: DbClient }) {
  const db = input.db ?? prisma;
  const workspace = await db.pilotWorkspace.findUnique({ where: { organizationId: input.organizationId }, select: { id: true } });
  if (!workspace) throw new ApiError(404, "Pilot workspace not found");
  return buildReadModel(workspace.id, db);
}

export async function listPilotWorkspaces(input: { db?: DbClient } = {}) {
  const db = input.db ?? prisma;
  const workspaces = await db.pilotWorkspace.findMany({
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    select: { id: true },
  });
  const pilots = await Promise.all(workspaces.map((workspace) => buildReadModel(workspace.id, db)));
  return {
    counts: {
      total: pilots.length,
      live: pilots.filter((pilot) => pilot.status === "LIVE").length,
      readyForLaunch: pilots.filter((pilot) => pilot.status === "READY_FOR_LAUNCH").length,
      paused: pilots.filter((pilot) => pilot.status === "PAUSED").length,
    },
    pilots,
  };
}

export async function updatePilotWorkspace(input: {
  organizationId: string;
  actorUserId: string;
  status?: PilotWorkspaceStatus;
  assignedOperatorId?: string | null;
  notes?: string | null;
  seoGrowthPlanner?: {
    businessGoals?: string[];
    targetAudience?: string[];
    preferredKeywords?: string[];
    cityLocation?: string | null;
  };
  db?: DbClient;
}) {
  const db = input.db ?? prisma;
  if (input.status && !PILOT_STATUSES.has(input.status)) throw new ApiError(400, "Invalid pilot status");
  const current = await db.pilotWorkspace.findUnique({ where: { organizationId: input.organizationId } });
  if (!current) return createOrRefreshPilotWorkspace(input);

  const updated = await db.pilotWorkspace.update({
    where: { organizationId: input.organizationId },
    data: {
      status: input.status,
      assignedOperatorId: input.assignedOperatorId === undefined ? undefined : input.assignedOperatorId,
      notes: input.notes === undefined ? undefined : input.notes,
      seoGrowthPlanner: input.seoGrowthPlanner ? asJsonObject(input.seoGrowthPlanner) : undefined,
    },
  });

  await audit({
    db,
    action: input.status && input.status !== current.status ? "CHANGE_STATUS" : "UPDATE",
    workspaceId: updated.id,
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    description: "Pilot workspace updated",
    previousValue: asJsonObject({ status: current.status, assignedOperatorId: current.assignedOperatorId, notes: current.notes }),
    newValue: asJsonObject({ status: updated.status, assignedOperatorId: updated.assignedOperatorId, notes: updated.notes, seoGrowthPlannerUpdated: Boolean(input.seoGrowthPlanner) }),
  });

  return buildReadModel(updated.id, db);
}

export async function completePilotChecklistItem(input: {
  organizationId: string;
  itemKey: string;
  completed: boolean;
  actorUserId: string;
  db?: DbClient;
}) {
  const db = input.db ?? prisma;
  const workspace = await db.pilotWorkspace.findUnique({ where: { organizationId: input.organizationId } });
  if (!workspace) throw new ApiError(404, "Pilot workspace not found");
  const checklist = jsonArray(workspace.checklist) as PilotChecklistItem[];
  const item = checklist.find((entry) => entry.key === input.itemKey);
  if (!item) throw new ApiError(404, "Pilot checklist item not found");
  const completed = new Set(jsonArray(workspace.completedChecklist).filter((entry): entry is string => typeof entry === "string"));
  if (input.completed) completed.add(input.itemKey);
  else completed.delete(input.itemKey);

  const updated = await db.pilotWorkspace.update({
    where: { organizationId: input.organizationId },
    data: { completedChecklist: asJsonArray(Array.from(completed)) },
  });

  await db.organizationActivationTask.updateMany({
    where: { organizationId: input.organizationId, taskKey: `pilot-${input.itemKey}` },
    data: { status: input.completed ? "COMPLETED" : "PENDING", completedAt: input.completed ? new Date() : null },
  });

  await audit({
    db,
    action: "UPDATE",
    workspaceId: workspace.id,
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    description: "Pilot checklist item updated",
    newValue: asJsonObject({ itemKey: input.itemKey, completed: input.completed }),
  });

  return buildReadModel(updated.id, db);
}

export type PilotLaunchStage =
  | "DATA_COLLECTION"
  | "PROFILE_SETUP"
  | "CATALOG_SETUP"
  | "INTEGRATION_SETUP"
  | "GROWTH_SETUP"
  | "TRUST_SETUP"
  | "LAUNCH_REVIEW"
  | "READY_TO_LAUNCH"
  | "LIVE"
  | "PAUSED";

export type ProviderConnectionState =
  | "NOT_CONFIGURED"
  | "CONFIGURED"
  | "READY_TO_CONNECT"
  | "CONNECTION_PENDING"
  | "VERIFIED_EXTERNALLY"
  | "ACTIVE";

export type PilotSourceKind = "SNAPPFOOD" | "WEBSITE" | "INSTAGRAM" | "INOTI" | "IAM" | "MANUAL" | "CSV" | "OTHER";

export type PilotSourceAssessmentStatus =
  | "NOT_ASSESSED"
  | "MANUAL_ONLY"
  | "ADAPTER_AVAILABLE"
  | "READY_FOR_REVIEW"
  | "REQUIRES_CREDENTIALS"
  | "REQUIRES_EXTERNAL_APPROVAL"
  | "UNSUPPORTED";

export type PilotReadinessState = "READY" | "MISSING" | "NEEDS_OPERATOR_INPUT" | "PENDING_VERIFICATION" | "OPTIONAL" | "BLOCKED";

export type PilotSourceAssessment = {
  id: string | null;
  persisted: boolean;
  sourceKind: PilotSourceKind;
  sourceType: ExternalImportSourceType;
  displayName: string;
  sourceUrl: string | null;
  intendedPurpose: string;
  connectionState: ProviderConnectionState;
  assessmentStatus: PilotSourceAssessmentStatus;
  legalAssessmentStatus: PilotSourceAssessmentStatus;
  technicalAssessmentStatus: PilotSourceAssessmentStatus;
  dataExpected: string[];
  manualImportRequired: boolean;
  adapterSupport: "NONE" | "LOCAL_PREVIEW_FIXTURE" | "MANUAL_INPUT" | "FUTURE_CONNECTOR";
  externalVerificationRequired: boolean;
  provenance: "MANUAL_OPERATOR" | "BUSINESS_OWNER" | "EXTERNAL_CATALOG" | "WEBSITE" | "SOCIAL" | "INOTI" | "IAM" | "LEGACY_IMPORT";
  externalProviderCalls: false;
  updatedAt: string | null;
};

export type RealPilotLaunchReadModel = {
  organization: PilotWorkspaceReadModel["organization"] & {
    descriptionStatus: PilotReadinessState;
    locationStatus: PilotReadinessState;
    publicContactStatus: PilotReadinessState;
  };
  pilot: PilotWorkspaceReadModel;
  acquisition: {
    industry: OrganizationIndustryKey;
    sourceType: string | null;
    generatedFromBazarBaazTeam: boolean;
  };
  activation: {
    status: string;
    completedActions: number;
    recommendedActions: number;
  };
  launch: {
    stage: PilotLaunchStage;
    blockerCount: number;
    recommendationCount: number;
    approval: {
      completed: boolean;
      reviewerUserId: string | null;
      reviewedAt: string | null;
      notes: string | null;
    };
  };
  profileReadiness: {
    state: PilotReadinessState;
    missing: string[];
    editableFields: string[];
  };
  catalogReadiness: {
    state: PilotReadinessState;
    productCount: number;
    productCategoryCount: number;
    serviceCount: number;
    staffCount: number;
    requiredCapability: "SHOP" | "APPOINTMENT";
    sourcePath: "MANUAL_INPUT" | "STRUCTURED_PASTE" | "APPROVED_LOCAL_FIXTURE" | "FUTURE_CONNECTOR";
  };
  integrationReadiness: {
    dryRunOnly: true;
    services: Array<{
      key: string;
      provider: IntegrationProvider;
      recommended: boolean;
      capabilityAvailable: boolean;
      connectionState: ProviderConnectionState;
      label: string;
      credentialState: string;
      readOnlyVerification: string;
      publicIntegrationId: string | null;
      callbackUrl: string | null;
      ussdCodeNameConfigured: boolean;
      smsTokenConfigured: boolean;
      ussdDialStringConfigured: boolean;
      realExecution: "DISABLED";
      nextAction: string;
    }>;
  };
  growthReadiness: {
    state: PilotReadinessState;
    seoScore: number;
    keywordPlanCount: number;
    iamRecommendationCount: number;
    contentOpportunityCount: number;
    nextAction: string | null;
  };
  trustReadiness: {
    state: PilotReadinessState;
    verifiedReviewCount: number;
    reviewRequestReady: boolean;
    publicTrustReady: boolean;
  };
  publicExperienceReadiness: {
    state: PilotReadinessState;
    safeToSerialize: boolean;
    missingPublicFields: string[];
    privateFieldsExcluded: string[];
  };
  sourceAssessments: PilotSourceAssessment[];
  blockers: Array<{ key: string; title: string; area: string; severity: "BLOCKER"; nextAction: string }>;
  recommendations: Array<{ key: string; title: string; area: string; severity: "RECOMMENDATION"; nextAction: string }>;
  nextActions: Array<{ key: string; title: string; area: string; priority: "HIGH" | "MEDIUM" | "LOW" }>;
  safety: {
    externalProviderCalls: false;
    exposesCredentials: false;
    exposesCustomerIdentity: false;
    demoUniverseSeparated: true;
  };
};

type PilotWorkspaceMetadata = {
  realPilotIntake?: {
    website?: string | null;
    socialUrls?: string[];
    operatingAreas?: string[];
  };
  launchApproval?: {
    completed: boolean;
    reviewerUserId: string;
    reviewedAt: string;
    notes?: string | null;
    remainingRecommendations?: string[];
  };
};

function jsonObjectValue(value: Prisma.JsonValue | null | undefined): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? Array.from(new Set(value.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim())))
    : [];
}

function sourceTypeForKind(kind: PilotSourceKind): ExternalImportSourceType {
  if (kind === "SNAPPFOOD") return "SNAP_FOOD";
  if (kind === "INSTAGRAM") return "INSTAGRAM";
  if (kind === "CSV") return "CSV";
  if (kind === "WEBSITE" || kind === "MANUAL") return "MANUAL_URL";
  return "UNKNOWN";
}

function normalizeSourceUrl(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed.toLowerCase() : null;
}

function realPilotDefaults(slug: string, businessKindValue: ReturnType<typeof businessKind>): PilotSourceAssessment[] {
  const defaults: PilotSourceAssessment[] = [];
  if (slug === "italiano-13" || businessKindValue === "RESTAURANT") {
    defaults.push(sourceAssessmentDefaults({
      sourceKind: "SNAPPFOOD",
      displayName: "SnappFood source candidate",
      sourceUrl: null,
      intendedPurpose: "Future menu/catalog intake after provider and legal review.",
      assessmentStatus: "REQUIRES_EXTERNAL_APPROVAL",
      dataExpected: ["menu categories", "menu items", "prices if approved", "images if approved"],
      adapterSupport: "LOCAL_PREVIEW_FIXTURE",
      externalVerificationRequired: true,
      provenance: "EXTERNAL_CATALOG",
    }));
  }
  if (slug === "cafe-leo") {
    defaults.push(sourceAssessmentDefaults({
      sourceKind: "WEBSITE",
      displayName: "Cafe Leo website",
      sourceUrl: "https://iran.leocafe.vip/",
      intendedPurpose: "Future website-based brand/content intake. Crawling is not authorized in this milestone.",
      assessmentStatus: "MANUAL_ONLY",
      dataExpected: ["business profile", "brand content", "menu/content if owner approves", "media references"],
      adapterSupport: "FUTURE_CONNECTOR",
      externalVerificationRequired: true,
      provenance: "WEBSITE",
    }));
  }
  if (slug === "aka-shoes") {
    defaults.push(sourceAssessmentDefaults({
      sourceKind: "INSTAGRAM",
      displayName: "AKA Shoes Instagram",
      sourceUrl: "https://www.instagram.com/aka.shoes/",
      intendedPurpose: "Future social/catalog intake with human review before entity or product mapping.",
      assessmentStatus: "REQUIRES_EXTERNAL_APPROVAL",
      dataExpected: ["social content", "product photos", "captions", "optional product mapping after review"],
      adapterSupport: "FUTURE_CONNECTOR",
      externalVerificationRequired: true,
      provenance: "SOCIAL",
    }));
  }
  defaults.push(sourceAssessmentDefaults({
    sourceKind: "MANUAL",
    displayName: "Manual operator intake",
    sourceUrl: null,
    intendedPurpose: "Safe local data entry and structured pasted data with operator provenance.",
    assessmentStatus: "ADAPTER_AVAILABLE",
    dataExpected: businessKindValue === "APPOINTMENT" ? ["services", "staff", "schedule", "portfolio media"] : ["profile fields", "categories", "catalog/menu items", "media"],
    adapterSupport: "MANUAL_INPUT",
    externalVerificationRequired: false,
    provenance: "MANUAL_OPERATOR",
  }));
  return defaults;
}

function sourceAssessmentDefaults(input: {
  sourceKind: PilotSourceKind;
  displayName: string;
  sourceUrl: string | null;
  intendedPurpose: string;
  assessmentStatus: PilotSourceAssessmentStatus;
  dataExpected: string[];
  adapterSupport: PilotSourceAssessment["adapterSupport"];
  externalVerificationRequired: boolean;
  provenance: PilotSourceAssessment["provenance"];
}): PilotSourceAssessment {
  return {
    id: null,
    persisted: false,
    sourceKind: input.sourceKind,
    sourceType: sourceTypeForKind(input.sourceKind),
    displayName: input.displayName,
    sourceUrl: input.sourceUrl,
    intendedPurpose: input.intendedPurpose,
    connectionState: input.externalVerificationRequired ? "READY_TO_CONNECT" : "CONFIGURED",
    assessmentStatus: input.assessmentStatus,
    legalAssessmentStatus: input.assessmentStatus,
    technicalAssessmentStatus: input.assessmentStatus,
    dataExpected: input.dataExpected,
    manualImportRequired: input.adapterSupport !== "LOCAL_PREVIEW_FIXTURE",
    adapterSupport: input.adapterSupport,
    externalVerificationRequired: input.externalVerificationRequired,
    provenance: input.provenance,
    externalProviderCalls: false,
    updatedAt: null,
  };
}

function serializeSourceAssessment(row: {
  id: string;
  type: ExternalImportSourceType;
  status: ExternalImportSourceStatus;
  displayName: string | null;
  sourceUrl: string | null;
  metadata: Prisma.JsonValue | null;
  updatedAt: Date;
}): PilotSourceAssessment {
  const metadata = jsonObjectValue(row.metadata);
  const sourceKind = typeof metadata.sourceKind === "string" ? metadata.sourceKind as PilotSourceKind : "OTHER";
  const assessmentStatus = typeof metadata.assessmentStatus === "string" ? metadata.assessmentStatus as PilotSourceAssessmentStatus : "NOT_ASSESSED";
  const adapterSupport = typeof metadata.adapterSupport === "string" ? metadata.adapterSupport as PilotSourceAssessment["adapterSupport"] : "NONE";
  const externalVerificationRequired = metadata.externalVerificationRequired === true;
  return {
    id: row.id,
    persisted: true,
    sourceKind,
    sourceType: row.type,
    displayName: row.displayName ?? sourceKind,
    sourceUrl: row.sourceUrl,
    intendedPurpose: typeof metadata.intendedPurpose === "string" ? metadata.intendedPurpose : "Source assessment",
    connectionState: typeof metadata.connectionState === "string" ? metadata.connectionState as ProviderConnectionState : externalVerificationRequired ? "READY_TO_CONNECT" : "CONFIGURED",
    assessmentStatus,
    legalAssessmentStatus: typeof metadata.legalAssessmentStatus === "string" ? metadata.legalAssessmentStatus as PilotSourceAssessmentStatus : assessmentStatus,
    technicalAssessmentStatus: typeof metadata.technicalAssessmentStatus === "string" ? metadata.technicalAssessmentStatus as PilotSourceAssessmentStatus : assessmentStatus,
    dataExpected: stringList(metadata.dataExpected),
    manualImportRequired: metadata.manualImportRequired !== false,
    adapterSupport,
    externalVerificationRequired,
    provenance: typeof metadata.provenance === "string" ? metadata.provenance as PilotSourceAssessment["provenance"] : "MANUAL_OPERATOR",
    externalProviderCalls: false,
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mergeSourceAssessments(stored: PilotSourceAssessment[], defaults: PilotSourceAssessment[]) {
  const key = (item: PilotSourceAssessment) => `${item.sourceKind}:${item.sourceUrl ?? ""}`;
  const storedKeys = new Set(stored.map(key));
  return [...stored, ...defaults.filter((item) => !storedKeys.has(key(item)))];
}

function providerState(input: {
  status: OrganizationIntegrationStatus | "NOT_CONNECTED";
  credentialProfileKey?: string | null;
  healthStatus?: string | null;
  healthMetadata?: Prisma.JsonValue | null;
}): ProviderConnectionState {
  if (input.status === "NOT_CONNECTED") return "NOT_CONFIGURED";
  const metadata = jsonObjectValue(input.healthMetadata);
  const externallyVerified = metadata.externalProviderVerified === true || metadata.verifiedExternally === true;
  if (input.status === "ACTIVE" && externallyVerified && input.healthStatus === "CONNECTED") return "ACTIVE";
  if (externallyVerified && input.healthStatus === "CONNECTED") return "VERIFIED_EXTERNALLY";
  if (input.status === "ACTIVE") return "CONNECTION_PENDING";
  if (input.credentialProfileKey) return "READY_TO_CONNECT";
  return "CONFIGURED";
}

function readinessFromMissing(missing: string[], optional = false): PilotReadinessState {
  if (missing.length === 0) return "READY";
  return optional ? "OPTIONAL" : "MISSING";
}

function buildBlockers(input: {
  pilot: PilotWorkspaceReadModel;
  missingProfile: string[];
  catalogReady: boolean;
  launchApproved: boolean;
}) {
  const blockers: RealPilotLaunchReadModel["blockers"] = [];
  const capabilities = input.pilot.organization.capabilities;
  if (!input.pilot.organization.name.trim()) {
    blockers.push({ key: "profile-name", title: "No public business name", area: "Identity", severity: "BLOCKER", nextAction: "Enter the public business name" });
  }
  for (const field of input.missingProfile) {
    const fieldLabel = field === "contact info" ? "public contact" : field;
    blockers.push({ key: `profile-${field.replace(/\s+/g, "-")}`, title: `Missing ${fieldLabel}`, area: "Identity", severity: "BLOCKER", nextAction: "Complete public profile intake" });
  }
  if (!capabilities.includes("SHOP") && !capabilities.includes("APPOINTMENT")) {
    blockers.push({ key: "capability-required", title: "No enabled launch capability", area: "Operations", severity: "BLOCKER", nextAction: "Enable SHOP or APPOINTMENT capability" });
  }
  if (!input.catalogReady) {
    blockers.push({ key: "catalog-required", title: capabilities.includes("APPOINTMENT") ? "No service catalog ready" : "No catalog/menu ready", area: "Operations", severity: "BLOCKER", nextAction: capabilities.includes("APPOINTMENT") ? "Enter services and schedule data" : "Enter menu/catalog data manually or from an approved source" });
  }
  if (!input.launchApproved) {
    blockers.push({ key: "launch-review", title: "Launch review not completed", area: "Approval", severity: "BLOCKER", nextAction: "Complete operator launch review after required data is safe" });
  }
  return blockers;
}

function deriveLaunchStage(input: {
  status: PilotWorkspaceStatus;
  blockers: RealPilotLaunchReadModel["blockers"];
  growthReady: boolean;
  trustReady: boolean;
}): PilotLaunchStage {
  if (input.status === "LIVE") return "LIVE";
  if (input.status === "PAUSED") return "PAUSED";
  const firstBlocker = input.blockers[0];
  if (!firstBlocker) return "READY_TO_LAUNCH";
  if (firstBlocker.area === "Identity") return firstBlocker.key === "profile-name" ? "DATA_COLLECTION" : "PROFILE_SETUP";
  if (firstBlocker.area === "Operations") return "CATALOG_SETUP";
  if (!input.growthReady) return "GROWTH_SETUP";
  if (!input.trustReady) return "TRUST_SETUP";
  return "LAUNCH_REVIEW";
}

async function loadSourceAssessments(input: {
  organizationId: string;
  slug: string;
  businessKindValue: ReturnType<typeof businessKind>;
  db: DbClient;
}) {
  const rows = await input.db.externalImportSource.findMany({
    where: { organizationId: input.organizationId },
    select: { id: true, type: true, status: true, displayName: true, sourceUrl: true, metadata: true, updatedAt: true },
    orderBy: [{ updatedAt: "desc" }],
  });
  const stored = rows
    .filter((row) => jsonObjectValue(row.metadata).realPilotLaunch === true)
    .map(serializeSourceAssessment);
  return mergeSourceAssessments(stored, realPilotDefaults(input.slug, input.businessKindValue));
}

export async function getRealPilotLaunchWorkspace(input: { organizationId: string; db?: DbClient }): Promise<RealPilotLaunchReadModel> {
  const db = input.db ?? prisma;
  const pilot = await getPilotWorkspace({ organizationId: input.organizationId, db });
  const [organization, activationPlan, growthPlan, inoti] = await Promise.all([
    db.organization.findFirst({
      where: { id: input.organizationId, isActive: true, deletedAt: null },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        address: true,
        phone: true,
        email: true,
        logo: true,
        coverImage: true,
        acquisition: { select: { sourceType: true, industryKey: true } },
        pilotWorkspace: { select: { completedChecklist: true, metadata: true } },
      },
    }),
    getActivationPlan({ organizationId: input.organizationId, db }),
    getGrowthPlan({ organizationId: input.organizationId, db }).catch(() => null),
    getInotiAccountReadModel(input.organizationId).catch(() => null),
  ]);
  if (!organization) throw new ApiError(404, "Organization not found");

  const missingProfile = profileMissing(organization);
  const requiredCapability = pilot.organization.capabilities.includes("APPOINTMENT") ? "APPOINTMENT" as const : "SHOP" as const;
  const catalogReady = requiredCapability === "APPOINTMENT"
    ? pilot.readinessSummary.catalog.serviceCount > 0
    : pilot.readinessSummary.catalog.productCount > 0;
  const metadata = jsonObjectValue(organization.pilotWorkspace?.metadata) as PilotWorkspaceMetadata;
  const completed = new Set(jsonArray(organization.pilotWorkspace?.completedChecklist).filter((item): item is string => typeof item === "string"));
  const approval = metadata.launchApproval;
  const launchApproved = approval?.completed === true || completed.has("launch-final-review");
  const blockers = buildBlockers({ pilot, missingProfile, catalogReady, launchApproved });
  const recommendations: RealPilotLaunchReadModel["recommendations"] = [
    pilot.readinessSummary.trust.reviewCount === 0
      ? { key: "trust-reviews", title: "No verified reviews yet", area: "Trust", severity: "RECOMMENDATION", nextAction: "Prepare review request readiness after real customer interactions" }
      : null,
    pilot.readinessSummary.seo.iamRecommendationCount === 0
      ? { key: "growth-iam", title: "No iAM page recommendations generated", area: "Growth", severity: "RECOMMENDATION", nextAction: "Refresh growth intelligence after profile/catalog intake" }
      : null,
    pilot.readinessSummary.integrations.inotiStatus === "NOT_CONNECTED"
      ? { key: "integration-inoti", title: "iNoti services are not configured locally", area: "Integrations", severity: "RECOMMENDATION", nextAction: "Create local iNoti readiness drafts only after operator review" }
      : null,
  ].filter((item): item is RealPilotLaunchReadModel["recommendations"][number] => Boolean(item));
  const stage = deriveLaunchStage({
    status: pilot.status,
    blockers,
    growthReady: Boolean(growthPlan && growthPlan.readiness.seoStrategyStatus === "READY"),
    trustReady: pilot.readinessSummary.trust.reviewCount > 0,
  });
  const kind = businessKind({ organizationName: pilot.organization.name, industry: pilot.organization.industry, capabilities: pilot.organization.capabilities });
  const sourceAssessments = await loadSourceAssessments({ organizationId: input.organizationId, slug: organization.slug, businessKindValue: kind, db });
  const recommendedServices = new Set<string>(getIndustryTemplate(pilot.organization.industry).growthIntelligence.recommendedInotiServices);

  const integrationServices = (inoti?.services ?? []).map((service) => ({
    key: service.key,
    provider: service.provider,
    recommended: recommendedServices.has(service.key),
    capabilityAvailable: service.capabilityAvailable,
    connectionState: providerState({
      status: service.status,
      healthStatus: service.healthStatus,
      credentialProfileKey: service.credentialState === "CREDENTIALS_AVAILABLE" ? "configured" : null,
    }),
    label: service.label,
    credentialState: service.credentialState,
    readOnlyVerification: service.readOnlyVerification,
    publicIntegrationId: service.publicIntegrationId,
    callbackUrl: service.callbackUrl,
    ussdCodeNameConfigured: service.ussdCodeNameConfigured,
    smsTokenConfigured: service.smsTokenConfigured,
    ussdDialStringConfigured: service.ussdDialStringConfigured,
    realExecution: service.realExecution,
    nextAction: service.status === "NOT_CONNECTED"
      ? "iNoti credentials not yet provided"
      : service.credentialState !== "CREDENTIALS_AVAILABLE"
        ? "Add the correct tenant credential profile before read-only verification"
      : service.status === "DRAFT"
        ? "Collect credentials or provider approval when authorized"
        : "Read-only verification may be run; live SMS and payments remain disabled",
  }));

  const nextActions: RealPilotLaunchReadModel["nextActions"] = [
    ...blockers.slice(0, 3).map((blocker) => ({ key: blocker.key, title: blocker.nextAction, area: blocker.area, priority: "HIGH" as const })),
    ...recommendations.slice(0, 3).map((recommendation) => ({ key: recommendation.key, title: recommendation.nextAction, area: recommendation.area, priority: "MEDIUM" as const })),
  ];

  return {
    organization: {
      ...pilot.organization,
      descriptionStatus: organization.description?.trim() ? "READY" : "MISSING",
      locationStatus: organization.address?.trim() ? "READY" : "MISSING",
      publicContactStatus: organization.phone?.trim() || organization.email?.trim() ? "READY" : "MISSING",
    },
    pilot,
    acquisition: {
      industry: organization.acquisition?.industryKey ?? pilot.organization.industry,
      sourceType: organization.acquisition?.sourceType ?? null,
      generatedFromBazarBaazTeam: organization.acquisition?.sourceType === "BAZARBAAZ_TEAM",
    },
    activation: {
      status: activationPlan.status,
      completedActions: activationPlan.completedActions.length,
      recommendedActions: activationPlan.recommendedActions.length,
    },
    launch: {
      stage,
      blockerCount: blockers.length,
      recommendationCount: recommendations.length,
      approval: {
        completed: launchApproved,
        reviewerUserId: approval?.reviewerUserId ?? null,
        reviewedAt: approval?.reviewedAt ?? null,
        notes: approval?.notes ?? null,
      },
    },
    profileReadiness: {
      state: readinessFromMissing(missingProfile),
      missing: missingProfile,
      editableFields: ["name", "description", "industry", "address", "phone", "email", "website", "socialUrls", "operatingAreas", "preferredGoals", "preferredKeywords", "notes"],
    },
    catalogReadiness: {
      state: catalogReady ? "READY" : "MISSING",
      productCount: pilot.readinessSummary.catalog.productCount,
      productCategoryCount: pilot.readinessSummary.catalog.productCategoryCount,
      serviceCount: pilot.readinessSummary.catalog.serviceCount,
      staffCount: pilot.readinessSummary.catalog.staffCount,
      requiredCapability,
      sourcePath: "MANUAL_INPUT",
    },
    integrationReadiness: {
      dryRunOnly: true,
      services: integrationServices,
    },
    growthReadiness: {
      state: growthPlan && growthPlan.readiness.seoStrategyStatus === "READY" ? "READY" : "NEEDS_OPERATOR_INPUT",
      seoScore: growthPlan?.readiness.seoScore ?? 0,
      keywordPlanCount: growthPlan?.readiness.keywordPlanCount ?? 0,
      iamRecommendationCount: growthPlan?.readiness.iamRecommendationCount ?? 0,
      contentOpportunityCount: growthPlan?.readiness.contentOpportunityCount ?? 0,
      nextAction: growthPlan?.readiness.nextAction ?? pilot.readinessSummary.seo.nextGrowthAction,
    },
    trustReadiness: {
      state: pilot.readinessSummary.trust.reviewCount > 0 ? "READY" : "OPTIONAL",
      verifiedReviewCount: pilot.readinessSummary.trust.reviewCount,
      reviewRequestReady: true,
      publicTrustReady: pilot.readinessSummary.trust.reviewCount > 0,
    },
    publicExperienceReadiness: {
      state: blockers.some((blocker) => blocker.area === "Identity" || blocker.area === "Operations") ? "MISSING" : "READY",
      safeToSerialize: true,
      missingPublicFields: missingProfile,
      privateFieldsExcluded: ["integration credentials", "provider config", "customer identity", "operator notes", "internal growth notes", "unapproved reviews"],
    },
    sourceAssessments,
    blockers,
    recommendations,
    nextActions,
    safety: {
      externalProviderCalls: false,
      exposesCredentials: false,
      exposesCustomerIdentity: false,
      demoUniverseSeparated: true,
    },
  };
}

export async function registerPilotSourceAssessment(input: {
  organizationId: string;
  actorUserId: string;
  sourceKind: PilotSourceKind;
  displayName?: string | null;
  sourceUrl?: string | null;
  intendedPurpose: string;
  assessmentStatus?: PilotSourceAssessmentStatus;
  legalAssessmentStatus?: PilotSourceAssessmentStatus;
  technicalAssessmentStatus?: PilotSourceAssessmentStatus;
  dataExpected?: string[];
  manualImportRequired?: boolean;
  adapterSupport?: PilotSourceAssessment["adapterSupport"];
  externalVerificationRequired?: boolean;
  provenance?: PilotSourceAssessment["provenance"];
  db?: DbClient;
}) {
  const db = input.db ?? prisma;
  await requireOrganization({ organizationId: input.organizationId, db });
  const sourceType = sourceTypeForKind(input.sourceKind);
  const sourceUrl = input.sourceUrl?.trim() || null;
  const normalizedUrl = normalizeSourceUrl(sourceUrl);
  const rows = await db.externalImportSource.findMany({
    where: { organizationId: input.organizationId, type: sourceType, normalizedUrl },
    select: { id: true, metadata: true },
  });
  const existing = rows.find((row) => jsonObjectValue(row.metadata).sourceKind === input.sourceKind);
  const assessmentStatus = input.assessmentStatus ?? "NOT_ASSESSED";
  const metadata = {
    realPilotLaunch: true,
    sourceKind: input.sourceKind,
    intendedPurpose: input.intendedPurpose,
    connectionState: input.externalVerificationRequired ? "READY_TO_CONNECT" : "CONFIGURED",
    assessmentStatus,
    legalAssessmentStatus: input.legalAssessmentStatus ?? assessmentStatus,
    technicalAssessmentStatus: input.technicalAssessmentStatus ?? assessmentStatus,
    dataExpected: input.dataExpected ?? [],
    manualImportRequired: input.manualImportRequired ?? true,
    adapterSupport: input.adapterSupport ?? "NONE",
    externalVerificationRequired: input.externalVerificationRequired ?? true,
    provenance: input.provenance ?? "MANUAL_OPERATOR",
    externalProviderCalls: false,
  } satisfies Prisma.InputJsonObject;

  const row = existing
    ? await db.externalImportSource.update({
        where: { id: existing.id },
        data: {
          displayName: input.displayName?.trim() || input.sourceKind,
          sourceUrl,
          normalizedUrl,
          status: "DRAFT",
          metadata,
          createdByUserId: input.actorUserId,
        },
      })
    : await db.externalImportSource.create({
        data: {
          organizationId: input.organizationId,
          type: sourceType,
          status: "DRAFT",
          displayName: input.displayName?.trim() || input.sourceKind,
          sourceUrl,
          normalizedUrl,
          consentConfirmed: false,
          metadata,
          createdByUserId: input.actorUserId,
        },
      });

  await db.auditLog.create({
    data: {
      action: "UPDATE",
      entityType: "ExternalImportSource",
      entityId: row.id,
      organizationId: input.organizationId,
      userId: input.actorUserId,
      description: "Pilot source assessment updated",
      newValue: asJsonObject({ sourceKind: input.sourceKind, assessmentStatus, externalProviderCalls: false }),
    },
  });
  return serializeSourceAssessment(row);
}

export async function updateRealPilotBusinessIntake(input: {
  organizationId: string;
  actorUserId: string;
  name?: string | null;
  description?: string | null;
  industry?: OrganizationIndustryKey | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  socialUrls?: string[];
  operatingAreas?: string[];
  preferredGoals?: string[];
  preferredKeywords?: string[];
  notes?: string | null;
  db?: DbClient;
}) {
  const db = input.db ?? prisma;
  const workspace = await db.pilotWorkspace.findUnique({ where: { organizationId: input.organizationId }, select: { id: true, metadata: true, seoGrowthPlanner: true } });
  if (!workspace) throw new ApiError(404, "Pilot workspace not found");
  await db.organization.update({
    where: { id: input.organizationId },
    data: {
      name: input.name === undefined ? undefined : input.name?.trim() || undefined,
      description: input.description === undefined ? undefined : input.description?.trim() || null,
      address: input.address === undefined ? undefined : input.address?.trim() || null,
      phone: input.phone === undefined ? undefined : input.phone?.trim() || null,
      email: input.email === undefined ? undefined : input.email?.trim() || null,
    },
  });
  if (input.industry) {
    await db.organizationAcquisition.updateMany({
      where: { organizationId: input.organizationId },
      data: { industryKey: input.industry },
    });
  }
  const currentMetadata = jsonObjectValue(workspace.metadata) as PilotWorkspaceMetadata;
  const currentPlanner = jsonObjectValue(workspace.seoGrowthPlanner);
  await db.pilotWorkspace.update({
    where: { organizationId: input.organizationId },
    data: {
      notes: input.notes === undefined ? undefined : input.notes?.trim() || null,
      metadata: asJsonObject({
        ...currentMetadata,
        realPilotIntake: {
          ...(currentMetadata.realPilotIntake ?? {}),
          website: input.website === undefined ? currentMetadata.realPilotIntake?.website ?? null : input.website?.trim() || null,
          socialUrls: input.socialUrls ?? currentMetadata.realPilotIntake?.socialUrls ?? [],
          operatingAreas: input.operatingAreas ?? currentMetadata.realPilotIntake?.operatingAreas ?? [],
        },
        externalProviderCalls: false,
      }),
      seoGrowthPlanner: asJsonObject({
        ...currentPlanner,
        businessGoals: input.preferredGoals ?? stringList(currentPlanner.businessGoals),
        preferredKeywords: input.preferredKeywords ?? stringList(currentPlanner.preferredKeywords),
      }),
    },
  });

  await audit({
    db,
    action: "UPDATE",
    workspaceId: workspace.id,
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    description: "Pilot business intake updated",
    newValue: asJsonObject({ updatedFields: Object.keys(input).filter((key) => !["db", "actorUserId", "organizationId"].includes(key)), externalProviderCalls: false }),
  });

  return getRealPilotLaunchWorkspace({ organizationId: input.organizationId, db });
}

export async function recordPilotLaunchReview(input: {
  organizationId: string;
  actorUserId: string;
  notes?: string | null;
  db?: DbClient;
}) {
  const db = input.db ?? prisma;
  const workspace = await db.pilotWorkspace.findUnique({ where: { organizationId: input.organizationId } });
  if (!workspace) throw new ApiError(404, "Pilot workspace not found");
  const completed = new Set(jsonArray(workspace.completedChecklist).filter((item): item is string => typeof item === "string"));
  completed.add("launch-final-review");
  const metadata = jsonObjectValue(workspace.metadata) as PilotWorkspaceMetadata;
  const updated = await db.pilotWorkspace.update({
    where: { organizationId: input.organizationId },
    data: {
      completedChecklist: asJsonArray(Array.from(completed)),
      metadata: asJsonObject({
        ...metadata,
        launchApproval: {
          completed: true,
          reviewerUserId: input.actorUserId,
          reviewedAt: new Date().toISOString(),
          notes: input.notes?.trim() || null,
        },
        externalProviderCalls: false,
      }),
    },
  });
  await db.organizationActivationTask.updateMany({
    where: { organizationId: input.organizationId, taskKey: "pilot-launch-final-review" },
    data: { status: "COMPLETED", completedAt: new Date() },
  });
  await audit({
    db,
    action: "UPDATE",
    workspaceId: updated.id,
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    description: "Pilot launch review completed",
    newValue: asJsonObject({ completed: true, externalProviderCalls: false }),
  });
  return getRealPilotLaunchWorkspace({ organizationId: input.organizationId, db });
}
