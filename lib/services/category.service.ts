import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import type {
  CreateProductCategoryInput,
  UpdateProductCategoryInput,
  CreateServiceCategoryInput,
  UpdateServiceCategoryInput,
} from "@/lib/validators";
import { ApiError } from "@/lib/api-guards";
import { buildUniqueCategorySlug, normalizeCategorySlug } from "@/lib/category-slugs";
import { normalizePagination } from "@/lib/pagination";
import { buildOrganizationPublicPath } from "@/lib/custom-domain-routing";

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

function revalidateCategoryPublicPages(input: {
  organizationSlug: string;
  mode: "shop" | "appointment";
  segments: Array<string | null | undefined>;
}) {
  const locales = ["fa", "en", "ar"] as const;
  const uniqueSegments = Array.from(new Set(input.segments.filter(Boolean)));

  for (const locale of locales) {
    if (input.mode === "shop") {
      revalidatePath(buildOrganizationPublicPath({ locale, organizationSlug: input.organizationSlug, surface: "shop" }));
      for (const segment of uniqueSegments) {
        revalidatePath(buildOrganizationPublicPath({ locale, organizationSlug: input.organizationSlug, surface: "shop", subPath: `/category/${segment}` }));
      }
    } else {
      revalidatePath(buildOrganizationPublicPath({ locale, organizationSlug: input.organizationSlug, surface: "appointment", subPath: "/services" }));
      for (const segment of uniqueSegments) {
        revalidatePath(buildOrganizationPublicPath({ locale, organizationSlug: input.organizationSlug, surface: "appointment", subPath: `/services/category/${segment}` }));
      }
    }
  }
}

// Product Category Service
export class ProductCategoryService {
  private async buildUniqueSlug(organizationId: string, source: string, excludeId?: string) {
    return buildUniqueCategorySlug(source, async (candidate) => {
      const existing = await prisma.productCategory.findFirst({
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
        slug: await this.buildUniqueSlug(organizationId, data.slug || data.name),
        organizationId,
        organizationSlug: org.slug,
      },
    });

    revalidatePath(`/dashboard/product-categories`);
    revalidateCategoryPublicPages({
      organizationSlug: org.slug,
      mode: "shop",
      segments: [category.id, category.slug],
    });
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
      select: { id: true, name: true, slug: true, organizationId: true, organizationSlug: true },
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

    const nextData = {
      ...data,
      ...(data.slug
        ? { slug: await this.buildUniqueSlug(existing.organizationId, normalizeCategorySlug(data.slug), id) }
        : !existing.slug
          ? { slug: await this.buildUniqueSlug(existing.organizationId, data.name || existing.name, id) }
          : {}),
    };

    const category = await prisma.productCategory.update({
      where: { id },
      data: nextData,
    });

    revalidatePath(`/dashboard/product-categories`);
    revalidateCategoryPublicPages({
      organizationSlug: existing.organizationSlug,
      mode: "shop",
      segments: [existing.id, existing.slug, category.slug],
    });
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
  private async buildUniqueSlug(organizationId: string, source: string, excludeId?: string) {
    return buildUniqueCategorySlug(source, async (candidate) => {
      const existing = await prisma.serviceCategory.findFirst({
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

  async create(organizationId: string, data: CreateServiceCategoryInput) {
    const org = await requireOrganization(organizationId, "APPOINTMENT");

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
        slug: await this.buildUniqueSlug(organizationId, data.slug || data.name),
        organizationId,
      },
    });

    revalidatePath(`/dashboard/service-categories`);
    revalidateCategoryPublicPages({
      organizationSlug: org.slug,
      mode: "appointment",
      segments: [category.id, category.slug],
    });
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
      select: {
        id: true,
        name: true,
        slug: true,
        organizationId: true,
        organization: { select: { slug: true } },
      },
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

    const nextData = {
      ...data,
      ...(data.slug
        ? { slug: await this.buildUniqueSlug(existing.organizationId, normalizeCategorySlug(data.slug), id) }
        : !existing.slug
          ? { slug: await this.buildUniqueSlug(existing.organizationId, data.name || existing.name, id) }
          : {}),
    };

    const category = await prisma.serviceCategory.update({
      where: { id },
      data: nextData,
    });

    revalidatePath(`/dashboard/service-categories`);
    revalidateCategoryPublicPages({
      organizationSlug: existing.organization.slug,
      mode: "appointment",
      segments: [existing.id, existing.slug, category.slug],
    });
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
