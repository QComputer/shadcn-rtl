export const customDomainLocales = ["fa", "en", "ar"] as const;
export type CustomDomainLocale = (typeof customDomainLocales)[number];
export const defaultCustomDomainLocale: CustomDomainLocale = "fa";

export type ResolvedCustomDomain = {
  slug: string;
  locale: CustomDomainLocale;
  organizationId: string;
  organizationType: "SHOP" | "APPOINTMENT";
  capabilities: Array<"SHOP" | "APPOINTMENT">;
  publicHomeMode?: string | null;
  brandLandingProvider?: string | null;
  publicHome?: {
    kind: "capability";
    mode: "SHOP" | "APPOINTMENT";
    capability: "SHOP" | "APPOINTMENT";
    publicSurface: "shop" | "appointment";
    publicEntryPath: "/shop" | "/services";
  } | {
    kind: "brand";
    provider: "BAZARBAAZ" | "CUSTOM_INTERNAL";
  } | {
    kind: "external";
    provider: "CUSTOM_EXTERNAL";
  } | {
    kind: "visitor-choice";
    capabilities: Array<"SHOP" | "APPOINTMENT">;
  } | {
    kind: "generic";
    reason: "NO_PUBLIC_CAPABILITY" | "MULTIPLE_WITHOUT_VALID_DEFAULT";
  } | {
    kind: "invalid";
    reason: "MODE_REQUIRES_MISSING_CAPABILITY";
    mode: "SHOP" | "APPOINTMENT" | "BRAND";
  };
};

const DEFAULT_PLATFORM_HOSTS = [
  "localhost",
  "127.0.0.1",
  "bazar-baz.ir",
  "www.bazar-baz.ir",
  "shadcn-rtl.vercel.app",
  "bazarbaaz.ir",
];

function hostFromUrlLike(value: string | undefined | null) {
  const raw = value?.trim();
  if (!raw) return null;

  try {
    return new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`).host;
  } catch {
    return raw;
  }
}

function urlHostname(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";

  try {
    return new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`).hostname;
  } catch {
    return trimmed;
  }
}

export function normalizeDomainHost(value: string | undefined | null): string {
  const hostname = urlHostname(value || "");

  return hostname
    .toLowerCase()
    .replace(/\.$/, "")
    .replace(/^www\./, "");
}

export function getPlatformHosts() {
  const hosts = new Set(DEFAULT_PLATFORM_HOSTS.map(normalizeDomainHost));

  for (const value of [
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.NEXT_PUBLIC_DEPLOYED_APP_URL,
    process.env.NEXTAUTH_URL,
    process.env.VERCEL_URL,
    process.env.CUSTOM_DOMAIN_PLATFORM_HOSTS,
    process.env.BAZAR_BAZ_PLATFORM_HOSTS,
  ]) {
    if (!value) continue;

    for (const item of value.split(",")) {
      const host = normalizeDomainHost(hostFromUrlLike(item));
      if (host) hosts.add(host);
    }
  }

  return hosts;
}

export function isPlatformHost(host: string | undefined | null) {
  const normalizedHost = normalizeDomainHost(host);
  if (!normalizedHost) return true;
  return getPlatformHosts().has(normalizedHost);
}

/**
 * Canonical public platform domain. `bazarbaaz.ir` (and its `www.` variant,
 * which normalizes to the apex) is a platform host and must never resolve to a
 * tenant organization. `www.bazarbaaz.ir`, `bazar-baz.ir`, and `www.bazar-baz.ir`
 * are non-canonical sources that redirect (308, preserving path/query) to the apex.
 */
export const CANONICAL_PLATFORM_HOST = "bazarbaaz.ir";

const PLATFORM_CANONICAL_REDIRECT_SOURCES = new Set([
  "www.bazarbaaz.ir",
  "bazar-baz.ir",
  "www.bazar-baz.ir",
]);

/**
 * Returns the canonical platform origin (`https://bazarbaaz.ir`) when the
 * supplied raw `Host` header is a non-canonical platform host (the `www.`
 * variant or a legacy `bazar-baz.ir` host), or `null` when the host is already
 * canonical, is not a canonicalization target, or is a tenant/custom domain.
 *
 * Callers issue a `308` redirect to the returned origin, preserving the original
 * pathname and search. The apex canonical host always returns `null` to avoid a
 * redirect loop.
 */
export function getPlatformCanonicalRedirectTarget(
  rawHost: string | null | undefined,
): string | null {
  if (!rawHost) return null;

  const hostname = rawHost.split(":")[0].replace(/\.$/, "").toLowerCase();

  if (hostname === CANONICAL_PLATFORM_HOST) return null;

  if (PLATFORM_CANONICAL_REDIRECT_SOURCES.has(hostname)) {
    return `https://${CANONICAL_PLATFORM_HOST}`;
  }

  return null;
}

export function isSupportedCustomDomainLocale(value: string | undefined | null): value is CustomDomainLocale {
  return customDomainLocales.includes(value as CustomDomainLocale);
}

export function splitLocalePrefix(pathname: string): {
  locale: CustomDomainLocale | null;
  pathnameWithoutLocale: string;
  hadLocalePrefix: boolean;
} {
  const normalizedPathname = pathname.startsWith("/") ? pathname : `/${pathname}`;
  const parts = normalizedPathname.split("/").filter(Boolean);
  const firstPart = parts[0];

  if (isSupportedCustomDomainLocale(firstPart)) {
    const rest = parts.slice(1).join("/");
    return {
      locale: firstPart,
      pathnameWithoutLocale: rest ? `/${rest}` : "/",
      hadLocalePrefix: true,
    };
  }

  return {
    locale: null,
    pathnameWithoutLocale: normalizedPathname || "/",
    hadLocalePrefix: false,
  };
}

export function buildTenantPublicPath(locale: string, tenantSubPath = "/") {
  const supportedLocale = isSupportedCustomDomainLocale(locale) ? locale : defaultCustomDomainLocale;
  const cleanSubPath = tenantSubPath && tenantSubPath !== "/"
    ? tenantSubPath.startsWith("/") ? tenantSubPath : `/${tenantSubPath}`
    : "";

  if (supportedLocale === defaultCustomDomainLocale) {
    return cleanSubPath || "/";
  }

  return `/${supportedLocale}${cleanSubPath}`;
}

export function getShopSubPathFromPlatformPath(pathname: string, slug: string) {
  const { locale, pathnameWithoutLocale } = splitLocalePrefix(pathname);
  const prefix = `/shop/${slug}`;

  if (pathnameWithoutLocale === prefix) {
    return {
      locale: locale || defaultCustomDomainLocale,
      subPath: "/",
    };
  }

  if (pathnameWithoutLocale.startsWith(`${prefix}/`)) {
    return {
      locale: locale || defaultCustomDomainLocale,
      subPath: pathnameWithoutLocale.slice(prefix.length) || "/",
    };
  }

  return null;
}

export function buildShopPlatformPath(input: {
  locale: string;
  slug: string;
  publicPathname: string;
}) {
  const locale = isSupportedCustomDomainLocale(input.locale)
    ? input.locale
    : defaultCustomDomainLocale;
  const { pathnameWithoutLocale } = splitLocalePrefix(input.publicPathname);
  const cleanPath = pathnameWithoutLocale === "/" ? "" : pathnameWithoutLocale;

  return `/${locale}/shop/${input.slug}${cleanPath}`;
}

export type ParsedShopPlatformPath = {
  locale: CustomDomainLocale;
  slug: string;
  subPath: string;
};

export function parseShopPlatformPath(pathname: string): ParsedShopPlatformPath | null {
  const { locale, pathnameWithoutLocale } = splitLocalePrefix(pathname);
  if (!locale) return null;

  const parts = pathnameWithoutLocale.split("/").filter(Boolean);
  if (parts[0] !== "shop" || !parts[1]) return null;

  const subPathParts = parts.slice(2);
  const subPath = subPathParts.length > 0 ? `/${subPathParts.join("/")}` : "/";

  return {
    locale,
    slug: parts[1],
    subPath,
  };
}

export function isSeoIndexableShopSubPath(subPath: string) {
  const normalizedSubPath = subPath.startsWith("/") ? subPath : `/${subPath}`;

  return (
    normalizedSubPath === "/" ||
    normalizedSubPath === "/profile" ||
    normalizedSubPath === "/fanpage" ||
    normalizedSubPath.startsWith("/category/") ||
    normalizedSubPath.startsWith("/product/")
  );
}

export function isCustomDomainBypassPath(pathname: string) {
  if (pathname === "/robots.txt" || pathname === "/sitemap.xml") {
    return false;
  }

  return (
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/uploads") ||
    pathname.startsWith("/og-image") ||
    pathname.startsWith("/static") ||
    pathname === "/favicon.ico" ||
    pathname.includes(".")
  );
}

export function isCustomDomainApplicationPath(pathname: string) {
  const { pathnameWithoutLocale } = splitLocalePrefix(pathname);

  return (
    pathnameWithoutLocale === "/login" ||
    pathnameWithoutLocale === "/register" ||
    pathnameWithoutLocale.startsWith("/register/") ||
    pathnameWithoutLocale === "/dashboard" ||
    pathnameWithoutLocale.startsWith("/dashboard/")
  );
}
