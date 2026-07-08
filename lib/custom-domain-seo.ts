import { headers } from "next/headers";
import prisma from "@/lib/db";
import {
  buildTenantPublicPath,
  defaultCustomDomainLocale,
  isSupportedCustomDomainLocale,
  type CustomDomainLocale,
} from "@/lib/custom-domain-routing";

export type TenantSeoContext = {
  isCustomDomain: boolean;
  baseUrl?: string;
  path: string;
  alternatePath: (locale: CustomDomainLocale) => string;
};

const ORGANIZATION_PATHS = {
  SHOP: (slug: string, subPath: string) => `/shop/${slug}${subPath === "/" ? "" : subPath}`,
  APPOINTMENT: (slug: string, subPath: string) => `/appointment/${slug}${subPath === "/" ? "" : subPath}`,
} as const;

type OrganizationPathBuilder = (slug: string, subPath: string) => string;

async function getPrimaryDomainBaseUrl(slug: string, type: "SHOP" | "APPOINTMENT") {
  const domain = await prisma.organizationDomain.findFirst({
    where: {
      status: "ACTIVE",
      isPrimary: true,
      organization: {
        slug,
        type,
        isActive: true,
        deletedAt: null,
      },
    },
    select: { normalizedDomain: true },
  });

  return domain?.normalizedDomain ? `https://${domain.normalizedDomain}` : undefined;
}

export async function getTenantSeoContext(input: {
  locale: string;
  slug: string;
  subPath?: string;
  organizationType: "SHOP" | "APPOINTMENT";
}): Promise<TenantSeoContext> {
  const headerList = await headers();
  const headerSlug = headerList.get("x-bazar-tenant-slug");
  const customDomainEnabled = headerList.get("x-bazar-custom-domain") === "true";
  const customBaseUrl = headerList.get("x-bazar-tenant-public-base-url") || undefined;
  const locale = isSupportedCustomDomainLocale(input.locale)
    ? input.locale
    : defaultCustomDomainLocale;
  const subPath = input.subPath || "/";

  if (customDomainEnabled && customBaseUrl && headerSlug === input.slug) {
    return {
      isCustomDomain: true,
      baseUrl: customBaseUrl,
      path: buildTenantPublicPath(locale, subPath),
      alternatePath: (nextLocale) => buildTenantPublicPath(nextLocale, subPath),
    };
  }

  const primaryDomainBaseUrl = await getPrimaryDomainBaseUrl(input.slug, input.organizationType);

  const pathBuilder: OrganizationPathBuilder = ORGANIZATION_PATHS[input.organizationType] ?? ORGANIZATION_PATHS.SHOP;

  if (primaryDomainBaseUrl) {
    return {
      isCustomDomain: false,
      baseUrl: primaryDomainBaseUrl,
      path: buildTenantPublicPath(locale, subPath),
      alternatePath: (nextLocale) => buildTenantPublicPath(nextLocale, subPath),
    };
  }

  return {
    isCustomDomain: false,
    path: pathBuilder(input.slug, subPath),
    alternatePath: (nextLocale) => pathBuilder(input.slug, `/${nextLocale}${subPath}`),
  };
}

export async function getShopTenantSeoContext(input: {
  locale: string;
  slug: string;
  subPath?: string;
}): Promise<TenantSeoContext> {
  return getTenantSeoContext({ ...input, organizationType: "SHOP" });
}
