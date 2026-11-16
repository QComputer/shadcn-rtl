import assert from "node:assert/strict";
import { test } from "node:test";
import { sellableUnitsForNight } from "@/lib/hotel/domain/availability";
import type { InventoryNight } from "@/lib/hotel/domain/types";

const inventoryNight = (overrides: Partial<InventoryNight> = {}): InventoryNight => ({
  scope: { kind: "ROOM_TYPE", roomTypeId: "room-type-a" },
  date: "2027-08-12",
  allotment: 20,
  booked: 0,
  held: 0,
  outOfService: 0,
  closedToArrival: false,
  closedToDeparture: false,
  ...overrides,
});

test("uses the lower of physical and inventory capacity without double-counting commitments", () => {
  assert.equal(sellableUnitsForNight(inventoryNight({ physicalRoomCapacity: 4 })), 4);
  assert.equal(sellableUnitsForNight(inventoryNight({ booked: 1, held: 1, physicalRoomCapacity: 4 })), 2);
  assert.equal(sellableUnitsForNight(inventoryNight({ booked: 1, held: 1, outOfService: 2, physicalRoomCapacity: 4 })), 2);
  assert.equal(sellableUnitsForNight(inventoryNight({ allotment: 3, outOfService: 1, physicalRoomCapacity: 8 })), 2);
});

test("preserves inventory-only legacy behavior but treats configured zero as sold out", () => {
  assert.equal(sellableUnitsForNight(inventoryNight({ allotment: 7 })), 7);
  assert.equal(sellableUnitsForNight(inventoryNight({ allotment: 7, physicalRoomCapacity: null })), 7);
  assert.equal(sellableUnitsForNight(inventoryNight({ allotment: 7, physicalRoomCapacity: 0 })), 0);
});
