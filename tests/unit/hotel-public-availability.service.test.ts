import assert from "node:assert/strict";
import { test } from "node:test";
import { searchPublicHotelAvailability, serializePublicAvailability } from "@/lib/hotel/services/public-availability.service";

const property = { id: "property-1", organizationId: "org-1", slug: "hotel", name: "Synthetic hotel", timezone: "Asia/Tehran", currency: "TOMAN", checkInTime: "14:00", checkOutTime: "11:00", minStayNights: 1, maxStayNights: 30, policies: { key: "pending", name: "pending", description: "pending", freeCancellationCutoffHours: 0, fullCancellationRetention: 0 } };
const roomType = { id: "room-1", propertyId: "property-1", slug: "standard", name: "Standard", capacity: { maxAdults: 2, maxChildren: 1, maxOccupancy: 3 }, beds: [{ kind: "queen", count: 1 }], amenities: [], maxOccupancy: 3, isActive: true };
const plan = { id: "plan-1", propertyId: "property-1", roomTypeId: "room-1", code: "flex", name: "Flexible", baseNightlyRate: 125000, currency: "TOMAN", mealPlan: "none", minNights: 1, maxNights: 0, isRefundable: true, isActive: true };
const query = { propertyId: "property-1", window: { checkIn: "2027-08-12", checkOut: "2027-08-14" }, occupancy: { adults: 2, children: 0 } };

function repository(overrides: Record<string, unknown> = {}) {
  return {
    findPropertyBySlug: async () => property,
    listRoomTypes: async () => [roomType],
    listRatePlans: async () => [plan],
    listSeasonalRates: async () => [],
    getInventoryNights: async (_scope: unknown, _propertyId: string, _roomTypeIds: readonly string[], nights: readonly string[]) => nights.map((date) => ({ propertyId: "property-1", roomTypeId: "room-1", date, allotment: 2, booked: 0, held: 0, outOfService: 0, closedToArrival: false, closedToDeparture: false })),
    ...overrides,
  } as never;
}

test("returns a TOMAN informational quote without reserving inventory", async () => {
  const result = await searchPublicHotelAvailability({ scope: { organizationId: "org-1" }, propertySlug: "hotel", query }, repository());
  assert.ok(result);
  assert.equal(result.inventoryReserved, false);
  assert.equal(result.options[0]?.totalRate, 250000);
  const serialized = serializePublicAvailability(result);
  assert.equal(serialized.options[0]?.totalRate, "250000");
});

test("uses commitments and out-of-service inventory when determining availability", async () => {
  const result = await searchPublicHotelAvailability({ scope: { organizationId: "org-1" }, propertySlug: "hotel", query }, repository({ getInventoryNights: async () => [
    { propertyId: "property-1", roomTypeId: "room-1", date: "2027-08-12", allotment: 2, booked: 1, held: 1, outOfService: 0, closedToArrival: false, closedToDeparture: false },
    { propertyId: "property-1", roomTypeId: "room-1", date: "2027-08-13", allotment: 2, booked: 0, held: 0, outOfService: 0, closedToArrival: false, closedToDeparture: false },
  ] }));
  assert.equal(result?.options[0]?.isAvailable, false);
  assert.equal(result?.options[0]?.unavailableNights[0]?.reason, "SOLD_OUT");
});

test("rejects over-capacity occupancy and missing nightly rates without mutating state", async () => {
  const oversized = await searchPublicHotelAvailability({ scope: { organizationId: "org-1" }, propertySlug: "hotel", query: { ...query, occupancy: { adults: 3, children: 1 } } }, repository());
  assert.equal(oversized?.options.length, 0);
  assert.match(oversized?.rejected[0]?.reason ?? "", /CAPACITY|OCCUPANCY|BEDS/);
  const noRate = await searchPublicHotelAvailability({ scope: { organizationId: "org-1" }, propertySlug: "hotel", query }, repository({ listRatePlans: async () => [] }));
  assert.equal(noRate?.options.length, 0);
  assert.equal(noRate?.rejected[0]?.reason, "NO_RATE_PLAN");
});

test("does not expose a foreign property through the scoped repository", async () => {
  const result = await searchPublicHotelAvailability({ scope: { organizationId: "org-foreign" }, propertySlug: "hotel", query }, repository({ findPropertyBySlug: async () => null }));
  assert.equal(result, null);
});
