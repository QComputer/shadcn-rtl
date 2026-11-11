import assert from "node:assert/strict";
import test from "node:test";
import { guestPortalHref } from "../sites/damoon/booking-flow.js";

test("guest portal link is same-origin, segment-safe, localized and carries only stay selection", () => {
  const href = guestPortalHref("https://damoon.example/contact?room=suite&ref=campaign#call", "en", {
    enabled: true,
    organizationId: "org_123",
    propertyId: "property-456",
  }, {
    range: { checkIn: "2027-04-12", checkOut: "2027-04-15" },
    adults: 2,
    children: 2,
    childAges: [7, 12],
  });

  assert.equal(href, "/en/hotel/org_123/property-456?checkIn=2027-04-12&checkOut=2027-04-15&adults=2&guests=2&children=2&childAges=7%2C12");
  assert.equal(new URL(href, "https://damoon.example").origin, "https://damoon.example");
  assert.equal(href.includes("campaign"), false);
  assert.equal(href.includes("#call"), false);
});

test("guest portal link refuses external bases, disabled or malformed tenant mappings", () => {
  const mapping = { enabled: true, organizationId: "org1", propertyId: "property1" };
  const stay = { range: {}, adults: 2, children: 0, childAges: [] };
  assert.equal(guestPortalHref("javascript:alert(1)", "fa", mapping, stay), null);
  assert.equal(guestPortalHref("https://damoon.example", "fa", { ...mapping, enabled: false }, stay), null);
  assert.equal(guestPortalHref("https://damoon.example", "fa", { ...mapping, organizationId: "../evil" }, stay), null);
  assert.equal(guestPortalHref("https://damoon.example", "fa", { ...mapping, propertyId: "x?y=1" }, stay), null);
  assert.equal(guestPortalHref("https://damoon.example", "de", mapping, stay), null);
});

test("operational mapping selects the reservation portal without changing request-only links", () => {
  const mapping = { enabled: true, organizationId: "org1", propertyId: "property1" };
  const stay = { range: {}, adults: 2, children: 0, childAges: [] };
  assert.ok(guestPortalHref("https://damoon.example", "ar", {...mapping, mode: "RESERVATION"}, stay).startsWith("/ar/hotel-reservations/org1/property1?"));
  assert.ok(guestPortalHref("https://damoon.example", "fa", {...mapping, mode: "REQUEST_ONLY"}, stay).startsWith("/fa/hotel/org1/property1?"));
});
