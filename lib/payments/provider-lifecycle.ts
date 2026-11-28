import { createHash } from "node:crypto";
import type { PaymentRequestStatus } from "@prisma/client";

export type ProviderVerification =
  | {
      outcome: "CONFIRMED_PAID";
      amountToman: bigint;
      currency: "TOMAN";
      providerTransactionId: string;
    }
  | { outcome: "CONFIRMED_NOT_PAID"; providerTransactionId?: string | null }
  | { outcome: "UNKNOWN"; reason: "TIMEOUT" | "UNAVAILABLE" | "AMBIGUOUS" };

export type VerificationDecision =
  | { action: "SETTLE"; providerTransactionId: string; amountToman: bigint }
  | { action: "FAIL_DEFINITIVELY"; providerTransactionId: string | null }
  | { action: "RECONCILE"; reason: "TIMEOUT" | "UNAVAILABLE" | "AMBIGUOUS" }
  | { action: "IDEMPOTENT_REPLAY" }
  | { action: "REJECT"; reason: "WRONG_STATE" | "AMOUNT_MISMATCH" | "INVALID_TRANSACTION_ID" };

const TERMINAL_REQUEST_STATES = new Set<PaymentRequestStatus>([
  "PAID", "FAILED", "EXPIRED", "CANCELLED",
]);

export type FinalizedProviderAmount = Readonly<{ amountToman: bigint; currency: "TOMAN" }>;

/** The adapter receives only the amount already frozen in the merchant quote and request. */
export function finalizedProviderAmount(input: {
  snapshotAmountToman: bigint;
  paymentRequestAmountToman: bigint;
  currency: string;
}): FinalizedProviderAmount {
  if (input.snapshotAmountToman <= BigInt(0) || input.paymentRequestAmountToman !== input.snapshotAmountToman || input.currency !== "TOMAN") {
    throw new Error("Finalized provider amount does not match the immutable installment quote.");
  }
  return Object.freeze({ amountToman: input.snapshotAmountToman, currency: "TOMAN" });
}

/**
 * Decide what may happen after a provider-neutral verification result has
 * already been translated into TOMAN. This function makes no provider calls.
 * Provider-specific unit conversion, authentication, signatures and outcome
 * mapping must be supplied by an adapter validated against the official API.
 */
export function decidePaymentVerification(input: {
  currentStatus: PaymentRequestStatus;
  expectedAmountToman: bigint;
  verification: ProviderVerification;
  alreadyApplied?: { amountToman: bigint; providerTransactionId: string } | null;
}): VerificationDecision {
  const { currentStatus, expectedAmountToman, verification } = input;
  if (expectedAmountToman <= BigInt(0)) return { action: "REJECT", reason: "AMOUNT_MISMATCH" };

  if (input.alreadyApplied) {
    if (verification.outcome === "CONFIRMED_PAID" &&
        input.alreadyApplied.amountToman === verification.amountToman &&
        input.alreadyApplied.providerTransactionId === verification.providerTransactionId) {
      return { action: "IDEMPOTENT_REPLAY" };
    }
    return { action: "REJECT", reason: "WRONG_STATE" };
  }

  if (currentStatus !== "PENDING_VERIFICATION" || TERMINAL_REQUEST_STATES.has(currentStatus)) {
    return { action: "REJECT", reason: "WRONG_STATE" };
  }

  if (verification.outcome === "UNKNOWN") {
    return { action: "RECONCILE", reason: verification.reason };
  }
  if (verification.outcome === "CONFIRMED_NOT_PAID") {
    return { action: "FAIL_DEFINITIVELY", providerTransactionId: verification.providerTransactionId ?? null };
  }

  const transactionId = verification.providerTransactionId.trim();
  if (!transactionId || transactionId.length > 200 || /[\u0000-\u001f\u007f]/.test(transactionId)) {
    return { action: "REJECT", reason: "INVALID_TRANSACTION_ID" };
  }
  if (verification.currency !== "TOMAN" || verification.amountToman !== expectedAmountToman) {
    return { action: "REJECT", reason: "AMOUNT_MISMATCH" };
  }
  return { action: "SETTLE", providerTransactionId: transactionId, amountToman: verification.amountToman };
}

/** Unknown provider outcomes must keep the existing attempt for reconciliation. */
export function paymentRecoveryAction(status: PaymentRequestStatus): "VERIFY_EXISTING" | "RECONCILE" | "NONE" {
  if (status === "PENDING_VERIFICATION") return "RECONCILE";
  if (status === "AWAITING_CUSTOMER") return "VERIFY_EXISTING";
  return "NONE";
}

export type CallbackReplayDecision = "PROCESS_FIRST_DELIVERY" | "IGNORE_EXACT_REPLAY" | "REJECT_CONFLICT";

/**
 * Fingerprint raw callback bytes without retaining them. This is only a
 * deduplication primitive; it does not authenticate a callback or prove that
 * its contents are canonical. Persist and compare it under a database lock or
 * unique key before any financial side effect.
 */
export function fingerprintProviderCallback(rawBody: Uint8Array): string {
  return createHash("sha256").update(rawBody).digest("hex");
}

export function decideCallbackReplay(storedFingerprint: string | null, incomingFingerprint: string): CallbackReplayDecision {
  if (!/^[a-f0-9]{64}$/i.test(incomingFingerprint)) return "REJECT_CONFLICT";
  if (storedFingerprint === null) return "PROCESS_FIRST_DELIVERY";
  return storedFingerprint.toLowerCase() === incomingFingerprint.toLowerCase()
    ? "IGNORE_EXACT_REPLAY"
    : "REJECT_CONFLICT";
}

export type SanitizedLifecycleAudit = {
  organizationId: string;
  paymentRequestId: string;
  attemptId: string;
  event: "CALLBACK_RECEIVED" | "VERIFICATION_STARTED" | "VERIFICATION_RESULT" | "RECONCILIATION_REQUIRED" | "CANCEL_REQUESTED" | "REFUND_REQUESTED";
  outcome: "ACCEPTED" | "REPLAY" | "REJECTED" | "UNKNOWN" | "UNSUPPORTED";
  code?: string;
};

/** Only local opaque identifiers and allowlisted result codes belong in audit. */
export function sanitizeLifecycleAudit(input: SanitizedLifecycleAudit): SanitizedLifecycleAudit {
  const code = input.code?.trim();
  return {
    organizationId: input.organizationId,
    paymentRequestId: input.paymentRequestId,
    attemptId: input.attemptId,
    event: input.event,
    outcome: input.outcome,
    ...(code && /^[A-Z0-9_-]{1,64}$/.test(code) ? { code } : {}),
  };
}

/** Provider-specific cancellation/refund cannot be enabled without a verified contract. */
export function providerFinancialMutationCapability(operation: "CANCEL" | "REFUND" | "PARTIAL_REFUND") {
  return { operation, available: false as const, reason: "OFFICIAL_SELF_API_CONTRACT_REQUIRED" as const };
}
