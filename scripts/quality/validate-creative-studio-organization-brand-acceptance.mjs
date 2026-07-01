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

const doc = exists("docs/PHASE_116_CREATIVE_STUDIO_ORGANIZATION_BRAND_ACCEPTANCE.md")
  ? read("docs/PHASE_116_CREATIVE_STUDIO_ORGANIZATION_BRAND_ACCEPTANCE.md")
  : "";
const service = read("lib/services/creative-studio.service.ts");
const cache = read("lib/services/creative-studio-cache-revalidation.ts");
const readiness = read("lib/services/creative-studio-generation-readiness.ts");
const validators = read("lib/validators/index.ts");
const page = read("app/[locale]/dashboard/creative-studio/page.tsx");
const smoke = read("scripts/e2e/deployed-creative-studio-generated-assets.mjs");
const packageJson = read("package.json");
const validateProject = read("scripts/quality/validate-project.mjs");
const readme = read("README.md");
const roadmap = read("docs/NEXT_PHASE_ROADMAP.md");
const sourceOfTruth = read("docs/CURRENT_SOURCE_OF_TRUTH.md");

add("P116 phase document exists and is implemented", /Status: implemented/.test(doc) && /P116/.test(doc) && /generated-asset acceptance/.test(doc));
add("organization brand provider execution remains out of scope", /providerExecutionGatePhase:\s*"P117"/.test(readiness) && /publicAutoApplyAllowed:\s*false/.test(readiness) && !/\/v1\/organization-brand\/jobs/.test(service));
add("schema keeps logo and cover as the only organization brand assets", /targetType === "ORGANIZATION_BRAND"/.test(validators) && /\["LOGO", "COVER"\]\.includes\(input\.assetType\)/.test(validators));
add("service exposes selected-target metadata helpers", /getNestedMetadataRecord/.test(service) && /getSelectedTargetField/.test(service) && /p113Selection/.test(service));
add("service requires organization brand selection before public apply", /asset\.job\.targetType === "ORGANIZATION_BRAND"/.test(service) && /asset\.status !== "SELECTED"/.test(service) && /must be selected before public apply/.test(service));
add("service requires selected organization brand target to match apply target", /selectedTargetField !== targetField/.test(service) && /Selected organization brand target does not match/.test(service));
add("service records P116 acceptance metadata on organization brand apply", /p116OrganizationBrandAcceptance/.test(service) && /selectedBeforeApply:\s*true/.test(service) && /publicMutation:\s*true/.test(service));
add("service preserves logo and cover target mapping", /organization\.logo/.test(service) && /organization\.coverImage/.test(service) && /settings:manage/.test(service));
add("cache revalidation covers all locale public logo and cover surfaces", /supportedLocales/.test(cache) && /\/shop\/\$\{input\.organizationSlug\}/.test(cache) && /\/appointment\/\$\{input\.organizationSlug\}/.test(cache) && /revalidateTag\("home-page", "max"\)/.test(cache));
add("dashboard still requires select then confirmation apply", /selectGeneratedAsset/.test(page) && /setPendingApply/.test(page) && /confirmationText\.trim\(\)/.test(page) && /copy\.confirmationRequired/.test(page));
add("dashboard maps logo and cover apply labels", /applyAsLogo/.test(page) && /applyAsCover/.test(page) && /organization\.logo/.test(page) && /organization\.coverImage/.test(page));
add("deployed smoke verifies organization brand readiness policy", /organizationBrandPlan/.test(smoke) && /selectionStillRequired/.test(smoke) && /publicAutoApplyAllowed/.test(smoke));
add("deployed smoke creates a safe request-only logo job", /organization logo request acceptance stays draft-first and non-mutating/.test(smoke) && /targetType:\s*"ORGANIZATION_BRAND"/.test(smoke) && /assetType:\s*"LOGO"/.test(smoke) && /p116DeployedSmoke/.test(smoke));
add("deployed smoke verifies select and apply rejection without public mutation", /draft brand asset without URL should not select/.test(smoke) && /unselected\/no-url brand asset should not apply/.test(smoke) && /publicMutation === false/.test(smoke));
add("package exposes P116 validator", /"quality:creative-studio-organization-brand-acceptance":\s*"node scripts\/quality\/validate-creative-studio-organization-brand-acceptance\.mjs"/.test(packageJson));
add("quality local references P116 validator", /validate-creative-studio-organization-brand-acceptance\.mjs/.test(validateProject) && /P116 Creative Studio organization brand acceptance validator passes/.test(validateProject));
add("README marks P116 complete and P117 next", /Latest completed implementation phase:\s+\*\*P117 - Creative Studio organization-brand provider execution rollout gate\*\*/.test(readme) && /Recommended next phase:\s+\*\*P118 - Creative Studio organization-brand provider execution implementation\*\*/.test(readme));
add("roadmap marks P116 complete and P117 next", /Completed through \*\*P117 - Creative Studio organization-brand provider execution rollout gate\*\*/.test(roadmap) && /\| P116 \| Creative Studio organization logo and cover generated-asset acceptance\. \|/.test(roadmap) && /\| P117 \| Creative Studio organization-brand provider execution rollout gate\. \|/.test(roadmap));
add("source of truth names P116 baseline", /after P117 Creative Studio organization-brand provider execution rollout gate/.test(sourceOfTruth) && /Creative Studio organization logo and cover generated-asset acceptance exists/.test(sourceOfTruth));

for (const check of checks) {
  console.log(`${check.pass ? "PASS" : "FAIL"} ${check.name}`);
}

const failed = checks.filter((check) => !check.pass);
if (failed.length > 0) {
  console.error(`\n${failed.length} Creative Studio organization brand acceptance validation check(s) failed.`);
  process.exit(1);
}
