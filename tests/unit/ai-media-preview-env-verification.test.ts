import { register } from "node:module";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  verifyAiMediaPreviewEnvironmentEvidence,
  type AiMediaPreviewEnvVerificationInput,
} from "@/lib/ai-media/preview-env-verification";

register(new URL("./loader.mjs", import.meta.url));

const safeEvidence: AiMediaPreviewEnvVerificationInput = {
  previewDeploymentUrl: "https://bazar-baz-git-preview.vercel.app",
  productionDeploymentUrl: "https://www.bazar-baz.ir",
  previewDbFingerprint: "neon-preview-br-quiet-union-ai05j3cs",
  productionDbFingerprint: "neon-production-br-small-queen-aii58cw9",
  previewStorageFingerprint: "blob-preview-store-hash-123",
  productionStorageFingerprint: "blob-production-store-hash-456",
  previewAiMediaServiceIdentity: "render-preview-ai-media-service",
  productionAiMediaServiceIdentity: "render-production-ai-media-service",
  previewUsesServerOnlyRenderKey: true,
  productionUsesServerOnlyRenderKey: true,
  previewHasPublicRenderSecret: false,
  productionHasPublicRenderSecret: false,
  previewAiWriteFlowEnabled: false,
  productionAiWriteFlowEnabled: false,
  notes: ["All values are redacted operator evidence."],
};

describe("ai media preview env verification evidence", () => {
  it("safe distinct Preview and Production evidence passes", () => {
    const result = verifyAiMediaPreviewEnvironmentEvidence(safeEvidence);
    assert.equal(result.ok, true);
    assert.deepEqual(result.blockers, []);
    assert.equal(result.evidenceSummary.comparisons.deploymentUrlsDiffer, true);
    assert.equal(result.evidenceSummary.comparisons.databaseFingerprintsDiffer, true);
    assert.equal(result.evidenceSummary.comparisons.storageFingerprintsDiffer, true);
    assert.equal(result.evidenceSummary.comparisons.aiMediaServiceIdentitiesDiffer, true);
  });

  it("identical deployment URL fails", () => {
    const result = verifyAiMediaPreviewEnvironmentEvidence({
      ...safeEvidence,
      previewDeploymentUrl: safeEvidence.productionDeploymentUrl,
    });
    assert.equal(result.ok, false);
    assert.match(result.blockers.join(" "), /deployment URLs/i);
  });

  it("identical DB fingerprint fails", () => {
    const result = verifyAiMediaPreviewEnvironmentEvidence({
      ...safeEvidence,
      previewDbFingerprint: safeEvidence.productionDbFingerprint,
    });
    assert.equal(result.ok, false);
    assert.match(result.blockers.join(" "), /database fingerprints/i);
  });

  it("identical storage fingerprint fails", () => {
    const result = verifyAiMediaPreviewEnvironmentEvidence({
      ...safeEvidence,
      previewStorageFingerprint: safeEvidence.productionStorageFingerprint,
    });
    assert.equal(result.ok, false);
    assert.match(result.blockers.join(" "), /storage fingerprints/i);
  });

  it("identical AI media service identity fails", () => {
    const result = verifyAiMediaPreviewEnvironmentEvidence({
      ...safeEvidence,
      previewAiMediaServiceIdentity: safeEvidence.productionAiMediaServiceIdentity,
    });
    assert.equal(result.ok, false);
    assert.match(result.blockers.join(" "), /AI media service identities/i);
  });

  it("Preview public Render secret fails", () => {
    const result = verifyAiMediaPreviewEnvironmentEvidence({
      ...safeEvidence,
      previewHasPublicRenderSecret: true,
    });
    assert.equal(result.ok, false);
    assert.match(result.blockers.join(" "), /Preview.*public/i);
  });

  it("Production public Render secret fails", () => {
    const result = verifyAiMediaPreviewEnvironmentEvidence({
      ...safeEvidence,
      productionHasPublicRenderSecret: true,
    });
    assert.equal(result.ok, false);
    assert.match(result.blockers.join(" "), /Production.*public/i);
  });

  it("Preview AI write flow enabled fails", () => {
    const result = verifyAiMediaPreviewEnvironmentEvidence({
      ...safeEvidence,
      previewAiWriteFlowEnabled: true,
    });
    assert.equal(result.ok, false);
    assert.match(result.blockers.join(" "), /Preview AI write flow/i);
  });

  it("missing evidence warns by default and blocks in strict mode", () => {
    const nonStrict = verifyAiMediaPreviewEnvironmentEvidence({});
    assert.equal(nonStrict.ok, true);
    assert.ok(nonStrict.warnings.some((warning) => /Missing Preview verification evidence/.test(warning)));

    const strict = verifyAiMediaPreviewEnvironmentEvidence({ strict: true });
    assert.equal(strict.ok, false);
    assert.ok(strict.blockers.some((blocker) => /Missing Preview verification evidence/.test(blocker)));
  });

  it("output does not expose raw secret-like values", () => {
    const rawSecret = "postgresql://user:password@prod.neon.tech/bazar_baz";
    const result = verifyAiMediaPreviewEnvironmentEvidence({
      ...safeEvidence,
      previewDbFingerprint: rawSecret,
      notes: ["AI_MEDIA_SERVICE_INTERNAL_KEY=super-secret"],
    });
    const serialized = JSON.stringify(result);
    assert.equal(result.ok, false);
    assert.equal(serialized.includes(rawSecret), false);
    assert.equal(serialized.includes("super-secret"), false);
    assert.deepEqual(result.evidenceSummary.secretLikeEvidenceFields.sort(), ["notes", "previewDbFingerprint"].sort());
  });

  it("helper performs no network calls", () => {
    const originalFetch = globalThis.fetch;
    let fetchCalled = false;
    globalThis.fetch = (() => {
      fetchCalled = true;
      throw new Error("fetch should not be called");
    }) as typeof fetch;
    try {
      const result = verifyAiMediaPreviewEnvironmentEvidence(safeEvidence);
      assert.equal(result.ok, true);
      assert.equal(fetchCalled, false);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("helper does not import server-only runtime client", async () => {
    const mod = await import("@/lib/ai-media/preview-env-verification");
    assert.equal(typeof mod.verifyAiMediaPreviewEnvironmentEvidence, "function");
  });
});
