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
const archive = exists("scripts/release/archive-ai-media-rollout-evidence.mjs")
  ? read("scripts/release/archive-ai-media-rollout-evidence.mjs")
  : ""
const packageJson = read("package.json")
const validateProject = read("scripts/quality/validate-project.mjs")
const readme = read("README.md")
const sourceOfTruth = read("docs/CURRENT_SOURCE_OF_TRUTH.md")
const roadmap = read("docs/NEXT_PHASE_ROADMAP.md")
const phaseDoc = exists("docs/PHASE_91_AI_MEDIA_ROLLOUT_EVIDENCE.md")
  ? read("docs/PHASE_91_AI_MEDIA_ROLLOUT_EVIDENCE.md")
  : ""

add("deployed smoke writes operator-safe evidence", /test-results\/deployed-ai-media-rollout/.test(smoke) && /evidence\.json/.test(smoke) && /writeEvidence/.test(smoke))
add("evidence redacts password and AI key", /redactEvidence/.test(smoke) && /\[redacted-password\]/.test(smoke) && /\[redacted-ai-key\]/.test(smoke))
add("evidence records rollout summary without paid enablement", /paidGenerationEnabled:\s*false/.test(smoke) && /selectionProbeRan/.test(smoke) && /directRenderChecked/.test(smoke))
add("archive script exists", exists("scripts/release/archive-ai-media-rollout-evidence.mjs"))
add("archive script reads rollout evidence", /test-results\/deployed-ai-media-rollout\/evidence\.json/.test(archive))
add("archive script writes release evidence archive", /\.release\/ai-media-rollout-evidence/.test(archive) && /manifest\.json/.test(archive) && /REVIEW\.md/.test(archive))
add("archive checklist requires paid-generation approval", /paidGenerationEnabled/.test(archive) && /explicit paid-provider rollout/.test(archive))
add("package exposes P91 quality and release scripts", /"quality:ai-media-rollout-evidence":\s*"node scripts\/quality\/validate-ai-media-rollout-evidence\.mjs"/.test(packageJson) && /"release:ai-media-rollout-evidence":\s*"node scripts\/release\/archive-ai-media-rollout-evidence\.mjs"/.test(packageJson))
add("project validator references P91 validator", /validate-ai-media-rollout-evidence\.mjs/.test(validateProject) && /P91 AI media rollout evidence validator passes/.test(validateProject))
add("P91 phase doc exists", exists("docs/PHASE_91_AI_MEDIA_ROLLOUT_EVIDENCE.md") && /Status: implemented/.test(phaseDoc))
add("roadmap docs mark P91 complete and next phase", /P91/.test(readme) && /P91/.test(sourceOfTruth) && /P91/.test(roadmap) && /P92/.test(readme) && /P92/.test(sourceOfTruth) && /P92/.test(roadmap))

console.table(results)
const failed = results.filter((result) => !result.ok)
if (failed.length) {
  console.error(`AI media rollout evidence validation failed with ${failed.length} issue(s).`, failed)
  process.exit(1)
}

console.log("AI media rollout evidence validation passed.")
