export const DASHBOARD_ROLES = ["SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF", "DRIVER", "USER"] as const

export type DashboardRole = (typeof DASHBOARD_ROLES)[number]

export type SidebarRoleContext = {
  role?: string | null
  organizationRole?: string | null
  organizationMembershipRole?: string | null
  membershipRole?: string | null
}

export type DashboardNavigationKey =
  | "overview"
  | "notifications"
  | "notificationOperations"
  | "appointments"
  | "calendar"
  | "orders"
  | "driverOrders"
  | "products"
  | "productCategories"
  | "services"
  | "serviceCategories"
  | "members"
  | "customerClub"
  | "imports"
  | "exports"
  | "creativeStudio"
  | "settings"
  | "organizationSettings"
  | "qrcode"
  | "organizations"
  | "shopDomains"
  | "users"
  | "requestDemoLeads"

export type DashboardNavigationGroupKey = "operations" | "catalog" | "teamAndSettings" | "platformAdmin"

export const DASHBOARD_NAVIGATION_ITEMS = {
  overview: "",
  notifications: "/notifications",
  notificationOperations: "/notification-operations",
  appointments: "/appointments",
  calendar: "/calendar",
  orders: "/orders",
  driverOrders: "/driver-orders",
  products: "/products",
  productCategories: "/product-categories",
  services: "/services",
  serviceCategories: "/service-categories",
  members: "/members",
  customerClub: "/customer-club",
  imports: "/imports",
  exports: "/exports",
  creativeStudio: "/creative-studio",
  settings: "/settings",
  organizationSettings: "/settings/organization",
  qrcode: "/qrcode",
  organizations: "/organizations",
  shopDomains: "/shop-domains",
  users: "/users",
  requestDemoLeads: "/request-demo-leads",
} as const satisfies Record<DashboardNavigationKey, string>

export const DASHBOARD_NAVIGATION_GROUPS = [
  {
    key: "operations",
    items: ["overview", "notifications", "notificationOperations", "appointments", "calendar", "orders", "driverOrders"],
  },
  {
    key: "catalog",
    items: ["products", "productCategories", "services", "serviceCategories"],
  },
  {
    key: "teamAndSettings",
    items: ["members", "customerClub", "imports", "exports", "creativeStudio", "settings", "organizationSettings", "qrcode"],
  },
  {
    key: "platformAdmin",
    items: ["organizations", "shopDomains", "users", "requestDemoLeads"],
  },
] as const satisfies readonly { key: DashboardNavigationGroupKey; items: readonly DashboardNavigationKey[] }[]

const ALL_OPERATIONS_ROLES = ["SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"] as const satisfies readonly DashboardRole[]
const MANAGEMENT_ROLES = ["SUPER_ADMIN", "ADMIN", "MANAGER"] as const satisfies readonly DashboardRole[]
const ADMIN_MANAGER_ROLES = ["SUPER_ADMIN", "ADMIN", "MANAGER"] as const satisfies readonly DashboardRole[]

export const ROLE_NAVIGATION_POLICY = {
  overview: ["SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF", "DRIVER", "USER"],
  notifications: ["SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF", "DRIVER", "USER"],
  notificationOperations: ALL_OPERATIONS_ROLES,
  appointments: ALL_OPERATIONS_ROLES,
  calendar: ALL_OPERATIONS_ROLES,
  orders: ALL_OPERATIONS_ROLES,
  driverOrders: ["SUPER_ADMIN", "ADMIN", "MANAGER", "DRIVER"],
  products: ALL_OPERATIONS_ROLES,
  productCategories: ADMIN_MANAGER_ROLES,
  services: ALL_OPERATIONS_ROLES,
  serviceCategories: ADMIN_MANAGER_ROLES,
  members: MANAGEMENT_ROLES,
  customerClub: MANAGEMENT_ROLES,
  imports: MANAGEMENT_ROLES,
  exports: MANAGEMENT_ROLES,
  creativeStudio: MANAGEMENT_ROLES,
  settings: MANAGEMENT_ROLES,
  organizationSettings: MANAGEMENT_ROLES,
  qrcode: MANAGEMENT_ROLES,
  organizations: ["SUPER_ADMIN"],
  shopDomains: ["SUPER_ADMIN"],
  users: ["SUPER_ADMIN"],
  requestDemoLeads: ["SUPER_ADMIN"],
} as const satisfies Record<DashboardNavigationKey, readonly DashboardRole[]>

export const DASHBOARD_ROUTE_POLICY = {
  "": ROLE_NAVIGATION_POLICY.overview,
  "/notifications": ROLE_NAVIGATION_POLICY.notifications,
  "/notification-operations": ROLE_NAVIGATION_POLICY.notificationOperations,
  "/appointments": ROLE_NAVIGATION_POLICY.appointments,
  "/appointments/[id]": ROLE_NAVIGATION_POLICY.appointments,
  "/appointments/[id]/edit": ROLE_NAVIGATION_POLICY.appointments,
  "/calendar": ROLE_NAVIGATION_POLICY.calendar,
  "/orders": ROLE_NAVIGATION_POLICY.orders,
  "/driver-orders": ROLE_NAVIGATION_POLICY.driverOrders,
  "/products": ROLE_NAVIGATION_POLICY.products,
  "/products/new": ROLE_NAVIGATION_POLICY.products,
  "/products/[id]": ROLE_NAVIGATION_POLICY.products,
  "/product-categories": ROLE_NAVIGATION_POLICY.productCategories,
  "/services": ROLE_NAVIGATION_POLICY.services,
  "/services/new": ROLE_NAVIGATION_POLICY.services,
  "/services/[id]": ROLE_NAVIGATION_POLICY.services,
  "/service-categories": ROLE_NAVIGATION_POLICY.serviceCategories,
  "/members": ROLE_NAVIGATION_POLICY.members,
  "/customer-club": ROLE_NAVIGATION_POLICY.customerClub,
  "/customer-club/members": ROLE_NAVIGATION_POLICY.customerClub,
  "/customer-club/segments": ROLE_NAVIGATION_POLICY.customerClub,
  "/customer-club/campaigns": ROLE_NAVIGATION_POLICY.customerClub,
  "/customer-club/campaigns/new": ROLE_NAVIGATION_POLICY.customerClub,
  "/customer-club/campaigns/[id]": ROLE_NAVIGATION_POLICY.customerClub,
  "/customer-club/loyalty": ROLE_NAVIGATION_POLICY.customerClub,
  "/customer-club/coupons": ROLE_NAVIGATION_POLICY.customerClub,
  "/customer-club/push": ROLE_NAVIGATION_POLICY.customerClub,
  "/imports": ROLE_NAVIGATION_POLICY.imports,
  "/exports": ROLE_NAVIGATION_POLICY.exports,
  "/creative-studio": ROLE_NAVIGATION_POLICY.creativeStudio,
  "/settings": ROLE_NAVIGATION_POLICY.settings,
  "/settings/organization": ROLE_NAVIGATION_POLICY.organizationSettings,
  "/qrcode": ROLE_NAVIGATION_POLICY.qrcode,
  "/organizations": ROLE_NAVIGATION_POLICY.organizations,
  "/organizations/new": ROLE_NAVIGATION_POLICY.organizations,
  "/shop-domains": ROLE_NAVIGATION_POLICY.shopDomains,
  "/users": ROLE_NAVIGATION_POLICY.users,
  "/request-demo-leads": ROLE_NAVIGATION_POLICY.requestDemoLeads,
} as const satisfies Record<string, readonly DashboardRole[]>

export function normalizeDashboardRole(role: string | null | undefined): DashboardRole | null {
  if (!role) return null
  return DASHBOARD_ROLES.includes(role as DashboardRole) ? (role as DashboardRole) : null
}

export function getDashboardRoleFromUser(user: SidebarRoleContext | null | undefined): DashboardRole {
  const globalRole = normalizeDashboardRole(user?.role)
  if (globalRole === "SUPER_ADMIN") return "SUPER_ADMIN"

  return (
    normalizeDashboardRole(user?.organizationMembershipRole) ??
    normalizeDashboardRole(user?.organizationRole) ??
    normalizeDashboardRole(user?.membershipRole) ??
    globalRole ??
    "USER"
  )
}

export function isDashboardNavigationItemVisible(key: DashboardNavigationKey, role: DashboardRole): boolean {
  const allowedRoles: readonly DashboardRole[] = ROLE_NAVIGATION_POLICY[key]
  return allowedRoles.includes(role) || role === "SUPER_ADMIN"
}

export type DashboardRouteKey = keyof typeof DASHBOARD_ROUTE_POLICY

export type DashboardRouteAccessDecision = {
  isDashboardPath: boolean
  isKnownRoute: boolean
  isAllowed: boolean
  routePath: string | null
  routeKey: DashboardRouteKey | null
  role: DashboardRole
}

export function isDashboardRouteAllowed(route: DashboardRouteKey, role: DashboardRole): boolean {
  const allowedRoles: readonly DashboardRole[] = DASHBOARD_ROUTE_POLICY[route]
  return allowedRoles.includes(role) || role === "SUPER_ADMIN"
}

export function getDashboardHref(locale: string, itemHref: string): string {
  return `/${locale}/dashboard${itemHref}`
}

export function getDashboardRoutePathFromPathname(locale: string, pathname: string | null | undefined): string | null {
  if (!pathname) return null

  const [pathOnly = ""] = pathname.split(/[?#]/, 1)
  const normalizedPath = pathOnly.length > 1 ? pathOnly.replace(/\/+$/, "") : pathOnly
  const dashboardRoot = getDashboardHref(locale, "")

  if (normalizedPath === dashboardRoot) return ""
  if (!normalizedPath.startsWith(`${dashboardRoot}/`)) return null

  return normalizedPath.slice(dashboardRoot.length) || ""
}

function splitRouteSegments(route: string): string[] {
  return route.split("/").filter(Boolean)
}

export function routePatternMatches(pattern: DashboardRouteKey, route: string): boolean {
  if (pattern === route) return true

  const patternSegments = splitRouteSegments(pattern)
  const routeSegments = splitRouteSegments(route)

  if (patternSegments.length !== routeSegments.length) return false

  return patternSegments.every((segment, index) => {
    const routeSegment = routeSegments[index]
    return (segment.startsWith("[") && segment.endsWith("]")) || segment === routeSegment
  })
}

export function getDashboardRouteKey(routePath: string | null | undefined): DashboardRouteKey | null {
  if (routePath === null || typeof routePath === "undefined") return null

  const normalizedRoute = routePath === "/" ? "" : routePath.replace(/\/+$/, "")
  const directRoute = normalizedRoute as DashboardRouteKey

  if (directRoute in DASHBOARD_ROUTE_POLICY) return directRoute

  return (Object.keys(DASHBOARD_ROUTE_POLICY) as DashboardRouteKey[]).find((candidate) =>
    routePatternMatches(candidate, normalizedRoute),
  ) ?? null
}

export function getDashboardRouteKeyFromPathname(locale: string, pathname: string | null | undefined): DashboardRouteKey | null {
  return getDashboardRouteKey(getDashboardRoutePathFromPathname(locale, pathname))
}

export function getDashboardRouteAccessDecision({
  locale,
  pathname,
  role,
}: {
  locale: string
  pathname: string | null | undefined
  role: DashboardRole
}): DashboardRouteAccessDecision {
  const routePath = getDashboardRoutePathFromPathname(locale, pathname)

  if (routePath === null) {
    return {
      isDashboardPath: false,
      isKnownRoute: false,
      isAllowed: true,
      routePath: null,
      routeKey: null,
      role,
    }
  }

  const routeKey = getDashboardRouteKey(routePath)

  return {
    isDashboardPath: true,
    isKnownRoute: routeKey !== null,
    isAllowed: routeKey !== null ? isDashboardRouteAllowed(routeKey, role) : false,
    routePath,
    routeKey,
    role,
  }
}
