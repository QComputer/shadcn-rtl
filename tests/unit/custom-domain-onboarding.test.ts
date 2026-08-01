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
let verifyProjectDomainOnVercel: any;
let removeProjectDomainFromVercel: any;
let getVercelDomainAutomationState: any;
let isVercelDomainAutomationDryRun: any;
let CUSTOM_DOMAIN_REAL_MUTATION_ACK_VALUE: string;
let validateShopDomainInput: any;
let isPlatformHost: any;
let isCustomDomainBypassPath: any;
let buildShopPlatformPath: any;
let buildTenantPublicPath: any;
let getShopSubPathFromPlatformPath: any;
let parseShopPlatformPath: any;
let isSeoIndexableShopSubPath: any;
let buildShopCategoryPath: any;
let buildShopProductPath: any;
let buildShopPublicPath: any;
let assertDomainOwnership: any;
let resolveActiveTenantForHost: any;
let toSupportedLocale: any;

// Track env vars the test mutates so they can be restored between cases.
const ENV_KEYS = [
  "CUSTOM_DOMAIN_REAL_MUTATION_ENABLED",
  "CUSTOM_DOMAIN_REAL_MUTATION_ACK",
  "VERCEL_API_TOKEN",
  "VERCEL_ACCESS_TOKEN",
  "VERCEL_DOMAIN_AUTOMATION_DRY_RUN",
  "VERCEL_PROJECT_ID",
];
const envSnapshot: Record<string, string | undefined> = {};
const originalFetch = globalThis.fetch;

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
    verifyProjectDomainOnVercel,
    removeProjectDomainFromVercel,
    getVercelDomainAutomationState,
    isVercelDomainAutomationDryRun,
    CUSTOM_DOMAIN_REAL_MUTATION_ACK_VALUE,
  } = await import("@/lib/vercel-domain-automation"));
  ({ validateShopDomainInput } = await import("@/lib/shop-domain-admin"));
  ({
    buildShopPlatformPath,
    buildTenantPublicPath,
    getShopSubPathFromPlatformPath,
    isCustomDomainBypassPath,
    isPlatformHost,
    isSeoIndexableShopSubPath,
    parseShopPlatformPath,
  } = await import("@/lib/custom-domain-routing"));
  ({ buildShopCategoryPath, buildShopProductPath, buildShopPublicPath } = await import("@/lib/shop-public-paths"));
  ({ assertDomainOwnership } = await import("@/lib/domains/domain-authorization.server"));
  ({ resolveActiveTenantForHost, toSupportedLocale } = await import("@/lib/domains/domain-resolver.server"));

  for (const key of ENV_KEYS) envSnapshot[key] = process.env[key];
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (envSnapshot[key] === undefined) delete process.env[key];
    else process.env[key] = envSnapshot[key];
  }
  globalThis.fetch = originalFetch;
});

function clearProviderEnv() {
  delete process.env.CUSTOM_DOMAIN_REAL_MUTATION_ENABLED;
  delete process.env.CUSTOM_DOMAIN_REAL_MUTATION_ACK;
  delete process.env.VERCEL_API_TOKEN;
  delete process.env.VERCEL_ACCESS_TOKEN;
  delete process.env.VERCEL_DOMAIN_AUTOMATION_DRY_RUN;
  delete process.env.VERCEL_PROJECT_ID;
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

  it("normalizes scheme, path and port when reading host headers", () => {
    assert.equal(
      normalizeDomainHost("https://MyShop.Example.com:3000/foo/bar"),
      "myshop.example.com",
    );
    assert.equal(normalizeDomainHost("http://example.ir:8080"), "example.ir");
  });

  it("rejects schemes, paths, queries and ports for submitted domains", () => {
    assert.throws(() => validateRawDomain("https://example.ir"), (err: any) => err instanceof ApiError && err.status === 400);
    assert.throws(() => validateRawDomain("example.ir/path"), (err: any) => err instanceof ApiError && err.status === 400);
    assert.throws(() => validateRawDomain("example.ir?x=1"), (err: any) => err instanceof ApiError && err.status === 400);
    assert.throws(() => validateRawDomain("example.ir:443"), (err: any) => err instanceof ApiError && err.status === 400);
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

  it("normalizes IDN domains to punycode", () => {
    assert.equal(validateRawDomain("مثال.ir"), "xn--mgbh0fb.ir");
  });

  it("rejects platform and reserved hosts", () => {
    assert.throws(() => validateRawDomain("bazar-baz.ir"), (err: any) => err instanceof ApiError && err.status === 400);
    assert.throws(() => validateRawDomain("www.bazar-baz.ir"), (err: any) => err instanceof ApiError && err.status === 400);
  });

  it("uses the strict validator for legacy shop-domain admin inputs", () => {
    assert.equal(validateShopDomainInput("Shop.Example.ir"), "shop.example.ir");
    assert.throws(() => validateShopDomainInput("https://shop.example.ir"), (err: any) => err instanceof ApiError && err.status === 400);
    assert.throws(() => validateShopDomainInput("shop.example.ir/path"), (err: any) => err instanceof ApiError && err.status === 400);
    assert.throws(() => validateShopDomainInput("bazar-baz.ir"), (err: any) => err instanceof ApiError && err.status === 400);
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

  it("throws ApiError(403) when exact mutation acknowledgement is missing", async () => {
    clearProviderEnv();
    process.env.CUSTOM_DOMAIN_REAL_MUTATION_ENABLED = "true";
    process.env.VERCEL_PROJECT_ID = "prj_test";
    process.env.VERCEL_API_TOKEN = "secret_token";

    await assert.rejects(
      () => addProjectDomainToVercel("shop.example.ir"),
      (err: any) => err instanceof ApiError && err.status === 403 && /CUSTOM_DOMAIN_REAL_MUTATION_ACK/.test(err.message),
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
    process.env.CUSTOM_DOMAIN_REAL_MUTATION_ACK = CUSTOM_DOMAIN_REAL_MUTATION_ACK_VALUE;
    state = getVercelDomainAutomationState();
    assert.equal(state.realMutationsEnabled, true);
  });

  it("maps add/check/remove provider responses without exposing raw provider JSON", async () => {
    clearProviderEnv();
    process.env.CUSTOM_DOMAIN_REAL_MUTATION_ENABLED = "true";
    process.env.CUSTOM_DOMAIN_REAL_MUTATION_ACK = CUSTOM_DOMAIN_REAL_MUTATION_ACK_VALUE;
    process.env.VERCEL_PROJECT_ID = "prj_test";
    process.env.VERCEL_API_TOKEN = "secret_token";

    const calls: Array<{ url: string; init: RequestInit }> = [];
    globalThis.fetch = (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({
        projectId: "prj_test",
        verified: url.includes("/verify"),
        verification: [{ type: "TXT", domain: "_vercel.shop.example.ir", value: "verify-token" }],
      }), { status: 200, headers: { "content-type": "application/json" } });
    }) as typeof fetch;

    const add = await addProjectDomainToVercel("shop.example.ir");
    assert.equal(add.status, "VERIFYING");
    assert.equal(add.verificationToken, "verify-token");
    assert.equal("raw" in add, false);

    const check = await verifyProjectDomainOnVercel("shop.example.ir");
    assert.equal(check.status, "ACTIVE");
    assert.equal(check.verified, true);
    assert.equal("raw" in check, false);

    const remove = await removeProjectDomainFromVercel("shop.example.ir");
    assert.equal(remove.status, "DNS_REQUIRED");
    assert.equal(remove.verified, false);
    assert.equal("raw" in remove, false);

    assert.equal(calls.length, 3);
    assert.equal((calls[0].init.headers as Record<string, string>).Authorization, "Bearer secret_token");
  });

  it("sanitizes provider errors and does not leak tokens", async () => {
    clearProviderEnv();
    process.env.CUSTOM_DOMAIN_REAL_MUTATION_ENABLED = "true";
    process.env.CUSTOM_DOMAIN_REAL_MUTATION_ACK = CUSTOM_DOMAIN_REAL_MUTATION_ACK_VALUE;
    process.env.VERCEL_PROJECT_ID = "prj_test";
    process.env.VERCEL_API_TOKEN = "secret_token";

    globalThis.fetch = (async () => new Response(JSON.stringify({
      error: { message: "Authorization: Bearer secret_token token=secret_token failed" },
    }), { status: 429, headers: { "content-type": "application/json" } })) as typeof fetch;

    const result = await addProjectDomainToVercel("shop.example.ir");
    assert.equal(result.ok, false);
    assert.equal(result.status, "ERROR");
    assert.match(result.message, /\[redacted\]/);
    assert.equal(result.message.includes("secret_token"), false);
    assert.equal("raw" in result, false);
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

  it("rewrites clean custom-domain category paths to the internal shop category route", () => {
    const categorySegment = "پیتزا-ایتالیایی-cmo8ht";
    assert.equal(
      buildShopPlatformPath({
        locale: "fa",
        slug: "chakme",
        publicPathname: `/category/${categorySegment}`,
      }),
      `/fa/shop/chakme/category/${categorySegment}`,
    );
  });

  it("rewrites percent-encoded custom-domain category paths without changing the identifier", () => {
    const encodedCategorySegment = "%D9%BE%DB%8C%D8%AA%D8%B2%D8%A7-%D8%A7%DB%8C%D8%AA%D8%A7%D9%84%DB%8C%D8%A7%DB%8C%DB%8C-cmo8ht";
    assert.equal(
      buildShopPlatformPath({
        locale: "fa",
        slug: "chakme",
        publicPathname: `/category/${encodedCategorySegment}`,
      }),
      `/fa/shop/chakme/category/${encodedCategorySegment}`,
    );
  });

  it("redirects platform-shaped custom-domain category URLs to the tenant canonical path", () => {
    const platformPath = getShopSubPathFromPlatformPath("/fa/shop/chakme/category/پیتزا-ایتالیایی-cmo8ht", "chakme");
    assert.deepEqual(platformPath, {
      locale: "fa",
      subPath: "/category/پیتزا-ایتالیایی-cmo8ht",
    });
    assert.equal(buildTenantPublicPath(platformPath.locale, platformPath.subPath), "/category/پیتزا-ایتالیایی-cmo8ht");
  });

  it("keeps non-default custom-domain locales in canonical category paths", () => {
    assert.equal(
      buildShopCategoryPath({
        locale: "en",
        shopSlug: "chakme",
        categorySegment: "pizza-cmo8ht",
        isCustomDomain: true,
      }),
      "/en/category/pizza-cmo8ht",
    );
  });

  it("preserves category pagination query strings for platform and custom domains", () => {
    assert.equal(
      buildShopCategoryPath({
        locale: "fa",
        shopSlug: "chakme",
        categorySegment: "پیتزا-ایتالیایی-cmo8ht",
        page: 2,
      }),
      "/fa/shop/chakme/category/پیتزا-ایتالیایی-cmo8ht?page=2",
    );
    assert.equal(
      buildShopCategoryPath({
        locale: "fa",
        shopSlug: "chakme",
        categorySegment: "پیتزا-ایتالیایی-cmo8ht",
        isCustomDomain: true,
        page: 2,
      }),
      "/category/پیتزا-ایتالیایی-cmo8ht?page=2",
    );
  });

  it("keeps product paths and all-products paths on their current public surface", () => {
    assert.equal(buildShopPublicPath({ locale: "fa", shopSlug: "chakme", isCustomDomain: true }), "/");
    assert.equal(buildShopPublicPath({ locale: "fa", shopSlug: "chakme" }), "/fa/shop/chakme");
    assert.equal(
      buildShopProductPath({
        locale: "fa",
        shopSlug: "chakme",
        productSegment: "latte-cmo123",
        isCustomDomain: true,
      }),
      "/product/latte-cmo123",
    );
    assert.equal(
      buildShopProductPath({
        locale: "fa",
        shopSlug: "chakme",
        productSegment: "latte-cmo123",
      }),
      "/fa/shop/chakme/product/latte-cmo123",
    );
  });

  it("recognizes category and product paths as SEO-indexable shop subpaths", () => {
    assert.equal(isSeoIndexableShopSubPath("/category/پیتزا-ایتالیایی-cmo8ht"), true);
    assert.equal(isSeoIndexableShopSubPath("/product/latte-cmo123"), true);
    assert.equal(isSeoIndexableShopSubPath("/checkout"), false);
  });

  it("parses platform category paths without losing locale, shop slug, or category segment", () => {
    assert.deepEqual(parseShopPlatformPath("/fa/shop/chakme/category/پیتزا-ایتالیایی-cmo8ht"), {
      locale: "fa",
      slug: "chakme",
      subPath: "/category/پیتزا-ایتالیایی-cmo8ht",
    });
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

  it("resolves an ACTIVE appointment domain to its tenant", async () => {
    const prisma = makePrisma("ACTIVE", { type: "APPOINTMENT", slug: "clinic-demo", locale: "fa" });
    const tenant = await resolveActiveTenantForHost(prisma, "clinic.example.ir");
    assert.deepEqual(tenant, {
      slug: "clinic-demo",
      locale: "fa",
      organizationId: "org_1",
      organizationType: "APPOINTMENT",
    });
  });

  it("returns null for non-ACTIVE statuses", async () => {
    for (const status of ["VERIFYING", "DNS_REQUIRED", "ERROR", "REQUESTED", "DISABLED", "REMOVED"]) {
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
