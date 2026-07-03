import { getSmsIrLineNumber, getSmsRuntimeConfig } from "@/lib/sms/sms-provider"
import type { SmsProvider, SmsSendResult, SmsSendTextInput, SmsSendVerifyCodeInput } from "@/lib/sms/sms.types"
import { SmsIrClient, createSmsIrClient } from "@/lib/sms/sms-ir-client.server"
import { validateRecipientCount } from "@/lib/sms/phone-normalization"
import { validateLikeToLikeLengths, validateSchedule } from "@/lib/sms/sms-ir-validation"

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
  private readonly client: SmsIrClient | null

  constructor() {
    this.client = createSmsIrClient()
  }

  async getLines(input?: { pageSize?: number }): Promise<{ ok: boolean; lines?: number[]; error?: string }> {
    if (!this.client) {
      return { ok: false, error: "SMS.ir client is not configured" }
    }
    try {
      const lines = await this.client.getLines(input)
      const numeric = lines.map((line) => (typeof line === "number" ? line : Number(line))).filter((line) => Number.isFinite(line))
      return { ok: true, lines: numeric }
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : "SMS.ir get lines failed" }
    }
  }

  async sendText(input: SmsSendTextInput): Promise<SmsSendResult> {
    const config = getSmsRuntimeConfig()
    if (!config.realSendEnabled) throw new Error("Real SMS sending is disabled; use dry-run mode")
    if (!this.client) throw new Error("SMS.ir is not configured")

    const lineNumber = getSmsIrLineNumber()
    if (!lineNumber) throw new Error("SMS.ir line number is not configured")

    const schedule = validateSchedule(null)
    if (!schedule.ok) throw new Error(schedule.error)

    const recipientValidation = validateRecipientCount([input.to], 100)
    if (recipientValidation.invalid.length > 0) {
      throw new Error("Maximum 100 recipients allowed per request")
    }

    const result = await this.client.sendBulk({
      lineNumber,
      messageText: input.message,
      mobiles: [input.to],
      sendDateTime: null,
    })

    return {
      ok: true,
      provider: "sms_ir",
      dryRun: false,
      messageId: result.messageIds[0] ?? undefined,
      packId: result.packId,
      status: 1,
      message: "SMS.ir bulk send succeeded",
      cost: result.cost,
    }
  }

  async sendVerifyCode(input: SmsSendVerifyCodeInput): Promise<SmsSendResult> {
    const config = getSmsRuntimeConfig()
    if (!config.realSendEnabled) throw new Error("Real SMS sending is disabled; use dry-run mode")
    if (!this.client) throw new Error("SMS.ir is not configured")

    const recipientValidation = validateRecipientCount([input.to], 100)
    if (recipientValidation.invalid.length > 0) {
      throw new Error("Maximum 100 recipients allowed per request")
    }

    return this.request("/v1/send/verify", {
      mobile: input.to,
      templateId: input.templateId,
      parameters: input.parameters,
    })
  }

  async sendBulk(input: { to: string[]; message: string; purpose: string; correlationId?: string }): Promise<SmsSendResult> {
    const config = getSmsRuntimeConfig()
    if (!config.realSendEnabled) throw new Error("Real SMS sending is disabled; use dry-run mode")
    if (!this.client) throw new Error("SMS.ir is not configured")

    const lineNumber = getSmsIrLineNumber()
    if (!lineNumber) throw new Error("SMS.ir line number is not configured")

    const recipientValidation = validateRecipientCount(input.to, 100)
    if (recipientValidation.invalid.length > 0) {
      throw new Error("Maximum 100 recipients allowed per request")
    }

    const result = await this.client.sendBulk({
      lineNumber,
      messageText: input.message,
      mobiles: input.to,
      sendDateTime: null,
    })

    return {
      ok: true,
      provider: "sms_ir",
      dryRun: false,
      packId: result.packId,
      status: 1,
      message: "SMS.ir bulk send succeeded",
      cost: result.cost,
    }
  }

  async sendLikeToLike(input: { to: string[]; messages: string[]; purpose: string; correlationId?: string }): Promise<SmsSendResult> {
    const config = getSmsRuntimeConfig()
    if (!config.realSendEnabled) throw new Error("Real SMS sending is disabled; use dry-run mode")
    if (!this.client) throw new Error("SMS.ir is not configured")

    const lineNumber = getSmsIrLineNumber()
    if (!lineNumber) throw new Error("SMS.ir line number is not configured")

    const lengthValidation = validateLikeToLikeLengths(input.to, input.messages)
    if (!lengthValidation.ok) throw new Error(lengthValidation.error)

    const recipientValidation = validateRecipientCount(input.to, 100)
    if (recipientValidation.invalid.length > 0) {
      throw new Error("Maximum 100 recipients allowed per request")
    }

    const result = await this.client.sendLikeToLike({
      lineNumber,
      messageTexts: input.messages,
      mobiles: input.to,
      sendDateTime: null,
    })

    return {
      ok: true,
      provider: "sms_ir",
      dryRun: false,
      packId: result.packId,
      status: 1,
      message: "SMS.ir likeToLike send succeeded",
      cost: result.cost,
    }
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
      const providerOk = response.ok && (providerStatus === 1 || providerStatus === 200)

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
