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

const policy = exists("lib/services/ai-media-paid-provider.ts")
  ? read("lib/services/ai-media-paid-provider.ts")
  : ""
const service = read("lib/services/ai-media.service.ts")
const statusRoute = read("app/api/dashboard/ai-media/status/route.ts")
const runtimeEnv = read("lib/runtime-env.ts")
const deployedSmoke = read("scripts/e2e/deployed-ai-media-smoke.mjs")
const packageJson = read("package.json")
const validateProject = read("scripts/quality/validate-project.mjs")
const readme = read("README.md")
const sourceOfTruth = read("docs/CURRENT_SOURCE_OF_TRUTH.md")
const roadmap = read("docs/NEXT_PHASE_ROADMAP.md")
const phaseDoc = exists("docs/PHASE_92_AI_MEDIA_PAID_PROVIDER_CONTROLS.md")
  ? read("docs/PHASE_92_AI_MEDIA_PAID_PROVIDER_CONTROLS.md")
  : ""

add("paid provider policy helper is server-only", /import "server-only"/.test(policy) && /getAiMediaPaidProviderStatus/.test(policy))
add("paid provider defaults off unless explicitly requested", /AI_MEDIA_PAID_PROVIDER_ENABLED/.test(policy) && /requested && configured/.test(policy))
add("paid provider requires approval metadata", /AI_MEDIA_PAID_PROVIDER_APPROVED/.test(policy) && /AI_MEDIA_PAID_PROVIDER_APPROVED_BY/.test(policy) && /AI_MEDIA_PAID_PROVIDER_APPROVED_AT/.test(policy))
add("paid provider requires cost guardrails", /AI_MEDIA_PAID_PROVIDER_DAILY_COST_LIMIT_CENTS/.test(policy) && /AI_MEDIA_PAID_PROVIDER_MONTHLY_BUDGET_CENTS/.test(policy))
add("runtime env rejects incomplete paid provider enablement", /aiMediaPaidProviderRequested/.test(runtimeEnv) && /Paid AI media requires approval metadata/.test(runtimeEnv))
add("status route exposes secret-safe paid provider status", /getAiMediaPaidProviderStatus/.test(statusRoute) && /paidProvider/.test(statusRoute) && !/process\.env\.AI_MEDIA_PAID/.test(statusRoute))
add("usage summary carries paid provider status", /getAiMediaPaidProviderStatus/.test(service) && /paidGenerationEnabled:\s*paidProvider\.enabled/.test(service) && /paidProvider/.test(service))
add("deployed smoke asserts paid provider remains disabled", /paid provider must remain disabled/.test(deployedSmoke) && /paid provider policy must remain disabled/.test(deployedSmoke))
add("package exposes P92 paid provider validator", /"quality:ai-media-paid-provider-controls":\s*"node scripts\/quality\/validate-ai-media-paid-provider-controls\.mjs"/.test(packageJson))
add("project validator references P92 validator", /validate-ai-media-paid-provider-controls\.mjs/.test(validateProject) && /P92 AI media paid provider controls validator passes/.test(validateProject))
add("P92 phase doc exists", exists("docs/PHASE_92_AI_MEDIA_PAID_PROVIDER_CONTROLS.md") && /Status: implemented/.test(phaseDoc))
add("roadmap docs mark P92 complete and next phase", /P92/.test(readme) && /P92/.test(sourceOfTruth) && /P92/.test(roadmap) && /P93/.test(readme) && /P93/.test(sourceOfTruth) && /P93/.test(roadmap))

console.table(results)
const failed = results.filter((result) => !result.ok)
if (failed.length) {
  console.error(`AI media paid provider controls validation failed with ${failed.length} issue(s).`, failed)
  process.exit(1)
}

console.log("AI media paid provider controls validation passed.")
