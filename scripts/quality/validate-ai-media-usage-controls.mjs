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

const schema = read("prisma/schema.prisma")
const service = read("lib/services/ai-media.service.ts")
const usageRoute = exists("app/api/dashboard/ai-media/usage/route.ts")
  ? read("app/api/dashboard/ai-media/usage/route.ts")
  : ""
const packageJson = read("package.json")
const sourceOfTruth = read("docs/CURRENT_SOURCE_OF_TRUTH.md")
const roadmap = read("docs/NEXT_PHASE_ROADMAP.md")
const aiMediaDocs = read("docs/AI_MEDIA_SERVICE.md")

add("AiMediaUsageEvent model exists", /model\s+AiMediaUsageEvent\s*{/.test(schema))
add("AiMediaUsageEvent migration exists", exists("prisma/migrations/20260629008700_add_ai_media_usage_events/migration.sql"))
add("usage event indexes are tenant and audit friendly", /@@index\(\[organizationId, createdAt\]\)/.test(schema) && /@@index\(\[jobId\]\)/.test(schema) && /@@index\(\[action\]\)/.test(schema))
add("service defines AI media usage actions", /type AiMediaUsageAction =/.test(service) && /JOB_CREATED/.test(service) && /IMAGE_SELECTED/.test(service))
add("service reads quota from server env with safe defaults", /AI_MEDIA_DAILY_JOB_LIMIT/.test(service) && /DEFAULT_DAILY_AI_MEDIA_JOB_LIMIT/.test(service))
add("service exposes usage summary", /getUsageSummary/.test(service) && /remainingDailyJobs/.test(service) && /paidGenerationEnabled:\s*paidProvider\.enabled/.test(service) && /paidProvider/.test(service))
add("service blocks create when quota is exhausted", /assertCanCreateJob/.test(service) && /AI media daily generation quota exceeded/.test(service) && /await this\.assertCanCreateJob/.test(service))
add("service records job creation usage", /action: "JOB_CREATED"/.test(service) && /recordUsageEvent/.test(service))
add("service records terminal job usage", /JOB_COMPLETED/.test(service) && /JOB_FAILED/.test(service) && /JOB_CANCELED/.test(service) && /dedupeByJobAndAction/.test(service))
add("service records selected image usage", /action: "IMAGE_SELECTED"/.test(service) && /storageStatus/.test(service))
add("usage route is authenticated and organization scoped", /requireAuthSession/.test(usageRoute) && /requireOrgAccess/.test(usageRoute) && /getUsageSummary/.test(usageRoute))
add("usage route supports SUPER_ADMIN organization query", /session\.user\.role === "SUPER_ADMIN"/.test(usageRoute) && /searchParams\.get\("organizationId"\)/.test(usageRoute))
add("package exposes P88 usage controls validator", /"quality:ai-media-usage-controls":\s*"node scripts\/quality\/validate-ai-media-usage-controls\.mjs"/.test(packageJson))
add("AI media docs describe usage endpoint and quotas", /\/api\/dashboard\/ai-media\/usage/.test(aiMediaDocs) && /AI_MEDIA_DAILY_JOB_LIMIT/.test(aiMediaDocs))
add("source of truth names P88 usage controls", /P88/.test(sourceOfTruth) && /(Usage Logs|usage logs|usage controls)/.test(sourceOfTruth))
add("roadmap includes P89 import AI media bridge follow-up", /P89 - Import draft product to AI image suggestion workflow integration/.test(roadmap) || /P89 \| Import draft product to AI image suggestion workflow integration/.test(roadmap) || /P89 \| Import draft product to AI image suggestion bridge/.test(roadmap))

console.table(results)
const failed = results.filter((result) => !result.ok)
if (failed.length) {
  console.error(`AI media usage controls validation failed with ${failed.length} issue(s).`, failed)
  process.exit(1)
}

console.log("AI media usage controls validation passed.")
