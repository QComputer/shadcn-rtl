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

const doc = exists("docs/PHASE_112_CREATIVE_STUDIO_PRODUCT_IMAGE_GENERATION.md") ? read("docs/PHASE_112_CREATIVE_STUDIO_PRODUCT_IMAGE_GENERATION.md") : "";
const service = read("lib/services/creative-studio.service.ts");
const readiness = read("lib/services/creative-studio-generation-readiness.ts");
const validators = read("lib/validators/index.ts");
const jobsRoute = read("app/api/dashboard/creative-studio/jobs/route.ts");
const cancelRoute = read("app/api/dashboard/creative-studio/jobs/[jobId]/cancel/route.ts");
const page = read("app/[locale]/dashboard/creative-studio/page.tsx");
const packageJson = read("package.json");
const validateProject = read("scripts/quality/validate-project.mjs");
const readme = read("README.md");
const roadmap = read("docs/NEXT_PHASE_ROADMAP.md");
const sourceOfTruth = read("docs/CURRENT_SOURCE_OF_TRUTH.md");

add("P112 phase document exists and is implemented", /Status: implemented/.test(doc) && /P112/.test(doc));
add("readiness enables only server-mediated request controls", /phase:\s*"P112"/.test(readiness) && /generationRequestEnabled:\s*productImageGenerationEnabled/.test(readiness) && /generationUiEnabled:\s*productImageGenerationEnabled/.test(readiness) && /browserWorkerCallsAllowed:\s*false/.test(readiness) && /noNewProviders:\s*true/.test(readiness));
add("schema exposes product-image generation controls", /aspect_ratio/.test(validators) && /style_preset/.test(validators) && /PRODUCT_IMAGE/.test(validators) && /Product target is required/.test(validators));
add("service reuses existing AI media service only", /import \{ aiMediaService \}/.test(service) && /aiMediaService\.createJob/.test(service) && !/createAiMediaJob\(/.test(service) && !/fetch\(`?\$\{.*AI_MEDIA_SERVICE/.test(service));
add("service routes only product-image generation to remote contract", /isProductImageGenerationInput/.test(service) && /targetType === "PRODUCT"/.test(service) && /assetType === "PRODUCT_IMAGE"/.test(service) && /createProductImageGenerationJob/.test(service));
add("service stores remote job reference and contract metadata", /p112Generation/.test(service) && /remoteJobId/.test(service) && /ai-media-product-image-suggestions-v1/.test(service) && /localAiMediaJobId/.test(service));
add("service syncs long-running status and drafts outputs", /syncProductImageGenerationJob/.test(service) && /aiMediaService\.getJobStatus/.test(service) && /normalizeAiMediaOutputs/.test(service) && /creativeStudioAsset\.create/.test(service) && /ASSET_DRAFTED/.test(service));
add("service cancels remote jobs through server-side AI media service", /aiMediaService\.cancelJob/.test(service) && /getRemoteJobIdFromInputs/.test(service));
add("jobs route stays dashboard-scoped", /createCreativeStudioJobSchema/.test(jobsRoute) && /requireCreativeStudioOrganization/.test(jobsRoute) && /creativeStudioService\.createJob/.test(jobsRoute));
add("cancel route preserves selected organization context", /NextRequest/.test(cancelRoute) && /searchParams\.get\("organizationId"\)/.test(cancelRoute) && /creativeStudioService\.cancelJob/.test(cancelRoute));
add("dashboard has Persian product-image generation controls", /ساخت تصویر محصول/.test(page) && /شروع تولید/.test(page) && /محصول/.test(page) && /ادامه پیگیری/.test(page) && /لغو تولید/.test(page));
add("dashboard polls and cancels Creative Studio jobs only", /GENERATION_POLL_INTERVAL_MS/.test(page) && /GENERATION_MAX_POLL_ATTEMPTS/.test(page) && /pollCreativeStudioJob/.test(page) && /cancelGenerationJob/.test(page) && /\/api\/dashboard\/creative-studio\/jobs/.test(page));
add("dashboard does not call AI media worker directly", !/\/api\/dashboard\/products\/.+ai-image-suggestions/.test(page) && !/\/api\/dashboard\/ai-image-suggestions/.test(page) && !/AI_MEDIA_SERVICE/.test(page));
add("package exposes P112 validator", /"quality:creative-studio-product-image-generation":\s*"node scripts\/quality\/validate-creative-studio-product-image-generation\.mjs"/.test(packageJson));
add("quality local references P112 validator", /validate-creative-studio-product-image-generation\.mjs/.test(validateProject) && /P112 Creative Studio product image generation validator passes/.test(validateProject));
add("README marks P112 complete and P113 next", /Latest completed implementation phase:\s+\*\*P112 - Creative Studio product-image generation request controls and long-running job UX\*\*/.test(readme) && /Recommended next phase:\s+\*\*P113 - Creative Studio generated-asset selection polish and deployed acceptance\*\*/.test(readme));
add("roadmap marks P112 complete and P113 next", /Completed through \*\*P112 - Creative Studio product-image generation request controls and long-running job UX\*\*/.test(roadmap) && /\| P112 \| Creative Studio product-image generation request controls and long-running job UX\. \|/.test(roadmap) && /\| P113 \| Creative Studio generated-asset selection polish and deployed acceptance\. \|/.test(roadmap));
add("source of truth names P112 baseline", /after P112 Creative Studio product-image generation request controls and long-running job UX/.test(sourceOfTruth) && /Creative Studio product-image generation controls exist/.test(sourceOfTruth));

const failed = checks.filter((check) => !check.pass);
for (const check of checks) {
  console.log(`${check.pass ? "PASS" : "FAIL"} ${check.name}`);
}

if (failed.length > 0) {
  console.error(`\n${failed.length} Creative Studio product-image generation validation check(s) failed.`);
  process.exit(1);
}
