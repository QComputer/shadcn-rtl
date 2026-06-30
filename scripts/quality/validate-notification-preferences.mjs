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
const migration = exists("prisma/migrations/20260629000400_notification_preferences/migration.sql")
  ? read("prisma/migrations/20260629000400_notification_preferences/migration.sql")
  : ""
const service = exists("lib/services/notification-preferences.service.ts")
  ? read("lib/services/notification-preferences.service.ts")
  : ""
const apiRoute = exists("app/api/customer/notification-preferences/route.ts")
  ? read("app/api/customer/notification-preferences/route.ts")
  : ""
const webPushService = exists("lib/services/web-push-foundation.service.ts")
  ? read("lib/services/web-push-foundation.service.ts")
  : ""
const optInComponent = exists("components/public/web-push-opt-in.tsx")
  ? read("components/public/web-push-opt-in.tsx")
  : ""
const shopProfile = exists("app/[locale]/shop/[slug]/profile/page.tsx")
  ? read("app/[locale]/shop/[slug]/profile/page.tsx")
  : ""
const packageJson = exists("package.json") ? read("package.json") : ""
const validateProject = exists("scripts/quality/validate-project.mjs") ? read("scripts/quality/validate-project.mjs") : ""
const readme = exists("README.md") ? read("README.md") : ""
const roadmap = exists("docs/NEXT_PHASE_ROADMAP.md") ? read("docs/NEXT_PHASE_ROADMAP.md") : ""
const sourceOfTruth = exists("docs/CURRENT_SOURCE_OF_TRUTH.md") ? read("docs/CURRENT_SOURCE_OF_TRUTH.md") : ""

add("P99 phase document exists", exists("docs/PHASE_99_NOTIFICATION_PREFERENCES.md"))

add("schema defines notification channels", /enum NotificationChannel\s*\{[\s\S]*IN_APP[\s\S]*WEB_PUSH[\s\S]*SMS[\s\S]*EMAIL[\s\S]*\}/.test(schema))
add("schema defines notification preference model", /model NotificationPreference\s*\{[\s\S]*organizationId\s+String[\s\S]*customerId\s+String[\s\S]*channel\s+NotificationChannel[\s\S]*marketingEnabled\s+Boolean\s+@default\(false\)[\s\S]*transactionalEnabled\s+Boolean\s+@default\(true\)[\s\S]*quietHoursStart\s+String\?[\s\S]*quietHoursEnd\s+String\?[\s\S]*locale\s+String\s+@default\("fa"\)[\s\S]*source\s+String\s+@default\("PUBLIC_SHOP"\)[\s\S]*\}/.test(schema))
add("schema relates preferences to organization and customer", /notificationPreferences\s+NotificationPreference\[\]/.test(schema) && /notificationPreferences\s+NotificationPreference\[\]\s+@relation\("CustomerNotificationPreferences"\)/.test(schema))
add("schema enforces tenant/customer/channel uniqueness", /@@unique\(\[organizationId,\s*customerId,\s*channel\]\)/.test(schema))
add("schema indexes preference lookup paths", /@@index\(\[organizationId,\s*customerId\]\)/.test(schema) && /@@index\(\[customerId,\s*channel\]\)/.test(schema) && /@@index\(\[organizationId,\s*channel,\s*marketingEnabled\]\)/.test(schema))

add("migration creates notification preference enum and table", /CREATE TYPE "NotificationChannel" AS ENUM \('IN_APP', 'WEB_PUSH', 'SMS', 'EMAIL'\)/.test(migration) && /CREATE TABLE IF NOT EXISTS "NotificationPreference"/.test(migration))
add("migration creates preference constraints and indexes", /NotificationPreference_organizationId_customerId_channel_key/.test(migration) && /NotificationPreference_organizationId_customerId_idx/.test(migration) && /NotificationPreference_customerId_channel_idx/.test(migration) && /NotificationPreference_organizationId_channel_marketingEnabled_idx/.test(migration))
add("migration creates tenant and customer foreign keys", /FOREIGN KEY \("organizationId"\) REFERENCES "Organization"\("id"\)[\s\S]*ON DELETE CASCADE/.test(migration) && /FOREIGN KEY \("customerId"\) REFERENCES "User"\("id"\)[\s\S]*ON DELETE CASCADE/.test(migration))

add("preference service exposes supported channels", /NOTIFICATION_CHANNELS = \["IN_APP", "WEB_PUSH", "SMS"\]/.test(service))
add("preference service defaults in-app marketing on and external channels off", /return channel === "IN_APP"/.test(service))
add("preference service validates quiet hours", /Quiet hours must use HH:mm format/.test(service) && /\/\^\\d\{2\}:\\d\{2\}\$\/.test\(value\)/.test(service))
add("preference service exposes customer preference APIs", /getCustomerPreferences/.test(service) && /upsertCustomerPreference/.test(service) && /setWebPushOptIn/.test(service) && /listMarketingEligibleCustomerIds/.test(service))
add("preference service preserves partial quiet-hour updates", /hasQuietHoursStart/.test(service) && /hasQuietHoursEnd/.test(service) && /\.\.\.\(hasQuietHoursStart \? \{ quietHoursStart \} : \{\}\)/.test(service))
add("preference service is tenant safe", /requireOrganizationBySlug/.test(service) && /deletedAt:\s*null/.test(service) && /isActive:\s*true/.test(service))

add("customer preference API exists", exists("app/api/customer/notification-preferences/route.ts"))
add("customer preference API requires auth and validates body", /requireAuthSession/.test(apiRoute) && /updatePreferencesSchema/.test(apiRoute) && /organizationSlugSchema/.test(apiRoute))
add("customer preference API supports GET and PATCH", /export async function GET/.test(apiRoute) && /export async function PATCH/.test(apiRoute))
add("customer preference API upserts tenant-scoped preferences", /notificationPreferencesService\.getCustomerPreferences/.test(apiRoute) && /notificationPreferencesService\.upsertCustomerPreference/.test(apiRoute) && /source:\s*"PUBLIC_SHOP"/.test(apiRoute))

add("web-push service returns preferences in customer status", /notificationPreferencesService\.getCustomerPreferences/.test(webPushService) && /preferences,/.test(webPushService))
add("web-push subscribe opts customer into browser marketing", /setWebPushOptIn\(\{[\s\S]*enabled:\s*true/.test(webPushService))
add("web-push unsubscribe and denied states opt customer out", /input\.state === "DENIED"[\s\S]*input\.state === "UNSUPPORTED"[\s\S]*input\.state === "REVOKED"[\s\S]*enabled:\s*false/.test(webPushService) && /unsubscribe\(input[\s\S]*setWebPushOptIn\(\{[\s\S]*enabled:\s*false/.test(webPushService))

add("public opt-in component renders preference switches", /preferences\.map/.test(optInComponent) && /<Switch/.test(optInComponent) && /onCheckedChange/.test(optInComponent))
add("public opt-in component saves notification preferences", /\/api\/customer\/notification-preferences/.test(optInComponent) && /method:\s*"PATCH"/.test(optInComponent))
add("public opt-in component is Persian-first and locale-aware", /locale = "fa"/.test(optInComponent) && /copy\[locale as keyof typeof copy\] \|\| copy\.fa/.test(optInComponent) && /\\u0627\\u0639\\u0644\\u0627\\u0646/.test(optInComponent))
add("shop profile passes locale to opt-in component", /<WebPushOptIn\s+organizationSlug=\{profile\.slug\}\s+organizationName=\{profile\.name\}\s+locale=\{locale\}\s*\/>/.test(shopProfile))

add("package exposes P99 validator", /"quality:notification-preferences":\s*"node scripts\/quality\/validate-notification-preferences\.mjs"/.test(packageJson))
add("project validator references P99 validator", /validate-notification-preferences\.mjs/.test(validateProject) && /P99 notification preferences validator passes/.test(validateProject))
add("README keeps P99 complete while marking P109 latest", /\| 99 \| Notification domain model and preferences/.test(readme) && /Latest completed implementation phase:\s+\*\*P109 - Creative Studio dashboard shell and read-only job review\*\*/.test(readme) && /P110 - Creative Studio apply controls and cache-safe public asset updates/.test(readme))
add("roadmap marks P99 complete in P109 progression", /\| P99 \| Notification domain model and preferences\. \|/.test(roadmap) && /Completed through \*\*P109 - Creative Studio dashboard shell and read-only job review\*\*/.test(roadmap))
add("source of truth names P109 baseline", /after P109 Creative Studio dashboard shell and read-only job review/.test(sourceOfTruth) && /Notification domain model and preferences exists/.test(sourceOfTruth))

for (const check of checks) {
  console.log(`${check.pass ? "OK" : "FAIL"} ${check.name}${check.detail ? ` (${check.detail})` : ""}`)
}

const failed = checks.filter((check) => !check.pass)
if (failed.length > 0) {
  console.error(`\n${failed.length} notification preference validation check(s) failed.`)
  process.exit(1)
}
