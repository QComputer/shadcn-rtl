import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  provisioningSafeCapabilities,
  universalProvisioningConfigurationSchema,
} from "../../lib/tenant-provisioning/universal-provisioning-contract";

const recipient = (suffix = "1", invitedRole: "ADMIN" | "MANAGER" = "ADMIN") => ({
  recipientUserId: `c${suffix.padStart(24, "0")}`,
  recipientUsername: `owner-${suffix}`,
  recipientEmail: `owner-${suffix}@example.invalid`,
  invitedRole,
  ttlHours: 24,
});

const shop = (overrides: Record<string, unknown> = {}) => ({
  name: "Synthetic shop",
  slug: "synthetic-shop",
  locale: "fa",
  vertical: null,
  type: "SHOP",
  entitledCapabilities: ["SHOP"],
  enabledCapabilities: ["SHOP"],
  recipients: [recipient()],
  ...overrides,
});

describe("universal provisioning contract", () => {
  it("accepts a nullable-vertical shop and keeps service organizations nullable", () => {
    const parsed = universalProvisioningConfigurationSchema.parse(shop());
    assert.equal(parsed.vertical, null);
    assert.deepEqual(parsed.enabledCapabilities, ["SHOP"]);
  });

  it("accepts appointment provisioning without inferring a vertical", () => {
    const parsed = universalProvisioningConfigurationSchema.parse(shop({
      slug: "synthetic-service",
      type: "APPOINTMENT",
      entitledCapabilities: ["APPOINTMENT"],
      enabledCapabilities: ["APPOINTMENT"],
    }));
    assert.equal(parsed.vertical, null);
    assert.deepEqual(parsed.enabledCapabilities, ["APPOINTMENT"]);
  });

  it("requires a property and hotel website capability for hotel organizations", () => {
    const hotel = shop({
      slug: "synthetic-hotel",
      vertical: "HOTEL",
      entitledCapabilities: ["HOTEL_WEBSITE"],
      enabledCapabilities: ["HOTEL_WEBSITE"],
      property: { name: "Synthetic property", slug: "main" },
    });
    assert.equal(universalProvisioningConfigurationSchema.parse(hotel).property?.slug, "main");
    assert.equal(universalProvisioningConfigurationSchema.safeParse({ ...hotel, property: undefined }).success, false);
    assert.equal(universalProvisioningConfigurationSchema.safeParse({
      ...hotel,
      entitledCapabilities: ["SHOP"],
      enabledCapabilities: ["SHOP"],
    }).success, false);
  });

  it("rejects hotel-only configuration on non-hotel tenants", () => {
    assert.equal(universalProvisioningConfigurationSchema.safeParse(shop({
      property: { name: "Synthetic property", slug: "main" },
    })).success, false);
    assert.equal(universalProvisioningConfigurationSchema.safeParse(shop({
      entitledCapabilities: ["SHOP", "HOTEL_WEBSITE"],
      enabledCapabilities: ["SHOP", "HOTEL_WEBSITE"],
    })).success, false);
  });

  it("limits grants to the reviewed safe capability set", () => {
    assert.deepEqual([...provisioningSafeCapabilities].sort(), [
      "APPOINTMENT", "CRM", "HOTEL_WEBSITE", "IAM", "LOYALTY", "SHOP",
    ]);
    for (const capability of ["HOTEL_BOOKING", "SMS", "USSD", "ICV", "EBC"]) {
      assert.equal(universalProvisioningConfigurationSchema.safeParse(shop({
        entitledCapabilities: ["SHOP", capability],
      })).success, false, `${capability} entitlement must be rejected`);
      assert.equal(universalProvisioningConfigurationSchema.safeParse(shop({
        enabledCapabilities: ["SHOP", capability],
        entitledCapabilities: ["SHOP", capability],
      })).success, false, `${capability} enablement must be rejected`);
    }
  });

  it("requires enabled capabilities to be entitled and compatible with the organization type", () => {
    assert.equal(universalProvisioningConfigurationSchema.safeParse(shop({
      enabledCapabilities: ["APPOINTMENT"],
    })).success, false);
    assert.equal(universalProvisioningConfigurationSchema.safeParse(shop({
      type: "APPOINTMENT",
      entitledCapabilities: ["SHOP"],
      enabledCapabilities: ["SHOP"],
    })).success, false);
    assert.equal(universalProvisioningConfigurationSchema.safeParse(shop({
      entitledCapabilities: ["APPOINTMENT"],
      enabledCapabilities: ["APPOINTMENT"],
    })).success, false);
  });

  it("requires an administrator invitation and rejects reserved organization slugs", () => {
    assert.equal(universalProvisioningConfigurationSchema.safeParse(shop({
      recipients: [recipient("2", "MANAGER")],
    })).success, false);
    assert.equal(universalProvisioningConfigurationSchema.safeParse(shop({ slug: "admin" })).success, false);
    assert.equal(universalProvisioningConfigurationSchema.safeParse(shop({ slug: "api" })).success, false);
  });
});
