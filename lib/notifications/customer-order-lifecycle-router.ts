import { writeAuditLog } from "@/lib/audit-log"
import { deliveryAttemptRecorder } from "@/lib/notifications/delivery-attempt-recorder"
import { prisma } from "@/lib/db"
import { notificationRouterService } from "@/lib/notifications/router"
import { getOrderStatusLabel, getPaymentStatusLabel } from "@/lib/notifications/status-labels"
import { smsService } from "@/lib/sms"
import type { NotificationTemplateKey } from "@/lib/notifications/templates"
import type { UserRole } from "@prisma/client"

type NotifyOrderStatusChangedInput = {
  organizationId: string
  orderId?: string | null
  orderNumber: string
  previousStatus: string
  newStatus: string
  customerId?: string | null
  guestCustomerId?: string | null
  guestPhone?: string | null
  actorUserId?: string | null
}

type NotifyPaymentStatusChangedInput = {
  organizationId: string
  orderId?: string | null
  orderNumber: string
  previousStatus: string
  newStatus: string
  customerId?: string | null
  guestCustomerId?: string | null
  guestPhone?: string | null
  actorUserId?: string | null
}

function normalizePhone(value: string | null | undefined): string | null {
  if (!value) return null
  const digits = value.trim().replace(/[\s-]/g, "")
  if (!/^\+?\d{10,15}$/.test(digits)) return null
  return digits
}

function buildCustomerVariables(orderNumber: string, previousStatus: string, newStatus: string) {
  return {
    orderNumber,
    previousStatus: getOrderStatusLabel(previousStatus),
    status: getOrderStatusLabel(newStatus),
  }
}

function buildPaymentVariables(orderNumber: string, previousStatus: string, newStatus: string) {
  return {
    orderNumber,
    previousPaymentStatus: getPaymentStatusLabel(previousStatus),
    paymentStatus: getPaymentStatusLabel(newStatus),
  }
}

async function recordGuestSmsDryRun(params: {
  organizationId: string
  orderId?: string | null
  orderNumber: string
  guestCustomerId: string
  actorUserId?: string | null
  purpose: string
}) {
  await deliveryAttemptRecorder.record({
    organizationId: params.organizationId,
    targetUserId: null,
    orderId: params.orderId || null,
    guestCustomerId: params.guestCustomerId,
    notificationId: null,
    channel: "SMS",
    purpose: params.purpose,
    status: "DRY_RUN",
    dryRun: true,
    retryable: false,
    actorUserId: params.actorUserId || null,
  })
}

export class CustomerOrderLifecycleRouter {
  async notifyOrderStatusChangedSafe(input: NotifyOrderStatusChangedInput): Promise<void> {
    const { organizationId, orderId, orderNumber, previousStatus, newStatus, customerId, guestCustomerId, guestPhone, actorUserId } = input

    if (previousStatus === newStatus) return

    try {
      if (customerId) {
        await this.routeCustomerNotification({
          organizationId,
          orderId: orderId || null,
          customerId,
          actorUserId,
          templateKey: "order_status_updated",
          variables: buildCustomerVariables(orderNumber, previousStatus, newStatus),
        })
        return
      }

      if (guestCustomerId && guestPhone) {
        const normalizedPhone = normalizePhone(guestPhone)
        if (!normalizedPhone) return

        await writeAuditLog({
          action: "CREATE",
          entityType: "Notification",
          entityId: organizationId,
          description: "Guest order status SMS dry-run reviewed",
          newValue: {
            orderNumber,
            previousStatus: getOrderStatusLabel(previousStatus),
            newStatus: getOrderStatusLabel(newStatus),
            guestCustomerId,
            phoneMasked: normalizedPhone.slice(-4).padStart(normalizedPhone.length, "*"),
            channel: "SMS",
            dryRun: true,
            templateKey: "order_status_updated",
            reason: "Guest customer notification dry-run only in P120B",
          },
          userId: actorUserId || undefined,
          organizationId,
        })

        await smsService.sendTextToPhone({
          organizationId,
          actorUserId,
          to: normalizedPhone,
          message: `Guest order status update: ${orderNumber}`,
          purpose: "order_status_updated",
          dryRun: true,
          guestCustomerId,
          orderId: orderId || null,
        })

        await recordGuestSmsDryRun({
          organizationId,
          orderId: orderId || null,
          orderNumber,
          guestCustomerId,
          actorUserId,
          purpose: "GUEST_ORDER_STATUS_SMS_DRY_RUN",
        })
      }
    } catch (error) {
      console.error("[customer-order-lifecycle] order status notification failed (non-blocking)", error instanceof Error ? error.message : String(error))
    }
  }

  async notifyPaymentStatusChangedSafe(input: NotifyPaymentStatusChangedInput): Promise<void> {
    const { organizationId, orderId, orderNumber, previousStatus, newStatus, customerId, guestCustomerId, guestPhone, actorUserId } = input

    if (previousStatus === newStatus) return

    try {
      if (customerId) {
        await this.routeCustomerNotification({
          organizationId,
          orderId: orderId || null,
          customerId,
          actorUserId,
          templateKey: "payment_status_updated",
          variables: buildPaymentVariables(orderNumber, previousStatus, newStatus),
        })
        return
      }

      if (guestCustomerId && guestPhone) {
        const normalizedPhone = normalizePhone(guestPhone)
        if (!normalizedPhone) return

        await writeAuditLog({
          action: "CREATE",
          entityType: "Notification",
          entityId: organizationId,
          description: "Guest payment status SMS dry-run reviewed",
          newValue: {
            orderNumber,
            previousStatus: getPaymentStatusLabel(previousStatus),
            newStatus: getPaymentStatusLabel(newStatus),
            guestCustomerId,
            phoneMasked: normalizedPhone.slice(-4).padStart(normalizedPhone.length, "*"),
            channel: "SMS",
            dryRun: true,
            templateKey: "payment_status_updated",
            reason: "Guest customer notification dry-run only in P120B",
          },
          userId: actorUserId || undefined,
          organizationId,
        })

        await smsService.sendTextToPhone({
          organizationId,
          actorUserId,
          to: normalizedPhone,
          message: `Guest payment status update: ${orderNumber}`,
          purpose: "payment_status_updated",
          dryRun: true,
          guestCustomerId,
          orderId: orderId || null,
        })

        await recordGuestSmsDryRun({
          organizationId,
          orderId: orderId || null,
          orderNumber,
          guestCustomerId,
          actorUserId,
          purpose: "GUEST_PAYMENT_STATUS_SMS_DRY_RUN",
        })
      }
    } catch (error) {
      console.error("[customer-order-lifecycle] payment status notification failed (non-blocking)", error instanceof Error ? error.message : String(error))
    }
  }

  private async routeCustomerNotification(input: {
    organizationId: string
    orderId?: string | null
    customerId: string
    actorUserId?: string | null
    templateKey: NotificationTemplateKey
    variables: Record<string, string | number | Date | null | undefined>
  }) {
    const result = await notificationRouterService.routeCustomerNotification({
      organizationId: input.organizationId,
      customerId: input.customerId,
      actorUserId: input.actorUserId || null,
      templateKey: input.templateKey,
      variables: input.variables,
      dryRun: false,
    })

    return result
  }
}

export const customerOrderLifecycleRouter = new CustomerOrderLifecycleRouter()
