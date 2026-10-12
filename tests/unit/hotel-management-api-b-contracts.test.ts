import assert from "node:assert/strict";
import test from "node:test";
import {
  activationSchema,
  createAmenitySchema,
  createCancellationPolicySchema,
  createPhysicalRoomSchema,
  createRatePlanSchema,
  nightlyRateSchema,
  roomTypeAmenitiesSchema,
} from "@/lib/hotel/validation/management-contracts";

test("H3-D2-B management contracts preserve typed service inputs", () => {
  const room = createPhysicalRoomSchema.parse({ roomTypeId: "room-1", code: "101" });
  const amenity = createAmenitySchema.parse({ key: "wifi", label: "Wi-Fi" });
  const plan = createRatePlanSchema.parse({ roomTypeId: "room-1", code: "flex", name: "Flexible", baseNightlyRate: "125000" });
  const rate = nightlyRateSchema.parse({ from: "2027-01-01", to: "2027-01-02", nightlyRate: 125000 });
  const policy = createCancellationPolicySchema.parse({ key: "flex", name: "Flexible", freeCancellationCutoffHours: 24 });
  assert.equal(room.code, "101");
  assert.equal(amenity.key, "wifi");
  assert.equal(plan.baseNightlyRate, BigInt(125000));
  assert.equal(rate.nightlyRate, BigInt(125000));
  assert.equal(policy.freeCancellationCutoffHours, 24);
  assert.deepEqual(activationSchema.parse({ isActive: false }), { isActive: false });
  assert.deepEqual(roomTypeAmenitiesSchema.parse({ amenityIds: ["a", "b"] }), { amenityIds: ["a", "b"] });
});

test("H3-D2-B contracts reject unsupported client authority and invalid ranges", () => {
  assert.throws(() => createPhysicalRoomSchema.parse({ roomTypeId: "r", code: "1", organizationId: "other" }));
  assert.throws(() => createRatePlanSchema.parse({ roomTypeId: "r", code: "x", name: "x", baseNightlyRate: -1 }));
  assert.doesNotThrow(() => nightlyRateSchema.parse({ from: "2027-01-02", to: "2027-01-01" }));
  assert.throws(() => createCancellationPolicySchema.parse({ key: "x", name: "x", freeCancellationCutoffHours: -1 }));
});
