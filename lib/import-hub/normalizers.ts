import type { ExternalImportSourceType } from "@prisma/client"

export function getImportSourceLabel(type: ExternalImportSourceType) {
  const labels: Record<ExternalImportSourceType, string> = {
    INSTAGRAM: "Instagram",
    TELEGRAM: "Telegram",
    SNAP_FOOD: "Snappfood",
    SNAP_MARKET: "Snappmarket",
    CSV: "CSV",
    EXCEL: "Excel",
    PDF: "PDF",
    IMAGE_MENU: "Image menu",
    MANUAL_URL: "Manual URL",
    MANUAL_TEXT: "Manual text",
    UNKNOWN: "Unknown source",
  }

  return labels[type] ?? labels.UNKNOWN
}

export function normalizeImportText(input: string | null | undefined) {
  const value = input?.trim()
  if (!value) return null
  return value.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").slice(0, 12000)
}

export function normalizeImportFilename(input: string | null | undefined) {
  const value = input?.trim()
  if (!value) return null
  return value.replace(/[^\p{L}\p{N}._ -]/gu, "").slice(0, 180) || null
}
