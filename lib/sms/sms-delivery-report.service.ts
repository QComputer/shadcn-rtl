import { prisma } from "@/lib/db"
import type { SmsDeliveryStatus, NotificationDeliveryAttemptStatus } from "@prisma/client"

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

const PROVIDER_REPORT_REASON = "SMS_IR_REPORT_ENDPOINT_NOT_CONFIGURED"

function sanitizeText(value: string | null | undefined, max = 500): string | null {
  if (!value) return null
  const trimmed = value.trim()
  if (trimmed.length > max) return trimmed.slice(0, max)
  return trimmed
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

    return rows.map((row) => {
      const attempt = findMatchingAttempt(row, orgSmsAttempts)
      const providerReportAvailable = false
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
      attemptStatus: null,
      attemptRetryable: false,
      attemptRetryCount: 0,
      attemptLastErrorText: null,
      attemptProviderMessageId: null,
      attemptCreatedAt: null,
      reconciliationStatus: null,
      reconciliationError: null,
      providerReportAvailable: false,
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

    const deliverySent = delivery.status === "SENT"
    const attemptSent = attempt.status === "SENT" || attempt.status === "DRY_RUN"
    const attemptFailed = attempt.status === "FAILED"
    const bothSent = deliverySent && attemptSent
    const bothFailed = delivery.status === "FAILED" && attemptFailed

    if (bothSent || bothFailed) {
      return {
        ok: true,
        providerReportAvailable: false,
        reason: PROVIDER_REPORT_REASON,
        deliveryId,
        reconciliationStatus: "internal_aligned",
        previousStatus,
        updatedStatus: previousStatus,
      }
    }

    if (attemptFailed && deliverySent) {
      return {
        ok: true,
        providerReportAvailable: false,
        reason: PROVIDER_REPORT_REASON,
        deliveryId,
        reconciliationStatus: "internal_mismatch_requires_provider_report",
        previousStatus,
        updatedStatus: previousStatus,
      }
    }

    return {
      ok: true,
      providerReportAvailable: false,
      reason: PROVIDER_REPORT_REASON,
      deliveryId,
      reconciliationStatus: "unknown",
      previousStatus,
      updatedStatus: previousStatus,
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

  async fetchProviderReportByPackId(_packId: string): Promise<ReconcileResult> {
    return {
      ok: false,
      providerReportAvailable: false,
      reason: PROVIDER_REPORT_REASON,
      deliveryId: "",
      reconciliationStatus: "not_configured",
      previousStatus: null,
      updatedStatus: null,
    }
  }

  async fetchProviderReportByMessageId(_messageId: string): Promise<ReconcileResult> {
    return {
      ok: false,
      providerReportAvailable: false,
      reason: PROVIDER_REPORT_REASON,
      deliveryId: "",
      reconciliationStatus: "not_configured",
      previousStatus: null,
      updatedStatus: null,
    }
  }

  async reconcileFromProviderReport(_organizationId: string, deliveryId: string): Promise<ReconcileResult> {
    return {
      ok: false,
      providerReportAvailable: false,
      reason: PROVIDER_REPORT_REASON,
      deliveryId,
      reconciliationStatus: "not_configured",
      previousStatus: null,
      updatedStatus: null,
    }
  }
}

export const smsDeliveryReportService = new SmsDeliveryReportService()
