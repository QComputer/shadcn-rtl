import assert from "node:assert/strict";
import test from "node:test";
import { guestPortalHref } from "../../../public/damoon-front/booking-flow.js";

const validMapping = { enabled: true, organizationId: "org-123", propertyId: "prop-456" };
const validSelection = { range: { checkIn: "2027-12-10", checkOut: "2027-12-12" }, guests: 2, children: 0, childAges: [] };
const baseUrl = "https://damoon-hotel.ir/en/contact";

test("guestPortalHref returns correct path for valid same-origin mapping with locale fa", () => {
  const result = guestPortalHref(baseUrl, "fa", validMapping, validSelection);
  assert.equal(result, "/fa/hotel/org-123/prop-456?checkIn=2027-12-10&checkOut=2027-12-12&adults=2&guests=2&children=0");
});

test("guestPortalHref returns correct path for valid same-origin mapping with locale en", () => {
  const result = guestPortalHref(baseUrl, "en", validMapping, validSelection);
  assert.equal(result, "/en/hotel/org-123/prop-456?checkIn=2027-12-10&checkOut=2027-12-12&adults=2&guests=2&children=0");
});

test("guestPortalHref returns correct path for valid same-origin mapping with locale ar", () => {
  const result = guestPortalHref(baseUrl, "ar", validMapping, validSelection);
  assert.equal(result, "/ar/hotel/org-123/prop-456?checkIn=2027-12-10&checkOut=2027-12-12&adults=2&guests=2&children=0");
});

test("guestPortalHref propagates stay-selection query parameters including children and childAges", () => {
  const selectionWithChildren = { range: { checkIn: "2027-12-10", checkOut: "2027-12-12" }, guests: 2, children: 2, childAges: ["5", "8"] };
  const result = guestPortalHref(baseUrl, "en", validMapping, selectionWithChildren);
  assert.ok(result.includes("children=2"));
  assert.ok(result.includes("childAges=5%2C8") || result.includes("childAges=5,8"));
});

test("guestPortalHref rejects invalid mapping (enabled false)", () => {
  const result = guestPortalHref(baseUrl, "en", { enabled: false, organizationId: "org-123", propertyId: "prop-456" }, validSelection);
  assert.equal(result, null);
});

test("guestPortalHref rejects invalid mapping (missing organizationId)", () => {
  const result = guestPortalHref(baseUrl, "en", { enabled: true, organizationId: "", propertyId: "prop-456" }, validSelection);
  assert.equal(result, null);
});

test("guestPortalHref rejects invalid mapping (invalid organizationId format)", () => {
  const result = guestPortalHref(baseUrl, "en", { enabled: true, organizationId: "org@123", propertyId: "prop-456" }, validSelection);
  assert.equal(result, null);
});

test("guestPortalHref rejects invalid mapping (invalid propertyId format)", () => {
  const result = guestPortalHref(baseUrl, "en", { enabled: true, organizationId: "org-123", propertyId: "prop@456" }, validSelection);
  assert.equal(result, null);
});

test("guestPortalHref rejects invalid locale", () => {
  const result = guestPortalHref(baseUrl, "fr", validMapping, validSelection);
  assert.equal(result, null);
});

test("guestPortalHref rejects invalid protocol (ftp)", () => {
  const result = guestPortalHref("ftp://damoon-hotel.ir/en/contact", "en", validMapping, validSelection);
  assert.equal(result, null);
});

test("guestPortalHref rejects URL with username", () => {
  const result = guestPortalHref("https://user@damoon-hotel.ir/en/contact", "en", validMapping, validSelection);
  assert.equal(result, null);
});

test("guestPortalHref rejects URL with password", () => {
  const result = guestPortalHref("https://user:pass@damoon-hotel.ir/en/contact", "en", validMapping, validSelection);
  assert.equal(result, null);
});

test("guestPortalHref rejects malformed URL", () => {
  const result = guestPortalHref("not-a-url", "en", validMapping, validSelection);
  assert.equal(result, null);
});

test("guestPortalHref returns path only (no external origin redirection)", () => {
  const result = guestPortalHref("https://evil.com/en/contact", "en", validMapping, validSelection);
  assert.ok(result.startsWith("/en/hotel/"));
  assert.ok(!result.includes("evil.com"));
});

test("guestPortalHref handles different origin correctly", () => {
  const result = guestPortalHref("https://damoon-hotel.ir/en/contact", "en", validMapping, validSelection);
  assert.ok(result.startsWith("/en/hotel/org-123/prop-456"));
});

test("guestPortalHref uses current URL origin for target", () => {
  const result = guestPortalHref("https://custom-domain.example/en/contact", "en", validMapping, validSelection);
  assert.ok(result.startsWith("/en/hotel/org-123/prop-456"));
});

test("guestPortalHref handles missing range gracefully", () => {
  const selectionNoRange = { range: { checkIn: "", checkOut: "" }, guests: 1, children: 0, childAges: [] };
  const result = guestPortalHref(baseUrl, "en", validMapping, selectionNoRange);
  assert.ok(result.includes("adults=1"));
  assert.ok(result.includes("guests=1"));
  assert.ok(!result.includes("checkIn="));
  assert.ok(!result.includes("checkOut="));
});

test("guestPortalHref handles special characters in organizationId and propertyId", () => {
  const specialMapping = { enabled: true, organizationId: "org_123-abc", propertyId: "prop_456-def" };
  const result = guestPortalHref(baseUrl, "en", specialMapping, validSelection);
  assert.equal(result, "/en/hotel/org_123-abc/prop_456-def?checkIn=2027-12-10&checkOut=2027-12-12&adults=2&guests=2&children=0");
});