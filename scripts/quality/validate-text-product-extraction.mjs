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

const parser = exists("lib/import-hub/text-product-extractor.ts")
  ? read("lib/import-hub/text-product-extractor.ts")
  : ""
const provider = exists("lib/import-hub/text-extraction-provider.ts")
  ? read("lib/import-hub/text-extraction-provider.ts")
  : ""
const service = read("lib/services/import-hub.service.ts")
const page = read("app/[locale]/dashboard/imports/page.tsx")
const packageJson = read("package.json")
const validateProject = read("scripts/quality/validate-project.mjs")
const reviewDraftsBlock = service.match(/async reviewDrafts[\s\S]*?async resolveReimportDrafts/)?.[0] ?? ""

add("text product extractor exists", exists("lib/import-hub/text-product-extractor.ts"))
add("text extractor supports Persian/Arabic digits", /digitMap/.test(parser) && /۰/.test(parser) && /٩/.test(parser))
add("text extractor parses product-like lines", /parseProductLine/.test(parser) && /extractPrice/.test(parser))
add("text extractor records confidence", /confidence/.test(parser) && /calculateConfidence/.test(parser))
add("text extractor records warnings and errors", /warnings: string\[\]/.test(parser) && /errors: string\[\]/.test(parser))
add("provider abstraction exists", exists("lib/import-hub/text-extraction-provider.ts") && /ProductTextExtractionProvider/.test(provider))
add("provider is local dry-run only", /mode:\s*"dry-run"/.test(provider) && /local-rule-based/.test(provider))
add("external text extraction is disabled", /externalTextExtractionEnabled/.test(provider) && /return false/.test(provider))
add("provider avoids network and AI SDK calls", !/\bfetch\s*\(/.test(provider) && !/openai|ai sdk|generateText/i.test(provider))

add("service imports provider abstraction", /getProductTextExtractionProvider/.test(service))
add("service parses MANUAL_TEXT into product drafts", /type === "MANUAL_TEXT"/.test(service) && /extractProducts/.test(service))
add("service stores confidence metadata", /sourceMetadata/.test(service) && /local-rule-based-text-product-extractor/.test(service))
add("service keeps text products draft-only", /status:\s*"DRAFT"/.test(service))
add("service publishes products only after review approval", /tx\.product\.create/.test(reviewDraftsBlock) && /status:\s*"IMPORTED"/.test(reviewDraftsBlock))

add("imports page displays product confidence", /sourceMetadata\?\.confidence/.test(page))
add("package script exposes P71 validator", /"quality:text-product-extraction":\s*"node scripts\/quality\/validate-text-product-extraction\.mjs"/.test(packageJson))
add("project validator references P71 validator", /validate-text-product-extraction\.mjs/.test(validateProject))
add("P71 phase doc exists", exists("docs/PHASE_71_TEXT_PRODUCT_EXTRACTION.md"))
add("README references P71", /P71/.test(read("README.md")) && /AI\/Text Product Extraction Foundation/.test(read("README.md")))
add("current source of truth references P71", /P71/.test(read("docs/CURRENT_SOURCE_OF_TRUTH.md")))

console.table(results)
const failed = results.filter((result) => !result.ok)
if (failed.length) {
  console.error(`Text product extraction validation failed with ${failed.length} issue(s).`, failed)
  process.exit(1)
}

console.log("Text product extraction validation passed.")
