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

const policy = read("lib/services/ai-media-paid-provider.ts")
const service = read("lib/services/ai-media.service.ts")
const runtimeEnv = read("lib/runtime-env.ts")
const deployedSmoke = read("scripts/e2e/deployed-ai-media-smoke.mjs")
const archive = read("scripts/release/archive-ai-media-rollout-evidence.mjs")
const packageJson = read("package.json")
const validateProject = read("scripts/quality/validate-project.mjs")
const readme = read("README.md")
const sourceOfTruth = read("docs/CURRENT_SOURCE_OF_TRUTH.md")
const roadmap = read("docs/NEXT_PHASE_ROADMAP.md")
const phaseDoc = exists("docs/PHASE_93_AI_MEDIA_COST_ROLLBACK.md")
  ? read("docs/PHASE_93_AI_MEDIA_COST_ROLLBACK.md")
  : ""

add("paid provider policy includes rollback state", /AI_MEDIA_PAID_PROVIDER_ROLLBACK_PAUSED/.test(policy) && /rollback:\s*{/.test(policy) && /enabled:\s*requested && configured && !rollbackPaused/.test(policy))
add("paid provider policy requires estimated job cost", /AI_MEDIA_PAID_PROVIDER_ESTIMATED_JOB_COST_CENTS/.test(policy) && /estimatedJobCostCents/.test(policy))
add("runtime env validates rollback reason and estimated job cost", /aiMediaPaidProviderHasEstimatedJobCost/.test(runtimeEnv) && /AI_MEDIA_PAID_PROVIDER_ROLLBACK_REASON/.test(runtimeEnv))
add("usage summary exposes cost telemetry", /costTelemetry/.test(service) && /dailyEstimatedCostCents/.test(service) && /monthlyEstimatedCostCents/.test(service))
add("service records job cost telemetry metadata", /estimatedCostCents/.test(service) && /costTelemetryMode/.test(service) && /rollbackPaused/.test(service))
add("service blocks rollback-paused create attempts", /rollback\.paused/.test(service) && /rollout is paused/.test(service))
add("service enforces daily and monthly cost guardrails", /daily cost limit exceeded/.test(service) && /monthly budget exceeded/.test(service))
add("deployed smoke captures cost telemetry evidence", /latestCostTelemetry/.test(deployedSmoke) && /usage\.costTelemetry/.test(deployedSmoke) && /rollbackPaused !== false/.test(deployedSmoke))
add("archive checklist covers cost and rollback review", /Cost telemetry is present/.test(archive) && /Rollback status is reviewed/.test(archive))
add("package exposes P93 validator", /"quality:ai-media-cost-rollback":\s*"node scripts\/quality\/validate-ai-media-cost-rollback\.mjs"/.test(packageJson))
add("project validator references P93 validator", /validate-ai-media-cost-rollback\.mjs/.test(validateProject) && /P93 AI media cost rollback validator passes/.test(validateProject))
add("P93 phase doc exists", exists("docs/PHASE_93_AI_MEDIA_COST_ROLLBACK.md") && /Status: implemented/.test(phaseDoc))
add("roadmap docs mark P93 complete and next phase", /P93/.test(readme) && /P93/.test(sourceOfTruth) && /P93/.test(roadmap) && /P94/.test(readme) && /P94/.test(sourceOfTruth) && /P94/.test(roadmap))

console.table(results)
const failed = results.filter((result) => !result.ok)
if (failed.length) {
  console.error(`AI media cost and rollback validation failed with ${failed.length} issue(s).`, failed)
  process.exit(1)
}

console.log("AI media cost and rollback validation passed.")
