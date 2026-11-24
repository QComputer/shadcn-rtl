import { normalizeDomainHost } from "@/lib/custom-domain-routing";

/** Public demo data is isolated in a dedicated property inside the Damoon tenant. */
export const DAMOON_DEMO_BOOKING = Object.freeze({
  mode: "DEMO_BOOKING" as const,
  enabled: true,
  organizationSlug: "damoon-hotel",
  propertySlug: "damoon-demo",
  hosts: ["damoon-hotel.ir", "www.damoon-hotel.ir"] as const,
});

export function isDamoonDemoOrganizationSlug(slug: string | null | undefined) {
  return slug === DAMOON_DEMO_BOOKING.organizationSlug
    || (process.env.DAMOON_E2E_ENABLED === "1" && process.env.NODE_ENV !== "production" && (process.env.NODE_ENV === "test" || process.env.DAMOON_LOCAL_E2E === "1") && /^damoon-e2e-[a-f0-9]+-a$/.test(slug || ""));
}
export function isDamoonDemoBookingRequest(input: {
  readonly host: string | null | undefined;
  readonly organizationSlug: string | null | undefined;
  readonly propertySlug: string | null | undefined;
}) {
  if (!DAMOON_DEMO_BOOKING.enabled || !isDamoonDemoOrganizationSlug(input.organizationSlug) || input.propertySlug !== DAMOON_DEMO_BOOKING.propertySlug) return false;
  return (DAMOON_DEMO_BOOKING.hosts as readonly string[]).includes(normalizeDomainHost(input.host));
}

/** Build the public demo entry only on an explicitly approved Damoon host. */
export function damoonDemoBookingUrl(locale: string) {
  if (!DAMOON_DEMO_BOOKING.enabled || !(locale === "fa" || locale === "en" || locale === "ar")) return null;
  const host = DAMOON_DEMO_BOOKING.hosts[0];
  return new URL(`/${locale}/hotel-reservations/start?mode=${DAMOON_DEMO_BOOKING.mode}`, `https://${host}`).toString();
}
