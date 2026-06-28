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

const parser = exists("lib/import-hub/instagram-manual-parser.ts")
  ? read("lib/import-hub/instagram-manual-parser.ts")
  : ""
const service = read("lib/services/import-hub.service.ts")
const route = read("app/api/dashboard/imports/jobs/route.ts")
const page = read("app/[locale]/dashboard/imports/page.tsx")
const packageJson = read("package.json")
const validateProject = read("scripts/quality/validate-project.mjs")

add("manual Instagram parser exists", exists("lib/import-hub/instagram-manual-parser.ts"))
add("parser extracts hashtags", /extractHashtags/.test(parser) && /matchAll/.test(parser))
add("parser extracts mentions", /extractMentions/.test(parser))
add("parser detects likely product mentions", /detectLikelyProductMentions/.test(parser))
add("parser normalizes approved media references", /normalizeMediaReferences/.test(parser) && /mediaReferences/.test(parser))
add("parser avoids network scraping", !/\bfetch\s*\(/.test(parser) && !/instagram.*api/i.test(parser))

add("service imports manual Instagram parser", /parseManualInstagramContent/.test(service))
add("service creates ImportedContentDraft rows", /importedContentDraft\.createMany/.test(service))
add("service keeps Instagram imports draft-only", /status:\s*"DRAFT"/.test(service))
add("service stores Instagram metadata", /hashtags/.test(service) || /sourceMetadata:\s*draft\.sourceMetadata/.test(service))
add("service requires Instagram URL", /Instagram import requires a seller-provided post URL/.test(service))
add("service does not publish fanpage posts", !/fanpagePost\.create/.test(service))

add("API accepts bounded media references", /mediaReferences:\s*z\.array/.test(route) && /\.max\(10\)/.test(route))
add("API passes media references to service", /mediaReferences:\s*body\.mediaReferences/.test(route))

add("imports page has media references input", /mediaReferencesText/.test(page) && /copy\.mediaReferences/.test(page))
add("imports page displays content drafts", /selectedJob\.contentDrafts/.test(page) && /ImportedContentDraft/.test(page))
add("imports page reviews content draft IDs", /contentDraftIds/.test(page) && /reviewDrafts/.test(page))
add("imports page displays extracted hints", /likelyProductMentions/.test(page) && /hashtags/.test(page))

add("package script exposes P70 validator", /"quality:manual-instagram-import":\s*"node scripts\/quality\/validate-manual-instagram-import\.mjs"/.test(packageJson))
add("project validator references P70 validator", /validate-manual-instagram-import\.mjs/.test(validateProject))
add("P70 phase doc exists", exists("docs/PHASE_70_MANUAL_INSTAGRAM_FANPAGE_IMPORT.md"))
add("README references P70 Manual Instagram", /P70/.test(read("README.md")) && /Manual Instagram Fanpage Import/.test(read("README.md")))
add("current source of truth references P70", /P70/.test(read("docs/CURRENT_SOURCE_OF_TRUTH.md")))

console.table(results)
const failed = results.filter((result) => !result.ok)
if (failed.length) {
  console.error(`Manual Instagram import validation failed with ${failed.length} issue(s).`, failed)
  process.exit(1)
}

console.log("Manual Instagram import validation passed.")
