import test from "node:test";
import assert from "node:assert/strict";
import { availableOptions, buildGuestRequestPayload, buildHoldPayload, createIdempotencyKey, formatMoney, holdAttemptFingerprint, parseChildAges, policySummary, requestAttemptFingerprint, validateContact } from "../sites/damoon/booking-flow.js";

test("parseChildAges requires explicit valid ages and never invents defaults", () => {
  assert.deepEqual(parseChildAges([], 0), { ok: true, ages: [] });
  assert.deepEqual(parseChildAges(["3", "10"], 2), { ok: true, ages: [3, 10] });
  assert.equal(parseChildAges(["3"], 2).ok, false);
  assert.equal(parseChildAges(["", "4"], 2).ok, false);
  assert.equal(parseChildAges(["18", "4"], 2).ok, false);
  assert.equal(parseChildAges(["-1", "4"], 2).ok, false);
  assert.equal(parseChildAges([5, 5], 1).ok, false);
  // regression: missing/unknown ages must never be substituted (availability search must block)
  assert.equal(parseChildAges([undefined, 4], 2).ok, false);
  assert.equal(parseChildAges([null, 4], 2).ok, false);
  assert.equal(parseChildAges(["  ", "4"], 2).ok, false);
});

test("validateContact enforces name and phone", () => {
  assert.equal(validateContact({ fullName: "A", phone: "09120000000" }).ok, false);
  assert.equal(validateContact({ fullName: "Ali Reza", phone: "123" }).ok, false);
  const ok = validateContact({ fullName: "Ali Reza", phone: "+98 912 000 0000", email: "a@b.co" });
  assert.equal(ok.ok, true);
  assert.equal(ok.value.fullName, "Ali Reza");
});

test("availableOptions filters unavailable/malformed options", () => {
  const options = availableOptions({ options: [
    { isAvailable: true, roomType: { slug: "std" }, ratePlan: { code: "flex" } },
    { isAvailable: false, roomType: { slug: "no" }, ratePlan: { code: "x" } },
    { isAvailable: true, roomType: {}, ratePlan: { code: "x" } },
  ] });
  assert.equal(options.length, 1);
  assert.equal(options[0].roomType.slug, "std");
});

test("buildHoldPayload uses real option, preserves child ages in occupancy, does not invent child names, and includes reviewed quote/policy fields", () => {
  const payload = buildHoldPayload({
    property: "damoon-hotel",
    range: { checkIn: "2027-09-30", checkOut: "2027-10-02" },
    adults: 2,
    children: 1,
    childAges: [7],
    option: { roomType: { slug: "standard" }, ratePlan: { code: "flex", currency: "TOMAN", cancellationPolicy: { key: "flex-24", version: 3 } }, totalRate: 250000 },
    contact: { fullName: "Guest Name", phone: "09120000000" },
  });
  assert.equal(payload.property, "damoon-hotel");
  assert.equal(payload.roomType, "standard");
  assert.equal(payload.ratePlan, "flex");
  assert.equal(payload.acceptedCancellationPolicyKey, "flex-24");
  assert.equal(payload.acceptedCancellationPolicyVersion, 3);
  assert.equal(payload.acceptedTotalRate, "250000");
  assert.equal(payload.acceptedCurrency, "TOMAN");
  assert.deepEqual(payload.occupancy, { adults: 2, children: 1, childAges: [7] });
  // only primary guest is sent; child ages remain in occupancy (no fabricated dependent names)
  assert.equal(payload.guests.length, 1);
  assert.equal(payload.guests[0].isPrimary, true);
  assert.equal(payload.guests[0].fullName, "Guest Name");
  assert.equal("isChild" in payload.guests[0], false);
});

test("holdAttemptFingerprint is stable for the same attempt and changes for a genuine change", () => {
  const base = {
    property: "damoon-hotel",
    range: { checkIn: "2027-09-30", checkOut: "2027-10-02" },
    adults: 2, children: 1, childAges: [7],
    option: { roomType: { slug: "standard" }, ratePlan: { code: "flex", currency: "TOMAN", cancellationPolicy: { key: "flex-24", version: 3 } }, totalRate: 250000 },
    contact: { fullName: "Guest Name", phone: "09120000000" },
  };
  assert.equal(holdAttemptFingerprint(base), holdAttemptFingerprint({ ...base }));
  assert.notEqual(holdAttemptFingerprint(base), holdAttemptFingerprint({ ...base, childAges: [8] }));
  assert.notEqual(holdAttemptFingerprint(base), holdAttemptFingerprint({ ...base, option: { ...base.option, ratePlan: { ...base.option.ratePlan, code: "nonref" } } }));
  assert.notEqual(holdAttemptFingerprint(base), holdAttemptFingerprint({ ...base, option: { ...base.option, ratePlan: { code: "flex", currency: "TOMAN", cancellationPolicy: { key: "flex-24", version: 4 } } } }));
  assert.notEqual(holdAttemptFingerprint(base), holdAttemptFingerprint({ ...base, option: { ...base.option, totalRate: 260000 } }));
});

test("guest request payload keeps the selected stay and preferences without claiming a reservation", () => {
  const input = {
    property: "damoon-hotel",
    range: { checkIn: "2026-12-01", checkOut: "2026-12-03" },
    adults: 2,
    children: 1,
    childAges: [7],
    option: { roomType: { slug: "double" }, ratePlan: { code: "standard" } },
    contact: { fullName: "Guest Name", phone: "+989121234567", email: "guest@example.test" },
    specialRequests: "Quiet room",
  };
  const payload = buildGuestRequestPayload(input);
  assert.deepEqual(payload.occupancy, { adults: 2, children: 1, childAges: [7] });
  assert.equal(payload.roomType, "double");
  assert.equal(payload.ratePlan, "standard");
  assert.equal(payload.specialRequests, "Quiet room");
  assert.equal("reservation" in payload, false);
  assert.equal("payment" in payload, false);
});

test("guest request idempotency fingerprint changes for guest or preference edits", () => {
  const input = {
    property: "damoon-hotel",
    range: { checkIn: "2026-12-01", checkOut: "2026-12-03" },
    adults: 2, children: 0, childAges: [], option: { roomType: { slug: "double" }, ratePlan: { code: "standard" } },
    contact: { fullName: "Guest Name", phone: "+989121234567", email: "guest@example.test" },
    specialRequests: "Quiet room",
  };
  assert.equal(requestAttemptFingerprint(input), requestAttemptFingerprint({ ...input, contact: { ...input.contact } }));
  assert.notEqual(requestAttemptFingerprint(input), requestAttemptFingerprint({ ...input, specialRequests: "Near elevator" }));
});

test("policySummary exposes full cancellation terms including tiers, cutoff/retention and penalty basis", () => {
  const tiered = policySummary({
    key: "tiered", name: "Tiered", freeCancellationCutoffHours: 48, fullCancellationRetention: 1,
    cancellationTiers: [
      { cutoffHours: 24, retentionBasisPoints: 10000, penaltyBasis: "FIRST_NIGHT" },
      { cutoffHours: 48, retentionBasisPoints: 5000, penaltyBasis: "RESERVATION_TOTAL" },
    ],
  }, "en") || "";
  assert.match(tiered, /24h/);
  assert.match(tiered, /first night/i);
  assert.match(tiered, /48h/);
  assert.match(tiered, /total stay/i);
  assert.match(tiered, /100%/);
  assert.match(tiered, /50%/);
  assert.match(policySummary({ freeCancellationCutoffHours: 24, fullCancellationRetention: 0.5 }, "en") || "", /50% of total stay/);
  assert.match(policySummary({ freeCancellationCutoffHours: 0, fullCancellationRetention: 1 }, "en") || "", /non-refundable/i);
  assert.equal(createIdempotencyKey().startsWith("damoon-"), true);
  assert.match(formatMoney(250000, "TOMAN", "en"), /250,000/);
});
