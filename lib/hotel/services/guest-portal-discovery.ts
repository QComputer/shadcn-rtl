import { DAMOON_DEMO_BOOKING, isDamoonDemoOrganizationSlug } from "./damoon-demo-booking";

export type GuestPortalCandidateProperty = { id: string; slug: string };

/** Legacy discovery may select one operational property, but never guesses between several. */
export function resolveGuestPortalPropertyId(organizationSlug: string, properties: readonly GuestPortalCandidateProperty[]) {
  const operational = properties.filter((property) =>
    !(isDamoonDemoOrganizationSlug(organizationSlug) && property.slug === DAMOON_DEMO_BOOKING.propertySlug),
  );
  return operational.length === 1 ? operational[0]!.id : null;
}
