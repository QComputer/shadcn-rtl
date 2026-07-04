import { getSmsRuntimeConfig } from "@/lib/sms/sms-provider"
import type {
  SmsIrGetLinesInput,
  SmsIrSendBulkInput,
  SmsIrSendLikeToLikeInput,
  SmsIrLine,
  SmsIrResponse,
  SmsIrSendResult,
  SmsIrMessageReport,
  SmsIrPackSummary,
  SmsIrPackMessage,
  SmsIrPaginationInput,
  SmsIrArchiveInput,
} from "@/lib/sms/sms-ir-types"

function validateServerOnly() {
  if (typeof window !== "undefined") {
    throw new Error("sms-ir client can only be used on the server")
  }
}

async function request<T>(baseUrl: string, apiKey: string, timeoutMs: number, path: string, init?: RequestInit): Promise<SmsIrResponse<T>> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: {
        Accept: "application/json",
        "X-API-KEY": apiKey,
        ...(init?.headers || {}),
      },
      signal: controller.signal,
    })

    const envelope = (await response.json().catch(() => ({}))) as SmsIrResponse<T>
    if (!response.ok || envelope.status !== 1) {
      throw new Error(envelope.message || `sms.ir request failed with HTTP ${response.status}`)
    }
    return envelope
  } finally {
    clearTimeout(timeout)
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

  async getMessageReport(messageId: number | string): Promise<SmsIrMessageReport | null> {
    validateServerOnly()
    const envelope = await request<SmsIrMessageReport>(this.baseUrl, this.apiKey, this.timeoutMs, `/v1/send/${encodeURIComponent(String(messageId))}`)
    return envelope.data ?? null
  }

  async getTodayPacks(input: SmsIrPaginationInput = {}): Promise<SmsIrPackSummary[]> {
    validateServerOnly()
    const params = new URLSearchParams()
    if (input.pageSize) params.set("PageSize", String(input.pageSize))
    if (input.pageNumber) params.set("PageNumber", String(input.pageNumber))

    const envelope = await request<SmsIrPackSummary[]>(this.baseUrl, this.apiKey, this.timeoutMs, `/v1/send/pack?${params.toString()}`)
    return Array.isArray(envelope.data) ? envelope.data : []
  }

  async getPackReport(packId: string): Promise<SmsIrPackMessage[]> {
    validateServerOnly()
    const envelope = await request<SmsIrPackMessage[]>(this.baseUrl, this.apiKey, this.timeoutMs, `/v1/send/pack/${encodeURIComponent(packId)}`)
    return Array.isArray(envelope.data) ? envelope.data : []
  }

  async getLiveSendReport(input: SmsIrPaginationInput = {}): Promise<SmsIrPackMessage[]> {
    validateServerOnly()
    const params = new URLSearchParams()
    if (input.pageSize) params.set("PageSize", String(input.pageSize))
    if (input.pageNumber) params.set("PageNumber", String(input.pageNumber))

    const envelope = await request<SmsIrPackMessage[]>(this.baseUrl, this.apiKey, this.timeoutMs, `/v1/send/live?${params.toString()}`)
    return Array.isArray(envelope.data) ? envelope.data : []
  }

  async getArchiveSendReport(input: SmsIrArchiveInput = {}): Promise<SmsIrPackMessage[]> {
    validateServerOnly()
    const params = new URLSearchParams()
    if (input.fromDate) params.set("FromDate", String(input.fromDate))
    if (input.toDate) params.set("ToDate", String(input.toDate))
    if (input.pageSize) params.set("PageSize", String(input.pageSize))
    if (input.pageNumber) params.set("PageNumber", String(input.pageNumber))

    const envelope = await request<SmsIrPackMessage[]>(this.baseUrl, this.apiKey, this.timeoutMs, `/v1/send/archive?${params.toString()}`)
    return Array.isArray(envelope.data) ? envelope.data : []
  }
}

export function createSmsIrClient(): SmsIrClient | null {
  const config = getSmsRuntimeConfig()
  if (!config.apiKeyConfigured || !config.baseUrl) return null
  return new SmsIrClient(config.baseUrl, process.env.SMS_IR_API_KEY || "", config.timeoutMs)
}
