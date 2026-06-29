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

const smoke = exists("scripts/e2e/deployed-ai-media-smoke.mjs")
  ? read("scripts/e2e/deployed-ai-media-smoke.mjs")
  : ""
const packageJson = read("package.json")
const validateProject = read("scripts/quality/validate-project.mjs")
const readme = read("README.md")
const sourceOfTruth = read("docs/CURRENT_SOURCE_OF_TRUTH.md")
const roadmap = read("docs/NEXT_PHASE_ROADMAP.md")
const phaseDoc = exists("docs/PHASE_90_DEPLOYED_AI_MEDIA_ROLLOUT_GATE.md")
  ? read("docs/PHASE_90_DEPLOYED_AI_MEDIA_ROLLOUT_GATE.md")
  : ""

add("deployed AI media smoke exists", exists("scripts/e2e/deployed-ai-media-smoke.mjs"))
add("smoke defaults deployed credentials safely", /DEPLOYED_USERNAME/.test(smoke) && /DEPLOYED_PASSWORD/.test(smoke) && /"Amir"/.test(smoke))
add("smoke authenticates with credentials session", /api\/auth\/csrf/.test(smoke) && /callback\/credentials/.test(smoke) && /api\/auth\/session/.test(smoke))
add("smoke resolves canonical deployment redirects", /canonical deployment URL resolves/.test(smoke) && /baseUrl = new URL\(location, baseUrl\)\.origin/.test(smoke))
add("smoke resolves organization context", /api\/users\/me\/membership/.test(smoke) && /organizationId/.test(smoke))
add("smoke checks unauthenticated AI media guards", /unauthenticated AI media status is blocked/.test(smoke) && /unauthenticated AI media usage is blocked/.test(smoke) && /unauthenticated AI image select is blocked/.test(smoke))
add("smoke validates authenticated Bazar Baz readiness shape", /dashboard AI media status is secret-safe/.test(smoke) && /status\.ready/.test(smoke) && /DEPLOYED_AI_MEDIA_REQUIRE_READY/.test(smoke))
add("smoke validates usage quotas and paid generation gate", /dashboard AI media usage is quota-shaped/.test(smoke) && /paidGenerationEnabled !== false/.test(smoke) && /dailyJobLimit/.test(smoke))
add("smoke keeps direct Render checks optional", /AI_MEDIA_SERVICE_URL/.test(smoke) && /skip: AI_MEDIA_SERVICE_URL not provided/.test(smoke))
add("smoke verifies MOCK provider behavior when key is provided", /Render AI media service can complete a MOCK job/.test(smoke) && /\/local-output\//.test(smoke))
add("smoke supports optional durable selection probe", /DEPLOYED_AI_MEDIA_SELECTION_PRODUCT_ID/.test(smoke) && /DEPLOYED_AI_MEDIA_REQUIRE_BLOB_SELECTION/.test(smoke) && /storageStatus/.test(smoke))
add("smoke uses Persian fixture text without mojibake", /پیتزا پپرونی/.test(smoke) && !/Ø|Ù|Û/.test(smoke))
add("package exposes P90 validator and deployed smoke", /"quality:deployed-ai-media-rollout":\s*"node scripts\/quality\/validate-deployed-ai-media-rollout\.mjs"/.test(packageJson) && /"e2e:deployed:ai-media":\s*"node scripts\/e2e\/deployed-ai-media-smoke\.mjs"/.test(packageJson))
add("project validator references P90 validator", /validate-deployed-ai-media-rollout\.mjs/.test(validateProject) && /P90 deployed AI media rollout validator passes/.test(validateProject))
add("P90 phase doc exists", exists("docs/PHASE_90_DEPLOYED_AI_MEDIA_ROLLOUT_GATE.md") && /Status: implemented/.test(phaseDoc))
add("roadmap docs mark P90 complete and next phase", /P90/.test(readme) && /P90/.test(sourceOfTruth) && /P90/.test(roadmap) && /P91/.test(readme) && /P91/.test(sourceOfTruth) && /P91/.test(roadmap))

console.table(results)
const failed = results.filter((result) => !result.ok)
if (failed.length) {
  console.error(`Deployed AI media rollout validation failed with ${failed.length} issue(s).`, failed)
  process.exit(1)
}

console.log("Deployed AI media rollout validation passed.")
