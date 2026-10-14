import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

const enabled = process.env.RETAIL_R4_CHECKOUT_PG_ACCEPTANCE === "1";

function assertExactDatabaseTarget() {
  for (const key of ["DATABASE_URL", "DIRECT_URL"]) {
    const url = new URL(process.env[key] ?? "");
    assert.ok(["127.0.0.1", "localhost"].includes(url.hostname), `${key} must use loopback`);
    assert.equal(url.port, "55433", `${key} must use the disposable R4 PostgreSQL port`);
    assert.equal(url.pathname, `/${process.env.RETAIL_R4_EXPECTED_DATABASE}`, `${key} must use the exact disposable R4/R5 database`);
  }
  assert.equal(process.env.DATABASE_URL, process.env.DIRECT_URL);
  assert.equal(process.env.LOCAL_PRISMA_EXPECTED_PORT, "55433");
  assert.match(process.env.RETAIL_R4_EXPECTED_DATABASE ?? "", /^bazarbaaz_retail_(?:r4|r5)$/);
  assert.equal(process.env.AI_MEDIA_LOCAL_DOCKER_E2E, "1");
}

test("Retail R4 checkout, discount limits, and payment reports persist on the seeded PG17 fixture", { skip: !enabled, concurrency: false }, async () => {
  assertExactDatabaseTarget();
  const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
  const codeSuffix = suffix.toUpperCase();
  const testRoot = await mkdtemp(path.join(os.tmpdir(), "retail-r4-checkout-"));
  process.env.CI = "true";
  process.env.RETAIL_RECEIPT_TEST_STORAGE = "1";
  process.env.RETAIL_RECEIPT_LOCAL_ROOT = testRoot;

  const [{ PrismaClient }, checkout, reports, cash, receiptStorage, inotiReadiness, catalog] = await Promise.all([
    import("@prisma/client"),
    import("@/lib/retail/checkout.server"),
    import("@/lib/retail/payment-reports.server"),
    import("@/lib/retail/cash.server"),
    import("@/lib/retail/receipt-storage.server"),
    import("@/lib/retail/inoti-readiness.server"),
    import("@/lib/public-catalog/service.server"),
  ]);
  const db = new PrismaClient({ log: ["error"] });
  const idempotencyKeys: string[] = [];
  const receiptKeys: string[] = [];
  let productId = "";
  let variantId = "";
  const cartIds = new Set<string>();
  const couponIds: string[] = [];
  const orderIds: string[] = [];
  let secondaryCustomerId = "";

  try {
    const identity = await db.$queryRaw<Array<{ database: string; version: string; version_num: number }>>`
      SELECT current_database() AS database, current_setting('server_version') AS version,
        current_setting('server_version_num')::int AS version_num
    `;
    assert.equal(identity[0]?.database, "bazarbaaz_retail_r4");
    assert.ok(identity[0]!.version_num >= 170000 && identity[0]!.version_num < 180000, `expected PostgreSQL 17, got ${identity[0]!.version}`);

    const fashion = await db.organization.findUniqueOrThrow({ where: { slug: "retail-r4-synthetic-fashion" } });
    const mobile = await db.organization.findUniqueOrThrow({ where: { slug: "retail-r4-synthetic-mobile" } });
    const customer = await db.user.findUniqueOrThrow({ where: { email: "r4-synthetic-customer@example.test" } });
    const manager = await db.user.findUniqueOrThrow({ where: { email: "r4-synthetic-fashion-manager@example.test" } });
    const category = await db.productCategory.findFirstOrThrow({ where: { organizationId: fashion.id, slug: "sneakers" } });
    assert.equal(await inotiReadiness.getRetailInotiReadiness(fashion.id), null,
      "synthetic merchant without a verified active iNoti integration must not offer USSD");
    await assert.rejects(() => checkout.createRetailCheckout(customer.id, {
      organization: fashion.slug, idempotencyKey: randomUUID(), type: "PICK_UP", paymentMethod: "INOTI_USSD",
    }), /Selected payment method is not available/);

    const product = await db.product.create({ data: {
      name: `[R4-SYNTHETIC] checkout test ${suffix}`, slug: `r4-checkout-${suffix}`,
      basePrice: 700000, organizationId: fashion.id, organizationSlug: fashion.slug,
      categoryId: category.id, isActive: true, trackInventory: true,
    } });
    productId = product.id;
    const variant = await db.productVariant.create({ data: {
      productId, name: "Test variant", sku: `R4-IT-${suffix}`, price: 680000, inventory: 20,
      reservedQuantity: 0, allowBackOrder: false,
    } });
    variantId = variant.id;

    async function addCoupon(input: { code: string; discountType: "PERCENTAGE" | "FIXED_AMOUNT"; discountValue: number; usageLimit?: number; perCustomerLimit?: number; maxDiscountAmount?: number; minOrderTotal?: number }, organizationId = fashion.id) {
      const created = await db.coupon.create({ data: { organizationId, name: `R4 integration ${suffix}`, ...input } });
      couponIds.push(created.id);
      return created;
    }
    const pct = await addCoupon({ code: `R4P-${codeSuffix}`, discountType: "PERCENTAGE", discountValue: 10, minOrderTotal: 500000, maxDiscountAmount: 20000, usageLimit: 10, perCustomerLimit: 1 });
    const fixed = await addCoupon({ code: `R4F-${codeSuffix}`, discountType: "FIXED_AMOUNT", discountValue: 50000 });
    const capped = await addCoupon({ code: `R4L-${codeSuffix}`, discountType: "FIXED_AMOUNT", discountValue: 1000, usageLimit: 1, perCustomerLimit: 10 });

    async function checkoutOrder(options: { organization?: string; couponCode?: string; paymentMethod?: "BANK_TRANSFER" | "CASH"; cashMode?: "COUNTER"; customerId?: string } = {}) {
      const organization = options.organization ?? fashion.slug;
      const buyerId = options.customerId ?? customer.id;
      const key = randomUUID();
      idempotencyKeys.push(key);
      const organizationId = organization === fashion.slug ? fashion.id : mobile.id;
      const cart = await db.shopCart.upsert({
        where: { organizationSlug_customerId: { organizationSlug: organization, customerId: buyerId } },
        create: { organizationSlug: organization, customerId: buyerId }, update: { status: "ACTIVE" },
      });
      cartIds.add(cart.id);
      await db.shopCartItem.deleteMany({ where: { cartId: cart.id } });
      if (organizationId === fashion.id) await db.shopCartItem.create({ data: { cartId: cart.id, variantId, quantity: 1 } });
      else {
        const mobileVariant = await db.productVariant.findFirstOrThrow({ where: { sku: "R4-SYN-NOVA-256-BL", product: { organizationId: mobile.id } } });
        await db.shopCartItem.create({ data: { cartId: cart.id, variantId: mobileVariant.id, quantity: 1 } });
      }
      const result = await checkout.createRetailCheckout(buyerId, {
        organization, idempotencyKey: key, type: "PICK_UP", paymentMethod: options.paymentMethod ?? "BANK_TRANSFER",
        ...(options.couponCode ? { couponCode: options.couponCode } : {}), ...(options.cashMode ? { cashMode: options.cashMode } : {}),
      });
      const order = await db.order.findFirstOrThrow({ where: { retailCheckoutKey: key, organizationSlug: organization } });
      orderIds.push(order.id);
      return { result, order };
    }

    // Percentage cap, variant price snapshot, inventory decrement, and idempotent replay.
    const beforeStock = (await db.productVariant.findUniqueOrThrow({ where: { id: variantId } })).inventory;
    const pctOrder = await checkoutOrder({ couponCode: pct.code });
    assert.equal(pctOrder.order.subtotal.toString(), "680000");
    assert.equal(pctOrder.order.discount.toString(), "20000");
    assert.equal(pctOrder.order.total.toString(), "660000");
    const bankPayment = await db.payment.findUniqueOrThrow({ where: { orderId: pctOrder.order.id } });
    assert.equal((bankPayment.metadata as { retailR4: { bankCardNumber: string } }).retailR4.bankCardNumber, "6037990000000000",
      "checkout must snapshot the merchant card details presented for this order");
    const line = await db.orderItem.findFirstOrThrow({ where: { orderId: pctOrder.order.id, variantId } });
    assert.equal(line.price.toString(), "680000");
    assert.equal((await db.productVariant.findUniqueOrThrow({ where: { id: variantId } })).inventory, beforeStock - 1);
    await db.productVariant.update({ where: { id: variantId }, data: { price: 999000 } });
    assert.equal((await db.orderItem.findFirstOrThrow({ where: { orderId: pctOrder.order.id, variantId } })).price.toString(), "680000");
    const replay = await checkout.createRetailCheckout(customer.id, { organization: fashion.slug, idempotencyKey: idempotencyKeys.at(-1)!, type: "PICK_UP", paymentMethod: "BANK_TRANSFER", couponCode: pct.code });
    assert.equal(replay.orderNumber, pctOrder.order.orderNumber);
    assert.equal((await db.productVariant.findUniqueOrThrow({ where: { id: variantId } })).inventory, beforeStock - 1);
    await assert.rejects(() => checkoutOrder({ couponCode: pct.code }), /Customer discount limit/);
    assert.equal((await db.coupon.findUniqueOrThrow({ where: { id: pct.id } })).usedCount, 1);

    // Fixed amount discount and tenant isolation: a fashion coupon cannot be redeemed in Mobile.
    await db.productVariant.update({ where: { id: variantId }, data: { price: 680000 } });
    const fixedOrder = await checkoutOrder({ couponCode: fixed.code });
    assert.equal(fixedOrder.order.discount.toString(), "50000");
    await db.product.update({ where: { id: productId }, data: { discountType: "percentage", discountValue: 10 } });
    const discountedProduct = await catalog.getPublicCatalogProduct(fashion.slug, product.slug);
    assert.equal(discountedProduct.variants[0]?.price.amount, 612000);
    const discountedListing = await catalog.listPublicCatalogProducts({
      organizationIdentifier: fashion.slug, page: 1, limit: 10, minPrice: 610000, maxPrice: 620000,
    });
    assert.ok(discountedListing.products.some((item) => item.id === productId));
    const productDiscountOrder = await checkoutOrder();
    assert.equal(productDiscountOrder.order.subtotal.toString(), "612000");
    assert.equal((await db.orderItem.findFirstOrThrow({ where: { orderId: productDiscountOrder.order.id } })).price.toString(), "612000");
    await db.product.update({ where: { id: productId }, data: { discountType: "none", discountValue: 0 } });
    await assert.rejects(() => checkoutOrder({ organization: mobile.slug, couponCode: fixed.code }), /Discount code was not found/);
    await checkoutOrder({ couponCode: capped.code });
    await assert.rejects(() => checkoutOrder({ couponCode: capped.code }), /Discount usage limit reached/);
    assert.equal((await db.coupon.findUniqueOrThrow({ where: { id: capped.id } })).usedCount, 1);

    // Bank time report keeps normalized client context; merchant rejection leaves payment pending.
    const timed = await checkoutOrder();
    const reportedAt = new Date(Date.now() - 60_000);
    const timeReport = await reports.submitBankTimeReport({ organizationSlug: fashion.slug, orderNumber: timed.order.orderNumber,
      customerId: customer.id, reportedAt: reportedAt.toISOString(), submittedLocalTime: "synthetic local time" });
    const rejected = await reports.reviewRetailPaymentReport({ organizationId: fashion.id, actorUserId: manager.id,
      reportId: timeReport.id, action: "REJECT", reason: "synthetic rejection case" });
    assert.equal(rejected.status, "REJECTED");
    const storedTimeReport = await db.retailPaymentReport.findUniqueOrThrow({ where: { id: timeReport.id } });
    assert.equal(storedTimeReport.reportedAt?.toISOString(), reportedAt.toISOString());
    assert.equal((storedTimeReport.submittedContext as { submittedLocalTime: string }).submittedLocalTime, "synthetic local time");
    assert.equal((await db.order.findUniqueOrThrow({ where: { id: timed.order.id } })).paymentStatus, "PENDING");

    // Private synthetic PNG receipt can be retrieved only through the merchant report contract, then approved.
    const receiptOrder = await checkoutOrder();
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/SioAAAAASUVORK5CYII=", "base64");
    const receiptReport = await reports.submitBankReceiptReport({ organizationSlug: fashion.slug, orderNumber: receiptOrder.order.orderNumber,
      customerId: customer.id, buffer: png, mimeType: "image/png" });
    const receiptKey = await reports.getRetailReceiptForMerchant(fashion.id, receiptReport.id);
    receiptKeys.push(receiptKey);
    const readReceipt = await receiptStorage.readRetailReceipt(receiptKey);
    assert.equal(readReceipt.contentType, "image/png");
    assert.deepEqual(readReceipt.buffer, png);
    const approved = await reports.reviewRetailPaymentReport({ organizationId: fashion.id, actorUserId: manager.id,
      reportId: receiptReport.id, action: "APPROVE" });
    assert.equal(approved.status, "APPROVED");
    assert.equal((await db.order.findUniqueOrThrow({ where: { id: receiptOrder.order.id } })).paymentStatus, "COMPLETED");

    // Counter cash can be confirmed by the merchant and settles the payment.
    const cashOrder = await checkoutOrder({ paymentMethod: "CASH", cashMode: "COUNTER" });
    const cashResult = await cash.confirmRetailCashCollection({ organizationId: fashion.id,
      orderNumber: cashOrder.order.orderNumber, actorUserId: manager.id });
    assert.equal(cashResult.paymentStatus, "COMPLETED");
    assert.equal((await db.retailPaymentReport.findUniqueOrThrow({ where: { id: cashResult.reportId } })).status, "APPROVED");
    assert.equal((await db.payment.findUniqueOrThrow({ where: { orderId: cashOrder.order.id } })).status, "COMPLETED");

    // Concurrent buyers share the same coupon row and the same final unit of
    // stock. Exactly one checkout may commit; a losing transaction must not
    // oversell or increment the coupon count.
    const secondary = await db.user.create({ data: {
      email: `r4-concurrency-${suffix}@example.test`, name: "R4 synthetic concurrent buyer", role: "CUSTOMER", isActive: true,
      password: customer.password,
    } });
    secondaryCustomerId = secondary.id;
    await db.productVariant.update({ where: { id: variantId }, data: { inventory: 1 } });
    const singleUse = await addCoupon({ code: `R4C-${codeSuffix}`, discountType: "FIXED_AMOUNT", discountValue: 1000, usageLimit: 1 });
    const races = await Promise.allSettled([
      checkoutOrder({ couponCode: singleUse.code }),
      checkoutOrder({ couponCode: singleUse.code, customerId: secondary.id }),
    ]);
    assert.equal(races.filter((result) => result.status === "fulfilled").length, 1);
    assert.equal(races.filter((result) => result.status === "rejected").length, 1);
    assert.equal((await db.coupon.findUniqueOrThrow({ where: { id: singleUse.id } })).usedCount, 1);
    assert.equal((await db.productVariant.findUniqueOrThrow({ where: { id: variantId } })).inventory, 0);
  } finally {
    if (orderIds.length) {
      const reportsToClean = await db.retailPaymentReport.findMany({ where: { orderId: { in: orderIds } }, select: { receiptKey: true } });
      for (const item of reportsToClean) if (item.receiptKey && !receiptKeys.includes(item.receiptKey)) receiptKeys.push(item.receiptKey);
      await db.retailPaymentReport.deleteMany({ where: { orderId: { in: orderIds } } });
      await db.paymentEvent.deleteMany({ where: { orderId: { in: orderIds } } });
      await db.orderStatusHistory.deleteMany({ where: { orderId: { in: orderIds } } });
      await db.inventoryMovement.deleteMany({ where: { orderId: { in: orderIds } } });
      await db.payment.deleteMany({ where: { orderId: { in: orderIds } } });
      await db.couponRedemption.deleteMany({ where: { orderId: { in: orderIds } } });
      await db.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
      await db.order.deleteMany({ where: { id: { in: orderIds } } });
    }
    if (couponIds.length) await db.coupon.deleteMany({ where: { id: { in: couponIds } } });
    if (cartIds.size) await db.shopCartItem.deleteMany({ where: { cartId: { in: [...cartIds] } } });
    if (cartIds.size) await db.shopCart.deleteMany({ where: { id: { in: [...cartIds] } } });
    if (productId) await db.productVariant.deleteMany({ where: { productId } });
    if (productId) await db.product.deleteMany({ where: { id: productId } });
    if (secondaryCustomerId) await db.user.delete({ where: { id: secondaryCustomerId } });
    for (const key of receiptKeys) await receiptStorage.removeRetailReceipt(key).catch(() => undefined);
    await db.$disconnect();
    await rm(testRoot, { recursive: true, force: true });
  }
});
