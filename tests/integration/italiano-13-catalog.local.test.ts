import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { prisma } from "../../lib/db";
import { importItaliano13Snapshot, type Italiano13Snapshot } from "../../lib/external-catalog/italiano-13-import";
import { getPublicCatalogSnapshot, listPublicCatalogProducts } from "../../lib/public-catalog/service.server";

const fixturePath = path.join(process.cwd(), "prisma", "seed-data", "italiano-13-snappfood-menu.json");
const fixture = JSON.parse(readFileSync(fixturePath, "utf8")) as Italiano13Snapshot;

test("Italiano 13 import is idempotent, tenant-safe, public, and cart-ready", async () => {
  const suffix = Date.now().toString(36);
  const guardProductIds: string[] = [];
  for (const [index, slug] of ["cafe-leo", "aka-shoes", "sicily", "platform-catalog", `italiano-foreign-${suffix}`].entries()) {
    const guardOrganization = await prisma.organization.create({
      data: { type: "SHOP", name: `Guard tenant ${index}`, slug, capabilitiesInitializedAt: new Date(), isPlatformOwner: slug === "platform-catalog" },
    });
    const guardCategory = await prisma.productCategory.create({
      data: { organizationId: guardOrganization.id, organizationSlug: guardOrganization.slug, name: fixture.categories[0].name, slug: `same-name-${index}`, isActive: true },
    });
    const guardProduct = await prisma.product.create({
      data: { organizationId: guardOrganization.id, organizationSlug: guardOrganization.slug, categoryId: guardCategory.id, name: fixture.categories[0].products[0].name, slug: `same-product-${index}`, basePrice: 12345, isActive: true },
    });
    guardProductIds.push(guardProduct.id);
  }

  const organization = await prisma.organization.create({
    data: {
      type: "SHOP",
      name: "فست فود ایتالیایی سیزده",
      slug: "italiano-13",
      capabilitiesInitializedAt: new Date(),
      capabilities: { create: { key: "SHOP", status: "ACTIVE", enabledAt: new Date() } },
    },
  });

  const first = await importItaliano13Snapshot({ prisma, organizationId: organization.id, snapshot: fixture });
  assert.deepEqual(first.created, { categories: 9, products: 56, variants: 72 });
  assert.deepEqual(first.updated, { categories: 0, products: 0, variants: 0 });

  const second = await importItaliano13Snapshot({ prisma, organizationId: organization.id, snapshot: fixture });
  assert.deepEqual(second.created, { categories: 0, products: 0, variants: 0 });
  assert.deepEqual(second.updated, { categories: 0, products: 0, variants: 0 });
  assert.deepEqual(second.unchanged, { categories: 9, products: 56, variants: 72 });

  const changedFixture = structuredClone(fixture);
  const changedProduct = changedFixture.categories[0].products[0];
  const originalBasePrice = Math.min(...changedProduct.variants.filter((variant) => variant.active).map((variant) => variant.priceToman));
  const changedVariant = changedProduct.variants[0];
  const originalPrice = changedVariant.priceToman;
  changedVariant.priceToman += 1000;
  const changedBasePrice = Math.min(...changedProduct.variants.filter((variant) => variant.active).map((variant) => variant.priceToman));
  const third = await importItaliano13Snapshot({ prisma, organizationId: organization.id, snapshot: changedFixture });
  assert.equal(third.updated.variants, 1);
  assert.equal(third.updated.products, changedBasePrice === originalBasePrice ? 0 : 1);
  assert.deepEqual(third.priceChanges, [{ externalId: changedVariant.externalId, fromToman: originalPrice, toToman: originalPrice + 1000 }]);
  assert.equal(third.created.categories + third.created.products + third.created.variants, 0);

  const storedVariant = await prisma.productVariant.findFirstOrThrow({
    where: { product: { organizationId: organization.id }, price: originalPrice + 1000 },
    include: { product: true },
  });
  assert.equal(storedVariant.product.image, null);
  assert.equal(storedVariant.product.description, null);
  assert.equal(await prisma.productCategory.count({ where: { organizationId: organization.id, isActive: true, deletedAt: null } }), 9);
  assert.equal(await prisma.product.count({ where: { organizationId: organization.id, isActive: true, deletedAt: null } }), 56);
  assert.equal(await prisma.productVariant.count({ where: { product: { organizationId: organization.id }, deletedAt: null } }), 72);
  const guardProducts = await prisma.product.findMany({ where: { id: { in: guardProductIds } }, select: { basePrice: true } });
  assert.equal(guardProducts.length, 5);
  assert.ok(guardProducts.every((product) => product.basePrice.equals(12345)));

  const removedFixture = structuredClone(fixture);
  const removedProduct = removedFixture.categories.at(-1)!.products.pop()!;
  removedFixture.counts.products -= 1;
  removedFixture.counts.prices -= removedProduct.variants.length;
  const removed = await importItaliano13Snapshot({ prisma, organizationId: organization.id, snapshot: removedFixture });
  assert.equal(removed.deactivated.products, 1);
  assert.equal(removed.deactivated.variants, removedProduct.variants.length);
  assert.equal(await prisma.product.count({ where: { organizationId: organization.id, isActive: true, deletedAt: null } }), 55);
  await importItaliano13Snapshot({ prisma, organizationId: organization.id, snapshot: fixture });
  assert.equal(await prisma.product.count({ where: { organizationId: organization.id, isActive: true, deletedAt: null } }), 56);
  assert.equal(await prisma.productVariant.count({ where: { product: { organizationId: organization.id }, deletedAt: null } }), 72);

  const publicSnapshot = await getPublicCatalogSnapshot("italiano-13");
  assert.equal(publicSnapshot.categories.length, 9);
  assert.equal(publicSnapshot.pagination.total, 56);
  assert.equal(publicSnapshot.priceUnit, "TOMAN");
  const allProducts = await listPublicCatalogProducts({ organizationIdentifier: "italiano-13", page: 1, limit: 100 });
  assert.equal(allProducts.products.length, 56);
  assert.equal(allProducts.products.flatMap((product) => product.variants).length, 72);

  const cart = await prisma.shopCart.create({ data: { organizationSlug: "italiano-13", sessionId: `italiano-db-test-${suffix}` } });
  const cartItem = await prisma.shopCartItem.create({ data: { cartId: cart.id, variantId: storedVariant.id, quantity: 2 } });
  assert.equal(cartItem.quantity, 2);
  assert.equal(Number(storedVariant.price) * cartItem.quantity, (originalPrice + 1000) * 2);

  assert.equal(await prisma.order.count({ where: { organizationSlug: organization.slug } }), 0);
  assert.equal(await prisma.organizationIntegration.count({ where: { organizationId: organization.id } }), 0);
});

test.after(async () => {
  await prisma.$disconnect();
});
