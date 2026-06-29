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
  const realSendEnabled = provider === "sms_ir" && !dryRun
  const apiKeyConfigured = hasValue(process.env.SMS_IR_API_KEY)
  const lineNumberConfigured = hasValue(lineNumber)

  return {
    provider,
    dryRun,
    baseUrl: normalizeBaseUrl(process.env.SMS_IR_BASE_URL),
    apiKeyConfigured,
    lineNumberConfigured,
    verifyTemplateConfigured: hasValue(process.env.SMS_IR_VERIFY_TEMPLATE_ID),
    timeoutMs: normalizeTimeoutMs(process.env.SMS_IR_TIMEOUT_MS),
    realSendEnabled,
    configured: !realSendEnabled || (apiKeyConfigured && lineNumberConfigured),
  }
}

export function getSmsIrLineNumber() {
  return (process.env.SMS_IR_LINE_NUMBER || process.env.SMS_IR_LINE || "").trim()
}
