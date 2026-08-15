export const BUSINESS_CAPABILITIES = ["SHOP", "APPOINTMENT"] as const

export type BusinessCapability = (typeof BUSINESS_CAPABILITIES)[number]

type CapabilityDefinition = {
  dashboardNavigation: readonly string[]
  dashboardRoutes: readonly string[]
  publicSurface: "shop" | "appointment"
}

/**
 * Small, explicit registry for business surfaces. Plans, permissions and
 * rollout flags deliberately do not belong here.
 */
export const BUSINESS_CAPABILITY_REGISTRY = {
  SHOP: {
    dashboardNavigation: ["orders", "driverOrders", "products", "productCategories"],
    dashboardRoutes: ["/orders", "/driver-orders", "/products", "/product-categories"],
    publicSurface: "shop",
  },
  APPOINTMENT: {
    dashboardNavigation: ["appointments", "calendar", "services", "serviceCategories"],
    dashboardRoutes: ["/appointments", "/calendar", "/services", "/service-categories"],
    publicSurface: "appointment",
  },
} as const satisfies Record<BusinessCapability, CapabilityDefinition>

export function requiredCapabilityForNavigation(key: string): BusinessCapability | null {
  return BUSINESS_CAPABILITIES.find((capability) =>
    (BUSINESS_CAPABILITY_REGISTRY[capability].dashboardNavigation as readonly string[]).includes(key),
  ) ?? null
}

export function requiredCapabilityForDashboardRoute(routePath: string): BusinessCapability | null {
  return BUSINESS_CAPABILITIES.find((capability) =>
    BUSINESS_CAPABILITY_REGISTRY[capability].dashboardRoutes.some(
      (prefix) => routePath === prefix || routePath.startsWith(`${prefix}/`),
    ),
  ) ?? null
}
