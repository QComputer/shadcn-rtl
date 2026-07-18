import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../../", import.meta.url));

function read(relativePath: string) {
  const path = `${projectRoot}${relativePath.startsWith("/") ? "" : "/"}${relativePath}`;
  return existsSync(path) ? readFileSync(path, "utf8") : "";
}

function runGit(args: string[]) {
  const result = spawnSync("git", args, {
    cwd: projectRoot,
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  return `${result.stdout || ""}${result.stderr || ""}`.trim();
}

function report(name: string, ok: boolean, detail = "") {
  const suffix = detail ? ` - ${detail}` : "";
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${suffix}`);
  return ok;
}

const schema = read("prisma/schema.prisma");
const migration = read("prisma/migrations/20260716000100_ai_media_preview_mock_write_foundation/migration.sql");
const guard = read("lib/ai-media/preview-write-guard.ts");
const requestService = read("lib/services/ai-media-platform-request-service.ts");
const mirrorService = read("lib/services/ai-media-job-mirror-service.ts");
const importService = read("lib/services/ai-media-import-service.ts");
const contributionService = read("lib/services/ai-media-contribution-mirror-service.ts");
const listRoute = read("app/api/dashboard/ai-media/preview/jobs/route.ts");
const detailRoute = read("app/api/dashboard/ai-media/preview/jobs/[id]/route.ts");
const tests = read("tests/unit/ai-media-preview-write-foundation.test.ts");
const docs = read("docs/ai-media/AI_MEDIA_PREVIEW_MOCK_WRITE_FOUNDATION.md");
const handoff = `${read("docs/AI_HANDOFF_CURRENT_STATE.md")}\n${read("docs/AI_HANDOFF_NEXT_PROMPT.md")}\n${read("docs/AI_HANDOFF_VALIDATION.md")}`;
const packageJson = read("package.json");
const diffNameStatus = runGit(["diff", "--name-status"]);
const cachedNameStatus = runGit(["diff", "--cached", "--name-status"]);
const changedNames = `${diffNameStatus}\n${cachedNameStatus}`;
const allSource = [
  guard,
  requestService,
  mirrorService,
  importService,
  contributionService,
  listRoute,
  detailRoute,
  docs,
].join("\n");
const runtimeSource = [
  guard,
  requestService,
  mirrorService,
  importService,
  contributionService,
  listRoute,
  detailRoute,
].join("\n");

const requiredModels = [
  "model AiMediaRequest",
  "model AiMediaJobMirror",
  "model AiMediaJobEvent",
  "model AiMediaImport",
  "model AiMediaAsset",
  "model AiMediaUsageQuote",
  "model AiMediaSpendHold",
  "model WorkerContributionMirror",
];

const checks: Array<[string, boolean, string?]> = [
  ["Prisma mirror models exist", requiredModels.every((model) => schema.includes(model))],
  ["AI media migration source exists", migration.includes("CREATE TABLE \"AiMediaRequest\"") && migration.includes("CREATE TABLE \"WorkerContributionMirror\"")],
  ["no existing applied migration edited", !/(^|\n)M\s+prisma[\\/]migrations[\\/](?!20260716000100_ai_media_preview_mock_write_foundation|20260707000200_export_hub_extend_data_types)/.test(changedNames)],
  ["preview write guard exists", guard.includes("evaluateAiMediaPreviewWriteGuard") && guard.includes("productionBlocked")],
  ["guard fails closed in Production", /vercelEnv === "production"|nodeEnv === "production"/.test(guard) && /blockers\.push\("AI media Preview MOCK writes are disabled in Production/.test(guard)],
  ["guard requires feature flag isolation pinned contract MOCK and SUPER_ADMIN", ["featureFlagEnabled", "previewIsolationVerified", "pinnedRenderContractVerified", "providerMock", "privilegedUser"].every((token) => guard.includes(token))],
  ["route skeletons are authenticated and guarded", /requireAuthSession/.test(`${listRoute}\n${detailRoute}`) && /evaluateAiMediaPreviewWriteGuard/.test(`${listRoute}\n${detailRoute}`)],
  ["routes default to no Render mutation or Blob write", /renderMutation:\s*false/.test(`${listRoute}\n${detailRoute}`) && /blobWrite:\s*false/.test(`${listRoute}\n${detailRoute}`)],
  ["no Render secret exposed to client or route response", !/AI_MEDIA_SERVICE_INTERNAL_KEY|X-BazarBaz-AI-Key|NEXT_PUBLIC_.*AI_MEDIA_SERVICE/.test(runtimeSource)],
  ["no NEXT_PUBLIC Render secret in package/source", !/NEXT_PUBLIC_.*(RENDER|AI_MEDIA).*SECRET|NEXT_PUBLIC_.*AI_MEDIA_SERVICE_INTERNAL_KEY/.test(runtimeSource + packageJson)],
  ["no Blob write added in import planning", !/@vercel\/blob|storeCreativeStudioAsset|BLOB_READ_WRITE_TOKEN|\bput\s*\(|\bdel\s*\(/.test(importService + listRoute + detailRoute)],
  ["no Production write enablement", !/VERCEL_ENV\s*===\s*["']production["'][\s\S]{0,120}allowed:\s*true/.test(guard)],
  ["services are server-only", [requestService, mirrorService, importService, contributionService].every((source) => source.includes("server-only"))],
  ["tests exist and cover guard/service/import/contribution safety", /blocks Production/.test(tests) && /RESULT_READY plans pending import/.test(tests) && /never credits wallet/.test(tests)],
  ["quality scripts exposed", /test:ai-media:preview-write-foundation/.test(packageJson) && /quality:ai-media-preview-write-foundation/.test(packageJson)],
  ["docs and handoff updated", /Preview MOCK write foundation/i.test(docs) && /Preview MOCK write foundation/i.test(handoff)],
  ["real generation remains disabled", docs.includes("real generation remains disabled") && guard.includes("Real generation must remain disabled")],
];

const failed = checks.filter(([name, ok, detail]) => !report(name, ok, detail));

if (failed.length > 0) {
  console.error(`AI media Preview write foundation validation failed with ${failed.length} issue(s).`);
  process.exitCode = 1;
} else {
  console.log("AI media Preview write foundation validation passed.");
}
