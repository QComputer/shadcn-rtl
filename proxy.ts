import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import type { UserRole, OrgMemberRole, OrganizationType } from "@/lib/types";

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

// ============================================
// Access Control Configuration
// ============================================

interface RouteAccessConfig {
  allowedRoles: UserRole[];
  requiresOrgMembership?: boolean;
  requiredOrgType?: OrganizationType[];
  requiredOrgMemberRole?: OrgMemberRole[];
  isMyOnly?: boolean;
  isUniversal?: boolean;
}

/**
 * Dashboard route access configuration
 */
const dashboardRouteConfig: Record<string, RouteAccessConfig> = {
  // Main dashboard - accessible by all authenticated users
  "/dashboard": {
    allowedRoles: ["SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF", "DRIVER", "CUSTOMER"],
  },

  // Universal access routes
  "/dashboard/settings": {
    allowedRoles: ["SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF", "DRIVER", "CUSTOMER"],
    isUniversal: true,
  },
  "/dashboard/calendar": {
    allowedRoles: ["SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF", "DRIVER", "CUSTOMER"],
    isUniversal: true,
  },

  // SUPER_ADMIN only
  "/dashboard/organizations": {
    allowedRoles: ["SUPER_ADMIN"],
  },

  // SHOP organization routes
  "/dashboard/orders": {
    allowedRoles: ["SUPER_ADMIN", "ADMIN", "MANAGER"],
    requiresOrgMembership: true,
    requiredOrgType: ["SHOP"],
    requiredOrgMemberRole: ["ADMIN", "MANAGER"],
  },
  "/dashboard/products": {
    allowedRoles: ["SUPER_ADMIN", "ADMIN", "MANAGER"],
    requiresOrgMembership: true,
    requiredOrgType: ["SHOP"],
    requiredOrgMemberRole: ["ADMIN", "MANAGER"],
  },
  "/dashboard/product-categories": {
    allowedRoles: ["SUPER_ADMIN", "ADMIN", "MANAGER"],
    requiresOrgMembership: true,
    requiredOrgType: ["SHOP"],
    requiredOrgMemberRole: ["ADMIN", "MANAGER"],
  },
  "/dashboard/customers": {
    allowedRoles: ["SUPER_ADMIN", "ADMIN", "MANAGER"],
    requiresOrgMembership: true,
    requiredOrgType: ["SHOP"],
    requiredOrgMemberRole: ["ADMIN", "MANAGER"],
  },
  "/dashboard/members": {
    allowedRoles: ["SUPER_ADMIN", "ADMIN", "MANAGER"],
    requiresOrgMembership: true,
    requiredOrgType: ["SHOP"],
    requiredOrgMemberRole: ["ADMIN", "MANAGER"],
  },

  // APPOINTMENT organization routes
  "/dashboard/appointments": {
    allowedRoles: ["SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"],
    requiresOrgMembership: true,
    requiredOrgType: ["APPOINTMENT"],
    requiredOrgMemberRole: ["ADMIN", "MANAGER", "STAFF"],
  },
  "/dashboard/services": {
    allowedRoles: ["SUPER_ADMIN", "ADMIN", "MANAGER"],
    requiresOrgMembership: true,
    requiredOrgType: ["APPOINTMENT"],
    requiredOrgMemberRole: ["ADMIN", "MANAGER"],
  },
  "/dashboard/service-categories": {
    allowedRoles: ["SUPER_ADMIN", "ADMIN", "MANAGER"],
    requiresOrgMembership: true,
    requiredOrgType: ["APPOINTMENT"],
    requiredOrgMemberRole: ["ADMIN", "MANAGER"],
  },

  // Organization details (for org members with admin/manager role)
  "/dashboard/organization-details": {
    allowedRoles: ["SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"],
    requiresOrgMembership: true,
    requiredOrgMemberRole: ["ADMIN", "MANAGER"],
  },

  // "My" routes - limited access
  "/dashboard/my-orders": {
    allowedRoles: ["SUPER_ADMIN", "CUSTOMER", "DRIVER"],
    isMyOnly: true,
  },
  "/dashboard/my-appointments": {
    allowedRoles: ["SUPER_ADMIN", "CUSTOMER", "STAFF"],
    isMyOnly: true,
  },
  "/dashboard/my-services": {
    allowedRoles: ["SUPER_ADMIN", "STAFF"],
    isMyOnly: true,
    requiresOrgMembership: true,
    requiredOrgType: ["APPOINTMENT"],
  },
};

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

/**
 * Check if path is a dashboard route
 */
function isDashboardRoute(pathname: string): boolean {
  // Remove locale prefix if present
  let path = pathname;
  for (const locale of locales) {
    if (pathname.startsWith(`/${locale}/`)) {
      path = pathname.substring(locale.length + 1);
      break;
    }
  }
  
  return path.startsWith("/dashboard");
}

/**
 * Normalize route path (remove locale prefix and trailing slash)
 */
function normalizeRoute(pathname: string): string {
  let route = pathname;
  
  // Remove locale prefix
  for (const locale of locales) {
    if (pathname.startsWith(`/${locale}/`)) {
      route = pathname.substring(locale.length + 1);
      break;
    } else if (pathname === `/${locale}`) {
      route = "/";
      break;
    }
  }
  
  // Remove trailing slash
  if (route.endsWith("/") && route.length > 1) {
    route = route.slice(0, -1);
  }
  
  return route;
}

/**
 * Get route config for a given path
 */
function getRouteConfig(route: string): RouteAccessConfig | null {
  // Direct match
  if (dashboardRouteConfig[route]) {
    return dashboardRouteConfig[route];
  }

  // Check for dynamic routes (e.g., /dashboard/orders/123)
  const routeSegments = route.split("/");
  for (let i = routeSegments.length; i > 1; i--) {
    const parentRoute = routeSegments.slice(0, i).join("/");
    if (dashboardRouteConfig[parentRoute]) {
      return dashboardRouteConfig[parentRoute];
    }
  }

  return null;
}

/**
 * Get redirect path based on user role
 */
function getRedirectPathForRole(role: UserRole, locale: Locale): string {
  switch (role) {
    case "SUPER_ADMIN":
      return `/${locale}/dashboard`;
    case "ADMIN":
    case "MANAGER":
      return `/${locale}/dashboard`;
    case "STAFF":
      return `/${locale}/dashboard/my-appointments`;
    case "DRIVER":
      return `/${locale}/dashboard/my-orders`;
    case "CUSTOMER":
      return `/${locale}/dashboard/my-orders`;
    default:
      return `/${locale}/dashboard`;
  }
}

/**
 * Check route access for a user
 */
async function checkRouteAccess(
  request: NextRequest,
  route: string,
  token: any
): Promise<{ hasAccess: boolean; redirectPath?: string }> {
  const routeConfig = getRouteConfig(route);
  
  // If no config found, allow access (will be handled by page)
  if (!routeConfig) {
    return { hasAccess: true };
  }

  const userRole = token.role as UserRole;
  
  // SUPER_ADMIN has access to everything
  if (userRole === "SUPER_ADMIN") {
    return { hasAccess: true };
  }

  // Universal routes are accessible by all authenticated users
  if (routeConfig.isUniversal) {
    return { hasAccess: true };
  }

  // Check if user role is allowed
  if (!routeConfig.allowedRoles.includes(userRole)) {
    const locale = getLocale(request);
    return {
      hasAccess: false,
      redirectPath: getRedirectPathForRole(userRole, locale),
    };
  }

  // For routes requiring organization membership, we need to check
  // This would require a database call, so we'll pass the info to the client
  // The client-side will do the full check
  // For middleware, we just check the basic role requirements
  
  // Note: Full organization membership check is done client-side
  // because middleware shouldn't make database calls for performance
  
  return { hasAccess: true };
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
    pathname.startsWith("/_next") ||
    pathname.startsWith("/static") ||
    pathname.includes(".") ||
    pathname.startsWith("/auth") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
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
      maxAge: 60 * 60 * 24 * 365, // 1 year
      httpOnly: false,
    });
    
    return response;
  }

  // Path already has locale - extract it
  const locale = pathname.split("/")[1] as Locale;
  
  // Validate locale
  if (!locales.includes(locale)) {
    const newUrl = new URL(`/${defaultLocale}${pathname}`, request.url);
    return NextResponse.redirect(newUrl);
  }

  // Check if this is a dashboard route
  const normalizedRoute = normalizeRoute(pathname);
  const isDashboard = isDashboardRoute(pathname);

  if (isDashboard) {
    // Get authentication token
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET || "development-secret-change-in-production",
    });

    // If no token, redirect to login
    if (!token) {
      const loginUrl = new URL(`/${locale}/login`, request.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Check route access
    const accessCheck = await checkRouteAccess(request, normalizedRoute, token);
    
    if (!accessCheck.hasAccess && accessCheck.redirectPath) {
      return NextResponse.redirect(new URL(accessCheck.redirectPath, request.url));
    }

    // Create response with user context headers
    const response = NextResponse.next();
    
    // Set user context headers for downstream use
    response.headers.set("x-user-id", token.id as string || "");
    response.headers.set("x-user-role", token.role as string || "");
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

    return response;
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

  return response;
}

// Export config for Next.js 16 matcher
export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)",
  ],
};
