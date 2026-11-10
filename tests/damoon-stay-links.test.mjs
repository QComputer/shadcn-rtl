import assert from "node:assert/strict";
import test from "node:test";
import { parseChildAges, withStaySelection } from "../sites/damoon/booking-flow.js";

test("child age entry accepts Persian and Arabic digits without accepting unknown or exponent notation", () => {
  assert.deepEqual(parseChildAges(["۷", "١٢"], 2), { ok: true, ages: [7, 12] });
  for (const value of ["", "۱۸", "1e1", "-1", "7.5"]) assert.equal(parseChildAges([value], 1).ok, false, value);
});

test("stay links replace stale occupancy and preserve route, unrelated query and fragment", () => {
  const url = withStaySelection("https://example.test/ar/rooms/double?adults=1&guests=1&children=4&childAges=1,2,3,4&ref=hotel#details", {
    range: { checkIn: "2027-01-12", checkOut: "2027-01-15" }, adults: 3, children: 2, childAges: [7, 12],
  });
  assert.equal(url.pathname, "/ar/rooms/double");
  assert.equal(url.hash, "#details");
  assert.equal(url.searchParams.get("ref"), "hotel");
  assert.equal(url.searchParams.get("adults"), "3");
  assert.equal(url.searchParams.get("guests"), "3");
  assert.equal(url.searchParams.get("children"), "2");
  assert.equal(url.searchParams.get("childAges"), "7,12");
  assert.equal(url.searchParams.get("checkOut"), "2027-01-15");
});

test("partial child ages remain explicitly unknown instead of disappearing or becoming zero", () => {
  const url = withStaySelection("https://example.test/en/rooms", {
    range: { checkIn: "2027-01-12", checkOut: "" }, adults: 2, children: 3, childAges: [7, "", 18],
  });
  assert.equal(url.searchParams.get("childAges"), "7,,");
  assert.equal(url.searchParams.has("checkOut"), false);
});

test("removing children clears stale ages from shared links", () => {
  const url = withStaySelection("https://example.test/contact?room=double&children=2&childAges=7,12", {
    range: { checkIn: "", checkOut: "" }, guests: 2, children: 0, childAges: [7, 12],
  });
  assert.equal(url.searchParams.get("room"), "double");
  assert.equal(url.searchParams.get("children"), "0");
  assert.equal(url.searchParams.has("childAges"), false);
});
