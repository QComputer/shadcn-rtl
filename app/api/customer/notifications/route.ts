import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { jsonError, requireAuthSession } from "@/lib/api-guards";

function readLimit(request: NextRequest) {
  const value = Number(request.nextUrl.searchParams.get("limit") || "50");
  return Number.isFinite(value) ? Math.min(Math.max(value, 1), 100) : 50;
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuthSession();
    const includeRead = request.nextUrl.searchParams.get("scope") === "all";

    const notifications = await prisma.notification.findMany({
      where: {
        targetUserId: session.user.id,
        ...(includeRead ? {} : { seen: false }),
      },
      orderBy: { createdAt: "desc" },
      take: readLimit(request),
      select: {
        id: true,
        context: true,
        type: true,
        seen: true,
        readAt: true,
        createdAt: true,
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    return NextResponse.json({ notifications });
  } catch (error) {
    return jsonError(error, "Failed to fetch customer notifications");
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await requireAuthSession();
    const body = (await request.json().catch(() => ({}))) as { ids?: string[]; seen?: boolean };
    const ids = Array.isArray(body.ids)
      ? body.ids.filter((id): id is string => typeof id === "string" && id.length > 0)
      : [];
    const seen = body.seen ?? true;

    if (ids.length === 0) {
      return NextResponse.json({ updated: 0 });
    }

    const result = await prisma.notification.updateMany({
      where: {
        id: { in: ids },
        targetUserId: session.user.id,
      },
      data: {
        seen,
        readAt: seen ? new Date() : null,
      },
    });

    return NextResponse.json({ updated: result.count });
  } catch (error) {
    return jsonError(error, "Failed to update customer notifications");
  }
}
