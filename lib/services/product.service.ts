import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { 
  createProductSchema, 
  updateProductSchema,
  createProductVariantSchema,
  updateProductVariantSchema,
  productFilterSchema 
} from "@/lib/validators";
import type { 
  CreateProductInput, 
  UpdateProductInput,
  CreateProductVariantInput,
  UpdateProductVariantInput 
} from "@/lib/validators";
import { hasPermission, type UserRole } from "@/lib/types";

export class ProductService {
  async create(data: any, organizationId: string, userRole: UserRole) {
    if (!hasPermission(userRole, "product:create")) {
      throw new Error("Unauthorized");
    }

    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
    });
    if (!organization) return;
    const _product = await prisma.product.create({
      data: { ...data, organizationId, organizationSlug: organization.slug },
    });

    // Creating default variant with default inventory 1000
    const variant = await prisma.productVariant.create({
      data: {
        productId: _product.id,
        name: _product.name,
        price: _product.basePrice,
        sku: _product.sku ? _product.sku + "_0" : undefined,
        inventory: 1000,
      },
    });
    const product = await prisma.product.findUnique({
      where: { id: _product.id },
      include: {
        category: true,
        variants: true,
      },
    });

    revalidatePath(`/dashboard/products`);
    return product;
  }

  async getById(id: string) {
    return prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
        variants: {
          where: { deletedAt: null },
        },
      },
    });
  }

  async getBySlug(slug: string, organizationSlug: string) {
    const organization = await prisma.organization.findUnique({
      where: { slug: organizationSlug },
    });

    if (!organization) {
      throw new Error("Organization not found");
    }

    return prisma.product.findFirst({
      where: {
        id: slug,
        organizationId: organization.id,
        isActive: true,
        deletedAt: null,
      },
      include: {
        category: true,
        variants: {
          where: { deletedAt: null },
        },
      },
    });
  }

  async list(params: {
    page?: number;
    pageSize?: number;
    organizationId?: string;
    categoryId?: string;
    isActive?: boolean;
    search?: string;
    minPrice?: number;
    maxPrice?: number;
    inStock?: boolean;
  }) {
    const {
      page = 1,
      pageSize = 20,
      organizationId,
      categoryId,
      isActive,
      search,
      minPrice,
      maxPrice,
      inStock,
    } = params;

    const where: Record<string, unknown> = {
      deletedAt: null,
    };

    if (organizationId) where.organizationId = organizationId;
    if (categoryId) where.categoryId = categoryId;
    if (isActive !== undefined) where.isActive = isActive;

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }

    if (minPrice || maxPrice) {
      where.basePrice = {};
      if (minPrice) (where.basePrice as Record<string, number>).gte = minPrice;
      if (maxPrice) (where.basePrice as Record<string, number>).lte = maxPrice;
    }

    const [data, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { sortOrder: "asc" },
        include: {
          category: true,
          variants: {
            where: { deletedAt: null },
          },
        },
      }),
      prisma.product.count({ where }),
    ]);

    // Filter inStock if needed
    let filteredData = data;
    if (inStock) {
      filteredData = data.filter(
        (product) =>
          product.variants.some((v) => v.inventory > 0) ||
          !product.trackInventory,
      );
    }

    return {
      data: filteredData,
      total: inStock ? filteredData.length : total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async listAll(params: {
    page?: number;
    pageSize?: number;
    organizationId?: string;
    categoryId?: string;
    isActive?: boolean;
    search?: string;
    minPrice?: number;
    maxPrice?: number;
    inStock?: boolean;
  }) {
    const {
      page = 1,
      pageSize = 20,
      organizationId,
      categoryId,
      isActive,
      search,
      minPrice,
      maxPrice,
      inStock,
    } = params;

    const where: Record<string, unknown> = {};

    if (organizationId) where.organizationId = organizationId;
    if (categoryId) where.categoryId = categoryId;
    if (isActive !== undefined) where.isActive = isActive;

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }

    if (minPrice || maxPrice) {
      where.basePrice = {};
      if (minPrice) (where.basePrice as Record<string, number>).gte = minPrice;
      if (maxPrice) (where.basePrice as Record<string, number>).lte = maxPrice;
    }

    const [data, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { sortOrder: "asc" },
        include: {
          category: true,
          variants: true,
        },
      }),
      prisma.product.count({ where }),
    ]);

    // Filter inStock if needed
    let filteredData = data;
    if (inStock) {
      filteredData = data.filter(
        (product) =>
          product.variants.some((v) => v.inventory > 0) ||
          !product.trackInventory,
      );
    }

    //await this.deleteSingletVariants();

    return {
      data: filteredData,
      total: inStock ? filteredData.length : total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async update(id: string, data: UpdateProductInput, userRole: UserRole) {
    if (!hasPermission(userRole, "product:update")) {
      throw new Error("Unauthorized");
    }

    const product = await prisma.product.update({
      where: { id },
      data,
      include: {
        category: true,
        variants: true,
      },
    });

    revalidatePath(`/dashboard/products`);
    return product;
  }

  async delete(id: string, userRole: UserRole) {
    if (!hasPermission(userRole, "product:delete")) {
      throw new Error("Unauthorized");
    }

    // Soft delete
    const product = await prisma.product.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });

    revalidatePath(`/dashboard/products`);
    return product;
  }

  async hardDelete(id: string, userRole: UserRole) {
    if (userRole !== "SUPER_ADMIN") {
      throw new Error("Unauthorized");
    }

    // hard delete
    await prisma.productVariant.deleteMany({
      where: { productId: id },
    });

    await prisma.product.delete({
      where: { id },
    });

    revalidatePath(`/dashboard/products`);
    return null;
  }

  async hardDeleteVariant(id: string, userRole: UserRole) {
    if (userRole !== "SUPER_ADMIN") {
      throw new Error("Unauthorized");
    }

    // hard delete variant
    await prisma.productVariant.delete({
      where: { id },
    });

    //revalidatePath(`/dashboard/products`);
    return null;
  }

  // Variant methods
  async createVariant(
    productId: string,
    data: CreateProductVariantInput,
    userRole: UserRole,
  ) {
    /*if (!hasPermission(userRole, "product:update")) {
      throw new Error("Unauthorized");
    }*/

    const variant = await prisma.productVariant.create({
      data: {
        ...data,
        productId,
      },
    });

    revalidatePath(`/dashboard/products`);
    return variant;
  }

  async updateVariant(data: UpdateProductVariantInput, userRole: UserRole) {
    /*if (!hasPermission(userRole, "product:update")) {
      throw new Error("Unauthorized");
    }*/
    if (!data?.id) return;

    const variant = await prisma.productVariant.update({
      where: { id: data.id },
      data,
    });

    revalidatePath(`/dashboard/products`);
    return variant;
  }

  async deleteVariant(id: string, userRole: UserRole) {
    if (!hasPermission(userRole, "product:delete")) {
      throw new Error("Unauthorized");
    }

    // Soft delete
    const variant = await prisma.productVariant.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    revalidatePath(`/dashboard/products`);
    return variant;
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
    return prisma.productVariant.findUnique({
      where: {
        id,
        deletedAt: null,
      },
    });
  }

  async deleteSingletVariants() {
  const variants = await prisma.productVariant.findMany({
    select: { id: true,  name: true, product: { select: { variants: true } } },
  });
  variants.forEach((v) => {
    if (v.product.variants?.length < 2) setTimeout(async ()=> {
       await prisma.productVariant.update({
        where: {id: v.id},
        data: {name: null}
       })
       console.log(v.name);
       
    }, 100)
  });

  }
}

export const productService = new ProductService();
