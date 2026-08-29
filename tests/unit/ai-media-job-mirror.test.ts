import { readFileSync } from "node:fs";
import { register } from "node:module";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getNormalUserJobVisibility,
  getSpendHoldActionForMirrorState,
  getSuperAdminJobVisibility,
  getWorkerOperatorJobVisibility,
  mapNetworkStatusToJobMirrorState,
} from "@/lib/ai-media/job-mirror";

register(new URL("./loader.mjs", import.meta.url));

describe("AI media app-owned job mirror design helpers", () => {
  it("maps GPU queue states to QUEUED instead of failure", () => {
    assert.equal(mapNetworkStatusToJobMirrorState({ status: "QUEUED_WAITING_FOR_GPU" }), "QUEUED");
    assert.equal(mapNetworkStatusToJobMirrorState({ status: "QUEUED_GPU_OFFLINE" }), "QUEUED");
    assert.equal(mapNetworkStatusToJobMirrorState({ status: "QUEUED_GPU_BUSY" }), "QUEUED");
  });

  it("maps active and terminal network statuses to app mirror states", () => {
    assert.equal(mapNetworkStatusToJobMirrorState({ status: "CLAIMED_BY_WORKER" }), "CLAIMED");
    assert.equal(mapNetworkStatusToJobMirrorState({ status: "PROCESSING" }), "PROCESSING");
    assert.equal(mapNetworkStatusToJobMirrorState({ status: "RESULT_READY" }), "RESULT_READY");
    assert.equal(mapNetworkStatusToJobMirrorState({ status: "IMPORTED_BY_BAZAR_BAZ" }), "IMPORTED");
    assert.equal(mapNetworkStatusToJobMirrorState({ status: "FAILED_RETRYABLE" }), "FAILED_RETRYABLE");
    assert.equal(mapNetworkStatusToJobMirrorState({ status: "FAILED_FINAL" }), "FAILED_FINAL");
    assert.equal(mapNetworkStatusToJobMirrorState({ status: "CANCELLED" }), "CANCELLED");
    assert.equal(mapNetworkStatusToJobMirrorState({ status: "EXPIRED" }), "EXPIRED");
  });

  it("fails closed on unknown provider status", () => {
    assert.equal(mapNetworkStatusToJobMirrorState({ status: "SOMETHING_NEW" }), "QUEUED");
  });

  it("settles spend hold only after accepted Bazarbaaz import", () => {
    assert.equal(getSpendHoldActionForMirrorState("RESULT_READY", { hasActiveHold: true }), "keep");
    assert.equal(getSpendHoldActionForMirrorState("IMPORT_PENDING", { hasActiveHold: true }), "keep");
    assert.equal(getSpendHoldActionForMirrorState("IMPORTED", { hasActiveHold: true }), "settle");
  });

  it("creates, keeps, and releases or refunds spend holds safely", () => {
    assert.equal(getSpendHoldActionForMirrorState("DRAFT"), "none");
    assert.equal(getSpendHoldActionForMirrorState("QUOTED"), "create");
    assert.equal(getSpendHoldActionForMirrorState("HOLD_PENDING", { hasActiveHold: true }), "keep");
    assert.equal(getSpendHoldActionForMirrorState("FAILED_FINAL", { hasActiveHold: true }), "release_refund");
    assert.equal(getSpendHoldActionForMirrorState("CANCELLED", { hasActiveHold: true }), "release_refund");
    assert.equal(getSpendHoldActionForMirrorState("EXPIRED", { hasActiveHold: true }), "release_refund");
  });

  it("normal user visibility excludes cross-user and cross-organization details", () => {
    const hidden = getNormalUserJobVisibility({
      viewerUserId: "user-b",
      viewerOrganizationId: "org-b",
      jobRequestedByUserId: "user-a",
      jobOrganizationId: "org-a",
      privacyLevel: "ORGANIZATION",
    });
    assert.equal(hidden.canSeeJob, false);
    assert.equal(hidden.canSeePrompt, false);
    assert.equal(hidden.canSeeImages, false);
    assert.equal(hidden.canSeeFiles, false);
  });

  it("normal user can see own or organization job details without provider diagnostics", () => {
    const visible = getNormalUserJobVisibility({
      viewerUserId: "user-a",
      viewerOrganizationId: "org-a",
      jobRequestedByUserId: "user-a",
      jobOrganizationId: "org-a",
      privacyLevel: "ORGANIZATION",
    });
    assert.equal(visible.canSeeJob, true);
    assert.equal(visible.canSeePrompt, true);
    assert.equal(visible.canSeeImages, true);
    assert.equal(visible.canSeeFiles, true);
    assert.equal(visible.canSeeProviderDiagnostics, false);
    assert.equal(visible.fullDiagnosticMarker, false);
  });

  it("worker operator visibility excludes prompts images and files", () => {
    const visibility = getWorkerOperatorJobVisibility();
    assert.equal(visibility.canSeeJob, true);
    assert.equal(visibility.canSeePrompt, false);
    assert.equal(visibility.canSeeImages, false);
    assert.equal(visibility.canSeeFiles, false);
    assert.equal(visibility.canSeeWorkerContributionFacts, true);
  });

  it("Super Admin visibility can include full diagnostic marker without implementing UI", () => {
    const visibility = getSuperAdminJobVisibility();
    assert.equal(visibility.canSeeJob, true);
    assert.equal(visibility.canSeePrompt, true);
    assert.equal(visibility.canSeeImages, true);
    assert.equal(visibility.canSeeFiles, true);
    assert.equal(visibility.canSeeProviderDiagnostics, true);
    assert.equal(visibility.fullDiagnosticMarker, true);
  });

  it("pure module has no fetch, process.env, DB, storage, or Render write imports", () => {
    const source = readFileSync(new URL("../../lib/ai-media/job-mirror.ts", import.meta.url), "utf8");
    assert.equal(/\bfetch\s*\(/.test(source), false);
    assert.equal(/process\.env/.test(source), false);
    assert.equal(/@\/lib\/db|prisma|@prisma|@vercel\/blob/.test(source), false);
    assert.equal(/createAiMediaJob|cancelAiMediaJob|v1\/product-image-suggestions\/jobs/.test(source), false);
  });
});
