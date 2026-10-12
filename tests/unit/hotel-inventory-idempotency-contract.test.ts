import assert from "node:assert/strict";
import test from "node:test";
import { inventoryAdjustmentSchema } from "@/lib/hotel/validation/management-contracts";

test("inventory adjustment requires a bounded reason and a non-zero integer delta", () => {
  const parsed = inventoryAdjustmentSchema.parse({ roomTypeId: "room-1", date: "2027-01-01", allotmentDelta: 2, reason: "manual correction" });
  assert.equal(parsed.date instanceof Date, true);
  assert.equal(parsed.allotmentDelta, 2);
  assert.throws(() => inventoryAdjustmentSchema.parse({ roomTypeId: "room-1", date: "2027-01-01", reason: "none" }));
  assert.throws(() => inventoryAdjustmentSchema.parse({ roomTypeId: "room-1", date: "2027-01-01", allotmentDelta: 1, organizationId: "other", reason: "spoof" }));
});
