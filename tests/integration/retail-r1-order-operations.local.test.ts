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

test("Retail R1 merchant order operations enforce tenant, fulfillment, payment, and retry contracts", {
  skip: !enabled,
  concurrency: false,
}, async () => {
  assertExactDatabaseTarget();
  mock.module("next/cache", { namedExports: { revalidatePath: () => undefined, revalidateTag: () => undefined } });
  mock.module("@/lib/notifications/customer-order-lifecycle-router", { namedExports: {
    customerOrderLifecycleRouter: {
      notifyOrderStatusChangedSafe: async () => undefined,
      notifyOrderReadyTimeChangedSafe: async () => undefined,
      notifyPaymentStatusChangedSafe: async () => undefined,
    },
  } });
  const [{ PrismaClient }, merchant, { ApiError }] = await Promise.all([
    import("@prisma/client"),
    import("@/lib/retail/merchant-orders.server"),
    import("@/lib/api-guards"),
  ]);
  const db = new PrismaClient({ log: ["error"] });
  const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
  const slug = `retail-r1-orders-${suffix}`;
  const foreignSlug = `retail-r1-foreign-${suffix}`;
  const orderIds: string[] = [];
  const userIds: string[] = [];
  const organizationIds: string[] = [];
  const categoryIds: string[] = [];
  const productIds: string[] = [];
  const variantIds: string[] = [];
  let lockRelease: (() => void) | undefined;
  let lockTransaction: Promise<unknown> | undefined;
  let staleUpdate: Promise<unknown> | undefined;

  try {
    const identity = await db.$queryRaw<Array<{ database: string; username: string; version_num: number }>>`
      SELECT current_database() AS database, current_user AS username,
        current_setting('server_version_num')::int AS version_num`;
    assert.equal(identity[0]?.database, "retail_p0_20261019");
    assert.match(identity[0]?.username ?? "", /^consol_[a-f0-9]+$/);
    assert.ok(identity[0]!.version_num >= 160000 && identity[0]!.version_num < 170000);

    const organizations = await Promise.all([
      db.organization.create({ data: { name: `Retail R1 ${suffix}`, slug, type: "SHOP", capabilitiesInitializedAt: new Date() } }),
      db.organization.create({ data: { name: `Retail R1 foreign ${suffix}`, slug: foreignSlug, type: "SHOP", capabilitiesInitializedAt: new Date() } }),
    ]);
    organizationIds.push(...organizations.map(({ id }) => id));
    const [organization, foreignOrganization] = organizations;
    await db.organizationCapability.createMany({ data: organizationIds.map((organizationId) => ({
      organizationId, key: "SHOP" as const, status: "ACTIVE" as const, enabledAt: new Date(),
    })) });

    const actor = await db.user.create({ data: {
      name: `Retail R1 operator ${suffix}`, email: `retail-r1-${suffix}@example.test`, password: "synthetic-only", role: "ADMIN",
    } });
    userIds.push(actor.id);
    const [category, foreignCategory] = await Promise.all([
      db.productCategory.create({ data: { name: "R1 products", slug: `r1-${suffix}`, organizationId: organization.id, organizationSlug: slug } }),
      db.productCategory.create({ data: { name: "R1 foreign products", slug: `r1-foreign-${suffix}`, organizationId: foreignOrganization.id, organizationSlug: foreignSlug } }),
    ]);
    categoryIds.push(category.id, foreignCategory.id);
    const [product, foreignProduct] = await Promise.all([
      db.product.create({ data: { name: "Purchase-time product", slug: `r1-${suffix}`, basePrice: 125, organizationId: organization.id, organizationSlug: slug, categoryId: category.id, trackInventory: true } }),
      db.product.create({ data: { name: "Foreign product", slug: `r1-foreign-${suffix}`, basePrice: 200, organizationId: foreignOrganization.id, organizationSlug: foreignSlug, categoryId: foreignCategory.id, trackInventory: true } }),
    ]);
    productIds.push(product.id, foreignProduct.id);
    const [variant, foreignVariant] = await Promise.all([
      db.productVariant.create({ data: { productId: product.id, sku: `R1-${suffix.toUpperCase()}`, name: "Purchase-time variant", price: 125, inventory: 10 } }),
      db.productVariant.create({ data: { productId: foreignProduct.id, sku: `R1-F-${suffix.toUpperCase()}`, name: "Foreign variant", price: 200, inventory: 5 } }),
    ]);
    variantIds.push(variant.id, foreignVariant.id);

    const context = { organizationId: organization.id, organizationSlug: slug, actorUserId: actor.id, role: "ADMIN" as const };
    const managerContext = { ...context, role: "MANAGER" as const };
    const staffContext = { ...context, role: "STAFF" as const };
    const customerContext = { ...context, role: "CUSTOMER" as const };
    const order = async (key: string, type: "PICK_UP" | "DELIVERY", status: "PENDING" | "DELIVERED" = "PENDING", options: {
      foreign?: boolean; paid?: boolean; item?: boolean; total?: number;
    } = {}) => {
      const selectedProduct = options.foreign ? foreignProduct : product;
      const selectedVariant = options.foreign ? foreignVariant : variant;
      const selectedSlug = options.foreign ? foreignSlug : slug;
      const amount = options.total ?? 125;
      const created = await db.order.create({ data: {
        orderNumber: `R1-${key}-${suffix}`,
        retailCheckoutKey: `r1-${key}-${suffix}`,
        type, status, subtotal: amount, total: amount, organizationSlug: selectedSlug,
        paymentMethod: options.paid ? "BANK_TRANSFER" : "CASH",
        paymentStatus: options.paid ? "COMPLETED" : "PENDING",
        ...(options.item === false ? {} : { items: { create: [{
          productId: selectedProduct.id, variantId: selectedVariant.id, quantity: 1, price: amount,
          productNameSnapshot: "Purchase-time product", skuSnapshot: selectedVariant.sku,
          variantNameSnapshot: "Purchase-time variant",
          variantOptionsSnapshot: [{ key: "color", label: "Color", value: "Blue", displayUnit: null }],
        }] } }),
      } });
      orderIds.push(created.id);
      if (!options.foreign && options.item !== false) {
        const updatedVariant = await db.productVariant.update({
          where: { id: variant.id }, data: { inventory: { decrement: 1 } }, select: { inventory: true },
        });
        await db.inventoryMovement.create({ data: {
          variantId: variant.id, orderId: created.id, quantityDelta: -1,
          quantityBefore: updatedVariant.inventory + 1, quantityAfter: updatedVariant.inventory,
          reason: "ORDER_CREATED",
        } });
      }
      return created;
    };

    const snapshotOrder = await order("SNAP", "PICK_UP");
    const pickupOrder = await order("PICKUP", "PICK_UP");
    const deliveryOrder = await order("DELIVERY", "DELIVERY");
    const cancellationOrder = await order("CANCEL", "PICK_UP");
    const paidOrder = await order("PAID", "PICK_UP", "DELIVERED", { paid: true });
    const foreignOrder = await order("FOREIGN", "PICK_UP", "PENDING", { foreign: true, item: false });

    const pendingPage = await merchant.listMerchantRetailOrders(context, { page: 1, pageSize: 2, query: "", status: "PENDING", sort: "oldest" });
    assert.equal(pendingPage.total, 4, "tenant list contains its four pending orders, excluding foreign tenant data");
    assert.equal(pendingPage.orders.length, 2);
    assert.equal(pendingPage.page, 1);
    assert.equal(pendingPage.totalPages, 2);
    assert.ok(pendingPage.orders.every((entry) => entry.orderNumber !== foreignOrder.orderNumber));
    const nextPage = await merchant.listMerchantRetailOrders(context, { page: 2, pageSize: 2, query: "", status: "PENDING", sort: "oldest" });
    assert.equal(nextPage.orders.length, 2);
    assert.notEqual(pendingPage.orders[0]?.id, nextPage.orders[0]?.id);
    const filtered = await merchant.listMerchantRetailOrders(context, { page: 1, pageSize: 10, query: snapshotOrder.orderNumber, paymentStatus: "PENDING", sort: "newest" });
    assert.deepEqual(filtered.orders.map((entry) => entry.id), [snapshotOrder.id]);
    await assert.rejects(() => merchant.listMerchantRetailOrders(staffContext, { page: 1, pageSize: 10, query: "", sort: "newest" }),
      (error: unknown) => error instanceof ApiError && error.status === 403);

    const legacyOrder = await db.order.create({ data: {
      orderNumber: `R1-LEGACY-${suffix}`, type: "PICK_UP", status: "PENDING", subtotal: 125, total: 125, organizationSlug: slug,
    } });
    orderIds.push(legacyOrder.id);
    const legacyDetail = await merchant.getMerchantRetailOrder(context, legacyOrder.orderNumber);
    assert.equal(legacyDetail.legacyOrder, true);
    assert.deepEqual(legacyDetail.actions, [], "legacy order details remain readable without enabling Retail actions");
    assert.ok((await merchant.listMerchantRetailOrders(context, { page: 1, pageSize: 10, query: legacyOrder.orderNumber, sort: "newest" }))
      .orders.some((entry) => entry.id === legacyOrder.id), "legacy orders remain visible in the tenant order list");
    await assert.rejects(() => merchant.changeMerchantRetailOrder(context, legacyOrder.orderNumber,
      { status: "ACCEPTED", expectedStatus: "PENDING" }),
    (error: unknown) => error instanceof ApiError && error.status === 404);

    const detailBefore = await merchant.getMerchantRetailOrder(context, snapshotOrder.orderNumber);
    assert.equal(detailBefore.items[0]?.name, "Purchase-time product");
    assert.equal(detailBefore.items[0]?.unitPrice, 125);
    await db.product.update({ where: { id: product.id }, data: { name: "Renamed live product", basePrice: 900 } });
    await db.productVariant.update({ where: { id: variant.id }, data: { name: "Renamed live variant", price: 950 } });
    const detailAfter = await merchant.getMerchantRetailOrder(context, snapshotOrder.orderNumber);
    assert.equal(detailAfter.items[0]?.name, "Purchase-time product");
    assert.equal(detailAfter.items[0]?.sku, variant.sku);
    assert.equal(detailAfter.items[0]?.variantName, "Purchase-time variant");
    assert.equal(detailAfter.items[0]?.unitPrice, 125);
    assert.deepEqual(detailAfter.items[0]?.options, ["Color: Blue"]);

    const stockBeforeFulfillment = (await db.productVariant.findUniqueOrThrow({ where: { id: variant.id } })).inventory;
    await merchant.changeMerchantRetailOrder(context, pickupOrder.orderNumber, { status: "ACCEPTED", expectedStatus: "PENDING" });
    await merchant.changeMerchantRetailOrder(managerContext, pickupOrder.orderNumber, { status: "PREPARING", expectedStatus: "ACCEPTED" });
    await merchant.changeMerchantRetailOrder(context, pickupOrder.orderNumber, { status: "READY", expectedStatus: "PREPARING" });
    await merchant.changeMerchantRetailOrder(context, pickupOrder.orderNumber, { status: "PICKED_UP", expectedStatus: "READY" });
    await assert.rejects(() => merchant.changeMerchantRetailOrder(context, pickupOrder.orderNumber, { status: "DELIVERED", expectedStatus: "PICKED_UP" }),
      (error: unknown) => error instanceof ApiError && error.status === 409);

    await merchant.changeMerchantRetailOrder(managerContext, deliveryOrder.orderNumber, { status: "ACCEPTED", expectedStatus: "PENDING" });
    await merchant.changeMerchantRetailOrder(managerContext, deliveryOrder.orderNumber, { status: "PREPARING", expectedStatus: "ACCEPTED" });
    await merchant.changeMerchantRetailOrder(managerContext, deliveryOrder.orderNumber, { status: "READY", expectedStatus: "PREPARING" });
    await merchant.changeMerchantRetailOrder(managerContext, deliveryOrder.orderNumber, { status: "PICKED_UP", expectedStatus: "READY" });
    await merchant.changeMerchantRetailOrder(managerContext, deliveryOrder.orderNumber, { status: "DELIVERED", expectedStatus: "PICKED_UP" });
    assert.equal((await db.productVariant.findUniqueOrThrow({ where: { id: variant.id } })).inventory, stockBeforeFulfillment,
      "fulfillment transitions do not change the reserved inventory balance");
    await assert.rejects(() => merchant.changeMerchantRetailOrder(context, snapshotOrder.orderNumber, { status: "READY", expectedStatus: "PENDING" }),
      (error: unknown) => error instanceof ApiError && error.status === 409);
    for (const deniedContext of [staffContext, customerContext]) {
      await assert.rejects(() => merchant.changeMerchantRetailOrder(deniedContext, snapshotOrder.orderNumber,
        { status: "ACCEPTED", expectedStatus: "PENDING" }),
      (error: unknown) => error instanceof ApiError && error.status === 403);
    }
    const adminOrder = await order("ADMIN", "PICK_UP");
    await merchant.changeMerchantRetailOrder(context, adminOrder.orderNumber, { status: "ACCEPTED", expectedStatus: "PENDING" });
    const managerOrder = await order("MANAGER", "PICK_UP");
    await merchant.changeMerchantRetailOrder(managerContext, managerOrder.orderNumber, { status: "ACCEPTED", expectedStatus: "PENDING" });

    const stockBeforeCancellation = (await db.productVariant.findUniqueOrThrow({ where: { id: variant.id } })).inventory;
    await merchant.changeMerchantRetailOrder(context, cancellationOrder.orderNumber, { status: "CANCELLED", expectedStatus: "PENDING" });
    await merchant.changeMerchantRetailOrder(context, cancellationOrder.orderNumber, { status: "CANCELLED", expectedStatus: "CANCELLED" });
    assert.equal((await db.productVariant.findUniqueOrThrow({ where: { id: variant.id } })).inventory, stockBeforeCancellation + 1,
      "only the cancelled order's reserved unit is added back once");
    assert.equal(await db.inventoryMovement.count({ where: { orderId: cancellationOrder.id, reason: "ORDER_CANCELLED" } }), 1);
    assert.equal(await db.orderStatusHistory.count({ where: { orderId: cancellationOrder.id } }), 1);

    await assert.rejects(() => merchant.changeMerchantRetailOrder(context, paidOrder.orderNumber, { status: "CANCELLED", expectedStatus: "DELIVERED" }),
      (error: unknown) => error instanceof ApiError && error.status === 409);
    await assert.rejects(() => merchant.changeMerchantRetailOrder(context, paidOrder.orderNumber, { status: "REFUNDED", expectedStatus: "DELIVERED" }),
      (error: unknown) => error instanceof ApiError && error.status === 409);
    assert.equal((await db.order.findUniqueOrThrow({ where: { id: paidOrder.id } })).paymentStatus, "COMPLETED");
    assert.equal(await db.inventoryMovement.count({ where: { orderId: paidOrder.id, reason: "ORDER_CANCELLED" } }), 0);
    assert.equal(await db.inventoryMovement.count({ where: { orderId: paidOrder.id, reason: "ORDER_REFUNDED" } }), 0);

    await merchant.changeMerchantRetailOrder(context, pickupOrder.orderNumber, { status: "PICKED_UP", expectedStatus: "PICKED_UP" });
    assert.equal(await db.orderStatusHistory.count({ where: { orderId: pickupOrder.id } }), 4,
      "repeating the current status does not duplicate lifecycle history");

    let releaseLock!: () => void;
    let lockAcquired!: () => void;
    let lockerPid = 0;
    const acquired = new Promise<void>((resolve) => { lockAcquired = resolve; });
    const release = new Promise<void>((resolve) => { releaseLock = resolve; });
    lockRelease = () => releaseLock();
    const lockOrder = await order("RACE", "PICK_UP", "PENDING", { item: false });
    lockTransaction = db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${lockOrder.id} FOR UPDATE`;
      const pid = await tx.$queryRaw<Array<{ pid: number }>>`SELECT pg_backend_pid() AS pid`;
      lockerPid = pid[0]!.pid;
      lockAcquired();
      await release;
      await tx.order.update({ where: { id: lockOrder.id }, data: { status: "CANCELLED" } });
    }, { timeout: 15_000 });
    await acquired;
    staleUpdate = merchant.changeMerchantRetailOrder(context, lockOrder.orderNumber, { status: "ACCEPTED", expectedStatus: "PENDING" });
    const deadline = Date.now() + 5000;
    let blockedCalls = 0;
    while (Date.now() < deadline) {
      const blocked = await db.$queryRaw<Array<{ count: bigint }>>`
        SELECT count(*)::bigint AS count FROM pg_stat_activity activity
        WHERE activity.datname = current_database() AND activity.wait_event_type = 'Lock'
          AND ${lockerPid} = ANY(pg_blocking_pids(activity.pid))`;
      blockedCalls = Number(blocked[0]?.count ?? 0);
      if (blockedCalls >= 1) break;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    assert.ok(blockedCalls >= 1, `expected merchant status update to wait on the locked order row, saw ${blockedCalls}`);
    releaseLock();
    lockRelease = undefined;
    await lockTransaction;
    await assert.rejects(() => staleUpdate, (error: unknown) => error instanceof ApiError && error.status === 409);
    staleUpdate = undefined;
    assert.equal((await db.order.findUniqueOrThrow({ where: { id: lockOrder.id } })).status, "CANCELLED");
    assert.equal(await db.orderStatusHistory.count({ where: { orderId: lockOrder.id } }), 0,
      "a stale expectedStatus request writes no lifecycle history");
  } finally {
    if (lockRelease) lockRelease();
    if (lockTransaction) await lockTransaction;
    if (staleUpdate) await Promise.allSettled([staleUpdate]);
    if (orderIds.length) {
      await db.couponRedemption.deleteMany({ where: { orderId: { in: orderIds } } });
      await db.paymentEvent.deleteMany({ where: { orderId: { in: orderIds } } });
      await db.orderStatusHistory.deleteMany({ where: { orderId: { in: orderIds } } });
      await db.inventoryMovement.deleteMany({ where: { orderId: { in: orderIds } } });
      await db.payment.deleteMany({ where: { orderId: { in: orderIds } } });
      await db.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
      await db.order.deleteMany({ where: { id: { in: orderIds } } });
    }
    if (variantIds.length) await db.inventoryMovement.deleteMany({ where: { variantId: { in: variantIds } } });
    if (productIds.length) await db.productVariant.deleteMany({ where: { productId: { in: productIds } } });
    if (productIds.length) await db.product.deleteMany({ where: { id: { in: productIds } } });
    if (categoryIds.length) await db.productCategory.deleteMany({ where: { id: { in: categoryIds } } });
    if (organizationIds.length) await db.organizationCapability.deleteMany({ where: { organizationId: { in: organizationIds } } });
    if (organizationIds.length) await db.organization.deleteMany({ where: { id: { in: organizationIds } } });
    if (userIds.length) await db.user.deleteMany({ where: { id: { in: userIds } } });
    await db.$disconnect();
  }
});
