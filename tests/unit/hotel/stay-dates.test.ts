import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  addStayDays,
  bedCapacity,
  compareStayDates,
  enumerateStayNights,
  isStayDate,
  parseStayDate,
  stayNightCount,
  validateOccupancy,
  validateOccupancyFitsRoom,
  validateStayWindow,
} from "../../../lib/hotel/domain/stay-dates";

describe("hotel stay dates", () => {
  it("validates real calendar dates and rejects impossible ones", () => {
    assert.equal(isStayDate("2026-03-21"), true);
    assert.equal(isStayDate("2026-02-30"), false);
    assert.equal(isStayDate("2026-13-01"), false);
    assert.equal(isStayDate("2026-3-1"), false);
    assert.deepEqual(parseStayDate("2024-02-29"), { year: 2024, month: 2, day: 29 });
  });

  it("handles leap years", () => {
    assert.equal(isStayDate("2025-02-29"), false);
    assert.equal(isStayDate("2028-02-29"), true);
  });

  it("crosses month and year boundaries without timezone drift", () => {
    assert.equal(addStayDays("2026-03-31", 1), "2026-04-01");
    assert.equal(addStayDays("2026-12-31", 1), "2027-01-01");
    assert.equal(addStayDays("2026-01-01", -1), "2025-12-31");
  });

  it("counts nights as a half-open interval", () => {
    assert.equal(stayNightCount("2026-03-21", "2026-03-24"), 3);
    assert.equal(stayNightCount("2026-03-21", "2026-03-21"), 0);
  });

  it("treats checkout day as unoccupied", () => {
    assert.deepEqual(enumerateStayNights("2026-03-21", "2026-03-24"), [
      "2026-03-21",
      "2026-03-22",
      "2026-03-23",
    ]);
  });

  it("returns no nights for an inverted or empty window", () => {
    assert.deepEqual(enumerateStayNights("2026-03-24", "2026-03-21"), []);
    assert.deepEqual(enumerateStayNights("2026-03-24", "2026-03-24"), []);
  });

  it("orders dates correctly", () => {
    assert.ok(compareStayDates("2026-03-21", "2026-03-22") < 0);
    assert.ok(compareStayDates("2026-03-22", "2026-03-21") > 0);
    assert.equal(compareStayDates("2026-03-21", "2026-03-21"), 0);
  });

  it("enforces minimum and maximum stay length", () => {
    const policy = { minNights: 2, maxNights: 5 };
    assert.deepEqual(validateStayWindow("2026-03-21", "2026-03-23", policy), { isValid: true, nights: 2 });
    assert.deepEqual(validateStayWindow("2026-03-21", "2026-03-22", policy), {
      isValid: false,
      reason: "MIN_STAY_NOT_MET",
    });
    assert.deepEqual(validateStayWindow("2026-03-21", "2026-03-27", policy), {
      isValid: false,
      reason: "MAX_STAY_EXCEEDED",
    });
    assert.deepEqual(validateStayWindow("2026-03-21", "2026-03-21", policy), {
      isValid: false,
      reason: "CHECK_OUT_MUST_BE_AFTER_CHECK_IN",
    });
  });

  it("does not reject a hotel check-in/check-out window that crosses midnight", () => {
    // Hotels routinely configure checkOut earlier in the day than checkIn.
    // This must not be treated as a misconfiguration.
    const result = validateStayWindow("2026-03-21", "2026-03-24", { minNights: 1, maxNights: 0 });
    assert.equal(result.isValid, true);
  });
});

describe("hotel occupancy", () => {
  it("requires at least one adult", () => {
    assert.deepEqual(validateOccupancy({ adults: 0, children: 1 }), {
      isValid: false,
      reason: "AT_LEAST_ONE_ADULT_REQUIRED",
    });
  });

  it("requires one age per child when ages are supplied", () => {
    assert.deepEqual(validateOccupancy({ adults: 1, children: 2, childAges: [5] }), {
      isValid: false,
      reason: "CHILD_AGE_COUNT_MISMATCH",
    });
    assert.equal(validateOccupancy({ adults: 1, children: 1, childAges: [5] }).isValid, true);
  });

  it("rejects ages outside the child range", () => {
    assert.deepEqual(validateOccupancy({ adults: 1, children: 1, childAges: [22] }), {
      isValid: false,
      reason: "INVALID_CHILD_AGE",
    });
  });

  it("derives bed capacity from bed shapes", () => {
    assert.equal(
      bedCapacity([
        { kind: "queen", count: 1 },
        { kind: "single", count: 1 },
      ]),
      3,
    );
    assert.equal(bedCapacity([{ kind: "crib", count: 1 }]), 1);
    assert.equal(bedCapacity([]), 0);
  });

  it("rejects a party larger than the room can physically hold", () => {
    const capacity = { maxAdults: 2, maxChildren: 1, maxOccupancy: 3 };
    const beds = [{ kind: "double" as const, count: 1 }];

    assert.equal(validateOccupancyFitsRoom({ adults: 2, children: 0 }, capacity, beds).isValid, true);
    assert.deepEqual(validateOccupancyFitsRoom({ adults: 2, children: 2 }, capacity, beds), {
      isValid: false,
      reason: "OCCUPANCY_EXCEEDS_ROOM_MAX",
    });
  });

  it("rejects a party that fits the declared capacity but not the beds", () => {
    const capacity = { maxAdults: 4, maxChildren: 2, maxOccupancy: 6 };
    const beds = [{ kind: "double" as const, count: 1 }];
    assert.deepEqual(validateOccupancyFitsRoom({ adults: 3, children: 0 }, capacity, beds), {
      isValid: false,
      reason: "NOT_ENOUGH_BEDS",
    });
  });

  it("separates adult and child quotas", () => {
    // maxOccupancy is generous so the child-specific quota is the binding limit.
    const capacity = { maxAdults: 2, maxChildren: 1, maxOccupancy: 6 };
    const beds = [
      { kind: "double" as const, count: 1 },
      { kind: "double" as const, count: 1 },
      { kind: "crib" as const, count: 1 },
    ];
    assert.deepEqual(validateOccupancyFitsRoom({ adults: 1, children: 3 }, capacity, beds), {
      isValid: false,
      reason: "CHILDREN_EXCEED_ROOM_CAPACITY",
    });
    assert.equal(validateOccupancyFitsRoom({ adults: 2, children: 1 }, capacity, beds).isValid, true);
  });
});