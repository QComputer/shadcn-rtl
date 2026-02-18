import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { supportedLocales } from "@/lib/i18n";

const locales = supportedLocales;
const defaultLocale = "en";

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

  const pathnameHasLocale = locales.some(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
  );

  if (pathnameHasLocale) {
    return NextResponse.next();
  }

  const locale = getLocale(request);

  if (locale === defaultLocale) {
    return NextResponse.next();
  }

  // Redirect to localized URL
  const newUrl = new URL(`/${locale}${pathname}`, request.url);
  const response = NextResponse.redirect(newUrl);

  // Set cookie for future requests
  response.cookies.set("locale", locale as string, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365, // 1 year
    httpOnly: true,
  });

  return response;
}

export const config = {
  matcher: [
    // Skip all internal paths (_next)
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)",
  ],
};
