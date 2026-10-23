import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
import { mock, test } from "node:test";

const enabled = process.env.RETAIL_R4_PG_ACCEPTANCE === "1";

function assertGuardedDatabase() {
  assert.equal(process.env.DATABASE_URL, process.env.DIRECT_URL);
  for (const key of ["DATABASE_URL", "DIRECT_URL"]) {
    const url = new URL(process.env[key] ?? "");
    assert.equal(url.protocol, "postgresql:");
    assert.ok(["127.0.0.1", "localhost"].includes(url.hostname));
    assert.equal(url.port, "54713");
    assert.equal(url.pathname, "/retail_p0_20261019");
    assert.match(decodeURIComponent(url.username), /^consol_[a-f0-9]+$/);
  }
}

type ListingInput = {
  organizationIdentifier: string; page: number; limit: number; q?: string; category?: string;
  filter?: string[]; minPrice?: number; maxPrice?: number; brand?: string; available?: boolean;
  sort?: "featured" | "price-asc" | "price-desc" | "name-asc" | "newest" | "relevance";
};

test("Retail R4 discovery search, facets, related products, pricing, and tenant isolation", {
  skip: !enabled,
  concurrency: false,
}, async () => {
  assertGuardedDatabase();
  mock.module("next/cache", { namedExports: { revalidatePath: () => undefined, revalidateTag: () => undefined } });

  const { PrismaClient } = await import("@prisma/client");
  const db = new PrismaClient({ log: ["error"] });
  let queryCount = 0;
  let countQueries = false;
  const measuredDb = db.$extends({ query: { async $allOperations({ query, args }) {
    if (countQueries) queryCount++;
    return query(args);
  } } });
  const existingGlobal = globalThis as typeof globalThis & { bazarBazPrisma?: unknown };
  const hadGlobalClient = Object.hasOwn(existingGlobal, "bazarBazPrisma");
  const priorGlobalClient = existingGlobal.bazarBazPrisma;
  existingGlobal.bazarBazPrisma = measuredDb;
  const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
  const organizationIds: string[] = [];
  const fixtureProductIds: string[] = [];
  const fixtureCategoryIds: string[] = [];
  const fixtureDefinitionIds: string[] = [];
  const fixtureImageIds: string[] = [];

  try {
    const catalog = await import("@/lib/public-catalog/service.server");
    const identity = await db.$queryRaw<Array<{ database: string; username: string }>>`
      SELECT current_database() AS database, current_user AS username`;
    assert.equal(identity[0]?.database, "retail_p0_20261019");
    assert.match(identity[0]?.username ?? "", /^consol_[a-f0-9]+$/);

    const shop = await db.organization.create({ data: {
      name: `R4 discovery ${suffix}`, slug: `r4-discovery-${suffix}`, type: "SHOP", capabilitiesInitializedAt: new Date(),
      capabilities: { create: { key: "SHOP", status: "ACTIVE", enabledAt: new Date() } },
    } });
    const foreignShop = await db.organization.create({ data: {
      name: `R4 discovery foreign ${suffix}`, slug: `r4-discovery-foreign-${suffix}`, type: "SHOP", capabilitiesInitializedAt: new Date(),
      capabilities: { create: { key: "SHOP", status: "ACTIVE", enabledAt: new Date() } },
    } });
    organizationIds.push(shop.id, foreignShop.id);

    const [shoes, accessories, foreignCategory] = await Promise.all([
      db.productCategory.create({ data: { organizationId: shop.id, organizationSlug: shop.slug, name: "کفش ورزشی", slug: `shoes-${suffix}` } }),
      db.productCategory.create({ data: { organizationId: shop.id, organizationSlug: shop.slug, name: "Accessories", slug: `accessories-${suffix}` } }),
      db.productCategory.create({ data: { organizationId: foreignShop.id, organizationSlug: foreignShop.slug, name: "کفش ورزشی", slug: `foreign-shoes-${suffix}` } }),
    ]);
    fixtureCategoryIds.push(shoes.id, accessories.id, foreignCategory.id);

    const [color, size, material, hiddenAttribute] = await Promise.all([
      db.retailAttributeDefinition.create({ data: { organizationId: shop.id, key: "color", label: "Color", localizedLabels: { fa: "رنگ" }, scope: "VARIANT_OPTION", valueType: "ENUM", allowedValues: ["red", "navy"], isFilterable: true } }),
      db.retailAttributeDefinition.create({ data: { organizationId: shop.id, key: "size", label: "Size", localizedLabels: { fa: "سایز" }, scope: "VARIANT_OPTION", valueType: "NUMBER", displayUnit: "EU", allowedValues: [37, 38, 39, 40, 41, 42], isFilterable: true } }),
      db.retailAttributeDefinition.create({ data: { organizationId: shop.id, key: "material", label: "Material", scope: "PRODUCT", valueType: "TEXT", isFilterable: true } }),
      db.retailAttributeDefinition.create({ data: { organizationId: shop.id, key: "internal_note", label: "Internal note", scope: "PRODUCT", valueType: "TEXT", isFilterable: false } }),
    ]);
    fixtureDefinitionIds.push(color.id, size.id, material.id, hiddenAttribute.id);

    const [publicImage, privateImage, foreignImage] = await Promise.all([
      db.image.create({ data: { organizationId: shop.id, url: `https://cdn.example.test/r4-public-${suffix}.webp`, filename: "public.webp", access: "PUBLIC" } }),
      db.image.create({ data: { organizationId: shop.id, url: `https://cdn.example.test/r4-private-${suffix}.webp`, filename: "private.webp", access: "PRIVATE" } }),
      db.image.create({ data: { organizationId: foreignShop.id, url: `https://cdn.example.test/r4-foreign-${suffix}.webp`, filename: "foreign.webp", access: "PUBLIC" } }),
    ]);
    fixtureImageIds.push(publicImage.id, privateImage.id, foreignImage.id);

    // Keep a substantial tenant catalog while using complete, explicit SKU rows.
    // The feature product intentionally has red/39 and navy/40 only; no implicit
    // Cartesian combination is valid for this product.
    const bulkProducts = await db.product.createMany({ data: Array.from({ length: 120 }, (_, index) => ({
      organizationId: shop.id, organizationSlug: shop.slug,
      categoryId: index === 0 || index % 4 !== 0 ? shoes.id : accessories.id,
      name: index === 0 ? "کفشِ  ۳۹ ورزشی‌آبی" : `Discovery shoe ${String(index + 1).padStart(3, "0")}`,
      slug: `discovery-${suffix}-${index + 1}`,
      brand: index === 0 ? "Acme Motion" : index % 3 === 0 ? "Northstar" : "Acme",
      description: index === 0 ? `کفش ورزشی‌آبی ${suffix} performance narrative` : `Synthetic catalog item ${index + 1}`,
      basePrice: index === 0 ? 250000 : 100000 + index * 1000,
      sku: `R4-DISC-${suffix}-${index + 1}`,
      isActive: true, trackInventory: true, sortOrder: index,
    })) });
    assert.equal(bulkProducts.count, 120);
    const products = await db.product.findMany({ where: { organizationId: shop.id, slug: { startsWith: `discovery-${suffix}-` } }, orderBy: { sortOrder: "asc" }, select: { id: true, slug: true, sortOrder: true } });
    fixtureProductIds.push(...products.map((product) => product.id));
    const feature = products[0]!;
    const featureName = (await db.product.findUniqueOrThrow({ where: { id: feature.id }, select: { name: true } })).name;

    const foreignProduct = await db.product.create({ data: {
      organizationId: foreignShop.id, organizationSlug: foreignShop.slug, categoryId: foreignCategory.id,
      name: `foreign OR leak ${suffix}`, slug: `foreign-${suffix}`, brand: "Acme Motion", description: `foreign-${suffix}`,
      basePrice: 210000, sku: `R4-FOR-${suffix}`, isActive: true, trackInventory: true,
    } });
    fixtureProductIds.push(foreignProduct.id);
    const draft = await db.product.create({ data: {
      organizationId: shop.id, organizationSlug: shop.slug, categoryId: shoes.id,
      name: `unpublished OR leak ${suffix}`, slug: `draft-${suffix}`, brand: "Acme Motion", description: `draft-${suffix}`,
      basePrice: 210000, sku: `R4-DRAFT-${suffix}`, isActive: false, trackInventory: true,
    } });
    fixtureProductIds.push(draft.id);
    const qaLabel = await db.product.create({ data: {
      organizationId: shop.id, organizationSlug: shop.slug, categoryId: shoes.id,
      name: `[QA] label ${suffix}`, slug: `qa-label-${suffix}`, brand: "Acme Motion", description: `qa-label-${suffix}`,
      basePrice: 210000, sku: `R4-QA-${suffix}`, isActive: true, trackInventory: true,
      variants: { create: { name: "QA label", sku: `R4-QA-V-${suffix}`, price: 210000, inventory: 1 } },
    } });
    fixtureProductIds.push(qaLabel.id);

    await db.productVariant.createMany({ data: products.map((product, index) => ({
      productId: product.id,
      name: index === 0 ? "Red / EU 39" : `Default ${index + 1}`,
      sku: `R4-DISC-V-${suffix}-${index + 1}`,
      price: index === 0 ? 210000 : 100000 + (index + 1) * 1000,
      inventory: 5, reservedQuantity: 0, allowBackOrder: false,
    })) });
    const fixtureVariants = await db.productVariant.findMany({ where: { productId: { in: products.map((product) => product.id) } }, select: { id: true, productId: true } });
    const fixtureVariantForProduct = new Map(fixtureVariants.map((variant) => [variant.productId, variant.id]));
    const optionValues = products.flatMap((product, index) => {
      const variantId = fixtureVariantForProduct.get(product.id)!;
      const colorValue = index % 2 === 0 ? "red" : "navy";
      const sizeValue = index === 0 ? 39 : 37 + (Math.floor(index / 2) % 6);
      return [
        { variantId, definitionId: color.id, valueText: colorValue },
        { variantId, definitionId: size.id, valueNumber: sizeValue },
      ];
    });
    await db.productVariantAttributeValue.createMany({ data: optionValues });
    const featureVariants = await db.productVariant.findMany({ where: { productId: feature.id }, select: { id: true, name: true } });
    const secondVariant = await db.productVariant.create({ data: { productId: feature.id, name: "Navy / EU 40", sku: `R4-DISC-NV-${suffix}`, price: 310000, inventory: 5 } });
    const unavailableVariant = await db.productVariant.create({ data: { productId: feature.id, name: "Red / EU 40", sku: `R4-DISC-OUT-${suffix}`, price: 410000, inventory: 1, reservedQuantity: 1 } });
    await db.productVariant.createMany({ data: [
      { productId: foreignProduct.id, name: "Foreign", sku: `R4-FOR-V-${suffix}`, price: 210000, inventory: 3 },
      { productId: draft.id, name: "Draft", sku: `R4-DRAFT-V-${suffix}`, price: 210000, inventory: 3 },
    ] });

    const trackedVariantIds = [featureVariants[0]!.id, secondVariant.id, unavailableVariant.id];
    await db.productVariantAttributeValue.createMany({ data: [
      { variantId: trackedVariantIds[1]!, definitionId: color.id, valueText: "navy" },
      { variantId: trackedVariantIds[1]!, definitionId: size.id, valueNumber: 40 },
      { variantId: trackedVariantIds[2]!, definitionId: color.id, valueText: "red" },
      { variantId: trackedVariantIds[2]!, definitionId: size.id, valueNumber: 40 },
    ] });
    await db.productAttributeValue.createMany({ data: [
      { productId: feature.id, definitionId: material.id, valueText: "technical-knit" },
      { productId: feature.id, definitionId: hiddenAttribute.id, valueText: `not-filterable-${suffix}` },
    ] });
    await db.product.update({ where: { id: feature.id }, data: { images: { connect: [{ id: publicImage.id }, { id: privateImage.id }, { id: foreignImage.id }] } } });

    const trackedFalse = await db.product.create({ data: {
      organizationId: shop.id, organizationSlug: shop.slug, categoryId: shoes.id, name: `Untracked ${suffix}`, slug: `untracked-${suffix}`,
      brand: "Acme", basePrice: 177000, sku: `R4-UNT-${suffix}`, trackInventory: false,
      variants: { create: { name: "Untracked option", sku: `R4-UNT-V-${suffix}`, price: 177000, inventory: 0 } },
    } });
    fixtureProductIds.push(trackedFalse.id);
    const backorder = await db.product.create({ data: {
      organizationId: shop.id, organizationSlug: shop.slug, categoryId: shoes.id, name: `Backorder ${suffix}`, slug: `backorder-${suffix}`,
      brand: "Acme", basePrice: 188000, sku: `R4-BACK-${suffix}`, trackInventory: true,
      variants: { create: { name: "Backorder option", sku: `R4-BACK-V-${suffix}`, price: 188000, inventory: 0, allowBackOrder: true } },
    } });
    fixtureProductIds.push(backorder.id);
    await db.productVariant.create({ data: { productId: foreignProduct.id, name: "OR predicate match", sku: `R4-OR-${suffix}`, price: 120000, inventory: 2 } });

    const list = (input: ListingInput) => catalog.listPublicCatalogProducts(input);
    const firstPage = await list({ organizationIdentifier: shop.slug, page: 1, limit: 50 });
    const secondPage = await list({ organizationIdentifier: shop.slug, page: 2, limit: 50 });
    assert.equal(firstPage.pagination.total, 123);
    assert.equal(new Set([...firstPage.products, ...secondPage.products].map((product) => product.id)).size, 100);
    assert.ok(![...firstPage.products, ...secondPage.products].some((product) => [foreignProduct.id, draft.id].includes(product.id)));
    const tenantOrProbe = await list({ organizationIdentifier: shop.slug, page: 1, limit: 20, q: suffix });
    assert.ok(!tenantOrProbe.products.some((product) => product.id === foreignProduct.id || product.id === draft.id), "tenant and publication predicates must guard OR search branches");

    const normalizedSearches = [featureName, "کفش ورزشی آبی", "كفشِ ورزشی‌ابی", "کفشِ  ورزشی آبی", "39", "۳۹"];
    for (const q of normalizedSearches) {
      const result = await list({ organizationIdentifier: shop.slug, page: 1, limit: 20, q });
      assert.ok(result.products.some((product) => product.id === feature.id), `normalized search did not find feature product for ${JSON.stringify(q)}`);
    }
    for (const q of ["Acme Motion", `performance narrative`, `R4-DISC-${suffix}-1`, `R4-DISC-V-${suffix}-1`, "technical-knit"]) {
      const result = await list({ organizationIdentifier: shop.slug, page: 1, limit: 20, q });
      assert.ok(result.products.some((product) => product.id === feature.id), `search field ${q} was not indexed`);
    }
    const categorySearch = await list({ organizationIdentifier: shop.slug, page: 1, limit: 20, q: "Accessories" });
    assert.ok(categorySearch.products.some((product) => product.category?.id === accessories.id), "English category names participate in discovery search");

    const exactCombination = await list({ organizationIdentifier: shop.slug, page: 1, limit: 20, filter: ["color:red", "size:39"], available: true });
    assert.ok(exactCombination.products.some((product) => product.id === feature.id));
    const multiValueCombination = await list({ organizationIdentifier: shop.slug, page: 1, limit: 20, filter: ["color:red", "color:navy", "size:39"], available: true });
    assert.ok(multiValueCombination.products.some((product) => product.id === feature.id));
    assert.ok(multiValueCombination.products.some((product) => product.id === products[5]!.id), "values under one option key are ORed while size stays on that same variant");
    const nonexistentCombination = await list({ organizationIdentifier: shop.slug, page: 1, limit: 20, filter: ["color:navy", "size:39"], available: true });
    assert.ok(!nonexistentCombination.products.some((product) => product.id === feature.id), "variant attribute filters must match one variant, not cross-combine siblings");
    const unavailableCombination = await list({ organizationIdentifier: shop.slug, page: 1, limit: 20, filter: ["color:red", "size:40"], available: true });
    assert.ok(!unavailableCombination.products.some((product) => product.id === feature.id));
    const visibleUnavailable = await list({ organizationIdentifier: shop.slug, page: 1, limit: 50, filter: ["color:red", "size:40"] });
    assert.equal(visibleUnavailable.products.find((product) => product.id === feature.id)?.orderable, false,
      "a different available color must not make the selected unavailable combination orderable");
    const nonFilterableProbe = await list({ organizationIdentifier: shop.slug, page: 1, limit: 20, filter: [`internal_note:not-filterable-${suffix}`] });
    assert.ok(!nonFilterableProbe.products.some((product) => product.id === feature.id), "non-filterable generic attributes must not become discovery filters");
    for (const id of [trackedFalse.id, backorder.id]) {
      const result = await list({ organizationIdentifier: shop.slug, page: 1, limit: 20, q: id === trackedFalse.id ? "Untracked" : "Backorder", available: true });
      assert.ok(result.products.some((product) => product.id === id), "untracked products and allowed backorders are orderable");
    }

    const byCategoryBrand = await list({ organizationIdentifier: shop.slug, page: 1, limit: 50, category: shoes.slug!, brand: "Acme Motion" });
    assert.ok(byCategoryBrand.products.every((product) => product.brand === "Acme Motion" && product.category?.id === shoes.id));
    const priceBound = await list({ organizationIdentifier: shop.slug, page: 1, limit: 50, filter: ["color:red", "size:39"], minPrice: 210000, maxPrice: 210000 });
    const exactFeature = priceBound.products.find((product) => product.id === feature.id);
    assert.ok(exactFeature, "price filtering must use the selected variant combination");
    assert.equal(exactFeature.price.amount, 210000, "card display price must use the same selected combination as the price filter");

    const sortedAsc = await list({ organizationIdentifier: shop.slug, page: 1, limit: 50, sort: "price-asc" });
    assert.deepEqual(sortedAsc.products.map((product) => product.price.amount), [...sortedAsc.products.map((product) => product.price.amount)].sort((a, b) => a - b));
    const sortedAscAgain = await list({ organizationIdentifier: shop.slug, page: 1, limit: 50, sort: "price-asc" });
    assert.deepEqual(sortedAscAgain.products.map((product) => product.id), sortedAsc.products.map((product) => product.id), "ties and pagination must have stable ID ordering");
    const relevance = await list({ organizationIdentifier: shop.slug, page: 1, limit: 20, q: "Acme Motion", sort: "relevance" });
    assert.equal(new Set(relevance.products.map((product) => product.id)).size, relevance.products.length);
    assert.equal(relevance.products[0]?.id, feature.id);

    const featureProduct = firstPage.products.find((product) => product.id === feature.id)!;
    assert.equal(featureProduct.media.card, publicImage.url);
    assert.doesNotMatch(JSON.stringify(featureProduct.media), new RegExp(`${privateImage.url}|${foreignImage.url}`));
    assert.ok(featureProduct.attributes.some((attribute) => attribute.key === "material" && attribute.filterable));
    assert.ok(featureProduct.attributes.some((attribute) => attribute.key === "internal_note" && !attribute.filterable));
    const facets = await catalog.getPublicCatalogFacets(shop.slug);
    assert.ok(facets.categories.some((category) => category.id === shoes.id && category.count > 0));
    assert.ok(facets.brands.some((brand) => brand.value === "Acme Motion" && brand.count > 0));
    assert.ok(facets.attributes.some((attribute) => attribute.key === "color" && attribute.scope === "VARIANT_OPTION" && attribute.values.some((value) => value.value === "red")));
    assert.ok(!facets.attributes.some((attribute) => attribute.key === "internal_note"));
    assert.ok(facets.categories.every((category) => category.id !== foreignCategory.id));

    const related = await catalog.getRelatedPublicProducts(shop.slug, feature.id);
    assert.ok(related.every((product) => product.id !== feature.id));
    assert.ok(related.every((product) => product.category?.id === shoes.id));
    assert.ok(related.every((product) => fixtureProductIds.includes(product.id)));
    assert.ok(!related.some((product) => product.id === foreignProduct.id || product.id === draft.id || product.id === qaLabel.id));

    // Record only elapsed listing time and actual Prisma operation counts for this invocation.
    const started = performance.now();
    countQueries = true;
    await list({ organizationIdentifier: shop.slug, page: 1, limit: 20, q: "Acme", sort: "relevance" });
    countQueries = false;
    const listingMs = performance.now() - started;
    process.stdout.write(`RETAIL_R4_DISCOVERY_LOCAL listingMs=${listingMs.toFixed(2)} queryCount=${queryCount}\n`);
  } finally {
    countQueries = false;
    if (hadGlobalClient) existingGlobal.bazarBazPrisma = priorGlobalClient;
    else delete existingGlobal.bazarBazPrisma;
    if (fixtureProductIds.length) await db.product.deleteMany({ where: { id: { in: fixtureProductIds } } });
    if (fixtureDefinitionIds.length) await db.retailAttributeDefinition.deleteMany({ where: { id: { in: fixtureDefinitionIds } } });
    if (fixtureImageIds.length) await db.image.deleteMany({ where: { id: { in: fixtureImageIds } } });
    if (fixtureCategoryIds.length) await db.productCategory.deleteMany({ where: { id: { in: fixtureCategoryIds } } });
    if (organizationIds.length) {
      await db.organization.deleteMany({ where: { id: { in: organizationIds } } });
    }
    await db.$disconnect();
  }
});
