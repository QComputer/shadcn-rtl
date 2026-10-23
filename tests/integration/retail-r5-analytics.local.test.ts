import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";

const enabled = process.env.RETAIL_R5_PG_ACCEPTANCE === "1";
const money = (value: string) => value.replace(/(\.\d*?[1-9])0+$|\.0+$/, "$1");

function assertGuardedDatabase() {
  assert.equal(process.env.DATABASE_URL, process.env.DIRECT_URL);
  assert.equal(process.env.LOCAL_PRISMA_EXPECTED_PORT, "54713");
  for (const key of ["DATABASE_URL", "DIRECT_URL"]) {
    const url = new URL(process.env[key] ?? "");
    assert.equal(url.protocol, "postgresql:");
    assert.equal(url.hostname, "127.0.0.1");
    assert.equal(url.port, "54713");
    assert.equal(url.pathname, "/retail_p0_20261019");
    assert.match(decodeURIComponent(url.username), /^consol_[a-f0-9]+$/);
  }
}

test("Retail R5 analytics scope, verified collections, snapshots, timezone boundaries, and inventory", {
  skip: !enabled,
  concurrency: false,
}, async () => {
  assertGuardedDatabase();
  process.env.AI_MEDIA_LOCAL_DOCKER_E2E = "1";
  const { PrismaClient } = await import("@prisma/client");
  const db = new PrismaClient({ log: [{ level: "query", emit: "event" }, "error"] });
  let queryCount = 0;
  db.$on("query", () => { queryCount++; });
  (globalThis as unknown as { bazarBazPrisma: typeof db | undefined }).bazarBazPrisma = db;
  const [identity] = await db.$queryRaw<Array<{ database: string; version_num: number; current_user: string }>>`SELECT current_database() AS database, current_setting('server_version_num')::int AS version_num, current_user`;
  assert.equal(identity.database, "retail_p0_20261019");
  assert.ok(identity.version_num >= 160000 && identity.version_num < 170000, "fixture must be the available PostgreSQL 16 container");
  assert.match(identity.current_user, /^consol_[a-f0-9]+$/);
  assert.equal(identity.current_user, decodeURIComponent(new URL(process.env.DATABASE_URL!).username));
  const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
  const groupPrefix = `r5-analytics-${suffix}-`;
  const orgIds: string[] = [];
  const userIds: string[] = [];
  const orderIds: string[] = [];
  const productIds: string[] = [];
  const categoryIds: string[] = [];

  try {
    const [org, otherOrg] = await Promise.all([
      db.organization.create({ data: { type: "SHOP", name: `R5 analytics ${suffix}`, slug: `r5-analytics-${suffix}`, timezone: "Asia/Tehran" } }),
      db.organization.create({ data: { type: "SHOP", name: `R5 analytics other ${suffix}`, slug: `r5-analytics-other-${suffix}` } }),
    ]);
    orgIds.push(org.id, otherOrg.id);
    const customer = await db.user.create({ data: { name: `r5-analytics-customer-${suffix}`, password: "synthetic-only", role: "CUSTOMER", phone: `+98912${suffix.slice(0, 7)}` } });
    const phoneTwin = await db.user.create({ data: { name: `r5-analytics-phone-twin-${suffix}`, password: "synthetic-only", role: "CUSTOMER", phone: customer.phone } });
    const manager = await db.user.create({ data: { name: `r5-analytics-manager-${suffix}`, password: "synthetic-only", role: "ADMIN" } });
    const managerRoleUser = await db.user.create({ data: { name: `r5-analytics-manager-role-${suffix}`, password: "synthetic-only", role: "MANAGER" } });
    userIds.push(customer.id, phoneTwin.id, manager.id, managerRoleUser.id);

    const category = await db.productCategory.create({ data: { name: "Synthetic R5 category", slug: `r5-analytics-${suffix}`, organizationId: org.id, organizationSlug: org.slug } });
    const otherCategory = await db.productCategory.create({ data: { name: "Synthetic R5 other category", slug: `r5-analytics-other-${suffix}`, organizationId: otherOrg.id, organizationSlug: otherOrg.slug } });
    categoryIds.push(category.id, otherCategory.id);
    const product = await db.product.create({ data: {
      name: "Synthetic historical snapshot item", slug: `r5-analytics-${suffix}`, basePrice: "9999.99", organizationId: org.id,
      organizationSlug: org.slug, categoryId: category.id, trackInventory: true, lowStockThreshold: 5,
      variants: { create: [
        { name: "low tracked", sku: `R5L${suffix}`, price: "9999.99", inventory: 4, reservedQuantity: 2 },
        { name: "backorder", sku: `R5B${suffix}`, inventory: 0, allowBackOrder: true },
      ] },
    } });
    productIds.push(product.id);
    const untrackedProduct = await db.product.create({ data: {
      name: "Synthetic untracked item", slug: `r5-untracked-${suffix}`, basePrice: "10.00", organizationId: org.id,
      organizationSlug: org.slug, categoryId: category.id, trackInventory: false,
      variants: { create: { name: "untracked", sku: `R5U${suffix}`, inventory: 0 } },
    } });
    productIds.push(untrackedProduct.id);
    const foreignProduct = await db.product.create({ data: {
      name: "Synthetic foreign product", slug: `r5-foreign-${suffix}`, basePrice: "500.00", organizationId: otherOrg.id,
      organizationSlug: otherOrg.slug, categoryId: otherCategory.id,
      variants: { create: { name: "foreign", sku: `R5F${suffix}`, inventory: 50 } },
    } });
    productIds.push(foreignProduct.id);
    const lowVariant = await db.productVariant.findUniqueOrThrow({ where: { sku: `R5L${suffix}` } });

    // 2026-04-01 Tehran midnight is 2026-03-31T20:30Z. The custom range is
    // local-date inclusive and must exclude the instant immediately before it.
    const tehranStart = new Date("2026-03-31T20:30:00.000Z");
    const tehranEnd = new Date("2026-04-01T20:30:00.000Z");
    async function createOrder(options: {
      suffix: string; createdAt?: Date; paidAt?: Date | null; status?: "PENDING" | "CANCELLED" | "REFUNDED";
      paymentStatus?: "PENDING" | "COMPLETED" | "REFUNDED"; method?: "BANK_TRANSFER" | "CASH";
      total: string; customerId?: string | null; productId?: string; includeItem?: boolean; softDeleted?: boolean;
      paymentAmount?: string; paymentStatusRow?: "PENDING" | "COMPLETED" | "REFUNDED"; cashReport?: "APPROVED" | "PENDING_REVIEW";
    }) {
      const idempotency = `r5-analytics-${suffix}-${options.suffix}`;
      const state = options.paymentStatus ?? "COMPLETED";
      const order = await db.order.create({ data: {
        orderNumber: `R5-${suffix}-${options.suffix}`, retailCheckoutKey: idempotency, type: "PICK_UP",
        status: options.status ?? "DELIVERED", subtotal: "100.10", deliveryFee: "10.05", tax: "3.25", discount: "5.00", total: options.total,
        paidAt: options.paidAt === undefined ? tehranStart : options.paidAt,
        paymentMethod: options.method ?? "BANK_TRANSFER", paymentStatus: state, organizationSlug: org.slug,
        customerId: options.customerId === undefined ? customer.id : options.customerId, createdAt: options.createdAt ?? tehranStart,
        deletedAt: options.softDeleted ? new Date("2026-04-02T00:00:00.000Z") : null,
        ...(options.includeItem === false ? {} : { items: { create: {
          productId: options.productId ?? product.id, variantId: null, quantity: 2, price: "100.10", discount: "5.05",
          productNameSnapshot: "Historical item name", skuSnapshot: `OLD-${suffix}`, variantOptionsSnapshot: { size: "old" },
        } } }),
        payment: { create: { amount: options.paymentAmount ?? options.total, method: options.method ?? "BANK_TRANSFER", status: options.paymentStatusRow ?? state } },
      } });
      orderIds.push(order.id);
      if (options.cashReport) await db.retailPaymentReport.create({ data: {
        organizationId: org.id, orderId: order.id, submittedById: customer.id, kind: "CASH_COLLECTION", cashMode: "COURIER", collectorId: manager.id,
        status: options.cashReport, ...(options.cashReport === "APPROVED" ? { reviewedAt: new Date("2026-04-01T22:00:00.000Z"), reviewedById: manager.id } : {}),
      } });
      return order;
    }

    const verified = await createOrder({ suffix: "verified", total: "205.15", customerId: customer.id });
    await createOrder({ suffix: "prior-purchase", total: "11.00", createdAt: new Date(tehranStart.getTime() - 86_400_000), paidAt: new Date(tehranStart.getTime() - 86_400_000), customerId: customer.id });
    await createOrder({ suffix: "older-paid-this-period", total: "11.00", createdAt: new Date(tehranStart.getTime() - 2 * 86_400_000), paidAt: new Date("2026-04-01T20:00:00.000Z"), customerId: null, includeItem: false });
    await createOrder({ suffix: "cash-unreviewed", total: "40.00", method: "CASH" });
    await createOrder({ suffix: "cash-approved", total: "50.00", method: "CASH", cashReport: "APPROVED", customerId: phoneTwin.id });
    await createOrder({ suffix: "pending", total: "80.00", paymentStatus: "PENDING", paymentStatusRow: "PENDING", paidAt: null });
    await createOrder({ suffix: "cancelled-paid", total: "20.00", status: "CANCELLED", customerId: phoneTwin.id });
    await createOrder({ suffix: "refunded", total: "30.00", status: "REFUNDED", paymentStatus: "REFUNDED", paymentStatusRow: "REFUNDED", paidAt: null });
    await createOrder({ suffix: "mismatched-amount", total: "25.00", paymentAmount: "24.99" });
    await createOrder({ suffix: "outside-before", total: "7.00", createdAt: new Date(tehranStart.getTime() - 1), paidAt: new Date(tehranStart.getTime() - 1) });
    await createOrder({ suffix: "outside-after", total: "8.00", createdAt: tehranEnd, paidAt: tehranEnd });
    await createOrder({ suffix: "soft-deleted", total: "9.00", softDeleted: true });
    const foreign = await db.order.create({ data: {
      orderNumber: `R5-${suffix}-foreign`, retailCheckoutKey: `r5-analytics-${suffix}-foreign`, type: "PICK_UP", status: "DELIVERED",
      subtotal: "500.00", deliveryFee: 0, tax: 0, discount: 0, total: "500.00", paidAt: tehranStart,
      paymentMethod: "BANK_TRANSFER", paymentStatus: "COMPLETED", organizationSlug: otherOrg.slug, createdAt: tehranStart,
      items: { create: { productId: foreignProduct.id, quantity: 1, price: "500.00", productNameSnapshot: "Foreign", skuSnapshot: "FOREIGN" } },
      payment: { create: { amount: "500.00", method: "BANK_TRANSFER", status: "COMPLETED" } },
    } });
    orderIds.push(foreign.id);

    // Transition evidence can be duplicated without becoming a second receipt.
    await db.paymentEvent.createMany({ data: [
      { orderId: verified.id, previousStatus: "PENDING", newStatus: "COMPLETED", method: "BANK_TRANSFER", amount: "205.15", note: "synthetic transition" },
      { orderId: verified.id, previousStatus: "COMPLETED", newStatus: "COMPLETED", method: "BANK_TRANSFER", amount: "205.15", note: "synthetic duplicate evidence" },
    ] });
    await db.product.update({ where: { id: product.id }, data: { basePrice: "12345.67" } });
    await db.inventoryMovement.create({ data: { variantId: lowVariant.id, orderId: verified.id, quantityDelta: -1, quantityBefore: 5, quantityAfter: 4, reason: "ORDER_CREATED", createdAt: tehranStart } });

    const [{ getRetailAnalytics }, { analyticsQuerySchema }] = await Promise.all([
      import("@/lib/retail/analytics.server"), import("@/lib/retail/analytics"),
    ]);
    const getReport = (context: Parameters<typeof getRetailAnalytics>[0], input: Record<string, unknown>) => getRetailAnalytics(context, analyticsQuerySchema.parse(input));
    const context = { organizationId: org.id, organizationSlug: org.slug, actorUserId: manager.id, role: "ADMIN" as const };
    const report = await getReport(context, { range: "custom", from: "2026-04-01", to: "2026-04-01", page: 1, report: "summary" });
    assert.equal(report.range.timezone, "Asia/Tehran");
    assert.equal(report.summary.orders, 7, "orders are counted by creation time, excluding archived and boundary-external rows");
    assert.equal(money(report.summary.grossValue), "450.15");
    assert.equal(money(report.summary.subtotal), "700.7");
    assert.equal(money(report.summary.shipping), "70.35");
    assert.equal(money(report.summary.tax), "22.75");
    assert.equal(money(report.summary.discount), "35");
    assert.equal(money(report.summary.pendingCollection), "80");
    assert.equal(money(report.summary.verifiedCollected), "286.15", "a prior order created before this range but paid in-period still contributes to receipts");
    assert.equal(report.summary.paymentMismatches, 2, "unreviewed cash and amount mismatch are surfaced");
    assert.equal(report.filters.ranking, "quantity");
    assert.equal(report.summary.unitsSold, 4, "cancelled and refunded orders do not count as item sales");
    assert.deepEqual(report.trends.map(day => day.date), ["2026-04-01"]);
    assert.equal(money(report.trends[0]?.collected ?? "0"), "286.15");
    assert.equal(report.products.length, 1);
    assert.equal(report.products[0]?.name, "Historical item name");
    assert.equal(report.products[0]?.sku, `OLD-${suffix}`);
    assert.equal(money(report.products[0]?.value ?? "0"), "390.3", "historical line value uses purchase snapshot price less line discount");
    assert.equal(report.products[0]?.quantity, 4);
    assert.equal(report.customers.purchasing, 2, "distinct customer IDs remain distinct even when phone values match");
    assert.equal(report.customers.new, 1);
    assert.equal(report.customers.returning, 1, "prior verified order in this tenant classifies the same account as returning");
    assert.equal(report.inventory.tracked, 2);
    assert.equal(report.inventory.untracked, 1);
    assert.equal(report.inventory.backorder, 1);
    assert.equal(report.inventory.lowStock, 1);
    assert.equal(report.inventory.outOfStock, 0, "backorder variants are not reported out of stock");
    const availableVariant = report.inventory.rows.find(row => row.sku === `R5L${suffix}`);
    assert.equal(availableVariant?.quantity, 2, "available inventory subtracts two reserved units from four on hand");
    assert.equal(report.inventory.movements.length, 1);
    assert.equal(report.inventory.movements[0]?.delta, -1);
    assert.equal(report.inventory.movements[0]?.reason, "ORDER_CREATED");

    const backorderVariant = await db.productVariant.findUniqueOrThrow({ where: { sku: `R5B${suffix}` } });
    const snapshotOrder = await db.order.create({ data: {
      orderNumber: `R5-${suffix}-many-snapshots`, retailCheckoutKey: `${groupPrefix}many-snapshots`, type: "PICK_UP", status: "DELIVERED",
      subtotal: "2500.00", deliveryFee: 0, tax: 0, discount: 0, total: "2500.00", paidAt: tehranStart,
      paymentMethod: "BANK_TRANSFER", paymentStatus: "COMPLETED", organizationSlug: org.slug, createdAt: tehranStart,
      items: { create: [
        { productId: product.id, variantId: lowVariant.id, quantity: 1, price: "100.10", discount: 0, productNameSnapshot: "Same variant snapshot", skuSnapshot: "SAME-SNAPSHOT-SKU", variantOptionsSnapshot: { size: "same" } },
        { productId: product.id, variantId: backorderVariant.id, quantity: 1, price: "100.10", discount: 0, productNameSnapshot: "Same variant snapshot", skuSnapshot: "SAME-SNAPSHOT-SKU", variantOptionsSnapshot: { size: "same" } },
        ...Array.from({ length: 23 }, (_, index) => ({
          productId: product.id, variantId: null, quantity: 1, price: "100.10", discount: 0,
          productNameSnapshot: "Archived item display", skuSnapshot: `ARCHIVED-${String(index + 1).padStart(2, "0")}`,
          variantOptionsSnapshot: { group: index + 1 },
        })),
      ] },
      payment: { create: { amount: "2500.00", method: "BANK_TRANSFER", status: "COMPLETED" } },
    } });
    orderIds.push(snapshotOrder.id);
    const productPage1 = await getReport(context, { range: "custom", from: "2026-04-01", to: "2026-04-01", page: 1, report: "products" });
    const productPage2 = await getReport(context, { range: "custom", from: "2026-04-01", to: "2026-04-01", page: 2, report: "products" });
    assert.equal(productPage1.productTotal, 26, "distinct snapshots and variants are separate product-performance groups");
    assert.equal(productPage1.products.length, 20);
    assert.equal(productPage2.page, 2);
    assert.equal(productPage2.products.length, 6);
    const repeatedVariantGroups = [...productPage1.products, ...productPage2.products].filter(row => row.sku === "SAME-SNAPSHOT-SKU");
    assert.equal(repeatedVariantGroups.length, 2, "same-name and same-SKU order rows remain distinct by variant ID");
    assert.equal(new Set(repeatedVariantGroups.map(row => row.variantId)).size, 2);
    await db.product.update({ where: { id: product.id }, data: { deletedAt: new Date("2026-04-03T00:00:00.000Z") } });
    const archivedSnapshot = await getReport(context, { range: "custom", from: "2026-04-01", to: "2026-04-01", page: 2, report: "products" });
    assert.equal(archivedSnapshot.productTotal, 26, "archiving the catalog product does not erase purchase snapshots");
    assert.equal(archivedSnapshot.products.length, 6);

    await assert.rejects(() => getReport({ ...context, role: "CUSTOMER" as const }, {
      range: "custom", from: "2026-04-01", to: "2026-04-01", page: 1, report: "summary",
    }), (error: unknown) => typeof error === "object" && error !== null && "status" in error && error.status === 403);
    const emptyQueryStart = queryCount;
    const empty = await getReport(context, { range: "custom", from: "2026-05-01", to: "2026-05-01", page: 1, report: "summary" });
    const emptyQueryCount = queryCount - emptyQueryStart;
    assert.equal(empty.summary.orders, 0);
    assert.equal(empty.summary.grossValue, "0");
    assert.equal(empty.summary.verifiedCollected, "0");
    assert.equal(empty.trends.length, 1);
    assert.equal(empty.trends[0]?.orders, 0);
    const managerAccess = await getReport({ ...context, actorUserId: managerRoleUser.id, role: "MANAGER" }, { range: "custom", from: "2026-05-01", to: "2026-05-01", page: 1, report: "summary" });
    const superAdminAccess = await getReport({ ...context, role: "SUPER_ADMIN" }, { range: "custom", from: "2026-05-01", to: "2026-05-01", page: 1, report: "summary" });
    assert.equal(managerAccess.summary.orders, 0);
    assert.equal(superAdminAccess.summary.orders, 0);

    // A bounded 500-order volume sample uses bulk fixture writes and captures
    // service query time in the artifact runner log without a brittle timing gate.
    const volumePrefix = `${groupPrefix}volume-`;
    const createdAt = new Date("2026-05-02T12:00:00.000Z");
    const volumeOrders = Array.from({ length: 500 }, (_, index) => {
      const serial = String(index + 1).padStart(4, "0");
      return {
        id: `r5bench${suffix}${serial}`, orderNumber: `R5-${suffix}-V${serial}`, retailCheckoutKey: `${volumePrefix}${serial}`,
        type: "PICK_UP" as const, status: "PENDING" as const, subtotal: "1.01", deliveryFee: "0", tax: "0", discount: "0", total: "1.01",
        paymentStatus: "PENDING" as const, paymentMethod: "BANK_TRANSFER" as const, organizationSlug: org.slug, createdAt,
      };
    });
    await db.order.createMany({ data: volumeOrders });
    await db.payment.createMany({ data: volumeOrders.map((order, index) => ({
      id: `r5pay${suffix}${String(index + 1).padStart(4, "0")}`, orderId: order.id, amount: "1.01", method: "BANK_TRANSFER" as const, status: "PENDING" as const,
    })) });
    const volumeQueryStart = queryCount;
    const volume = await getReport(context, { range: "custom", from: "2026-05-02", to: "2026-05-02", page: 1, report: "summary" });
    const volumeQueryCount = queryCount - volumeQueryStart;
    assert.equal(volume.summary.orders, 500);
    assert.equal(money(volume.summary.grossValue), "505");
    assert.equal(volumeQueryCount, emptyQueryCount, "analytics query count stays constant with 500 rows instead of growing with result size");
    console.log(`R5_ANALYTICS_VOLUME ${JSON.stringify({ orders: 500, queryMilliseconds: volume.queryMilliseconds, queryCount: volumeQueryCount, emptyQueryCount, pageSize: volume.pageSize, resultCount: volume.summary.orders })}`);

    await db.organization.update({ where: { id: org.id }, data: { timezone: "America/New_York" } });
    const dstStart = new Date("2026-03-08T05:00:00.000Z");
    const dstEnd = new Date("2026-03-09T04:00:00.000Z");
    assert.equal(dstEnd.getTime() - dstStart.getTime(), 23 * 60 * 60 * 1000);
    await createOrder({ suffix: "dst-before", total: "10.00", createdAt: new Date(dstStart.getTime() - 1), status: "PENDING", paymentStatus: "PENDING", paymentStatusRow: "PENDING", paidAt: null, customerId: null, includeItem: false });
    await createOrder({ suffix: "dst-at-start", total: "10.00", createdAt: dstStart, status: "PENDING", paymentStatus: "PENDING", paymentStatusRow: "PENDING", paidAt: null, customerId: null, includeItem: false });
    await createOrder({ suffix: "dst-before-end", total: "10.00", createdAt: new Date(dstEnd.getTime() - 1), status: "PENDING", paymentStatus: "PENDING", paymentStatusRow: "PENDING", paidAt: null, customerId: null, includeItem: false });
    await createOrder({ suffix: "dst-at-end", total: "10.00", createdAt: dstEnd, status: "PENDING", paymentStatus: "PENDING", paymentStatusRow: "PENDING", paidAt: null, customerId: null, includeItem: false });
    const dstReport = await getReport(context, { range: "custom", from: "2026-03-08", to: "2026-03-08", page: 1, report: "summary" });
    assert.equal(dstReport.range.timezone, "America/New_York");
    assert.equal(dstReport.summary.orders, 2, "local-day SQL boundaries include start and final millisecond, excluding adjacent instants");
    assert.deepEqual(dstReport.trends.map(day => [day.date, day.orders]), [["2026-03-08", 2]]);
  } finally {
    const generated = await db.order.findMany({ where: { retailCheckoutKey: { startsWith: groupPrefix } }, select: { id: true } });
    const generatedIds = [...new Set([...orderIds, ...generated.map(row => row.id)])];
    if (generatedIds.length) {
      await db.paymentEvent.deleteMany({ where: { orderId: { in: generatedIds } } });
      await db.payment.deleteMany({ where: { orderId: { in: generatedIds } } });
    }
    if (generatedIds.length) await db.order.deleteMany({ where: { id: { in: generatedIds } } });
    if (productIds.length) await db.product.deleteMany({ where: { id: { in: productIds } } });
    if (categoryIds.length) await db.productCategory.deleteMany({ where: { id: { in: categoryIds } } });
    if (orgIds.length) await db.organization.deleteMany({ where: { id: { in: orgIds } } });
    if (userIds.length) await db.user.deleteMany({ where: { id: { in: userIds } } });
    (globalThis as unknown as { bazarBazPrisma: typeof db | undefined }).bazarBazPrisma = undefined;
    await db.$disconnect();
  }
});
