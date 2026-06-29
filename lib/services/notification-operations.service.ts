import type { SmsDeliveryStatus, WebPushDeliveryStatus } from "@prisma/client"
import { ApiError } from "@/lib/api-guards"
import { prisma } from "@/lib/db"
import { getWebPushRuntimeConfig } from "@/lib/services/web-push-foundation.service"
import { smsService } from "@/lib/sms"

const WEB_PUSH_STATUSES: WebPushDeliveryStatus[] = ["PENDING", "SENT", "FAILED", "SKIPPED"]
const SMS_STATUSES: SmsDeliveryStatus[] = ["PENDING", "SENT", "FAILED", "SKIPPED"]

function emptyStatusCounts<T extends string>(statuses: readonly T[]) {
  return Object.fromEntries(statuses.map((status) => [status, 0])) as Record<T, number>
}

function mapStatusCounts<T extends string>(
  statuses: readonly T[],
  rows: Array<{ status: T; _count: { _all: number } }>,
) {
  const counts = emptyStatusCounts(statuses)
  for (const row of rows) counts[row.status] = row._count._all
  return counts
}

export class NotificationOperationsService {
  async getDashboard(organizationId: string) {
    await this.requireOrganization(organizationId)

    const [
      inAppTotal,
      inAppUnread,
      recentInApp,
      webPushStatusRows,
      recentWebPush,
      smsStatusRows,
      recentSms,
    ] = await Promise.all([
      prisma.notification.count({ where: { organizationId } }),
      prisma.notification.count({ where: { organizationId, seen: false } }),
      prisma.notification.findMany({
        where: { organizationId },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true,
          context: true,
          type: true,
          seen: true,
          readAt: true,
          createdAt: true,
          targetUser: {
            select: {
              id: true,
              name: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
            },
          },
          createdBy: {
            select: {
              id: true,
              name: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      }),
      prisma.webPushDelivery.groupBy({
        by: ["status"],
        where: { organizationId },
        _count: { _all: true },
      }),
      prisma.webPushDelivery.findMany({
        where: { organizationId },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true,
          title: true,
          body: true,
          provider: true,
          dryRun: true,
          status: true,
          error: true,
          sentAt: true,
          createdAt: true,
          customer: {
            select: {
              id: true,
              name: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
            },
          },
          actor: {
            select: {
              id: true,
              name: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      }),
      prisma.smsDelivery.groupBy({
        by: ["status"],
        where: { organizationId },
        _count: { _all: true },
      }),
      prisma.smsDelivery.findMany({
        where: { organizationId },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true,
          phoneMasked: true,
          purpose: true,
          message: true,
          provider: true,
          dryRun: true,
          status: true,
          providerStatus: true,
          providerMessage: true,
          error: true,
          sentAt: true,
          createdAt: true,
          customer: {
            select: {
              id: true,
              name: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
            },
          },
          actor: {
            select: {
              id: true,
              name: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      }),
    ])

    return {
      config: {
        webPush: getWebPushRuntimeConfig(),
        sms: smsService.getConfig(),
      },
      stats: {
        inApp: {
          total: inAppTotal,
          unread: inAppUnread,
          read: Math.max(inAppTotal - inAppUnread, 0),
        },
        webPush: mapStatusCounts(WEB_PUSH_STATUSES, webPushStatusRows),
        sms: mapStatusCounts(SMS_STATUSES, smsStatusRows),
      },
      recent: {
        inApp: recentInApp,
        webPush: recentWebPush,
        sms: recentSms,
      },
    }
  }

  private async requireOrganization(id: string) {
    const organization = await prisma.organization.findFirst({
      where: { id, deletedAt: null, isActive: true },
      select: { id: true },
    })
    if (!organization) throw new ApiError(404, "Organization not found")
    return organization
  }
}

export const notificationOperationsService = new NotificationOperationsService()
