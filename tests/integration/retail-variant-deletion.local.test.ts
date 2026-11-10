import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { mock, test } from "node:test";
import { assertRetailRecoveryEnvironment } from "../e2e/retail-recovery/safety.mjs";

// Fail closed before importing the server-side services or connecting Prisma.
const target = assertRetailRecoveryEnvironment();

function statusOf(error: unknown): number | undefined {
  if (error instanceof Error && error.name === "ZodError") return 400;
  return error && typeof error === "object" && "status" in error
    ? Number((error as { status?: unknown }).status)
    : undefined;
}

async function expectStatus(status: number, fn: () => Promise<unknown>) {
  let caught: unknown;
  try { await fn(); } catch (error) { caught = error; }
  assert.ok(caught instanceof Error, `expected a controlled ${status} error`);
  assert.equal(statusOf(caught), status, caught.message);
  return caught;
}

test("Retail variant deletion is atomic, tenant scoped, historical-safe, and cart/checkout safe", { concurrency: false, timeout: 180000 }, async (t) => {
  mock.module("next/cache", { namedExports: { revalidatePath: () => undefined, revalidateTag: () => undefined } });

  const [{ PrismaClient }, { PrismaPg }, { prisma }, merchant, { cartService }, quoteModule, checkoutModule] = await Promise.all([
    import("@prisma/client"), import("@prisma/adapter-pg"), import("@/lib/db"),
    import("@/lib/retail/merchant-catalog.server"), import("@/lib/services/cart.service"),
    import("@/lib/retail/checkout-quote.server"), import("@/lib/retail/checkout.server"),
  ]);
  const databaseUrl = process.env.DATABASE_URL?.trim();
  assert.ok(databaseUrl);
  const url = new URL(databaseUrl);
  assert.equal(url.hostname, "127.0.0.1");
  assert.equal(url.port, "5436");
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }), log: ["error"] });
  const stamp = process.env.E2E_STAMP;
  assert.ok(stamp, "recovery seed stamp is required");
  const organizationSlug = `retail-e2e-${stamp}`;
  const unique = randomUUID().replaceAll("-", "").slice(0, 10);
  let productId: string | undefined;
  let finalProductId: string | undefined;
  let concurrencyProductId: string | undefined;
  let colorDefinitionId: string | undefined;
  let sizeDefinitionId: string | undefined;
  let customerId: string | undefined;
  let concurrencyCustomerId: string | undefined;
  let cartId: string | undefined;
  let concurrencyCartId: string | undefined;
  let paymentSettingsCreated = false;
  let historyOrderId: string | undefined;
  let foreignVariantId: string | undefined;
  const financialOrderIds: string[] = [];
  const financialRequestIds: string[] = [];
  const financialAttemptIds: string[] = [];
  const financialIntentIds: string[] = [];
  const financialIntegrationIds: string[] = [];
  let concurrencyCheckoutOrderId: string | undefined;
  const createdVariantIds: string[] = [];

  try {
    const identity = await db.$queryRaw<Array<{ db: string }>>`SELECT current_database()::text AS db`;
    assert.equal(identity[0]?.db, target.databaseName, "Connected database identity mismatch.");
    const organization = await db.organization.findFirstOrThrow({ where: { slug: organizationSlug, isActive: true, deletedAt: null }, select: { id: true, slug: true } });
    const admin = await db.user.findFirstOrThrow({ where: { name: `admin-e2e-${stamp}` }, select: { id: true } });
    const category = await db.productCategory.findFirstOrThrow({ where: { organizationId: organization.id, isActive: true, deletedAt: null }, select: { id: true } });
    const image = await db.image.findFirstOrThrow({ where: { organizationId: organization.id, access: "PUBLIC" }, select: { id: true } });
    const context = { organizationId: organization.id, organizationSlug: organization.slug, actorUserId: admin.id, role: "ADMIN" as const };
    const createProduct = (input: unknown) => merchant.createMerchantRetailProduct(context, admin.id, merchant.retailProductCreateSchema.parse(input));
    const updateProduct = (id: string, input: unknown) => merchant.updateMerchantRetailProduct(context, admin.id, id, merchant.retailProductUpdateSchema.parse(input));

    const colors = ["مشکی", "سفید", "زیتونی"];
    const sizes = ["38", "39", "40", "41", "42"];
    const colorDefinition = await db.retailAttributeDefinition.create({ data: {
      organizationId: organization.id, key: `variant_delete_color_${unique}`, label: "رنگ کفش", scope: "VARIANT_OPTION", valueType: "ENUM", allowedValues: colors, isActive: true,
    }, select: { id: true } });
    colorDefinitionId = colorDefinition.id;
    const sizeDefinition = await db.retailAttributeDefinition.create({ data: {
      organizationId: organization.id, key: `variant_delete_size_${unique}`, label: "سایز", scope: "VARIANT_OPTION", valueType: "ENUM", allowedValues: sizes, isActive: true,
    }, select: { id: true } });
    sizeDefinitionId = sizeDefinition.id;

    const product = await createProduct({
      name: `Variant deletion ${unique}`, slug: `variant-deletion-${unique}`, description: null, basePrice: 500000,
      categoryId: category.id, imageIds: [image.id], variants: colors.flatMap(color => sizes.map(size => ({
        name: `${color} / ${size}`, sku: `VD-${unique}-${colors.indexOf(color)}-${size}`, price: 500000, inventory: 8, allowBackOrder: false,
        options: [{ definitionId: colorDefinition.id, value: color }, { definitionId: sizeDefinition.id, value: size }], imageIds: [],
      }))),
      gallerySettings: {
        version: 1, productImageIds: [image.id],
        colors: colors.map(value => ({ definitionId: colorDefinition.id, value, imageIds: [] })),
        appearanceGroups: colors.map(value => ({ definitionId: colorDefinition.id, value, lightImageId: null, darkImageId: null })),
      },
    });
    productId = product.id;
    createdVariantIds.push(...product.variants.map((variant: { id: string }) => variant.id));
    assert.equal(product.variants.length, 15, "fixture must start with three colors by five sizes");
    await t.test("legacy hard deletion is closed for Retail even to a platform administrator", async () => {
      const { productService } = await import("@/lib/services/product.service");
      await expectStatus(409, () => productService.hardDeleteVariant(product.variants[0]!.id, "SUPER_ADMIN"));
      const retained = await db.productVariant.findUniqueOrThrow({ where: { id: product.variants[0]!.id }, select: { id: true, deletedAt: true } });
      assert.equal(retained.id, product.variants[0]!.id);
      assert.equal(retained.deletedAt, null);
    });

    const colorOf = (variant: { options: Array<{ definitionId: string; value: string | number | boolean }> }) => String(variant.options.find(option => option.definitionId === colorDefinition.id)?.value);
    const sizeOf = (variant: { options: Array<{ definitionId: string; value: string | number | boolean }> }) => String(variant.options.find(option => option.definitionId === sizeDefinition.id)?.value);
    const findVariant = (variants: typeof product.variants, color: string, size: string) => variants.find((variant: typeof product.variants[number]) => colorOf(variant) === color && sizeOf(variant) === size)!;
    const revision = (value: { variantRevision?: string }) => {
      assert.match(value.variantRevision ?? "", /^[a-f0-9]{64}$/, "getMerchantRetailProduct must expose the SHA-256 variantRevision");
      return value.variantRevision!;
    };
    const remove = (loaded: { variantRevision?: string }, ids: string[], extra: Record<string, unknown> = {}) => updateProduct(
      product.id, { ...extra, deletedVariantIds: ids, expectedVariantRevision: revision(loaded) },
    );

    await t.test("an invalid companion field rolls the variant deletion back with the product update", async () => {
      const before = await merchant.getMerchantRetailProduct(context, product.id);
      const targetVariant = before.variants[0]!;
      const priorGallery = before.gallerySettings;
      await expectStatus(400, () => updateProduct(product.id, {
        deletedVariantIds: [targetVariant.id], expectedVariantRevision: revision(before), imageIds: [], isActive: true,
      }));
      const after = await merchant.getMerchantRetailProduct(context, product.id);
      assert.ok(after.variants.some((variant: typeof product.variants[number]) => variant.id === targetVariant.id), "the invalid image update must not partially delete the variant");
      assert.deepEqual(after.gallerySettings, priorGallery);
    });

    await t.test("D1: delete a full color group, persist only its variants, and prune every color reference", async () => {
      const before = await merchant.getMerchantRetailProduct(context, product.id);
      const removed = before.variants.filter((variant: typeof product.variants[number]) => colorOf(variant) === "زیتونی");
      const retainedSnapshot = new Map(before.variants.filter((variant: typeof product.variants[number]) => colorOf(variant) !== "زیتونی").map((variant: typeof product.variants[number]) => [variant.id, [variant.sku, variant.price, variant.inventory]]));
      await remove(before, removed.map((variant: typeof product.variants[number]) => variant.id));
      const reloaded = await merchant.getMerchantRetailProduct(context, product.id);
      assert.equal(reloaded.variants.length, 10);
      assert.ok(reloaded.variants.every((variant: typeof product.variants[number]) => colorOf(variant) !== "زیتونی"));
      for (const [id, snapshot] of retainedSnapshot) {
        const current = reloaded.variants.find((variant: typeof product.variants[number]) => variant.id === id);
        assert.ok(current, `retained variant ${id} must remain`);
        assert.deepEqual([current.sku, current.price, current.inventory], snapshot);
      }
      const rows = await db.productVariant.findMany({ where: { id: { in: removed.map((variant: typeof product.variants[number]) => variant.id) } }, select: { id: true, sku: true, deletedAt: true } });
      assert.equal(rows.length, 5);
      assert.ok(rows.every(row => row.deletedAt instanceof Date && row.sku));
      assert.ok(!reloaded.gallerySettings?.colors.some((color: { value: string }) => color.value === "زیتونی"));
      assert.ok(!reloaded.gallerySettings?.appearanceGroups?.some((group: { value: string }) => group.value === "زیتونی"));
      assert.ok(!(reloaded.gallerySettings?.variantAppearances ?? []).some((entry: { variantId: string }) => removed.some((variant: typeof product.variants[number]) => variant.id === entry.variantId)));
      assert.ok(!(reloaded.gallerySettings?.overrides ?? []).some((id: string) => removed.some((variant: typeof product.variants[number]) => variant.id === id)));
    });

    await t.test("D2/D3: delete one size across colors, then one combination; preserve every other SKU, price, and quantity", async () => {
      const beforeSize = await merchant.getMerchantRetailProduct(context, product.id);
      const size40 = beforeSize.variants.filter((variant: typeof product.variants[number]) => sizeOf(variant) === "40");
      const keptBefore = new Map(beforeSize.variants.filter((variant: typeof product.variants[number]) => !size40.some((targetVariant: typeof product.variants[number]) => targetVariant.id === variant.id)).map((variant: typeof product.variants[number]) => [variant.id, [variant.sku, variant.price, variant.inventory]]));
      await remove(beforeSize, size40.map((variant: typeof product.variants[number]) => variant.id));
      const afterSize = await merchant.getMerchantRetailProduct(context, product.id);
      assert.equal(afterSize.variants.length, 8);
      assert.ok(afterSize.variants.every((variant: typeof product.variants[number]) => sizeOf(variant) !== "40"));
      for (const [id, snapshot] of keptBefore) {
        const current = afterSize.variants.find((variant: typeof product.variants[number]) => variant.id === id);
        assert.ok(current);
        assert.deepEqual([current.sku, current.price, current.inventory], snapshot);
      }
      const single = findVariant(afterSize.variants, "مشکی", "39");
      await remove(afterSize, [single.id]);
      const afterSingle = await merchant.getMerchantRetailProduct(context, product.id);
      assert.ok(!afterSingle.variants.some((variant: typeof product.variants[number]) => colorOf(variant) === "مشکی" && sizeOf(variant) === "39"));
      assert.ok(afterSingle.variants.some((variant: typeof product.variants[number]) => colorOf(variant) === "مشکی" && sizeOf(variant) === "41"));
      assert.ok(afterSingle.variants.some((variant: typeof product.variants[number]) => colorOf(variant) === "سفید" && sizeOf(variant) === "39"));

      const oldRow = await db.productVariant.findUniqueOrThrow({ where: { id: single.id }, select: { sku: true, deletedAt: true } });
      assert.ok(oldRow.deletedAt);
      assert.ok(oldRow.sku);
      const regenerated = await merchant.generateRetailVariants(context, admin.id, product.id, merchant.variantGenerationSchema.parse({
        colorDefinitionId: colorDefinition.id, sizeDefinitionId: sizeDefinition.id, sizeMode: "STANDARD",
        standardSizes: ["39"], colorValues: ["مشکی"], inventory: 9, price: 500000,
      }));
      assert.equal(regenerated.added, 1, "a soft-deleted combination can be generated again");
      const afterRegenerate = await merchant.getMerchantRetailProduct(context, product.id);
      const replacement = findVariant(afterRegenerate.variants, "مشکی", "39");
      assert.notEqual(replacement.id, single.id);
      assert.notEqual(replacement.sku, oldRow.sku, "the replacement receives a new unique SKU");
      assert.deepEqual(await db.productVariant.findUniqueOrThrow({ where: { id: single.id }, select: { sku: true, deletedAt: true } }), oldRow,
        "regeneration does not change the historical row SKU");
    });

    await t.test("invalid, duplicated, stale, foreign, reserved, and active-order requests fail atomically", async (t) => {
      let before = await merchant.getMerchantRetailProduct(context, product.id);
      const candidate = before.variants[0]!;
      const availableIds = before.variants.map((variant: typeof product.variants[number]) => variant.id);
      await expectStatus(400, () => remove(before, [candidate.id, candidate.id]));
      await expectStatus(400, () => remove(before, ["bad/id"]));
      assert.deepEqual((await merchant.getMerchantRetailProduct(context, product.id)).variants.map((variant: typeof product.variants[number]) => variant.id), availableIds);

      const stale = revision(before);
      await updateProduct(product.id, { variantUpdates: [{ id: candidate.id, inventory: candidate.inventory + 1 }] });
      await expectStatus(409, () => updateProduct(product.id, { deletedVariantIds: [candidate.id], expectedVariantRevision: stale }));
      await updateProduct(product.id, { variantUpdates: [{ id: candidate.id, inventory: candidate.inventory }] });
      assert.equal((await db.productVariant.findUniqueOrThrow({ where: { id: candidate.id } })).deletedAt, null);

      const foreignProduct = await db.product.findFirstOrThrow({ where: { organizationSlug: `retail-e2e-other-${stamp}`, deletedAt: null }, select: { id: true } });
      const foreignVariant = await db.productVariant.create({ data: {
        productId: foreignProduct.id, name: `foreign variant ${unique}`, sku: `VD-${unique}-FOREIGN`, price: 500000, inventory: 4,
      }, select: { id: true } });
      foreignVariantId = foreignVariant.id;
      before = await merchant.getMerchantRetailProduct(context, product.id);
      await expectStatus(400, () => remove(before, [foreignVariant.id]));
      assert.equal((await db.productVariant.findUniqueOrThrow({ where: { id: foreignVariant.id } })).deletedAt, null);

      const reserved = before.variants[1]!;
      await db.productVariant.update({ where: { id: reserved.id }, data: { reservedQuantity: 1 } });
      const reservedRevision = await merchant.getMerchantRetailProduct(context, product.id);
      const allBeforeReserved = reservedRevision.variants.map((variant: typeof product.variants[number]) => variant.id);
      const bulkTarget = reservedRevision.variants.find((variant: typeof product.variants[number]) => variant.id === candidate.id)!;
      const nameBeforeBlockedBulkDelete = reservedRevision.name;
      await expectStatus(409, () => remove(reservedRevision, [bulkTarget.id, reserved.id], { name: `must-not-commit-${unique}` }));
      const afterBlockedBulkDelete = await merchant.getMerchantRetailProduct(context, product.id);
      assert.deepEqual(afterBlockedBulkDelete.variants.map((variant: typeof product.variants[number]) => variant.id), allBeforeReserved,
        "a reserved member rejects the whole mixed free/reserved deletion request");
      assert.equal(afterBlockedBulkDelete.name, nameBeforeBlockedBulkDelete, "the companion product edit rolls back with the blocked deletion");
      await db.productVariant.update({ where: { id: reserved.id }, data: { reservedQuantity: 0 } });

      const activeOrderVariant = (await merchant.getMerchantRetailProduct(context, product.id)).variants[2]!;
      const customer = await db.user.create({ data: { name: `variant-delete-customer-${unique}`, password: "test-password-not-used", role: "CUSTOMER", isActive: true, locale: "fa" }, select: { id: true } });
      customerId = customer.id;
      const order = await db.order.create({ data: {
        orderNumber: `VD-${unique}-ACTIVE`, type: "PICK_UP", status: "PENDING", paymentStatus: "PENDING", subtotal: 500000, total: 500000,
        organizationSlug, customerId: customer.id,
      }, select: { id: true } });
      historyOrderId = order.id;
      const dbVariant = await db.productVariant.findUniqueOrThrow({ where: { id: activeOrderVariant.id }, select: { sku: true, name: true } });
      await db.orderItem.create({ data: {
        orderId: order.id, productId: product.id, variantId: activeOrderVariant.id, quantity: 1, price: 500000,
        productNameSnapshot: product.name, skuSnapshot: dbVariant.sku, variantNameSnapshot: dbVariant.name,
        variantOptionsSnapshot: [{ key: "color", value: colorOf(activeOrderVariant) }, { key: "size", value: sizeOf(activeOrderVariant) }],
      } });
      const beforeOrder = await merchant.getMerchantRetailProduct(context, product.id);
      const ordered = beforeOrder.variants.find((variant: typeof product.variants[number]) => variant.id === activeOrderVariant.id)!;
      const countBeforeOrderReject = beforeOrder.variants.length;
      await expectStatus(409, () => remove(beforeOrder, [ordered.id]));
      assert.equal((await merchant.getMerchantRetailProduct(context, product.id)).variants.length, countBeforeOrderReject);

      await t.test("terminal orders with paid, verified, or settled financial artifacts remain protected", async () => {
        const financialVariant = (await merchant.getMerchantRetailProduct(context, product.id)).variants[3]!;
        const financialOrder = await db.order.create({ data: {
          orderNumber: `VD-${unique}-FINANCIAL`, type: "PICK_UP", status: "CANCELLED", paymentStatus: "PENDING",
          subtotal: 500000, total: 500000, organizationSlug, customerId: customer.id,
        }, select: { id: true } });
        financialOrderIds.push(financialOrder.id);
        await db.orderItem.create({ data: { orderId: financialOrder.id, productId: product.id, variantId: financialVariant.id, quantity: 1, price: 500000 } });
        const financialRequest = await db.paymentRequest.create({ data: {
          organizationId: organization.id, orderId: financialOrder.id, amountToman: BigInt(500000), purpose: "retail variant deletion acceptance", status: "PAID",
        }, select: { id: true } });
        financialRequestIds.push(financialRequest.id);
        let current = await merchant.getMerchantRetailProduct(context, product.id);
        const currentVariant = current.variants.find((variant: typeof product.variants[number]) => variant.id === financialVariant.id)!;
        await expectStatus(409, () => remove(current, [currentVariant.id]));
        assert.ok((await merchant.getMerchantRetailProduct(context, product.id)).variants.some((variant: typeof product.variants[number]) => variant.id === currentVariant.id));

        await db.paymentRequest.update({ where: { id: financialRequest.id }, data: { status: "FAILED" } });
        const verifiedAttempt = await db.paymentProviderAttempt.create({ data: {
          organizationId: organization.id, paymentRequestId: financialRequest.id, provider: "PAYMENT", status: "VERIFIED", amountToman: BigInt(500000),
        }, select: { id: true } });
        financialAttemptIds.push(verifiedAttempt.id);
        current = await merchant.getMerchantRetailProduct(context, product.id);
        const stillProtected = current.variants.find((variant: typeof product.variants[number]) => variant.id === financialVariant.id)!;
        await expectStatus(409, () => remove(current, [stillProtected.id]));

        const integration = await db.organizationIntegration.create({ data: {
          organizationId: organization.id, provider: "INOTI_USSD", codeName: `variant-deletion-${unique}`,
        }, select: { id: true } });
        financialIntegrationIds.push(integration.id);
        const settledIntent = await db.ussdPaymentIntent.create({ data: {
          organizationId: organization.id, integrationId: integration.id, orderId: financialOrder.id,
          merchantAccountKey: "variant-deletion-fixture", merchantCodeName: `variant-deletion-${unique}`,
          merchantFactorId: `BZ${randomUUID().replaceAll("-", "")}`, amountRial: BigInt(5000000), sessionIdHash: createHash("sha256").update(`session-${unique}`).digest("hex"),
          mobileHash: createHash("sha256").update(`mobile-${unique}`).digest("hex"), mobileMasked: "***0000", status: "SETTLED",
        }, select: { id: true } });
        financialIntentIds.push(settledIntent.id);
        current = await merchant.getMerchantRetailProduct(context, product.id);
        const settledProtected = current.variants.find((variant: typeof product.variants[number]) => variant.id === financialVariant.id)!;
        await expectStatus(409, () => remove(current, [settledProtected.id]));
        assert.ok((await merchant.getMerchantRetailProduct(context, product.id)).variants.some((variant: typeof product.variants[number]) => variant.id === settledProtected.id));

        await db.ussdPaymentIntent.deleteMany({ where: { id: settledIntent.id } });
        financialIntentIds.splice(financialIntentIds.indexOf(settledIntent.id), 1);
        await db.paymentProviderAttempt.deleteMany({ where: { id: verifiedAttempt.id } });
        financialAttemptIds.splice(financialAttemptIds.indexOf(verifiedAttempt.id), 1);
        await db.paymentRequest.deleteMany({ where: { id: financialRequest.id } });
        financialRequestIds.splice(financialRequestIds.indexOf(financialRequest.id), 1);
        await db.orderItem.deleteMany({ where: { orderId: financialOrder.id } });
        await db.order.delete({ where: { id: financialOrder.id } });
        financialOrderIds.splice(financialOrderIds.indexOf(financialOrder.id), 1);
        await db.organizationIntegration.delete({ where: { id: integration.id } });
        financialIntegrationIds.splice(financialIntegrationIds.indexOf(integration.id), 1);
      });
    });

    await t.test("D6/D8: closed order history survives soft deletion; old cart is unavailable, quantity update and checkout reject, removal remains allowed", async () => {
      assert.ok(customerId && historyOrderId);
      const historyItem = await db.orderItem.findFirstOrThrow({ where: { orderId: historyOrderId }, select: { id: true, variantId: true, skuSnapshot: true, productNameSnapshot: true, variantNameSnapshot: true, variantOptionsSnapshot: true } });
      const historyVariantId = historyItem.variantId!;
      const stock = await db.productVariant.findUniqueOrThrow({ where: { id: historyVariantId }, select: { inventory: true, sku: true } });
      await db.order.update({ where: { id: historyOrderId }, data: { status: "RECEIVED", paymentStatus: "COMPLETED" } });
      await db.inventoryMovement.create({ data: {
        variantId: historyVariantId, orderId: historyOrderId, quantityDelta: -1, quantityBefore: stock.inventory,
        quantityAfter: stock.inventory - 1, reason: "ORDER_CREATED", note: "retained historical movement fixture",
      } });
      await db.productVariant.update({ where: { id: historyVariantId }, data: { inventory: stock.inventory - 1 } });

      await updateProduct(product.id, { isActive: true });
      const live = await merchant.getMerchantRetailProduct(context, product.id);
      const orderedVariant = live.variants.find((variant: typeof product.variants[number]) => variant.id === historyVariantId)!;
      await db.paymentSettings.create({ data: { organizationSlug, settings: { retailR4: {
        bankTransferEnabled: false, cashEnabled: true, inotiUssdEnabled: false, bankCardNumber: null, bankAccountOwner: null,
        cashModes: ["COUNTER"], cashBeforeConfirmation: false,
        paymentDeadlinesMinutes: { bankTransfer: 1440, cash: 1440, inotiUssd: 15 },
      } } } });
      paymentSettingsCreated = true;
      const cart = await db.shopCart.create({ data: { organizationSlug, customerId, status: "ACTIVE" } });
      cartId = cart.id;
      const item = await db.shopCartItem.create({ data: { cartId: cart.id, variantId: orderedVariant.id, quantity: 1 } });
      const quoteInput = { organization: organizationSlug, type: "PICK_UP" as const, paymentMethod: "CASH" as const, cashMode: "COUNTER" as const };
      const oldQuote = await quoteModule.createRetailCheckoutQuote(customerId, quoteInput);
      assert.deepEqual(oldQuote.quote.issues, []);

      const beforeDelete = await merchant.getMerchantRetailProduct(context, product.id);
      await remove(beforeDelete, [orderedVariant.id]);
      const softDeleted = await db.productVariant.findUniqueOrThrow({ where: { id: orderedVariant.id }, select: { deletedAt: true, sku: true } });
      assert.ok(softDeleted.deletedAt);
      assert.equal(softDeleted.sku, stock.sku);

      const cartView = await cartService.getCart(organizationSlug, customerId, null);
      const cartLine = cartView?.items.find((line: { id: string }) => line.id === item.id);
      assert.equal(cartLine?.availability.orderable, false);
      assert.equal(cartLine?.availability.reason, "unavailable");
      await expectStatus(409, () => cartService.updateItemQuantity(item.id, { quantity: 2 }, customerId, null, organizationSlug));
      const checkoutKey = randomUUID();
      await expectStatus(409, () => checkoutModule.createRetailCheckout(customerId, {
        ...quoteInput, idempotencyKey: checkoutKey, reviewToken: oldQuote.quote.reviewToken,
      }));
      assert.equal(await db.order.count({ where: { retailCheckoutKey: checkoutKey } }), 0);
      await cartService.removeItem(item.id, customerId, null, organizationSlug);
      assert.equal((await cartService.getCart(organizationSlug, customerId, null))?.items.length, 0, "the customer can remove a deleted variant from an old cart");

      const preserved = await db.orderItem.findUniqueOrThrow({ where: { id: historyItem.id }, include: { order: true } });
      assert.equal(preserved.variantId, historyVariantId);
      assert.equal(preserved.skuSnapshot, historyItem.skuSnapshot);
      assert.equal(preserved.productNameSnapshot, historyItem.productNameSnapshot);
      assert.equal(preserved.variantNameSnapshot, historyItem.variantNameSnapshot);
      assert.deepEqual(preserved.variantOptionsSnapshot, historyItem.variantOptionsSnapshot);
      assert.equal(preserved.order.status, "RECEIVED");
      assert.equal(await db.inventoryMovement.count({ where: { variantId: historyVariantId, orderId: historyOrderId } }), 1);

      await expectStatus(409, () => updateProduct(product.id, {
        newVariants: [{ name: dbVariantName(preserved.variantNameSnapshot), sku: softDeleted.sku, price: 500000, inventory: 1, allowBackOrder: false,
          options: [{ definitionId: colorDefinition.id, value: colorOf(orderedVariant) }, { definitionId: sizeDefinition.id, value: sizeOf(orderedVariant) }], imageIds: [] }],
      }));
    });

    await t.test("D9: deleting the published last variant requires atomic unpublish", async () => {
      const lastProduct = await createProduct({
        name: `Last variant ${unique}`, slug: `last-variant-${unique}`, description: null, basePrice: 500000, categoryId: category.id, imageIds: [image.id],
        variants: [{ name: "مشکی / 38", sku: `VD-${unique}-LAST`, price: 500000, inventory: 2, allowBackOrder: false,
          options: [{ definitionId: colorDefinition.id, value: "مشکی" }, { definitionId: sizeDefinition.id, value: "38" }], imageIds: [] }],
      });
      finalProductId = lastProduct.id;
      await updateProduct(lastProduct.id, { isActive: true });
      const published = await merchant.getMerchantRetailProduct(context, lastProduct.id);
      await expectStatus(409, () => updateProduct(lastProduct.id, {
        deletedVariantIds: [published.variants[0].id], expectedVariantRevision: revision(published),
      }));
      const afterReject = await merchant.getMerchantRetailProduct(context, lastProduct.id);
      assert.equal(afterReject.isActive, true);
      assert.equal(afterReject.variants.length, 1);
      await updateProduct(lastProduct.id, {
        deletedVariantIds: [published.variants[0].id], expectedVariantRevision: revision(published), isActive: false,
      });
      const afterSave = await merchant.getMerchantRetailProduct(context, lastProduct.id);
      assert.equal(afterSave.isActive, false);
      assert.equal(afterSave.variants.length, 0);
      assert.ok((await db.productVariant.findUniqueOrThrow({ where: { id: published.variants[0].id } })).deletedAt);
    });

    await t.test("untracked checkout and variant deletion serialize on the product row", { timeout: 45000 }, async () => {
      const currentSettings = await db.paymentSettings.findUnique({ where: { organizationSlug }, select: { id: true } });
      if (!currentSettings) {
        await db.paymentSettings.create({ data: { organizationSlug, settings: { retailR4: {
          bankTransferEnabled: false, cashEnabled: true, inotiUssdEnabled: false, bankCardNumber: null, bankAccountOwner: null,
          cashModes: ["COUNTER"], cashBeforeConfirmation: false,
          paymentDeadlinesMinutes: { bankTransfer: 1440, cash: 1440, inotiUssd: 15 },
        } } } });
        paymentSettingsCreated = true;
      }
      const raceProduct = await createProduct({
        name: `Untracked race ${unique}`, slug: `untracked-race-${unique}`, description: null, basePrice: 500000,
        categoryId: category.id, imageIds: [image.id], trackInventory: false,
        variants: ["41", "42"].map(size => ({
          name: `مشکی / ${size}`, sku: `VD-${unique}-RACE-${size}`, price: 500000, inventory: 6, allowBackOrder: false,
          options: [{ definitionId: colorDefinition.id, value: "مشکی" }, { definitionId: sizeDefinition.id, value: size }], imageIds: [],
        })),
      });
      concurrencyProductId = raceProduct.id;
      createdVariantIds.push(...raceProduct.variants.map((variant: { id: string }) => variant.id));
      await updateProduct(raceProduct.id, { isActive: true });
      const candidate = raceProduct.variants[0]!;
      const initialStock = new Map(raceProduct.variants.map((variant: { id: string; inventory: number }) => [variant.id, variant.inventory]));
      const raceCustomer = await db.user.create({ data: {
        name: `variant-delete-race-customer-${unique}`, password: "test-password-not-used", role: "CUSTOMER", isActive: true, locale: "fa",
      }, select: { id: true } });
      concurrencyCustomerId = raceCustomer.id;
      const raceCart = await db.shopCart.create({ data: { organizationSlug, customerId: raceCustomer.id, status: "ACTIVE" } });
      concurrencyCartId = raceCart.id;
      await db.shopCartItem.create({ data: { cartId: raceCart.id, variantId: candidate.id, quantity: 1 } });
      const quoteInput = { organization: organizationSlug, type: "PICK_UP" as const, paymentMethod: "CASH" as const, cashMode: "COUNTER" as const };
      const quote = await quoteModule.createRetailCheckoutQuote(raceCustomer.id, quoteInput);
      assert.deepEqual(quote.quote.issues, []);
      const beforeDelete = await merchant.getMerchantRetailProduct(context, raceProduct.id);
      const deleteInput = {
        deletedVariantIds: [candidate.id],
        expectedVariantRevision: revision(beforeDelete),
      };
      const idempotencyKey = randomUUID();

      let releaseBarrier!: () => void;
      let signalLocked!: () => void;
      const barrierReleased = new Promise<void>(resolve => { releaseBarrier = resolve; });
      const productLocked = new Promise<void>(resolve => { signalLocked = resolve; });
      const heldProductLock = db.$transaction(async tx => {
        await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "Product" WHERE "id" = ${raceProduct.id} AND "organizationId" = ${organization.id} FOR UPDATE`;
        signalLocked();
        await barrierReleased;
      }, { timeout: 15000 });
      await productLocked;
      const deleteAttempt = updateProduct(raceProduct.id, deleteInput);
      const checkoutAttempt = checkoutModule.createRetailCheckout(raceCustomer.id, {
        ...quoteInput, idempotencyKey, reviewToken: quote.quote.reviewToken,
      });
      let bothQueued = false;
      try {
        const deadline = Date.now() + 10000;
        while (Date.now() < deadline) {
          const waiters = await db.$queryRaw<Array<{ productLockWaiters: number }>>`
            SELECT
              count(*) FILTER (WHERE query ILIKE '%"Product"%' AND (query ILIKE '%FOR UPDATE%' OR query ILIKE '%FOR KEY SHARE%'))::int AS "productLockWaiters"
            FROM pg_stat_activity
            WHERE datname = current_database() AND pid <> pg_backend_pid() AND wait_event_type = 'Lock'`;
          if ((waiters[0]?.productLockWaiters ?? 0) >= 2) { bothQueued = true; break; }
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      } finally {
        releaseBarrier();
        await heldProductLock;
      }
      const [deleteResult, checkoutResult] = await Promise.allSettled([deleteAttempt, checkoutAttempt]);
      assert.ok(bothQueued, "both operations should reach their product-row lock while the test barrier is held");
      assert.equal([deleteResult, checkoutResult].filter(result => result.status === "fulfilled").length, 1,
        "exactly one of deletion or checkout commits");
      if (deleteResult.status === "fulfilled") {
        assert.equal(checkoutResult.status, "rejected");
        if (checkoutResult.status === "rejected") assert.equal(statusOf(checkoutResult.reason), 409, String(checkoutResult.reason));
        assert.ok((await db.productVariant.findUniqueOrThrow({ where: { id: candidate.id } })).deletedAt);
        assert.equal(await db.orderItem.count({ where: { variantId: candidate.id, order: { retailCheckoutKey: idempotencyKey } } }), 0,
          "checkout cannot persist an order that references a deleted variant");
      } else {
        assert.equal(checkoutResult.status, "fulfilled", "checkout wins only when the deletion is rejected");
        assert.equal(statusOf(deleteResult.reason), 409, String(deleteResult.reason));
        if (checkoutResult.status === "fulfilled") concurrencyCheckoutOrderId = checkoutResult.value.id;
        assert.equal((await db.productVariant.findUniqueOrThrow({ where: { id: candidate.id } })).deletedAt, null,
          "a pending order reference keeps its variant active");
      }
      for (const [variantId, inventory] of initialStock) {
        assert.equal((await db.productVariant.findUniqueOrThrow({ where: { id: variantId } })).inventory, inventory,
          "untracked inventory does not change during either racing operation");
      }
    });

    await t.test("deleting a foreign variant through a foreign product ID is rejected by product tenancy", async () => {
      const foreignProduct = await db.product.findFirstOrThrow({ where: { organizationSlug: `retail-e2e-other-${stamp}`, deletedAt: null }, select: { id: true } });
      const ownProduct = await merchant.getMerchantRetailProduct(context, product.id);
      await expectStatus(404, () => updateProduct(foreignProduct.id, {
        deletedVariantIds: ["c000000000000000000000000"], expectedVariantRevision: revision(ownProduct),
      }));
    });
  } finally {
    try {
      if (historyOrderId) {
        await db.inventoryMovement.deleteMany({ where: { orderId: historyOrderId } });
        await db.orderItem.deleteMany({ where: { orderId: historyOrderId } });
        await db.orderStatusHistory.deleteMany({ where: { orderId: historyOrderId } });
        await db.paymentEvent.deleteMany({ where: { orderId: historyOrderId } });
        await db.payment.deleteMany({ where: { orderId: historyOrderId } });
        await db.order.deleteMany({ where: { id: historyOrderId } });
      }
      if (concurrencyCheckoutOrderId) {
        await db.inventoryMovement.deleteMany({ where: { orderId: concurrencyCheckoutOrderId } });
        await db.paymentEvent.deleteMany({ where: { orderId: concurrencyCheckoutOrderId } });
        await db.orderStatusHistory.deleteMany({ where: { orderId: concurrencyCheckoutOrderId } });
        await db.orderItem.deleteMany({ where: { orderId: concurrencyCheckoutOrderId } });
        await db.payment.deleteMany({ where: { orderId: concurrencyCheckoutOrderId } });
        await db.order.deleteMany({ where: { id: concurrencyCheckoutOrderId } });
      }
      if (financialIntentIds.length) await db.ussdPaymentIntent.deleteMany({ where: { id: { in: financialIntentIds } } });
      if (financialAttemptIds.length) await db.paymentProviderAttempt.deleteMany({ where: { id: { in: financialAttemptIds } } });
      if (financialRequestIds.length) await db.paymentRequest.deleteMany({ where: { id: { in: financialRequestIds } } });
      if (financialOrderIds.length) {
        await db.orderItem.deleteMany({ where: { orderId: { in: financialOrderIds } } });
        await db.order.deleteMany({ where: { id: { in: financialOrderIds } } });
      }
      if (financialIntegrationIds.length) await db.organizationIntegration.deleteMany({ where: { id: { in: financialIntegrationIds } } });
      if (cartId) {
        await db.shopCartItem.deleteMany({ where: { cartId } });
        await db.shopCart.deleteMany({ where: { id: cartId } });
      }
      if (concurrencyCartId) {
        await db.shopCartItem.deleteMany({ where: { cartId: concurrencyCartId } });
        await db.shopCart.deleteMany({ where: { id: concurrencyCartId } });
      }
      if (paymentSettingsCreated) await db.paymentSettings.deleteMany({ where: { organizationSlug } });
      const productIds = [productId, finalProductId, concurrencyProductId].filter((id): id is string => Boolean(id));
      if (productIds.length) {
        await db.inventoryMovement.deleteMany({ where: { variantId: { in: createdVariantIds }, orderId: null } });
        await db.product.deleteMany({ where: { id: { in: productIds } } });
      }
      if (foreignVariantId) await db.productVariant.deleteMany({ where: { id: foreignVariantId } });
      if (colorDefinitionId) await db.retailAttributeDefinition.deleteMany({ where: { id: colorDefinitionId } });
      if (sizeDefinitionId) await db.retailAttributeDefinition.deleteMany({ where: { id: sizeDefinitionId } });
      if (customerId) await db.user.deleteMany({ where: { id: customerId } });
      if (concurrencyCustomerId) await db.user.deleteMany({ where: { id: concurrencyCustomerId } });
    } finally {
      await Promise.allSettled([db.$disconnect(), prisma.$disconnect()]);
    }
  }
});

function dbVariantName(value: unknown): string {
  return typeof value === "string" && value.length ? value : "restored historical combination";
}
