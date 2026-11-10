import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { assertRetailRecoveryEnvironment } from "../e2e/retail-recovery/safety.mjs";

// Fail closed before loading the server-side checkout services or connecting Prisma.
const target = assertRetailRecoveryEnvironment();

test("Retail recovery rejects a checkout quote after cart quantity changes", { concurrency: false }, async () => {
  const [{ PrismaClient }, { prisma }, quoteModule, checkoutModule] = await Promise.all([
    import("@prisma/client"),
    import("@/lib/db"),
    import("@/lib/retail/checkout-quote.server"),
    import("@/lib/retail/checkout.server"),
  ]);
  const db = new PrismaClient({ log: ["error"] });
  const stamp = process.env.E2E_STAMP;
  assert.ok(stamp, "retail recovery fixture stamp is required");
  const organizationSlug = `retail-e2e-${stamp}`;
  const checkoutKey = randomUUID();
  const couponCode = `RECOVERY-${randomUUID().replaceAll("-", "").slice(0, 12)}`.toUpperCase();
  let cartId: string | undefined;
  let couponId: string | undefined;
  let orderId: string | undefined;
  let paymentSettingsCreated = false;
  let variant: { id: string; inventory: number } | undefined;

  try {
    const identity = await db.$queryRaw<Array<{ db: string }>>`SELECT current_database()::text AS db`;
    assert.equal(identity[0]?.db, target.databaseName, "Connected test database identity mismatch.");
    const customer = await db.user.findFirstOrThrow({ where: { name: `customer-e2e-${stamp}` }, select: { id: true } });
    const product = await db.product.findFirstOrThrow({ where: { slug: `pub-shoe-${stamp}`, organizationSlug }, select: { id: true } });
    const fixtureVariant = await db.productVariant.findFirstOrThrow({ where: { productId: product.id, sku: `PUB-BLK-40-${stamp}` }, select: { id: true, inventory: true } });
    variant = fixtureVariant;
    const settings = await db.paymentSettings.findUnique({ where: { organizationSlug } });
    assert.equal(settings, null, "recovery seed must not contain payment settings");
    await db.paymentSettings.create({ data: {
      organizationSlug,
      settings: { retailR4: {
        bankTransferEnabled: false, cashEnabled: true, inotiUssdEnabled: false,
        bankCardNumber: null, bankAccountOwner: null, cashModes: ["COUNTER"], cashBeforeConfirmation: false,
        paymentDeadlinesMinutes: { bankTransfer: 1440, cash: 1440, inotiUssd: 15 },
      } },
    } });
    paymentSettingsCreated = true;

    const cart = await db.shopCart.create({ data: { organizationSlug, customerId: customer.id, status: "ACTIVE" } });
    cartId = cart.id;
    const item = await db.shopCartItem.create({ data: { cartId: cart.id, variantId: fixtureVariant.id, quantity: 2 } });
    const coupon = await db.coupon.create({ data: {
      organizationId: (await db.organization.findUniqueOrThrow({ where: { slug: organizationSlug }, select: { id: true } })).id,
      code: couponCode, name: "Disposable stale quote", discountType: "PERCENTAGE", discountValue: 10,
      usageLimit: 1, perCustomerLimit: 1,
    } });
    couponId = coupon.id;

    const quoteInput = { organization: organizationSlug, type: "PICK_UP" as const, paymentMethod: "CASH" as const,
      cashMode: "COUNTER" as const, couponCode };
    const original = await quoteModule.createRetailCheckoutQuote(customer.id, quoteInput);
    assert.deepEqual(original.quote.issues, [], "initial disposable quote must be orderable");
    assert.deepEqual(original.quote.items.map((line: { quantity: number }) => line.quantity), [2]);
    await db.shopCartItem.update({ where: { id: item.id }, data: { quantity: 1 } });

    let rejection: unknown;
    try {
      await checkoutModule.createRetailCheckout(customer.id, {
        ...quoteInput, idempotencyKey: checkoutKey, reviewToken: original.quote.reviewToken,
      });
    } catch (error) {
      rejection = error;
    }
    assert.ok(rejection instanceof Error, "stale quote must be rejected");
    assert.equal((rejection as Error & { status?: number }).status, 409);
    assert.match((rejection as Error).message, /details changed|review/i);

    assert.equal(await db.order.count({ where: { retailCheckoutKey: checkoutKey } }), 0, "stale quote creates no order");
    assert.equal((await db.coupon.findUniqueOrThrow({ where: { id: coupon.id } })).usedCount, 0, "stale quote consumes no coupon use");
    assert.equal(await db.couponRedemption.count({ where: { couponId: coupon.id } }), 0, "stale quote creates no coupon redemption");
    assert.equal((await db.productVariant.findUniqueOrThrow({ where: { id: fixtureVariant.id } })).inventory, fixtureVariant.inventory,
      "stale quote does not decrement stock");

    const fresh = await quoteModule.createRetailCheckoutQuote(customer.id, quoteInput);
    assert.deepEqual(fresh.quote.issues, [], "fresh disposable quote must be orderable");
    assert.notEqual(fresh.quote.reviewToken, original.quote.reviewToken);
    assert.deepEqual(fresh.quote.items.map((line: { quantity: number }) => line.quantity), [1]);
    assert.equal(fresh.quote.subtotal, 500000);

    const checkoutInput = { ...quoteInput, idempotencyKey: checkoutKey, reviewToken: fresh.quote.reviewToken };
    const created = await checkoutModule.createRetailCheckout(customer.id, checkoutInput);
    orderId = created.id;
    assert.equal(created.total.toNumber(), 450000, "fresh quote applies the coupon to the updated quantity");
    const saved = await db.order.findUniqueOrThrow({ where: { id: created.id }, include: { items: true } });
    assert.equal(saved.items.length, 1);
    assert.equal(saved.items[0]?.quantity, 1, "order snapshot stores the reviewed quantity");
    assert.equal(saved.items[0]?.price.toNumber(), 500000);
    assert.equal((await db.productVariant.findUniqueOrThrow({ where: { id: fixtureVariant.id } })).inventory, fixtureVariant.inventory - 1,
      "successful checkout decrements stock once");
    assert.equal((await db.coupon.findUniqueOrThrow({ where: { id: coupon.id } })).usedCount, 1);
    assert.equal(await db.couponRedemption.count({ where: { couponId: coupon.id, orderId: created.id } }), 1);

    const replay = await checkoutModule.createRetailCheckout(customer.id, checkoutInput);
    assert.equal(replay.id, created.id, "same idempotency key replays the existing order");
    assert.equal(await db.order.count({ where: { retailCheckoutKey: checkoutKey } }), 1);
    assert.equal((await db.productVariant.findUniqueOrThrow({ where: { id: fixtureVariant.id } })).inventory, fixtureVariant.inventory - 1,
      "idempotent retry does not decrement stock twice");
    assert.equal((await db.coupon.findUniqueOrThrow({ where: { id: coupon.id } })).usedCount, 1,
      "idempotent retry does not consume coupon twice");
  } finally {
    try {
      if (orderId) {
        if (variant) await db.productVariant.update({ where: { id: variant.id }, data: { inventory: variant.inventory } });
        await db.couponRedemption.deleteMany({ where: { orderId } });
        await db.paymentEvent.deleteMany({ where: { orderId } });
        await db.orderStatusHistory.deleteMany({ where: { orderId } });
        await db.inventoryMovement.deleteMany({ where: { orderId } });
        await db.payment.deleteMany({ where: { orderId } });
        await db.orderItem.deleteMany({ where: { orderId } });
        await db.order.deleteMany({ where: { id: orderId } });
      }
      if (couponId) {
        await db.couponRedemption.deleteMany({ where: { couponId } });
        await db.coupon.deleteMany({ where: { id: couponId } });
      }
      if (cartId) {
        await db.shopCartItem.deleteMany({ where: { cartId } });
        await db.shopCart.deleteMany({ where: { id: cartId } });
      }
      if (paymentSettingsCreated) await db.paymentSettings.deleteMany({ where: { organizationSlug } });
    } finally {
      await Promise.allSettled([db.$disconnect(), prisma.$disconnect()]);
    }
  }
});
