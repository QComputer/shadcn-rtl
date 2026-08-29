import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  activePublicBusinessCapabilities,
  assertDefaultPublicCapabilityAllowed,
  getConfiguredDefaultPublicCapability,
  getPublicExperienceOwnership,
  resolveOrganizationPublicHome,
  writeDefaultPublicCapabilitySetting,
} from "../../lib/organization-public-home";

const active = (key: string) => ({ key: key as any, status: "ACTIVE" });
const inactive = (key: string) => ({ key: key as any, status: "INACTIVE" });

describe("organization public home resolution", () => {
  it("formalizes public-experience ownership independently from capabilities", () => {
    const capabilities = [active("SHOP"), active("APPOINTMENT")];
    assert.equal(getPublicExperienceOwnership(resolveOrganizationPublicHome({
      capabilities,
      publicHomeMode: "BRAND",
      brandLandingProvider: "CUSTOM_EXTERNAL",
    })), "EXTERNAL_WEBSITE");
    assert.equal(getPublicExperienceOwnership(resolveOrganizationPublicHome({
      capabilities,
      publicHomeMode: "VISITOR_CHOICE",
    })), "BAZARBAAZ_MANAGED");
  });

  it("routes a SHOP-only custom-domain root to the shop experience", () => {
    assert.deepEqual(resolveOrganizationPublicHome({ capabilities: [active("SHOP")] }), {
      kind: "capability",
      mode: "SHOP",
      capability: "SHOP",
      publicSurface: "shop",
      publicEntryPath: "/shop",
    });
  });

  it("routes an APPOINTMENT-only custom-domain root to the appointment experience", () => {
    assert.deepEqual(resolveOrganizationPublicHome({ capabilities: [active("APPOINTMENT")] }), {
      kind: "capability",
      mode: "APPOINTMENT",
      capability: "APPOINTMENT",
      publicSurface: "appointment",
      publicEntryPath: "/services",
    });
  });

  it("uses the configured default for multi-capability organizations in AUTO mode", () => {
    const shopDefault = resolveOrganizationPublicHome({
      capabilities: [active("SHOP"), active("APPOINTMENT")],
      settings: { defaultPublicCapability: "SHOP" },
    });
    const appointmentDefault = resolveOrganizationPublicHome({
      capabilities: [active("SHOP"), active("APPOINTMENT")],
      settings: { defaultPublicCapability: "APPOINTMENT" },
    });

    assert.equal(shopDefault.kind, "capability");
    assert.equal(shopDefault.kind === "capability" ? shopDefault.capability : null, "SHOP");
    assert.equal(appointmentDefault.kind, "capability");
    assert.equal(appointmentDefault.kind === "capability" ? appointmentDefault.capability : null, "APPOINTMENT");
  });

  it("keeps multi-capability organizations generic when no default is configured in AUTO mode", () => {
    assert.deepEqual(resolveOrganizationPublicHome({
      capabilities: [active("SHOP"), active("APPOINTMENT")],
      settings: null,
    }), {
      kind: "generic",
      reason: "MULTIPLE_WITHOUT_VALID_DEFAULT",
    });
  });

  it("ignores disabled and non-public selected capabilities", () => {
    assert.deepEqual(activePublicBusinessCapabilities([
      active("SHOP"),
      inactive("APPOINTMENT"),
      active("CRM"),
    ]), ["SHOP"]);

    assert.equal(getConfiguredDefaultPublicCapability({ defaultPublicCapability: "CRM" }), null);
  });

  it("rejects an unavailable default public capability", () => {
    assert.throws(
      () => assertDefaultPublicCapabilityAllowed({
        selected: "APPOINTMENT",
        activePublicCapabilities: ["SHOP"],
      }),
      /active public business capability/,
    );
  });

  it("falls back when the selected capability is later disabled", () => {
    assert.deepEqual(resolveOrganizationPublicHome({
      capabilities: [active("SHOP"), inactive("APPOINTMENT")],
      settings: { defaultPublicCapability: "APPOINTMENT" },
    }), {
      kind: "capability",
      mode: "SHOP",
      capability: "SHOP",
      publicSurface: "shop",
      publicEntryPath: "/shop",
    });
  });

  it("renders generic organization content when no public business capability is active", () => {
    assert.deepEqual(resolveOrganizationPublicHome({
      capabilities: [active("CRM"), inactive("SHOP")],
      settings: { defaultPublicCapability: "SHOP" },
    }), {
      kind: "generic",
      reason: "NO_PUBLIC_CAPABILITY",
    });
  });

  it("stores and clears the default public capability in the existing settings object", () => {
    assert.deepEqual(writeDefaultPublicCapabilitySetting({ theme: "system" }, "SHOP"), {
      theme: "system",
      defaultPublicCapability: "SHOP",
    });
    assert.deepEqual(writeDefaultPublicCapabilitySetting({ theme: "system", defaultPublicCapability: "SHOP" }, null), {
      theme: "system",
    });
    assert.equal(writeDefaultPublicCapabilitySetting({ defaultPublicCapability: "SHOP" }, null), null);
  });

  it("supports explicit SHOP mode when SHOP is active", () => {
    assert.deepEqual(resolveOrganizationPublicHome({
      capabilities: [active("SHOP"), active("APPOINTMENT")],
      publicHomeMode: "SHOP",
    }), {
      kind: "capability",
      mode: "SHOP",
      capability: "SHOP",
      publicSurface: "shop",
      publicEntryPath: "/shop",
    });
  });

  it("rejects explicit SHOP mode when SHOP is not active", () => {
    assert.deepEqual(resolveOrganizationPublicHome({
      capabilities: [active("APPOINTMENT")],
      publicHomeMode: "SHOP",
    }), {
      kind: "invalid",
      reason: "MODE_REQUIRES_MISSING_CAPABILITY",
      mode: "SHOP",
    });
  });

  it("supports explicit APPOINTMENT mode when APPOINTMENT is active", () => {
    assert.deepEqual(resolveOrganizationPublicHome({
      capabilities: [active("SHOP"), active("APPOINTMENT")],
      publicHomeMode: "APPOINTMENT",
    }), {
      kind: "capability",
      mode: "APPOINTMENT",
      capability: "APPOINTMENT",
      publicSurface: "appointment",
      publicEntryPath: "/services",
    });
  });

  it("rejects explicit APPOINTMENT mode when APPOINTMENT is not active", () => {
    assert.deepEqual(resolveOrganizationPublicHome({
      capabilities: [active("SHOP")],
      publicHomeMode: "APPOINTMENT",
    }), {
      kind: "invalid",
      reason: "MODE_REQUIRES_MISSING_CAPABILITY",
      mode: "APPOINTMENT",
    });
  });

  it("supports BRAND mode with BAZARBAAZ provider", () => {
    assert.deepEqual(resolveOrganizationPublicHome({
      capabilities: [active("SHOP")],
      publicHomeMode: "BRAND",
      brandLandingProvider: "BAZARBAAZ",
    }), {
      kind: "brand",
      provider: "BAZARBAAZ",
    });
  });

  it("supports BRAND mode with CUSTOM_INTERNAL provider", () => {
    assert.deepEqual(resolveOrganizationPublicHome({
      capabilities: [active("SHOP")],
      publicHomeMode: "BRAND",
      brandLandingProvider: "CUSTOM_INTERNAL",
    }), {
      kind: "brand",
      provider: "CUSTOM_INTERNAL",
    });
  });

  it("supports BRAND mode with CUSTOM_EXTERNAL provider", () => {
    assert.deepEqual(resolveOrganizationPublicHome({
      capabilities: [active("SHOP")],
      publicHomeMode: "BRAND",
      brandLandingProvider: "CUSTOM_EXTERNAL",
    }), {
      kind: "external",
      provider: "CUSTOM_EXTERNAL",
    });
  });

  it("rejects BRAND mode without a provider", () => {
    assert.deepEqual(resolveOrganizationPublicHome({
      capabilities: [active("SHOP")],
      publicHomeMode: "BRAND",
    }), {
      kind: "invalid",
      reason: "MODE_REQUIRES_MISSING_PROVIDER",
      mode: "BRAND",
    });
  });

  it("supports VISITOR_CHOICE with active capabilities", () => {
    assert.deepEqual(resolveOrganizationPublicHome({
      capabilities: [active("SHOP"), active("APPOINTMENT")],
      publicHomeMode: "VISITOR_CHOICE",
    }), {
      kind: "visitor-choice",
      capabilities: ["SHOP", "APPOINTMENT"],
    });
  });

  it("rejects VISITOR_CHOICE with no active capabilities", () => {
    assert.deepEqual(resolveOrganizationPublicHome({
      capabilities: [inactive("SHOP"), inactive("APPOINTMENT")],
      publicHomeMode: "VISITOR_CHOICE",
    }), {
      kind: "generic",
      reason: "NO_PUBLIC_CAPABILITY",
    });
  });

  it("preserves legacy behavior when new fields are null", () => {
    assert.deepEqual(resolveOrganizationPublicHome({
      capabilities: [active("SHOP")],
      settings: null,
    }), {
      kind: "capability",
      mode: "SHOP",
      capability: "SHOP",
      publicSurface: "shop",
      publicEntryPath: "/shop",
    });
  });

  it("ignores inactive capabilities in AUTO mode", () => {
    assert.deepEqual(resolveOrganizationPublicHome({
      capabilities: [active("SHOP"), inactive("APPOINTMENT")],
      settings: { defaultPublicCapability: "APPOINTMENT" },
    }), {
      kind: "capability",
      mode: "SHOP",
      capability: "SHOP",
      publicSurface: "shop",
      publicEntryPath: "/shop",
    });
  });
});
