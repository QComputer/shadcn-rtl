import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ApiError, jsonError, requireAuthSession, requireOrgAccess } from "@/lib/api-guards";
import type { SessionWithUser } from "@/lib/api-guards";
import { writeAuditLog } from "@/lib/audit-log";
import type { UserRole } from "@/lib/types";

async function resolveOrganizationId(session: SessionWithUser, routeId: string) {
  if (session?.user?.role === "SUPER_ADMIN") {
    return routeId;
  }

  const sessionOrgId = session?.user?.organizationId;
  if (!sessionOrgId) {
    throw new ApiError(403, "Forbidden");
  }

  if (sessionOrgId !== routeId) {
    throw new ApiError(403, "Forbidden");
  }

  return sessionOrgId;
}

type ManageableMemberRole = Extract<UserRole, "ADMIN" | "MANAGER" | "STAFF" | "DRIVER">;

const MANAGEABLE_MEMBER_ROLES = new Set<ManageableMemberRole>(["ADMIN", "MANAGER", "STAFF", "DRIVER"]);

function parseManageableMemberRole(role: unknown): ManageableMemberRole {
  if (typeof role !== "string" || !MANAGEABLE_MEMBER_ROLES.has(role as ManageableMemberRole)) {
    throw new ApiError(400, "Unsupported organization member role");
  }

  return role as ManageableMemberRole;
}

function assertValidBody(body: unknown): asserts body is { role?: unknown; isActive?: unknown } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new ApiError(400, "Invalid member update body");
  }
}

async function loadMemberInOrganization(memberId: string, organizationId: string) {
  const member = await prisma.organizationMember.findFirst({
    where: { id: memberId, organizationId },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          role: true,
          isActive: true,
          isTeamMember: true,
        },
      },
      organization: {
        select: { id: true, name: true, slug: true, type: true },
      },
    },
  });

  if (!member) {
    throw new ApiError(404, "Organization member not found");
  }

  return member;
}

async function assertAdminContinuity(options: {
  organizationId: string;
  memberId: string;
  currentRole: UserRole;
  currentIsActive: boolean;
  nextRole?: ManageableMemberRole;
  nextIsActive?: boolean;
}) {
  const nextRole = options.nextRole ?? options.currentRole;
  const nextIsActive = options.nextIsActive ?? options.currentIsActive;
  const removesActiveAdmin = options.currentRole === "ADMIN" && options.currentIsActive && (nextRole !== "ADMIN" || !nextIsActive);

  if (!removesActiveAdmin) return;

  const remainingActiveAdmins = await prisma.organizationMember.count({
    where: {
      organizationId: options.organizationId,
      isActive: true,
      role: "ADMIN",
      id: { not: options.memberId },
    },
  });

  if (remainingActiveAdmins === 0) {
    throw new ApiError(400, "At least one active organization admin must remain");
  }
}

async function assertCanApplyMemberUpdate(options: {
  actorSession: SessionWithUser;
  actorMembershipRole: UserRole | null;
  targetUserId: string;
  nextRole?: ManageableMemberRole;
}) {
  const isSuperAdmin = options.actorSession.user.role === "SUPER_ADMIN";

  if (!isSuperAdmin && options.actorSession.user.id === options.targetUserId) {
    throw new ApiError(400, "Use another admin account to change your own membership");
  }

  if (options.nextRole === "ADMIN" && !isSuperAdmin && options.actorMembershipRole !== "ADMIN") {
    throw new ApiError(403, "Only organization admins can grant admin membership");
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; mId: string }> },
) {
  try {
    const session = await requireAuthSession();
    const { id, mId } = await params;
    const organizationId = await resolveOrganizationId(session, id);

    if (session.user.role !== "SUPER_ADMIN") {
      if (session.user.role === "ADMIN" || session.user.role === "MANAGER") {
        await requireOrgAccess(session, organizationId, ["ADMIN", "MANAGER"]);
      } else {
        const ownMember = await prisma.organizationMember.findFirst({
          where: { id: mId, organizationId, userId: session.user.id },
          select: { id: true },
        });
        if (!ownMember) {
          throw new ApiError(403, "Forbidden");
        }
      }
    }

    const member = await loadMemberInOrganization(mId, organizationId);
    return NextResponse.json(member);
  } catch (error) {
    console.error("Error getting member:", error);
    return jsonError(error, "Internal server error");
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; mId: string }> },
) {
  try {
    const session = await requireAuthSession();
    const { id, mId } = await params;
    const organizationId = await resolveOrganizationId(session, id);

    const actorMembership = await requireOrgAccess(session, organizationId, ["ADMIN", "MANAGER"]);
    const actorMembershipRole = actorMembership?.role ?? (session.user.role === "SUPER_ADMIN" ? "SUPER_ADMIN" : null);
    const existingMember = await loadMemberInOrganization(mId, organizationId);

    const body = await request.json();
    assertValidBody(body);

    const hasIsActive = typeof body.isActive === "boolean";
    const hasRole = typeof body.role !== "undefined";

    if (!hasIsActive && !hasRole) {
      throw new ApiError(400, "At least one supported member update field is required");
    }

    const nextRole = hasRole ? parseManageableMemberRole(body.role) : undefined;
    const nextIsActive = hasIsActive ? body.isActive : undefined;

    await assertCanApplyMemberUpdate({
      actorSession: session,
      actorMembershipRole,
      targetUserId: existingMember.userId,
      nextRole,
    });

    await assertAdminContinuity({
      organizationId,
      memberId: mId,
      currentRole: existingMember.role as UserRole,
      currentIsActive: existingMember.isActive,
      nextRole,
      nextIsActive,
    });

    const updateData: { role?: ManageableMemberRole; isActive?: boolean } = {};
    if (nextRole) updateData.role = nextRole;
    if (typeof nextIsActive === "boolean") updateData.isActive = nextIsActive;

    await prisma.organizationMember.update({
      where: { id: mId },
      data: updateData,
    });

    if (nextRole) {
      await writeAuditLog({
        action: "ASSIGN_ROLE",
        entityType: "OrganizationMember",
        entityId: mId,
        description: "Changed organization member role",
        userId: session.user.id,
        organizationId,
        organizationSlug: existingMember.organizationSlug,
        previousValue: { userId: existingMember.userId, role: existingMember.role },
        newValue: { userId: existingMember.userId, role: nextRole },
      });
    }

    if (typeof nextIsActive === "boolean") {
      await writeAuditLog({
        action: "CHANGE_STATUS",
        entityType: "OrganizationMember",
        entityId: mId,
        description: "Changed organization member active status",
        userId: session.user.id,
        organizationId,
        organizationSlug: existingMember.organizationSlug,
        previousValue: { userId: existingMember.userId, isActive: existingMember.isActive },
        newValue: { userId: existingMember.userId, isActive: nextIsActive },
      });
    }

    const updatedMember = await loadMemberInOrganization(mId, organizationId);
    return NextResponse.json(updatedMember);
  } catch (error) {
    console.error("Error updating organization member:", error);
    return jsonError(error, "Internal server error");
  }
}
