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

const service = exists("lib/services/export-hub.service.ts") ? read("lib/services/export-hub.service.ts") : ""
const downloadRoute = exists("app/api/dashboard/exports/jobs/[jobId]/download/route.ts")
  ? read("app/api/dashboard/exports/jobs/[jobId]/download/route.ts")
  : ""
const jobRoute = exists("app/api/dashboard/exports/jobs/[jobId]/route.ts")
  ? read("app/api/dashboard/exports/jobs/[jobId]/route.ts")
  : ""
const page = exists("app/[locale]/dashboard/exports/page.tsx") ? read("app/[locale]/dashboard/exports/page.tsx") : ""
const packageJson = read("package.json")
const validateProject = read("scripts/quality/validate-project.mjs")

add("export download route exists", exists("app/api/dashboard/exports/jobs/[jobId]/download/route.ts"))
add("download route requires authenticated org access", /requireAuthSession/.test(downloadRoute) && /requireOrgAccess/.test(downloadRoute) && /getJobOrganizationId/.test(downloadRoute))
add("download route sends attachment headers", /Content-Disposition/.test(downloadRoute) && /attachment/.test(downloadRoute) && /X-Content-Type-Options/.test(downloadRoute))
add("download route prevents shared cache", /Cache-Control/.test(downloadRoute) && /private, no-store/.test(downloadRoute))
add("service builds CSV and JSON downloads", /getJobDownload/.test(service) && /rowsToCsv/.test(service) && /JSON\.stringify/.test(service))
add("service only downloads completed jobs", /status !== "COMPLETED"/.test(service) && /not ready for download/.test(service))
add("job list omits heavy payload field", /exportJobSummarySelect/.test(service) && /select: exportJobSummarySelect/.test(service))
add("job detail route still supports preview payload", /exportHubService\.getJob/.test(jobRoute))
add("dashboard exposes completed job download action", /downloadJob/.test(page) && /\/download/.test(page) && /downloadLabel/.test(page))
add("dashboard keeps Persian download label", /دانلود فایل/.test(page))
add("package script exposes P81 validator", /"quality:export-downloads":\s*"node scripts\/quality\/validate-export-downloads\.mjs"/.test(packageJson))
add("project validator references P81 validator", /validate-export-downloads\.mjs/.test(validateProject) && /P81 export downloads validator passes/.test(validateProject))
add("P81 phase doc exists", exists("docs/PHASE_81_EXPORT_DOWNLOADS.md"))

console.table(results)
const failed = results.filter((result) => !result.ok)
if (failed.length) {
  console.error(`Export downloads validation failed with ${failed.length} issue(s).`, failed)
  process.exit(1)
}

console.log("Export downloads validation passed.")
