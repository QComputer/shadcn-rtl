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
const migration = exists("prisma/migrations/20260629000600_sms_provider_delivery/migration.sql")
  ? read("prisma/migrations/20260629000600_sms_provider_delivery/migration.sql")
  : ""
const smsIndex = exists("lib/sms/index.ts") ? read("lib/sms/index.ts") : ""
const smsTypes = exists("lib/sms/sms.types.ts") ? read("lib/sms/sms.types.ts") : ""
const smsProvider = exists("lib/sms/sms-provider.ts") ? read("lib/sms/sms-provider.ts") : ""
const dryRunProvider = exists("lib/sms/sms-dry-run-provider.ts") ? read("lib/sms/sms-dry-run-provider.ts") : ""
const smsIrProvider = exists("lib/sms/sms-ir-provider.ts") ? read("lib/sms/sms-ir-provider.ts") : ""
const preferences = exists("lib/services/notification-preferences.service.ts")
  ? read("lib/services/notification-preferences.service.ts")
  : ""
const runtimeEnv = exists("lib/runtime-env.ts") ? read("lib/runtime-env.ts") : ""
const envValidator = exists("scripts/quality/validate-env.mjs") ? read("scripts/quality/validate-env.mjs") : ""
const envExample = exists(".env.example") ? read(".env.example") : ""
const packageJson = exists("package.json") ? read("package.json") : ""
const validateProject = exists("scripts/quality/validate-project.mjs") ? read("scripts/quality/validate-project.mjs") : ""
const readme = exists("README.md") ? read("README.md") : ""
const roadmap = exists("docs/NEXT_PHASE_ROADMAP.md") ? read("docs/NEXT_PHASE_ROADMAP.md") : ""
const sourceOfTruth = exists("docs/CURRENT_SOURCE_OF_TRUTH.md") ? read("docs/CURRENT_SOURCE_OF_TRUTH.md") : ""
const smsDeliveryModel = schema.match(/model SmsDelivery\s*\{[\s\S]*?\n\}/)?.[0] || ""

add("P101 phase document exists", exists("docs/PHASE_101_SMS_PROVIDER.md"))
add("schema defines SMS delivery status", /enum SmsDeliveryStatus\s*\{[\s\S]*PENDING[\s\S]*SENT[\s\S]*FAILED[\s\S]*SKIPPED[\s\S]*\}/.test(schema))
add("schema defines SmsDelivery model", /model SmsDelivery\s*\{[\s\S]*organizationId\s+String[\s\S]*customerId\s+String[\s\S]*phoneMasked\s+String[\s\S]*purpose\s+String[\s\S]*message\s+String\s+@db\.Text[\s\S]*provider\s+String\s+@default\("dry_run"\)[\s\S]*dryRun\s+Boolean\s+@default\(true\)[\s\S]*status\s+SmsDeliveryStatus\s+@default\(PENDING\)[\s\S]*\}/.test(schema))
add("schema relates SMS deliveries to organization customer and actor", /smsDeliveries\s+SmsDelivery\[\]/.test(schema) && /actorSmsDeliveries\s+SmsDelivery\[\]/.test(schema))
add("schema indexes SMS delivery operations", /@@index\(\[organizationId,\s*status,\s*createdAt\]\)/.test(schema) && /@@index\(\[customerId,\s*createdAt\]\)/.test(schema) && /@@index\(\[purpose,\s*createdAt\]\)/.test(schema))
add("migration creates SMS delivery enum and table", /CREATE TYPE "SmsDeliveryStatus" AS ENUM \('PENDING', 'SENT', 'FAILED', 'SKIPPED'\)/.test(migration) && /CREATE TABLE IF NOT EXISTS "SmsDelivery"/.test(migration))
add("migration creates SMS delivery indexes and foreign keys", /SmsDelivery_organizationId_status_createdAt_idx/.test(migration) && /SmsDelivery_customerId_createdAt_idx/.test(migration) && /SmsDelivery_organizationId_fkey/.test(migration) && /SmsDelivery_customerId_fkey/.test(migration))

add("SMS types define provider interface and purposes", /export interface SmsProvider/.test(smsTypes) && /sendText/.test(smsTypes) && /sendVerifyCode/.test(smsTypes) && /marketing_broadcast/.test(smsTypes))
add("SMS masking helper avoids storing raw phone numbers", /maskPhoneNumber/.test(smsTypes) && /phoneMasked\s+String/.test(smsDeliveryModel) && !/\bphone\s+String/.test(smsDeliveryModel) && !/\bto\s+String/.test(smsDeliveryModel))
add("SMS runtime config defaults to dry-run", /normalizeSmsProvider/.test(smsProvider) && /SMS_DRY_RUN/.test(smsProvider) && /provider === "dry_run"/.test(smsProvider))
add("SMS runtime config recognizes sms.ir env", /SMS_IR_USERNAME/.test(smsProvider) && /SMS_IR_API_KEY/.test(smsProvider) && /SMS_IR_LINE_NUMBER/.test(smsProvider) && /SMS_IR_BASE_URL/.test(smsProvider))
add("SMS real send requires explicit rollout approval and target", /DEPLOYED_ALLOW_REAL_SMS/.test(smsProvider) && /DEPLOYED_SMS_TARGET_MOBILE/.test(smsProvider) && /SMS_REAL_SEND_OPERATOR_CONFIRMED/.test(smsProvider) && /usernameConfigured/.test(smsProvider))
add("dry-run provider does not call external services", /class SmsDryRunProvider/.test(dryRunProvider) && /provider:\s*"dry_run"/.test(dryRunProvider) && !/fetch\(/.test(dryRunProvider))
add("sms.ir provider uses REST API key header and send endpoints", /class SmsIrProvider/.test(smsIrProvider) && /"X-API-KEY"/.test(smsIrProvider) && /\/v1\/send\/bulk/.test(smsIrProvider) && /\/v1\/send\/verify/.test(smsIrProvider))
add("sms.ir provider refuses when real sending disabled or unconfigured", /Real SMS sending is disabled/.test(smsIrProvider) && /SMS\.ir is not configured/.test(smsIrProvider))
add("SMS service creates provider through single boundary", /createSmsProvider/.test(smsIndex) && /new SmsIrProvider/.test(smsIndex) && /new SmsDryRunProvider/.test(smsIndex))
add("SMS service checks preferences before delivery", /isCustomerDeliveryAllowed/.test(preferences) && /channel:\s*"SMS"/.test(smsIndex) && /preferenceKind/.test(smsIndex))
add("SMS service records skipped and attempted deliveries", /smsDelivery\.create[\s\S]*status:\s*"SKIPPED"/.test(smsIndex) && /smsDelivery\.create[\s\S]*status:\s*"PENDING"/.test(smsIndex) && /smsDelivery\.update[\s\S]*status:\s*result\.ok \? "SENT" : "FAILED"/.test(smsIndex))
add("SMS audit logs use masked phone data", /writeAuditLog/.test(smsIndex) && /phoneMasked:\s*maskPhoneNumber/.test(smsIndex))

add("runtime environment summarizes SMS provider state", /smsProvider/.test(runtimeEnv) && /smsDryRun/.test(runtimeEnv) && /smsIrConfigured/.test(runtimeEnv) && /smsRealSendEnabled/.test(runtimeEnv))
add("runtime environment blocks live sms.ir without secrets and approval", /DEPLOYED_ALLOW_REAL_SMS=1 is required/.test(runtimeEnv) && /SMS_IR_USERNAME is required/.test(runtimeEnv) && /SMS_IR_API_KEY is required when real SMS\.ir sending is enabled/.test(runtimeEnv) && /SMS_IR_LINE_NUMBER or SMS_IR_LINE is required/.test(runtimeEnv))
add("env validator keeps SMS dry-run safeguards", /SMS_PROVIDER/.test(envValidator) && /SMS_DRY_RUN/.test(envValidator) && /DEPLOYED_ALLOW_REAL_SMS=1 is required/.test(envValidator) && /SMS_IR_API_KEY is required/.test(envValidator))
add(".env.example keeps placeholder-only SMS config", /SMS_PROVIDER=DRY_RUN/.test(envExample) && /SMS_DRY_RUN=true/.test(envExample) && /DEPLOYED_ALLOW_REAL_SMS=0/.test(envExample) && /^SMS_IR_API_KEY=$/m.test(envExample) && /^SMS_IR_LINE_NUMBER=$/m.test(envExample))
add("package exposes P101 validator", /"quality:sms-provider":\s*"node scripts\/quality\/validate-sms-provider\.mjs"/.test(packageJson))
add("project validator references P101 validator", /validate-sms-provider\.mjs/.test(validateProject) && /P101 SMS provider validator passes/.test(validateProject))
add("README keeps P101 complete while marking P109 latest", /\| 101 \| SMS provider abstraction and sms\.ir integration/.test(readme) && /Latest completed implementation phase:\s+\*\*P119 - Creative Studio provider result ingestion and review stabilization\*\*/.test(readme) && /P120 - Creative Studio reviewed asset apply and rollback workflow/.test(readme))
add("roadmap keeps P101 complete while marking P109 baseline", /\| P101 \| SMS provider abstraction and sms\.ir integration\. \|/.test(roadmap) && /Completed through \*\*P119 - Creative Studio provider result ingestion and review stabilization\*\*/.test(roadmap))
add("source of truth names P109 baseline", /after P119 Creative Studio provider result ingestion and review stabilization/.test(sourceOfTruth) && /SMS provider abstraction exists/.test(sourceOfTruth))

for (const check of checks) {
  console.log(`${check.pass ? "OK" : "FAIL"} ${check.name}${check.detail ? ` (${check.detail})` : ""}`)
}

const failed = checks.filter((check) => !check.pass)
if (failed.length > 0) {
  console.error(`\n${failed.length} SMS provider validation check(s) failed.`)
  process.exit(1)
}
