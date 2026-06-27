import { prisma } from "@/lib/db";
import { revalidatePath, revalidateTag } from "next/cache";
import type {
  CreateProductInput,
  UpdateProductInput,
  CreateProductVariantInput,
  UpdateProductVariantInput,
} from "@/lib/validators";
import { hasPermission, type UserRole } from "@/lib/types";
import { ApiError } from "@/lib/api-guards";
import { buildUniqueDetailSlug, normalizeDetailSlug } from "@/lib/detail-slugs";
import { normalizePagination } from "@/lib/pagination";
import { InventoryMovementReason } from "@prisma/client";
import { supportedLocales } from "@/lib/i18n";

function revalidateShopProductPages(productId: string, organizationSlug: string, segments: Array<string | null | undefined> = []) {
  const uniqueSegments = Array.from(new Set([productId, ...segments].filter(Boolean)));
  for (const locale of supportedLocales) {
    revalidatePath(`/${locale}/shop/${organizationSlug}`);
    for (const segment of uniqueSegments) {
      revalidatePath(`/${locale}/shop/${organizationSlug}/product/${segment}`);
    }
  }
  revalidateTag("home-page", "max");
}

type ProductListParams = {
  page?: number | string;
  pageSize?: number | string;
  organizationId?: string;
  categoryId?: string;
  isActive?: boolean;
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
};

export class ProductService {
  private async buildUniqueSlug(organizationId: string, source: string, excludeId?: string) {
    return buildUniqueDetailSlug(source, async (candidate) => {
      const existing = await prisma.product.findFirst({
        where: {
          organizationId,
          deletedAt: null,
          slug: candidate,
          ...(excludeId ? { id: { not: excludeId } } : {}),
        },
        select: { id: true },
      });

      return Boolean(existing);
    });
  }

  private async requireShopOrganization(organizationId: string) {
    const organization = await prisma.organization.findFirst({
      where: {
        id: organizationId,
        deletedAt: null,
        isActive: true,
        type: "SHOP",
      },
      select: { id: true, slug: true },
    });

    if (!organization) {
      throw new ApiError(404, "Shop organization not found");
    }

    return organization;
  }

  private async requireProductCategory(categoryId: string, organizationId: string) {
    const category = await prisma.productCategory.findFirst({
      where: {
        id: categoryId,
        organizationId,
        deletedAt: null,
        isActive: true,
      },
      select: { id: true },
    });

    if (!category) {
      throw new ApiError(400, "Product category must belong to this organization");
    }
  }

  private buildWhere(params: ProductListParams, includeDeleted = false) {
    const where: Record<string, unknown> = includeDeleted ? {} : { deletedAt: null };

    if (params.organizationId) where.organizationId = params.organizationId;
    if (params.categoryId) where.categoryId = params.categoryId;
    if (params.isActive !== undefined) where.isActive = params.isActive;

    if (params.search) {
      where.OR = [
        { name: { contains: params.search, mode: "insensitive" } },
        { description: { contains: params.search, mode: "insensitive" } },
        { sku: { contains: params.search, mode: "insensitive" } },
        { category: { name: { contains: params.search, mode: "insensitive" } } },
      ];
    }

    if (params.minPrice !== undefined || params.maxPrice !== undefined) {
      where.basePrice = {};
      if (params.minPrice !== undefined) (where.basePrice as Record<string, number>).gte = params.minPrice;
      if (params.maxPrice !== undefined) (where.basePrice as Record<string, number>).lte = params.maxPrice;
    }

    if (params.inStock) {
      where.OR = [
        ...(Array.isArray(where.OR) ? where.OR : []),
      ];
      const existingOr = Array.isArray(where.OR) ? where.OR : [];
      const stockOr = [
        { trackInventory: false },
        { variants: { some: { deletedAt: null, inventory: { gt: 0 } } } },
      ];
      if (existingOr.length) {
        where.AND = [{ OR: existingOr }, { OR: stockOr }];
        delete where.OR;
      } else {
        where.OR = stockOr;
      }
    }

    return where;
  }

  async create(data: CreateProductInput, organizationId: string, userRole: UserRole) {
    if (!hasPermission(userRole, "product:create")) {
      throw new ApiError(403, "Forbidden");
    }

    const organization = await this.requireShopOrganization(organizationId);
    await this.requireProductCategory(data.categoryId, organizationId);

    const product = await prisma.product.create({
      data: {
        ...data,
        slug: await this.buildUniqueSlug(organizationId, data.slug || data.name),
        organizationId,
        organizationSlug: organization.slug,
      },
      include: {
        category: true,
        variants: true,
      },
    });

    await prisma.productVariant.create({
      data: {
        productId: product.id,
        name: "Default",
        price: product.basePrice,
        sku: data.sku || undefined,
        inventory: product.trackInventory ? 0 : 1000,
      },
    });

    const created = await this.getById(product.id);
    revalidatePath(`/dashboard/products`);
    revalidateShopProductPages(product.id, organization.slug, [product.slug]);
    return created;
  }

  async getById(id: string) {
    return prisma.product.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        basePrice: true,
        image: true,
        isActive: true,
        trackInventory: true,
        lowStockThreshold: true,
        sortOrder: true,
        organizationId: true,
        organizationSlug: true,
        categoryId: true,
        discountType: true,
        discountValue: true,
        category: true,
        organization: { select: { id: true, name: true, slug: true, type: true } },
        variants: {
          where: { deletedAt: null },
          orderBy: { name: "asc" },
        },
      },
    });
  }

  async getBySlug(slug: string, organizationSlug: string) {
    const organization = await prisma.organization.findFirst({
      where: { slug: organizationSlug, deletedAt: null, isActive: true },
      select: { id: true },
    });

    if (!organization) {
      throw new ApiError(404, "Organization not found");
    }

    return prisma.product.findFirst({
      where: {
        OR: [{ id: slug }, { slug }],
        organizationId: organization.id,
        isActive: true,
        deletedAt: null,
      },
      include: {
        category: true,
        variants: {
          where: { deletedAt: null },
          orderBy: { name: "asc" },
        },
      },
    });
  }

  async list(params: ProductListParams) {
    const pagination = normalizePagination(params, { maxPageSize: 100 });
    const where = this.buildWhere(params);

    const [data, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        include: {
          category: true,
          variants: {
            where: { deletedAt: null },
            orderBy: { name: "asc" },
          },
        },
      }),
      prisma.product.count({ where }),
    ]);

    return {
      data,
      total,
      page: pagination.page,
      pageSize: pagination.pageSize,
      totalPages: Math.ceil(total / pagination.pageSize),
    };
  }

  async listAll(params: ProductListParams) {
    const pagination = normalizePagination(params, { maxPageSize: 100 });
    const where = this.buildWhere(params);

    const [data, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        include: {
          organization: { select: { id: true, name: true, slug: true } },
          category: true,
          variants: {
            where: { deletedAt: null },
            orderBy: { name: "asc" },
          },
        },
      }),
      prisma.product.count({ where }),
    ]);

    return {
      data,
      total,
      page: pagination.page,
      pageSize: pagination.pageSize,
      totalPages: Math.ceil(total / pagination.pageSize),
    };
  }

  async update(id: string, data: UpdateProductInput, userRole: UserRole) {
    if (!hasPermission(userRole, "product:update")) {
      throw new ApiError(403, "Forbidden");
    }

    const existing = await prisma.product.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, name: true, slug: true, organizationId: true, organizationSlug: true },
    });
    if (!existing) throw new ApiError(404, "Product not found");

    if (data.categoryId) {
      await this.requireProductCategory(data.categoryId, existing.organizationId);
    }

    const nextData = {
      ...data,
      ...(data.slug
        ? { slug: await this.buildUniqueSlug(existing.organizationId, normalizeDetailSlug(data.slug, "product"), id) }
        : !existing.slug
          ? { slug: await this.buildUniqueSlug(existing.organizationId, data.name || existing.name, id) }
          : {}),
    };

    const product = await prisma.product.update({
      where: { id },
      data: {
        ...nextData,
        ...(data.discountType === "none" ? { discountValue: 0 } : {}),
      },
      include: {
        category: true,
        variants: { where: { deletedAt: null } },
      },
    });

    revalidatePath(`/dashboard/products`);
    revalidateShopProductPages(product.id, product.organizationSlug, [existing.slug, product.slug]);
    return product;
  }

  async delete(id: string, userRole: UserRole) {
    if (!hasPermission(userRole, "product:delete")) {
      throw new ApiError(403, "Forbidden");
    }

    const product = await prisma.product.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });

    await prisma.productVariant.updateMany({
      where: { productId: id, deletedAt: null },
      data: { deletedAt: new Date() },
    });

    revalidatePath(`/dashboard/products`);
    revalidateShopProductPages(product.id, product.organizationSlug, [product.slug]);
    return product;
  }

  async hardDelete(id: string, userRole: UserRole) {
    if (userRole !== "SUPER_ADMIN") {
      throw new ApiError(403, "Forbidden");
    }

    await prisma.productVariant.deleteMany({ where: { productId: id } });
    await prisma.product.delete({ where: { id } });

    revalidatePath(`/dashboard/products`);
    return null;
  }

  async hardDeleteVariant(id: string, userRole: UserRole) {
    if (userRole !== "SUPER_ADMIN") {
      throw new ApiError(403, "Forbidden");
    }

    await prisma.productVariant.delete({ where: { id } });
    return null;
  }

  async createVariant(
    productId: string,
    data: CreateProductVariantInput,
    userRole: UserRole,
    actorUserId?: string,
  ) {
    if (!hasPermission(userRole, "product:update")) {
      throw new ApiError(403, "Forbidden");
    }

    const product = await prisma.product.findFirst({
      where: { id: productId, deletedAt: null },
      select: { id: true, trackInventory: true },
    });
    if (!product) throw new ApiError(404, "Product not found");

    const initialInventory = product.trackInventory ? data.inventory ?? 0 : data.inventory ?? 1000;

    const variant = await prisma.$transaction(async (tx) => {
      const created = await tx.productVariant.create({
        data: {
          ...data,
          productId,
          inventory: initialInventory,
        },
      });

      if (initialInventory !== 0) {
        await tx.inventoryMovement.create({
          data: {
            variantId: created.id,
            quantityDelta: initialInventory,
            quantityBefore: 0,
            quantityAfter: initialInventory,
            reason: InventoryMovementReason.INITIAL_STOCK,
            note: "Initial stock recorded when product variant was created",
            createdById: actorUserId ?? null,
          },
        });
      }

      return created;
    });

    revalidatePath(`/dashboard/products`);
    return variant;
  }

  async updateVariant(data: UpdateProductVariantInput, userRole: UserRole, actorUserId?: string) {
    if (!hasPermission(userRole, "product:update")) {
      throw new ApiError(403, "Forbidden");
    }

    const existing = await prisma.productVariant.findFirst({
      where: { id: data.id, deletedAt: null },
      select: { id: true, inventory: true },
    });
    if (!existing) throw new ApiError(404, "Product variant not found");

    const variant = await prisma.$transaction(async (tx) => {
      const updated = await tx.productVariant.update({
        where: { id: data.id },
        data,
      });

      if (typeof data.inventory === "number" && data.inventory !== existing.inventory) {
        await tx.inventoryMovement.create({
          data: {
            variantId: updated.id,
            quantityDelta: data.inventory - existing.inventory,
            quantityBefore: existing.inventory,
            quantityAfter: data.inventory,
            reason: InventoryMovementReason.MANUAL_ADJUSTMENT,
            note: "Manual inventory adjustment from dashboard product variant update",
            createdById: actorUserId ?? null,
          },
        });
      }

      return updated;
    });

    revalidatePath(`/dashboard/products`);
    return variant;
  }

  async deleteVariant(id: string, userRole: UserRole) {
    if (!hasPermission(userRole, "product:delete")) {
      throw new ApiError(403, "Forbidden");
    }

    const variant = await prisma.productVariant.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, productId: true },
    });
    if (!variant) throw new ApiError(404, "Product variant not found");

    const activeVariantCount = await prisma.productVariant.count({
      where: { productId: variant.productId, deletedAt: null },
    });
    if (activeVariantCount <= 1) {
      throw new ApiError(400, "A product must keep at least one active variant");
    }

    const deleted = await prisma.productVariant.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    revalidatePath(`/dashboard/products`);
    return deleted;
  }

  async getVariants(productId: string) {
    return prisma.productVariant.findMany({
      where: {
        productId,
        deletedAt: null,
      },
      orderBy: { name: "asc" },
    });
  }

  async getVariant(id: string) {
    return prisma.productVariant.findFirst({
      where: {
        id,
        deletedAt: null,
      },
    });
  }
}

export const productService = new ProductService();
