import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { checkRouteAccess } from "@/lib/access-control";
import {
  effectiveOrganizationCapabilities,
  hasOrganizationCapability,
} from "@/lib/organization-capabilities";
import {
  adaptPushTargetUrlForOrigin,
  buildOrderPushTargetUrl,
  normalizePushTargetUrl,
} from "@/lib/push-target-url";
import {
  requiredCapabilityForDashboardRoute,
  requiredCapabilityForNavigation,
} from "@/lib/business-capability-registry";
import {
  getDashboardRouteAccessDecision,
  isDashboardNavigationItemVisible,
} from "@/lib/dashboard/navigation-policy";
import { evaluateOrganizationCollaborationGrant } from "@/lib/collaboration-grants";
import { normalizePushOrigin } from "@/lib/push-origin";
import { buildMinimalWebPushPayload } from "@/lib/push-payload";

describe("organization capability compatibility", () => {
  it("falls back to the legacy type only before capability initialization", () => {
    assert.deepEqual(effectiveOrganizationCapabilities({ legacyType: "SHOP" }), ["SHOP"]);
  });

  it("supports zero capabilities without treating legacy type as active", () => {
    assert.deepEqual(effectiveOrganizationCapabilities({
      legacyType: "SHOP",
      capabilitiesInitializedAt: new Date(),
      capabilities: [],
    }), []);
  });

  it("supports multiple active capabilities and ignores inactive rows", () => {
    const organization = {
      legacyType: "SHOP" as const,
      capabilitiesInitializedAt: new Date(),
      capabilities: [
        { key: "SHOP" as const, status: "ACTIVE" as const },
        { key: "APPOINTMENT" as const, status: "ACTIVE" as const },
      ],
    };
    assert.equal(hasOrganizationCapability(organization, "SHOP"), true);
    assert.equal(hasOrganizationCapability(organization, "APPOINTMENT"), true);
    assert.deepEqual(effectiveOrganizationCapabilities({
      ...organization,
      capabilities: [{ key: "SHOP", status: "INACTIVE" }],
    }), []);
  });
});

describe("capability-aware dashboard authorization", () => {
  const base = {
    userId: "demo-admin",
    userRole: "ADMIN" as const,
    organizationId: "tenant-a",
  };

  it("allows both workflows for a multi-capability tenant", () => {
    const context = { ...base, organizationType: "SHOP" as const, organizationCapabilities: ["SHOP", "APPOINTMENT"] as const };
    assert.equal(checkRouteAccess("/fa/dashboard/orders", { ...context, organizationCapabilities: [...context.organizationCapabilities] }).hasAccess, true);
    assert.equal(checkRouteAccess("/fa/dashboard/appointments", { ...context, organizationCapabilities: [...context.organizationCapabilities] }).hasAccess, true);
  });

  it("fails closed for an initialized tenant with zero capabilities", () => {
    const result = checkRouteAccess("/fa/dashboard/orders", {
      ...base,
      organizationType: "SHOP",
      organizationCapabilities: [],
    });
    assert.equal(result.hasAccess, false);
    assert.match(result.reason ?? "", /capabilit/i);
  });

  it("uses one registry for navigation and dashboard route boundaries", () => {
    assert.equal(requiredCapabilityForNavigation("orders"), "SHOP");
    assert.equal(requiredCapabilityForDashboardRoute("/appointments/demo"), "APPOINTMENT");
    assert.equal(isDashboardNavigationItemVisible("orders", "ADMIN", []), false);
    assert.equal(isDashboardNavigationItemVisible("orders", "ADMIN", ["SHOP"]), true);
    assert.equal(getDashboardRouteAccessDecision({
      locale: "fa",
      pathname: "/fa/dashboard/orders",
      role: "ADMIN",
      capabilities: [],
    }).isAllowed, false);
  });
});

describe("tenant-safe push deep links", () => {
  it("allows relative tenant routes", () => {
    assert.equal(normalizePushTargetUrl("/fa/shop/sicily/order/ORD-1"), "/fa/shop/sicily/order/ORD-1");
  });

  it("rejects external and scheme-relative URLs", () => {
    assert.throws(() => normalizePushTargetUrl("https://evil.example/steal"), /same-origin/);
    assert.throws(() => normalizePushTargetUrl("//evil.example/steal"), /same-origin/);
  });

  it("builds role-aware order targets without embedding an origin", () => {
    assert.equal(buildOrderPushTargetUrl({
      organizationSlug: "cafe-a",
      orderNumber: "ORD-1",
      audience: "CUSTOMER",
    }), "/fa/shop/cafe-a/order/ORD-1");
    assert.equal(buildOrderPushTargetUrl({
      organizationSlug: "cafe-a",
      orderNumber: "ORD-1",
      audience: "DRIVER",
    }), "/fa/dashboard/driver-orders");
  });

  it("uses clean order links for custom-origin subscriptions", () => {
    const platformTarget = "/fa/shop/cafe-a/order/ORD-1";
    assert.equal(adaptPushTargetUrlForOrigin({
      targetUrl: platformTarget,
      subscriptionOrigin: "https://cafe-a.example.ir",
      organizationSlug: "cafe-a",
    }), "/order/ORD-1");
    assert.equal(adaptPushTargetUrlForOrigin({
      targetUrl: platformTarget,
      subscriptionOrigin: "https://www.bazar-baz.ir",
      organizationSlug: "cafe-a",
    }), platformTarget);
  });
});

describe("origin-aware push subscriptions", () => {
  it("normalizes secure and local origins without accepting paths", () => {
    assert.equal(normalizePushOrigin("https://Cafe-A.IR"), "https://cafe-a.ir");
    assert.equal(normalizePushOrigin("http://127.0.0.1:3100"), "http://127.0.0.1:3100");
    assert.throws(() => normalizePushOrigin("https://cafe-a.ir/private"), /path/);
    assert.throws(() => normalizePushOrigin("http://cafe-a.ir"), /HTTPS/);
  });

  it("serializes only title, body, and a same-origin relative URL", () => {
    const payload = JSON.parse(buildMinimalWebPushPayload({
      title: "Order update",
      body: "Order ORD-1 is ready",
      targetUrl: "/fa/shop/cafe-a/order/ORD-1",
    }));
    assert.deepEqual(Object.keys(payload).sort(), ["body", "title", "url"]);
    assert.equal(payload.url, "/fa/shop/cafe-a/order/ORD-1");
    assert.equal("customerId" in payload, false);
    assert.equal("organizationId" in payload, false);
    assert.equal("phone" in payload, false);
  });
});

describe("collaboration grants remain deny-by-default", () => {
  const active = {
    ownerOrgId: "tenant-a",
    partnerOrgId: "tenant-b",
    status: "ACTIVE" as const,
    scopes: [{
      scope: "ORDER_VISIBILITY",
      ownerToPartner: true,
      partnerToOwner: false,
      writeAccess: false,
    }],
  };

  it("does not treat relationship or network membership as a grant", () => {
    assert.equal(evaluateOrganizationCollaborationGrant({
      collaboration: null,
      actorOrganizationId: "tenant-b",
      resourceOrganizationId: "tenant-a",
      scope: "ORDER_VISIBILITY",
      access: "READ",
    }), false);
    assert.equal(evaluateOrganizationCollaborationGrant({
      collaboration: active,
      actorOrganizationId: "tenant-c",
      resourceOrganizationId: "tenant-a",
      scope: "ORDER_VISIBILITY",
      access: "READ",
    }), false);
  });

  it("requires an active, current, directional scope", () => {
    const now = new Date("2030-01-01T00:00:00.000Z");
    for (const collaboration of [
      { ...active, status: "PENDING" as const },
      { ...active, status: "SUSPENDED" as const },
      { ...active, startsAt: new Date("2030-01-02T00:00:00.000Z") },
      { ...active, endsAt: new Date("2030-01-01T00:00:00.000Z") },
    ]) {
      assert.equal(evaluateOrganizationCollaborationGrant({
        collaboration,
        actorOrganizationId: "tenant-b",
        resourceOrganizationId: "tenant-a",
        scope: "ORDER_VISIBILITY",
        access: "READ",
        now,
      }), false);
    }
    assert.equal(evaluateOrganizationCollaborationGrant({
      collaboration: active,
      actorOrganizationId: "tenant-b",
      resourceOrganizationId: "tenant-a",
      scope: "ORDER_VISIBILITY",
      access: "READ",
      now,
    }), true);
  });

  it("denies a relationship without the requested directional scope", () => {
    assert.equal(evaluateOrganizationCollaborationGrant({
      collaboration: active,
      actorOrganizationId: "tenant-a",
      resourceOrganizationId: "tenant-b",
      scope: "ORDER_VISIBILITY",
      access: "READ",
    }), false);
    assert.equal(evaluateOrganizationCollaborationGrant({
      collaboration: active,
      actorOrganizationId: "tenant-b",
      resourceOrganizationId: "tenant-a",
      scope: "CUSTOMER_PROFILE",
      access: "READ",
    }), false);
  });

  it("denies revoked grants and all writes in the foundation milestone", () => {
    assert.equal(evaluateOrganizationCollaborationGrant({
      collaboration: { ...active, status: "REVOKED" },
      actorOrganizationId: "tenant-b",
      resourceOrganizationId: "tenant-a",
      scope: "ORDER_VISIBILITY",
      access: "READ",
    }), false);
    assert.equal(evaluateOrganizationCollaborationGrant({
      collaboration: active,
      actorOrganizationId: "tenant-b",
      resourceOrganizationId: "tenant-a",
      scope: "ORDER_VISIBILITY",
      access: "WRITE",
    }), false);
  });
});
