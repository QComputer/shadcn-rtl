import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  recommendRoomConfigurations,
  type RoomConfigurationCandidate,
} from "../../../lib/hotel/domain/room-configuration-recommendation";
import type { Occupancy } from "../../../lib/hotel/domain/types";

function room(input: Partial<RoomConfigurationCandidate> & Pick<RoomConfigurationCandidate, "roomTypeId">): RoomConfigurationCandidate {
  return {
    capacity: { maxAdults: 2, maxChildren: 2, maxOccupancy: 4 },
    maxOccupancy: 4,
    beds: [{ kind: "queen", count: 1 }, { kind: "single", count: 2 }],
    amenities: [],
    policy: { status: "APPROVED", childAgeTreatment: "AGE_INDEPENDENT" },
    ...input,
  };
}

const oneAdult: Occupancy = { adults: 1, children: 0 };

describe("policy-based room configuration recommendation", () => {
  it("recommends a room for one adult within declared capacity", () => {
    const result = recommendRoomConfigurations({ occupancy: oneAdult, candidates: [room({ roomTypeId: "standard" })] });
    assert.equal(result.status, "RECOMMENDATIONS_AVAILABLE");
    assert.equal(result.recommendations[0].roomTypeId, "standard");
  });

  it("supports multiple adults within declared capacity", () => {
    const result = recommendRoomConfigurations({
      occupancy: { adults: 2, children: 0 }, candidates: [room({ roomTypeId: "standard" })],
    });
    assert.equal(result.recommendations.length, 1);
  });

  it("reports total occupancy exceeded", () => {
    const result = recommendRoomConfigurations({
      occupancy: { adults: 2, children: 2 }, candidates: [room({ roomTypeId: "small", capacity: { maxAdults: 2, maxChildren: 2, maxOccupancy: 3 }, maxOccupancy: 3 })],
    });
    assert.deepEqual(result.evaluations[0].reasonCodes, ["TOTAL_CAPACITY_EXCEEDED"]);
  });

  it("reports adult capacity exceeded independently", () => {
    const result = recommendRoomConfigurations({
      occupancy: { adults: 3, children: 0 }, candidates: [room({ roomTypeId: "adult-limited", capacity: { maxAdults: 2, maxChildren: 2, maxOccupancy: 4 }, maxOccupancy: 4 })],
    });
    assert.deepEqual(result.evaluations[0].reasonCodes, ["ADULT_CAPACITY_EXCEEDED"]);
  });

  it("reports child capacity exceeded independently", () => {
    const result = recommendRoomConfigurations({
      occupancy: { adults: 1, children: 3 }, candidates: [room({ roomTypeId: "child-limited", capacity: { maxAdults: 3, maxChildren: 2, maxOccupancy: 5 }, maxOccupancy: 5 })],
    });
    assert.deepEqual(result.evaluations[0].reasonCodes, ["CHILD_CAPACITY_EXCEEDED"]);
  });

  it("reports insufficient physical bed capacity", () => {
    const result = recommendRoomConfigurations({
      occupancy: { adults: 3, children: 0 }, candidates: [room({ roomTypeId: "two-beds", capacity: { maxAdults: 4, maxChildren: 2, maxOccupancy: 4 }, maxOccupancy: 4, beds: [{ kind: "double", count: 1 }] })],
    });
    assert.deepEqual(result.evaluations[0].reasonCodes, ["BED_CAPACITY_INSUFFICIENT"]);
  });

  it("uses explicitly classified children and does not infer age thresholds", () => {
    const result = recommendRoomConfigurations({
      occupancy: { adults: 2, children: 1, childAges: [7] }, candidates: [room({ roomTypeId: "family" })],
    });
    assert.equal(result.evaluations[0].eligibility, "COMPATIBLE");
  });

  it("requires age policy when supplied ages could affect eligibility", () => {
    const result = recommendRoomConfigurations({
      occupancy: { adults: 1, children: 1, childAges: [4] },
      candidates: [room({ roomTypeId: "unknown-age-rule", policy: { status: "APPROVED" } })],
    });
    assert.equal(result.status, "REVIEW_REQUIRED");
    assert.deepEqual(result.evaluations[0].reasonCodes, ["CHILD_AGE_POLICY_MISSING"]);
  });

  it("requires an explicit age-independent policy for children even when ages are omitted", () => {
    const result = recommendRoomConfigurations({
      occupancy: { adults: 1, children: 1 },
      candidates: [room({ roomTypeId: "unknown-child-policy", policy: { status: "APPROVED" } })],
    });
    assert.equal(result.evaluations[0].eligibility, "REVIEW_REQUIRED");
    assert.ok(result.evaluations[0].reasonCodes.includes("CHILD_AGE_POLICY_MISSING"));
  });

  it("distinguishes complete from missing occupancy policy", () => {
    const result = recommendRoomConfigurations({
      occupancy: oneAdult,
      candidates: [room({ roomTypeId: "known" }), room({ roomTypeId: "unknown", policy: null })],
    });
    assert.equal(result.recommendations.length, 1);
    assert.equal(result.evaluations[1].eligibility, "REVIEW_REQUIRED");
    assert.ok(result.evaluations[1].reasonCodes.includes("OCCUPANCY_POLICY_MISSING"));
    assert.equal(result.reviewRequired, true);
  });

  it("marks conflicting policy as review-required", () => {
    const result = recommendRoomConfigurations({
      occupancy: oneAdult, candidates: [room({ roomTypeId: "conflict", policy: { status: "CONFLICTING" } })],
    });
    assert.deepEqual(result.evaluations[0].reasonCodes, ["OCCUPANCY_POLICY_CONFLICTING"]);
  });

  it("marks malformed policy values for review", () => {
    const invalidPolicy = { status: "APPROVED", childAgeTreatment: "AGE_THRESHOLD" } as unknown as RoomConfigurationCandidate["policy"];
    const result = recommendRoomConfigurations({
      occupancy: oneAdult, candidates: [room({ roomTypeId: "malformed-policy", policy: invalidPolicy })],
    });
    assert.equal(result.evaluations[0].eligibility, "REVIEW_REQUIRED");
    assert.ok(result.evaluations[0].reasonCodes.includes("CHILD_AGE_POLICY_REVIEW_REQUIRED"));
  });

  it("marks invalid or contradictory capacity as review-required", () => {
    const invalid = recommendRoomConfigurations({
      occupancy: oneAdult,
      candidates: [room({ roomTypeId: "invalid", capacity: { maxAdults: 0, maxChildren: 0, maxOccupancy: 0 } })],
    });
    assert.ok(invalid.evaluations[0].reasonCodes.includes("ROOM_CAPACITY_INVALID"));
    const conflict = recommendRoomConfigurations({
      occupancy: oneAdult, candidates: [room({ roomTypeId: "copy-conflict", maxOccupancy: 3 })],
    });
    assert.deepEqual(conflict.evaluations[0].reasonCodes, ["ROOM_CAPACITY_CONFLICT"]);
  });

  it("returns compatible and incompatible categories separately", () => {
    const result = recommendRoomConfigurations({
      occupancy: oneAdult,
      candidates: [
        room({ roomTypeId: "ok", amenities: ["wheelchair_accessible"] }),
        room({ roomTypeId: "not-wheelchair", amenities: [] }),
      ],
      requirements: { wheelchairAccessible: true },
    });
    assert.deepEqual(result.recommendations.map((item) => item.roomTypeId), ["ok"]);
    assert.equal(result.evaluations[1].eligibility, "INCOMPATIBLE");
  });

  it("returns no-compatible status when all known configurations fail", () => {
    const result = recommendRoomConfigurations({
      occupancy: { adults: 5, children: 0 }, candidates: [room({ roomTypeId: "small", capacity: { maxAdults: 2, maxChildren: 0, maxOccupancy: 2 }, maxOccupancy: 2 })],
    });
    assert.equal(result.status, "NO_COMPATIBLE_CONFIGURATION");
    assert.equal(result.recommendations.length, 0);
  });

  it("orders compatible categories by fit and then stable room ID", () => {
    const input = {
      occupancy: oneAdult,
      candidates: [
        room({ roomTypeId: "z-large", capacity: { maxAdults: 4, maxChildren: 2, maxOccupancy: 6 }, maxOccupancy: 6, beds: [{ kind: "king", count: 2 }] }),
        room({ roomTypeId: "b-fit", capacity: { maxAdults: 2, maxChildren: 1, maxOccupancy: 3 }, maxOccupancy: 3, beds: [{ kind: "single", count: 1 }] }),
        room({ roomTypeId: "a-fit", capacity: { maxAdults: 2, maxChildren: 1, maxOccupancy: 3 }, maxOccupancy: 3, beds: [{ kind: "single", count: 1 }] }),
      ],
    };
    const first = recommendRoomConfigurations(input);
    const second = recommendRoomConfigurations({ ...input, candidates: [...input.candidates].reverse() });
    assert.deepEqual(first.recommendations.map((item) => item.roomTypeId), ["a-fit", "b-fit", "z-large"]);
    assert.deepEqual(first.recommendations, second.recommendations);
    assert.deepEqual(first.recommendations.map((item) => item.rank), [1, 2, 3]);
    assert.ok(first.recommendations[0].reasonCodes.includes("BEST_FIT_CAPACITY"));
  });

  it("does not assume extra-bed support", () => {
    const result = recommendRoomConfigurations({
      occupancy: oneAdult, candidates: [room({ roomTypeId: "room" })], requirements: { extraBed: true },
    });
    assert.equal(result.status, "POLICY_REQUIRED");
    assert.ok(result.evaluations[0].reasonCodes.includes("EXTRA_BED_POLICY_REQUIRED"));
  });

  it("requires an approved allocation policy for multiple rooms", () => {
    const result = recommendRoomConfigurations({
      occupancy: { adults: 3, children: 1 }, candidates: [room({ roomTypeId: "room" })], requirements: { roomCount: 2 },
    });
    assert.equal(result.status, "POLICY_REQUIRED");
    assert.ok(result.evaluations[0].reasonCodes.includes("MULTI_ROOM_POLICY_REQUIRED"));
  });

  it("accepts an explicitly declared wheelchair-accessible amenity", () => {
    const result = recommendRoomConfigurations({
      occupancy: oneAdult,
      candidates: [room({ roomTypeId: "accessible", amenities: ["wheelchair_accessible"] })],
      requirements: { wheelchairAccessible: true },
    });
    assert.equal(result.recommendations[0].roomTypeId, "accessible");
    assert.ok(result.recommendations[0].reasonCodes.includes("WHEELCHAIR_AMENITY_MATCH"));
  });

  it("keeps missing accessibility information unknown", () => {
    const result = recommendRoomConfigurations({
      occupancy: oneAdult, candidates: [room({ roomTypeId: "unknown", amenities: null })],
      requirements: { wheelchairAccessible: true },
    });
    assert.equal(result.status, "REVIEW_REQUIRED");
    assert.ok(result.evaluations[0].reasonCodes.includes("ACCESSIBILITY_INFORMATION_MISSING"));
  });

  it("does not mutate guest, candidate, or nested bed input", () => {
    const guest = Object.freeze({ adults: 1, children: 0 });
    const candidate = Object.freeze(room({
      roomTypeId: "frozen", beds: Object.freeze([{ kind: "single" as const, count: 1 }]),
    }));
    const before = JSON.stringify(candidate);
    recommendRoomConfigurations({ occupancy: guest, candidates: [candidate] });
    assert.equal(JSON.stringify(candidate), before);
  });

  it("uses stable structured reason codes", () => {
    const result = recommendRoomConfigurations({
      occupancy: oneAdult, candidates: [room({ roomTypeId: "missing", policy: null })],
    });
    assert.deepEqual(result.evaluations[0].reasonCodes, ["OCCUPANCY_POLICY_MISSING"]);
    assert.equal(typeof result.evaluations[0].reasonCodes[0], "string");
  });

  it("has no availability or pricing input and returns no commercial claims", () => {
    const result = recommendRoomConfigurations({ occupancy: oneAdult, candidates: [room({ roomTypeId: "advisory" })] });
    assert.deepEqual(Object.keys(result.recommendations[0]).sort(), ["rank", "reasonCodes", "roomCount", "roomTypeId"].sort());
    assert.equal("available" in result.recommendations[0], false);
    assert.equal("price" in result.recommendations[0], false);
    assert.ok(result.recommendations[0].reasonCodes.includes("FITS_DECLARED_OCCUPANCY"));
    assert.ok(result.recommendations[0].reasonCodes.includes("FITS_DECLARED_BEDS"));
  });

  it("rejects malformed guest composition before candidate evaluation", () => {
    const result = recommendRoomConfigurations({
      occupancy: { adults: -1, children: 0 }, candidates: [room({ roomTypeId: "room" })],
    });
    assert.equal(result.status, "INVALID_INPUT");
    assert.ok(result.evaluations[0].reasonCodes.includes("INVALID_GUEST_COMPOSITION"));
  });

  it("rejects duplicate room-category identities deterministically", () => {
    const result = recommendRoomConfigurations({
      occupancy: oneAdult, candidates: [room({ roomTypeId: "dup" }), room({ roomTypeId: "dup" })],
    });
    assert.equal(result.status, "INVALID_INPUT");
    assert.ok(result.evaluations.every((item) => item.reasonCodes.includes("DUPLICATE_ROOM_TYPE")));
  });

  it("marks invalid bed configurations for review instead of computing them", () => {
    const result = recommendRoomConfigurations({
      occupancy: oneAdult, candidates: [room({ roomTypeId: "bad-bed", beds: [{ kind: "single", count: 0 }] })],
    });
    assert.equal(result.evaluations[0].eligibility, "REVIEW_REQUIRED");
    assert.ok(result.evaluations[0].reasonCodes.includes("BED_CONFIGURATION_INVALID"));
  });

  it("does not treat a requested but unlisted accessibility amenity as suitable", () => {
    const result = recommendRoomConfigurations({
      occupancy: oneAdult, candidates: [room({ roomTypeId: "plain", amenities: [] })],
      requirements: { wheelchairAccessible: true },
    });
    assert.equal(result.evaluations[0].eligibility, "INCOMPATIBLE");
    assert.deepEqual(result.evaluations[0].reasonCodes, ["ACCESSIBILITY_AMENITY_NOT_DECLARED"]);
  });
});
