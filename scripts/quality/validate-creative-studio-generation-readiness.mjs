import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const checks = [];

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}

function add(name, pass) {
  checks.push({ name, pass: Boolean(pass) });
}

const doc = exists("docs/PHASE_111_CREATIVE_STUDIO_GENERATION_READINESS.md") ? read("docs/PHASE_111_CREATIVE_STUDIO_GENERATION_READINESS.md") : "";
const helper = exists("lib/services/creative-studio-generation-readiness.ts") ? read("lib/services/creative-studio-generation-readiness.ts") : "";
const service = read("lib/services/creative-studio.service.ts");
const statusRoute = read("app/api/dashboard/creative-studio/status/route.ts");
const page = read("app/[locale]/dashboard/creative-studio/page.tsx");
const packageJson = read("package.json");
const validateProject = read("scripts/quality/validate-project.mjs");
const readme = read("README.md");
const roadmap = read("docs/NEXT_PHASE_ROADMAP.md");
const sourceOfTruth = read("docs/CURRENT_SOURCE_OF_TRUTH.md");

add("P111 phase document exists and is implemented", /Status: implemented/.test(doc) && /P111/.test(doc));
add("readiness helper is server-only", /import "server-only"/.test(helper));
add("readiness helper uses existing AI media service config", /getAiMediaServiceConfigStatus/.test(helper) && /checkAiMediaServiceReadiness/.test(helper) && /getAiMediaPaidProviderStatus/.test(helper));
add("readiness helper keeps generation disabled", /generationRequestEnabled:\s*false/.test(helper) && /generationUiEnabled:\s*false/.test(helper));
add("readiness helper blocks direct browser worker calls", /browserWorkerCallsAllowed:\s*false/.test(helper) && /serverOnly:\s*true/.test(helper));
add("readiness helper declares no new providers", /noNewProviders:\s*true/.test(helper) && /upstream:\s*"AI_MEDIA_SERVICE"/.test(helper));
add("readiness contract is product-image only", /PRODUCT/.test(helper) && /PRODUCT_IMAGE/.test(helper) && /product\.image/.test(helper) && /ORGANIZATION_BRAND/.test(helper) && /FANPAGE_POST/.test(helper) && /CAMPAIGN/.test(helper) && /IMPORTED_MEDIA/.test(helper));
add("readiness contract mirrors AI media endpoints", /\/v1\/product-image-suggestions\/jobs/.test(helper) && /statusEndpoint/.test(helper) && /cancelEndpoint/.test(helper));
add("readiness contract documents create and output fields", /organization_id/.test(helper) && /requested_by_user_id/.test(helper) && /product_title/.test(helper) && /output_images/.test(helper));
add("readiness helper returns secret-safe blockers", /AI_MEDIA_SERVICE_INTERNAL_KEY is not configured/.test(helper) && !/internalKey:/.test(helper) && !/process\.env\.AI_MEDIA_SERVICE_INTERNAL_KEY/.test(helper));
add("Creative Studio status embeds generation readiness", /getCreativeStudioGenerationReadiness/.test(service) && /generationReadiness/.test(service));
add("status route supports explicit check=1 only", /searchParams\.get\("check"\) === "1"/.test(statusRoute) && /checkGenerationReadiness/.test(statusRoute));
add("dashboard shows Persian readiness card", /آمادگی تولید/.test(page) && /دروازه آمادگی تولید/.test(page) && /فرم تولید/.test(page));
add("dashboard still has no generation form or start button", !/createCreativeStudioJob/.test(page) && !/شروع تولید/.test(page) && !/startGeneration/.test(page));
add("package exposes P111 validator", /"quality:creative-studio-generation-readiness":\s*"node scripts\/quality\/validate-creative-studio-generation-readiness\.mjs"/.test(packageJson));
add("quality local references P111 validator", /validate-creative-studio-generation-readiness\.mjs/.test(validateProject) && /P111 Creative Studio generation readiness validator passes/.test(validateProject));
add("README marks P111 complete and P112 next", /Latest completed implementation phase:\s+\*\*P111 - Creative Studio generation readiness gate and AI-service contract sync\*\*/.test(readme) && /Recommended next phase:\s+\*\*P112 - Creative Studio product-image generation request controls and long-running job UX\*\*/.test(readme));
add("roadmap marks P111 complete and P112 next", /Completed through \*\*P111 - Creative Studio generation readiness gate and AI-service contract sync\*\*/.test(roadmap) && /\| P111 \| Creative Studio generation readiness gate and AI-service contract sync\. \|/.test(roadmap) && /\| P112 \| Creative Studio product-image generation request controls and long-running job UX\. \|/.test(roadmap));
add("source of truth names P111 baseline", /after P111 Creative Studio generation readiness gate and AI-service contract sync/.test(sourceOfTruth) && /Creative Studio generation readiness exists/.test(sourceOfTruth));

const failed = checks.filter((check) => !check.pass);
for (const check of checks) {
  console.log(`${check.pass ? "PASS" : "FAIL"} ${check.name}`);
}

if (failed.length > 0) {
  console.error(`\n${failed.length} Creative Studio generation readiness validation check(s) failed.`);
  process.exit(1);
}
