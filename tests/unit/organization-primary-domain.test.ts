import assert from "node:assert/strict";
import { before, mock, test } from "node:test";

let row: { domain: string; normalizedDomain: string } | null = { domain: "www.shop.example", normalizedDomain: "shop.example" };
let query: unknown;
const prisma = { organizationDomain: { findFirst: async (args: unknown) => { query = args; return row; } } };
mock.module("@/lib/db", { defaultExport: prisma, namedExports: { prisma } });
let lookup: typeof import("@/lib/domains/primary-domain.server").getActivePrimaryOrganizationDomain;
before(async () => {
  ({ getActivePrimaryOrganizationDomain: lookup } = await import("@/lib/domains/primary-domain.server"));
});
test("primary lookup requires exact tenant and active non-platform organization; preserves registered www", async () => {
  assert.equal(await lookup("tenant"), "www.shop.example");
  assert.deepEqual(query, {
    where: { status: "ACTIVE", isPrimary: true, organization: { slug: "tenant", isActive: true, deletedAt: null, isPlatformOwner: false } },
    select: { domain: true, normalizedDomain: true },
  });
});
test("missing or invalid registry records cannot produce a redirect host", async () => {
  row = null; assert.equal(await lookup("tenant"), null);
  for (const normalizedDomain of ["https://shop.example", "shop.example/path", "bazarbaaz.ir", "127.0.0.1", "shop.example:443"]) {
    row = { domain: normalizedDomain, normalizedDomain };
    assert.equal(await lookup("tenant"), null);
  }
  row = { domain: "other.example", normalizedDomain: "shop.example" };
  assert.equal(await lookup("tenant"), "shop.example");
});
