import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
import { mock, test } from "node:test";

const enabled = process.env.RETAIL_R3_CAPACITY_PG_ACCEPTANCE === "1";

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

test("Retail R3 capacity, idempotency, update ledger, and CSV/XLSX round trip", {
  skip: !enabled,
  concurrency: false,
}, async () => {
  assertGuardedDatabase();
  mock.module("next/cache", { namedExports: { revalidatePath: () => undefined, revalidateTag: () => undefined } });

  const hadNextAuthSecret = Object.hasOwn(process.env, "NEXTAUTH_SECRET");
  const priorNextAuthSecret = process.env.NEXTAUTH_SECRET;
  process.env.NEXTAUTH_SECRET ||= randomUUID();

  const { PrismaClient } = await import("@prisma/client");
  const db = new PrismaClient({ log: ["error"] });
  let simulatedTransport = false;
  let currentOperationCount = 0;
  let failVariantCreateManyAtFifthCall = false;
  let variantCreateManyCount = 0;
  const injectedPrisma = db.$extends({
    query: {
      async $allOperations({ model, operation, query, args }) {
        if (simulatedTransport) {
          currentOperationCount++;
          await new Promise((resolve) => setTimeout(resolve, 40));
        }
        if (failVariantCreateManyAtFifthCall && model === "ProductVariant" && operation === "createMany") {
          variantCreateManyCount++;
          if (variantCreateManyCount === 5) throw new Error("synthetic failure after fifth ProductVariant.createMany");
        }
        return query(args);
      },
    },
  });
  (globalThis as unknown as { bazarBazPrisma: typeof injectedPrisma | undefined }).bazarBazPrisma = injectedPrisma;
  const [catalog, spreadsheet] = await Promise.all([
    import("@/lib/import-hub/retail-catalog.server"),
    import("@/lib/import-hub/retail-spreadsheet"),
  ]);
  const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
  const organizationIds: string[] = [];
  const userIds: string[] = [];
  const categoryIds: string[] = [];
  const definitionIds: string[] = [];
  const timings: Record<string, number> = {};
  const operationCounts: Record<string, number> = {};
  let benchmarkOutput: Record<string, unknown> | undefined;
  const jobIds: string[] = [];
  const contextFor = new Map<string, { organizationId: string; organizationSlug: string; actorUserId: string; role: "ADMIN" }>();

  const csvInput = (rows: Record<string, string>[], mode: "CREATE" | "UPDATE") => ({
    format: "CSV" as const,
    content: spreadsheet.writeRetailSpreadsheet(rows, "CSV").toString("utf8"),
    mode,
  });
  const xlsxInput = (bytes: Buffer, mode: "CREATE" | "UPDATE") => ({
    format: "XLSX" as const,
    content: bytes.toString("base64"),
    mode,
  });
  const time = async <T>(name: string, run: () => Promise<T>): Promise<T> => {
    const started = performance.now();
    try {
      return await run();
    } finally {
      timings[name] = Math.round((performance.now() - started) * 100) / 100;
    }
  };
  const rowsFor = (stage: "shoe120" | "shoe120Alt" | "shoe120Failure" | "shoe500", categoryId: string, sizeCount: number) => {
    const rows: Record<string, string>[] = [];
    for (let product = 1; product <= 10; product++) {
      for (const [color, colorCode] of [["Black", "B"], ["White", "W"]]) {
        for (let size = 1; size <= sizeCount; size++) {
          const productKey = `${stage}-${String(product).padStart(2, "0")}`;
          rows.push({
            product_key: productKey,
            product_name: `Synthetic ${stage} shoe ${String(product).padStart(2, "0")}`,
            slug: `r3-${suffix}-${productKey}`,
            category_id: categoryId,
            variant_name: `${color} ${size}`,
            sku: `R3${suffix}${stage === "shoe120" ? "A" : stage === "shoe120Alt" ? "C" : stage === "shoe120Failure" ? "D" : "B"}${String(product).padStart(2, "0")}${colorCode}${String(size).padStart(3, "0")}`,
            price_toman: String(250000 + product * 100 + size),
            stock: "5",
            track_inventory: "true",
            allow_backorder: "false",
            "attribute:color": color,
            "attribute:size": String(size),
          });
        }
      }
    }
    return rows;
  };
  const timeWithTransport = async <T>(name: string, run: () => Promise<T>): Promise<T> => {
    const started = performance.now();
    currentOperationCount = 0;
    simulatedTransport = true;
    try {
      return await run();
    } finally {
      timings[name] = Math.round((performance.now() - started) * 100) / 100;
      operationCounts[name] = currentOperationCount;
      simulatedTransport = false;
    }
  };
  const execute = async (
    context: { organizationId: string; organizationSlug: string; actorUserId: string; role: "ADMIN" },
    input: ReturnType<typeof csvInput> | ReturnType<typeof xlsxInput>,
    name: string,
    idempotencyKey = randomUUID(),
    simulateTransport = false,
  ) => {
    const measure = simulateTransport ? timeWithTransport : time;
    const preview = await measure(`${name}.previewMs`, () => catalog.previewRetailImport(context, input));
    const result = await measure(`${name}.executeMs`, () => catalog.executeRetailImport(context, {
      ...input, token: preview.token, idempotencyKey, confirmed: true,
    }));
    jobIds.push(result.jobId);
    return { preview, result };
  };

  try {
    const identity = await db.$queryRaw<Array<{ database: string; username: string; version_num: number }>>`
      SELECT current_database() AS database, current_user AS username, current_setting('server_version_num')::int AS version_num`;
    assert.equal(identity[0]?.database, "retail_p0_20261019");
    assert.match(identity[0]?.username ?? "", /^consol_[a-f0-9]+$/);
    assert.ok(identity[0]!.version_num >= 160000 && identity[0]!.version_num < 170000);

    const [organization120, organization500] = await Promise.all([
      db.organization.create({ data: { name: `Retail R3 capacity 120 ${suffix}`, slug: `r3-cap-120-${suffix}`, type: "SHOP", capabilitiesInitializedAt: new Date() } }),
      db.organization.create({ data: { name: `Retail R3 capacity 500 ${suffix}`, slug: `r3-cap-500-${suffix}`, type: "SHOP", capabilitiesInitializedAt: new Date() } }),
    ]);
    organizationIds.push(organization120.id, organization500.id);
    await db.organizationCapability.createMany({ data: organizationIds.map((organizationId) => ({ organizationId, key: "SHOP" as const, status: "ACTIVE" as const, enabledAt: new Date() })) });
    const admin = await db.user.create({ data: { name: `retail-r3-capacity-${suffix}`, email: `retail-r3-capacity-${suffix}@example.test`, password: "synthetic-only", role: "ADMIN" } });
    userIds.push(admin.id);

    for (const organization of [organization120, organization500]) {
      const slug = organization.slug;
      const context = { organizationId: organization.id, organizationSlug: slug, actorUserId: admin.id, role: "ADMIN" as const };
      contextFor.set(organization.id, context);
      const category = await db.productCategory.create({ data: { name: `R3 synthetic shoes ${slug}`, slug: `r3-shoes-${slug}`, organizationId: organization.id, organizationSlug: slug } });
      categoryIds.push(category.id);
      const [color, size] = await Promise.all([
        db.retailAttributeDefinition.create({ data: { organizationId: organization.id, key: "color", label: "Color", scope: "VARIANT_OPTION", valueType: "ENUM", allowedValues: ["Black", "White"] } }),
        db.retailAttributeDefinition.create({ data: { organizationId: organization.id, key: "size", label: "Size", scope: "VARIANT_OPTION", valueType: "NUMBER" } }),
      ]);
      definitionIds.push(color.id, size.id);
    }

    const context120 = contextFor.get(organization120.id)!;
    const initialRows = rowsFor("shoe120", categoryIds[0]!, 6);
    assert.equal(initialRows.length, 120);
    const initialInput = csvInput(initialRows, "CREATE");
    const initialKey = randomUUID();
    const initialPreview = await timeWithTransport("initial120.previewMs", () => catalog.previewRetailImport(context120, initialInput));
    assert.equal(initialPreview.counts.productsCreate, 10);
    assert.equal(initialPreview.counts.variantsCreate, 120);
    assert.equal(initialPreview.counts.invalidRows, 0);
    const initialResult = await timeWithTransport("initial120.executeMs", () => catalog.executeRetailImport(context120, {
      ...initialInput, token: initialPreview.token, idempotencyKey: initialKey, confirmed: true,
    }));
    assert.ok(timings["initial120.executeMs"]! < 80_000, `120-variant execution exceeded 80 seconds with simulated 40 ms per ORM operation (${timings["initial120.executeMs"]} ms)`);
    jobIds.push(initialResult.jobId);
    assert.equal(initialResult.status, "COMPLETED");
    assert.equal(initialResult.counts.productsCreate, 10);
    assert.equal(initialResult.counts.variantsCreate, 120);
    const initialProducts = await db.product.findMany({ where: { organizationId: organization120.id }, include: { variants: { include: { optionValues: { include: { definition: true } } } } } });
    assert.equal(initialProducts.length, 10);
    assert.equal(initialProducts.reduce((count, product) => count + product.variants.length, 0), 120);
    const initialVariantIds = initialProducts.flatMap((product) => product.variants.map((variant) => variant.id));
    assert.equal(await db.inventoryMovement.count({ where: { variantId: { in: initialVariantIds }, reason: "INITIAL_STOCK" } }), 120);

    const replay = await time("initial120.idempotentReplayMs", () => catalog.executeRetailImport(context120, {
      ...initialInput, token: initialPreview.token, idempotencyKey: initialKey, confirmed: true,
    }));
    jobIds.push(replay.jobId);
    assert.equal(replay.jobId, initialResult.jobId);
    assert.equal(await db.product.count({ where: { organizationId: organization120.id } }), 10);

    const [priceTarget, stockTarget] = initialProducts.flatMap((product) => product.variants).slice(0, 2);
    assert.ok(priceTarget && stockTarget);
    const updateRows = [
      { product_id: initialProducts.find((product) => product.variants.some((variant) => variant.id === priceTarget.id))!.id, variant_id: priceTarget.id, price_toman: "399999" },
      { product_id: initialProducts.find((product) => product.variants.some((variant) => variant.id === stockTarget.id))!.id, variant_id: stockTarget.id, stock: "9" },
    ];
    const updateInput = csvInput(updateRows, "UPDATE");
    const update = await execute(context120, updateInput, "selectedUpdate", randomUUID(), true);
    assert.ok(timings["selectedUpdate.executeMs"]! < 80_000, `selected update exceeded 80 seconds with simulated 40 ms per ORM operation (${timings["selectedUpdate.executeMs"]} ms)`);
    assert.equal(update.preview.counts.variantsUpdate, 2);
    assert.equal(update.preview.counts.invalidRows, 0);
    const changedVariants = await db.productVariant.findMany({ where: { id: { in: [priceTarget.id, stockTarget.id] } }, include: { inventoryMovements: true } });
    assert.equal(changedVariants.find((variant) => variant.id === priceTarget.id)?.price?.toString(), "399999");
    assert.equal(changedVariants.find((variant) => variant.id === stockTarget.id)?.inventory, 9);
    assert.equal(await db.inventoryMovement.count({ where: { variantId: { in: initialVariantIds }, reason: "INITIAL_STOCK" } }), 120);
    assert.equal(await db.inventoryMovement.count({ where: { variantId: { in: initialVariantIds }, reason: "MANUAL_ADJUSTMENT" } }), 1,
      "only the changed stock row adds a ledger movement; changing price adds none");

    const unchanged120Export = await catalog.downloadRetailCatalog(context120, "export", "CSV");
    const unchanged120Input = { format: "CSV" as const, content: unchanged120Export.toString("utf8"), mode: "UPDATE" as const };
    const unchanged = await execute(context120, unchanged120Input, "unchanged120");
    assert.equal(unchanged.preview.counts.productsCreate, 0);
    assert.equal(unchanged.preview.counts.variantsCreate, 0);
    assert.equal(unchanged.preview.counts.variantsUpdate, 0);
    assert.equal(unchanged.preview.counts.invalidRows, 0);
    assert.equal(unchanged.preview.counts.unchanged, 120);
    assert.equal(await db.product.count({ where: { organizationId: organization120.id } }), 10);
    assert.equal((await db.productVariant.count({ where: { product: { organizationId: organization120.id } } })), 120);
    assert.equal(await db.inventoryMovement.count({ where: { variantId: { in: initialVariantIds } } }), 121,
      "unchanged import and idempotency replay add no stock movements");

    const rollbackRows = rowsFor("shoe120Failure", categoryIds[0]!, 6);
    const rollbackInput = csvInput(rollbackRows, "CREATE");
    const rollbackPreview = await catalog.previewRetailImport(context120, rollbackInput);
    assert.equal(rollbackPreview.counts.productsCreate, 10);
    assert.equal(rollbackPreview.counts.variantsCreate, 120);
    const rollbackBaseline = {
      products: await db.product.count({ where: { organizationId: organization120.id } }),
      variants: await db.productVariant.count({ where: { product: { organizationId: organization120.id } } }),
      jobs: await db.externalImportJob.count({ where: { organizationId: organization120.id, inputText: { startsWith: "retail-r3:" } } }),
      movements: await db.inventoryMovement.count({ where: { variantId: { in: initialVariantIds } } }),
    };
    variantCreateManyCount = 0;
    failVariantCreateManyAtFifthCall = true;
    try {
      await assert.rejects(() => catalog.executeRetailImport(context120, {
        ...rollbackInput, token: rollbackPreview.token, idempotencyKey: randomUUID(), confirmed: true,
      }), /synthetic failure after fifth ProductVariant\.createMany/);
    } finally {
      failVariantCreateManyAtFifthCall = false;
    }
    assert.equal(variantCreateManyCount, 5, "failure injection stops the write after the fifth variant batch");
    assert.deepEqual({
      products: await db.product.count({ where: { organizationId: organization120.id } }),
      variants: await db.productVariant.count({ where: { product: { organizationId: organization120.id } } }),
      jobs: await db.externalImportJob.count({ where: { organizationId: organization120.id, inputText: { startsWith: "retail-r3:" } } }),
      movements: await db.inventoryMovement.count({ where: { variantId: { in: initialVariantIds } } }),
    }, rollbackBaseline, "a mid-batch product variant failure rolls back products, variants, job, drafts, and ledger writes");

    const context500 = contextFor.get(organization500.id)!;
    const capacityRows = rowsFor("shoe500", categoryIds[1]!, 25);
    assert.equal(capacityRows.length, 500);
    const capacityInput = csvInput(capacityRows, "CREATE");
    const capacity = await execute(context500, capacityInput, "capacity500", randomUUID(), true);
    assert.ok(timings["capacity500.executeMs"]! < 80_000, `500-variant execution exceeded 80 seconds with simulated 40 ms per ORM operation (${timings["capacity500.executeMs"]} ms)`);
    assert.equal(capacity.preview.counts.productsCreate, 10);
    assert.equal(capacity.preview.counts.variantsCreate, 500);
    assert.equal(capacity.preview.counts.invalidRows, 0);
    assert.equal(await db.product.count({ where: { organizationId: organization500.id } }), 10);
    assert.equal(await db.productVariant.count({ where: { product: { organizationId: organization500.id } } }), 500);
    const capacityVariantIds = await db.productVariant.findMany({ where: { product: { organizationId: organization500.id } }, select: { id: true } }).then((variants) => variants.map((variant) => variant.id));
    const initialCapacityMovements = await db.inventoryMovement.count({ where: { variantId: { in: capacityVariantIds }, reason: "INITIAL_STOCK" } });
    assert.equal(initialCapacityMovements, 500);

    const capacityVariants = await db.productVariant.findMany({
      where: { id: { in: capacityVariantIds } },
      select: { id: true, productId: true, price: true, inventory: true },
    });
    const bulkUpdateRows = capacityVariants.map((variant) => ({
      product_id: variant.productId,
      variant_id: variant.id,
      price_toman: String(variant.price!.toNumber() + 1),
      stock: String(variant.inventory + 1),
    }));
    assert.equal(bulkUpdateRows.length, 500);
    const bulkUpdateInput = csvInput(bulkUpdateRows, "UPDATE");
    const bulkUpdateKey = randomUUID();
    const bulkUpdatePreview = await timeWithTransport("update500.previewMs", () => catalog.previewRetailImport(context500, bulkUpdateInput));
    assert.equal(bulkUpdatePreview.counts.variantsUpdate, 500);
    assert.equal(bulkUpdatePreview.counts.invalidRows, 0);
    const bulkUpdateResult = await timeWithTransport("update500.executeMs", () => catalog.executeRetailImport(context500, {
      ...bulkUpdateInput, token: bulkUpdatePreview.token, idempotencyKey: bulkUpdateKey, confirmed: true,
    }));
    jobIds.push(bulkUpdateResult.jobId);
    assert.ok(timings["update500.executeMs"]! < 80_000, `500-variant update exceeded 80 seconds with simulated 40 ms per ORM operation (${timings["update500.executeMs"]} ms)`);
    assert.equal(bulkUpdateResult.counts.variantsUpdate, 500);
    const updatedCapacityVariants = await db.productVariant.findMany({ where: { id: { in: capacityVariantIds } }, select: { id: true, price: true, inventory: true } });
    const expectedUpdates = new Map(capacityVariants.map((variant) => [variant.id, { price: variant.price!.toNumber() + 1, inventory: variant.inventory + 1 }]));
    for (const variant of updatedCapacityVariants) {
      const expected = expectedUpdates.get(variant.id)!;
      assert.equal(variant.price?.toNumber(), expected.price);
      assert.equal(variant.inventory, expected.inventory);
    }
    assert.equal(await db.inventoryMovement.count({ where: { variantId: { in: capacityVariantIds }, reason: "MANUAL_ADJUSTMENT" } }), 500,
      "each of the 500 changed stock rows writes one inventory adjustment");

    const bulkUpdateReplay = await catalog.executeRetailImport(context500, {
      ...bulkUpdateInput, token: bulkUpdatePreview.token, idempotencyKey: bulkUpdateKey, confirmed: true,
    });
    jobIds.push(bulkUpdateReplay.jobId);
    assert.equal(bulkUpdateReplay.jobId, bulkUpdateResult.jobId);
    const freshUnchangedPreview = await catalog.previewRetailImport(context500, bulkUpdateInput);
    assert.equal(freshUnchangedPreview.counts.unchanged, 500);
    assert.equal(freshUnchangedPreview.counts.variantsUpdate, 0);
    const freshUnchangedResult = await catalog.executeRetailImport(context500, {
      ...bulkUpdateInput, token: freshUnchangedPreview.token, idempotencyKey: randomUUID(), confirmed: true,
    });
    jobIds.push(freshUnchangedResult.jobId);
    assert.equal(freshUnchangedResult.counts.unchanged, 500);
    assert.equal(await db.inventoryMovement.count({ where: { variantId: { in: capacityVariantIds }, reason: "MANUAL_ADJUSTMENT" } }), 500,
      "idempotency replay and a fresh unchanged update add no movements");

    const csvExport = await time("exportCsvMs", () => catalog.downloadRetailCatalog(context500, "export", "CSV"));
    const xlsxExport = await time("exportXlsxMs", () => catalog.downloadRetailCatalog(context500, "export", "XLSX", 1));
    assert.ok(Buffer.isBuffer(csvExport));
    assert.ok(Buffer.isBuffer(xlsxExport));
    const csvRoundTripInput = { format: "CSV" as const, content: csvExport.toString("utf8"), mode: "UPDATE" as const };
    const xlsxRoundTripInput = xlsxInput(xlsxExport, "UPDATE");
    const csvRoundTrip = await execute(context500, csvRoundTripInput, "roundTripCsv");
    const xlsxRoundTrip = await execute(context500, xlsxRoundTripInput, "roundTripXlsx");
    for (const [label, roundTrip] of [["CSV", csvRoundTrip], ["XLSX", xlsxRoundTrip]] as const) {
      assert.equal(roundTrip.preview.counts.invalidRows, 0, `${label} export should be accepted on re-import`);
      assert.equal(roundTrip.preview.counts.productsCreate, 0, `${label} re-import should not create products`);
      assert.equal(roundTrip.preview.counts.variantsCreate, 0, `${label} re-import should not create variants`);
      assert.equal(roundTrip.preview.counts.variantsUpdate, 0, `${label} re-import should not update unchanged variants`);
      assert.equal(roundTrip.preview.counts.unchanged, 500);
    }
    assert.equal(await db.product.count({ where: { organizationId: organization500.id } }), 10);
    assert.equal(await db.productVariant.count({ where: { product: { organizationId: organization500.id } } }), 500);
    assert.equal(await db.inventoryMovement.count({ where: { variantId: { in: capacityVariantIds } } }), initialCapacityMovements + 500,
      "CSV and XLSX round trips preserve variant identity and create no ledger duplicates");

    const additionalRows = rowsFor("shoe120Alt", categoryIds[1]!, 6);
    assert.equal(additionalRows.length, 120);
    const additional = await execute(context500, csvInput(additionalRows, "CREATE"), "additional120");
    assert.equal(additional.preview.counts.productsCreate, 10);
    assert.equal(additional.preview.counts.variantsCreate, 120);
    assert.equal(additional.preview.counts.invalidRows, 0);
    assert.equal(await db.product.count({ where: { organizationId: organization500.id } }), 20);
    assert.equal(await db.productVariant.count({ where: { product: { organizationId: organization500.id } } }), 620);

    const templateCsv = await catalog.downloadRetailCatalog(context500, "template", "CSV");
    const templateRows = spreadsheet.readRetailSpreadsheet({ format: "CSV", content: templateCsv.toString("utf8"), mode: "CREATE" });
    assert.equal(templateRows.length, 12, "a shop with two colors and six numeric sizes receives twelve template variants");
    assert.deepEqual(new Set(templateRows.map((row) => row.data["attribute:color"])), new Set(["Black", "White"]));
    assert.equal(new Set(templateRows.map((row) => row.data["attribute:size"])).size, 6);

    const exportMetadata = await catalog.retailImportMetadata(context500);
    assert.equal(exportMetadata.exportAvailable, true);
    await assert.rejects(() => catalog.downloadRetailCatalog(context500, "export", "CSV", 1, "0".repeat(64)), /ترکیب کاتالوگ تغییر کرده/);
    assert.equal(exportMetadata.exportBatches.length, 2, "20 products and 620 variants are exported as deterministic compatible batches");
    assert.equal(exportMetadata.exportBatches.reduce((sum, batch) => sum + batch.products, 0), 20);
    assert.equal(exportMetadata.exportBatches.reduce((sum, batch) => sum + batch.rows, 0), 620);
    const allCapacityVariantIds = await db.productVariant.findMany({ where: { product: { organizationId: organization500.id } }, select: { id: true } }).then((variants) => variants.map((variant) => variant.id));
    const exportedIdsByFormat = new Map<string, string[]>();
    for (const format of ["CSV", "XLSX"] as const) {
      const ids: string[] = [];
      for (const batch of exportMetadata.exportBatches) {
        const bytes = batch.index === 1 && format === "CSV"
          ? await catalog.downloadRetailCatalog(context500, "export", format)
          : await catalog.downloadRetailCatalog(context500, "export", format, batch.index, exportMetadata.exportVersion);
        const input = format === "CSV"
          ? { format, content: bytes.toString("utf8"), mode: "UPDATE" as const }
          : xlsxInput(bytes, "UPDATE");
        const importedRows = spreadsheet.readRetailSpreadsheet(input);
        const batchIds = importedRows.map((row) => row.data.variant_id).filter((id): id is string => Boolean(id));
        assert.equal(batchIds.length, batch.rows, `${format} batch ${batch.index} exports the metadata row count`);
        ids.push(...batchIds);
        const roundTrip = await execute(context500, input, `batch${batch.index}${format}`);
        assert.equal(roundTrip.preview.counts.invalidRows, 0, `${format} batch ${batch.index} export should be accepted on re-import`);
        assert.equal(roundTrip.preview.counts.productsCreate, 0);
        assert.equal(roundTrip.preview.counts.variantsCreate, 0);
        assert.equal(roundTrip.preview.counts.variantsUpdate, 0);
        assert.equal(roundTrip.preview.counts.unchanged, batch.rows);
      }
      assert.equal(ids.length, 620);
      assert.equal(new Set(ids).size, 620, `${format} batches cover each stable variant id once`);
      assert.deepEqual([...ids].sort(), [...allCapacityVariantIds].sort(), `${format} batches cover the complete catalog`);
      exportedIdsByFormat.set(format, ids);
    }
    assert.equal(await db.product.count({ where: { organizationId: organization500.id } }), 20);
    assert.equal(await db.productVariant.count({ where: { product: { organizationId: organization500.id } } }), 620);
    assert.equal(await db.inventoryMovement.count({ where: { variantId: { in: allCapacityVariantIds } } }), initialCapacityMovements + 500 + 120,
      "re-importing each CSV and XLSX batch adds no inventory movements");

    benchmarkOutput = {
      event: "retail_r3_capacity_benchmark",
      status: "PASSED",
      rows: { initialCreate: 120, capacityCreate: 500, additionalCreate: 120, totalExportedPerFormat: 620 },
      persisted: { products120: initialProducts.length, variants120: initialVariantIds.length, products500Shop: 20, variants500Shop: 620 },
      ledger: { initial120: 120, changedStock120: 1, initial500: initialCapacityMovements, changedStock500: 500, additionalInitialStock: 120, exportReimportsAdded: 0 },
      exportBatches: exportMetadata.exportBatches,
      uniqueExportedIdsPerFormat: Object.fromEntries([...exportedIdsByFormat].map(([format, ids]) => [format, new Set(ids).size])),
      timingsMs: timings,
      ormOperationCounts: operationCounts,
      transportSimulation: { delayPerOrmOperationMs: 40, appliesTo: ["initial120", "selectedUpdate", "capacity500", "update500"], representsNeonTransportOverhead: false },
    };
  } finally {
    failVariantCreateManyAtFifthCall = false;
    let cleanupError: unknown;
    const cleanup = async <T,>(action: () => Promise<T>): Promise<T | undefined> => {
      try {
        return await action();
      } catch (error) {
        cleanupError ??= error;
      }
    };
    if (organizationIds.length) {
      const ownedJobs = await cleanup(async () => db.externalImportJob.findMany({ where: { organizationId: { in: organizationIds }, inputText: { startsWith: "retail-r3:" } }, select: { id: true } })) as Array<{ id: string }> | undefined;
      const allJobIds = [...new Set([...jobIds, ...(ownedJobs ?? []).map((job) => job.id)])];
      const variants = await cleanup(async () => db.productVariant.findMany({ where: { product: { organizationId: { in: organizationIds } } }, select: { id: true } })) as Array<{ id: string }> | undefined;
      const variantIds = (variants ?? []).map((variant) => variant.id);
      if (variantIds.length) await cleanup(() => db.inventoryMovement.deleteMany({ where: { variantId: { in: variantIds } } }));
      if (allJobIds.length) await cleanup(() => db.importedProductDraft.deleteMany({ where: { jobId: { in: allJobIds } } }));
      await cleanup(() => db.auditLog.deleteMany({ where: { organizationId: { in: organizationIds } } }));
      if (allJobIds.length) await cleanup(() => db.externalImportJob.deleteMany({ where: { id: { in: allJobIds } } }));
      await cleanup(() => db.product.deleteMany({ where: { organizationId: { in: organizationIds } } }));
      await cleanup(() => db.retailAttributeDefinition.deleteMany({ where: { id: { in: definitionIds } } }));
      await cleanup(() => db.productCategory.deleteMany({ where: { id: { in: categoryIds } } }));
      await cleanup(() => db.organizationCapability.deleteMany({ where: { organizationId: { in: organizationIds } } }));
      await cleanup(() => db.organization.deleteMany({ where: { id: { in: organizationIds } } }));
    }
    if (userIds.length) await cleanup(() => db.user.deleteMany({ where: { id: { in: userIds } } }));
    await cleanup(() => db.$disconnect());
    delete (globalThis as unknown as { bazarBazPrisma?: unknown }).bazarBazPrisma;
    if (hadNextAuthSecret) process.env.NEXTAUTH_SECRET = priorNextAuthSecret;
    else delete process.env.NEXTAUTH_SECRET;
    if (cleanupError) throw cleanupError;
  }
  assert.ok(benchmarkOutput, "benchmark output is assembled only after all capacity checks pass");
  process.stdout.write(`${JSON.stringify(benchmarkOutput)}\n`);
});
