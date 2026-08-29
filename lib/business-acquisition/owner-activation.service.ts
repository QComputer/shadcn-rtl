import "server-only";

import type {
  OrganizationActivationTaskCategory,
  OrganizationActivationTaskStatus,
  OrganizationCapabilityKey,
  OrganizationIndustryKey,
  Prisma,
  UserRole,
} from "@prisma/client";
import prisma from "@/lib/db";
import { ApiError, getActiveMembership, getMembershipRole, type SessionWithUser } from "@/lib/api-guards";
import {
  completeActivationStep,
  generateActivationPlan,
  getActivationPlan,
  type ActivationAction,
} from "@/lib/business-acquisition/activation-plan.service";
import { getIndustryTemplate } from "@/lib/business-acquisition/industry-templates";
import { buildOrganizationPublicPath, buildOrganizationRootPath } from "@/lib/custom-domain-routing";

const OWNER_PORTAL_ROLES: UserRole[] = ["ADMIN", "MANAGER"];

type ActivationTaskStatus = OrganizationActivationTaskStatus;
type ActivationTaskCategory = OrganizationActivationTaskCategory;

export type OwnerBusinessProfileUpdate = {
  description?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
};

export type OwnerActivationDashboard = {
  organization: {
    id: string;
    name: string;
    slug: string;
    type: "SHOP" | "APPOINTMENT";
    industryKey: OrganizationIndustryKey;
    description: string | null;
    address: string | null;
    phone: string | null;
    email: string | null;
    logo: string | null;
    coverImage: string | null;
    isOpen: boolean;
    publicPaths: {
      shell: string;
      shop: string | null;
      appointment: string | null;
    };
  };
  membership: {
    role: UserRole;
    ownerEquivalent: boolean;
  };
  activation: {
    id: string;
    status: string;
    industryKey: OrganizationIndustryKey;
    generatedFromTemplate: string;
    progress: {
      total: number;
      completed: number;
      percent: number;
    };
    recommendedActions: Array<ActivationAction & { completed: boolean }>;
    nextActions: Array<ActivationAction & { completed: boolean }>;
  };
  guidedSetup: {
    greeting: string;
    progress: {
      total: number;
      completed: number;
      inProgress: number;
      percent: number;
    };
    completedTasks: OwnerActivationTask[];
    nextRecommendedTasks: OwnerActivationTask[];
    tasks: OwnerActivationTask[];
  };
  readinessScore: {
    percent: number;
    dimensions: Array<{
      key: "PROFILE" | "OPERATIONS" | "CUSTOMER_EXPERIENCE" | "GROWTH";
      label: string;
      percent: number;
      completed: number;
      total: number;
    }>;
  };
  profileCompletion: {
    score: number;
    completedItems: string[];
    missingItems: string[];
    recommendedNextItems: string[];
  };
  growthRecommendations: {
    seo: Array<{ key: string; title: string; description: string; priority: string; completed: boolean }>;
    iamPageBlueprintHints: string[];
    customerJourneySuggestions: string[];
  };
  inotiReadiness: Array<{
    service: string;
    status: "RECOMMENDED";
    reason: string;
    externalActivation: false;
  }>;
  enabledCapabilities: OrganizationCapabilityKey[];
  missingSetupItems: string[];
  futureClaimFlow: {
    ownerInvitationPrepared: boolean;
    claimRequestsPending: number;
    verificationCreatesMembership: false;
  };
};

export type OwnerActivationTask = {
  id: string;
  taskKey: string;
  title: string;
  description: string | null;
  category: ActivationTaskCategory;
  status: ActivationTaskStatus;
  completedAt: string | null;
  targetRoute: string | null;
  actionLabel: string;
  metadata: Record<string, unknown>;
};

type TaskDraft = {
  taskKey: string;
  title: string;
  description: string;
  category: ActivationTaskCategory;
  targetRoute: string | null;
  metadata: Record<string, unknown>;
};

function cleanText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > maxLength ? trimmed.slice(0, maxLength) : trimmed;
}

function activeCapabilityKeys(capabilities: Array<{ key: OrganizationCapabilityKey; status: string }>) {
  return capabilities.filter((capability) => capability.status === "ACTIVE").map((capability) => capability.key);
}

function fallbackCapabilities(type: "SHOP" | "APPOINTMENT"): OrganizationCapabilityKey[] {
  return type === "APPOINTMENT" ? ["APPOINTMENT"] : ["SHOP"];
}

function taskCategoryForAction(category: ActivationAction["category"]): ActivationTaskCategory {
  if (category === "PROFILE") return "PROFILE";
  if (category === "SEO" || category === "IAM") return "GROWTH";
  if (category === "INTEGRATION") return "INTEGRATIONS";
  if (category === "CUSTOMER_JOURNEY") return "CUSTOMER";
  return "OPERATIONS";
}

function targetRouteForAction(action: ActivationAction, organizationType: "SHOP" | "APPOINTMENT") {
  if (action.category === "PROFILE") return "/dashboard/settings/organization";
  if (action.category === "SEO" || action.category === "IAM") return "/dashboard/business-activation#growth";
  if (action.category === "INTEGRATION") return "/dashboard/business-activation#integrations";
  if (action.category === "CUSTOMER_JOURNEY") return "/dashboard/customer-club";
  if (action.relatedCapability === "APPOINTMENT" || organizationType === "APPOINTMENT") return "/dashboard/services";
  if (action.relatedCapability === "SHOP" || organizationType === "SHOP") return "/dashboard/products";
  return "/dashboard/business-activation";
}

function industryTaskDrafts(input: {
  industryKey: OrganizationIndustryKey;
  organizationType: "SHOP" | "APPOINTMENT";
  capabilities: OrganizationCapabilityKey[];
}): TaskDraft[] {
  const common: TaskDraft[] = [
    {
      taskKey: "public-profile",
      title: "Complete public business profile",
      description: "Add the public description, address, phone, email, and visual identity customers will see.",
      category: "PROFILE",
      targetRoute: "/dashboard/settings/organization",
      metadata: { source: "OWNER_ACTIVATION", dimension: "PROFILE", activationActionKey: "complete-public-profile" },
    },
    {
      taskKey: "visual-identity",
      title: "Complete images and visual identity",
      description: "Prepare logo or cover imagery before sharing the public business page.",
      category: "PROFILE",
      targetRoute: "/dashboard/creative-studio",
      metadata: { source: "OWNER_ACTIVATION", dimension: "PROFILE" },
    },
  ];

  const byIndustry: Record<OrganizationIndustryKey, TaskDraft[]> = {
    RESTAURANT: [
      { taskKey: "opening-hours", title: "Review opening hours", description: "Confirm the hours customers use before ordering.", category: "OPERATIONS", targetRoute: "/dashboard/settings/organization", metadata: { source: "INDUSTRY_TEMPLATE", dimension: "OPERATIONS" } },
      { taskKey: "menu-readiness", title: "Add restaurant menu", description: "Create menu products and categories for customer ordering.", category: "OPERATIONS", targetRoute: "/dashboard/products", metadata: { source: "INDUSTRY_TEMPLATE", dimension: "OPERATIONS" } },
      { taskKey: "customer-engagement-readiness", title: "Prepare customer engagement", description: "Review customer club readiness for retention campaigns.", category: "CUSTOMER", targetRoute: "/dashboard/customer-club", metadata: { source: "INDUSTRY_TEMPLATE", dimension: "CUSTOMER_EXPERIENCE" } },
    ],
    DENTAL_CLINIC: [
      { taskKey: "doctors-staff", title: "Add doctors and staff", description: "Prepare team members who manage services and appointments.", category: "OPERATIONS", targetRoute: "/dashboard/members", metadata: { source: "INDUSTRY_TEMPLATE", dimension: "OPERATIONS" } },
      { taskKey: "service-readiness", title: "Add dental services", description: "Create appointment services customers can discover and book.", category: "OPERATIONS", targetRoute: "/dashboard/services", metadata: { source: "INDUSTRY_TEMPLATE", dimension: "OPERATIONS" } },
      { taskKey: "appointment-settings", title: "Review appointment settings", description: "Confirm booking readiness before sharing appointment links.", category: "CUSTOMER", targetRoute: "/dashboard/settings/organization", metadata: { source: "INDUSTRY_TEMPLATE", dimension: "CUSTOMER_EXPERIENCE" } },
    ],
    PHARMACY: [
      { taskKey: "category-readiness", title: "Add pharmacy categories", description: "Prepare categories for customer product discovery.", category: "OPERATIONS", targetRoute: "/dashboard/product-categories", metadata: { source: "INDUSTRY_TEMPLATE", dimension: "OPERATIONS" } },
      { taskKey: "product-readiness", title: "Add pharmacy products", description: "Create initial products without medical claims or external inventory assumptions.", category: "OPERATIONS", targetRoute: "/dashboard/products", metadata: { source: "INDUSTRY_TEMPLATE", dimension: "OPERATIONS" } },
      { taskKey: "customer-communication-readiness", title: "Prepare customer communication", description: "Review customer club readiness for future follow-up flows.", category: "CUSTOMER", targetRoute: "/dashboard/customer-club", metadata: { source: "INDUSTRY_TEMPLATE", dimension: "CUSTOMER_EXPERIENCE" } },
    ],
    FASHION_BOUTIQUE: [
      { taskKey: "catalog-readiness", title: "Add boutique catalog", description: "Create collections or products for fashion discovery.", category: "OPERATIONS", targetRoute: "/dashboard/products", metadata: { source: "INDUSTRY_TEMPLATE", dimension: "OPERATIONS" } },
      { taskKey: "brand-readiness", title: "Prepare brand presentation", description: "Review visual content and collection presentation.", category: "GROWTH", targetRoute: "/dashboard/creative-studio", metadata: { source: "INDUSTRY_TEMPLATE", dimension: "GROWTH" } },
      { taskKey: "customer-profile-readiness", title: "Prepare customer profile readiness", description: "Use customer club foundations for preferences and manual recommendations.", category: "CUSTOMER", targetRoute: "/dashboard/customer-club", metadata: { source: "INDUSTRY_TEMPLATE", dimension: "CUSTOMER_EXPERIENCE" } },
    ],
    RETAIL_SHOP: [
      { taskKey: "category-readiness", title: "Add product categories", description: "Prepare categories for product discovery.", category: "OPERATIONS", targetRoute: "/dashboard/product-categories", metadata: { source: "INDUSTRY_TEMPLATE", dimension: "OPERATIONS" } },
      { taskKey: "product-readiness", title: "Add initial products", description: "Create products customers can discover and order.", category: "OPERATIONS", targetRoute: "/dashboard/products", metadata: { source: "INDUSTRY_TEMPLATE", dimension: "OPERATIONS" } },
      { taskKey: "customer-engagement-readiness", title: "Prepare customer engagement", description: "Review customer club readiness for retention.", category: "CUSTOMER", targetRoute: "/dashboard/customer-club", metadata: { source: "INDUSTRY_TEMPLATE", dimension: "CUSTOMER_EXPERIENCE" } },
    ],
    OTHER: [
      { taskKey: "capability-review", title: "Review enabled capabilities",         description: "Confirm the selected Bazarbaaz capabilities match this business.", category: "OPERATIONS", targetRoute: "/dashboard/business-activation", metadata: { source: "INDUSTRY_TEMPLATE", dimension: "OPERATIONS" } },
      { taskKey: "customer-path-review", title: "Review customer journey", description: "Prepare the customer path before sharing the business page.", category: "CUSTOMER", targetRoute: "/dashboard/customer-club", metadata: { source: "INDUSTRY_TEMPLATE", dimension: "CUSTOMER_EXPERIENCE" } },
    ],
  };

  const capabilityDrafts: TaskDraft[] = [];
  if (input.capabilities.includes("SHOP")) {
    capabilityDrafts.push({
      taskKey: "shop-capability-ready",
      title: "Confirm shop capability",
      description: "Check products, categories, and ordering surfaces.",
      category: "OPERATIONS",
      targetRoute: "/dashboard/products",
      metadata: { source: "CAPABILITY", dimension: "OPERATIONS", capability: "SHOP" },
    });
  }
  if (input.capabilities.includes("APPOINTMENT")) {
    capabilityDrafts.push({
      taskKey: "appointment-capability-ready",
      title: "Confirm appointment capability",
      description: "Check services, staff, and booking surfaces.",
      category: "OPERATIONS",
      targetRoute: "/dashboard/services",
      metadata: { source: "CAPABILITY", dimension: "OPERATIONS", capability: "APPOINTMENT" },
    });
  }

  return [...common, ...(byIndustry[input.industryKey] ?? byIndustry.OTHER), ...capabilityDrafts];
}

function buildTaskDrafts(input: {
  planId: string;
  industryKey: OrganizationIndustryKey;
  organizationType: "SHOP" | "APPOINTMENT";
  capabilities: OrganizationCapabilityKey[];
  actions: ActivationAction[];
}): TaskDraft[] {
  const actionDrafts = input.actions.map((action): TaskDraft => ({
    taskKey: `plan-${action.key}`,
    title: action.title,
    description: action.description,
    category: taskCategoryForAction(action.category),
    targetRoute: targetRouteForAction(action, input.organizationType),
    metadata: {
      source: "ACTIVATION_PLAN",
      activationPlanId: input.planId,
      activationActionKey: action.key,
      priority: action.priority,
      relatedCapability: action.relatedCapability ?? null,
    },
  }));

  const drafts = [...industryTaskDrafts(input), ...actionDrafts];
  return drafts.filter((draft, index, all) => all.findIndex((candidate) => candidate.taskKey === draft.taskKey) === index);
}

function actionLabelForTask(task: { status: ActivationTaskStatus; targetRoute: string | null }) {
  if (task.status === "COMPLETED") return "Completed";
  if (!task.targetRoute) return "Review";
  return task.status === "IN_PROGRESS" ? "Continue" : "Start";
}

function serializeTask(task: {
  id: string;
  taskKey: string;
  title: string;
  description: string | null;
  category: ActivationTaskCategory;
  status: ActivationTaskStatus;
  completedAt: Date | null;
  targetRoute: string | null;
  metadata: Prisma.JsonValue | null;
}): OwnerActivationTask {
  return {
    id: task.id,
    taskKey: task.taskKey,
    title: task.title,
    description: task.description,
    category: task.category,
    status: task.status,
    completedAt: task.completedAt?.toISOString() ?? null,
    targetRoute: task.targetRoute,
    actionLabel: actionLabelForTask(task),
    metadata: typeof task.metadata === "object" && task.metadata !== null && !Array.isArray(task.metadata)
      ? task.metadata as Record<string, unknown>
      : {},
  };
}

function progressForTasks(tasks: OwnerActivationTask[]) {
  const completed = tasks.filter((task) => task.status === "COMPLETED").length;
  const inProgress = tasks.filter((task) => task.status === "IN_PROGRESS").length;
  return {
    total: tasks.length,
    completed,
    inProgress,
    percent: tasks.length === 0 ? 100 : Math.round((completed / tasks.length) * 100),
  };
}

async function syncActivationTasks(input: {
  organizationId: string;
  activationPlanId: string;
  industryKey: OrganizationIndustryKey;
  organizationType: "SHOP" | "APPOINTMENT";
  capabilities: OrganizationCapabilityKey[];
  actions: ActivationAction[];
  completedActions: string[];
}) {
  const drafts = buildTaskDrafts({
    planId: input.activationPlanId,
    industryKey: input.industryKey,
    organizationType: input.organizationType,
    capabilities: input.capabilities,
    actions: input.actions,
  });
  const completedActions = new Set(input.completedActions);

  await prisma.$transaction(drafts.map((draft) => {
    const activationActionKey = typeof draft.metadata.activationActionKey === "string" ? draft.metadata.activationActionKey : null;
    const completedFromPlan = activationActionKey ? completedActions.has(activationActionKey) : false;
    return prisma.organizationActivationTask.upsert({
      where: {
        organizationId_taskKey: {
          organizationId: input.organizationId,
          taskKey: draft.taskKey,
        },
      },
      update: {
        activationPlanId: input.activationPlanId,
        title: draft.title,
        description: draft.description,
        category: draft.category,
        targetRoute: draft.targetRoute,
        metadata: draft.metadata as Prisma.InputJsonObject,
        ...(completedFromPlan ? { status: "COMPLETED", completedAt: new Date() } : {}),
      },
      create: {
        organizationId: input.organizationId,
        activationPlanId: input.activationPlanId,
        taskKey: draft.taskKey,
        title: draft.title,
        description: draft.description,
        category: draft.category,
        targetRoute: draft.targetRoute,
        metadata: draft.metadata as Prisma.InputJsonObject,
        status: completedFromPlan ? "COMPLETED" : "PENDING",
        completedAt: completedFromPlan ? new Date() : null,
      },
    });
  }));

  return prisma.organizationActivationTask.findMany({
    where: { organizationId: input.organizationId, activationPlanId: input.activationPlanId },
    orderBy: [{ status: "asc" }, { createdAt: "asc" }],
  });
}

async function calculateReadiness(input: {
  organization: Awaited<ReturnType<typeof loadOwnerOrganization>>;
  tasks: OwnerActivationTask[];
  capabilities: OrganizationCapabilityKey[];
}) {
  const [businessHours, products, productCategories, services, serviceCategories, bookingSettings, customerIdentities, seoOpportunities, images] = await Promise.all([
    prisma.businessHour.count({ where: { organizationId: input.organization.id } }),
    prisma.product.count({ where: { organizationId: input.organization.id, deletedAt: null } }),
    prisma.productCategory.count({ where: { organizationId: input.organization.id, deletedAt: null } }),
    prisma.service.count({ where: { organizationId: input.organization.id, deletedAt: null } }),
    prisma.serviceCategory.count({ where: { organizationId: input.organization.id, deletedAt: null } }),
    prisma.bookingSettings.count({ where: { organizationSlug: input.organization.slug } }),
    prisma.customerIdentity.count({ where: { organizationId: input.organization.id } }),
    prisma.seoOpportunity.count({ where: { organizationId: input.organization.id } }),
    prisma.image.count({ where: { organizationId: input.organization.id } }),
  ]);
  const profileItems = [
    Boolean(input.organization.description?.trim()),
    Boolean(input.organization.address?.trim()),
    Boolean(input.organization.phone?.trim()),
    Boolean(input.organization.email?.trim()),
    Boolean(input.organization.logo || input.organization.coverImage || images > 0),
  ];
  const operationsItems = input.capabilities.includes("APPOINTMENT")
    ? [services > 0, serviceCategories > 0, bookingSettings > 0]
    : [products > 0, productCategories > 0, businessHours > 0];
  const customerItems = [
    input.tasks.some((task) => task.category === "CUSTOMER" && task.status === "COMPLETED"),
    customerIdentities > 0,
  ];
  const growthItems = [
    seoOpportunities > 0,
    input.tasks.some((task) => (task.category === "GROWTH" || task.category === "INTEGRATIONS") && task.status === "COMPLETED"),
  ];

  function dimension(key: "PROFILE" | "OPERATIONS" | "CUSTOMER_EXPERIENCE" | "GROWTH", label: string, items: boolean[]) {
    const completed = items.filter(Boolean).length;
    return {
      key,
      label,
      completed,
      total: items.length,
      percent: items.length === 0 ? 100 : Math.round((completed / items.length) * 100),
    };
  }

  const dimensions = [
    dimension("PROFILE", "Profile", profileItems),
    dimension("OPERATIONS", "Operations", operationsItems),
    dimension("CUSTOMER_EXPERIENCE", "Customer Experience", customerItems),
    dimension("GROWTH", "Growth", growthItems),
  ];
  return {
    percent: Math.round(dimensions.reduce((sum, item) => sum + item.percent, 0) / dimensions.length),
    dimensions,
  };
}

async function recordActivationEvent(input: {
  organizationId: string;
  organizationSlug: string;
  userId?: string | null;
  entityType: string;
  entityId: string;
  description: string;
  metadata?: Record<string, unknown>;
}) {
  await prisma.auditLog.create({
    data: {
      action: "UPDATE",
      entityType: input.entityType,
      entityId: input.entityId,
      description: input.description,
      newValue: (input.metadata ?? {}) as Prisma.InputJsonObject,
      userId: input.userId ?? null,
      organizationId: input.organizationId,
      organizationSlug: input.organizationSlug,
    },
  });
}

async function resolveOwnerOrganization(session: SessionWithUser, requestedOrganizationId?: string | null) {
  const userId = session.user.id;
  const organizationId = requestedOrganizationId || session.user.organizationId || undefined;
  const membership = await getActiveMembership(userId, organizationId);
  const role = getMembershipRole(membership);

  if (
    !membership ||
    !role ||
    !OWNER_PORTAL_ROLES.includes(role) ||
    !membership.organization?.isActive ||
    membership.organization.deletedAt ||
    !membership.user?.isActive ||
    membership.user.deletedAt
  ) {
    throw new ApiError(403, "Forbidden");
  }

  if (requestedOrganizationId && membership.organizationId !== requestedOrganizationId) {
    throw new ApiError(403, "Tenant context mismatch");
  }

  return { organizationId: membership.organizationId, role };
}

async function loadOwnerOrganization(organizationId: string) {
  const organization = await prisma.organization.findFirst({
    where: { id: organizationId, isActive: true, deletedAt: null },
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
      isOpen: true,
      acquisition: { select: { industryKey: true } },
      capabilities: { select: { key: true, status: true }, orderBy: { key: "asc" } },
      invitations: {
        where: { status: { in: ["CREATED", "SENT", "CLAIMED"] } },
        select: { id: true },
        take: 1,
      },
      claimRequests: {
        where: { status: "REQUESTED" },
        select: { id: true },
      },
    },
  }) as Prisma.OrganizationGetPayload<{
    select: {
      id: true;
      name: true;
      slug: true;
      type: true;
      description: true;
      address: true;
      phone: true;
      email: true;
      logo: true;
      coverImage: true;
      isOpen: true;
      acquisition: { select: { industryKey: true } };
      capabilities: { select: { key: true; status: true } };
      invitations: { select: { id: true } };
      claimRequests: { select: { id: true } };
    };
  }> | null;

  if (!organization) throw new ApiError(404, "Organization not found");
  return organization;
}

export async function getOwnerActivationDashboard(input: {
  session: SessionWithUser;
  organizationId?: string | null;
  locale?: string;
}): Promise<OwnerActivationDashboard> {
  const resolved = await resolveOwnerOrganization(input.session, input.organizationId);
  const organization = await loadOwnerOrganization(resolved.organizationId);
  const industryKey = organization.acquisition?.industryKey ?? "OTHER";
  const plan = await getActivationPlan({ organizationId: organization.id });
  const template = getIndustryTemplate(industryKey);
  const enabledCapabilities = activeCapabilityKeys(organization.capabilities);
  const effectiveCapabilities = enabledCapabilities.length > 0 ? enabledCapabilities : fallbackCapabilities(organization.type);
  const completed = new Set(plan.completedActions);
  const recommendedActions = plan.recommendedActions.map((action) => ({ ...action, completed: completed.has(action.key) }));
  const tasks = (await syncActivationTasks({
    organizationId: organization.id,
    activationPlanId: plan.id,
    industryKey,
    organizationType: organization.type,
    capabilities: effectiveCapabilities,
    actions: plan.recommendedActions,
    completedActions: plan.completedActions,
  })).map(serializeTask);
  const guidedProgress = progressForTasks(tasks);
  const readinessScore = await calculateReadiness({ organization, tasks, capabilities: effectiveCapabilities });
  const completion = plan.ownerOnboardingReadModel.businessProfileCompleteness;
  const locale = input.locale || "fa";

  return {
    organization: {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      type: organization.type,
      industryKey,
      description: organization.description,
      address: organization.address,
      phone: organization.phone,
      email: organization.email,
      logo: organization.logo,
      coverImage: organization.coverImage,
      isOpen: organization.isOpen,
      publicPaths: {
        shell: buildOrganizationRootPath({ locale, organizationSlug: organization.slug }),
        shop: effectiveCapabilities.includes("SHOP") ? buildOrganizationPublicPath({ locale, organizationSlug: organization.slug, surface: "shop" }) : null,
        appointment: effectiveCapabilities.includes("APPOINTMENT") ? buildOrganizationPublicPath({ locale, organizationSlug: organization.slug, surface: "appointment" }) : null,
      },
    },
    membership: {
      role: resolved.role,
      ownerEquivalent: true,
    },
    activation: {
      id: plan.id,
      status: plan.status,
      industryKey: plan.industryKey,
      generatedFromTemplate: plan.generatedFromTemplate,
      progress: {
        total: recommendedActions.length,
        completed: completed.size,
        percent: recommendedActions.length === 0 ? 100 : Math.round((completed.size / recommendedActions.length) * 100),
      },
      recommendedActions,
      nextActions: recommendedActions.filter((action) => !action.completed).slice(0, 5),
    },
    guidedSetup: {
      greeting: `سلام، ${organization.name}`,
      progress: guidedProgress,
      completedTasks: tasks.filter((task) => task.status === "COMPLETED"),
      nextRecommendedTasks: tasks.filter((task) => task.status === "PENDING" || task.status === "IN_PROGRESS").slice(0, 5),
      tasks,
    },
    readinessScore,
    profileCompletion: {
      score: completion.score,
      completedItems: completion.completedItems,
      missingItems: completion.missingItems,
      recommendedNextItems: completion.missingItems.slice(0, 3),
    },
    growthRecommendations: {
      seo: template.growthIntelligence.seoOpportunities.map((opportunity) => ({
        key: opportunity.key,
        title: opportunity.title,
        description: opportunity.description,
        priority: opportunity.priority,
        completed: recommendedActions.some((action) => action.key === `seo-${opportunity.key}` && action.completed),
      })),
      iamPageBlueprintHints: plan.growthOpportunities.iamPageBlueprintHints,
      customerJourneySuggestions: plan.growthOpportunities.customerJourneySuggestions,
    },
    inotiReadiness: plan.growthOpportunities.recommendedInotiServices.map((service) => ({
      service,
      status: "RECOMMENDED",
      reason: "Prepared as an activation recommendation only. No iNoti provider action has been performed.",
      externalActivation: false,
    })),
    enabledCapabilities: effectiveCapabilities,
    missingSetupItems: plan.ownerOnboardingReadModel.missingSetupItems,
    futureClaimFlow: {
      ownerInvitationPrepared: organization.invitations.length > 0,
      claimRequestsPending: organization.claimRequests.length,
      verificationCreatesMembership: false,
    },
  };
}

export async function updateOwnerBusinessProfile(input: {
  session: SessionWithUser;
  organizationId?: string | null;
  data: OwnerBusinessProfileUpdate;
}) {
  const resolved = await resolveOwnerOrganization(input.session, input.organizationId);
  const data = {
    description: cleanText(input.data.description, 2000),
    address: cleanText(input.data.address, 300),
    phone: cleanText(input.data.phone, 80),
    email: cleanText(input.data.email, 160),
  };

  const organizationBefore = await loadOwnerOrganization(resolved.organizationId);
  await prisma.organization.update({
    where: { id: resolved.organizationId },
    data,
  });

  await generateActivationPlan({
    organizationId: resolved.organizationId,
    generatedByUserId: input.session.user.id,
  });
  await recordActivationEvent({
    organizationId: organizationBefore.id,
    organizationSlug: organizationBefore.slug,
    userId: input.session.user.id,
    entityType: "OrganizationActivation",
    entityId: organizationBefore.id,
    description: "BUSINESS_PROFILE_COMPLETED",
    metadata: { event: "BUSINESS_PROFILE_COMPLETED", fields: Object.keys(data).filter((key) => typeof data[key as keyof typeof data] !== "undefined") },
  });

  return getOwnerActivationDashboard({ session: input.session, organizationId: resolved.organizationId });
}

export async function completeOwnerActivationTask(input: {
  session: SessionWithUser;
  organizationId?: string | null;
  taskKey: string;
}) {
  const resolved = await resolveOwnerOrganization(input.session, input.organizationId);
  const organization = await loadOwnerOrganization(resolved.organizationId);
  const plan = await getActivationPlan({ organizationId: resolved.organizationId });
  await syncActivationTasks({
    organizationId: organization.id,
    activationPlanId: plan.id,
    industryKey: organization.acquisition?.industryKey ?? "OTHER",
    organizationType: organization.type,
    capabilities: activeCapabilityKeys(organization.capabilities),
    actions: plan.recommendedActions,
    completedActions: plan.completedActions,
  });
  const task = await prisma.organizationActivationTask.findUnique({
    where: {
      organizationId_taskKey: {
        organizationId: resolved.organizationId,
        taskKey: input.taskKey,
      },
    },
  });
  if (!task) throw new ApiError(404, "Activation task not found");

  const metadata = serializeTask(task).metadata;
  const activationActionKey = typeof metadata.activationActionKey === "string" ? metadata.activationActionKey : null;
  if (activationActionKey && plan.recommendedActions.some((action) => action.key === activationActionKey)) {
    await completeActivationStep({
      organizationId: resolved.organizationId,
      actionKey: activationActionKey,
      completedByUserId: input.session.user.id,
    });
  }

  const updated = await prisma.organizationActivationTask.update({
    where: { id: task.id },
    data: {
      status: "COMPLETED",
      completedAt: new Date(),
      metadata: {
        ...metadata,
        completedByUserId: input.session.user.id,
        event: "ACTIVATION_TASK_COMPLETED",
      } as Prisma.InputJsonObject,
    },
  });
  const allTasks = await prisma.organizationActivationTask.findMany({
    where: { organizationId: resolved.organizationId },
    select: { status: true },
  });
  await recordActivationEvent({
    organizationId: organization.id,
    organizationSlug: organization.slug,
    userId: input.session.user.id,
    entityType: "OrganizationActivationTask",
    entityId: updated.id,
    description: "ACTIVATION_TASK_COMPLETED",
    metadata: { taskKey: updated.taskKey, status: updated.status },
  });
  await recordActivationEvent({
    organizationId: organization.id,
    organizationSlug: organization.slug,
    userId: input.session.user.id,
    entityType: "OrganizationActivation",
    entityId: plan.id,
    description: "ACTIVATION_PROGRESS_UPDATED",
    metadata: {
      completed: allTasks.filter((entry) => entry.status === "COMPLETED").length,
      total: allTasks.length,
    },
  });

  return getOwnerActivationDashboard({ session: input.session, organizationId: resolved.organizationId });
}

export const completeOwnerActivationStep = completeOwnerActivationTask;
