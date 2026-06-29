export type SmsProviderName = "dry_run" | "sms_ir"

export type SmsPurpose =
  | "phone_verification"
  | "appointment_confirmation"
  | "appointment_reminder"
  | "order_created"
  | "order_status_updated"
  | "payment_status_updated"
  | "staff_alert"
  | "marketing_broadcast"

export type SmsPreferenceKind = "marketing" | "transactional"

export type SmsRuntimeConfig = {
  provider: SmsProviderName
  dryRun: boolean
  baseUrl: string
  allowRealSms: boolean
  operatorTargetConfirmed: boolean
  usernameConfigured: boolean
  apiKeyConfigured: boolean
  lineNumberConfigured: boolean
  verifyTemplateConfigured: boolean
  timeoutMs: number
  realSendEnabled: boolean
  configured: boolean
}

export type SmsSendResult = {
  ok: boolean
  provider: SmsProviderName
  dryRun: boolean
  messageId?: string | number
  packId?: string | number
  status?: number
  message?: string
  error?: string
  skipped?: boolean
  deliveryId?: string
}

export type SmsSendTextInput = {
  to: string
  message: string
  purpose: SmsPurpose
  correlationId?: string
}

export type SmsSendVerifyCodeInput = {
  to: string
  templateId: number
  parameters: { name: string; value: string }[]
  purpose: SmsPurpose
  correlationId?: string
}

export interface SmsProvider {
  sendText(input: SmsSendTextInput): Promise<SmsSendResult>
  sendVerifyCode(input: SmsSendVerifyCodeInput): Promise<SmsSendResult>
}

export function maskPhoneNumber(value: string) {
  const digits = value.replace(/\D/g, "")
  if (digits.length <= 4) return "****"
  const prefix = digits.slice(0, Math.min(4, digits.length - 4))
  const suffix = digits.slice(-3)
  return `${prefix}${"*".repeat(Math.max(digits.length - prefix.length - suffix.length, 4))}${suffix}`
}
