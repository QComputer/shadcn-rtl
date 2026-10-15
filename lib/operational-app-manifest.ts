import type { MetadataRoute } from "next";
import { appPath, appResourceUrl } from "@/lib/app-base-path";
import type { ResolvedOrganizationBranding, TenantPwaBranding } from "@/lib/organization-branding";

type AppBasePath = "" | "/app";

function safeTenantStartPath(value: string | null | undefined, locale: "fa" | "en" | "ar"): string | null {
  if (!value || !value.startsWith(`/${locale}/`) || value.includes("\\")) return null;
  try {
    const parsed = new URL(value, "https://tenant.invalid");
    const parts = parsed.pathname.split("/");
    if (parsed.origin !== "https://tenant.invalid" || parsed.search || parsed.hash || parts[1] !== locale) return null;
    if (parts.length === 3 && parts[2] === "shop") return `/${locale}/shop`;
    const retailPath = parts.length === 4 && parts[2] === "retail";
    const organizationShopPath = parts.length === 4 && parts[3] === "shop";
    if (!retailPath && !organizationShopPath) return null;
    const identifier = decodeURIComponent(retailPath ? parts[3] : parts[2]);
    if (!identifier || identifier === "." || identifier === ".." || /[\\/?#\u0000-\u001f]/.test(identifier)) return null;
    return retailPath
      ? `/${locale}/retail/${encodeURIComponent(identifier)}`
      : `/${locale}/${encodeURIComponent(identifier)}/shop`;
  } catch {
    return null;
  }
}

function safeIconUrl(value: string | null | undefined, basePath: AppBasePath): string | null {
  if (!value) return null;
  if (value.startsWith("/") && !value.startsWith("//") && !value.includes("\\")) {
    return appResourceUrl(value, basePath);
  }
  try {
    const url = new URL(value);
    if (url.protocol === "https:" && !url.username && !url.password) return url.toString();
  } catch {
    // Invalid tenant asset configuration is omitted instead of replaced by
    // Bazarbaaz artwork.
  }
  return null;
}

function imageMimeType(src: string): string | null {
  let pathname = src;
  try {
    pathname = new URL(src, "https://asset.invalid").pathname;
  } catch {
    return null;
  }
  const extension = pathname.toLowerCase().split(".").pop();
  if (extension === "png") return "image/png";
  if (extension === "webp") return "image/webp";
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
  if (extension === "svg") return "image/svg+xml";
  if (extension === "ico") return "image/x-icon";
  return null;
}

function icon(
  src: string | null,
  sizes: string,
  purpose: "any" | "maskable",
): MetadataRoute.Manifest["icons"][number] | null {
  const type = src ? imageMimeType(src) : null;
  return src && type ? { src, sizes, type, purpose } : null;
}

export function buildOperationalAppManifest(input: {
  basePath: AppBasePath;
  branding?: ResolvedOrganizationBranding | null;
  tenantBranding?: TenantPwaBranding | null;
  tenantStartPath?: string | null;
  locale?: "fa" | "en" | "ar";
}): MetadataRoute.Manifest {
  const { basePath, branding, tenantBranding } = input;
  const locale = input.locale || "fa";
  const tenant = tenantBranding ?? null;
  const platform = !tenant && Boolean(branding);
  const isPlatform = platform || (!tenant && !branding);
  const name = tenant
    ? (tenant.displayName || tenant.shortName || "Tenant website")
    : (branding?.displayName || "بازارباز");
  const shortName = tenant
    ? (tenant.shortName || tenant.displayName || "Website")
    : (branding?.shortName || "بازارباز");
  const tenantStartPath = tenant ? safeTenantStartPath(input.tenantStartPath, locale) : null;
  const startUrl = appPath(tenantStartPath ?? `/${locale}`, basePath);
  const scope = tenantStartPath ? appPath(tenantStartPath, basePath) : appPath("/", basePath);
  const icons = tenant
    ? [
        icon(safeIconUrl(tenant.pwaIcons.icon192, basePath), "192x192", "any"),
        icon(safeIconUrl(tenant.pwaIcons.icon512, basePath), "512x512", "any"),
        icon(safeIconUrl(tenant.pwaIcons.maskable192, basePath), "192x192", "maskable"),
        icon(safeIconUrl(tenant.pwaIcons.maskable512, basePath), "512x512", "maskable"),
      ].filter((value): value is NonNullable<typeof value> => value !== null)
    : [
        icon(safeIconUrl(branding?.pwaIcons.icon192 || "/icons/icon-192x192.png", basePath), "192x192", "any"),
        icon(safeIconUrl(branding?.pwaIcons.icon512 || "/icons/icon-512x512.png", basePath), "512x512", "any"),
        icon(appPath("/icons/icon-maskable-192x192.png", basePath), "192x192", "maskable"),
        icon(appPath("/icons/icon-maskable-512x512.png", basePath), "512x512", "maskable"),
      ].filter((value): value is NonNullable<typeof value> => value !== null);
  const installable = isPlatform || [
    tenant?.pwaIcons.icon192,
    tenant?.pwaIcons.icon512,
    tenant?.pwaIcons.maskable192,
    tenant?.pwaIcons.maskable512,
  ].every((value) => {
    const url = safeIconUrl(value, basePath);
    return Boolean(url && imageMimeType(url));
  });

  return {
    id: startUrl,
    name,
    short_name: shortName,
    ...(tenant
      ? { description: installable ? `${name} website` : `${name} website app identity is not configured` }
      : { description: branding ? `${name} operational application powered by Bazarbaaz` : "Bazarbaaz multi-business platform" }),
    start_url: startUrl,
    scope,
    display: installable ? "standalone" : "browser",
    orientation: "portrait",
    dir: locale === "en" ? "ltr" : "rtl",
    lang: locale,
    background_color: tenant?.backgroundColor && /^#[\da-f]{6}$/i.test(tenant.backgroundColor) ? tenant.backgroundColor : "#ffffff",
    theme_color: tenant?.themeColor && /^#[\da-f]{6}$/i.test(tenant.themeColor) ? tenant.themeColor : "#2F5BFF",
    categories: ["business", "shopping", "productivity"],
    icons,
    ...(tenant ? {} : {
      shortcuts: [
        { name: "فروشگاه‌ها", short_name: "فروشگاه", url: appPath(`/${locale}`, basePath) },
        { name: "ورود به پنل", short_name: "پنل", url: appPath(`/${locale}/dashboard`, basePath) },
      ],
    }),
  };
}

export function isTenantPwaInstallable(branding: TenantPwaBranding): boolean {
  return [
    branding.pwaIcons.icon192,
    branding.pwaIcons.icon512,
    branding.pwaIcons.maskable192,
    branding.pwaIcons.maskable512,
  ].every((value) => {
    const url = safeIconUrl(value, "");
    return Boolean(url && imageMimeType(url));
  });
}

export function safeTenantAssetUrl(value: string | null | undefined, basePath: AppBasePath): string | null {
  return safeIconUrl(value, basePath);
}
