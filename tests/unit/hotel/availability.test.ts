import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  planRoomNightAllocation,
  searchAvailability,
  sellableUnitsForNight,
  type InventoryNightInput,
} from "../../../lib/hotel/domain/availability";
import type {
  HotelProperty,
  InventoryNight,
  RatePlan,
  RoomType,
} from "../../../lib/hotel/domain/types";

function night(
  roomTypeId: string,
  date: string,
  allotment: number,
  booked = 0,
  held = 0,
): InventoryNight {
  return { scope: { kind: "ROOM_TYPE", roomTypeId }, date, allotment, booked, held };
}

function roomType(input: Partial<RoomType> & Pick<RoomType, "id" | "name">): RoomType {
  return {
    propertyId: "prop_1",
    slug: "standard",
    capacity: { maxAdults: 2, maxChildren: 1, maxOccupancy: 3 },
    beds: [{ kind: "queen", count: 1 }],
    amenities: [{ key: "wifi", label: "Wi-Fi" }],
    maxOccupancy: 3,
    isActive: true,
    ...input,
  };
}

function ratePlan(input: Partial<RatePlan> & Pick<RatePlan, "id" | "roomTypeId">): RatePlan {
  return {
    propertyId: "prop_1",
    code: "FLEX",
    name: "Flexible",
    baseNightlyRate: 1_000_000,
    currency: "TOMAN",
    mealPlan: "none",
    minNights: 1,
    maxNights: 0,
    isRefundable: true,
    isActive: true,
    ...input,
  };
}

const property: HotelProperty = {
  id: "prop_1",
  organizationId: "org_1",
  slug: "damoon-hotel",
  name: "Damoon",
  timezone: "Asia/Tehran",
  currency: "TOMAN",
  checkInTime: "14:00",
  checkOutTime: "11:00",
  minStayNights: 1,
  maxStayNights: 30,
  policies: {
    key: "flexible",
    name: "Flexible",
    freeCancellationCutoffHours: 48,
    fullCancellationRetention: 0,
    description: "",
  },
};

const nights = ["2026-03-21", "2026-03-22", "2026-03-23"];

describe("inventory arithmetic", () => {
  it("subtracts bookings and holds from the allotment", () => {
    assert.equal(sellableUnitsForNight(night("rt1", "2026-03-21", 5, 2, 1)), 2);
  });

  it("never returns negative sellable units", () => {
    assert.equal(sellableUnitsForNight(night("rt1", "2026-03-21", 2, 5, 0)), 0);
  });

  it("treats a missing inventory row as nothing sellable", () => {
    assert.equal(sellableUnitsForNight(undefined), 0);
  });

  it("blocks sale when the night is closed to arrival or departure", () => {
    const closedArrival: InventoryNight = { ...night("rt1", "2026-03-21", 5), closedToArrival: true };
    assert.equal(sellableUnitsForNight(closedArrival), 0);
  });

  it("keeps an infinite allotment sellable", () => {
    assert.equal(sellableUnitsForNight(night("rt1", "2026-03-21", Infinity)), Infinity);
  });
});

describe("multi-night room night allocation", () => {
  const inventory = (rows: InventoryNight[]): InventoryNightInput[] => [{ roomTypeId: "rt1", nights: rows }];

  it("allocates when every night of the stay is open", () => {
    const plan = planRoomNightAllocation({
      window: { checkIn: "2026-03-21", checkOut: "2026-03-24" },
      requestedRoomTypeIds: ["rt1"],
      inventoryByRoomType: inventory(nights.map((date) => night("rt1", date, 4))),
    });
    assert.equal(plan.isAllocatable, true);
    assert.equal(plan.isAllocatable && plan.plans[0].nights.length, 3);
  });

  it("refuses the whole stay when a single night is sold out", () => {
    const plan = planRoomNightAllocation({
      window: { checkIn: "2026-03-21", checkOut: "2026-03-24" },
      requestedRoomTypeIds: ["rt1"],
      inventoryByRoomType: inventory([
        night("rt1", "2026-03-21", 4),
        night("rt1", "2026-03-22", 0, 4, 0),
        night("rt1", "2026-03-23", 4),
      ]),
    });
    assert.equal(plan.isAllocatable, false);
    assert.deepEqual(
      plan.isAllocatable === false && plan.blockingNights.map((entry) => entry.date),
      ["2026-03-22"],
    );
  });

  it("counts live holds against availability", () => {
    const plan = planRoomNightAllocation({
      window: { checkIn: "2026-03-21", checkOut: "2026-03-22" },
      requestedRoomTypeIds: ["rt1"],
      inventoryByRoomType: inventory([night("rt1", "2026-03-21", 1, 0, 1)]),
    });
    assert.equal(plan.isAllocatable, false);
  });

  it("takes the minimum across nights, not the maximum", () => {
    const plan = planRoomNightAllocation({
      window: { checkIn: "2026-03-21", checkOut: "2026-03-24" },
      requestedRoomTypeIds: ["rt1"],
      inventoryByRoomType: inventory([
        night("rt1", "2026-03-21", 9),
        night("rt1", "2026-03-22", 1, 0, 0),
        night("rt1", "2026-03-23", 9),
      ]),
    });
    assert.equal(plan.isAllocatable && plan.plans[0].minAvailableUnits, 1);
  });

  it("rejects an inverted window", () => {
    const plan = planRoomNightAllocation({
      window: { checkIn: "2026-03-24", checkOut: "2026-03-21" },
      requestedRoomTypeIds: ["rt1"],
      inventoryByRoomType: [],
    });
    assert.equal(plan.isAllocatable, false);
  });
});

describe("availability search", () => {
  const baseQuery = {
    propertyId: "prop_1",
    window: { checkIn: "2026-03-21", checkOut: "2026-03-24" },
    occupancy: { adults: 2, children: 0 },
  };

  it("offers a sellable room type with the correct nightly breakdown", () => {
    const result = searchAvailability({
      query: baseQuery,
      property,
      roomTypes: [roomType({ id: "rt1", name: "Suite" })],
      ratePlans: [ratePlan({ id: "rp1", roomTypeId: "rt1", baseNightlyRate: 2_000_000 })],
      seasonalRates: [],
      inventoryByRoomType: [{ roomTypeId: "rt1", nights: nights.map((date) => night("rt1", date, 5)) }],
    });

    assert.equal(result.nightCount, 3);
    assert.equal(result.options.length, 1);
    assert.equal(result.options[0].isAvailable, true);
    assert.equal(result.options[0].totalRate, 6_000_000);
    assert.deepEqual(result.options[0].nightlyRates, [2_000_000, 2_000_000, 2_000_000]);
  });

  it("applies a date-specific rate to only the night it covers", () => {
    const result = searchAvailability({
      query: baseQuery,
      property,
      roomTypes: [roomType({ id: "rt1", name: "Suite" })],
      ratePlans: [ratePlan({ id: "rp1", roomTypeId: "rt1", baseNightlyRate: 2_000_000 })],
      seasonalRates: [
        { id: "sr1", ratePlanId: "rp1", from: "2026-03-22", to: "2026-03-22", nightlyRate: 3_000_000 },
      ],
      inventoryByRoomType: [{ roomTypeId: "rt1", nights: nights.map((date) => night("rt1", date, 5)) }],
    });

    assert.deepEqual(result.options[0].nightlyRates, [2_000_000, 3_000_000, 2_000_000]);
    assert.equal(result.options[0].totalRate, 7_000_000);
  });

  it("marks a room type unavailable when any night is sold out but still returns it", () => {
    const result = searchAvailability({
      query: baseQuery,
      property,
      roomTypes: [roomType({ id: "rt1", name: "Suite" })],
      ratePlans: [ratePlan({ id: "rp1", roomTypeId: "rt1" })],
      seasonalRates: [],
      inventoryByRoomType: [
        {
          roomTypeId: "rt1",
          nights: [night("rt1", "2026-03-21", 5), night("rt1", "2026-03-22", 0, 5, 0), night("rt1", "2026-03-23", 5)],
        },
      ],
    });

    assert.equal(result.options[0].isAvailable, false);
    assert.deepEqual(result.options[0].unavailableNights.map((entry) => entry.date), ["2026-03-22"]);
  });

  it("rejects a room type that cannot physically fit the party", () => {
    // 3 adults fits the overall ceiling of 3 but exceeds the 2-adult limit.
    const result = searchAvailability({
      query: { ...baseQuery, occupancy: { adults: 3, children: 0 } },
      property,
      roomTypes: [roomType({ id: "rt1", name: "Small" })],
      ratePlans: [ratePlan({ id: "rp1", roomTypeId: "rt1" })],
      seasonalRates: [],
      inventoryByRoomType: [{ roomTypeId: "rt1", nights: nights.map((date) => night("rt1", date, 5)) }],
    });

    assert.equal(result.options.length, 0);
    assert.equal(result.rejected[0].reason, "ADULTS_EXCEED_ROOM_CAPACITY");
  });

  it("rejects a room type missing a required amenity", () => {
    const result = searchAvailability({
      query: { ...baseQuery, requiredAmenities: ["pool"] },
      property,
      roomTypes: [roomType({ id: "rt1", name: "NoPool" })],
      ratePlans: [ratePlan({ id: "rp1", roomTypeId: "rt1" })],
      seasonalRates: [],
      inventoryByRoomType: [{ roomTypeId: "rt1", nights: nights.map((date) => night("rt1", date, 5)) }],
    });

    assert.equal(result.options.length, 0);
    assert.equal(result.rejected[0].reason, "MISSING_AMENITIES:pool");
  });

  it("enforces a nightly budget ceiling", () => {
    const result = searchAvailability({
      query: { ...baseQuery, maxNightlyRate: 1_500_000 },
      property,
      roomTypes: [roomType({ id: "rt1", name: "Suite" })],
      ratePlans: [ratePlan({ id: "rp1", roomTypeId: "rt1", baseNightlyRate: 2_000_000 })],
      seasonalRates: [],
      inventoryByRoomType: [{ roomTypeId: "rt1", nights: nights.map((date) => night("rt1", date, 5)) }],
    });

    assert.equal(result.options.length, 0);
    assert.equal(result.rejected[0].reason, "NO_APPLICABLE_RATE_PLAN");
  });

  it("orders available options before unavailable, then cheapest first", () => {
    const result = searchAvailability({
      query: baseQuery,
      property,
      roomTypes: [
        roomType({ id: "rt_exp", name: "Expensive" }),
        roomType({ id: "rt_gone", name: "Gone" }),
        roomType({ id: "rt_cheap", name: "Cheap" }),
      ],
      ratePlans: [
        ratePlan({ id: "rp_exp", roomTypeId: "rt_exp", baseNightlyRate: 5_000_000 }),
        ratePlan({ id: "rp_gone", roomTypeId: "rt_gone", baseNightlyRate: 1_200_000 }),
        ratePlan({ id: "rp_cheap", roomTypeId: "rt_cheap", baseNightlyRate: 2_000_000 }),
      ],
      seasonalRates: [],
      inventoryByRoomType: [
        { roomTypeId: "rt_exp", nights: nights.map((date) => night("rt_exp", date, 5)) },
        { roomTypeId: "rt_gone", nights: [night("rt_gone", "2026-03-21", 5), night("rt_gone", "2026-03-22", 0, 5, 0), night("rt_gone", "2026-03-23", 5)] },
        { roomTypeId: "rt_cheap", nights: nights.map((date) => night("rt_cheap", date, 5)) },
      ],
    });

    assert.deepEqual(result.options.map((option) => option.roomType.id), ["rt_cheap", "rt_exp", "rt_gone"]);
  });

  it("picks the cheapest sellable rate plan for a room type", () => {
    const result = searchAvailability({
      query: baseQuery,
      property,
      roomTypes: [roomType({ id: "rt1", name: "Suite" })],
      ratePlans: [
        ratePlan({ id: "rp_expensive", roomTypeId: "rt1", baseNightlyRate: 4_000_000 }),
        ratePlan({ id: "rp_cheap", roomTypeId: "rt1", baseNightlyRate: 2_500_000 }),
      ],
      seasonalRates: [],
      inventoryByRoomType: [{ roomTypeId: "rt1", nights: nights.map((date) => night("rt1", date, 5)) }],
    });

    assert.equal(result.options[0].ratePlan.id, "rp_cheap");
    assert.equal(result.options[0].totalRate, 7_500_000);
  });

  it("sums physical-room inventory rows when no room-type row exists", () => {
    const result = searchAvailability({
      query: baseQuery,
      property,
      roomTypes: [roomType({ id: "rt1", name: "Suite" })],
      ratePlans: [ratePlan({ id: "rp1", roomTypeId: "rt1" })],
      seasonalRates: [],
      inventoryByRoomType: [
        {
          roomTypeId: "rt1",
          roomIds: ["room_a", "room_b"],
          nights: [
            { scope: { kind: "PHYSICAL_ROOM", roomId: "room_a" }, date: "2026-03-21", allotment: 1, booked: 0, held: 0 },
            { scope: { kind: "PHYSICAL_ROOM", roomId: "room_b" }, date: "2026-03-21", allotment: 1, booked: 0, held: 0 },
            { scope: { kind: "PHYSICAL_ROOM", roomId: "room_a" }, date: "2026-03-22", allotment: 1, booked: 0, held: 0 },
            { scope: { kind: "PHYSICAL_ROOM", roomId: "room_b" }, date: "2026-03-22", allotment: 1, booked: 1, held: 0 },
            { scope: { kind: "PHYSICAL_ROOM", roomId: "room_a" }, date: "2026-03-23", allotment: 1, booked: 0, held: 0 },
            { scope: { kind: "PHYSICAL_ROOM", roomId: "room_b" }, date: "2026-03-23", allotment: 1, booked: 0, held: 0 },
          ],
        },
      ],
    });

    assert.equal(result.options[0].availableRoomCount, 1);
    assert.equal(result.options[0].isAvailable, true);
  });
});