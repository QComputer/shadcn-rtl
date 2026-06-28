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

const fixture = exists("lib/import-hub/menu-ocr-fixtures.ts")
  ? read("lib/import-hub/menu-ocr-fixtures.ts")
  : ""
const service = read("lib/services/import-hub.service.ts")
const page = read("app/[locale]/dashboard/imports/page.tsx")
const packageJson = read("package.json")
const validateProject = read("scripts/quality/validate-project.mjs")

add("menu OCR fixture parser exists", exists("lib/import-hub/menu-ocr-fixtures.ts"))
add("fixture parser supports PDF and image menu", /PDF/.test(fixture) && /IMAGE_MENU/.test(fixture))
add("fixture parser marks dry-run OCR", /DRY_RUN_MENU_OCR_FIXTURE/.test(fixture) && /dryRun:\s*true/.test(fixture))
add("real OCR is disabled", /realMenuOcrEnabled/.test(fixture) && /return false/.test(fixture))
add("fixture parser avoids OCR/network SDKs", !/\bfetch\s*\(/.test(fixture) && !/tesseract|google.*vision|azure.*vision|openai/i.test(fixture))

add("service imports menu OCR fixtures", /parseMenuOcrFixture/.test(service) && /realMenuOcrEnabled/.test(service))
add("service parses PDF/image menu into product drafts", /type === "PDF" \|\| type === "IMAGE_MENU"/.test(service) && /parsedMenuProductDrafts/.test(service))
add("service stores P72 metadata", /P72_IMAGE_PDF_MENU_IMPORT/.test(service) && /dryRunMenuOcrFixture/.test(service))
add("service keeps menu rows draft-only", /status:\s*"DRAFT"/.test(service))
add("service does not create live products", !/prisma\.product\.create/.test(service))

add("imports page accepts PDF and images", /accept="\.csv,\.xlsx,\.xls,\.pdf,\.png,\.jpg,\.jpeg,\.webp,\.gif"/.test(page))
add("imports page classifies PDF files", /setSourceType\("PDF"\)/.test(page))
add("imports page classifies image menu files", /setSourceType\("IMAGE_MENU"\)/.test(page))

add("package script exposes P72 validator", /"quality:image-pdf-menu-import":\s*"node scripts\/quality\/validate-image-pdf-menu-import\.mjs"/.test(packageJson))
add("project validator references P72 validator", /validate-image-pdf-menu-import\.mjs/.test(validateProject))
add("P72 phase doc exists", exists("docs/PHASE_72_IMAGE_PDF_MENU_IMPORT.md"))
add("README references P72", /P72/.test(read("README.md")) && /Image\/PDF Menu Import Foundation/.test(read("README.md")))
add("current source of truth references P72", /P72/.test(read("docs/CURRENT_SOURCE_OF_TRUTH.md")))

console.table(results)
const failed = results.filter((result) => !result.ok)
if (failed.length) {
  console.error(`Image/PDF menu import validation failed with ${failed.length} issue(s).`, failed)
  process.exit(1)
}

console.log("Image/PDF menu import validation passed.")
