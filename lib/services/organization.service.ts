import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { createOrganizationSchema, updateOrganizationSchema } from "@/lib/validators";
import type { CreateOrganizationInput, UpdateOrganizationInput } from "@/lib/validators";
import { hasPermission, type UserRole, type Permission } from "@/lib/types";

export class OrganizationService {
  async create(data: CreateOrganizationInput, userId: string) {
    // Check if slug is already taken
    const existingSlug = await prisma.organization.findUnique({
      where: { slug: data.slug },
    });

    if (existingSlug) {
      throw new Error("Slug already exists");
    }

    const organization = await prisma.organization.create({
      data: {
        ...data,
        members: {
          create: {
            userId,
            role: "ADMIN",
            isActive: true,
          },
        },
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });

    // Update user's isTeamMember flag
    await prisma.user.update({
      where: { id: userId },
      data: { isTeamMember: true },
    });

    revalidatePath("/dashboard");
    return organization;
  }

  async getById(id: string) {
    return prisma.organization.findUnique({
      where: { id },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                avatar: true,
              },
            },
          },
        },
        businessHours: true,
        settings: true,
      },
    });
  }

  async getBySlug(slug: string) {
    return prisma.organization.findUnique({
      where: { slug },
      include: {
        businessHours: true,
        settings: true,
      },
    });
  }

  async getBySlugPublic(slug: string) {
    return prisma.organization.findUnique({
      where: { slug, isActive: true },
      select: {
        id: true,
        type: true,
        name: true,
        slug: true,
        description: true,
        address: true,
        phone: true,
        email: true,
        logo: true,
        coverImage: true,
        locale: true,
        timezone: true,
      },
    });
  }

  async list(params: {
    page?: number;
    pageSize?: number;
    type?: "SHOP" | "APPOINTMENT";
    isActive?: boolean;
    search?: string;
  }) {
    const { page = 1, pageSize = 20, type, isActive, search } = params;

    const where: Record<string, unknown> = {};

    if (type) where.type = type;
    if (isActive !== undefined) where.isActive = isActive;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { slug: { contains: search, mode: "insensitive" } },
      ];
    }

    const [data, total] = await Promise.all([
      prisma.organization.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: "desc" },
      }),
      prisma.organization.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async update(id: string, data: UpdateOrganizationInput, userRole: UserRole) {
    if (!hasPermission(userRole, "org:update")) {
      throw new Error("Unauthorized");
    }

    const organization = await prisma.organization.update({
      where: { id },
      data,
    });

    revalidatePath(`/dashboard/organizations/${id}`);
    return organization;
  }

  async delete(id: string, userRole: UserRole) {
    if (!hasPermission(userRole, "org:delete")) {
      throw new Error("Unauthorized");
    }

    // Soft delete
    const organization = await prisma.organization.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });

    revalidatePath("/dashboard/organizations");
    return organization;
  }

  async getMembers(organizationId: string) {
    return prisma.organizationMember.findMany({
      where: { organizationId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            avatar: true,
            role: true,
            isActive: true,
          },
        },
      },
      orderBy: { joinedAt: "desc" },
    });
  }

  async addMember(
    organizationId: string,
    userId: string,
    role: "ADMIN" | "MANAGER" | "STAFF",
    addedBy: string
  ) {
    // Check if user is already a member
    const existingMember = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: { organizationId, userId },
      },
    });

    if (existingMember) {
      throw new Error("User is already a member");
    }

    const member = await prisma.organizationMember.create({
      data: {
        organizationId,
        userId,
        role,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // Update user's isTeamMember flag
    await prisma.user.update({
      where: { id: userId },
      data: { isTeamMember: true },
    });

    revalidatePath(`/dashboard/organizations/${organizationId}/members`);
    return member;
  }

  async updateMemberRole(
    organizationId: string,
    userId: string,
    role: "ADMIN" | "MANAGER" | "STAFF"
  ) {
    const member = await prisma.organizationMember.update({
      where: {
        organizationId_userId: { organizationId, userId },
      },
      data: { role },
    });

    revalidatePath(`/dashboard/organizations/${organizationId}/members`);
    return member;
  }

  async removeMember(organizationId: string, userId: string) {
    await prisma.organizationMember.delete({
      where: {
        organizationId_userId: { organizationId, userId },
      },
    });

    revalidatePath(`/dashboard/organizations/${organizationId}/members`);
  }

  async getBusinessHours(organizationId: string) {
    return prisma.businessHour.findMany({
      where: { organizationId },
      orderBy: { day: "asc" },
    });
  }

  async updateBusinessHours(
    organizationId: string,
    hours: Array<{
      day: string;
      openTime: string;
      closeTime: string;
      isOpen: boolean;
    }>
  ) {
    // Delete existing hours and create new ones
    await prisma.businessHour.deleteMany({
      where: { organizationId },
    });

    const businessHours = await prisma.businessHour.createMany({
      data: hours.map((h) => ({
        day: h.day as "MONDAY" | "TUESDAY" | "WEDNESDAY" | "THURSDAY" | "FRIDAY" | "SATURDAY" | "SUNDAY",
        openTime: h.openTime,
        closeTime: h.closeTime,
        isOpen: h.isOpen,
        organizationId,
      })),
    });

    revalidatePath(`/dashboard/organizations/${organizationId}/settings`);
    return businessHours;
  }

  async isMember(userId: string, organizationId: string) {
    const member = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: { organizationId, userId },
      },
    });

    return member?.isActive ?? false;
  }

  async getMemberRole(userId: string, organizationId: string) {
    const member = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: { organizationId, userId },
      },
    });

    return member?.role;
  }
}

export const organizationService = new OrganizationService();
