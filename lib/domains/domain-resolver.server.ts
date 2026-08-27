import { normalizeDomainHost, type CustomDomainLocale } from "@/lib/custom-domain-routing";
import { activePublicBusinessCapabilities, resolveOrganizationPublicHome, type OrganizationPublicHome } from "@/lib/organization-public-home";
import type { OrganizationCapabilityKey } from "@prisma/client";

export type ResolvedTenant = {
  slug: string;
  locale: CustomDomainLocale;
  organizationId: string;
  organizationType: "SHOP" | "APPOINTMENT";
  capabilities: OrganizationCapabilityKey[];
  publicHomeMode?: string | null;
  brandLandingProvider?: string | null;
  publicHome: OrganizationPublicHome;
};

export type ResolverPrismaLike = {
  organizationDomain: {
    findUnique: (args: any) => Promise<any>;
  };
};

const supportedLocales = new Set<CustomDomainLocale>(["fa", "en", "ar"]);

export function toSupportedLocale(value: string | null | undefined): CustomDomainLocale {
  return supportedLocales.has(value as CustomDomainLocale) ? (value as CustomDomainLocale) : "fa";
}

export async function resolveActiveTenantForHost(
  prisma: ResolverPrismaLike,
  host: string | null | undefined,
): Promise<ResolvedTenant | null> {
  const normalizedHost = normalizeDomainHost(host);
  if (!normalizedHost) return null;

  const domain = await prisma.organizationDomain.findUnique({
    where: { normalizedDomain: normalizedHost },
    select: {
      normalizedDomain: true,
      status: true,
      organization: {
        select: {
          id: true,
          slug: true,
          locale: true,
          type: true,
          capabilitiesInitializedAt: true,
          capabilities: { select: { key: true, status: true } },
          settings: { select: { settings: true, publicHomeMode: true, brandLandingProvider: true } },
          isActive: true,
          deletedAt: true,
        },
      },
    },
  });

  if (
    !domain ||
    domain.status !== "ACTIVE" ||
    !domain.organization.isActive ||
    domain.organization.deletedAt
  ) {
    return null;
  }

  return {
    slug: domain.organization.slug,
    locale: toSupportedLocale(domain.organization.locale),
    organizationId: domain.organization.id,
    organizationType: domain.organization.type,
    capabilities: activePublicBusinessCapabilities(domain.organization.capabilities),
    publicHomeMode: domain.organization.settings?.publicHomeMode ?? null,
    brandLandingProvider: domain.organization.settings?.brandLandingProvider ?? null,
    publicHome: resolveOrganizationPublicHome({
      capabilities: domain.organization.capabilities,
      settings: domain.organization.settings?.settings,
      publicHomeMode: domain.organization.settings?.publicHomeMode ?? undefined,
      brandLandingProvider: domain.organization.settings?.brandLandingProvider ?? undefined,
    }),
  };
}
