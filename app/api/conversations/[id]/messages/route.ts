import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { messagingService } from "@/lib/services/messaging.service";

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

    const body = await request.json();
    const { content } = body;

    if (!content || typeof content !== "string") {
      return NextResponse.json({ error: "Message content is required" }, { status: 400 });
    }

    if (content.length > 10000) {
      return NextResponse.json({ error: "Message is too long (max 10000 characters)" }, { status: 400 });
    }

    const message = await messagingService.sendMessage(id, session.user.id, content);

    return NextResponse.json(message, { status: 201 });
  } catch (error) {
    console.error("Error sending message:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
