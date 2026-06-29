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
const importService = read("lib/services/import-hub.service.ts")
const aiMediaService = read("lib/services/ai-media.service.ts")
const importsPage = read("app/[locale]/dashboard/imports/page.tsx")
const packageJson = read("package.json")
const sourceOfTruth = read("docs/CURRENT_SOURCE_OF_TRUTH.md")
const roadmap = read("docs/NEXT_PHASE_ROADMAP.md")
const aiMediaDocs = read("docs/AI_MEDIA_SERVICE.md")

add("ImportedProductDraft stores live imported product id", /importedProductId\s+String\?/.test(schema) && /@@index\(\[importedProductId\]\)/.test(schema))
add("P89 imported product bridge migration exists", exists("prisma/migrations/20260629008900_imported_product_ai_media_bridge/migration.sql"))
add("import approval builds AI media prompt metadata", /buildImportedProductAiMediaPrompt/.test(importService) && /withImportedProductAiMediaMetadata/.test(importService))
add("only imported approvals receive AI media bridge metadata", /status:\s*"IMPORTED"/.test(importService) && /importedProductId: product\.id/.test(importService) && /generatedOnlyAfterImportApproval/.test(importService))
add("AI media service loads imported product context by live product id", /getImportedProductAiMediaContext/.test(aiMediaService) && /importedProductId: productId/.test(aiMediaService) && /status: "IMPORTED"/.test(aiMediaService))
add("AI media service uses imported prompt only as fallback", /options\.seller_prompt\?\.trim\(\) \|\| importedAiMediaContext\?\.promptDefault \|\| null/.test(aiMediaService))
add("AI media usage metadata records imported draft source", /importedProductDraftId/.test(aiMediaService) && /sellerPromptSource/.test(aiMediaService))
add("imports UI links imported products into AI image workflow", /aiMediaSuggestion\?:/.test(importsPage) && /dashboard\/products\/\$\{draft\.sourceMetadata\.aiMediaSuggestion\.productId\}/.test(importsPage) && /تصویر AI/.test(importsPage))
add("package exposes P89 import AI media bridge validator", /"quality:import-ai-media-bridge":\s*"node scripts\/quality\/validate-import-ai-media-bridge\.mjs"/.test(packageJson))
add("AI media docs mention imported product context", /imported product/.test(aiMediaDocs) || /importedProductId/.test(aiMediaDocs))
add("source of truth names P89 import AI media bridge", /P89/.test(sourceOfTruth) && /(Import draft product|Import-to-AI-Media|import-to-AI-media)/.test(sourceOfTruth))
add("roadmap advances next phase to P90", /P90 - Deployed AI media rollout gate through Bazar Baz/.test(roadmap) || /P90 \| Deployed AI media rollout gate through Bazar Baz/.test(roadmap))

console.table(results)
const failed = results.filter((result) => !result.ok)
if (failed.length) {
  console.error(`Import AI media bridge validation failed with ${failed.length} issue(s).`, failed)
  process.exit(1)
}

console.log("Import AI media bridge validation passed.")
