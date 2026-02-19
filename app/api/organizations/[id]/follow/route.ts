import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { followService } from "@/lib/services/follow.service";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const { id } = await params;

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const follow = await followService.follow(session.user.id, id);

    return NextResponse.json(follow, { status: 201 });
  } catch (error) {
    console.error("Error following organization:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const { id } = await params;

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await followService.unfollow(session.user.id, id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error unfollowing organization:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
