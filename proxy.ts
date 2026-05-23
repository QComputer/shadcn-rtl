import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

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
  ["Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()"],
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

// ============================================
// Main Middleware Function
// ============================================

/**
 * Main proxy/middleware function for Next.js 16
 * Handles locale detection, routing, authentication, and access control
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip API routes, static files, and Next.js internals
  if (
    pathname.startsWith("/api") ||
    pathname.startsWith("/fa/shop") ||
    pathname.startsWith("/uploads") ||
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
    const locale = 'fa'//getLocale(request);
    
    // Build new URL with locale prefix
    const newPath = pathname === "/" 
      ? `/${locale}` 
      : `/${locale}${pathname}`;
    
    const newUrl = new URL(newPath, request.url);
    const response = NextResponse.redirect(newUrl);
    
    // Set locale cookie
    response.cookies.set("locale", locale, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365, // 1 year
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
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)",
  ],
};
