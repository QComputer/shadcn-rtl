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

function collectSource(dir, out = []) {
  const abs = path.join(root, dir);
  if (!fs.existsSync(abs)) return out;
  for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
    if (["node_modules", ".next", ".git"].includes(entry.name)) continue;
    const rel = path.join(dir, entry.name).replaceAll(path.sep, "/");
    if (entry.isDirectory()) collectSource(rel, out);
    else if (/\.(ts|tsx|js|mjs)$/.test(rel)) out.push(rel);
  }
  return out;
}

const validatorPath = "lib/validators/creative-studio-provider-output.ts";
const internalRoutePath = "app/api/internal/creative-studio/provider-results/organization-brand/route.ts";
const refreshRoutePath = "app/api/dashboard/creative-studio/jobs/[jobId]/refresh-provider-result/route.ts";
const rejectRoutePath = "app/api/dashboard/creative-studio/assets/[assetId]/reject/route.ts";
const docPath = "docs/PHASE_119_CREATIVE_STUDIO_PROVIDER_RESULT_INGESTION.md";

const validator = exists(validatorPath) ? read(validatorPath) : "";
const service = read("lib/services/creative-studio.service.ts");
const client = read("lib/services/ai-media-service-client.ts");
const internalRoute = exists(internalRoutePath) ? read(internalRoutePath) : "";
const refreshRoute = exists(refreshRoutePath) ? read(refreshRoutePath) : "";
const rejectRoute = exists(rejectRoutePath) ? read(rejectRoutePath) : "";
const page = read("app/[locale]/dashboard/creative-studio/page.tsx");
const smoke = read("scripts/e2e/deployed-creative-studio-generated-assets.mjs");
const envExample = read(".env.example");
const runtimeEnv = read("lib/runtime-env.ts");
const packageJson = read("package.json");
const validateProject = read("scripts/quality/validate-project.mjs");
const readme = read("README.md");
const roadmap = read("docs/NEXT_PHASE_ROADMAP.md");
const sourceOfTruth = read("docs/CURRENT_SOURCE_OF_TRUTH.md");
const doc = exists(docPath) ? read(docPath) : "";

const appAndLib = collectSource("app").concat(collectSource("lib"));
const directComfyFindings = appAndLib.filter((file) => {
  const text = read(file);
  return /localhost:8188|ComfyUI|file:\/\/.*provider|GPU server private URL|local worker/i.test(text);
});
const clientComponents = collectSource("app")
  .concat(collectSource("components"))
  .filter((file) => /"use client"|'use client'/.test(read(file)));
const clientSecretFindings = clientComponents.filter((file) => /AI_MEDIA_SERVICE_INTERNAL_KEY|CREATIVE_STUDIO_PROVIDER_RESULTS_INTERNAL_KEY|x-bazarbaz-ai-key|x-creative-studio-provider-key/i.test(read(file)));

const ingestionMethod = service.slice(
  service.indexOf("async ingestOrganizationBrandProviderResult"),
  service.indexOf("async refreshOrganizationBrandProviderResult"),
);
const refreshMethod = service.slice(
  service.indexOf("async refreshOrganizationBrandProviderResult"),
  service.indexOf("private async syncOrganizationBrandGenerationJob"),
);
const rejectMethod = service.slice(
  service.indexOf("async rejectAsset"),
  service.indexOf("async recordAssetApplication"),
);

add("P119 provider output validator exists", exists(validatorPath) && /validateCreativeStudioProviderResult/.test(validator));
add("provider result contract supports expected statuses", /"PENDING" \| "RUNNING" \| "SUCCEEDED" \| "FAILED" \| "CANCELLED"/.test(validator));
add("output URL validator rejects file URLs", /file:\/\//i.test(validator) && /must not use file:\/\//.test(validator));
add("output URL validator rejects localhost/private hosts", /localhost/.test(validator) && /PRIVATE_IPV4_PATTERNS/.test(validator) && /169\\.254/.test(validator) && /172\\\./.test(validator));
add("output URL validator requires HTTPS in production", /NODE_ENV === "production"/.test(validator) && /must be https in production/.test(validator));
add("output URL validator rejects credentials and protocol-relative URLs", /protocol-relative/.test(validator) && /username \|\| parsed\.password/.test(validator));
add("output MIME types are restricted to images", /ALLOWED_MIME_TYPES/.test(validator) && /image\/png/.test(validator) && /image\/webp/.test(validator));
add("provider metadata is sanitized and secret-redacted", /sanitizeCreativeStudioProviderMetadata/.test(validator) && /SECRET_KEY_PATTERN/.test(validator) && /\[redacted\]/.test(validator));
add("stable output key supports idempotency", /stableCreativeStudioProviderOutputKey/.test(validator) && /providerAssetId/.test(validator) && /checksum/.test(validator) && /sha256/.test(validator));

add("server-only AI media client polls provider results", /import "server-only"/.test(client) && /getOrganizationBrandGenerationResult/.test(client) && /\/v1\/organization-brand\/jobs\/.+\/result/.test(client));
add("provider result polling validates response shape", /validateCreativeStudioProviderResult/.test(client) && /mapOrganizationBrandJobToProviderResult/.test(client));
add("provider result dry-run mode is supported", /CREATIVE_STUDIO_ORGANIZATION_BRAND_PROVIDER_RESULT_DRY_RUN/.test(client) && /dryRun:\s*true/.test(client) && /outputs:\s*\[\]/.test(client));
add("provider result envs are documented", /CREATIVE_STUDIO_ORGANIZATION_BRAND_PROVIDER_RESULTS_ENABLED=false/.test(envExample) && /CREATIVE_STUDIO_ORGANIZATION_BRAND_PROVIDER_RESULT_DRY_RUN=true/.test(envExample) && /CREATIVE_STUDIO_ORGANIZATION_BRAND_PROVIDER_POLLING_ENABLED=false/.test(envExample));
add("runtime env validates result flags", /organizationBrandProviderResultsEnabled/.test(runtimeEnv) && /organizationBrandProviderPollingEnabled/.test(runtimeEnv) && /provider result ingestion\/polling requires provider execution/.test(runtimeEnv));

add("internal ingestion route exists", exists(internalRoutePath) && /POST/.test(internalRoute));
add("internal ingestion route requires a server secret", /CREATIVE_STUDIO_PROVIDER_RESULTS_INTERNAL_KEY/.test(internalRoute) && /AI_MEDIA_SERVICE_INTERNAL_KEY/.test(internalRoute) && /Unauthorized/.test(internalRoute) && /headerSecret === secret/.test(internalRoute));
add("internal ingestion route does not accept browser session auth", !/requireCreativeStudioOrganization|auth\(/.test(internalRoute));
add("internal ingestion route calls service ingestion only", /ingestOrganizationBrandProviderResult/.test(internalRoute) && /source:\s*"internal-webhook"/.test(internalRoute));

add("dashboard refresh route exists", exists(refreshRoutePath) && /refreshOrganizationBrandProviderResult/.test(refreshRoute));
add("dashboard refresh route is dashboard-authenticated", /requireCreativeStudioOrganization/.test(refreshRoute) && /session\.user\.role/.test(refreshRoute));
add("dashboard refresh response keeps publicAutoApply false", /publicAutoApply:\s*false/.test(refreshRoute));

add("ingestion service supports only organization brand target", /input\.targetType !== "ORGANIZATION_BRAND"/.test(ingestionMethod));
add("ingestion service validates provider job ownership", /Provider job id does not match/.test(ingestionMethod) && /organizationId:\s*input\.organizationId/.test(ingestionMethod));
add("ingestion service supports LOGO and COVER only", /getStringMetadata\(localJob\.inputs, "assetType"\) === "COVER" \? "COVER" : "LOGO"/.test(ingestionMethod) && /Provider output asset type does not match/.test(ingestionMethod));
add("ingestion service creates draft review assets", /status:\s*"DRAFT"/.test(ingestionMethod) && /reviewStatus:\s*"READY_FOR_REVIEW"/.test(ingestionMethod) && /draftOnly:\s*true/.test(ingestionMethod));
add("ingestion service is idempotent", /existingKeys/.test(ingestionMethod) && /existingUrls/.test(ingestionMethod) && /stableCreativeStudioProviderOutputKey/.test(ingestionMethod));
add("ingestion service records usage and audit events", /createUsageEventOnce/.test(ingestionMethod) && /writeAuditLog/.test(ingestionMethod));
add("ingestion service never mutates public organization images", !/prisma\.organization\.update/.test(ingestionMethod) && !/Organization\.logo|Organization\.coverImage/.test(ingestionMethod));
add("ingestion service never mutates product or fanpage images", !/prisma\.product\.update/.test(ingestionMethod) && !/prisma\.fanpagePost\.update/.test(ingestionMethod));
add("ingestion metadata keeps public auto-apply false", /publicAutoApply:\s*false/.test(ingestionMethod) && /publicMutation:\s*false/.test(ingestionMethod));

add("dashboard refresh service respects polling/dry-run gates", /CREATIVE_STUDIO_ORGANIZATION_BRAND_PROVIDER_POLLING_ENABLED/.test(refreshMethod) && /CREATIVE_STUDIO_ORGANIZATION_BRAND_PROVIDER_RESULTS_ENABLED/.test(refreshMethod));
add("dashboard refresh service does not mutate public assets", !/prisma\.organization\.update|prisma\.product\.update|prisma\.fanpagePost\.update/.test(refreshMethod));

add("reject/archive route exists", exists(rejectRoutePath) && /rejectAsset/.test(rejectRoute));
add("reject/archive service marks rejected without deletion", /status:\s*"REJECTED"/.test(rejectMethod) && /p119AssetReview/.test(rejectMethod) && !/delete/.test(rejectMethod));
add("reject/archive service blocks applied assets", /Applied Creative Studio assets cannot be rejected/.test(rejectMethod));
add("reject/archive service records audit/usage", /creativeStudioUsageEvent/.test(rejectMethod) && /writeAuditLog/.test(rejectMethod));

add("dashboard shows Persian P119 review labels", /نتیجه تولید/.test(page) && /بررسی نتیجه تولید/.test(page) && /فقط برای بررسی/.test(page) && /رد کردن خروجی/.test(page));
add("dashboard shows public auto-apply warning", /اعمال خودکار روی صفحه عمومی غیرفعال است/.test(page) && /publicAutoApplyWarning/.test(page));
add("dashboard exposes refresh and reject actions", /refreshProviderResult/.test(page) && /rejectGeneratedAsset/.test(page) && /refresh-provider-result/.test(page) && /\/reject/.test(page));
add("dashboard disables selection/application for rejected assets", /asset\.status === "REJECTED"/.test(page) && /disabledReason:\s*copy\.rejectOutput/.test(page));

add("main app source has no direct ComfyUI/GPU/local worker calls", directComfyFindings.length === 0, directComfyFindings.join(", "));
add("client components do not reference provider secrets", clientSecretFindings.length === 0, clientSecretFindings.join(", "));

add("deployed smoke covers P119 safe routes", /refresh-provider-result/.test(smoke) && /provider-results\/organization-brand/.test(smoke) && /file:\/\//.test(smoke) && /127\.0\.0\.1/.test(smoke) && /publicAutoApply/.test(smoke));
add("package exposes P119 validator", /"quality:creative-studio-provider-result-ingestion":\s*"node scripts\/quality\/validate-creative-studio-provider-result-ingestion\.mjs"/.test(packageJson));
add("quality local references P119 validator", /validate-creative-studio-provider-result-ingestion\.mjs/.test(validateProject) && /P119 Creative Studio provider result ingestion validator passes/.test(validateProject));
add("P119 docs exist and state safety boundaries", /Status: implemented/.test(doc) && /draft\/review-only/.test(doc) && /Public auto-apply remains disabled/.test(doc) && /never calls ComfyUI/.test(doc));
add("README marks P119 complete and P120 next", /Latest completed implementation phase:\s+\*\*P119 - Creative Studio provider result ingestion and review stabilization\*\*/.test(readme) && /Recommended next phase:\s+\*\*P120 - Creative Studio reviewed asset apply and rollback workflow\*\*/.test(readme));
add("roadmap marks P119 complete and P120 next", /Completed through \*\*P119 - Creative Studio provider result ingestion and review stabilization\*\*/.test(roadmap) && /\| P119 \| Creative Studio provider result ingestion and review stabilization\. \|/.test(roadmap) && /\| P120 \| Creative Studio reviewed asset apply and rollback workflow\. \|/.test(roadmap));
add("source of truth names P119 baseline", /after P119 Creative Studio provider result ingestion and review stabilization/.test(sourceOfTruth) && /Creative Studio provider result ingestion exists/.test(sourceOfTruth));

for (const check of checks) {
  console.log(`${check.pass ? "PASS" : "FAIL"} ${check.name}${check.detail ? ` (${check.detail})` : ""}`);
}

const failed = checks.filter((check) => !check.pass);
if (failed.length > 0) {
  console.error(`\n${failed.length} Creative Studio provider result ingestion validation check(s) failed.`);
  process.exit(1);
}
