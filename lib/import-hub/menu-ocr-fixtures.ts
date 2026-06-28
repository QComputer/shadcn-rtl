export type ParsedMenuFixtureDraft = {
  rowNumber: number
  name: string | null
  description: string | null
  sku: string | null
  categoryName: string | null
  basePrice: string | null
  stock: number | null
  imageUrl: string | null
  sourceUrl: string | null
  sourceMetadata: {
    type: "DRY_RUN_MENU_OCR_FIXTURE"
    mediaType: "PDF" | "IMAGE_MENU"
    filename: string | null
    sourceUrl: string | null
    confidence: number
    dryRun: true
    realOcrEnabled: false
  }
  rawData: {
    fixture: string
    line: string
  }
  warnings: string[]
  errors: string[]
}

export function realMenuOcrEnabled() {
  return false
}

export function parseMenuOcrFixture(input: {
  type: "PDF" | "IMAGE_MENU"
  filename?: string | null
  sourceUrl?: string | null
}): ParsedMenuFixtureDraft[] {
  const filename = input.filename?.trim() || null
  const sourceUrl = input.sourceUrl?.trim() || null
  const fixtureRows = input.type === "PDF"
    ? [
        { name: "نمونه آیتم منو از PDF", categoryName: "منوی وارداتی", basePrice: "120000.00" },
        { name: "نمونه نوشیدنی از PDF", categoryName: "نوشیدنی", basePrice: "85000.00" },
      ]
    : [
        { name: "نمونه آیتم منوی تصویری", categoryName: "منوی تصویری", basePrice: "120000.00" },
        { name: "نمونه پیشنهاد تصویری", categoryName: "پیشنهاد روز", basePrice: "95000.00" },
      ]

  return fixtureRows.map((row, index) => ({
    rowNumber: index + 1,
    name: row.name,
    description: `Dry-run OCR fixture for ${filename ?? sourceUrl ?? input.type}`,
    sku: null,
    categoryName: row.categoryName,
    basePrice: row.basePrice,
    stock: null,
    imageUrl: input.type === "IMAGE_MENU" ? sourceUrl : null,
    sourceUrl,
    sourceMetadata: {
      type: "DRY_RUN_MENU_OCR_FIXTURE",
      mediaType: input.type,
      filename,
      sourceUrl,
      confidence: 0.5,
      dryRun: true,
      realOcrEnabled: false,
    },
    rawData: {
      fixture: "dry-run-menu-ocr",
      line: `${row.name} - ${row.basePrice}`,
    },
    warnings: ["Dry-run OCR fixture only; real OCR is disabled."],
    errors: [],
  }))
}
