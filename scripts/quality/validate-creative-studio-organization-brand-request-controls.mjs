#!/usr/bin/env node
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

const doc = exists("docs/PHASE_115_CREATIVE_STUDIO_ORGANIZATION_BRAND_REQUEST_CONTROLS.md") ? read("docs/PHASE_115_CREATIVE_STUDIO_ORGANIZATION_BRAND_REQUEST_CONTROLS.md") : "";
const readiness = read("lib/services/creative-studio-generation-readiness.ts");
const validators = read("lib/validators/index.ts");
const service = read("lib/services/creative-studio.service.ts");
const jobsRoute = read("app/api/dashboard/creative-studio/jobs/route.ts");
const page = read("app/[locale]/dashboard/creative-studio/page.tsx");
const packageJson = read("package.json");
const validateProject = read("scripts/quality/validate-project.mjs");
const readme = read("README.md");
const roadmap = read("docs/NEXT_PHASE_ROADMAP.md");
const sourceOfTruth = read("docs/CURRENT_SOURCE_OF_TRUTH.md");

add("P115 phase document exists and is implemented", /Status: implemented/.test(doc) && /P115/.test(doc) && /request controls/.test(doc));
add("readiness helper exposes P115 request controls separately from provider execution", /requestControlsPhase:\s*"P115"/.test(readiness) && /requestControlsEnabled:\s*true/.test(readiness) && /providerExecutionGatePhase:\s*"P117"/.test(readiness) && /requestOnlyJobPersistence:\s*true/.test(readiness));
add("readiness keeps organization brand request controls gated", /generationRequestEnabled:\s*false/.test(readiness) && /generationUiEnabled:\s*false/.test(readiness) && /providerContractReady:\s*organizationBrandProvider\.providerContractReady/.test(readiness) && /Organization brand provider execution rollout is not requested/.test(readiness));
add("schema still constrains organization brand requests to logo or cover", /targetType === "ORGANIZATION_BRAND"/.test(validators) && /\["LOGO", "COVER"\]\.includes\(input\.assetType\)/.test(validators));
add("service routes organization brand requests through an explicit P115 path", /isOrganizationBrandGenerationInput/.test(service) && /createOrganizationBrandGenerationRequest/.test(service) && /p115BrandGeneration/.test(service));
add("service maps logo and cover to organization fields and aspect ratios", /getOrganizationBrandTargetField/.test(service) && /organization\.logo/.test(service) && /organization\.coverImage/.test(service) && /assetType === "LOGO" \? "1:1" : "16:9"/.test(service));
add("service keeps P115 request-only jobs draft-first and non-mutating", /requestControlsOnly:\s*true/.test(service) && /providerExecutionEnabled:\s*false/.test(service) && /publicMutation:\s*false/.test(service) && /applyStillRequiresConfirmation:\s*true/.test(service));
add("service requires settings permission through organization brand target access", /targetType === "ORGANIZATION_BRAND"/.test(service) && /settings:manage/.test(service));
add("service keeps P115 requests draft-first even after P118 provider wiring", /requestControlsOnly:\s*true/.test(service) && /p118OrganizationBrandProviderExecution/.test(service) && /publicAutoApply:\s*false/.test(service) && !/directComfyUiCall:\s*true/.test(service));
add("jobs route remains dashboard scoped and schema validated", /createCreativeStudioJobSchema/.test(jobsRoute) && /requireCreativeStudioOrganization/.test(jobsRoute) && /creativeStudioService\.createJob/.test(jobsRoute));
add("dashboard exposes organization brand request controls", /startOrganizationBrandGeneration/.test(page) && /brandRequestForm/.test(page) && /brandAssetType/.test(page) && /brandPrompt/.test(page) && /brandStylePreset/.test(page));
add("dashboard posts logo and cover requests to the server-mediated Creative Studio API only", /assetType:\s*brandAssetType/.test(page) && /\/api\/dashboard\/creative-studio\/organization-brand\/execute/.test(page) && /dryRun:\s*true/.test(page) && !/\/v1\/organization-brand\/jobs/.test(page));
add("dashboard shows request-only and provider-execution state", /requestOnlyMode/.test(page) && /providerExecution/.test(page) && /brandProviderExecutionEnabled/.test(page) && /brandRequestControlsReady/.test(page));
add("dashboard preserves manual selection/apply workflow", /selectGeneratedAsset/.test(page) && /confirmationText\.trim\(\) !== "اعمال شود"/.test(page) && /applyStillManual/.test(page));
add("package exposes P115 validator", /"quality:creative-studio-organization-brand-request-controls":\s*"node scripts\/quality\/validate-creative-studio-organization-brand-request-controls\.mjs"/.test(packageJson));
add("quality local references P115 validator", /validate-creative-studio-organization-brand-request-controls\.mjs/.test(validateProject) && /P115 Creative Studio organization brand request controls validator passes/.test(validateProject));
add("README marks current P118 baseline and P119 next", /Latest completed implementation phase:\s+\*\*P120 - Creative Studio reviewed asset apply and rollback workflow\*\*/.test(readme) && /Recommended next phase:\s+\*\*P120B - Customer order lifecycle notifications and guest SMS dry-run review\*\*/.test(readme));
add("roadmap keeps P115 complete in current progression", /Completed through \*\*P120 - Creative Studio reviewed asset apply and rollback workflow\*\*/.test(roadmap) && /\| P115 \| Creative Studio organization logo and cover generation request controls\. \|/.test(roadmap) && /\| P119 \| Creative Studio provider result ingestion and review stabilization\. \|/.test(roadmap) && /\| P120 \| Creative Studio reviewed asset apply and rollback workflow\. \|/.test(roadmap));
add("source of truth keeps P115 controls in current baseline", /after P119 Creative Studio provider result ingestion and review stabilization/.test(sourceOfTruth) && /Creative Studio organization logo and cover request controls exist/.test(sourceOfTruth));

for (const check of checks) {
  console.log(`${check.pass ? "PASS" : "FAIL"} ${check.name}`);
}

const failed = checks.filter((check) => !check.pass);
if (failed.length > 0) {
  console.error(`\n${failed.length} Creative Studio organization brand request-control validation check(s) failed.`);
  process.exit(1);
}
