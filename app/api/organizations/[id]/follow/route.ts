import { NextRequest, NextResponse } from "next/server";
import { followService } from "@/lib/services/follow.service";
import { jsonError, requireAuthSession } from "@/lib/api-guards";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

function followRateLimit(request: NextRequest, userId: string, organizationId: string) {
  const clientIp = getClientIp(request.headers);
  const result = checkRateLimit({
    key: `follow:${userId}:${organizationId}:${clientIp}`,
    limit: 30,
    windowMs: 60_000,
  });

  if (!result.allowed) {
    return NextResponse.json(
      { error: "Too many follow requests" },
      {
        status: 429,
        headers: { "Retry-After": String(result.retryAfterSeconds) },
      },
    );
  }

  return null;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAuthSession();
    const { id } = await params;
    const limited = followRateLimit(request, session.user.id, id);
    if (limited) return limited;

    const follow = await followService.follow(session.user.id, id);
    return NextResponse.json(follow, { status: follow.alreadyFollowing ? 200 : 201 });
  } catch (error) {
    return jsonError(error, "Error following organization");
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAuthSession();
    const { id } = await params;
    const limited = followRateLimit(request, session.user.id, id);
    if (limited) return limited;

    const result = await followService.unfollow(session.user.id, id);
    return NextResponse.json(result);
  } catch (error) {
    return jsonError(error, "Error unfollowing organization");
  }
}
