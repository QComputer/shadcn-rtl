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

const phaseDoc = exists("docs/PHASE_105_PRODUCTION_ROLLOUT_RUNBOOK.md")
  ? read("docs/PHASE_105_PRODUCTION_ROLLOUT_RUNBOOK.md")
  : ""
const archive = exists("scripts/release/archive-pwa-push-sms-rollout-evidence.mjs")
  ? read("scripts/release/archive-pwa-push-sms-rollout-evidence.mjs")
  : ""
const packageJson = exists("package.json") ? read("package.json") : ""
const validateProject = exists("scripts/quality/validate-project.mjs") ? read("scripts/quality/validate-project.mjs") : ""
const releaseTemplate = exists("docs/RELEASE_NOTES_TEMPLATE.md") ? read("docs/RELEASE_NOTES_TEMPLATE.md") : ""
const readme = exists("README.md") ? read("README.md") : ""
const roadmap = exists("docs/NEXT_PHASE_ROADMAP.md") ? read("docs/NEXT_PHASE_ROADMAP.md") : ""
const sourceOfTruth = exists("docs/CURRENT_SOURCE_OF_TRUTH.md") ? read("docs/CURRENT_SOURCE_OF_TRUTH.md") : ""

add("P105 phase document exists", exists("docs/PHASE_105_PRODUCTION_ROLLOUT_RUNBOOK.md") && /Status: implemented/.test(phaseDoc))
add("runbook keeps Persian-first release check", /Persian-first/.test(phaseDoc) && /\/fa/.test(phaseDoc) && /DEPLOYED_URL="?https:\/\/www\.bazar-baz\.ir/.test(phaseDoc))
add("runbook documents Web Push enablement and rollback", /WEB_PUSH_PROVIDER=web_push/.test(phaseDoc) && /WEB_PUSH_DRY_RUN=false/.test(phaseDoc) && /WEB_PUSH_REAL_SEND_ENABLED=false/.test(phaseDoc))
add("runbook documents SMS enablement and rollback", /SMS_PROVIDER=sms_ir/.test(phaseDoc) && /SMS_DRY_RUN=false/.test(phaseDoc) && /SMS_PROVIDER=DRY_RUN/.test(phaseDoc))
add("runbook documents notification operations monitoring", /\/fa\/dashboard\/notification-operations/.test(phaseDoc) && /provider readiness/.test(phaseDoc) && /recent delivery/.test(phaseDoc))
add("runbook requires explicit operator sign-off", /operator sign-off/.test(phaseDoc) && /release owner/.test(phaseDoc) && /rollback owner/.test(phaseDoc))
add("runbook documents evidence archive workflow", /pnpm run e2e:deployed:pwa-push-sms/.test(phaseDoc) && /pnpm run release:pwa-push-sms-rollout-evidence/.test(phaseDoc))
add("evidence archive script exists", exists("scripts/release/archive-pwa-push-sms-rollout-evidence.mjs"))
add("archive script writes release evidence archive", /\.release\/pwa-push-sms-rollout-evidence/.test(archive) && /manifest\.json/.test(archive) && /REVIEW\.md/.test(archive))
add("archive script refuses obvious secrets", /Refusing to archive PWA\/Push\/SMS rollout evidence/.test(archive) && /WEB_PUSH_VAPID_PRIVATE_KEY/.test(archive) && /SMS_IR_API_KEY/.test(archive))
add("release notes include PWA Push SMS rollout evidence", /PWA Push SMS Rollout Evidence/.test(releaseTemplate) && /Rollback owner/.test(releaseTemplate))
add("package exposes P105 quality and release scripts", /"quality:production-rollout":\s*"node scripts\/quality\/validate-production-rollout-runbook\.mjs"/.test(packageJson) && /"release:pwa-push-sms-rollout-evidence":\s*"node scripts\/release\/archive-pwa-push-sms-rollout-evidence\.mjs"/.test(packageJson))
add("project validator references P105 validator", /validate-production-rollout-runbook\.mjs/.test(validateProject) && /P105 production rollout runbook validator passes/.test(validateProject))
add("README keeps P105 complete while marking P107 latest", /\| 105 \| Production rollout runbook/.test(readme) && /Latest completed implementation phase:\s+\*\*P107 - Creative Studio integration planning for main Bazar Baz\*\*/.test(readme) && /P108 - Creative Studio server foundation/.test(readme))
add("roadmap keeps P105 complete in P107 progression", /\| P105 \| Production rollout runbook\. \|/.test(roadmap) && /Completed through \*\*P107 - Creative Studio integration planning for main Bazar Baz\*\*/.test(roadmap))
add("source of truth names P107 baseline while keeping P105 runbook", /after P107 Creative Studio integration planning/.test(sourceOfTruth) && /Production rollout runbook exists/.test(sourceOfTruth))

for (const check of checks) {
  console.log(`${check.pass ? "OK" : "FAIL"} ${check.name}${check.detail ? ` (${check.detail})` : ""}`)
}

const failed = checks.filter((check) => !check.pass)
if (failed.length > 0) {
  console.error(`\n${failed.length} production rollout runbook validation check(s) failed.`)
  process.exit(1)
}
