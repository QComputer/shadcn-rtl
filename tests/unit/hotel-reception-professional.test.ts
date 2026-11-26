import { test } from "node:test";
import assert from "node:assert/strict";
import { canMarkManualNoShow, matchesReceptionSearch, normalizeReceptionSearch, projectReceptionHistory, receptionClock, receptionArrivalTiming, receptionDepartureTiming, earlyDepartureBoundary, currentReceptionRoom } from "../../lib/hotel/domain/reception-professional";

const due = { status: "CONFIRMED", checkIn: "2026-11-25", today: "2026-11-26", checkedInAt: null };
test("no-show requires a prior arrival day, confirmed state and no actual arrival", () => {
  assert.equal(canMarkManualNoShow(due), true);
  assert.equal(canMarkManualNoShow({ ...due, checkIn: due.today }), false);
  assert.equal(canMarkManualNoShow({ ...due, checkIn: "2026-11-27" }), false);
  assert.equal(canMarkManualNoShow({ ...due, status: "CHECKED_IN" }), false);
  assert.equal(canMarkManualNoShow({ ...due, status: "NO_SHOW" }), false);
  assert.equal(canMarkManualNoShow({ ...due, checkedInAt: new Date() }), false);
  assert.equal(canMarkManualNoShow({ ...due, checkIn: "2026-02-30" }), false);
});
test("search normalizes Persian and Arabic letters and both sets of digits", () => {
  assert.equal(normalizeReceptionSearch("كريمي ۱۲٣"), "کریمی 123");
  assert.equal(matchesReceptionSearch("كريمي ۱۰۲", ["رضا کریمی", "Room 102"]), true);
  assert.equal(matchesReceptionSearch("رضا 103", ["رضا کریمی", "Room 102"]), false);
  assert.equal(matchesReceptionSearch("", []), true);
});
test("reception history projects only known actions and loaded reservations", () => {
  const createdAt = new Date("2026-11-26T00:00:00Z");
  const rows = [
    { id: "1", createdAt, resultJson: { action: "mark-no-show", reservation: { id: "A", secret: "hidden" }, actorUserId: "hidden" } },
    { id: "2", createdAt, resultJson: { action: "CREATE_MANUAL_RESERVATION", reservationId: "A" } },
    { id: "3", createdAt, resultJson: { action: "amend-stay", reservation: { id: "B" } } },
    { id: "4", createdAt, resultJson: { action: "preview-amend-stay", reservation: { id: "A" } } },
    { id: "5", createdAt, resultJson: null },
  ];
  assert.deepEqual(projectReceptionHistory(rows, new Set(["A"])), [
    { id: "1", reservationId: "A", action: "mark-no-show", at: createdAt.toISOString() },
    { id: "2", reservationId: "A", action: "CREATE_MANUAL_RESERVATION", at: createdAt.toISOString() },
  ]);
});

test("Jalali reception calendar keeps canonical Gregorian dates across Nowruz and bounds", async () => {
  const { jalaliParts, jalaliMonthGrid, moveJalaliMonth, startOfJalaliMonth } = await import("../../lib/booking/jalali-calendar");
  const first = "2025-03-21";
  assert.deepEqual(jalaliParts(first), { year: 1404, month: 1, day: 1 });
  assert.equal(startOfJalaliMonth("2025-04-02"), first);
  assert.equal(moveJalaliMonth(first, 1), "2025-04-21");
  const days = jalaliMonthGrid(first, "2025-03-21", "2025-03-23");
  assert.equal(days.length, 42);
  assert.deepEqual(days.filter(day => !day.disabled).map(day => day.iso), ["2025-03-21", "2025-03-22", "2025-03-23"]);
});


test("arrival uses property-local civil day and scheduled hour, not runner time", () => {
  const clock = receptionClock("Asia/Tehran", new Date("2026-11-25T21:00:00Z"));
  assert.deepEqual(clock, { today: "2026-11-26", localTime: "00:30" });
  assert.equal(receptionArrivalTiming("2026-11-26", "2026-11-29", clock.today, clock.localTime, "14:00"), "EARLY");
  assert.equal(receptionArrivalTiming("2026-11-27", "2026-11-29", clock.today, clock.localTime, "14:00"), "BEFORE_STAY");
  assert.equal(receptionArrivalTiming("2026-11-24", "2026-11-29", clock.today, clock.localTime, "14:00"), "LATE_ARRIVAL");
  assert.equal(receptionArrivalTiming("2026-11-24", "2026-11-26", clock.today, clock.localTime, "14:00"), "STAY_ENDED");
  assert.equal(receptionArrivalTiming("2026-11-26", "2026-11-29", clock.today, "14:00", "14:00"), "ON_DAY");
});
test("early departure retains today, releases only future nights and distinguishes late checkout", () => {
  assert.equal(earlyDepartureBoundary("2026-12-31", "2027-01-04"), "2027-01-01");
  assert.equal(earlyDepartureBoundary("2026-12-31", "2027-01-01"), null);
  assert.equal(earlyDepartureBoundary("2027-01-02", "2027-01-01"), null);
  assert.equal(receptionDepartureTiming("2027-01-01", "2026-12-31", "23:00", "11:00"), "EARLY");
  assert.equal(receptionDepartureTiming("2027-01-01", "2027-01-01", "10:59", "11:00"), "EARLY");
  assert.equal(receptionDepartureTiming("2027-01-01", "2027-01-01", "11:00", "11:00"), "ON_DAY");
  assert.equal(receptionDepartureTiming("2027-01-01", "2027-01-01", "11:01", "11:00"), "LATE_DEPARTURE");
});
test("overdue guest keeps the most recent room, without using future room assignment", () => {
  const nights = [{ date: "2026-11-27", roomId: "B" }, { date: new Date("2026-11-25T00:00Z"), roomId: "A" }];
  assert.equal(currentReceptionRoom(nights, "2026-11-24"), null);
  assert.equal(currentReceptionRoom(nights, "2026-11-26"), "A");
  assert.equal(currentReceptionRoom(nights, "2026-11-29"), "B");
});
