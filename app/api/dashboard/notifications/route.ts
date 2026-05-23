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

    if (notifications.length > 0) {
      await prisma.notification.updateMany({
        where: {
          id: { in: notifications.map((notification) => notification.id) },
          targetUserId: session.user.id,
        },
        data: {
          seen: true,
          readAt: new Date(),
        },
      });
    }

    return NextResponse.json({
      trigger: notifications.length > 0,
      notifications,
    });
  } catch (error) {
    return jsonError(error, "Failed to fetch notifications");
  }
}
