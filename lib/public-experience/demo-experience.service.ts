import "server-only";

import prisma from "@/lib/db";
import { parseDemoSettings } from "@/lib/demo-universe/demo-organization";
import { listPublicDemoOrganizations, listPublicDemoShowcases } from "@/lib/demo-universe/demo-public.service";
import { DEMO_STORY_STEPS } from "@/lib/public-experience/demo-storytelling";
import { getHomepageBackendContract } from "@/lib/public-experience/homepage-contract";
import { listPlatformFeatureCapabilities, listPlatformFeatures } from "@/lib/public-experience/platform-features";

export const DEMO_JOURNEYS = [
  { key: "customer", title: "Customer journey", role: "CUSTOMER", route: "/demo?role=CUSTOMER", ordering: 10 },
  { key: "manager", title: "Manager journey", role: "MANAGER", route: "/demo?role=MANAGER", ordering: 20 },
  { key: "staff", title: "Staff journey", role: "STAFF", route: "/demo?role=STAFF", ordering: 30 },
  { key: "driver", title: "Driver journey", role: "DRIVER", route: "/demo?role=DRIVER", ordering: 40 },
  { key: "platform-admin", title: "Platform admin journey", role: "PLATFORM_ADMIN", route: "/demo?role=PLATFORM_ADMIN", ordering: 50 },
] as const;

export async function getDemoPlatformAnalytics() {
  const organizations = await prisma.organization.findMany({
    where: { isActive: true, deletedAt: null },
    select: {
      id: true,
      settings: { select: { settings: true } },
      capabilities: { where: { status: "ACTIVE" }, select: { key: true } },
    },
  });
  const demoOrganizationIds = organizations
    .filter((organization) => parseDemoSettings(organization.settings?.settings).enabled)
    .map((organization) => organization.id);

  if (demoOrganizationIds.length === 0) {
    return {
      demoBusinessCount: 0,
      capabilitiesDemonstrated: [],
      integrationsAvailable: 0,
      seoOpportunitiesDetected: 0,
      contentWorkflowStatus: {},
      crmActivitySimulation: { customerIdentities: 0, interactions: 0 },
    };
  }

  const [
    integrationsAvailable,
    seoOpportunitiesDetected,
    contentRequestsByStatus,
    customerIdentities,
    interactions,
  ] = await Promise.all([
    prisma.organizationIntegration.count({ where: { organizationId: { in: demoOrganizationIds } } }),
    prisma.seoOpportunity.count({ where: { organizationId: { in: demoOrganizationIds } } }),
    prisma.seoContentRequest.groupBy({
      by: ["status"],
      where: { organizationId: { in: demoOrganizationIds } },
      _count: { _all: true },
    }),
    prisma.customerIdentity.count({ where: { organizationId: { in: demoOrganizationIds } } }),
    prisma.customerInteraction.count({ where: { organizationId: { in: demoOrganizationIds } } }),
  ]);

  return {
    demoBusinessCount: demoOrganizationIds.length,
    capabilitiesDemonstrated: Array.from(new Set(
      organizations
        .filter((organization) => demoOrganizationIds.includes(organization.id))
        .flatMap((organization) => organization.capabilities.map((capability) => capability.key)),
    )),
    integrationsAvailable,
    seoOpportunitiesDetected,
    contentWorkflowStatus: Object.fromEntries(contentRequestsByStatus.map((entry) => [entry.status, entry._count._all])),
    crmActivitySimulation: { customerIdentities, interactions },
  };
}

export async function getPublicDemoExperience() {
  const [demoOrganizations, demoShowcases, platformAnalytics] = await Promise.all([
    listPublicDemoOrganizations(),
    listPublicDemoShowcases(),
    getDemoPlatformAnalytics(),
  ]);

  return {
    platformFeatures: listPlatformFeatures(),
    demoOrganizations: demoOrganizations.map((organization) => ({
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      locale: organization.locale,
      logo: organization.logo,
      coverImage: organization.coverImage,
      description: organization.description,
      capabilities: organization.capabilities,
      demoRoles: organization.demoRoles,
      showcase: organization.showcase,
      demoLinks: {
        publicProfile: `/${organization.locale}/organization/${organization.slug}`,
        session: `/api/public/demo/${organization.slug}/session`,
      },
    })),
    demoShowcases,
    journeys: DEMO_JOURNEYS,
    capabilities: listPlatformFeatureCapabilities(),
    storytelling: DEMO_STORY_STEPS,
    investorReadiness: platformAnalytics,
    homepageContract: getHomepageBackendContract(),
    safety: {
      demoOnly: true,
      externalProviderCalls: false,
      exposesPrivateTenantData: false,
    },
  };
}
