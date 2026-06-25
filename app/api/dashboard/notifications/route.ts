import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  ApiError,
  jsonError,
  requireAuthSession,
  requireCurrentOrganizationId,
  requireOrgAccess,
} from "@/lib/api-guards";
import { writeAuditLog } from "@/lib/audit-log";

const createInAppNotificationSchema = z.object({
  organizationId: z.string().min(1),
  message: z.string().trim().min(1).max(500),
  type: z.string().trim().min(1).max(80).default("CUSTOMER_CLUB_IN_APP"),
  dryRun: z.boolean().optional().default(false),
});

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuthSession();
    const scope = request.nextUrl.searchParams.get("scope");
    const includeRead = scope === "all";
    const limitParam = Number(request.nextUrl.searchParams.get("limit") || "20");
    const take = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 100) : 20;

    const notifications = await prisma.notification.findMany({
      where: {
        targetUserId: session.user.id,
        ...(includeRead ? {} : { seen: false }),
      },
      orderBy: { createdAt: "desc" },
      take,
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

    return NextResponse.json({
      trigger: notifications.length > 0,
      notifications,
    });
  } catch (error) {
    return jsonError(error, "Failed to fetch notifications");
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuthSession();
    const body = createInAppNotificationSchema.parse(await request.json());
    const organizationId = await requireCurrentOrganizationId(session, body.organizationId);
    await requireOrgAccess(session, organizationId, ["ADMIN", "MANAGER"]);

    const recipients = await prisma.customerClubMembership.findMany({
      where: {
        organizationId,
        status: "ACTIVE",
        customer: {
          isActive: true,
          deletedAt: null,
        },
      },
      select: {
        customerId: true,
      },
      distinct: ["customerId"],
    });

    if (body.dryRun) {
      return NextResponse.json({ dryRun: true, recipientCount: recipients.length, created: 0 });
    }

    if (recipients.length === 0) {
      return NextResponse.json({ recipientCount: 0, created: 0 });
    }

    const result = await prisma.notification.createMany({
      data: recipients.map((recipient) => ({
        targetUserId: recipient.customerId,
        organizationId,
        createdByUserId: session.user.id,
        context: body.message,
        type: body.type,
      })),
    });

    await writeAuditLog({
      action: "CREATE",
      entityType: "Notification",
      entityId: organizationId,
      description: "In-app customer club notification created",
      newValue: {
        type: body.type,
        recipientCount: result.count,
        dryRun: false,
      },
      userId: session.user.id,
      organizationId,
    });

    return NextResponse.json({ recipientCount: recipients.length, created: result.count }, { status: 201 });
  } catch (error) {
    if (error instanceof ApiError) return jsonError(error);
    return jsonError(error, "Failed to create in-app notification");
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
    return jsonError(error, "Failed to mark notifications as seen");
  }
}
