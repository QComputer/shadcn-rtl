import type { OrganizationCapabilityKey } from "@prisma/client";
import type { DemoRole } from "@/lib/public-experience/types";

export type DemoWalkthroughStage =
  | "DIGITAL_PRESENCE"
  | "BUSINESS_OPERATIONS"
  | "CUSTOMER_INTELLIGENCE"
  | "GROWTH_INTELLIGENCE"
  | "CUSTOMER_ENGAGEMENT";

export type DemoJourneyStepState = "LOCKED" | "AVAILABLE" | "COMPLETED";

export type DemoJourneyStepInput = {
  id?: string;
  key: string;
  title: string;
  description: string | null;
  role: string;
  action: string | null;
  completedAt?: string | null;
  sortOrder?: number;
  businessValue?: string | null;
  relatedCapability?: OrganizationCapabilityKey | null;
  artifact?: string | null;
  stage?: DemoWalkthroughStage | null;
};

export type DemoJourneyStep = {
  id?: string;
  key: string;
  title: string;
  description: string | null;
  role: string;
  action: string | null;
  completedAt: string | null;
  state: DemoJourneyStepState;
  businessValue: string;
  relatedCapability: OrganizationCapabilityKey | null;
  artifact: string;
  stage: DemoWalkthroughStage;
  visibleForRole: boolean;
};

export type DemoPresentationPanels = {
  businessGrowth: {
    seoOpportunities: number;
    contentReadiness: number;
    customerEngagement: number;
  };
  operations: {
    activeOrders: number;
    appointments: number;
    staffWorkflowItems: number;
  };
  customerIntelligence: {
    customers: number;
    interactions: number;
    loyaltySignals: number;
  };
  integrationReadiness: {
    iMenu: boolean;
    iAM: boolean;
    iCV: boolean;
    ebc: boolean;
    ussd: boolean;
  };
};

export const UNIVERSAL_BAZARBAAZ_JOURNEY = [
  {
    stage: "DIGITAL_PRESENCE",
    title: "Digital Presence",
    description: "صفحه عمومی، محصولات/خدمات و دسته‌بندی‌ها از مدل واقعی کسب‌وکار ساخته می‌شود.",
    relatedCapability: "SHOP",
    artifact: "Public page + catalog",
    businessValue: "کسب‌وکار در چند دقیقه قابل معرفی، جست‌وجو و اشتراک می‌شود.",
  },
  {
    stage: "BUSINESS_OPERATIONS",
    title: "Business Operations",
    description: "سفارش، نوبت، آماده‌سازی و کار تیم در یک جریان عملیاتی قابل پیگیری قرار می‌گیرد.",
    relatedCapability: "APPOINTMENT",
    artifact: "Orders, appointments, staff workflow",
    businessValue: "عملیات روزانه از پیام و فایل جدا می‌شود و در داشبورد قابل مدیریت است.",
  },
  {
    stage: "CUSTOMER_INTELLIGENCE",
    title: "Customer Intelligence",
    description: "رفتار مشتری، سفارش‌ها، مراجعه‌ها و تعاملات به پروفایل CRM نمایشی وصل می‌شود.",
    relatedCapability: "CRM",
    artifact: "CRM profile + interactions",
    businessValue: "هر تعامل به شناخت مشتری و فرصت بازگشت تبدیل می‌شود.",
  },
  {
    stage: "GROWTH_INTELLIGENCE",
    title: "Growth Intelligence",
    description: "گراف موجودیت، فرصت‌های SEO و جریان محتوای قابل انتشار روی داده‌های demo نشان داده می‌شود.",
    relatedCapability: "CRM",
    artifact: "SEO opportunities + content workflow",
    businessValue: "رشد عمومی و محتوایی از داده عملیاتی تغذیه می‌کند.",
  },
  {
    stage: "CUSTOMER_ENGAGEMENT",
    title: "Customer Engagement",
    description: "کمپین، وفاداری و آمادگی اکوسیستم iNoti/USSD به صورت dry-run نمایش داده می‌شود.",
    relatedCapability: "USSD",
    artifact: "Campaign + iNoti readiness",
    businessValue: "کسب‌وکار مسیر ارتباط و بازگشت مشتری را بدون تماس خارجی واقعی می‌بیند.",
  },
] as const satisfies ReadonlyArray<{
  stage: DemoWalkthroughStage;
  title: string;
  description: string;
  relatedCapability: OrganizationCapabilityKey;
  artifact: string;
  businessValue: string;
}>;

const DEFAULT_BY_STAGE = new Map(UNIVERSAL_BAZARBAAZ_JOURNEY.map((step) => [step.stage, step]));

export function buildDemoJourneySteps(input: {
  steps: DemoJourneyStepInput[];
  currentRole?: DemoRole | string | null;
}): DemoJourneyStep[] {
  let firstOpenAssigned = false;
  return input.steps.map((step) => {
    const stage = step.stage ?? "BUSINESS_OPERATIONS";
    const universal = DEFAULT_BY_STAGE.get(stage) ?? UNIVERSAL_BAZARBAAZ_JOURNEY[1];
    const completedAt = step.completedAt ?? null;
    const state: DemoJourneyStepState = completedAt
      ? "COMPLETED"
      : firstOpenAssigned
        ? "LOCKED"
        : "AVAILABLE";
    if (!completedAt && !firstOpenAssigned) firstOpenAssigned = true;
    return {
      id: step.id,
      key: step.key,
      title: step.title,
      description: step.description,
      role: step.role,
      action: step.action,
      completedAt,
      state,
      businessValue: step.businessValue || universal.businessValue,
      relatedCapability: step.relatedCapability ?? universal.relatedCapability,
      artifact: step.artifact || universal.artifact,
      stage,
      visibleForRole: !input.currentRole || step.role === input.currentRole || input.currentRole === "ORGANIZATION_OWNER" || input.currentRole === "PLATFORM_ADMIN",
    };
  });
}

export function buildUniversalDemoJourneySteps(input: {
  steps: DemoJourneyStepInput[];
  currentRole?: DemoRole | string | null;
}): DemoJourneyStep[] {
  const scenarioJourney = buildDemoJourneySteps(input);
  let firstOpenAssigned = false;

  return UNIVERSAL_BAZARBAAZ_JOURNEY.map((universal, index) => {
    const stageSteps = scenarioJourney.filter((step) => step.stage === universal.stage);
    const representative = stageSteps[0];
    const hasCompletedStage = stageSteps.length > 0 && stageSteps.every((step) => step.state === "COMPLETED");
    const state: DemoJourneyStepState = hasCompletedStage
      ? "COMPLETED"
      : firstOpenAssigned
        ? "LOCKED"
        : "AVAILABLE";
    if (!hasCompletedStage && !firstOpenAssigned) firstOpenAssigned = true;

    return {
      id: representative?.id,
      key: `universal-${universal.stage.toLowerCase()}`,
      title: universal.title,
      description: representative?.description ?? universal.description,
      role: representative?.role ?? "ALL",
      action: representative?.action ?? null,
      completedAt: hasCompletedStage ? (stageSteps.at(-1)?.completedAt ?? null) : null,
      state,
      businessValue: representative?.businessValue ?? universal.businessValue,
      relatedCapability: representative?.relatedCapability ?? universal.relatedCapability,
      artifact: representative?.artifact ?? universal.artifact,
      stage: universal.stage,
      visibleForRole: stageSteps.length === 0 || stageSteps.some((step) => step.visibleForRole),
    };
  });
}

function arrayLength(value: unknown) {
  return Array.isArray(value) ? value.length : 0;
}

function numberFromGroup(value: unknown) {
  if (!Array.isArray(value)) return 0;
  return value.reduce((sum, item) => {
    if (!item || typeof item !== "object") return sum;
    const entry = item as { _count?: { _all?: number } };
    return sum + (entry._count?._all ?? 0);
  }, 0);
}

export function buildDemoPresentationPanels(payload: Record<string, unknown> | null): DemoPresentationPanels {
  const integrations = (payload?.integrationsReadiness ?? {}) as Record<string, { ready?: boolean }>;
  const seo = (payload?.seoIntelligence ?? {}) as {
    openOpportunityTypes?: unknown[];
    indexedCount?: number;
  };
  const workflow = (payload?.seoContentWorkflow ?? {}) as {
    requestCount?: number;
    reviewRequiredAssets?: number;
  };
  const customerMetrics = (payload?.customerMetrics ?? {}) as { totalCustomers?: number };
  const loyalty = (payload?.loyalty ?? {}) as { activityScore?: number; repeatCustomer?: boolean };

  return {
    businessGrowth: {
      seoOpportunities: arrayLength(seo.openOpportunityTypes),
      contentReadiness: (workflow.requestCount ?? 0) + (workflow.reviewRequiredAssets ?? 0),
      customerEngagement: arrayLength(payload?.recentEvents),
    },
    operations: {
      activeOrders: arrayLength(payload?.activeOrders) + numberFromGroup(payload?.ordersSummary),
      appointments: arrayLength(payload?.appointments),
      staffWorkflowItems: arrayLength(payload?.pendingWork) + arrayLength(payload?.assignedDeliveries),
    },
    customerIntelligence: {
      customers: customerMetrics.totalCustomers ?? (payload?.identity ? 1 : 0),
      interactions: arrayLength(payload?.recentInteractions) + arrayLength(payload?.recentEvents),
      loyaltySignals: (loyalty.activityScore ?? 0) + (loyalty.repeatCustomer ? 1 : 0),
    },
    integrationReadiness: {
      iMenu: integrations.iMenu?.ready === true,
      iAM: integrations.iAM?.ready === true,
      iCV: integrations.iCV?.ready === true,
      ebc: integrations.ebc?.ready === true,
      ussd: integrations.ussd?.ready === true,
    },
  };
}
