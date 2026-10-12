import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  decideReservationTransition,
  guardReservationTransition,
  holdsInventory,
  isTerminalReservationStatus,
  nextReservationStatus,
  RESERVATION_TRANSITIONS,
  type ReservationEvent,
  type ReservationTransition,
} from "../../../lib/hotel/domain/booking-state";
import type { ReservationStatus } from "../../../lib/hotel/domain/types";

const NOW = "2026-03-20T10:00:00.000Z";

function decide(
  current: ReservationStatus,
  transition: ReservationTransition,
  event: ReservationEvent,
) {
  return decideReservationTransition({ current, transition, event, now: NOW });
}

describe("reservation state machine", () => {
  it("exposes a stable transition list", () => {
    assert.deepEqual([...RESERVATION_TRANSITIONS].sort(), [
      "CANCEL",
      "CHECK_IN",
      "CHECK_OUT",
      "CONFIRM",
      "EXPIRE",
      "HOLD",
      "MARK_NO_SHOW",
      "REFUND",
      "RELEASE_HOLD",
      "REQUEST_PAYMENT",
    ]);
  });

  it("maps transitions to statuses", () => {
    assert.equal(nextReservationStatus("HELD", "REQUEST_PAYMENT"), "PENDING_PAYMENT");
    assert.equal(nextReservationStatus("CONFIRMED", "CHECK_OUT"), "CHECKED_OUT");
    assert.equal(nextReservationStatus("CANCELLED", "REFUND"), null);
  });

  it("requires a hold before payment can be requested", () => {
    const denied = decide("CONFIRMED", "REQUEST_PAYMENT", { type: "PAYMENT_REQUESTED" });
    assert.equal(denied.isAllowed, false);
    assert.equal(!denied.isAllowed && denied.reason, "PAYMENT_REQUIRES_ACTIVE_HOLD");
  });

  it("only confirms on a server-verified payment event", () => {
    const verified = decide("PENDING_PAYMENT", "CONFIRM", {
      type: "PAYMENT_VERIFIED",
      paymentRequestPublicId: "prp_123",
    });
    assert.equal(verified.isAllowed, true);
    assert.equal(verified.isAllowed && verified.nextStatus, "CONFIRMED");
  });

  it("refuses confirmation driven by anything other than verified payment", () => {
    // This is the redirect-trust assertion: a browser cannot self-confirm.
    const spoofed = decide("PENDING_PAYMENT", "CONFIRM", { type: "PAYMENT_REQUESTED" });
    assert.equal(spoofed.isAllowed, false);
    assert.equal(!spoofed.isAllowed && spoofed.reason, "CONFIRMATION_REQUIRES_SERVER_VERIFIED_PAYMENT");

    const paymentFailed = decide("PENDING_PAYMENT", "CONFIRM", { type: "PAYMENT_FAILED" });
    assert.equal(paymentFailed.isAllowed, false);
  });

  it("guards the arrival lifecycle", () => {
    assert.equal(decide("PENDING_PAYMENT", "CHECK_IN", { type: "GUEST_CHECKED_IN", at: NOW }).isAllowed, false);
    assert.equal(decide("CONFIRMED", "CHECK_IN", { type: "GUEST_CHECKED_IN", at: NOW }).isAllowed, true);
    assert.equal(decide("CONFIRMED", "CHECK_OUT", { type: "GUEST_CHECKED_OUT", at: NOW }).isAllowed, false);
    assert.equal(decide("CHECKED_IN", "CHECK_OUT", { type: "GUEST_CHECKED_OUT", at: NOW }).isAllowed, true);
  });

  it("prevents cancelling a stay already in progress", () => {
    const result = decide("CHECKED_IN", "CANCEL", {
      type: "CANCELLATION_REQUESTED",
      at: NOW,
      refundableAmount: 0,
    });
    assert.equal(!result.isAllowed && result.reason, "ACTIVE_STAY_CANNOT_BE_CANCELLED");
  });

  it("rejects a cancellation timestamped in the future", () => {
    const result = decide("CONFIRMED", "CANCEL", {
      type: "CANCELLATION_REQUESTED",
      at: "2026-03-25T10:00:00.000Z",
      refundableAmount: 0,
    });
    assert.equal(!result.isAllowed && result.reason, "CANCELLATION_TIMESTAMP_IN_FUTURE");
  });

  it("allows cancellation from held, pending and confirmed", () => {
    for (const status of ["HELD", "PENDING_PAYMENT", "CONFIRMED"] as ReservationStatus[]) {
      const result = decide(status, "CANCEL", {
        type: "CANCELLATION_REQUESTED",
        at: "2026-03-19T10:00:00.000Z",
        refundableAmount: 0,
      });
      assert.equal(result.isAllowed, true, status);
    }
  });

  it("only expires a hold that is actually due", () => {
    const due = decide("HELD", "EXPIRE", { type: "HOLD_EXPIRED", at: "2026-03-20T10:05:00.000Z" });
    assert.equal(due.isAllowed, true);

    const notDue = decide("HELD", "EXPIRE", { type: "HOLD_EXPIRED", at: "2026-03-20T09:00:00.000Z" });
    assert.equal(!notDue.isAllowed && notDue.reason, "EXPIRY_REQUIRES_DUE_HOLD");

    const confirmed = decide("CONFIRMED", "EXPIRE", { type: "HOLD_EXPIRED", at: "2026-03-20T10:05:00.000Z" });
    assert.equal(!confirmed.isAllowed && confirmed.reason, "EXPIRY_ONLY_APPLIES_TO_HELD_OR_PENDING_PAYMENT");
  });

  it("releases a hold only while one is active", () => {
    assert.equal(decide("HELD", "RELEASE_HOLD", { type: "HOLD_RELEASED" }).isAllowed, true);

    const confirmed = decide("CONFIRMED", "RELEASE_HOLD", { type: "HOLD_RELEASED" });
    assert.equal(!confirmed.isAllowed && confirmed.reason, "NO_ACTIVE_HOLD_TO_RELEASE");
  });

  it("refunds only a cancelled or no-show reservation", () => {
    assert.equal(decide("CANCELLED", "REFUND", { type: "REFUND_ISSUED", amount: 500 }).isAllowed, true);
    assert.equal(decide("NO_SHOW", "REFUND", { type: "REFUND_ISSUED", amount: 500 }).isAllowed, true);
    assert.equal(decide("CONFIRMED", "REFUND", { type: "REFUND_ISSUED", amount: 500 }).isAllowed, false);
  });

  it("freezes terminal statuses", () => {
    for (const status of ["CHECKED_OUT", "CANCELLED", "EXPIRED", "NO_SHOW", "REFUNDED"] as ReservationStatus[]) {
      assert.equal(isTerminalReservationStatus(status), true, status);
      const result = decide(status, "CHECK_IN", { type: "GUEST_CHECKED_IN", at: NOW });
      assert.equal(!result.isAllowed && result.reason, `RESERVATION_IS_TERMINAL:${status}`);
    }
  });

  it("treats REFUNDED as terminal and refuses a replayed refund", () => {
    assert.equal(isTerminalReservationStatus("REFUNDED"), true);
    const replay = guardReservationTransition({
      current: "REFUNDED",
      transition: "REFUND",
      event: { type: "REFUND_ISSUED", amount: 500 },
      now: NOW,
    });
    assert.equal(replay.allows, false);
  });

  it("marks no-show only from a confirmed reservation", () => {
    assert.equal(decide("CONFIRMED", "MARK_NO_SHOW", { type: "GUEST_ABSENT", at: NOW }).isAllowed, true);
    assert.equal(decide("PENDING_PAYMENT", "MARK_NO_SHOW", { type: "GUEST_ABSENT", at: NOW }).isAllowed, false);
  });

  it("holds inventory exactly for the committed statuses", () => {
    assert.equal(holdsInventory("HELD"), true);
    assert.equal(holdsInventory("PENDING_PAYMENT"), true);
    assert.equal(holdsInventory("CONFIRMED"), true);
    assert.equal(holdsInventory("CHECKED_IN"), true);
    assert.equal(holdsInventory("CANCELLED"), false);
    assert.equal(holdsInventory("EXPIRED"), false);
  });

  it("rejects an event that does not match the requested transition", () => {
    const result = decide("CONFIRMED", "CHECK_IN", { type: "GUEST_CHECKED_OUT", at: NOW });
    assert.equal(!result.isAllowed && result.reason, "EVENT_DOES_NOT_MATCH_TRANSITION");
  });
});