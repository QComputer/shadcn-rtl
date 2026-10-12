import type { ReservationStatus } from "@/lib/hotel/domain/types";

/**
 * Reservation state machine.
 *
 * Modelled explicitly rather than reusing `AppointmentStatus` because a hotel
 * reservation has states that a slot appointment cannot express: a timed
 * inventory hold, a payment-gated confirmation, and separate arrival/departure
 * lifecycle states. `AppointmentStatus` (PENDING / CONFIRMED / COMPLETED /
 * CANCELLED / NO_SHOW) has no HELD or payment coupling.
 *
 * Every transition carries a guard. Guards are evaluated by the service layer
 * inside the same transaction that performs the write; the guard result is the
 * single place a caller has to check for a legal transition.
 */

export type ReservationTransition =
  | "HOLD"
  | "RELEASE_HOLD"
  | "REQUEST_PAYMENT"
  | "CONFIRM"
  | "CHECK_IN"
  | "CHECK_OUT"
  | "CANCEL"
  | "MARK_NO_SHOW"
  | "EXPIRE"
  | "REFUND";

export type ReservationEvent =
  | { readonly type: "HOLD_CREATED" }
  | { readonly type: "HOLD_RELEASED" }
  | { readonly type: "PAYMENT_REQUESTED" }
  | { readonly type: "PAYMENT_VERIFIED"; readonly paymentRequestPublicId: string }
  | { readonly type: "PAYMENT_FAILED" }
  | { readonly type: "GUEST_CHECKED_IN"; readonly at: string }
  | { readonly type: "GUEST_CHECKED_OUT"; readonly at: string }
  | { readonly type: "CANCELLATION_REQUESTED"; readonly at: string; readonly refundableAmount: number }
  | { readonly type: "GUEST_ABSENT"; readonly at: string }
  | { readonly type: "HOLD_EXPIRED"; readonly at: string }
  | { readonly type: "REFUND_ISSUED"; readonly amount: number };

export type TransitionGuard =
  | { readonly allows: true; readonly reason?: undefined }
  | { readonly allows: false; readonly reason: string };

const ALLOWED: TransitionGuard = { allows: true };

function deny(reason: string): TransitionGuard {
  return { allows: false, reason };
}

/**
 * Status reached after a transition. `null` means the event does not change
 * status (for example recording a refund against a cancelled reservation).
 */
const NEXT_STATUS: Readonly<Record<ReservationTransition, ReservationStatus | null>> = {
  HOLD: "HELD",
  RELEASE_HOLD: "EXPIRED",
  REQUEST_PAYMENT: "PENDING_PAYMENT",
  CONFIRM: "CONFIRMED",
  CHECK_IN: "CHECKED_IN",
  CHECK_OUT: "CHECKED_OUT",
  CANCEL: "CANCELLED",
  MARK_NO_SHOW: "NO_SHOW",
  EXPIRE: "EXPIRED",
  REFUND: null,
};

export const RESERVATION_TRANSITIONS: readonly ReservationTransition[] = [
  "HOLD",
  "RELEASE_HOLD",
  "REQUEST_PAYMENT",
  "CONFIRM",
  "CHECK_IN",
  "CHECK_OUT",
  "CANCEL",
  "MARK_NO_SHOW",
  "EXPIRE",
  "REFUND",
];

export function nextReservationStatus(
  current: ReservationStatus,
  transition: ReservationTransition,
): ReservationStatus | null {
  return NEXT_STATUS[transition];
}

/**
 * Evaluates whether `transition` is legal from `current`.
 *
 * The important rules encoded here:
 *  - `HELD` is not reachable from a terminal state, and a hold must exist
 *    before payment can be requested.
 *  - `CONFIRM` is only reachable on a payment-verified event, so a browser
 *    redirect can never confirm a reservation on its own.
 *  - Inventory is released exactly once: from HELD or PENDING_PAYMENT only.
 */
export function guardReservationTransition(input: {
  current: ReservationStatus
  transition: ReservationTransition
  event: ReservationEvent
  now: string
}): TransitionGuard {
  const { current, transition, event, now } = input;

  const terminal: ReservationStatus[] = ["CHECKED_OUT", "CANCELLED", "EXPIRED", "NO_SHOW", "REFUNDED"];
  // A refund is a settlement against an already-finished reservation, not a
  // lifecycle transition, so it stays legal from the terminal states that
  // actually owe money. `REFUNDED` itself is excluded, which makes a replayed
  // refund a no-op instead of a second payout.
  const refundableTerminal: ReservationStatus[] = ["CANCELLED", "NO_SHOW"];

  if (
    terminal.includes(current) &&
    !(transition === "REFUND" && refundableTerminal.includes(current))
  ) {
    return deny(`RESERVATION_IS_TERMINAL:${current}`);
  }

  switch (transition) {
    case "HOLD":
      return current === "EXPIRED" ? deny("EXPIRED_RESERVATION_CANNOT_BE_HELD") : ALLOWED;

    case "REQUEST_PAYMENT":
      if (current !== "HELD") return deny("PAYMENT_REQUIRES_ACTIVE_HOLD");
      if (event.type !== "PAYMENT_REQUESTED") return deny("EVENT_DOES_NOT_MATCH_TRANSITION");
      return ALLOWED;

    case "CONFIRM": {
      if (current !== "PENDING_PAYMENT") return deny("CONFIRMATION_REQUIRES_PAYMENT_PENDING_RESERVATION");
      // Authoritative, server-verified settlement only. A redirect event is
      // intentionally not accepted here.
      if (event.type !== "PAYMENT_VERIFIED" || !event.paymentRequestPublicId) {
        return deny("CONFIRMATION_REQUIRES_SERVER_VERIFIED_PAYMENT");
      }
      return ALLOWED;
    }

    case "CHECK_IN":
      if (current !== "CONFIRMED") return deny("CHECK_IN_REQUIRES_CONFIRMED_RESERVATION");
      if (event.type !== "GUEST_CHECKED_IN") return deny("EVENT_DOES_NOT_MATCH_TRANSITION");
      return ALLOWED;

    case "CHECK_OUT":
      if (current !== "CHECKED_IN") return deny("CHECK_OUT_REQUIRES_ACTIVE_STAY");
      if (event.type !== "GUEST_CHECKED_OUT") return deny("EVENT_DOES_NOT_MATCH_TRANSITION");
      return ALLOWED;

    case "MARK_NO_SHOW":
      if (current !== "CONFIRMED") return deny("NO_SHOW_REQUIRES_CONFIRMED_RESERVATION");
      if (event.type !== "GUEST_ABSENT") return deny("EVENT_DOES_NOT_MATCH_TRANSITION");
      return ALLOWED;

    case "CANCEL": {
      if (current === "CHECKED_IN") return deny("ACTIVE_STAY_CANNOT_BE_CANCELLED");
      if (!["HELD", "PENDING_PAYMENT", "CONFIRMED"].includes(current)) {
        return deny("CANCELLATION_NOT_PERMITTED_FOR_STATE");
      }
      if (event.type !== "CANCELLATION_REQUESTED") return deny("EVENT_DOES_NOT_MATCH_TRANSITION");
      if (Date.parse(event.at) > Date.parse(now)) return deny("CANCELLATION_TIMESTAMP_IN_FUTURE");
      return ALLOWED;
    }

    case "EXPIRE":
      // Holds and payment-pending reservations lapse; confirmed stays do not.
      if (current !== "HELD" && current !== "PENDING_PAYMENT") {
        return deny("EXPIRY_ONLY_APPLIES_TO_HELD_OR_PENDING_PAYMENT");
      }
      if (event.type !== "HOLD_EXPIRED" || Date.parse(event.at) <= Date.parse(now)) {
        return deny("EXPIRY_REQUIRES_DUE_HOLD");
      }
      return ALLOWED;

    case "RELEASE_HOLD":
      if (current !== "HELD") return deny("NO_ACTIVE_HOLD_TO_RELEASE");
      if (event.type !== "HOLD_RELEASED") return deny("EVENT_DOES_NOT_MATCH_TRANSITION");
      return ALLOWED;

    case "REFUND":
      if (!refundableTerminal.includes(current)) {
        return deny("REFUND_REQUIRES_CANCELLED_OR_NO_SHOW_RESERVATION");
      }
      if (event.type !== "REFUND_ISSUED") return deny("EVENT_DOES_NOT_MATCH_TRANSITION");
      return ALLOWED;

    default:
      return deny("UNKNOWN_TRANSITION");
  }
}

export type ReservationTransitionDecision =
  | { readonly isAllowed: true; readonly nextStatus: ReservationStatus | null; readonly reason?: undefined }
  | { readonly isAllowed: false; readonly reason: string; readonly nextStatus?: undefined };

export function decideReservationTransition(input: {
  current: ReservationStatus
  transition: ReservationTransition
  event: ReservationEvent
  now: string
}): ReservationTransitionDecision {
  const guard = guardReservationTransition(input);
  if (!guard.allows) return { isAllowed: false, reason: guard.reason };
  return {
    isAllowed: true,
    nextStatus: nextReservationStatus(input.current, input.transition),
  };
}

/** Statuses from which no further transition is possible. */
export function isTerminalReservationStatus(status: ReservationStatus): boolean {
  return ["CHECKED_OUT", "CANCELLED", "EXPIRED", "NO_SHOW", "REFUNDED"].includes(status);
}

/** Statuses for which room inventory is currently committed and must be held. */
export function holdsInventory(status: ReservationStatus): boolean {
  return ["HELD", "PENDING_PAYMENT", "CONFIRMED", "CHECKED_IN"].includes(status);
}