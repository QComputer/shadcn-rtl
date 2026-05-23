import { NextRequest, NextResponse } from "next/server";
import { ApiError, jsonError, requireAuthSession } from "@/lib/api-guards";
import { getClientIp, checkRateLimit } from "@/lib/rate-limit";
import { messagingService } from "@/lib/services/messaging.service";

const MAX_PAGE_SIZE = 50;
const MAX_PARTICIPANTS = 20;

function parsePositiveInt(value: string | null, fallback: number, max: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
}

function checkConversationWriteLimit(request: NextRequest, userId: string) {
  const ip = getClientIp(request.headers);
  const result = checkRateLimit({
    key: `conversation:create:${userId}:${ip}`,
    limit: 30,
    windowMs: 60_000,
  });

  if (!result.allowed) {
    throw new ApiError(429, `Too many conversation requests. Try again in ${result.retryAfterSeconds}s.`);
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuthSession();
    const { searchParams } = request.nextUrl;
    const page = parsePositiveInt(searchParams.get("page"), 1, 100000);
    const pageSize = parsePositiveInt(searchParams.get("pageSize"), 20, MAX_PAGE_SIZE);

    const conversations = await messagingService.getConversations(session.user.id, {
      page,
      pageSize,
    });

    return NextResponse.json(conversations);
  } catch (error) {
    return jsonError(error, "Failed to list conversations");
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuthSession();
    checkConversationWriteLimit(request, session.user.id);

    const body = await request.json();
    const participantIds = body?.participantIds;

    if (!Array.isArray(participantIds)) {
      throw new ApiError(400, "Participant IDs are required");
    }

    if (participantIds.some((id) => typeof id !== "string" || !id.trim())) {
      throw new ApiError(400, "Participant IDs must be strings");
    }

    if (participantIds.length > MAX_PARTICIPANTS) {
      throw new ApiError(400, `At most ${MAX_PARTICIPANTS} participants are allowed`);
    }

    const conversation = await messagingService.createConversation(
      session.user.id,
      participantIds.map((id) => id.trim()),
    );

    return NextResponse.json(conversation, { status: 201 });
  } catch (error) {
    return jsonError(error, "Failed to create conversation");
  }
}
