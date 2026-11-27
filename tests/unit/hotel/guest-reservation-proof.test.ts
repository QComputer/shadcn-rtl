import assert from "node:assert/strict";
import { test } from "node:test";
import { buildHotelGuestReservationProof, HOTEL_GUEST_PROOF_TTL_SECONDS, hotelGuestBrowserCredential, hotelGuestProofCookieName, hotelGuestProofEnabled, hotelGuestProofSetCookie, matchesHotelGuestReservationProof, validHotelGuestReservationProof } from "../../../lib/hotel/domain/guest-reservation-proof";
const scope = { reservationId: "reservation-1", organizationId: "org-a", propertyId: "hotel-a", origin: "https://hotel.example" };
const secret = "synthetic-secret-only-for-hotel-proof-0123456789";
const token = Buffer.alloc(32, 1).toString("base64url");
const wrong = Buffer.alloc(32, 2).toString("base64url");
const phone = "09123456789";
const now = new Date("2026-11-27T10:00:00Z");
const proof = buildHotelGuestReservationProof(scope, token, phone, secret, now)!;
test("capture is default OFF and exact opt-in only", () => {
  assert.equal(hotelGuestProofEnabled({}), false); assert.equal(hotelGuestProofEnabled({ HOTEL_GUEST_CLAIM_PROOF_ENABLED: "true" }), false); assert.equal(hotelGuestProofEnabled({ HOTEL_GUEST_CLAIM_PROOF_ENABLED: "1" }), true);
});
test("record-scoped proof stores neither raw browser token nor phone", () => {
  assert.match(proof.browserDigest, /^[a-f0-9]{64}$/); assert.match(proof.contactDigest, /^[a-f0-9]{64}$/);
  assert.notEqual(proof.browserDigest, proof.contactDigest);
  assert.equal(JSON.stringify(proof).includes(token), false); assert.equal(JSON.stringify(proof).includes(phone), false);
  assert.equal(matchesHotelGuestReservationProof(proof, scope, token, "+989123456789", secret, now), true);
});
test("wrong browser, phone, secret, record, organization, property or origin fail closed", () => {
  assert.equal(matchesHotelGuestReservationProof(proof, scope, wrong, phone, secret, now), false);
  assert.equal(matchesHotelGuestReservationProof(proof, scope, token, "09999999999", secret, now), false);
  assert.equal(matchesHotelGuestReservationProof(proof, scope, token, phone, secret + "different", now), false);
  for (const changed of [{ reservationId: "other" }, { organizationId: "other" }, { propertyId: "other" }, { origin: "https://other.example" }]) assert.equal(matchesHotelGuestReservationProof(proof, { ...scope, ...changed }, token, phone, secret, now), false);
});
test("expiry and malformed capture inputs fail closed", () => {
  assert.equal(matchesHotelGuestReservationProof(proof, scope, token, phone, secret, proof.expiresAt), false);
  assert.equal(matchesHotelGuestReservationProof(proof, scope, token, phone, secret, new Date(now.getTime() - 1)), false);
  assert.equal(buildHotelGuestReservationProof(scope, "short", phone, secret, now), null);
  assert.equal(buildHotelGuestReservationProof(scope, token, phone, "short", now), null);
  assert.equal(buildHotelGuestReservationProof(scope, token, "bad", secret, now), null);
  assert.equal(buildHotelGuestReservationProof({ ...scope, origin: "https://hotel.example/path" }, token, phone, secret, now), null);
});
test("host-only secure cookie, duplicate denial and canonical credentials", () => {
  const name = hotelGuestProofCookieName(scope.origin, true)!;
  assert.equal(name, "__Host-bazarbaaz_hotel_claim");
  assert.equal(hotelGuestProofCookieName("http://hotel.localhost:3000", true), null);
  assert.equal(hotelGuestProofCookieName("http://hotel.localhost:3000", false), "bazarbaaz_hotel_claim_dev");
  assert.equal(hotelGuestProofCookieName("http://hotel.example", false), null);
  const minted = hotelGuestBrowserCredential(null, name)!; assert.equal(minted.minted, true); assert.equal(minted.token.length, 43);
  assert.deepEqual(hotelGuestBrowserCredential(`x=1; ${name}=${token}`, name), { token, minted: false });
  assert.equal(hotelGuestBrowserCredential(`${name}=${token}; ${name}=${wrong}`, name), null);
  assert.equal(hotelGuestBrowserCredential(`${name}=bad`, name), null);
  assert.equal(hotelGuestProofSetCookie(name, token), `${name}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${HOTEL_GUEST_PROOF_TTL_SECONDS}; Secure`);
});
test("persistence envelope permits only new matching held reservations", () => {
  const row = { id: scope.reservationId, organizationId: scope.organizationId, propertyId: scope.propertyId, createdAt: now, holdId: "hold", status: "PENDING_PAYMENT" };
  assert.equal(validHotelGuestReservationProof(proof, row), true);
  assert.equal(validHotelGuestReservationProof(proof, { ...row, holdId: undefined }), false);
  assert.equal(validHotelGuestReservationProof(proof, { ...row, status: "CHECKED_OUT" }), false);
  assert.equal(validHotelGuestReservationProof(proof, { ...row, propertyId: "other" }), false);
});
