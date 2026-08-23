import "server-only";

import prisma from "@/lib/db";
import { parseDemoSettings } from "@/lib/demo-universe/demo-organization";
import { buildPublicDemoShowcase } from "@/lib/demo-universe/demo-showcase";
import { FEATURED_DEMO_SHOWCASE_SLUGS } from "@/lib/demo-universe/demo-showcase-blueprints";
import { getIntegrationShowcaseReadiness } from "@/lib/demo-universe/demo-scenario.service";
import { effectiveOrganizationCapabilities } from "@/lib/organization-capabilities";
import { isRealPilotBusinessSlug } from "@/lib/pilot-operations/real-pilot-businesses";
import { getHomepageBackendContract } from "@/lib/public-experience/homepage-contract";
import { listPlatformFeatureCapabilities, listPlatformFeatures } from "@/lib/public-experience/platform-features";

export async function listPublicDemoOrganizations() {
  const organizations = await prisma.organization.findMany({
    where: { isActive: true, deletedAt: null },
    include: {
      settings: { select: { settings: true } },
      capabilities: { select: { key: true, status: true } },
      integrations: { select: { provider: true, type: true, status: true, healthStatus: true } },
    },
    orderBy: { name: "asc" },
  });

  const demoOrganizations = organizations.filter((organization) =>
    !isRealPilotBusinessSlug(organization.slug) &&
    parseDemoSettings(organization.settings?.settings).enabled,
  );

  return Promise.all(demoOrganizations.map(async (organization) => {
    const demo = parseDemoSettings(organization.settings?.settings);
    const showcase = buildPublicDemoShowcase({ organization, settings: organization.settings?.settings });
    return {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      locale: organization.locale,
      logo: organization.logo,
      coverImage: organization.coverImage,
      description: organization.description,
      capabilities: effectiveOrganizationCapabilities({
        legacyType: organization.type,
        capabilitiesInitializedAt: organization.capabilitiesInitializedAt,
        capabilities: organization.capabilities,
      }),
      demoRoles: demo.roles,
      showcase,
      integrations: await getIntegrationShowcaseReadiness(organization.id),
    };
  }));
}

export async function listPublicDemoShowcases() {
  const organizations = await prisma.organization.findMany({
    where: { isActive: true, deletedAt: null },
    include: {
      settings: { select: { settings: true } },
    },
  });
  const order = new Map(FEATURED_DEMO_SHOWCASE_SLUGS.map((slug, index) => [slug, index]));
  return organizations
    .flatMap((organization) => {
      const demo = parseDemoSettings(organization.settings?.settings);
      if (!demo.enabled || isRealPilotBusinessSlug(organization.slug)) return [];
      const showcase = buildPublicDemoShowcase({ organization, settings: organization.settings?.settings });
      return showcase ? [showcase] : [];
    })
    .sort((a, b) => (order.get(a.organization.slug) ?? 999) - (order.get(b.organization.slug) ?? 999));
}

export async function getPublicDemoShowcaseBySlug(slug: string) {
  const organization = await prisma.organization.findFirst({
    where: { slug, isActive: true, deletedAt: null },
    include: { settings: { select: { settings: true } } },
  });
  if (!organization) return null;
  const demo = parseDemoSettings(organization.settings?.settings);
  if (!demo.enabled || isRealPilotBusinessSlug(organization.slug)) return null;
  return buildPublicDemoShowcase({ organization, settings: organization.settings?.settings });
}

export async function getHomepageData() {
  const demoOrganizations = await listPublicDemoOrganizations();
  return {
    hero: {
      titleKey: "homepage.demoUniverse.hero.title",
      descriptionKey: "homepage.demoUniverse.hero.description",
      primaryActionKey: "homepage.demoUniverse.hero.primaryAction",
    },
    platformFeatures: listPlatformFeatures(),
    demoHighlights: demoOrganizations.slice(0, 4),
    demoOrganizations,
    supportedCapabilities: listPlatformFeatureCapabilities(),
    integrationEcosystem: [
      { key: "iMenu", provider: "INOTI_IMENU", capability: "SHOP" },
      { key: "iCV", provider: "INOTI_ICV", capability: "ICV" },
      { key: "iAM", provider: "INOTI_IAM", capability: "IAM" },
      { key: "EBC", provider: "INOTI_EBC", capability: "EBC" },
      { key: "USSD", provider: "INOTI_USSD", capability: "USSD" },
    ],
    homepageContract: getHomepageBackendContract(),
  };
}
