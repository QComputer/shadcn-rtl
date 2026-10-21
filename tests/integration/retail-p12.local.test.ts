import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mock, test } from "node:test";

const enabled = process.env.RETAIL_P12_PG_ACCEPTANCE === "1";

function assertGuardedDatabase() {
  assert.equal(process.env.DATABASE_URL, process.env.DIRECT_URL, "runtime and direct URLs must match");
  for (const key of ["DATABASE_URL", "DIRECT_URL"]) {
    const url = new URL(process.env[key] ?? "");
    assert.equal(url.protocol, "postgresql:");
    assert.equal(url.hostname, "127.0.0.1");
    assert.equal(url.port, "54713");
    assert.equal(url.pathname, "/retail_p0_20261019");
    assert.match(decodeURIComponent(url.username), /^consol_[a-f0-9]+$/);
  }
}

test("Retail P1.2 quote, snapshot, tenant recovery, rollback, and overlapping stock contention", {
  skip: !enabled,
  concurrency: false,
}, async () => {
  assertGuardedDatabase();
  mock.module("next/cache", { namedExports: { revalidatePath: () => undefined, revalidateTag: () => undefined } });
  const [{ PrismaClient }, checkout, quoteModule, cartModule] = await Promise.all([
    import("@prisma/client"), import("@/lib/retail/checkout.server"), import("@/lib/retail/checkout-quote.server"), import("@/lib/services/cart.service"),
  ]);
  const db = new PrismaClient({ log: ["error"] });
  const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
  const slug = `retail-p12-${suffix}`;
  const otherSlug = `retail-p12-x-${suffix}`;
  const users: string[] = [];
  const orgs: string[] = [];
  const productIds: string[] = [];
  const cartIds: string[] = [];
  const orderIds: string[] = [];
  const couponIds: string[] = [];
  const imageIds: string[] = [];

  try {
    const identity = await db.$queryRaw<Array<{ database: string; username: string; version_num: number }>>`
      SELECT current_database() AS database, current_user AS username, current_setting('server_version_num')::int AS version_num`;
    assert.equal(identity[0]?.database, "retail_p0_20261019");
    assert.match(identity[0]?.username ?? "", /^consol_[a-f0-9]+$/);
    assert.ok(identity[0]!.version_num >= 160000 && identity[0]!.version_num < 170000, "expected PostgreSQL 16");

    const [org, otherOrg] = await Promise.all([
      db.organization.create({ data: { type: "SHOP", name: `P1.2 ${suffix}`, slug, capabilitiesInitializedAt: new Date() } }),
      db.organization.create({ data: { type: "SHOP", name: `P1.2 foreign ${suffix}`, slug: otherSlug, capabilitiesInitializedAt: new Date() } }),
    ]);
    orgs.push(org.id, otherOrg.id);
    await db.organizationCapability.createMany({ data: orgs.map((organizationId) => ({ organizationId, key: "SHOP" as const, status: "ACTIVE" as const, enabledAt: new Date() })) });
    const [a, b, c] = await Promise.all(["a", "b", "c"].map((label) => db.user.create({
      data: { name: `retail-p12-${label}-${suffix}`, email: `retail-p12-${label}-${suffix}@example.test`, password: "synthetic-only", role: "CUSTOMER" },
    })));
    users.push(a.id, b.id, c.id);
    const category = await db.productCategory.create({ data: { organizationId: org.id, organizationSlug: slug, name: "P1.2", slug: `p12-${suffix}` } });
    const product = await db.product.create({ data: { organizationId: org.id, organizationSlug: slug, categoryId: category.id,
      name: "P1.2 synthetic item", slug: `item-${suffix}`, image: "/legacy-p12-image.png", basePrice: 1000, trackInventory: true,
      discountType: "none", discountValue: 0 } });
    productIds.push(product.id);
    const variant = await db.productVariant.create({ data: { productId: product.id, name: "Blue / M", sku: `P12-${suffix}`, price: 1000, inventory: 5 } });
    const [ownedGalleryImage, foreignGalleryImage] = await Promise.all([
      db.image.create({ data: { organizationId: org.id, url: `https://media.example.test/p12-${suffix}-owned.webp`, purpose: "upload", access: "PUBLIC" } }),
      db.image.create({ data: { organizationId: otherOrg.id, url: `https://media.example.test/p12-${suffix}-foreign.webp`, purpose: "upload", access: "PUBLIC" } }),
    ]);
    imageIds.push(ownedGalleryImage.id, foreignGalleryImage.id);
    await db.productVariantImage.createMany({ data: [ownedGalleryImage, foreignGalleryImage].map((image, sortOrder) => ({ variantId: variant.id, imageId: image.id, sortOrder })) });
    const [definition] = await Promise.all([db.retailAttributeDefinition.create({ data: {
      organizationId: org.id, key: `size_${suffix}`, label: "Size", localizedLabels: {}, scope: "VARIANT_OPTION", valueType: "TEXT", isActive: true,
    } })]);
    await db.productVariantAttributeValue.create({ data: { variantId: variant.id, definitionId: definition.id, valueText: "M" } });
    await db.organizationSettings.create({ data: { organizationSlug: slug, enablePickup: true, enableDelivery: true, deliveryFee: 125 } });
    const cashSettings = { retailR4: { bankTransferEnabled: true, cashEnabled: true, inotiUssdEnabled: false,
      bankCardNumber: "6037990000000000", bankAccountOwner: "Synthetic Account", cashModes: ["COUNTER", "PICKUP", "COURIER"], cashBeforeConfirmation: false,
      paymentDeadlinesMinutes: { bankTransfer: 1440, cash: 1440, inotiUssd: 15 } } };
    await db.paymentSettings.create({ data: { organizationSlug: slug, settings: cashSettings } });

    const addCart = async (customerId: string, quantity = 1) => {
      const cart = await db.shopCart.upsert({ where: { organizationSlug_customerId: { organizationSlug: slug, customerId } },
        update: { status: "ACTIVE" }, create: { organizationSlug: slug, customerId } });
      if (!cartIds.includes(cart.id)) cartIds.push(cart.id);
      await db.shopCartItem.create({ data: { cartId: cart.id, variantId: variant.id, quantity } });
      return cart;
    };
    const input = (key: string, type: "PICK_UP" | "DELIVERY" = "PICK_UP", additions = {}) => ({
      organization: slug, idempotencyKey: key, type, paymentMethod: "CASH" as const, cashMode: type === "PICK_UP" ? "COUNTER" as const : "COURIER" as const, ...additions,
    });
    const quoteInput = (type: "PICK_UP" | "DELIVERY" = "PICK_UP", additions = {}) => ({
      organization: slug, type, paymentMethod: "CASH" as const, cashMode: type === "PICK_UP" ? "COUNTER" as const : "COURIER" as const,
      ...(type === "DELIVERY" ? { deliveryAddress: "123 Synthetic Street" } : {}), ...additions,
    });

    // Quote values, coupon refusal, and stale-price rejection all read the same fixture.
    await addCart(a.id, 2);
    const normalizedCart = await cartModule.cartService.getCart(slug, a.id, null);
    const projectedVariant = normalizedCart!.items[0]!.variant as Record<string, unknown>;
    assert.equal(Object.prototype.hasOwnProperty.call(projectedVariant, "galleryImages"), false, "cart API must not leak raw image relations");
    assert.deepEqual((projectedVariant.media as { gallery: string[] }).gallery, [ownedGalleryImage.url], "only the cart tenant's public gallery image is projected");
    assert.equal((projectedVariant.product as { image: string | null }).image, "/legacy-p12-image.png", "legacy scalar image remains available to the old cart drawer");
    const coupon = await db.coupon.create({ data: { organizationId: org.id, code: `P12-${suffix}`.toUpperCase(),
      name: "Synthetic", discountType: "PERCENTAGE", discountValue: 10, usageLimit: 1, perCustomerLimit: 1 } });
    couponIds.push(coupon.id);
    const quote = await quoteModule.createRetailCheckoutQuote(a.id, quoteInput("DELIVERY", { couponCode: coupon.code }));
    assert.equal(quote.quote.subtotal, 2000);
    assert.equal(quote.quote.deliveryFee, 125);
    assert.equal(quote.quote.discount, 200, JSON.stringify({ discount: quote.quote.discount, issues: quote.quote.issues }));
    assert.equal(quote.quote.total, 1925);
    assert.equal(quote.quote.fulfillment.find((entry: { type: string }) => entry.type === "DELIVERY")?.fee, 125);
    assert.deepEqual(quote.quote.items.map((item: { unitPrice: number; quantity: number }) => [item.unitPrice, item.quantity]), [[1000, 2]]);

    const badCoupon = await quoteModule.createRetailCheckoutQuote(a.id, quoteInput("PICK_UP", { couponCode: "MISSING" }));
    assert.equal(badCoupon.quote.discount, 0, "unavailable coupons must not be presented as a discount");
    assert.ok(badCoupon.quote.issues.length);
    const initialPickup = await quoteModule.createRetailCheckoutQuote(a.id, quoteInput("PICK_UP"));
    assert.ok(initialPickup.quote.fulfillment.some((entry: { type: string }) => entry.type === "DELIVERY"));
    await db.organizationSettings.update({ where: { organizationSlug: slug }, data: { enablePickup: false } });
    const disabledPickup = await quoteModule.createRetailCheckoutQuote(a.id, quoteInput("PICK_UP"));
    assert.ok(disabledPickup.quote.issues.length, "disabled initial pickup returns an actionable quote issue");
    assert.ok(disabledPickup.quote.fulfillment.some((entry: { type: string }) => entry.type === "DELIVERY"));
    await assert.rejects(() => checkout.createRetailCheckout(a.id, input(randomUUID())), /pickup.*unavailable/i);
    await db.organizationSettings.update({ where: { organizationSlug: slug }, data: { enablePickup: true, deliveryFee: null } });
    const missingFee = await quoteModule.createRetailCheckoutQuote(a.id, quoteInput("DELIVERY"));
    assert.ok(missingFee.quote.issues.some((issue: string) => /fee/i.test(issue)));
    assert.equal(missingFee.quote.fulfillment.some((entry: { type: string }) => entry.type === "DELIVERY"), false);
    await assert.rejects(() => checkout.createRetailCheckout(a.id, input(randomUUID(), "DELIVERY")), /delivery fee/i);
    await db.organizationSettings.update({ where: { organizationSlug: slug }, data: { deliveryFee: 125 } });

    // Payment selection is part of the reviewed facts. Both cash modes are
    // enabled, so a valid mode change still requires a fresh review token.
    await addCart(b.id);
    const counterQuote = await quoteModule.createRetailCheckoutQuote(b.id, quoteInput("PICK_UP"));
    const changedModeKey = randomUUID();
    await assert.rejects(() => checkout.createRetailCheckout(b.id, { ...input(changedModeKey), cashMode: "PICKUP", reviewToken: counterQuote.quote.reviewToken }), /changed|review/i);
    const pickupModeQuote = await quoteModule.createRetailCheckoutQuote(b.id, quoteInput("PICK_UP", { cashMode: "PICKUP" }));
    assert.notEqual(counterQuote.quote.reviewToken, pickupModeQuote.quote.reviewToken);
    const changedModeOrder = await checkout.createRetailCheckout(b.id, { ...input(changedModeKey), cashMode: "PICKUP", reviewToken: pickupModeQuote.quote.reviewToken });
    orderIds.push(changedModeOrder.id);

    await addCart(c.id);
    const cashQuote = await quoteModule.createRetailCheckoutQuote(c.id, quoteInput("PICK_UP"));
    const changedPaymentKey = randomUUID();
    const bankCheckoutInput = { organization: slug, idempotencyKey: changedPaymentKey, type: "PICK_UP" as const, paymentMethod: "BANK_TRANSFER" as const };
    await assert.rejects(() => checkout.createRetailCheckout(c.id, { ...bankCheckoutInput, reviewToken: cashQuote.quote.reviewToken }), /changed|review/i);
    const bankQuote = await quoteModule.createRetailCheckoutQuote(c.id, quoteInput("PICK_UP", { paymentMethod: "BANK_TRANSFER", cashMode: undefined }));
    assert.notEqual(cashQuote.quote.reviewToken, bankQuote.quote.reviewToken);
    const bankOrder = await checkout.createRetailCheckout(c.id, { ...bankCheckoutInput, reviewToken: bankQuote.quote.reviewToken });
    orderIds.push(bankOrder.id);

    const staleKey = randomUUID();
    const staleReview = await quoteModule.createRetailCheckoutQuote(a.id, quoteInput("PICK_UP", { couponCode: coupon.code }));
    await db.productVariant.update({ where: { id: variant.id }, data: { price: 1100 } });
    await assert.rejects(() => checkout.createRetailCheckout(a.id, { ...input(staleKey), couponCode: coupon.code, reviewToken: staleReview.quote.reviewToken }), /changed|review/i);
    assert.equal(await db.order.count({ where: { retailCheckoutKey: staleKey } }), 0, "stale review rejection creates no order");
    assert.equal((await db.coupon.findUniqueOrThrow({ where: { id: coupon.id } })).usedCount, 0, "stale review rejection does not consume coupon");
    const freshQuote = await quoteModule.createRetailCheckoutQuote(a.id, quoteInput("PICK_UP", { couponCode: coupon.code }));
    const successKey = randomUUID();
    const created = await checkout.createRetailCheckout(a.id, { ...input(successKey), couponCode: coupon.code, reviewToken: freshQuote.quote.reviewToken });
    orderIds.push(created.id);
    const saved = await db.order.findUniqueOrThrow({ where: { id: created.id }, include: { items: true } });
    assert.equal(saved.subtotal.toNumber(), 2200);
    assert.equal(saved.discount.toNumber(), 220);
    assert.equal(saved.items[0]?.variantNameSnapshot, "Blue / M");
    assert.deepEqual(saved.items[0]?.variantOptionsSnapshot, [{ key: definition.key, label: "Size", value: "M", displayUnit: null }]);
    assert.equal((await checkout.findRetailCheckoutRecovery(a.id, slug, successKey))?.orderNumber, saved.orderNumber);
    assert.equal(await checkout.findRetailCheckoutRecovery(b.id, slug, successKey), null, "another customer cannot recover this order");
    assert.equal(await checkout.findRetailCheckoutRecovery(a.id, otherSlug, successKey), null, "another tenant cannot recover this order");
    assert.equal((await checkout.createRetailCheckout(a.id, { ...input(successKey), couponCode: coupon.code })).id, created.id, "same customer retry replays the original order");

    // Prove observable overlap: hold the inventory row lock, start both checkout
    // calls, and wait until PostgreSQL reports blocked ProductVariant updates.
    await db.productVariant.update({ where: { id: variant.id }, data: { inventory: 1 } });
    await addCart(b.id);
    await addCart(c.id);
    let releaseLock!: () => void;
    let lockAcquired!: () => void;
    let lockerPid = 0;
    const acquired = new Promise<void>((resolve) => { lockAcquired = resolve; });
    const release = new Promise<void>((resolve) => { releaseLock = resolve; });
    const locker = db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "ProductVariant" WHERE "id" = ${variant.id} FOR UPDATE`;
      const pid = await tx.$queryRaw<Array<{ pid: number }>>`SELECT pg_backend_pid() AS pid`;
      lockerPid = pid[0]!.pid;
      lockAcquired();
      await release;
    }, { timeout: 15_000 });
    await acquired;
    const raceKeys = [randomUUID(), randomUUID()];
    const outcomesPromise = Promise.allSettled([checkout.createRetailCheckout(b.id, input(raceKeys[0]!)), checkout.createRetailCheckout(c.id, input(raceKeys[1]!))]);
    const deadline = Date.now() + 5000;
    let blockedWriters = 0;
    while (Date.now() < deadline) {
      const blocked = await db.$queryRaw<Array<{ count: bigint }>>`
        SELECT count(*)::bigint AS count FROM pg_stat_activity activity
        WHERE activity.datname = current_database() AND activity.wait_event_type = 'Lock'
          AND ${lockerPid} = ANY(pg_blocking_pids(activity.pid))`;
      blockedWriters = Number(blocked[0]?.count ?? 0);
      if (blockedWriters >= 2) break;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    assert.ok(blockedWriters >= 2, `expected two overlapping blocked stock writers, saw ${blockedWriters}`);
    releaseLock();
    await locker;
    const outcomes = await outcomesPromise;
    assert.equal(outcomes.filter((result) => result.status === "fulfilled").length, 1, "only one buyer can purchase the final unit");
    const raceOrders = await db.order.findMany({ where: { retailCheckoutKey: { in: raceKeys } }, select: { id: true } });
    orderIds.push(...raceOrders.map((order) => order.id));
    assert.equal(raceOrders.length, 1);
    assert.equal((await db.productVariant.findUniqueOrThrow({ where: { id: variant.id } })).inventory, 0);

    // A backorder remains orderable at zero inventory and does not decrement stock.
    await db.productVariant.update({ where: { id: variant.id }, data: { allowBackOrder: true } });
    await addCart(a.id);
    const backorderKey = randomUUID();
    const backorder = await checkout.createRetailCheckout(a.id, input(backorderKey));
    orderIds.push(backorder.id);
    assert.equal((await db.productVariant.findUniqueOrThrow({ where: { id: variant.id } })).inventory, -1, "backorder ledger preserves the full outstanding inventory quantity");
    assert.equal(await db.inventoryMovement.count({ where: { orderId: backorder.id, quantityDelta: -1 } }), 1, "backorder ledger records the full outstanding quantity");
  } finally {
    if (orderIds.length) {
      await db.couponRedemption.deleteMany({ where: { orderId: { in: orderIds } } });
      await db.paymentEvent.deleteMany({ where: { orderId: { in: orderIds } } });
      await db.orderStatusHistory.deleteMany({ where: { orderId: { in: orderIds } } });
      await db.inventoryMovement.deleteMany({ where: { orderId: { in: orderIds } } });
      await db.payment.deleteMany({ where: { orderId: { in: orderIds } } });
      await db.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
      await db.order.deleteMany({ where: { id: { in: orderIds } } });
    }
    await db.couponRedemption.deleteMany({ where: { couponId: { in: couponIds } } });
    await db.coupon.deleteMany({ where: { id: { in: couponIds } } });
    if (cartIds.length) {
      await db.shopCartItem.deleteMany({ where: { cartId: { in: cartIds } } });
      await db.shopCart.deleteMany({ where: { id: { in: cartIds } } });
    }
    if (productIds.length) await db.product.deleteMany({ where: { id: { in: productIds } } });
    if (imageIds.length) await db.image.deleteMany({ where: { id: { in: imageIds } } });
    if (users.length) await db.user.deleteMany({ where: { id: { in: users } } });
    if (orgs.length) {
      await db.organizationSettings.deleteMany({ where: { organizationSlug: { in: [slug, otherSlug] } } });
      await db.paymentSettings.deleteMany({ where: { organizationSlug: { in: [slug, otherSlug] } } });
      await db.organizationCapability.deleteMany({ where: { organizationId: { in: orgs } } });
      await db.productCategory.deleteMany({ where: { organizationId: { in: orgs } } });
      await db.organization.deleteMany({ where: { id: { in: orgs } } });
    }
    await db.$disconnect();
  }
});
