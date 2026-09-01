import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  buildShopPlatformPath,
  buildAppointmentPlatformPath,
  buildOrganizationRootPath,
  buildOrganizationPublicPath,
  buildTenantPublicPath,
  getPlatformCanonicalRedirectTarget,
  CANONICAL_PLATFORM_HOST,
  getShopSubPathFromPlatformPath,
  getAppointmentSubPathFromPlatformPath,
  isCustomDomainApplicationPath,
  isCustomDomainBypassPath,
  isPlatformHost,
  normalizeDomainHost,
  parseShopPlatformPath,
  parseLegacyPlatformCapabilityPath,
  splitLocalePrefix,
  isSeoIndexableShopSubPath,
  getLegacyCustomDomainCapabilityRedirect,
  parseCustomDomainCapabilityPath,
  classifyPublicSurfaceCapability,
  isReservedCustomDomainSurfaceSegment,
  isResolvedOperationalAppHost,
  resolveOperationalAppRoute,
  type ResolvedCustomDomain,
} from "@/lib/custom-domain-routing";
import { getPublicFooterContextForPathname, type PublicFooterContext } from "@/lib/public-footer-context";
import { appCookiePath, appPath, resolveAppBasePath } from "@/lib/app-base-path";

// Supported locales - Persian is the default (primary native language)
export const locales = ["fa", "en", "ar"] as const;
export type Locale = (typeof locales)[number];

// Default locale is Persian (RTL)
export const defaultLocale: Locale = "fa";

// Locale configurations for RTL/LTR and other settings
export const localeConfig: Record<Locale, {
  dir: "rtl" | "ltr";
  name: string;
  nativeName: string;
}> = {
  fa: {
    dir: "rtl",
    name: "fa",
    nativeName: "فارسی"
  },
  en: {
    dir: "ltr",
    name: "en",
    nativeName: "English"
  },
  ar: {
    dir: "rtl",
    name: "ar",
    nativeName: "العربية"
  }
};

const securityHeaders = [
  ["X-Content-Type-Options", "nosniff"],
  ["X-Frame-Options", "SAMEORIGIN"],
  ["Referrer-Policy", "strict-origin-when-cross-origin"],
  ["Permissions-Policy", "camera=(), microphone=(), payment=()"],
  ["Cross-Origin-Opener-Policy", "same-origin"],
] as const;

function withSecurityHeaders(response: NextResponse): NextResponse {
  for (const [key, value] of securityHeaders) {
    response.headers.set(key, value);
  }
  return response;
}

function withFooterContext(request: NextRequest, context: PublicFooterContext) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-bazar-public-footer-context", context);
  return { request: { headers: requestHeaders } };
}

// ============================================
// Helper Functions
// ============================================

/**
 * Check if pathname has a locale prefix
 */
function pathnameHasLocale(pathname: string): boolean {
  return locales.some(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
  );
}

/**
 * Get the direction (RTL/LTR) for a given locale
 */
export function getDirection(locale: Locale): "rtl" | "ltr" {
  return localeConfig[locale].dir;
}

/**
 * Check if a locale is RTL
 */
export function isRTL(locale: Locale): boolean {
  return localeConfig[locale].dir === "rtl";
}


async function resolveTenantForCustomDomain(
  request: NextRequest,
  normalizedHost: string,
): Promise<ResolvedCustomDomain | null> {
  const resolverUrl = new URL(appPath("/api/internal/domain-resolver"), request.url);
  resolverUrl.searchParams.set("host", normalizedHost);

  const resolverSecret = process.env.CUSTOM_DOMAIN_RESOLVER_SECRET || process.env.INTERNAL_API_SECRET || "";

  const response = await fetch(resolverUrl, {
    headers: resolverSecret ? { "x-internal-secret": resolverSecret } : undefined,
    cache: "no-store",
  });

  if (!response.ok) return null;

  const data = (await response.json().catch(() => null)) as ResolvedCustomDomain | null;
  if (!data?.slug || !data.organizationId) return null;

  return data;
}

async function resolvePrimaryDomainForShop(
  request: NextRequest,
  slug: string,
): Promise<string | null> {
  const resolverUrl = new URL(appPath("/api/internal/shop-primary-domain"), request.url);
  resolverUrl.searchParams.set("slug", slug);

  const resolverSecret = process.env.CUSTOM_DOMAIN_RESOLVER_SECRET || process.env.INTERNAL_API_SECRET || "";

  const response = await fetch(resolverUrl, {
    headers: resolverSecret ? { "x-internal-secret": resolverSecret } : undefined,
    cache: "no-store",
  });

  if (!response.ok) return null;

  const data = (await response.json().catch(() => null)) as { domain?: string } | null;
  return data?.domain || null;
}

function buildTenantRewriteHeaders(
  request: NextRequest,
  normalizedHost: string,
  tenant: ResolvedCustomDomain,
  locale: Locale,
  publicPath: string,
) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-bazar-custom-domain", "true");
  requestHeaders.set("x-bazar-tenant-domain", normalizedHost);
  requestHeaders.set("x-bazar-tenant-slug", tenant.slug);
  requestHeaders.set("x-bazar-tenant-organization-id", tenant.organizationId);
  requestHeaders.set("x-bazar-tenant-organization-type", tenant.organizationType);
  requestHeaders.set("x-bazar-tenant-capabilities", tenant.capabilities.join(","));
  requestHeaders.set("x-bazar-tenant-public-base-url", getRequestOrigin(request));
  requestHeaders.set("x-bazar-tenant-public-locale", locale);
  requestHeaders.set("x-bazar-tenant-public-path", publicPath);
  requestHeaders.set(
    "x-bazar-organization-root-zone",
    tenant.publicHome?.kind === "external" ? "external" : "bazarbaaz",
  );
  requestHeaders.set("x-bazar-public-footer-context", "none");
  return requestHeaders;
}

function getRequestOrigin(request: NextRequest) {
  const host = request.headers.get("host") || request.nextUrl.host;
  const protocol = request.headers.get("x-forwarded-proto") || request.nextUrl.protocol.replace(":", "") || "https";
  return `${protocol}://${host}`;
}

// ============================================
// Main Middleware Function
// ============================================

/**
 * Main proxy/middleware function for Next.js 16
 * Handles locale detection, routing, authentication, and access control
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hostHeader = request.headers.get("host") || request.nextUrl.host;
  const normalizedHost = normalizeDomainHost(hostHeader);

  const canonicalRedirectTarget = getPlatformCanonicalRedirectTarget(hostHeader);
  if (canonicalRedirectTarget) {
    const canonicalUrl = request.nextUrl.clone();
    canonicalUrl.protocol = "https:";
    canonicalUrl.host = CANONICAL_PLATFORM_HOST;
    canonicalUrl.port = "";
    return withSecurityHeaders(NextResponse.redirect(canonicalUrl, 308));
  }

  if (!isPlatformHost(normalizedHost) && pathname.startsWith("/api/auth")) {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-forwarded-host", hostHeader);
    requestHeaders.set(
      "x-forwarded-proto",
      request.headers.get("x-forwarded-proto") || request.nextUrl.protocol.replace(":", "") || "https",
    );
    return withSecurityHeaders(NextResponse.next({ request: { headers: requestHeaders } }));
  }

  if (!isPlatformHost(normalizedHost) && !isCustomDomainBypassPath(pathname)) {
    const tenant = await resolveTenantForCustomDomain(request, normalizedHost);

    if (!tenant) {
      const notConfiguredUrl = request.nextUrl.clone();
      notConfiguredUrl.pathname = `/${defaultLocale}/domain-not-configured`;
      return withSecurityHeaders(NextResponse.rewrite(notConfiguredUrl));
    }

    // A verified OrganizationDomain can route more than a public experience.
    // The explicit APP endpoint owns the operational build when both host and
    // compile-time path prefix match, so it must bypass public-root rewrites.
    if (isResolvedOperationalAppHost(tenant, normalizedHost, resolveAppBasePath())) {
      const splitPath = splitLocalePrefix(pathname);
      const requestHeaders = buildTenantRewriteHeaders(
        request,
        normalizedHost,
        tenant,
        splitPath.locale || defaultLocale,
        pathname,
      );
      requestHeaders.set("x-bazar-public-footer-context", "none");
      const operationalRoute = pathname.startsWith("/api")
        ? null
        : resolveOperationalAppRoute(pathname, tenant.slug);
      if (!pathname.startsWith("/api") && !operationalRoute) {
        const unavailableUrl = request.nextUrl.clone();
        unavailableUrl.pathname = `/${defaultLocale}/not-found`;
        return withSecurityHeaders(NextResponse.rewrite(unavailableUrl, { request: { headers: requestHeaders } }));
      }
      const response = operationalRoute
        ? NextResponse.rewrite(new URL(operationalRoute.internalPathname + request.nextUrl.search, request.url), {
            request: { headers: requestHeaders },
          })
        : NextResponse.next({ request: { headers: requestHeaders } });
      const operationalLocale = operationalRoute?.locale || splitPath.locale;
      if (operationalLocale) {
        response.headers.set("x-locale", operationalLocale);
        response.headers.set("x-direction", localeConfig[operationalLocale].dir);
      }
      return withSecurityHeaders(response);
    }

    const tenantPathLocale = splitLocalePrefix(pathname).locale;
    const localeForTenant = tenantPathLocale || defaultLocale;

    // Authentication and management pages stay on the custom-domain origin,
    // but they are application routes rather than storefront subpaths.
    if (isCustomDomainApplicationPath(pathname)) {
      if (!tenantPathLocale) {
        const localizedUrl = request.nextUrl.clone();
        localizedUrl.pathname = `/${defaultLocale}${pathname}`;
        return withSecurityHeaders(NextResponse.redirect(localizedUrl));
      }

      const requestHeaders = buildTenantRewriteHeaders(
        request,
        normalizedHost,
        tenant,
        tenantPathLocale,
        pathname,
      );
      requestHeaders.set("x-bazar-public-footer-context", "none");

      const response = NextResponse.next({ request: { headers: requestHeaders } });
      response.headers.set("x-locale", tenantPathLocale);
      response.headers.set("x-direction", localeConfig[tenantPathLocale].dir);
      return withSecurityHeaders(response);
    }

    if (pathname === "/sitemap.xml" || pathname === "/robots.txt") {
      const internalUrl = request.nextUrl.clone();
      internalUrl.pathname = pathname === "/sitemap.xml"
        ? "/api/public/custom-domain/sitemap"
        : "/api/public/custom-domain/robots";
      const requestHeaders = buildTenantRewriteHeaders(
        request,
        normalizedHost,
        tenant,
        localeForTenant,
        pathname,
      );
      return withSecurityHeaders(NextResponse.rewrite(internalUrl, { request: { headers: requestHeaders } }));
    }

    const splitPath = splitLocalePrefix(pathname);
    const locale = splitPath.locale || defaultLocale;
    const tenantHomeUrl = request.nextUrl.clone();
    const requestHeaders = buildTenantRewriteHeaders(
      request,
      normalizedHost,
      tenant,
      locale,
      buildTenantPublicPath(locale, splitPath.pathnameWithoutLocale),
    );

    if (splitPath.pathnameWithoutLocale === "/") {
      const publicHome = tenant.publicHome;

      if (publicHome?.kind === "external") {
        const externalUrl = request.nextUrl.clone();
        externalUrl.pathname = `/${locale}/external-root/${tenant.slug}`;
        const response = NextResponse.rewrite(externalUrl, { request: { headers: requestHeaders } });
        response.headers.set("x-locale", locale);
        response.headers.set("x-direction", localeConfig[locale].dir);
        return withSecurityHeaders(response);
      } else {
        tenantHomeUrl.pathname = buildOrganizationRootPath({ locale, organizationSlug: tenant.slug });
      }

      const response = NextResponse.rewrite(tenantHomeUrl, { request: { headers: requestHeaders } });
      response.headers.set("x-locale", locale);
      response.headers.set("x-direction", localeConfig[locale].dir);
      return withSecurityHeaders(response);
    }

    const legacyPlatformCapabilityPath = parseLegacyPlatformCapabilityPath(pathname);
    if (
      legacyPlatformCapabilityPath &&
      legacyPlatformCapabilityPath.slug === tenant.slug &&
      tenant.capabilities.includes(classifyPublicSurfaceCapability(legacyPlatformCapabilityPath.surface))
    ) {
      const cleanUrl = request.nextUrl.clone();
      cleanUrl.pathname = buildOrganizationPublicPath({
        locale: legacyPlatformCapabilityPath.locale,
        organizationSlug: tenant.slug,
        surface: legacyPlatformCapabilityPath.surface,
        subPath: legacyPlatformCapabilityPath.subPath,
        isCustomDomain: true,
      });
      return withSecurityHeaders(NextResponse.redirect(cleanUrl, 308));
    }

    if (tenant.capabilities.includes("SHOP") && !isReservedCustomDomainSurfaceSegment("shop", tenant.slug)) {
      const platformPath = getShopSubPathFromPlatformPath(pathname, tenant.slug);
      if (platformPath) {
        const cleanUrl = request.nextUrl.clone();
        cleanUrl.pathname = buildOrganizationPublicPath({
          locale: platformPath.locale,
          organizationSlug: tenant.slug,
          surface: "shop",
          subPath: platformPath.subPath,
          isCustomDomain: true,
        });
        return withSecurityHeaders(NextResponse.redirect(cleanUrl, 308));
      }
    }

    if (tenant.capabilities.includes("APPOINTMENT") && !isReservedCustomDomainSurfaceSegment("appointment", tenant.slug)) {
      const platformPath = getAppointmentSubPathFromPlatformPath(pathname, tenant.slug);
      if (platformPath) {
        const cleanUrl = request.nextUrl.clone();
        cleanUrl.pathname = buildOrganizationPublicPath({
          locale: platformPath.locale,
          organizationSlug: tenant.slug,
          surface: "appointment",
          subPath: platformPath.subPath,
          isCustomDomain: true,
        });
        return withSecurityHeaders(NextResponse.redirect(cleanUrl, 308));
      }
    }

    const legacyCapabilityRedirect = getLegacyCustomDomainCapabilityRedirect(pathname);
    if (legacyCapabilityRedirect) {
      const redirectedCapabilityPath = parseCustomDomainCapabilityPath(legacyCapabilityRedirect);
      const requiredCapability = redirectedCapabilityPath
        ? classifyPublicSurfaceCapability(redirectedCapabilityPath.surface)
        : null;
      if (!requiredCapability || !tenant.capabilities.includes(requiredCapability)) {
        const unavailableUrl = request.nextUrl.clone();
        unavailableUrl.pathname = `/${locale}/not-found`;
        return withSecurityHeaders(NextResponse.rewrite(unavailableUrl, { request: { headers: requestHeaders } }));
      }

      const cleanUrl = request.nextUrl.clone();
      cleanUrl.pathname = legacyCapabilityRedirect;
      return withSecurityHeaders(NextResponse.redirect(cleanUrl, 308));
    }

    const capabilityPath = parseCustomDomainCapabilityPath(pathname);
    if (capabilityPath) {
      // Path classification is syntactic; authorization remains here against
      // the capabilities returned by the trusted host resolver.
      const requiredCapability = classifyPublicSurfaceCapability(capabilityPath.surface);
      if (!tenant.capabilities.includes(requiredCapability)) {
        const unavailableUrl = request.nextUrl.clone();
        unavailableUrl.pathname = `/${locale}/not-found`;
        return withSecurityHeaders(NextResponse.rewrite(unavailableUrl, { request: { headers: requestHeaders } }));
      }
      const rewrittenUrl = request.nextUrl.clone();
      rewrittenUrl.pathname = capabilityPath.surface === "shop"
        ? buildShopPlatformPath({ locale, slug: tenant.slug, publicPathname: capabilityPath.subPath })
        : buildAppointmentPlatformPath({ locale, slug: tenant.slug, publicPathname: capabilityPath.subPath });
      return withSecurityHeaders(NextResponse.rewrite(rewrittenUrl, { request: { headers: requestHeaders } }));
    }

    const notConfiguredUrl = request.nextUrl.clone();
    notConfiguredUrl.pathname = `/${defaultLocale}/domain-not-configured`;
    return withSecurityHeaders(NextResponse.rewrite(notConfiguredUrl));
  }

  const legacyPlatformCapabilityPath = parseLegacyPlatformCapabilityPath(pathname);
  if (legacyPlatformCapabilityPath) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = buildOrganizationPublicPath({
      locale: legacyPlatformCapabilityPath.locale,
      organizationSlug: legacyPlatformCapabilityPath.slug,
      surface: legacyPlatformCapabilityPath.surface,
      subPath: legacyPlatformCapabilityPath.subPath,
    });
    return withSecurityHeaders(NextResponse.redirect(redirectUrl, 308));
  }

  // If a shop has an active primary custom domain, redirect indexable public
  // storefront URLs from the platform host to the tenant domain. Transactional
  // paths are intentionally excluded so carts/orders remain on their current
  // cookie origin and are noindexed by robots.
  const platformShopPath = parseShopPlatformPath(pathname);
  if (
    platformShopPath &&
    isSeoIndexableShopSubPath(platformShopPath.subPath) &&
    request.headers.get("x-bazar-custom-domain") !== "true"
  ) {
    const primaryDomain = await resolvePrimaryDomainForShop(request, platformShopPath.slug);

    if (primaryDomain) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.protocol = "https:";
      redirectUrl.host = primaryDomain;
      redirectUrl.pathname = buildOrganizationPublicPath({
        locale: platformShopPath.locale,
        organizationSlug: platformShopPath.slug,
        surface: "shop",
        subPath: platformShopPath.subPath,
        isCustomDomain: true,
      });
      return withSecurityHeaders(NextResponse.redirect(redirectUrl, 308));
    }
  }

  // Skip API routes, static files, and Next.js internals
  if (
    pathname.startsWith("/api") ||
    pathname.startsWith("/fa/shop") ||
    pathname.startsWith("/review") ||
    pathname.startsWith("/uploads") ||
    pathname.startsWith("/og-image") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/static") ||
    pathname.includes(".") ||
    pathname.startsWith("/auth") ||
    pathname === "/favicon.ico"
  ) {
    return withSecurityHeaders(NextResponse.next(withFooterContext(request, getPublicFooterContextForPathname(pathname))));
  }

  // Check if pathname already has locale
  const hasLocale = pathnameHasLocale(pathname);

  // If no locale is present on the platform domain, always use Persian.
  // Do not derive the first-visit locale from cookies or browser language: Bazarbaaz
  // is Persian-first, and explicit /en/... or /ar/... paths remain available.
  if (!hasLocale) {
    const locale = defaultLocale;

    // Build new URL with the Persian locale prefix
    const newPath = pathname === "/"
      ? `/${locale}`
      : `/${locale}${pathname}`;

    const newUrl = new URL(newPath, request.url);
    const response = NextResponse.redirect(newUrl);

    // Set locale cookie
    response.cookies.set("locale", locale, {
      path: appCookiePath(),
      maxAge: 60 * 60 * 24 * 365,
      httpOnly: false,
    });

    return withSecurityHeaders(response);
  }

  // Path already has locale - extract it
  const locale = pathname.split("/")[1] as Locale;
  
  // Validate locale
  if (!locales.includes(locale)) {
    const newUrl = new URL(`/${defaultLocale}${pathname}`, request.url);
    return withSecurityHeaders(NextResponse.redirect(newUrl));
  }

  // Non-dashboard routes - just set locale headers
  const response = NextResponse.next(withFooterContext(request, getPublicFooterContextForPathname(pathname)));
  
  // Set headers for downstream use
  response.headers.set("x-locale", locale);
  response.headers.set("x-direction", localeConfig[locale].dir);
  
  // Set locale cookie if not already set
  if (!request.cookies.has("locale")) {
    response.cookies.set("locale", locale, {
      path: appCookiePath(),
      maxAge: 60 * 60 * 24 * 365,
      httpOnly: false,
    });
  }

  return withSecurityHeaders(response);
}

// Export config for Next.js 16 matcher
export const config = {
  matcher: [
    "/robots.txt",
    "/sitemap.xml",
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)",
  ],
};
