import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { hasPermission, type UserRole, type Permission } from "@/lib/types";

export class UserService {
  async getById(id: string) {
    return prisma.user.findUnique({
      where: { id },
      include: {
        memberOf: true,
        businessHours: true,
      },
    });
  }

  async getByName(name: string) {
    return prisma.user.findUnique({
      where: { name },
      include: {
        memberOf: true,
        businessHours: true,
      },
    });
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

  async getBusinessHours(id: string) {
    return prisma.userBusinessHour.findMany({
      where: { id },
      orderBy: { day: "asc" },
    });
  }

  async updateBusinessHours(
    userId: string,
    hours: Array<{
      day: string;
      openTime: string;
      closeTime: string;
      isOpen: boolean;
    }>,
  ) {
    // Delete existing hours and create new ones
    await prisma.userBusinessHour.deleteMany({
      where: { id: userId },
    });

    const businessHours = await prisma.userBusinessHour.createMany({
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
        userId,
      })),
    });

    //revalidatePath(`/dashboard/users/${userId}/settings`);
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

}

export const userService = new UserService();
