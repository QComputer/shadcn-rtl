import { prisma } from "@/lib/db"
import type { NotificationDeliveryAttemptStatus } from "@prisma/client"

type RecordAttemptInput = {
  organizationId: string
  targetUserId?: string | null
  orderId?: string | null
  guestCustomerId?: string | null
  notificationId?: string | null
  channel: "IN_APP" | "WEB_PUSH" | "SMS"
  purpose: string
  status: NotificationDeliveryAttemptStatus
  dryRun?: boolean
  retryable?: boolean
  retryCount?: number
  nextRetryAt?: Date | null
  lastErrorCode?: string | null
  lastErrorText?: string | null
  providerMessageId?: string | null
  metadata?: Record<string, unknown> | null
  actorUserId?: string | null
}

function sanitizeText(value: string | null | undefined, max = 500): string | null {
  if (!value) return null
  const trimmed = value.trim()
  if (trimmed.length > max) return trimmed.slice(0, max)
  return trimmed
}

function sanitizeMetadata(input: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
  if (!input) return null
  const safe: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(input)) {
    if (typeof value === "string") {
      safe[key] = sanitizeText(value, 200) ?? ""
    } else if (typeof value === "number" || typeof value === "boolean") {
      safe[key] = value
    } else if (value === null) {
      safe[key] = null
    }
  }
  return safe
}

export class DeliveryAttemptRecorder {
  async record(input: RecordAttemptInput) {
    try {
      await prisma.notificationDeliveryAttempt.create({
        data: {
          organizationId: input.organizationId,
          targetUserId: input.targetUserId || null,
          orderId: input.orderId || null,
          guestCustomerId: input.guestCustomerId || null,
          notificationId: input.notificationId || null,
          channel: input.channel,
          purpose: sanitizeText(input.purpose, 120) || input.purpose,
          status: input.status,
          dryRun: input.dryRun ?? false,
          retryable: input.retryable ?? false,
          retryCount: input.retryCount ?? 0,
          nextRetryAt: input.nextRetryAt || null,
          lastErrorCode: sanitizeText(input.lastErrorCode, 80),
          lastErrorText: sanitizeText(input.lastErrorText, 500),
          providerMessageId: sanitizeText(input.providerMessageId, 120),
          metadata: sanitizeMetadata(input.metadata) as never,
        },
        select: { id: true },
      })
    } catch (error) {
      console.error("[delivery-attempt-recorder] failed to record attempt", error instanceof Error ? error.message : String(error))
    }
  }
}

export const deliveryAttemptRecorder = new DeliveryAttemptRecorder()
