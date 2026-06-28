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

const limits = exists("lib/import-hub/limits.ts") ? read("lib/import-hub/limits.ts") : ""
const service = read("lib/services/import-hub.service.ts")
const eventsRoute = exists("app/api/dashboard/imports/jobs/[jobId]/events/route.ts")
  ? read("app/api/dashboard/imports/jobs/[jobId]/events/route.ts")
  : ""
const retryRoute = exists("app/api/dashboard/imports/jobs/[jobId]/retry/route.ts")
  ? read("app/api/dashboard/imports/jobs/[jobId]/retry/route.ts")
  : ""
const cancelRoute = read("app/api/dashboard/imports/jobs/[jobId]/cancel/route.ts")
const page = read("app/[locale]/dashboard/imports/page.tsx")
const packageJson = read("package.json")
const validateProject = read("scripts/quality/validate-project.mjs")

add("limits module exists", exists("lib/import-hub/limits.ts"))
add("limits define active daily draft and audit caps", /maxActiveJobsPerOrganization/.test(limits) && /maxJobsPerOrganizationPerDay/.test(limits) && /maxDraftsPerJob/.test(limits) && /auditEventPageSize/.test(limits))
add("limits include plan readiness mode", /planReadinessMode/.test(limits) && /admin-default-limits/.test(limits))
add("service enforces create limits", /assertCreateWithinLimits/.test(service) && /Import Hub active job limit reached/.test(service) && /Import Hub daily job limit reached/.test(service))
add("service stores P77 metadata", /P77_IMPORT_HUB_AUDIT_LIMITS_PLAN_READINESS/.test(service) && /importHubLimits/.test(service))
add("service exposes audit events", /listJobAuditEvents/.test(service) && /auditLog\.findMany/.test(service) && /auditEventPageSize/.test(service))
add("service hardens cancel policy", /Only queued, review-needed, or failed import jobs can be canceled/.test(service))
add("service implements retry policy", /retryJob/.test(service) && /Only failed or canceled import jobs can be retried/.test(service))
add("events route exists", exists("app/api/dashboard/imports/jobs/[jobId]/events/route.ts"))
add("events route is org-scoped", /requireAuthSession/.test(eventsRoute) && /requireOrgAccess/.test(eventsRoute) && /listJobAuditEvents/.test(eventsRoute))
add("retry route exists", exists("app/api/dashboard/imports/jobs/[jobId]/retry/route.ts"))
add("retry route is org-scoped", /requireAuthSession/.test(retryRoute) && /requireOrgAccess/.test(retryRoute) && /retryJob/.test(retryRoute))
add("cancel route remains org-scoped", /requireAuthSession/.test(cancelRoute) && /requireOrgAccess/.test(cancelRoute))
add("dashboard shows audit events", /auditEvents/.test(page) && /copy\.auditEvents/.test(page))
add("dashboard exposes retry action", /retryJob/.test(page) && /copy\.retry/.test(page))
add("package script exposes P77 validator", /"quality:import-hub-audit-limits":\s*"node scripts\/quality\/validate-import-hub-audit-limits\.mjs"/.test(packageJson))
add("project validator references P77 validator", /validate-import-hub-audit-limits\.mjs/.test(validateProject))
add("P77 phase doc exists", exists("docs/PHASE_77_IMPORT_HUB_AUDIT_LIMITS.md"))
add("README references P77", /P77/.test(read("README.md")) && /Import Hub Audit/.test(read("README.md")))
add("current source of truth references P77", /P77/.test(read("docs/CURRENT_SOURCE_OF_TRUTH.md")) && /auditability|limits/i.test(read("docs/CURRENT_SOURCE_OF_TRUTH.md")))

console.table(results)
const failed = results.filter((result) => !result.ok)
if (failed.length) {
  console.error(`Import Hub audit/limits validation failed with ${failed.length} issue(s).`, failed)
  process.exit(1)
}

console.log("Import Hub audit/limits validation passed.")
