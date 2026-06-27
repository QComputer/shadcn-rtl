import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  buildShopPlatformPath,
  buildTenantPublicPath,
  getShopSubPathFromPlatformPath,
  isCustomDomainBypassPath,
  isPlatformHost,
  normalizeDomainHost,
  parseShopPlatformPath,
  splitLocalePrefix,
  isSeoIndexableShopSubPath,
  type ResolvedCustomDomainShop,
} from "@/lib/custom-domain-routing";

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
 * Get locale from request
 */
function getLocale(request: NextRequest): Locale {
  const pathname = request.nextUrl.pathname;

  // Check if pathname already has a locale
  if (pathnameHasLocale(pathname)) {
    const pathnameLocale = pathname.split("/")[1];
    if (locales.includes(pathnameLocale as Locale)) {
      return pathnameLocale as Locale;
    }
  }

  // Try to get locale from cookie or accept-language header
  const cookieLocale = request.cookies.get("locale")?.value;
  if (cookieLocale && locales.includes(cookieLocale as Locale)) {
    return cookieLocale as Locale;
  }

  const acceptLanguage = request.headers.get("Accept-Language");
  if (acceptLanguage) {
    const preferredLocales = acceptLanguage.split(",").map((lang) => {
      const [locale, quality] = lang.trim().split(";q=");
      return {
        locale: locale.split("-")[0],
        quality: quality ? parseFloat(quality) : 1.0
      };
    });

    preferredLocales.sort((a, b) => b.quality - a.quality);

    for (const { locale } of preferredLocales) {
      if (locales.includes(locale as Locale)) {
        return locale as Locale;
      }
    }
  }

  return defaultLocale;
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


async function resolveShopForCustomDomain(
  request: NextRequest,
  normalizedHost: string,
): Promise<ResolvedCustomDomainShop | null> {
  const resolverUrl = new URL("/api/internal/domain-resolver", request.url);
  resolverUrl.searchParams.set("host", normalizedHost);

  const resolverSecret = process.env.CUSTOM_DOMAIN_RESOLVER_SECRET || process.env.INTERNAL_API_SECRET || "";

  const response = await fetch(resolverUrl, {
    headers: resolverSecret ? { "x-internal-secret": resolverSecret } : undefined,
    cache: "no-store",
  });

  if (!response.ok) return null;

  const data = (await response.json().catch(() => null)) as ResolvedCustomDomainShop | null;
  if (!data?.slug || !data.organizationId) return null;

  return data;
}

async function resolvePrimaryDomainForShop(
  request: NextRequest,
  slug: string,
): Promise<string | null> {
  const resolverUrl = new URL("/api/internal/shop-primary-domain", request.url);
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
  shop: ResolvedCustomDomainShop,
  locale: Locale,
  publicPath: string,
) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-bazar-custom-domain", "true");
  requestHeaders.set("x-bazar-tenant-domain", normalizedHost);
  requestHeaders.set("x-bazar-tenant-slug", shop.slug);
  requestHeaders.set("x-bazar-tenant-organization-id", shop.organizationId);
  requestHeaders.set("x-bazar-tenant-public-base-url", getRequestOrigin(request));
  requestHeaders.set("x-bazar-tenant-public-locale", locale);
  requestHeaders.set("x-bazar-tenant-public-path", publicPath);
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

  // Custom shop domains are public storefront domains. They bypass the platform
  // locale redirect and are rewritten to /[locale]/shop/[slug] internally.
  if (!isPlatformHost(normalizedHost) && !isCustomDomainBypassPath(pathname)) {
    const shop = await resolveShopForCustomDomain(request, normalizedHost);

    if (!shop) {
      const locale = getLocale(request);
      const notConfiguredUrl = request.nextUrl.clone();
      notConfiguredUrl.pathname = `/${locale}/domain-not-configured`;
      return withSecurityHeaders(NextResponse.rewrite(notConfiguredUrl));
    }

    const localeForTenant = getLocale(request) || shop.locale;
    if (pathname === "/sitemap.xml" || pathname === "/robots.txt") {
      const internalUrl = request.nextUrl.clone();
      internalUrl.pathname = pathname === "/sitemap.xml"
        ? "/api/public/custom-domain/sitemap"
        : "/api/public/custom-domain/robots";
      const requestHeaders = buildTenantRewriteHeaders(
        request,
        normalizedHost,
        shop,
        localeForTenant,
        pathname,
      );
      return withSecurityHeaders(NextResponse.rewrite(internalUrl, { request: { headers: requestHeaders } }));
    }

    const platformPath = getShopSubPathFromPlatformPath(pathname, shop.slug);
    if (platformPath) {
      const cleanUrl = request.nextUrl.clone();
      cleanUrl.pathname = buildTenantPublicPath(platformPath.locale, platformPath.subPath);
      return withSecurityHeaders(NextResponse.redirect(cleanUrl, 308));
    }

    const splitPath = splitLocalePrefix(pathname);
    const locale = splitPath.locale || getLocale(request) || shop.locale;
    const rewrittenUrl = request.nextUrl.clone();
    rewrittenUrl.pathname = buildShopPlatformPath({
      locale,
      slug: shop.slug,
      publicPathname: pathname,
    });

    const requestHeaders = buildTenantRewriteHeaders(
      request,
      normalizedHost,
      shop,
      locale,
      buildTenantPublicPath(locale, splitPath.pathnameWithoutLocale),
    );

    const response = NextResponse.rewrite(rewrittenUrl, {
      request: { headers: requestHeaders },
    });
    response.headers.set("x-locale", locale);
    response.headers.set("x-direction", localeConfig[locale].dir);
    return withSecurityHeaders(response);
  }

  // If a shop has an active primary custom domain, redirect indexable public
  // storefront URLs from the platform host to the tenant domain. Transactional
  // paths are intentionally excluded so carts/orders remain on their current
  // cookie origin and are noindexed by robots.
  const platformShopPath = parseShopPlatformPath(pathname);
  if (platformShopPath && isSeoIndexableShopSubPath(platformShopPath.subPath)) {
    const primaryDomain = await resolvePrimaryDomainForShop(request, platformShopPath.slug);

    if (primaryDomain) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.protocol = "https:";
      redirectUrl.host = primaryDomain;
      redirectUrl.pathname = buildTenantPublicPath(platformShopPath.locale, platformShopPath.subPath);
      return withSecurityHeaders(NextResponse.redirect(redirectUrl, 308));
    }
  }

  // Skip API routes, static files, and Next.js internals
  if (
    pathname.startsWith("/api") ||
    pathname.startsWith("/fa/shop") ||
    pathname.startsWith("/uploads") ||
    pathname.startsWith("/og-image") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/static") ||
    pathname.includes(".") ||
    pathname.startsWith("/auth") ||
    pathname === "/favicon.ico"
  ) {
    return withSecurityHeaders(NextResponse.next());
  }

  // Check if pathname already has locale
  const hasLocale = pathnameHasLocale(pathname);

  // If no locale in path, redirect to locale-prefixed path
  if (!hasLocale) {
    const locale = getLocale(request);

    // Build new URL with locale prefix
    const newPath = pathname === "/"
      ? `/${locale}`
      : `/${locale}${pathname}`;

    const newUrl = new URL(newPath, request.url);
    const response = NextResponse.redirect(newUrl);

    // Set locale cookie
    response.cookies.set("locale", locale, {
      path: "/",
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
  const response = NextResponse.next();
  
  // Set headers for downstream use
  response.headers.set("x-locale", locale);
  response.headers.set("x-direction", localeConfig[locale].dir);
  
  // Set locale cookie if not already set
  if (!request.cookies.has("locale")) {
    response.cookies.set("locale", locale, {
      path: "/",
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
