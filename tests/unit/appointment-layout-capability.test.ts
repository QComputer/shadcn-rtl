import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { effectiveOrganizationCapabilities, hasOrganizationCapability } from "@/lib/organization-capabilities";

describe("appointment layout capability eligibility", () => {
  it("allows APPOINTMENT-only org to show services and booking", () => {
    const org = {
      legacyType: "APPOINTMENT" as const,
      capabilitiesInitializedAt: new Date(),
      capabilities: [{ key: "APPOINTMENT" as const, status: "ACTIVE" as const }],
    };
    assert.equal(hasOrganizationCapability(org, "APPOINTMENT"), true);
    assert.deepEqual(effectiveOrganizationCapabilities(org), ["APPOINTMENT"]);
  });

  it("allows SHOP + APPOINTMENT org to show services and booking", () => {
    const org = {
      legacyType: "SHOP" as const,
      capabilitiesInitializedAt: new Date(),
      capabilities: [
        { key: "SHOP" as const, status: "ACTIVE" as const },
        { key: "APPOINTMENT" as const, status: "ACTIVE" as const },
      ],
    };
    assert.equal(hasOrganizationCapability(org, "APPOINTMENT"), true);
    assert.deepEqual(effectiveOrganizationCapabilities(org), ["SHOP", "APPOINTMENT"]);
  });

  it("denies appointment services for org with legacy type but initialized capabilities without APPOINTMENT", () => {
    const org = {
      legacyType: "APPOINTMENT" as const,
      capabilitiesInitializedAt: new Date(),
      capabilities: [{ key: "SHOP" as const, status: "ACTIVE" as const }],
    };
    assert.equal(hasOrganizationCapability(org, "APPOINTMENT"), false);
    assert.deepEqual(effectiveOrganizationCapabilities(org), ["SHOP"]);
  });

  it("denies appointment services for org without APPOINTMENT capability", () => {
    const org = {
      legacyType: "SHOP" as const,
      capabilitiesInitializedAt: new Date(),
      capabilities: [{ key: "SHOP" as const, status: "ACTIVE" as const }],
    };
    assert.equal(hasOrganizationCapability(org, "APPOINTMENT"), false);
    assert.deepEqual(effectiveOrganizationCapabilities(org), ["SHOP"]);
  });

  it("falls back to legacy APPOINTMENT type before capability initialization", () => {
    const org = {
      legacyType: "APPOINTMENT" as const,
      capabilitiesInitializedAt: null,
      capabilities: [],
    };
    assert.equal(hasOrganizationCapability(org, "APPOINTMENT"), true);
    assert.deepEqual(effectiveOrganizationCapabilities(org), ["APPOINTMENT"]);
  });
});
