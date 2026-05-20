import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { userService } from "@/lib/services/user.service";
import { ApiError, jsonError, requireAuthSession, requireCurrentOrgAdminOrManager } from "@/lib/api-guards";
import type { SessionWithUser } from "@/lib/api-guards";
import type { UserRole } from "@/lib/types";

async function canManageTargetUser(session: SessionWithUser, targetUserId: string) {
  if (!session?.user?.id || !session.user.role) {
    throw new ApiError(401, "Unauthorized");
  }

  if (session.user.role === "SUPER_ADMIN") {
    return true;
  }

  const managerMembership = await requireCurrentOrgAdminOrManager(session);
  const targetMembership = await prisma.organizationMember.findFirst({
    where: {
      userId: targetUserId,
      organizationId: managerMembership?.organizationId,
    },
  });

  if (!targetMembership) {
    throw new ApiError(403, "Forbidden");
  }

  return true;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAuthSession();
    const { id } = await params;

    if (id !== session.user.id) {
      await canManageTargetUser(session, id);
    }

    const user = await userService.getById(id);
    if (!user || user.deletedAt) {
      throw new ApiError(404, "User not found");
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error("Error getting user:", error);
    return jsonError(error, "Internal server error");
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAuthSession();
    const { id } = await params;
    const body = await request.json();

    if (body.role) {
      if (session.user.role !== "SUPER_ADMIN") {
        throw new ApiError(403, "Only SUPER_ADMIN can change global roles");
      }
      const user = await userService.updateRole(id, body.role as UserRole);
      return NextResponse.json(user);
    }

    await canManageTargetUser(session, id);

    if (typeof body.isActive === "boolean") {
      if (session.user.role === "SUPER_ADMIN") {
        const user = await userService.updateUserIsActive(id, body.isActive);
        return NextResponse.json(user);
      }

      const managerMembership = await requireCurrentOrgAdminOrManager(session);
      const targetMembership = await prisma.organizationMember.findFirst({
        where: {
          userId: id,
          organizationId: managerMembership?.organizationId,
        },
      });

      if (!targetMembership) {
        throw new ApiError(403, "Forbidden");
      }

      const membership = await userService.updateMembershipIsActive(targetMembership.id, body.isActive);
      return NextResponse.json(membership);
    }

    throw new ApiError(400, "No supported update fields provided");
  } catch (error) {
    console.error("Error updating user:", error);
    return jsonError(error, "Internal server error");
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAuthSession();
    const { id } = await params;

    if (session.user.role !== "SUPER_ADMIN") {
      throw new ApiError(403, "Only SUPER_ADMIN can delete users");
    }

    await userService.update(id, { deletedAt: new Date(), isActive: false });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting user:", error);
    return jsonError(error, "Internal server error");
  }
}
