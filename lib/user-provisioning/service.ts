import "server-only";

import bcrypt from "bcryptjs";
import { Prisma, type PrismaClient, type UserRole } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/db-runtime";
import { ApiError } from "@/lib/api-guards";
import type { ProvisionOrganizationAccountInput } from "./contract";

export type ProvisioningActor = {
  userId: string;
  sessionRole: UserRole;
  sessionOrganizationId?: string | null;
};

type Tx = Prisma.TransactionClient;
type ScopedRole = "ADMIN" | "MANAGER" | "STAFF" | "CUSTOMER";

export class OrganizationAccountProvisioningService {
  constructor(
    private readonly db: PrismaClient = defaultPrisma,
    private readonly hashPassword: (password: string) => Promise<string> = (password) => bcrypt.hash(password, 12),
  ) {}

  private async transaction<T>(callback: (tx: Tx) => Promise<T>) {
    for (let attempt = 0; ; attempt++) {
      try {
        return await this.db.$transaction(callback, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          timeout: 15000,
        });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2034", "P2002"].includes(error.code)) {
          if (attempt < 3) continue;
          throw new ApiError(409, "Concurrent account change; retry the request");
        }
        throw error;
      }
    }
  }

  private async authorize(tx: Tx, actor: ProvisioningActor, organizationId: string, targetRole?: ScopedRole) {
    const locked = await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "Organization" WHERE "id"=${organizationId} FOR UPDATE`;
    if (!locked.length) throw new ApiError(404, "Organization not found");

    const [user, organization] = await Promise.all([
      tx.user.findFirst({ where: { id: actor.userId, isActive: true, deletedAt: null }, select: { id: true, role: true, lockedUntil: true } }),
      tx.organization.findFirst({ where: { id: organizationId, isActive: true, deletedAt: null }, select: { id: true, slug: true, vertical: true } }),
    ]);
    if (!user || (user.lockedUntil && user.lockedUntil > new Date()) || !organization) {
      throw new ApiError(403, "Active account and organization access required");
    }

    if (actor.sessionRole === "SUPER_ADMIN") {
      if (user.role !== "SUPER_ADMIN") throw new ApiError(403, "Active platform administrator required");
      if (targetRole === "ADMIN" && organization.vertical === "HOTEL" && user.role !== "SUPER_ADMIN") {
        throw new ApiError(403, "Platform administrator required for Hotel administrator accounts");
      }
      return { authority: "SUPER_ADMIN" as const, organization };
    }

    if (actor.sessionOrganizationId !== organizationId) throw new ApiError(403, "Tenant context mismatch");
    const membership = await tx.organizationMember.findFirst({
      where: { userId: actor.userId, organizationId, isActive: true, role: "ADMIN" },
      select: { id: true },
    });
    if (!membership) throw new ApiError(403, "Organization administrator membership required");
    if (targetRole === "ADMIN") throw new ApiError(403, "Only SUPER_ADMIN can grant organization administrator membership");
    return { authority: "ADMIN" as const, organization };
  }

  async provision(actor: ProvisioningActor, organizationId: string, input: ProvisionOrganizationAccountInput) {
    return this.transaction(async (tx) => {
      const authorization = await this.authorize(tx, actor, organizationId, input.role);

      // Username identity is canonical lowercase. Check every row, including inactive and
      // soft-deleted users, so an old identity can never be silently taken over.
      const existing = await tx.user.findFirst({
        where: { name: { equals: input.username, mode: "insensitive" } },
        select: { id: true, name: true, isActive: true, deletedAt: true },
      });
      if (existing) {
        if (!existing.isActive || existing.deletedAt || existing.name !== input.username) {
          throw new ApiError(409, "Username is reserved");
        }
        const membership = await tx.organizationMember.findUnique({
          where: { organizationId_userId: { organizationId, userId: existing.id } },
          select: { id: true, role: true, isActive: true },
        });
        if (membership?.isActive && membership.role === input.role) {
          return { created: false, userId: existing.id, username: existing.name, organizationId, organizationSlug: authorization.organization.slug, role: membership.role };
        }
        throw new ApiError(409, "Username already belongs to another account or organization role");
      }

      const passwordHash = await this.hashPassword(input.password);
      const user = await tx.user.create({
        data: {
          name: input.username,
          password: passwordHash,
          email: input.email,
          role: "CUSTOMER",
          isActive: true,
          isTeamMember: input.role !== "CUSTOMER",
          locale: "fa",
          theme: "system",
        },
        select: { id: true, name: true },
      });
      const member = await tx.organizationMember.create({
        data: {
          organizationId,
          organizationSlug: authorization.organization.slug,
          userId: user.id,
          role: input.role,
          isActive: true,
        },
        select: { id: true, role: true },
      });

      await tx.auditLog.create({
        data: {
          action: "CREATE",
          entityType: "OrganizationAccount",
          entityId: member.id,
          userId: actor.userId,
          organizationId,
          organizationSlug: authorization.organization.slug,
          description: "Created username/password account with organization-scoped membership",
          newValue: { userId: user.id, username: user.name, role: member.role, emailProvided: Boolean(input.email) },
        },
      });
      return { created: true, userId: user.id, username: user.name, organizationId, organizationSlug: authorization.organization.slug, role: member.role };
    });
  }

  async resetPassword(actor: ProvisioningActor, organizationId: string, targetUserId: string, newPassword: string) {
    if (actor.userId === targetUserId) throw new ApiError(400, "Use the account password-change flow for your own password");
    return this.transaction(async (tx) => {
      const authorization = await this.authorize(tx, actor, organizationId);
      const membership = await tx.organizationMember.findFirst({
        where: { organizationId, userId: targetUserId, isActive: true, user: { isActive: true, deletedAt: null } },
        select: { id: true, role: true, user: { select: { role: true } } },
      });
      if (!membership) throw new ApiError(404, "Active organization account not found");
      if (membership.user.role === "SUPER_ADMIN") {
        throw new ApiError(403, "Platform administrator credentials cannot be reset through organization management");
      }
      if (authorization.authority === "ADMIN" && membership.role === "ADMIN") {
        throw new ApiError(403, "Organization administrators cannot reset another administrator credential");
      }

      const passwordHash = await this.hashPassword(newPassword);
      await tx.user.update({
        where: { id: targetUserId },
        data: { password: passwordHash, failedLoginAttempts: 0, lockedUntil: null },
        select: { id: true },
      });
      await tx.auditLog.create({
        data: {
          action: "UPDATE",
          entityType: "OrganizationAccountCredential",
          entityId: targetUserId,
          userId: actor.userId,
          organizationId,
          organizationSlug: authorization.organization.slug,
          description: "Organization administrator initiated a password reset",
          newValue: { passwordReset: true, membershipRole: membership.role },
        },
      });
      return { success: true, userId: targetUserId, organizationId };
    });
  }
}

export const organizationAccountProvisioningService = new OrganizationAccountProvisioningService();
