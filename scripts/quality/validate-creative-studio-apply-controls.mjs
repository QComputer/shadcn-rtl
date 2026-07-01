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

const doc = exists("docs/PHASE_110_CREATIVE_STUDIO_APPLY_CONTROLS.md") ? read("docs/PHASE_110_CREATIVE_STUDIO_APPLY_CONTROLS.md") : "";
const service = read("lib/services/creative-studio.service.ts");
const cache = read("lib/services/creative-studio-cache-revalidation.ts");
const route = read("app/api/dashboard/creative-studio/assets/[assetId]/apply/route.ts");
const validators = read("lib/validators/index.ts");
const page = read("app/[locale]/dashboard/creative-studio/page.tsx");
const packageJson = read("package.json");
const validateProject = read("scripts/quality/validate-project.mjs");
const readme = read("README.md");
const roadmap = read("docs/NEXT_PHASE_ROADMAP.md");
const sourceOfTruth = read("docs/CURRENT_SOURCE_OF_TRUTH.md");

add("P110 phase document exists and is implemented", /Status: implemented/.test(doc) && /P110/.test(doc));
add("apply route preserves organization context", /searchParams\.get\("organizationId"\)/.test(route) && /input\.organizationId/.test(route) && /requireCreativeStudioOrganization\(requestedOrganizationId\)/.test(route));
add("apply schema supports explicit target fields and confirmation", /creativeStudioApplyTargetFieldSchema/.test(validators) && /applyToTarget:\s*z\.boolean\(\)/.test(validators) && /targetField/.test(validators) && /confirmationText/.test(validators) && /اعمال شود/.test(validators));
add("service no longer rejects all public apply requests", !/input\.applyToTarget !== false/.test(service) && /if \(!input\.applyToTarget\)/.test(service));
add("recorded-only path is preserved", /recordedOnly:\s*true/.test(service) && /publicMutation:\s*false/.test(service));
add("service maps only safe target and asset combinations", /PRODUCT_IMAGE/.test(service) && /product\.image/.test(service) && /ORGANIZATION_BRAND/.test(service) && /organization\.logo/.test(service) && /organization\.coverImage/.test(service) && /FANPAGE_IMAGE/.test(service) && /fanpagePost\.image/.test(service) && /Unsupported Creative Studio apply target/.test(service));
add("service validates public-safe asset URL", /assertPublicSafeAssetUrl/.test(service) && /storedUrl \|\| asset\.draftUrl \|\| asset\.sourceUrl/.test(service) && /http:/.test(service) && /https:/.test(service) && /\/uploads\//.test(service) && /localhost/.test(service) && /credentials/.test(service));
add("service mutates Product.image for product images", /tx\.product\.update\(\{ where: \{ id: target\.id \}, data: \{ image: publicAssetUrl \} \}\)/.test(service));
add("service mutates Organization.logo for logo assets", /tx\.organization\.update\(\{ where: \{ id: target\.id \}, data: \{ logo: publicAssetUrl \} \}\)/.test(service));
add("service mutates Organization.coverImage for cover assets", /tx\.organization\.update\(\{ where: \{ id: target\.id \}, data: \{ coverImage: publicAssetUrl \} \}\)/.test(service));
add("service mutates FanpagePost.image for fanpage image assets", /tx\.fanpagePost\.update\(\{ where: \{ id: target\.id \}, data: \{ image: publicAssetUrl \} \}\)/.test(service));
add("service does not mutate Campaign images", !/campaign\.update/.test(service) && /CAMPAIGN/.test(validators));
add("service records rollback metadata", /previousValue/.test(service) && /appliedUrl/.test(service) && /rollbackHint/.test(service) && /p110Application/.test(service));
add("service writes usage event and audit logs", /creativeStudioUsageEvent\.create/.test(service) && /action:\s*"ASSET_APPLIED"/.test(service) && /writeAuditLog/.test(service) && /entityType: target\.entityType/.test(service) && /entityType:\s*"CreativeStudioAsset"/.test(service));
add("service calls cache revalidation helper", /revalidateCreativeStudioPublicTarget/.test(service) && /cacheRevalidation/.test(service));
add("cache helper revalidates all locales and home tag", /supportedLocales/.test(cache) && /revalidatePath/.test(cache) && /revalidateTag\("home-page", "max"\)/.test(cache) && /product\.image/.test(cache) && /organization\.logo/.test(cache) && /fanpagePost\.image/.test(cache));
add("dashboard includes Persian apply controls and confirmation copy", /اعمال روی هدف عمومی/.test(page) && /اعمال شود/.test(page) && /AlertDialog/.test(page) && /method:\s*"POST"/.test(page) && /targetField/.test(page));
add("package exposes P110 validator", /"quality:creative-studio-apply-controls":\s*"node scripts\/quality\/validate-creative-studio-apply-controls\.mjs"/.test(packageJson));
add("quality local references P110 validator", /validate-creative-studio-apply-controls\.mjs/.test(validateProject) && /P110 Creative Studio apply controls validator passes/.test(validateProject));
add("README marks P110 complete and P111 next", /Latest completed implementation phase:\s+\*\*P118 - Creative Studio organization-brand provider execution implementation\*\*/.test(readme) && /Recommended next phase:\s+\*\*P119 - Creative Studio provider execution smoke and generated asset ingestion\*\*/.test(readme));
add("roadmap marks P110 complete and P111 next", /Completed through \*\*P118 - Creative Studio organization-brand provider execution implementation\*\*/.test(roadmap) && /\| P110 \| Creative Studio apply controls and cache-safe public asset updates\. \|/.test(roadmap) && /\| P111 \| Creative Studio generation readiness gate and AI-service contract sync\. \|/.test(roadmap));
add("source of truth names P110 baseline", /after P118 Creative Studio organization-brand provider execution implementation/.test(sourceOfTruth) && /Creative Studio apply controls exist/.test(sourceOfTruth));

const failed = checks.filter((check) => !check.pass);
for (const check of checks) {
  console.log(`${check.pass ? "PASS" : "FAIL"} ${check.name}`);
}

if (failed.length > 0) {
  console.error(`\n${failed.length} Creative Studio apply control validation check(s) failed.`);
  process.exit(1);
}
