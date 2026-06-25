/**
 * Dashboard RBAC route registry.
 *
 * This file is intentionally explicit. Unknown /dashboard/* children must not
 * inherit the broad /dashboard policy; every real dashboard page, including
 * dynamic pages, gets a concrete policy entry here.
 */

import type { OrganizationType, UserRole } from "./types"

export interface RouteAccessConfig {
  /** Allowed global user roles for this route. SUPER_ADMIN is always allowed. */
  allowedRoles: UserRole[]
  /** Whether this route requires an active organization membership. */
  requiresOrgMembership?: boolean
  /** Required organization types when organization membership is required. */
  requiredOrgType?: OrganizationType[]
  /** Route is available to every authenticated role. */
  isUniversal?: boolean
}

export interface UserAccessContext {
  userId: string
  userRole: UserRole
  organizationId?: string
  organizationType?: OrganizationType
}

export interface AccessCheckResult {
  hasAccess: boolean
  reason?: string
  redirectPath?: string
}

const ALL_AUTHENTICATED_ROLES: UserRole[] = [
  "SUPER_ADMIN",
  "ADMIN",
  "MANAGER",
  "STAFF",
  "DRIVER",
  "CUSTOMER",
]

const ORG_MANAGEMENT_ROLES: UserRole[] = ["ADMIN", "MANAGER"]
const APPOINTMENT_WORKFLOW_ROLES: UserRole[] = ["ADMIN", "MANAGER", "STAFF"]

/**
 * Keep this registry aligned with localized dashboard page files.
 * Dynamic route segments use the same [id] syntax as the App Router.
 */
export const dashboardRouteConfig: Record<string, RouteAccessConfig> = {
  "/dashboard": {
    allowedRoles: ALL_AUTHENTICATED_ROLES,
    isUniversal: true,
  },

  "/dashboard/settings": {
    allowedRoles: ALL_AUTHENTICATED_ROLES,
    isUniversal: true,
  },

  "/dashboard/notifications": {
    allowedRoles: ALL_AUTHENTICATED_ROLES,
    isUniversal: true,
  },

  "/dashboard/settings/organization": {
    allowedRoles: ORG_MANAGEMENT_ROLES,
    requiresOrgMembership: true,
  },

  "/dashboard/qrcode": {
    allowedRoles: ORG_MANAGEMENT_ROLES,
    requiresOrgMembership: true,
  },

  "/dashboard/organizations": {
    allowedRoles: ["SUPER_ADMIN"],
  },

  "/dashboard/organizations/new": {
    allowedRoles: ["SUPER_ADMIN"],
  },

  "/dashboard/users": {
    allowedRoles: ["SUPER_ADMIN"],
  },

  "/dashboard/members": {
    allowedRoles: ORG_MANAGEMENT_ROLES,
    requiresOrgMembership: true,
  },

  "/dashboard/customer-club": {
    allowedRoles: ORG_MANAGEMENT_ROLES,
    requiresOrgMembership: true,
  },

  "/dashboard/customer-club/members": {
    allowedRoles: ORG_MANAGEMENT_ROLES,
    requiresOrgMembership: true,
  },

  "/dashboard/customer-club/segments": {
    allowedRoles: ORG_MANAGEMENT_ROLES,
    requiresOrgMembership: true,
  },

  "/dashboard/orders": {
    allowedRoles: ORG_MANAGEMENT_ROLES,
    requiresOrgMembership: true,
    requiredOrgType: ["SHOP"],
  },

  "/dashboard/driver-orders": {
    allowedRoles: ["DRIVER"],
  },

  "/dashboard/products": {
    allowedRoles: ORG_MANAGEMENT_ROLES,
    requiresOrgMembership: true,
    requiredOrgType: ["SHOP"],
  },

  "/dashboard/products/new": {
    allowedRoles: ORG_MANAGEMENT_ROLES,
    requiresOrgMembership: true,
    requiredOrgType: ["SHOP"],
  },

  "/dashboard/products/[id]": {
    allowedRoles: ORG_MANAGEMENT_ROLES,
    requiresOrgMembership: true,
    requiredOrgType: ["SHOP"],
  },

  "/dashboard/product-categories": {
    allowedRoles: ORG_MANAGEMENT_ROLES,
    requiresOrgMembership: true,
    requiredOrgType: ["SHOP"],
  },

  "/dashboard/calendar": {
    allowedRoles: APPOINTMENT_WORKFLOW_ROLES,
    requiresOrgMembership: true,
    requiredOrgType: ["APPOINTMENT"],
  },

  "/dashboard/appointments": {
    allowedRoles: APPOINTMENT_WORKFLOW_ROLES,
    requiresOrgMembership: true,
    requiredOrgType: ["APPOINTMENT"],
  },

  "/dashboard/appointments/[id]": {
    allowedRoles: APPOINTMENT_WORKFLOW_ROLES,
    requiresOrgMembership: true,
    requiredOrgType: ["APPOINTMENT"],
  },

  "/dashboard/appointments/[id]/edit": {
    allowedRoles: APPOINTMENT_WORKFLOW_ROLES,
    requiresOrgMembership: true,
    requiredOrgType: ["APPOINTMENT"],
  },

  "/dashboard/services": {
    allowedRoles: APPOINTMENT_WORKFLOW_ROLES,
    requiresOrgMembership: true,
    requiredOrgType: ["APPOINTMENT"],
  },

  "/dashboard/services/new": {
    allowedRoles: APPOINTMENT_WORKFLOW_ROLES,
    requiresOrgMembership: true,
    requiredOrgType: ["APPOINTMENT"],
  },

  "/dashboard/services/[id]": {
    allowedRoles: APPOINTMENT_WORKFLOW_ROLES,
    requiresOrgMembership: true,
    requiredOrgType: ["APPOINTMENT"],
  },

  "/dashboard/service-categories": {
    allowedRoles: ORG_MANAGEMENT_ROLES,
    requiresOrgMembership: true,
    requiredOrgType: ["APPOINTMENT"],
  },
}

export function listDashboardRoutePatterns(): string[] {
  return Object.keys(dashboardRouteConfig).sort()
}

export function checkRouteAccess(route: string, context: UserAccessContext): AccessCheckResult {
  const normalizedRoute = normalizeRoute(route)
  const routeConfig = getRouteConfig(normalizedRoute)

  if (!normalizedRoute.startsWith("/dashboard")) {
    return {
      hasAccess: false,
      reason: "Route is outside the dashboard access boundary",
      redirectPath: getRedirectPathForRole(context.userRole),
    }
  }

  if (!routeConfig) {
    return {
      hasAccess: false,
      reason: "Dashboard route is not explicitly configured",
      redirectPath: getRedirectPathForRole(context.userRole),
    }
  }

  if (context.userRole === "SUPER_ADMIN") {
    return { hasAccess: true }
  }

  if (routeConfig.isUniversal) {
    return { hasAccess: true }
  }

  if (!routeConfig.allowedRoles.includes(context.userRole)) {
    return {
      hasAccess: false,
      reason: `Role ${context.userRole} is not allowed to access ${normalizedRoute}`,
      redirectPath: getRedirectPathForRole(context.userRole),
    }
  }

  if (routeConfig.requiresOrgMembership && !context.organizationId) {
    return {
      hasAccess: false,
      reason: "Organization membership is required for this dashboard route",
      redirectPath: "/dashboard/settings",
    }
  }

  if (routeConfig.requiredOrgType) {
    if (!context.organizationType) {
      return {
        hasAccess: false,
        reason: "Organization type is required for this dashboard route",
        redirectPath: "/dashboard/settings",
      }
    }

    if (!routeConfig.requiredOrgType.includes(context.organizationType)) {
      return {
        hasAccess: false,
        reason: `Organization type ${context.organizationType} is not allowed for ${normalizedRoute}`,
        redirectPath: getRedirectPathForRole(context.userRole),
      }
    }
  }

  return { hasAccess: true }
}

function getRouteConfig(route: string): RouteAccessConfig | null {
  if (dashboardRouteConfig[route]) {
    return dashboardRouteConfig[route]
  }

  const dynamicMatch = Object.entries(dashboardRouteConfig).find(([pattern]) =>
    routePatternMatches(pattern, route),
  )

  return dynamicMatch?.[1] ?? null
}

function routePatternMatches(pattern: string, route: string): boolean {
  const patternSegments = pattern.split("/").filter(Boolean)
  const routeSegments = route.split("/").filter(Boolean)

  if (patternSegments.length !== routeSegments.length) {
    return false
  }

  return patternSegments.every((segment, index) => {
    if (/^\[[^\]]+\]$/.test(segment)) {
      return Boolean(routeSegments[index])
    }
    return segment === routeSegments[index]
  })
}

export function normalizeRoute(route: string): string {
  let normalizedRoute = route || "/"

  const localePattern = /^\/(fa|en|ar)(?=\/|$)/
  normalizedRoute = normalizedRoute.replace(localePattern, "") || "/"

  if (normalizedRoute.endsWith("/") && normalizedRoute.length > 1) {
    normalizedRoute = normalizedRoute.slice(0, -1)
  }

  return normalizedRoute
}

export function getRedirectPathForRole(role: UserRole): string {
  switch (role) {
    case "SUPER_ADMIN":
    case "ADMIN":
    case "MANAGER":
      return "/dashboard"
    case "STAFF":
      return "/dashboard/appointments"
    case "DRIVER":
      return "/dashboard/driver-orders"
    case "CUSTOMER":
    case "GUEST":
    default:
      return "/dashboard/settings"
  }
}

export interface NavItem {
  id: string
  labelKey: string
  href: string
  icon: string
  requiredRoles?: UserRole[]
  requiredOrgType?: OrganizationType[]
  requiresOrgMembership?: boolean
  isUniversal?: boolean
}

export const dashboardNavItems: NavItem[] = [
  {
    id: "dashboard",
    labelKey: "navigation.dashboard",
    href: "/dashboard",
    icon: "LayoutDashboard",
    isUniversal: true,
  },
  {
    id: "notifications",
    labelKey: "navigation.notifications",
    href: "/dashboard/notifications",
    icon: "Bell",
    isUniversal: true,
  },
  {
    id: "orders",
    labelKey: "navigation.orders",
    href: "/dashboard/orders",
    icon: "ShoppingCart",
    requiredRoles: ORG_MANAGEMENT_ROLES,
    requiresOrgMembership: true,
    requiredOrgType: ["SHOP"],
  },
  {
    id: "products",
    labelKey: "navigation.products",
    href: "/dashboard/products",
    icon: "Package",
    requiredRoles: ORG_MANAGEMENT_ROLES,
    requiresOrgMembership: true,
    requiredOrgType: ["SHOP"],
  },
  {
    id: "product-categories",
    labelKey: "navigation.product-categories",
    href: "/dashboard/product-categories",
    icon: "FolderOpen",
    requiredRoles: ORG_MANAGEMENT_ROLES,
    requiresOrgMembership: true,
    requiredOrgType: ["SHOP"],
  },
  {
    id: "appointments",
    labelKey: "navigation.appointments",
    href: "/dashboard/appointments",
    icon: "Calendar",
    requiredRoles: APPOINTMENT_WORKFLOW_ROLES,
    requiresOrgMembership: true,
    requiredOrgType: ["APPOINTMENT"],
  },
  {
    id: "calendar",
    labelKey: "navigation.calendar",
    href: "/dashboard/calendar",
    icon: "CalendarDays",
    requiredRoles: APPOINTMENT_WORKFLOW_ROLES,
    requiresOrgMembership: true,
    requiredOrgType: ["APPOINTMENT"],
  },
  {
    id: "services",
    labelKey: "navigation.services",
    href: "/dashboard/services",
    icon: "Scissors",
    requiredRoles: APPOINTMENT_WORKFLOW_ROLES,
    requiresOrgMembership: true,
    requiredOrgType: ["APPOINTMENT"],
  },
  {
    id: "service-categories",
    labelKey: "service.categories",
    href: "/dashboard/service-categories",
    icon: "FolderOpen",
    requiredRoles: ORG_MANAGEMENT_ROLES,
    requiresOrgMembership: true,
    requiredOrgType: ["APPOINTMENT"],
  },
  {
    id: "driver-orders",
    labelKey: "navigation.orders",
    href: "/dashboard/driver-orders",
    icon: "ShoppingBag",
    requiredRoles: ["DRIVER"],
  },
  {
    id: "members",
    labelKey: "navigation.members",
    href: "/dashboard/members",
    icon: "Users",
    requiredRoles: ORG_MANAGEMENT_ROLES,
    requiresOrgMembership: true,
  },
  {
    id: "customer-club",
    labelKey: "navigation.customerClub",
    href: "/dashboard/customer-club",
    icon: "UserRoundCheck",
    requiredRoles: ORG_MANAGEMENT_ROLES,
    requiresOrgMembership: true,
  },
  {
    id: "settings",
    labelKey: "navigation.settings",
    href: "/dashboard/settings",
    icon: "Settings",
    isUniversal: true,
  },
  {
    id: "settings-organization",
    labelKey: "navigation.settingsOrganization",
    href: "/dashboard/settings/organization",
    icon: "Settings",
    requiredRoles: ORG_MANAGEMENT_ROLES,
    requiresOrgMembership: true,
  },
  {
    id: "users",
    labelKey: "navigation.users",
    href: "/dashboard/users",
    icon: "Users",
    requiredRoles: ["SUPER_ADMIN"],
  },
  {
    id: "organizations",
    labelKey: "navigation.organizations",
    href: "/dashboard/organizations",
    icon: "Building2",
    requiredRoles: ["SUPER_ADMIN"],
  },
  {
    id: "qrcode",
    labelKey: "navigation.qrcode",
    href: "/dashboard/qrcode",
    icon: "QrCode",
    requiredRoles: ORG_MANAGEMENT_ROLES,
    requiresOrgMembership: true,
  },
]

export function filterNavItems(items: NavItem[], context: UserAccessContext): NavItem[] {
  return items.filter((item) => {
    if (item.isUniversal) {
      return true
    }

    if (context.userRole === "SUPER_ADMIN") {
      return true
    }

    if (item.requiredRoles && !item.requiredRoles.includes(context.userRole)) {
      return false
    }

    if (item.requiresOrgMembership && !context.organizationId) {
      return false
    }

    if (item.requiredOrgType) {
      if (!context.organizationType) {
        return false
      }
      if (!item.requiredOrgType.includes(context.organizationType)) {
        return false
      }
    }

    return true
  })
}
