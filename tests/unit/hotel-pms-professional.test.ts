import assert from "node:assert/strict";
import { test } from "node:test";
import { propertyCalendarDate, offsetPropertyDate, isPropertyDate, receptionDateIssue } from "../../lib/hotel/domain/property-calendar";
import { receptionDateMessage, reservationActionMessage, receptionReloadMessage, refreshMatches } from "../../lib/hotel/management/reservation-center-feedback";

test("Tehran civil date changes at Tehran midnight, not UTC midnight", () => {
  assert.equal(propertyCalendarDate("Asia/Tehran", new Date("2026-11-25T20:29:59Z")), "2026-11-25");
  assert.equal(propertyCalendarDate("Asia/Tehran", new Date("2026-11-25T20:30:00Z")), "2026-11-26");
  assert.equal(propertyCalendarDate("America/Los_Angeles", new Date("2026-11-26T00:30:00Z")), "2026-11-25");
});
test("ISO calendar arithmetic handles leap days and month/year boundaries", () => {
  assert.equal(offsetPropertyDate("2028-02-28", 1), "2028-02-29");
  assert.equal(offsetPropertyDate("2026-12-31", 1), "2027-01-01");
  assert.equal(offsetPropertyDate("2026-11-26", 31), "2026-12-27");
  assert.equal(isPropertyDate("2026-02-30"), false);
  assert.equal(isPropertyDate(""), false);
});
test("manual reservations allow property-local same-day arrival but reject past, reversed and overlong stays", () => {
  const today = "2026-11-26";
  assert.equal(receptionDateIssue(today, "2026-11-27", today), null);
  assert.equal(receptionDateIssue("2026-11-25", "2026-11-27", today), "PAST");
  assert.equal(receptionDateIssue(today, today, today), "ORDER");
  assert.equal(receptionDateIssue(today, "2026-12-27", today), null);
  assert.equal(receptionDateIssue(today, "2026-12-28", today), "TOO_LONG");
  assert.equal(receptionDateIssue("", "2026-11-27", today), "REQUIRED");
  assert.equal(receptionDateIssue("2026-11-31", "2026-12-01", today), "INVALID");
});
test("known errors are localized without exposing unknown backend messages", () => {
  for (const locale of ["fa", "en", "ar"]) {
    assert.notEqual(reservationActionMessage("Check-in precedes property today", locale, "fallback"), "fallback");
    assert.notEqual(reservationActionMessage("No room inventory is available for these dates", locale, "fallback"), "fallback");
    assert.notEqual(reservationActionMessage("ROOM_MAINTENANCE_CONFLICT", locale, "fallback"), "fallback");
    assert.notEqual(reservationActionMessage("Unauthorized", locale, "fallback", 401), "fallback");
    assert.equal(reservationActionMessage("SQL secret user@example.com", locale, "fallback", 500), "fallback");
    assert.ok(receptionDateMessage("PAST", locale));
    assert.ok(receptionReloadMessage(locale));
  }
});
test("calendar refresh signals match only the current organization and property", () => {
  const scope = { organizationId: "org-1", propertyId: "hotel-1" };
  assert.equal(refreshMatches(scope, scope), true);
  assert.equal(refreshMatches({ ...scope, propertyId: "hotel-2" }, scope), false);
  assert.equal(refreshMatches({ ...scope, organizationId: "org-2" }, scope), false);
  assert.equal(refreshMatches(null, scope), false);
});
