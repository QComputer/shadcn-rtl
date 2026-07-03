#!/usr/bin/env node
import fs from "node:fs"
import path from "node:path"

const root = process.cwd()
const checks = []

function read(file) {
  return fs.readFileSync(path.join(root, file), "utf8")
}

function exists(file) {
  return fs.existsSync(path.join(root, file))
}

function add(name, pass, detail = "") {
  checks.push({ name, pass: Boolean(pass), detail })
}

const pagePath = "app/[locale]/dashboard/creative-studio/page.tsx"
const page = exists(pagePath) ? read(pagePath) : ""
const policy = read("lib/dashboard/navigation-policy.ts")
const sidebar = read("components/dashboard/dashboard-sidebar.tsx")
const jobRoute = read("app/api/dashboard/creative-studio/jobs/[jobId]/route.ts")
const packageJson = read("package.json")
const validateProject = read("scripts/quality/validate-project.mjs")
const readme = read("README.md")
const roadmap = read("docs/NEXT_PHASE_ROADMAP.md")
const sourceOfTruth = read("docs/CURRENT_SOURCE_OF_TRUTH.md")
const doc = exists("docs/PHASE_109_CREATIVE_STUDIO_DASHBOARD_REVIEW.md")
  ? read("docs/PHASE_109_CREATIVE_STUDIO_DASHBOARD_REVIEW.md")
  : ""

add("P109 phase document exists", exists("docs/PHASE_109_CREATIVE_STUDIO_DASHBOARD_REVIEW.md") && /Status: implemented/.test(doc))
add("Creative Studio dashboard page exists", exists(pagePath))
add("dashboard fetches P108 read APIs", /\/api\/dashboard\/creative-studio\/status/.test(page) && /\/api\/dashboard\/creative-studio\/usage/.test(page) && /\/api\/dashboard\/creative-studio\/jobs/.test(page))
add("dashboard keeps P109 review surface", /dailyJobLimit/.test(page) && /remainingDailyJobs/.test(page) && /selectedJob\.assets/.test(page) && /usageEvents/.test(page))
add("dashboard adds only explicit P110 apply controls", /method:\s*"POST"/.test(page) && /pendingApply\.asset\.id/.test(page) && /confirmationText\.trim\(\) !== "اعمال شود"/.test(page) && !/createJob\(/.test(page))
add("dashboard has Persian-first Creative Studio copy", /استودیوی خلاقیت/.test(page) && /تغییر عمومی/.test(page) && /اعمال روی هدف عمومی/.test(page))
add("dashboard shows usage, jobs, assets, and events", /dailyJobLimit/.test(page) && /remainingDailyJobs/.test(page) && /selectedJob\.assets/.test(page) && /usageEvents/.test(page))
add("dashboard supports SUPER_ADMIN organization context", /\/api\/organizations\?pageSize=100/.test(page) && /organizationId/.test(page) && /isSuperAdmin/.test(page))
add("dashboard route policy includes Creative Studio", /creativeStudio/.test(policy) && /"\/creative-studio":\s*ROLE_NAVIGATION_POLICY\.creativeStudio/.test(policy) && /creativeStudio:\s*MANAGEMENT_ROLES/.test(policy))
add("sidebar exposes Creative Studio navigation", /WandSparkles/.test(sidebar) && /creativeStudio:\s*WandSparkles/.test(sidebar) && /استودیوی خلاقیت/.test(sidebar) && /Creative Studio/.test(sidebar))
add("job detail preserves organization context", /NextRequest/.test(jobRoute) && /searchParams\.get\("organizationId"\)/.test(jobRoute) && /requireCreativeStudioOrganization\(requestedOrganizationId\)/.test(jobRoute))
add("package exposes P109 validator", /"quality:creative-studio-dashboard":\s*"node scripts\/quality\/validate-creative-studio-dashboard\.mjs"/.test(packageJson))
add("project validator references P109 validator", /validate-creative-studio-dashboard\.mjs/.test(validateProject) && /P109 Creative Studio dashboard validator passes/.test(validateProject))
add("README marks P110 latest", /Latest completed implementation phase:\s+\*\*P120B - Customer order lifecycle notifications and guest SMS dry-run review\*\*/.test(readme) && /Recommended next phase:\s+\*\*P120C - Notification delivery observability and retry review\*\*/.test(readme))
add("roadmap keeps P109 complete in P110 progression", /Completed through \*\*P120B - Customer order lifecycle notifications and guest SMS dry-run review\*\*/.test(roadmap) && /\| P109 \| Creative Studio dashboard shell and read-only job review\. \|/.test(roadmap) && /\| P110 \| Creative Studio apply controls and cache-safe public asset updates\. \|/.test(roadmap))
add("source of truth names P110 baseline", /after P119 Creative Studio provider result ingestion and review stabilization/.test(sourceOfTruth) && /Creative Studio dashboard review exists/.test(sourceOfTruth))

for (const check of checks) {
  console.log(`${check.pass ? "OK" : "FAIL"} ${check.name}${check.detail ? ` (${check.detail})` : ""}`)
}

const failed = checks.filter((check) => !check.pass)
if (failed.length > 0) {
  console.error(`\n${failed.length} Creative Studio dashboard validation check(s) failed.`)
  process.exit(1)
}
