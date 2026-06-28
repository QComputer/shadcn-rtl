export type ParsedSnappfoodProductDraft = {
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
    type: "SNAPPFOOD_URL_FALLBACK"
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

export function snappfoodPublicFetchEnabled() {
  return false
}

export function isSnappfoodUrl(sourceUrl: string | null | undefined) {
  return Boolean(sourceUrl && /(^https?:\/\/)?([^/]+\.)?snappfood\.ir(\/|$)/i.test(sourceUrl))
}

export function parseSnappfoodUrlFixture(input: {
  sourceUrl: string
}): ParsedSnappfoodProductDraft[] {
  const sourceUrl = input.sourceUrl.trim()
  const rows = [
    { name: "نمونه آیتم اسنپ‌فود", categoryName: "وارداتی از اسنپ‌فود", basePrice: "120000.00" },
    { name: "نمونه پیشنهاد اسنپ‌فود", categoryName: "پیشنهاد روز", basePrice: "95000.00" },
  ]

  return rows.map((row, index) => ({
    rowNumber: index + 1,
    name: row.name,
    description: `Snappfood one-time URL intake fallback for ${sourceUrl}`,
    sku: null,
    categoryName: row.categoryName,
    basePrice: row.basePrice,
    stock: null,
    imageUrl: null,
    sourceUrl,
    sourceMetadata: {
      type: "SNAPPFOOD_URL_FALLBACK",
      sourceUrl,
      publicFetchEnabled: false,
      fallback: "manual-review-fixture",
      confidence: 0.4,
    },
    rawData: {
      sourceUrl,
      fixture: "snappfood-url-fallback",
      line: `${row.name} - ${row.basePrice}`,
    },
    warnings: [
      "Snappfood public fetch is disabled; review this fallback draft manually or use CSV/manual import.",
    ],
    errors: [],
  }))
}
