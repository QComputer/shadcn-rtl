import { writeAuditLog } from "@/lib/audit-log"
import { deliveryAttemptRecorder } from "@/lib/notifications/delivery-attempt-recorder"
import { prisma } from "@/lib/db"
import { getWebPushRuntimeConfig, webPushFoundationService } from "@/lib/services/web-push-foundation.service"
import type { Prisma, UserRole } from "@prisma/client"

type NotifyOrderCreatedInput = {
  prisma: Prisma.TransactionClient | typeof prisma
  organizationId: string
  order: {
    orderNumber: string
    total: number
    type: "DELIVERY" | "PICK_UP"
    customerName?: string | null
  }
  actorUserId?: string | null
}

type AttemptStaffWebPushInput = {
  organizationId: string
  order: {
    orderNumber: string
    total: number
    type: "DELIVERY" | "PICK_UP"
  }
  actorUserId?: string | null
}

const OPERATIONAL_ROLES: UserRole[] = ["ADMIN", "MANAGER", "STAFF"]

function formatToman(value: number): string {
  return new Intl.NumberFormat("fa-IR").format(Math.round(value))
}

export class OperationalNotificationRouter {
  async notifyOrderCreatedForStaff(input: NotifyOrderCreatedInput): Promise<void> {
    const { prisma: db, organizationId, order, actorUserId } = input

    const operationalMembers = await db.organizationMember.findMany({
      where: {
        organizationId,
        isActive: true,
        user: {
          isActive: true,
          deletedAt: null,
        },
      },
      select: {
        userId: true,
        role: true,
      },
    })

    const recipientIds = operationalMembers
      .filter((member) => OPERATIONAL_ROLES.includes(member.role as UserRole))
      .map((member) => member.userId)

    if (recipientIds.length === 0) {
      return
    }

    const customerName = order.customerName || "مشتری"
    const typeName = order.type === "DELIVERY" ? "ارسال" : "تحویل در محل"
    const totalDisplay = formatToman(order.total)
    const context = `سفارش جدید ثبت شد: شماره ${order.orderNumber}، مشتری ${customerName}، مبلغ ${totalDisplay}، نوع سفارش ${typeName}`

    await db.notification.createMany({
      data: recipientIds.map((userId) => ({
        targetUserId: userId,
        organizationId,
        createdByUserId: actorUserId || null,
        context,
        type: "ORDER_CREATED",
        seen: false,
      })),
    })

    await deliveryAttemptRecorder.record({
      organizationId,
      targetUserId: null,
      orderId: null,
      guestCustomerId: null,
      notificationId: null,
      channel: "IN_APP",
      purpose: "ORDER_CREATED_STAFF",
      status: "SENT",
      dryRun: false,
      retryable: false,
      metadata: { recipientCount: recipientIds.length, orderNumber: order.orderNumber },
      actorUserId: actorUserId || null,
    })

    await writeAuditLog({
      action: "CREATE",
      entityType: "Notification",
      entityId: organizationId,
      description: "New order notification sent to operational staff",
      newValue: {
        orderNumber: order.orderNumber,
        recipientCount: recipientIds.length,
        recipientRoles: operationalMembers.map((m) => m.role),
      },
      userId: actorUserId || undefined,
      organizationId,
    })
  }

  async attemptStaffWebPush(input: AttemptStaffWebPushInput): Promise<void> {
    const { organizationId, order, actorUserId } = input
    const config = getWebPushRuntimeConfig()

    if (!config.realSendEnabled) {
      return
    }

    const operationalMembers = await prisma.organizationMember.findMany({
      where: {
        organizationId,
        isActive: true,
        user: {
          isActive: true,
          deletedAt: null,
        },
      },
      select: {
        userId: true,
        role: true,
      },
    })

    const recipientIds = operationalMembers
      .filter((member) => OPERATIONAL_ROLES.includes(member.role as UserRole))
      .map((member) => member.userId)

    const subscriptions = await prisma.pushSubscription.findMany({
      where: {
        organizationId,
        customerId: { in: recipientIds },
        isActive: true,
        customer: {
          isActive: true,
          deletedAt: null,
        },
      },
      select: {
        id: true,
        customerId: true,
        endpoint: true,
        p256dh: true,
        auth: true,
      },
    })

    if (subscriptions.length === 0) {
      return
    }

    for (const subscription of subscriptions) {
      try {
        const delivery = await prisma.webPushDelivery.create({
          data: {
            organizationId,
            customerId: subscription.customerId,
            subscriptionId: subscription.id,
            actorUserId: actorUserId || null,
            title: "سفارش جدید",
            body: `سفارش ${order.orderNumber} نیازمند بررسی است`,
            provider: config.provider,
            dryRun: false,
            status: "PENDING",
          },
          select: { id: true },
        })

        const pushResult = await webPushFoundationService.sendToCustomer({
          organizationId,
          customerId: subscription.customerId,
          actorUserId: actorUserId || null,
          title: "سفارش جدید",
          body: `سفارش ${order.orderNumber} نیازمند بررسی است`,
          preferenceKind: "transactional",
          dryRun: false,
        }).catch(async (err) => {
          await prisma.webPushDelivery.update({
            where: { id: delivery.id },
            data: { status: "FAILED", error: err instanceof Error ? err.message : String(err) },
          })
          await deliveryAttemptRecorder.record({
            organizationId,
            targetUserId: subscription.customerId,
            orderId: null,
            guestCustomerId: null,
            notificationId: null,
            channel: "WEB_PUSH",
            purpose: "ORDER_CREATED_STAFF",
            status: "FAILED",
            dryRun: false,
            retryable: true,
            lastErrorText: err instanceof Error ? err.message : String(err),
            actorUserId: actorUserId || null,
          })
          return null
        })

        if (pushResult) {
          await prisma.webPushDelivery.update({
            where: { id: delivery.id },
            data: { status: "SENT", sentAt: new Date() },
          })
          await deliveryAttemptRecorder.record({
            organizationId,
            targetUserId: subscription.customerId,
            orderId: null,
            guestCustomerId: null,
            notificationId: null,
            channel: "WEB_PUSH",
            purpose: "ORDER_CREATED_STAFF",
            status: "SENT",
            dryRun: false,
            retryable: false,
            actorUserId: actorUserId || null,
          })
        }
      } catch (err) {
        console.error("[operational-router] Failed to send push to staff member", subscription.customerId, err instanceof Error ? err.message : String(err))
      }
    }
  }
}

export const operationalNotificationRouter = new OperationalNotificationRouter()