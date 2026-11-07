import test from "node:test";
import assert from "node:assert/strict";
import { availableOptions, buildHoldPayload, createIdempotencyKey, formatMoney, parseChildAges, policySummary, validateContact } from "../sites/damoon/booking-flow.js";

test("parseChildAges requires explicit valid ages and never invents defaults", () => {
  assert.deepEqual(parseChildAges([], 0), { ok: true, ages: [] });
  assert.deepEqual(parseChildAges(["3", "10"], 2), { ok: true, ages: [3, 10] });
  assert.equal(parseChildAges(["3"], 2).ok, false);
  assert.equal(parseChildAges(["", "4"], 2).ok, false);
  assert.equal(parseChildAges(["18", "4"], 2).ok, false);
  assert.equal(parseChildAges(["-1", "4"], 2).ok, false);
  assert.equal(parseChildAges([5, 5], 1).ok, false);
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

test("buildHoldPayload uses real pricing option, occupancy, policy key, and guest details", () => {
  const payload = buildHoldPayload({
    property: "damoon-hotel",
    range: { checkIn: "2027-09-30", checkOut: "2027-10-02" },
    adults: 2,
    children: 1,
    childAges: [7],
    option: { roomType: { slug: "standard" }, ratePlan: { code: "flex", cancellationPolicy: { key: "flex-24" } } },
    contact: { fullName: "Guest Name", phone: "09120000000" },
  });
  assert.equal(payload.property, "damoon-hotel");
  assert.equal(payload.roomType, "standard");
  assert.equal(payload.ratePlan, "flex");
  assert.equal(payload.acceptedCancellationPolicyKey, "flex-24");
  assert.deepEqual(payload.occupancy, { adults: 2, children: 1, childAges: [7] });
  assert.equal(payload.guests.length, 2);
  assert.equal(payload.guests[1].isChild, true);
  assert.equal(payload.guests[1].age, 7);
  assert.equal(payload.guests[0].isPrimary, true);
});

test("formatMoney and policySummary are defensive", () => {
  assert.match(formatMoney(250000, "TOMAN", "en"), /250,000/);
  assert.match(policySummary({ freeCancellationCutoffHours: 24, fullCancellationRetention: 0.5 }, "en") || "", /24/);
  assert.equal(createIdempotencyKey().startsWith("damoon-"), true);
});
