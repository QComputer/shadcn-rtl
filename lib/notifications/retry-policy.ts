import type { NotificationDeliveryAttemptStatus } from "@prisma/client"

export type RetryPolicy = {
  maxRetryCount: number
  backoffMs: number[]
  retryableChannels: readonly ("WEB_PUSH" | "SMS")[]
  retryablePurposes: readonly string[]
  allowGuestRetry: boolean
}

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxRetryCount: 3,
  backoffMs: [5 * 60 * 1000, 30 * 60 * 1000, 2 * 60 * 60 * 1000],
  retryableChannels: ["WEB_PUSH", "SMS"],
  retryablePurposes: [
    "ORDER_CREATED_STAFF",
    "ORDER_STATUS_CUSTOMER",
    "PAYMENT_STATUS_CUSTOMER",
    "GUEST_ORDER_STATUS_SMS_DRY_RUN",
    "GUEST_PAYMENT_STATUS_SMS_DRY_RUN",
  ],
  allowGuestRetry: false,
}

export type RetryEligibility = {
  retryable: boolean
  nextRetryAt: Date | null
  retryCount: number
  reason?: string
}

export function computeRetryEligibility(input: {
  status: NotificationDeliveryAttemptStatus
  channel: string
  purpose: string
  dryRun: boolean
  guestCustomerId?: string | null
  retryCount: number
  policy?: RetryPolicy
}): RetryEligibility {
  const policy = input.policy || DEFAULT_RETRY_POLICY

  if (input.dryRun) {
    return { retryable: false, nextRetryAt: null, retryCount: input.retryCount, reason: "dry_run" }
  }

  if (!policy.retryableChannels.includes(input.channel as RetryPolicy["retryableChannels"][number])) {
    return { retryable: false, nextRetryAt: null, retryCount: input.retryCount, reason: "channel_not_retryable" }
  }

  if (input.channel === "IN_APP") {
    return { retryable: false, nextRetryAt: null, retryCount: input.retryCount, reason: "in_app_not_retried" }
  }

  if (!policy.retryablePurposes.includes(input.purpose)) {
    return { retryable: false, nextRetryAt: null, retryCount: input.retryCount, reason: "purpose_not_retryable" }
  }

  if (!policy.allowGuestRetry && input.guestCustomerId) {
    return { retryable: false, nextRetryAt: null, retryCount: input.retryCount, reason: "guest_retry_disabled" }
  }

  if (input.retryCount >= policy.maxRetryCount) {
    return { retryable: false, nextRetryAt: null, retryCount: input.retryCount, reason: "retry_exhausted" }
  }

  const backoffIndex = Math.min(input.retryCount, policy.backoffMs.length - 1)
  const nextRetryAt = new Date(Date.now() + policy.backoffMs[backoffIndex])

  return { retryable: true, nextRetryAt, retryCount: input.retryCount }
}

export function formatRetryBackoff(ms: number): string {
  const minutes = Math.floor(ms / (1000 * 60))
  if (minutes < 60) return `${minutes} دقیقه`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} ساعت`
  const days = Math.floor(hours / 24)
  return `${days} روز`
}
