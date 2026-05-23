import { NextRequest, NextResponse } from "next/server";
import { jsonError, requireAuthSession } from "@/lib/api-guards";
import { messagingService } from "@/lib/services/messaging.service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAuthSession();
    const { id } = await params;
    const conversation = await messagingService.getConversation(id, session.user.id);

    return NextResponse.json(conversation);
  } catch (error) {
    return jsonError(error, "Failed to get conversation");
  }
}
