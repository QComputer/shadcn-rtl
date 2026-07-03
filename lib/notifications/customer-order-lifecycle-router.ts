import { writeAuditLog } from "@/lib/audit-log"
import { prisma } from "@/lib/db"
import { notificationRouterService } from "@/lib/notifications/router"
import type { NotificationTemplateKey } from "@/lib/notifications/templates"
import type { UserRole } from "@prisma/client"

type NotifyOrderStatusChangedInput = {
  organizationId: string
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

export class CustomerOrderLifecycleRouter {
  async notifyOrderStatusChangedSafe(input: NotifyOrderStatusChangedInput): Promise<void> {
    const { organizationId, orderNumber, previousStatus, newStatus, customerId, guestCustomerId, guestPhone, actorUserId } = input

    if (previousStatus === newStatus) return

    try {
      if (customerId) {
        await this.routeCustomerNotification({
          organizationId,
          customerId,
          actorUserId,
          templateKey: "order_status_updated",
          variables: {
            orderNumber,
            previousStatus,
            status: newStatus,
          },
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
            previousStatus,
            newStatus,
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
      }
    } catch (error) {
      console.error("[customer-order-lifecycle] order status notification failed (non-blocking)", error instanceof Error ? error.message : String(error))
    }
  }

  async notifyPaymentStatusChangedSafe(input: NotifyPaymentStatusChangedInput): Promise<void> {
    const { organizationId, orderNumber, previousStatus, newStatus, customerId, guestCustomerId, guestPhone, actorUserId } = input

    if (previousStatus === newStatus) return

    try {
      if (customerId) {
        await this.routeCustomerNotification({
          organizationId,
          customerId,
          actorUserId,
          templateKey: "payment_status_updated",
          variables: {
            orderNumber,
            previousPaymentStatus: previousStatus,
            paymentStatus: newStatus,
          },
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
            previousStatus,
            newStatus,
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
      }
    } catch (error) {
      console.error("[customer-order-lifecycle] payment status notification failed (non-blocking)", error instanceof Error ? error.message : String(error))
    }
  }

  private async routeCustomerNotification(input: {
    organizationId: string
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
