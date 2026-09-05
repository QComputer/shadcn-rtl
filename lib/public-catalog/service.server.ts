import "server-only";

import { ApiError } from "@/lib/api-guards";
import { prisma } from "@/lib/db";
import { activePublicBusinessCapabilities } from "@/lib/organization-public-home";
import { resolveOrganizationEndpointForTenant } from "@/lib/organization-endpoints.server";
import { buildProductPurchaseHandoff } from "@/lib/purchase-intent";
import type { PublicCatalogPagination } from "@/lib/public-catalog/contracts";
import { serializePublicCatalogCategory, serializePublicCatalogProduct } from "@/lib/public-catalog/serializers";
import type { Prisma } from "@prisma/client";

const publicVariantSelect = {
  id: true, name: true, price: true, inventory: true, allowBackOrder: true,
} satisfies Prisma.ProductVariantSelect;
const publicCategorySelect = { id: true, slug: true, name: true } satisfies Prisma.ProductCategorySelect;
const publicProductSelect = {
  id: true, slug: true, name: true, description: true, basePrice: true, image: true, images: { select: { url: true } },
  discountType: true, discountValue: true, trackInventory: true,
  category: { select: publicCategorySelect },
  variants: { where: { deletedAt: null }, orderBy: [{ name: "asc" }, { id: "asc" }], select: publicVariantSelect },
} satisfies Prisma.ProductSelect;

async function requirePublicShop(identifier: string) {
  const organization = await prisma.organization.findFirst({
    where: { slug: identifier, isActive: true, deletedAt: null, isPlatformOwner: false },
    select: {
      id: true, slug: true, name: true, description: true, logo: true, coverImage: true,
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
const visibleProductWhere = { isActive: true, deletedAt: null, category: visibleCategoryWhere } as const;

export async function listPublicCatalogCategories(organizationIdentifier: string) {
  const organization = await requirePublicShop(organizationIdentifier);
  const categories = await prisma.productCategory.findMany({
    where: { organizationId: organization.id, ...visibleCategoryWhere },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }, { id: "asc" }],
    select: {
      id: true, slug: true, name: true, description: true, sortOrder: true, image: true,
      _count: { select: { products: { where: { isActive: true, deletedAt: null } } } },
    },
  });
  return { organization, categories: categories.map((category) => serializePublicCatalogCategory({ ...category, productCount: category._count.products })) };
}

export async function getPublicCatalogCategory(organizationIdentifier: string, categoryIdentifier: string) {
  const organization = await requirePublicShop(organizationIdentifier);
  const category = await prisma.productCategory.findFirst({
    where: { organizationId: organization.id, ...visibleCategoryWhere, OR: [{ id: categoryIdentifier }, { slug: categoryIdentifier }] },
    select: {
      id: true, slug: true, name: true, description: true, sortOrder: true, image: true,
      _count: { select: { products: { where: { isActive: true, deletedAt: null } } } },
    },
  });
  if (!category) throw new ApiError(404, "Category not found");
  return serializePublicCatalogCategory({ ...category, productCount: category._count.products });
}

export async function listPublicCatalogProducts(input: {
  organizationIdentifier: string; page: number; limit: number; category?: string; q?: string;
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
    ...visibleProductWhere,
    ...(categoryId ? { categoryId } : {}),
    ...(input.q ? { OR: [{ name: { contains: input.q, mode: "insensitive" as const } }, { description: { contains: input.q, mode: "insensitive" as const } }] } : {}),
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
  return { products: rows.map((product) => serializePublicCatalogProduct({ ...product, images: product.images.map((img) => img.url), purchase: buildPurchase(product.id) })), pagination };
}

export async function getPublicCatalogProduct(organizationIdentifier: string, productIdentifier: string) {
  const organization = await requirePublicShop(organizationIdentifier);
  const product = await prisma.product.findFirst({
    where: {
      organizationId: organization.id, ...visibleProductWhere,
      OR: [{ id: productIdentifier }, { slug: productIdentifier }],
    },
    select: publicProductSelect,
  });
  if (!product) throw new ApiError(404, "Product not found");
  const buildPurchase = await purchaseBuilder(organization);
  return serializePublicCatalogProduct({ ...product, images: product.images.map((img) => img.url), purchase: buildPurchase(product.id) });
}

export async function getPublicCatalogSnapshot(organizationIdentifier: string) {
  const [{ organization, categories }, listing] = await Promise.all([
    listPublicCatalogCategories(organizationIdentifier),
    listPublicCatalogProducts({ organizationIdentifier, page: 1, limit: 20 }),
  ]);
  return {
    organization: {
      identifier: organization.slug, name: organization.name, description: organization.description,
      branding: { logo: organization.logo, cover: organization.coverImage },
    },
    priceUnit: "TOMAN" as const,
    categories,
    products: listing.products,
    pagination: listing.pagination,
  };
}
