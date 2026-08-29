import "server-only";

import type { CustomerIdentity, DemoSessionToken, OrderStatus, OrganizationCapabilityKey, Prisma, UserRole } from "@prisma/client";
import { ApiError } from "@/lib/api-guards";
import prisma from "@/lib/db";
import { recordCustomerInteraction } from "@/lib/customer-identity/customer-identity.service";
import { recordBusinessEvent } from "@/lib/integrations/runtime/business-events";
import { requireDemoOrganization } from "@/lib/demo-universe/demo-organization";
import { buildPublicDemoShowcase } from "@/lib/demo-universe/demo-showcase";
import { buildDemoJourneySteps, buildUniversalDemoJourneySteps, type DemoWalkthroughStage } from "@/lib/demo-universe/demo-walkthrough";
import { hasOrganizationCapability } from "@/lib/organization-capabilities";

const ORDER_EVENT_BY_STATUS = {
  ACCEPTED: "ORDER_ACCEPTED",
  PREPARING: "ORDER_PREPARING",
  READY: "ORDER_READY",
  PICKED_UP: "ORDER_OUT_FOR_DELIVERY",
  DELIVERED: "ORDER_COMPLETED",
  RECEIVED: "ORDER_COMPLETED",
} as const satisfies Partial<Record<OrderStatus, Parameters<typeof recordBusinessEvent>[0]["type"]>>;

const DEFAULT_SCENARIO_KEY = "order-to-delivery";

const DEFAULT_SCENARIO_STEPS = [
  {
    key: "customer-place-order",
    title: "مشتری سفارش می‌سازد",
    description: "نقش مشتری یک سفارش نمایشی ثبت می‌کند تا جریان عملیاتی آغاز شود.",
    role: "CUSTOMER",
    action: "CREATE_ORDER",
    sortOrder: 10,
    businessValue: "مشتری از صفحه عمومی وارد جریان عملیاتی می‌شود.",
    relatedCapability: "SHOP",
    artifact: "سفارش demo",
    stage: "DIGITAL_PRESENCE",
  },
  {
    key: "staff-prepare-order",
    title: "کارمند سفارش را آماده می‌کند",
    description: "نقش کارمند سفارش را از صف انتظار به آماده‌سازی منتقل می‌کند.",
    role: "STAFF",
    action: "PREPARE_ORDER",
    sortOrder: 20,
    businessValue: "کار تیم از وضعیت سفارش قابل مدیریت می‌شود.",
    relatedCapability: "SHOP",
    artifact: "صف آماده‌سازی",
    stage: "BUSINESS_OPERATIONS",
  },
  {
    key: "staff-ready-order",
    title: "کارمند سفارش را آماده تحویل می‌کند",
    description: "نقش کارمند سفارش آماده‌شده را برای تحویل علامت‌گذاری می‌کند.",
    role: "STAFF",
    action: "MARK_ORDER_READY",
    sortOrder: 30,
    businessValue: "آماده‌سازی به وضعیت قابل مشاهده برای مشتری و مدیر تبدیل می‌شود.",
    relatedCapability: "CRM",
    artifact: "وضعیت سفارش",
    stage: "BUSINESS_OPERATIONS",
  },
  {
    key: "driver-deliver-order",
    title: "راننده تحویل را کامل می‌کند",
    description: "نقش راننده سفارش را تحویل می‌دهد و وضعیت CRM/رخدادها به‌روز می‌شود.",
    role: "DRIVER",
    action: "DELIVER_ORDER",
    sortOrder: 40,
    businessValue: "تحویل، CRM و تعامل بعدی مشتری در یک مسیر بسته می‌شود.",
    relatedCapability: "CRM",
    artifact: "تحویل و تعامل مشتری",
    stage: "CUSTOMER_ENGAGEMENT",
  },
] as const;

function stepWalkthroughMetadata(step: {
  businessValue?: string;
  relatedCapability?: string;
  artifact?: string;
  stage?: string;
}) {
  return {
    demoUniverse: true,
    source: "default",
    businessValue: step.businessValue,
    relatedCapability: step.relatedCapability,
    artifact: step.artifact,
    stage: step.stage,
  } satisfies Prisma.InputJsonObject;
}

function parseStepMetadata(metadata: Prisma.JsonValue | null) {
  const entry = metadata && typeof metadata === "object" && !Array.isArray(metadata)
    ? metadata as Record<string, unknown>
    : {};
  return {
    businessValue: typeof entry.businessValue === "string" ? entry.businessValue : null,
    relatedCapability: typeof entry.relatedCapability === "string" ? entry.relatedCapability as OrganizationCapabilityKey : null,
    artifact: typeof entry.artifact === "string" ? entry.artifact : null,
    stage: typeof entry.stage === "string" ? entry.stage as DemoWalkthroughStage : null,
  };
}

function assertDemoActionRole(role: UserRole, nextStatus: OrderStatus) {
  const managerStatuses: OrderStatus[] = ["ACCEPTED"];
  const staffStatuses: OrderStatus[] = ["PREPARING", "READY"];
  const driverStatuses: OrderStatus[] = ["PICKED_UP", "DELIVERED", "RECEIVED"];
  if (managerStatuses.includes(nextStatus) && !["MANAGER", "ADMIN", "SUPER_ADMIN"].includes(role)) throw new ApiError(403, "Manager role required");
  if (staffStatuses.includes(nextStatus) && !["STAFF", "MANAGER", "ADMIN", "SUPER_ADMIN"].includes(role)) throw new ApiError(403, "Staff role required");
  if (driverStatuses.includes(nextStatus) && !["DRIVER", "MANAGER", "ADMIN", "SUPER_ADMIN"].includes(role)) throw new ApiError(403, "Driver role required");
}

async function findOrderCustomerIdentity(organizationId: string, order: { id: string; customerId?: string | null; guestCustomerId?: string | null }) {
  const linkedIdentity = order.customerId || order.guestCustomerId
    ? await prisma.customerIdentity.findFirst({
    where: {
      organizationId,
      OR: [
        order.customerId ? { userId: order.customerId } : undefined,
        order.guestCustomerId ? { guestCustomerId: order.guestCustomerId } : undefined,
      ].filter((condition): condition is Exclude<typeof condition, undefined> => condition !== undefined),
    },
      })
    : null;
  if (linkedIdentity) return linkedIdentity;
  const existingOrderEvent = await prisma.businessEvent.findFirst({
    where: {
      organizationId,
      entityType: "Order",
      entityId: order.id,
      customerIdentityId: { not: null },
    },
    orderBy: { occurredAt: "asc" },
    include: { customerIdentity: true },
  });
  return existingOrderEvent?.customerIdentity ?? null;
}

async function emitOrderDemoEvent(input: {
  organizationId: string;
  orderId: string;
  orderNumber: string;
  status: OrderStatus;
  customerIdentity?: CustomerIdentity | null;
}) {
  const type = ORDER_EVENT_BY_STATUS[input.status] ?? "ORDER_CREATED";
  const event = await recordBusinessEvent({
    organizationId: input.organizationId,
    customerIdentityId: input.customerIdentity?.id ?? null,
    type,
    entityType: "Order",
    entityId: input.orderId,
    payload: { orderNumber: input.orderNumber, status: input.status },
    metadata: { demoUniverse: true },
  });
  if (input.customerIdentity) {
    await recordCustomerInteraction({
      organizationId: input.organizationId,
      customerIdentityId: input.customerIdentity.id,
      businessEventId: event.id,
      type,
      entityType: "Order",
      entityId: input.orderId,
      summary: `Demo order ${input.orderNumber} moved to ${input.status}`,
      metadata: { demoUniverse: true },
    });
  }
  return event;
}

export async function transitionDemoOrder(input: {
  organizationId: string;
  orderId: string;
  actorRole: UserRole;
  nextStatus: OrderStatus;
}) {
  await requireDemoOrganization(input.organizationId);
  assertDemoActionRole(input.actorRole, input.nextStatus);
  const organization = await prisma.organization.findUnique({
    where: { id: input.organizationId },
    select: { slug: true },
  });
  if (!organization) throw new ApiError(404, "Organization not found");
  const order = await prisma.order.findFirst({
    where: { id: input.orderId, organizationSlug: organization.slug },
  });
  if (!order) throw new ApiError(404, "Order not found");
  const customerIdentity = await findOrderCustomerIdentity(input.organizationId, order);
  const updated = await prisma.order.update({
    where: { id: order.id },
    data: { status: input.nextStatus },
  });
  await prisma.orderStatusHistory.create({
    data: {
      orderId: order.id,
      previousStatus: order.status,
      newStatus: input.nextStatus,
      note: "Demo Universe transition",
    },
  });
  await emitOrderDemoEvent({
    organizationId: input.organizationId,
    orderId: order.id,
    orderNumber: order.orderNumber,
    status: input.nextStatus,
    customerIdentity,
  });
  return updated;
}

export async function ensureDefaultDemoScenario(organizationId: string) {
  const { organization } = await requireDemoOrganization(organizationId);
  const showcase = buildPublicDemoShowcase({ organization, settings: organization.settings?.settings });
  const scenarioKey = showcase ? "featured-showcase-journey" : DEFAULT_SCENARIO_KEY;
  const scenarioTitle = showcase?.tagline ?? "سفارش تا تحویل";
  const scenarioDescription = showcase
    ? showcase.highlights.join(" | ")
    : "یک مسیر نمایشی برای تجربه چندنقشی Bazarbaaz از ثبت سفارش تا تحویل.";
  const scenarioSteps = showcase
    ? showcase.storySteps.map((step) => ({
        key: step.key,
        title: step.title,
        description: step.description,
        role: step.role,
        action: step.action,
        sortOrder: step.sortOrder,
        businessValue: step.businessValue,
        relatedCapability: step.relatedCapability,
        artifact: step.artifact,
        stage: step.stage,
      }))
    : DEFAULT_SCENARIO_STEPS;
  const scenario = await prisma.demoScenario.upsert({
    where: { organizationId_key: { organizationId, key: scenarioKey } },
    update: {
      title: scenarioTitle,
      description: scenarioDescription,
      isActive: true,
      metadata: { demoUniverse: true, source: showcase ? "showcase-settings" : "default" } satisfies Prisma.InputJsonObject,
    },
    create: {
      organizationId,
      key: scenarioKey,
      title: scenarioTitle,
      description: scenarioDescription,
      metadata: { demoUniverse: true, source: showcase ? "showcase-settings" : "default" } satisfies Prisma.InputJsonObject,
    },
  });

  for (const step of scenarioSteps) {
    await prisma.demoScenarioStep.upsert({
      where: { scenarioId_key: { scenarioId: scenario.id, key: step.key } },
      update: {
        title: step.title,
        description: step.description,
        role: step.role,
        action: step.action,
        sortOrder: step.sortOrder,
        metadata: stepWalkthroughMetadata(step),
      },
      create: {
        scenarioId: scenario.id,
        key: step.key,
        title: step.title,
        description: step.description,
        role: step.role,
        action: step.action,
        sortOrder: step.sortOrder,
        metadata: stepWalkthroughMetadata(step),
      },
    });
  }

  return scenario;
}

export async function getDemoScenario(input: {
  organizationId: string;
  session?: DemoSessionToken | null;
}) {
  const scenario = await ensureDefaultDemoScenario(input.organizationId);
  const [steps, progress] = await Promise.all([
    prisma.demoScenarioStep.findMany({
      where: { scenarioId: scenario.id },
      orderBy: { sortOrder: "asc" },
    }),
    input.session
      ? prisma.demoProgress.findMany({
          where: { scenarioId: scenario.id, sessionId: input.session.id, completedAt: { not: null } },
          select: { stepId: true, completedAt: true },
        })
      : Promise.resolve([]),
  ]);
  const progressByStepId = new Map(progress.map((entry) => [entry.stepId, entry.completedAt]));
  const stepSummaries = steps.map((step) => {
    const metadata = parseStepMetadata(step.metadata);
    return {
      id: step.publicId,
      key: step.key,
      title: step.title,
      description: step.description,
      role: step.role,
      action: step.action,
      completedAt: progressByStepId.get(step.id)?.toISOString() ?? null,
      ...metadata,
    };
  });
  return {
    id: scenario.publicId,
    key: scenario.key,
    title: scenario.title,
    description: scenario.description,
    steps: stepSummaries,
    scenarioJourneySteps: buildDemoJourneySteps({
      steps: stepSummaries,
      currentRole: input.session?.demoRole ?? input.session?.role ?? null,
    }),
    journeySteps: buildUniversalDemoJourneySteps({
      steps: stepSummaries,
      currentRole: input.session?.demoRole ?? input.session?.role ?? null,
    }),
  };
}

export async function completeDemoScenarioStep(input: {
  organizationId: string;
  session: DemoSessionToken;
  stepKey: string;
  metadata?: Prisma.InputJsonObject;
}) {
  const scenario = await ensureDefaultDemoScenario(input.organizationId);
  const step = await prisma.demoScenarioStep.findUnique({
    where: { scenarioId_key: { scenarioId: scenario.id, key: input.stepKey } },
  });
  if (!step) return null;
  const existing = await prisma.demoProgress.findFirst({
    where: {
      scenarioId: scenario.id,
      stepId: step.id,
      sessionId: input.session.id,
    },
  });
  if (existing) {
    return prisma.demoProgress.update({
      where: { id: existing.id },
      data: {
        demoRole: input.session.demoRole ?? input.session.role,
        completedAt: existing.completedAt ?? new Date(),
        metadata: input.metadata ?? existing.metadata ?? undefined,
      },
    });
  }
  return prisma.demoProgress.create({
    data: {
      organizationId: input.organizationId,
      scenarioId: scenario.id,
      stepId: step.id,
      sessionId: input.session.id,
      demoRole: input.session.demoRole ?? input.session.role,
      completedAt: new Date(),
      metadata: input.metadata,
    },
  });
}

export async function getDemoBusinessState(organizationId: string) {
  const { organization, demo } = await requireDemoOrganization(organizationId);
  const [ordersByStatus, recentEvents, readiness] = await Promise.all([
    prisma.order.groupBy({
      by: ["status"],
      where: { organizationSlug: organization.slug },
      _count: { _all: true },
    }),
    prisma.businessEvent.findMany({
      where: { organizationId },
      orderBy: { occurredAt: "desc" },
      take: 20,
    }),
    getIntegrationShowcaseReadiness(organizationId),
  ]);
  return { demo, ordersByStatus, recentEvents, readiness };
}

export async function listDemoDriverDeliveries(input: {
  organizationId: string;
  driverId?: string | null;
}) {
  const { organization } = await requireDemoOrganization(input.organizationId);
  return prisma.order.findMany({
    where: {
      organizationSlug: organization.slug,
      ...(input.driverId ? { driverId: input.driverId } : {}),
      status: { in: ["READY", "PICKED_UP"] },
    },
    orderBy: { updatedAt: "desc" },
  });
}

export async function getIntegrationShowcaseReadiness(organizationId: string) {
  const { organization } = await requireDemoOrganization(organizationId);
  const integrations = organization.integrations;
  const hasCapability = (capability: Parameters<typeof hasOrganizationCapability>[1]) =>
    hasOrganizationCapability({
      legacyType: organization.type,
      capabilitiesInitializedAt: organization.capabilitiesInitializedAt,
      capabilities: organization.capabilities,
    }, capability);
  return {
    iMenu: { ready: hasCapability("SHOP"), integrationConfigured: integrations.some((integration) => integration.provider === "INOTI_IMENU") },
    iCV: { ready: hasCapability("ICV"), integrationConfigured: integrations.some((integration) => integration.provider === "INOTI_ICV") },
    iAM: { ready: hasCapability("IAM"), integrationConfigured: integrations.some((integration) => integration.provider === "INOTI_IAM") },
    ebc: { ready: hasCapability("CRM") || hasCapability("EBC"), integrationConfigured: integrations.some((integration) => integration.provider === "INOTI_EBC") },
    ussd: { ready: hasCapability("USSD"), integrationConfigured: integrations.some((integration) => integration.provider === "INOTI_USSD") },
  };
}
