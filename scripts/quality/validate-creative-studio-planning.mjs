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

const docPath = "docs/PHASE_107_CREATIVE_STUDIO_INTEGRATION_PLANNING.md"
const doc = exists(docPath) ? read(docPath) : ""
const packageJson = exists("package.json") ? read("package.json") : ""
const validateProject = exists("scripts/quality/validate-project.mjs") ? read("scripts/quality/validate-project.mjs") : ""
const readme = exists("README.md") ? read("README.md") : ""
const roadmap = exists("docs/NEXT_PHASE_ROADMAP.md") ? read("docs/NEXT_PHASE_ROADMAP.md") : ""
const sourceOfTruth = exists("docs/CURRENT_SOURCE_OF_TRUTH.md") ? read("docs/CURRENT_SOURCE_OF_TRUTH.md") : ""
const aiMediaClient = exists("lib/services/ai-media-service-client.ts") ? read("lib/services/ai-media-service-client.ts") : ""
const aiMediaService = exists("lib/services/ai-media.service.ts") ? read("lib/services/ai-media.service.ts") : ""
const runtimeEnv = exists("lib/runtime-env.ts") ? read("lib/runtime-env.ts") : ""

add("P107 phase document exists", exists(docPath))
add("P107 is marked implemented", /Status: implemented/.test(doc))
add("P107 is planning-only", /planning-only/.test(doc) && /does not add:[\s\S]*Creative Studio dashboard routes/.test(doc) && /does not add:[\s\S]*Prisma models or migrations/.test(doc))
add("P107 defines server boundary", /## Server boundary/.test(doc) && /authenticated dashboard API routes/.test(doc) && /server-only modules/.test(doc) && /Never expose provider secrets/.test(doc))
add("P107 defines consent policy", /## Consent and asset policy/.test(doc) && /seller-initiated/.test(doc) && /review-gated/.test(doc) && /No scraping/.test(doc) && /No use of customer personal data/.test(doc))
add("P107 defines access rules", /## Access rules/.test(doc) && /product:update/.test(doc) && /SUPER_ADMIN only/.test(doc) && /organization-scoped/.test(doc))
add("P107 defines data model planning", /CreativeStudioJob/.test(doc) && /CreativeStudioAsset/.test(doc) && /CreativeStudioUsageEvent/.test(doc))
add("P107 defines planned API surface", /GET \/api\/dashboard\/creative-studio\/status/.test(doc) && /POST \/api\/dashboard\/creative-studio\/jobs/.test(doc) && /assets\/\[assetId\]\/apply/.test(doc))
add("P107 keeps Persian as primary UX language", /Persian \(`fa`\) copy is the primary copy/.test(doc) && /English and Arabic dictionary parity/.test(doc))
add("P107 defines rollout gates", /quality:creative-studio-foundation/.test(doc) && /quality:creative-studio-access/.test(doc) && /quality:creative-studio-cost-guardrails/.test(doc) && /MOCK provider only/.test(doc))
add("P107 recommends P108 server foundation", /P108 - Creative Studio server foundation/.test(doc))

add("existing AI media client is server-only", /import "server-only"/.test(aiMediaClient) && /X-BazarBaz-AI-Key/.test(aiMediaClient))
add("existing AI media service is product and organization scoped", /hasPermission\(userRole, "product:update"\)/.test(aiMediaService) && /organizationId/.test(aiMediaService) && /aiMediaUsageEvent/.test(aiMediaService))
add("existing runtime keeps paid provider guardrails", /AI_MEDIA_PAID_PROVIDER_APPROVED/.test(runtimeEnv) && /AI_MEDIA_PAID_PROVIDER_ROLLBACK_PAUSED/.test(runtimeEnv) && /Paid AI media requires approval metadata/.test(runtimeEnv))
add("P107 remains a planning-only document", /does not add:[\s\S]*Creative Studio dashboard routes/.test(doc) && /does not add:[\s\S]*Prisma models or migrations/.test(doc))

add("package exposes P107 validator", /"quality:creative-studio-planning":\s*"node scripts\/quality\/validate-creative-studio-planning\.mjs"/.test(packageJson))
add("project validator references P107 validator", /validate-creative-studio-planning\.mjs/.test(validateProject) && /P107 Creative Studio planning validator passes/.test(validateProject))
add("README keeps P107 complete while marking P109 latest", /Latest completed implementation phase:\s+\*\*P119 - Creative Studio provider result ingestion and review stabilization\*\*/.test(readme) && /Recommended next phase:\s+\*\*P120 - Creative Studio reviewed asset apply and rollback workflow\*\*/.test(readme))
add("roadmap keeps P107 complete in P109 progression", /Completed through \*\*P119 - Creative Studio provider result ingestion and review stabilization\*\*/.test(roadmap) && /\| P107 \| Creative Studio integration planning for main Bazar Baz\. \|/.test(roadmap) && /\| P108 \| Creative Studio server foundation\. \|/.test(roadmap))
add("source of truth names P109 baseline while keeping P107 planning", /after P119 Creative Studio provider result ingestion and review stabilization/.test(sourceOfTruth) && /Creative Studio integration planning exists/.test(sourceOfTruth) && /Creative Studio server foundation exists/.test(sourceOfTruth))

for (const check of checks) {
  console.log(`${check.pass ? "OK" : "FAIL"} ${check.name}${check.detail ? ` (${check.detail})` : ""}`)
}

const failed = checks.filter((check) => !check.pass)
if (failed.length > 0) {
  console.error(`\n${failed.length} Creative Studio planning validation check(s) failed.`)
  process.exit(1)
}
