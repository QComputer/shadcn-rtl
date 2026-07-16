import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { register } from "node:module";
import { before, describe, it } from "node:test";

register(new URL("./loader.mjs", import.meta.url));

let evaluateAiMediaPreviewWriteGuard: typeof import("@/lib/ai-media/preview-write-guard").evaluateAiMediaPreviewWriteGuard;
let planAiMediaResultImport: typeof import("@/lib/ai-media/import-planning").planAiMediaResultImport;
let planWorkerContributionReward: typeof import("@/lib/ai-media/contribution-mirror").planWorkerContributionReward;
let getNormalUserJobVisibility: typeof import("@/lib/ai-media/job-mirror").getNormalUserJobVisibility;
let getSuperAdminJobVisibility: typeof import("@/lib/ai-media/job-mirror").getSuperAdminJobVisibility;
let getWorkerOperatorJobVisibility: typeof import("@/lib/ai-media/job-mirror").getWorkerOperatorJobVisibility;

before(async () => {
  ({ evaluateAiMediaPreviewWriteGuard } = await import("@/lib/ai-media/preview-write-guard"));
  ({ planAiMediaResultImport } = await import("@/lib/ai-media/import-planning"));
  ({ planWorkerContributionReward } = await import("@/lib/ai-media/contribution-mirror"));
  ({
    getNormalUserJobVisibility,
    getSuperAdminJobVisibility,
    getWorkerOperatorJobVisibility,
  } = await import("@/lib/ai-media/job-mirror"));
});

const greenGuard = {
  vercelEnv: "preview",
  nodeEnv: "development",
  featureFlagEnabled: true,
  previewIsolationVerified: true,
  pinnedRenderContractVerified: true,
  provider: "MOCK",
  realGenerationEnabled: false,
  userRole: "SUPER_ADMIN",
};

describe("AI media Preview MOCK write foundation", () => {
  it("blocks Production even with otherwise green evidence", () => {
    const decision = evaluateAiMediaPreviewWriteGuard({ ...greenGuard, vercelEnv: "production" });
    assert.equal(decision.allowed, false);
    assert.match(decision.blockers.join("\n"), /Production/i);
  });

  it("blocks missing evidence and missing feature flag", () => {
    const decision = evaluateAiMediaPreviewWriteGuard({
      vercelEnv: "preview",
      nodeEnv: "development",
      provider: "MOCK",
      userRole: "SUPER_ADMIN",
    });
    assert.equal(decision.allowed, false);
    assert.match(decision.blockers.join("\n"), /feature flag/i);
    assert.match(decision.blockers.join("\n"), /isolation/i);
    assert.match(decision.blockers.join("\n"), /Render/i);
  });

  it("allows Preview MOCK only when all evidence is green", () => {
    const decision = evaluateAiMediaPreviewWriteGuard(greenGuard);
    assert.equal(decision.allowed, true);
    assert.equal(decision.mode, "PREVIEW_MOCK");
    assert.equal(decision.realGeneration, "DISABLED");
  });

  it("blocks real generation and non-MOCK provider", () => {
    const decision = evaluateAiMediaPreviewWriteGuard({
      ...greenGuard,
      provider: "REAL",
      realGenerationEnabled: true,
    });
    assert.equal(decision.allowed, false);
    assert.match(decision.blockers.join("\n"), /MOCK/i);
    assert.match(decision.blockers.join("\n"), /Real generation/i);
  });

  it("service source builds dry-run plans without Render Blob or ledger writes", () => {
    const source = readFileSync(new URL("../../lib/services/ai-media-platform-request-service.ts", import.meta.url), "utf8");
    assert.equal(/renderMutationPlanned:\s*false/.test(source), true);
    assert.equal(/blobWritePlanned:\s*false/.test(source), true);
    assert.equal(/bazLedgerMutationPlanned:\s*false/.test(source), true);
    assert.equal(/createAiMediaJob|cancelAiMediaJob|@vercel\/blob|BLOB_READ_WRITE_TOKEN/.test(source), false);
  });

  it("service source creates planned request quote mirror and event with scoped idempotency", () => {
    const requestService = readFileSync(new URL("../../lib/services/ai-media-platform-request-service.ts", import.meta.url), "utf8");
    const mirrorService = readFileSync(new URL("../../lib/services/ai-media-job-mirror-service.ts", import.meta.url), "utf8");
    assert.equal(/aiMediaRequest\.upsert/.test(requestService), true);
    assert.equal(/aiMediaUsageQuote\.upsert/.test(requestService), true);
    assert.equal(/organizationId_idempotencyKey/.test(requestService), true);
    assert.equal(/aiMediaJobMirror\.upsert/.test(mirrorService), true);
    assert.equal(/aiMediaJobEvent\.upsert/.test(mirrorService), true);
    assert.equal(/organizationId_dedupeKey/.test(mirrorService), true);
  });

  it("status mirror source updates RESULT_READY without forcing imported", () => {
    const source = readFileSync(new URL("../../lib/services/ai-media-job-mirror-service.ts", import.meta.url), "utf8");
    assert.equal(/resultReadyAt:\s*nextState === "RESULT_READY"/.test(source), true);
    assert.equal(/importedAt:\s*nextState === "IMPORTED"/.test(source), true);
  });

  it("RESULT_READY plans pending import and IMPORTED is user-visible success with no Blob write", () => {
    const pending = planAiMediaResultImport({
      state: "RESULT_READY",
      rawOutputAvailable: true,
    });
    const imported = planAiMediaResultImport({
      state: "IMPORTED",
      rawOutputAvailable: true,
    });
    assert.equal(pending.importStatus, "PENDING");
    assert.equal(pending.userVisibleSuccess, false);
    assert.equal(imported.importStatus, "ACCEPTED");
    assert.equal(imported.userVisibleSuccess, true);
    const importService = readFileSync(new URL("../../lib/services/ai-media-import-service.ts", import.meta.url), "utf8");
    assert.equal(/blobWritePlanned:\s*false/.test(importService), true);
  });

  it("contribution mirror never credits wallet before accepted imported asset", () => {
    const result = planWorkerContributionReward({
      providerContributionId: "contrib-a",
      workerOpaqueId: "worker-a",
      mirrorId: "mirror-a",
      jobState: "RESULT_READY",
      importedAssetAccepted: false,
    });
    assert.equal(result.rewardEligible, false);
    assert.equal(result.walletCreditProduced, false);
    const source = readFileSync(new URL("../../lib/services/ai-media-contribution-mirror-service.ts", import.meta.url), "utf8");
    assert.equal(/walletCreditProduced:\s*false/.test(source), true);
  });

  it("safe views hide cross-user media and worker prompt fields while Super Admin gets marker", () => {
    const hidden = getNormalUserJobVisibility({
      viewerUserId: "user-b",
      viewerOrganizationId: "org-b",
      jobOrganizationId: "org-a",
      jobRequestedByUserId: "user-a",
      privacyLevel: "ORGANIZATION",
    });
    const worker = getWorkerOperatorJobVisibility();
    const superAdmin = getSuperAdminJobVisibility();

    assert.equal(hidden.canSeeJob, false);
    assert.equal(worker.canSeePrompt, false);
    assert.equal(worker.canSeeImages, false);
    assert.equal(worker.canSeeFiles, false);
    assert.equal(superAdmin.fullDiagnosticMarker, true);
  });

  it("route skeletons do not expose Render secrets or direct Blob writes", () => {
    const listRoute = readFileSync(new URL("../../app/api/dashboard/ai-media/preview/jobs/route.ts", import.meta.url), "utf8");
    const detailRoute = readFileSync(new URL("../../app/api/dashboard/ai-media/preview/jobs/[id]/route.ts", import.meta.url), "utf8");
    const source = `${listRoute}\n${detailRoute}`;
    assert.equal(/AI_MEDIA_SERVICE_INTERNAL_KEY|NEXT_PUBLIC.*AI_MEDIA|BLOB_READ_WRITE_TOKEN/.test(source), false);
    assert.equal(/\bcreateAiMediaJob\s*\(|\bcancelAiMediaJob\s*\(|storeCreativeStudioAsset|@vercel\/blob|\bput\s*\(|\bdel\s*\(/.test(source), false);
    assert.equal(/requireAuthSession/.test(source), true);
    assert.equal(/evaluateAiMediaPreviewWriteGuard/.test(source), true);
  });
});
