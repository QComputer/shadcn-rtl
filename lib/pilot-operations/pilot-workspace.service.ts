import "server-only";

import type {
  OrganizationCapabilityKey,
  OrganizationIndustryKey,
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
