import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { organizationService } from "@/lib/services/organization.service";
import { hasPermission } from "@/lib/types";
import prisma from "@/lib/db";

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
        ? await organizationService.getAllMembers()
        : session?.user?.organizationId
          ? session.user.role == "ADMIN" || session.user.role == "MANAGER"
            ? await organizationService.getMembers(session.user.organizationId)
            : [await organizationService.getMemberByUserId(session.user.id)]
          : [];

    return NextResponse.json(members);
  } catch (error) {
    console.error("Error getting members:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
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

    const body = await request.json();
    const { userId, role } = body;

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 },
      );
    }

    const member = await organizationService.addMember(
      id,
      userId,
      role || "STAFF",
      session.user.id,
    );

    return NextResponse.json(member, { status: 201 });
  } catch (error) {
    console.error("Error adding member:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    const { id } = await params;

    const body = await request.json();
    const {userId, userRole, prevUserRole} = body

    const user = prisma.user.update({
      where: {id: userId},
      data: { role: userRole}
    });

    const memberShip = await prisma.organizationMember.upsert({
      where: { userId: userId },
      update: { organizationId: id },
      create: { organizationId: id, userId: userId },
    });

    let prevUser;
    if (session?.user?.id) {
      prevUser = await prisma.user.update({
        where: { id: session.user.id },
        data: {
          role: prevUserRole,
        },
      });
    }
    return NextResponse.json({ user, memberShip, prevUser});
  } catch (error) {
    console.error("Error updating settings:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}