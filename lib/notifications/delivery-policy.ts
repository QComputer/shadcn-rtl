import type { NotificationChannel } from "@prisma/client"
import type { NotificationTemplateKey, RenderedNotificationTemplate } from "@/lib/notifications/templates"

export type NotificationDeliveryChannel = Extract<NotificationChannel, "IN_APP" | "WEB_PUSH" | "SMS">

type DeliveryPolicy = {
  templateKey: NotificationTemplateKey
  channels: NotificationDeliveryChannel[]
  preferenceKind: "marketing" | "transactional"
}

const DEFAULT_CHANNELS: Record<NotificationTemplateKey, NotificationDeliveryChannel[]> = {
  appointment_confirmation: ["IN_APP", "WEB_PUSH", "SMS"],
  appointment_reminder: ["IN_APP", "WEB_PUSH", "SMS"],
  order_created: ["IN_APP", "WEB_PUSH"],
  order_status_updated: ["IN_APP", "WEB_PUSH", "SMS"],
  order_ready_time_updated: ["IN_APP", "WEB_PUSH"],
  payment_status_updated: ["IN_APP", "WEB_PUSH", "SMS"],
  staff_alert: ["IN_APP", "WEB_PUSH"],
  marketing_broadcast: ["IN_APP", "WEB_PUSH", "SMS"],
}

export function resolveNotificationDeliveryPolicy(input: {
  template: RenderedNotificationTemplate
  channels?: NotificationDeliveryChannel[]
}): DeliveryPolicy {
  const defaults = DEFAULT_CHANNELS[input.template.key]
  const requested = input.channels?.length ? input.channels : defaults
  const allowed = requested.filter((channel): channel is NotificationDeliveryChannel => defaults.includes(channel))

  return {
    templateKey: input.template.key,
    channels: [...new Set(allowed)],
    preferenceKind: input.template.preferenceKind,
  }
}
