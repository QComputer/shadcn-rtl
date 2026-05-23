import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { organizationService } from "@/lib/services/organization.service";
import { userService } from "@/lib/services/user.service";
import { ApiError, jsonError, requireAuthSession, requireOrgAccess } from "@/lib/api-guards";
import type { SessionWithUser } from "@/lib/api-guards";
import { writeAuditLog } from "@/lib/audit-log";

async function resolveOrganizationId(session: SessionWithUser, routeId: string) {
  if (session?.user?.role === "SUPER_ADMIN") {
    return routeId;
  }

  const sessionOrgId = session?.user?.organizationId;
  if (!sessionOrgId) {
    throw new ApiError(403, "Forbidden");
  }

  return sessionOrgId;
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
        const ownMember = await organizationService.getAMemberByUserId(session.user.id);
        if (!ownMember || ownMember.id !== mId || ownMember.organizationId !== organizationId) {
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

    await requireOrgAccess(session, organizationId, ["ADMIN", "MANAGER"]);
    await loadMemberInOrganization(mId, organizationId);

    const body = await request.json();
    if (typeof body.isActive !== "boolean") {
      throw new ApiError(400, "isActive boolean is required");
    }

    const organizationMember = await userService.updateMembershipIsActive(mId, body.isActive);
    await writeAuditLog({
      action: "CHANGE_STATUS",
      entityType: "OrganizationMember",
      entityId: mId,
      description: "Changed organization member active status",
      userId: session.user.id,
      organizationId,
      organizationSlug: organizationMember.organizationSlug,
      newValue: { isActive: body.isActive },
    });
    return NextResponse.json(organizationMember);
  } catch (error) {
    console.error("Error updating organization member:", error);
    return jsonError(error, "Internal server error");
  }
}
