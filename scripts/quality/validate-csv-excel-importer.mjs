#!/usr/bin/env node
import fs from "node:fs"
import path from "node:path"

const root = process.cwd()
const results = []

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8")
}

function exists(rel) {
  return fs.existsSync(path.join(root, rel))
}

function add(name, condition, detail = "") {
  results.push({ name, ok: Boolean(condition), detail })
}

const schema = read("prisma/schema.prisma")
const service = read("lib/services/import-hub.service.ts")
const parser = exists("lib/import-hub/spreadsheet-parser.ts") ? read("lib/import-hub/spreadsheet-parser.ts") : ""
const route = read("app/api/dashboard/imports/jobs/route.ts")
const page = read("app/[locale]/dashboard/imports/page.tsx")
const packageJson = read("package.json")
const validateProject = read("scripts/quality/validate-project.mjs")

add("xlsx dependency is declared", /"xlsx":\s*"\^0\.18\.5"/.test(packageJson))
add("ImportedProductDraft has row number", /model\s+ImportedProductDraft\s*{[^}]*rowNumber\s+Int\?/.test(schema))
add("ImportedProductDraft has stock", /model\s+ImportedProductDraft\s*{[^}]*stock\s+Int\?/.test(schema))
add("ImportedProductDraft has errors JSON", /model\s+ImportedProductDraft\s*{[^}]*errors\s+Json\?/.test(schema))
add("P69 migration exists", exists("prisma/migrations/20260628000200_csv_excel_product_importer/migration.sql"))

add("spreadsheet parser exists", exists("lib/import-hub/spreadsheet-parser.ts"))
add("spreadsheet parser imports xlsx", /from "xlsx"/.test(parser))
add("spreadsheet parser parses CSV rows", /function parseCsvRows/.test(parser))
add("spreadsheet parser parses Excel rows", /function parseExcelRows/.test(parser) && /XLSX\.read/.test(parser))
add("spreadsheet parser maps product columns", /columnAliases/.test(parser) && /basePrice/.test(parser) && /categoryName/.test(parser))
add("spreadsheet parser records row warnings and errors", /warnings: string\[\]/.test(parser) && /errors: string\[\]/.test(parser))
add("spreadsheet parser caps rows", /maxRows/.test(parser) && /slice\(0, maxRows\)/.test(parser))

add("service parses spreadsheets into product drafts", /parseProductSpreadsheet/.test(service) && /importedProductDraft\.createMany/.test(service))
add("service keeps spreadsheet imports draft-only", /status:\s*"DRAFT"/.test(service))
add("service stores row metadata", /rowNumber/.test(service) && /rawData/.test(service) && /warnings/.test(service) && /errors/.test(service))
add("service does not create live products", !/prisma\.product\.create/.test(service))
add("service does not copy images to Blob", !/put\(/.test(service) && !/@vercel\/blob/.test(service))

add("API accepts CSV text content", /fileContent/.test(route))
add("API accepts Excel base64 content", /fileBase64/.test(route))
add("API size-limits file payloads", /1_000_000/.test(route) && /5_000_000/.test(route))

add("imports page has real CSV/Excel file input", /type="file"/.test(page) && /\.csv/.test(page) && /\.xlsx/.test(page) && /\.xls/.test(page))
add("imports page reads CSV as text", /file\.text\(\)/.test(page))
add("imports page reads Excel as base64", /arrayBuffer/.test(page) && /btoa/.test(page))
add("imports page displays product drafts", /selectedJob\.productDrafts/.test(page) && /draft\.rowNumber/.test(page))
add("imports page can approve or reject drafts", /reviewDrafts\("APPROVED"\)/.test(page) && /reviewDrafts\("REJECTED"\)/.test(page))

add("package script exposes P69 validator", /"quality:csv-excel-importer":\s*"node scripts\/quality\/validate-csv-excel-importer\.mjs"/.test(packageJson))
add("project validator references P69 validator", /validate-csv-excel-importer\.mjs/.test(validateProject))
add("P69 phase doc exists", exists("docs/PHASE_69_CSV_EXCEL_PRODUCT_IMPORTER.md"))
add("README references P69 CSV/Excel", /P69/.test(read("README.md")) && /CSV\/Excel Product Importer/.test(read("README.md")))
add("current source of truth references P69", /P69/.test(read("docs/CURRENT_SOURCE_OF_TRUTH.md")))

console.table(results)
const failed = results.filter((result) => !result.ok)
if (failed.length) {
  console.error(`CSV/Excel importer validation failed with ${failed.length} issue(s).`, failed)
  process.exit(1)
}

console.log("CSV/Excel importer validation passed.")
