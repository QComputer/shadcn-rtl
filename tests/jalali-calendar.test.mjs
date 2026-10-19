import assert from "node:assert/strict";
import test from "node:test";
import {
  parseISODate, toISODate, todayLocalISO, shiftISODate, jalaliParts, jalaliDayLabel,
  jalaliAccessibleDay, jalaliMonthTitle, startOfJalaliMonth, moveJalaliMonth,
  persianWeekdayIndex, jalaliMonthGrid, selectStayDate, validateStayRange,
} from "../lib/booking/jalali-calendar.ts";

test("rejects malformed and impossible Gregorian ISO values", () => {
  for (const value of ["", "2026-1-01", "1405-01-01", "2026-13-01", "2026-02-30", "2025-02-29", "2026-00-01", "2026-03-0a", "2026-03-01T00:00:00Z", "2026-12-32"]) {
    assert.equal(parseISODate(value), null, value);
  }
  assert.ok(parseISODate("2024-02-29"));
});

test("ISO day arithmetic is DST- and leap-safe", () => {
  assert.equal(shiftISODate("2024-02-28", 1), "2024-02-29");
  assert.equal(shiftISODate("2024-02-29", 1), "2024-03-01");
  assert.equal(shiftISODate("2026-01-01", -1), "2025-12-31");
  assert.equal(toISODate(parseISODate("2026-10-12")), "2026-10-12");
  assert.throws(() => shiftISODate("not-date", 1), RangeError);
});

test("Jalali display maps Nowruz without altering ISO", () => {
  assert.deepEqual(jalaliParts("2025-03-20"), { year: 1403, month: 12, day: 30 });
  assert.deepEqual(jalaliParts("2025-03-21"), { year: 1404, month: 1, day: 1 });
  assert.match(jalaliDayLabel("2025-03-21"), /۱۴۰۴/);
  assert.match(jalaliAccessibleDay("2025-03-21"), /۱۴۰۴/);
  assert.match(jalaliMonthTitle("2025-03-21"), /فروردین/);
});

test("Jalali presentation localizes month names without changing canonical ISO", () => {
  const iso = "2025-03-21";
  assert.match(jalaliMonthTitle(iso, "en"), /1404/);
  assert.match(jalaliMonthTitle(iso, "ar"), /١٤٠٤|۱۴۰۴/);
  assert.notEqual(jalaliDayLabel(iso, "en"), jalaliDayLabel(iso, "fa"));
  assert.equal(iso, "2025-03-21");
});

test("month navigation is reversible across year and leap boundaries", () => {
  for (const date of ["2025-03-20", "2025-03-21", "2024-02-28", "2026-10-12", "2026-12-30"]) {
    const first = startOfJalaliMonth(date);
    assert.equal(jalaliParts(first).day, 1);
    assert.equal(moveJalaliMonth(moveJalaliMonth(first, 1), -1), first);
    assert.equal(moveJalaliMonth(moveJalaliMonth(first, -1), 1), first);
  }
});

test("Jalali month grids have 42 contiguous Saturday-first dates", () => {
  for (const month of ["2025-03-21", "2026-10-12", "2024-03-01"]) {
    const grid = jalaliMonthGrid(month, "2020-01-01");
    assert.equal(grid.length, 42);
    assert.equal(persianWeekdayIndex(grid[0].iso), 0);
    assert.equal(persianWeekdayIndex(grid[6].iso), 6);
    assert.ok(grid.some((cell) => cell.currentMonth && cell.jalaliDay === 1));
    for (let day = 1; day < grid.length; day++) assert.equal(grid[day].iso, shiftISODate(grid[day - 1].iso, 1));
  }
});

test("minimum and maximum ISO dates disable prohibited days", () => {
  const grid = jalaliMonthGrid("2026-10-12", "2026-10-12", "2026-10-16");
  assert.ok(grid.find((day) => day.iso === "2026-10-11")?.disabled);
  assert.equal(grid.find((day) => day.iso === "2026-10-12")?.disabled, false);
  assert.equal(grid.find((day) => day.iso === "2026-10-16")?.disabled, false);
  assert.ok(grid.find((day) => day.iso === "2026-10-17")?.disabled);
});

test("range selection returns Gregorian ISO in ascending order", () => {
  const start = selectStayDate({ checkIn: "", checkOut: "" }, "2026-10-15", "checkIn");
  assert.deepEqual(start, { range: { checkIn: "2026-10-15", checkOut: "" }, nextSegment: "checkOut", complete: false });
  const end = selectStayDate(start.range, "2026-10-19", "checkOut");
  assert.equal(end.complete, true);
  assert.deepEqual(end.range, { checkIn: "2026-10-15", checkOut: "2026-10-19" });
  assert.deepEqual(selectStayDate(end.range, "2026-10-14", "checkOut").range, { checkIn: "2026-10-14", checkOut: "" });
  assert.deepEqual(selectStayDate(end.range, "2026-10-17", "checkIn").range, { checkIn: "2026-10-17", checkOut: "" });
});

test("validation distinguishes missing, past, order and valid states", () => {
  const minimum = "2026-10-12";
  assert.equal(validateStayRange({ checkIn: "", checkOut: "" }, minimum), "MISSING");
  assert.equal(validateStayRange({ checkIn: "2026-10-11", checkOut: "2026-10-15" }, minimum), "PAST");
  assert.equal(validateStayRange({ checkIn: "2026-10-16", checkOut: "2026-10-15" }, minimum), "ORDER");
  assert.equal(validateStayRange({ checkIn: "2026-10-16", checkOut: "2026-10-16" }, minimum), "ORDER");
  assert.equal(validateStayRange({ checkIn: "2026-10-16", checkOut: "2026-10-17" }, minimum), "OK");
});

test("local date helper does not roll over to UTC", () => {
  assert.equal(todayLocalISO(new Date(2026, 9, 12, 23, 30)), "2026-10-12");
});
