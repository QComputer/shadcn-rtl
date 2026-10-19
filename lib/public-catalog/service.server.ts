import "server-only";

import { ApiError } from "@/lib/api-guards";
import { prisma } from "@/lib/db";
import { activePublicBusinessCapabilities } from "@/lib/organization-public-home";
import { resolveOrganizationEndpointForTenant } from "@/lib/organization-endpoints.server";
import { buildProductPurchaseHandoff } from "@/lib/purchase-intent";
import type { PublicCatalogPagination, PublicCatalogProductsPage, PublicCatalogSnapshot } from "@/lib/public-catalog/contracts";
import { publicCatalogProductsPageSchema, publicCatalogSnapshotSchema } from "@/lib/public-catalog/contracts";
import { serializePublicCatalogCategory, serializePublicCatalogProduct } from "@/lib/public-catalog/serializers";
import { Prisma, type Prisma as PrismaTypes } from "@prisma/client";
import { tagIdentityKey } from "@/lib/retail/product-taxonomy-utils";

const publicVariantSelect = {
  id: true, sku: true, name: true, price: true, inventory: true, reservedQuantity: true, allowBackOrder: true,
  optionValues: { where: { definition: { isActive: true, scope: "VARIANT_OPTION" } }, select: { valueText: true, valueNumber: true, valueBoolean: true, definition: { select: { organizationId: true, key: true, label: true, localizedLabels: true, valueType: true, displayUnit: true, isFilterable: true } } } },
} satisfies Prisma.ProductVariantSelect;
const publicCategorySelect = { id: true, slug: true, name: true } satisfies Prisma.ProductCategorySelect;
const publicProductSelect = {
  id: true, slug: true, name: true, description: true, basePrice: true, image: true, images: { select: { url: true, organizationId: true, access: true } },
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
  const eligibleImages = product.images.filter((image) => image.access === "PUBLIC" && (!image.organizationId || image.organizationId === organizationId) && isSafePublicMediaUrl(image.url)).map((image) => image.url);
  const primary = product.image && eligibleImages.includes(product.image) ? product.image : eligibleImages[0] ?? null;
  return {
    ...product,
    image: primary,
    images: eligibleImages.filter((url) => url !== primary),
    attributes: product.attributeValues.map((value) => publicAttribute(value, organizationId)).filter((value) => value !== null),
    variants: product.variants.map((variant) => ({ ...variant, options: variant.optionValues.map((value) => publicAttribute(value, organizationId)).filter((value) => value !== null) })),
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
  minPrice?: number; maxPrice?: number; sort?: "featured" | "price-asc" | "price-desc" | "name-asc" | "newest";
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
  if (input.q) predicates.push(Prisma.sql`(p."name" ILIKE ${`%${input.q}%`} OR COALESCE(p."description", '') ILIKE ${`%${input.q}%`})`);
  for (const filter of input.filter ?? []) {
    const separator = filter.indexOf(":");
    const key = filter.slice(0, separator);
    const value = filter.slice(separator + 1);
    const numeric = value.trim() !== "" ? Number(value) : Number.NaN;
    const numericPredicate = Number.isFinite(numeric) ? Prisma.sql`OR (d."valueType" = 'NUMBER' AND av."valueNumber" = ${numeric})` : Prisma.empty;
    const booleanPredicate = /^(true|false)$/i.test(value) ? Prisma.sql`OR (d."valueType" = 'BOOLEAN' AND av."valueBoolean" = ${value.toLowerCase() === "true"})` : Prisma.empty;
    predicates.push(Prisma.sql`EXISTS (
      SELECT 1 FROM "RetailAttributeDefinition" d
      JOIN "ProductAttributeValue" av ON av."definitionId" = d."id"
      WHERE av."productId" = p."id" AND d."organizationId" = ${organization.id}
        AND d."key" = ${key} AND d."scope" = 'PRODUCT' AND d."isActive" = true AND d."isFilterable" = true
        AND ((d."valueType" IN ('TEXT', 'ENUM') AND av."valueText" = ${value}) ${numericPredicate} ${booleanPredicate})
    ) OR EXISTS (
      SELECT 1 FROM "RetailAttributeDefinition" d
      JOIN "ProductVariantAttributeValue" av ON av."definitionId" = d."id"
      JOIN "ProductVariant" v ON v."id" = av."variantId"
      WHERE v."productId" = p."id" AND v."deletedAt" IS NULL AND d."organizationId" = ${organization.id}
        AND d."key" = ${key} AND d."scope" = 'VARIANT_OPTION' AND d."isActive" = true AND d."isFilterable" = true
        AND ((d."valueType" IN ('TEXT', 'ENUM') AND av."valueText" = ${value}) ${numericPredicate} ${booleanPredicate})
    )`);
  }
  const effectiveVariantPrice = Prisma.sql`COALESCE(v."price", p."basePrice")`;
  const availableVariant = Prisma.sql`(NOT p."trackInventory" OR v."allowBackOrder" OR v."inventory" - v."reservedQuantity" > 0)`;
  const rawPrice = Prisma.sql`COALESCE(
    (SELECT MIN(${effectiveVariantPrice}) FROM "ProductVariant" v WHERE v."productId" = p."id" AND v."deletedAt" IS NULL AND ${availableVariant}),
    (SELECT MIN(${effectiveVariantPrice}) FROM "ProductVariant" v WHERE v."productId" = p."id" AND v."deletedAt" IS NULL),
    p."basePrice"
  )`;
  const displayPrice = Prisma.sql`CASE
    WHEN p."discountType" = 'percentage' THEN GREATEST(0, ${rawPrice} * (1 - LEAST(COALESCE(p."discountValue", 0), 100) / 100))
    WHEN p."discountType" = 'fixed' THEN GREATEST(0, ${rawPrice} - COALESCE(p."discountValue", 0))
    ELSE ${rawPrice} END`;
  const baseQuery = Prisma.sql`SELECT p."id", p."name", p."sortOrder", p."createdAt", ${displayPrice} AS "displayPrice"
    FROM "Product" p JOIN "ProductCategory" c ON c."id" = p."categoryId"
    WHERE ${Prisma.join(predicates, " AND ")}`;
  const pricePredicates: PrismaTypes.Sql[] = [];
  if (input.minPrice !== undefined) pricePredicates.push(Prisma.sql`catalog."displayPrice" >= ${input.minPrice}`);
  if (input.maxPrice !== undefined) pricePredicates.push(Prisma.sql`catalog."displayPrice" <= ${input.maxPrice}`);
  const filteredQuery = Prisma.sql`SELECT * FROM (${baseQuery}) catalog ${pricePredicates.length ? Prisma.sql`WHERE ${Prisma.join(pricePredicates, " AND ")}` : Prisma.empty}`;
  const orderBy = input.sort === "price-asc" ? Prisma.sql`catalog."displayPrice" ASC, catalog."id" ASC`
    : input.sort === "price-desc" ? Prisma.sql`catalog."displayPrice" DESC, catalog."id" ASC`
    : input.sort === "name-asc" ? Prisma.sql`catalog."name" ASC, catalog."id" ASC`
    : input.sort === "newest" ? Prisma.sql`catalog."createdAt" DESC, catalog."id" ASC`
    : Prisma.sql`catalog."sortOrder" ASC, catalog."name" ASC, catalog."id" ASC`;
  const [pageRecords, countRecords] = await Promise.all([
    prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`${filteredQuery} ORDER BY ${orderBy} LIMIT ${input.limit} OFFSET ${(input.page - 1) * input.limit}`),
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
  return publicCatalogProductsPageSchema.parse({ products: rows.map((product) => serializePublicCatalogProduct({ ...retailProduct(product, organization.id), purchase: buildPurchase(product.id) })), pagination }) as unknown as PublicCatalogProductsPage;
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
