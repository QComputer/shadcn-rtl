import "server-only";

import type { DemoSessionToken } from "@prisma/client";
import prisma from "@/lib/db";
import { listOrganizationCustomers } from "@/lib/customer-crm/customer-crm.service";
import { getCustomerSummary } from "@/lib/customer-crm/customer-summary.service";
import { resolveCustomerIdentity } from "@/lib/customer-identity/customer-identity.service";
import {
  getDemoBusinessState,
  listDemoDriverDeliveries,
} from "@/lib/demo-universe/demo-scenario.service";
import { getHomepageData, listPublicDemoOrganizations } from "@/lib/demo-universe/demo-public.service";
import { analyzeOrganizationEntity } from "@/lib/seo-intelligence/seo-intelligence.service";
import { getDemoSeoContentReadiness, listSeoContentRequests } from "@/lib/seo-content/seo-content.service";

export async function resolveDemoSessionCustomerIdentity(input: {
  organizationId: string;
  session: DemoSessionToken;
}) {
  return resolveCustomerIdentity({
    organizationId: input.organizationId,
    email: `demo-${input.session.publicId}@demo.bazarbaaz.local`,
    externalIdentifiers: { demoSessionPublicId: input.session.publicId },
    metadata: { demoUniverse: true, role: input.session.role },
  });
}

export async function getDemoCustomerDashboard(input: {
  organizationId: string;
  organizationSlug: string;
  session: DemoSessionToken;
}) {
  const identity = await resolveDemoSessionCustomerIdentity(input);
  const [orders, summary] = await Promise.all([
    prisma.order.findMany({
      where: {
        organizationSlug: input.organizationSlug,
        status: { notIn: ["DELIVERED", "RECEIVED", "CANCELLED", "REFUNDED"] },
      },
      orderBy: { updatedAt: "desc" },
      take: 10,
    }),
    getCustomerSummary({ organizationId: input.organizationId, customerIdentityId: identity.id }),
  ]);
  return {
    role: "CUSTOMER",
    identity: summary.identity,
    activeOrders: orders,
    recentInteractions: summary.recentInteractions,
    loyalty: {
      activityScore: summary.metrics.customerActivityScore,
      repeatCustomer: summary.metrics.repeatCustomer,
    },
    availableActions: ["CREATE_ORDER"],
  };
}

export async function getDemoManagerDashboard(input: {
  organizationId: string;
}) {
  const [businessState, customers, seoIntelligence, seoContentRequests] = await Promise.all([
    getDemoBusinessState(input.organizationId),
    listOrganizationCustomers({ organizationId: input.organizationId, pageSize: 10 }),
    analyzeOrganizationEntity(input.organizationId),
    listSeoContentRequests({ organizationId: input.organizationId }),
  ]);
  return {
    role: "MANAGER",
    salesSummary: { demoOnly: true },
    ordersSummary: businessState.ordersByStatus,
    customerMetrics: {
      totalCustomers: customers.total,
    },
    integrationsReadiness: businessState.readiness,
    seoIntelligence: {
      indexedCount: seoIntelligence.indexedCount,
      relationTypes: seoIntelligence.graph.relationTypes,
      schemaHintTypes: Array.from(new Set(seoIntelligence.schemaHints.map((hint) => hint.schemaType))),
      openOpportunityTypes: Array.from(new Set(seoIntelligence.opportunities.map((opportunity) => opportunity.opportunityType))),
    },
    seoContentWorkflow: {
      requestCount: seoContentRequests.length,
      requestStatuses: Array.from(new Set(seoContentRequests.map((request) => request.status))),
      reviewRequiredAssets: seoContentRequests.reduce((count, request) => (
        count + request.contentAssets.filter((asset) => asset.status === "REVIEW_REQUIRED").length
      ), 0),
    },
    recentEvents: businessState.recentEvents,
    availableActions: ["RUN_DEMO_CAMPAIGN"],
  };
}

export async function getDemoPlatformDashboard() {
  const [homepage, demoOrganizations, seoContentReadiness] = await Promise.all([
    getHomepageData(),
    listPublicDemoOrganizations(),
    getDemoSeoContentReadiness(),
  ]);
  return {
    role: "PLATFORM_ADMIN",
    homepage,
    tenantCount: demoOrganizations.length,
    demoOrganizations,
    seoContentReadiness,
    availableActions: ["COMPARE_TENANTS", "VIEW_ECOSYSTEM"],
  };
}

export async function getDemoStaffDashboard(input: {
  organizationSlug: string;
}) {
  const pendingWork = await prisma.order.findMany({
    where: {
      organizationSlug: input.organizationSlug,
      status: { in: ["PLACED", "ACCEPTED", "PREPARING"] },
    },
    orderBy: { updatedAt: "desc" },
    take: 20,
  });
  return {
    role: "STAFF",
    pendingWork,
    availableActions: ["PREPARE_ORDER", "MARK_ORDER_READY"],
  };
}

export async function getDemoDriverDashboard(input: {
  organizationId: string;
}) {
  return {
    role: "DRIVER",
    assignedDeliveries: await listDemoDriverDeliveries({ organizationId: input.organizationId }),
    availableActions: ["DELIVER_ORDER"],
  };
}
