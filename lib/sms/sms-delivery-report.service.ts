import { prisma } from "@/lib/db"
import { createSmsIrClient } from "@/lib/sms/sms-ir-client.server"
import { validateMessageId, validatePackId, maskMobile, sanitizeProviderRawData, validatePagination, validateArchiveInput } from "@/lib/sms/sms-ir-report-validation"
import type { SmsDeliveryStatus, NotificationDeliveryAttemptStatus } from "@prisma/client"
import type { SmsIrMessageReport, SmsIrPackMessage } from "@/lib/sms/sms-ir-types"

export type SmsDeliveryReportRow = {
  id: string
  phoneMasked: string
  purpose: string
  message: string
  provider: string
  dryRun: boolean
  status: SmsDeliveryStatus
  providerStatus: number | null
  providerMessage: string | null
  error: string | null
  sentAt: string | null
  createdAt: string
  updatedAt: string
  externalPackId: string | null
  externalMessageId: string | null
  actorUserId: string | null
  actorName: string | null
  customerId: string | null
  customerName: string | null
  attemptStatus: NotificationDeliveryAttemptStatus | null
  attemptRetryable: boolean
  attemptRetryCount: number
  attemptLastErrorText: string | null
  attemptProviderMessageId: string | null
  attemptCreatedAt: string | null
  reconciliationStatus: string | null
  reconciliationError: string | null
  providerReportAvailable: boolean
  providerDeliveryState: number | null
  providerDeliveryDateTime: string | null
  providerCost: number | null
  providerLineNumber: string | null
  providerMessageText: string | null
  providerMobileMasked: string | null
}

export type SmsDeliveryReportFilter = {
  dryRun?: boolean
  status?: SmsDeliveryStatus
  providerStatus?: number | null
  from?: string
  to?: string
  purpose?: string
}

export type ReconcileResult = {
  ok: boolean
  providerReportAvailable: boolean
  reason: string | null
  deliveryId: string
  reconciliationStatus: string | null
  previousStatus: SmsDeliveryStatus | null
  updatedStatus: SmsDeliveryStatus | null
}

export type LiveReportRow = {
  messageId: number
  mobileMasked: string
  messageText: string
  sendDateTime: number
  lineNumber: string | number
  cost: number
  deliveryState: number | null
  deliveryDateTime: number | null
}

export type ArchiveReportRow = LiveReportRow

const PROVIDER_REPORT_REASON = "SMS_IR_REPORT_ENDPOINT_NOT_CONFIGURED"

function sanitizeText(value: string | null | undefined, max = 500): string | null {
  if (!value) return null
  const trimmed = value.trim()
  if (trimmed.length > max) return trimmed.slice(0, max)
  return trimmed
}

function mapProviderDeliveryState(state: number | null | undefined): string | null {
  if (state === null || state === undefined) return "PROVIDER_UNKNOWN"
  if (state === 1) return "PROVIDER_DELIVERED"
  if (state === 2) return "PROVIDER_FAILED"
  if (state === 0) return "PROVIDER_PENDING"
  return "PROVIDER_UNKNOWN"
}

function computeReconciliationStatus(
  deliveryStatus: SmsDeliveryStatus,
  providerState: number | null | undefined,
  attemptStatus: NotificationDeliveryAttemptStatus | null,
): string | null {
  if (attemptStatus === "FAILED" && deliveryStatus === "SENT") {
    return "internal_mismatch_requires_provider_report"
  }

  const providerMapped = mapProviderDeliveryState(providerState)
  if (providerMapped === "PROVIDER_DELIVERED" && deliveryStatus === "SENT") {
    return "internal_aligned"
  }
  if (providerMapped === "PROVIDER_FAILED" && deliveryStatus === "FAILED") {
    return "internal_aligned"
  }
  if (providerMapped === "PROVIDER_PENDING" || providerMapped === "PROVIDER_UNKNOWN") {
    return "unknown"
  }

  return "unknown"
}

function findMatchingAttempt(delivery: {
  id: string
  externalMessageId: string | null
  createdAt: Date
  purpose: string
}, attempts: Array<{
  id: string
  purpose: string
  status: NotificationDeliveryAttemptStatus
  retryable: boolean
  retryCount: number
  lastErrorText: string | null
  providerMessageId: string | null
  createdAt: Date
}>): {
  status: NotificationDeliveryAttemptStatus | null
  retryable: boolean
  retryCount: number
  lastErrorText: string | null
  providerMessageId: string | null
  createdAt: string | null
} | null {
  if (delivery.externalMessageId) {
    const byMessageId = attempts.find((a) => a.providerMessageId === delivery.externalMessageId)
    if (byMessageId) {
      return {
        status: byMessageId.status,
        retryable: byMessageId.retryable,
        retryCount: byMessageId.retryCount,
        lastErrorText: byMessageId.lastErrorText,
        providerMessageId: byMessageId.providerMessageId,
        createdAt: byMessageId.createdAt.toISOString(),
      }
    }
  }

  const samePurpose = attempts.filter((a) => a.purpose === delivery.purpose)
  if (samePurpose.length === 0) return null
  if (samePurpose.length === 1) {
    const a = samePurpose[0]
    return {
      status: a.status,
      retryable: a.retryable,
      retryCount: a.retryCount,
      lastErrorText: a.lastErrorText,
      providerMessageId: a.providerMessageId,
      createdAt: a.createdAt.toISOString(),
    }
  }

  const closest = samePurpose.reduce((best, current) => {
    const bestDiff = Math.abs(best.createdAt.getTime() - delivery.createdAt.getTime())
    const currentDiff = Math.abs(current.createdAt.getTime() - delivery.createdAt.getTime())
    return currentDiff < bestDiff ? current : best
  })

  return {
    status: closest.status,
    retryable: closest.retryable,
    retryCount: closest.retryCount,
    lastErrorText: closest.lastErrorText,
    providerMessageId: closest.providerMessageId,
    createdAt: closest.createdAt.toISOString(),
  }
}

export class SmsDeliveryReportService {
  async getDeliveries(organizationId: string, filter: SmsDeliveryReportFilter = {}): Promise<SmsDeliveryReportRow[]> {
    const where: Record<string, unknown> = { organizationId }

    if (typeof filter.dryRun === "boolean") {
      where.dryRun = filter.dryRun
    }
    if (filter.status) {
      where.status = filter.status
    }
    if (filter.purpose) {
      where.purpose = { contains: filter.purpose, mode: "insensitive" }
    }
    if (filter.from || filter.to) {
      where.createdAt = {}
      if (filter.from) {
        ;(where.createdAt as Record<string, unknown>).gte = new Date(filter.from)
      }
      if (filter.to) {
        ;(where.createdAt as Record<string, unknown>).lte = new Date(filter.to)
      }
    }

    const rows = await prisma.smsDelivery.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true,
        phoneMasked: true,
        purpose: true,
        message: true,
        provider: true,
        dryRun: true,
        status: true,
        providerStatus: true,
        providerMessage: true,
        error: true,
        sentAt: true,
        createdAt: true,
        updatedAt: true,
        externalPackId: true,
        externalMessageId: true,
        actorUserId: true,
        customerId: true,
        actor: {
          select: { name: true },
        },
        customer: {
          select: { name: true },
        },
      },
    })

    const [actorNames, customerNames] = await Promise.all([
      prisma.user.findMany({
        where: { id: { in: rows.map((r) => r.actorUserId).filter(Boolean) } },
        select: { id: true, name: true },
      }),
      prisma.user.findMany({
        where: { id: { in: rows.map((r) => r.customerId).filter(Boolean) } },
        select: { id: true, name: true },
      }),
    ])

    const actorMap = new Map(actorNames.map((u) => [u.id, u.name]))
    const customerMap = new Map(customerNames.map((u) => [u.id, u.name]))

    const orgSmsAttempts = await prisma.notificationDeliveryAttempt.findMany({
      where: { organizationId, channel: "SMS" },
      select: {
        id: true,
        purpose: true,
        status: true,
        retryable: true,
        retryCount: true,
        lastErrorText: true,
        providerMessageId: true,
        createdAt: true,
      },
    })

    const client = createSmsIrClient()

    return rows.map((row) => {
      const attempt = findMatchingAttempt(row, orgSmsAttempts)
      const providerReportAvailable = client !== null
      return {
        id: row.id,
        phoneMasked: row.phoneMasked,
        purpose: row.purpose,
        message: sanitizeText(row.message, 200) ?? "",
        provider: row.provider,
        dryRun: row.dryRun,
        status: row.status,
        providerStatus: row.providerStatus,
        providerMessage: sanitizeText(row.providerMessage, 300),
        error: sanitizeText(row.error, 300),
        sentAt: row.sentAt?.toISOString() ?? null,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
        externalPackId: row.externalPackId,
        externalMessageId: row.externalMessageId,
        actorUserId: row.actorUserId,
        actorName: sanitizeText(actorMap.get(row.actorUserId || "") ?? null, 120),
        customerId: row.customerId,
        customerName: sanitizeText(customerMap.get(row.customerId || "") ?? null, 120),
        attemptStatus: attempt?.status ?? null,
        attemptRetryable: attempt?.retryable ?? false,
        attemptRetryCount: attempt?.retryCount ?? 0,
        attemptLastErrorText: sanitizeText(attempt?.lastErrorText ?? null, 300),
        attemptProviderMessageId: sanitizeText(attempt?.providerMessageId ?? null, 120),
        attemptCreatedAt: attempt?.createdAt ?? null,
        reconciliationStatus: null,
        reconciliationError: null,
        providerReportAvailable,
        providerDeliveryState: null,
        providerDeliveryDateTime: null,
        providerCost: null,
        providerLineNumber: null,
        providerMessageText: null,
        providerMobileMasked: null,
      }
    })
  }

  async getDeliveryDetail(organizationId: string, deliveryId: string): Promise<SmsDeliveryReportRow | null> {
    const row = await prisma.smsDelivery.findFirst({
      where: { id: deliveryId, organizationId },
      select: {
        id: true,
        phoneMasked: true,
        purpose: true,
        message: true,
        provider: true,
        dryRun: true,
        status: true,
        providerStatus: true,
        providerMessage: true,
        error: true,
        sentAt: true,
        createdAt: true,
        updatedAt: true,
        externalPackId: true,
        externalMessageId: true,
        actorUserId: true,
        customerId: true,
        actor: {
          select: { name: true },
        },
        customer: {
          select: { name: true },
        },
      },
    })

    if (!row) return null

    const actorName = row.actor?.name ?? null
    const customerName = row.customer?.name ?? null

    const attempts = await prisma.notificationDeliveryAttempt.findMany({
      where: { organizationId, channel: "SMS" },
      select: {
        id: true,
        purpose: true,
        status: true,
        dryRun: true,
        retryable: true,
        retryCount: true,
        nextRetryAt: true,
        lastErrorCode: true,
        lastErrorText: true,
        providerMessageId: true,
        metadata: true,
        createdAt: true,
      },
    })

    const matched = findMatchingAttempt(row, attempts)
    const client = createSmsIrClient()
    const hasProviderReport = Boolean(client && row.externalMessageId && !row.dryRun)

    let providerDeliveryState: number | null = null
    let providerDeliveryDateTime: string | null = null
    let providerCost: number | null = null
    let providerLineNumber: string | null = null
    let providerMessageText: string | null = null
    let providerMobileMasked: string | null = null

    if (hasProviderReport && client) {
      try {
        const messageId = Number(row.externalMessageId)
        if (Number.isFinite(messageId)) {
          const report = await client.getMessageReport(messageId)
          if (report) {
            providerDeliveryState = report.deliveryState
            providerDeliveryDateTime = report.deliveryDateTime ? new Date(report.deliveryDateTime * 1000).toISOString() : null
            providerCost = report.cost
            providerLineNumber = String(report.lineNumber ?? "")
            providerMessageText = sanitizeText(report.messageText, 200) ?? null
            providerMobileMasked = maskMobile(report.mobile)
          }
        }
      } catch {
        // provider report fetch failed; keep nulls
      }
    }

    const reconciliationStatus = computeReconciliationStatus(row.status, providerDeliveryState, matched?.status ?? null)

    return {
      id: row.id,
      phoneMasked: row.phoneMasked,
      purpose: row.purpose,
      message: sanitizeText(row.message, 200) ?? "",
      provider: row.provider,
      dryRun: row.dryRun,
      status: row.status,
      providerStatus: row.providerStatus,
      providerMessage: sanitizeText(row.providerMessage, 300),
      error: sanitizeText(row.error, 300),
      sentAt: row.sentAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      externalPackId: row.externalPackId,
      externalMessageId: row.externalMessageId,
      actorUserId: row.actorUserId,
      actorName: sanitizeText(actorName, 120),
      customerId: row.customerId,
      customerName: sanitizeText(customerName, 120),
      attemptStatus: matched?.status ?? null,
      attemptRetryable: matched?.retryable ?? false,
      attemptRetryCount: matched?.retryCount ?? 0,
      attemptLastErrorText: sanitizeText(matched?.lastErrorText ?? null, 300),
      attemptProviderMessageId: sanitizeText(matched?.providerMessageId ?? null, 120),
      attemptCreatedAt: matched?.createdAt ?? null,
      reconciliationStatus,
      reconciliationError: null,
      providerReportAvailable: hasProviderReport,
      providerDeliveryState,
      providerDeliveryDateTime,
      providerCost,
      providerLineNumber: providerLineNumber || null,
      providerMessageText,
      providerMobileMasked,
    }
  }

  async reconcileFromInternalState(organizationId: string, deliveryId: string): Promise<ReconcileResult> {
    const delivery = await prisma.smsDelivery.findFirst({
      where: { id: deliveryId, organizationId },
      select: {
        id: true,
        status: true,
        dryRun: true,
        providerStatus: true,
        sentAt: true,
        error: true,
        externalMessageId: true,
        createdAt: true,
        purpose: true,
      },
    })

    if (!delivery) {
      return {
        ok: false,
        providerReportAvailable: false,
        reason: "SMS delivery not found",
        deliveryId,
        reconciliationStatus: "not_found",
        previousStatus: null,
        updatedStatus: null,
      }
    }

    const previousStatus = delivery.status

    if (delivery.dryRun) {
      return {
        ok: true,
        providerReportAvailable: false,
        reason: "Dry-run delivery does not require provider reconciliation",
        deliveryId,
        reconciliationStatus: "dry_run_skipped",
        previousStatus,
        updatedStatus: previousStatus,
      }
    }

    const attempts = await prisma.notificationDeliveryAttempt.findMany({
      where: { organizationId, channel: "SMS" },
      select: {
        id: true,
        purpose: true,
        status: true,
        retryable: true,
        retryCount: true,
        lastErrorText: true,
        providerMessageId: true,
        createdAt: true,
      },
    })

    const attempt = findMatchingAttempt(delivery, attempts)

    if (!attempt) {
      return {
        ok: true,
        providerReportAvailable: false,
        reason: "No SMS delivery attempt recorded yet",
        deliveryId,
        reconciliationStatus: "pending_attempt",
        previousStatus,
        updatedStatus: previousStatus,
      }
    }

    const client = createSmsIrClient()
    if (!client || !delivery.externalMessageId) {
      return {
        ok: true,
        providerReportAvailable: false,
        reason: PROVIDER_REPORT_REASON,
        deliveryId,
        reconciliationStatus: "provider_report_unavailable",
        previousStatus,
        updatedStatus: previousStatus,
      }
    }

    try {
      const messageId = Number(delivery.externalMessageId)
      if (!Number.isFinite(messageId)) {
        throw new Error("Invalid externalMessageId")
      }

      const report = await client.getMessageReport(messageId)
      if (!report) {
        throw new Error("Empty provider report")
      }

      const safeMobile = maskMobile(report.mobile)
      const providerMessage = sanitizeText(report.messageText, 200) ?? null

      await prisma.smsDelivery.update({
        where: { id: delivery.id },
        data: {
          providerStatus: report.deliveryState,
          providerMessage: `deliveryState=${report.deliveryState}${providerMessage ? `; ${providerMessage}` : ""}`,
        },
      })

      const reconciliationStatus = computeReconciliationStatus(delivery.status, report.deliveryState, attempt.status)

      return {
        ok: true,
        providerReportAvailable: true,
        reason: null,
        deliveryId,
        reconciliationStatus,
        previousStatus,
        updatedStatus: previousStatus,
      }
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Provider report fetch failed"
      await prisma.smsDelivery.update({
        where: { id: delivery.id },
        data: {
          error: `Provider report reconciliation failed: ${sanitizeText(reason, 300) ?? "unknown"}`,
        },
      })

      return {
        ok: true,
        providerReportAvailable: true,
        reason,
        deliveryId,
        reconciliationStatus: "provider_report_error",
        previousStatus,
        updatedStatus: previousStatus,
      }
    }
  }

  async reconcileFromProviderReport(organizationId: string, deliveryId: string): Promise<ReconcileResult> {
    const delivery = await prisma.smsDelivery.findFirst({
      where: { id: deliveryId, organizationId },
      select: {
        id: true,
        status: true,
        dryRun: true,
        providerStatus: true,
        error: true,
        externalMessageId: true,
      },
    })

    if (!delivery) {
      return {
        ok: false,
        providerReportAvailable: false,
        reason: "SMS delivery not found",
        deliveryId,
        reconciliationStatus: "not_found",
        previousStatus: null,
        updatedStatus: null,
      }
    }

    const previousStatus = delivery.status

    if (delivery.dryRun) {
      return {
        ok: true,
        providerReportAvailable: false,
        reason: "Dry-run delivery does not require provider reconciliation",
        deliveryId,
        reconciliationStatus: "dry_run_skipped",
        previousStatus,
        updatedStatus: previousStatus,
      }
    }

    const client = createSmsIrClient()
    if (!client || !delivery.externalMessageId) {
      return {
        ok: true,
        providerReportAvailable: false,
        reason: PROVIDER_REPORT_REASON,
        deliveryId,
        reconciliationStatus: "provider_report_unavailable",
        previousStatus,
        updatedStatus: previousStatus,
      }
    }

    try {
      const messageId = Number(delivery.externalMessageId)
      if (!Number.isFinite(messageId)) {
        throw new Error("Invalid externalMessageId")
      }

      const report = await client.getMessageReport(messageId)
      if (!report) {
        throw new Error("Empty provider report")
      }

      const safeMobile = maskMobile(report.mobile)
      const providerMessage = sanitizeText(report.messageText, 200) ?? null

      await prisma.smsDelivery.update({
        where: { id: delivery.id },
        data: {
          providerStatus: report.deliveryState,
          providerMessage: `deliveryState=${report.deliveryState}${providerMessage ? `; ${providerMessage}` : ""}`,
        },
      })

      return {
        ok: true,
        providerReportAvailable: true,
        reason: null,
        deliveryId,
        reconciliationStatus: "provider_report_updated",
        previousStatus,
        updatedStatus: previousStatus,
      }
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Provider report fetch failed"
      await prisma.smsDelivery.update({
        where: { id: delivery.id },
        data: {
          error: `Provider report reconciliation failed: ${sanitizeText(reason, 300) ?? "unknown"}`,
        },
      })

      return {
        ok: true,
        providerReportAvailable: true,
        reason,
        deliveryId,
        reconciliationStatus: "provider_report_error",
        previousStatus,
        updatedStatus: previousStatus,
      }
    }
  }

  async markProviderReportUnavailable(organizationId: string, deliveryId: string, reason = PROVIDER_REPORT_REASON): Promise<ReconcileResult> {
    const current = await prisma.smsDelivery.findFirst({
      where: { id: deliveryId, organizationId },
      select: { id: true, status: true },
    })

    if (!current) {
      return {
        ok: false,
        providerReportAvailable: false,
        reason: "SMS delivery not found",
        deliveryId,
        reconciliationStatus: "not_found",
        previousStatus: null,
        updatedStatus: null,
      }
    }

    return {
      ok: true,
      providerReportAvailable: false,
      reason,
      deliveryId,
      reconciliationStatus: "provider_report_unavailable",
      previousStatus: current.status,
      updatedStatus: current.status,
    }
  }

  async fetchProviderReportByPackId(packId: string): Promise<{ ok: boolean; data?: SmsIrPackMessage[]; reason?: string }> {
    const validationError = validatePackId(packId)
    if (validationError) {
      return { ok: false, reason: validationError.message }
    }

    const client = createSmsIrClient()
    if (!client) {
      return { ok: false, reason: PROVIDER_REPORT_REASON }
    }

    try {
      const data = await client.getPackReport(packId)
      return { ok: true, data }
    } catch (error) {
      return { ok: false, reason: error instanceof Error ? error.message : "Failed to fetch pack report" }
    }
  }

  async fetchProviderReportByMessageId(messageId: string | number): Promise<{ ok: boolean; data?: SmsIrMessageReport; reason?: string }> {
    const validationError = validateMessageId(messageId)
    if (validationError) {
      return { ok: false, reason: validationError.message }
    }

    const client = createSmsIrClient()
    if (!client) {
      return { ok: false, reason: PROVIDER_REPORT_REASON }
    }

    try {
      const data = await client.getMessageReport(messageId)
      if (!data) {
        return { ok: false, reason: "Empty provider report" }
      }
      return { ok: true, data }
    } catch (error) {
      return { ok: false, reason: error instanceof Error ? error.message : "Failed to fetch message report" }
    }
  }

  async getLiveReports(input?: { pageSize?: number; pageNumber?: number }): Promise<{ ok: boolean; data?: LiveReportRow[]; reason?: string }> {
    const client = createSmsIrClient()
    if (!client) {
      return { ok: false, reason: PROVIDER_REPORT_REASON }
    }

    try {
      const paginationError = validatePagination({ pageSize: input?.pageSize, pageNumber: input?.pageNumber })
      if (paginationError) {
        return { ok: false, reason: paginationError.message }
      }

      const data = await client.getLiveSendReport(input)
      const sanitized = data.map((row) => ({
        messageId: row.messageId,
        mobileMasked: maskMobile(row.mobile),
        messageText: sanitizeText(row.messageText, 200) ?? "",
        sendDateTime: row.sendDateTime,
        lineNumber: String(row.lineNumber ?? ""),
        cost: row.cost,
        deliveryState: row.deliveryState,
        deliveryDateTime: row.deliveryDateTime,
      }))

      return { ok: true, data: sanitized }
    } catch (error) {
      return { ok: false, reason: error instanceof Error ? error.message : "Failed to fetch live reports" }
    }
  }

  async getArchiveReports(input?: { fromDate?: number; toDate?: number; pageSize?: number; pageNumber?: number }): Promise<{ ok: boolean; data?: ArchiveReportRow[]; reason?: string }> {
    const client = createSmsIrClient()
    if (!client) {
      return { ok: false, reason: PROVIDER_REPORT_REASON }
    }

    try {
      const archiveError = validateArchiveInput({
        fromDate: input?.fromDate,
        toDate: input?.toDate,
        pageSize: input?.pageSize,
        pageNumber: input?.pageNumber,
      })
      if (archiveError) {
        return { ok: false, reason: archiveError.message }
      }

      const data = await client.getArchiveSendReport(input)
      const sanitized = data.map((row) => ({
        messageId: row.messageId,
        mobileMasked: maskMobile(row.mobile),
        messageText: sanitizeText(row.messageText, 200) ?? "",
        sendDateTime: row.sendDateTime,
        lineNumber: String(row.lineNumber ?? ""),
        cost: row.cost,
        deliveryState: row.deliveryState,
        deliveryDateTime: row.deliveryDateTime,
      }))

      return { ok: true, data: sanitized }
    } catch (error) {
      return { ok: false, reason: error instanceof Error ? error.message : "Failed to fetch archive reports" }
    }
  }
}

export const smsDeliveryReportService = new SmsDeliveryReportService()
