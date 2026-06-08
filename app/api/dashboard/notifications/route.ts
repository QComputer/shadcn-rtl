import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { jsonError, requireAuthSession } from "@/lib/api-guards";

export async function GET(_request: NextRequest) {
  try {
    const session = await requireAuthSession();

    const notifications = await prisma.notification.findMany({
      where: {
        targetUserId: session.user.id,
        seen: false,
      },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        context: true,
        type: true,
        seen: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      trigger: notifications.length > 0,
      notifications,
    });
  } catch (error) {
    return jsonError(error, "Failed to fetch notifications");
  }
}


export async function PATCH(request: NextRequest) {
  try {
    const session = await requireAuthSession();
    const body = (await request.json().catch(() => ({}))) as { ids?: string[] };
    const ids = Array.isArray(body.ids)
      ? body.ids.filter((id): id is string => typeof id === "string" && id.length > 0)
      : [];

    if (ids.length === 0) {
      return NextResponse.json({ updated: 0 });
    }

    const result = await prisma.notification.updateMany({
      where: {
        id: { in: ids },
        targetUserId: session.user.id,
      },
      data: {
        seen: true,
        readAt: new Date(),
      },
    });

    return NextResponse.json({ updated: result.count });
  } catch (error) {
    return jsonError(error, "Failed to mark notifications as seen");
  }
}
