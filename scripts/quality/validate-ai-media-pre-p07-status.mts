import test from "node:test";
import assert from "node:assert/strict";
import {
  getAiMediaStatusDetailLines,
  getAiMediaStatusDisplay,
  isAiMediaStatusInFlight,
  mapAiMediaStatusToLegacyStatus,
  normalizeAiMediaServiceStatusPayload,
} from "@/lib/ai-media/status";

test("PRE-P07 statuses map into the legacy application enum safely", () => {
  const expectations = [
    ["ACCEPTED", "QUEUED"],
    ["QUEUED_WAITING_FOR_GPU", "QUEUED"],
    ["QUEUED_GPU_OFFLINE", "QUEUED"],
    ["QUEUED_GPU_BUSY", "QUEUED"],
    ["CLAIMED_BY_WORKER", "PROCESSING"],
    ["PROCESSING", "PROCESSING"],
    ["RESULT_READY", "COMPLETED"],
    ["IMPORTED_BY_BAZAR_BAZ", "COMPLETED"],
    ["FAILED_RETRYABLE", "FAILED"],
    ["FAILED_FINAL", "FAILED"],
    ["CANCELLED", "CANCELED"],
    ["EXPIRED", "FAILED"],
    ["UNKNOWN", "QUEUED"],
  ] as const;

  for (const [canonical, legacy] of expectations) {
    assert.equal(mapAiMediaStatusToLegacyStatus(canonical), legacy, canonical);
    assert.equal(normalizeAiMediaServiceStatusPayload({ status: canonical }).legacyStatus, legacy, canonical);
  }
});

test("legacy service statuses remain accepted", () => {
  assert.equal(normalizeAiMediaServiceStatusPayload({ status: "QUEUED" }).canonicalStatus, "QUEUED_WAITING_FOR_GPU");
  assert.equal(normalizeAiMediaServiceStatusPayload({ status: "PROCESSING" }).legacyStatus, "PROCESSING");
  assert.equal(normalizeAiMediaServiceStatusPayload({ status: "COMPLETED" }).legacyStatus, "COMPLETED");
  assert.equal(normalizeAiMediaServiceStatusPayload({ status: "FAILED" }).legacyStatus, "FAILED");
  assert.equal(normalizeAiMediaServiceStatusPayload({ status: "CANCELED" }).legacyStatus, "CANCELED");
});

test("GPU offline and busy states are pending, not failed", () => {
  const offline = normalizeAiMediaServiceStatusPayload({ status: "QUEUED_GPU_OFFLINE" });
  const busy = normalizeAiMediaServiceStatusPayload({ status: "QUEUED_GPU_BUSY" });

  assert.equal(offline.failure, false);
  assert.equal(offline.inFlight, true);
  assert.equal(offline.unavailable, true);
  assert.equal(busy.failure, false);
  assert.equal(busy.inFlight, true);
  assert.equal(busy.workerAvailability, "busy");
});

test("queue rank and ETA metadata are parsed without trusting raw status strings", () => {
  const normalized = normalizeAiMediaServiceStatusPayload({
    canonical_status: "QUEUED_WAITING_FOR_GPU",
    queue: { queue_rank: 3, jobs_ahead: "2" },
    eta: { eta_seconds: 125, confidence: "low" },
  });

  assert.equal(normalized.queue.queueRank, 3);
  assert.equal(normalized.queue.jobsAhead, 2);
  assert.equal(normalized.eta.displayable, true);
  assert.equal(normalized.eta.approximate, true);
  assert.match(getAiMediaStatusDetailLines(normalized, "fa").join(" | "), /رتبه در صف/);
  assert.match(getAiMediaStatusDetailLines(normalized, "en").join(" | "), /Approximate ETA/);
});

test("unknown or malformed status is fail-closed into safe pending UI", () => {
  const normalized = normalizeAiMediaServiceStatusPayload({ status: "WORKER_HAS_EXISTENTIAL_CRISIS" });
  const display = getAiMediaStatusDisplay(normalized, "fa");

  assert.equal(normalized.canonicalStatus, "UNKNOWN");
  assert.equal(normalized.legacyStatus, "QUEUED");
  assert.equal(isAiMediaStatusInFlight(normalized), true);
  assert.equal(normalized.success, false);
  assert.equal(display.badgeText, "در حال بررسی");
});

test("ETA with none or unknown confidence is hidden from user-facing details", () => {
  const none = normalizeAiMediaServiceStatusPayload({
    status: "QUEUED_WAITING_FOR_GPU",
    eta_seconds: 60,
    eta_confidence: "none",
  });
  const unknown = normalizeAiMediaServiceStatusPayload({
    status: "QUEUED_WAITING_FOR_GPU",
    eta_seconds: 60,
    eta_confidence: "unknown",
  });

  assert.equal(none.eta.displayable, false);
  assert.equal(unknown.eta.displayable, false);
  assert.equal(getAiMediaStatusDetailLines(none, "fa").some((line) => line.includes("زمان")), false);
});
