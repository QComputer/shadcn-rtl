import { strict as assert } from "node:assert";
import { test } from "node:test";
import { buildHotelRecoveryEvidence, createHotelRecoverySecret, HOTEL_RECOVERY_TTL_MS, matchesHotelRecoveryEvidence } from "../../lib/hotel/domain/guest-recovery-secret";

const scope = { reservationId: "reservation", organizationId: "tenant", propertyId: "property", origin: "https://hotel.example" };
const key = "a sufficiently long test-only secret key";
const now = new Date("2026-01-01T00:00:00Z");
const phone = "09121234567";
const checkOut = new Date("2026-02-01T00:00:00Z");

test("recovery evidence is record-bound, expires independently, and is single-use", () => {
  const credential = createHotelRecoverySecret();
  const proof = buildHotelRecoveryEvidence(scope, credential, phone, key, now, checkOut)!;
  assert.notEqual(proof.secretDigest, credential);
  assert.equal(proof.expiresAt.getTime() - checkOut.getTime(), HOTEL_RECOVERY_TTL_MS);
  const matches = (s = scope, c = credential, p = phone, at = now) => matchesHotelRecoveryEvidence(proof, s, c, p, key, at);
  assert.equal(matches(), true);
  for (const field of ["reservationId", "organizationId", "propertyId", "origin"] as const) assert.equal(matches({ ...scope, [field]: field === "origin" ? "https://other.example" : "other" }), false);
  assert.equal(matches(scope, createHotelRecoverySecret()), false);
  assert.equal(matches(scope, credential, "09121234568"), false);
  assert.equal(matches(scope, credential, phone, proof.expiresAt), false);
  assert.equal(matchesHotelRecoveryEvidence({ ...proof, redeemedAt: now }, scope, credential, phone, key, now), false);
});

test("invalid keys, credentials, origins and phones fail closed", () => {
  const credential = createHotelRecoverySecret();
  assert.equal(buildHotelRecoveryEvidence(scope, credential, phone, "short", now, checkOut), null);
  assert.equal(buildHotelRecoveryEvidence(scope, "bad", phone, key, now, checkOut), null);
  assert.equal(buildHotelRecoveryEvidence({ ...scope, origin: "http://example.com" }, credential, phone, key, now, checkOut), null);
  assert.equal(buildHotelRecoveryEvidence(scope, credential, "invalid", key, now, checkOut), null);
});
