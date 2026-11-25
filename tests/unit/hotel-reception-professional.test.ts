import { test } from "node:test";
import assert from "node:assert/strict";
import { canMarkManualNoShow, matchesReceptionSearch, normalizeReceptionSearch, projectReceptionHistory } from "../../lib/hotel/domain/reception-professional";

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
