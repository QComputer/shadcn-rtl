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

const smoke = exists("scripts/e2e/deployed-pwa-push-sms-smoke.mjs") ? read("scripts/e2e/deployed-pwa-push-sms-smoke.mjs") : ""
const packageJson = exists("package.json") ? read("package.json") : ""
const validateProject = exists("scripts/quality/validate-project.mjs") ? read("scripts/quality/validate-project.mjs") : ""
const readme = exists("README.md") ? read("README.md") : ""
const roadmap = exists("docs/NEXT_PHASE_ROADMAP.md") ? read("docs/NEXT_PHASE_ROADMAP.md") : ""
const sourceOfTruth = exists("docs/CURRENT_SOURCE_OF_TRUTH.md") ? read("docs/CURRENT_SOURCE_OF_TRUTH.md") : ""

add("P104 phase document exists", exists("docs/PHASE_104_DEPLOYED_PWA_PUSH_SMS_SMOKE.md"))
add("deployed PWA/Push/SMS smoke exists", exists("scripts/e2e/deployed-pwa-push-sms-smoke.mjs"))
add("smoke defaults deployed credentials and URL", /DEPLOYED_URL/.test(smoke) && /"https:\/\/www\.bazar-baz\.ir"/.test(smoke) && /"Amir"/.test(smoke) && /"123456"/.test(smoke))
add("smoke resolves canonical deployment URL", /canonical deployment URL resolves/.test(smoke) && /baseUrl = new URL\(location, baseUrl\)\.origin/.test(smoke))
add("smoke verifies Persian first visit", /first visit redirects to Persian locale/.test(smoke) && /\/fa/.test(smoke) && /Accept-Language/.test(smoke))
add("smoke verifies installable Persian manifest", /manifest is installable and Persian-first/.test(smoke) && /start_url/.test(smoke) && /standalone/.test(smoke) && /maskable/.test(smoke))
add("smoke verifies service worker and offline shell", /service worker keeps offline and push handlers/.test(smoke) && /offline shell is reachable and Persian/.test(smoke) && /web-push-sw\.js/.test(smoke))
add("smoke verifies unauthenticated guards", /unauthenticated notification operations is blocked/.test(smoke) && /unauthenticated push dashboard is blocked/.test(smoke))
add("smoke authenticates with deployed credentials", /api\/auth\/csrf/.test(smoke) && /callback\/credentials/.test(smoke) && /api\/auth\/session/.test(smoke))
add("smoke resolves organization membership", /api\/users\/me\/membership/.test(smoke) && /organizationId/.test(smoke) && /organizationSlug/.test(smoke))
add("smoke reads operations provider health safely", /notification operations exposes safe provider health/.test(smoke) && /assertDeliveryConfigSafe/.test(smoke) && /assertNoSecrets/.test(smoke))
add("smoke checks dry-run send safety by default", /DEPLOYED_PWA_PUSH_SMS_REQUIRE_DRY_RUN/.test(smoke) && /realSendEnabled === false/.test(smoke))
add("smoke reads dashboard push and customer preference state", /dashboard push health is readable/.test(smoke) && /customer push status is readable/.test(smoke) && /customer notification preferences include push and SMS/.test(smoke))
add("smoke keeps mutating dry-run send optional", /DEPLOYED_PWA_PUSH_SMS_ENABLE_DRY_RUN_SEND/.test(smoke) && /optional dashboard Web Push dry-run send skipped/.test(smoke))
add("smoke writes redacted evidence", /DEPLOYED_PWA_PUSH_SMS_EVIDENCE_DIR/.test(smoke) && /evidence\.json/.test(smoke) && /redacted-password/.test(smoke))
add("package exposes P104 scripts", /"e2e:deployed:pwa-push-sms":\s*"node scripts\/e2e\/deployed-pwa-push-sms-smoke\.mjs"/.test(packageJson) && /"quality:deployed-pwa-push-sms":\s*"node scripts\/quality\/validate-deployed-pwa-push-sms\.mjs"/.test(packageJson))
add("project validator references P104 validator", /validate-deployed-pwa-push-sms\.mjs/.test(validateProject) && /P104 deployed PWA Push SMS validator passes/.test(validateProject))
add("README keeps P104 complete while marking P109 latest", /P104 deployed PWA\/Push\/SMS smoke gates/.test(readme) && /Latest completed implementation phase:\s+\*\*P118 - Creative Studio organization-brand provider execution implementation\*\*/.test(readme) && /P119 - Creative Studio provider execution smoke and generated asset ingestion/.test(readme))
add("roadmap marks P104 complete in P109 progression", /\| P104 \| Deployed PWA, Push, and SMS smoke gates\. \|/.test(roadmap) && /Completed through \*\*P118 - Creative Studio organization-brand provider execution implementation\*\*/.test(roadmap))
add("source of truth names P109 baseline while keeping P104 smoke", /after P118 Creative Studio organization-brand provider execution implementation/.test(sourceOfTruth) && /Deployed PWA, Push, and SMS smoke exists/.test(sourceOfTruth))

for (const check of checks) {
  console.log(`${check.pass ? "OK" : "FAIL"} ${check.name}${check.detail ? ` (${check.detail})` : ""}`)
}

const failed = checks.filter((check) => !check.pass)
if (failed.length > 0) {
  console.error(`\n${failed.length} deployed PWA/Push/SMS validation check(s) failed.`)
  process.exit(1)
}
