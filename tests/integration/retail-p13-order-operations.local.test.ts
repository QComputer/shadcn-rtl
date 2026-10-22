import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mock, test } from "node:test";

const enabled = process.env.RETAIL_P13_ORDER_OPS_PG_ACCEPTANCE === "1";

function assertExactDatabaseTarget() {
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

test("Retail P1.3 merchant order operations preserve payment truth and retry idempotency", {
  skip: !enabled,
  concurrency: false,
}, async () => {
  assertExactDatabaseTarget();
  mock.module("next/cache", { namedExports: { revalidatePath: () => undefined, revalidateTag: () => undefined } });
  const [{ PrismaClient }, { orderService }, cash, { ApiError }] = await Promise.all([
    import("@prisma/client"),
    import("@/lib/services/order.service"),
    import("@/lib/retail/cash.server"),
    import("@/lib/api-guards"),
  ]);
  const db = new PrismaClient({ log: ["error"] });
  const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
  const slug = `retail-p13-ops-${suffix}`;
  const sku = `P13-${suffix.toUpperCase()}`;
  const orderIds: string[] = [];
  let organizationId = "";
  let actorId = "";
  let categoryId = "";
  let productId = "";
  let variantId = "";

  try {
    const identity = await db.$queryRaw<Array<{ database: string; username: string; version_num: number }>>`
      SELECT current_database() AS database, current_user AS username,
        current_setting('server_version_num')::int AS version_num`;
    assert.equal(identity[0]?.database, "retail_p0_20261019");
    assert.match(identity[0]?.username ?? "", /^consol_[a-f0-9]+$/);
    assert.ok(identity[0]!.version_num >= 160000 && identity[0]!.version_num < 170000);

    const organization = await db.organization.create({ data: {
      name: `Retail P13 operations ${suffix}`, slug, type: "SHOP", capabilitiesInitializedAt: new Date(),
    } });
    organizationId = organization.id;
    await db.organizationCapability.create({ data: {
      organizationId, key: "SHOP", status: "ACTIVE", enabledAt: new Date(),
    } });
    const actor = await db.user.create({ data: {
      name: `P13 merchant ${suffix}`, email: `p13-${suffix}@example.test`, password: "synthetic-only", role: "ADMIN",
    } });
    actorId = actor.id;
    const category = await db.productCategory.create({ data: {
      name: "P13 operations", slug: `p13-${suffix}`, organizationId, organizationSlug: slug,
    } });
    categoryId = category.id;
    const product = await db.product.create({ data: {
      name: "P13 snapshot product", slug: `p13-${suffix}`, basePrice: 100,
      organizationId, organizationSlug: slug, categoryId, trackInventory: true,
    } });
    productId = product.id;
    const variant = await db.productVariant.create({ data: {
      productId, sku, name: "P13 snapshot variant", price: 100, inventory: 4,
    } });
    variantId = variant.id;

    const cancelled = await db.order.create({ data: {
      orderNumber: `P13-C-${suffix}`, retailCheckoutKey: `p13-cancel-${suffix}`, type: "PICK_UP",
      status: "PENDING", subtotal: 100, total: 100, organizationSlug: slug,
      paymentMethod: "BANK_TRANSFER", paymentStatus: "PENDING",
      items: { create: [{ productId, variantId, quantity: 1, price: 100,
        productNameSnapshot: "P13 product at purchase", skuSnapshot: sku,
        variantNameSnapshot: "P13 variant at purchase",
        variantOptionsSnapshot: [{ key: "color", label: "Color", value: "Red", displayUnit: null }],
      }] },
    } });
    orderIds.push(cancelled.id);
    await db.inventoryMovement.create({ data: {
      variantId, orderId: cancelled.id, quantityDelta: -1, quantityBefore: 5, quantityAfter: 4, reason: "ORDER_CREATED",
    } });

    await orderService.updateStatus(cancelled.id, { status: "CANCELLED" }, "ADMIN", actorId);
    const stockAfterCancellation = await db.productVariant.findUniqueOrThrow({ where: { id: variantId } });
    await orderService.updateStatus(cancelled.id, { status: "CANCELLED" }, "ADMIN", actorId);
    assert.equal((await db.productVariant.findUniqueOrThrow({ where: { id: variantId } })).inventory, 5);
    assert.equal(await db.inventoryMovement.count({ where: { orderId: cancelled.id, reason: "ORDER_CANCELLED" } }), 1);
    assert.equal(await db.orderStatusHistory.count({ where: { orderId: cancelled.id } }), 1,
      "same-status retries must not add duplicate lifecycle history");
    assert.equal(stockAfterCancellation.inventory, 5);

    await db.productVariant.update({ where: { id: variantId }, data: { inventory: 4 } });
    const paidDelivered = await db.order.create({ data: {
      orderNumber: `P13-R-${suffix}`, retailCheckoutKey: `p13-refund-${suffix}`, type: "PICK_UP",
      status: "DELIVERED", subtotal: 100, total: 100, organizationSlug: slug,
      paymentMethod: "BANK_TRANSFER", paymentStatus: "COMPLETED",
      items: { create: [{ productId, variantId, quantity: 1, price: 100,
        productNameSnapshot: "P13 product at purchase", skuSnapshot: sku,
      }] },
    } });
    orderIds.push(paidDelivered.id);
    await db.payment.create({ data: { orderId: paidDelivered.id, amount: 100, method: "BANK_TRANSFER", status: "COMPLETED" } });
    await db.inventoryMovement.create({ data: {
      variantId, orderId: paidDelivered.id, quantityDelta: -1, quantityBefore: 5, quantityAfter: 4, reason: "ORDER_CREATED",
    } });
    await assert.rejects(() => orderService.updateStatus(paidDelivered.id, { status: "REFUNDED" }, "ADMIN", actorId),
      (error: unknown) => error instanceof ApiError && error.status === 409);
    assert.equal((await db.order.findUniqueOrThrow({ where: { id: paidDelivered.id } })).status, "DELIVERED");
    assert.equal((await db.order.findUniqueOrThrow({ where: { id: paidDelivered.id } })).paymentStatus, "COMPLETED");
    assert.equal((await db.payment.findUniqueOrThrow({ where: { orderId: paidDelivered.id } })).status, "COMPLETED");
    assert.equal(await db.paymentEvent.count({ where: { orderId: paidDelivered.id } }), 0);
    assert.equal(await db.inventoryMovement.count({ where: { orderId: paidDelivered.id, reason: "ORDER_REFUNDED" } }), 0);
    assert.equal((await db.productVariant.findUniqueOrThrow({ where: { id: variantId } })).inventory, 4);

    const cashOrder = await db.order.create({ data: {
      orderNumber: `P13-CASH-${suffix}`, retailCheckoutKey: `p13-cash-${suffix}`, type: "PICK_UP",
      status: "PENDING", subtotal: 100, total: 100, organizationSlug: slug,
      paymentMethod: "CASH", paymentStatus: "PENDING",
      items: { create: [{ productId, variantId, quantity: 1, price: 100,
        productNameSnapshot: "P13 product at purchase", skuSnapshot: sku,
      }] },
    } });
    orderIds.push(cashOrder.id);
    await db.payment.create({ data: {
      orderId: cashOrder.id, amount: 100, method: "CASH", status: "PENDING",
      metadata: { retailR4: { cashMode: "COUNTER", cashBeforeConfirmation: true } },
    } });
    const confirmed = await cash.confirmRetailCashCollection({ organizationId, orderNumber: cashOrder.orderNumber, actorUserId: actorId });
    assert.equal(confirmed.paymentStatus, "COMPLETED");
    assert.equal((await orderService.getById(cashOrder.id))?.retailCashMode, "COUNTER", "detail refresh must preserve the cash workflow projection");
    assert.equal((await db.order.findUniqueOrThrow({ where: { id: cashOrder.id } })).paymentStatus, "COMPLETED");
    assert.equal((await db.payment.findUniqueOrThrow({ where: { orderId: cashOrder.id } })).status, "COMPLETED");
    assert.equal(await db.paymentEvent.count({ where: { orderId: cashOrder.id, newStatus: "COMPLETED" } }), 1);
    assert.equal(await db.retailPaymentReport.count({ where: { orderId: cashOrder.id, status: "APPROVED", cashMode: "COUNTER" } }), 1);
    await assert.rejects(() => cash.confirmRetailCashCollection({ organizationId, orderNumber: cashOrder.orderNumber, actorUserId: actorId }),
      (error: unknown) => error instanceof ApiError && error.status === 409);

    const listing = await orderService.list({ page: 1, pageSize: 10 }, organizationId);
    const listedCashOrder = listing.data.find((order) => order.id === cashOrder.id) as typeof listing.data[number] & { retailCashMode?: string | null; payment?: unknown };
    assert.equal(listedCashOrder?.retailCashMode, "COUNTER");
    assert.equal("payment" in (listedCashOrder ?? {}), false, "cash mode projection must not expose payment metadata");

    const snapshots = await orderService.getById(cancelled.id);
    assert.equal(snapshots?.items[0]?.productNameSnapshot, "P13 product at purchase");
    assert.equal(snapshots?.items[0]?.skuSnapshot, sku);
    assert.equal(snapshots?.items[0]?.variantNameSnapshot, "P13 variant at purchase");
    assert.equal((snapshots?.items[0]?.variantOptionsSnapshot as Array<{ value: string }>)[0]?.value, "Red");
    assert.ok(Array.isArray(snapshots?.statusHistory));
  } finally {
    if (orderIds.length) {
      await db.retailPaymentReport.deleteMany({ where: { orderId: { in: orderIds } } });
      await db.paymentEvent.deleteMany({ where: { orderId: { in: orderIds } } });
      await db.orderStatusHistory.deleteMany({ where: { orderId: { in: orderIds } } });
      await db.inventoryMovement.deleteMany({ where: { orderId: { in: orderIds } } });
      await db.payment.deleteMany({ where: { orderId: { in: orderIds } } });
      await db.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
      await db.order.deleteMany({ where: { id: { in: orderIds } } });
    }
    if (variantId) await db.inventoryMovement.deleteMany({ where: { variantId } });
    if (productId) await db.productVariant.deleteMany({ where: { productId } });
    if (productId) await db.product.deleteMany({ where: { id: productId } });
    if (categoryId) await db.productCategory.deleteMany({ where: { id: categoryId } });
    if (organizationId) await db.organizationCapability.deleteMany({ where: { organizationId } });
    if (organizationId) await db.organization.deleteMany({ where: { id: organizationId } });
    if (actorId) await db.user.deleteMany({ where: { id: actorId } });
    await db.$disconnect();
  }
});
