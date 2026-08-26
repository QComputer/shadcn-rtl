import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";
import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { GET as getPublicShop } from "@/app/api/public/organizations/[slug]/shop/route";
import { cartService } from "@/lib/services/cart.service";
import { orderService } from "@/lib/services/order.service";
import {
  ensureLocalCafeLeoOrganization,
  importCafeLeoCatalog,
  readCafeLeoExtractionFixture,
} from "../../prisma/seed-data/cafe-leo-menu";
import type { CafeLeoExtractionFixture } from "../../prisma/seed-data/cafe-leo-types";

const localDatabaseUrl = new URL(process.env.DATABASE_URL ?? "https://missing.invalid");
assert.ok(
  ["127.0.0.1", "localhost"].includes(localDatabaseUrl.hostname),
  "cafe-leo-import.local.test.ts refuses to run against a non-local database",
);

function cloneFixture(): CafeLeoExtractionFixture {
  return JSON.parse(JSON.stringify(readCafeLeoExtractionFixture())) as CafeLeoExtractionFixture;
}

describe("Cafe Leo catalog importer on disposable local database", () => {
  it("is idempotent, updates source-owned products, deactivates missing items, reactivates restored items, and stays tenant-scoped", async () => {
    const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
    const leoSlug = `cafe-leo-import-${suffix}`;
    const sicilySlug = `sicily-import-guard-${suffix}`;
    const sicilyOrgId = `sicily_guard_org_${suffix}`;
    const sicilyCategoryId = `sicily_guard_cat_${suffix}`;
    const sicilyProductId = `sicily_guard_prod_${suffix}`;
    const sicilyVariantId = `sicily_guard_var_${suffix}`;
    const sessionId = `leo_cart_${suffix}`;
    const phone = `0914${suffix.slice(0, 7)}`;
    const fixture = cloneFixture();
    const firstSourceId = fixture.categories[0]!.products[0]!.sourceId;
    const firstPrice = fixture.categories[0]!.products[0]!.priceValue;
    const createdProgressIds = new Set<string>();

    try {
      await ensureLocalCafeLeoOrganization(prisma, leoSlug);
      await prisma.organization.create({
        data: {
          id: sicilyOrgId,
          slug: sicilySlug,
          name: "Sicily Import Guard",
          type: "SHOP",
          isActive: true,
          capabilitiesInitializedAt: new Date(),
          capabilities: {
            create: { key: "SHOP", status: "ACTIVE", enabledAt: new Date() },
          },
        },
      });
      await prisma.productCategory.create({
        data: { id: sicilyCategoryId, organizationId: sicilyOrgId, organizationSlug: sicilySlug, name: "Guard", slug: "guard" },
      });
      await prisma.product.create({
        data: {
          id: sicilyProductId,
          organizationId: sicilyOrgId,
          organizationSlug: sicilySlug,
          categoryId: sicilyCategoryId,
          name: "Guard product",
          slug: "guard-product",
          sku: "CAFELEO-hot-coffee-1",
          basePrice: 999,
          trackInventory: false,
          isActive: true,
        },
      });
      await prisma.productVariant.create({
        data: {
          id: sicilyVariantId,
          productId: sicilyProductId,
          sku: `sicily-guard-${suffix}`,
          price: 999,
          allowBackOrder: true,
        },
      });

      const firstRun = await importCafeLeoCatalog(prisma, { fixture, organizationSlug: leoSlug, updateBusinessProfile: true });
      assert.equal(firstRun.counts.categories, 11);
      assert.equal(firstRun.counts.products, 115);
      assert.equal(firstRun.counts.activeProducts, 115);
      assert.equal(firstRun.counts.variants, 115);
      assert.equal(firstRun.counts.productsWithUsableVariant, 115);
      assert.equal(firstRun.counts.duplicateCategorySlugs, 0);
      assert.equal(firstRun.counts.duplicateProductSlugs, 0);
      assert.equal(firstRun.counts.duplicateVariantSkus, 0);

      const secondRun = await importCafeLeoCatalog(prisma, { fixture, organizationSlug: leoSlug, updateBusinessProfile: true });
      assert.equal(secondRun.created.categories, 0);
      assert.equal(secondRun.created.products, 0);
      assert.equal(secondRun.created.variants, 0);
      assert.deepEqual(secondRun.counts, firstRun.counts);

      const changedFixture = cloneFixture();
      changedFixture.categories[0]!.products[0]!.priceValue = firstPrice + 7;
      changedFixture.categories[0]!.products[0]!.rawPrice = `${firstPrice + 7} تومان`;
      changedFixture.categories[0]!.products[0]!.imageUrl = changedFixture.categories[0]!.products[1]!.imageUrl;
      await importCafeLeoCatalog(prisma, { fixture: changedFixture, organizationSlug: leoSlug });
      const updatedProduct = await prisma.product.findFirstOrThrow({
        where: { organizationSlug: leoSlug, sku: `CAFELEO-${firstSourceId}` },
        include: { variants: true },
      });
      assert.equal(updatedProduct.basePrice.toString(), String(firstPrice + 7));
      assert.equal(updatedProduct.variants[0]?.price?.toString(), String(firstPrice + 7));
      assert.equal(updatedProduct.image, changedFixture.categories[0]!.products[1]!.imageUrl);

      const removedFixture = cloneFixture();
      removedFixture.categories[0]!.products = removedFixture.categories[0]!.products.slice(1);
      removedFixture.counts.products -= 1;
      removedFixture.counts.pricedOrderable -= 1;
      const removalRun = await importCafeLeoCatalog(prisma, { fixture: removedFixture, organizationSlug: leoSlug });
      assert.equal(removalRun.deactivated.products, 1);
      assert.equal((await prisma.product.findFirstOrThrow({ where: { organizationSlug: leoSlug, sku: `CAFELEO-${firstSourceId}` } })).isActive, false);

      await importCafeLeoCatalog(prisma, { fixture, organizationSlug: leoSlug });
      assert.equal((await prisma.product.findFirstOrThrow({ where: { organizationSlug: leoSlug, sku: `CAFELEO-${firstSourceId}` } })).isActive, true);

      await assert.rejects(
        cartService.addItem(sicilySlug, null, `cross_${suffix}`, { variantId: updatedProduct.variants[0]!.id, quantity: 1 }),
        /Product does not belong to this organization|Product variant not found/,
      );
      assert.equal((await prisma.product.findUniqueOrThrow({ where: { id: sicilyProductId } })).basePrice.toString(), "999");

      const publicShopResponse = await getPublicShop(
        new NextRequest(`http://127.0.0.1/api/public/organizations/${leoSlug}/shop`),
        { params: Promise.resolve({ slug: leoSlug }) },
      );
      assert.equal(publicShopResponse.status, 200);
      const publicShop = await publicShopResponse.json();
      assert.equal(publicShop.organization.slug, leoSlug);
      assert.equal(publicShop.categories.length, 11);
      assert.equal(publicShop.categories.reduce((sum: number, category: { products: unknown[] }) => sum + category.products.length, 0), 115);

      const orderProduct = await prisma.product.findFirstOrThrow({
        where: { organizationSlug: leoSlug, sku: `CAFELEO-${firstSourceId}` },
        include: { variants: true },
      });
      await prisma.shopCart.create({
        data: {
          organizationSlug: leoSlug,
          sessionId,
          items: { create: { variantId: orderProduct.variants[0]!.id, quantity: 2 } },
        },
      });
      const cart = await cartService.getCart(leoSlug, undefined, sessionId);
      assert.equal(cart?.subtotal, firstPrice * 2);

      await orderService
        .createForGuest({
          organizationSlug: leoSlug,
          type: "PICK_UP",
          autoCompleteEndTimes: false,
          customerName: "Cafe Leo Local Guest",
          customerPhone: phone,
        }, sessionId)
        .catch((error: unknown) => {
          assert.match(String(error instanceof Error ? error.message : error), /revalidatePath/);
        });
      const order = await prisma.order.findFirstOrThrow({ where: { organizationSlug: leoSlug }, include: { items: true } });
      for (const progressId of [
        order.preparationProgressId,
        order.pickupProgressId,
        order.deliveryProgressId,
      ]) {
        if (progressId) createdProgressIds.add(progressId);
      }
      assert.equal(order.items[0]?.price.toString(), String(firstPrice));
      assert.equal(order.subtotal.toString(), String(firstPrice * 2));
      assert.equal(order.total.toString(), String(firstPrice * 2));
    } finally {
      const orders = await prisma.order.findMany({
        where: { organizationSlug: leoSlug },
        select: {
          preparationProgressId: true,
          pickupProgressId: true,
          deliveryProgressId: true,
        },
      });
      for (const order of orders) {
        for (const progressId of [
          order.preparationProgressId,
          order.pickupProgressId,
          order.deliveryProgressId,
        ]) {
          if (progressId) createdProgressIds.add(progressId);
        }
      }
      await prisma.orderItem.deleteMany({ where: { order: { organizationSlug: leoSlug } } }).catch(() => undefined);
      await prisma.order.deleteMany({ where: { organizationSlug: leoSlug } }).catch(() => undefined);
      await prisma.guestCustomer.deleteMany({ where: { sessionId } }).catch(() => undefined);
      await prisma.shopCartItem.deleteMany({ where: { cart: { organizationSlug: { in: [leoSlug, sicilySlug] } } } }).catch(() => undefined);
      await prisma.shopCart.deleteMany({ where: { organizationSlug: { in: [leoSlug, sicilySlug] } } }).catch(() => undefined);
      await prisma.productVariant.deleteMany({ where: { product: { organizationSlug: { in: [leoSlug, sicilySlug] } } } }).catch(() => undefined);
      await prisma.product.deleteMany({ where: { organizationSlug: { in: [leoSlug, sicilySlug] } } }).catch(() => undefined);
      await prisma.productCategory.deleteMany({ where: { organizationSlug: { in: [leoSlug, sicilySlug] } } }).catch(() => undefined);
      await prisma.paymentSettings.deleteMany({ where: { organizationSlug: leoSlug } }).catch(() => undefined);
      await prisma.organizationSettings.deleteMany({ where: { organizationSlug: leoSlug } }).catch(() => undefined);
      await prisma.organization.deleteMany({ where: { slug: { in: [leoSlug, sicilySlug] } } }).catch(() => undefined);
      if (createdProgressIds.size > 0) {
        await prisma.progress.deleteMany({ where: { id: { in: [...createdProgressIds] } } }).catch(() => undefined);
      }
    }
  });
});
