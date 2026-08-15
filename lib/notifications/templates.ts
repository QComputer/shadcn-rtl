import type { SmsPurpose } from "@/lib/sms"

export type NotificationTemplateKey =
  | "appointment_confirmation"
  | "appointment_reminder"
  | "order_created"
  | "order_status_updated"
  | "order_ready_time_updated"
  | "payment_status_updated"
  | "staff_alert"
  | "marketing_broadcast"

export type NotificationTemplateVariables = Record<string, string | number | Date | null | undefined>

export type RenderedNotificationTemplate = {
  key: NotificationTemplateKey
  locale: string
  title: string
  body: string
  pushTitle: string
  pushBody: string
  smsBody: string
  inAppType: string
  smsPurpose: SmsPurpose
  preferenceKind: "marketing" | "transactional"
}

type TemplateDefinition = {
  inAppType: string
  smsPurpose: SmsPurpose
  preferenceKind: "marketing" | "transactional"
  title: string
  body: string
  smsBody?: string
}

const TEMPLATES: Record<NotificationTemplateKey, TemplateDefinition> = {
  appointment_confirmation: {
    inAppType: "APPOINTMENT_CONFIRMATION",
    smsPurpose: "appointment_confirmation",
    preferenceKind: "transactional",
    title: "تایید نوبت",
    body: "نوبت {{serviceName}} در {{organizationName}} برای {{date}} ساعت {{time}} تایید شد.",
  },
  appointment_reminder: {
    inAppType: "APPOINTMENT_REMINDER",
    smsPurpose: "appointment_reminder",
    preferenceKind: "transactional",
    title: "یادآوری نوبت",
    body: "یادآوری: نوبت {{serviceName}} در {{organizationName}} برای {{date}} ساعت {{time}} ثبت شده است.",
  },
  order_created: {
    inAppType: "ORDER_CREATED",
    smsPurpose: "order_created",
    preferenceKind: "transactional",
    title: "سفارش جدید",
    body: "سفارش {{orderNumber}} در {{organizationName}} ثبت شد.",
  },
  order_status_updated: {
    inAppType: "ORDER_STATUS_UPDATED",
    smsPurpose: "order_status_updated",
    preferenceKind: "transactional",
    title: "به روزرسانی سفارش",
    body: "وضعیت سفارش {{orderNumber}} به {{status}} تغییر کرد.",
  },
  order_ready_time_updated: {
    inAppType: "ORDER_READY_TIME_UPDATED",
    smsPurpose: "order_status_updated",
    preferenceKind: "transactional",
    title: "زمان آماده‌شدن سفارش",
    body: "زمان آماده‌شدن سفارش {{orderNumber}} به {{readyAt}} تغییر کرد.",
  },
  payment_status_updated: {
    inAppType: "PAYMENT_STATUS_UPDATED",
    smsPurpose: "payment_status_updated",
    preferenceKind: "transactional",
    title: "وضعیت پرداخت",
    body: "وضعیت پرداخت سفارش {{orderNumber}} به {{paymentStatus}} تغییر کرد.",
  },
  staff_alert: {
    inAppType: "STAFF_ALERT",
    smsPurpose: "staff_alert",
    preferenceKind: "transactional",
    title: "هشدار عملیاتی",
    body: "{{message}}",
  },
  marketing_broadcast: {
    inAppType: "MARKETING_BROADCAST",
    smsPurpose: "marketing_broadcast",
    preferenceKind: "marketing",
    title: "{{title}}",
    body: "{{message}}",
  },
}

function valueToString(value: string | number | Date | null | undefined, locale: string) {
  if (value == null) return ""
  if (value instanceof Date) return value.toLocaleString(locale === "fa" ? "fa-IR" : locale)
  return String(value)
}

function interpolate(template: string, variables: NotificationTemplateVariables, locale: string) {
  return template.replace(/\{\{([A-Za-z0-9_]+)\}\}/g, (_, key: string) => valueToString(variables[key], locale))
}

export function renderNotificationTemplate(
  key: NotificationTemplateKey,
  variables: NotificationTemplateVariables = {},
  locale = "fa",
): RenderedNotificationTemplate {
  const definition = TEMPLATES[key]
  const title = interpolate(definition.title, variables, locale).trim()
  const body = interpolate(definition.body, variables, locale).trim()
  const smsBody = interpolate(definition.smsBody || definition.body, variables, locale).trim()

  return {
    key,
    locale,
    title,
    body,
    pushTitle: title,
    pushBody: body,
    smsBody,
    inAppType: definition.inAppType,
    smsPurpose: definition.smsPurpose,
    preferenceKind: definition.preferenceKind,
  }
}

export function listNotificationTemplateKeys() {
  return Object.keys(TEMPLATES) as NotificationTemplateKey[]
}
