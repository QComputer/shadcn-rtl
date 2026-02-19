import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { supportedLocales } from "@/lib/i18n";

const locales = supportedLocales;
const defaultLocale = "fa";

function getLocale(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Check if pathname already has a locale
  const pathnameIsMissingLocale = locales.every(
    (locale) => !pathname.startsWith(`/${locale}/`) && pathname !== `/${locale}`
  );

  if (pathnameIsMissingLocale) {
    // Try to get locale from cookie or accept-language header
    const cookieLocale = request.cookies.get("locale")?.value;
    if (cookieLocale && locales.includes(cookieLocale as typeof locales[number])) {
      return cookieLocale;
    }

    const acceptLanguage = request.headers.get("Accept-Language");
    if (acceptLanguage) {
      const preferredLocale = acceptLanguage.split(",")[0]?.split("-")[0];
      if (preferredLocale && locales.includes(preferredLocale as typeof locales[number])) {
        return preferredLocale;
      }
    }

    return defaultLocale;
  }

  return undefined;
}

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Skip API routes, static files, and Next.js internals
  if (
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/static") ||
    pathname.includes(".") ||
    pathname.startsWith("/auth")
  ) {
    return NextResponse.next();
  }

  // Handle root path - no locale prefix needed
  if (pathname === "/") {
    return NextResponse.next();
  }

  const pathnameHasLocale = locales.some(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
  );

  // If pathname has a locale, check if the route exists
  if (pathnameHasLocale) {
    // Extract the path without locale
    const locale = pathname.split("/")[1];
    const pathWithoutLocale = "/" + pathname.split("/").slice(2).join("/");
    
    // Check if the route exists by trying to access without locale
    // For now, just pass through - Next.js will handle 404 if route doesn't exist
    return NextResponse.next();
  }

  // For now, we don't redirect to locale-prefixed URLs
  // The app handles Persian as the default language
  // This can be enhanced later with proper locale-based routing
  
  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match all paths except API routes, static files, and Next.js internals
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)",
  ],
};
