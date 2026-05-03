import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { 
  createProductCategorySchema, 
  updateProductCategorySchema,
  createServiceCategorySchema,
  updateServiceCategorySchema
} from "@/lib/validators";
import type { 
  CreateProductCategoryInput, 
  UpdateProductCategoryInput,
  CreateServiceCategoryInput,
  UpdateServiceCategoryInput
} from "@/lib/validators";
import { hasPermission, type UserRole } from "@/lib/types";

// Product Category Service
export class ProductCategoryService {
  async create(organizationId: string, data: CreateProductCategoryInput) {
    const org = await prisma.organization.findUnique({where: {id: organizationId},
    select:{
      slug:true,
    }})
    if (!org) return
    const category = await prisma.productCategory.create({
      data: {
        ...data,
        organizationId,
        organizationSlug: org?.slug,
      },
    });

    revalidatePath(`/dashboard/products/categories`);
    return category;
  }

  async getById(id: string) {
    return prisma.productCategory.findUnique({
      where: { id },
      include: {
        products: {
          where: { deletedAt: null },
        },
      },
    });
  }

  async list(
    organizationId: string,
    params: {
      page?: number;
      pageSize?: number;
      isActive?: boolean;
      search?: string;
    },
  ) {
    const { page = 1, pageSize = 20, isActive, search } = params;

    const where: Record<string, unknown> = {
      organizationId,
      deletedAt: null,
    };

    if (isActive !== undefined) where.isActive = isActive;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }

    const [data, total] = await Promise.all([
      prisma.productCategory.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { sortOrder: "asc" },
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
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }
  /**
   * List all service categories across all organizations (SUPER_ADMIN only)
   */
  async listAll(params: {
    page?: number;
    pageSize?: number;
    isActive?: boolean;
    search?: string;
    organizationId?: string;
  }) {
    const {
      page = 1,
      pageSize = 20,
      isActive,
      search,
      organizationId,
    } = params;

    const where: Record<string, unknown> = {
      deletedAt: null,
    };

    if (organizationId) where.organizationId = organizationId;
    if (isActive !== undefined) where.isActive = isActive;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }

    const [data, total] = await Promise.all([
      prisma.serviceCategory.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { sortOrder: "asc" },
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
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async update(id: string, data: UpdateProductCategoryInput) {
    const category = await prisma.productCategory.update({
      where: { id },
      data,
    });

    revalidatePath(`/dashboard/products/categories`);
    return category;
  }

  async delete(id: string) {
    // Soft delete
    const category = await prisma.productCategory.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });

    revalidatePath(`/dashboard/products/categories`);
    return category;
  }
}

// Service Category Service
export class ServiceCategoryService {
  async create(organizationId: string, data: CreateServiceCategoryInput) {
    const category = await prisma.serviceCategory.create({
      data: {
        ...data,
        organizationId,
      },
    });

    revalidatePath(`/dashboard/services/categories`);
    return category;
  }

  async getById(id: string) {
    return prisma.serviceCategory.findUnique({
      where: { id },
      include: {
        services: {
          where: { deletedAt: null },
        },
      },
    });
  }

  async list(organizationId: string, params: {
    page?: number;
    pageSize?: number;
    isActive?: boolean;
    search?: string;
  }) {
    const { page = 1, pageSize = 20, isActive, search } = params;

    const where: Record<string, unknown> = {
      organizationId,
      deletedAt: null,
    };

    if (isActive !== undefined) where.isActive = isActive;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }

    const [data, total] = await Promise.all([
      prisma.serviceCategory.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { sortOrder: "asc" },
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
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * List all service categories across all organizations (SUPER_ADMIN only)
   */
  async listAll(params: {
    page?: number;
    pageSize?: number;
    isActive?: boolean;
    search?: string;
    organizationId?: string;
  }) {
    const { page = 1, pageSize = 20, isActive, search, organizationId } = params;

    const where: Record<string, unknown> = {
      deletedAt: null,
    };

    if (organizationId) where.organizationId = organizationId;
    if (isActive !== undefined) where.isActive = isActive;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }

    const [data, total] = await Promise.all([
      prisma.serviceCategory.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { sortOrder: "asc" },
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
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async listPublic(organizationId: string) {
    return prisma.serviceCategory.findMany({
      where: {
        organizationId,
        deletedAt: null,
        isActive: true,
      },
      orderBy: { sortOrder: "asc" },
      include: {
        services: {
          where: { deletedAt: null, isActive: true },
          orderBy: { sortOrder: "asc" },
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
    const category = await prisma.serviceCategory.update({
      where: { id },
      data,
    });

    revalidatePath(`/dashboard/services/categories`);
    return category;
  }

  async delete(id: string) {
    // Soft delete
    const category = await prisma.serviceCategory.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });

    revalidatePath(`/dashboard/services/categories`);
    return category;
  }
}

// Service Service (for individual services)
export class ServiceService {
  async create(organizationId: string, data: CreateServiceCategoryInput & { 
    price: number;
    duration: number;
    categoryId: string;
    serviceProviderId?: string | null;
  }) {
    const { price, duration, categoryId, serviceProviderId, ...categoryData } = data;
    
    // Create category if not exists, or use existing
    let category = await prisma.serviceCategory.findFirst({
      where: { organizationId, name: categoryData.name },
    });

    if (!category) {
      category = await prisma.serviceCategory.create({
        data: {
          ...categoryData,
          organizationId,
        },
      });
    }

    const service = await prisma.service.create({
      data: {
        name: data.name || categoryData.name,
        description: categoryData.description,
        price,
        duration,
        categoryId: category.id,
        organizationId,
        ...(serviceProviderId ? { serviceProviderId } : {}),
      },
      include: {
        category: true,
        serviceProvider: {
          select: {
            id: true,
            name: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    revalidatePath(`/dashboard/services`);
    return service;
  }

  async getById(id: string) {
    return prisma.service.findUnique({
      where: { id },
      include: {
        category: true,
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
    });
  }

  async list(organizationId: string, params: {
    page?: number;
    pageSize?: number;
    categoryId?: string;
    isActive?: boolean;
    search?: string;
  }) {
    const { page = 1, pageSize = 20, categoryId, isActive, search } = params;

    const where: Record<string, unknown> = {
      organizationId,
      deletedAt: null,
    };

    if (categoryId) where.categoryId = categoryId;
    if (isActive !== undefined) where.isActive = isActive;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }

    const [data, total] = await Promise.all([
      prisma.service.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { sortOrder: "asc" },
        include: {
          category: true,
          serviceProvider: {
            select: {
              id: true,
              name: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      }),
      prisma.service.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async update(id: string, data: Partial<{
    name: string;
    description: string | null;
    price: number;
    duration: number;
    image: string | null;
    isActive: boolean;
    categoryId: string;
    serviceProviderId: string | null;
  }>) {
    const service = await prisma.service.update({
      where: { id },
      data,
    });

    revalidatePath(`/dashboard/services`);
    return service;
  }

  async delete(id: string) {
    // Soft delete
    const service = await prisma.service.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });

    revalidatePath(`/dashboard/services`);
    return service;
  }
}

export const productCategoryService = new ProductCategoryService();
export const serviceCategoryService = new ServiceCategoryService();
//export const serviceService = new ServiceService();
