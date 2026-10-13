import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { resolveAppBasePath } from "@/lib/app-base-path";
import { buildOperationalAppManifest } from "@/lib/operational-app-manifest";
import { resolvePlatformFallbackBranding } from "@/lib/organization-branding";
import { resolveTenantPwaRequestContext } from "@/lib/tenant-pwa-context.server";

export const dynamic = "force-dynamic";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const basePath = resolveAppBasePath();
  const requestHeaders = await headers();
  const context = await resolveTenantPwaRequestContext(requestHeaders).catch(() => ({ kind: "unknown" as const }));
  const locale = requestHeaders.get("x-bazar-tenant-public-locale");
  if (context.kind === "tenant") {
    return buildOperationalAppManifest({ basePath, tenantBranding: context.branding, locale: context.locale });
  }
  if (context.kind === "platform") {
    return buildOperationalAppManifest({ basePath, branding: resolvePlatformFallbackBranding(), locale: locale === "en" || locale === "ar" ? locale : "fa" });
  }

  // Unknown or inactive custom domains get a clearly non-installable manifest
  // without a Bazarbaaz name, logo, or cross-tenant asset fallback.
  return {
    id: basePath ? `${basePath}/not-configured` : "/not-configured",
    name: "Website identity not configured",
    short_name: "Not configured",
    start_url: basePath ? `${basePath}/` : "/",
    scope: basePath ? `${basePath}/` : "/",
    display: "browser",
    dir: "ltr",
    lang: "en",
    icons: [],
  };
}
