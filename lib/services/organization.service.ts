import { prisma } from "@/lib/db";
import { revalidatePath, revalidateTag } from "next/cache";
import { createOrganizationSchema, pageSizeSchema, updateOrganizationSchema } from "@/lib/validators";
import type { CreateOrganizationInput, UpdateOrganizationInput } from "@/lib/validators";
import { hasPermission, type UserRole, type Permission } from "@/lib/types";
import { supportedLocales } from "@/lib/i18n";

function revalidateOrganizationPublicPages(slug: string) {
  for (const locale of supportedLocales) {
    revalidatePath(`/${locale}/shop/${slug}`);
    revalidatePath(`/${locale}/shop/${slug}/profile`);
    revalidatePath(`/${locale}/appointment/${slug}`);
  }
}

export class OrganizationService {
  async create(data: CreateOrganizationInput) {
    return prisma.$transaction(async (tx) => {
      const existingSlug = await tx.organization.findUnique({
        where: { slug: data.slug },
        select: { id: true },
      });

      if (existingSlug) {
        throw new Error("Slug already exists");
      }

      const { capabilities, ...organizationData } = data;
      const effectiveCapabilities = [...new Set(capabilities ?? [data.type])];
      const organization = await tx.organization.create({
        data: {
          ...organizationData,
          capabilitiesInitializedAt: new Date(),
          capabilities: {
            create: effectiveCapabilities.map((key) => ({ key, status: "ACTIVE", enabledAt: new Date() })),
          },
        },
        include: { capabilities: true },
      });

      await tx.organizationSettings.create({
        data: { organizationSlug: organization.slug },
      });

      await tx.paymentSettings.create({
        data: { organizationSlug: organization.slug },
      });

      return organization;
    });
  }

  async createByUser(data: CreateOrganizationInput, userId: string) {
    return prisma.$transaction(async (tx) => {
      const existingSlug = await tx.organization.findUnique({
        where: { slug: data.slug },
        select: { id: true },
      });

      if (existingSlug) {
        throw new Error("Slug already exists");
      }

      const { capabilities, ...organizationData } = data;
      const effectiveCapabilities = [...new Set(capabilities ?? [data.type])];
      const organization = await tx.organization.create({
        data: {
          ...organizationData,
          capabilitiesInitializedAt: new Date(),
          capabilities: {
            create: effectiveCapabilities.map((key) => ({ key, status: "ACTIVE", enabledAt: new Date() })),
          },
        },
        include: { capabilities: true },
      });

      await tx.organizationSettings.create({
        data: { organizationSlug: organization.slug },
      });

      await tx.paymentSettings.create({
        data: { organizationSlug: organization.slug },
      });

      await tx.organizationMember.create({
        data: {
          organizationId: organization.id,
          organizationSlug: organization.slug,
          userId,
          role: "ADMIN",
          isActive: true,
        },
      });

      await tx.user.update({
        where: { id: userId },
        data: { isTeamMember: true, role: "ADMIN" },
      });

      return organization;
    });
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
                name: true,
                role: true,
                email: true,
                firstName: true,
                lastName: true,
                avatar: true,
              },
            },
          },
        },
        businessHours: true,
        capabilities: true,
        settings: true,
        paymentSettings: true,
      },
    });
  }

  async getBySlug(slug: string) {
    return prisma.organization.findUnique({
      where: { slug },
      include: {
        businessHours: true,
        capabilities: true,
        settings: true,
        paymentSettings: true,
      },
    });
  }

  async getBySlugPublic(slug: string) {
    return prisma.organization.findUnique({
      where: { slug, isActive: true },
      select: {
        id: true,
        type: true,
        capabilitiesInitializedAt: true,
        capabilities: { where: { status: "ACTIVE" }, select: { key: true, status: true } },
        name: true,
        slug: true,
        description: true,
        address: true,
        lat: true,
        lng: true,
        phone: true,
        email: true,
        logo: true,
        coverImage: true,
        locale: true,
        timezone: true,
        isOpen: true,
        settings: true,
        paymentSettings: true,
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
    //console.log("----------------list organizations----------params", params);

    const where: Record<string, unknown> = {};

    if (type) {
      where.OR = [
        { capabilitiesInitializedAt: null, type },
        { capabilities: { some: { key: type, status: "ACTIVE" } } },
      ];
    }
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

    revalidatePath(`/dashboard/settings/organization`);
    revalidateOrganizationPublicPages(organization.slug);
    revalidateTag("home-page", "max");
    return organization;
  }

  async delete(id: string, userRole: UserRole) {
    if (!hasPermission(userRole, "org:delete")) {
      throw new Error("Unauthorized");
    }
    //  delete
    const _organization = await prisma.organization.findUnique({
      where: { id },
      select: { slug: true, id: true },
    });
    if (!_organization) return;

    await prisma.organizationMember.deleteMany({
      where: {
        organizationSlug: _organization.slug,
        organizationId: _organization.id,
      },
    });
    await prisma.organizationSettings.deleteMany({
      where: {
        organizationSlug: _organization.slug,
      },
    });
        await prisma.paymentSettings.deleteMany({
          where: {
            organizationSlug: _organization.slug,
          },
        });
    await prisma.organization.delete({
      where: { id: _organization.id, slug: _organization.slug },
      //data: { deletedAt: new Date(), isActive: false },
    });

    revalidatePath("/dashboard/organizations");
    return;
  }

  async softDelete(id: string, userRole: UserRole) {
    if (!hasPermission(userRole, "org:delete")) {
      throw new Error("Unauthorized");
    }
    console.log(
      "------------------------->organizationService.softDelete:",
      id,
      "with role:",
      userRole,
    );

    //  delete
    const _organization = await prisma.organization.findUnique({
      where: { id },
      select: { slug: true, id: true },
    });
    if (!_organization) return;
    await prisma.organizationMember.deleteMany({
      where: {
        organizationSlug: _organization.slug,
        organizationId: _organization.id,
      },
    });
    await prisma.organizationSettings.deleteMany({
      where: {
        organizationSlug: _organization.slug,
      },
    });
    await prisma.organization.update({
      where: { id: _organization.id, slug: _organization.slug },
      data: { deletedAt: new Date(), isActive: false },
    });

    revalidatePath("/dashboard/settings");
    return;
  }

  async getAMemberByUserId(userId: string, organizationId?: string) {
    return prisma.organizationMember.findFirst({
      where: {
        userId,
        ...(organizationId ? { organizationId } : {}),
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            role: true,
            email: true,
            firstName: true,
            lastName: true,
            avatar: true,
            isActive: true,
            businessHours: true,
          },
        },
      },
    });
  }

  async getMember(id: string) {
    return prisma.organizationMember.findMany({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            role: true,
            email: true,
            firstName: true,
            lastName: true,
            avatar: true,
            isActive: true,
            businessHours: true,
            providedServices: true,
          },
        },
      },
      orderBy: { joinedAt: "desc" },
    });
  }

  async getMembers(organizationId: string) {
    return prisma.organizationMember.findMany({
      where: { organizationId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            role: true,
            email: true,
            firstName: true,
            lastName: true,
            avatar: true,
            isActive: true,
            businessHours: true,
            providedServices: true,
          },
        },
      },
      orderBy: { joinedAt: "desc" },
    });
  }

  async getAllMembers() {
    return prisma.organizationMember.findMany({
      include: {
        user: {
          select: {
            id: true,
            name: true,
            role: true,
            email: true,
            firstName: true,
            lastName: true,
            avatar: true,
            isActive: true,
            businessHours: true,
            providedServices: true,
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
    addedBy: string,
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

    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { slug: true },
    });

    if (!org) {
      throw new Error("Organization not found");
    }

    const member = await prisma.organizationMember.create({
      data: {
        organizationId,
        organizationSlug: org.slug,
        userId,
        role,
        isActive: true,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            role: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // Update user's isTeamMember flag and role
    await prisma.user.update({
      where: { id: userId },
      data: {
        isTeamMember: true,
        role,
      },
    });

    revalidatePath(`/dashboard/organizations/${organizationId}/members`);
    return member;
  }

  async applyAsMember(organizationSlug: string, userId: string) {
    const organization = await prisma.organization.findUnique({
      where: { slug: organizationSlug },
    });

    if (!organization) {
      throw new Error("organization not found");
    }
    // Check if user is already a member
    const existingMember = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: { organizationId: organization.id, userId },
      },
    });

    if (existingMember) {
      throw new Error("User is already a member");
    }

    // create an inactive staff
    const member = await prisma.organizationMember.create({
      data: {
        organizationId: organization.id,
        organizationSlug,
        userId,
        role: "STAFF",
        isActive: false,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            role: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return member;
  }

  async updateMemberRole(
    organizationId: string,
    userId: string,
    role: "ADMIN" | "MANAGER" | "STAFF" | "DRIVER" | "CUSTOMER",
  ) {
    const member = await prisma.organizationMember.update({
      where: { organizationId_userId: { organizationId, userId } },
      data: { role },
      include: { user: true, organization: true },
    });

    await prisma.user.update({
      where: { id: userId },
      data: {
        isTeamMember: role !== "CUSTOMER",
        role,
      },
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

    const remainingMembership = await prisma.organizationMember.findFirst({
      where: { userId, isActive: true },
    });

    if (!remainingMembership) {
      await prisma.user.update({
        where: { id: userId },
        data: {
          isTeamMember: false,
          role: "CUSTOMER",
        },
      });
    }

    revalidatePath(`/dashboard/organizations/${organizationId}/members`);
  }

  async getBusinessHours(organizationId: string) {
    return prisma.businessHour.findMany({
      where: { organizationId, userId: null },
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
    }>,
  ) {
    // Delete existing hours and create new ones
    await prisma.businessHour.deleteMany({
      where: { organizationId, userId: null },
    });

    const businessHours = await prisma.businessHour.createMany({
      data: hours.map((h) => ({
        day: h.day as
          | "MONDAY"
          | "TUESDAY"
          | "WEDNESDAY"
          | "THURSDAY"
          | "FRIDAY"
          | "SATURDAY"
          | "SUNDAY",
        openTime: h.openTime,
        closeTime: h.closeTime,
        isOpen: h.isOpen,
        organizationId,
      })),
    });

    // Update all staff business hours and wait for every write to finish.
    const organizationMembers = await this.getMembers(organizationId);
    await Promise.all(
      organizationMembers.map((m) =>
        this.updateStaffBusinessHours(m.userId, organizationId, hours),
      ),
    );

    revalidatePath(`/dashboard/settings`);
    return businessHours;
  }

  async updateStaffBusinessHours(
    userId: string,
    organizationId: string,
    hours: Array<{
      day: string;
      openTime: string;
      closeTime: string;
      isOpen: boolean;
    }>,
  ) {
    // Delete existing hours and create new ones
    await prisma.businessHour.deleteMany({
      where: { organizationId, userId },
    });

    const businessHours = await prisma.businessHour.createMany({
      data: hours.map((h) => ({
        day: h.day as
          | "MONDAY"
          | "TUESDAY"
          | "WEDNESDAY"
          | "THURSDAY"
          | "FRIDAY"
          | "SATURDAY"
          | "SUNDAY",
        openTime: h.openTime,
        closeTime: h.closeTime,
        isOpen: h.isOpen,
        organizationId,
        userId,
      })),
    });

    revalidatePath(`/dashboard/settings`);
    return businessHours;
  }

  async copyBusinessHoursToAllStaff(organizationId: string) {
    const hours = await this.getBusinessHours(organizationId);
    const organizationMembers = await this.getMembers(organizationId);
    for (let index = 0; index < organizationMembers.length; index++) {
      await prisma.businessHour.deleteMany({
        where: { organizationId, userId: organizationMembers[index].userId },
      });
      await prisma.businessHour.createMany({
        data: hours.map((h) => ({
          day: h.day as
            | "SATURDAY"
            | "SUNDAY"
            | "MONDAY"
            | "TUESDAY"
            | "WEDNESDAY"
            | "THURSDAY"
            | "FRIDAY",
          openTime: h.openTime,
          closeTime: h.closeTime,
          isOpen: h.isOpen,
          organizationId,
          userId: organizationMembers[index].userId,
        })),
      });
    }
    return organizationMembers;
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
      include: {
        user: {
          select: {
            role: true,
          },
        },
      },
    });

    return member?.role ?? member?.user?.role;
  }
}

export const organizationService = new OrganizationService();
