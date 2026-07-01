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

const doc = exists("docs/PHASE_113_CREATIVE_STUDIO_GENERATED_ASSET_SELECTION.md") ? read("docs/PHASE_113_CREATIVE_STUDIO_GENERATED_ASSET_SELECTION.md") : "";
const service = read("lib/services/creative-studio.service.ts");
const validators = read("lib/validators/index.ts");
const selectRoute = exists("app/api/dashboard/creative-studio/assets/[assetId]/select/route.ts")
  ? read("app/api/dashboard/creative-studio/assets/[assetId]/select/route.ts")
  : "";
const page = read("app/[locale]/dashboard/creative-studio/page.tsx");
const smoke = exists("scripts/e2e/deployed-creative-studio-generated-assets.mjs") ? read("scripts/e2e/deployed-creative-studio-generated-assets.mjs") : "";
const packageJson = read("package.json");
const validateProject = read("scripts/quality/validate-project.mjs");
const readme = read("README.md");
const roadmap = read("docs/NEXT_PHASE_ROADMAP.md");
const sourceOfTruth = read("docs/CURRENT_SOURCE_OF_TRUTH.md");

add("P113 phase document exists and is implemented", /Status: implemented/.test(doc) && /P113/.test(doc));
add("schema exposes selection input", /selectCreativeStudioAssetSchema/.test(validators) && /SelectCreativeStudioAssetInput/.test(validators) && /creativeStudioApplyTargetFieldSchema\.optional/.test(validators));
add("service records selected asset without public mutation", /async selectAsset/.test(service) && /ASSET_SELECTED/.test(service) && /p113Selection/.test(service) && /publicMutation:\s*false/.test(service) && /applyStillRequiresConfirmation:\s*true/.test(service));
add("service keeps one selected candidate per job", /updateMany/.test(service) && /status:\s*"SELECTED"/.test(service) && /id:\s*\{\s*not:\s*asset\.id/.test(service) && /data:\s*\{\s*status:\s*"DRAFT"\s*\}/.test(service));
add("selection route is dashboard scoped", /selectCreativeStudioAssetSchema/.test(selectRoute) && /requireCreativeStudioOrganization/.test(selectRoute) && /creativeStudioService\.selectAsset/.test(selectRoute));
add("dashboard exposes Persian selection polish", /بررسی و انتخاب خروجی‌ها/.test(page) && /انتخاب این تصویر/.test(page) && /تصویر انتخاب‌شده/.test(page) && /صفحه عمومی را تغییر نمی‌دهد/.test(page));
add("dashboard calls select endpoint and refreshes selected job", /selectGeneratedAsset/.test(page) && /\/select/.test(page) && /copy\.selectSuccess/.test(page) && /await loadJob\(selectedJob\.id, organizationId\)/.test(page));
add("dashboard keeps apply confirmation separate", /confirmationText\.trim\(\) !== "اعمال شود"/.test(page) && /applyStillRequiresConfirmation/.test(service) && /setPendingApply/.test(page));
add("deployed Creative Studio smoke exists", exists("scripts/e2e/deployed-creative-studio-generated-assets.mjs"));
add("deployed smoke uses default production credentials safely", /"https:\/\/www\.bazar-baz\.ir"/.test(smoke) && /"Amir"/.test(smoke) && /"123456"/.test(smoke) && /redacted-password/.test(smoke));
add("deployed smoke verifies auth, status, jobs, usage, and safe select rejection", /unauthenticated Creative Studio APIs are blocked/.test(smoke) && /Creative Studio status is secret-safe and server-mediated/.test(smoke) && /Creative Studio jobs and usage are readable/.test(smoke) && /unknown asset selection is scoped and non-mutating/.test(smoke));
add("package exposes P113 validator and deployed smoke", /"quality:creative-studio-generated-asset-selection":\s*"node scripts\/quality\/validate-creative-studio-generated-asset-selection\.mjs"/.test(packageJson) && /"e2e:deployed:creative-studio":\s*"node scripts\/e2e\/deployed-creative-studio-generated-assets\.mjs"/.test(packageJson));
add("quality local references P113 validator", /validate-creative-studio-generated-asset-selection\.mjs/.test(validateProject) && /P113 Creative Studio generated asset selection validator passes/.test(validateProject));
add("README marks P113 complete and P114 next", /Latest completed implementation phase:\s+\*\*P117 - Creative Studio organization-brand provider execution rollout gate\*\*/.test(readme) && /Recommended next phase:\s+\*\*P118 - Creative Studio organization-brand provider execution implementation\*\*/.test(readme));
add("roadmap marks P113 complete and P114 next", /Completed through \*\*P117 - Creative Studio organization-brand provider execution rollout gate\*\*/.test(roadmap) && /\| P113 \| Creative Studio generated-asset selection polish and deployed acceptance\. \|/.test(roadmap) && /\| P114 \| Creative Studio organization-brand generation planning and readiness gate\. \|/.test(roadmap));
add("source of truth names P113 baseline", /after P117 Creative Studio organization-brand provider execution rollout gate/.test(sourceOfTruth) && /Creative Studio generated-asset selection polish exists/.test(sourceOfTruth));

for (const check of checks) {
  console.log(`${check.pass ? "PASS" : "FAIL"} ${check.name}`);
}

const failed = checks.filter((check) => !check.pass);
if (failed.length > 0) {
  console.error(`\n${failed.length} Creative Studio generated asset selection validation check(s) failed.`);
  process.exit(1);
}
