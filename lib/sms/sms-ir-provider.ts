import { ApiError } from "@/lib/api-guards"
import { getSmsIrLineNumber, getSmsRuntimeConfig } from "@/lib/sms/sms-provider"
import type { SmsProvider, SmsSendResult, SmsSendTextInput, SmsSendVerifyCodeInput } from "@/lib/sms/sms.types"

type SmsIrEnvelope = {
  status?: number
  message?: string
  data?: {
    messageId?: string | number
    packId?: string | number
    [key: string]: unknown
  }
}

export class SmsIrProvider implements SmsProvider {
  async sendText(input: SmsSendTextInput): Promise<SmsSendResult> {
    const config = getSmsRuntimeConfig()
    const lineNumber = getSmsIrLineNumber()
    if (!config.realSendEnabled) throw new ApiError(409, "Real SMS sending is disabled; use dry-run mode")
    if (!config.allowRealSms || !config.operatorTargetConfirmed || !config.usernameConfigured || !config.apiKeyConfigured || !lineNumber) throw new ApiError(409, "SMS.ir is not configured")

    return this.request("/v1/send/bulk", {
      lineNumber,
      messageText: input.message,
      mobiles: [input.to],
      sendDateTime: null,
    })
  }

  async sendVerifyCode(input: SmsSendVerifyCodeInput): Promise<SmsSendResult> {
    const config = getSmsRuntimeConfig()
    if (!config.realSendEnabled) throw new ApiError(409, "Real SMS sending is disabled; use dry-run mode")
    if (!config.allowRealSms || !config.operatorTargetConfirmed || !config.usernameConfigured || !config.apiKeyConfigured) throw new ApiError(409, "SMS.ir is not configured")

    return this.request("/v1/send/verify", {
      mobile: input.to,
      templateId: input.templateId,
      parameters: input.parameters,
    })
  }

  private async request(path: string, payload: Record<string, unknown>): Promise<SmsSendResult> {
    const config = getSmsRuntimeConfig()
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), config.timeoutMs)

    try {
      const response = await fetch(`${config.baseUrl}${path}`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-API-KEY": process.env.SMS_IR_API_KEY || "",
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      })
      const envelope = (await response.json().catch(() => ({}))) as SmsIrEnvelope
      const providerStatus = typeof envelope.status === "number" ? envelope.status : response.status
      const providerOk = response.ok && (providerStatus === 1 || providerStatus === 200 || providerStatus === response.status)

      return {
        ok: providerOk,
        provider: "sms_ir",
        dryRun: false,
        messageId: envelope.data?.messageId,
        packId: envelope.data?.packId,
        status: providerStatus,
        message: envelope.message || response.statusText,
        error: providerOk ? undefined : envelope.message || `SMS.ir request failed with HTTP ${response.status}`,
      }
    } catch (error) {
      return {
        ok: false,
        provider: "sms_ir",
        dryRun: false,
        error: error instanceof Error ? error.message : "SMS.ir request failed",
      }
    } finally {
      clearTimeout(timeout)
    }
  }
}
