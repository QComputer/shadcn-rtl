import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { recommendRooms, type RecommendationQuery } from "../../../lib/hotel/domain/recommendation";
import type { HotelAmenityKey, RoomType, RoomTypeAvailability } from "../../../lib/hotel/domain/types";

function roomType(input: Partial<RoomType> & Pick<RoomType, "id" | "name">): RoomType {
  return {
    propertyId: "prop_1",
    slug: input.id,
    capacity: { maxAdults: 2, maxChildren: 2, maxOccupancy: 4 },
    beds: [{ kind: "queen", count: 1 }, { kind: "single", count: 1 }],
    amenities: [{ key: "wifi", label: "Wi-Fi" }],
    maxOccupancy: 4,
    isActive: true,
    ...input,
  };
}

function availability(input: {
  roomType: RoomType;
  totalRate: number;
  availableRoomCount?: number;
  isAvailable?: boolean;
  amenities?: HotelAmenityKey[];
  refundable?: boolean;
  average?: number;
}): RoomTypeAvailability {
  return {
    roomType: {
      ...input.roomType,
      amenities: (input.amenities ?? ["wifi"]).map((key) => ({ key, label: key })),
    },
    ratePlan: {
      id: `rp_${input.roomType.id}`,
      propertyId: "prop_1",
      roomTypeId: input.roomType.id,
      code: "FLEX",
      name: "Flexible",
      baseNightlyRate: input.totalRate,
      currency: "TOMAN",
      mealPlan: "none",
      minNights: 1,
      maxNights: 0,
      isRefundable: input.refundable ?? true,
      isActive: true,
    },
    nights: ["2026-03-21", "2026-03-22"],
    nightlyRates: [Math.round(input.totalRate / 2), Math.round(input.totalRate / 2)],
    totalRate: input.totalRate,
    averageNightlyRate: input.average ?? Math.round(input.totalRate / 2),
    availableRoomCount: input.availableRoomCount ?? 4,
    isAvailable: input.isAvailable ?? true,
    unavailableNights: [],
  };
}

const query: RecommendationQuery = {
  guests: 2,
  adults: 2,
  children: 0,
  preferences: {},
  stayLengthNights: 2,
  now: new Date("2026-03-20T10:00:00.000Z"),
};

describe("explainable room recommendation", () => {
  it("never surfaces an unavailable option", () => {
    const result = recommendRooms({
      options: [
        availability({ roomType: roomType({ id: "rt_gone", name: "Gone" }), totalRate: 1_000_000, isAvailable: false }),
      ],
      query,
    });

    assert.equal(result.recommendations.length, 0);
    assert.equal(result.excluded[0].reason, "UNAVAILABLE");
    assert.equal(result.shortfall, "No rooms are available for the selected dates and party size.");
  });

  it("ranks deterministically for identical input", () => {
    const options = [
      availability({ roomType: roomType({ id: "rt_b", name: "B" }), totalRate: 2_000_000 }),
      availability({ roomType: roomType({ id: "rt_a", name: "A" }), totalRate: 2_000_000 }),
    ];
    const first = recommendRooms({ options, query });
    const second = recommendRooms({ options: [...options].reverse(), query });

    assert.deepEqual(
      first.recommendations.map((entry) => entry.roomTypeId),
      second.recommendations.map((entry) => entry.roomTypeId),
    );
  });

  it("prefers a room matching requested amenities", () => {
    const result = recommendRooms({
      options: [
        availability({ roomType: roomType({ id: "rt_plain", name: "Plain" }), totalRate: 2_000_000 }),
        availability({
          roomType: roomType({ id: "rt_pool", name: "Pool" }),
          totalRate: 2_000_000,
          amenities: ["wifi", "pool"],
        }),
      ],
      query: { ...query, preferences: { amenities: ["pool"] } },
    });

    assert.equal(result.recommendations[0].roomTypeId, "rt_pool");
    assert.ok(
      result.recommendations[0].reasons.some((reason) => reason.code === "MATCHES_REQUESTED_AMENITIES"),
    );
  });

  it("excludes a room above the stated budget rather than ranking it low", () => {
    const result = recommendRooms({
      options: [
        availability({ roomType: roomType({ id: "rt_cheap", name: "Cheap" }), totalRate: 1_000_000 }),
        availability({ roomType: roomType({ id: "rt_pricey", name: "Pricey" }), totalRate: 9_000_000 }),
      ],
      query: { ...query, preferences: { budgetPerNight: 600_000 } },
    });

    assert.deepEqual(result.recommendations.map((entry) => entry.roomTypeId), ["rt_cheap"]);
    assert.ok(result.excluded.some((entry) => entry.reason === "ABOVE_BUDGET"));
  });

  it("rewards the smallest sufficient room rather than the largest", () => {
    const result = recommendRooms({
      options: [
        availability({
          roomType: roomType({ id: "rt_suite", name: "Suite", maxOccupancy: 6 }),
          totalRate: 8_000_000,
        }),
        availability({ roomType: roomType({ id: "rt_std", name: "Standard" }), totalRate: 3_000_000 }),
      ],
      query,
    });

    assert.ok(
      result.recommendations[0].reasons.some((reason) => reason.code === "SMALLEST_SUFFICIENT_CAPACITY"),
      "right-sized room should be credited",
    );
  });

  it("reports a shortfall when nothing matches the budget", () => {
    const result = recommendRooms({
      options: [availability({ roomType: roomType({ id: "rt_pricey", name: "Pricey" }), totalRate: 9_000_000 })],
      query: { ...query, preferences: { budgetPerNight: 100_000 } },
    });

    assert.equal(result.recommendations.length, 0);
    assert.equal(result.shortfall, "No rooms match your dates within the stated budget.");
  });

  it("explains a single remaining option", () => {
    const result = recommendRooms({
      options: [availability({ roomType: roomType({ id: "rt_only", name: "Only" }), totalRate: 2_000_000 })],
      query,
    });

    assert.ok(result.recommendations[0].reasons.some((reason) => reason.code === "ONLY_AVAILABLE_OPTION"));
  });

  it("assigns contiguous ranks starting at one", () => {
    const result = recommendRooms({
      options: [
        availability({ roomType: roomType({ id: "rt_a", name: "A" }), totalRate: 3_000_000 }),
        availability({ roomType: roomType({ id: "rt_b", name: "B" }), totalRate: 2_000_000 }),
        availability({ roomType: roomType({ id: "rt_c", name: "C" }), totalRate: 1_000_000 }),
      ],
      query,
    });

    assert.deepEqual(result.recommendations.map((entry) => entry.rank), [1, 2, 3]);
  });

  it("breaks a score tie on price, not on guest attributes", () => {
    const result = recommendRooms({
      options: [
        availability({ roomType: roomType({ id: "rt_dear", name: "Dear" }), totalRate: 5_000_000 }),
        availability({ roomType: roomType({ id: "rt_worth", name: "Worth" }), totalRate: 2_000_000 }),
      ],
      query,
    });

    assert.equal(result.recommendations[0].roomTypeId, "rt_worth");
  });

  it("only ever emits known explanation codes", () => {
    const known = new Set([
      "ONLY_AVAILABLE_OPTION",
      "MATCHES_REQUESTED_AMENITIES",
      "WITHIN_BUDGET",
      "BEST_AVAILABILITY",
      "SMALLEST_SUFFICIENT_CAPACITY",
      "MATCHES_VIEW_PREFERENCE",
      "FLEXIBLE_CANCELLATION",
      "FALLBACK_LOWEST_PRICE",
    ]);

    const result = recommendRooms({
      options: [
        availability({
          roomType: roomType({ id: "rt_a", name: "A" }),
          totalRate: 2_000_000,
          amenities: ["wifi", "sea_view", "spa"],
        }),
      ],
      query: {
        ...query,
        preferences: { amenities: ["spa"], viewPreference: "sea", budgetPerNight: 500_000 },
      },
    });

    for (const recommendation of result.recommendations) {
      for (const reason of recommendation.reasons) {
        assert.ok(known.has(reason.code), `unexpected reason code: ${reason.code}`);
      }
    }
  });
});