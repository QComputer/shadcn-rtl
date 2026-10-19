import "server-only";
import { Prisma, type PrismaClient, type UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/api-guards";

export type MembershipActor = { userId: string; organizationId?: string | null };
export type ManagedMemberRole = Extract<UserRole, "ADMIN" | "MANAGER" | "STAFF" | "DRIVER" | "CUSTOMER">;
const roles = new Set<string>(["ADMIN", "MANAGER", "STAFF", "DRIVER", "CUSTOMER"]);
export function parseManagedMemberRole(value: unknown): ManagedMemberRole {
  if (value === "SUPER_ADMIN") throw new ApiError(403, "Global authority cannot be assigned through organization membership");
  if (typeof value !== "string" || !roles.has(value)) throw new ApiError(400, "Unsupported organization member role");
  return value as ManagedMemberRole;
}
const memberSelect = { id: true, userId: true, organizationId: true, organizationSlug: true, role: true, isActive: true,
  user: { select: { id: true, name: true, email: true, firstName: true, lastName: true, phone: true, role: true, isActive: true, isTeamMember: true } },
  organization: { select: { id: true, name: true, slug: true, type: true } },
} as const;

/** Every legacy membership write shares these locks, policy and durable audit.
 * Role changes remain organization-scoped; User.role is never changed here. */
export class OrganizationMembershipService {
  constructor(private readonly db: PrismaClient = prisma) {}
  private async transaction<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      try { return await this.db.$transaction(work, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15000 }); }
      catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2034", "P2002"].includes(error.code)) {
          if (attempt < 3) continue;
          throw new ApiError(409, "Concurrent membership change; retry the request");
        }
        throw error;
      }
    }
  }
  private async authorize(tx: Prisma.TransactionClient, actor: MembershipActor, organizationId: string) {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "Organization" WHERE "id"=${organizationId} FOR UPDATE`;
    if (!rows.length) throw new ApiError(404, "Organization not found");
    const [user, org] = await Promise.all([
      tx.user.findFirst({ where: { id: actor.userId, isActive: true, deletedAt: null }, select: { role: true } }),
      tx.organization.findFirst({ where: { id: organizationId, isActive: true, deletedAt: null }, select: { slug: true, vertical: true } }),
    ]);
    if (!user || !org) throw new ApiError(403, "Active organization access required");
    if (user.role === "SUPER_ADMIN") return { role: "SUPER_ADMIN" as const, org };
    if (actor.organizationId !== organizationId) throw new ApiError(403, "Tenant context mismatch");
    const membership = await tx.organizationMember.findFirst({ where: { organizationId, userId: actor.userId, isActive: true, role: { in: ["ADMIN", "MANAGER"] } }, select: { role: true } });
    if (!membership) throw new ApiError(403, "Organization administrator or manager required");
    return { role: membership.role, org };
  }
  async change(actor: MembershipActor, organizationId: string, memberId: string, update: { role?: ManagedMemberRole; isActive?: boolean }) {
    return this.transaction(async (tx) => {
      const authority = await this.authorize(tx, actor, organizationId);
      const member = await tx.organizationMember.findFirst({ where: { id: memberId, organizationId } });
      if (!member) throw new ApiError(404, "Organization member not found");
      const nextRole = update.role === undefined ? member.role : parseManagedMemberRole(update.role);
      const nextActive = update.isActive ?? member.isActive;
      if (authority.role !== "SUPER_ADMIN" && member.userId === actor.userId) throw new ApiError(403, "Use another administrator to change your membership");
      if (authority.role === "MANAGER" && (member.role === "ADMIN" || nextRole === "ADMIN")) throw new ApiError(403, "Only organization admins can manage admin membership");
      if (authority.org.vertical === "HOTEL" && nextActive && ["ADMIN", "MANAGER"].includes(nextRole) && (!member.isActive || !["ADMIN", "MANAGER"].includes(member.role))) throw new ApiError(403, "Hotel privileged access requires identity-bound invitation activation");
      if (member.role === "ADMIN" && member.isActive && (nextRole !== "ADMIN" || !nextActive)) {
        const remaining = await tx.organizationMember.count({ where: { organizationId, id: { not: memberId }, role: "ADMIN", isActive: true, user: { isActive: true, deletedAt: null } } });
        if (remaining === 0) throw new ApiError(409, "At least one active organization admin must remain");
      }
      const result = await tx.organizationMember.update({ where: { id: memberId }, data: { role: nextRole, isActive: nextActive }, select: memberSelect });
      const teamCount = await tx.organizationMember.count({ where: { userId: member.userId, isActive: true, role: { in: ["ADMIN", "MANAGER", "STAFF", "DRIVER"] }, organization: { isActive: true, deletedAt: null } } });
      await tx.user.update({ where: { id: member.userId }, data: { isTeamMember: teamCount > 0 }, select: { id: true } });
      await tx.auditLog.create({ data: { action: "UPDATE", entityType: "OrganizationMember", entityId: memberId, userId: actor.userId,
        organizationId, organizationSlug: authority.org.slug, description: "Changed organization-scoped membership",
        previousValue: { role: member.role, isActive: member.isActive }, newValue: { role: nextRole, isActive: nextActive } } });
      return result;
    });
  }
  async add(actor: MembershipActor, organizationId: string, userId: string, rawRole: unknown) {
    const role = parseManagedMemberRole(rawRole);
    return this.transaction(async (tx) => {
      const authority = await this.authorize(tx, actor, organizationId);
      if (authority.role === "MANAGER" && role === "ADMIN") throw new ApiError(403, "Only organization admins can grant admin membership");
      if (authority.org.vertical === "HOTEL" && ["ADMIN", "MANAGER"].includes(role)) throw new ApiError(403, "Use identity-bound Hotel invitation activation");
      const user = await tx.user.findFirst({ where: { id: userId, isActive: true, deletedAt: null }, select: { id: true } });
      if (!user) throw new ApiError(404, "Active user not found");
      if (await tx.organizationMember.findUnique({ where: { organizationId_userId: { organizationId, userId } }, select: { id: true } })) throw new ApiError(409, "User is already a member");
      const member = await tx.organizationMember.create({ data: { organizationId, organizationSlug: authority.org.slug, userId, role }, select: memberSelect });
      if (role !== "CUSTOMER") await tx.user.update({ where: { id: userId }, data: { isTeamMember: true }, select: { id: true } });
      await tx.auditLog.create({ data: { action: "CREATE", entityType: "OrganizationMember", entityId: member.id, userId: actor.userId, organizationId, organizationSlug: authority.org.slug, description: "Added organization-scoped member", newValue: { userId, role } } });
      return member;
    });
  }
  /** Global disable/delete must first resolve every active Admin membership through
   * its guarded organization workflow. This closes the alternate user API bypass. */
  async changeGlobalUser(actor: MembershipActor, userId: string, update: { role?: UserRole; isActive?: boolean; deletedAt?: Date }) {
    return this.transaction(async (tx) => {
      const operator = await tx.user.findFirst({ where: { id: actor.userId, role: "SUPER_ADMIN", isActive: true, deletedAt: null }, select: { id: true } });
      if (!operator) throw new ApiError(403, "Active platform SUPER_ADMIN required");
      if (actor.userId === userId && (update.isActive === false || update.deletedAt || (update.role && update.role !== "SUPER_ADMIN"))) throw new ApiError(403, "Use another platform administrator to change your own authority");
      if (update.isActive === false || update.deletedAt) {
        if (await tx.organizationMember.count({ where: { userId, role: "ADMIN", isActive: true, organization: { isActive: true, deletedAt: null } } })) throw new ApiError(409, "Resolve active admin memberships before disabling this account");
      }
      await tx.user.update({ where: { id: userId }, data: update, select: { id: true } });
      await tx.auditLog.create({ data: { action: "UPDATE", entityType: "User", entityId: userId, userId: actor.userId, description: "Platform-authorized global user change", newValue: { ...(update.role ? { role: update.role } : {}), ...(update.isActive !== undefined ? { isActive: update.isActive } : {}), ...(update.deletedAt ? { deleted: true } : {}) } } });
      return { id: userId, success: true };
    });
  }
}
export const organizationMembershipService = new OrganizationMembershipService();
