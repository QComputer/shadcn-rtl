import type { TenantPwaBranding } from "@/lib/organization-branding";
import { appPath } from "@/lib/app-base-path";

const RETAIL_PRESENTATION_THEMES = new Set(["FASHION", "ELECTRONICS", "GENERAL"]);

/**
 * A tenant starts in the Retail storefront only when persisted Retail branding
 * and the active SHOP capability agree. Legacy shops keep their existing
 * public entry point until an operator configures their Retail presentation.
 */
export function resolveTenantRetailStartPath(input: {
  locale: "fa" | "en" | "ar";
  slug: string;
  hasActiveShopCapability: boolean;
  branding: Pick<TenantPwaBranding, "retailPresentationTheme">;
}): string | null {
  const { locale, slug, hasActiveShopCapability, branding } = input;
  // The Retail storefront route currently has Persian copy and is only
  // published beneath /fa. Do not create a branded install deep link that
  // targets an unavailable locale route.
  if (locale !== "fa") return null;
  if (!hasActiveShopCapability || !RETAIL_PRESENTATION_THEMES.has(branding.retailPresentationTheme ?? "")) return null;
  if (!slug || slug === "." || slug === ".." || /[\\/?#\u0000-\u001f]/.test(slug)) return null;
  // Use the published Shop route as the install entry. It renders the same
  // persisted Retail catalog while keeping cart, profile, and checkout routes
  // inside the tenant-specific manifest scope.
  return `/${locale}/${encodeURIComponent(slug)}/shop`;
}

/** Canonical public shop path on a verified tenant host or APP endpoint. */
export function resolveTenantShopStartPath(input: {
  locale: "fa" | "en" | "ar";
  hasActiveShopCapability: boolean;
}): string | null {
  return input.hasActiveShopCapability ? `/${input.locale}/shop` : null;
}

export function tenantPwaManifestHref(input: {
  organizationIdentifier: string;
  locale: "fa" | "en" | "ar";
  entry: "retail" | "shop";
}): string {
  const path = `/api/public/v1/organizations/${encodeURIComponent(input.organizationIdentifier)}/pwa-manifest`;
  const query = new URLSearchParams({ locale: input.locale, entry: input.entry });
  return `${appPath(path)}?${query.toString()}`;
}
