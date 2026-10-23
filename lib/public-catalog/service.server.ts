import { readGallerySettings, orderedImages } from "@/lib/retail/product-galleries";
import "server-only";

import { ApiError } from "@/lib/api-guards";
import { prisma } from "@/lib/db";
import { activePublicBusinessCapabilities } from "@/lib/organization-public-home";
import { resolveOrganizationEndpointForTenant } from "@/lib/organization-endpoints.server";
import { buildProductPurchaseHandoff } from "@/lib/purchase-intent";
import { PUBLIC_CATALOG_PRICE_UNIT, publicCatalogProductsPageSchema, publicCatalogSnapshotSchema, type PublicCatalogPagination, type PublicCatalogProductsPage, type PublicCatalogProduct, type PublicCatalogSnapshot } from "@/lib/public-catalog/contracts";
import { serializePublicCatalogCategory, serializePublicCatalogProduct } from "@/lib/public-catalog/serializers";
import { Prisma, type Prisma as PrismaTypes } from "@prisma/client";
import { tagIdentityKey } from "@/lib/retail/product-taxonomy-utils";
import { isSyntheticRetailLabel, normalizeRetailSearch } from "@/lib/retail/discovery";

const publicVariantSelect = {
  id: true, sku: true, name: true, price: true, inventory: true, reservedQuantity: true, allowBackOrder: true,
  optionValues: { where: { definition: { isActive: true, scope: "VARIANT_OPTION" } }, select: { valueText: true, valueNumber: true, valueBoolean: true, definition: { select: { organizationId: true, key: true, label: true, localizedLabels: true, valueType: true, displayUnit: true, isFilterable: true } } } },
  galleryImages: { orderBy: { sortOrder: "asc" }, select: { image: { select: { url: true, organizationId: true, access: true } } } },
} satisfies Prisma.ProductVariantSelect;
const publicCategorySelect = { id: true, slug: true, name: true } satisfies Prisma.ProductCategorySelect;
const publicProductSelect = {
  id: true, slug: true, name: true, brand: true, description: true, basePrice: true, image: true, gallerySettings: true, images: { select: { id: true, url: true, organizationId: true, access: true } },
  discountType: true, discountValue: true, trackInventory: true,
  category: { select: publicCategorySelect },
  attributeValues: { where: { definition: { isActive: true, scope: "PRODUCT" } }, select: { valueText: true, valueNumber: true, valueBoolean: true, definition: { select: { organizationId: true, key: true, label: true, localizedLabels: true, valueType: true, displayUnit: true, isFilterable: true } } } },
  variants: { where: { deletedAt: null }, orderBy: [{ name: "asc" }, { id: "asc" }], select: publicVariantSelect },
} satisfies Prisma.ProductSelect;

function publicAttribute(value: { valueText: string | null; valueNumber: Prisma.Decimal | null; valueBoolean: boolean | null; definition: { organizationId: string; key: string; label: string; localizedLabels: Prisma.JsonValue; valueType: "TEXT" | "NUMBER" | "BOOLEAN" | "ENUM"; displayUnit: string | null; isFilterable: boolean } }, organizationId: string) {
  if (value.definition.organizationId !== organizationId) return null;
  const localized = value.definition.localizedLabels;
  const labels = localized && typeof localized === "object" && !Array.isArray(localized) ? localized as Record<string, unknown> : {};
  return { key: value.definition.key, label: typeof labels.fa === "string" ? labels.fa : value.definition.label,
    valueType: value.definition.valueType, displayUnit: value.definition.displayUnit, filterable: value.definition.isFilterable,
    valueText: value.valueText, valueNumber: value.valueNumber, valueBoolean: value.valueBoolean };
}

function isSafePublicMediaUrl(value: string) {
  if (value.startsWith("/") && !value.startsWith("//")) return true;
  try { return new URL(value).protocol === "https:"; } catch { return false; }
}

function retailProduct(product: Prisma.ProductGetPayload<{ select: typeof publicProductSelect }>, organizationId: string) {
  const gallerySettings = readGallerySettings(product.gallerySettings);
  const eligibleImages = orderedImages(product.images, gallerySettings?.productImageIds ?? []).filter((image) => image.access === "PUBLIC" && (!image.organizationId || image.organizationId === organizationId) && isSafePublicMediaUrl(image.url)).map((image) => image.url);
  const primary = gallerySettings ? eligibleImages[0] ?? null : product.image && eligibleImages.includes(product.image) ? product.image : eligibleImages[0] ?? null;
  return {
    ...product,
    image: primary,
    images: eligibleImages.filter((url) => url !== primary),
    attributes: product.attributeValues.map((value) => publicAttribute(value, organizationId)).filter((value) => value !== null),
    variants: product.variants.map((variant) => ({ ...variant, media: { gallery: variant.galleryImages.filter((entry) => entry.image.access === "PUBLIC" && entry.image.organizationId === organizationId && isSafePublicMediaUrl(entry.image.url)).map((entry) => entry.image.url) }, options: variant.optionValues.map((value) => publicAttribute(value, organizationId)).filter((value) => value !== null) })),
  };
}

async function requirePublicShop(identifier: string) {
  const organization = await prisma.organization.findFirst({
    where: { slug: identifier, isActive: true, deletedAt: null, isPlatformOwner: false },
    select: {
      id: true, slug: true, name: true, description: true, logo: true, coverImage: true,
      branding: { select: { displayName: true, logoUrl: true, retailPresentationTheme: true, retailPreviewOnly: true } },
      capabilities: { select: { key: true, status: true } },
    },
  });
  if (!organization || !activePublicBusinessCapabilities(organization.capabilities).includes("SHOP")) {
    throw new ApiError(404, "Catalog not found");
  }
  return organization;
}

async function purchaseBuilder(organization: { id: string; slug: string }) {
  const appEndpoint = await resolveOrganizationEndpointForTenant({ organizationId: organization.id, role: "APP" });
  return (productId: string) => buildProductPurchaseHandoff({
    productId,
    appEndpoint,
  });
}

const visibleCategoryWhere = { isActive: true, deletedAt: null } as const;
const visibleProductWhere = { isActive: true, deletedAt: null } as const;
const visibleProductWhereForTenant = (organizationId: string) => ({ ...visibleProductWhere, category: { ...visibleCategoryWhere, organizationId } });
function retailPresentationTheme(value: string | null | undefined): "FASHION" | "ELECTRONICS" | "GENERAL" {
  return value === "FASHION" || value === "ELECTRONICS" ? value : "GENERAL";
}

function normalizedSearchSql(value: PrismaTypes.Sql) {
  const normalized = Prisma.sql`lower(normalize(coalesce(${value}, ''), NFKC))`;
  const latinDigits = "01234567890123456789";
  const arabicCharacters = "يىكآ۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩";
  const normalizedLettersAndDigits = Prisma.sql`translate(${normalized}, ${arabicCharacters}, ${"ییکا" + latinDigits})`;
  const marks = "ًٌٍَُِّْٰـٕٖٜٟٔٗ٘ٙٚٛٝٞۖۗۘۙۚۛۜ۞";
  const withoutMarks = Prisma.sql`translate(${normalizedLettersAndDigits}, ${marks}, '')`;
  const punctuation = Prisma.sql`translate(${withoutMarks}, ${"\u200c\u200d،؛؟…"}, '      ')`;
  const separated = Prisma.sql`regexp_replace(${punctuation}, '[[:punct:]]+', ' ', 'g')`;
  return Prisma.sql`btrim(regexp_replace(${separated}, '\\s+', ' ', 'g'))`;
}

type DiscoveryFilter = { key: string; value: string; numeric?: number; boolean?: boolean };

function groupDiscoveryFilters(filters: DiscoveryFilter[]) {
  const groups = new Map<string, DiscoveryFilter[]>();
  for (const filter of filters) groups.set(filter.key, [...(groups.get(filter.key) ?? []), filter]);
  return groups;
}

function normalizeDiscoveryQuery(value: string) {
  return normalizeRetailSearch(value).replace(/آ/g, "ا");
}

function parseDiscoveryFilter(filter: string): DiscoveryFilter | null {
  const separator = filter.indexOf(":");
  if (separator < 1) return null;
  const key = filter.slice(0, separator);
  const value = filter.slice(separator + 1);
  const normalizedNumeric = normalizeRetailSearch(value);
  const parsedNumber = normalizedNumeric.trim() ? Number(normalizedNumeric) : Number.NaN;
  return {
    key,
    value,
    ...(Number.isFinite(parsedNumber) ? { numeric: parsedNumber } : {}),
    ...(/^(true|false)$/i.test(value) ? { boolean: value.toLowerCase() === "true" } : {}),
  };
}

function attributeValueMatchSql(definitionAlias: string, valueAlias: string, filter: DiscoveryFilter) {
  const d = Prisma.raw(definitionAlias);
  const v = Prisma.raw(valueAlias);
  const textValue = Prisma.sql`(${d}."valueType" IN ('TEXT', 'ENUM') AND ${v}."valueText" = ${filter.value})`;
  const numberValue = filter.numeric === undefined ? Prisma.empty : Prisma.sql`OR (${d}."valueType" = 'NUMBER' AND ${v}."valueNumber" = ${filter.numeric})`;
  const booleanValue = filter.boolean === undefined ? Prisma.empty : Prisma.sql`OR (${d}."valueType" = 'BOOLEAN' AND ${v}."valueBoolean" = ${filter.boolean})`;
  return Prisma.sql`(${textValue} ${numberValue} ${booleanValue})`;
}

function escapeLikePattern(value: string) {
  return value.replace(/[!%_]/g, "!$&");
}

function rawSkuSearchForScore(query: string) {
  const value = query.trim().toLowerCase();
  return Prisma.sql`(lower(btrim(COALESCE(p."sku", ''))) = ${value} OR EXISTS (
    SELECT 1 FROM "ProductVariant" scoreSku WHERE scoreSku."productId" = p."id" AND scoreSku."deletedAt" IS NULL
      AND lower(btrim(COALESCE(scoreSku."sku", ''))) = ${value}))`;
}

function orderableVariantSql(variantAlias: string) {
  const variant = Prisma.raw(variantAlias);
  return Prisma.sql`(NOT p."trackInventory" OR ${variant}."allowBackOrder" OR ${variant}."inventory" - ${variant}."reservedQuantity" > 0)`;
}

function publicProductPriceWithSelectedOptions(product: PublicCatalogProduct, filters: DiscoveryFilter[], available?: boolean): PublicCatalogProduct {
  if (!filters.length) return product;
  const groups = groupDiscoveryFilters(filters);
  const matchesFilter = (variant: PublicCatalogProduct["variants"][number], filter: DiscoveryFilter) => {
    const option = variant.options.find((entry) => entry.key === filter.key);
    if (!option) return false;
    if (filter.numeric !== undefined && option.valueType === "NUMBER") return option.value === filter.numeric;
    if (filter.boolean !== undefined && option.valueType === "BOOLEAN") return option.value === filter.boolean;
    return option.valueType === "TEXT" || option.valueType === "ENUM" ? option.value === filter.value : false;
  };
  const matching = product.variants.filter((variant) => [...groups.values()].every((group) => group.some((filter) => matchesFilter(variant, filter))));
  const eligible = available === false ? matching.filter((variant) => !variant.orderable)
    : matching.filter((variant) => variant.orderable);
  const choices = eligible.length ? eligible : matching;
  const display = [...choices].sort((left, right) => left.price.amount - right.price.amount || left.id.localeCompare(right.id))[0];
  if (!display) return product;
  const card = display.media?.gallery[0] ?? product.media.card;
  return {
    ...product,
    orderable: choices.some((variant) => variant.orderable),
    price: display.price,
    listPrice: display.listPrice,
    media: card === product.media.card ? product.media : { ...product.media, card, detail: card, gallery: display.media?.gallery.length ? display.media.gallery : product.media.gallery },
  };
}

export async function listPublicCatalogCategories(organizationIdentifier: string) {
  const organization = await requirePublicShop(organizationIdentifier);
  const categories = await prisma.productCategory.findMany({
    where: { organizationId: organization.id, ...visibleCategoryWhere },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }, { id: "asc" }],
    select: {
      id: true, slug: true, name: true, description: true, sortOrder: true, image: true,
      _count: { select: { categoryAssignments: { where: {
        organizationId: organization.id,
        product: visibleProductWhereForTenant(organization.id),
      } } } },
    },
  });
    return { organization, categories: categories.map((category) => serializePublicCatalogCategory({ ...category, image: null, productCount: category._count.categoryAssignments })) };
}

export async function getPublicCatalogCategory(organizationIdentifier: string, categoryIdentifier: string) {
  const organization = await requirePublicShop(organizationIdentifier);
  const category = await prisma.productCategory.findFirst({
    where: { organizationId: organization.id, ...visibleCategoryWhere, OR: [{ id: categoryIdentifier }, { slug: categoryIdentifier }] },
    select: {
      id: true, slug: true, name: true, description: true, sortOrder: true, image: true,
      _count: { select: { categoryAssignments: { where: {
        organizationId: organization.id,
        product: visibleProductWhereForTenant(organization.id),
      } } } },
    },
  });
  if (!category) throw new ApiError(404, "Category not found");
  return serializePublicCatalogCategory({ ...category, image: null, productCount: category._count.categoryAssignments });
}

export async function listPublicCatalogProducts(input: {
  organizationIdentifier: string; page: number; limit: number; category?: string; tag?: string; q?: string; filter?: string[];
  minPrice?: number; maxPrice?: number; brand?: string; available?: boolean; productIds?: readonly string[];
  sort?: "featured" | "price-asc" | "price-desc" | "name-asc" | "newest" | "relevance";
}) {
  const organization = await requirePublicShop(input.organizationIdentifier);
  let categoryId: string | undefined;
  if (input.category) {
    const category = await prisma.productCategory.findFirst({
      where: { organizationId: organization.id, ...visibleCategoryWhere, OR: [{ id: input.category }, { slug: input.category }] },
      select: { id: true },
    });
    if (!category) throw new ApiError(404, "Category not found");
    categoryId = category.id;
  }
  const predicates: PrismaTypes.Sql[] = [Prisma.sql`p."organizationId" = ${organization.id}`, Prisma.sql`p."isActive" = true`, Prisma.sql`p."deletedAt" IS NULL`, Prisma.sql`c."organizationId" = ${organization.id}`, Prisma.sql`c."isActive" = true`, Prisma.sql`c."deletedAt" IS NULL`];
  if (categoryId) predicates.push(Prisma.sql`(
    p."categoryId" = ${categoryId} OR EXISTS (
      SELECT 1 FROM "ProductCategoryAssignment" pca
      JOIN "ProductCategory" assignedCategory ON assignedCategory."id" = pca."categoryId"
      WHERE pca."productId" = p."id" AND pca."organizationId" = ${organization.id}
        AND pca."categoryId" = ${categoryId} AND assignedCategory."organizationId" = ${organization.id}
        AND assignedCategory."isActive" = true AND assignedCategory."deletedAt" IS NULL
    )
  )`);
  if (input.tag) {
    const normalizedTag = tagIdentityKey(input.tag);
    predicates.push(Prisma.sql`EXISTS (
      SELECT 1 FROM "ProductTagAssignment" pta JOIN "ProductTag" pt ON pt."id" = pta."tagId"
      WHERE pta."productId" = p."id" AND pta."organizationId" = ${organization.id}
        AND pt."organizationId" = ${organization.id} AND pt."normalizedName" = ${normalizedTag}
    )`);
  }
  if (input.productIds) {
    const productIds = [...new Set(input.productIds)];
    predicates.push(productIds.length ? Prisma.sql`p."id" IN (${Prisma.join(productIds)})` : Prisma.sql`FALSE`);
  }
  if (input.brand?.trim()) predicates.push(Prisma.sql`lower(btrim(p."brand")) = lower(btrim(${input.brand.trim()}))`);

  const filters = (input.filter ?? []).map(parseDiscoveryFilter).filter((filter): filter is DiscoveryFilter => filter !== null);
  const filterKeys = [...new Set(filters.map((filter) => filter.key))];
  const definitions = filterKeys.length ? await prisma.retailAttributeDefinition.findMany({
    where: { organizationId: organization.id, key: { in: filterKeys }, isActive: true, isFilterable: true },
    select: { key: true, scope: true },
  }) : [];
  const definitionScopes = new Map(definitions.map((definition) => [definition.key, definition.scope]));
  const filterGroups = [...groupDiscoveryFilters(filters)];
  const variantFilterGroups = filterGroups.filter(([key]) => definitionScopes.get(key) === "VARIANT_OPTION");
  const variantFilters = variantFilterGroups.flatMap(([, group]) => group);
  const variantConditions = variantFilterGroups.map(([key, group], index) => {
    const d = `variantDefinition${index}`;
    const av = `variantValue${index}`;
    return Prisma.sql`EXISTS (
      SELECT 1 FROM "RetailAttributeDefinition" ${Prisma.raw(d)}
      JOIN "ProductVariantAttributeValue" ${Prisma.raw(av)} ON ${Prisma.raw(av)}."definitionId" = ${Prisma.raw(d)}."id"
      WHERE ${Prisma.raw(av)}."variantId" = v."id" AND ${Prisma.raw(d)}."organizationId" = ${organization.id}
        AND ${Prisma.raw(d)}."key" = ${key} AND ${Prisma.raw(d)}."scope" = 'VARIANT_OPTION'
        AND ${Prisma.raw(d)}."isActive" = true AND ${Prisma.raw(d)}."isFilterable" = true
        AND (${Prisma.join(group.map((filter) => attributeValueMatchSql(d, av, filter)), " OR ")})
    )`;
  });
  const variantOptionsPredicate = variantConditions.length ? Prisma.sql`AND ${Prisma.join(variantConditions, " AND ")}` : Prisma.empty;
  const variantMatch = (withAvailability?: boolean) => Prisma.sql`EXISTS (
    SELECT 1 FROM "ProductVariant" v WHERE v."productId" = p."id" AND v."deletedAt" IS NULL
      ${variantOptionsPredicate}
      ${withAvailability === undefined ? Prisma.empty : Prisma.sql`AND ${withAvailability ? orderableVariantSql("v") : Prisma.sql`NOT ${orderableVariantSql("v")}`}`}
  )`;
  for (const [key, group] of filterGroups) {
    const scope = definitionScopes.get(key);
    if (!scope) {
      predicates.push(Prisma.sql`FALSE`);
    } else if (scope === "PRODUCT") {
      predicates.push(Prisma.sql`EXISTS (
        SELECT 1 FROM "RetailAttributeDefinition" filterDefinition
        JOIN "ProductAttributeValue" filterValue ON filterValue."definitionId" = filterDefinition."id"
        WHERE filterValue."productId" = p."id" AND filterDefinition."organizationId" = ${organization.id}
          AND filterDefinition."key" = ${key} AND filterDefinition."scope" = 'PRODUCT'
          AND filterDefinition."isActive" = true AND filterDefinition."isFilterable" = true
          AND (${Prisma.join(group.map((filter) => attributeValueMatchSql("filterDefinition", "filterValue", filter)), " OR ")})
      )`);
    }
  }
  if (variantFilters.length) predicates.push(variantMatch(input.available === true ? true : input.available === false ? false : undefined));
  else if (input.available === true) predicates.push(variantMatch(true));
  else if (input.available === false) predicates.push(Prisma.sql`NOT ${variantMatch(true)}`);

  if (input.q?.trim()) {
    const normalizedQuery = normalizeDiscoveryQuery(input.q);
    const rawSkuSearch = rawSkuSearchForScore(input.q);
    if (!normalizedQuery) predicates.push(rawSkuSearch);
    else {
      const searchPattern = `%${escapeLikePattern(normalizedQuery)}%`;
      const fields = [
        normalizedSearchSql(Prisma.sql`p."name"`), normalizedSearchSql(Prisma.sql`p."description"`),
        normalizedSearchSql(Prisma.sql`p."brand"`), normalizedSearchSql(Prisma.sql`c."name"`),
        normalizedSearchSql(Prisma.sql`c."slug"`),
      ];
      const textSearch = Prisma.join(fields.map((field) => Prisma.sql`${field} LIKE ${searchPattern} ESCAPE '!'`), " OR ");
      const tokenSearch = Prisma.join(normalizedQuery.split(" ").filter(Boolean).map((token) => {
        const tokenPattern = `%${escapeLikePattern(token)}%`;
        return Prisma.sql`(${Prisma.join(fields.map((field) => Prisma.sql`${field} LIKE ${tokenPattern} ESCAPE '!'`), " OR ")})`;
      }), " AND ");
      const attributeSearch = Prisma.sql`(EXISTS (
        SELECT 1 FROM "ProductAttributeValue" searchValue JOIN "RetailAttributeDefinition" searchDefinition ON searchDefinition."id" = searchValue."definitionId"
        WHERE searchValue."productId" = p."id" AND searchDefinition."organizationId" = ${organization.id}
          AND searchDefinition."scope" = 'PRODUCT' AND searchDefinition."isActive" = true
          AND ${normalizedSearchSql(Prisma.sql`searchValue."valueText"`)} LIKE ${searchPattern} ESCAPE '!'
      ) OR EXISTS (
        SELECT 1 FROM "ProductVariantAttributeValue" searchValue JOIN "RetailAttributeDefinition" searchDefinition ON searchDefinition."id" = searchValue."definitionId"
        JOIN "ProductVariant" searchVariant ON searchVariant."id" = searchValue."variantId"
        WHERE searchVariant."productId" = p."id" AND searchVariant."deletedAt" IS NULL AND searchDefinition."organizationId" = ${organization.id}
          AND searchDefinition."scope" = 'VARIANT_OPTION' AND searchDefinition."isActive" = true
          AND ${normalizedSearchSql(Prisma.sql`searchValue."valueText"`)} LIKE ${searchPattern} ESCAPE '!'
      ))`;
      predicates.push(Prisma.sql`((${textSearch}) OR (${tokenSearch}) OR ${rawSkuSearch} OR ${attributeSearch})`);
    }
  }
  const effectiveVariantPrice = Prisma.sql`COALESCE(v."price", p."basePrice")`;
  const selectedPriceForOrderability = (orderable: boolean | undefined) => Prisma.sql`(SELECT MIN(${effectiveVariantPrice}) FROM "ProductVariant" v
    WHERE v."productId" = p."id" AND v."deletedAt" IS NULL ${variantOptionsPredicate}
      ${orderable === undefined ? Prisma.empty : Prisma.sql`AND ${orderable ? orderableVariantSql("v") : Prisma.sql`NOT ${orderableVariantSql("v")}`}`})`;
  const rawPrice = variantFilters.length
    ? input.available === true ? Prisma.sql`COALESCE(${selectedPriceForOrderability(true)}, p."basePrice")`
      : input.available === false ? Prisma.sql`COALESCE(${selectedPriceForOrderability(false)}, p."basePrice")`
        : Prisma.sql`COALESCE(${selectedPriceForOrderability(true)}, ${selectedPriceForOrderability(undefined)}, p."basePrice")`
    : Prisma.sql`COALESCE(
    (SELECT MIN(${effectiveVariantPrice}) FROM "ProductVariant" v WHERE v."productId" = p."id" AND v."deletedAt" IS NULL AND ${orderableVariantSql("v")}),
    (SELECT MIN(${effectiveVariantPrice}) FROM "ProductVariant" v WHERE v."productId" = p."id" AND v."deletedAt" IS NULL),
    p."basePrice"
  )`;
  const displayPrice = Prisma.sql`CASE
    WHEN p."discountType" = 'percentage' THEN GREATEST(0, ${rawPrice} * (1 - LEAST(COALESCE(p."discountValue", 0), 100) / 100))
    WHEN p."discountType" = 'fixed' THEN GREATEST(0, ${rawPrice} - COALESCE(p."discountValue", 0))
    ELSE ${rawPrice} END`;
  const relevanceQuery = input.q?.trim() ? normalizeDiscoveryQuery(input.q) : "";
  const searchScore = relevanceQuery ? Prisma.sql`CASE
      WHEN ${normalizedSearchSql(Prisma.sql`p."name"`)} = ${relevanceQuery} THEN 100
      WHEN ${normalizedSearchSql(Prisma.sql`p."name"`)} LIKE ${`${escapeLikePattern(relevanceQuery)}%`} ESCAPE '!' THEN 90
      WHEN ${rawSkuSearchForScore(input.q!)} THEN 85
      WHEN ${normalizedSearchSql(Prisma.sql`p."name"`)} LIKE ${`%${escapeLikePattern(relevanceQuery)}%`} ESCAPE '!' THEN 80
      WHEN ${normalizedSearchSql(Prisma.sql`p."brand"`)} LIKE ${`%${escapeLikePattern(relevanceQuery)}%`} ESCAPE '!' THEN 65
      WHEN ${normalizedSearchSql(Prisma.sql`c."name"`)} LIKE ${`%${escapeLikePattern(relevanceQuery)}%`} ESCAPE '!' THEN 55
      WHEN ${normalizedSearchSql(Prisma.sql`p."description"`)} LIKE ${`%${escapeLikePattern(relevanceQuery)}%`} ESCAPE '!' THEN 40
      ELSE 10 END` : Prisma.sql`0`;
  const baseQuery = Prisma.sql`SELECT p."id", p."name", p."sortOrder", p."createdAt", ${displayPrice} AS "displayPrice", ${searchScore} AS "relevanceScore"
    FROM "Product" p JOIN "ProductCategory" c ON c."id" = p."categoryId"
    WHERE ${Prisma.join(predicates, " AND ")}`;
  const pricePredicates: PrismaTypes.Sql[] = [];
  if (input.minPrice !== undefined) pricePredicates.push(Prisma.sql`catalog."displayPrice" >= ${input.minPrice}`);
  if (input.maxPrice !== undefined) pricePredicates.push(Prisma.sql`catalog."displayPrice" <= ${input.maxPrice}`);
  const filteredQuery = Prisma.sql`SELECT * FROM (${baseQuery}) catalog ${pricePredicates.length ? Prisma.sql`WHERE ${Prisma.join(pricePredicates, " AND ")}` : Prisma.empty}`;
  const orderBy = input.sort === "relevance" ? Prisma.sql`catalog."relevanceScore" DESC, catalog."sortOrder" ASC, catalog."createdAt" ASC, catalog."id" ASC`
    : input.sort === "price-asc" ? Prisma.sql`catalog."displayPrice" ASC, catalog."id" ASC`
    : input.sort === "price-desc" ? Prisma.sql`catalog."displayPrice" DESC, catalog."id" ASC`
    : input.sort === "name-asc" ? Prisma.sql`catalog."name" ASC, catalog."id" ASC`
    : input.sort === "newest" ? Prisma.sql`catalog."createdAt" DESC, catalog."id" ASC`
    : Prisma.sql`catalog."sortOrder" ASC, catalog."name" ASC, catalog."id" ASC`;
  const [pageRecords, countRecords] = await Promise.all([
    prisma.$queryRaw<Array<{ id: string; displayPrice: Prisma.Decimal }>>(Prisma.sql`${filteredQuery} ORDER BY ${orderBy} LIMIT ${input.limit} OFFSET ${(input.page - 1) * input.limit}`),
    prisma.$queryRaw<Array<{ total: bigint }>>(Prisma.sql`SELECT COUNT(*)::bigint AS total FROM (${filteredQuery}) filtered`),
  ]);
  const total = Number(countRecords[0]?.total ?? BigInt(0));
  const rowsById = pageRecords.length ? await prisma.product.findMany({
    where: { id: { in: pageRecords.map((record) => record.id) }, organizationId: organization.id, ...visibleProductWhereForTenant(organization.id) },
    select: publicProductSelect,
  }) : [];
  const rowMap = new Map(rowsById.map((row) => [row.id, row]));
  const rows = pageRecords.map(({ id }) => rowMap.get(id)).filter((row): row is NonNullable<typeof row> => row !== undefined);
  const buildPurchase = await purchaseBuilder(organization);
  const pagination: PublicCatalogPagination = { page: input.page, limit: input.limit, total, totalPages: Math.ceil(total / input.limit) };
  const priceById = new Map(pageRecords.map(({ id, displayPrice }) => [id, Number(displayPrice.toString())]));
  return publicCatalogProductsPageSchema.parse({ products: rows.map((product) => {
    const serialized = serializePublicCatalogProduct({ ...retailProduct(product, organization.id), purchase: buildPurchase(product.id) });
    const aligned = publicProductPriceWithSelectedOptions(serialized, variantFilters, input.available);
    const selectedPrice = priceById.get(product.id);
    return selectedPrice === undefined ? aligned : { ...aligned, price: { amount: selectedPrice, currency: PUBLIC_CATALOG_PRICE_UNIT } };
  }), pagination }) as unknown as PublicCatalogProductsPage;
}

export async function getPublicCatalogFacets(organizationIdentifier: string) {
  const organization = await requirePublicShop(organizationIdentifier);
  const [categories, brands, attributes] = await Promise.all([
    prisma.$queryRaw<Array<{ id: string; slug: string | null; name: string; count: number }>>(Prisma.sql`
      SELECT c."id", c."slug", c."name", COUNT(DISTINCT p."id")::int AS "count"
      FROM "ProductCategory" c
      LEFT JOIN "Product" p ON p."organizationId" = ${organization.id} AND p."isActive" = true AND p."deletedAt" IS NULL
        AND EXISTS (SELECT 1 FROM "ProductCategory" primaryCategory WHERE primaryCategory."id" = p."categoryId"
          AND primaryCategory."organizationId" = ${organization.id} AND primaryCategory."isActive" = true AND primaryCategory."deletedAt" IS NULL)
        AND (p."categoryId" = c."id" OR EXISTS (
          SELECT 1 FROM "ProductCategoryAssignment" pca
          JOIN "ProductCategory" assigned ON assigned."id" = pca."categoryId"
          WHERE pca."productId" = p."id" AND pca."organizationId" = ${organization.id}
            AND pca."categoryId" = c."id" AND assigned."organizationId" = ${organization.id}
            AND assigned."isActive" = true AND assigned."deletedAt" IS NULL
        ))
      WHERE c."organizationId" = ${organization.id} AND c."isActive" = true AND c."deletedAt" IS NULL
      GROUP BY c."id", c."slug", c."name", c."sortOrder"
      ORDER BY c."sortOrder" ASC, c."name" ASC, c."id" ASC`),
    prisma.$queryRaw<Array<{ value: string; count: number }>>(Prisma.sql`
      SELECT btrim(p."brand") AS "value", COUNT(DISTINCT p."id")::int AS "count"
      FROM "Product" p JOIN "ProductCategory" c ON c."id" = p."categoryId"
      WHERE p."organizationId" = ${organization.id} AND p."isActive" = true AND p."deletedAt" IS NULL
        AND c."organizationId" = ${organization.id} AND c."isActive" = true AND c."deletedAt" IS NULL
        AND NULLIF(btrim(p."brand"), '') IS NOT NULL
      GROUP BY btrim(p."brand") ORDER BY btrim(p."brand") ASC`),
    prisma.$queryRaw<Array<{ key: string; label: string; scope: "PRODUCT" | "VARIANT_OPTION"; value: string; count: number }>>(Prisma.sql`
      WITH attribute_values AS (
        SELECT d."key", COALESCE(d."localizedLabels" ->> 'fa', d."label") AS "label", d."scope"::text AS "scope",
          COALESCE(v."valueText", trim_scale(v."valueNumber")::text, CASE WHEN v."valueBoolean" IS NULL THEN NULL WHEN v."valueBoolean" THEN 'true' ELSE 'false' END) AS "value",
          v."productId" AS "productId"
        FROM "RetailAttributeDefinition" d JOIN "ProductAttributeValue" v ON v."definitionId" = d."id"
        WHERE d."organizationId" = ${organization.id} AND d."scope" = 'PRODUCT' AND d."isActive" = true AND d."isFilterable" = true
        UNION ALL
        SELECT d."key", COALESCE(d."localizedLabels" ->> 'fa', d."label") AS "label", d."scope"::text AS "scope",
          COALESCE(v."valueText", trim_scale(v."valueNumber")::text, CASE WHEN v."valueBoolean" IS NULL THEN NULL WHEN v."valueBoolean" THEN 'true' ELSE 'false' END) AS "value",
          variant."productId" AS "productId"
        FROM "RetailAttributeDefinition" d JOIN "ProductVariantAttributeValue" v ON v."definitionId" = d."id"
        JOIN "ProductVariant" variant ON variant."id" = v."variantId" AND variant."deletedAt" IS NULL
        WHERE d."organizationId" = ${organization.id} AND d."scope" = 'VARIANT_OPTION' AND d."isActive" = true AND d."isFilterable" = true
      )
      SELECT av."key", av."label", av."scope", av."value", COUNT(DISTINCT p."id")::int AS "count"
      FROM attribute_values av JOIN "Product" p ON p."id" = av."productId"
      JOIN "ProductCategory" c ON c."id" = p."categoryId"
      WHERE p."organizationId" = ${organization.id} AND p."isActive" = true AND p."deletedAt" IS NULL
        AND c."organizationId" = ${organization.id} AND c."isActive" = true AND c."deletedAt" IS NULL
        AND av."value" IS NOT NULL
      GROUP BY av."key", av."label", av."scope", av."value"
      ORDER BY av."key" ASC, av."value" ASC`),
  ]);
  const attributesByKey = new Map<string, { key: string; label: string; scope: "PRODUCT" | "VARIANT_OPTION"; values: Array<{ value: string; count: number }> }>();
  for (const row of attributes) {
    const attribute = attributesByKey.get(row.key) ?? { key: row.key, label: row.label, scope: row.scope, values: [] };
    attribute.values.push({ value: row.value, count: Number(row.count) });
    attributesByKey.set(row.key, attribute);
  }
  return {
    categories: categories.map((category) => ({ ...category, count: Number(category.count) })),
    brands: brands.map((brand) => ({ ...brand, count: Number(brand.count) })),
    attributes: [...attributesByKey.values()],
  };
}

export async function getRelatedPublicProducts(organizationIdentifier: string, productIdentifier: string): Promise<PublicCatalogProduct[]> {
  const organization = await requirePublicShop(organizationIdentifier);
  const current = await prisma.product.findFirst({
    where: { organizationId: organization.id, ...visibleProductWhereForTenant(organization.id), OR: [{ id: productIdentifier }, { slug: productIdentifier }] },
    select: { id: true, categoryId: true, brand: true },
  });
  if (!current) throw new ApiError(404, "Product not found");
  const candidates = await prisma.product.findMany({
    where: {
      organizationId: organization.id, categoryId: current.categoryId, id: { not: current.id },
      ...visibleProductWhereForTenant(organization.id),
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }, { id: "asc" }],
    take: 48,
    select: publicProductSelect,
  });
  const related = candidates
    .filter((candidate) => !isSyntheticRetailLabel(candidate.name, candidate.slug))
    .sort((left, right) => Number(right.brand === current.brand) - Number(left.brand === current.brand))
    .slice(0, 8);
  const buildPurchase = await purchaseBuilder(organization);
  return related.map((product) => serializePublicCatalogProduct({
    ...retailProduct(product, organization.id),
    purchase: buildPurchase(product.id),
  }));
}

export async function getPublicCatalogProduct(organizationIdentifier: string, productIdentifier: string) {
  const organization = await requirePublicShop(organizationIdentifier);
  const product = await prisma.product.findFirst({
    where: {
      organizationId: organization.id, ...visibleProductWhereForTenant(organization.id),
      OR: [{ id: productIdentifier }, { slug: productIdentifier }],
    },
    select: publicProductSelect,
  });
  if (!product) throw new ApiError(404, "Product not found");
  const buildPurchase = await purchaseBuilder(organization);
  return serializePublicCatalogProduct({ ...retailProduct(product, organization.id), purchase: buildPurchase(product.id) });
}

export async function getPublicCatalogSnapshot(organizationIdentifier: string): Promise<PublicCatalogSnapshot> {
  const [{ organization, categories }, listing] = await Promise.all([
    listPublicCatalogCategories(organizationIdentifier),
    listPublicCatalogProducts({ organizationIdentifier, page: 1, limit: 20 }),
  ]);
  return publicCatalogSnapshotSchema.parse({
    organization: {
      identifier: organization.slug, name: organization.branding?.displayName ?? organization.name, description: organization.description,
      theme: retailPresentationTheme(organization.branding?.retailPresentationTheme),
      previewOnly: organization.branding?.retailPreviewOnly ?? false,
      branding: { logo: organization.branding?.logoUrl ?? organization.logo, cover: organization.coverImage },
    },
    priceUnit: "TOMAN" as const,
    categories,
    products: listing.products,
    pagination: listing.pagination,
  }) as unknown as PublicCatalogSnapshot;
}
