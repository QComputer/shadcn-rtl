import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { listPlatformFeatures } from "@/lib/public-experience/platform-features";
import { buildPublicDemoShowcase } from "@/lib/demo-universe/demo-showcase";
import { DEMO_SHOWCASE_BLUEPRINTS, FEATURED_DEMO_SHOWCASE_SLUGS } from "@/lib/demo-universe/demo-showcase-blueprints";
import { buildDemoJourneySteps, buildDemoPresentationPanels, buildUniversalDemoJourneySteps, UNIVERSAL_BAZARBAAZ_JOURNEY } from "@/lib/demo-universe/demo-walkthrough";
import { DEMO_STORY_STEPS } from "@/lib/public-experience/demo-storytelling";
import { getHomepageBackendContract } from "@/lib/public-experience/homepage-contract";
import { buildHomepageViewModel } from "@/lib/public-experience/homepage-view-model";
import { buildPublicOrganizationReadModel } from "@/lib/public-experience/organization-public-read-model";

describe("platform feature contract", () => {
  it("keeps public experience data outside React components", () => {
    const features = listPlatformFeatures();
    assert.equal(features.length >= 11, true);
    assert.deepEqual(features.map((feature) => feature.ordering), [...features.map((feature) => feature.ordering)].sort((a, b) => a - b));
    for (const key of [
      "digital-storefront",
      "appointment-booking",
      "crm",
      "customer-club",
      "seo-intelligence",
      "content-generation",
      "social-presence",
      "campaigns",
      "ussd-conversion",
      "analytics",
      "integrations",
    ]) {
      assert.equal(features.some((feature) => feature.key === key), true);
    }
  });
});

describe("demo storytelling contract", () => {
  it("models the guided investor/customer story as dry-run steps", () => {
    assert.deepEqual(DEMO_STORY_STEPS.map((step) => step.key), [
      "business-joins",
      "source-connected",
      "entities-structured",
      "seo-discovered",
      "content-generated",
      "crm-available",
      "inoti-demonstrated",
    ]);
    assert.equal(DEMO_STORY_STEPS.every((step) => step.simulatedOnly), true);
  });

  it("prepares homepage backend sections without requiring the final homepage UI", () => {
    const contract = getHomepageBackendContract();
    assert.deepEqual(Object.keys(contract), [
      "hero",
      "problem",
      "solution",
      "howItWorks",
      "businessExamples",
      "inotiEcosystem",
      "demoCta",
    ]);
  });
});

describe("homepage presentation contract", () => {
  it("adapts the public demo experience without creating a separate feature source", () => {
    const platformFeatures = listPlatformFeatures();
    const model = buildHomepageViewModel({
      platformFeatures,
      demoOrganizations: [{
        id: "demo-org",
        name: "Demo Cafe",
        slug: "demo-cafe",
        locale: "fa",
        logo: null,
        coverImage: null,
        description: "Demo only",
        capabilities: ["SHOP", "CRM"],
        demoRoles: ["CUSTOMER", "MANAGER"],
        demoLinks: { session: "/api/public/demo/demo-cafe/session" },
      }],
      journeys: [
        { key: "manager", title: "Manager journey", role: "MANAGER", route: "/demo?role=MANAGER", ordering: 20 },
        { key: "customer", title: "Customer journey", role: "CUSTOMER", route: "/demo?role=CUSTOMER", ordering: 10 },
      ],
      storytelling: [...DEMO_STORY_STEPS],
      investorReadiness: {
        demoBusinessCount: 1,
        capabilitiesDemonstrated: ["SHOP", "CRM"],
        integrationsAvailable: 2,
        seoOpportunitiesDetected: 3,
        crmActivitySimulation: { customerIdentities: 4, interactions: 5 },
      },
    });

    assert.equal(model.platformFeatures, platformFeatures);
    assert.equal(model.storytelling[0].key, "business-joins");
    assert.deepEqual(model.demo.journeys.map((journey) => journey.role), ["CUSTOMER", "MANAGER"]);
    assert.equal(model.demo.title, "Explore how different businesses use BazarBaaz");
    assert.equal(model.metrics.find((metric) => metric.label === "تعامل CRM")?.value, "5");
  });
});

describe("demo showcase story contract", () => {
  it("defines exactly the four featured investor/customer showcase organizations", () => {
    assert.deepEqual(FEATURED_DEMO_SHOWCASE_SLUGS, [
      "salamat-novin-pharmacy",
      "sepidar-dental-clinic",
      "barg-cafe-restaurant",
      "aryana-fashion-boutique",
    ]);
    assert.deepEqual(DEMO_SHOWCASE_BLUEPRINTS.map((showcase) => showcase.organization.name), [
      "داروخانه سلامت نوین",
      "کلینیک دندانپزشکی سپیدار",
      "کافه رستوران برگ",
      "مزون آریانا",
    ]);
  });

  it("keeps each showcase tied to capabilities, roles, and guided steps", () => {
    for (const showcase of DEMO_SHOWCASE_BLUEPRINTS) {
      assert.equal(showcase.capabilities.length > 0, true);
      assert.equal(showcase.demoRoles.length > 0, true);
      assert.equal(showcase.storySteps.length >= 4, true);
      for (const step of showcase.storySteps) {
        assert.equal(showcase.demoRoles.includes(step.role), true);
        assert.equal(typeof step.businessValue, "string");
        assert.equal(step.businessValue.length > 0, true);
        assert.equal(typeof step.artifact, "string");
        assert.equal(UNIVERSAL_BAZARBAAZ_JOURNEY.some((journey) => journey.stage === step.stage), true);
      }
    }
    const restaurant = DEMO_SHOWCASE_BLUEPRINTS.find((showcase) => showcase.organization.slug === "barg-cafe-restaurant");
    assert.deepEqual(restaurant?.demoRoles, ["ORGANIZATION_OWNER", "CUSTOMER", "MANAGER", "STAFF", "DRIVER"]);
    assert.equal(restaurant?.capabilities.includes("SHOP"), true);
    assert.equal(restaurant?.capabilities.includes("CRM"), true);

    const dental = DEMO_SHOWCASE_BLUEPRINTS.find((showcase) => showcase.organization.slug === "sepidar-dental-clinic");
    assert.equal(dental?.capabilities.includes("APPOINTMENT"), true);
    assert.equal(dental?.services?.flatMap((category) => category.items).some((service) => service.slug === "implant-consultation-demo"), true);
  });

  it("avoids medical claims and biometric fashion claims in showcase copy", () => {
    const text = JSON.stringify(DEMO_SHOWCASE_BLUEPRINTS);
    for (const forbidden of ["درمان قطعی", "تضمین درمان", "تشخیص پزشکی", "AI body analysis", "تحلیل بدن با هوش مصنوعی", "داده بیومتریک مشتری"]) {
      assert.equal(text.includes(forbidden), false);
    }
    assert.equal(text.includes("بدون ادعای درمانی"), true);
    assert.equal(text.includes("بدون تحلیل بدن یا داده بیومتریک"), true);
  });

  it("serializes showcase settings without leaking raw organization settings", () => {
    const blueprint = DEMO_SHOWCASE_BLUEPRINTS[0];
    const showcase = buildPublicDemoShowcase({
      organization: {
        id: "org_showcase",
        name: blueprint.organization.name,
        slug: blueprint.organization.slug,
        locale: "fa",
        logo: blueprint.organization.logo,
        coverImage: blueprint.organization.coverImage,
        description: blueprint.organization.description,
      },
      settings: {
        paymentSettings: { privateToken: "secret" },
        demo: {
          enabled: true,
          showcase: {
            featured: true,
            industry: blueprint.industry,
            industryLabel: blueprint.industryLabel,
            tagline: blueprint.tagline,
            capabilities: blueprint.capabilities,
            demoRoles: blueprint.demoRoles,
            highlights: blueprint.highlights,
            roleExperiences: blueprint.roleExperiences,
            storySteps: blueprint.storySteps,
            ctaLabel: blueprint.ctaLabel,
            artifacts: blueprint.artifacts,
          },
        },
      },
    });

    assert.equal(showcase?.organization.slug, "salamat-novin-pharmacy");
    assert.equal(showcase?.cta.sessionRoute, "/api/public/demo/salamat-novin-pharmacy/session");
    assert.equal(showcase?.storySteps[0].stage, "DIGITAL_PRESENCE");
    assert.equal(showcase?.storySteps[0].relatedCapability, "SHOP");
    assert.equal(showcase?.storySteps[0].businessValue.length > 0, true);
    assert.equal("paymentSettings" in (showcase ?? {}), false);
    assert.equal("settings" in (showcase?.organization ?? {}), false);
    assert.equal("customerIdentities" in (showcase ?? {}), false);
  });
});

describe("demo guided walkthrough contract", () => {
  it("computes walkthrough states from existing DemoProgress completion", () => {
    const steps = buildDemoJourneySteps({
      currentRole: "CUSTOMER",
      steps: [
        {
          id: "step_1",
          key: "digital-presence",
          title: "Digital Presence",
          description: "Public profile",
          role: "CUSTOMER",
          action: "VIEW",
          completedAt: "2026-08-22T00:00:00.000Z",
          businessValue: "Business can be discovered.",
          relatedCapability: "SHOP",
          artifact: "Public page",
          stage: "DIGITAL_PRESENCE",
        },
        {
          id: "step_2",
          key: "operations",
          title: "Operations",
          description: "Orders",
          role: "STAFF",
          action: "PREPARE",
          completedAt: null,
          businessValue: "Work is tracked.",
          relatedCapability: "SHOP",
          artifact: "Staff queue",
          stage: "BUSINESS_OPERATIONS",
        },
        {
          id: "step_3",
          key: "growth",
          title: "Growth",
          description: "SEO",
          role: "MANAGER",
          action: "REVIEW",
          completedAt: null,
          businessValue: "Growth is visible.",
          relatedCapability: "CRM",
          artifact: "SEO opportunities",
          stage: "GROWTH_INTELLIGENCE",
        },
      ],
    });

    assert.deepEqual(steps.map((step) => step.state), ["COMPLETED", "AVAILABLE", "LOCKED"]);
    assert.deepEqual(steps.map((step) => step.visibleForRole), [true, false, false]);
  });

  it("allows owner/platform roles to see the full role journey without bypassing API authorization", () => {
    const steps = buildDemoJourneySteps({
      currentRole: "ORGANIZATION_OWNER",
      steps: DEMO_SHOWCASE_BLUEPRINTS[2].storySteps.map((step) => ({ ...step, completedAt: null })),
    });
    assert.equal(steps.every((step) => step.visibleForRole), true);
    assert.equal(steps[0].state, "AVAILABLE");
    assert.equal(steps.slice(1).every((step) => step.state === "LOCKED"), true);
  });

  it("projects existing showcase scenarios into the universal five-stage business story", () => {
    const journey = buildUniversalDemoJourneySteps({
      currentRole: "CUSTOMER",
      steps: DEMO_SHOWCASE_BLUEPRINTS[2].storySteps.map((step) => ({ ...step, completedAt: null })),
    });

    assert.deepEqual(journey.map((step) => step.stage), UNIVERSAL_BAZARBAAZ_JOURNEY.map((step) => step.stage));
    assert.deepEqual(journey.map((step) => step.state), ["AVAILABLE", "LOCKED", "LOCKED", "LOCKED", "LOCKED"]);
    assert.equal(journey[0].businessValue.includes("منو"), true);
    assert.equal(journey[2].artifact, "CRM profile + interactions");
    assert.equal(journey[4].relatedCapability, "CRM");
  });

  it("builds investor presentation panels from role dashboard payloads without private data", () => {
    const panels = buildDemoPresentationPanels({
      role: "MANAGER",
      ordersSummary: [{ status: "PLACED", _count: { _all: 2 } }],
      customerMetrics: { totalCustomers: 3 },
      integrationsReadiness: {
        iMenu: { ready: true },
        iAM: { ready: false },
        iCV: { ready: false },
        ebc: { ready: true },
        ussd: { ready: true },
      },
      seoIntelligence: { openOpportunityTypes: ["FAQ_MISSING", "SCHEMA_MISSING"] },
      seoContentWorkflow: { requestCount: 1, reviewRequiredAssets: 2 },
      recentEvents: [{ id: "event_1" }],
      privateToken: "secret",
    });

    assert.equal(panels.operations.activeOrders, 2);
    assert.equal(panels.customerIntelligence.customers, 3);
    assert.equal(panels.businessGrowth.seoOpportunities, 2);
    assert.deepEqual(panels.integrationReadiness, {
      iMenu: true,
      iAM: false,
      iCV: false,
      ebc: true,
      ussd: true,
    });
    assert.equal(JSON.stringify(panels).includes("secret"), false);
  });
});

describe("public organization read model", () => {
  it("serializes only public organization data", () => {
    const model = buildPublicOrganizationReadModel({
      id: "org_1",
      type: "SHOP",
      capabilitiesInitializedAt: new Date("2026-08-22T00:00:00.000Z"),
      capabilities: [{ key: "SHOP", status: "ACTIVE" }, { key: "CRM", status: "ACTIVE" }],
      name: "Demo Cafe",
      slug: "demo-cafe",
      description: "Public description",
      address: "Tehran",
      lat: 35.7,
      lng: 51.4,
      phone: "021",
      email: "public@example.test",
      logo: "/logo.png",
      coverImage: "/cover.png",
      locale: "fa",
      timezone: "Asia/Tehran",
      isOpen: true,
      settings: {
        settings: {
          demo: { enabled: true },
          socialLinks: { instagram: "https://example.test/demo", empty: "" },
          privateToken: "secret",
        },
      },
      productCategories: [{ id: "cat_1", name: "Coffee", slug: "coffee", description: null, image: null }],
      serviceCategories: [],
      products: [{
        id: "product_1",
        name: "Espresso",
        slug: "espresso",
        description: null,
        image: null,
        price: 120000,
        category: { id: "cat_1", name: "Coffee", slug: "coffee" },
      }],
      services: [],
      businessHours: [{ day: "SATURDAY", openTime: "09:00", closeTime: "18:00", isOpen: true }],
      businessEntities: [{
        id: "entity_public",
        type: "PRODUCT",
        title: "Espresso",
        slug: "espresso",
        status: "ACTIVE",
        schemaTypes: ["Product"],
        seoTitle: "Espresso",
        seoDescription: "Fresh espresso",
      }],
      seoOpportunities: [{ opportunityType: "FAQ_MISSING", status: "OPEN" }],
      contentAssets: [{
        id: "asset_public",
        title: "Espresso guide",
        contentType: "PRODUCT_DESCRIPTION",
        schemaType: "Product",
        seoTitle: "Espresso guide",
        seoDescription: "Approved guide",
      }],
    });

    assert.deepEqual(model.organization.capabilities, ["SHOP", "CRM"]);
    assert.deepEqual(model.organization.socialLinks, { instagram: "https://example.test/demo" });
    assert.equal("settings" in model.organization, false);
    assert.equal("paymentSettings" in model.organization, false);
    assert.equal("customerIdentities" in model, false);
    assert.equal("customerInteractions" in model, false);
    assert.equal(model.catalog.products[0].price, 120000);
    assert.equal(model.seo.openOpportunityCount, 1);
  });
});
