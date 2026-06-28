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
const migration = exists("prisma/migrations/20260628000300_export_hub_foundation/migration.sql")
  ? read("prisma/migrations/20260628000300_export_hub_foundation/migration.sql")
  : ""
const types = exists("lib/export-hub/types.ts") ? read("lib/export-hub/types.ts") : ""
const service = exists("lib/services/export-hub.service.ts") ? read("lib/services/export-hub.service.ts") : ""
const jobsRoute = exists("app/api/dashboard/exports/jobs/route.ts") ? read("app/api/dashboard/exports/jobs/route.ts") : ""
const jobRoute = exists("app/api/dashboard/exports/jobs/[jobId]/route.ts") ? read("app/api/dashboard/exports/jobs/[jobId]/route.ts") : ""
const page = exists("app/[locale]/dashboard/exports/page.tsx") ? read("app/[locale]/dashboard/exports/page.tsx") : ""
const nav = read("lib/dashboard/navigation-policy.ts")
const sidebar = read("components/dashboard/dashboard-sidebar.tsx")
const access = read("lib/access-control.ts")
const packageJson = read("package.json")
const validateProject = read("scripts/quality/validate-project.mjs")

add("ExportJob schema model exists", /model ExportJob/.test(schema) && /ExportDataType/.test(schema) && /ExportJobFormat/.test(schema))
add("ExportJob migration exists", exists("prisma/migrations/20260628000300_export_hub_foundation/migration.sql"))
add("migration creates export enums and table", /CREATE TYPE "ExportJobStatus"/.test(migration) && /CREATE TABLE "ExportJob"/.test(migration))
add("export types exist", exists("lib/export-hub/types.ts") && /exportDataTypes/.test(types) && /exportJobFormats/.test(types))
add("service creates organization-scoped export jobs", /exportHubService/.test(service) && /createJob/.test(service) && /organizationId/.test(service))
add("service supports required export datasets", /PRODUCTS/.test(service) && /PRODUCT_CATEGORIES/.test(service) && /ORDERS/.test(service) && /CUSTOMERS/.test(service) && /FANPAGE_POSTS/.test(service))
add("service generates CSV and JSON payloads", /rowsToCsv/.test(service) && /payload\.csv/.test(service) && /JSON/.test(service))
add("service writes audit logs", /writeAuditLog/.test(service) && /Export Hub job generated/.test(service))
add("exports jobs API exists", exists("app/api/dashboard/exports/jobs/route.ts"))
add("exports jobs API is org-scoped", /requireAuthSession/.test(jobsRoute) && /requireOrgAccess/.test(jobsRoute) && /requireCurrentOrganizationId/.test(jobsRoute))
add("single export job API exists", exists("app/api/dashboard/exports/jobs/[jobId]/route.ts"))
add("single export job API is org-scoped", /requireAuthSession/.test(jobRoute) && /requireOrgAccess/.test(jobRoute) && /getJobOrganizationId/.test(jobRoute))
add("dashboard export page exists", exists("app/[locale]/dashboard/exports/page.tsx"))
add("dashboard export page exposes type format and preview", /exportTypes/.test(page) && /exportFormats/.test(page) && /selectedJob/.test(page))
add("navigation exposes exports", /exports/.test(nav) && /\/exports/.test(nav) && /Export Hub/.test(sidebar))
add("access control protects exports", /\/dashboard\/exports/.test(access) && /ORG_MANAGEMENT_ROLES/.test(access))
add("package script exposes P78 validator", /"quality:export-hub-foundation":\s*"node scripts\/quality\/validate-export-hub-foundation\.mjs"/.test(packageJson))
add("project validator references P78 validator", /validate-export-hub-foundation\.mjs/.test(validateProject))
add("P78 phase doc exists", exists("docs/PHASE_78_EXPORT_HUB_FOUNDATION.md"))
add("README references P78", /P78/.test(read("README.md")) && /Export Hub/.test(read("README.md")))
add("current source of truth references P78", /P78/.test(read("docs/CURRENT_SOURCE_OF_TRUTH.md")) && /Export Hub/.test(read("docs/CURRENT_SOURCE_OF_TRUTH.md")))

console.table(results)
const failed = results.filter((result) => !result.ok)
if (failed.length) {
  console.error(`Export Hub foundation validation failed with ${failed.length} issue(s).`, failed)
  process.exit(1)
}

console.log("Export Hub foundation validation passed.")
