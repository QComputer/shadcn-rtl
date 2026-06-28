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

function includes(rel, needle) {
  return exists(rel) && read(rel).includes(needle)
}

const schema = read("prisma/schema.prisma")
const service = exists("lib/services/import-hub.service.ts") ? read("lib/services/import-hub.service.ts") : ""
const detection = exists("lib/import-hub/source-detection.ts") ? read("lib/import-hub/source-detection.ts") : ""
const page = exists("app/[locale]/dashboard/imports/page.tsx") ? read("app/[locale]/dashboard/imports/page.tsx") : ""
const navPolicy = exists("lib/dashboard/navigation-policy.ts") ? read("lib/dashboard/navigation-policy.ts") : ""
const sidebar = exists("components/dashboard/dashboard-sidebar.tsx") ? read("components/dashboard/dashboard-sidebar.tsx") : ""
const accessControl = exists("lib/access-control.ts") ? read("lib/access-control.ts") : ""
const packageJson = read("package.json")
const validateProject = read("scripts/quality/validate-project.mjs")

for (const enumName of [
  "ExternalImportSourceType",
  "ExternalImportSourceStatus",
  "ExternalImportJobStatus",
  "ImportedDraftStatus",
]) {
  add(`${enumName} enum exists`, new RegExp(`enum\\s+${enumName}\\s*{`).test(schema))
}

for (const modelName of [
  "ExternalImportSource",
  "ExternalImportJob",
  "ImportedProductDraft",
  "ImportedContentDraft",
]) {
  add(`${modelName} model exists`, new RegExp(`model\\s+${modelName}\\s*{`).test(schema))
}

add("import source types include external/manual sources", /INSTAGRAM[\s\S]*TELEGRAM[\s\S]*SNAP_FOOD[\s\S]*SNAP_MARKET[\s\S]*CSV[\s\S]*EXCEL[\s\S]*PDF[\s\S]*IMAGE_MENU[\s\S]*MANUAL_URL[\s\S]*MANUAL_TEXT/.test(schema))
add("import jobs are organization scoped", /model\s+ExternalImportJob\s*{[\s\S]*organizationId\s+String[\s\S]*organization\s+Organization/.test(schema))
add("product drafts are draft-status scoped", /model\s+ImportedProductDraft\s*{[\s\S]*status\s+ImportedDraftStatus\s+@default\(DRAFT\)/.test(schema))
add("content drafts preserve source metadata", /model\s+ImportedContentDraft\s*{[\s\S]*sourceMetadata\s+Json\?[\s\S]*rawData\s+Json\?/.test(schema))
add("organization has import relations", /externalImportSources\s+ExternalImportSource\[\]/.test(schema) && /externalImportJobs\s+ExternalImportJob\[\]/.test(schema))
add("user has import audit relations", /createdImportSources\s+ExternalImportSource\[\]/.test(schema) && /requestedImportJobs\s+ExternalImportJob\[\]/.test(schema))
add("P68 migration exists", exists("prisma/migrations/20260628000100_import_hub_foundation/migration.sql"))

add("import hub types file exists", exists("lib/import-hub/types.ts"))
add("source detection file exists", exists("lib/import-hub/source-detection.ts"))
add("normalizers file exists", exists("lib/import-hub/normalizers.ts"))
add("source detection recognizes Instagram", /instagram/.test(detection))
add("source detection recognizes Telegram", /telegram|t\\\.me/.test(detection))
add("source detection recognizes Snappfood", /snappfood/.test(detection))
add("source detection recognizes Snappmarket", /snappmarket|snapp\\.market/.test(detection))

add("import hub service exists", exists("lib/services/import-hub.service.ts"))
add("service creates draft-first jobs", /status:\s*"NEEDS_REVIEW"/.test(service) && /importerEnabled:\s*false/.test(service))
add("service requires seller consent for third-party URL sources", /Seller ownership or permission confirmation is required/.test(service))
add("service writes audit logs", /writeAuditLog/.test(service))
add("service does not fetch external URLs", !/\bfetch\s*\(/.test(service))
add("service does not create real products", !/prisma\.product\.create/.test(service))
add("service does not publish fanpage posts", !/fanpagePost\.create/.test(service))

for (const rel of [
  "app/api/dashboard/imports/jobs/route.ts",
  "app/api/dashboard/imports/jobs/[jobId]/route.ts",
  "app/api/dashboard/imports/jobs/[jobId]/cancel/route.ts",
  "app/api/dashboard/imports/jobs/[jobId]/review/route.ts",
]) {
  add(`${rel} exists`, exists(rel))
  add(`${rel} requires auth`, includes(rel, "requireAuthSession"))
  add(`${rel} checks org access`, includes(rel, "requireOrgAccess"))
}

add("create jobs route validates consent", includes("app/api/dashboard/imports/jobs/route.ts", "consentConfirmed"))
add("review route only accepts review statuses", includes("app/api/dashboard/imports/jobs/[jobId]/review/route.ts", "reviewableDraftStatuses"))

add("imports dashboard page exists", exists("app/[locale]/dashboard/imports/page.tsx"))
add("imports page has source selector", /sourceTypes\.map/.test(page) && /SelectItem/.test(page))
add("imports page has URL text and file placeholder inputs", /inputUrl/.test(page) && /inputText/.test(page) && /inputFilename/.test(page))
add("imports page has consent checkbox", /consentConfirmed/.test(page) && /Checkbox/.test(page))
add("imports page has Persian-first Import Hub title", /مرکز واردسازی بازارباز/.test(page))
add("imports page lists jobs with draft counts", /draftCounts/.test(page) && /productDrafts/.test(page) && /contentDrafts/.test(page))
add("imports page exposes review link", /#job-\$\{job\.id\}/.test(page))

add("navigation policy includes imports key", /imports/.test(navPolicy) && /"\/imports":\s*ROLE_NAVIGATION_POLICY\.imports/.test(navPolicy))
add("legacy access control includes imports route", /"\/dashboard\/imports"/.test(accessControl))
add("sidebar includes import icon and labels", /Import/.test(sidebar) && /Import Hub/.test(sidebar) && /مرکز واردسازی/.test(sidebar))

add("package script exposes P68 validator", /"quality:import-hub-foundation":\s*"node scripts\/quality\/validate-import-hub-foundation\.mjs"/.test(packageJson))
add("project validator references P68 validator", /validate-import-hub-foundation\.mjs/.test(validateProject))
add("P68 phase doc exists", exists("docs/PHASE_68_IMPORT_HUB_FOUNDATION.md"))
add("current source of truth references P68", includes("docs/CURRENT_SOURCE_OF_TRUTH.md", "P68"))
add("README references P68 Import Hub", includes("README.md", "P68") && /Import Hub/.test(read("README.md")))

console.table(results)
const failed = results.filter((result) => !result.ok)
if (failed.length) {
  console.error(`Import Hub foundation validation failed with ${failed.length} issue(s).`, failed)
  process.exit(1)
}

console.log("Import Hub foundation validation passed.")
