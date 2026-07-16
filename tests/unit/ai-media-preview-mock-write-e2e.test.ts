import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { register } from "node:module";
import { before, describe, it } from "node:test";

register(new URL("./loader.mjs", import.meta.url));

let evaluateAiMediaPreviewDbIdentityGuard: typeof import("@/lib/ai-media/preview-db-identity-guard").evaluateAiMediaPreviewDbIdentityGuard;
let buildPreviewMockRenderJobRequest: typeof import("@/lib/ai-media/preview-mock-render-request").buildPreviewMockRenderJobRequest;

before(async () => {
  ({ evaluateAiMediaPreviewDbIdentityGuard } = await import("@/lib/ai-media/preview-db-identity-guard"));
  ({ buildPreviewMockRenderJobRequest } = await import("@/lib/ai-media/preview-mock-render-request"));
});

const greenDbEvidence = {
  vercelEnv: "preview",
  nodeEnv: "development",
  featureFlagEnabled: true,
  databaseUrlPresent: true,
  directUrlPresent: true,
  databaseUrlEqualsDirectUrl: false,
  previewDbFingerprint: "preview-db-fingerprint",
  productionDbFingerprint: "production-db-fingerprint",
  previewDbBranchId: "br-quiet-union-ai05j3cs",
  productionDbBranchId: "br-small-queen-aii58cw9",
  explicitPreviewDbIdentityVerified: true,
  nonIsolatedWriteAccepted: false,
};

describe("AI media Preview MOCK write E2E guard", () => {
  it("blocks Production DB writes even with otherwise green evidence", () => {
    const decision = evaluateAiMediaPreviewDbIdentityGuard({ ...greenDbEvidence, vercelEnv: "production" });
    assert.equal(decision.allowed, false);
    assert.match(decision.blockers.join("\n"), /Production/i);
  });

  it("blocks missing DB evidence", () => {
    const decision = evaluateAiMediaPreviewDbIdentityGuard({
      vercelEnv: "preview",
      nodeEnv: "development",
      featureFlagEnabled: true,
    });
    assert.equal(decision.allowed, false);
    assert.match(decision.blockers.join("\n"), /DATABASE_URL/i);
    assert.match(decision.blockers.join("\n"), /DIRECT_URL/i);
    assert.match(decision.blockers.join("\n"), /fingerprints/i);
  });

  it("blocks equal Preview and Production DB evidence", () => {
    const decision = evaluateAiMediaPreviewDbIdentityGuard({
      ...greenDbEvidence,
      previewDbFingerprint: "same",
      productionDbFingerprint: "same",
      previewDbBranchId: "br-same",
      productionDbBranchId: "br-same",
    });
    assert.equal(decision.allowed, false);
    assert.match(decision.blockers.join("\n"), /fingerprints/i);
    assert.match(decision.blockers.join("\n"), /branch ids/i);
  });

  it("allows isolated Preview DB identity evidence", () => {
    const decision = evaluateAiMediaPreviewDbIdentityGuard(greenDbEvidence);
    assert.equal(decision.allowed, true);
    assert.equal(decision.mode, "PREVIEW_DB");
    assert.equal(decision.safeSummary.fingerprintsDiffer, true);
  });

  it("allows isolated Preview DB when Preview URLs are identical with a warning", () => {
    const decision = evaluateAiMediaPreviewDbIdentityGuard({
      ...greenDbEvidence,
      databaseUrlEqualsDirectUrl: true,
    });

    assert.equal(decision.allowed, true);
    assert.equal(decision.mode, "PREVIEW_DB");
    assert.match(decision.warnings.join("\n"), /identical inside this environment/i);
  });

  it("allows accepted-risk non-isolated MOCK E2E only with explicit marker", () => {
    const decision = evaluateAiMediaPreviewDbIdentityGuard({
      ...greenDbEvidence,
      previewDbFingerprint: null,
      productionDbFingerprint: null,
      previewDbBranchId: null,
      productionDbBranchId: null,
      explicitPreviewDbIdentityVerified: false,
      nonIsolatedWriteAccepted: true,
    });

    assert.equal(decision.allowed, true);
    assert.equal(decision.mode, "ACCEPTED_RISK_NON_ISOLATED_DB");
    assert.equal(decision.safeSummary.acceptedRiskNonIsolated, true);
    assert.match(decision.warnings.join("\n"), /accepted-risk non-isolated MOCK E2E/i);
  });

  it("blocks unproven Preview DB separation without accepted-risk marker", () => {
    const decision = evaluateAiMediaPreviewDbIdentityGuard({
      ...greenDbEvidence,
      previewDbFingerprint: null,
      productionDbFingerprint: null,
      previewDbBranchId: null,
      productionDbBranchId: null,
      explicitPreviewDbIdentityVerified: false,
      nonIsolatedWriteAccepted: false,
    });

    assert.equal(decision.allowed, false);
    assert.match(decision.blockers.join("\n"), /accepted-risk non-isolated/i);
  });

  it("blocks missing pinned Render verification through the write guard", async () => {
    const { evaluateAiMediaPreviewWriteGuard } = await import("@/lib/ai-media/preview-write-guard");
    const decision = evaluateAiMediaPreviewWriteGuard({
      vercelEnv: "preview",
      nodeEnv: "development",
      featureFlagEnabled: true,
      previewIsolationVerified: true,
      pinnedRenderContractVerified: false,
      provider: "MOCK",
      realGenerationEnabled: false,
      userRole: "SUPER_ADMIN",
    });

    assert.equal(decision.allowed, false);
    assert.match(decision.blockers.join("\n"), /Pinned Render MOCK contract/i);
  });

  it("does not leak secret-like values through DB guard output", () => {
    const decision = evaluateAiMediaPreviewDbIdentityGuard({
      ...greenDbEvidence,
      previewDbFingerprint: "postgres://user:password@host/db",
      productionDbFingerprint: "postgres://prod:secret@host/db",
    });
    const output = JSON.stringify(decision);
    assert.equal(/password|secret|postgres:\/\//i.test(output), false);
  });

  it("builds a safe Render MOCK product-image request with idempotency and correlation", () => {
    const request = buildPreviewMockRenderJobRequest({
      organizationId: "org-a",
      requestedByUserId: "user-a",
      targetType: "PRODUCT_IMAGE",
      targetId: "product-a",
      idempotencyKey: "idem-a",
      payload: { prompt: "make it brighter", productTitle: "Tea", category: "Cafe" },
      prompt: "make it brighter",
    }, "corr-a");

    assert.equal(request.organization_id, "org-a");
    assert.equal(request.product_id, "product-a");
    assert.equal("provider" in request, false);
    assert.equal(request.idempotency_key, "idem-a");
    assert.equal(request.correlation_id, "corr-a");
    assert.equal(request.count, 1);
  });

  it("route source requires auth guards DB identity and idempotency before Render mutation", () => {
    const listRoute = readFileSync(new URL("../../app/api/dashboard/ai-media/preview/jobs/route.ts", import.meta.url), "utf8");
    assert.equal(/requireAuthSession/.test(listRoute), true);
    assert.equal(/evaluateAiMediaPreviewWriteGuard/.test(listRoute), true);
    assert.equal(/evaluateAiMediaPreviewDbIdentityGuard/.test(listRoute), true);
    assert.equal(/idempotency key/i.test(listRoute), true);
    assert.equal(/submitPreviewMockAiMediaJob/.test(listRoute), true);
    assert.equal(/dryRun/.test(listRoute), true);
  });

  it("live E2E runner keeps local Docker mode on localhost databases only", () => {
    const runner = readFileSync(new URL("../../scripts/e2e/ai-media-preview-mock-write-e2e.mjs", import.meta.url), "utf8");
    assert.equal(/AI_MEDIA_LOCAL_DOCKER_E2E/.test(runner), true);
    assert.equal(/DATABASE_URL/.test(runner), true);
    assert.equal(/DIRECT_URL/.test(runner), true);
    assert.equal(/refuses non-local/.test(runner), true);
    assert.equal(/neon/i.test(runner), true);
  });

  it("status sync route is server-side guarded and does not write Blob or expose secrets", () => {
    const detailRoute = readFileSync(new URL("../../app/api/dashboard/ai-media/preview/jobs/[id]/route.ts", import.meta.url), "utf8");
    assert.equal(/export async function POST/.test(detailRoute), true);
    assert.equal(/syncPreviewMockAiMediaJobStatus/.test(detailRoute), true);
    assert.equal(/evaluateAiMediaPreviewDbIdentityGuard/.test(detailRoute), true);
    assert.equal(/BLOB_READ_WRITE_TOKEN|@vercel\/blob|AI_MEDIA_SERVICE_INTERNAL_KEY|NEXT_PUBLIC.*RENDER/i.test(detailRoute), false);
  });

  it("service source calls Render only through the server-only client and never Blob or ledger", () => {
    const service = readFileSync(new URL("../../lib/services/ai-media-preview-mock-write-service.ts", import.meta.url), "utf8");
    assert.equal(service.includes('import "server-only"'), true);
    assert.equal(/createAiMediaJob/.test(service), true);
    assert.equal(/getAiMediaJob/.test(service), true);
    assert.equal(/@vercel\/blob|BLOB_READ_WRITE_TOKEN|walletCreditProduced:\s*true|ledgerMutationAllowed:\s*true/.test(service), false);
  });

  it("accepts the deployed create contract where provider is only guaranteed on status reads", () => {
    const client = readFileSync(new URL("../../lib/services/ai-media-service-client.ts", import.meta.url), "utf8");
    assert.equal(/input\.provider[\s\S]*:\s*"MOCK"/.test(client), true);
    assert.equal(/if \(!jobId \|\| !provider\)/.test(client), false);
  });
});
