export function normalizeIranianMobile(value: string | null | undefined): string | null {
  if (!value) return null
  const digits = value.trim().replace(/[\s-]/g, "")
  if (digits.startsWith("+98")) {
    const local = digits.slice(3)
    if (/^9\d{9}$/.test(local)) return `0${local}`
  } else if (digits.startsWith("0098")) {
    const local = digits.slice(4)
    if (/^9\d{9}$/.test(local)) return `0${local}`
  } else if (/^9\d{9}$/.test(digits)) {
    return digits
  } else if (/^\d{10}$/.test(digits) && digits.startsWith("9")) {
    return digits
  }
  return null
}

export function maskPhoneNumber(value: string) {
  const digits = value.replace(/\D/g, "")
  if (digits.length <= 4) return "****"
  const prefix = digits.slice(0, Math.min(4, digits.length - 4))
  const suffix = digits.slice(-3)
  return `${prefix}${"*".repeat(Math.max(digits.length - prefix.length - suffix.length, 4))}${suffix}`
}

export function validateRecipientCount(mobiles: string[], max = 100): { valid: string[]; invalid: string[] } {
  if (mobiles.length > max) {
    return { valid: [], invalid: mobiles }
  }
  return { valid: mobiles, invalid: [] }
}
