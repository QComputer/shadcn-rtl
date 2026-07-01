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

const doc = exists("docs/PHASE_117_CREATIVE_STUDIO_ORGANIZATION_BRAND_PROVIDER_ROLLOUT_GATE.md")
  ? read("docs/PHASE_117_CREATIVE_STUDIO_ORGANIZATION_BRAND_PROVIDER_ROLLOUT_GATE.md")
  : "";
const provider = read("lib/services/creative-studio-organization-brand-provider.ts");
const readiness = read("lib/services/creative-studio-generation-readiness.ts");
const runtimeEnv = read("lib/runtime-env.ts");
const envExample = read(".env.example");
const service = read("lib/services/creative-studio.service.ts");
const page = read("app/[locale]/dashboard/creative-studio/page.tsx");
const smoke = read("scripts/e2e/deployed-creative-studio-generated-assets.mjs");
const sourceBaseline = read("scripts/quality/validate-source-baseline.mjs");
const packageJson = read("package.json");
const validateProject = read("scripts/quality/validate-project.mjs");
const readme = read("README.md");
const roadmap = read("docs/NEXT_PHASE_ROADMAP.md");
const sourceOfTruth = read("docs/CURRENT_SOURCE_OF_TRUTH.md");

add("P117 phase document exists and is implemented", /Status: implemented/.test(doc) && /P117/.test(doc) && /provider execution rollout gate/.test(doc));
add("organization brand provider helper is server-only and secret-safe", /import "server-only"/.test(provider) && /getOrganizationBrandProviderStatus/.test(provider) && /internalKeyConfigured/.test(provider) && !/internalKey:\s*process\.env/.test(provider) && !/serviceUrl:\s*process\.env/.test(provider));
add("provider helper exposes explicit rollout gate envs", /CREATIVE_STUDIO_ORGANIZATION_BRAND_PROVIDER_ENABLED/.test(provider) && /CREATIVE_STUDIO_ORGANIZATION_BRAND_SERVICE_URL/.test(provider) && /CREATIVE_STUDIO_ORGANIZATION_BRAND_INTERNAL_KEY/.test(provider) && /CREATIVE_STUDIO_ORGANIZATION_BRAND_ROLLBACK_PAUSED/.test(provider));
add("provider helper requires approval, limits, and rollback controls", /approvalRequired:\s*true/.test(provider) && /CREATIVE_STUDIO_ORGANIZATION_BRAND_PROVIDER_APPROVED_BY/.test(provider) && /CREATIVE_STUDIO_ORGANIZATION_BRAND_DAILY_JOB_LIMIT/.test(provider) && /CREATIVE_STUDIO_ORGANIZATION_BRAND_ESTIMATED_JOB_COST_CENTS/.test(provider) && /rollback-paused/.test(provider));
add("readiness exposes P117 rollout gate without public auto-apply", /organizationBrandProvider/.test(readiness) && /providerExecutionGatePhase:\s*"P117"/.test(readiness) && /rolloutGate:\s*organizationBrandProvider/.test(readiness) && /publicAutoApplyAllowed:\s*false/.test(readiness) && /nextPhase:\s*"P120 - Creative Studio reviewed asset apply and rollback workflow"/.test(readiness));
add("readiness keeps manual selection and confirmation in the checklist", /selected-candidate-review/.test(readiness) && /manual-apply-confirmation/.test(readiness) && /provider-execution-approval/.test(readiness) && /secret-safe-status/.test(readiness));
add("service records P117 gate metadata and keeps execution behind explicit P118 controls", /getOrganizationBrandProviderStatus/.test(service) && /p117OrganizationBrandProviderGate/.test(service) && /providerExecutionGateOnly:\s*true/.test(service) && /p118OrganizationBrandProviderExecution/.test(service) && /canCallProvider/.test(service) && /providerExecutionEnabled && !requestDryRun/.test(service));
add("dashboard renders P117 rollout state for admins", /providerRolloutGate/.test(page) && /providerRequested/.test(page) && /providerConfigured/.test(page) && /providerApproved/.test(page) && /rollbackPaused/.test(page) && /rolloutIssues/.test(page));
add("dashboard posts through server-mediated route without provider secrets", /\/api\/dashboard\/creative-studio\/organization-brand\/execute/.test(page) && /dryRun:\s*true/.test(page) && !/\/v1\/organization-brand\/jobs/.test(page) && !/AI_MEDIA_SERVICE_INTERNAL_KEY/.test(page));
add("runtime env validates organization brand rollout gate", /organizationBrandProviderRequested/.test(runtimeEnv) && /CREATIVE_STUDIO_ORGANIZATION_BRAND_PROVIDER_ENABLED/.test(runtimeEnv) && /CREATIVE_STUDIO_ORGANIZATION_BRAND_ROLLBACK_REASON/.test(runtimeEnv) && /positive job\/cost limits/.test(runtimeEnv));
add(".env.example documents safe organization brand rollout placeholders", /CREATIVE_STUDIO_ORGANIZATION_BRAND_PROVIDER_ENABLED=false/.test(envExample) && /^CREATIVE_STUDIO_ORGANIZATION_BRAND_INTERNAL_KEY=$/m.test(envExample) && /CREATIVE_STUDIO_ORGANIZATION_BRAND_ROLLBACK_PAUSED=false/.test(envExample));
add("source baseline scans the new internal key placeholder", /CREATIVE_STUDIO_ORGANIZATION_BRAND_INTERNAL_KEY/.test(sourceBaseline));
add("deployed smoke verifies P117 rollout gate and P118 dry-run behavior", /providerExecutionGatePhase === "P117"/.test(smoke) && /organization-brand\/execute/.test(smoke) && /providerExecutionDryRun === true/.test(smoke) && /brand rollout gate must not call a real provider/.test(smoke));
add("package exposes P117 validator", /"quality:creative-studio-organization-brand-provider-rollout":\s*"node scripts\/quality\/validate-creative-studio-organization-brand-provider-rollout\.mjs"/.test(packageJson));
add("quality local references P117 validator", /validate-creative-studio-organization-brand-provider-rollout\.mjs/.test(validateProject) && /P117 Creative Studio organization brand provider rollout validator passes/.test(validateProject));
add("README marks current P119 baseline and P120 next", /Latest completed implementation phase:\s+\*\*P119 - Creative Studio provider result ingestion and review stabilization\*\*/.test(readme) && /Recommended next phase:\s+\*\*P120 - Creative Studio reviewed asset apply and rollback workflow\*\*/.test(readme));
add("roadmap keeps P117 complete through P119 baseline", /Completed through \*\*P119 - Creative Studio provider result ingestion and review stabilization\*\*/.test(roadmap) && /\| P117 \| Creative Studio organization-brand provider execution rollout gate\. \|/.test(roadmap) && /\| P118 \| Creative Studio organization-brand provider execution implementation\. \|/.test(roadmap) && /\| P119 \| Creative Studio provider result ingestion and review stabilization\. \|/.test(roadmap));
add("source of truth keeps P117 rollout gate in current baseline", /after P119 Creative Studio provider result ingestion and review stabilization/.test(sourceOfTruth) && /Creative Studio organization-brand provider execution rollout gate exists/.test(sourceOfTruth));

for (const check of checks) {
  console.log(`${check.pass ? "PASS" : "FAIL"} ${check.name}`);
}

const failed = checks.filter((check) => !check.pass);
if (failed.length > 0) {
  console.error(`\n${failed.length} Creative Studio organization brand provider rollout validation check(s) failed.`);
  process.exit(1);
}
