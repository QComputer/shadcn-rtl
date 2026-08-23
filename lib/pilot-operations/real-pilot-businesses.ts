export const REAL_PILOT_BUSINESS_SLUGS = [
  "italiano-13",
  "cafe-leo",
  "aka-shoes",
  "tikal-pilot",
] as const;

export type RealPilotBusinessSlug = (typeof REAL_PILOT_BUSINESS_SLUGS)[number];

const REAL_PILOT_SLUG_SET = new Set<string>(REAL_PILOT_BUSINESS_SLUGS);

export function isRealPilotBusinessSlug(slug: string | null | undefined): slug is RealPilotBusinessSlug {
  return Boolean(slug && REAL_PILOT_SLUG_SET.has(slug));
}

