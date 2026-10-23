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

test("Retail R3 bulk catalog import preview, execution, idempotency, and export", {
  skip: !enabled,
  concurrency: false,
}, async () => {
  assertGuardedDatabase();
  mock.module("next/cache", { namedExports: { revalidatePath: () => undefined, revalidateTag: () => undefined } });
  const [{ PrismaClient }, catalog, spreadsheet, { ApiError }] = await Promise.all([
    import("@prisma/client"),
    import("@/lib/import-hub/retail-catalog.server"),
    import("@/lib/import-hub/retail-spreadsheet"),
    import("@/lib/api-guards"),
  ]);
  const db = new PrismaClient({ log: ["error"] });
  const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
  const slug = `retail-r3-${suffix}`;
  const foreignSlug = `retail-r3-foreign-${suffix}`;
  const organizationIds: string[] = [];
  const userIds: string[] = [];
  const categoryIds: string[] = [];
  const definitionIds: string[] = [];
  const imageIds: string[] = [];
  const jobIds: string[] = [];
  const productIds: string[] = [];
  const orderIds: string[] = [];

  const csv = (rows: Record<string, string>[]) => ({ format: "CSV" as const, content: spreadsheet.writeRetailSpreadsheet(rows, "CSV").toString("utf8"), mode: "CREATE" as "CREATE" | "UPDATE" | "UPSERT" });
  const baseRows = (categoryId: string, productImageId: string, redImageId: string, blueImageId: string) => {
    const rows: Record<string, string>[] = [];
    for (const [color, colorImage, prefix] of [["قرمز", redImageId, "R"], ["آبی", blueImageId, "B"]]) {
      for (let size = 1; size <= 3; size++) rows.push({
        product_key: "shirt-main", product_name: "پیراهن آزمایشی", slug: `r3-shirt-${suffix}`, category_id: categoryId,
        image_ids: productImageId, variant_name: `${color} ${size}`, sku: `00${prefix}00${size}`,
        price_toman: String(1000 + size), stock: String(size + 2), allow_backorder: "false",
        gallery_mode: color === "قرمز" && size === 1 ? "OVERRIDE" : "INHERIT",
        ...(color === "قرمز" && size === 1 ? { variant_image_ids: productImageId } : {}),
        color_attribute: "color", color_value: color, color_image_ids: colorImage,
        "attribute:color": color, "attribute:size": String(size),
        "product_attribute:material": "پنبه",
      });
    }
    return rows;
  };

  try {
    const identity = await db.$queryRaw<Array<{ database: string; username: string; version_num: number }>>`
      SELECT current_database() AS database, current_user AS username, current_setting('server_version_num')::int AS version_num`;
    assert.equal(identity[0]?.database, "retail_p0_20261019");
    assert.match(identity[0]?.username ?? "", /^consol_[a-f0-9]+$/);
    assert.ok(identity[0]!.version_num >= 160000 && identity[0]!.version_num < 170000);

    const [organization, foreignOrganization] = await Promise.all([
      db.organization.create({ data: { name: `Retail R3 ${suffix}`, slug, type: "SHOP", capabilitiesInitializedAt: new Date() } }),
      db.organization.create({ data: { name: `Retail R3 foreign ${suffix}`, slug: foreignSlug, type: "SHOP", capabilitiesInitializedAt: new Date() } }),
    ]);
    organizationIds.push(organization.id, foreignOrganization.id);
    await db.organizationCapability.createMany({ data: organizationIds.map((organizationId) => ({ organizationId, key: "SHOP" as const, status: "ACTIVE" as const, enabledAt: new Date() })) });
    const [admin, manager, staff] = await Promise.all(["admin", "manager", "staff"].map((role) => db.user.create({
      data: { name: `retail-r3-${role}-${suffix}`, email: `retail-r3-${role}-${suffix}@example.test`, password: "synthetic-only", role: role.toUpperCase() as "ADMIN" | "MANAGER" | "STAFF" },
    })));
    userIds.push(admin.id, manager.id, staff.id);
    const context = { organizationId: organization.id, organizationSlug: slug, actorUserId: admin.id, role: "ADMIN" as const };
    const managerContext = { ...context, actorUserId: manager.id, role: "MANAGER" as const };
    const staffContext = { ...context, actorUserId: staff.id, role: "STAFF" as const };

    const [category, foreignCategory, colorDef, sizeDef, materialDef, productImage, redImage, blueImage, foreignImage] = await Promise.all([
      db.productCategory.create({ data: { name: `R3 category ${suffix}`, slug: `r3-category-${suffix}`, organizationId: organization.id, organizationSlug: slug } }),
      db.productCategory.create({ data: { name: `R3 foreign category ${suffix}`, slug: `r3-foreign-category-${suffix}`, organizationId: foreignOrganization.id, organizationSlug: foreignSlug } }),
      db.retailAttributeDefinition.create({ data: { organizationId: organization.id, key: "color", label: "Color", scope: "VARIANT_OPTION", valueType: "ENUM", allowedValues: ["قرمز", "آبی"] } }),
      db.retailAttributeDefinition.create({ data: { organizationId: organization.id, key: "size", label: "Size", scope: "VARIANT_OPTION", valueType: "ENUM", allowedValues: ["1", "2", "3"] } }),
      db.retailAttributeDefinition.create({ data: { organizationId: organization.id, key: "material", label: "Material", scope: "PRODUCT", valueType: "ENUM", allowedValues: ["پنبه"] } }),
      db.image.create({ data: { organizationId: organization.id, url: `https://example.test/r3-${suffix}-product.jpg`, filename: "product.jpg", access: "PUBLIC" } }),
      db.image.create({ data: { organizationId: organization.id, url: `https://example.test/r3-${suffix}-red.jpg`, filename: "red.jpg", access: "PUBLIC" } }),
      db.image.create({ data: { organizationId: organization.id, url: `https://example.test/r3-${suffix}-blue.jpg`, filename: "blue.jpg", access: "PUBLIC" } }),
      db.image.create({ data: { organizationId: foreignOrganization.id, url: `https://example.test/r3-${suffix}-foreign.jpg`, filename: "foreign.jpg", access: "PUBLIC" } }),
    ]);
    categoryIds.push(category.id, foreignCategory.id);
    definitionIds.push(colorDef.id, sizeDef.id, materialDef.id);
    imageIds.push(productImage.id, redImage.id, blueImage.id, foreignImage.id);
    const foreignProduct = await db.product.create({ data: { name: "Foreign synthetic", slug: `r3-foreign-${suffix}`, basePrice: 1000,
      organizationId: foreignOrganization.id, organizationSlug: foreignSlug, categoryId: foreignCategory.id, trackInventory: true, discountType: "none", discountValue: 0 } });
    productIds.push(foreignProduct.id);

    const rows = baseRows(category.id, productImage.id, redImage.id, blueImage.id);
    const input = csv(rows);
    const beforePreview = await db.product.count({ where: { organizationId: organization.id } });
    const preview = await catalog.previewRetailImport(managerContext, input);
    assert.equal(preview.counts.productsCreate, 1);
    assert.equal(preview.counts.variantsCreate, 6);
    assert.equal(preview.counts.invalidRows, 0);
    assert.equal(preview.rows.length, 6);
    assert.equal((await db.product.count({ where: { organizationId: organization.id } })), beforePreview, "preview must not write catalog rows");
    await assert.rejects(() => catalog.previewRetailImport(staffContext, input), (error: unknown) => error instanceof ApiError && error.status === 403);

    const duplicates = rows.map((row) => ({ ...row }));
    duplicates[1]!.sku = duplicates[0]!.sku!;
    duplicates[1]!["attribute:size"] = duplicates[0]!["attribute:size"]!;
    const duplicatePreview = await catalog.previewRetailImport(context, csv(duplicates));
    assert.ok(duplicatePreview.counts.invalidRows > 0, "duplicate SKU and option combination should be rejected in preview");

    const invalidRefs = [{ ...rows[0]!, category_id: foreignCategory.id, image_ids: foreignImage.id, variant_image_ids: foreignImage.id }];
    const invalidRefPreview = await catalog.previewRetailImport(context, csv(invalidRefs));
    assert.ok(invalidRefPreview.rows[0]!.errors.length, "cross-organization category/media references must fail preview");
    const foreignProductPreview = await catalog.previewRetailImport(context, { ...csv([{ product_id: foreignProduct.id, variant_id: "", sku: "", price_toman: "", stock: "" }]), mode: "UPDATE" });
    assert.ok(foreignProductPreview.rows[0]!.errors.length, "cross-organization product ids must fail preview");
    const invalidNumbers = [{ ...rows[0]!, price_toman: "0", stock: "-2" }];
    assert.ok((await catalog.previewRetailImport(context, csv(invalidNumbers))).rows[0]!.errors.length);
    const unknownCategory = [{ ...rows[0]!, category_id: `missing-${suffix}` }];
    assert.ok((await catalog.previewRetailImport(context, csv(unknownCategory))).rows[0]!.errors.length);
    const createWithId = { ...csv([{ ...rows[0]!, product_id: foreignProduct.id }]), mode: "CREATE" as "CREATE" | "UPDATE" | "UPSERT" };
    assert.ok((await catalog.previewRetailImport(context, createWithId)).counts.invalidRows > 0, "CREATE rejects product ids");
    const updateWithoutId = { ...csv([{ ...rows[0]!, product_key: `not-existing-${suffix}`, product_name: "Invalid update", sku: "00999001" }]), mode: "UPDATE" as const };
    assert.ok((await catalog.previewRetailImport(context, updateWithoutId)).counts.invalidRows > 0, "UPDATE requires a same-tenant product id");
    const productCountBeforeInvalidExecute = await db.product.count({ where: { organizationId: organization.id } });
    const invalidExecutePreview = await catalog.previewRetailImport(context, { ...input, content: spreadsheet.writeRetailSpreadsheet(invalidNumbers, "CSV").toString("utf8") });
    await assert.rejects(() => catalog.executeRetailImport(context, {
      ...input, content: spreadsheet.writeRetailSpreadsheet(invalidNumbers, "CSV").toString("utf8"),
      token: invalidExecutePreview.token, idempotencyKey: randomUUID(), confirmed: true,
    }), (error: unknown) => error instanceof ApiError && error.status === 400);
    assert.equal(await db.product.count({ where: { organizationId: organization.id } }), productCountBeforeInvalidExecute, "invalid execution rolls back catalog writes");

    const exportBefore = await catalog.downloadRetailCatalog(context, "template", "CSV");
    assert.ok(Buffer.isBuffer(exportBefore) && exportBefore.toString("utf8").includes("product_key"));
    const xlsxInput = { format: "XLSX" as const, content: spreadsheet.writeRetailSpreadsheet(rows, "XLSX").toString("base64"), mode: "CREATE" as "CREATE" | "UPDATE" | "UPSERT" };
    assert.equal((await catalog.previewRetailImport(context, xlsxInput)).counts.variantsCreate, 6);
    const xlsxCreateInput = { format: "XLSX" as const, content: spreadsheet.writeRetailSpreadsheet([{
      product_key: `xlsx-shirt-${suffix}`, product_name: "XLSX پیراهن", slug: `r3-xlsx-${suffix}`, category_id: category.id,
      variant_name: "Small", sku: `000X${suffix}`, price_toman: "2500", stock: "4", "attribute:color": "قرمز", "attribute:size": "1",
    }], "XLSX").toString("base64"), mode: "CREATE" as "CREATE" | "UPDATE" | "UPSERT" };
    const xlsxCreatePreview = await catalog.previewRetailImport(managerContext, xlsxCreateInput);
    const xlsxCreated = await catalog.executeRetailImport(managerContext, { ...xlsxCreateInput, token: xlsxCreatePreview.token, idempotencyKey: randomUUID(), confirmed: true });
    jobIds.push(xlsxCreated.jobId);
    const xlsxProduct = await db.product.findFirstOrThrow({ where: { organizationId: organization.id, slug: `r3-xlsx-${suffix}` }, include: { variants: true } });
    productIds.push(xlsxProduct.id);
    assert.equal(xlsxProduct.variants[0]?.sku, `000X${suffix}`, "XLSX execution preserves SKU text and leading zeros");

    const idempotencyKey = randomUUID();
    const executed = await catalog.executeRetailImport(managerContext, { ...input, token: preview.token, idempotencyKey, confirmed: true });
    jobIds.push(executed.jobId);
    assert.equal(executed.status, "COMPLETED");
    assert.equal(executed.counts.variantsCreate, 6);
    const replay = await catalog.executeRetailImport(managerContext, { ...input, token: preview.token, idempotencyKey, confirmed: true });
    assert.equal(replay.jobId, executed.jobId);
    await assert.rejects(() => catalog.executeRetailImport(context, {
      ...csv([{ ...rows[0]!, product_name: "Different payload" }]), token: preview.token, idempotencyKey, confirmed: true,
    }), (error: unknown) => error instanceof ApiError && error.status === 409);

    const product = await db.product.findFirstOrThrow({ where: { organizationId: organization.id, slug: `r3-shirt-${suffix}` }, include: { variants: { include: { optionValues: { include: { definition: true } }, galleryImages: true, inventoryMovements: true } } } });
    productIds.push(product.id);
    assert.equal(product.name, "پیراهن آزمایشی");
    assert.equal(product.variants.length, 6);
    const productWithAttributes = await db.product.findUniqueOrThrow({ where: { id: product.id }, include: { attributeValues: { include: { definition: true } } } });
    assert.ok(productWithAttributes.attributeValues.some((attribute) => attribute.definition.key === "material" && attribute.valueText === "پنبه"));
    assert.ok(product.variants.some((variant) => variant.sku?.startsWith("00")), "leading zero SKU is retained");
    assert.ok(product.variants.some((variant) => variant.inventoryMovements.some((movement) => movement.reason === "INITIAL_STOCK")));

    const orderVariant = product.variants[0]!;
    const snapshotOrder = await db.order.create({ data: {
      orderNumber: `R3-${suffix}`, type: "PICK_UP", status: "PENDING", subtotal: 1000, deliveryFee: 0, tax: 0, discount: 0, total: 1000,
      organizationSlug: slug, customerId: admin.id, notes: "synthetic historical snapshot",
      items: { create: [{ productId: product.id, variantId: orderVariant.id, quantity: 1, price: 1000,
        productNameSnapshot: product.name, skuSnapshot: orderVariant.sku, variantNameSnapshot: orderVariant.name,
        variantOptionsSnapshot: orderVariant.optionValues.map((option) => ({ key: option.definition.key, label: option.definition.label, value: option.valueText ?? option.valueNumber?.toString() ?? option.valueBoolean })),
      }] },
    }, include: { items: true } });
    orderIds.push(snapshotOrder.id);
    const historicSnapshotBefore = JSON.stringify({ notes: snapshotOrder.notes, type: snapshotOrder.type, total: snapshotOrder.total.toString(), items: snapshotOrder.items.map((item) => ({
      productId: item.productId, variantId: item.variantId, price: item.price.toString(), productNameSnapshot: item.productNameSnapshot,
      skuSnapshot: item.skuSnapshot, variantNameSnapshot: item.variantNameSnapshot, variantOptionsSnapshot: item.variantOptionsSnapshot,
    })) });
    const galleryExport = await catalog.downloadRetailCatalog(context, "export", "CSV");
    const roundTrip = spreadsheet.readRetailSpreadsheet({ format: "CSV", content: galleryExport.toString("utf8"), mode: "UPDATE" });
    const roundTripProduct = roundTrip.filter((row) => row.data.product_id === product.id);
    assert.equal(roundTripProduct.length, 6);
    assert.equal(new Set(roundTripProduct.map((row) => row.data.variant_id)).size, 6, "export/re-import rows retain stable product and variant ids");
    assert.ok(roundTripProduct.some((row) => row.data["attribute:color"] === "قرمز" && row.data.color_image_ids === redImage.id));
    assert.ok(roundTripProduct.every((row) => row.data["product_attribute:material"] === "پنبه"), "product-scoped attributes survive export/re-import");
    assert.ok(roundTripProduct.some((row) => row.data.gallery_mode === "OVERRIDE" && row.data.variant_image_ids === productImage.id));
    assert.ok(roundTripProduct.some((row) => row.data.gallery_mode === "INHERIT"));

    const firstVariant = product.variants[0]!;
    const updateCannotCreate=await catalog.previewRetailImport(context,{...csv([{product_id:product.id,sku:"NEW-IN-UPDATE-"+suffix,price_toman:"1000",stock:"1"}]),mode:"UPDATE"});
    assert.equal(updateCannotCreate.counts.variantsCreate,0);
    assert.ok(updateCannotCreate.counts.invalidRows>0,"UPDATE-only must not insert a new variant");
    const changedRows = [{ product_id: product.id, product_name: "", variant_id: firstVariant.id, price_toman: "1777" }];
    const changedInput = { ...csv(changedRows), mode: "UPDATE" as const };
    const changePreview = await catalog.previewRetailImport(managerContext, changedInput);
    assert.equal(changePreview.counts.variantsUpdate, 1);
    assert.equal(changePreview.rows[0].values.product_name,product.name,"minimal update files must identify the existing product for merchant review");
    assert.equal(changePreview.rows[0].sku,firstVariant.sku);
    assert.equal(changePreview.rows[0].values.stock,String(firstVariant.inventory),"omitted inventory is displayed as retained, not an invented count");
    const changedResult = await catalog.executeRetailImport(managerContext, {
      ...changedInput, token: changePreview.token, idempotencyKey: randomUUID(), confirmed: true,
    });
    jobIds.push(changedResult.jobId);
    const updated = await db.product.findUniqueOrThrow({ where: { id: product.id }, include: { variants: { include: { inventoryMovements: true } } } });
    assert.equal(updated.name, "پیراهن آزمایشی", "omitted product name is preserved");
    assert.equal(updated.image, `https://example.test/r3-${suffix}-product.jpg`, "omitted product media is preserved");
    assert.equal(updated.variants.find((variant) => variant.id === firstVariant.id)?.inventory, firstVariant.inventory, "omitted stock is preserved");
    assert.equal(updated.variants.find((variant) => variant.id === firstVariant.id)?.price?.toNumber(), 1777);
    assert.equal(updated.variants.find((variant) => variant.id === firstVariant.id)?.inventoryMovements.some((movement) => movement.reason === "MANUAL_ADJUSTMENT"), false,
      "price-only update does not create a stock ledger entry");

    const stockInput = { ...csv([{ product_id: product.id, variant_id: firstVariant.id, stock: String(firstVariant.inventory + 2) }]), mode: "UPDATE" as const };
    const stockPreview = await catalog.previewRetailImport(managerContext, stockInput);
    const stockResult = await catalog.executeRetailImport(managerContext, { ...stockInput, token: stockPreview.token, idempotencyKey: randomUUID(), confirmed: true });
    jobIds.push(stockResult.jobId);
    const afterStockChange = await db.productVariant.findUniqueOrThrow({ where: { id: firstVariant.id }, include: { inventoryMovements: true } });
    assert.equal(afterStockChange.inventory, firstVariant.inventory + 2);
    const adjustment = afterStockChange.inventoryMovements.find((movement) => movement.reason === "MANUAL_ADJUSTMENT");
    assert.ok(adjustment, "stock adjustments are recorded as manual adjustments");

    const clearInput = { ...csv([{ product_id: product.id, brand: "[[CLEAR]]" }]), mode: "UPDATE" as const };
    await db.product.update({ where: { id: product.id }, data: { brand: "Synthetic Brand" } });
    const clearPreview = await catalog.previewRetailImport(managerContext, clearInput);
    const clearResult = await catalog.executeRetailImport(managerContext, { ...clearInput, token: clearPreview.token, idempotencyKey: randomUUID(), confirmed: true });
    jobIds.push(clearResult.jobId);
    assert.equal((await db.product.findUniqueOrThrow({ where: { id: product.id }, select: { brand: true } })).brand, null,
      "[[CLEAR]] explicitly clears an optional field");

    const upsertInput={...csv([
      {product_id:product.id,brand:"برند ویرایش‌شده"} as Record<string,string>,
      {product_key:"UPSERT-"+suffix,product_name:"نمونه ایجاد ترکیبی",category_id:category.id,sku:"00-UP-"+suffix,price_toman:"۱۲۳۴.۵۰",stock:"۰"} as Record<string,string>,
    ]),mode:"UPSERT" as const};
    const upsertPreview=await catalog.previewRetailImport(context,upsertInput);
    assert.equal(upsertPreview.counts.invalidRows,0);
    assert.equal(upsertPreview.counts.productsCreate,1);
    assert.equal(upsertPreview.counts.productsUpdate,1);
    const upsertRun=await catalog.executeRetailImport(context,{...upsertInput,token:upsertPreview.token,idempotencyKey:randomUUID(),confirmed:true});
    jobIds.push(upsertRun.jobId);
    const upsertProduct=await db.product.findFirstOrThrow({where:{organizationId:organization.id,slug:("UPSERT-"+suffix).toLowerCase()},include:{variants:true}});
    productIds.push(upsertProduct.id);
    assert.equal(upsertProduct.isActive,false);
    assert.equal(upsertProduct.variants[0].price?.toString(),"1234.5");
    assert.equal((await db.product.findUniqueOrThrow({where:{id:product.id}})).brand,"برند ویرایش‌شده");
    const repeatedCreate=await catalog.previewRetailImport(context,upsertInput);
    assert.ok(repeatedCreate.counts.invalidRows>0,"a new request with an existing normalized key must not create a suffixed duplicate");

    const stableExport = await catalog.downloadRetailCatalog(context, "export", "CSV");
    const stableExportInput = { format: "CSV" as const, content: stableExport.toString("utf8"), mode: "UPDATE" as const };
    const stableExportPreview = await catalog.previewRetailImport(managerContext, stableExportInput);
    assert.equal(stableExportPreview.counts.productsCreate, 0);
    assert.equal(stableExportPreview.counts.variantsCreate, 0, "re-importing an export must not duplicate variants");
    const movementCountBeforeExportReimport = await db.inventoryMovement.count({ where: { variantId: { in: product.variants.map((variant) => variant.id) } } });
    const stableExportRun = await catalog.executeRetailImport(managerContext, {
      ...stableExportInput, token: stableExportPreview.token, idempotencyKey: randomUUID(), confirmed: true,
    });
    jobIds.push(stableExportRun.jobId);
    const stableAfterReimport = await db.product.findUniqueOrThrow({ where: { id: product.id }, include: { variants: true } });
    assert.equal(stableAfterReimport.id, product.id);
    assert.deepEqual(stableAfterReimport.variants.map((variant) => variant.id).sort(), product.variants.map((variant) => variant.id).sort());
    assert.equal(await db.inventoryMovement.count({ where: { variantId: { in: product.variants.map((variant) => variant.id) } } }), movementCountBeforeExportReimport,
      "export round-trip does not duplicate stock movement records");

    const historicSnapshotAfterOrder = await db.order.findUniqueOrThrow({ where: { id: snapshotOrder.id }, include: { items: true } });
    const historicSnapshotAfter = JSON.stringify({ notes: historicSnapshotAfterOrder.notes, type: historicSnapshotAfterOrder.type, total: historicSnapshotAfterOrder.total.toString(), items: historicSnapshotAfterOrder.items.map((item) => ({
      productId: item.productId, variantId: item.variantId, price: item.price.toString(), productNameSnapshot: item.productNameSnapshot,
      skuSnapshot: item.skuSnapshot, variantNameSnapshot: item.variantNameSnapshot, variantOptionsSnapshot: item.variantOptionsSnapshot,
    })) });
    assert.equal(historicSnapshotAfter, historicSnapshotBefore, "catalog imports preserve historical order item snapshots and order data");

    const staleInput = { ...changedInput, content: spreadsheet.writeRetailSpreadsheet([{ ...changedRows[0]!, price_toman: "1888" }], "CSV").toString("utf8") };
    const stalePreview = await catalog.previewRetailImport(context, staleInput);
    await db.productVariant.update({ where: { id: firstVariant.id }, data: { inventory: firstVariant.inventory + 1 } });
    await assert.rejects(() => catalog.executeRetailImport(context, {
      ...staleInput, token: stalePreview.token, idempotencyKey: randomUUID(), confirmed: true,
    }), (error: unknown) => error instanceof ApiError && error.status === 409);
    await db.productVariant.update({ where: { id: firstVariant.id }, data: { inventory: firstVariant.inventory } });

    const concurrentStockBefore=(await db.productVariant.findUniqueOrThrow({where:{id:firstVariant.id}})).inventory;
    const concurrentMovementsBefore=await db.inventoryMovement.count({where:{variantId:firstVariant.id,reason:"MANUAL_ADJUSTMENT"}});
    const conflictRowsA = [{ product_id: product.id, variant_id: firstVariant.id, stock: String(concurrentStockBefore+1) }];
    const conflictRowsB = [{ product_id: product.id, variant_id: firstVariant.id, stock: String(concurrentStockBefore+2) }];
    const conflictA = csv(conflictRowsA); conflictA.mode = "UPDATE";
    const conflictB = csv(conflictRowsB); conflictB.mode = "UPDATE";
    const [previewA, previewB] = await Promise.all([catalog.previewRetailImport(context, conflictA), catalog.previewRetailImport(context, conflictB)]);
    let releaseOrgLock!: () => void;
    let confirmOrgLock!: () => void;
    const orgLocked = new Promise<void>((resolve) => { confirmOrgLock = resolve; });
    const lockRelease = new Promise<void>((resolve) => { releaseOrgLock = resolve; });
    const locker = db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Organization" WHERE "id"=${organization.id} FOR UPDATE`;
      confirmOrgLock();
      await lockRelease;
    }, { timeout: 15000 });
    await orgLocked;
    const concurrentPromises = [
      catalog.executeRetailImport(context, { ...conflictA, token: previewA.token, idempotencyKey: randomUUID(), confirmed: true }),
      catalog.executeRetailImport(context, { ...conflictB, token: previewB.token, idempotencyKey: randomUUID(), confirmed: true }),
    ];
    let lockWaiters = 0;
    const barrierDeadline = Date.now() + 5000;
    try {
      while (Date.now() < barrierDeadline) {
        const rows = await db.$queryRaw<Array<{ waiting: number }>>`
          SELECT count(*)::int AS waiting FROM pg_stat_activity
          WHERE datname=current_database() AND wait_event_type='Lock'
            AND query ILIKE '%Organization%' AND query ILIKE '%FOR UPDATE%'`;
        lockWaiters = rows[0]?.waiting ?? 0;
        if (lockWaiters >= 2) break;
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
    } finally {
      releaseOrgLock();
    }
    await locker;
    assert.ok(lockWaiters >= 2, `both imports must be observably blocked on the organization lock (observed ${lockWaiters})`);
    const concurrent = await Promise.allSettled(concurrentPromises);
    const fulfilled = concurrent.filter((result) => result.status === "fulfilled");
    const rejected = concurrent.filter((result) => result.status === "rejected");
    assert.equal(fulfilled.length, 1);
    assert.equal(rejected.length, 1);
    assert.ok(rejected[0]!.status === "rejected" && rejected[0]!.reason instanceof ApiError && rejected[0]!.reason.status === 409);
    assert.ok([concurrentStockBefore+1,concurrentStockBefore+2].includes((await db.productVariant.findUniqueOrThrow({where:{id:firstVariant.id}})).inventory));
    assert.equal(await db.inventoryMovement.count({where:{variantId:firstVariant.id,reason:"MANUAL_ADJUSTMENT"}}),concurrentMovementsBefore+1,"only the committed concurrent stock update creates a ledger entry");
    const concurrentJob = fulfilled[0] as PromiseFulfilledResult<{ jobId: string }>;
    jobIds.push(concurrentJob.value.jobId);
    const jobAudit = await db.auditLog.findFirst({ where: { entityId: executed.jobId, entityType: "ExternalImportJob", organizationId: organization.id } });
    assert.equal((jobAudit?.newValue as Record<string, unknown>)?.contract, "RETAIL_R3");
  } finally {
    if (orderIds.length) {
      await db.orderStatusHistory.deleteMany({ where: { orderId: { in: orderIds } } });
      await db.inventoryMovement.deleteMany({ where: { orderId: { in: orderIds } } });
      await db.payment.deleteMany({ where: { orderId: { in: orderIds } } });
      await db.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
      await db.order.deleteMany({ where: { id: { in: orderIds } } });
    }
    if (jobIds.length) {
      await db.importedProductDraft.deleteMany({ where: { jobId: { in: jobIds } } });
      await db.externalImportJob.deleteMany({ where: { id: { in: jobIds } } });
    }
    if (organizationIds.length) {
      await db.auditLog.deleteMany({ where: { organizationId: { in: organizationIds } } });
    }
    if (productIds.length) await db.product.deleteMany({ where: { id: { in: productIds } } });
    if (imageIds.length) await db.image.deleteMany({ where: { id: { in: imageIds } } });
    if (definitionIds.length) await db.retailAttributeDefinition.deleteMany({ where: { id: { in: definitionIds } } });
    if (categoryIds.length) await db.productCategory.deleteMany({ where: { id: { in: categoryIds } } });
    if (organizationIds.length) {
      await db.organizationCapability.deleteMany({ where: { organizationId: { in: organizationIds } } });
      await db.organization.deleteMany({ where: { id: { in: organizationIds } } });
    }
    if (userIds.length) await db.user.deleteMany({ where: { id: { in: userIds } } });
    await db.$disconnect();
  }
});
