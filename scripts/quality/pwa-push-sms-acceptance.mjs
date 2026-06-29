#!/usr/bin/env node
import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"

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

function git(args) {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8" })
  return result.status === 0 ? result.stdout.trim().split(/\r?\n/).filter(Boolean) : []
}

const trackedFiles = git(["ls-files"])
const trackedSet = new Set(trackedFiles)
const packageJson = JSON.parse(read("package.json"))
const scripts = packageJson.scripts || {}
const envExample = exists(".env.example") ? read(".env.example") : ""
const gitignore = exists(".gitignore") ? read(".gitignore") : ""
const schema = exists("prisma/schema.prisma") ? read("prisma/schema.prisma") : ""
const smsProvider = exists("lib/sms/sms-provider.ts") ? read("lib/sms/sms-provider.ts") : ""
const smsIrProvider = exists("lib/sms/sms-ir-provider.ts") ? read("lib/sms/sms-ir-provider.ts") : ""
const webPushService = exists("lib/services/web-push-foundation.service.ts") ? read("lib/services/web-push-foundation.service.ts") : ""
const runtimeEnv = exists("lib/runtime-env.ts") ? read("lib/runtime-env.ts") : ""
const releaseScript = exists("scripts/release/create-clean-source.mjs") ? read("scripts/release/create-clean-source.mjs") : ""
const cleanVerifier = exists("scripts/quality/verify-clean-source.mjs") ? read("scripts/quality/verify-clean-source.mjs") : ""
const smsIrCanary = "bYh" + "Hp0ax"
const blobTokenPrefix = "vercel_blob" + "_rw_"
const vercelTokenPrefix = "vcp_"

add(".env is not tracked", !trackedSet.has(".env"))
add("private env variants are not tracked", !trackedFiles.some((file) => path.basename(file).startsWith(".env") && file !== ".env.example"))
add("generated/runtime directories are not tracked", !trackedFiles.some((file) => /^(node_modules|\.next|\.release|\.vercel|dist|coverage|\.kilo|playwright-report|test-results)\//.test(file)), trackedFiles.filter((file) => /^(node_modules|\.next|\.release|\.vercel|dist|coverage|\.kilo|playwright-report|test-results)\//.test(file)).join(", "))
add("local database artifacts are not tracked", !trackedFiles.some((file) => /(^|\/)(dev\.db|.*\.sqlite|.*\.sqlite3|.*\.db)$/.test(file)), trackedFiles.filter((file) => /(^|\/)(dev\.db|.*\.sqlite|.*\.sqlite3|.*\.db)$/.test(file)).join(", "))
add(".gitignore excludes private env and generated artifacts", /\.env\*/.test(gitignore) && /!\.env\.example/.test(gitignore) && /\/node_modules/.test(gitignore) && /\/\.next\//.test(gitignore) && /\/test-results\//.test(gitignore) && /\/\.release\//.test(gitignore) && /\*\.sqlite3/.test(gitignore) && /\/dist\//.test(gitignore))

add(".env.example exists", exists(".env.example"))
add(".env.example keeps placeholder-only secrets", /^SMS_IR_API_KEY=$/m.test(envExample) && /^WEB_PUSH_VAPID_PRIVATE_KEY=$/m.test(envExample) && /^BLOB_READ_WRITE_TOKEN=$/m.test(envExample) && /^AI_MEDIA_SERVICE_INTERNAL_KEY=$/m.test(envExample) && /^VERCEL_ACCESS_TOKEN=$/m.test(envExample) && !new RegExp(`${smsIrCanary}|${blobTokenPrefix}|${vercelTokenPrefix}[A-Za-z0-9]`).test(envExample))

const secretPatterns = [
  new RegExp(smsIrCanary, "i"),
  new RegExp(`${blobTokenPrefix}[A-Za-z0-9_:-]{12,}`),
  new RegExp(`${vercelTokenPrefix}[A-Za-z0-9_:-]{12,}`),
  /-----BEGIN (?:RSA |EC |OPENSSH |)PRIVATE KEY-----/,
]
const secretFindings = []
for (const file of trackedFiles) {
  if (!exists(file)) continue
  if (file === ".env.example") continue
  const ext = path.extname(file).toLowerCase()
  if (![".json", ".js", ".mjs", ".ts", ".tsx", ".md", ".prisma", ".sql", ".yml", ".yaml", ".ps1", ".css", ".html", ".svg", ".txt"].includes(ext)) continue
  const text = read(file)
  if (secretPatterns.some((pattern) => pattern.test(text))) secretFindings.push(file)
}
add("tracked source contains no real-looking secret values", secretFindings.length === 0, secretFindings.join(", "))

add("PWA manifest exists", exists("app/manifest.ts") && /start_url:\s*"\/fa"/.test(read("app/manifest.ts")))
add("PWA icons/assets exist", exists("public/pwa-icon.svg") && exists("public/pwa-maskable-icon.svg"))
add("service worker and offline shell exist", exists("public/web-push-sw.js") && exists("public/offline.html"))
add("service worker has offline and push handlers", /addEventListener\("fetch"/.test(read("public/web-push-sw.js")) && /addEventListener\("push"/.test(read("public/web-push-sw.js")) && /notificationclick/.test(read("public/web-push-sw.js")))
add("install UX exists", exists("components/pwa-install-manager.tsx") && /beforeinstallprompt/.test(read("components/pwa-install-manager.tsx")))

add("notification preference model exists", /model NotificationPreference\s*\{[\s\S]*channel\s+NotificationChannel/.test(schema))
add("Web Push delivery model exists", /model WebPushDelivery\s*\{[\s\S]*status\s+WebPushDeliveryStatus/.test(schema))
add("SMS delivery model exists", /model SmsDelivery\s*\{[\s\S]*status\s+SmsDeliveryStatus/.test(schema))
add("Push subscription model exists", /model PushSubscription\s*\{[\s\S]*endpoint\s+String/.test(schema))

add("notification preference service exists", exists("lib/services/notification-preferences.service.ts") && /NOTIFICATION_CHANNELS = \["IN_APP", "WEB_PUSH", "SMS"\]/.test(read("lib/services/notification-preferences.service.ts")))
add("Web Push service and routes exist", exists("lib/services/web-push-foundation.service.ts") && exists("app/api/customer/push-subscriptions/route.ts") && exists("app/api/dashboard/customer-club/push/route.ts"))
add("SMS provider abstraction exists", exists("lib/sms/sms.types.ts") && exists("lib/sms/sms-dry-run-provider.ts") && exists("lib/sms/sms-ir-provider.ts") && exists("lib/sms/index.ts"))
add("sms.ir provider has no hardcoded credentials", /process\.env\.SMS_IR_API_KEY/.test(smsIrProvider) && !new RegExp(`${smsIrCanary}|SMS_IR_API_KEY\\s*=\\s*["'][^"']+`).test(smsIrProvider))
add("SMS real send has explicit rollout guards", /DEPLOYED_ALLOW_REAL_SMS/.test(smsProvider) && /DEPLOYED_SMS_TARGET_MOBILE/.test(smsProvider) && /SMS_REAL_SEND_OPERATOR_CONFIRMED/.test(smsProvider) && /SMS_IR_USERNAME/.test(smsProvider))
add("runtime env enforces SMS and Web Push guardrails", /DEPLOYED_ALLOW_REAL_SMS=1 is required/.test(runtimeEnv) && /SMS_IR_USERNAME is required/.test(runtimeEnv) && /WEB_PUSH_ENABLED=true is required/.test(runtimeEnv))
add("Web Push real send requires WEB_PUSH_ENABLED", /WEB_PUSH_ENABLED/.test(webPushService) && /WEB_PUSH_REAL_SEND_ENABLED/.test(webPushService) && /realSendEnabled = enabled/.test(webPushService))

add("notification routing exists", exists("lib/notifications/router.ts") && exists("lib/notifications/templates.ts") && exists("lib/notifications/delivery-policy.ts"))
add("notification operations dashboard exists", exists("lib/services/notification-operations.service.ts") && exists("app/api/dashboard/notification-operations/route.ts") && exists("app/[locale]/dashboard/notification-operations/page.tsx"))
add("deployed smoke scripts exist", exists("scripts/e2e/deployed-pwa-push-sms-smoke.mjs") && exists("scripts/quality/validate-deployed-pwa-push-sms.mjs"))
add("production rollout runbook exists", exists("docs/PHASE_105_PRODUCTION_ROLLOUT_RUNBOOK.md") && /Status: implemented/.test(read("docs/PHASE_105_PRODUCTION_ROLLOUT_RUNBOOK.md")))

const requiredScripts = [
  "quality:source-baseline",
  "quality:open-fields-audit",
  "quality:pwa-foundation",
  "quality:pwa-offline-shell",
  "quality:notification-preferences",
  "quality:web-push-delivery",
  "quality:sms-provider",
  "quality:notification-routing",
  "quality:notification-operations",
  "quality:deployed-pwa-push-sms",
  "quality:production-rollout",
  "e2e:deployed:pwa-push-sms",
  "release:pwa-push-sms-rollout-evidence",
  "release:clean-source",
  "quality:clean-source",
  "quality:pwa-push-sms-acceptance",
  "release:pwa-push-sms-acceptance-evidence",
]
const missingScripts = requiredScripts.filter((script) => !scripts[script])
const missingTargets = requiredScripts
  .filter((script) => scripts[script]?.startsWith("node "))
  .map((script) => scripts[script].replace(/^node\s+/, "").split(/\s+/)[0])
  .filter((target) => !exists(target))
add("P95-P106 package scripts exist", missingScripts.length === 0, missingScripts.join(", "))
add("package script targets exist", missingTargets.length === 0, missingTargets.join(", "))
add("clean source scripts exist", /blockedDirs/.test(releaseScript) && /dist/.test(releaseScript) && /Expand-Archive/.test(cleanVerifier))

for (const check of checks) {
  console.log(`${check.pass ? "OK" : "FAIL"} ${check.name}${check.detail ? ` (${check.detail})` : ""}`)
}

const failed = checks.filter((check) => !check.pass)
if (failed.length > 0) {
  console.error(`\n${failed.length} PWA/Push/SMS acceptance validation check(s) failed.`)
  process.exit(1)
}
