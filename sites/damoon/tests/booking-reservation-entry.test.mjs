import assert from "node:assert/strict";
import { test } from "node:test";
import { buildReservationEntryUrl } from "../booking-flow.js";

test("reservation entry preserves stay choices and carries no guest or tenant identifiers", () => {
  const url = buildReservationEntryUrl("https://damoon-hotel.ir/fa/hotel-reservations/start?campaign=preview", "damoon-hotel", {
    range: { checkIn: "2027-05-10", checkOut: "2027-05-13" }, adults: 2, children: 1, childAges: [7],
  });

  assert.equal(url.origin, "https://damoon-hotel.ir");
  assert.equal(url.pathname, "/fa/hotel-reservations/start");
  assert.equal(url.searchParams.get("property"), "damoon-hotel");
  assert.equal(url.searchParams.get("checkIn"), "2027-05-10");
  assert.equal(url.searchParams.get("checkOut"), "2027-05-13");
  assert.equal(url.searchParams.get("adults"), "2");
  assert.equal(url.searchParams.get("children"), "1");
  assert.equal(url.searchParams.get("childAges"), "7");
  assert.equal(url.searchParams.get("campaign"), "preview");
  assert.equal([...url.searchParams.keys()].some((key) => /name|phone|payment|organizationId|propertyId/i.test(key)), false);
});

test("reservation entry rejects malformed property slugs", () => {
  assert.throws(() => buildReservationEntryUrl("https://damoon-hotel.ir/fa/hotel-reservations/start", "../other", {
    range: { checkIn: "", checkOut: "" }, adults: 2, children: 0, childAges: [],
  }), TypeError);
});
