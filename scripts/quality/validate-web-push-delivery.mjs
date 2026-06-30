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

const schema = exists("prisma/schema.prisma") ? read("prisma/schema.prisma") : ""
const migration = exists("prisma/migrations/20260629000500_web_push_delivery/migration.sql")
  ? read("prisma/migrations/20260629000500_web_push_delivery/migration.sql")
  : ""
const service = exists("lib/services/web-push-foundation.service.ts") ? read("lib/services/web-push-foundation.service.ts") : ""
const dashboardPage = exists("app/[locale]/dashboard/customer-club/push/page.tsx")
  ? read("app/[locale]/dashboard/customer-club/push/page.tsx")
  : ""
const packageJson = exists("package.json") ? read("package.json") : ""
const validateProject = exists("scripts/quality/validate-project.mjs") ? read("scripts/quality/validate-project.mjs") : ""
const readme = exists("README.md") ? read("README.md") : ""
const roadmap = exists("docs/NEXT_PHASE_ROADMAP.md") ? read("docs/NEXT_PHASE_ROADMAP.md") : ""
const sourceOfTruth = exists("docs/CURRENT_SOURCE_OF_TRUTH.md") ? read("docs/CURRENT_SOURCE_OF_TRUTH.md") : ""

add("P100 phase document exists", exists("docs/PHASE_100_WEB_PUSH_DELIVERY.md"))
add("schema defines Web Push delivery status", /enum WebPushDeliveryStatus\s*\{[\s\S]*PENDING[\s\S]*SENT[\s\S]*FAILED[\s\S]*SKIPPED[\s\S]*\}/.test(schema))
add("schema defines WebPushDelivery model", /model WebPushDelivery\s*\{[\s\S]*organizationId\s+String[\s\S]*customerId\s+String[\s\S]*subscriptionId\s+String\?[\s\S]*actorUserId\s+String\?[\s\S]*title\s+String[\s\S]*body\s+String[\s\S]*provider\s+String\s+@default\("dry_run"\)[\s\S]*dryRun\s+Boolean\s+@default\(false\)[\s\S]*status\s+WebPushDeliveryStatus\s+@default\(PENDING\)[\s\S]*\}/.test(schema))
add("schema relates delivery rows to organization customer actor and subscription", /webPushDeliveries\s+WebPushDelivery\[\]/.test(schema) && /actorWebPushDeliveries\s+WebPushDelivery\[\]/.test(schema) && /deliveries\s+WebPushDelivery\[\]/.test(schema))
add("schema indexes delivery operations", /@@index\(\[organizationId,\s*status,\s*createdAt\]\)/.test(schema) && /@@index\(\[customerId,\s*createdAt\]\)/.test(schema) && /@@index\(\[subscriptionId\]\)/.test(schema))

add("migration creates Web Push delivery enum and table", /CREATE TYPE "WebPushDeliveryStatus" AS ENUM \('PENDING', 'SENT', 'FAILED', 'SKIPPED'\)/.test(migration) && /CREATE TABLE IF NOT EXISTS "WebPushDelivery"/.test(migration))
add("migration creates delivery indexes", /WebPushDelivery_organizationId_status_createdAt_idx/.test(migration) && /WebPushDelivery_customerId_createdAt_idx/.test(migration) && /WebPushDelivery_subscriptionId_idx/.test(migration))
add("migration creates delivery foreign keys", /FOREIGN KEY \("organizationId"\) REFERENCES "Organization"\("id"\)[\s\S]*ON DELETE CASCADE/.test(migration) && /FOREIGN KEY \("customerId"\) REFERENCES "User"\("id"\)[\s\S]*ON DELETE CASCADE/.test(migration) && /FOREIGN KEY \("subscriptionId"\) REFERENCES "PushSubscription"\("id"\)[\s\S]*ON DELETE SET NULL/.test(migration))

add("service builds preference-aware delivery plan", /getEligibleDeliveryPlan/.test(service) && /listMarketingEligibleCustomerIds\(organizationId,\s*"WEB_PUSH"\)/.test(service))
add("service returns active eligible and skipped counts", /activeSubscriptionCount/.test(service) && /activeCustomerCount/.test(service) && /preferenceSkippedCustomerCount/.test(service))
add("service lists recent deliveries for dashboard", /webPushDelivery\.findMany/.test(service) && /recentDeliveries/.test(service))
add("service creates delivery attempt rows before real send", /webPushDelivery\.create/.test(service) && /status:\s*"PENDING"/.test(service))
add("service updates delivery rows after success and failure", /webPushDelivery\.update[\s\S]*status:\s*"SENT"/.test(service) && /webPushDelivery\.update[\s\S]*status:\s*"FAILED"/.test(service))
add("service cleans invalid subscriptions", /statusCode === 404 \|\| statusCode === 410/.test(service) && /isActive:\s*false/.test(service) && /removedCount/.test(service))
add("service keeps real send feature-flag gated", /WEB_PUSH_ENABLED/.test(service) && /WEB_PUSH_REAL_SEND_ENABLED/.test(service) && /Real Web Push sending is disabled/.test(service))
add("service audit logs include preference policy counts", /preferenceSkippedCustomerCount/.test(service) && /activeSubscriptionCount/.test(service))

add("dashboard page shows delivery history and eligibility counts", /eligibleCustomerCount/.test(dashboardPage) && /preferenceSkippedCustomerCount/.test(dashboardPage) && /recentDeliveries/.test(dashboardPage) && /deliveryHistory/.test(dashboardPage))
add("dashboard page uses localized real-send labels", /copy\.realSendResult/.test(dashboardPage) && /copy\.sendNow/.test(dashboardPage) && /copy\.deliveryStates/.test(dashboardPage))

for (const locale of ["fa", "en", "ar"]) {
  const dictionary = exists(`dictionaries/${locale}.json`) ? read(`dictionaries/${locale}.json`) : ""
  add(`${locale} dictionary has P100 Web Push copy`, /"eligibleRecipients"\s*:/.test(dictionary) && /"skippedByPreference"\s*:/.test(dictionary) && /"deliveryHistory"\s*:/.test(dictionary) && /"deliveryStates"\s*:/.test(dictionary))
}

add("package exposes P100 validator", /"quality:web-push-delivery":\s*"node scripts\/quality\/validate-web-push-delivery\.mjs"/.test(packageJson))
add("project validator references P100 validator", /validate-web-push-delivery\.mjs/.test(validateProject) && /P100 Web Push delivery validator passes/.test(validateProject))
add("README keeps P100 complete while marking P108 latest", /\| 100 \| Web Push notification service/.test(readme) && /Latest completed implementation phase:\s+\*\*P108 - Creative Studio server foundation\*\*/.test(readme) && /P109 - Creative Studio dashboard shell and read-only job review/.test(readme))
add("roadmap keeps P100 complete while marking P108 baseline", /\| P100 \| Web Push notification service\. \|/.test(roadmap) && /Completed through \*\*P108 - Creative Studio server foundation\*\*/.test(roadmap))
add("source of truth names P108 baseline and keeps P100 summary", /after P108 Creative Studio server foundation/.test(sourceOfTruth) && /Web Push notification service exists/.test(sourceOfTruth))

for (const check of checks) {
  console.log(`${check.pass ? "OK" : "FAIL"} ${check.name}${check.detail ? ` (${check.detail})` : ""}`)
}

const failed = checks.filter((check) => !check.pass)
if (failed.length > 0) {
  console.error(`\n${failed.length} Web Push delivery validation check(s) failed.`)
  process.exit(1)
}
