import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  BUSINESS_VERTICAL_REGISTRY,
  BUSINESS_VERTICALS,
  findInvalidVerticalCapabilitySuggestions,
  getBusinessVerticalDefinition,
  inferBusinessVerticalFromLegacyType,
  isBusinessVertical,
  listBusinessVerticals,
  parseBusinessVertical,
  resolveBusinessVertical,
  suggestCapabilitiesForVertical,
} from "@/lib/business-verticals";
import { BUSINESS_CAPABILITIES } from "@/lib/business-capability-registry";
import {
  DAMOON_CAPABILITIES_AVAILABLE_TODAY,
  DAMOON_CAPABILITY_READINESS,
  DAMOON_PENDING_INPUT,
  DAMOON_PENDING_INPUT_MARKER,
  DAMOON_PILOT,
  DAMOON_PILOT_PROPOSED_CAPABILITIES,
  hasPilotRecordsBeenCreated,
} from "@/lib/hotel/dev/damoon-pilot-contract";
import { effectiveOrganizationCapabilities } from "@/lib/organization-capabilities";

describe("1. every supported initial vertical", () => {
  it("supports exactly the seven agreed verticals", () => {
    assert.deepEqual(
      [...listBusinessVerticals()].sort(),
      [
        "CLOTHING_STORE",
        "FLORIST",
        "HOTEL",
        "PHARMACY",
        "RESTAURANT",
        "SHOE_STORE",
        "SUPERMARKET",
      ],
    );
  });

  it("has a complete registry entry for every vertical", () => {
    for (const vertical of BUSINESS_VERTICALS) {
      const definition = getBusinessVerticalDefinition(vertical);
      assert.equal(definition.key, vertical);
      assert.ok(definition.label.length > 0, `${vertical} label`);
      assert.ok(Array.isArray(definition.suggestedCapabilities));
      assert.ok(definition.onboardingTaskKeys.length > 0, `${vertical} onboarding tasks`);
    }
  });

  it("only suggests capabilities that really exist", () => {
    assert.deepEqual(findInvalidVerticalCapabilitySuggestions(), []);
  });

  it("never suggests a capability outside the known registry", () => {
    const known = new Set<string>(BUSINESS_CAPABILITIES);
    for (const vertical of BUSINESS_VERTICALS) {
      for (const key of getBusinessVerticalDefinition(vertical).suggestedCapabilities) {
        assert.ok(known.has(key), `${vertical} suggests unknown ${key}`);
      }
    }
  });
});

describe("2. unknown or future vertical handling", () => {
  it("rejects an unknown vertical string", () => {
    assert.equal(isBusinessVertical("BAKING_SHOP"), false);
    assert.equal(parseBusinessVertical("BAKING_SHOP"), null);
  });

  it("never degrades a future vertical into an existing one", () => {
    // A newer deploy may write a vertical this build has never heard of.
    // Collapsing it into a known value would silently mis-classify the tenant.
    assert.equal(parseBusinessVertical("VERTICAL_FROM_THE_FUTURE"), null);
  });

  it("rejects non-string input", () => {
    for (const value of [null, undefined, 42, {}, [], true]) {
      assert.equal(parseBusinessVertical(value), null);
    }
  });

  it("suggests nothing for an unknown or absent vertical", () => {
    assert.deepEqual(suggestCapabilitiesForVertical(null), []);
    assert.deepEqual(suggestCapabilitiesForVertical(undefined), []);
    assert.deepEqual(suggestCapabilitiesForVertical("BAKING_SHOP" as never), []);
  });
});

describe("3. organizations without a vertical", () => {
  it("resolves to an explicit unassigned state rather than guessing", () => {
    const resolved = resolveBusinessVertical({ vertical: null, legacyType: "SHOP" });
    assert.equal(resolved.vertical, null);
    assert.equal(resolved.source, "UNASSIGNED");
    assert.equal(resolved.isLegacyUnassigned, true);
  });

  it("still reports active capabilities for an unassigned organization", () => {
    const resolved = resolveBusinessVertical({
      vertical: null,
      legacyType: "SHOP",
      activeCapabilities: ["SHOP"],
    });
    assert.equal(resolved.vertical, null);
    assert.deepEqual(resolved.activeCapabilities, ["SHOP"]);
  });

  it("tolerates a missing input object entirely", () => {
    const resolved = resolveBusinessVertical({});
    assert.equal(resolved.vertical, null);
    assert.equal(resolved.source, "UNASSIGNED");
    assert.equal(resolved.isLegacyUnassigned, false);
    assert.deepEqual(resolved.activeCapabilities, []);
  });
});

describe("4. organizations without an enabled capability", () => {
  it("still resolves a vertical independently of capabilities", () => {
    const resolved = resolveBusinessVertical({
      vertical: "HOTEL",
      legacyType: "SHOP",
      activeCapabilities: [],
    });
    assert.equal(resolved.vertical, "HOTEL");
    assert.equal(resolved.source, "EXPLICIT");
    assert.equal(resolved.isLegacyUnassigned, false);
    assert.deepEqual(resolved.activeCapabilities, []);
  });

  it("drops malformed capability entries instead of propagating them", () => {
    const resolved = resolveBusinessVertical({
      vertical: "HOTEL",
      activeCapabilities: ["SHOP", null as never, "" as never, "CRM"],
    });
    assert.deepEqual(resolved.activeCapabilities, ["SHOP", "CRM"]);
  });
});

describe("5. organizations with multiple capabilities", () => {
  it("keeps every capability and never derives them from the vertical", () => {
    const resolved = resolveBusinessVertical({
      vertical: "HOTEL",
      activeCapabilities: ["SHOP", "APPOINTMENT", "CRM", "LOYALTY"],
    });
    assert.deepEqual(resolved.activeCapabilities, ["SHOP", "APPOINTMENT", "CRM", "LOYALTY"]);
  });

  it("does not activate capabilities just because a vertical was assigned", () => {
    // Vertical assigned, nothing activated.
    const resolved = resolveBusinessVertical({ vertical: "RESTAURANT", activeCapabilities: [] });
    assert.equal(resolved.vertical, "RESTAURANT");
    assert.deepEqual(resolved.activeCapabilities, []);
  });
});

describe("6. existing SHOP compatibility", () => {
  it("refuses to infer a vertical from SHOP", () => {
    // SHOP spans shoe stores, clothing, pharmacy, supermarket and florist.
    assert.equal(inferBusinessVerticalFromLegacyType("SHOP"), null);
  });

  it("keeps the legacy capability fallback intact", () => {
    const capabilities = effectiveOrganizationCapabilities({
      legacyType: "SHOP",
      capabilitiesInitializedAt: null,
      capabilities: [],
    });
    assert.deepEqual(capabilities, ["SHOP"]);
  });

  it("reports an uninitialised SHOP org as legacy-unassigned", () => {
    const resolved = resolveBusinessVertical({
      vertical: undefined,
      legacyType: "SHOP",
      activeCapabilities: effectiveOrganizationCapabilities({
        legacyType: "SHOP",
        capabilitiesInitializedAt: null,
        capabilities: [],
      }),
    });
    assert.equal(resolved.vertical, null);
    assert.equal(resolved.isLegacyUnassigned, true);
    assert.deepEqual(resolved.activeCapabilities, ["SHOP"]);
  });

  it("behaves identically once capabilities are initialised", () => {
    const capabilities = effectiveOrganizationCapabilities({
      legacyType: "SHOP",
      capabilitiesInitializedAt: new Date(),
      capabilities: [{ key: "SHOP", status: "ACTIVE" }],
    });
    assert.deepEqual(capabilities, ["SHOP"]);
  });
});

describe("7. existing APPOINTMENT compatibility", () => {
  it("refuses to infer a vertical from APPOINTMENT", () => {
    // Restaurant, hotel, spa and clinic all use APPOINTMENT today.
    assert.equal(inferBusinessVerticalFromLegacyType("APPOINTMENT"), null);
  });

  it("tolerates a null legacy type", () => {
    assert.equal(inferBusinessVerticalFromLegacyType(null), null);
    assert.equal(inferBusinessVerticalFromLegacyType(undefined), null);
  });

  it("keeps an APPOINTMENT org with no capabilities on an empty set", () => {
    const capabilities = effectiveOrganizationCapabilities({
      legacyType: "APPOINTMENT",
      capabilitiesInitializedAt: new Date(),
      capabilities: [],
    });
    assert.deepEqual(capabilities, []);
  });

  it("does not mutate capabilities when a vertical is added", () => {
    const before = effectiveOrganizationCapabilities({
      legacyType: "APPOINTMENT",
      capabilitiesInitializedAt: new Date(),
      capabilities: [{ key: "APPOINTMENT", status: "ACTIVE" }],
    });
    const resolved = resolveBusinessVertical({ vertical: "RESTAURANT", activeCapabilities: before });
    assert.deepEqual(resolved.activeCapabilities, before);
  });
});

describe("8. capability activation and deactivation preserve business data", () => {
  it("drops a deactivated capability without affecting the others", () => {
    const capabilities = effectiveOrganizationCapabilities({
      legacyType: "SHOP",
      capabilitiesInitializedAt: new Date(),
      capabilities: [
        { key: "SHOP", status: "ACTIVE" },
        { key: "CRM", status: "INACTIVE" },
        { key: "LOYALTY", status: "ACTIVE" },
      ],
    });
    assert.deepEqual(capabilities, ["SHOP", "LOYALTY"]);
  });

  it("returns an empty capability set for a fully deactivated organization", () => {
    const capabilities = effectiveOrganizationCapabilities({
      legacyType: "SHOP",
      capabilitiesInitializedAt: new Date(),
      capabilities: [
        { key: "SHOP", status: "INACTIVE" },
        { key: "CRM", status: "INACTIVE" },
      ],
    });
    assert.deepEqual(capabilities, []);
    // Still a valid organization, still resolvable.
    const resolved = resolveBusinessVertical({ vertical: "HOTEL", activeCapabilities: capabilities });
    assert.equal(resolved.vertical, "HOTEL");
    assert.deepEqual(resolved.activeCapabilities, []);
  });

  it("deduplicates repeated active capabilities", () => {
    const capabilities = effectiveOrganizationCapabilities({
      legacyType: "SHOP",
      capabilitiesInitializedAt: new Date(),
      capabilities: [
        { key: "SHOP", status: "ACTIVE" },
        { key: "SHOP", status: "ACTIVE" },
      ],
    });
    assert.deepEqual(capabilities, ["SHOP"]);
  });

  it("does not let the legacy fallback resurrect a deactivated capability", () => {
    // capabilitiesInitializedAt is set, so `legacyType` must be ignored.
    const capabilities = effectiveOrganizationCapabilities({
      legacyType: "SHOP",
      capabilitiesInitializedAt: new Date(),
      capabilities: [{ key: "SHOP", status: "INACTIVE" }],
    });
    assert.deepEqual(capabilities, []);
  });
});

describe("9. tenant isolation", () => {
  it("keeps resolution a pure function of its own input", () => {
    const a = resolveBusinessVertical({ vertical: "HOTEL", activeCapabilities: ["SHOP"] });
    const b = resolveBusinessVertical({ vertical: "PHARMACY", activeCapabilities: ["CRM"] });
    assert.equal(a.vertical, "HOTEL");
    assert.equal(b.vertical, "PHARMACY");
    assert.notEqual(a.vertical, b.vertical);
  });

  it("carries no organization identity, so nothing can leak between tenants", () => {
    const source = getBusinessVerticalDefinition("HOTEL");
    assert.deepEqual(Object.keys(source).sort(), [
      "key",
      "label",
      "onboardingTaskKeys",
      "suggestedCapabilities",
    ]);
  });

  it("contains no tenant-specific branching", () => {
    // Guards against the forbidden `if (slug === "damoon")` pattern.
    assert.equal(Object.values(BUSINESS_VERTICAL_REGISTRY).some((entry) => "slug" in entry), false);
  });
});

describe("10. custom-domain and surface compatibility", () => {
  it("leaves the legacy public surface capabilities unchanged", () => {
    assert.deepEqual([...BUSINESS_CAPABILITIES].sort(), ["APPOINTMENT", "SHOP"]);
  });

  it("maps a vertical to advisory capabilities that are all existing surfaces", () => {
    assert.deepEqual(suggestCapabilitiesForVertical("HOTEL"), ["APPOINTMENT"]);
    assert.deepEqual(suggestCapabilitiesForVertical("SHOE_STORE"), ["SHOP"]);
    assert.deepEqual(suggestCapabilitiesForVertical("FLORIST"), ["SHOP", "APPOINTMENT"]);
  });
});

describe("11. Hotel Damoon proposed configuration without creating records", () => {
  it("creates no records", () => {
    assert.equal(hasPilotRecordsBeenCreated(), false);
  });

  it("declares the pilot identity without inventing hotel facts", () => {
    assert.equal(DAMOON_PILOT.canonicalDomain, "damoon-hotel.ir");
    assert.equal(DAMOON_PILOT.vertical, "HOTEL");
    assert.equal(parseBusinessVertical(DAMOON_PILOT.vertical), "HOTEL");
  });

  it("requires HOTEL_BOOKING and keeps it optional-list separate", () => {
    assert.deepEqual([...DAMOON_PILOT_PROPOSED_CAPABILITIES.required], ["HOTEL_BOOKING"]);
    assert.ok(DAMOON_PILOT_PROPOSED_CAPABILITIES.optional.includes("CRM"));
    assert.ok(DAMOON_PILOT_PROPOSED_CAPABILITIES.optional.includes("VTOUR"));
  });

  it("does not claim HOTEL_BOOKING is available before the migration", () => {
    const readiness = DAMOON_CAPABILITY_READINESS.find((entry) => entry.key === "HOTEL_BOOKING");
    assert.equal(readiness?.status, "REQUIRES_MIGRATION");
    assert.equal(DAMOON_CAPABILITIES_AVAILABLE_TODAY.includes("HOTEL_BOOKING" as never), false);
  });

  it("marks unimplemented capabilities honestly", () => {
    for (const key of ["SEO", "VTOUR", "NOTIFICATIONS"]) {
      const entry = DAMOON_CAPABILITY_READINESS.find((candidate) => candidate.key === key);
      assert.equal(entry?.status, "NOT_YET_IMPLEMENTED", key);
    }
  });

  it("lists only capabilities that exist today as immediately usable", () => {
    for (const key of DAMOON_CAPABILITIES_AVAILABLE_TODAY) {
      assert.ok(
        (BUSINESS_CAPABILITIES as readonly string[]).includes(key),
        `${key} must be a real capability`,
      );
    }
  });

  it("tracks every pending real-world input with the agreed marker", () => {
    assert.ok(DAMOON_PENDING_INPUT.length >= 10);
    assert.equal(DAMOON_PENDING_INPUT_MARKER, "PENDING_HOTEL_INPUT");
    assert.ok(DAMOON_PENDING_INPUT.includes("room_types_and_beds"));
    assert.ok(DAMOON_PENDING_INPUT.includes("rate_plans_and_rates"));
  });

  it("inherits the hotel vertical onboarding tasks from the generic registry", () => {
    assert.deepEqual(
      DAMOON_PILOT.vertical === "HOTEL"
        ? getBusinessVerticalDefinition("HOTEL").onboardingTaskKeys
        : [],
      ["property", "rooms", "policies"],
    );
  });
});