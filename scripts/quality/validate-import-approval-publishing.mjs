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

const service = read("lib/services/import-hub.service.ts")
const page = read("app/[locale]/dashboard/imports/page.tsx")
const packageJson = read("package.json")
const validateProject = read("scripts/quality/validate-project.mjs")
const reviewDraftsBlock = service.match(/async reviewDrafts[\s\S]*?async resolveReimportDrafts/)?.[0] ?? ""

add("approval publishing validator is registered", /"quality:import-approval-publishing":\s*"node scripts\/quality\/validate-import-approval-publishing\.mjs"/.test(packageJson))
add("project validator references approval publishing", /validate-import-approval-publishing\.mjs/.test(validateProject))
add("P79 phase doc exists", exists("docs/PHASE_79_IMPORT_APPROVAL_PUBLISHING.md"))
add("README references P79", /P79/.test(read("README.md")) && /Import Approval Publishing/.test(read("README.md")))
add("source of truth references P79", /P79/.test(read("docs/CURRENT_SOURCE_OF_TRUTH.md")) && /approval-to-live/.test(read("docs/CURRENT_SOURCE_OF_TRUTH.md")))

add("review flow keeps rejection non-publishing", /input\.status === "REJECTED"/.test(reviewDraftsBlock) && /Import drafts rejected after seller review/.test(reviewDraftsBlock))
add("approved product drafts require shop organization", /Product import publishing requires a shop organization/.test(reviewDraftsBlock))
add("approved product drafts create categories", /findOrCreateImportedCategory/.test(service) && /buildUniqueCategorySlug/.test(service))
add("approved product drafts create live products", /tx\.product\.create/.test(reviewDraftsBlock) && /buildUniqueDetailSlug/.test(reviewDraftsBlock))
add("approved product drafts create default variants", /tx\.productVariant\.create/.test(reviewDraftsBlock) && /name:\s*"Default"/.test(reviewDraftsBlock))
add("approved content drafts create published fanpage posts", /tx\.fanpagePost\.create/.test(reviewDraftsBlock) && /isPublished:\s*true/.test(reviewDraftsBlock))
add("approved drafts are marked imported", /status:\s*"IMPORTED"/.test(reviewDraftsBlock) && /importedAt:\s*reviewedAt/.test(reviewDraftsBlock))
add("publishing writes audit log", /Approved import drafts published to live records/.test(service) && /fanpagePostCount/.test(service))
add("publishing revalidates all locales and home cache", /supportedLocales/.test(service) && /revalidateImportedProductPages/.test(service) && /revalidateImportedFanpagePages/.test(service) && /revalidateTag\("home-page", "max"\)/.test(service))
add("product revalidation uses public singular routes", /\/product\/\$\{slug\}/.test(service) && /\/category\/\$\{slug\}/.test(service))
add("imports UI labels approval as publish action", /Approve and publish/.test(page) && /تایید و انتشار/.test(page))
add("imports UI treats imported rows as successful", /draft\.status === "APPROVED" \|\| draft\.status === "IMPORTED"/.test(page))

console.table(results)
const failed = results.filter((result) => !result.ok)
if (failed.length) {
  console.error(`Import approval publishing validation failed with ${failed.length} issue(s).`, failed)
  process.exit(1)
}

console.log("Import approval publishing validation passed.")
