const CURRENT_LOCALE_ROUTE_SLUGS = [
  "appointment",
  "brand",
  "contact",
  "dashboard",
  "dashboard-showcase",
  "demo",
  "domain-not-configured",
  "external-root",
  "features",
  "login",
  "onboarding",
  "organization",
  "pricing",
  "privacy",
  "register",
  "request-demo",
  "shop",
  "terms",
  "trust",
  "visitor-choice",
] as const;

const RESERVED_AUTH_AND_PLATFORM_SLUGS = [
  "logout",
  "signin",
  "signup",
  "admin",
  "account",
  "search",
  "explore",
] as const;

const RESERVED_SYSTEM_AND_ASSET_SLUGS = [
  "api",
  "_next",
  "_bazarbaaz",
  "robots.txt",
  "sitemap.xml",
  "manifest.webmanifest",
  "assets",
  "static",
  "uploads",
] as const;

export const reservedOrganizationSlugs = [
  ...CURRENT_LOCALE_ROUTE_SLUGS,
  ...RESERVED_AUTH_AND_PLATFORM_SLUGS,
  ...RESERVED_SYSTEM_AND_ASSET_SLUGS,
] as const;

const reservedOrganizationSlugSet = new Set<string>(reservedOrganizationSlugs);

export function isReservedOrganizationSlug(value: string | null | undefined) {
  return reservedOrganizationSlugSet.has((value || "").trim().toLowerCase());
}

export function assertOrganizationSlugAllowed(value: string) {
  if (isReservedOrganizationSlug(value)) {
    throw new Error(`Organization slug "${value}" is reserved by the platform`);
  }
}
