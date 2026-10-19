import { publicUserSelect, toPublicUserDto } from "./user-public-dto";
import { organizationMembershipService, type MembershipActor } from "./organization-membership.service";
import { prisma } from "@/lib/db";
import { type UserRole } from "@/lib/types";

export class UserService {

  async getById(id: string, organizationId?: string) {
    const user = await prisma.user.findUnique({ where: { id, deletedAt: null }, select: publicUserSelect(organizationId) });
    return user ? toPublicUserDto(user) : null;
  }

  async getByName(name: string, organizationId?: string) {
    const user = await prisma.user.findUnique({ where: { name, deletedAt: null }, select: publicUserSelect(organizationId) });
    return user ? toPublicUserDto(user) : null;
  }

  async delete(id: string, actor: MembershipActor) {
    return organizationMembershipService.changeGlobalUser(actor, id, { deletedAt: new Date(), isActive: false });
  }

  async getBusinessHours(id: string) {
    return prisma.businessHour.findMany({
      where: { userId: id },
      orderBy: { day: "asc" },
    });
  }

  async updateBusinessHours(
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
      where: { userId },
    });

    const businessHours = await prisma.businessHour.createMany({
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
        userId,
      })),
    });

    //revalidatePath(`/dashboard/users/${userId}/settings`);
    return businessHours;
  }

  async updateRole(id: string, role: UserRole, actor: MembershipActor) {
    return organizationMembershipService.changeGlobalUser(actor, id, { role });
  }

  async updateMembershipIsActive(id: string, isActive: boolean, actor: MembershipActor, organizationId: string) {
    return organizationMembershipService.change(actor, organizationId, id, { isActive });
  }

  async updateUserIsActive(id: string, isActive: boolean, actor: MembershipActor) {
    return organizationMembershipService.changeGlobalUser(actor, id, { isActive });
  }

  async update(id: string, data: { deletedAt?: Date; isActive?: boolean; role?: UserRole }, actor: MembershipActor) {
    return organizationMembershipService.changeGlobalUser(actor, id, data);
  }

  async copyBusinessHours(userId: string, organizationId: string) {
    // Delete existing hours and create new ones
    await prisma.businessHour.deleteMany({
      where: { userId },
    });
    const hours = await this.getBusinessHours(organizationId);

    const businessHours = await prisma.businessHour.createMany({
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
