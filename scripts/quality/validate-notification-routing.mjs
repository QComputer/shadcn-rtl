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

const templates = exists("lib/notifications/templates.ts") ? read("lib/notifications/templates.ts") : ""
const policy = exists("lib/notifications/delivery-policy.ts") ? read("lib/notifications/delivery-policy.ts") : ""
const router = exists("lib/notifications/router.ts") ? read("lib/notifications/router.ts") : ""
const webPush = exists("lib/services/web-push-foundation.service.ts") ? read("lib/services/web-push-foundation.service.ts") : ""
const packageJson = exists("package.json") ? read("package.json") : ""
const validateProject = exists("scripts/quality/validate-project.mjs") ? read("scripts/quality/validate-project.mjs") : ""
const readme = exists("README.md") ? read("README.md") : ""
const roadmap = exists("docs/NEXT_PHASE_ROADMAP.md") ? read("docs/NEXT_PHASE_ROADMAP.md") : ""
const sourceOfTruth = exists("docs/CURRENT_SOURCE_OF_TRUTH.md") ? read("docs/CURRENT_SOURCE_OF_TRUTH.md") : ""

add("P102 phase document exists", exists("docs/PHASE_102_NOTIFICATION_ROUTING.md"))
add("template registry defines required workflow templates", /appointment_confirmation/.test(templates) && /appointment_reminder/.test(templates) && /order_created/.test(templates) && /order_status_updated/.test(templates) && /payment_status_updated/.test(templates) && /staff_alert/.test(templates) && /marketing_broadcast/.test(templates))
add("template renderer exposes rendered channel content", /renderNotificationTemplate/.test(templates) && /pushTitle/.test(templates) && /pushBody/.test(templates) && /smsBody/.test(templates) && /inAppType/.test(templates))
add("templates are Persian-first", /تایید نوبت/.test(templates) && /سفارش جدید/.test(templates) && /وضعیت پرداخت/.test(templates))
add("delivery policy maps templates to channels", /DEFAULT_CHANNELS/.test(policy) && /IN_APP/.test(policy) && /WEB_PUSH/.test(policy) && /SMS/.test(policy) && /resolveNotificationDeliveryPolicy/.test(policy))
add("delivery policy preserves marketing vs transactional preference kind", /preferenceKind/.test(policy) && /marketing/.test(policy) && /transactional/.test(policy))
add("router renders templates and resolves policy", /renderNotificationTemplate/.test(router) && /resolveNotificationDeliveryPolicy/.test(router))
add("router sends in-app notifications through preference checks", /isCustomerDeliveryAllowed/.test(router) && /channel:\s*"IN_APP"/.test(router) && /prisma\.notification\.create/.test(router))
add("router routes Web Push through service boundary", /webPushFoundationService\.sendToCustomer/.test(router) && !/webpush\.sendNotification/.test(router))
add("router routes SMS through service boundary", /smsService\.sendTextToCustomer/.test(router) && !/SmsIrProvider/.test(router))
add("router supports dry-run preview without channel writes", /input\.dryRun/.test(router) && /status:\s*"planned"/.test(router))
add("router audit logs routing outcomes", /writeAuditLog/.test(router) && /Notification routed across channels/.test(router))
add("Web Push service exposes single-customer delivery", /sendToCustomer/.test(webPush) && /customerId/.test(webPush) && /isCustomerDeliveryAllowed/.test(webPush))
add("single-customer Web Push records delivery attempts and cleans invalid subscriptions", /webPushDelivery\.create/.test(webPush) && /statusCode === 404 \|\| statusCode === 410/.test(webPush))
add("package exposes P102 validator", /"quality:notification-routing":\s*"node scripts\/quality\/validate-notification-routing\.mjs"/.test(packageJson))
add("project validator references P102 validator", /validate-notification-routing\.mjs/.test(validateProject) && /P102 notification routing validator passes/.test(validateProject))
add("README keeps P102 complete while marking P104 latest and P105 next", /\| 102 \| Notification templates, routing, and delivery policies/.test(readme) && /Latest completed implementation phase:\s+\*\*P104 - Deployed PWA, Push, and SMS smoke gates\*\*/.test(readme) && /Recommended next phase:\s+\*\*P105 - Production rollout runbook\*\*/.test(readme))
add("roadmap marks P102 complete in P104 progression", /\| P102 \| Notification templates, routing, and delivery policies\. \|/.test(roadmap) && /Completed through \*\*P104 - Deployed PWA, Push, and SMS smoke gates\*\*/.test(roadmap))
add("source of truth names P104 baseline", /after P104 Deployed PWA, Push, and SMS smoke gates/.test(sourceOfTruth) && /Notification routing exists/.test(sourceOfTruth))

for (const check of checks) {
  console.log(`${check.pass ? "OK" : "FAIL"} ${check.name}${check.detail ? ` (${check.detail})` : ""}`)
}

const failed = checks.filter((check) => !check.pass)
if (failed.length > 0) {
  console.error(`\n${failed.length} notification routing validation check(s) failed.`)
  process.exit(1)
}
