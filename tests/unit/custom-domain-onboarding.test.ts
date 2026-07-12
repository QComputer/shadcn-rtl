import { register } from "node:module";
import { describe, it, before, afterEach } from "node:test";
import assert from "node:assert/strict";

// Register the test loader so the real `@/`-aliased source modules (and the
// `@prisma/client` / `@/lib/api-guards` stubs) can be imported directly by
// their production specifiers. The loader is registered before the dynamic
// imports below so it is active when they are resolved.
register(new URL("./loader.mjs", import.meta.url));

// ApiError is resolved through the same stub the source modules use, so
// `instanceof ApiError` checks remain valid against the real code paths.
let ApiError: any;
let normalizeDomainHost: any;
let validateRawDomain: any;
let isApexDomain: any;
let getDomainLabels: any;
let getSld: any;
let getTld: any;
let normalizeDomainInput: any;
let addProjectDomainToVercel: any;
let getVercelDomainAutomationState: any;
let isVercelDomainAutomationDryRun: any;
let isPlatformHost: any;
let isCustomDomainBypassPath: any;
let assertDomainOwnership: any;
let resolveActiveTenantForHost: any;
let toSupportedLocale: any;

// Track env vars the test mutates so they can be restored between cases.
const ENV_KEYS = [
  "CUSTOM_DOMAIN_REAL_MUTATION_ENABLED",
  "VERCEL_DOMAIN_AUTOMATION_DRY_RUN",
  "VERCEL_PROJECT_ID",
];
const envSnapshot: Record<string, string | undefined> = {};

before(async () => {
  ({ ApiError } = await import("@/lib/api-guards"));
  ({
    normalizeDomainHost,
    validateRawDomain,
    isApexDomain,
    getDomainLabels,
    getSld,
    getTld,
    normalizeDomainInput,
  } = await import("@/lib/domains/domain-normalization.server"));
  ({
    addProjectDomainToVercel,
    getVercelDomainAutomationState,
    isVercelDomainAutomationDryRun,
  } = await import("@/lib/vercel-domain-automation"));
  ({ isPlatformHost, isCustomDomainBypassPath } = await import("@/lib/custom-domain-routing"));
  ({ assertDomainOwnership } = await import("@/lib/domains/domain-authorization.server"));
  ({ resolveActiveTenantForHost, toSupportedLocale } = await import("@/lib/domains/domain-resolver.server"));

  for (const key of ENV_KEYS) envSnapshot[key] = process.env[key];
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (envSnapshot[key] === undefined) delete process.env[key];
    else process.env[key] = envSnapshot[key];
  }
});

function clearProviderEnv() {
  delete process.env.CUSTOM_DOMAIN_REAL_MUTATION_ENABLED;
  delete process.env.VERCEL_DOMAIN_AUTOMATION_DRY_RUN;
}

describe("domain normalization", () => {
  it("lower-cases the domain", () => {
    assert.equal(validateRawDomain("SHOP.Example.IR"), "shop.example.ir");
    assert.equal(normalizeDomainHost("WWW.Shop.Example.com"), "shop.example.com");
  });

  it("removes a trailing dot", () => {
    assert.equal(validateRawDomain("shop.example.ir."), "shop.example.ir");
    assert.equal(normalizeDomainHost("example.com."), "example.com");
  });

  it("strips scheme, path and port from a host", () => {
    assert.equal(
      normalizeDomainHost("https://MyShop.Example.com:3000/foo/bar"),
      "myshop.example.com",
    );
    assert.equal(normalizeDomainHost("http://example.ir:8080"), "example.ir");
  });

  it("rejects localhost and *.localhost", () => {
    assert.throws(() => validateRawDomain("localhost"), (err: any) => err instanceof ApiError && err.status === 400);
    assert.throws(() => validateRawDomain("sub.localhost"), (err: any) => err instanceof ApiError && err.status === 400);
  });

  it("rejects IP addresses", () => {
    assert.throws(() => validateRawDomain("127.0.0.1"), (err: any) => err instanceof ApiError && err.status === 400);
    assert.throws(() => validateRawDomain("192.168.1.1"), (err: any) => err instanceof ApiError && err.status === 400);
  });

  it("rejects wildcard domains", () => {
    assert.throws(() => validateRawDomain("*.example.com"), (err: any) => err instanceof ApiError && err.status === 400);
  });

  it("rejects domains with invalid characters", () => {
    assert.throws(() => validateRawDomain("exa mple.com"), (err: any) => err instanceof ApiError && err.status === 400);
    assert.throws(() => validateRawDomain("-bad.example.com"), (err: any) => err instanceof ApiError && err.status === 400);
  });

  it("accepts valid domains", () => {
    assert.equal(validateRawDomain("shop.example.ir"), "shop.example.ir");
    assert.equal(validateRawDomain("my-shop.co.uk"), "my-shop.co.uk");
  });

  it("detects apex vs subdomain", () => {
    assert.equal(isApexDomain("example.ir"), true);
    assert.equal(isApexDomain("shop.example.ir"), false);
    assert.equal(isApexDomain("a.b.shop.example.ir"), false);
  });

  it("extracts labels, sld and tld", () => {
    assert.deepEqual(getDomainLabels("shop.example.ir"), ["shop", "example", "ir"]);
    assert.equal(getSld("shop.example.ir"), "example");
    assert.equal(getTld("shop.example.ir"), "ir");
    assert.equal(getSld("example.ir"), "example");
    assert.equal(getTld("example.ir"), "ir");
  });

  it("normalizes a full input into a structured record", () => {
    const apex = normalizeDomainInput({ rawDomain: "Example.ir", organizationId: "org_1" });
    assert.equal(apex.normalizedDomain, "example.ir");
    assert.equal(apex.kind, "APEX");
    assert.equal(apex.provider, "VERCEL");
    assert.equal(apex.isApex, true);
    assert.deepEqual(apex.labels, ["example", "ir"]);
    assert.equal(apex.sld, "example");
    assert.equal(apex.tld, "ir");

    const sub = normalizeDomainInput({ rawDomain: "shop.example.ir", organizationId: "org_1" });
    assert.equal(sub.kind, "SUBDOMAIN");
    assert.equal(sub.isApex, false);
  });
});

describe("provider disabled mode (vercel automation)", () => {
  it("throws ApiError(403) when real mutations are not enabled", async () => {
    clearProviderEnv();
    await assert.rejects(
      () => addProjectDomainToVercel("shop.example.ir"),
      (err: any) => err instanceof ApiError && err.status === 403,
    );
  });

  it("returns a dry-run result when VERCEL_DOMAIN_AUTOMATION_DRY_RUN is set", async () => {
    clearProviderEnv();
    process.env.VERCEL_DOMAIN_AUTOMATION_DRY_RUN = "true";

    const result = await addProjectDomainToVercel("Shop.Example.ir");
    assert.equal(result.dryRun, true);
    assert.equal(result.action, "add");
    assert.equal(result.domain, "shop.example.ir");
    assert.equal(result.verified, false);
    assert.equal(isVercelDomainAutomationDryRun(), true);
  });

  it("reports automation state including realMutationsEnabled", () => {
    clearProviderEnv();
    process.env.VERCEL_PROJECT_ID = "prj_test";
    let state = getVercelDomainAutomationState();
    assert.equal(state.realMutationsEnabled, false);
    assert.equal(state.projectConfigured, true);
    assert.equal(state.dryRun, false);

    process.env.CUSTOM_DOMAIN_REAL_MUTATION_ENABLED = "true";
    state = getVercelDomainAutomationState();
    assert.equal(state.realMutationsEnabled, true);
  });
});

describe("authorization (assertDomainOwnership)", () => {
  function makePrisma(overrides: {
    domain?: unknown;
    membership?: unknown;
    user?: unknown;
  }) {
    return {
      organizationDomain: {
        findUnique: async () => overrides.domain ?? null,
      },
      organizationMember: {
        findFirst: async () => overrides.membership ?? null,
      },
      user: {
        findUnique: async () => overrides.user ?? null,
      },
    } as any;
  }

  it("returns 404 for a non-existent domain", async () => {
    const prisma = makePrisma({ domain: null });
    await assert.rejects(
      () => assertDomainOwnership(prisma, "user_1", "missing"),
      (err: any) => err instanceof ApiError && err.status === 404,
    );
  });

  it("returns 404 for a soft-deleted domain", async () => {
    const prisma = makePrisma({
      domain: { id: "d1", organizationId: "org_1", deletedAt: new Date(), domain: "shop.example.ir" },
    });
    await assert.rejects(
      () => assertDomainOwnership(prisma, "user_1", "d1"),
      (err: any) => err instanceof ApiError && err.status === 404,
    );
  });

  it("allows an active member of the owning organization", async () => {
    const prisma = makePrisma({
      domain: { id: "d1", organizationId: "org_1", deletedAt: null, domain: "shop.example.ir" },
      membership: { id: "m1" },
    });
    const domain = await assertDomainOwnership(prisma, "user_1", "d1");
    assert.equal(domain.id, "d1");
    assert.equal(domain.organizationId, "org_1");
  });

  it("returns 403 for a non-member, non-super-admin user", async () => {
    const prisma = makePrisma({
      domain: { id: "d1", organizationId: "org_1", deletedAt: null, domain: "shop.example.ir" },
      membership: null,
      user: { role: "CUSTOMER" },
    });
    await assert.rejects(
      () => assertDomainOwnership(prisma, "user_1", "d1"),
      (err: any) => err instanceof ApiError && err.status === 403,
    );
  });

  it("allows a SUPER_ADMIN even without membership", async () => {
    const prisma = makePrisma({
      domain: { id: "d1", organizationId: "org_1", deletedAt: null, domain: "shop.example.ir" },
      membership: null,
      user: { role: "SUPER_ADMIN" },
    });
    const domain = await assertDomainOwnership(prisma, "admin_1", "d1");
    assert.equal(domain.id, "d1");
  });

  it("allows the domain when there is no session user", async () => {
    const prisma = makePrisma({
      domain: { id: "d1", organizationId: "org_1", deletedAt: null, domain: "shop.example.ir" },
    });
    const domain = await assertDomainOwnership(prisma, "", "d1");
    assert.equal(domain.id, "d1");
  });
});

describe("host routing helpers", () => {
  it("recognizes default platform hosts", () => {
    assert.equal(isPlatformHost("localhost"), true);
    assert.equal(isPlatformHost("127.0.0.1"), true);
    assert.equal(isPlatformHost("bazar-baz.ir"), true);
    assert.equal(isPlatformHost("www.bazar-baz.ir"), true);
    assert.equal(isPlatformHost("shadcn-rtl.vercel.app"), true);
  });

  it("treats unknown custom domains as non-platform hosts", () => {
    assert.equal(isPlatformHost("shop.example.ir"), false);
    assert.equal(isPlatformHost("tenant.my-bazar.com"), false);
  });

  it("identifies bypass paths", () => {
    assert.equal(isCustomDomainBypassPath("/api/foo"), true);
    assert.equal(isCustomDomainBypassPath("/_next/static/x.js"), true);
    assert.equal(isCustomDomainBypassPath("/uploads/x.png"), true);
    assert.equal(isCustomDomainBypassPath("/og-image/x"), true);
    assert.equal(isCustomDomainBypassPath("/static/x"), true);
    assert.equal(isCustomDomainBypassPath("/favicon.ico"), true);
    assert.equal(isCustomDomainBypassPath("/logo.png"), true);
  });

  it("does not bypass seo or app entry paths", () => {
    assert.equal(isCustomDomainBypassPath("/"), false);
    assert.equal(isCustomDomainBypassPath("/robots.txt"), false);
    assert.equal(isCustomDomainBypassPath("/sitemap.xml"), false);
    assert.equal(isCustomDomainBypassPath("/shop/slug"), false);
  });

  it("normalizeDomainHost lowercases, strips www and trailing dot", () => {
    assert.equal(normalizeDomainHost("WWW.Shop.Example.com."), "shop.example.com");
    assert.equal(normalizeDomainHost("www.example.ir"), "example.ir");
    assert.equal(normalizeDomainHost(null), "");
  });
});

describe("ACTIVE-only routing (resolveActiveTenantForHost)", () => {
  function makePrisma(status: string, organizationOverrides: Record<string, unknown> = {}) {
    return {
      organizationDomain: {
        findUnique: async () => ({
          normalizedDomain: "shop.example.ir",
          status,
          organization: {
            id: "org_1",
            slug: "myshop",
            locale: "en",
            type: "SHOP",
            isActive: true,
            deletedAt: null,
            ...organizationOverrides,
          },
        }),
      },
    } as any;
  }

  it("resolves an ACTIVE domain to its tenant", async () => {
    const prisma = makePrisma("ACTIVE");
    const tenant = await resolveActiveTenantForHost(prisma, "shop.example.ir");
    assert.deepEqual(tenant, {
      slug: "myshop",
      locale: "en",
      organizationId: "org_1",
      organizationType: "SHOP",
    });
  });

  it("returns null for non-ACTIVE statuses", async () => {
    for (const status of ["VERIFYING", "DNS_REQUIRED", "ERROR", "REQUESTED"]) {
      const prisma = makePrisma(status);
      assert.equal(await resolveActiveTenantForHost(prisma, "shop.example.ir"), null, `status ${status}`);
    }
  });

  it("returns null when the organization is inactive or soft-deleted", async () => {
    assert.equal(await resolveActiveTenantForHost(makePrisma("ACTIVE", { isActive: false }), "shop.example.ir"), null);
    assert.equal(await resolveActiveTenantForHost(makePrisma("ACTIVE", { deletedAt: new Date() }), "shop.example.ir"), null);
  });

  it("normalizes the host before lookup (www + trailing dot)", async () => {
    const prisma = makePrisma("ACTIVE");
    const tenant = await resolveActiveTenantForHost(prisma, "WWW.Shop.Example.ir.");
    assert.equal(tenant?.slug, "myshop");
  });

  it("returns null when no host is provided", async () => {
    const prisma = makePrisma("ACTIVE");
    assert.equal(await resolveActiveTenantForHost(prisma, ""), null);
    assert.equal(await resolveActiveTenantForHost(prisma, null), null);
  });

  it("falls back to the default locale for unsupported organization locale", () => {
    assert.equal(toSupportedLocale("de"), "fa");
    assert.equal(toSupportedLocale("en"), "en");
    assert.equal(toSupportedLocale(null), "fa");
  });
});
