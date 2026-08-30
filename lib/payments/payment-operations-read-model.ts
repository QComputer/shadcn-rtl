import type {
  PaymentProviderAttemptStatus,
  PaymentRequestStatus,
  UssdPaymentIntentStatus,
} from "@prisma/client";

export type PaymentOperationsInput = {
  publicPaymentId: string;
  amountToman: bigint;
  currency: string;
  purpose: string;
  status: PaymentRequestStatus;
  expiresAt: Date | null;
  paidAt: Date | null;
  failedAt: Date | null;
  cancelledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  attempts: readonly {
    status: PaymentProviderAttemptStatus;
    failureReason: string | null;
    callbackReceivedAt: Date | null;
    verificationStartedAt: Date | null;
    verifiedAt: Date | null;
  }[];
  ussdPaymentIntent: {
    status: UssdPaymentIntentStatus;
    verifiedAt: Date | null;
    settledAt: Date | null;
  } | null;
};

export type PublicPaymentState =
  | "AWAITING_CUSTOMER"
  | "VERIFYING"
  | "PAID"
  | "FAILED"
  | "EXPIRED"
  | "CANCELLED";

const PUBLIC_PAYMENT_MESSAGES: Record<PublicPaymentState, string> = {
  AWAITING_CUSTOMER: "Payment is awaiting customer action.",
  VERIFYING: "Payment is being verified.",
  PAID: "Payment has been verified.",
  FAILED: "Payment could not be verified.",
  EXPIRED: "Payment request has expired.",
  CANCELLED: "Payment request was cancelled.",
};

function publicState(status: PaymentRequestStatus): PublicPaymentState {
  if (status === "CREATED" || status === "AWAITING_CUSTOMER") return "AWAITING_CUSTOMER";
  if (status === "PENDING_VERIFICATION") return "VERIFYING";
  return status;
}
export function buildPublicPaymentStatus(input: PaymentOperationsInput) {
  const state = publicState(input.status);
  return {
    publicPaymentId: input.publicPaymentId,
    status: state,
    messageCode: `PAYMENT_${state}`,
    message: PUBLIC_PAYMENT_MESSAGES[state],
    retryable: state === "VERIFYING",
    amountToman: input.amountToman.toString(),
    currency: input.currency,
    purpose: input.purpose,
    expiresAt: input.expiresAt?.toISOString() ?? null,
    paidAt: state === "PAID" ? input.paidAt?.toISOString() ?? null : null,
    createdAt: input.createdAt.toISOString(),
    updatedAt: input.updatedAt.toISOString(),
  };
}

export type ReconciliationCategory =
  | "PROVIDER_RESULT_PENDING"
  | "DEFINITELY_FAILED"
  | "LATE_VERIFIED_PAYMENT"
  | "SECURITY_ANOMALY"
  | "MANUAL_REVIEW_REQUIRED";

function hasSecurityFailure(input: PaymentOperationsInput) {
  return input.attempts.some((attempt) =>
    /correlation|mismatch|replay|duplicate|ambiguous/i.test(attempt.failureReason ?? ""),
  );
}

function hasVerifiedEvidence(input: PaymentOperationsInput) {
  return input.attempts.some((attempt) => attempt.status === "VERIFIED") ||
    input.ussdPaymentIntent?.status === "VERIFIED" ||
    input.ussdPaymentIntent?.status === "SETTLED";
}

export function classifyReconciliation(input: PaymentOperationsInput): {
  category: ReconciliationCategory;
  retryable: boolean;
  operatorAction: string;
} | null {
  const lateVerified = (input.status === "EXPIRED" || input.status === "CANCELLED") && hasVerifiedEvidence(input);
  if (lateVerified) {
    return {
      category: "LATE_VERIFIED_PAYMENT",
      retryable: false,
      operatorAction: "Reconcile provider truth and choose refund, credit, or approved manual acceptance. Do not auto-fulfil.",
    };
  }
  if (hasSecurityFailure(input)) {
    return {
      category: "SECURITY_ANOMALY",
      retryable: false,
      operatorAction: "Review sanitized audit evidence and escalate before any financial state change.",
    };
  }
  if (
    input.status === "PENDING_VERIFICATION" ||
    input.attempts.some((attempt) => attempt.status === "PENDING_VERIFICATION") ||
    input.ussdPaymentIntent?.status === "VERIFYING"
  ) {
    return {
      category: "PROVIDER_RESULT_PENDING",
      retryable: true,
      operatorAction: "Keep initiation disabled if needed and continue durable provider reconciliation.",
    };
  }
  if (input.status === "FAILED" && input.attempts.some((attempt) => attempt.status === "FAILED")) {
    return {
      category: "DEFINITELY_FAILED",
      retryable: false,
      operatorAction: "Confirm the terminal evidence before communicating failure or starting a new request.",
    };
  }
  if (
    (input.status === "EXPIRED" || input.status === "CANCELLED") &&
    (input.attempts.length > 0 || input.ussdPaymentIntent)
  ) {
    return {
      category: "MANUAL_REVIEW_REQUIRED",
      retryable: false,
      operatorAction: "Confirm that no provider payment exists before closing the case.",
    };
  }
  return null;
}

export function buildOperatorReconciliationItem(input: PaymentOperationsInput) {
  const classification = classifyReconciliation(input);
  if (!classification) return null;
  return {
    publicPaymentId: input.publicPaymentId,
    amountToman: input.amountToman.toString(),
    currency: input.currency,
    purpose: input.purpose,
    requestStatus: input.status,
    category: classification.category,
    retryable: classification.retryable,
    operatorAction: classification.operatorAction,
    attemptStatuses: [...new Set(input.attempts.map((attempt) => attempt.status))],
    providerIntentStatus: input.ussdPaymentIntent?.status ?? null,
    callbackObserved: input.attempts.some((attempt) => Boolean(attempt.callbackReceivedAt)),
    verificationStarted: input.attempts.some((attempt) => Boolean(attempt.verificationStartedAt)),
    verifiedEvidenceObserved: hasVerifiedEvidence(input),
    createdAt: input.createdAt.toISOString(),
    updatedAt: input.updatedAt.toISOString(),
  };
}
