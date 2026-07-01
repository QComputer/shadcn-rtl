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

const doc = exists("docs/PHASE_114_CREATIVE_STUDIO_ORGANIZATION_BRAND_READINESS.md") ? read("docs/PHASE_114_CREATIVE_STUDIO_ORGANIZATION_BRAND_READINESS.md") : "";
const readiness = read("lib/services/creative-studio-generation-readiness.ts");
const validators = read("lib/validators/index.ts");
const service = read("lib/services/creative-studio.service.ts");
const page = read("app/[locale]/dashboard/creative-studio/page.tsx");
const packageJson = read("package.json");
const validateProject = read("scripts/quality/validate-project.mjs");
const readme = read("README.md");
const roadmap = read("docs/NEXT_PHASE_ROADMAP.md");
const sourceOfTruth = read("docs/CURRENT_SOURCE_OF_TRUTH.md");

add("P114 phase document exists and is implemented", /Status: implemented/.test(doc) && /P114/.test(doc) && /organization logo and cover generation/.test(doc));
add("readiness helper exposes P114 organization brand plan", /organizationBrandPlan/.test(readiness) && /phase:\s*"P114"/.test(readiness) && /targetType:\s*"ORGANIZATION_BRAND"/.test(readiness));
add("organization brand generation remains gated", /generationRequestEnabled:\s*false/.test(readiness) && /generationUiEnabled:\s*false/.test(readiness) && /providerExecutionGatePhase:\s*"P117"/.test(readiness) && /providerContractReady:\s*organizationBrandProvider\.providerContractReady/.test(readiness));
add("organization brand plan requires review and manual apply", /selectionStillRequired:\s*true/.test(readiness) && /applyStillRequiresConfirmation:\s*true/.test(readiness) && /publicAutoApplyAllowed:\s*false/.test(readiness));
add("organization brand plan covers logo and cover targets", /assetType:\s*"LOGO"/.test(readiness) && /targetField:\s*"organization\.logo"/.test(readiness) && /assetType:\s*"COVER"/.test(readiness) && /targetField:\s*"organization\.coverImage"/.test(readiness));
add("organization brand provider contract is declared but not called", /creative-studio-organization-brand-v1/.test(readiness) && /\/v1\/organization-brand\/jobs/.test(readiness) && !/aiMediaService\.createOrganizationBrandJob/.test(service) && !/\/v1\/organization-brand\/jobs/.test(page));
add("organization brand checklist preserves existing safety boundaries", /server-only-provider-calls/.test(readiness) && /settings-manage-permission/.test(readiness) && /draft-asset-persistence/.test(readiness) && /selected-candidate-review/.test(readiness) && /manual-apply-confirmation/.test(readiness) && /all-locale-cache-revalidation/.test(readiness));
add("create job schema constrains organization brand assets", /targetType === "ORGANIZATION_BRAND"/.test(validators) && /\["LOGO", "COVER"\]\.includes\(input\.assetType\)/.test(validators) && /Organization brand Creative Studio jobs only support logo or cover assets/.test(validators));
add("apply surface already supports organization logo and cover", /organization\.logo/.test(service) && /organization\.coverImage/.test(service) && /settings:manage/.test(service));
add("dashboard exposes Persian-first organization brand readiness copy", /brandGenerationPlan/.test(page) && /logoCoverReadiness/.test(page) && /providerContract/.test(page) && /plannedBrandTargets/.test(page) && /brandGenerationDisabled/.test(page) && /applyStillManual/.test(page));
add("dashboard renders organization brand plan without enabling provider execution", /organizationBrandPlan/.test(page) && /providerContractReady/.test(page) && /supportedAssets\.map/.test(page) && !/\/v1\/organization-brand\/jobs/.test(page) && !/createOrganizationBrandJob/.test(page));
add("package exposes P114 validator", /"quality:creative-studio-organization-brand-readiness":\s*"node scripts\/quality\/validate-creative-studio-organization-brand-readiness\.mjs"/.test(packageJson));
add("quality local references P114 validator", /validate-creative-studio-organization-brand-readiness\.mjs/.test(validateProject) && /P114 Creative Studio organization brand readiness validator passes/.test(validateProject));
add("README marks P114 complete and P115 next", /Latest completed implementation phase:\s+\*\*P118 - Creative Studio organization-brand provider execution implementation\*\*/.test(readme) && /Recommended next phase:\s+\*\*P119 - Creative Studio provider execution smoke and generated asset ingestion\*\*/.test(readme));
add("roadmap marks P114 complete and P115 next", /Completed through \*\*P118 - Creative Studio organization-brand provider execution implementation\*\*/.test(roadmap) && /\| P114 \| Creative Studio organization-brand generation planning and readiness gate\. \|/.test(roadmap) && /\| P115 \| Creative Studio organization logo and cover generation request controls\. \|/.test(roadmap));
add("source of truth names P114 baseline", /after P118 Creative Studio organization-brand provider execution implementation/.test(sourceOfTruth) && /Creative Studio organization-brand generation readiness exists/.test(sourceOfTruth));

for (const check of checks) {
  console.log(`${check.pass ? "PASS" : "FAIL"} ${check.name}`);
}

const failed = checks.filter((check) => !check.pass);
if (failed.length > 0) {
  console.error(`\n${failed.length} Creative Studio organization-brand readiness validation check(s) failed.`);
  process.exit(1);
}
