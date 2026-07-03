export function validateSchedule(sendDateTime: number | null | undefined): { ok: boolean; error?: string } {
  if (sendDateTime == null || sendDateTime === undefined) return { ok: true }
  if (!Number.isFinite(sendDateTime) || !Number.isInteger(sendDateTime)) {
    return { ok: false, error: "sendDateTime must be a valid Unix timestamp" }
  }
  const now = Date.now()
  const oneHour = 60 * 60 * 1000
  const oneYear = 365 * 24 * 60 * 60 * 1000
  const diff = sendDateTime - now
  if (diff < oneHour) {
    return { ok: false, error: "sendDateTime must be at least 1 hour in the future" }
  }
  if (diff > oneYear) {
    return { ok: false, error: "sendDateTime must be at most 365 days in the future" }
  }
  return { ok: true }
}

export function validateLikeToLikeLengths(mobiles: string[], messageTexts: string[]): { ok: boolean; error?: string } {
  if (mobiles.length !== messageTexts.length) {
    return { ok: false, error: "messageTexts length must equal mobiles length for likeToLike send" }
  }
  return { ok: true }
}
