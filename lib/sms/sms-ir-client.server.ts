import { getSmsRuntimeConfig } from "@/lib/sms/sms-provider"
import type { SmsIrGetLinesInput, SmsIrSendBulkInput, SmsIrSendLikeToLikeInput, SmsIrLine, SmsIrResponse, SmsIrSendResult } from "@/lib/sms/sms-ir-types"

function validateServerOnly() {
  if (typeof window !== "undefined") {
    throw new Error("sms-ir client can only be used on the server")
  }
}

export class SmsIrClient {
  constructor(private readonly baseUrl: string, private readonly apiKey: string, private readonly timeoutMs: number) {}

  async getLines(input: SmsIrGetLinesInput = {}): Promise<SmsIrLine[]> {
    validateServerOnly()
    const url = `${this.baseUrl}/v1/line`
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs)

    try {
      const params = new URLSearchParams()
      if (input.pageSize) params.set("PageSize", String(input.pageSize))

      const response = await fetch(`${url}?${params.toString()}`, {
        method: "GET",
        headers: {
          Accept: "application/json",
          "X-API-KEY": this.apiKey,
        },
        signal: controller.signal,
      })

      const envelope = (await response.json().catch(() => ({}))) as SmsIrResponse<SmsIrLine[]>
      if (!response.ok || envelope.status !== 1) {
        throw new Error(envelope.message || `sms.ir get lines failed with HTTP ${response.status}`)
      }
      return Array.isArray(envelope.data) ? envelope.data : []
    } finally {
      clearTimeout(timeout)
    }
  }

  async sendBulk(input: SmsIrSendBulkInput): Promise<SmsIrSendResult> {
    validateServerOnly()
    const url = `${this.baseUrl}/v1/send/bulk`
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs)

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-API-KEY": this.apiKey,
        },
        body: JSON.stringify({
          lineNumber: input.lineNumber,
          messageText: input.messageText,
          mobiles: input.mobiles,
          sendDateTime: input.sendDateTime ?? null,
        }),
        signal: controller.signal,
      })

      const envelope = (await response.json().catch(() => ({}))) as SmsIrResponse<SmsIrSendResult>
      if (!response.ok || envelope.status !== 1 || !envelope.data) {
        throw new Error(envelope.message || `sms.ir send bulk failed with HTTP ${response.status}`)
      }
      return {
        packId: String(envelope.data.packId || ""),
        messageIds: Array.isArray(envelope.data.messageIds) ? envelope.data.messageIds : [],
        cost: typeof envelope.data.cost === "number" ? envelope.data.cost : 0,
      }
    } finally {
      clearTimeout(timeout)
    }
  }

  async sendLikeToLike(input: SmsIrSendLikeToLikeInput): Promise<SmsIrSendResult> {
    validateServerOnly()
    const url = `${this.baseUrl}/v1/send/likeToLike`
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs)

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-API-KEY": this.apiKey,
        },
        body: JSON.stringify({
          lineNumber: input.lineNumber,
          messageTexts: input.messageTexts,
          mobiles: input.mobiles,
          sendDateTime: input.sendDateTime ?? null,
        }),
        signal: controller.signal,
      })

      const envelope = (await response.json().catch(() => ({}))) as SmsIrResponse<SmsIrSendResult>
      if (!response.ok || envelope.status !== 1 || !envelope.data) {
        throw new Error(envelope.message || `sms.ir likeToLike send failed with HTTP ${response.status}`)
      }
      return {
        packId: String(envelope.data.packId || ""),
        messageIds: Array.isArray(envelope.data.messageIds) ? envelope.data.messageIds : [],
        cost: typeof envelope.data.cost === "number" ? envelope.data.cost : 0,
      }
    } finally {
      clearTimeout(timeout)
    }
  }
}

export function createSmsIrClient(): SmsIrClient | null {
  const config = getSmsRuntimeConfig()
  if (!config.apiKeyConfigured || !config.baseUrl) return null
  return new SmsIrClient(config.baseUrl, process.env.SMS_IR_API_KEY || "", config.timeoutMs)
}
