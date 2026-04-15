/**
 * Access Control Configuration
 * 
 * This module defines the role-based access control (RBAC) system for the dashboard.
 * It includes route access rules, permission checking functions, and organization-based access control.
 */

import type { UserRole, OrganizationType } from "./types"

// ============================================
// Types and Interfaces
// ============================================

export interface RouteAccessConfig {
  /** Allowed user roles for this route */
  allowedRoles: UserRole[]
  /** Whether this route requires organization membership */
  requiresOrgMembership?: boolean
  /** Required organization types (if org membership is required) */
  requiredOrgType?: OrganizationType[]
  /** Required organization member roles (if org membership is required) */
  //requiredOrgMemberRole?: OrgMemberRole[]
  /** Whether this is a "my only" route (e.g., my-orders, my-appointments) */
  isMyOnly?: boolean
  /** Routes that are universally accessible regardless of role */
  isUniversal?: boolean
}

export interface UserAccessContext {
  userId: string
  userRole: UserRole
  organizationId?: string
  organizationType?: OrganizationType
  //orgMemberRole?: OrgMemberRole
}

export interface AccessCheckResult {
  hasAccess: boolean
  reason?: string
  redirectPath?: string
}


// ============================================
// Dashboard Route Configuration
// ============================================

/**
 * Complete dashboard route access configuration
 * Based on the permission structure specified in requirements
 */
export const dashboardRouteConfig: Record<string, RouteAccessConfig> = {
  // Main dashboard - accessible by all authenticated users
  "/dashboard": {
    allowedRoles: [
      "SUPER_ADMIN",
      "ADMIN",
      "MANAGER",
      "STAFF",
      "DRIVER",
      "CUSTOMER",
    ],
    isUniversal: true,
  },

  // ============================================
  // Universal Access Routes (All Roles)
  // ============================================

  // Settings - Universal access
  "/dashboard/settings": {
    allowedRoles: [
      "SUPER_ADMIN",
      "ADMIN",
      "MANAGER",
      "STAFF",
      "DRIVER",
      "CUSTOMER",
    ],
    isUniversal: true,
  },

  // Calendar - Universal access
  "/dashboard/calendar": {
    allowedRoles: [
      "SUPER_ADMIN",
      "ADMIN",
      "MANAGER",
      "STAFF",
      "DRIVER",
      "CUSTOMER",
    ],
    isUniversal: true,
  },

  // ============================================
  // SUPER_ADMIN Routes
  // ============================================

  // Organizations management - SUPER_ADMIN only
  "/dashboard/organizations": {
    allowedRoles: ["SUPER_ADMIN"],
  },

  // ============================================
  // SHOP Organization Routes
  // ============================================

  // Orders - SHOP org admins/managers
  "/dashboard/orders": {
    allowedRoles: ["SUPER_ADMIN", "ADMIN", "MANAGER"],
    requiresOrgMembership: true,
    requiredOrgType: ["SHOP"],
    //requiredOrgMemberRole: ["ADMIN", "MANAGER"],
  },

  // Products - SHOP org admins/managers
  "/dashboard/products": {
    allowedRoles: ["SUPER_ADMIN", "ADMIN", "MANAGER"],
    requiresOrgMembership: true,
    requiredOrgType: ["SHOP"],
    //requiredOrgMemberRole: ["ADMIN", "MANAGER"],
  },

  // Product Categories - SHOP org admins/managers
  "/dashboard/product-categories": {
    allowedRoles: ["SUPER_ADMIN", "ADMIN", "MANAGER"],
    requiresOrgMembership: true,
    requiredOrgType: ["SHOP"],
    //requiredOrgMemberRole: ["ADMIN", "MANAGER"],
  },

  // Customers - SHOP org admins/managers
  "/dashboard/customers": {
    allowedRoles: ["SUPER_ADMIN", "ADMIN", "MANAGER"],
    requiresOrgMembership: true,
    requiredOrgType: ["SHOP"],
    //requiredOrgMemberRole: ["ADMIN", "MANAGER"],
  },

  // Members - SHOP org admins/managers
  "/dashboard/members": {
    allowedRoles: ["SUPER_ADMIN", "ADMIN", "MANAGER"],
    requiresOrgMembership: true,
    requiredOrgType: ["SHOP"],
    //requiredOrgMemberRole: ["ADMIN", "MANAGER"],
  },

  // ============================================
  // APPOINTMENT Organization Routes
  // ============================================

  // Appointments - APPOINTMENT org admins/managers
  "/dashboard/appointments": {
    allowedRoles: ["SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"],
    requiresOrgMembership: true,
    requiredOrgType: ["APPOINTMENT"],
    //requiredOrgMemberRole: ["ADMIN", "MANAGER"],
  },

  // Services - APPOINTMENT org admins/managers/staff
  "/dashboard/services": {
    allowedRoles: ["SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"],
    requiresOrgMembership: true,
    requiredOrgType: ["APPOINTMENT"],
    //requiredOrgMemberRole: ["ADMIN", "MANAGER", "STAFF"],
  },

  // Service Categories - APPOINTMENT org admins/managers/staff
  "/dashboard/service-categories": {
    allowedRoles: ["SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"],
    requiresOrgMembership: true,
    requiredOrgType: ["APPOINTMENT"],
    //requiredOrgMemberRole: ["ADMIN", "MANAGER", "STAFF"],
  },

  // ============================================
  // STAFF with ADMIN/MANAGER role in APPOINTMENT org
  // ============================================

  // Special access for STAFF with elevated org role
  "/dashboard/organization-details": {
    allowedRoles: ["SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"],
    requiresOrgMembership: true,
    //requiredOrgMemberRole: ["ADMIN", "MANAGER"],
  },

  // ============================================
  // "My" Routes - Limited Access
  // ============================================

  // My Orders - CUSTOMER and DRIVER
  "/dashboard/my-orders": {
    allowedRoles: ["SUPER_ADMIN", "CUSTOMER"],
    isMyOnly: true,
  },

  // Driver Orders -  DRIVER
  "/dashboard/driver-orders": {
    allowedRoles: ["DRIVER"],
    //isMyOnly: true,
  },

  // My Appointments - CUSTOMER and STAFF/ADMIN/MANAGER (APPOINTMENT org member)
  "/dashboard/my-appointments": {
    allowedRoles: ["CUSTOMER", "STAFF"],
    isMyOnly: true,
    requiredOrgType: ["APPOINTMENT"],
  },

  // My Services - STAFF/ADMIN/MANAGER (APPOINTMENT org member)
  "/dashboard/my-services": {
    allowedRoles: ["SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"],
    isMyOnly: true,
    requiresOrgMembership: true,
    requiredOrgType: ["APPOINTMENT"],
  },
};

// ============================================
// Access Check Functions
// ============================================

/**
 * Check if a user has access to a specific route
 */
export function checkRouteAccess(
  route: string,
  context: UserAccessContext
): AccessCheckResult {
  // Normalize route (remove trailing slash, locale prefix)
  const normalizedRoute = normalizeRoute(route)
  
  // Get route config
  const routeConfig = getRouteConfig(normalizedRoute)
  
  // If no config found, deny access by default
  if (!routeConfig) {
    return {
      hasAccess: false,
      reason: "Route not found in access control configuration",
      redirectPath: "/dashboard",
    }
  }

  // SUPER_ADMIN has access to everything
  if (context.userRole === "SUPER_ADMIN") {
    return { hasAccess: true }
  }

  // Check if route is universal (all authenticated users)
  if (routeConfig.isUniversal) {
    return { hasAccess: true }
  }

  // Check if user role is allowed
  if (!routeConfig.allowedRoles.includes(context.userRole)) {
    return {
      hasAccess: false,
      reason: `Role ${context.userRole} is not allowed to access this route`,
      redirectPath: getRedirectPathForRole(context.userRole),
    }
  }

  // Check organization membership if required
  if (routeConfig.requiresOrgMembership) {
    if (!context.organizationId) {
      return {
        hasAccess: false,
        reason: "Organization membership required",
        redirectPath: "/dashboard",
      }
    }

    // Check organization type
    if (routeConfig.requiredOrgType && context.organizationType) {
      if (!routeConfig.requiredOrgType.includes(context.organizationType)) {
        return {
          hasAccess: false,
          reason: `Organization type ${context.organizationType} is not allowed`,
          redirectPath: getRedirectPathForRole(context.userRole),
        }
      }
    }

    // Check organization member role
    //if (routeConfig.requiredOrgMemberRole && context.orgMemberRole) {
    //  if (!routeConfig.requiredOrgMemberRole.includes(context.orgMemberRole)) {
    //    return {
    //      hasAccess: false,
    //      reason: `Organization member role ${context.orgMemberRole} is not allowed`,
    //      redirectPath: getRedirectPathForRole(context.userRole),
    //    }
    //  }
    //}
  }

  // All checks passed
  return { hasAccess: true }
}

/**
 * Get route configuration, including wildcard matching
 */
function getRouteConfig(route: string): RouteAccessConfig | null {
  // Direct match
  if (dashboardRouteConfig[route]) {
    return dashboardRouteConfig[route]
  }

  // Check for dynamic routes (e.g., /dashboard/orders/123)
  const routeSegments = route.split("/")
  for (let i = routeSegments.length; i > 1; i--) {
    const parentRoute = routeSegments.slice(0, i).join("/")
    if (dashboardRouteConfig[parentRoute]) {
      return dashboardRouteConfig[parentRoute]
    }
  }

  return null
}

/**
 * Normalize route path
 */
function normalizeRoute(route: string): string {
  // Remove locale prefix
  const localePattern = /^\/(fa|en|ar)(\/.*)?$/
  const match = route.match(localePattern)
  if (match) {
    route = match[2] || "/dashboard"
  }

  // Remove trailing slash
  if (route.endsWith("/") && route.length > 1) {
    route = route.slice(0, -1)
  }

  return route
}

/**
 * Get redirect path based on user role
 */
function getRedirectPathForRole(role: UserRole): string {
  switch (role) {
    case "SUPER_ADMIN":
      return "/dashboard"
    case "ADMIN":
    case "MANAGER":
      return "/dashboard"
    case "STAFF":
      return "/dashboard/my-appointments"
    case "DRIVER":
      return "/dashboard/driver-orders"
    case "CUSTOMER":
      return "/dashboard/my-orders"
    default:
      return "/dashboard"
  }
}

// ============================================
// Navigation Configuration
// ============================================

export interface NavItem {
  id: string
  labelKey: string
  href: string
  icon: string
  requiredRoles?: UserRole[]
  requiredOrgType?: OrganizationType[]
  //requiredOrgMemberRole?: OrgMemberRole[]
  isUniversal?: boolean
}

/**
 * Dashboard navigation items with access control
 */
export const dashboardNavItems: NavItem[] = [
  {
    id: "dashboard",
    labelKey: "navigation.dashboard",
    href: "/dashboard",
    icon: "LayoutDashboard",
  },
  {
    id: "orders",
    labelKey: "navigation.orders",
    href: "/dashboard/orders",
    icon: "ShoppingCart",
    requiredRoles: ["SUPER_ADMIN", "ADMIN", "MANAGER"],
    requiredOrgType: ["SHOP"],
    //requiredOrgMemberRole: ["ADMIN", "MANAGER"],
  },
  {
    id: "products",
    labelKey: "navigation.products",
    href: "/dashboard/products",
    icon: "Package",
    requiredRoles: ["SUPER_ADMIN", "ADMIN", "MANAGER"],
    requiredOrgType: ["SHOP"],
    //requiredOrgMemberRole: ["ADMIN", "MANAGER"],
  },
  {
    id: "product-categories",
    labelKey: "navigation.product-categories",
    href: "/dashboard/product-categories",
    icon: "FolderOpen",
    requiredRoles: ["SUPER_ADMIN", "ADMIN", "MANAGER"],
    requiredOrgType: ["SHOP"],
    //requiredOrgMemberRole: ["ADMIN", "MANAGER"],
  },
  {
    id: "appointments",
    labelKey: "navigation.appointments",
    href: "/dashboard/appointments",
    icon: "Calendar",
    requiredRoles: ["SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"],
    requiredOrgType: ["APPOINTMENT"],
    //requiredOrgMemberRole: ["ADMIN", "MANAGER"],
  },
  {
    id: "services",
    labelKey: "navigation.services",
    href: "/dashboard/services",
    icon: "Scissors",
    requiredRoles: ["SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"],
    requiredOrgType: ["APPOINTMENT"],
    //requiredOrgMemberRole: ["ADMIN", "MANAGER", "STAFF"],
  },
  {
    id: "service-categories",
    labelKey: "service.categories",
    href: "/dashboard/service-categories",
    icon: "FolderOpen",
    requiredRoles: ["SUPER_ADMIN", "ADMIN", "MANAGER"],
    requiredOrgType: ["APPOINTMENT"],
    //requiredOrgMemberRole: ["ADMIN", "MANAGER"],
  },
  {
    id: "customers",
    labelKey: "navigation.customers",
    href: "/dashboard/customers",
    icon: "Users",
    requiredRoles: ["SUPER_ADMIN"],
    requiredOrgType: ["SHOP"],
    //requiredOrgMemberRole: ["ADMIN", "MANAGER"],
  },
  {
    id: "driver-orders",
    labelKey: "navigation.orders",
    href: "/dashboard/driver-orders",
    icon: "ShoppingBag",
    requiredRoles: ["CUSTOMER", "DRIVER"],
  },

  {
    id: "my-orders",
    labelKey: "navigation.myOrders",
    href: "/dashboard/my-orders",
    icon: "ShoppingBag",
    requiredRoles: ["CUSTOMER", "SUPER_ADMIN"],
  },
  {
    id: "my-appointments",
    labelKey: "navigation.myAppointments",
    href: "/dashboard/my-appointments",
    icon: "CalendarDays",
    requiredRoles: ["CUSTOMER"],
  },

  {
    id: "calendar",
    labelKey: "navigation.calendar",
    href: "/dashboard/calendar",
    icon: "Calendar",
    requiredRoles: ["SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"],
  },
  {
    id: "settings",
    labelKey: "navigation.settings",
    href: "/dashboard/settings",
    icon: "Settings",
    isUniversal: true,
  },
];

/**
 * Filter navigation items based on user context
 */
export function filterNavItems(
  items: NavItem[],
  context: UserAccessContext
): NavItem[] {
  return items.filter((item) => {
    // Universal items are always visible
    if (item.isUniversal) {
      return true
    }

    // SUPER_ADMIN sees everything
    if (context.userRole === "SUPER_ADMIN") {
      return true
    }

    // Check role requirement
    if (item.requiredRoles && !item.requiredRoles.includes(context.userRole)) {
      return false
    }

    // Check org type requirement
    if (item.requiredOrgType && context.organizationType) {
      if (!item.requiredOrgType.includes(context.organizationType)) {
        return false
      }
    }
    return true
  })
}

// ============================================
// Permission Helpers
// ============================================

/**
 * Check if user can manage orders
 */
export function canManageOrders(context: UserAccessContext): boolean {
  if (context.userRole === "SUPER_ADMIN") return true
  
  if (["ADMIN", "MANAGER"].includes(context.userRole)) {
    if (context.organizationType === "SHOP" && context.userRole) {
      return ["ADMIN", "MANAGER"].includes(context.userRole)
    }
  }
  
  return false
}

/**
 * Check if user can manage products
 */
export function canManageProducts(context: UserAccessContext): boolean {
  if (context.userRole === "SUPER_ADMIN") return true
  
  if (["ADMIN", "MANAGER"].includes(context.userRole)) {
    if (context.organizationType === "SHOP" && context.userRole) {
      return ["ADMIN", "MANAGER"].includes(context.userRole)
    }
  }
  
  return false
}

/**
 * Check if user can manage appointments
 */
export function canManageAppointments(context: UserAccessContext): boolean {
  if (context.userRole === "SUPER_ADMIN") return true
  
  if (["ADMIN", "MANAGER", "STAFF"].includes(context.userRole)) {
    if (context.organizationType === "APPOINTMENT" && context.userRole) {
      return ["ADMIN", "MANAGER", "STAFF"].includes(context.userRole)
    }
  }
  
  return false
}

/**
 * Check if user can manage services
 */
export function canManageServices(context: UserAccessContext): boolean {
  if (context.userRole === "SUPER_ADMIN") return true
  
  if (["ADMIN", "MANAGER"].includes(context.userRole)) {
    if (context.organizationType === "APPOINTMENT" && context.userRole) {
      return ["ADMIN", "MANAGER"].includes(context.userRole)
    }
  }
  
  return false
}

/**
 * Check if user can view their own orders
 */
export function canViewMyOrders(context: UserAccessContext): boolean {
  return ["SUPER_ADMIN", "CUSTOMER", "DRIVER"].includes(context.userRole)
}

/**
 * Check if user can view driver orders
 */
export function canViewDriverOrders(context: UserAccessContext): boolean {
  return [ "DRIVER"].includes(context.userRole)
}

/**
 * Check if user can view their own appointments
 */
export function canViewMyAppointments(context: UserAccessContext): boolean {
  return ["SUPER_ADMIN", "CUSTOMER", "STAFF"].includes(context.userRole)
}

/**
 * Check if user can view their own services
 */
export function canViewMyServices(context: UserAccessContext): boolean {
  if (context.userRole === "SUPER_ADMIN") return true
  
  if (context.userRole === "STAFF") {
    return context.organizationType === "APPOINTMENT"
  }
  
  return false
}
