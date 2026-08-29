import type { PaymentProviderAttemptStatus, PaymentRequestStatus } from "@prisma/client";

const REQUEST_TRANSITIONS: Record<PaymentRequestStatus, readonly PaymentRequestStatus[]> = {
  CREATED: ["AWAITING_CUSTOMER", "CANCELLED", "EXPIRED"],
  AWAITING_CUSTOMER: ["PENDING_VERIFICATION", "CANCELLED", "EXPIRED"],
  PENDING_VERIFICATION: ["PAID", "FAILED", "CANCELLED", "EXPIRED"],
  PAID: [],
  FAILED: [],
  EXPIRED: [],
  CANCELLED: [],
};

const ATTEMPT_TRANSITIONS: Record<PaymentProviderAttemptStatus, readonly PaymentProviderAttemptStatus[]> = {
  CREATED: ["AWAITING_CUSTOMER", "PENDING_VERIFICATION", "FAILED", "EXPIRED", "CANCELLED"],
  AWAITING_CUSTOMER: ["PENDING_VERIFICATION", "FAILED", "EXPIRED", "CANCELLED"],
  PENDING_VERIFICATION: ["VERIFIED", "FAILED", "EXPIRED", "CANCELLED"],
  VERIFIED: [],
  FAILED: [],
  EXPIRED: [],
  CANCELLED: [],
};

export function canTransitionPaymentRequest(from: PaymentRequestStatus, to: PaymentRequestStatus) {
  return from === to || REQUEST_TRANSITIONS[from].includes(to);
}

export function canTransitionPaymentAttempt(from: PaymentProviderAttemptStatus, to: PaymentProviderAttemptStatus) {
  return from === to || ATTEMPT_TRANSITIONS[from].includes(to);
}
