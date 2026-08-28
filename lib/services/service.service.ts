import { prisma } from "@/lib/db";
import { revalidatePath, revalidateTag } from "next/cache";
import { 
  createServiceSchema, 
  updateServiceSchema 
} from "@/lib/validators";
import type { 
  CreateServiceInput, 
  UpdateServiceInput 
} from "@/lib/validators";
import { hasPermission, type UserRole } from "@/lib/types";
import { ApiError } from "@/lib/api-guards";
import { buildOrganizationPublicPath } from "@/lib/custom-domain-routing";
import { buildUniqueDetailSlug, normalizeDetailSlug } from "@/lib/detail-slugs";
import { normalizePagination } from "@/lib/pagination";
import { supportedLocales } from "@/lib/i18n";
import { canReadAiMediaEntityAttachmentColumns } from "@/lib/services/ai-media-entity-attachment-service";

function revalidateAppointmentServicePages(serviceId: string, organizationSlug: string, segments: Array<string | null | undefined> = []) {
  const uniqueSegments = Array.from(new Set([serviceId, ...segments].filter(Boolean)));

  for (const locale of supportedLocales) {
    revalidatePath(buildOrganizationPublicPath({ locale, organizationSlug, surface: "appointment" }));
    revalidatePath(buildOrganizationPublicPath({ locale, organizationSlug, surface: "appointment", subPath: "/services" }));
    for (const segment of uniqueSegments) {
      revalidatePath(buildOrganizationPublicPath({ locale, organizationSlug, surface: "appointment", subPath: `/services/${segment}` }));
    }
  }

  revalidateTag("home-page", "max");
}

export class ServiceService {
  private async buildUniqueSlug(organizationId: string, source: string, excludeId?: string) {
    return buildUniqueDetailSlug(source, async (candidate) => {
      const existing = await prisma.service.findFirst({
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

  /**
   * Create a new service
   */
  async create(organizationId: string, data: CreateServiceInput & { serviceProviderId?: string }) {
    const includeAiMediaAttachment = canReadAiMediaEntityAttachmentColumns();
    // Verify category belongs to the organization
    const category = await prisma.serviceCategory.findFirst({
      where: {
        id: data.categoryId,
        organizationId,
        deletedAt: null,
      },
    });

    if (!category) {
      throw new ApiError(400, "Category not found or does not belong to this organization");
    }

    // If serviceProviderId provided, verify they are a member
    if (data.serviceProviderId) {
      const member = await prisma.organizationMember.findFirst({
        where: {
          userId: data.serviceProviderId,
          organizationId,
          isActive: true,
        },
      });

      if (!member) {
        throw new ApiError(400, "Service provider not found in this organization");
      }
    }

    const organization = await prisma.organization.findFirst({
      where: { id: organizationId, deletedAt: null, isActive: true, type: "APPOINTMENT" },
      select: { id: true, slug: true },
    });
    if (!organization) throw new ApiError(404, "Appointment organization not found");

    const service = await prisma.service.create({
      data: {
        name: data.name,
        slug: await this.buildUniqueSlug(organizationId, data.slug || data.name),
        description: data.description,
        price: data.price,
        duration: data.duration,
        image: data.image,
        sortOrder: data.sortOrder || 0,
        isActive: true,
        organizationId,
        categoryId: data.categoryId,
        serviceProviderId: data.serviceProviderId,
      },
      include: {
        category: {
          select: {
            id: true,
            name: true,
          },
        },
        ...(includeAiMediaAttachment ? { aiPrimaryMediaAsset: { select: { id: true } } } : {}),
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

    revalidatePath(`/dashboard/services`);
    revalidateAppointmentServicePages(service.id, organization.slug, [service.slug]);
    return service;
  }

  /**
   * Get service by ID
   */
  async getById(id: string) {
    const includeAiMediaAttachment = canReadAiMediaEntityAttachmentColumns();
    return prisma.service.findFirst({
      where: { id, deletedAt: null },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
            description: true,
          },
        },
        serviceProvider: {
          select: {
            id: true,
            name: true,
            firstName: true,
            lastName: true,
            avatar: true,
            phone: true,
          },
        },
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
            type: true,
          },
        },
        _count: {
          select: {
            appointments: {
              where: {
                status: { in: ["COMPLETED", "CONFIRMED"] },
              },
            },
          },
        },
      },
    });
  }

  /**
   * List services with pagination and filtering
   */
  async list(organizationId: string, params: {
    page?: number | string;
    pageSize?: number | string;
    categoryId?: string;
    isActive?: boolean;
    search?: string;
    providerId?: string;
  }) {
    const includeAiMediaAttachment = canReadAiMediaEntityAttachmentColumns();
    const { categoryId, isActive, search, providerId } = params;
    const pagination = normalizePagination(params, { maxPageSize: 100 });

    const where: Record<string, unknown> = {
      organizationId,
      deletedAt: null,
    };

    if (categoryId) where.categoryId = categoryId;
    if (isActive !== undefined) where.isActive = isActive;
    if (providerId) where.serviceProviderId = providerId;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }

    const [data, total] = await Promise.all([
      prisma.service.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        include: {
          category: {
            select: {
              id: true,
              name: true,
            },
          },
          ...(includeAiMediaAttachment ? { aiPrimaryMediaAsset: { select: { id: true } } } : {}),
          serviceProvider: {
            select: {
              id: true,
              name: true,
              firstName: true,
              lastName: true,
              avatar: true,
            },
          },
          _count: {
            select: {
              appointments: {
                where: { deletedAt: null },
              },
            },
          },
        },
      }),
      prisma.service.count({ where }),
    ]);

    return {
      data,
      total,
      page: pagination.page,
      pageSize: pagination.pageSize,
      totalPages: Math.ceil(total / pagination.pageSize),
    };
  }

  /**
   * List services for a service provider (staff member)
   */
  async listByProvider(userId: string, organizationId?: string) {
    const where: Record<string, unknown> = {
      serviceProviderId: userId,
      deletedAt: null,
      isActive: true,
    };

    if (organizationId) {
      where.organizationId = organizationId;
    }

    return prisma.service.findMany({
      where,
      include: {
        category: {
          select: {
            id: true,
            name: true,
          },
        },
        organization: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            appointments: {
              where: {
                status: { in: ["COMPLETED", "CONFIRMED"] },
              },
            },
          },
        },
      },
      orderBy: { name: "asc" },
    });
  }

  /**
   * List all services across all organizations (SUPER_ADMIN only)
   */
  async listAll(params: {
    page?: number | string;
    pageSize?: number | string;
    categoryId?: string;
    isActive?: boolean;
    search?: string;
    organizationId?: string;
  }) {
    const includeAiMediaAttachment = canReadAiMediaEntityAttachmentColumns();
    const { categoryId, isActive, search, organizationId } = params;
    const pagination = normalizePagination(params, { maxPageSize: 100 });

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

    const [data, total] = await Promise.all([
      prisma.service.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        include: {
          category: {
            select: {
              id: true,
              name: true,
            },
          },
          organization: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
          ...(includeAiMediaAttachment ? { aiPrimaryMediaAsset: { select: { id: true } } } : {}),
          serviceProvider: {
            select: {
              id: true,
              name: true,
              firstName: true,
              lastName: true,
              avatar: true,
            },
          },
          _count: {
            select: {
              appointments: {
                where: { deletedAt: null },
              },
            },
          },
        },
      }),
      prisma.service.count({ where }),
    ]);

    return {
      data,
      total,
      page: pagination.page,
      pageSize: pagination.pageSize,
      totalPages: Math.ceil(total / pagination.pageSize),
    };
  }

  /**
   * Update a service
   */
  async update(id: string, data: Partial<UpdateServiceInput>, userId?: string, userRole?: UserRole) {
    if (userId && userRole) {
      if (!hasPermission(userRole, "service:update")) {
        throw new ApiError(403, "Forbidden");
      }
    }

    const existingService = await prisma.service.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        name: true,
        slug: true,
        organizationId: true,
        organization: { select: { slug: true } },
      },
    });

    if (!existingService) {
      throw new ApiError(404, "Service not found");
    }

    if (data.serviceProviderId !== undefined) {
      if (data.serviceProviderId) {
        const member = await prisma.organizationMember.findFirst({
          where: {
            userId: data.serviceProviderId,
            organizationId: existingService.organizationId,
            isActive: true,
          },
        });

        if (!member) {
          throw new ApiError(400, "Service provider not found in this organization");
        }
      }
    }

    if (data.categoryId) {
      const category = await prisma.serviceCategory.findFirst({
        where: {
          id: data.categoryId,
          organizationId: existingService.organizationId,
          deletedAt: null,
        },
      });

      if (!category) {
        throw new ApiError(400, "Category not found or does not belong to this organization");
      }
    }

    const nextData = {
      ...data,
      ...(data.slug
        ? { slug: await this.buildUniqueSlug(existingService.organizationId, normalizeDetailSlug(data.slug, "service"), id) }
        : !existingService.slug
          ? { slug: await this.buildUniqueSlug(existingService.organizationId, data.name || existingService.name, id) }
          : {}),
    };

    const service = await prisma.service.update({
      where: { id },
      data: nextData,
      include: {
        category: {
          select: {
            id: true,
            name: true,
          },
        },
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

    revalidatePath(`/dashboard/services`);
    revalidateAppointmentServicePages(service.id, existingService.organization.slug, [existingService.slug, service.slug]);
    return service;
  }

  /**
   * Soft delete a service
   */
  async delete(id: string) {
    // Check for upcoming appointments
    const upcomingAppointments = await prisma.appointment.count({
      where: {
        serviceId: id,
        status: { in: ["PENDING", "CONFIRMED"] },
        startTime: { gte: new Date() },
      },
    });

    if (upcomingAppointments > 0) {
      throw new ApiError(400, `Cannot delete service with ${upcomingAppointments} upcoming appointments. Please cancel or reschedule them first.`);
    }

    const service = await prisma.service.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        isActive: false,
      },
    });

    revalidatePath(`/dashboard/services`);
    const organization = await prisma.organization.findUnique({
      where: { id: service.organizationId },
      select: { slug: true },
    });
    if (organization) {
      revalidateAppointmentServicePages(service.id, organization.slug, [service.slug]);
    }
    return service;
  }

  /**
   * Toggle service active status
   */
  async toggleActive(id: string) {
    const service = await prisma.service.findFirst({
      where: { id, deletedAt: null },
      select: { isActive: true },
    });

    if (!service) {
      throw new ApiError(404, "Service not found");
    }

    const updated = await prisma.service.update({
      where: { id },
      data: { isActive: !service.isActive },
      include: {
        category: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    revalidatePath(`/dashboard/services`);
    return updated;
  }

  /**
   * Get services with their availability for a specific date
   */
  async getServicesWithAvailability(organizationId: string, date: Date) {
    const services = await prisma.service.findMany({
      where: {
        organizationId,
        isActive: true,
        deletedAt: null,
      },
      include: {
        category: {
          select: {
            id: true,
            name: true,
          },
        },
        serviceProvider: {
          select: {
            id: true,
            name: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });

    // Get appointment counts for each service on the date
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const appointments = await prisma.appointment.groupBy({
      by: ["serviceId"],
      where: {
        serviceId: { in: services.map(s => s.id) },
        date: {
          gte: startOfDay,
          lte: endOfDay,
        },
        status: { notIn: ["CANCELLED", "NO_SHOW"] },
      },
      _count: true,
    });

    const appointmentMap = new Map(
      appointments.map(a => [a.serviceId, a._count])
    );

    return services.map(service => ({
      ...service,
      price: Number(service.price),
      appointmentCount: appointmentMap.get(service.id) || 0,
    }));
  }
}

export const serviceService = new ServiceService();
