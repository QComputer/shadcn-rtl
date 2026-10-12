import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { quoteCancellation } from "../../../lib/hotel/domain/rate";
import { parseClockTime, resolvePropertyInstant } from "../../../lib/hotel/domain/stay-dates";
import type {
  CancellationPolicySet,
  ReservationCancellationPolicySnapshot,
} from "../../../lib/hotel/domain/types";

/**
 * Check-in is 14:00 property-local on the arrival date. Built through the
 * local-time helper so the tests exercise the same path production will use
 * rather than hard-coding a UTC instant.
 */
const CHECK_IN_DATE = "2026-04-01";
const CHECK_IN_TIME = "14:00";
const TIME_ZONE = "Asia/Tehran"; // UTC+03:30, no DST

const checkInAt = resolvePropertyInstant({
  date: CHECK_IN_DATE,
  time: CHECK_IN_TIME,
  timeZone: TIME_ZONE,
}) as Date;

function policySet(input: {
  key?: string;
  freeCancellationCutoffHours?: number;
  fullCancellationRetention?: number;
  cancellationTiers?: CancellationPolicySet["cancellationTiers"];
}): CancellationPolicySet {
  return {
    key: input.key ?? "flexible",
    name: "Flexible",
    freeCancellationCutoffHours: input.freeCancellationCutoffHours ?? 48,
    fullCancellationRetention: input.fullCancellationRetention ?? 0,
    description: "",
    cancellationTiers: input.cancellationTiers,
  };
}

function snapshot(input: Parameters<typeof policySet>[0]): ReservationCancellationPolicySnapshot {
  return {
    ...policySet(input),
    organizationId: "org_hotel",
    policyVersion: 3,
    capturedAt: "2026-03-01T00:00:00.000Z",
  };
}

const TOTAL = 8_000_000;

function hoursBeforeCheckIn(hours: number): Date {
  return new Date(checkInAt.getTime() - hours * 3_600_000);
}

describe("property-local check-in resolution", () => {
  it("parses a valid clock time and rejects nonsense", () => {
    assert.deepEqual(parseClockTime("14:00"), { hour: 14, minute: 0 });
    assert.deepEqual(parseClockTime("9:05"), { hour: 9, minute: 5 });
    assert.equal(parseClockTime("24:00"), null);
    assert.equal(parseClockTime("14:70"), null);
    assert.equal(parseClockTime("nonsense"), null);
  });

  it("resolves local check-in to the correct absolute instant", () => {
    // Asia/Tehran is UTC+03:30, so 14:00 local is 10:30 UTC.
    assert.equal(checkInAt.toISOString(), "2026-04-01T10:30:00.000Z");
  });

  it("returns null for an unresolvable date or time", () => {
    assert.equal(resolvePropertyInstant({ date: "2026-02-30", time: "14:00", timeZone: TIME_ZONE }), null);
    assert.equal(resolvePropertyInstant({ date: CHECK_IN_DATE, time: "99:99", timeZone: TIME_ZONE }), null);
  });
});

describe("cancellation quoting — full refund", () => {
  it("refunds in full outside the cutoff", () => {
    const quote = quoteCancellation({
      totalAmount: TOTAL,
      cancelledAt: hoursBeforeCheckIn(72),
      checkInAt,
      policy: snapshot({ freeCancellationCutoffHours: 48 }),
    });
    assert.equal(quote.isFreeCancellation, true);
    assert.equal(quote.reason, "FREE_CANCELLATION");
    assert.equal(quote.refundableAmount, TOTAL);
    assert.equal(quote.retainedAmount, 0);
  });

  it("treats the exact cutoff instant as still free", () => {
    const quote = quoteCancellation({
      totalAmount: TOTAL,
      cancelledAt: hoursBeforeCheckIn(48),
      checkInAt,
      policy: snapshot({ freeCancellationCutoffHours: 48 }),
    });
    assert.equal(quote.isFreeCancellation, true);
    assert.equal(quote.refundableAmount, TOTAL);
  });

  it("applies the penalty one second past the cutoff", () => {
    const quote = quoteCancellation({
      totalAmount: TOTAL,
      cancelledAt: new Date(hoursBeforeCheckIn(48).getTime() + 1000),
      checkInAt,
      policy: snapshot({ freeCancellationCutoffHours: 48, fullCancellationRetention: 0.5 }),
    });
    assert.equal(quote.isFreeCancellation, false);
    assert.equal(quote.reason, "PARTIAL_RETENTION");
  });
});

describe("cancellation quoting — multi-tier policies", () => {
  it("selects an ordered first-night penalty tier", () => {
    const quote = quoteCancellation({
      totalAmount: 3_000_000,
      firstNightAmount: 1_000_000,
      cancelledAt: new Date("2026-06-08T00:00:00Z"),
      checkInAt: new Date("2026-06-10T00:00:00Z"),
      policy: policySet({
        freeCancellationCutoffHours: 72,
        cancellationTiers: [
          { cutoffHours: 72, retentionBasisPoints: 5000, penaltyBasis: "FIRST_NIGHT" },
          { cutoffHours: 24, retentionBasisPoints: 10000, penaltyBasis: "RESERVATION_TOTAL" },
        ],
      }),
    });
    assert.equal(quote.retainedAmount, 500_000);
    assert.equal(quote.refundableAmount, 2_500_000);
  });
});

describe("cancellation quoting — partial refund", () => {
  it("retains the configured fraction inside the penalty window", () => {
    const quote = quoteCancellation({
      totalAmount: TOTAL,
      cancelledAt: hoursBeforeCheckIn(12),
      checkInAt,
      policy: snapshot({ freeCancellationCutoffHours: 48, fullCancellationRetention: 0.5 }),
    });
    assert.equal(quote.retainedAmount, 4_000_000);
    assert.equal(quote.refundableAmount, 4_000_000);
  });

  it("keeps a third-of-a-stay retention integral and balanced", () => {
    const quote = quoteCancellation({
      totalAmount: TOTAL,
      cancelledAt: hoursBeforeCheckIn(12),
      checkInAt,
      policy: snapshot({ freeCancellationCutoffHours: 48, fullCancellationRetention: 1 / 3 }),
    });
    assert.equal(Number.isInteger(quote.retainedAmount), true);
    assert.equal(quote.retainedAmount + quote.refundableAmount, TOTAL);
  });

  it("never produces a negative or over-sized refund", () => {
    for (const retention of [0, 0.25, 0.5, 0.75, 0.999, 1]) {
      const quote = quoteCancellation({
        totalAmount: TOTAL,
        cancelledAt: hoursBeforeCheckIn(12),
        checkInAt,
        policy: snapshot({ freeCancellationCutoffHours: 48, fullCancellationRetention: retention }),
      });
      assert.ok(quote.refundableAmount >= 0, `negative refund at ${retention}`);
      assert.ok(quote.retainedAmount >= 0, `negative retention at ${retention}`);
      assert.equal(quote.refundableAmount + quote.retainedAmount, TOTAL, `total drift at ${retention}`);
    }
  });

  it("handles a non-positive or NaN total without producing negative money", () => {
    for (const total of [0, -500, Number.NaN]) {
      const quote = quoteCancellation({
        totalAmount: total,
        cancelledAt: hoursBeforeCheckIn(12),
        checkInAt,
        policy: snapshot({ fullCancellationRetention: 0.5 }),
      });
      assert.equal(quote.refundableAmount, 0);
      assert.equal(quote.retainedAmount, 0);
    }
  });
});

describe("cancellation quoting — non-refundable bookings", () => {
  it("retains everything inside the penalty window of a fully non-refundable rate", () => {
    const quote = quoteCancellation({
      totalAmount: TOTAL,
      cancelledAt: hoursBeforeCheckIn(1),
      checkInAt,
      policy: snapshot({ freeCancellationCutoffHours: 48, fullCancellationRetention: 1 }),
    });
    assert.equal(quote.isFreeCancellation, false);
    assert.equal(quote.reason, "NON_REFUNDABLE");
    assert.equal(quote.refundableAmount, 0);
    assert.equal(quote.retainedAmount, TOTAL);
  });

  it("still refunds outside the cutoff even for a fully non-refundable rate", () => {
    const quote = quoteCancellation({
      totalAmount: TOTAL,
      cancelledAt: hoursBeforeCheckIn(96),
      checkInAt,
      policy: snapshot({ freeCancellationCutoffHours: 48, fullCancellationRetention: 1 }),
    });
    assert.equal(quote.isFreeCancellation, true);
    assert.equal(quote.refundableAmount, TOTAL);
  });

  it("treats a zero-retention penalty window as free cancellation", () => {
    const quote = quoteCancellation({
      totalAmount: TOTAL,
      cancelledAt: hoursBeforeCheckIn(1),
      checkInAt,
      policy: snapshot({ freeCancellationCutoffHours: 48, fullCancellationRetention: 0 }),
    });
    assert.equal(quote.isFreeCancellation, true);
    assert.equal(quote.reason, "FREE_CANCELLATION");
  });
});

describe("cancellation quoting — missing or invalid policies", () => {
  it("retains the full amount when no policy is attached", () => {
    const quote = quoteCancellation({
      totalAmount: TOTAL,
      cancelledAt: hoursBeforeCheckIn(96),
      checkInAt,
      policy: null,
    });
    assert.equal(quote.isFreeCancellation, false);
    assert.equal(quote.reason, "CANCELLATION_NOT_PERMITTED");
    assert.equal(quote.refundableAmount, 0);
    assert.equal(quote.retainedAmount, TOTAL);
    assert.equal(quote.policyKey, "");
  });

  it("refuses to refund on a retention value above 1", () => {
    const quote = quoteCancellation({
      totalAmount: TOTAL,
      cancelledAt: hoursBeforeCheckIn(96),
      checkInAt,
      policy: snapshot({ fullCancellationRetention: 1.5 }),
    });
    assert.equal(quote.reason, "INVALID_POLICY");
    assert.equal(quote.refundableAmount, 0);
    assert.equal(quote.retainedAmount, TOTAL);
  });

  it("refuses to refund on a negative retention or negative cutoff", () => {
    for (const broken of [
      { fullCancellationRetention: -0.2, freeCancellationCutoffHours: 48 },
      { fullCancellationRetention: 0.5, freeCancellationCutoffHours: -1 },
    ]) {
      const quote = quoteCancellation({
        totalAmount: TOTAL,
        cancelledAt: hoursBeforeCheckIn(96),
        checkInAt,
        policy: snapshot(broken),
      });
      assert.equal(quote.reason, "INVALID_POLICY");
      assert.equal(quote.refundableAmount, 0);
    }
  });

  it("refuses to refund on a NaN policy value", () => {
    const quote = quoteCancellation({
      totalAmount: TOTAL,
      cancelledAt: hoursBeforeCheckIn(96),
      checkInAt,
      policy: snapshot({ fullCancellationRetention: Number.NaN }),
    });
    assert.equal(quote.reason, "INVALID_POLICY");
    assert.equal(quote.refundableAmount, 0);
  });

  it("refuses to refund on a policy with no key", () => {
    const quote = quoteCancellation({
      totalAmount: TOTAL,
      cancelledAt: hoursBeforeCheckIn(96),
      checkInAt,
      policy: { ...policySet({}), key: "" },
    });
    assert.equal(quote.reason, "INVALID_POLICY");
    assert.equal(quote.refundableAmount, 0);
  });
});

describe("cancellation quoting — policy attribution and snapshot immutability", () => {
  it("returns the key of the policy actually used", () => {
    const quote = quoteCancellation({
      totalAmount: TOTAL,
      cancelledAt: hoursBeforeCheckIn(12),
      checkInAt,
      policy: snapshot({ key: "advance-purchase-50", fullCancellationRetention: 0.5 }),
    });
    assert.equal(quote.policyKey, "advance-purchase-50");
  });

  it("is unaffected by a later edit to the hotel's live policy", () => {
    // What the guest agreed to at booking time.
    const agreedAtBooking = snapshot({
      key: "flexible",
      freeCancellationCutoffHours: 48,
      fullCancellationRetention: 0,
    });

    // The hotel later changes its live terms to a non-refundable policy with a
    // 72-hour cutoff.
    const livePolicyAfterwards: CancellationPolicySet = {
      ...agreedAtBooking,
      freeCancellationCutoffHours: 72,
      fullCancellationRetention: 1,
    };

    // Quoting must use the reservation snapshot, so the guest keeps the terms
    // they were shown.
    const quote = quoteCancellation({
      totalAmount: TOTAL,
      cancelledAt: hoursBeforeCheckIn(36),
      checkInAt,
      policy: agreedAtBooking,
    });
    assert.equal(quote.isFreeCancellation, true);
    assert.equal(quote.retainedAmount, 0);

    // Proof the changed policy would have produced a different, unfair result.
    const unfair = quoteCancellation({
      totalAmount: TOTAL,
      cancelledAt: hoursBeforeCheckIn(36),
      checkInAt,
      policy: livePolicyAfterwards,
    });
    assert.equal(unfair.isFreeCancellation, false);
    assert.equal(unfair.refundableAmount, 0);
  });

  it("carries the snapshot version for audit", () => {
    const policy = snapshot({ key: "flexible" });
    assert.equal(policy.policyVersion, 3);
    assert.equal(policy.organizationId, "org_hotel");
    assert.equal(policy.capturedAt, "2026-03-01T00:00:00.000Z");
  });
});

describe("cancellation deadline across hotel-local day boundaries", () => {
  it("applies the cutoff against local check-in, not local midnight", () => {
    // Local midnight on 2026-04-01 in Tehran is 2026-03-31T20:30Z. This
    // cancellation is 2026-04-01 01:30 LOCAL (i.e. already the arrival day)
    // yet still 12.5 hours before the 14:00 local check-in. Computing the
    // deadline from the local calendar date instead of the local clock time
    // would wrongly call this "on the day, no refund".
    const cancelledAt = new Date("2026-03-31T22:00:00.000Z");
    const hours = (checkInAt.getTime() - cancelledAt.getTime()) / 3_600_000;
    assert.equal(hours, 12.5);

    const quote = quoteCancellation({
      totalAmount: TOTAL,
      cancelledAt,
      checkInAt,
      policy: snapshot({ freeCancellationCutoffHours: 24, fullCancellationRetention: 0.5 }),
    });
    assert.equal(quote.isFreeCancellation, false);
    assert.equal(quote.reason, "PARTIAL_RETENTION");
  });

  it("stays correct for a property well ahead of UTC", () => {
    // New Zealand is UTC+13 in April (daylight time), so 14:00 local on
    // 2026-04-01 is 01:00 UTC on the SAME date.
    const nzCheckIn = resolvePropertyInstant({
      date: CHECK_IN_DATE,
      time: CHECK_IN_TIME,
      timeZone: "Pacific/Auckland",
    }) as Date;
    assert.equal(nzCheckIn.toISOString(), "2026-04-01T01:00:00.000Z");

    const quote = quoteCancellation({
      totalAmount: TOTAL,
      cancelledAt: new Date(nzCheckIn.getTime() - 72 * 3_600_000),
      checkInAt: nzCheckIn,
      policy: snapshot({ freeCancellationCutoffHours: 48 }),
    });
    assert.equal(quote.isFreeCancellation, true);
  });

  it("stays correct for a property behind UTC", () => {
    const usCheckIn = resolvePropertyInstant({
      date: CHECK_IN_DATE,
      time: CHECK_IN_TIME,
      timeZone: "America/Los_Angeles",
    }) as Date;
    // PDT is UTC-7 in April, so 14:00 local is 21:00 UTC.
    assert.equal(usCheckIn.toISOString(), "2026-04-01T21:00:00.000Z");

    const quote = quoteCancellation({
      totalAmount: TOTAL,
      cancelledAt: new Date(usCheckIn.getTime() - 72 * 3_600_000),
      checkInAt: usCheckIn,
      policy: snapshot({ freeCancellationCutoffHours: 48 }),
    });
    assert.equal(quote.isFreeCancellation, true);
  });

  it("does not drift by a day across a month boundary", () => {
    const monthEndCheckIn = resolvePropertyInstant({
      date: "2026-04-30",
      time: CHECK_IN_TIME,
      timeZone: TIME_ZONE,
    }) as Date;
    assert.equal(monthEndCheckIn.toISOString(), "2026-04-30T10:30:00.000Z");

    const quote = quoteCancellation({
      totalAmount: TOTAL,
      cancelledAt: new Date(monthEndCheckIn.getTime() - 48 * 3_600_000),
      checkInAt: monthEndCheckIn,
      policy: snapshot({ freeCancellationCutoffHours: 48 }),
    });
    assert.equal(quote.isFreeCancellation, true);
  });
});

describe("daylight-saving transitions in an IANA zone", () => {
  // The offset is resolved for the specific calendar date, not cached per
  // property, so a stay spanning a transition keeps a correct local check-in
  // on each side of it.
  const NEW_YORK = "America/New_York";

  it("resolves to EST before the spring-forward transition", () => {
    // EST is UTC-5 in March 2026; DST begins 2026-03-08.
    const before = resolvePropertyInstant({
      date: "2026-03-01",
      time: CHECK_IN_TIME,
      timeZone: NEW_YORK,
    }) as Date;
    assert.equal(before.toISOString(), "2026-03-01T19:00:00.000Z");
  });

  it("resolves to EDT after the spring-forward transition", () => {
    // EDT is UTC-4, so the same 14:00 local wall clock is one hour earlier in
    // UTC. The LOCAL time is identical on both dates by design.
    const after = resolvePropertyInstant({
      date: "2026-03-15",
      time: CHECK_IN_TIME,
      timeZone: NEW_YORK,
    }) as Date;
    assert.equal(after.toISOString(), "2026-03-15T18:00:00.000Z");
  });

  it("handles the 02:00-03:00 gap hour that does not exist locally", () => {
    // On 2026-03-08 in New York the local clock jumps 02:00 -> 03:00. Asking
    // for 02:30 has no exact local instant; resolution must still produce a
    // deterministic instant rather than NaN or an exception.
    const gap = resolvePropertyInstant({
      date: "2026-03-08",
      time: "02:30",
      timeZone: NEW_YORK,
    });
    assert.notEqual(gap, null);
    assert.equal(Number.isNaN(gap?.getTime()), false);
  });

  it("keeps the cutoff in local terms across the transition", () => {
    const checkInAfterTransition = resolvePropertyInstant({
      date: "2026-03-15",
      time: CHECK_IN_TIME,
      timeZone: NEW_YORK,
    }) as Date;

    // 48 hours earlier is still exactly on the cutoff, because the deadline
    // is an absolute duration measured against a correctly resolved local
    // check-in instant.
    const quote = quoteCancellation({
      totalAmount: TOTAL,
      cancelledAt: new Date(checkInAfterTransition.getTime() - 48 * 3_600_000),
      checkInAt: checkInAfterTransition,
      policy: snapshot({ freeCancellationCutoffHours: 48 }),
    });
    assert.equal(quote.isFreeCancellation, true);
  });
});
