import { test } from "node:test";
import assert from "node:assert/strict";
import { planStayAmendment, stayDatesBetween } from "../../lib/hotel/domain/stay-amendment";

const base = {
  oldCheckIn: "2026-11-26", oldCheckOut: "2026-11-28", checkIn: "2026-11-26", checkOut: "2026-11-29",
  today: "2026-11-26", status: "CONFIRMED", nights: [
    { date: "2026-11-26", roomId: "A", rate: BigInt(125000) }, { date: "2026-11-27", roomId: "A", rate: BigInt(130000) },
  ], addedRates: new Map([["2026-11-28", BigInt(140000)]]),
};
test("extension preserves original nightly rates and quotes only added nights", () => {
  const plan = planStayAmendment(base);
  assert.deepEqual(plan.added, ["2026-11-28"]);
  assert.deepEqual(plan.removed, []);
  assert.deepEqual(plan.rates, [BigInt(125000), BigInt(130000), BigInt(140000)]);
  assert.equal(plan.total, BigInt(395000));
});
test("shortening releases only removed half-open nights", () => {
  const plan = planStayAmendment({ ...base, checkOut: "2026-11-27" });
  assert.deepEqual(plan.removed, ["2026-11-27"]);
  assert.equal(plan.total, BigInt(125000));
});
test("a date shift preserves overlapping rates and accounts for both deltas", () => {
  const plan = planStayAmendment({ ...base, checkIn: "2026-11-27" });
  assert.deepEqual(plan.removed, ["2026-11-26"]);
  assert.deepEqual(plan.retained, ["2026-11-27"]);
  assert.deepEqual(plan.added, ["2026-11-28"]);
  assert.equal(plan.total, BigInt(270000));
});
test("checked-in extension uses the active room after an earlier room move", () => {
  const plan = planStayAmendment({ ...base, status: "CHECKED_IN", today: "2026-11-27", nights: [base.nights[0]!, { ...base.nights[1]!, roomId: "B" }] });
  assert.equal(plan.newRoomId, "B");
  assert.deepEqual(plan.retained, ["2026-11-26", "2026-11-27"]);
  assert.equal(plan.total, BigInt(395000));
});
test("cannot rewrite arrival or release the current night of an active stay", () => {
  assert.throws(() => planStayAmendment({ ...base, status: "CHECKED_IN", today: "2026-11-27", checkIn: "2026-11-27" }), /STAY_AMENDMENT_ACTIVE_DATES/);
  assert.throws(() => planStayAmendment({ ...base, status: "CHECKED_IN", today: "2026-11-27", checkOut: "2026-11-27" }), /STAY_AMENDMENT_ACTIVE_DATES/);
});
test("rejects unavailable rates, incomplete nights and past arrival", () => {
  assert.throws(() => planStayAmendment({ ...base, addedRates: new Map() }), /STAY_AMENDMENT_INTEGRITY/);
  assert.throws(() => planStayAmendment({ ...base, nights: base.nights.slice(0, 1) }), /STAY_AMENDMENT_INTEGRITY/);
  assert.throws(() => planStayAmendment({ ...base, today: "2026-11-27" }), /precedes property today/);
});
test("stay bounds validate actual civil dates and exclude departure", () => {
  assert.deepEqual(stayDatesBetween("2026-12-31", "2027-01-02"), ["2026-12-31", "2027-01-01"]);
  assert.throws(() => stayDatesBetween("2026-02-30", "2026-03-02"));
  assert.throws(() => stayDatesBetween("2026-11-26", "2026-12-28"));
});
