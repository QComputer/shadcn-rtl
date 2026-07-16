import { readFileSync } from "node:fs";
import { register } from "node:module";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  planAiMediaResultImport,
  shouldExposeImportedAssetToNormalUser,
  shouldExposeImportedAssetToSuperAdmin,
  shouldExposeImportedAssetToWorkerOperator,
} from "@/lib/ai-media/import-planning";
import {
  planBazQuoteLifecycle,
  planBazRefundOrRelease,
  planBazSettlementEligibility,
  planBazSpendHoldLifecycle,
} from "@/lib/ai-media/baz-spend-planning";
import {
  contributionFactExposesRawMedia,
  planWorkerContributionReward,
  sanitizeWorkerContributionFact,
} from "@/lib/ai-media/contribution-mirror";
import { assertBazInternalCreditCurrency, buildAiMediaPlatformAuditEventDraft } from "@/lib/ai-media/platform-domain";

register(new URL("./loader.mjs", import.meta.url));

describe("AI media platform import planning", () => {
  it("RESULT_READY plans import pending, not user-visible success", () => {
    const plan = planAiMediaResultImport({ state: "RESULT_READY", rawOutputAvailable: true });
    assert.equal(plan.shouldAttemptImport, true);
    assert.equal(plan.userVisibleSuccess, false);
    assert.equal(plan.importStatus, "PENDING");
    assert.equal(plan.exposeRawOutput, false);
  });

  it("IMPORTED exposes accepted asset to owner or organization", () => {
    assert.equal(shouldExposeImportedAssetToNormalUser({
      state: "IMPORTED",
      viewerUserId: "user-a",
      viewerOrganizationId: "org-a",
      assetOwnerUserId: "user-b",
      assetOrganizationId: "org-a",
    }), true);
  });

  it("failed import hides raw worker output", () => {
    const plan = planAiMediaResultImport({
      state: "FAILED_FINAL",
      rawOutputAvailable: true,
      validationFailures: ["INVALID_MIME"],
    });
    assert.equal(plan.userVisibleSuccess, false);
    assert.equal(plan.exposeRawOutput, false);
    assert.equal(plan.importStatus, "FAILED_HIDDEN");
    assert.equal(plan.risk, "BLOCK");
  });

  it("worker operator cannot see raw media by default", () => {
    assert.equal(shouldExposeImportedAssetToWorkerOperator({ state: "IMPORTED" }), false);
    assert.equal(shouldExposeImportedAssetToWorkerOperator({ state: "IMPORTED", workerIsAuthorizedOwner: true }), true);
  });

  it("SUPER_ADMIN visibility marker is allowed for future admin console", () => {
    assert.equal(shouldExposeImportedAssetToSuperAdmin({ state: "RESULT_READY" }), true);
    assert.equal(shouldExposeImportedAssetToSuperAdmin({ state: "IMPORTED" }), true);
  });
});

describe("AI media Baz spend planning", () => {
  it("hold can be created after quote confirmation", () => {
    assert.equal(planBazQuoteLifecycle({ quoteAccepted: true }), "QUOTE_AVAILABLE");
    const plan = planBazSpendHoldLifecycle({ mirrorState: "QUOTED", quoteAccepted: true });
    assert.equal(plan.action, "CREATE_HOLD");
    assert.equal(plan.ledgerMutationAllowed, false);
    assert.equal(plan.internalCreditOnly, true);
  });

  it("hold is kept while queued or processing", () => {
    assert.equal(planBazSpendHoldLifecycle({ mirrorState: "QUEUED", hasActiveHold: true }).action, "KEEP_HOLD");
    assert.equal(planBazSpendHoldLifecycle({ mirrorState: "PROCESSING", hasActiveHold: true }).action, "KEEP_HOLD");
  });

  it("hold does not settle on RESULT_READY", () => {
    const plan = planBazSpendHoldLifecycle({ mirrorState: "RESULT_READY", hasActiveHold: true });
    assert.equal(plan.action, "KEEP_HOLD");
    assert.equal(plan.settlementEligible, false);
  });

  it("hold settles on IMPORTED only", () => {
    const plan = planBazSettlementEligibility({ mirrorState: "IMPORTED", hasActiveHold: true });
    assert.equal(plan.action, "SETTLE_HOLD");
    assert.equal(plan.settlementEligible, true);
    assert.equal(plan.ledgerMutationAllowed, false);
  });

  it("hold releases or refunds on final failure cancellation or expiry", () => {
    assert.equal(planBazRefundOrRelease({ mirrorState: "FAILED_FINAL", hasActiveHold: true }).action, "RELEASE_OR_REFUND_HOLD");
    assert.equal(planBazRefundOrRelease({ mirrorState: "CANCELLED", hasActiveHold: true }).action, "RELEASE_OR_REFUND_HOLD");
    assert.equal(planBazRefundOrRelease({ mirrorState: "EXPIRED", hasActiveHold: true }).action, "RELEASE_OR_REFUND_HOLD");
  });

  it("Baz remains internal credit only", () => {
    assert.equal(assertBazInternalCreditCurrency("BAZ_INTERNAL_CREDIT"), true);
    assert.equal(assertBazInternalCreditCurrency("USD"), false);
  });
});

describe("AI media worker contribution mirror planning", () => {
  const contribution = {
    providerContributionId: "contrib-1",
    workerOpaqueId: "worker-opaque",
    mirrorId: "mirror-1",
    jobState: "IMPORTED" as const,
    importedAssetAccepted: true,
    capabilityKey: "product-image",
    durationMs: 1200,
    rawPrompt: "must not survive",
    rawImageUrl: "https://example.test/source.png",
    rawFileUrl: "https://example.test/result.png",
  };

  it("accepted imported contribution is pending-reward eligible", () => {
    const plan = planWorkerContributionReward(contribution, "standard-v1");
    assert.equal(plan.rewardEligible, true);
    assert.equal(plan.pendingReward, true);
    assert.equal(plan.rewardPolicyKey, "standard-v1");
    assert.equal(plan.walletCreditProduced, false);
  });

  it("failed result is not reward eligible", () => {
    const plan = planWorkerContributionReward({ ...contribution, jobState: "FAILED_FINAL", importedAssetAccepted: false });
    assert.equal(plan.rewardEligible, false);
    assert.ok(plan.blockerCodes.includes("JOB_FAILED"));
    assert.ok(plan.blockerCodes.includes("RESULT_NOT_IMPORTED"));
  });

  it("suspicious or rejected output prevents reward eligibility", () => {
    assert.ok(planWorkerContributionReward({ ...contribution, suspicious: true }).blockerCodes.includes("FRAUD_SUSPECTED"));
    assert.ok(planWorkerContributionReward({ ...contribution, rejected: true }).blockerCodes.includes("REJECTED_OUTPUT"));
  });

  it("sanitized contribution fact exposes no raw prompt image or file fields", () => {
    const sanitized = sanitizeWorkerContributionFact(contribution);
    assert.ok(sanitized);
    assert.equal("rawPrompt" in sanitized, false);
    assert.equal("rawImageUrl" in sanitized, false);
    assert.equal("rawFileUrl" in sanitized, false);
    assert.equal(contributionFactExposesRawMedia(sanitized), false);
  });
});

describe("AI media platform domain boundary", () => {
  it("builds redacted audit event drafts without mutation", () => {
    const event = buildAiMediaPlatformAuditEventDraft({
      eventId: "event-1",
      organizationId: "org-a",
      requestId: "request-1",
      mirrorId: "mirror-1",
      actorUserId: "user-a",
      action: "IMPORT_PLANNED",
      dedupeKey: "org-a:mirror-1:import",
      safeMetadata: { status: "planned" },
    }, "ORGANIZATION");
    assert.equal(event.redacted, true);
    assert.equal(event.visibilityScope, "ORGANIZATION");
  });

  it("modules do not import Prisma server-only fetch process.env storage or Render write helpers", () => {
    const files = [
      "../../lib/ai-media/platform-domain.ts",
      "../../lib/ai-media/import-planning.ts",
      "../../lib/ai-media/baz-spend-planning.ts",
      "../../lib/ai-media/contribution-mirror.ts",
    ];
    for (const file of files) {
      const source = readFileSync(new URL(file, import.meta.url), "utf8");
      assert.equal(/@\/lib\/db|@prisma|prisma|server-only|@vercel\/blob/.test(source), false, file);
      assert.equal(/\bfetch\s*\(|process\.env/.test(source), false, file);
      assert.equal(/createAiMediaJob|cancelAiMediaJob|v1\/product-image-suggestions\/jobs/.test(source), false, file);
    }
  });
});
