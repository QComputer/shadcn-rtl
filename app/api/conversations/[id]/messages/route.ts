import { NextRequest, NextResponse } from "next/server";
import { ApiError, jsonError, requireAuthSession } from "@/lib/api-guards";
import { getClientIp, checkRateLimit } from "@/lib/rate-limit";
import { messagingService } from "@/lib/services/messaging.service";

function checkMessageWriteLimit(request: NextRequest, userId: string) {
  const ip = getClientIp(request.headers);
  const result = checkRateLimit({
    key: `message:send:${userId}:${ip}`,
    limit: 60,
    windowMs: 60_000,
  });

  if (!result.allowed) {
    throw new ApiError(429, `Too many messages. Try again in ${result.retryAfterSeconds}s.`);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAuthSession(request);
    // Conversations are account-global; customer use requires a tenant-owned model.
    if (session.user.role === "CUSTOMER") throw new ApiError(403, "Tenant-scoped customer messaging is not available");
    checkMessageWriteLimit(request, session.user.id);

    const { id } = await params;
    const body = await request.json();
    const message = await messagingService.sendMessage(id, session.user.id, body?.content);

    return NextResponse.json(message, { status: 201 });
  } catch (error) {
    return jsonError(error, "Failed to send message");
  }
}
