export type ParsedSnappmarketProductDraft = {
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
    type: "SNAPPMARKET_URL_FALLBACK"
    sourceUrl: string
    publicFetchEnabled: false
    fallback: "manual-review-fixture"
    confidence: number
  }
  rawData: {
    sourceUrl: string
    fixture: string
    line: string
  }
  warnings: string[]
  errors: string[]
}

export function snappmarketPublicFetchEnabled() {
  return false
}

export function isSnappmarketUrl(sourceUrl: string | null | undefined) {
  return Boolean(sourceUrl && /(^https?:\/\/)?([^/]+\.)?(snapp\.market|snappmarket\.ir)(\/|$)/i.test(sourceUrl))
}

export function parseSnappmarketUrlFixture(input: {
  sourceUrl: string
}): ParsedSnappmarketProductDraft[] {
  const sourceUrl = input.sourceUrl.trim()
  const rows = [
    { name: "نمونه کالای اسنپ‌مارکت", categoryName: "وارداتی از اسنپ‌مارکت", basePrice: "180000.00" },
    { name: "نمونه پیشنهاد سوپرمارکتی", categoryName: "پیشنهاد روز", basePrice: "135000.00" },
  ]

  return rows.map((row, index) => ({
    rowNumber: index + 1,
    name: row.name,
    description: `Snappmarket one-time URL intake fallback for ${sourceUrl}`,
    sku: null,
    categoryName: row.categoryName,
    basePrice: row.basePrice,
    stock: null,
    imageUrl: null,
    sourceUrl,
    sourceMetadata: {
      type: "SNAPPMARKET_URL_FALLBACK",
      sourceUrl,
      publicFetchEnabled: false,
      fallback: "manual-review-fixture",
      confidence: 0.4,
    },
    rawData: {
      sourceUrl,
      fixture: "snappmarket-url-fallback",
      line: `${row.name} - ${row.basePrice}`,
    },
    warnings: [
      "Snappmarket public fetch is disabled; review this fallback draft manually or use CSV/manual import.",
    ],
    errors: [],
  }))
}
