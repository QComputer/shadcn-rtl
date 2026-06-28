import * as XLSX from "xlsx"

export type ParsedProductDraftRow = {
  rowNumber: number
  name: string | null
  description: string | null
  sku: string | null
  categoryName: string | null
  basePrice: string | null
  stock: number | null
  imageUrl: string | null
  sourceUrl: string | null
  rawData: Record<string, string>
  warnings: string[]
  errors: string[]
}

type ParseSpreadsheetInput = {
  type: "CSV" | "EXCEL"
  fileContent?: string | null
  fileBase64?: string | null
  maxRows?: number
}

const columnAliases = {
  name: ["name", "product", "product name", "title", "نام", "نام محصول", "محصول"],
  description: ["description", "desc", "body", "توضیحات", "شرح"],
  sku: ["sku", "code", "کد", "شناسه", "کد محصول"],
  categoryName: ["category", "category name", "دسته", "دسته بندی", "دسته‌بندی"],
  basePrice: ["price", "base price", "amount", "قیمت", "قیمت پایه", "مبلغ"],
  stock: ["stock", "inventory", "quantity", "qty", "موجودی", "تعداد"],
  imageUrl: ["image", "image url", "photo", "تصویر", "عکس", "نشانی تصویر"],
  sourceUrl: ["url", "source url", "link", "لینک", "نشانی"],
} satisfies Record<string, string[]>

export function parseProductSpreadsheet(input: ParseSpreadsheetInput): ParsedProductDraftRow[] {
  const rows = input.type === "CSV" ? parseCsvRows(input.fileContent || "") : parseExcelRows(input.fileBase64 || "")
  const [headerRow, ...dataRows] = rows
  if (!headerRow || headerRow.length === 0) return []

  const maxRows = Math.min(Math.max(input.maxRows ?? 500, 1), 1000)
  const headers = headerRow.map(normalizeHeader)

  return dataRows
    .slice(0, maxRows)
    .map((row, index) => normalizeProductRow(headers, row, index + 2))
    .filter((row) => Object.values(row.rawData).some((value) => value.trim().length > 0))
}

function parseExcelRows(fileBase64: string): string[][] {
  if (!fileBase64) return []
  const workbook = XLSX.read(Buffer.from(fileBase64, "base64"), { type: "buffer" })
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) return []
  const sheet = workbook.Sheets[sheetName]
  return XLSX.utils.sheet_to_json<string[]>(sheet, {
    header: 1,
    raw: false,
    blankrows: false,
    defval: "",
  })
}

function parseCsvRows(input: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ""
  let inQuotes = false

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index]
    const next = input[index + 1]

    if (char === "\"") {
      if (inQuotes && next === "\"") {
        field += "\""
        index += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (char === "," && !inQuotes) {
      row.push(field)
      field = ""
      continue
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") index += 1
      row.push(field)
      rows.push(row)
      row = []
      field = ""
      continue
    }

    field += char
  }

  row.push(field)
  rows.push(row)
  return rows.filter((csvRow) => csvRow.some((cell) => cell.trim().length > 0))
}

function normalizeProductRow(headers: string[], row: string[], rowNumber: number): ParsedProductDraftRow {
  const rawData = headers.reduce<Record<string, string>>((acc, header, index) => {
    if (!header) return acc
    acc[header] = normalizeCell(row[index])
    return acc
  }, {})

  const get = (field: keyof typeof columnAliases) => {
    const aliases = columnAliases[field]
    const key = Object.keys(rawData).find((header) => aliases.includes(header))
    return key ? rawData[key] || null : null
  }

  const name = get("name")
  const basePrice = normalizePrice(get("basePrice"))
  const stock = normalizeStock(get("stock"))
  const warnings: string[] = []
  const errors: string[] = []

  if (!name) errors.push("Missing product name")
  if (!basePrice) warnings.push("Missing or invalid price")
  if (get("imageUrl")?.startsWith("http")) warnings.push("Remote image preview only; Blob copy requires approval")

  return {
    rowNumber,
    name,
    description: get("description"),
    sku: get("sku"),
    categoryName: get("categoryName"),
    basePrice,
    stock,
    imageUrl: get("imageUrl"),
    sourceUrl: get("sourceUrl"),
    rawData,
    warnings,
    errors,
  }
}

function normalizeHeader(value: string) {
  return normalizeCell(value).toLowerCase()
}

function normalizeCell(value: unknown) {
  return String(value ?? "").trim()
}

function normalizePrice(value: string | null) {
  if (!value) return null
  const normalized = value.replace(/[^\d.]/g, "")
  if (!normalized) return null
  const parsed = Number(normalized)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed.toFixed(2) : null
}

function normalizeStock(value: string | null) {
  if (!value) return null
  const parsed = Number(value.replace(/[^\d-]/g, ""))
  if (!Number.isFinite(parsed)) return null
  return Math.max(0, Math.trunc(parsed))
}
