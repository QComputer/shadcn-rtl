import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { InMemoryHotelRepositories } from "../../../lib/hotel/persistence/in-memory-hotel-repositories";
import type { PersistedInventoryNight } from "../../../lib/hotel/persistence/hotel-repositories";
import {
  cancelReservation,
  confirmBookingHold,
  createBookingHold,
  expireOverdueHolds,
  reconcileVerifiedPayment,
} from "../../../lib/hotel/services/hotel-booking.service";
import type {
  HotelProperty,
  ReservationCancellationPolicySnapshot,
  RoomType,
} from "../../../lib/hotel/domain/types";

/**
 * IMPORTANT: these tests run against an in-memory double whose mutations are
 * serialized by a single queue. They prove DOMAIN behaviour â€” inventory
 * accounting, state-machine wiring, idempotency, tenant isolation â€” but they
 * do NOT prove PostgreSQL concurrency safety. Real double-booking verification
 * (N concurrent transactions against 1 room) requires the H3 migration
 * milestone against an isolated test database.
 */

const ORG = "org_hotel";
const OTHER_ORG = "org_other";
const PROPERTY_ID = "prop_damoon";
const ROOM_TYPE_ID = "rt_deluxe";
const RATE_PLAN_ID = "rp_flex";
const NIGHTS = ["2026-04-10", "2026-04-11", "2026-04-12"];
/** Checkout is exclusive, so a 3-night stay checks out on 2026-04-13. */
const CHECK_OUT = "2026-04-13";

const property: HotelProperty = {
  id: PROPERTY_ID,
  organizationId: ORG,
  slug: "damoon-hotel",
  name: "Damoon (synthetic)",
  timezone: "Asia/Tehran",
  currency: "TOMAN",
  checkInTime: "14:00",
  checkOutTime: "11:00",
  minStayNights: 1,
  maxStayNights: 30,
  policies: {
    key: "flexible",
    name: "Flexible",
    freeCancellationCutoffHours: 48,
    fullCancellationRetention: 0.5,
    description: "",
  },
};

const roomType: RoomType = {
  id: ROOM_TYPE_ID,
  propertyId: PROPERTY_ID,
  slug: "deluxe",
  name: "Deluxe (synthetic)",
  capacity: { maxAdults: 2, maxChildren: 2, maxOccupancy: 4 },
  beds: [{ kind: "queen", count: 1 }],
  amenities: [{ key: "wifi", label: "Wi-Fi" }],
  maxOccupancy: 4,
  isActive: true,
};

const policySnapshot: ReservationCancellationPolicySnapshot = {
  key: "flexible",
  name: "Flexible",
  freeCancellationCutoffHours: 48,
  fullCancellationRetention: 0.5,
  description: "",
  organizationId: ORG,
  policyVersion: 1,
  capturedAt: "2026-03-01T00:00:00.000Z",
};

function inventory(allotment: number, overrides: Partial<PersistedInventoryNight> = {}): PersistedInventoryNight[] {
  return NIGHTS.map((date) => ({
    propertyId: PROPERTY_ID,
    date,
    roomTypeId: ROOM_TYPE_ID,
    allotment,
    booked: 0,
    held: 0,
    outOfService: 0,
    closedToArrival: false,
    closedToDeparture: false,
    ...overrides,
  }));
}

function build(seed: { allotment: number; inventory?: PersistedInventoryNight[] } = { allotment: 1 }) {
  const repos = new InMemoryHotelRepositories({
    property,
    roomTypes: [roomType],
    ratePlans: [
      {
        id: RATE_PLAN_ID,
        propertyId: PROPERTY_ID,
        roomTypeId: ROOM_TYPE_ID,
        code: "FLEX",
        name: "Flexible",
        baseNightlyRate: 2_000_000,
        currency: "TOMAN",
        mealPlan: "none",
        minNights: 1,
        maxNights: 0,
        isRefundable: true,
        isActive: true,
      },
    ],
    inventory: seed.inventory ?? inventory(seed.allotment),
  });
  let clock = new Date("2026-03-20T10:00:00.000Z");
  const deps = {
    booking: repos,
    payments: repos,
    now: () => clock,
  };
  return { repos, deps, setNow: (d: Date) => { clock = d; }, getNow: () => clock };
}

const holdCommand = (reference: string, holdId: string) => ({
  scope: { organizationId: ORG },
  propertyId: PROPERTY_ID,
  roomTypeId: ROOM_TYPE_ID,
  ratePlanId: RATE_PLAN_ID,
  reference,
  holdId,
    query: {
      propertyId: PROPERTY_ID,
      window: { checkIn: NIGHTS[0], checkOut: CHECK_OUT },
      occupancy: { adults: 2, children: 0 },
    } as never,
});

describe("booking holds â€” inventory accounting", () => {
  it("holds every night of the stay atomically", async () => {
    const { repos, deps } = build({ allotment: 2 });
    const result = await createBookingHold(deps, holdCommand("REF-1", "hold_1"));

    assert.equal(result.isHeld, true);
    const sellable = repos.snapshotInventory(ROOM_TYPE_ID, NIGHTS);
    for (const date of NIGHTS) {
      assert.equal(sellable[date], 1, `night ${date}`);
    }
  });

  it("claims nothing when a single night is sold out", async () => {
    const rows = inventory(2);
    const soldOutNight = rows.map((row) =>
      row.date === NIGHTS[1] ? { ...row, booked: 2 } : row,
    );
    const { repos, deps } = build({ allotment: 2, inventory: soldOutNight });

    const result = await createBookingHold(deps, holdCommand("REF-2", "hold_2"));

    assert.equal(result.isHeld, false);
    // Every night must be untouched â€” no partial claim.
    const sellable = repos.snapshotInventory(ROOM_TYPE_ID, NIGHTS);
    assert.equal(sellable[NIGHTS[0]], 2);
    assert.equal(sellable[NIGHTS[1]], 0);
    assert.equal(sellable[NIGHTS[2]], 2);
  });

  it("refuses a night with rooms out of service", async () => {
    const rows = inventory(2).map((row) =>
      row.date === NIGHTS[2] ? { ...row, outOfService: 2 } : row,
    );
    const { deps } = build({ allotment: 2, inventory: rows });
    const result = await createBookingHold(deps, holdCommand("REF-3", "hold_3"));
    assert.equal(result.isHeld, false);
  });

  it("refuses a night closed to arrival", async () => {
    const rows = inventory(2).map((row) =>
      row.date === NIGHTS[0] ? { ...row, closedToArrival: true } : row,
    );
    const { deps } = build({ allotment: 2, inventory: rows });
    const result = await createBookingHold(deps, holdCommand("REF-4", "hold_4"));
    assert.equal(result.isHeld, false);
  });

  it("rejects an inverted stay window", async () => {
    const { deps } = build({ allotment: 2 });
    const result = await createBookingHold(deps, {
      ...holdCommand("REF-5", "hold_5"),
      query: {
        propertyId: PROPERTY_ID,
        window: { checkIn: "2026-04-12", checkOut: "2026-04-10" },
        occupancy: { adults: 1, children: 0 },
      } as never,
    });
    assert.equal(result.isHeld, false);
    assert.equal(!result.isHeld && result.reason, "INVALID_STAY_WINDOW");
  });
});

describe("concurrent booking attempts (simulated repository)", () => {
  it("lets exactly one of two concurrent holds take the last room", async () => {
    const { repos, deps } = build({ allotment: 1 });

    const [first, second] = await Promise.all([
      createBookingHold(deps, holdCommand("REF-A", "hold_a")),
      createBookingHold(deps, holdCommand("REF-B", "hold_b")),
    ]);

    const held = [first, second].filter((r) => r.isHeld).length;
    assert.equal(held, 1, "exactly one hold may succeed");
    for (const date of NIGHTS) {
      assert.equal(repos.snapshotInventory(ROOM_TYPE_ID, NIGHTS)[date], 0);
    }
  });

  it("lets only the allotment number of concurrent holds succeed", async () => {
    const { deps } = build({ allotment: 2 });
    const attempts = await Promise.all(
      Array.from({ length: 5 }, (_, i) => createBookingHold(deps, holdCommand(`REF-C${i}`, `hold_c${i}`))),
    );
    assert.equal(attempts.filter((r) => r.isHeld).length, 2);
  });

  it("never oversells across many nights at once", async () => {
    const { repos, deps } = build({ allotment: 1 });
    const results = await Promise.all(
      Array.from({ length: 8 }, (_, i) => createBookingHold(deps, holdCommand(`REF-D${i}`, `hold_d${i}`))),
    );
    assert.equal(results.filter((r) => r.isHeld).length, 1);

    for (const date of NIGHTS) {
      assert.equal(repos.snapshotInventory(ROOM_TYPE_ID, [date])[date], 0, `oversold on ${date}`);
    }
  });
});

describe("hold expiry releases inventory", () => {
  it("returns inventory once the hold lapses", async () => {
    const { repos, deps, setNow } = build({ allotment: 1 });
    await createBookingHold(deps, holdCommand("REF-E", "hold_e"));
    assert.equal(repos.snapshotInventory(ROOM_TYPE_ID, NIGHTS)[NIGHTS[0]], 0);

    setNow(new Date("2026-03-20T10:20:00.000Z")); // past the 15-minute hold
    const swept = await expireOverdueHolds(deps, { scope: { organizationId: ORG } });

    assert.equal(swept.expired, 1);
    for (const date of NIGHTS) {
      assert.equal(repos.snapshotInventory(ROOM_TYPE_ID, NIGHTS)[date], 1, `night ${date} not released`);
    }
  });

  it("does not expire a hold that is still inside its window", async () => {
    const { deps } = build({ allotment: 1 });
    await createBookingHold(deps, holdCommand("REF-F", "hold_f"));
    const swept = await expireOverdueHolds(deps, { scope: { organizationId: ORG } });
    assert.equal(swept.expired, 0);
  });

  it("is idempotent across repeated sweeper runs", async () => {
    const { repos, deps, setNow } = build({ allotment: 1 });
    await createBookingHold(deps, holdCommand("REF-G", "hold_g"));
    setNow(new Date("2026-03-20T10:20:00.000Z"));

    await expireOverdueHolds(deps, { scope: { organizationId: ORG } });
    const before = repos.snapshotInventory(ROOM_TYPE_ID, NIGHTS);
    await expireOverdueHolds(deps, { scope: { organizationId: ORG } });
    const after = repos.snapshotInventory(ROOM_TYPE_ID, NIGHTS);

    assert.deepEqual(after, before, "second sweep must not double-release");
  });

  it("refuses to convert an expired hold into a reservation", async () => {
    const { repos, deps, setNow } = build({ allotment: 1 });
    await createBookingHold(deps, holdCommand("REF-H", "hold_h"));
    setNow(new Date("2026-03-20T10:20:00.000Z"));

    const confirmed = await confirmBookingHold(deps, {
      scope: { organizationId: ORG },
      holdId: "hold_h",
      reservationId: "res_h",
      ratePlanId: RATE_PLAN_ID,
      guests: [{ fullName: "Ali Rezaei", isPrimary: true }],
      policySnapshot,
      nightlyRates: [2_000_000, 2_000_000, 2_000_000],
      totalAmount: 6_000_000,
    });

    assert.equal(confirmed.isConfirmed, false);
    assert.equal(!confirmed.isConfirmed && confirmed.reason, "HOLD_EXPIRED");
    // Inventory must be back on the market.
    assert.equal(repos.snapshotInventory(ROOM_TYPE_ID, NIGHTS)[NIGHTS[0]], 1);
  });
});

describe("payment settlement consistency", () => {
  async function pendingReservation() {
    const harness = build({ allotment: 1 });
    await createBookingHold(harness.deps, holdCommand("REF-I", "hold_i"));
    const confirmed = await confirmBookingHold(harness.deps, {
      scope: { organizationId: ORG },
      holdId: "hold_i",
      reservationId: "res_i",
      ratePlanId: RATE_PLAN_ID,
      guests: [{ fullName: "Ali Rezaei", isPrimary: true }],
      policySnapshot,
      nightlyRates: [2_000_000, 2_000_000, 2_000_000],
      totalAmount: 6_000_000,
    });
    assert.equal(confirmed.isConfirmed, true);
    harness.repos.seedPayment({
      paymentRequestPublicId: "prp_1",
      organizationId: ORG,
      purpose: "RESERVATION_DEPOSIT",
      amountToman: BigInt(6_000_000),
      status: "PENDING_VERIFICATION",
      reservationId: "res_i",
    });
    return harness;
  }

  it("confirms the reservation only from a verified payment", async () => {
    const { repos, deps } = await pendingReservation();
    const applied = await reconcileVerifiedPayment(deps, {
      scope: { organizationId: ORG },
      reservationId: "res_i",
      paymentRequestPublicId: "prp_1",
      amountToman: BigInt(6_000_000),
    });

    assert.equal(applied.isApplied, true);
    assert.equal(repos.cloneReservation("res_i")?.status, "CONFIRMED");
    assert.equal(repos.cloneReservation("res_i")?.paymentRequestPublicId, "prp_1");
  });

  it("treats a replayed verification as an idempotent no-op", async () => {
    const { deps } = await pendingReservation();
    const first = await reconcileVerifiedPayment(deps, {
      scope: { organizationId: ORG },
      reservationId: "res_i",
      paymentRequestPublicId: "prp_1",
      amountToman: BigInt(6_000_000),
    });
    const replay = await reconcileVerifiedPayment(deps, {
      scope: { organizationId: ORG },
      reservationId: "res_i",
      paymentRequestPublicId: "prp_1",
      amountToman: BigInt(6_000_000),
    });

    assert.equal(first.isApplied, true);
    assert.equal(first.isIdempotentReplay, false);
    assert.equal(replay.isApplied, true);
    assert.equal(replay.isIdempotentReplay, true);
  });

  it("rejects a verification whose amount does not match the payment", async () => {
    const { deps } = await pendingReservation();
    const applied = await reconcileVerifiedPayment(deps, {
      scope: { organizationId: ORG },
      reservationId: "res_i",
      paymentRequestPublicId: "prp_1",
      amountToman: BigInt(1),
    });

    assert.equal(applied.isApplied, false);
    assert.equal(applied.reason, "AMOUNT_MISMATCH");
  });

  it("never confirms a reservation from an unrelated payment request", async () => {
    const { repos, deps } = await pendingReservation();
    repos.seedPayment({
      paymentRequestPublicId: "prp_other",
      organizationId: ORG,
      purpose: "ORDER_PAYMENT",
      amountToman: BigInt(6_000_000),
      status: "PENDING_VERIFICATION",
      reservationId: "res_different",
    });

    const applied = await reconcileVerifiedPayment(deps, {
      scope: { organizationId: ORG },
      reservationId: "res_i",
      paymentRequestPublicId: "prp_other",
      amountToman: BigInt(6_000_000),
    });

    assert.equal(applied.isApplied, false);
    assert.equal(repos.cloneReservation("res_i")?.status, "PENDING_PAYMENT");
  });

  it("leaves inventory committed after a successful payment", async () => {
    const { repos, deps } = await pendingReservation();
    await reconcileVerifiedPayment(deps, {
      scope: { organizationId: ORG },
      reservationId: "res_i",
      paymentRequestPublicId: "prp_1",
      amountToman: BigInt(6_000_000),
    });

    for (const date of NIGHTS) {
      assert.equal(repos.snapshotInventory(ROOM_TYPE_ID, [date])[date], 0, `night ${date}`);
    }
  });
});

describe("cancellation, refunds and inventory release", () => {
  async function confirmedReservation() {
    const harness = build({ allotment: 1 });
    await createBookingHold(harness.deps, holdCommand("REF-J", "hold_j"));
    await confirmBookingHold(harness.deps, {
      scope: { organizationId: ORG },
      holdId: "hold_j",
      reservationId: "res_j",
      ratePlanId: RATE_PLAN_ID,
      guests: [{ fullName: "Ali Rezaei", isPrimary: true }],
      policySnapshot,
      nightlyRates: [2_000_000, 2_000_000, 2_000_000],
      totalAmount: 6_000_000,
    });
    harness.repos.seedPayment({
      paymentRequestPublicId: "prp_2",
      organizationId: ORG,
      purpose: "RESERVATION_DEPOSIT",
      amountToman: BigInt(6_000_000),
      status: "PAID",
      reservationId: "res_j",
    });
    await reconcileVerifiedPayment(harness.deps, {
      scope: { organizationId: ORG },
      reservationId: "res_j",
      paymentRequestPublicId: "prp_2",
      amountToman: BigInt(6_000_000),
    });
    return harness;
  }

  it("refunds in full and releases inventory when cancelled outside the cutoff", async () => {
    const { repos, deps } = await confirmedReservation();
    const checkInAt = new Date("2026-04-10T10:30:00.000Z"); // 14:00 Tehran on arrival

    const cancelled = await cancelReservation(deps, {
      scope: { organizationId: ORG },
      reservationId: "res_j",
      checkInAt,
      releaseInventory: (id, now) => repos.releaseCommittedInventory(id, now),
    });

    assert.equal(cancelled.isCancelled, true);
    if (!cancelled.isCancelled) return;
    assert.equal(cancelled.quote.reason, "FREE_CANCELLATION");
    assert.equal(cancelled.quote.refundableAmount, 6_000_000);
    assert.equal(cancelled.reservation.status, "CANCELLED");
    for (const date of NIGHTS) {
      assert.equal(repos.snapshotInventory(ROOM_TYPE_ID, [date])[date], 1, `night ${date}`);
    }
  });

  it("retains the penalty inside the cutoff, using the snapshot policy", async () => {
    const { repos, deps, setNow } = await confirmedReservation();
    const checkInAt = new Date("2026-04-10T10:30:00.000Z");

    // 12 hours before local check-in â€” inside the 48-hour cutoff.
    setNow(new Date("2026-04-09T22:30:00.000Z"));
    const cancelled = await cancelReservation(deps, {
      scope: { organizationId: ORG },
      reservationId: "res_j",
      checkInAt,
      releaseInventory: (id, now) => repos.releaseCommittedInventory(id, now),
    });

    assert.equal(cancelled.isCancelled, true);
    if (!cancelled.isCancelled) return;
    assert.equal(cancelled.quote.reason, "PARTIAL_RETENTION");
    assert.equal(cancelled.quote.retainedAmount, 3_000_000);
    assert.equal(cancelled.quote.refundableAmount, 3_000_000);
    assert.equal(cancelled.quote.policyKey, "flexible");
  });

  it("keeps refund-after-cancellation reachable", async () => {
    const { repos, deps } = await confirmedReservation();
    const cancelled = await cancelReservation(deps, {
      scope: { organizationId: ORG },
      reservationId: "res_j",
      checkInAt: new Date("2026-04-10T10:30:00.000Z"),
      releaseInventory: (id, now) => repos.releaseCommittedInventory(id, now),
    });
    assert.equal(cancelled.isCancelled, true);

    const refunded = await repos.updateReservationStatus({
      scope: { organizationId: ORG },
      reservationId: "res_j",
      expectedStatus: ["CANCELLED", "NO_SHOW"],
      nextStatus: "REFUNDED",
      now: repos.cloneReservation("res_j")!.updatedAt,
    });
    assert.equal(refunded.isUpdated, true);
    assert.equal(repos.cloneReservation("res_j")?.status, "REFUNDED");
  });

  it("refuses a second cancellation", async () => {
    const { repos, deps } = await confirmedReservation();
    const now = repos.cloneReservation("res_j")!.updatedAt;
    await cancelReservation(deps, {
      scope: { organizationId: ORG },
      reservationId: "res_j",
      checkInAt: new Date("2026-04-10T10:30:00.000Z"),
      releaseInventory: (id, at) => repos.releaseCommittedInventory(id, at),
    });

    const again = await cancelReservation(deps, {
      scope: { organizationId: ORG },
      reservationId: "res_j",
      checkInAt: new Date("2026-04-10T10:30:00.000Z"),
    });
    assert.equal(again.isCancelled, false);
    void now;
  });
});

describe("server-authoritative pricing integrity", () => {
  async function held() {
    const harness = build({ allotment: 1 });
    await createBookingHold(harness.deps, holdCommand("REF-P", "hold_p"));
    return harness;
  }

  it("rejects a rate set whose length does not match the stay", async () => {
    const { deps } = await held();
    const result = await confirmBookingHold(deps, {
      scope: { organizationId: ORG },
      holdId: "hold_p",
      reservationId: "res_p",
      ratePlanId: RATE_PLAN_ID,
      guests: [{ fullName: "Ali Rezaei", isPrimary: true }],
      policySnapshot,
      nightlyRates: [2_000_000],
      totalAmount: 2_000_000,
    });

    assert.equal(result.isConfirmed, false);
    assert.equal(!result.isConfirmed && result.reason, "PRICING_NIGHT_COUNT_MISMATCH");
  });

  it("rejects a total that does not equal the sum of the nightly rates", async () => {
    const { deps } = await held();
    const result = await confirmBookingHold(deps, {
      scope: { organizationId: ORG },
      holdId: "hold_p",
      reservationId: "res_p",
      ratePlanId: RATE_PLAN_ID,
      guests: [{ fullName: "Ali Rezaei", isPrimary: true }],
      policySnapshot,
      nightlyRates: [2_000_000, 2_000_000, 2_000_000],
      totalAmount: 1_000_000,
    });

    assert.equal(result.isConfirmed, false);
    assert.equal(!result.isConfirmed && result.reason, "PRICING_TOTAL_MISMATCH");
  });

  it("rejects a negative or fractional total", async () => {
    const { deps } = await held();
    for (const total of [-1, 1_500.5]) {
      const result = await confirmBookingHold(deps, {
        scope: { organizationId: ORG },
        holdId: "hold_p",
        reservationId: "res_p",
        ratePlanId: RATE_PLAN_ID,
        guests: [{ fullName: "Ali Rezaei", isPrimary: true }],
        policySnapshot,
        nightlyRates: [total, 0, 0],
        totalAmount: total,
      });
      assert.equal(result.isConfirmed, false);
      assert.equal(!result.isConfirmed && result.reason, "PRICING_INVALID_AMOUNT");
    }
  });

  it("accepts a consistent rate set", async () => {
    const { deps } = await held();
    const result = await confirmBookingHold(deps, {
      scope: { organizationId: ORG },
      holdId: "hold_p",
      reservationId: "res_p",
      ratePlanId: RATE_PLAN_ID,
      guests: [{ fullName: "Ali Rezaei", isPrimary: true }],
      policySnapshot,
      nightlyRates: [2_000_000, 2_000_000, 2_000_000],
      totalAmount: 6_000_000,
    });
    assert.equal(result.isConfirmed, true);
  });
});

describe("maximum stay guard", () => {
  it("refuses a stay beyond the platform ceiling", async () => {
    const { deps } = build({ allotment: 1 });
    const result = await createBookingHold(deps, {
      ...holdCommand("REF-Q", "hold_q"),
      query: {
        propertyId: PROPERTY_ID,
        window: { checkIn: "2026-01-01", checkOut: "2026-06-01" },
        occupancy: { adults: 1, children: 0 },
      } as never,
    });
    assert.equal(result.isHeld, false);
    assert.equal(!result.isHeld && result.reason, "MAX_STAY_EXCEEDED");
  });
});

describe("verified payment after hold expiry is surfaced, never silently confirmed", () => {
  it("reports NOT_FOUND when the reservation no longer exists", async () => {
    const { repos, deps, setNow } = build({ allotment: 1 });
    await createBookingHold(deps, holdCommand("REF-R", "hold_r"));
    repos.seedPayment({
      paymentRequestPublicId: "prp_4",
      organizationId: ORG,
      purpose: "RESERVATION_DEPOSIT",
      amountToman: BigInt(2_000_000),
      status: "PAID",
      reservationId: "res_r",
    });

    // The hold lapses and is swept; no reservation was ever created.
    setNow(new Date("2026-03-20T10:20:00.000Z"));
    await expireOverdueHolds(deps, { scope: { organizationId: ORG } });

    const applied = await reconcileVerifiedPayment(deps, {
      scope: { organizationId: ORG },
      reservationId: "res_r",
      paymentRequestPublicId: "prp_4",
      amountToman: BigInt(2_000_000),
    });

    // Surfaced as NOT_FOUND so the caller can route it to reconciliation,
    // rather than reporting a successful booking.
    assert.equal(applied.isApplied, false);
    assert.equal(applied.reason, "NOT_FOUND");
  });
});

describe("cross-tenant access rejection", () => {
  it("refuses a hold claim from another organization", async () => {
    const { repos, deps } = build({ allotment: 1 });
    const result = await createBookingHold(deps, {
      ...holdCommand("REF-K", "hold_k"),
      scope: { organizationId: OTHER_ORG },
    });

    assert.equal(result.isHeld, false);
    // Inventory untouched.
    assert.equal(repos.snapshotInventory(ROOM_TYPE_ID, NIGHTS)[NIGHTS[0]], 1);
  });

  it("refuses to read another tenant's hold", async () => {
    const { repos, deps } = build({ allotment: 1 });
    await createBookingHold(deps, holdCommand("REF-L", "hold_l"));

    const found = await repos.findHold({ organizationId: OTHER_ORG }, "hold_l");
    assert.equal(found, null);
  });

  it("refuses to release another tenant's hold", async () => {
    const { repos, deps } = build({ allotment: 1 });
    await createBookingHold(deps, holdCommand("REF-M", "hold_m"));

    const released = await repos.releaseHold({ organizationId: OTHER_ORG }, "hold_m", new Date());
    assert.equal(released.isReleased, false);
    assert.equal(!released.isReleased && released.reason, "TENANT_MISMATCH");
    assert.equal(repos.snapshotInventory(ROOM_TYPE_ID, NIGHTS)[NIGHTS[0]], 0);
  });

  it("refuses to read another tenant's inventory", async () => {
    const { repos } = build({ allotment: 1 });
    const rows = await repos.getInventoryNights(
      { organizationId: OTHER_ORG },
      PROPERTY_ID,
      [ROOM_TYPE_ID],
      NIGHTS,
    );
    assert.equal(rows.length, 0);
  });

  it("refuses another tenant's payment reconciliation", async () => {
    const { repos, deps } = build({ allotment: 1 });
    await createBookingHold(deps, holdCommand("REF-N", "hold_n"));
    await confirmBookingHold(deps, {
      scope: { organizationId: ORG },
      holdId: "hold_n",
      reservationId: "res_n",
      ratePlanId: RATE_PLAN_ID,
      guests: [{ fullName: "Ali Rezaei", isPrimary: true }],
      policySnapshot,
      nightlyRates: [2_000_000, 2_000_000, 2_000_000],
      totalAmount: 6_000_000,
    });
    repos.seedPayment({
      paymentRequestPublicId: "prp_3",
      organizationId: ORG,
      purpose: "RESERVATION_DEPOSIT",
      amountToman: BigInt(6_000_000),
      status: "PENDING_VERIFICATION",
      reservationId: "res_n",
    });

    const applied = await reconcileVerifiedPayment(deps, {
      scope: { organizationId: OTHER_ORG },
      reservationId: "res_n",
      paymentRequestPublicId: "prp_3",
      amountToman: BigInt(6_000_000),
    });

    assert.equal(applied.isApplied, false);
    assert.equal(applied.reason, "TENANT_MISMATCH");
    assert.equal(repos.cloneReservation("res_n")?.status, "PENDING_PAYMENT");
  });
});
