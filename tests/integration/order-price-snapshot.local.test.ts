import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";
import prisma from "@/lib/db";
import { cartService } from "@/lib/services/cart.service";
import { orderService } from "@/lib/services/order.service";

const localDatabaseUrl = new URL(process.env.DATABASE_URL ?? "https://missing.invalid");
assert.ok(
  ["127.0.0.1", "localhost"].includes(localDatabaseUrl.hostname),
  "order-price-snapshot.local.test.ts refuses to run against a non-local database",
);

describe("order price snapshots on disposable local database", () => {
  it("persists unit prices, subtotal, total, and keeps them immutable after catalog price changes", async () => {
    const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
    const organizationSlug = `price-snapshot-${suffix}`;
    const sessionId = `price_session_${suffix}`;
    const phone = `0912${suffix.slice(0, 7)}`;
    const organizationId = `price_org_${suffix}`;
    const categoryId = `price_cat_${suffix}`;
    const baseProductId = `price_prod_base_${suffix}`;
    const variantProductId = `price_prod_variant_${suffix}`;
    const baseVariantId = `price_var_base_${suffix}`;
    const pricedVariantId = `price_var_priced_${suffix}`;
    const createdProgressIds = new Set<string>();

    try {
      await prisma.organization.create({
        data: {
          id: organizationId,
          slug: organizationSlug,
          name: `Price Snapshot ${suffix}`,
          type: "SHOP",
          isActive: true,
          capabilitiesInitializedAt: new Date(),
          capabilities: {
            create: { key: "SHOP", status: "ACTIVE", enabledAt: new Date() },
          },
        },
      });
      await prisma.productCategory.create({
        data: {
          id: categoryId,
          name: "Snapshot",
          slug: `snapshot-${suffix}`,
          organizationId,
          organizationSlug,
        },
      });
      await prisma.product.createMany({
        data: [
          {
            id: baseProductId,
            name: "Base priced item",
            slug: `base-priced-${suffix}`,
            basePrice: 123000,
            organizationId,
            organizationSlug,
            categoryId,
            isActive: true,
          },
          {
            id: variantProductId,
            name: "Variant priced item",
            slug: `variant-priced-${suffix}`,
            basePrice: 50000,
            organizationId,
            organizationSlug,
            categoryId,
            isActive: true,
          },
        ],
      });
      await prisma.productVariant.createMany({
        data: [
          {
            id: baseVariantId,
            name: "Default",
            sku: `base-${suffix}`,
            price: null,
            inventory: 10,
            productId: baseProductId,
          },
          {
            id: pricedVariantId,
            name: "Large",
            sku: `large-${suffix}`,
            price: 75000,
            inventory: 10,
            productId: variantProductId,
          },
        ],
      });
      await prisma.shopCart.create({
        data: {
          organizationSlug,
          sessionId,
          items: {
            createMany: {
              data: [
                { variantId: baseVariantId, quantity: 2 },
                { variantId: pricedVariantId, quantity: 3 },
              ],
            },
          },
        },
      });

      const cart = await cartService.getCart(organizationSlug, undefined, sessionId);
      assert.equal(cart?.subtotal, 471000);

      await orderService
        .createForGuest({
          organizationSlug,
          type: "PICK_UP",
          autoCompleteEndTimes: false,
          customerName: "Local Price Guest",
          customerPhone: phone,
        }, sessionId)
        .catch((error: unknown) => {
          assert.match(String(error instanceof Error ? error.message : error), /revalidatePath/);
        });

      const order = await prisma.order.findFirstOrThrow({
        where: { organizationSlug },
        include: { items: { orderBy: { productId: "asc" } } },
      });
      for (const progressId of [
        order.preparationProgressId,
        order.pickupProgressId,
        order.deliveryProgressId,
      ]) {
        if (progressId) createdProgressIds.add(progressId);
      }

      const baseItem = order.items.find((item) => item.variantId === baseVariantId);
      const pricedItem = order.items.find((item) => item.variantId === pricedVariantId);
      assert.ok(baseItem);
      assert.ok(pricedItem);
      assert.equal(baseItem.price.toString(), "123000");
      assert.equal(baseItem.quantity, 2);
      assert.equal(pricedItem.price.toString(), "75000");
      assert.equal(pricedItem.quantity, 3);
      assert.equal(order.subtotal.toString(), "471000");
      assert.equal(order.total.toString(), "471000");

      await prisma.product.update({ where: { id: baseProductId }, data: { basePrice: 999000 } });
      await prisma.productVariant.update({ where: { id: pricedVariantId }, data: { price: 111000 } });

      const afterCatalogChange = await prisma.order.findUniqueOrThrow({
        where: { id: order.id },
        include: { items: true },
      });
      assert.equal(afterCatalogChange.subtotal.toString(), "471000");
      assert.equal(afterCatalogChange.total.toString(), "471000");
      assert.equal(
        afterCatalogChange.items.find((item) => item.variantId === baseVariantId)?.price.toString(),
        "123000",
      );
      assert.equal(
        afterCatalogChange.items.find((item) => item.variantId === pricedVariantId)?.price.toString(),
        "75000",
      );
    } finally {
      const orders = await prisma.order.findMany({
        where: { organizationSlug },
        select: {
          id: true,
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

      await prisma.orderItem.deleteMany({ where: { order: { organizationSlug } } }).catch(() => undefined);
      await prisma.order.deleteMany({ where: { organizationSlug } }).catch(() => undefined);
      await prisma.guestCustomer.deleteMany({ where: { sessionId } }).catch(() => undefined);
      await prisma.shopCartItem.deleteMany({ where: { cart: { organizationSlug } } }).catch(() => undefined);
      await prisma.shopCart.deleteMany({ where: { organizationSlug } }).catch(() => undefined);
      await prisma.productVariant.deleteMany({ where: { productId: { in: [baseProductId, variantProductId] } } }).catch(() => undefined);
      await prisma.product.deleteMany({ where: { id: { in: [baseProductId, variantProductId] } } }).catch(() => undefined);
      await prisma.productCategory.deleteMany({ where: { id: categoryId } }).catch(() => undefined);
      await prisma.organization.deleteMany({ where: { id: organizationId } }).catch(() => undefined);
      if (createdProgressIds.size > 0) {
        await prisma.progress.deleteMany({ where: { id: { in: [...createdProgressIds] } } }).catch(() => undefined);
      }
    }
  });

  it("snapshots explicit variant price and keeps it immutable after catalog changes", async () => {
    const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
    const organizationSlug = `price-snapshot-explicit-${suffix}`;
    const sessionId = `price_session_explicit_${suffix}`;
    const phone = `0913${suffix.slice(0, 7)}`;
    const organizationId = `price_org_explicit_${suffix}`;
    const categoryId = `price_cat_explicit_${suffix}`;
    const productId = `price_prod_explicit_${suffix}`;
    const variantId = `price_var_explicit_${suffix}`;
    const createdProgressIds = new Set<string>();

    try {
      await prisma.organization.create({
        data: {
          id: organizationId,
          slug: organizationSlug,
          name: `Price Snapshot Explicit ${suffix}`,
          type: "SHOP",
          isActive: true,
          capabilitiesInitializedAt: new Date(),
          capabilities: {
            create: { key: "SHOP", status: "ACTIVE", enabledAt: new Date() },
          },
        },
      });
      await prisma.productCategory.create({
        data: {
          id: categoryId,
          name: "Snapshot Explicit",
          slug: `snapshot-explicit-${suffix}`,
          organizationId,
          organizationSlug,
        },
      });
      await prisma.product.create({
        data: {
          id: productId,
          name: "Explicit Variant Price Item",
          slug: `explicit-variant-${suffix}`,
          basePrice: 200000,
          organizationId,
          organizationSlug,
          categoryId,
          isActive: true,
        },
      });
      await prisma.productVariant.create({
        data: {
          id: variantId,
          name: "Default",
          sku: `explicit-${suffix}`,
          price: 150000,
          inventory: 10,
          productId,
        },
      });
      await prisma.shopCart.create({
        data: {
          organizationSlug,
          sessionId,
          items: {
            createMany: {
              data: [{ variantId, quantity: 2 }],
            },
          },
        },
      });

      const cart = await cartService.getCart(organizationSlug, undefined, sessionId);
      assert.equal(cart?.subtotal, 300000);

      await orderService
        .createForGuest({
          organizationSlug,
          type: "PICK_UP",
          autoCompleteEndTimes: false,
          customerName: "Local Price Explicit Guest",
          customerPhone: phone,
        }, sessionId)
        .catch((error: unknown) => {
          assert.match(String(error instanceof Error ? error.message : error), /revalidatePath/);
        });

      const order = await prisma.order.findFirstOrThrow({
        where: { organizationSlug },
        include: { items: { orderBy: { productId: "asc" } } },
      });
      for (const progressId of [
        order.preparationProgressId,
        order.pickupProgressId,
        order.deliveryProgressId,
      ]) {
        if (progressId) createdProgressIds.add(progressId);
      }

      const item = order.items.find((i) => i.variantId === variantId);
      assert.ok(item);
      assert.equal(item.price.toString(), "150000");
      assert.equal(item.quantity, 2);
      assert.equal(order.subtotal.toString(), "300000");
      assert.equal(order.total.toString(), "300000");

      await prisma.product.update({ where: { id: productId }, data: { basePrice: 300000 } });
      await prisma.productVariant.update({ where: { id: variantId }, data: { price: 250000 } });

      const afterCatalogChange = await prisma.order.findUniqueOrThrow({
        where: { id: order.id },
        include: { items: true },
      });
      assert.equal(afterCatalogChange.subtotal.toString(), "300000");
      assert.equal(afterCatalogChange.total.toString(), "300000");
      assert.equal(
        afterCatalogChange.items.find((item) => item.variantId === variantId)?.price.toString(),
        "150000",
      );
    } finally {
      const orders = await prisma.order.findMany({
        where: { organizationSlug },
        select: {
          id: true,
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

      await prisma.orderItem.deleteMany({ where: { order: { organizationSlug } } }).catch(() => undefined);
      await prisma.order.deleteMany({ where: { organizationSlug } }).catch(() => undefined);
      await prisma.guestCustomer.deleteMany({ where: { sessionId } }).catch(() => undefined);
      await prisma.shopCartItem.deleteMany({ where: { cart: { organizationSlug } } }).catch(() => undefined);
      await prisma.shopCart.deleteMany({ where: { organizationSlug } }).catch(() => undefined);
      await prisma.productVariant.deleteMany({ where: { productId } }).catch(() => undefined);
      await prisma.product.deleteMany({ where: { id: productId } }).catch(() => undefined);
      await prisma.productCategory.deleteMany({ where: { id: categoryId } }).catch(() => undefined);
      await prisma.organization.deleteMany({ where: { id: organizationId } }).catch(() => undefined);
      if (createdProgressIds.size > 0) {
        await prisma.progress.deleteMany({ where: { id: { in: [...createdProgressIds] } } }).catch(() => undefined);
      }
    }
  });
});
