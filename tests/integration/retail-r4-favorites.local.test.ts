import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";

const enabled = process.env.RETAIL_R4_PG_ACCEPTANCE === "1";

function assertGuardedDatabase() {
  assert.equal(process.env.DATABASE_URL, process.env.DIRECT_URL);
  for (const key of ["DATABASE_URL", "DIRECT_URL"]) {
    const url = new URL(process.env[key] ?? "");
    assert.equal(url.protocol, "postgresql:");
    assert.equal(url.hostname, "127.0.0.1");
    assert.equal(url.port, "54713");
    assert.equal(url.pathname, "/retail_p0_20261019");
    assert.match(decodeURIComponent(url.username), /^consol_[a-f0-9]+$/);
  }
}

test("Retail R4 favorites enforce tenant visibility, idempotency, deletion, and the 200 item cap", {
  skip: !enabled,
  concurrency: false,
}, async () => {
  assertGuardedDatabase();
  const [{ PrismaClient }, favorites] = await Promise.all([
    import("@prisma/client"),
    import("@/lib/retail/favorites.server"),
  ]);
  const db = new PrismaClient({ log: ["error"] });
  const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
  const organizationIds: string[] = [];
  const userIds: string[] = [];
  const categoryIds: string[] = [];
  const productIds: string[] = [];

  try {
    const organization = await db.organization.create({ data: {
      type: "SHOP", name: `R4 favorites ${suffix}`, slug: `r4-fav-${suffix}`,
      capabilitiesInitializedAt: new Date(),
    } });
    organizationIds.push(organization.id);
    await db.organizationCapability.create({ data: { organizationId: organization.id, key: "SHOP", status: "ACTIVE", enabledAt: new Date() } });
    const user = await db.user.create({ data: {
      name: `r4-fav-user-${suffix}`, password: "synthetic-test-password", role: "CUSTOMER",
    } });
    userIds.push(user.id);
    const category = await db.productCategory.create({ data: {
      name: "R4 synthetic favorites", slug: `r4-fav-${suffix}`, organizationId: organization.id, organizationSlug: organization.slug,
    } });
    categoryIds.push(category.id);

    const products = await Promise.all(Array.from({ length: 202 }, (_, index) => db.product.create({ data: {
      name: `R4 favorite product ${index}`, slug: `r4-fav-${suffix}-${index}`,
      basePrice: 1000, organizationId: organization.id, organizationSlug: organization.slug, categoryId: category.id,
    } })));
    productIds.push(...products.map(({ id }) => id));

    await favorites.addRetailProductFavorite(organization.id, user.id, products[0]!.id);
    await favorites.addRetailProductFavorite(organization.id, user.id, products[0]!.id);
    assert.deepEqual(await favorites.listRetailProductFavorites(organization.id, user.id), [products[0]!.id]);

    await db.product.update({ where: { id: products[0]!.id }, data: { isActive: false } });
    assert.deepEqual(await favorites.listRetailProductFavorites(organization.id, user.id), [], "inactive products are removed from the visible result");
    await db.product.update({ where: { id: products[0]!.id }, data: { isActive: true } });

    await assert.rejects(() => favorites.addRetailProductFavorite("wrong-organization", user.id, products[1]!.id), /Product is unavailable/);
    await db.productCategory.update({ where: { id: category.id }, data: { isActive: false } });
    await assert.rejects(() => favorites.addRetailProductFavorite(organization.id, user.id, products[1]!.id), /Product is unavailable/);
    await db.productCategory.update({ where: { id: category.id }, data: { isActive: true } });

    for (const product of products.slice(2, 200)) {
      await favorites.addRetailProductFavorite(organization.id, user.id, product.id);
    }
    const concurrentAttempts = await Promise.allSettled([
      favorites.addRetailProductFavorite(organization.id, user.id, products[201]!.id),
      favorites.addRetailProductFavorite(organization.id, user.id, products[1]!.id),
    ]);
    assert.equal(concurrentAttempts.filter((result) => result.status === "fulfilled").length, 1);
    assert.equal(await db.productFavorite.count({ where: { organizationId: organization.id, userId: user.id } }), 200);

    await favorites.removeRetailProductFavorite(organization.id, user.id, products[0]!.id);
    await favorites.removeRetailProductFavorite(organization.id, user.id, products[0]!.id);
    assert.equal(await db.productFavorite.count({ where: { organizationId: organization.id, userId: user.id } }), 199);
  } finally {
    if (organizationIds.length) {
      await db.productFavorite.deleteMany({ where: { organizationId: { in: organizationIds } } });
      if (productIds.length) await db.product.deleteMany({ where: { id: { in: productIds } } });
      if (categoryIds.length) await db.productCategory.deleteMany({ where: { id: { in: categoryIds } } });
      await db.organizationCapability.deleteMany({ where: { organizationId: { in: organizationIds } } });
      await db.organization.deleteMany({ where: { id: { in: organizationIds } } });
    }
    if (userIds.length) await db.user.deleteMany({ where: { id: { in: userIds } } });
    await db.$disconnect();
  }
});
