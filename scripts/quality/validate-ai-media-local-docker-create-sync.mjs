import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../../", import.meta.url));

function read(relativePath) {
  const path = `${projectRoot}${relativePath.startsWith("/") ? "" : "/"}${relativePath}`;
  return existsSync(path) ? readFileSync(path, "utf8") : "";
}

function report(name, ok) {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}`);
  return ok;
}

const submitService = read("lib/services/ai-media-preview-mock-write-service.ts");
const mirrorService = read("lib/services/ai-media-job-mirror-service.ts");
const jobMirror = read("lib/ai-media/job-mirror.ts");
const status = read("lib/ai-media/status.ts");
const contractMock = read("scripts/ai-media/local-contract-mock.mjs");
const e2eScript = read("scripts/e2e/ai-media-local-docker-create-sync.mjs");
const e2eFlow = read("scripts/e2e/ai-media-local-docker-create-sync-e2e.mts");
const docs = read("docs/ai-media/AI_MEDIA_LOCAL_DOCKER_MOCK_E2E_RECOVERY.md");
const handoff = `${read("docs/AI_HANDOFF_CURRENT_STATE.md")}\n${read("docs/AI_HANDOFF_NEXT_PROMPT.md")}\n${read("docs/AI_HANDOFF_VALIDATION.md")}`;
const packageJson = read("package.json");

const runtimeSource = `${submitService}\n${mirrorService}\n${jobMirror}`;

const checks = [
  ["create service exists and is server-only", /import "server-only"/.test(submitService) && /export async function submitPreviewMockAiMediaJob/.test(submitService)],
  ["status sync service exists and is server-only", /export async function syncPreviewMockAiMediaJobStatus/.test(submitService)],
  ["create does not write to storage/Blob (import phase owns storage)", !/BLOB_READ_WRITE_TOKEN|createApplicationStorageAdapter|storeCreativeStudioAsset/.test(submitService)],
  ["create records app-owned mirror + provider job id", /createAiMediaJobMirror/.test(submitService) && /providerJobId/.test(submitService)],
  ["create failure path marks FAILED_RETRYABLE/FAILED_FINAL safely", /FAILED_RETRYABLE/.test(submitService) && /FAILED_FINAL/.test(submitService)],
  ["status sync maps provider COMPLETED to RESULT_READY", /COMPLETED|SUCCEEDED|SUCCESS/.test(status) && /RESULT_READY/.test(jobMirror)],
  ["status sync stores provider job id on mirror", /updateMirrorFromNormalizedStatus/.test(submitService) && /providerJobId/.test(mirrorService)],
  ["status sync honors missing provider job id", /PROVIDER_JOB_ID_MISSING/.test(submitService)],
  ["contract mock exposes create + status + cancel endpoints", /\/v1\/product-image-suggestions\/jobs/.test(contractMock) && /createProductImageSuggestionJob/.test(contractMock) && /getProductImageSuggestionJob/.test(contractMock)],
  ["contract mock create returns MOCK provider and COMPLETED", /provider:\s*"MOCK"/.test(contractMock) && /status:\s*"COMPLETED"/.test(contractMock)],
  ["contract mock requires internal key (no anonymous writes)", /x-bazarbaz-ai-key/.test(contractMock) && /unauthorized/.test(contractMock)],
  ["contract mock refuses production env", /Refusing to start local contract MOCK in Vercel production\./.test(contractMock) || /Refusing to start local contract MOCK in Vercel production\./.test(e2eScript)],
  ["local Docker create/sync E2E wraps disposable Postgres", /bazar-baz-ai-media-createsync-/.test(e2eScript) && /createDockerDatabase/.test(e2eScript)],
  ["local Docker create/sync E2E starts local contract mock (no Render)", /startContractMock/.test(e2eScript) && /AI_MEDIA_LOCAL_CONTRACT_MOCK/.test(e2eScript) && !/onrender/.test(e2eScript)],
  ["local Docker create/sync E2E refuses non-local service URL", /Refusing to run local contract MOCK with non-local service URL/.test(e2eScript)],
  ["local Docker create/sync E2E flow uses service create + status sync", /submitPreviewMockAiMediaJob/.test(e2eFlow) && /syncPreviewMockAiMediaJobStatus/.test(e2eFlow)],
  ["local Docker create/sync E2E asserts provider job id stored", /providerJobIdStored/.test(e2eFlow) && /providerJobId/.test(e2eFlow)],
  ["local Docker create/sync E2E asserts RESULT_READY reach", /RESULT_READY/.test(e2eFlow)],
  ["local Docker create/sync E2E asserts idempotent reuse", /reused/.test(e2eFlow) && /idempotency/.test(e2eFlow)],
  ["local Docker create/sync E2E asserts no secret leak", /AI_MEDIA_SERVICE_INTERNAL_KEY|BLOB_READ_WRITE_TOKEN|DATABASE_URL/.test(e2eFlow)],
  ["local Docker create/sync E2E refuses non-local DB", /Refusing to run against a non-local database/.test(e2eFlow)],
  ["package exposes local Docker create/sync E2E + quality", /e2e:ai-media:local-docker-create-sync/.test(packageJson) && /quality:ai-media-local-docker-create-sync/.test(packageJson)],
  ["no real generation in recovery path", /AI_MEDIA_REAL_GENERATION_ENABLED/.test(e2eScript) && !/realGeneration:\s*true/.test(runtimeSource)],
  ["no Baz wallet mutation in recovery path", !/walletCreditProduced:\s*true|ledgerMutationAllowed:\s*true/.test(runtimeSource)],
  ["docs and handoff updated", /local Docker MOCK E2E recovery/i.test(docs) && /local Docker MOCK E2E recovery/i.test(handoff)],
];

const failed = checks.filter(([name, ok]) => !report(name, ok));

if (failed.length > 0) {
  console.error(`AI media local Docker create/status-sync recovery validation failed with ${failed.length} issue(s).`);
  process.exitCode = 1;
} else {
  console.log("AI media local Docker create/status-sync recovery validation passed.");
}
