import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  activePublicBusinessCapabilities,
  assertDefaultPublicCapabilityAllowed,
  getConfiguredDefaultPublicCapability,
  resolveOrganizationPublicHome,
  writeDefaultPublicCapabilitySetting,
} from "../../lib/organization-public-home";

const active = (key: string) => ({ key: key as any, status: "ACTIVE" });
const inactive = (key: string) => ({ key: key as any, status: "INACTIVE" });

describe("organization public home resolution", () => {
  it("routes a SHOP-only custom-domain root to the shop experience", () => {
    assert.deepEqual(resolveOrganizationPublicHome({ capabilities: [active("SHOP")] }), {
      kind: "business",
      capability: "SHOP",
      publicSurface: "shop",
      publicEntryPath: "/shop",
    });
  });

  it("routes an APPOINTMENT-only custom-domain root to the appointment experience", () => {
    assert.deepEqual(resolveOrganizationPublicHome({ capabilities: [active("APPOINTMENT")] }), {
      kind: "business",
      capability: "APPOINTMENT",
      publicSurface: "appointment",
      publicEntryPath: "/services",
    });
  });

  it("uses the configured default for multi-capability organizations", () => {
    const shopDefault = resolveOrganizationPublicHome({
      capabilities: [active("SHOP"), active("APPOINTMENT")],
      settings: { defaultPublicCapability: "SHOP" },
    });
    const appointmentDefault = resolveOrganizationPublicHome({
      capabilities: [active("SHOP"), active("APPOINTMENT")],
      settings: { defaultPublicCapability: "APPOINTMENT" },
    });

    assert.equal(shopDefault.kind, "business");
    assert.equal(shopDefault.kind === "business" ? shopDefault.capability : null, "SHOP");
    assert.equal(appointmentDefault.kind, "business");
    assert.equal(appointmentDefault.kind === "business" ? appointmentDefault.capability : null, "APPOINTMENT");
  });

  it("keeps multi-capability organizations generic when no default is configured", () => {
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
      kind: "business",
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
});
