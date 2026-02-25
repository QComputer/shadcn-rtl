import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { 
  createServiceSchema, 
  updateServiceSchema 
} from "@/lib/validators";
import type { 
  CreateServiceInput, 
  UpdateServiceInput 
} from "@/lib/validators";
import { hasPermission, type UserRole } from "@/lib/types";

export class ServiceService {
  /**
   * Create a new service
   */
  async create(organizationId: string, data: CreateServiceInput & { serviceProviderId?: string }) {
    // Verify category belongs to the organization
    const category = await prisma.serviceCategory.findFirst({
      where: {
        id: data.categoryId,
        organizationId,
        deletedAt: null,
      },
    });

    if (!category) {
      throw new Error("Category not found or does not belong to this organization");
    }

    // If serviceProviderId provided, verify they are a member
    if (data.serviceProviderId) {
      const member = await prisma.organizationMember.findFirst({
        where: {
          id: data.serviceProviderId,
          organizationId,
          isActive: true,
        },
      });

      if (!member) {
        throw new Error("Service provider not found in this organization");
      }
    }

    const service = await prisma.service.create({
      data: {
        name: data.name,
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
        serviceProvider: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true,
          },
        },
      },
    });

    revalidatePath(`/dashboard/services`);
    return service;
  }

  /**
   * Get service by ID
   */
  async getById(id: string) {
    return prisma.service.findUnique({
      where: { id },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
        serviceProvider: {
          select: {
            id: true,
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
    page?: number;
    pageSize?: number;
    categoryId?: string;
    isActive?: boolean;
    search?: string;
    providerId?: string;
  }) {
    const { page = 1, pageSize = 20, categoryId, isActive, search, providerId } = params;

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
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
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
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
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
    page?: number;
    pageSize?: number;
    categoryId?: string;
    isActive?: boolean;
    search?: string;
    organizationId?: string;
  }) {
    const { page = 1, pageSize = 20, categoryId, isActive, search, organizationId } = params;

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
        skip: (page - 1) * pageSize,
        take: pageSize,
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
          serviceProvider: {
            select: {
              id: true,
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
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * Update a service
   */
  async update(id: string, data: Partial<UpdateServiceInput>, userId?: string, userRole?: UserRole) {
    // If user info provided, check permissions
    if (userId && userRole) {
      if (!hasPermission(userRole, "service:update")) {
        throw new Error("Unauthorized");
      }
    }

    // If serviceProviderId provided, verify it's valid
    if (data.serviceProviderId !== undefined) {
      const service = await prisma.service.findUnique({
        where: { id },
        select: { organizationId: true },
      });

      if (!service) {
        throw new Error("Service not found");
      }

      if (data.serviceProviderId) {
        const member = await prisma.organizationMember.findFirst({
          where: {
            id: data.serviceProviderId,
            organizationId: service.organizationId,
            isActive: true,
          },
        });

        if (!member) {
          throw new Error("Service provider not found in this organization");
        }
      }
    }

    // If categoryId provided, verify it belongs to same organization
    if (data.categoryId) {
      const service = await prisma.service.findUnique({
        where: { id },
        select: { organizationId: true },
      });

      if (!service) {
        throw new Error("Service not found");
      }

      const category = await prisma.serviceCategory.findFirst({
        where: {
          id: data.categoryId,
          organizationId: service.organizationId,
          deletedAt: null,
        },
      });

      if (!category) {
        throw new Error("Category not found or does not belong to this organization");
      }
    }

    const service = await prisma.service.update({
      where: { id },
      data,
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
            firstName: true,
            lastName: true,
            avatar: true,
          },
        },
      },
    });

    revalidatePath(`/dashboard/services`);
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
      throw new Error(`Cannot delete service with ${upcomingAppointments} upcoming appointments. Please cancel or reschedule them first.`);
    }

    const service = await prisma.service.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        isActive: false,
      },
    });

    revalidatePath(`/dashboard/services`);
    return service;
  }

  /**
   * Toggle service active status
   */
  async toggleActive(id: string) {
    const service = await prisma.service.findUnique({
      where: { id },
      select: { isActive: true },
    });

    if (!service) {
      throw new Error("Service not found");
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
