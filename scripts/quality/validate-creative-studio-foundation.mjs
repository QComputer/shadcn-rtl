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

const schema = read("prisma/schema.prisma")
const migration = exists("prisma/migrations/20260630000100_creative_studio_foundation/migration.sql")
  ? read("prisma/migrations/20260630000100_creative_studio_foundation/migration.sql")
  : ""
const service = exists("lib/services/creative-studio.service.ts")
  ? read("lib/services/creative-studio.service.ts")
  : ""
const validators = read("lib/validators/index.ts")
const packageJson = read("package.json")
const validateProject = read("scripts/quality/validate-project.mjs")
const readme = read("README.md")
const roadmap = read("docs/NEXT_PHASE_ROADMAP.md")
const sourceOfTruth = read("docs/CURRENT_SOURCE_OF_TRUTH.md")
const doc = exists("docs/PHASE_108_CREATIVE_STUDIO_SERVER_FOUNDATION.md")
  ? read("docs/PHASE_108_CREATIVE_STUDIO_SERVER_FOUNDATION.md")
  : ""

const routeFiles = [
  "app/api/dashboard/creative-studio/status/route.ts",
  "app/api/dashboard/creative-studio/usage/route.ts",
  "app/api/dashboard/creative-studio/jobs/route.ts",
  "app/api/dashboard/creative-studio/jobs/[jobId]/route.ts",
  "app/api/dashboard/creative-studio/jobs/[jobId]/cancel/route.ts",
  "app/api/dashboard/creative-studio/assets/[assetId]/apply/route.ts",
]
const routes = routeFiles.map((file) => exists(file) ? read(file) : "").join("\n")

add("P108 phase document exists", exists("docs/PHASE_108_CREATIVE_STUDIO_SERVER_FOUNDATION.md") && /Status: implemented/.test(doc))
add("schema defines Creative Studio enums", /enum CreativeStudioTargetType/.test(schema) && /enum CreativeStudioAssetType/.test(schema) && /enum CreativeStudioUsageAction/.test(schema))
add("schema defines Creative Studio job asset and usage models", /model CreativeStudioJob/.test(schema) && /model CreativeStudioAsset/.test(schema) && /model CreativeStudioUsageEvent/.test(schema))
add("schema keeps organization and target indexes", /@@index\(\[organizationId, status, createdAt\]\)/.test(schema) && /@@index\(\[targetType, targetId\]\)/.test(schema))
add("migration creates Creative Studio tables and enums", /CREATE TYPE "CreativeStudioTargetType"/.test(migration) && /CREATE TABLE "CreativeStudioJob"/.test(migration) && /CREATE TABLE "CreativeStudioAsset"/.test(migration) && /CREATE TABLE "CreativeStudioUsageEvent"/.test(migration))
add("migration adds job asset usage foreign keys", /CreativeStudioAsset_jobId_fkey/.test(migration) && /CreativeStudioUsageEvent_jobId_fkey/.test(migration) && /CreativeStudioUsageEvent_assetId_fkey/.test(migration))

add("service exists", exists("lib/services/creative-studio.service.ts"))
add("service is MOCK-only and local", /provider:\s*"MOCK"/.test(service) && /realProviderEnabled:\s*false/.test(service) && !/createAiMediaJob\(/.test(service) && !/fetch\(/.test(service))
add("service enforces paid-provider rollback and quotas", /getAiMediaPaidProviderStatus/.test(service) && /rollback\.paused/.test(service) && /CREATIVE_STUDIO_DAILY_JOB_LIMIT/.test(service))
add("service enforces target access", /assertTargetAccess/.test(service) && /hasPermission\(role, "product:update"\)/.test(service) && /campaign\.findFirst/.test(service) && /fanpagePost\.findFirst/.test(service))
add("service writes job asset and usage rows", /creativeStudioJob\.create/.test(service) && /creativeStudioAsset\.create/.test(service) && /creativeStudioUsageEvent/.test(service))
add("service writes audit logs", /writeAuditLog/.test(service) && /CreativeStudioJob/.test(service) && /CreativeStudioAsset/.test(service))
add("service preserves P108 recorded-only apply path", /if \(!input\.applyToTarget\)/.test(service) && /recordedOnly:\s*true/.test(service) && /publicMutation:\s*false/.test(service))
add("P110 owns explicit public mutation controls", /resolveCreativeStudioApplyTarget/.test(service) && /assertPublicSafeAssetUrl/.test(service) && /revalidateCreativeStudioPublicTarget/.test(service))

add("validators define Creative Studio schemas", /createCreativeStudioJobSchema/.test(validators) && /creativeStudioJobFilterSchema/.test(validators) && /applyCreativeStudioAssetSchema/.test(validators))
add("routes exist", routeFiles.every((file) => exists(file)), routeFiles.filter((file) => !exists(file)).join(", "))
add("routes require dashboard auth and organization access", /requireCreativeStudioOrganization/.test(routes) && /requireAuthSession/.test(read("app/api/dashboard/creative-studio/_helpers.ts")) && /requireOrgAccess/.test(read("app/api/dashboard/creative-studio/_helpers.ts")))
add("routes expose status usage jobs cancel and apply", /creativeStudioService\.getStatus/.test(routes) && /getUsageSummary/.test(routes) && /createJob/.test(routes) && /cancelJob/.test(routes) && /recordAssetApplication/.test(routes))
add("apply route delegates public mutation policy to service", /recordAssetApplication/.test(read("app/api/dashboard/creative-studio/assets/[assetId]/apply/route.ts")) && /session\.user\.role/.test(read("app/api/dashboard/creative-studio/assets/[assetId]/apply/route.ts")))

add("package exposes P108 validator", /"quality:creative-studio-foundation":\s*"node scripts\/quality\/validate-creative-studio-foundation\.mjs"/.test(packageJson))
add("project validator references P108 validator", /validate-creative-studio-foundation\.mjs/.test(validateProject) && /P108 Creative Studio foundation validator passes/.test(validateProject))
add("README marks P110 latest", /Latest completed implementation phase:\s+\*\*P120 - Creative Studio reviewed asset apply and rollback workflow\*\*/.test(readme) && /Recommended next phase:\s+\*\*P120B - Customer order lifecycle notifications and guest SMS dry-run review\*\*/.test(readme))
add("roadmap keeps P108 complete in P110 progression", /Completed through \*\*P120 - Creative Studio reviewed asset apply and rollback workflow\*\*/.test(roadmap) && /\| P108 \| Creative Studio server foundation\. \|/.test(roadmap) && /\| P110 \| Creative Studio apply controls and cache-safe public asset updates\. \|/.test(roadmap))
add("source of truth names P110 baseline", /after P119 Creative Studio provider result ingestion and review stabilization/.test(sourceOfTruth) && /Creative Studio server foundation exists/.test(sourceOfTruth))

for (const check of checks) {
  console.log(`${check.pass ? "OK" : "FAIL"} ${check.name}${check.detail ? ` (${check.detail})` : ""}`)
}

const failed = checks.filter((check) => !check.pass)
if (failed.length > 0) {
  console.error(`\n${failed.length} Creative Studio foundation validation check(s) failed.`)
  process.exit(1)
}
