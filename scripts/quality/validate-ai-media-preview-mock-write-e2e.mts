import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../../", import.meta.url));

function read(relativePath: string) {
  const path = `${projectRoot}${relativePath.startsWith("/") ? "" : "/"}${relativePath}`;
  return existsSync(path) ? readFileSync(path, "utf8") : "";
}

function report(name: string, ok: boolean) {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}`);
  return ok;
}

const writeGuard = read("lib/ai-media/preview-write-guard.ts");
const dbGuard = read("lib/ai-media/preview-db-identity-guard.ts");
const submitService = read("lib/services/ai-media-preview-mock-write-service.ts");
const listRoute = read("app/api/dashboard/ai-media/preview/jobs/route.ts");
const detailRoute = read("app/api/dashboard/ai-media/preview/jobs/[id]/route.ts");
const tests = read("tests/unit/ai-media-preview-mock-write-e2e.test.ts");
const liveScript = read("scripts/e2e/ai-media-preview-mock-write-e2e.mjs");
const docs = read("docs/ai-media/AI_MEDIA_PREVIEW_MOCK_WRITE_E2E.md");
const handoff = `${read("docs/AI_HANDOFF_CURRENT_STATE.md")}\n${read("docs/AI_HANDOFF_NEXT_PROMPT.md")}\n${read("docs/AI_HANDOFF_VALIDATION.md")}`;
const packageJson = read("package.json");
const routeSource = `${listRoute}\n${detailRoute}`;
const runtimeSource = `${writeGuard}\n${dbGuard}\n${submitService}\n${routeSource}`;

const checks: Array<[string, boolean]> = [
  ["Preview write guard exists and blocks Production", /evaluateAiMediaPreviewWriteGuard/.test(writeGuard) && /disabled in Production/.test(writeGuard)],
  ["DB identity guard exists", /evaluateAiMediaPreviewDbIdentityGuard/.test(dbGuard) && /Preview and Production DB fingerprints/.test(dbGuard)],
  ["DB identity guard requires explicit verification", /explicitPreviewDbIdentityVerified/.test(dbGuard) && /AI_MEDIA_PREVIEW_DB_IDENTITY_VERIFIED/.test(dbGuard)],
  ["no Production write enablement", !/vercelEnv === "production"[\s\S]{0,240}allowed:\s*true/.test(`${writeGuard}\n${dbGuard}`)],
  ["no NEXT_PUBLIC Render secret", !/NEXT_PUBLIC_.*(RENDER|AI_MEDIA).*?(SECRET|TOKEN|KEY)/i.test(runtimeSource + packageJson)],
  ["no client-side Render fetch", !/components[\s\S]*bazar-baz-ai-media-service|fetch\([^)]*AI_MEDIA_SERVICE/i.test(runtimeSource)],
  ["Preview route requires auth", /requireAuthSession/.test(routeSource) && /requireCurrentOrganizationId/.test(routeSource)],
  ["Preview route requires write and DB guards", /evaluateAiMediaPreviewWriteGuard/.test(routeSource) && /evaluateAiMediaPreviewDbIdentityGuard/.test(routeSource)],
  ["idempotency key is required", /idempotency key/i.test(listRoute) && /ApiError\(400/.test(listRoute)],
  ["Render mutation only appears behind Preview guard", /submitPreviewMockAiMediaJob/.test(listRoute) && /if \(!guard\.allowed \|\| !dbGuard\.allowed\)/.test(listRoute)],
  ["status sync is server-side only", /export async function POST/.test(detailRoute) && /syncPreviewMockAiMediaJobStatus/.test(detailRoute)],
  ["no Blob write", !/@vercel\/blob|BLOB_READ_WRITE_TOKEN|storeCreativeStudioAsset|\bput\s*\(|\bdel\s*\(/.test(submitService + routeSource)],
  ["no real generation", /realGeneration:\s*false/.test(routeSource) && !/AI_MEDIA_REAL_GENERATION_ENABLED\s*=\s*["']true/.test(runtimeSource)],
  ["service uses server-only AI media client", /import "server-only"/.test(submitService) && /createAiMediaJob/.test(submitService) && /getAiMediaJob/.test(submitService)],
  ["E2E test script exists and covers DB guard route and service", /preview-mock-write-e2e/.test(packageJson) && /Preview DB identity/.test(tests) && /submitPreviewMockAiMediaJob/.test(tests)],
  ["E2E live mode requires explicit env flag in docs", /AI_MEDIA_PREVIEW_WRITE_E2E=1/.test(docs)],
  ["E2E live script fails closed unless explicitly enabled", /AI_MEDIA_PREVIEW_WRITE_E2E/.test(liveScript) && /AI_MEDIA_PREVIEW_BASE_URL/.test(liveScript) && /refuses Production host/.test(liveScript)],
  ["E2E live script is exposed", /e2e:ai-media:preview-mock-write/.test(packageJson)],
  ["docs and handoff updated", /Preview MOCK write E2E/i.test(docs) && /Preview MOCK write E2E/i.test(handoff)],
  ["Production remains blocked in docs", /Production AI writes remain disabled/i.test(docs) && /no P07/i.test(docs)],
];

const failed = checks.filter(([name, ok]) => !report(name, ok));

if (failed.length > 0) {
  console.error(`AI media Preview MOCK write E2E validation failed with ${failed.length} issue(s).`);
  process.exitCode = 1;
} else {
  console.log("AI media Preview MOCK write E2E validation passed.");
}
