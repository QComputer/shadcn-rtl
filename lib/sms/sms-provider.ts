import type { SmsProviderName, SmsRuntimeConfig } from "@/lib/sms/sms.types"

const DEFAULT_SMS_IR_BASE_URL = "https://api.sms.ir"
const DEFAULT_SMS_TIMEOUT_MS = 15000

function hasValue(value: string | undefined) {
  return typeof value === "string" && value.trim().length > 0
}

export function normalizeSmsProvider(value?: string | null): SmsProviderName {
  const normalized = (value || "dry_run").trim().toLowerCase().replaceAll("-", "_")
  return normalized === "sms_ir" ? "sms_ir" : "dry_run"
}

function normalizeBaseUrl(value?: string | null) {
  const raw = value?.trim() || DEFAULT_SMS_IR_BASE_URL
  return raw.replace(/\/+$/, "").replace(/\/v1$/, "")
}

function normalizeTimeoutMs(value?: string | null) {
  const parsed = Number.parseInt(value || "", 10)
  if (!Number.isFinite(parsed) || parsed < 1000) return DEFAULT_SMS_TIMEOUT_MS
  return Math.min(parsed, 60000)
}

export function getSmsRuntimeConfig(): SmsRuntimeConfig {
  const provider = normalizeSmsProvider(process.env.SMS_PROVIDER)
  const dryRun = process.env.SMS_DRY_RUN !== "false" || provider === "dry_run"
  const lineNumber = process.env.SMS_IR_LINE_NUMBER || process.env.SMS_IR_LINE
  const allowRealSms = process.env.DEPLOYED_ALLOW_REAL_SMS === "1"
  const operatorTargetConfirmed = hasValue(process.env.DEPLOYED_SMS_TARGET_MOBILE)
    || process.env.SMS_REAL_SEND_OPERATOR_CONFIRMED === "1"
  const usernameConfigured = hasValue(process.env.SMS_IR_USERNAME)
  const apiKeyConfigured = hasValue(process.env.SMS_IR_API_KEY)
  const lineNumberConfigured = hasValue(lineNumber)
  const realSendEnabled = provider === "sms_ir"
    && !dryRun
    && allowRealSms
    && operatorTargetConfirmed
    && usernameConfigured
    && apiKeyConfigured
    && lineNumberConfigured

  return {
    provider,
    dryRun,
    baseUrl: normalizeBaseUrl(process.env.SMS_IR_BASE_URL),
    allowRealSms,
    operatorTargetConfirmed,
    usernameConfigured,
    apiKeyConfigured,
    lineNumberConfigured,
    verifyTemplateConfigured: hasValue(process.env.SMS_IR_VERIFY_TEMPLATE_ID),
    timeoutMs: normalizeTimeoutMs(process.env.SMS_IR_TIMEOUT_MS),
    realSendEnabled,
    configured: !realSendEnabled || (allowRealSms && operatorTargetConfirmed && usernameConfigured && apiKeyConfigured && lineNumberConfigured),
  }
}

export function getSmsIrLineNumber() {
  return (process.env.SMS_IR_LINE_NUMBER || process.env.SMS_IR_LINE || "").trim()
}
