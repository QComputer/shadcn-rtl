import { NextRequest, NextResponse } from "next/server";
import { ApiError, jsonError, requireAuthSession } from "@/lib/api-guards";
import { messagingService } from "@/lib/services/messaging.service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAuthSession(request);
    // Conversations are account-global; customer use requires a tenant-owned model.
    if (session.user.role === "CUSTOMER") throw new ApiError(403, "Tenant-scoped customer messaging is not available");
    const { id } = await params;
    const conversation = await messagingService.getConversation(id, session.user.id);

    return NextResponse.json(conversation);
  } catch (error) {
    return jsonError(error, "Failed to get conversation");
  }
}
