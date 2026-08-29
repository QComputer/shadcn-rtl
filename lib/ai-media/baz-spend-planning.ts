import type { AiMediaJobMirrorState } from "@/lib/ai-media/job-mirror";

export type BazSpendPlanAction =
  | "NONE"
  | "CREATE_HOLD"
  | "KEEP_HOLD"
  | "REVIEW_HOLD"
  | "SETTLE_HOLD"
  | "RELEASE_OR_REFUND_HOLD";

export type BazQuoteLifecycleState = "NO_QUOTE" | "QUOTE_AVAILABLE" | "QUOTE_EXPIRED" | "QUOTE_REJECTED";

export type BazSpendPlanningInput = {
  mirrorState: AiMediaJobMirrorState;
  quoteState?: BazQuoteLifecycleState;
  quoteAccepted?: boolean;
  hasActiveHold?: boolean;
  retryPolicy?: "KEEP" | "REVIEW";
};

export type BazSpendPlan = {
  action: BazSpendPlanAction;
  settlementEligible: boolean;
  ledgerMutationAllowed: false;
  internalCreditOnly: true;
  reason: string;
};

export function planBazQuoteLifecycle(input: { quoteAccepted?: boolean; quoteExpired?: boolean }): BazQuoteLifecycleState {
  if (input.quoteExpired) return "QUOTE_EXPIRED";
  if (input.quoteAccepted === false) return "QUOTE_REJECTED";
  if (input.quoteAccepted === true) return "QUOTE_AVAILABLE";
  return "NO_QUOTE";
}

export function planBazSpendHoldLifecycle(input: BazSpendPlanningInput): BazSpendPlan {
  const hasActiveHold = input.hasActiveHold === true;

  if (input.quoteAccepted === true && !hasActiveHold && (input.mirrorState === "QUOTED" || input.mirrorState === "HOLD_PENDING")) {
    return plan("CREATE_HOLD", false, "quote accepted before provider submission");
  }

  switch (input.mirrorState) {
    case "QUEUED":
    case "CLAIMED":
    case "PROCESSING":
    case "IMPORT_PENDING":
    case "SUBMITTED_TO_RENDER":
    case "READY_TO_SUBMIT":
      return hasActiveHold ? plan("KEEP_HOLD", false, "request is not imported yet") : plan("NONE", false, "no active hold");
    case "RESULT_READY":
      return hasActiveHold ? plan("KEEP_HOLD", false, "provider result is not accepted import") : plan("NONE", false, "result is not imported");
    case "FAILED_RETRYABLE":
      return hasActiveHold
        ? plan(input.retryPolicy === "REVIEW" ? "REVIEW_HOLD" : "KEEP_HOLD", false, "retryable failure is not final")
        : plan("NONE", false, "no active hold");
    case "IMPORTED":
      return hasActiveHold ? plan("SETTLE_HOLD", true, "accepted Bazarbaaz import") : plan("NONE", false, "no active hold to settle");
    case "FAILED_FINAL":
    case "CANCELLED":
    case "EXPIRED":
    case "REFUNDED":
      return hasActiveHold ? plan("RELEASE_OR_REFUND_HOLD", false, "terminal non-imported state") : plan("NONE", false, "no active hold");
    default:
      return plan("NONE", false, "not eligible for spend action");
  }
}

export function planBazRefundOrRelease(input: BazSpendPlanningInput): BazSpendPlan {
  if (input.hasActiveHold === true && ["FAILED_FINAL", "CANCELLED", "EXPIRED", "REFUNDED"].includes(input.mirrorState)) {
    return plan("RELEASE_OR_REFUND_HOLD", false, "terminal state releases internal credit hold");
  }
  return plan("NONE", false, "refund or release not eligible");
}

export function planBazSettlementEligibility(input: BazSpendPlanningInput): BazSpendPlan {
  if (input.mirrorState === "IMPORTED" && input.hasActiveHold === true) {
    return plan("SETTLE_HOLD", true, "settlement allowed only after accepted import");
  }
  return plan("NONE", false, "not an accepted import");
}

function plan(action: BazSpendPlanAction, settlementEligible: boolean, reason: string): BazSpendPlan {
  return {
    action,
    settlementEligible,
    ledgerMutationAllowed: false,
    internalCreditOnly: true,
    reason,
  };
}
