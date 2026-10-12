import { BUSINESS_CAPABILITIES, type BusinessCapability } from "@/lib/business-capability-registry";

/**
 * Business Vertical foundation (H3-A).
 *
 * A **Business Vertical** answers "what kind of business is this?". It is
 * deliberately INDEPENDENT of the other two axes:
 *
 *   Vertical          → taxonomy / onboarding / analytics grouping
 *   Capability        → which functionality is actually enabled
 *   Page template     → how the public site looks
 *
 * Consequences that are intentional:
 *
 *  - A vertical NEVER grants a capability. `suggestedCapabilities` is advisory
 *    onboarding metadata; activation stays an explicit, audited action through
 *    `PUT /api/organizations/[id]/capabilities`.
 *  - A vertical is optional. An organization with no vertical is valid, as is
 *    one with no enabled capability.
 *  - Nothing here is tenant-specific. There is no `if (slug === ...)`.
 *
 * PERSISTENCE: this module is pure and imports no Prisma. Organization vertical
 * persistence is defined in `prisma/schema.prisma` and introduced by the shared
 * vertical migration; persistence adapters map it into this domain contract.
 */

export const BUSINESS_VERTICALS = [
  "RESTAURANT",
  "SHOE_STORE",
  "CLOTHING_STORE",
  "PHARMACY",
  "SUPERMARKET",
  "FLORIST",
  "HOTEL",
] as const;

export type BusinessVertical = (typeof BUSINESS_VERTICALS)[number];

export type BusinessVerticalDefinition = {
  readonly key: BusinessVertical;
  /** Stable, non-localized label for dashboards and exports. */
  readonly label: string;
  /**
   * Advisory capability suggestions for onboarding. NEVER authoritative.
   * Must be a subset of known capability keys.
   */
  readonly suggestedCapabilities: readonly BusinessCapability[];
  readonly onboardingTaskKeys: readonly string[];
};

export const BUSINESS_VERTICAL_REGISTRY = {
  RESTAURANT: {
    key: "RESTAURANT",
    label: "Restaurant",
    suggestedCapabilities: ["APPOINTMENT"],
    onboardingTaskKeys: ["menu", "opening-hours", "reservations"],
  },
  SHOE_STORE: {
    key: "SHOE_STORE",
    label: "Shoe store",
    suggestedCapabilities: ["SHOP"],
    onboardingTaskKeys: ["catalog", "sizes", "branding"],
  },
  CLOTHING_STORE: {
    key: "CLOTHING_STORE",
    label: "Clothing store",
    suggestedCapabilities: ["SHOP"],
    onboardingTaskKeys: ["catalog", "sizes", "branding"],
  },
  PHARMACY: {
    key: "PHARMACY",
    label: "Pharmacy",
    suggestedCapabilities: ["SHOP"],
    onboardingTaskKeys: ["catalog", "opening-hours", "compliance"],
  },
  SUPERMARKET: {
    key: "SUPERMARKET",
    label: "Supermarket",
    suggestedCapabilities: ["SHOP"],
    onboardingTaskKeys: ["catalog", "inventory", "opening-hours"],
  },
  FLORIST: {
    key: "FLORIST",
    label: "Florist",
    suggestedCapabilities: ["SHOP", "APPOINTMENT"],
    onboardingTaskKeys: ["catalog", "delivery", "seasonal-campaigns"],
  },
  HOTEL: {
    key: "HOTEL",
    label: "Hotel",
    suggestedCapabilities: ["APPOINTMENT"],
    onboardingTaskKeys: ["property", "rooms", "policies"],
  },
} as const satisfies Record<BusinessVertical, BusinessVerticalDefinition>;

export function isBusinessVertical(value: unknown): value is BusinessVertical {
  return typeof value === "string" && (BUSINESS_VERTICALS as readonly string[]).includes(value);
}

/**
 * Tolerant parse. An unknown value is `null`, never a guessed fallback — a
 * future vertical written by a newer deploy must not silently degrade into an
 * existing one.
 */
export function parseBusinessVertical(value: unknown): BusinessVertical | null {
  return isBusinessVertical(value) ? value : null;
}

export function listBusinessVerticals(): readonly BusinessVertical[] {
  return [...BUSINESS_VERTICALS];
}

export function getBusinessVerticalDefinition(
  vertical: BusinessVertical,
): BusinessVerticalDefinition {
  return BUSINESS_VERTICAL_REGISTRY[vertical];
}

/** The legacy `Organization.type` values that exist today. */
export type LegacyOrganizationType = "SHOP" | "APPOINTMENT";

/**
 * Explicitly refuses to infer a vertical from the legacy type.
 *
 * `SHOP` covers shoe stores, clothing stores, pharmacies, supermarkets and
 * florists. Mapping all of them to one vertical would be wrong, and picking
 * "most likely" would invent data. `APPOINTMENT` is equally ambiguous
 * (restaurant, hotel, spa, clinic).
 *
 * Returning `null` is the correct, honest answer: the vertical stays unset
 * until an operator or an onboarding flow assigns one.
 */
export function inferBusinessVerticalFromLegacyType(
  legacyType: LegacyOrganizationType | null | undefined,
): BusinessVertical | null {
  // Written as an exhaustive switch on purpose: the parameter is genuinely
  // unused, and enumerating the cases makes "we refuse to infer" explicit to
  // the next reader rather than looking like an oversight.
  switch (legacyType) {
    case "SHOP":
    case "APPOINTMENT":
    case null:
    case undefined:
    default:
      return null;
  }
}

export type BusinessVerticalResolutionSource = "EXPLICIT" | "UNASSIGNED";

export type BusinessVerticalResolution = {
  /** The assigned vertical, or `null` when none is assigned. */
  readonly vertical: BusinessVertical | null;
  readonly source: BusinessVerticalResolutionSource;
  /**
   * True when a legacy organization predates vertical assignment. Callers use
   * this to prompt for onboarding; it is never used to deny access.
   */
  readonly isLegacyUnassigned: boolean;
  /** Active capability keys resolved by the caller (NOT derived from vertical). */
  readonly activeCapabilities: readonly string[];
};

export type ResolveBusinessVerticalInput = {
  /** Raw persisted value. Null/undefined/unknown-string are all tolerated. */
  readonly vertical?: unknown;
  readonly legacyType?: LegacyOrganizationType | string | null;
  /** Resolved elsewhere by `effectiveOrganizationCapabilities`. */
  readonly activeCapabilities?: readonly string[] | null;
};

/**
 * Single entry point for resolving an organization's vertical.
 *
 * Deliberately does NOT read capabilities to guess a vertical, and does NOT
 * return capabilities as a function of the vertical. The two axes stay
 * independent all the way through.
 */
export function resolveBusinessVertical(
  input: ResolveBusinessVerticalInput,
): BusinessVerticalResolution {
  const vertical = parseBusinessVertical(input.vertical);
  const activeCapabilities = (input.activeCapabilities ?? []).filter(
    (key): key is string => typeof key === "string" && key.length > 0,
  );

  if (vertical) {
    return { vertical, source: "EXPLICIT", isLegacyUnassigned: false, activeCapabilities };
  }

  return {
    vertical: null,
    source: "UNASSIGNED",
    isLegacyUnassigned: input.legacyType !== undefined && input.legacyType !== null,
    activeCapabilities,
  };
}

/**
 * Advisory onboarding suggestions. Explicitly separated from activation so no
 * caller can mistake one for the other.
 */
export function suggestCapabilitiesForVertical(
  vertical: BusinessVertical | null | undefined,
): readonly BusinessCapability[] {
  if (!vertical || !isBusinessVertical(vertical)) return [];
  return BUSINESS_VERTICAL_REGISTRY[vertical].suggestedCapabilities;
}

/**
 * Registry self-consistency: suggestions must reference real capabilities.
 * Exported so a unit test can assert it rather than trusting review.
 */
export function findInvalidVerticalCapabilitySuggestions(): BusinessVertical[] {
  const known = new Set<string>(BUSINESS_CAPABILITIES);
  return BUSINESS_VERTICALS.filter((vertical) =>
    BUSINESS_VERTICAL_REGISTRY[vertical].suggestedCapabilities.some((key) => !known.has(key)),
  );
}
