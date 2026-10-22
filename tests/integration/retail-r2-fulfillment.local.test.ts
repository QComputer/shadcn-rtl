import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mock, test } from "node:test";

const enabled = process.env.RETAIL_P13_ORDER_OPS_PG_ACCEPTANCE === "1";

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

test("Retail R2 fulfillment settings, quote, handover history, and owner tracking contracts", {
  skip: !enabled,
  concurrency: false,
}, async () => {
  assertGuardedDatabase();
  mock.module("next/cache", { namedExports: { revalidatePath: () => undefined, revalidateTag: () => undefined } });
  mock.module("@/lib/notifications/customer-order-lifecycle-router", { namedExports: {
    customerOrderLifecycleRouter: {
      notifyOrderStatusChangedSafe: async () => undefined,
      notifyOrderReadyTimeChangedSafe: async () => undefined,
      notifyPaymentStatusChangedSafe: async () => undefined,
    },
  } });

  const [{ PrismaClient }, settingsModule, quoteModule, checkoutModule, paymentPolicyModule, merchant, customerModule, { ApiError }] = await Promise.all([
    import("@prisma/client"),
    import("@/lib/retail/fulfillment-settings.server"),
    import("@/lib/retail/checkout-quote.server"),
    import("@/lib/retail/checkout.server"),
    import("@/lib/retail/payment-policy.server"),
    import("@/lib/retail/merchant-orders.server"),
    import("@/lib/retail/customer-order.server"),
    import("@/lib/api-guards"),
  ]);
  const db = new PrismaClient({ log: ["error"] });
  const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
  const slug = `retail-r2-fulfillment-${suffix}`;
  const foreignSlug = `retail-r2-foreign-${suffix}`;
  const organizationIds: string[] = [];
  const userIds: string[] = [];
  const categoryIds: string[] = [];
  const productIds: string[] = [];
  const variantIds: string[] = [];
  const cartIds: string[] = [];
  const orderIds: string[] = [];

  try {
    const identity = await db.$queryRaw<Array<{ database: string; username: string; version_num: number }>>`
      SELECT current_database() AS database, current_user AS username,
        current_setting('server_version_num')::int AS version_num`;
    assert.equal(identity[0]?.database, "retail_p0_20261019");
    assert.match(identity[0]?.username ?? "", /^consol_[a-f0-9]+$/);
    assert.ok(identity[0]!.version_num >= 160000 && identity[0]!.version_num < 170000);

    const [organization, foreignOrganization] = await Promise.all([
      db.organization.create({ data: { name: `Retail R2 ${suffix}`, slug, type: "SHOP", address: "12 Synthetic Lane", phone: "09120000000", capabilitiesInitializedAt: new Date() } }),
      db.organization.create({ data: { name: `Retail R2 foreign ${suffix}`, slug: foreignSlug, type: "SHOP", capabilitiesInitializedAt: new Date() } }),
    ]);
    organizationIds.push(organization.id, foreignOrganization.id);
    await db.organizationCapability.createMany({ data: organizationIds.map((organizationId) => ({
      organizationId, key: "SHOP" as const, status: "ACTIVE" as const, enabledAt: new Date(),
    })) });
    const [admin, manager, customer, otherCustomer] = await Promise.all(["admin", "manager", "customer", "other"].map((role) => db.user.create({
      data: { name: `retail-r2-${role}-${suffix}`, email: `retail-r2-${role}-${suffix}@example.test`, password: "synthetic-only", role: role === "admin" ? "ADMIN" : role === "manager" ? "MANAGER" : "CUSTOMER" },
    })));
    userIds.push(admin.id, manager.id, customer.id, otherCustomer.id);
    const context = { organizationId: organization.id, organizationSlug: slug, actorUserId: admin.id, role: "ADMIN" as const };
    const managerContext = { ...context, actorUserId: manager.id, role: "MANAGER" as const };
    const staffContext = { ...context, role: "STAFF" as const };
    const wrongSlugContext = { ...context, organizationSlug: foreignSlug };
    const wrongOrganizationContext = { ...context, organizationId: foreignOrganization.id };

    await db.organizationSettings.create({ data: { organizationSlug: slug, enablePickup: true, enableDelivery: true, deliveryFee: 300,
      settings: { unrelatedConfiguration: { keep: true }, anotherFeature: "unchanged" } } });
    await paymentPolicyModule.saveRetailPaymentPolicy(slug, organization.id, admin.id, {
      bankTransferEnabled: false, cashEnabled: true, inotiUssdEnabled: false, bankCardNumber: null, bankAccountOwner: null,
      cashModes: ["COUNTER"], cashBeforeConfirmation: true,
      paymentDeadlinesMinutes: paymentPolicyModule.defaultRetailPaymentDeadlinesMinutes,
    });

    const initial = await settingsModule.getRetailFulfillmentSettings(context);
    assert.equal(initial.settings.deliveryFee, 300);
    assert.equal(initial.settings.pickupAddress, "12 Synthetic Lane");
    assert.equal((await settingsModule.getRetailFulfillmentSettings(managerContext)).version, initial.version);
    await assert.rejects(() => settingsModule.getRetailFulfillmentSettings(staffContext),
      (error: unknown) => error instanceof ApiError && error.status === 403);
    await assert.rejects(() => settingsModule.getRetailFulfillmentSettings(wrongSlugContext),
      (error: unknown) => error instanceof ApiError && error.status === 404);
    await assert.rejects(() => settingsModule.getRetailFulfillmentSettings(wrongOrganizationContext),
      (error: unknown) => error instanceof ApiError && error.status === 404);

    const saved = await settingsModule.updateRetailFulfillmentSettings(managerContext, {
      ...initial.settings, deliveryFee: 450, pickupAddress: "12 Synthetic Lane", pickupInstructions: "Use side entrance",
      deliveryRestrictions: "No oversized parcels", fulfillmentInstructions: "Call on arrival", expectedVersion: initial.version,
    });
    assert.notEqual(saved.version, initial.version);
    assert.equal(saved.settings.deliveryFee, 450);
    const preservedJson = await db.organizationSettings.findUniqueOrThrow({ where: { organizationSlug: slug }, select: { settings: true } });
    assert.deepEqual((preservedJson.settings as Record<string, unknown>).unrelatedConfiguration, { keep: true });
    assert.equal((preservedJson.settings as Record<string, unknown>).anotherFeature, "unchanged");
    await assert.rejects(() => settingsModule.updateRetailFulfillmentSettings(context, {
      ...initial.settings, expectedVersion: initial.version,
    }), (error: unknown) => error instanceof ApiError && error.status === 409);
    const adminSaved = await settingsModule.updateRetailFulfillmentSettings(context, {
      ...saved.settings, expectedVersion: saved.version,
    });
    assert.ok(adminSaved.version);

    const category = await db.productCategory.create({ data: { name: "R2 products", slug: `r2-${suffix}`, organizationId: organization.id, organizationSlug: slug } });
    categoryIds.push(category.id);
    const product = await db.product.create({ data: { name: "R2 synthetic product", slug: `r2-item-${suffix}`, basePrice: 1000,
      organizationId: organization.id, organizationSlug: slug, categoryId: category.id, trackInventory: true, discountType: "none", discountValue: 0 } });
    productIds.push(product.id);
    const variant = await db.productVariant.create({ data: { productId: product.id, name: "R2 variant", sku: `R2-${suffix}`, price: 1000, inventory: 8 } });
    variantIds.push(variant.id);
    const cart = await db.shopCart.create({ data: { organizationSlug: slug, customerId: customer.id } });
    cartIds.push(cart.id);
    await db.shopCartItem.create({ data: { cartId: cart.id, variantId: variant.id, quantity: 1 } });
    const quoteInput = { organization: slug, type: "DELIVERY" as const, deliveryAddress: "123 Synthetic Street", paymentMethod: "CASH" as const, cashMode: "COUNTER" as const };
    const quoted = await quoteModule.createRetailCheckoutQuote(customer.id, quoteInput);
    assert.equal(quoted.quote.deliveryFee, 450);
    assert.equal(quoted.quote.fulfillmentInfo.pickupAddress, "12 Synthetic Lane");
    assert.equal(quoted.quote.fulfillmentInfo.pickupInstructions, "Use side entrance");
    assert.equal(quoted.quote.fulfillmentInfo.deliveryRestrictions, "No oversized parcels");
    assert.equal(quoted.quote.fulfillmentInfo.fulfillmentInstructions, "Call on arrival");

    const beforeFeeChangeToken = quoted.quote.reviewToken;
    const forFeeChange = await settingsModule.updateRetailFulfillmentSettings(managerContext, {
      ...adminSaved.settings, deliveryFee: 451, expectedVersion: adminSaved.version,
    });
    const feeChanged = await quoteModule.createRetailCheckoutQuote(customer.id, quoteInput);
    assert.notEqual(feeChanged.quote.reviewToken, beforeFeeChangeToken, "a changed delivery fee invalidates the reviewed quote");
    const staleCheckoutKey = randomUUID();
    await assert.rejects(() => checkoutModule.createRetailCheckout(customer.id, {
      ...quoteInput, idempotencyKey: staleCheckoutKey, reviewToken: quoted.quote.reviewToken,
    }), /changed|review/i, "actual checkout rejects a quote made before the fee change");
    assert.equal(await db.order.count({ where: { retailCheckoutKey: staleCheckoutKey } }), 0,
      "stale fulfillment quotes create no order");
    const forInstructionChange = await settingsModule.updateRetailFulfillmentSettings(context, {
      ...forFeeChange.settings, fulfillmentInstructions: "Use rear entrance", expectedVersion: forFeeChange.version,
    });
    const instructionsChanged = await quoteModule.createRetailCheckoutQuote(customer.id, quoteInput);
    assert.notEqual(instructionsChanged.quote.reviewToken, feeChanged.quote.reviewToken, "changed fulfillment instructions invalidate the reviewed quote");
    const pickupQuote = await quoteModule.createRetailCheckoutQuote(customer.id, { organization: slug, type: "PICK_UP", paymentMethod: "BANK_TRANSFER" });
    assert.equal(pickupQuote.quote.deliveryFee, 0);
    assert.ok(pickupQuote.quote.fulfillment.some((method: { type: string; fee: number }) => method.type === "PICK_UP" && method.fee === 0));

    const disabledDelivery = await settingsModule.updateRetailFulfillmentSettings(context, {
      ...forInstructionChange.settings, enableDelivery: false, expectedVersion: forInstructionChange.version,
    });
    const deliveryOffQuote = await quoteModule.createRetailCheckoutQuote(customer.id, quoteInput);
    assert.equal(deliveryOffQuote.quote.fulfillment.some((method: { type: string }) => method.type === "DELIVERY"), false);
    assert.ok(deliveryOffQuote.quote.issues.some((issue: string) => /delivery.*unavailable/i.test(issue)));
    const noFee = await settingsModule.updateRetailFulfillmentSettings(context, {
      ...disabledDelivery.settings, enableDelivery: true, deliveryFee: null, expectedVersion: disabledDelivery.version,
    });
    const noFeeQuote = await quoteModule.createRetailCheckoutQuote(customer.id, quoteInput);
    assert.equal(noFeeQuote.quote.deliveryFee, 0);
    assert.equal(noFeeQuote.quote.fulfillment.some((method: { type: string }) => method.type === "DELIVERY"), false);
    assert.ok(noFeeQuote.quote.issues.some((issue: string) => /fee/i.test(issue)));
    const pickupOff = await settingsModule.updateRetailFulfillmentSettings(context, {
      ...noFee.settings, deliveryFee: 451, enablePickup: false, expectedVersion: noFee.version,
    });
    const pickupOffQuote = await quoteModule.createRetailCheckoutQuote(customer.id, { organization: slug, type: "PICK_UP", paymentMethod: "BANK_TRANSFER" });
    assert.equal(pickupOffQuote.quote.fulfillment.some((method: { type: string }) => method.type === "PICK_UP"), false);
    assert.ok(pickupOffQuote.quote.issues.some((issue: string) => /pickup.*unavailable/i.test(issue)));
    assert.equal((await db.organizationSettings.findUniqueOrThrow({ where: { organizationSlug: slug } })).deliveryFee, 451,
      "an unconfigured fee stays explicitly nullable until the merchant changes it");
    assert.ok(pickupOff.version);

    const restored = await settingsModule.updateRetailFulfillmentSettings(context, {
      ...pickupOff.settings, enablePickup: true, enableDelivery: true, deliveryFee: 451,
      fulfillmentInstructions: "Reviewed fulfillment instructions", expectedVersion: pickupOff.version,
    });
    const placementQuote = await quoteModule.createRetailCheckoutQuote(customer.id, quoteInput);
    assert.equal(placementQuote.quote.deliveryFee, 451);
    assert.equal(placementQuote.quote.fulfillmentInfo.pickupAddress, "12 Synthetic Lane");
    assert.equal(placementQuote.quote.fulfillmentInfo.fulfillmentInstructions, "Reviewed fulfillment instructions");
    const placed = await checkoutModule.createRetailCheckout(customer.id, {
      ...quoteInput, idempotencyKey: randomUUID(), reviewToken: placementQuote.quote.reviewToken,
    });
    const placedOrder = await db.order.findUnique({ where: { orderNumber: placed.orderNumber }, select: { id: true } });
    if (placedOrder?.id) orderIds.push(placedOrder.id);
    assert.ok(placedOrder, "successful checkout is persisted and tracked for fixture cleanup");
    const placedPayment = await db.payment.findUniqueOrThrow({ where: { orderId: placedOrder.id }, select: { metadata: true } });
    const placedMetadata = placedPayment.metadata as { retailR4?: { fulfillmentInfo?: Record<string, unknown> } };
    assert.deepEqual(placedMetadata.retailR4?.fulfillmentInfo, {
      pickupAddress: "12 Synthetic Lane", pickupInstructions: "Use side entrance", deliveryRestrictions: "No oversized parcels",
      fulfillmentInstructions: "Reviewed fulfillment instructions", contact: "09120000000",
    }, "payment snapshot captures the exact fulfillment details reviewed during checkout");
    assert.ok(restored.version);
    const laterSettings = await settingsModule.updateRetailFulfillmentSettings(managerContext, {
      ...restored.settings, deliveryFee: 999, pickupAddress: "Later pickup address", pickupInstructions: "Later pickup instructions",
      deliveryRestrictions: "Later delivery restrictions", fulfillmentInstructions: "Later fulfillment instructions", expectedVersion: restored.version,
    });
    const customerPlacedOrder = await customerModule.getRetailCustomerOrder(customer.id, slug, placed.orderNumber);
    assert.deepEqual(customerPlacedOrder.fulfillmentInfo, placedMetadata.retailR4?.fulfillmentInfo,
      "customer tracking reads the safe reviewed snapshot instead of current organization settings");
    assert.equal(customerPlacedOrder.deliveryFee, 451, "later fee changes do not rewrite the placed order's delivery fee");
    assert.equal(customerPlacedOrder.fulfillmentInfo?.pickupAddress, "12 Synthetic Lane");
    assert.equal(customerPlacedOrder.fulfillmentInfo?.fulfillmentInstructions, "Reviewed fulfillment instructions");
    assert.ok(laterSettings.version);

    const order = async (key: "PICKUP" | "DELIVERY", type: "PICK_UP" | "DELIVERY") => {
      const created = await db.order.create({ data: {
        orderNumber: `R2-${key}-${suffix}`, retailCheckoutKey: `r2-${key}-${suffix}`, type, status: "READY",
        subtotal: 1000, deliveryFee: type === "DELIVERY" ? 300 : 0, discount: 0, total: type === "DELIVERY" ? 1300 : 1000,
        organizationSlug: slug, customerId: customer.id, paymentMethod: "BANK_TRANSFER", paymentStatus: "PENDING",
        items: { create: [{ productId: product.id, variantId: variant.id, quantity: 1, price: 1000,
          productNameSnapshot: "Purchase-time name", skuSnapshot: variant.sku, variantNameSnapshot: "Purchase-time variant",
          variantOptionsSnapshot: [{ key: "color", label: "Color", value: "Blue", displayUnit: null }] }] },
      } });
      orderIds.push(created.id);
      return created;
    };
    const pickupOrder = await order("PICKUP", "PICK_UP");
    const deliveryOrder = await order("DELIVERY", "DELIVERY");
    const stockBeforeHandover = (await db.productVariant.findUniqueOrThrow({ where: { id: variant.id } })).inventory;
    const pickupHandover = { operatorName: "Store desk", trackingReference: "", merchantNote: "staff-only pickup note" };
    const pickupResult = await merchant.changeMerchantRetailOrder(managerContext, pickupOrder.orderNumber,
      { status: "PICKED_UP", expectedStatus: "READY", handover: pickupHandover });
    assert.equal(pickupResult.fulfillmentHistory.at(-1)?.details?.operatorName, "Store desk");
    const pickupCustomer = await customerModule.getRetailCustomerOrder(customer.id, slug, pickupOrder.orderNumber);
    assert.equal(pickupCustomer.fulfillment.label, "دریافت‌شده توسط مشتری");
    assert.equal(pickupCustomer.fulfillment.completed, true);
    assert.equal(pickupCustomer.fulfillment.events.at(-1)?.operatorName, null);
    await assert.rejects(() => customerModule.getRetailCustomerOrder(otherCustomer.id, slug, pickupOrder.orderNumber),
      (error: unknown) => error instanceof ApiError && error.status === 404);
    await assert.rejects(() => customerModule.getRetailCustomerOrder(customer.id, foreignSlug, pickupOrder.orderNumber),
      (error: unknown) => error instanceof ApiError && error.status === 404);

    const deliveryHandover = { operatorName: "Courier One", trackingReference: "TRACK-R2", merchantNote: "internal route note" };
    await merchant.changeMerchantRetailOrder(context, deliveryOrder.orderNumber,
      { status: "PICKED_UP", expectedStatus: "READY", handover: deliveryHandover });
    const dispatched = await customerModule.getRetailCustomerOrder(customer.id, slug, deliveryOrder.orderNumber);
    assert.equal(dispatched.fulfillment.label, "تحویل به پیک");
    assert.equal(dispatched.fulfillment.completed, false);
    assert.equal(dispatched.fulfillment.events.at(-1)?.operatorName, "Courier One");
    assert.equal(dispatched.fulfillment.events.at(-1)?.trackingReference, "TRACK-R2");
    const dispatchHistory = await db.orderStatusHistory.findMany({ where: { orderId: deliveryOrder.id }, orderBy: { createdAt: "asc" } });
    assert.equal(dispatchHistory.length, 1);
    assert.equal(dispatchHistory[0]?.changedById, admin.id);
    assert.ok(dispatchHistory[0]?.createdAt instanceof Date);
    assert.equal((await db.order.findUniqueOrThrow({ where: { id: deliveryOrder.id } })).deliveryFee.toNumber(), 300,
      "current fee changes do not rewrite the order's historical fee");

    const deliveryDone = await merchant.changeMerchantRetailOrder(context, deliveryOrder.orderNumber,
      { status: "DELIVERED", expectedStatus: "PICKED_UP", handover: { ...deliveryHandover, operatorName: "Courier Two", trackingReference: "TRACK-CHANGED", merchantNote: "replacement private note" } });
    assert.equal(deliveryDone.status, "DELIVERED");
    const beforeRetry = await db.orderStatusHistory.count({ where: { orderId: deliveryOrder.id } });
    const retry = await merchant.changeMerchantRetailOrder(context, deliveryOrder.orderNumber,
      { status: "DELIVERED", expectedStatus: "DELIVERED", handover: { operatorName: "Different operator", trackingReference: "DIFFERENT", merchantNote: "new private text" } });
    assert.equal(await db.orderStatusHistory.count({ where: { orderId: deliveryOrder.id } }), beforeRetry,
      "repeated handover does not add another status event");
    assert.equal(retry.fulfillmentHistory.at(-1)?.details?.operatorName, "Courier Two",
      "retries cannot replace the original handover metadata");
    assert.equal(retry.fulfillmentHistory.at(-1)?.details?.trackingReference, "TRACK-CHANGED");
    const tracked = await customerModule.getRetailCustomerOrder(customer.id, slug, deliveryOrder.orderNumber);
    assert.equal(tracked.fulfillment.completed, true);
    assert.equal(tracked.fulfillment.events.at(-1)?.operatorName, "Courier Two");
    assert.equal(tracked.deliveryFee, 300);
    assert.equal(tracked.items[0]?.productName, "Purchase-time name");
    assert.equal(Object.hasOwn(tracked, "internalNotes"), false);
    const publicJson = JSON.stringify(tracked);
    for (const privateValue of ["internal route note", "replacement private note", "new private text", "changedById", "actorId", "merchantNote"]) {
      assert.equal(publicJson.includes(privateValue), false);
    }
    const orderAfterHandover = await db.order.findUniqueOrThrow({ where: { id: deliveryOrder.id } });
    assert.equal(orderAfterHandover.paymentStatus, "PENDING", "handover does not alter payment state");
    assert.equal(orderAfterHandover.deliveryFee.toNumber(), 300);
    assert.equal((await db.productVariant.findUniqueOrThrow({ where: { id: variant.id } })).inventory, stockBeforeHandover,
      "handover does not decrement or restore stock");
  } finally {
    if (cartIds.length) await db.shopCart.deleteMany({ where: { id: { in: cartIds } } });
    if (orderIds.length) {
      await db.couponRedemption.deleteMany({ where: { orderId: { in: orderIds } } });
      await db.paymentEvent.deleteMany({ where: { orderId: { in: orderIds } } });
      await db.orderStatusHistory.deleteMany({ where: { orderId: { in: orderIds } } });
      await db.inventoryMovement.deleteMany({ where: { orderId: { in: orderIds } } });
      await db.payment.deleteMany({ where: { orderId: { in: orderIds } } });
      await db.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
      await db.order.deleteMany({ where: { id: { in: orderIds } } });
    }
    if (variantIds.length) await db.productVariant.deleteMany({ where: { id: { in: variantIds } } });
    if (productIds.length) await db.product.deleteMany({ where: { id: { in: productIds } } });
    if (categoryIds.length) await db.productCategory.deleteMany({ where: { id: { in: categoryIds } } });
    if (organizationIds.length) {
      await db.paymentSettings.deleteMany({ where: { organizationSlug: { in: [slug, foreignSlug] } } });
      await db.auditLog.deleteMany({ where: { organizationId: { in: organizationIds } } });
      await db.organizationSettings.deleteMany({ where: { organizationSlug: { in: [slug, foreignSlug] } } });
      await db.organizationCapability.deleteMany({ where: { organizationId: { in: organizationIds } } });
      await db.organization.deleteMany({ where: { id: { in: organizationIds } } });
    }
    if (userIds.length) await db.user.deleteMany({ where: { id: { in: userIds } } });
    await db.$disconnect();
  }
});
