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
import { resolveActiveTenantForHost } from "@/lib/domains/domain-resolver.server";
import { isPlatformHost } from "@/lib/custom-domain-routing";
import { publicOrganizationHref } from "@/app/[locale]/dashboard/organizations/page";
import { getIntegrationAdapter, listIntegrationAdapters } from "@/lib/integrations/runtime/registry";

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

describe("custom-domain capability resolution", () => {
  it("returns every active capability instead of choosing a legacy organization type", async () => {
    const tenant = await resolveActiveTenantForHost({
      organizationDomain: { findUnique: async () => ({
        status: "ACTIVE",
        organization: {
          id: "mixed-org", slug: "mixed-demo", locale: "fa", type: "SHOP",
          isActive: true, deletedAt: null, capabilitiesInitializedAt: new Date(),
          capabilities: [{ key: "SHOP", status: "ACTIVE" }, { key: "APPOINTMENT", status: "ACTIVE" }],
        },
      }) },
    }, "mixed-demo.ir");
    assert.deepEqual(tenant?.capabilities, ["SHOP", "APPOINTMENT"]);
  });

  it("keeps bazarbaaz.ir outside organization-domain resolution", () => {
    assert.equal(isPlatformHost("bazarbaaz.ir"), true);
  });
});

describe("integration runtime adapter registry", () => {
  it("resolves every supported provider through the registry", () => {
    const providers = listIntegrationAdapters().map((adapter) => adapter.provider).sort();
    assert.deepEqual(providers, [
      "INOTI_EBC",
      "INOTI_IAM",
      "INOTI_ICV",
      "INOTI_IMENU",
      "INOTI_USSD",
      "OTHER",
      "PAYMENT",
      "SMS",
    ]);
  });

  it("runs dry-run health without external provider calls and blocks disabled runtime", async () => {
    const adapter = getIntegrationAdapter("INOTI_USSD");
    assert.equal(adapter.supportedActions.includes("USSD_SESSION_START"), true);
    const active = await adapter.checkHealth({
      organizationId: "org-a",
      integrationId: "integration-a",
      provider: "INOTI_USSD",
      status: "ACTIVE",
      credentialProfileKey: "INOTI_DEFAULT",
      configuration: { serviceCode: "87788778" },
      capabilityKeys: ["USSD"],
    });
    assert.equal(active.status, "CONNECTED");
    assert.equal(active.connected, true);
    assert.equal(active.metadata.dryRun, true);

    const disabled = await adapter.checkHealth({
      organizationId: "org-a",
      integrationId: "integration-a",
      provider: "INOTI_USSD",
      status: "DISABLED",
      credentialProfileKey: "INOTI_DEFAULT",
      configuration: {},
      capabilityKeys: ["USSD"],
    });
    assert.equal(disabled.status, "BLOCKED");
    assert.equal(disabled.errorCode, "INTEGRATION_NOT_ACTIVE");
  });
});

describe("dashboard public organization destinations", () => {
  const base = { slug: "demo", type: "SHOP" as const };
  it("routes zero and mixed capability organizations to their shell", () => {
    assert.equal(publicOrganizationHref("fa", { ...base, capabilitiesInitializedAt: new Date(), capabilities: [] }), "/fa/organization/demo");
    assert.equal(publicOrganizationHref("fa", { ...base, capabilitiesInitializedAt: new Date(), capabilities: [{ key: "SHOP", status: "ACTIVE" }, { key: "APPOINTMENT", status: "ACTIVE" }] }), "/fa/organization/demo");
  });
  it("routes one enabled capability and preserves legacy fallback", () => {
    assert.equal(publicOrganizationHref("fa", { ...base, capabilitiesInitializedAt: new Date(), capabilities: [{ key: "SHOP", status: "ACTIVE" }] }), "/fa/shop/demo");
    assert.equal(publicOrganizationHref("fa", { ...base, type: "APPOINTMENT", capabilitiesInitializedAt: new Date(), capabilities: [{ key: "APPOINTMENT", status: "ACTIVE" }] }), "/fa/appointment/demo");
    assert.equal(publicOrganizationHref("fa", { ...base }), "/fa/shop/demo");
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
