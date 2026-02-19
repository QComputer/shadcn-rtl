import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { messagingService } from "@/lib/services/messaging.service";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "20");

    const conversations = await messagingService.getConversations(session.user.id, {
      page,
      pageSize,
    });

    return NextResponse.json(conversations);
  } catch (error) {
    console.error("Error listing conversations:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { participantIds } = body;

    if (!participantIds || !Array.isArray(participantIds)) {
      return NextResponse.json({ error: "Participant IDs are required" }, { status: 400 });
    }

    const conversation = await messagingService.createConversation(
      session.user.id,
      participantIds
    );

    return NextResponse.json(conversation, { status: 201 });
  } catch (error) {
    console.error("Error creating conversation:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
