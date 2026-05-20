import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { organizationService } from "@/lib/services/organization.service";
import { hasPermission } from "@/lib/types";
import { ApiError, jsonError, requireOrgAccess } from "@/lib/api-guards";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    const { id } = await params;
    if (!session?.user?.id || !session.user.role) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!hasPermission(session.user.role, "org:read")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const members =
      session.user.role === "SUPER_ADMIN"
        ? await organizationService.getMembers(id)
        : session?.user?.organizationId
          ? session.user.role == "ADMIN" || session.user.role == "MANAGER"
            ? await organizationService.getMembers(session.user.organizationId)
            : [await organizationService.getAMemberByUserId(session.user.id)]
          : [];

    return NextResponse.json(members);
  } catch (error) {
    console.error("Error getting members:", error);
    return jsonError(error, "Internal server error");
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    const { id } = await params;

    if (!session?.user?.id || !session.user.role) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!hasPermission(session.user.role, "org:manage_members")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const organizationId = session.user.role === "SUPER_ADMIN" ? id : session.user.organizationId || id;
    await requireOrgAccess(session, organizationId, ["ADMIN", "MANAGER"]);

    const body = await request.json();
    const { userId, role } = body;

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 },
      );
    }

    const member = await organizationService.addMember(
      organizationId,
      userId,
      role || "STAFF",
      session.user.id,
    );

    return NextResponse.json(member, { status: 201 });
  } catch (error) {
    console.error("Error adding member:", error);
    return jsonError(error, "Internal server error");
  }
}
/*
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    const { id } = await params;
    if (!session?.user?.id || !session.user.role) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = await request.json();
    const {userId, role} = body

    const memberShip = await prisma.organizationMember.upsert({
      where: { userId: userId },
      update: { organizationId: id, isActive: true },
      create: { organizationId: id, organizationSlug, userId: userId, isActive: true },
    });

    const user = await prisma.user.update({
      where: { id: userId },
      data: { role, isTeamMember: true },
    });

    return NextResponse.json({ user, memberShip});
  } catch (error) {
    console.error("Error updating user organization-membership:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}
*/