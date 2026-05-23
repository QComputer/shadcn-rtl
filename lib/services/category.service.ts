import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import type {
  CreateProductCategoryInput,
  UpdateProductCategoryInput,
  CreateServiceCategoryInput,
  UpdateServiceCategoryInput,
} from "@/lib/validators";
import { ApiError } from "@/lib/api-guards";
import { normalizePagination } from "@/lib/pagination";

type CategoryListParams = {
  page?: number | string;
  pageSize?: number | string;
  isActive?: boolean;
  search?: string;
  organizationId?: string;
};

async function requireOrganization(organizationId: string, type?: "SHOP" | "APPOINTMENT") {
  const organization = await prisma.organization.findFirst({
    where: {
      id: organizationId,
      deletedAt: null,
      isActive: true,
      ...(type ? { type } : {}),
    },
    select: { id: true, slug: true, type: true },
  });

  if (!organization) {
    throw new ApiError(404, type ? `${type} organization not found` : "Organization not found");
  }

  return organization;
}

function buildCategoryWhere(params: CategoryListParams, organizationId?: string) {
  const where: Record<string, unknown> = { deletedAt: null };
  if (organizationId) where.organizationId = organizationId;
  else if (params.organizationId) where.organizationId = params.organizationId;
  if (params.isActive !== undefined) where.isActive = params.isActive;
  if (params.search) {
    where.OR = [
      { name: { contains: params.search, mode: "insensitive" } },
      { description: { contains: params.search, mode: "insensitive" } },
    ];
  }
  return where;
}

// Product Category Service
export class ProductCategoryService {
  async create(organizationId: string, data: CreateProductCategoryInput) {
    const org = await requireOrganization(organizationId, "SHOP");

    const duplicate = await prisma.productCategory.findFirst({
      where: {
        organizationId,
        deletedAt: null,
        name: { equals: data.name, mode: "insensitive" },
      },
      select: { id: true },
    });
    if (duplicate) {
      throw new ApiError(409, "A product category with this name already exists");
    }

    const category = await prisma.productCategory.create({
      data: {
        ...data,
        organizationId,
        organizationSlug: org.slug,
      },
    });

    revalidatePath(`/dashboard/product-categories`);
    return category;
  }

  async getById(id: string) {
    return prisma.productCategory.findFirst({
      where: { id, deletedAt: null },
      include: {
        products: {
          where: { deletedAt: null },
        },
      },
    });
  }

  async list(organizationId: string, params: CategoryListParams) {
    const pagination = normalizePagination(params, { maxPageSize: 100 });
    const where = buildCategoryWhere(params, organizationId);

    const [data, total] = await Promise.all([
      prisma.productCategory.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        include: {
          _count: {
            select: { products: { where: { deletedAt: null } } },
          },
        },
      }),
      prisma.productCategory.count({ where }),
    ]);

    return {
      data,
      total,
      page: pagination.page,
      pageSize: pagination.pageSize,
      totalPages: Math.ceil(total / pagination.pageSize),
    };
  }

  async listAll(params: CategoryListParams) {
    const pagination = normalizePagination(params, { maxPageSize: 100 });
    const where = buildCategoryWhere(params);

    const [data, total] = await Promise.all([
      prisma.productCategory.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        include: {
          organization: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
          _count: {
            select: { products: { where: { deletedAt: null } } },
          },
        },
      }),
      prisma.productCategory.count({ where }),
    ]);

    return {
      data,
      total,
      page: pagination.page,
      pageSize: pagination.pageSize,
      totalPages: Math.ceil(total / pagination.pageSize),
    };
  }

  async update(id: string, data: UpdateProductCategoryInput) {
    const existing = await prisma.productCategory.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, organizationId: true },
    });
    if (!existing) throw new ApiError(404, "Product category not found");

    if (data.name) {
      const duplicate = await prisma.productCategory.findFirst({
        where: {
          organizationId: existing.organizationId,
          deletedAt: null,
          id: { not: id },
          name: { equals: data.name, mode: "insensitive" },
        },
        select: { id: true },
      });
      if (duplicate) {
        throw new ApiError(409, "A product category with this name already exists");
      }
    }

    const category = await prisma.productCategory.update({
      where: { id },
      data,
    });

    revalidatePath(`/dashboard/product-categories`);
    return category;
  }

  async delete(id: string) {
    const activeProductCount = await prisma.product.count({
      where: { categoryId: id, deletedAt: null },
    });
    if (activeProductCount > 0) {
      throw new ApiError(400, "Cannot delete a category that still has products");
    }

    const category = await prisma.productCategory.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });

    revalidatePath(`/dashboard/product-categories`);
    return category;
  }
}

// Service Category Service
export class ServiceCategoryService {
  async create(organizationId: string, data: CreateServiceCategoryInput) {
    await requireOrganization(organizationId, "APPOINTMENT");

    const duplicate = await prisma.serviceCategory.findFirst({
      where: {
        organizationId,
        deletedAt: null,
        name: { equals: data.name, mode: "insensitive" },
      },
      select: { id: true },
    });
    if (duplicate) {
      throw new ApiError(409, "A service category with this name already exists");
    }

    const category = await prisma.serviceCategory.create({
      data: {
        ...data,
        organizationId,
      },
    });

    revalidatePath(`/dashboard/service-categories`);
    return category;
  }

  async getById(id: string) {
    return prisma.serviceCategory.findFirst({
      where: { id, deletedAt: null },
      include: {
        services: {
          where: { deletedAt: null },
        },
      },
    });
  }

  async list(organizationId: string, params: CategoryListParams) {
    const pagination = normalizePagination(params, { maxPageSize: 100 });
    const where = buildCategoryWhere(params, organizationId);

    const [data, total] = await Promise.all([
      prisma.serviceCategory.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        include: {
          _count: {
            select: { services: { where: { deletedAt: null } } },
          },
        },
      }),
      prisma.serviceCategory.count({ where }),
    ]);

    return {
      data,
      total,
      page: pagination.page,
      pageSize: pagination.pageSize,
      totalPages: Math.ceil(total / pagination.pageSize),
    };
  }

  async listAll(params: CategoryListParams) {
    const pagination = normalizePagination(params, { maxPageSize: 100 });
    const where = buildCategoryWhere(params);

    const [data, total] = await Promise.all([
      prisma.serviceCategory.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        include: {
          organization: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
          _count: {
            select: { services: { where: { deletedAt: null } } },
          },
        },
      }),
      prisma.serviceCategory.count({ where }),
    ]);

    return {
      data,
      total,
      page: pagination.page,
      pageSize: pagination.pageSize,
      totalPages: Math.ceil(total / pagination.pageSize),
    };
  }

  async listPublic(organizationId: string) {
    return prisma.serviceCategory.findMany({
      where: {
        organizationId,
        deletedAt: null,
        isActive: true,
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: {
        services: {
          where: { deletedAt: null, isActive: true },
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
          include: {
            serviceProvider: {
              select: {
                id: true,
                name: true,
                firstName: true,
                lastName: true,
                avatar: true,
              },
            },
          },
        },
      },
    });
  }

  async update(id: string, data: UpdateServiceCategoryInput) {
    const existing = await prisma.serviceCategory.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, organizationId: true },
    });
    if (!existing) throw new ApiError(404, "Service category not found");

    if (data.name) {
      const duplicate = await prisma.serviceCategory.findFirst({
        where: {
          organizationId: existing.organizationId,
          deletedAt: null,
          id: { not: id },
          name: { equals: data.name, mode: "insensitive" },
        },
        select: { id: true },
      });
      if (duplicate) {
        throw new ApiError(409, "A service category with this name already exists");
      }
    }

    const category = await prisma.serviceCategory.update({
      where: { id },
      data,
    });

    revalidatePath(`/dashboard/service-categories`);
    return category;
  }

  async delete(id: string) {
    const activeServiceCount = await prisma.service.count({
      where: { categoryId: id, deletedAt: null },
    });
    if (activeServiceCount > 0) {
      throw new ApiError(400, "Cannot delete a category that still has services");
    }

    const category = await prisma.serviceCategory.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });

    revalidatePath(`/dashboard/service-categories`);
    return category;
  }
}

export const productCategoryService = new ProductCategoryService();
export const serviceCategoryService = new ServiceCategoryService();
