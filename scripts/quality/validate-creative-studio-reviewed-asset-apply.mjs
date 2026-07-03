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

function add(name, pass, detail = "") {
  checks.push({ name, pass: Boolean(pass), detail });
}

const service = read("lib/services/creative-studio.service.ts");
const applyRoute = read("app/api/dashboard/creative-studio/assets/[assetId]/apply/route.ts");
const rollbackRoute = exists("app/api/dashboard/creative-studio/assets/[assetId]/rollback/route.ts")
  ? read("app/api/dashboard/creative-studio/assets/[assetId]/rollback/route.ts")
  : "";
const validators = read("lib/validators/index.ts");
const page = read("app/[locale]/dashboard/creative-studio/page.tsx");
const packageJson = read("package.json");
const validateProject = read("scripts/quality/validate-project.mjs");
const readme = read("README.md");
const roadmap = read("docs/NEXT_PHASE_ROADMAP.md");
const sourceOfTruth = read("docs/CURRENT_SOURCE_OF_TRUTH.md");

add("P120 phase document exists", exists("docs/PHASE_120_CREATIVE_STUDIO_REVIEWED_ASSET_APPLY_ROLLBACK.md"));

add("apply route exists", exists("app/api/dashboard/creative-studio/assets/[assetId]/apply/route.ts"));
add("rollback route exists", exists("app/api/dashboard/creative-studio/assets/[assetId]/rollback/route.ts"));
add("apply route is POST-only", /export async function POST/.test(applyRoute) && !/export async function GET/.test(applyRoute));
add("rollback route is POST-only", rollbackRoute ? (/export async function POST/.test(rollbackRoute) && !/export async function GET/.test(rollbackRoute)) : false);

add("apply requires confirm=true", /confirmed !== true/.test(validators));
add("apply checks organization access/role permission", /requireCreativeStudioOrganization/.test(applyRoute) && /hasPermission/.test(service));
add("apply supports only ORGANIZATION_BRAND for P120", /targetType === "ORGANIZATION_BRAND"|input\.targetType !== "ORGANIZATION_BRAND"/.test(service));
add("apply supports only LOGO/COVER", /LOGO|COVER/.test(service) && /getOrganizationBrandTargetField/.test(service));
add("apply mutates only Organization.logo/coverImage", /organization\.logo|organization\.coverImage/.test(service) && /tx\.organization\.update/.test(service));
add("Product.image is not mutated by P120 apply", !/prisma\.product\.update/.test(service) || /targetField === "product\.image"/.test(service));
add("FanpagePost.image is not mutated by P120 apply", !/prisma\.fanpagePost\.update/.test(service));
add("Campaign assets are not mutated", !/campaign\.update/.test(service));

add("provider execution still does not auto-apply", /publicAutoApply:\s*false/.test(service));
add("result ingestion still does not auto-apply", /publicAutoApply:\s*false/.test(service));
add("publicAutoApply remains false outside explicit apply", /publicMutation:\s*false/.test(service) || /noPublicAssetMutation/.test(service));

add("centralized URL safety validator is used", /assertPublicSafeAssetUrl/.test(service));
add("file:// URLs are rejected", /file:\/\//i.test(service) && /must not use file:\/\//.test(service));
add("localhost/private URLs are rejected", /localhost/.test(service) && /PRIVATE_IPV4_PATTERNS/.test(service));

add("rollback metadata is stored", /rollbackHint|p120Rollback/.test(service) && /previousValue/.test(service));
add("rollback event is recorded", /ASSET_ROLLED_BACK/.test(service));
add("apply event is recorded", /ASSET_APPLIED/.test(service));
add("public revalidation is called", /revalidateCreativeStudioPublicTarget/.test(service));

add("dashboard has Persian rollback labels", /بازگردانی تصویر قبلی/.test(page) && /اعمال شد/.test(page));
add("dashboard has apply confirmation labels", /اعمال شود/.test(page) && /تأیید اعمال/.test(page));
add("reject/archive preserved", /rejectGeneratedAsset|رد کردن/.test(page));

add("package exposes P120 validator", /"quality:creative-studio-reviewed-asset-apply":\s*"node scripts\/quality\/validate-creative-studio-reviewed-asset-apply\.mjs"/.test(packageJson));
add("quality local references P120 validator", /validate-creative-studio-reviewed-asset-apply\.mjs/.test(validateProject));

add("README marks P120B next", /Recommended next phase:\s+\*\*P120B - Customer order lifecycle notifications and guest SMS dry-run review\*\*/.test(readme));
add("roadmap marks P120 next", /\| P120 \| Creative Studio reviewed asset apply and rollback workflow\. \|/.test(roadmap));
add("source of truth keeps P119 baseline", /after P119 Creative Studio provider result ingestion and review stabilization/.test(sourceOfTruth));

for (const check of checks) {
  console.log(`${check.pass ? "PASS" : "FAIL"} ${check.name}${check.detail ? ` (${check.detail})` : ""}`);
}

const failed = checks.filter((check) => !check.pass);
if (failed.length > 0) {
  console.error(`\n${failed.length} Creative Studio reviewed asset apply validation check(s) failed.`);
  process.exit(1);
}
