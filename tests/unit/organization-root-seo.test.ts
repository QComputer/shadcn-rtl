import assert from "node:assert/strict";
import { before, mock, test } from "node:test";

let requestHeaders = new Headers();
let activePrimaryDomain: string | null = null;
const organizations: Array<{
  slug: string;
  type: string;
  capabilitiesInitializedAt: Date | null;
  capabilities: Array<{ key: string; status: string }>;
  updatedAt: Date;
  domains: Array<{ normalizedDomain: string }>;
  fanpagePosts: Array<{ updatedAt: Date }>;
}> = [];

const prisma = {
  organization: { findMany: async () => organizations },
  productCategory: { findMany: async () => [] },
  serviceCategory: { findMany: async () => [] },
  product: { findMany: async () => [] },
  service: { findMany: async () => [] },
};

mock.module("next/headers", { namedExports: { headers: async () => requestHeaders } });
mock.module("@/lib/domains/primary-domain.server", {
  namedExports: { getActivePrimaryOrganizationDomain: async () => activePrimaryDomain },
});
mock.module("@/lib/db", { defaultExport: prisma, namedExports: { prisma } });

let getOrganizationRootSeoContext: typeof import("@/lib/custom-domain-seo").getOrganizationRootSeoContext;
let sitemap: typeof import("@/app/sitemap").default;

before(async () => {
  ({ getOrganizationRootSeoContext } = await import("@/lib/custom-domain-seo"));
  ({ default: sitemap } = await import("@/app/sitemap"));
});

test("platform root SEO uses the active primary-domain root and localized alternates", async () => {
  requestHeaders = new Headers({ host: "bazarbaaz.ir" });
  activePrimaryDomain = "tenant.example";

  const context = await getOrganizationRootSeoContext({ locale: "fa", slug: "tenant" });

  assert.equal(context.isCustomDomain, false);
  assert.equal(context.baseUrl, "https://tenant.example");
  assert.equal(context.path, "/");
  assert.equal(context.alternatePath("fa"), "/");
  assert.equal(context.alternatePath("en"), "/en");
  assert.equal(context.alternatePath("ar"), "/ar");
});

test("trusted tenant-host root SEO takes precedence over the primary-domain helper", async () => {
  requestHeaders = new Headers({
    "x-bazar-custom-domain": "true",
    "x-bazar-tenant-slug": "tenant",
    "x-bazar-tenant-public-base-url": "https://trusted.example",
  });
  activePrimaryDomain = "other.example";

  const context = await getOrganizationRootSeoContext({ locale: "fa", slug: "tenant" });

  assert.equal(context.isCustomDomain, true);
  assert.equal(context.baseUrl, "https://trusted.example");
  assert.equal(context.path, "/");
});

test("platform SEO keeps the organization path when there is no active primary domain", async () => {
  requestHeaders = new Headers({ host: "bazarbaaz.ir" });
  activePrimaryDomain = null;

  const context = await getOrganizationRootSeoContext({ locale: "fa", slug: "platform-only" });

  assert.equal(context.baseUrl, undefined);
  assert.equal(context.path, "/fa/platform-only");
});

test("platform sitemap omits primary-domain roots and keeps platform-only roots", async () => {
  requestHeaders = new Headers();
  organizations.splice(0, organizations.length,
    {
      slug: "tenant-domain",
      type: "OTHER",
      capabilitiesInitializedAt: null,
      capabilities: [],
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      domains: [{ normalizedDomain: "tenant.example" }],
      fanpagePosts: [],
    },
    {
      slug: "platform-only",
      type: "OTHER",
      capabilitiesInitializedAt: null,
      capabilities: [],
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      domains: [],
      fanpagePosts: [],
    },
  );

  const entries = await sitemap();
  const urls = entries.map((entry) => entry.url);

  assert.ok(urls.includes("https://bazarbaaz.ir/fa/platform-only"));
  assert.ok(!urls.includes("https://bazarbaaz.ir/fa/tenant-domain"));
});
