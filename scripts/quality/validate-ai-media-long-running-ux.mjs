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

const service = read("lib/services/ai-media.service.ts")
const pollRoute = read("app/api/dashboard/ai-image-suggestions/[jobId]/route.ts")
const cancelRoute = exists("app/api/dashboard/ai-image-suggestions/[jobId]/cancel/route.ts")
  ? read("app/api/dashboard/ai-image-suggestions/[jobId]/cancel/route.ts")
  : ""
const productRoute = read("app/api/dashboard/products/[productId]/ai-image-suggestions/route.ts")
const editPage = read("app/[locale]/dashboard/products/[id]/page.tsx")
const packageJson = read("package.json")
const sourceOfTruth = read("docs/CURRENT_SOURCE_OF_TRUTH.md")
const roadmap = read("docs/NEXT_PHASE_ROADMAP.md")

add("service exposes local job snapshot type", /export type AiMediaLocalJob/.test(service) && /requestedByUserId/.test(service))
add("service normalizes stored outputs for local recovery", /function normalizeStoredOutputs/.test(service) && /typeof output\.url === "string"/.test(service))
add("service converts local job to remote-compatible status", /localAiMediaJobToRemoteJob/.test(service) && /created_at: job\.createdAt\.toISOString\(\)/.test(service))
add("service returns local fallback when remote polling is unavailable", /getJobStatus/.test(service) && /remoteUnavailable: true/.test(service) && /localAiMediaJobToRemoteJob\(localJob\)/.test(service))
add("service supports latest product AI job recovery", /getLatestProductJob/.test(service) && /orderBy: \{ createdAt: "desc" \}/.test(service))
add("service restricts cancelable AI jobs to queued or processing", /Only queued or processing AI media jobs can be canceled/.test(service) && /\["QUEUED", "PROCESSING"\]/.test(service))
add("poll route returns remote unavailable flag with local status", /getJobStatus\(jobId\)/.test(pollRoute) && /remoteUnavailable: status\.remoteUnavailable/.test(pollRoute))
add("product AI route exposes latest local job recovery", /export async function GET/.test(productRoute) && /getLatestProductJob/.test(productRoute) && /outputs: localJob\.outputs/.test(productRoute))
add("cancel route exists and is organization scoped", /requireOrgAccess/.test(cancelRoute) && /aiMediaService\.cancelJob/.test(cancelRoute))
add("edit UI uses bounded long-running polling constants", /AI_JOB_POLL_INTERVAL_MS/.test(editPage) && /AI_JOB_MAX_POLL_ATTEMPTS/.test(editPage))
add("edit UI avoids overlapping polling with timeout cleanup", /aiPollTimerRef/.test(editPage) && /setTimeout\(pollOnce, AI_JOB_POLL_INTERVAL_MS\)/.test(editPage) && /clearAiPollingTimer/.test(editPage))
add("edit UI surfaces last-known local status", /آخرین وضعیت محلی/.test(editPage) && /formatAiTimestamp/.test(editPage) && /aiJobProvider/.test(editPage))
add("edit UI exposes continue polling recovery", /recoverLatestAiJob/.test(editPage) && /ادامه آخرین درخواست/.test(editPage) && /ادامه پیگیری/.test(editPage))
add("edit UI exposes seller cancel affordance", /cancelAiJob/.test(editPage) && /لغو درخواست/.test(editPage))
add("edit UI includes Persian timeout copy for slow jobs", /درخواست تصویر هنوز در صف یا در حال پردازش است/.test(editPage))
add("package exposes P87 long-running UX validator", /"quality:ai-media-long-running-ux":\s*"node scripts\/quality\/validate-ai-media-long-running-ux\.mjs"/.test(packageJson))
add("source of truth names P87 long-running UX", /P87/.test(sourceOfTruth) && /(Long-Running|long-running)/.test(sourceOfTruth))
add("roadmap advances next phase to P88", /P88 - Usage logs, quotas, and audit controls/.test(roadmap) || /P88 \| Usage logs, quotas, and audit controls/.test(roadmap))

console.table(results)
const failed = results.filter((result) => !result.ok)
if (failed.length) {
  console.error(`AI media long-running UX validation failed with ${failed.length} issue(s).`, failed)
  process.exit(1)
}

console.log("AI media long-running UX validation passed.")
