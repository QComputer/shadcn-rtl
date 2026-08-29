import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canTransitionPaymentAttempt, canTransitionPaymentRequest } from "@/lib/payments/payment-state";

describe("payment state machines", () => {
  it("keeps payment requests monotonic and permits retryable verification", () => {
    assert.equal(canTransitionPaymentRequest("CREATED", "AWAITING_CUSTOMER"), true);
    assert.equal(canTransitionPaymentRequest("AWAITING_CUSTOMER", "PENDING_VERIFICATION"), true);
    assert.equal(canTransitionPaymentRequest("PENDING_VERIFICATION", "PENDING_VERIFICATION"), true);
    assert.equal(canTransitionPaymentRequest("PENDING_VERIFICATION", "PAID"), true);
    assert.equal(canTransitionPaymentRequest("PAID", "FAILED"), false);
    assert.equal(canTransitionPaymentRequest("FAILED", "PENDING_VERIFICATION"), false);
  });

  it("keeps provider attempts terminal after verification", () => {
    assert.equal(canTransitionPaymentAttempt("CREATED", "PENDING_VERIFICATION"), true);
    assert.equal(canTransitionPaymentAttempt("PENDING_VERIFICATION", "PENDING_VERIFICATION"), true);
    assert.equal(canTransitionPaymentAttempt("PENDING_VERIFICATION", "VERIFIED"), true);
    assert.equal(canTransitionPaymentAttempt("VERIFIED", "FAILED"), false);
  });
});
