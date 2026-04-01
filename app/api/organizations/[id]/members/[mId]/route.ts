import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { organizationService } from "@/lib/services/organization.service";
import { hasPermission } from "@/lib/types";

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

    const members =
      (session.user.role === "SUPER_ADMIN" || session.user.role === "ADMIN"|| session.user.role === "MANAGER")
        ? await organizationService.getMember(mId)
        : session?.user?.id
          ? [await organizationService.getMemberByUserId(session.user?.id)]
          : null;

    return NextResponse.json(members);
  } catch (error) {
    console.error("Error getting members:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}