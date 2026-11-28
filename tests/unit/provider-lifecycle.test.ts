import assert from "node:assert/strict";
import test from "node:test";
import {
  decideCallbackReplay,
  decidePaymentVerification,
  fingerprintProviderCallback,
  finalizedProviderAmount,
  paymentRecoveryAction,
  providerFinancialMutationCapability,
  sanitizeLifecycleAudit,
} from "@/lib/payments/provider-lifecycle";

test("provider receives only the exact finalized amount from the immutable installment quote", () => {
  assert.deepEqual(finalizedProviderAmount({ snapshotAmountToman: BigInt(11_100), paymentRequestAmountToman: BigInt(11_100), currency: "TOMAN" }),
    { amountToman: BigInt(11_100), currency: "TOMAN" });
  assert.throws(() => finalizedProviderAmount({ snapshotAmountToman: BigInt(11_100), paymentRequestAmountToman: BigInt(11_000), currency: "TOMAN" }));
  assert.throws(() => finalizedProviderAmount({ snapshotAmountToman: BigInt(11_100), paymentRequestAmountToman: BigInt(11_100), currency: "IRR" }));
});
test("only exact positive amount and transaction identity can settle a pending payment", () => {
  const confirmed = decidePaymentVerification({ currentStatus: "PENDING_VERIFICATION", expectedAmountToman: BigInt(1_110_000),
    verification: { outcome: "CONFIRMED_PAID", amountToman: BigInt(1_110_000), currency: "TOMAN", providerTransactionId: "txn-1" } });
  assert.deepEqual(confirmed, { action: "SETTLE", amountToman: BigInt(1_110_000), providerTransactionId: "txn-1" });
  assert.equal(decidePaymentVerification({ currentStatus: "PENDING_VERIFICATION", expectedAmountToman: BigInt(1_110_000),
    verification: { outcome: "CONFIRMED_PAID", amountToman: BigInt(1_109_999), currency: "TOMAN", providerTransactionId: "txn-1" } }).action, "REJECT");
  assert.equal(decidePaymentVerification({ currentStatus: "PENDING_VERIFICATION", expectedAmountToman: BigInt(1_110_000),
    verification: { outcome: "CONFIRMED_PAID", amountToman: BigInt(1_110_000), currency: "TOMAN", providerTransactionId: "  " } }).action, "REJECT");
});

test("client-supplied or terminal-state results cannot change the server snapshot", () => {
  assert.deepEqual(decidePaymentVerification({ currentStatus: "AWAITING_CUSTOMER", expectedAmountToman: BigInt(20),
    verification: { outcome: "CONFIRMED_PAID", amountToman: BigInt(20), currency: "TOMAN", providerTransactionId: "txn" } }), { action: "REJECT", reason: "WRONG_STATE" });
  assert.deepEqual(decidePaymentVerification({ currentStatus: "PENDING_VERIFICATION", expectedAmountToman: BigInt(20),
    verification: { outcome: "CONFIRMED_PAID", amountToman: BigInt(20), currency: "TOMAN", providerTransactionId: "txn" },
    alreadyApplied: { amountToman: BigInt(19), providerTransactionId: "txn" } }), { action: "REJECT", reason: "WRONG_STATE" });
});

test("identical callback bytes replay idempotently while a conflicting replay is rejected", () => {
  const body = Buffer.from('{"synthetic":"callback"}');
  const fingerprint = fingerprintProviderCallback(body);
  assert.equal(fingerprint.length, 64);
  assert.equal(decideCallbackReplay(null, fingerprint), "PROCESS_FIRST_DELIVERY");
  assert.equal(decideCallbackReplay(fingerprint, fingerprint), "IGNORE_EXACT_REPLAY");
  assert.equal(decideCallbackReplay(fingerprint, "0".repeat(64)), "REJECT_CONFLICT");
});

test("unknown outcomes route to reconciliation without authorizing another attempt", () => {
  assert.deepEqual(decidePaymentVerification({ currentStatus: "PENDING_VERIFICATION", expectedAmountToman: BigInt(500),
    verification: { outcome: "UNKNOWN", reason: "TIMEOUT" } }), { action: "RECONCILE", reason: "TIMEOUT" });
  assert.equal(paymentRecoveryAction("PENDING_VERIFICATION"), "RECONCILE");
  assert.equal(paymentRecoveryAction("AWAITING_CUSTOMER"), "VERIFY_EXISTING");
  assert.equal(paymentRecoveryAction("FAILED"), "NONE");
});

test("provider-specific cancellation and refund are unavailable until contract validation", () => {
  for (const operation of ["CANCEL", "REFUND", "PARTIAL_REFUND"] as const) {
    assert.deepEqual(providerFinancialMutationCapability(operation), {
      operation, available: false, reason: "OFFICIAL_SELF_API_CONTRACT_REQUIRED",
    });
  }
});

test("audit payload removes callback and secret-like content", () => {
  const safe = sanitizeLifecycleAudit({ organizationId: "org-a", paymentRequestId: "request-a", attemptId: "attempt-a",
    event: "VERIFICATION_RESULT", outcome: "REJECTED", code: "AUTH_FAILED\nBearer super-secret" });
  assert.deepEqual(safe, { organizationId: "org-a", paymentRequestId: "request-a", attemptId: "attempt-a",
    event: "VERIFICATION_RESULT", outcome: "REJECTED" });
});
