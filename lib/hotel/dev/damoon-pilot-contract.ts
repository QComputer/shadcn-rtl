import type { BusinessCapability } from "@/lib/business-capability-registry";
import { BUSINESS_VERTICAL_REGISTRY } from "@/lib/business-verticals";

/**
 * Hotel Damoon pilot compatibility contract (H3-A).
 *
 * This is a **design contract**, not data. It records the capability set the
 * pilot is expected to need so H3-B/H3-D have something concrete to design
 * against, and so nobody has to re-derive it later.
 *
 * Hard rules honoured here:
 *  - **No real Hotel Damoon organization, property or record is created.**
 *  - **No capability is activated.** This is a proposal; activation is an
 *    explicit, audited `PUT /api/organizations/[id]/capabilities` action.
 *  - Every real-world hotel detail is `PENDING_HOTEL_INPUT`.
 *  - Nothing is tenant-specific in the implementation: the vertical registry is
 *    generic, and this file only describes one pilot's expectations.
 */

export const DAMOON_PILOT = {
  organizationSlug: "damoon-hotel",
  canonicalDomain: "damoon-hotel.ir",
  vertical: "HOTEL" as const,
} as const;

/**
 * Capabilities the pilot may eventually enable, grouped by dependency order.
 *
 * `HOTEL_BOOKING` does not exist in `OrganizationCapabilityKey` yet. It is
 * declared here as a string so this contract compiles against the CURRENT
 * schema; it becomes a real capability only when H3-B adds the enum value.
 * See `docs/HOTEL-PERSISTENCE-DESIGN.md` migration 1.
 */
export const DAMOON_PILOT_PROPOSED_CAPABILITIES = {
  /** Core. Requires the H3-B enum value. */
  required: ["HOTEL_BOOKING"] as const,
  /** Optional commerce and hospitality surfaces. */
  optional: ["SHOP", "APPOINTMENT", "CRM", "LOYALTY", "SEO", "VTOUR", "NOTIFICATIONS"] as const,
} as const;

/** Status of each proposed capability at the close of H3-A. */
export type ProposedCapabilityStatus =
  | "EXISTS_IN_SCHEMA"
  | "REQUIRES_MIGRATION"
  | "NOT_YET_IMPLEMENTED";

export const DAMOON_CAPABILITY_READINESS: readonly {
  readonly key: string;
  readonly status: ProposedCapabilityStatus;
  readonly note: string;
}[] = [
  {
    key: "HOTEL_BOOKING",
    status: "REQUIRES_MIGRATION",
    note: "Enum value must be added in H3-B. Not activatable before then.",
  },
  { key: "SHOP", status: "EXISTS_IN_SCHEMA", note: "Available today." },
  { key: "APPOINTMENT", status: "EXISTS_IN_SCHEMA", note: "Available today." },
  { key: "CRM", status: "EXISTS_IN_SCHEMA", note: "Capability exists; hotel integration not designed." },
  { key: "LOYALTY", status: "EXISTS_IN_SCHEMA", note: "Capability exists; hotel integration not designed." },
  {
    key: "SEO",
    status: "NOT_YET_IMPLEMENTED",
    note: "No capability key. Landing-engine metadata concern; see LANDING-ENGINE-ARCHITECTURE.md.",
  },
  {
    key: "VTOUR",
    status: "NOT_YET_IMPLEMENTED",
    note: "No capability key and no VTour integration exists in the codebase.",
  },
  {
    key: "NOTIFICATIONS",
    status: "NOT_YET_IMPLEMENTED",
    note: "Notification infrastructure exists (NotificationRouterService); no capability key.",
  },
] as const;

/** Real hotel facts still owed by the hotel. Nothing here may be invented. */
export const DAMOON_PENDING_INPUT = [
  "legal_name",
  "address_and_coordinates",
  "room_types_and_beds",
  "room_counts_and_allotment",
  "rate_plans_and_rates",
  "seasonal_calendar",
  "cancellation_policies",
  "amenities_and_facilities",
  "check_in_and_check_out_times",
  "photography",
  "vtour_scans",
  "policies_and_faq",
  "contact_details",
] as const;

export type DamoonPendingInput = (typeof DAMOON_PENDING_INPUT)[number];

export const DAMOON_PENDING_INPUT_MARKER = "PENDING_HOTEL_INPUT" as const;

/** The registry's advisory onboarding tasks for the hotel vertical. */
export const DAMOON_VERTICAL_ONBOARDING_TASKS =
  BUSINESS_VERTICAL_REGISTRY.HOTEL.onboardingTaskKeys;

/** Convenience: the real capability keys the pilot could use today. */
export const DAMOON_CAPABILITIES_AVAILABLE_TODAY: readonly BusinessCapability[] = [
  "SHOP",
  "APPOINTMENT",
];

/**
 * Explicitly asserted false by tests: this contract describes a pilot, it does
 * not create or activate anything.
 */
export function hasPilotRecordsBeenCreated(): boolean {
  return false;
}
