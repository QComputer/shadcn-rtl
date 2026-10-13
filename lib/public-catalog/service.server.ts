import "server-only";

import { ApiError } from "@/lib/api-guards";
import { prisma } from "@/lib/db";
import { activePublicBusinessCapabilities } from "@/lib/organization-public-home";
import { resolveOrganizationEndpointForTenant } from "@/lib/organization-endpoints.server";
import { buildProductPurchaseHandoff } from "@/lib/purchase-intent";
import type { PublicCatalogPagination, PublicCatalogProductsPage, PublicCatalogSnapshot } from "@/lib/public-catalog/contracts";
import { publicCatalogProductsPageSchema, publicCatalogSnapshotSchema } from "@/lib/public-catalog/contracts";
import { serializePublicCatalogCategory, serializePublicCatalogProduct } from "@/lib/public-catalog/serializers";
import type { Prisma } from "@prisma/client";

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
      _count: { select: { products: { where: { ...visibleProductWhere, organizationId: organization.id } } } },
    },
  });
    return { organization, categories: categories.map((category) => serializePublicCatalogCategory({ ...category, image: null, productCount: category._count.products })) };
}

export async function getPublicCatalogCategory(organizationIdentifier: string, categoryIdentifier: string) {
  const organization = await requirePublicShop(organizationIdentifier);
  const category = await prisma.productCategory.findFirst({
    where: { organizationId: organization.id, ...visibleCategoryWhere, OR: [{ id: categoryIdentifier }, { slug: categoryIdentifier }] },
    select: {
      id: true, slug: true, name: true, description: true, sortOrder: true, image: true,
      _count: { select: { products: { where: { ...visibleProductWhere, organizationId: organization.id } } } },
    },
  });
  if (!category) throw new ApiError(404, "Category not found");
  return serializePublicCatalogCategory({ ...category, image: null, productCount: category._count.products });
}

export async function listPublicCatalogProducts(input: {
  organizationIdentifier: string; page: number; limit: number; category?: string; q?: string; filter?: string[];
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
  const where = {
    organizationId: organization.id,
    ...visibleProductWhereForTenant(organization.id),
    ...(categoryId ? { categoryId } : {}),
    ...(input.q ? { OR: [{ name: { contains: input.q, mode: "insensitive" as const } }, { description: { contains: input.q, mode: "insensitive" as const } }] } : {}),
    ...(input.filter?.length ? { AND: input.filter.map((filter) => {
      const index = filter.indexOf(":");
      const key = filter.slice(0, index);
      const value = filter.slice(index + 1);
      const numeric = Number(value);
      const numericValue = Number.isFinite(numeric) ? numeric : undefined;
      return { OR: [
        { attributeValues: { some: { valueText: value, definition: { organizationId: organization.id, key, isFilterable: true, scope: "PRODUCT" as const } } } },
        ...(numericValue === undefined ? [] : [{ attributeValues: { some: { valueNumber: numericValue, definition: { organizationId: organization.id, key, isFilterable: true, scope: "PRODUCT" as const } } } }]),
        { variants: { some: { deletedAt: null, optionValues: { some: { OR: [{ valueText: value }, ...(numericValue === undefined ? [] : [{ valueNumber: numericValue }])], definition: { organizationId: organization.id, key, isFilterable: true, scope: "VARIANT_OPTION" as const } } } } } },
      ] };
    }) } : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.product.findMany({
      where, skip: (input.page - 1) * input.limit, take: input.limit,
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }, { id: "asc" }], select: publicProductSelect,
    }),
    prisma.product.count({ where }),
  ]);
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
