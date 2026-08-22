import type { OrganizationCapabilityKey } from "@prisma/client";

export type PlatformFeatureCategory =
  | "PUBLIC_PRESENCE"
  | "OPERATIONS"
  | "CUSTOMER_RELATIONSHIP"
  | "GROWTH"
  | "INTEGRATIONS"
  | "INTELLIGENCE";

export type PlatformFeature = {
  key: string;
  title: string;
  description: string;
  category: PlatformFeatureCategory;
  icon: string;
  ordering: number;
  relatedCapabilities: OrganizationCapabilityKey[];
  demoRoute: string;
};

export const PLATFORM_FEATURES = [
  {
    key: "digital-storefront",
    title: "Digital storefront",
    description: "Public product, category, ordering, and business profile surfaces for commerce tenants.",
    category: "PUBLIC_PRESENCE",
    icon: "Store",
    ordering: 10,
    relatedCapabilities: ["SHOP"],
    demoRoute: "/demo?journey=customer",
  },
  {
    key: "appointment-booking",
    title: "Appointment booking",
    description: "Public service discovery, staff availability, booking, and appointment tracking flows.",
    category: "OPERATIONS",
    icon: "CalendarClock",
    ordering: 20,
    relatedCapabilities: ["APPOINTMENT"],
    demoRoute: "/demo?capability=APPOINTMENT",
  },
  {
    key: "crm",
    title: "CRM",
    description: "Organization-scoped customer identity, interaction history, and customer summaries.",
    category: "CUSTOMER_RELATIONSHIP",
    icon: "UsersRound",
    ordering: 30,
    relatedCapabilities: ["CRM"],
    demoRoute: "/demo?journey=manager",
  },
  {
    key: "customer-club",
    title: "Customer club",
    description: "Membership, segmentation, loyalty, coupons, and customer engagement foundations.",
    category: "CUSTOMER_RELATIONSHIP",
    icon: "BadgePercent",
    ordering: 40,
    relatedCapabilities: ["LOYALTY", "CRM"],
    demoRoute: "/demo?feature=customer-club",
  },
  {
    key: "seo-intelligence",
    title: "SEO intelligence",
    description: "Business entity indexing, completeness checks, schema hints, and SEO opportunities.",
    category: "INTELLIGENCE",
    icon: "SearchCheck",
    ordering: 50,
    relatedCapabilities: ["SHOP", "APPOINTMENT"],
    demoRoute: "/demo?feature=seo-intelligence",
  },
  {
    key: "content-generation",
    title: "Content generation",
    description: "SEO briefs, simulated provider output, review, approval, and content asset workflows.",
    category: "GROWTH",
    icon: "FileText",
    ordering: 60,
    relatedCapabilities: ["SHOP", "APPOINTMENT"],
    demoRoute: "/demo?feature=content-generation",
  },
  {
    key: "social-presence",
    title: "Social presence",
    description: "Fanpage content, public posts, social relationships, and future distribution readiness.",
    category: "PUBLIC_PRESENCE",
    icon: "Share2",
    ordering: 70,
    relatedCapabilities: ["SHOP", "APPOINTMENT"],
    demoRoute: "/demo?feature=social-presence",
  },
  {
    key: "campaigns",
    title: "Campaigns",
    description: "Campaign planning, segmentation, coupons, delivery records, and dry-run engagement flows.",
    category: "GROWTH",
    icon: "Megaphone",
    ordering: 80,
    relatedCapabilities: ["CRM", "LOYALTY", "SMS"],
    demoRoute: "/demo?feature=campaigns",
  },
  {
    key: "ussd-conversion",
    title: "USSD conversion",
    description: "Dry-run iNoti USSD sessions, menu navigation, and payment-intent foundations.",
    category: "INTEGRATIONS",
    icon: "Hash",
    ordering: 90,
    relatedCapabilities: ["USSD"],
    demoRoute: "/demo?feature=ussd",
  },
  {
    key: "analytics",
    title: "Analytics",
    description: "Demo-only platform and tenant read models for business activity and readiness signals.",
    category: "INTELLIGENCE",
    icon: "ChartNoAxesCombined",
    ordering: 100,
    relatedCapabilities: ["SHOP", "APPOINTMENT", "CRM"],
    demoRoute: "/demo?journey=platform-admin",
  },
  {
    key: "integrations",
    title: "Integrations",
    description: "Provider adapter contracts for iMenu, iAM, iCV, EBC, USSD, SMS, and future integrations.",
    category: "INTEGRATIONS",
    icon: "Blocks",
    ordering: 110,
    relatedCapabilities: ["IAM", "ICV", "EBC", "USSD", "SMS"],
    demoRoute: "/demo?feature=integrations",
  },
] as const satisfies readonly PlatformFeature[];

export function listPlatformFeatures() {
  return [...PLATFORM_FEATURES].sort((a, b) => a.ordering - b.ordering);
}

export function listPlatformFeatureCapabilities() {
  return Array.from(new Set(listPlatformFeatures().flatMap((feature) => feature.relatedCapabilities)));
}
