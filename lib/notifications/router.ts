import { ApiError } from "@/lib/api-guards"
import { writeAuditLog } from "@/lib/audit-log"
import { prisma } from "@/lib/db"
import { resolveNotificationDeliveryPolicy, type NotificationDeliveryChannel } from "@/lib/notifications/delivery-policy"
import {
  renderNotificationTemplate,
  type NotificationTemplateKey,
  type NotificationTemplateVariables,
} from "@/lib/notifications/templates"
import { notificationPreferencesService } from "@/lib/services/notification-preferences.service"
import { webPushFoundationService } from "@/lib/services/web-push-foundation.service"
import { smsService } from "@/lib/sms"

type RouteCustomerNotificationInput = {
  organizationId: string
  customerId: string
  actorUserId?: string | null
  templateKey: NotificationTemplateKey
  variables?: NotificationTemplateVariables
  channels?: NotificationDeliveryChannel[]
  locale?: string
  dryRun?: boolean
  correlationId?: string
}

type ChannelResult = {
  channel: NotificationDeliveryChannel
  status: "planned" | "sent" | "skipped" | "failed"
  deliveryId?: string
  notificationId?: string
  error?: string
}

export class NotificationRouterService {
  async routeCustomerNotification(input: RouteCustomerNotificationInput) {
    const organization = await this.requireOrganization(input.organizationId)
    const customer = await this.requireCustomer(input.customerId)
    const template = renderNotificationTemplate(input.templateKey, input.variables, input.locale || organization.locale || "fa")
    const policy = resolveNotificationDeliveryPolicy({ template, channels: input.channels })
    const results: ChannelResult[] = []

    for (const channel of policy.channels) {
      if (input.dryRun) {
        results.push({ channel, status: "planned" })
        continue
      }

      if (channel === "IN_APP") {
        results.push(await this.sendInApp({
          organizationId: organization.id,
          customerId: customer.id,
          actorUserId: input.actorUserId,
          context: template.body,
          type: template.inAppType,
          preferenceKind: policy.preferenceKind,
        }))
      }

      if (channel === "WEB_PUSH") {
        try {
          const result = await webPushFoundationService.sendToCustomer({
            organizationId: organization.id,
            customerId: customer.id,
            actorUserId: input.actorUserId,
            title: template.pushTitle,
            body: template.pushBody,
            preferenceKind: policy.preferenceKind,
            dryRun: false,
          })
          results.push({
            channel,
            status: result.skipped ? "skipped" : result.failureCount > 0 && result.successCount === 0 ? "failed" : "sent",
            error: result.skipped ? "WEB_PUSH preference is disabled" : undefined,
          })
        } catch (error) {
          results.push({ channel, status: "failed", error: error instanceof Error ? error.message : "Web Push delivery failed" })
        }
      }

      if (channel === "SMS") {
        try {
          const result = await smsService.sendTextToCustomer({
            organizationId: organization.id,
            customerId: customer.id,
            actorUserId: input.actorUserId,
            to: customer.phone || "",
            message: template.smsBody,
            purpose: template.smsPurpose,
            preferenceKind: policy.preferenceKind,
            correlationId: input.correlationId,
          })
          results.push({
            channel,
            status: result.skipped ? "skipped" : result.ok ? "sent" : "failed",
            deliveryId: result.deliveryId,
            error: result.error,
          })
        } catch (error) {
          results.push({ channel, status: "failed", error: error instanceof Error ? error.message : "SMS delivery failed" })
        }
      }
    }

    await writeAuditLog({
      action: "CREATE",
      entityType: "Notification",
      entityId: organization.id,
      description: input.dryRun ? "Notification route previewed" : "Notification routed across channels",
      newValue: {
        templateKey: input.templateKey,
        channels: policy.channels,
        dryRun: Boolean(input.dryRun),
        results,
      },
      userId: input.actorUserId || undefined,
      organizationId: organization.id,
    })

    return {
      dryRun: Boolean(input.dryRun),
      template,
      policy,
      results,
      sentCount: results.filter((result) => result.status === "sent").length,
      skippedCount: results.filter((result) => result.status === "skipped").length,
      failedCount: results.filter((result) => result.status === "failed").length,
      plannedCount: results.filter((result) => result.status === "planned").length,
    }
  }

  private async sendInApp(input: {
    organizationId: string
    customerId: string
    actorUserId?: string | null
    context: string
    type: string
    preferenceKind: "marketing" | "transactional"
  }): Promise<ChannelResult> {
    const allowed = await notificationPreferencesService.isCustomerDeliveryAllowed({
      organizationId: input.organizationId,
      customerId: input.customerId,
      channel: "IN_APP",
      kind: input.preferenceKind,
    })

    if (!allowed) return { channel: "IN_APP", status: "skipped", error: "IN_APP preference is disabled" }

    const notification = await prisma.notification.create({
      data: {
        targetUserId: input.customerId,
        organizationId: input.organizationId,
        createdByUserId: input.actorUserId || null,
        context: input.context,
        type: input.type,
      },
      select: { id: true },
    })

    return { channel: "IN_APP", status: "sent", notificationId: notification.id }
  }

  private async requireOrganization(id: string) {
    const organization = await prisma.organization.findFirst({
      where: { id, deletedAt: null, isActive: true },
      select: { id: true, locale: true },
    })
    if (!organization) throw new ApiError(404, "Organization not found")
    return organization
  }

  private async requireCustomer(id: string) {
    const customer = await prisma.user.findFirst({
      where: { id, deletedAt: null, isActive: true },
      select: { id: true, phone: true },
    })
    if (!customer) throw new ApiError(404, "Customer not found")
    return customer
  }
}

export const notificationRouterService = new NotificationRouterService()
