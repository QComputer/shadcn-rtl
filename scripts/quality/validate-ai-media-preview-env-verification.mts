import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  verifyAiMediaPreviewEnvironmentEvidence,
  type AiMediaPreviewEnvVerificationInput,
} from "@/lib/ai-media/preview-env-verification";

const projectRoot = fileURLToPath(new URL("../../", import.meta.url));

function read(path: string): string {
  const resolved = `${projectRoot}/${path}`;
  if (!existsSync(resolved)) return "";
  return readFileSync(resolved, "utf8");
}

function add(name: string, ok: boolean, detail = "") {
  const status = ok ? "PASS" : "FAIL";
  const suffix = detail ? ` - ${detail}` : "";
  console.log(`${status} ${name}${suffix}`);
  return ok;
}

const safeEvidence: AiMediaPreviewEnvVerificationInput = {
  previewDeploymentUrl: "https://bazar-baz-preview.vercel.app",
  productionDeploymentUrl: "https://www.bazar-baz.ir",
  previewDbFingerprint: "preview-db-fingerprint",
  productionDbFingerprint: "production-db-fingerprint",
  previewStorageFingerprint: "preview-storage-fingerprint",
  productionStorageFingerprint: "production-storage-fingerprint",
  previewAiMediaServiceIdentity: "preview-ai-media-service",
  productionAiMediaServiceIdentity: "production-ai-media-service",
  previewUsesServerOnlyRenderKey: true,
  productionUsesServerOnlyRenderKey: true,
  previewHasPublicRenderSecret: false,
  productionHasPublicRenderSecret: false,
  previewAiWriteFlowEnabled: false,
  productionAiWriteFlowEnabled: false,
};

const checks: Array<[string, boolean, string?]> = [];
const safeResult = verifyAiMediaPreviewEnvironmentEvidence(safeEvidence);
checks.push(["safe sample evidence passes", safeResult.ok === true]);
checks.push(["matching Preview/Production DB fingerprints fail", verifyAiMediaPreviewEnvironmentEvidence({
  ...safeEvidence,
  previewDbFingerprint: safeEvidence.productionDbFingerprint,
}).ok === false]);
checks.push(["matching Preview/Production storage fingerprints fail", verifyAiMediaPreviewEnvironmentEvidence({
  ...safeEvidence,
  previewStorageFingerprint: safeEvidence.productionStorageFingerprint,
}).ok === false]);
checks.push(["matching Preview/Production AI media identity fails", verifyAiMediaPreviewEnvironmentEvidence({
  ...safeEvidence,
  previewAiMediaServiceIdentity: safeEvidence.productionAiMediaServiceIdentity,
}).ok === false]);
checks.push(["Preview public Render secret flag fails", verifyAiMediaPreviewEnvironmentEvidence({
  ...safeEvidence,
  previewHasPublicRenderSecret: true,
}).ok === false]);
checks.push(["Preview AI write flow enabled fails", verifyAiMediaPreviewEnvironmentEvidence({
  ...safeEvidence,
  previewAiWriteFlowEnabled: true,
}).ok === false]);

const missingEvidence = verifyAiMediaPreviewEnvironmentEvidence({});
const strictMissingEvidence = verifyAiMediaPreviewEnvironmentEvidence({ strict: true });
checks.push(["missing evidence is reported as warning by default", missingEvidence.warnings.some((warning) => /Missing Preview verification evidence/.test(warning))]);
checks.push(["missing evidence blocks in strict mode", strictMissingEvidence.ok === false && strictMissingEvidence.blockers.some((blocker) => /Missing Preview verification evidence/.test(blocker))]);

const secretValue = "postgresql://user:password@prod.neon.tech/bazar_baz";
const secretResult = verifyAiMediaPreviewEnvironmentEvidence({
  ...safeEvidence,
  previewDbFingerprint: secretValue,
});
checks.push(["raw secret-like evidence is blocked", secretResult.ok === false && secretResult.evidenceSummary.secretLikeEvidenceFields.includes("previewDbFingerprint")]);
checks.push(["raw secret-like evidence is not returned", !JSON.stringify(secretResult).includes(secretValue)]);

const docs = read("docs/ai-media/AI_MEDIA_PREVIEW_ENV_VERIFICATION_READONLY.md");
const helper = read("lib/ai-media/preview-env-verification.ts");
const packageJson = read("package.json");
const handoffCurrent = read("docs/AI_HANDOFF_CURRENT_STATE.md");
const handoffNext = read("docs/AI_HANDOFF_NEXT_PROMPT.md");
const handoffValidation = read("docs/AI_HANDOFF_VALIDATION.md");

const checklistItems = [
  "Preview deployment URL",
  "Production deployment URL",
  "Preview env summary with secrets redacted",
  "Production env summary with secrets redacted",
  "Preview DB endpoint fingerprint/hash",
  "Production DB endpoint fingerprint/hash",
  "Preview storage identity/fingerprint",
  "Production storage identity/fingerprint",
  "Preview AI media service URL/identity",
  "Production AI media service URL/identity",
  "Preview does not use Production Render identity",
  "Preview does not use Production Blob/storage",
  "no AI write flow is enabled",
];

checks.push(["docs contain human/operator evidence checklist", checklistItems.every((item) => docs.includes(item))]);
checks.push(["docs state read-only no deploy no AI jobs", /does not mutate any environment/i.test(docs) && /does not deploy/i.test(docs) && /does not create AI jobs/i.test(docs)]);
checks.push(["docs preserve browser never calls Render boundary", /Browser must never call Render directly/i.test(docs)]);
checks.push(["helper performs no network DB Blob Render calls", !/fetch\(|prisma|@vercel\/blob|aiMediaFetch|createAiMediaJob|XMLHttpRequest/.test(helper)]);
checks.push(["package exposes preview env verification scripts", /test:ai-media:preview-env-verification/.test(packageJson) && /quality:ai-media-preview-env-verification/.test(packageJson)]);
checks.push(["handoff docs mention Preview env verification tooling", /Preview env verification tooling/i.test(handoffCurrent) && /Preview env verification tooling/i.test(handoffNext) && /Preview env verification tooling/i.test(handoffValidation)]);

const failed = checks.filter(([name, ok, detail]) => !add(name, ok, detail));

if (failed.length > 0) {
  console.error(`AI media Preview env verification validation failed with ${failed.length} issue(s).`);
  process.exitCode = 1;
} else {
  console.log("AI media Preview env verification validation passed.");
}
