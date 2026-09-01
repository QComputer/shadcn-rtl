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
  appEndpoint?: {
    origin: string;
    pathPrefix: string;
  } | null;
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

export function isResolvedOperationalAppHost(
  tenant: Pick<ResolvedCustomDomain, "appEndpoint">,
  host: string | undefined | null,
  appBasePath: "" | "/app",
): boolean {
  if (!tenant.appEndpoint || tenant.appEndpoint.pathPrefix !== appBasePath) return false;
  try {
    return normalizeDomainHost(new URL(tenant.appEndpoint.origin).host) === normalizeDomainHost(host);
  } catch {
    return false;
  }
}

export type OperationalAppRoute = {
  locale: CustomDomainLocale;
  internalPathname: string;
  surface: "HOME" | "SHOP" | "PURCHASE_INTENT" | "LOGIN";
};

function safeDecodedPathSegment(value: string): string | null {
  try {
    const decoded = decodeURIComponent(value);
    if (!decoded || decoded === "." || decoded === ".." || /[/?#\\]/.test(decoded)) return null;
    return encodeURIComponent(decoded);
  } catch {
    return null;
  }
}

/**
 * Adapts the clean browser namespace owned by an APP endpoint to the existing
 * organization-first App Router hierarchy. Next.js has already stripped the
 * configured basePath before this function sees the pathname.
 */
export function resolveOperationalAppRoute(
  pathname: string,
  organizationSlug: string,
): OperationalAppRoute | null {
  const splitPath = splitLocalePrefix(pathname);
  const locale = splitPath.locale || defaultCustomDomainLocale;
  const path = splitPath.pathnameWithoutLocale;
  const organization = safeDecodedPathSegment(organizationSlug);
  if (!organization) return null;

  if (path === "/") {
    return { locale, internalPathname: `/${locale}/${organization}`, surface: "HOME" };
  }
  if (path === "/login") {
    return { locale, internalPathname: `/${locale}/login`, surface: "LOGIN" };
  }
  if (path === "/shop" || path.startsWith("/shop/")) {
    return { locale, internalPathname: `/${locale}/${organization}${path}`, surface: "SHOP" };
  }
  const match = path.match(/^\/purchase\/product\/([^/]+)$/);
  const productId = match ? safeDecodedPathSegment(match[1]) : null;
  if (productId) {
    return {
      locale,
      internalPathname: `/${locale}/${organization}/purchase/product/${productId}`,
      surface: "PURCHASE_INTENT",
    };
  }
  return null;
}

export type OrganizationPublicSurface = "shop" | "appointment";

export function buildOrganizationRootPath(input: {
  locale: string;
  organizationSlug: string;
  isCustomDomain?: boolean;
}) {
  if (input.isCustomDomain) return "/";
  const locale = isSupportedCustomDomainLocale(input.locale)
    ? input.locale
    : defaultCustomDomainLocale;
  return `/${locale}/${input.organizationSlug}`;
}

/**
 * Builds a browser-visible organization capability path without exposing the
 * internal locale/organization route used by the App Router.
 */
export function buildOrganizationPublicPath(input: {
  locale: string;
  organizationSlug: string;
  surface: OrganizationPublicSurface;
  subPath?: string;
  isCustomDomain?: boolean;
}) {
  const locale = isSupportedCustomDomainLocale(input.locale)
    ? input.locale
    : defaultCustomDomainLocale;
  const subPath = input.subPath && input.subPath !== "/"
    ? input.subPath.startsWith("/") ? input.subPath : `/${input.subPath}`
    : "";

  if (input.isCustomDomain) {
    const capabilityPath = `/${input.surface}${subPath}`;
    return locale === defaultCustomDomainLocale
      ? capabilityPath
      : `/${locale}${capabilityPath}`;
  }

  return `/${locale}/${input.organizationSlug}/${input.surface}${subPath}`;
}

export function buildOrganizationPlatformPath(input: {
  locale: string;
  organizationSlug: string;
  surface: OrganizationPublicSurface;
  publicPathname: string;
}) {
  const locale = isSupportedCustomDomainLocale(input.locale)
    ? input.locale
    : defaultCustomDomainLocale;
  const { pathnameWithoutLocale } = splitLocalePrefix(input.publicPathname);
  const surfacePrefix = `/${input.surface}`;
  const subPath = pathnameWithoutLocale === surfacePrefix
    ? ""
    : pathnameWithoutLocale.startsWith(`${surfacePrefix}/`)
      ? pathnameWithoutLocale.slice(surfacePrefix.length)
      : pathnameWithoutLocale === "/"
        ? ""
        : pathnameWithoutLocale;

  return `/${locale}/${input.organizationSlug}/${input.surface}${subPath}`;
}

export type PublicRouteSearchParams = Record<string, string | string[] | undefined>;

export function appendPublicRouteSearchParams(pathname: string, searchParams?: PublicRouteSearchParams) {
  if (!searchParams) return pathname;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (Array.isArray(value)) {
      for (const item of value) query.append(key, item);
    } else if (value !== undefined) {
      query.set(key, value);
    }
  }
  const serialized = query.toString();
  return serialized ? `${pathname}?${serialized}` : pathname;
}

export function buildLegacyPlatformCapabilityRedirect(input: {
  locale: string;
  organizationSlug: string;
  surface: OrganizationPublicSurface;
  legacySegments?: string[];
  searchParams?: PublicRouteSearchParams;
}) {
  const segments = input.legacySegments ?? [];
  const normalizedSegments = input.surface === "appointment" && segments[0] === "appointment" && segments[1]
    ? ["my-appointments", ...segments.slice(1)]
    : segments;
  const subPath = normalizedSegments.length > 0 ? `/${normalizedSegments.join("/")}` : "/";
  return appendPublicRouteSearchParams(buildOrganizationPublicPath({
    locale: input.locale,
    organizationSlug: input.organizationSlug,
    surface: input.surface,
    subPath,
  }), input.searchParams);
}

export function getShopSubPathFromPlatformPath(pathname: string, slug: string) {
  const { locale, pathnameWithoutLocale } = splitLocalePrefix(pathname);
  const prefix = `/${slug}/shop`;

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
  return buildOrganizationPlatformPath({
    locale: input.locale,
    organizationSlug: input.slug,
    surface: "shop",
    publicPathname: input.publicPathname,
  });
}

export function getAppointmentSubPathFromPlatformPath(pathname: string, slug: string) {
  const { locale, pathnameWithoutLocale } = splitLocalePrefix(pathname);
  const prefix = `/${slug}/appointment`;

  if (pathnameWithoutLocale === prefix) {
    return { locale: locale || defaultCustomDomainLocale, subPath: "/" };
  }

  if (pathnameWithoutLocale.startsWith(`${prefix}/`)) {
    const internalSubPath = pathnameWithoutLocale.slice(prefix.length) || "/";
    return {
      locale: locale || defaultCustomDomainLocale,
      subPath: internalSubPath.startsWith("/appointment/")
        ? `/my-appointments/${internalSubPath.slice("/appointment/".length)}`
        : internalSubPath,
    };
  }

  return null;
}

export function buildAppointmentPlatformPath(input: {
  locale: string;
  slug: string;
  publicPathname: string;
}) {
  return buildOrganizationPlatformPath({
    locale: input.locale,
    organizationSlug: input.slug,
    surface: "appointment",
    publicPathname: input.publicPathname,
  });
}

export type CustomDomainCapabilityPath = {
  locale: CustomDomainLocale;
  surface: OrganizationPublicSurface;
  subPath: string;
};

/**
 * Syntactically maps a parsed public namespace to its capability key. This
 * does not inspect an organization or authorize access; the resolver/proxy
 * layer must compare the returned key with the resolved tenant capabilities.
 */
export function classifyPublicSurfaceCapability(surface: OrganizationPublicSurface) {
  return surface === "shop" ? "SHOP" as const : "APPOINTMENT" as const;
}

const RESERVED_CUSTOM_DOMAIN_SEGMENTS: Record<OrganizationPublicSurface, Set<string>> = {
  shop: new Set(["category", "product", "cart", "checkout", "order", "profile", "fanpage"]),
  appointment: new Set(["services", "booking", "my-appointments", "appointment", "fanpage", "staff"]),
};

export function isReservedCustomDomainSurfaceSegment(surface: OrganizationPublicSurface, segment: string) {
  return RESERVED_CUSTOM_DOMAIN_SEGMENTS[surface].has(segment.toLowerCase());
}

export function parseCustomDomainCapabilityPath(pathname: string): CustomDomainCapabilityPath | null {
  const splitPath = splitLocalePrefix(pathname);
  const locale = splitPath.locale || defaultCustomDomainLocale;

  for (const surface of ["shop", "appointment"] as const) {
    const prefix = `/${surface}`;
    if (splitPath.pathnameWithoutLocale === prefix) {
      return { locale, surface, subPath: "/" };
    }
    if (splitPath.pathnameWithoutLocale.startsWith(`${prefix}/`)) {
      return {
        locale,
        surface,
        subPath: splitPath.pathnameWithoutLocale.slice(prefix.length) || "/",
      };
    }
  }

  return null;
}

/**
 * The future cross-zone edge contract owns only these explicit namespaces.
 * The legacy paths below are application-level compatibility redirects and do
 * not imply that an external edge (including CafeLeo/nginx) must route them to
 * Bazarbaaz.
 */
export const CUSTOM_DOMAIN_CAPABILITY_EDGE_PREFIXES = ["/shop", "/appointment"] as const;

const LEGACY_CUSTOM_DOMAIN_SURFACES = [
  { surface: "shop", prefixes: ["/product", "/category", "/cart", "/checkout", "/order", "/profile", "/fanpage"] },
  { surface: "appointment", prefixes: ["/services", "/booking", "/my-appointments"] },
] as const;

export function getLegacyCustomDomainCapabilityRedirect(pathname: string): string | null {
  const splitPath = splitLocalePrefix(pathname);
  const locale = splitPath.locale || defaultCustomDomainLocale;

  const intermediateDetailPrefix = "/appointment/appointment/";
  if (splitPath.pathnameWithoutLocale.startsWith(intermediateDetailPrefix)) {
    const detailPath = splitPath.pathnameWithoutLocale.slice(intermediateDetailPrefix.length);
    if (detailPath) {
      return buildOrganizationPublicPath({
        locale,
        organizationSlug: "unused-on-custom-domain",
        surface: "appointment",
        subPath: `/my-appointments/${detailPath}`,
        isCustomDomain: true,
      });
    }
  }

  if (splitPath.pathnameWithoutLocale.startsWith("/appointment/")) {
    const detailPath = splitPath.pathnameWithoutLocale.slice("/appointment/".length);
    const detailSegment = detailPath.split("/")[0];
    if (detailSegment && !isReservedCustomDomainSurfaceSegment("appointment", detailSegment)) {
      return buildOrganizationPublicPath({
        locale,
        organizationSlug: "unused-on-custom-domain",
        surface: "appointment",
        subPath: `/my-appointments/${detailPath}`,
        isCustomDomain: true,
      });
    }
  }

  for (const entry of LEGACY_CUSTOM_DOMAIN_SURFACES) {
    if (entry.prefixes.some((prefix) =>
      splitPath.pathnameWithoutLocale === prefix || splitPath.pathnameWithoutLocale.startsWith(`${prefix}/`),
    )) {
      return buildOrganizationPublicPath({
        locale,
        organizationSlug: "unused-on-custom-domain",
        surface: entry.surface,
        subPath: splitPath.pathnameWithoutLocale,
        isCustomDomain: true,
      });
    }
  }

  return null;
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
  if (!parts[0] || parts[1] !== "shop") return null;

  const subPathParts = parts.slice(2);
  const subPath = subPathParts.length > 0 ? `/${subPathParts.join("/")}` : "/";

  return {
    locale,
    slug: parts[0],
    subPath,
  };
}

export type ParsedLegacyPlatformCapabilityPath = {
  locale: CustomDomainLocale;
  slug: string;
  surface: OrganizationPublicSurface;
  subPath: string;
};

export function parseLegacyPlatformCapabilityPath(pathname: string): ParsedLegacyPlatformCapabilityPath | null {
  const { locale, pathnameWithoutLocale } = splitLocalePrefix(pathname);
  if (!locale) return null;

  const parts = pathnameWithoutLocale.split("/").filter(Boolean);
  const surface = parts[0];
  if ((surface !== "shop" && surface !== "appointment") || !parts[1]) return null;

  const legacySubPathParts = parts.slice(2);
  const subPathParts = surface === "appointment" && legacySubPathParts[0] === "appointment" && legacySubPathParts[1]
    ? ["my-appointments", ...legacySubPathParts.slice(1)]
    : legacySubPathParts;
  return {
    locale,
    slug: parts[1],
    surface,
    subPath: subPathParts.length > 0 ? `/${subPathParts.join("/")}` : "/",
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
