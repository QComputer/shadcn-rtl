import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mock, test } from "node:test";

const enabled = process.env.RETAIL_P0_PG_ACCEPTANCE === "1";

function assertExactDatabaseTarget() {
  assert.equal(process.env.DATABASE_URL, process.env.DIRECT_URL, "runtime and direct URLs must be identical");
  for (const key of ["DATABASE_URL", "DIRECT_URL"]) {
    const url = new URL(process.env[key] ?? "");
    assert.equal(url.protocol, "postgresql:", `${key} must use PostgreSQL`);
    assert.equal(url.hostname, "127.0.0.1", `${key} must use the guarded loopback`);
    assert.equal(url.port, "54713", `${key} must use the guarded Retail P0 port`);
    assert.equal(url.pathname, "/retail_p0_20261019", `${key} must use the exact Retail P0 database`);
    assert.match(decodeURIComponent(url.username), /^consol_[a-f0-9]+$/, `${key} must use the isolated console role`);
  }
}

test("Retail P0 merchant catalog, public projection, cart, and checkout persist on isolated PostgreSQL 16", {
  skip: !enabled,
  concurrency: false,
}, async () => {
  assertExactDatabaseTarget();
  mock.module("next/cache", { namedExports: { revalidatePath: () => undefined, revalidateTag: () => undefined } });
  const [{ PrismaClient }, merchant, catalog, cartModule, checkoutModule, tenantContext, applicationDb] = await Promise.all([
    import("@prisma/client"),
    import("@/lib/retail/merchant-catalog.server"),
    import("@/lib/public-catalog/service.server"),
    import("@/lib/services/cart.service"),
    import("@/lib/retail/checkout.server"),
    import("@/lib/tenant-context"),
    import("@/lib/db"),
  ]);
  const db = new PrismaClient({ log: ["error"] });
  const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
  const orgASlug = `retail-p0-a-${suffix}`;
  const orgBSlug = `retail-p0-b-${suffix}`;
  const skuPrefix = `P0-${suffix.toUpperCase()}`;
  let organizationAId = "";
  let organizationBId = "";
  const orderIds: string[] = [];
  const cartIds: string[] = [];
  const imageIds: string[] = [];
  const userIds: string[] = [];
  const productIds: string[] = [];
  const variantIds: string[] = [];
  const definitionIds: string[] = [];
  let productSlug = "";
  let checkoutKey = "";

  try {
    const identity = await db.$queryRaw<Array<{ database: string; username: string; version: string; version_num: number }>>`
      SELECT current_database() AS database, current_user AS username,
        current_setting('server_version') AS version,
        current_setting('server_version_num')::int AS version_num`;
    assert.equal(identity[0]?.database, "retail_p0_20261019");
    assert.match(identity[0]?.username ?? "", /^consol_[a-f0-9]+$/);
    assert.ok(identity[0]!.version_num >= 160000 && identity[0]!.version_num < 170000,
      `expected PostgreSQL 16, received ${identity[0]!.version}`);
    if (process.env.RETAIL_P0_CONTAINER_ID) assert.match(process.env.RETAIL_P0_CONTAINER_ID, /^[a-f0-9]{12,64}$/i);

    const [organizationA, organizationB] = await Promise.all([
      db.organization.create({ data: { type: "SHOP", name: `Retail P0 A ${suffix}`, slug: orgASlug, capabilitiesInitializedAt: new Date() } }),
      db.organization.create({ data: { type: "SHOP", name: `Retail P0 B ${suffix}`, slug: orgBSlug, capabilitiesInitializedAt: new Date() } }),
    ]);
    organizationAId = organizationA.id;
    organizationBId = organizationB.id;
    await db.organizationCapability.createMany({ data: [organizationAId, organizationBId].map((organizationId) => ({ organizationId, key: "SHOP" as const, status: "ACTIVE" as const, enabledAt: new Date() })) });
    const [manager, customer, otherCustomer] = await Promise.all([
      db.user.create({ data: { name: `retail-p0-manager-${suffix}`, email: `retail-p0-manager-${suffix}@example.test`, password: "synthetic-only", role: "MANAGER" } }),
      db.user.create({ data: { name: `retail-p0-customer-${suffix}`, email: `retail-p0-customer-${suffix}@example.test`, password: "synthetic-only", role: "CUSTOMER" } }),
      db.user.create({ data: { name: `retail-p0-other-${suffix}`, email: `retail-p0-other-${suffix}@example.test`, password: "synthetic-only", role: "CUSTOMER" } }),
    ]);
    userIds.push(manager.id, customer.id, otherCustomer.id);
    await db.organizationMember.createMany({ data: [
      { organizationId: organizationA.id, organizationSlug: orgASlug, userId: manager.id, role: "MANAGER" },
      { organizationId: organizationA.id, organizationSlug: orgASlug, userId: otherCustomer.id, role: "STAFF" },
    ] });
    const managerSession = { user: { id: manager.id, role: "MANAGER" as const, organizationId: organizationA.id } };
    assert.equal((await tenantContext.requireTenantContext(managerSession, organizationA.id, ["ADMIN", "MANAGER"])).organizationSlug, orgASlug);
    await assert.rejects(() => tenantContext.requireTenantContext({ user: { id: otherCustomer.id, role: "CUSTOMER", organizationId: organizationA.id } }, organizationA.id, ["ADMIN", "MANAGER"]), /Forbidden/);
    await assert.rejects(() => tenantContext.requireTenantContext(managerSession, organizationB.id, ["ADMIN", "MANAGER"]), /Tenant context mismatch/);
    const [categoryA, categoryA2, categoryB, inactiveCategory] = await Promise.all([
      db.productCategory.create({ data: { organizationId: organizationA.id, organizationSlug: orgASlug, name: "Apparel", slug: `apparel-${suffix}` } }),
      db.productCategory.create({ data: { organizationId: organizationA.id, organizationSlug: orgASlug, name: "Accessories", slug: `accessories-${suffix}` } }),
      db.productCategory.create({ data: { organizationId: organizationB.id, organizationSlug: orgBSlug, name: "Foreign", slug: `foreign-${suffix}` } }),
      db.productCategory.create({ data: { organizationId: organizationA.id, organizationSlug: orgASlug, name: "Inactive", slug: `inactive-${suffix}`, isActive: false } }),
    ]);
    const context = { organizationId: organizationA.id, organizationSlug: orgASlug, actorUserId: manager.id, role: "MANAGER" as const };
    const [color, size] = await Promise.all([
      merchant.createMerchantRetailDefinition(context, { key: `color_${suffix}`, label: "Color", localizedLabels: {}, scope: "VARIANT_OPTION", valueType: "ENUM", displayUnit: null, localizedUnits: {}, allowedValues: ["Red", "Blue"], isFilterable: true }),
      merchant.createMerchantRetailDefinition(context, { key: `size_${suffix}`, label: "Size", localizedLabels: {}, scope: "VARIANT_OPTION", valueType: "ENUM", displayUnit: null, localizedUnits: {}, allowedValues: ["S", "M", "L"], isFilterable: true }),
    ]);
    const foreignColor = await merchant.createMerchantRetailDefinition({ organizationId: organizationB.id, organizationSlug: orgBSlug, actorUserId: manager.id, role: "MANAGER" }, {
      key: `foreign_color_${suffix}`, label: "Color", localizedLabels: {}, scope: "VARIANT_OPTION", valueType: "ENUM", displayUnit: null, localizedUnits: {}, allowedValues: ["Red", "Blue"], isFilterable: true,
    });
    definitionIds.push(color.id, size.id, foreignColor.id);
    const images = await Promise.all([
      db.image.create({ data: { url: `https://media.example.test/${suffix}-one.webp`, organizationId: organizationA.id, access: "PUBLIC", purpose: "upload" } }),
      db.image.create({ data: { url: `https://media.example.test/${suffix}-two.webp`, organizationId: organizationA.id, access: "PUBLIC", purpose: "upload" } }),
      db.image.create({ data: { url: `https://media.example.test/${suffix}-foreign.webp`, organizationId: organizationB.id, access: "PUBLIC", purpose: "upload" } }),
      db.image.create({ data: { url: `https://media.example.test/${suffix}-private.webp`, organizationId: organizationA.id, access: "PRIVATE", purpose: "upload" } }),
    ]);
    imageIds.push(...images.map((image) => image.id));
    const [productImage, variantImage, foreignImage, privateImage] = images;
    const variants = [
      { name: "Red S", sku: `${skuPrefix}-RS`, price: 1200, inventory: 5, allowBackOrder: false, options: [{ definitionId: color.id, value: "Red" }, { definitionId: size.id, value: "S" }], imageIds: [variantImage.id, productImage.id] },
      { name: "Red M", sku: `${skuPrefix}-RM`, price: 1300, inventory: 4, allowBackOrder: false, options: [{ definitionId: color.id, value: "Red" }, { definitionId: size.id, value: "M" }], imageIds: [] },
      { name: "Blue S", sku: `${skuPrefix}-BS`, price: 1250, inventory: 3, allowBackOrder: false, options: [{ definitionId: color.id, value: "Blue" }, { definitionId: size.id, value: "S" }], imageIds: [] },
      { name: "Blue M", sku: `${skuPrefix}-BM`, price: 1350, inventory: 0, allowBackOrder: false, options: [{ definitionId: color.id, value: "Blue" }, { definitionId: size.id, value: "M" }], imageIds: [] },
    ];
    const created = await merchant.createMerchantRetailProduct(context, manager.id, {
      name: `Retail P0 Shirt ${suffix}`, slug: `retail-p0-shirt-${suffix}`, brand: "Generic Atelier",
      description: "Synthetic integration fixture", categoryId: categoryA.id, categoryIds: [categoryA2.id],
      tagNames: ["New season", "Everyday"], imageIds: [productImage.id], attributes: [], variants,
    });
    productIds.push(created.id);
    productSlug = created.slug;
    variantIds.push(...created.variants.map((variant: { id: string }) => variant.id));
    assert.equal(created.brand, "Generic Atelier");
    assert.deepEqual(new Set(created.categoryIds), new Set([categoryA.id, categoryA2.id]));
    assert.deepEqual(created.tags.map((tag: { name: string }) => tag.name).sort(), ["Everyday", "New season"]);
    assert.deepEqual(created.variants[0].imageIds, [variantImage.id, productImage.id]);
    assert.equal(created.isActive, false, "merchant create saves a draft");
    const persistedCreate = await db.product.findUniqueOrThrow({ where: { id: created.id }, include: { categoryAssignments: true, tagAssignments: { include: { tag: true } }, variants: { include: { optionValues: true, galleryImages: true } } } });
    assert.equal(persistedCreate.brand, "Generic Atelier");
    assert.deepEqual(new Set(persistedCreate.categoryAssignments.map((entry) => entry.categoryId)), new Set([categoryA.id, categoryA2.id]));
    assert.deepEqual(persistedCreate.tagAssignments.map((entry) => entry.tag.name).sort(), ["Everyday", "New season"]);
    assert.equal(persistedCreate.variants.length, 4);
    await assert.rejects(() => merchant.createMerchantRetailProduct(context, manager.id, {
      name: `Inactive category ${suffix}`, description: null, categoryId: inactiveCategory.id, imageIds: [productImage.id], attributes: [], variants: [variants[0]],
    }), /active category belonging to this store/i);
    await assert.rejects(() => catalog.getPublicCatalogProduct(orgASlug, created.slug), /Product not found/);

    const duplicateOptions = {
      name: `Duplicate options ${suffix}`, description: null, categoryId: categoryA.id, imageIds: [productImage.id], attributes: [],
      variants: [{ ...variants[0], sku: `${skuPrefix}-DUP-1` }, { ...variants[0], sku: `${skuPrefix}-DUP-2` }],
    };
    await assert.rejects(() => merchant.createMerchantRetailProduct(context, manager.id, duplicateOptions), /distinct option combination/i);
    const invalidVariant = (sku: string, overrides: Partial<(typeof variants)[number]> = {}) => ({ ...variants[0], ...overrides, sku });
    const foreignImageInput = { name: `Foreign image ${suffix}`, description: null, categoryId: categoryA.id, imageIds: [foreignImage.id], attributes: [], variants: [invalidVariant(`${skuPrefix}-FOREIGN-PRODUCT`)] };
    await assert.rejects(() => merchant.createMerchantRetailProduct(context, manager.id, foreignImageInput), /public images uploaded to this store/i);
    const foreignVariantImageInput = { name: `Foreign variant image ${suffix}`, description: null, categoryId: categoryA.id, imageIds: [productImage.id], attributes: [], variants: [invalidVariant(`${skuPrefix}-FOREIGN-VARIANT`, { imageIds: [foreignImage.id] })] };
    await assert.rejects(() => merchant.createMerchantRetailProduct(context, manager.id, foreignVariantImageInput), /public images uploaded to this store/i);
    const privateImageInput = { name: `Private image ${suffix}`, description: null, categoryId: categoryA.id, imageIds: [privateImage.id], attributes: [], variants: [invalidVariant(`${skuPrefix}-PRIVATE-PRODUCT`)] };
    await assert.rejects(() => merchant.createMerchantRetailProduct(context, manager.id, privateImageInput), /public images uploaded to this store/i);
    const privateVariantImageInput = { name: `Private variant image ${suffix}`, description: null, categoryId: categoryA.id, imageIds: [productImage.id], attributes: [], variants: [invalidVariant(`${skuPrefix}-PRIVATE-VARIANT`, { imageIds: [privateImage.id] })] };
    await assert.rejects(() => merchant.createMerchantRetailProduct(context, manager.id, privateVariantImageInput), /public images uploaded to this store/i);
    const foreignDefinitionInput = { name: `Foreign definition ${suffix}`, description: null, categoryId: categoryA.id, imageIds: [productImage.id], attributes: [], variants: [invalidVariant(`${skuPrefix}-FOREIGN-DEFINITION`, { options: [{ definitionId: foreignColor.id, value: "Red" }] })] };
    await assert.rejects(() => merchant.createMerchantRetailProduct(context, manager.id, foreignDefinitionInput), /attribute is missing|belongs to another store/i);
    await assert.rejects(() => merchant.createMerchantRetailProduct(context, manager.id, {
      name: `Foreign category ${suffix}`, description: null, categoryId: categoryB.id, imageIds: [productImage.id], attributes: [], variants: [variants[0]],
    }), /active category belonging to this store/i);
    const duplicateSkuInput = { name: `Duplicate SKU ${suffix}`, description: null, categoryId: categoryA.id, imageIds: [productImage.id], attributes: [], variants: [{ ...variants[0], sku: variants[0].sku }] };
    await assert.rejects(() => merchant.createMerchantRetailProduct(context, manager.id, duplicateSkuInput), /SKU or product identifier is already in use/i);
    assert.equal(await db.product.count({ where: { organizationId: organizationA.id, name: { contains: suffix } } }), 1, "all rejected creates roll back");

    const firstVariant = created.variants[0];
    await db.productVariant.update({ where: { id: firstVariant.id }, data: { reservedQuantity: 2 } });
    await assert.rejects(() => merchant.updateMerchantRetailProduct(context, manager.id, created.id, {
      variantUpdates: [{ id: firstVariant.id, inventory: 1 }],
    }), /below the quantity already reserved/i);
    await db.productVariant.update({ where: { id: firstVariant.id }, data: { reservedQuantity: 0 } });
    const updated = await merchant.updateMerchantRetailProduct(context, manager.id, created.id, {
      categoryIds: [categoryA.id, categoryA2.id], tagNames: ["Clearance"],
      variantUpdates: [{ id: firstVariant.id, name: "Red L", options: [{ definitionId: color.id, value: "Red" }, { definitionId: size.id, value: "L" }], imageIds: [productImage.id, variantImage.id] }],
    });
    assert.deepEqual(updated.variants[0].imageIds, [productImage.id, variantImage.id], "variant gallery order persists");
    assert.deepEqual(updated.tags.map((tag: { name: string }) => tag.name), ["Clearance"]);
    assert.ok(updated.variants[0].options.some((option: { key: string; value: string | number | boolean }) => option.key === size.key && option.value === "L"));
    const persistedUpdate = await db.product.findUniqueOrThrow({ where: { id: created.id }, include: { categoryAssignments: true, tagAssignments: { include: { tag: true } }, variants: { where: { id: firstVariant.id }, include: { optionValues: true, galleryImages: { orderBy: { sortOrder: "asc" } } } } } });
    assert.deepEqual(persistedUpdate.variants[0]?.galleryImages.map((entry) => entry.imageId), [productImage.id, variantImage.id]);
    assert.equal(persistedUpdate.variants[0]?.optionValues.find((value) => value.definitionId === size.id)?.valueText, "L");
    assert.deepEqual(persistedUpdate.tagAssignments.map((entry) => entry.tag.name), ["Clearance"]);

    await merchant.updateMerchantRetailProduct(context, manager.id, created.id, { variantUpdates: [{ id: firstVariant.id, sku: null }] });
    await assert.rejects(() => merchant.updateMerchantRetailProduct(context, manager.id, created.id, { isActive: true }), /Every published variant needs a SKU/i);
    await merchant.updateMerchantRetailProduct(context, manager.id, created.id, { variantUpdates: [{ id: firstVariant.id, sku: `${skuPrefix}-RS` }] });
    await db.product.update({ where: { id: created.id }, data: { categoryId: inactiveCategory.id } });
    await assert.rejects(() => merchant.updateMerchantRetailProduct(context, manager.id, created.id, { isActive: true }), /active category belonging to this store/i);
    await db.product.update({ where: { id: created.id }, data: { categoryId: categoryA.id } });

    await db.productVariantImage.create({ data: { variantId: firstVariant.id, imageId: foreignImage.id, sortOrder: 2 } });
    await db.productVariantAttributeValue.create({ data: { variantId: firstVariant.id, definitionId: foreignColor.id, valueText: "Foreign", valueNumber: null, valueBoolean: null } });
    await merchant.updateMerchantRetailProduct(context, manager.id, created.id, { isActive: true });
    const published = await catalog.getPublicCatalogProduct(orgASlug, productSlug);
    assert.equal(published.brand, "Generic Atelier");
    assert.equal(published.variants.length, 4);
    const publicFirstVariant = published.variants.find((variant) => variant.id === firstVariant.id);
    assert.deepEqual(publicFirstVariant?.media?.gallery, [productImage.url, variantImage.url], "public gallery preserves order and excludes another tenant's image");
    assert.equal(publicFirstVariant?.options.some((option) => option.key === foreignColor.key), false, "foreign tenant attribute definitions stay out of the public catalog");
    const red = await catalog.listPublicCatalogProducts({ organizationIdentifier: orgASlug, page: 1, limit: 20, filter: [`${color.key}:Red`] });
    assert.equal(red.products.length, 1);
    assert.equal(red.products[0]?.id, created.id);
    const blue = await catalog.listPublicCatalogProducts({ organizationIdentifier: orgASlug, page: 1, limit: 20, filter: [`${color.key}:Blue`] });
    assert.equal(blue.products.length, 1);
    const categoryFiltered = await catalog.listPublicCatalogProducts({ organizationIdentifier: orgASlug, page: 1, limit: 20, category: categoryA2.slug! });
    assert.deepEqual(categoryFiltered.products.map((product) => product.id), [created.id]);
    const tagFiltered = await catalog.listPublicCatalogProducts({ organizationIdentifier: orgASlug, page: 1, limit: 20, tag: "Clearance" });
    assert.deepEqual(tagFiltered.products.map((product) => product.id), [created.id]);
    assert.doesNotMatch(JSON.stringify(published), /inventory|reservedQuantity|allowBackOrder/);
    await assert.rejects(() => merchant.updateMerchantRetailProduct(context, manager.id, created.id, {
      variantUpdates: [{ id: firstVariant.id, sku: null }],
    }), /Every published variant needs a SKU/i, "edits to a published product must preserve publication invariants");
    assert.equal((await db.productVariant.findUniqueOrThrow({ where: { id: firstVariant.id } })).sku, `${skuPrefix}-RS`);

    const carts = cartModule.cartService;
    const cartItem = await carts.addItem(orgASlug, customer.id, null, { variantId: firstVariant.id, quantity: 1 });
    const cart = await carts.getCart(orgASlug, customer.id, null);
    assert.ok(cart);
    cartIds.push(cart.id);
    const normalized = cart.items.find((item: { id: string }) => item.id === cartItem.id);
    assert.equal(normalized.unitPrice, 1200);
    assert.ok(normalized.variant.options.some((option: { key: string; value: string | number | boolean }) => option.key === size.key && option.value === "L"));
    assert.equal("optionValues" in normalized.variant, false, "internal attribute ownership data is not serialized into the cart response");
    assert.equal(normalized.variant.options.some((option: { key: string }) => option.key === foreignColor.key), false);
    await assert.rejects(() => carts.updateItemQuantity(cartItem.id, { quantity: 1 }, otherCustomer.id, null, orgASlug), /Unauthorized/);
    await assert.rejects(() => carts.updateItemQuantity(cartItem.id, { quantity: 1 }, customer.id, null, orgBSlug), /Cart item not found/);
    await assert.rejects(() => carts.removeItem(cartItem.id, customer.id, null, orgBSlug), /Cart item not found/);
    await db.productVariant.update({ where: { id: firstVariant.id }, data: { reservedQuantity: 5 } });
    await assert.rejects(() => carts.addItem(orgASlug, customer.id, null, { variantId: firstVariant.id, quantity: 1 }), /currently available stock/i);
    await db.productVariant.update({ where: { id: firstVariant.id }, data: { reservedQuantity: 2 } });
    await db.product.update({ where: { id: created.id }, data: { discountType: "percentage", discountValue: 10 } });
    const discountedCart = await carts.getCart(orgASlug, customer.id, null);
    assert.equal(discountedCart.items[0].unitPrice, 1080);

    await db.paymentSettings.upsert({
      where: { organizationSlug: orgASlug },
      create: { organizationSlug: orgASlug, settings: { retailR4: {
        bankTransferEnabled: false, cashEnabled: true, inotiUssdEnabled: false,
        bankCardNumber: null, bankAccountOwner: null, cashModes: ["COUNTER"], cashBeforeConfirmation: true,
        paymentDeadlinesMinutes: { bankTransfer: 1440, cash: 1440, inotiUssd: 15 },
      } } },
      update: { settings: { retailR4: {
        bankTransferEnabled: false, cashEnabled: true, inotiUssdEnabled: false,
        bankCardNumber: null, bankAccountOwner: null, cashModes: ["COUNTER"], cashBeforeConfirmation: true,
        paymentDeadlinesMinutes: { bankTransfer: 1440, cash: 1440, inotiUssd: 15 },
      } } },
    });
    checkoutKey = randomUUID();
    const checkout = await checkoutModule.createRetailCheckout(customer.id, {
      organization: orgASlug, idempotencyKey: checkoutKey, type: "PICK_UP", paymentMethod: "CASH", cashMode: "COUNTER",
    });
    const order = await db.order.findFirstOrThrow({ where: { retailCheckoutKey: checkoutKey, organizationSlug: orgASlug }, include: { items: { include: { variant: true } } } });
    orderIds.push(order.id);
    assert.equal(order.items.length, 1);
    assert.equal(order.items[0]?.variantId, firstVariant.id);
    assert.equal(order.items[0]?.variant?.sku, `${skuPrefix}-RS`);
    assert.equal(order.items[0]?.price.toString(), "1080", "checkout stores the selected variant's discounted unit price");
    assert.equal(order.items[0]?.productId, created.id);
    assert.equal(order.items[0]?.productNameSnapshot, created.name);
    assert.equal(order.items[0]?.skuSnapshot, `${skuPrefix}-RS`);
    assert.equal(order.items[0]?.variantNameSnapshot, "Red L");
    assert.equal(JSON.stringify(order.items[0]?.variantOptionsSnapshot).includes(foreignColor.key), false, "foreign tenant attribute definitions stay out of saved order snapshots");
    assert.deepEqual(order.items[0]?.variantOptionsSnapshot, [
      { key: color.key, label: color.label, value: "Red", displayUnit: null },
      { key: size.key, label: size.label, value: "L", displayUnit: null },
    ]);
    assert.equal(checkout.orderNumber, order.orderNumber);
    assert.equal((await db.productVariant.findUniqueOrThrow({ where: { id: firstVariant.id } })).inventory, 4);
    assert.equal(await db.inventoryMovement.count({ where: { orderId: order.id, variantId: firstVariant.id, reason: "ORDER_CREATED", quantityDelta: -1 } }), 1);

    await db.productVariant.update({ where: { id: firstVariant.id }, data: { sku: `${skuPrefix}-RS-EDITED`, name: "Blue L" } });
    await db.productVariantAttributeValue.update({ where: { variantId_definitionId: { variantId: firstVariant.id, definitionId: color.id } }, data: { valueText: "Blue" } });
    await db.product.update({ where: { id: created.id }, data: { name: "Renamed synthetic model" } });
    const historicalOrderItem = await db.orderItem.findFirstOrThrow({ where: { orderId: order.id, variantId: firstVariant.id } });
    assert.equal(historicalOrderItem.productNameSnapshot, created.name, "order model name remains the checkout-time value after catalog edits");
    assert.equal(historicalOrderItem.skuSnapshot, `${skuPrefix}-RS`, "order SKU remains the checkout-time value after catalog edits");
    assert.equal(historicalOrderItem.variantNameSnapshot, "Red L", "order variant name remains the checkout-time value after catalog edits");
    assert.deepEqual(historicalOrderItem.variantOptionsSnapshot, [
      { key: color.key, label: color.label, value: "Red", displayUnit: null },
      { key: size.key, label: size.label, value: "L", displayUnit: null },
    ], "order option labels and values remain the checkout-time snapshot");

    await merchant.updateMerchantRetailProduct(context, manager.id, created.id, { isActive: false });
    await assert.rejects(() => catalog.getPublicCatalogProduct(orgASlug, productSlug), /Product not found/);
    assert.equal(await db.product.findUniqueOrThrow({ where: { id: created.id } }).then((row) => row.isActive), false);
  } finally {
    if (orderIds.length) {
      await db.paymentEvent.deleteMany({ where: { orderId: { in: orderIds } } });
      await db.orderStatusHistory.deleteMany({ where: { orderId: { in: orderIds } } });
      await db.inventoryMovement.deleteMany({ where: { orderId: { in: orderIds } } });
      await db.payment.deleteMany({ where: { orderId: { in: orderIds } } });
      await db.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
      await db.order.deleteMany({ where: { id: { in: orderIds } } });
    }
    if (cartIds.length) {
      await db.shopCartItem.deleteMany({ where: { cartId: { in: cartIds } } });
      await db.shopCart.deleteMany({ where: { id: { in: cartIds } } });
    }
    if (productIds.length) await db.product.deleteMany({ where: { id: { in: productIds } } });
    if (organizationAId) await db.productTag.deleteMany({ where: { organizationId: organizationAId } });
    if (definitionIds.length) await db.retailAttributeDefinition.deleteMany({ where: { id: { in: definitionIds } } });
    if (imageIds.length) await db.image.deleteMany({ where: { id: { in: imageIds } } });
    if (organizationAId || organizationBId) {
      await db.productCategory.deleteMany({ where: { organizationId: { in: [organizationAId, organizationBId].filter(Boolean) } } });
      await db.paymentSettings.deleteMany({ where: { organizationSlug: { in: [orgASlug, orgBSlug] } } });
      await db.organizationMember.deleteMany({ where: { organizationId: { in: [organizationAId, organizationBId].filter(Boolean) } } });
      await db.organizationCapability.deleteMany({ where: { organizationId: { in: [organizationAId, organizationBId].filter(Boolean) } } });
      await db.organization.deleteMany({ where: { id: { in: [organizationAId, organizationBId].filter(Boolean) } } });
    }
    if (userIds.length) await db.user.deleteMany({ where: { id: { in: userIds } } });
    await Promise.all([db.$disconnect(), applicationDb.prisma.$disconnect()]);
  }
});
