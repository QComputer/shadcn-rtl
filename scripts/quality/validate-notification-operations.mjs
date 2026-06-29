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

const service = exists("lib/services/notification-operations.service.ts") ? read("lib/services/notification-operations.service.ts") : ""
const route = exists("app/api/dashboard/notification-operations/route.ts") ? read("app/api/dashboard/notification-operations/route.ts") : ""
const page = exists("app/[locale]/dashboard/notification-operations/page.tsx") ? read("app/[locale]/dashboard/notification-operations/page.tsx") : ""
const nav = exists("lib/dashboard/navigation-policy.ts") ? read("lib/dashboard/navigation-policy.ts") : ""
const sidebar = exists("components/dashboard/dashboard-sidebar.tsx") ? read("components/dashboard/dashboard-sidebar.tsx") : ""
const packageJson = exists("package.json") ? read("package.json") : ""
const validateProject = exists("scripts/quality/validate-project.mjs") ? read("scripts/quality/validate-project.mjs") : ""
const readme = exists("README.md") ? read("README.md") : ""
const roadmap = exists("docs/NEXT_PHASE_ROADMAP.md") ? read("docs/NEXT_PHASE_ROADMAP.md") : ""
const sourceOfTruth = exists("docs/CURRENT_SOURCE_OF_TRUTH.md") ? read("docs/CURRENT_SOURCE_OF_TRUTH.md") : ""

add("P103 phase document exists", exists("docs/PHASE_103_NOTIFICATION_OPERATIONS_DASHBOARD.md"))
add("operations service exists", exists("lib/services/notification-operations.service.ts"))
add("operations service aggregates in-app notifications", /prisma\.notification\.count/.test(service) && /prisma\.notification\.findMany/.test(service) && /targetUser/.test(service))
add("operations service aggregates Web Push deliveries", /webPushDelivery\.groupBy/.test(service) && /webPushDelivery\.findMany/.test(service) && /getWebPushRuntimeConfig/.test(service))
add("operations service aggregates SMS deliveries", /smsDelivery\.groupBy/.test(service) && /smsDelivery\.findMany/.test(service) && /smsService\.getConfig/.test(service))
add("operations service scopes to active organization", /deletedAt:\s*null/.test(service) && /isActive:\s*true/.test(service))
add("dashboard API route exists", exists("app/api/dashboard/notification-operations/route.ts"))
add("dashboard API requires authenticated organization access", /requireAuthSession/.test(route) && /requireCurrentOrganizationId/.test(route) && /requireOrgAccess/.test(route))
add("dashboard API permits operator roles", /\["ADMIN",\s*"MANAGER",\s*"STAFF"\]/.test(route))
add("dashboard API uses service boundary", /notificationOperationsService\.getDashboard/.test(route) && !/prisma\./.test(route))
add("dashboard page exists", exists("app/[locale]/dashboard/notification-operations/page.tsx"))
add("dashboard page fetches operations endpoint no-store", /\/api\/dashboard\/notification-operations/.test(page) && /cache:\s*"no-store"/.test(page))
add("dashboard page renders channel health and recent rows", /ProviderPanel/.test(page) && /recentWebPush/.test(page) && /recentSms/.test(page) && /recentInApp/.test(page))
add("dashboard page is Persian-first", /پایش اعلان‌ها/.test(page) && /وضعیت عملیاتی/.test(page))
add("navigation includes notification operations item", /notificationOperations/.test(nav) && /\/notification-operations/.test(nav) && /ROLE_NAVIGATION_POLICY\.notificationOperations/.test(nav))
add("sidebar exposes notification operations icon and copy", /notificationOperations:\s*Activity/.test(sidebar) && /پایش اعلان‌ها/.test(sidebar) && /Notification ops/.test(sidebar))
add("package exposes P103 validator", /"quality:notification-operations":\s*"node scripts\/quality\/validate-notification-operations\.mjs"/.test(packageJson))
add("project validator references P103 validator", /validate-notification-operations\.mjs/.test(validateProject) && /P103 notification operations validator passes/.test(validateProject))
add("README marks P103 latest and P104 next", /Latest completed implementation phase:\s+\*\*P103 - Admin\/operator notification dashboard\*\*/.test(readme) && /Recommended next phase:\s+\*\*P104 - Deployed PWA, Push, and SMS smoke gates\*\*/.test(readme))
add("roadmap marks P103 complete and P104 next", /Completed through \*\*P103 - Admin\/operator notification dashboard\*\*/.test(roadmap) && /P104 - Deployed PWA, Push, and SMS smoke gates/.test(roadmap))
add("source of truth names P103 baseline", /after P103 Admin\/operator notification dashboard/.test(sourceOfTruth) && /Notification operations dashboard exists/.test(sourceOfTruth))

for (const check of checks) {
  console.log(`${check.pass ? "OK" : "FAIL"} ${check.name}${check.detail ? ` (${check.detail})` : ""}`)
}

const failed = checks.filter((check) => !check.pass)
if (failed.length > 0) {
  console.error(`\n${failed.length} notification operations validation check(s) failed.`)
  process.exit(1)
}
