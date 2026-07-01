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
    const rel = path.join(dir, entry.name).replaceAll(path.sep, "/");
    if (entry.isDirectory()) collectSource(rel, out);
    else if (/\.(ts|tsx|js|mjs)$/.test(rel)) out.push(rel);
  }
  return out;
}

const doc = exists("docs/PHASE_118_CREATIVE_STUDIO_ORGANIZATION_BRAND_PROVIDER_EXECUTION.md")
  ? read("docs/PHASE_118_CREATIVE_STUDIO_ORGANIZATION_BRAND_PROVIDER_EXECUTION.md")
  : "";
const client = read("lib/services/ai-media-service-client.ts");
const gate = read("lib/services/creative-studio-organization-brand-provider.ts");
const service = read("lib/services/creative-studio.service.ts");
const route = exists("app/api/dashboard/creative-studio/organization-brand/execute/route.ts")
  ? read("app/api/dashboard/creative-studio/organization-brand/execute/route.ts")
  : "";
const validators = read("lib/validators/index.ts");
const page = read("app/[locale]/dashboard/creative-studio/page.tsx");
const smoke = read("scripts/e2e/deployed-creative-studio-generated-assets.mjs");
const envExample = read(".env.example");
const packageJson = read("package.json");
const validateProject = read("scripts/quality/validate-project.mjs");
const readme = read("README.md");
const roadmap = read("docs/NEXT_PHASE_ROADMAP.md");
const sourceOfTruth = read("docs/CURRENT_SOURCE_OF_TRUTH.md");

const appSource = collectSource("app").concat(collectSource("lib"));
const directProviderFindings = appSource.filter((file) => {
  const text = read(file);
  return /localhost:8188|ComfyUI|GPU server local worker/i.test(text);
});
const p118RequestMethod = service.slice(
  service.indexOf("async requestOrganizationBrandProviderExecution"),
  service.indexOf("private async createOrganizationBrandGenerationRequest"),
);
const p118CreateMethod = service.slice(
  service.indexOf("private async createOrganizationBrandGenerationRequest"),
  service.indexOf("private async createProductImageGenerationJob"),
);
const p118SyncMethod = service.slice(
  service.indexOf("private async syncOrganizationBrandGenerationJob"),
  service.indexOf("async cancelJob"),
);

add("P118 phase document exists and is implemented", /Status: implemented/.test(doc) && /P118/.test(doc) && /provider execution wiring/.test(doc));
add("server-only AI media client exposes organization brand execution", /import "server-only"/.test(client) && /createOrganizationBrandGenerationJob/.test(client) && /getOrganizationBrandGenerationJob/.test(client) && /\/v1\/organization-brand\/jobs/.test(client));
add("AI media client reads URL and key lazily on the server", /function getAiMediaConfig/.test(client) && /AI_MEDIA_SERVICE_BASE_URL/.test(client) && /AI_MEDIA_SERVICE_INTERNAL_KEY/.test(client) && !/const AI_MEDIA_SERVICE_(BASE_)?URL\s*=/.test(client));
add("AI media client sanitizes provider errors", /sanitizedErrorText/.test(client) && /\[redacted\]/.test(client));
add("execution gate requires rollout plus explicit execution and dry-run off", /CREATIVE_STUDIO_ORGANIZATION_BRAND_PROVIDER_EXECUTION_ENABLED/.test(gate) && /CREATIVE_STUDIO_ORGANIZATION_BRAND_PROVIDER_DRY_RUN/.test(gate) && /enabled && executionRequested && !dryRun/.test(gate));
add("dry-run mode is supported and enabled by default", /dryRunSupported:\s*true/.test(gate) && /!== "false"/.test(gate) && /executionMode:\s*"disabled" \| "dry-run" \| "provider-requested"/.test(gate));
add("service implements P118 provider execution path behind gate", /requestOrganizationBrandProviderExecution/.test(service) && /createOrganizationBrandGenerationJob/.test(service) && /canCallProvider/.test(service) && /providerExecutionEnabled && !requestDryRun/.test(service));
add("service stores provider metadata and remote job id", /p118OrganizationBrandProviderExecution/.test(service) && /remoteJobId/.test(service) && /requestPayload/.test(service));
add("service keeps generated organization brand assets draft-only", /assetType,\s*\n\s*status:\s*"DRAFT"/.test(service) && /publicAutoApply:\s*false/.test(service) && /publicMutation:\s*false/.test(service));
add("service does not mutate organization logo or cover in provider execution", !/prisma\.organization\.update/.test(p118RequestMethod) && !/prisma\.organization\.update/.test(p118CreateMethod) && !/prisma\.organization\.update/.test(p118SyncMethod));
add("organization brand execution schema supports LOGO and COVER only", /executeOrganizationBrandProviderSchema/.test(validators) && /z\.enum\(\["LOGO", "COVER"\]\)/.test(validators) && /locale:\s*z\.enum\(\["fa", "en", "ar"\]\)/.test(validators));
add("dashboard route is server-mediated and secretless", /executeOrganizationBrandProviderSchema/.test(route) && /requireCreativeStudioOrganization/.test(route) && /requestOrganizationBrandProviderExecution/.test(route) && !/AI_MEDIA_SERVICE_INTERNAL_KEY/.test(route));
add("dashboard shows Persian execution labels", /اجرای تولید برند سازمانی/.test(page) && /تولید لوگو/.test(page) && /تولید کاور/.test(page) && /فقط پیش‌نویس ساخته می‌شود/.test(page) && /اعمال خودکار/.test(page));
add("dashboard posts to P118 route without provider secrets", /\/api\/dashboard\/creative-studio\/organization-brand\/execute/.test(page) && /dryRun:\s*true/.test(page) && !/AI_MEDIA_SERVICE_INTERNAL_KEY/.test(page));
add("deployed smoke covers safe P118 route behavior", /organization-brand\/execute/.test(smoke) && /publicAutoApply === false/.test(smoke) && /providerJobId/.test(smoke));
add("main app source has no direct GPU or ComfyUI URL", directProviderFindings.length === 0, directProviderFindings.join(", "));
add(".env.example keeps provider secret placeholders empty", /^CREATIVE_STUDIO_ORGANIZATION_BRAND_INTERNAL_KEY=$/m.test(envExample) && /^AI_MEDIA_SERVICE_INTERNAL_KEY=$/m.test(envExample));
add(".env.example documents execution disabled and dry-run default", /CREATIVE_STUDIO_ORGANIZATION_BRAND_PROVIDER_EXECUTION_ENABLED=false/.test(envExample) && /CREATIVE_STUDIO_ORGANIZATION_BRAND_PROVIDER_DRY_RUN=true/.test(envExample));
add("package exposes P118 validator", /"quality:creative-studio-organization-brand-provider-execution":\s*"node scripts\/quality\/validate-creative-studio-organization-brand-provider-execution\.mjs"/.test(packageJson));
add("quality local references P118 validator", /validate-creative-studio-organization-brand-provider-execution\.mjs/.test(validateProject) && /P118 Creative Studio organization brand provider execution validator passes/.test(validateProject));
add("README marks P119 complete and P120 next", /Latest completed implementation phase:\s+\*\*P119 - Creative Studio provider result ingestion and review stabilization\*\*/.test(readme) && /Recommended next phase:\s+\*\*P120 - Creative Studio reviewed asset apply and rollback workflow\*\*/.test(readme));
add("roadmap marks P119 complete and P120 next", /Completed through \*\*P119 - Creative Studio provider result ingestion and review stabilization\*\*/.test(roadmap) && /\| P118 \| Creative Studio organization-brand provider execution implementation\. \|/.test(roadmap) && /\| P119 \| Creative Studio provider result ingestion and review stabilization\. \|/.test(roadmap) && /\| P120 \| Creative Studio reviewed asset apply and rollback workflow\. \|/.test(roadmap));
add("source of truth names P119 baseline", /after P119 Creative Studio provider result ingestion and review stabilization/.test(sourceOfTruth) && /Creative Studio organization-brand provider execution wiring exists/.test(sourceOfTruth) && /Creative Studio provider result ingestion exists/.test(sourceOfTruth));

for (const check of checks) {
  console.log(`${check.pass ? "PASS" : "FAIL"} ${check.name}${check.detail ? ` (${check.detail})` : ""}`);
}

const failed = checks.filter((check) => !check.pass);
if (failed.length > 0) {
  console.error(`\n${failed.length} Creative Studio organization brand provider execution validation check(s) failed.`);
  process.exit(1);
}
