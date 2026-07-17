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

const validator = read("lib/ai-media/provider-result-validation.ts");
const importService = read("lib/services/ai-media-result-import-service.ts");
const storageGateway = read("lib/storage/application-storage.ts");
const localTestStorage = read("lib/storage/local-test-storage.ts");
const importRoute = read("app/api/dashboard/ai-media/preview/jobs/[id]/import/route.ts");
const previewRoute = read("app/api/dashboard/ai-media/preview/jobs/route.ts");
const tests = read("tests/unit/ai-media-app-managed-import.test.ts");
const e2eScript = read("scripts/e2e/ai-media-local-docker-import.mjs");
const docs = read("docs/ai-media/AI_MEDIA_APP_MANAGED_RESULT_IMPORT.md");
const handoff = `${read("docs/AI_HANDOFF_CURRENT_STATE.md")}\n${read("docs/AI_HANDOFF_NEXT_PROMPT.md")}\n${read("docs/AI_HANDOFF_VALIDATION.md")}`;
const packageJson = read("package.json");

const runtimeSource = `${validator}\n${importService}\n${storageGateway}\n${importRoute}`;

const checks: Array<[string, boolean]> = [
  ["provider result validator exists and is pure (no DB/network side effects)", /export function validateAiMediaProviderResult/.test(validator) && /import "server-only"/.test(validator) && !/prisma|fetch\(|getApplicationStorageAdapter/.test(validator)],
  ["validator enforces MOCK provider", /UNSUPPORTED_PROVIDER/.test(validator) && /SUPPORTED_PROVIDERS/.test(validator)],
  ["validator enforces RESULT_READY", /RESULT_NOT_READY/.test(validator)],
  ["validator enforces COMPLETED status", /PROVIDER_NOT_COMPLETED/.test(validator)],
  ["validator enforces provider job id match", /ID_MISMATCH/.test(validator)],
  ["validator rejects unsafe MIME (svg/html)", /INVALID_MIME/.test(validator) && /svg|html|xml/.test(validator)],
  ["validator rejects private/unsafe output URLs", /UNSAFE_URL/.test(validator) && /127\.0\.0\.1|localhost|PRIVATE_IPV4/.test(validator)],
  ["import service exists and is server-only", /import "server-only"/.test(importService) && /export (async )?function importResultReadyOutput/.test(importService)],
  ["import requires RESULT_READY before storage", /NOT_RESULT_READY/.test(importService) && /RESULT_READY/.test(importService)],
  ["import writes through storage gateway", /storeCreativeStudioAsset|storeCreativeStudioAssetFromRemote/.test(importService)],
  ["import creates AiMediaImport and AiMediaAsset", /aiMediaImport\.(upsert|create|update)/.test(importService) && /aiMediaAsset\.create/.test(importService)],
  ["import appends asset-accepted event", /ASSET_ACCEPTED/.test(importService) && /appendAiMediaJobEvent/.test(importService)],
  ["import marks mirror/request IMPORTED only after storage success", /state:\s*"IMPORTED"/.test(importService) && /STORAGE_FAILED/.test(importService) && /DB_PERSIST_FAILED/.test(importService)],
  ["import does not mark IMPORTED on storage failure", /STORAGE_FAILED/.test(importService) && /FAILED/.test(importService)],
  ["import failure preserves RESULT_READY or uses FAILED_FINAL", /RESULT_READY/.test(importService) && /FAILED_FINAL/.test(importService)],
  ["import is idempotent and returns canonical asset", /reused/.test(importService) && /acceptedAssetId/.test(importService)],
  ["import uses local storage adapter only in test runtime", /local-test/.test(localTestStorage) && /cannot run in production/.test(localTestStorage)],
  ["local storage adapter cannot enter Production import graph", /production/.test(localTestStorage) && /process\.env\.NODE_ENV === "production"/.test(localTestStorage)],
  ["storage gateway validates image bytes and sizes", /validateApplicationImageBuffer/.test(storageGateway) && /5 \* 1024 \* 1024/.test(storageGateway)],
  ["storage gateway blocks private/unsafe provider URLs", /Provider result URL is not allowed/.test(storageGateway) && /isPrivateOutputHost|PRIVATE_IPV4/.test(storageGateway)],
  ["storage gateway compensates failed import", /compensateFailedAssetImport/.test(storageGateway)],
  ["import route is authenticated and org scoped", /requireAuthSession/.test(importRoute) && /requireCurrentOrganizationId/.test(importRoute)],
  ["import route enforces Preview/dev/test guard", /evaluateAiMediaPreviewWriteGuard/.test(importRoute) && /evaluateAiMediaPreviewDbIdentityGuard/.test(importRoute)],
  ["import route requires idempotency key", /idempotency key/i.test(importRoute) && /ApiError|Missing idempotency key/.test(importRoute)],
  ["import route is server-side and safe", /importResultReadyOutput/.test(importRoute) && !/BLOB_READ_WRITE_TOKEN|NEXT_PUBLIC|AI_MEDIA_SERVICE_INTERNAL_KEY/.test(importRoute)],
  ["import route exposes only storage key fingerprint", /storageKeyFingerprint/.test(importRoute) && /rawProviderUrlExposed/.test(importRoute)],
  ["no client-side Render fetch", !/components[\s\S]*bazar-baz-ai-media-service|fetch\([^)]*AI_MEDIA_SERVICE/i.test(runtimeSource)],
  ["no client-side storage secret", !/NEXT_PUBLIC.*(BLOB|STORAGE)|BLOB_READ_WRITE_TOKEN/.test(runtimeSource)],
  ["no real generation", /realGeneration:\s*false/.test(runtimeSource) && !/AI_MEDIA_REAL_GENERATION_ENABLED\s*=\s*["']true/.test(runtimeSource)],
  ["no Baz wallet mutation", !/walletCreditProduced:\s*true|ledgerMutationAllowed:\s*true|settle/.test(importService)],
  ["Production remains fail-closed", !/vercelEnv === "production"[\s\S]{0,200}allowed:\s*true/.test(`${importRoute}\n${previewRoute}`)],
  ["unit tests cover validation and import flow", /test:ai-media:app-managed-import/.test(packageJson) && /validateAiMediaProviderResult/.test(tests) && /importResultReadyOutput/.test(tests) && /IMPORTED/.test(tests)],
  ["local Docker import E2E exists and is exposed", /e2e:ai-media:local-docker-import/.test(packageJson) && /AI_MEDIA_LOCAL_DOCKER_E2E/.test(e2eScript)],
  ["quality validator exists and is exposed", /quality:ai-media-app-managed-import/.test(packageJson)],
  ["docs and handoff updated", /app-managed result import/i.test(docs) && /app-managed result import/i.test(handoff)],
];

const failed = checks.filter(([name, ok]) => !report(name, ok));

if (failed.length > 0) {
  console.error(`AI media app-managed import validation failed with ${failed.length} issue(s).`);
  process.exitCode = 1;
} else {
  console.log("AI media app-managed import validation passed.");
}
