import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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
import { listInotiServiceMappings } from "@/lib/integrations/inoti-account-management";
import {
  calculateReputationScore,
  listReputationIntegrationReadinessMappings,
} from "@/lib/customer-reputation/customer-reputation.service";
import {
  createAcquisitionOnboardingDraft,
  getIndustryTemplate,
  organizationTypeForIndustryCapabilities,
  persistedCapabilitiesForRecommendations,
  reviewIndustryCapabilityRecommendations,
} from "@/lib/business-acquisition/industry-templates";

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

describe("business acquisition industry templates", () => {
  it("keeps industry recommendations data-driven and maps only concrete platform capabilities", () => {
    const restaurant = getIndustryTemplate("RESTAURANT");

    assert.deepEqual(restaurant.recommendedCapabilities, ["SHOP", "CRM", "CAMPAIGN", "SEO", "CUSTOMER_ENGAGEMENT"]);
    assert.deepEqual(persistedCapabilitiesForRecommendations(restaurant.recommendedCapabilities), ["SHOP", "CRM"]);
    assert.equal(organizationTypeForIndustryCapabilities(["SHOP", "CRM"]), "SHOP");
  });

  it("lets operators override recommended capabilities without changing the industry template", () => {
    const review = reviewIndustryCapabilityRecommendations({
      industryKey: "DENTAL_CLINIC",
      selectedCapabilities: ["APPOINTMENT", "CRM"],
    });

    assert.deepEqual(review.recommendedCapabilities, ["APPOINTMENT", "CRM", "SEO"]);
    assert.deepEqual(review.selectedCapabilities, ["APPOINTMENT", "CRM"]);
    assert.equal(review.organizationType, "APPOINTMENT");
  });

  it("marks future acquisition sources as architecture-ready but inactive", () => {
    const draft = createAcquisitionOnboardingDraft({
      industryKey: "FASHION_BOUTIQUE",
      sourceType: "INVITATION_CODE",
    });

    assert.equal(draft.futureSource, true);
    assert.equal(draft.activeSource, "BAZARBAAZ_TEAM");
    assert.equal(draft.industryTemplate.industryKey, "FASHION_BOUTIQUE");
    assert.deepEqual(draft.suggestedIntegrations, ["iCV", "EBC"]);
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
      "INOTI_SMS",
      "INOTI_USSD",
      "OTHER",
      "PAYMENT",
      "SMS",
    ]);
  });

  it("runs dry-run health for dry-run providers and blocks disabled runtime", async () => {
    const adapter = getIntegrationAdapter("INOTI_EBC");
    const active = await adapter.checkHealth({
      organizationId: "org-a",
      integrationId: "integration-a",
      provider: "INOTI_EBC",
      status: "ACTIVE",
      codeName: "ebc",
      credentialProfileKey: "INOTI_DEFAULT",
      configuration: { serviceCode: "87788778" },
      capabilityKeys: ["EBC"],
    });
    assert.equal(active.status, "CONNECTED");
    assert.equal(active.connected, true);
    assert.equal(active.metadata.dryRun, true);

    const disabled = await adapter.checkHealth({
      organizationId: "org-a",
      integrationId: "integration-a",
      provider: "INOTI_EBC",
      status: "DISABLED",
      codeName: "ebc",
      credentialProfileKey: "INOTI_DEFAULT",
      configuration: {},
      capabilityKeys: ["EBC"],
    });
    assert.equal(disabled.status, "BLOCKED");
    assert.equal(disabled.errorCode, "INTEGRATION_NOT_ACTIVE");
  });

  it("keeps iNoti USSD health read-only and fails closed without credentials", async () => {
    const adapter = getIntegrationAdapter("INOTI_USSD");
    assert.equal(adapter.supportedActions.includes("USSD_SESSION_START"), true);
    const active = await adapter.checkHealth({
      organizationId: "__platform__",
      integrationId: "integration-a",
      provider: "INOTI_USSD",
      status: "ACTIVE",
      codeName: "alpha",
      credentialProfileKey: "INOTI_DEFAULT",
      configuration: { serviceCode: "87788778" },
      capabilityKeys: ["USSD"],
    });
    assert.equal(active.status, "DEGRADED");
    assert.equal(active.connected, false);
    assert.equal(active.metadata.readOnly, true);
    assert.equal(active.metadata.realPaymentExecution, false);
  });

  it("exposes reusable iNoti service mappings without credential data", () => {
    const mappings = listInotiServiceMappings();
    assert.equal(mappings.length, 6);
    assert.deepEqual(mappings.map((mapping) => mapping.serviceKey).sort(), [
      "INOTI_EBC",
      "INOTI_IAM",
      "INOTI_ICV",
      "INOTI_IMENU",
      "INOTI_SMS",
      "INOTI_USSD",
    ]);
    assert.equal(mappings.find((mapping) => mapping.serviceKey === "INOTI_IAM")?.mappedGrowthFeatures.includes("SEO readiness"), true);
    const serialized = JSON.stringify(mappings);
    assert.equal(/password|apiKey|token|secret/i.test(serialized), false);
  });
});

describe("customer trust reputation foundation", () => {
  it("calculates deterministic reputation scores from transparent factors", () => {
    assert.equal(calculateReputationScore({
      averageRating: 5,
      reviewCount: 25,
      verifiedReviewRatio: 1,
      responseRate: 1,
      recentActivityRatio: 1,
    }), 100);
    assert.equal(calculateReputationScore({
      averageRating: 4,
      reviewCount: 10,
      verifiedReviewRatio: 0.8,
      responseRate: 0.5,
      recentActivityRatio: 0.4,
    }), 67);
  });

  it("maps review data to iAM, EBC, Customer Club, and USSD readiness without provider calls", () => {
    const mappings = listReputationIntegrationReadinessMappings();
    assert.deepEqual(mappings.map((mapping) => mapping.target).sort(), ["Customer Club", "EBC", "USSD", "iAM"]);
    assert.equal(mappings.every((mapping) => mapping.externalProviderCalls === false), true);
    assert.equal(/password|phone|email|token|secret/i.test(JSON.stringify(mappings)), false);
    assert.equal(mappings.some((mapping) => /signed review request/i.test(mapping.purpose)), true);
  });

  it("keeps authenticated review submission behind tenant context", () => {
    const routeSource = readFileSync("app/api/organizations/[id]/reviews/route.ts", "utf8");

    assert.match(routeSource, /requireTenantContext\(session,\s*id,\s*\["ADMIN",\s*"MANAGER",\s*"STAFF"\]\)/);
    assert.doesNotMatch(routeSource, /^\s*await requireAuthSession\(\);/m);
  });

  it("keeps signed public review links outside locale rewriting", () => {
    const proxySource = readFileSync("proxy.ts", "utf8");

    assert.match(proxySource, /pathname\.startsWith\("\/review"\)/);
  });
});

describe("dashboard public organization destinations", () => {
  const base = { slug: "demo", type: "SHOP" as const };
  it("routes zero and mixed capability organizations to their shell", () => {
    assert.equal(publicOrganizationHref("fa", { ...base, capabilitiesInitializedAt: new Date(), capabilities: [] }), "/fa/demo");
    assert.equal(publicOrganizationHref("fa", { ...base, capabilitiesInitializedAt: new Date(), capabilities: [{ key: "SHOP", status: "ACTIVE" }, { key: "APPOINTMENT", status: "ACTIVE" }] }), "/fa/demo");
  });
  it("routes one enabled capability and preserves legacy fallback", () => {
    assert.equal(publicOrganizationHref("fa", { ...base, capabilitiesInitializedAt: new Date(), capabilities: [{ key: "SHOP", status: "ACTIVE" }] }), "/fa/demo");
    assert.equal(publicOrganizationHref("fa", { ...base, type: "APPOINTMENT", capabilitiesInitializedAt: new Date(), capabilities: [{ key: "APPOINTMENT", status: "ACTIVE" }] }), "/fa/demo");
    assert.equal(publicOrganizationHref("fa", { ...base }), "/fa/demo");
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

  it("keeps the business acquisition console platform-only", () => {
    assert.equal(isDashboardNavigationItemVisible("businessAcquisition", "SUPER_ADMIN", []), true);
    assert.equal(isDashboardNavigationItemVisible("businessAcquisition", "ADMIN", ["SHOP"]), false);
    assert.equal(getDashboardRouteAccessDecision({
      locale: "fa",
      pathname: "/fa/dashboard/business-acquisition",
      role: "SUPER_ADMIN",
      capabilities: [],
    }).isAllowed, true);
    assert.equal(getDashboardRouteAccessDecision({
      locale: "fa",
      pathname: "/fa/dashboard/business-acquisition",
      role: "ADMIN",
      capabilities: ["SHOP"],
    }).isAllowed, false);
    assert.equal(checkRouteAccess("/fa/dashboard/business-acquisition", {
      userId: "platform-operator",
      userRole: "SUPER_ADMIN",
    }).hasAccess, true);
    assert.equal(checkRouteAccess("/fa/dashboard/business-acquisition", {
      userId: "tenant-admin",
      userRole: "ADMIN",
      organizationId: "tenant-a",
      organizationType: "SHOP",
      organizationCapabilities: ["SHOP"],
    }).hasAccess, false);
    assert.equal(isDashboardNavigationItemVisible("pilots", "SUPER_ADMIN", []), true);
    assert.equal(isDashboardNavigationItemVisible("pilots", "ADMIN", ["SHOP"]), false);
    assert.equal(getDashboardRouteAccessDecision({
      locale: "fa",
      pathname: "/fa/dashboard/pilots",
      role: "SUPER_ADMIN",
      capabilities: [],
    }).isAllowed, true);
    assert.equal(getDashboardRouteAccessDecision({
      locale: "fa",
      pathname: "/fa/dashboard/pilots",
      role: "ADMIN",
      capabilities: ["SHOP"],
    }).isAllowed, false);
    assert.equal(checkRouteAccess("/fa/dashboard/pilots", {
      userId: "platform-operator",
      userRole: "SUPER_ADMIN",
    }).hasAccess, true);
    assert.equal(checkRouteAccess("/fa/dashboard/pilots", {
      userId: "tenant-admin",
      userRole: "ADMIN",
      organizationId: "tenant-a",
      organizationType: "SHOP",
      organizationCapabilities: ["SHOP"],
    }).hasAccess, false);
    assert.equal(getDashboardRouteAccessDecision({
      locale: "fa",
      pathname: "/fa/dashboard/organizations/org_1/integrations/inoti",
      role: "SUPER_ADMIN",
      capabilities: [],
    }).isAllowed, true);
    assert.equal(getDashboardRouteAccessDecision({
      locale: "fa",
      pathname: "/fa/dashboard/organizations/org_1/integrations/inoti",
      role: "ADMIN",
      capabilities: ["SHOP"],
    }).isAllowed, false);
    assert.equal(checkRouteAccess("/fa/dashboard/organizations/org_1/integrations/inoti", {
      userId: "tenant-admin",
      userRole: "ADMIN",
      organizationId: "tenant-a",
      organizationType: "SHOP",
      organizationCapabilities: ["SHOP"],
    }).hasAccess, false);
  });

  it("exposes business activation to owner-equivalent tenant managers only", () => {
    assert.equal(isDashboardNavigationItemVisible("businessActivation", "ADMIN", []), true);
    assert.equal(isDashboardNavigationItemVisible("businessActivation", "MANAGER", ["SHOP"]), true);
    assert.equal(isDashboardNavigationItemVisible("businessActivation", "STAFF", ["SHOP"]), false);
    assert.equal(isDashboardNavigationItemVisible("reputation", "MANAGER", ["SHOP"]), true);
    assert.equal(getDashboardRouteAccessDecision({
      locale: "fa",
      pathname: "/fa/dashboard/business-activation",
      role: "ADMIN",
      capabilities: [],
    }).isAllowed, true);
    assert.equal(getDashboardRouteAccessDecision({
      locale: "fa",
      pathname: "/fa/dashboard/business-activation",
      role: "STAFF",
      capabilities: ["SHOP"],
    }).isAllowed, false);
    assert.equal(checkRouteAccess("/fa/dashboard/business-activation", {
      userId: "tenant-admin",
      userRole: "ADMIN",
      organizationId: "tenant-a",
      organizationType: "SHOP",
      organizationCapabilities: [],
    }).hasAccess, true);
    assert.equal(checkRouteAccess("/fa/dashboard/reputation", {
      userId: "tenant-admin",
      userRole: "ADMIN",
      organizationId: "tenant-a",
      organizationType: "SHOP",
      organizationCapabilities: [],
    }).hasAccess, true);
    assert.equal(checkRouteAccess("/fa/dashboard/business-activation", {
      userId: "tenant-staff",
      userRole: "STAFF",
      organizationId: "tenant-a",
      organizationType: "SHOP",
      organizationCapabilities: ["SHOP"],
    }).hasAccess, false);
  });
});

describe("tenant-safe push deep links", () => {
  it("allows relative tenant routes", () => {
    assert.equal(normalizePushTargetUrl("/fa/sicily/shop/order/ORD-1"), "/fa/sicily/shop/order/ORD-1");
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
    }), "/fa/cafe-a/shop/order/ORD-1");
    assert.equal(buildOrderPushTargetUrl({
      organizationSlug: "cafe-a",
      orderNumber: "ORD-1",
      audience: "DRIVER",
    }), "/fa/dashboard/driver-orders");
  });

  it("uses clean order links for custom-origin subscriptions", () => {
    const platformTarget = "/fa/cafe-a/shop/order/ORD-1";
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
      targetUrl: "/fa/cafe-a/shop/order/ORD-1",
    }));
    assert.deepEqual(Object.keys(payload).sort(), ["body", "title", "url"]);
    assert.equal(payload.url, "/fa/cafe-a/shop/order/ORD-1");
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
