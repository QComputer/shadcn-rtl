import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import type { PrismaClient } from "@prisma/client";

const enabled = process.env.RETAIL_BRAND_PG_ACCEPTANCE === "1";

function assertGuardedDatabase() {
  assert.equal(process.env.DATABASE_URL, process.env.DIRECT_URL, "both Prisma URLs must point to the same disposable local database");
  for (const key of ["DATABASE_URL", "DIRECT_URL"]) {
    const url = new URL(process.env[key] ?? "");
    assert.equal(url.protocol, "postgresql:", `${key} must use PostgreSQL`);
    assert.equal(url.hostname, "127.0.0.1", `${key} must use the guarded loopback`);
    assert.equal(url.port, "55439", `${key} must use the guarded Retail brand test port`);
    assert.equal(url.pathname, "/retail_hero_test", `${key} must use the exact disposable test database`);
    assert.equal(decodeURIComponent(url.username), "hero_test", `${key} must use the isolated test role`);
    assert.equal(decodeURIComponent(url.password), "local_admin_fixture_only", `${key} must use the disposable fixture credential`);
  }
}

test("Retail storefront primary color persists and remains tenant scoped on disposable PostgreSQL", {
  skip: !enabled,
  concurrency: false,
}, async () => {
  assertGuardedDatabase();
  const { PrismaClient: Client } = await import("@prisma/client");
  const db: PrismaClient = new Client({ log: ["error"] });
  (globalThis as unknown as { bazarBazPrisma: PrismaClient | undefined }).bazarBazPrisma = db;

  const identity = await db.$queryRaw<Array<{ database: string; version_num: number; current_user: string }>>`
    SELECT current_database() AS database, current_setting('server_version_num')::int AS version_num, current_user`;
  assert.equal(identity[0]?.database, "retail_hero_test");
  assert.ok((identity[0]?.version_num ?? 0) >= 170000 && (identity[0]?.version_num ?? 0) < 180000, "fixture must be PostgreSQL 17");
  assert.equal(identity[0]?.current_user, decodeURIComponent(new URL(process.env.DATABASE_URL!).username));

  const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
  const slugs = {
    a: `brand-a-${suffix}`,
    b: `brand-b-${suffix}`,
    hotel: `brand-hotel-${suffix}`,
  };
  const organizationIds: string[] = [];

  try {
    const [{ organizationBrandingPatchSchema }, { getPublicCatalogSnapshot }] = await Promise.all([
      import("@/lib/organization-branding-management"),
      import("@/lib/public-catalog/service.server"),
    ]);
    const [shopA, shopB, hotel] = await Promise.all([
      db.organization.create({ data: { type: "SHOP", name: `Brand A ${suffix}`, slug: slugs.a } }),
      db.organization.create({ data: { type: "SHOP", name: `Brand B ${suffix}`, slug: slugs.b } }),
      db.organization.create({ data: { type: "APPOINTMENT", name: `Brand Hotel ${suffix}`, slug: slugs.hotel } }),
    ]);
    organizationIds.push(shopA.id, shopB.id, hotel.id);
    await db.organizationCapability.createMany({ data: [shopA, shopB].map(organization => ({
      organizationId: organization.id,
      key: "SHOP" as const,
      status: "ACTIVE" as const,
      enabledAt: new Date(),
    })) });

    const patchA = organizationBrandingPatchSchema.parse({ themeColor: "#112233", backgroundColor: "#fefefe", storefrontPrimaryColor: "#5A9B42" });
    const patchB = organizationBrandingPatchSchema.parse({ themeColor: "#445566", storefrontPrimaryColor: "#7040B0" });
    const patchHotel = organizationBrandingPatchSchema.parse({ themeColor: "#778899", storefrontPrimaryColor: "#CC3300" });
    const saveBranding = (organizationId: string, data: typeof patchA | typeof patchB | typeof patchHotel) => db.organizationBranding.upsert({
      where: { organizationId },
      create: { organizationId, ...data },
      update: data,
    });
    await Promise.all([
      saveBranding(shopA.id, patchA),
      saveBranding(shopB.id, patchB),
      saveBranding(hotel.id, patchHotel),
    ]);

    const [persistedA, persistedB] = await Promise.all([
      db.organizationBranding.findUniqueOrThrow({ where: { organizationId: shopA.id } }),
      db.organizationBranding.findUniqueOrThrow({ where: { organizationId: shopB.id } }),
    ]);
    assert.equal(persistedA.storefrontPrimaryColor, "#5A9B42");
    assert.equal(persistedA.themeColor, "#112233", "PWA theme color remains independently persisted");
    assert.equal(persistedA.backgroundColor, "#fefefe");
    assert.equal(persistedB.storefrontPrimaryColor, "#7040B0");
    assert.equal(persistedB.themeColor, "#445566");

    const [catalogA, catalogB] = await Promise.all([
      getPublicCatalogSnapshot(slugs.a),
      getPublicCatalogSnapshot(slugs.b),
    ]);
    assert.equal(catalogA.organization.branding.primaryColor, "#5A9B42");
    assert.equal(catalogB.organization.branding.primaryColor, "#7040B0");
    assert.notEqual(catalogA.organization.branding.primaryColor, catalogB.organization.branding.primaryColor, "public catalog colors must not cross tenant boundaries");
    await assert.rejects(getPublicCatalogSnapshot(slugs.hotel), /Catalog not found/, "appointment and Hotel organizations are not exposed as Retail catalogs");

    const reset = organizationBrandingPatchSchema.parse({ storefrontPrimaryColor: null });
    await saveBranding(shopA.id, reset);
    const resetA = await db.organizationBranding.findUniqueOrThrow({ where: { organizationId: shopA.id } });
    assert.equal(resetA.storefrontPrimaryColor, null, "null clears the storefront brand color");
    assert.equal(resetA.themeColor, "#112233", "clearing storefront color leaves the PWA theme unchanged");
    const resetCatalog = await getPublicCatalogSnapshot(slugs.a);
    assert.equal(resetCatalog.organization.branding.primaryColor, null);
  } finally {
    if (organizationIds.length) {
      await db.organizationBranding.deleteMany({ where: { organizationId: { in: organizationIds } } });
      await db.organizationCapability.deleteMany({ where: { organizationId: { in: organizationIds } } });
      await db.organization.deleteMany({ where: { id: { in: organizationIds } } });
    }
    await db.$disconnect();
    (globalThis as unknown as { bazarBazPrisma?: PrismaClient }).bazarBazPrisma = undefined;
  }
});
