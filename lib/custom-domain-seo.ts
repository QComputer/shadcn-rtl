import { headers } from "next/headers";
import {
  buildTenantPublicPath,
  defaultCustomDomainLocale,
  isSupportedCustomDomainLocale,
  type CustomDomainLocale,
} from "@/lib/custom-domain-routing";

export type ShopTenantSeoContext = {
  isCustomDomain: boolean;
  baseUrl?: string;
  path: string;
  alternatePath: (locale: CustomDomainLocale) => string;
};

export async function getShopTenantSeoContext(input: {
  locale: string;
  slug: string;
  subPath?: string;
}): Promise<ShopTenantSeoContext> {
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

  return {
    isCustomDomain: false,
    path: `/${locale}/shop/${input.slug}${subPath === "/" ? "" : subPath}`,
    alternatePath: (nextLocale) => `/${nextLocale}/shop/${input.slug}${subPath === "/" ? "" : subPath}`,
  };
}
