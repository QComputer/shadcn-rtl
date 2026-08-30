import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { evaluateInotiProductionReadiness } from "@/lib/payments/inoti-production-readiness";
import {
  buildOperatorReconciliationItem,
  buildPublicPaymentStatus,
  classifyReconciliation,
  type PaymentOperationsInput,
} from "@/lib/payments/payment-operations-read-model";

function payment(overrides: Partial<PaymentOperationsInput> = {}): PaymentOperationsInput {
  return {
    publicPaymentId: "00000000-0000-4000-8000-000000000001",
    amountToman: BigInt(1000),
    currency: "TOMAN",
    purpose: "ORDER_PAYMENT",
    status: "PENDING_VERIFICATION",
    expiresAt: null,
    paidAt: null,
    failedAt: null,
    cancelledAt: null,
    createdAt: new Date("2026-08-30T00:00:00.000Z"),
    updatedAt: new Date("2026-08-30T00:01:00.000Z"),
    attempts: [{
      status: "PENDING_VERIFICATION",
      failureReason: "raw-secret-never-exposed",
      callbackReceivedAt: new Date("2026-08-30T00:00:30.000Z"),
      verificationStartedAt: new Date("2026-08-30T00:00:31.000Z"),
      verifiedAt: null,
    }],
    ussdPaymentIntent: { status: "VERIFYING", verifiedAt: null, settledAt: null },
    ...overrides,
  };
}

describe("BB-P3 payment operations read models", () => {
  it("represents retryable verification without claiming failure or payment", () => {
    const status = buildPublicPaymentStatus(payment());
    assert.equal(status.status, "VERIFYING");
    assert.equal(status.retryable, true);
    assert.equal(status.message, "Payment is being verified.");
  });

  it("keeps provider and customer evidence out of public and operator output", () => {
    const input = payment();
    const output = JSON.stringify({ public: buildPublicPaymentStatus(input), operator: buildOperatorReconciliationItem(input) });
    assert.doesNotMatch(output, /raw-secret|mobile|session|factor|rrn|password|token/i);
  });

  it("routes late verified and correlation cases to manual operations", () => {
    const late = classifyReconciliation(payment({
      status: "EXPIRED",
      attempts: [{ status: "VERIFIED", failureReason: null, callbackReceivedAt: new Date(), verificationStartedAt: new Date(), verifiedAt: new Date() }],
      ussdPaymentIntent: { status: "VERIFIED", verifiedAt: new Date(), settledAt: null },
    }));
    assert.equal(late?.category, "LATE_VERIFIED_PAYMENT");
    assert.equal(late?.retryable, false);

    const mismatch = classifyReconciliation(payment({
      status: "FAILED",
      attempts: [{ status: "FAILED", failureReason: "CORRELATION_MISMATCH", callbackReceivedAt: new Date(), verificationStartedAt: new Date(), verifiedAt: null }],
    }));
    assert.equal(mismatch?.category, "SECURITY_ANOMALY");
  });
});
describe("BB-P3 independent activation gates", () => {
  const ready = {
    schemaReady: true,
    appRevisionReady: true,
    integrationExists: true,
    integrationActive: true,
    providerIsInotiUssd: true,
    codeNamePresent: true,
    credentialsPresent: true,
    callbackValid: true,
    tenantPaymentEnabled: true,
    liveVerificationEnabled: true,
    livePaymentEnabled: true,
    runtimeMutationsApproved: true,
    monitoringReady: true,
    durableReconciliationReady: true,
  };

  it("requires both tenant and global gates", () => {
    assert.equal(evaluateInotiProductionReadiness(ready).initiationEnabled, true);
    assert.equal(evaluateInotiProductionReadiness({ ...ready, tenantPaymentEnabled: false }).initiationEnabled, false);
    assert.equal(evaluateInotiProductionReadiness({ ...ready, runtimeMutationsApproved: false }).initiationEnabled, false);
  });

  it("supports reconciliation while initiation is paused", () => {
    const paused = evaluateInotiProductionReadiness({ ...ready, tenantPaymentEnabled: false });
    assert.equal(paused.reconciliationEnabled, true);
    assert.equal(paused.initiationEnabled, false);
    assert.equal(paused.activationState, "PAUSED");
  });

  it("evaluates target rows independently without shared state", () => {
    const platform = evaluateInotiProductionReadiness(ready);
    const leo = evaluateInotiProductionReadiness({ ...ready, tenantPaymentEnabled: false });
    const aka = evaluateInotiProductionReadiness({ ...ready, codeNamePresent: false });
    assert.equal(platform.initiationEnabled, true);
    assert.equal(leo.initiationEnabled, false);
    assert.equal(aka.finalStatus, "BLOCKED_PROVIDER");
  });
});
