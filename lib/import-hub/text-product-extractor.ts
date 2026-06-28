export type ParsedTextProductDraft = {
  rowNumber: number
  lineNumber: number
  name: string | null
  description: string | null
  sku: string | null
  categoryName: string | null
  basePrice: string | null
  stock: number | null
  imageUrl: null
  sourceUrl: null
  sourceMetadata: {
    type: "RULE_BASED_TEXT_PRODUCT_EXTRACTOR"
    provider: "local-rule-based"
    confidence: number
    lineNumber: number
    dryRun: true
  }
  rawData: {
    line: string
  }
  warnings: string[]
  errors: string[]
}

const digitMap: Record<string, string> = {
  "۰": "0",
  "۱": "1",
  "۲": "2",
  "۳": "3",
  "۴": "4",
  "۵": "5",
  "۶": "6",
  "۷": "7",
  "۸": "8",
  "۹": "9",
  "٠": "0",
  "١": "1",
  "٢": "2",
  "٣": "3",
  "٤": "4",
  "٥": "5",
  "٦": "6",
  "٧": "7",
  "٨": "8",
  "٩": "9",
}

export function parseProductText(input: {
  text?: string | null
  maxLines?: number
}): ParsedTextProductDraft[] {
  const maxLines = Math.min(Math.max(input.maxLines ?? 200, 1), 500)
  return (input.text ?? "")
    .split(/\r?\n/)
    .map((line, index) => ({ line: line.trim(), lineNumber: index + 1 }))
    .filter(({ line }) => line.length > 0)
    .slice(0, maxLines)
    .map(({ line, lineNumber }) => parseProductLine(line, lineNumber))
    .filter((draft) => draft.name || draft.basePrice || draft.rawData.line.length > 0)
}

function parseProductLine(line: string, lineNumber: number): ParsedTextProductDraft {
  const normalizedLine = normalizeDigits(line)
  const basePrice = extractPrice(normalizedLine)
  const stock = extractStock(normalizedLine)
  const categoryName = extractField(normalizedLine, /(دسته|گروه|category)\s*[:：]\s*([^|،,\-]+)/i)
  const sku = extractField(normalizedLine, /(sku|کد|شناسه)\s*[:：]\s*([\p{L}\p{N}._-]+)/iu)
  const name = extractName(normalizedLine, basePrice)
  const confidence = calculateConfidence({ name, basePrice, stock, categoryName, sku })
  const warnings: string[] = []
  const errors: string[] = []

  if (!name) errors.push("Missing product name")
  if (!basePrice) warnings.push("Missing or uncertain price")
  if (confidence < 0.6) warnings.push("Low extraction confidence")

  return {
    rowNumber: lineNumber,
    lineNumber,
    name,
    description: line,
    sku,
    categoryName,
    basePrice,
    stock,
    imageUrl: null,
    sourceUrl: null,
    sourceMetadata: {
      type: "RULE_BASED_TEXT_PRODUCT_EXTRACTOR",
      provider: "local-rule-based",
      confidence,
      lineNumber,
      dryRun: true,
    },
    rawData: { line },
    warnings,
    errors,
  }
}

function normalizeDigits(value: string) {
  return value.replace(/[۰-۹٠-٩]/g, (digit) => digitMap[digit] ?? digit)
}

function extractPrice(line: string) {
  const currencyMatch = line.match(/(?:قیمت|قيمت|price)?\s*[:：]?\s*([0-9][0-9,.\s]{2,})\s*(?:تومان|ريال|ریال|rial|irr|toman)?/i)
  if (!currencyMatch?.[1]) return null
  const numeric = currencyMatch[1].replace(/[^\d.]/g, "")
  if (!numeric) return null
  const parsed = Number(numeric)
  return Number.isFinite(parsed) && parsed > 0 ? parsed.toFixed(2) : null
}

function extractStock(line: string) {
  const match = line.match(/(?:موجودی|تعداد|stock|qty|quantity)\s*[:：]?\s*([0-9]+)/i)
  if (!match?.[1]) return null
  const parsed = Number(match[1])
  return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : null
}

function extractField(line: string, pattern: RegExp) {
  const match = line.match(pattern)
  return match?.[2]?.trim() || null
}

function extractName(line: string, basePrice: string | null) {
  let value = line
    .replace(/(?:موجودی|تعداد|stock|qty|quantity)\s*[:：]?\s*[0-9]+/gi, "")
    .replace(/(?:دسته|گروه|category)\s*[:：]\s*[^|،,\-]+/gi, "")
    .replace(/(?:sku|کد|شناسه)\s*[:：]\s*[\p{L}\p{N}._-]+/giu, "")
    .replace(/(?:قیمت|قيمت|price)\s*[:：]?/gi, "")
    .trim()

  if (basePrice) {
    const priceInteger = Number(basePrice).toFixed(0)
    value = value.replace(new RegExp(`[\\s,.-]*${priceInteger}[\\d,.\u00a0\\s]*(?:تومان|ريال|ریال|rial|irr|toman)?`, "i"), "")
  }

  value = value
    .split(/[|،]/)[0]
    .replace(/[-:：]+$/g, "")
    .trim()

  return value.length >= 2 ? value.slice(0, 180) : null
}

function calculateConfidence(input: {
  name: string | null
  basePrice: string | null
  stock: number | null
  categoryName: string | null
  sku: string | null
}) {
  let score = 0
  if (input.name) score += 0.45
  if (input.basePrice) score += 0.35
  if (input.stock != null) score += 0.08
  if (input.categoryName) score += 0.07
  if (input.sku) score += 0.05
  return Number(Math.min(score, 0.95).toFixed(2))
}
