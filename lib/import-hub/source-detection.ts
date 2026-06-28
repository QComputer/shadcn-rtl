import type { ExternalImportSourceType } from "@prisma/client"

export function normalizeImportUrl(input: string | null | undefined) {
  const value = input?.trim()
  if (!value) return null

  try {
    const url = new URL(value)
    url.hash = ""
    url.hostname = url.hostname.toLowerCase().replace(/^www\./, "")
    return url.toString().replace(/\/$/, "")
  } catch {
    return value.toLowerCase()
  }
}

export function detectImportSourceType(input: {
  url?: string | null
  text?: string | null
  filename?: string | null
  fallback?: ExternalImportSourceType | null
}): ExternalImportSourceType {
  if (input.fallback && input.fallback !== "UNKNOWN") return input.fallback

  const url = normalizeImportUrl(input.url)
  const filename = input.filename?.trim().toLowerCase() ?? ""
  const text = input.text?.trim() ?? ""
  const haystack = `${url ?? ""} ${filename} ${text.slice(0, 400)}`.toLowerCase()

  if (/instagram\.com|instagr\.am/.test(haystack)) return "INSTAGRAM"
  if (/t\.me\/|telegram\.me|telegram\.org/.test(haystack)) return "TELEGRAM"
  if (/snappfood\.ir|snapp\.food/.test(haystack)) return "SNAP_FOOD"
  if (/snapp\.market|snappmarket\.ir/.test(haystack)) return "SNAP_MARKET"
  if (/\.(csv)(\?|$)/.test(haystack) || filename.endsWith(".csv")) return "CSV"
  if (/\.(xlsx|xls)(\?|$)/.test(haystack) || /\.(xlsx|xls)$/.test(filename)) return "EXCEL"
  if (/\.(pdf)(\?|$)/.test(haystack) || filename.endsWith(".pdf")) return "PDF"
  if (/\.(png|jpe?g|webp|gif)(\?|$)/.test(haystack) || /\.(png|jpe?g|webp|gif)$/.test(filename)) return "IMAGE_MENU"
  if (url) return "MANUAL_URL"
  if (text) return "MANUAL_TEXT"

  return "UNKNOWN"
}

export function isThirdPartyUrlSource(type: ExternalImportSourceType) {
  return ["INSTAGRAM", "TELEGRAM", "SNAP_FOOD", "SNAP_MARKET", "MANUAL_URL"].includes(type)
}
