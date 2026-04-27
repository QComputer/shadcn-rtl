import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { organizationService } from "@/lib/services/organization.service";
import { hasPermission } from "@/lib/types";
import { userService } from "@/lib/services/user.service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string | null, mId: string }> }
) {
  try {
    const session = await auth();
    const { id, mId } = await params;

    if (!session?.user?.id || !session.user.role) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!hasPermission(session.user.role, "org:read")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const member =
      (session.user.role === "SUPER_ADMIN" || session.user.role === "ADMIN"|| session.user.role === "MANAGER")
        ? await organizationService.getMember(mId)
        : session?.user?.id
          ? [await organizationService.getAMemberByUserId(session.user?.id)]
          : null;

    return NextResponse.json(member);
  } catch (error) {
    console.error("Error getting members:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; mId: string }> },
) {
  try {
    const session = await auth();
    const { id, mId } = await params;

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!session.user.role) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const organizationMember = await userService.updateMembershipIsActive(mId, body.isActive);

    return NextResponse.json(organizationMember);
  } catch (error) {
    console.error("Error updating organizationMember:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}



