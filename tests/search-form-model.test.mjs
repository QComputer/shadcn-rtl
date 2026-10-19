import assert from "node:assert/strict";
import test from "node:test";
import { jalaliDayLabel } from "../lib/booking/jalali-calendar.ts";
import {
  addChild, initialGuests, normalizeAvailabilitySearch, removeChild,
  setAdultCount, setChildAge, validateSearchDraft,
} from "../lib/booking/search-form-model.ts";

const unknown = { source: "UNAVAILABLE" };
const published = { source: "PUBLISHED_PROPERTY", timezone: "Asia/Tehran", minStayNights: 2, maxStayNights: 5 };
const draft = (guests = initialGuests, checkIn = "2026-10-20", checkOut = "2026-10-22") => ({ checkIn, checkOut, guests });

test("adult selection is bounded by committed validator", () => {
  assert.equal(setAdultCount(initialGuests, 2).adults, 2);
  assert.equal(setAdultCount(initialGuests, 0).adults, 1);
  assert.equal(setAdultCount(initialGuests, 13).adults, 12);
  assert.deepEqual(validateSearchDraft(draft({ adults: 0, childAges: [] }), { policy: unknown }), { ok: false, issue: "INVALID_ADULTS" });
});

test("adding and removing children preserves entered ages", () => {
  const two = addChild(addChild(initialGuests));
  assert.deepEqual(two.childAges, [null, null]);
  const aged = setChildAge(setChildAge(two, 0, 0), 1, 17);
  assert.deepEqual(aged.childAges, [0, 17]);
  assert.deepEqual(removeChild(aged).childAges, [0]);
  assert.equal(addChild({ adults: 1, childAges: Array(12).fill(null) }).childAges.length, 12);
});

test("optional ages are transmitted exactly or omitted, never partly dropped", () => {
  const noAges = validateSearchDraft(draft(addChild(initialGuests)), { policy: unknown });
  assert.equal(noAges.ok, true);
  assert.deepEqual(noAges.value.occupancy, { adults: 1, children: 1 });
  const full = normalizeAvailabilitySearch(draft(setChildAge(addChild(initialGuests), 0, 7)), { trustedPropertySlug: "synthetic-property", policy: unknown });
  assert.equal(full.ok, true);
  assert.deepEqual(full.value, { property: "synthetic-property", checkIn: "2026-10-20", checkOut: "2026-10-22", occupancy: { adults: 1, children: 1, childAges: [7] } });
  const partial = setChildAge(addChild(addChild(initialGuests)), 0, 7);
  assert.deepEqual(validateSearchDraft(draft(partial), { policy: unknown }), { ok: false, issue: "INCOMPLETE_CHILD_AGES" });
  assert.deepEqual(validateSearchDraft(draft({ adults: 1, childAges: [18] }), { policy: unknown }), { ok: false, issue: "INVALID_CHILD_AGE" });
});

test("future trusted policy may require all child ages", () => {
  assert.deepEqual(validateSearchDraft(draft(addChild(initialGuests)), { policy: { ...published, requireChildAges: true } }), { ok: false, issue: "CHILD_AGES_REQUIRED" });
});

test("dates remain Gregorian ISO even when presented in Jalali", () => {
  const result = normalizeAvailabilitySearch(draft(initialGuests, "2025-03-21", "2025-03-23"), { trustedPropertySlug: "synthetic-property", policy: unknown });
  assert.equal(result.ok, true);
  assert.equal(result.value.checkIn, "2025-03-21");
  assert.match(jalaliDayLabel(result.value.checkIn), /۱۴۰۴/);
});

test("invalid, missing, reversed and over-30-night dates are rejected", () => {
  for (const [input, issue] of [
    [draft(initialGuests, "", ""), "DATES_REQUIRED"],
    [draft(initialGuests, "2026-02-30", "2026-03-02"), "INVALID_DATE"],
    [draft(initialGuests, "2026-10-22", "2026-10-20"), "DATE_ORDER"],
    [draft(initialGuests, "2026-10-20", "2026-11-21"), "MAX_STAY"],
  ]) assert.deepEqual(validateSearchDraft(input, { policy: unknown }), { ok: false, issue });
});

test("published min/max stays, arrival bounds and unavailable nights are configurable", () => {
  assert.deepEqual(validateSearchDraft(draft(initialGuests, "2026-10-20", "2026-10-21"), { policy: published }), { ok: false, issue: "MIN_STAY" });
  assert.deepEqual(validateSearchDraft(draft(initialGuests, "2026-10-20", "2026-10-27"), { policy: published }), { ok: false, issue: "MAX_STAY" });
  assert.deepEqual(validateSearchDraft(draft(), { policy: { ...published, minArrivalDate: "2026-10-21" } }), { ok: false, issue: "MIN_ARRIVAL" });
  assert.deepEqual(validateSearchDraft(draft(), { policy: { ...published, maxArrivalDate: "2026-10-19" } }), { ok: false, issue: "MAX_ARRIVAL" });
  assert.deepEqual(validateSearchDraft(draft(), { policy: { ...published, unavailableDates: ["2026-10-21"] } }), { ok: false, issue: "UNAVAILABLE_DATE" });
  assert.equal(validateSearchDraft(draft(), { policy: published }).ok, true);
});

test("unknown policy remains explicit; browser today is only preview convenience", () => {
  const result = validateSearchDraft(draft(), { policy: unknown, browserToday: "2026-10-12" });
  assert.equal(result.ok, true);
  assert.equal(result.policyAvailable, false);
  assert.equal(result.browserTodayOnly, true);
  assert.deepEqual(validateSearchDraft(draft(), { policy: unknown, browserToday: "2026-10-21" }), { ok: false, issue: "PAST_PREVIEW_DATE" });
  const actualPolicy = validateSearchDraft(draft(), { policy: { ...published, propertyLocalToday: "2026-10-19" }, browserToday: "2026-10-21" });
  assert.equal(actualPolicy.ok, true, "browser clock does not override a trusted property-local date");
});

test("property identity cannot be supplied by the editable draft", () => {
  const spoofed = { ...draft(), property: "foreign-property" };
  const result = normalizeAvailabilitySearch(spoofed, { trustedPropertySlug: "synthetic-property", policy: unknown });
  assert.equal(result.ok, true);
  assert.equal(result.value.property, "synthetic-property");
  assert.deepEqual(normalizeAvailabilitySearch(draft(), { trustedPropertySlug: "INVALID!", policy: unknown }), { ok: false, issue: "INVALID_PROPERTY" });
});
