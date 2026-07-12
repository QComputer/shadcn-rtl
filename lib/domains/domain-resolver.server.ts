import { normalizeDomainHost, type CustomDomainLocale } from "@/lib/custom-domain-routing";

export type ResolvedTenant = {
  slug: string;
  locale: CustomDomainLocale;
  organizationId: string;
  organizationType: "SHOP" | "APPOINTMENT";
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
  };
}
