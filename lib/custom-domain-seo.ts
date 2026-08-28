import { headers } from "next/headers";
import prisma from "@/lib/db";
import {
  buildOrganizationPublicPath,
  buildOrganizationRootPath,
  defaultCustomDomainLocale,
  isSupportedCustomDomainLocale,
  type CustomDomainLocale,
} from "@/lib/custom-domain-routing";

export type TenantSeoContext = {
  isCustomDomain: boolean;
  organizationRootNavigation: "hard" | "next";
  baseUrl?: string;
  path: string;
  alternatePath: (locale: CustomDomainLocale) => string;
};

export async function getOrganizationRootSeoContext(input: {
  locale: string;
  slug: string;
}) {
  const headerList = await headers();
  const customDomainEnabled = headerList.get("x-bazar-custom-domain") === "true";
  const headerSlug = headerList.get("x-bazar-tenant-slug");
  const customBaseUrl = headerList.get("x-bazar-tenant-public-base-url") || undefined;
  const locale = isSupportedCustomDomainLocale(input.locale)
    ? input.locale
    : defaultCustomDomainLocale;
  const isCustomDomain = customDomainEnabled && headerSlug === input.slug;

  return {
    isCustomDomain,
    baseUrl: isCustomDomain ? customBaseUrl : undefined,
    path: buildOrganizationRootPath({ locale, organizationSlug: input.slug, isCustomDomain }),
    alternatePath: (nextLocale: CustomDomainLocale) => buildOrganizationRootPath({
      locale: nextLocale,
      organizationSlug: input.slug,
      isCustomDomain,
    }),
  };
}

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
  const organizationRootNavigation = headerList.get("x-bazar-organization-root-zone") === "external"
    ? "hard" as const
    : "next" as const;
  const locale = isSupportedCustomDomainLocale(input.locale)
    ? input.locale
    : defaultCustomDomainLocale;
  const subPath = input.subPath || "/";
  const surface = input.organizationType === "APPOINTMENT" ? "appointment" : "shop";

  if (customDomainEnabled && customBaseUrl && headerSlug === input.slug) {
    return {
      isCustomDomain: true,
      organizationRootNavigation,
      baseUrl: customBaseUrl,
      path: buildOrganizationPublicPath({ locale, organizationSlug: input.slug, surface, subPath, isCustomDomain: true }),
      alternatePath: (nextLocale) => buildOrganizationPublicPath({ locale: nextLocale, organizationSlug: input.slug, surface, subPath, isCustomDomain: true }),
    };
  }

  const primaryDomainBaseUrl = await getPrimaryDomainBaseUrl(input.slug, input.organizationType);

  if (primaryDomainBaseUrl) {
    return {
      isCustomDomain: false,
      organizationRootNavigation: "next",
      baseUrl: primaryDomainBaseUrl,
      path: buildOrganizationPublicPath({ locale, organizationSlug: input.slug, surface, subPath, isCustomDomain: true }),
      alternatePath: (nextLocale) => buildOrganizationPublicPath({ locale: nextLocale, organizationSlug: input.slug, surface, subPath, isCustomDomain: true }),
    };
  }

  return {
    isCustomDomain: false,
    organizationRootNavigation: "next",
    path: buildOrganizationPublicPath({ locale, organizationSlug: input.slug, surface, subPath }),
    alternatePath: (nextLocale) => buildOrganizationPublicPath({ locale: nextLocale, organizationSlug: input.slug, surface, subPath }),
  };
}

export async function getShopTenantSeoContext(input: {
  locale: string;
  slug: string;
  subPath?: string;
}): Promise<TenantSeoContext> {
  return getTenantSeoContext({ ...input, organizationType: "SHOP" });
}
