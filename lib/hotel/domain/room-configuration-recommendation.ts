import {
  bedCapacity,
  validateOccupancy,
  validateOccupancyFitsRoom,
} from "@/lib/hotel/domain/stay-dates";
import type {
  BedConfiguration,
  HotelAmenityKey,
  Occupancy,
  RoomCapacity,
} from "@/lib/hotel/domain/types";

/** A caller may mark a policy approved only when it came from an authoritative Hotel source. */
export type RoomConfigurationPolicy =
  | {
      readonly status: "APPROVED";
      /** No age thresholds are inferred. AGE_INDEPENDENT is an explicit Hotel policy. */
      readonly childAgeTreatment?: "AGE_INDEPENDENT" | "REVIEW_REQUIRED";
    }
  | { readonly status: "MISSING" | "CONFLICTING" };

/** Minimal projection of the existing room-category contract; no inventory or price fields. */
export type RoomConfigurationCandidate = {
  readonly roomTypeId: string;
  readonly capacity: RoomCapacity | null;
  /** Retained separately to detect inconsistent copies of the existing RoomType contract. */
  readonly maxOccupancy: number | null;
  readonly beds: readonly BedConfiguration[] | null;
  /** null means the source did not provide an authoritative amenity list. */
  readonly amenities: readonly HotelAmenityKey[] | null;
  readonly policy: RoomConfigurationPolicy | null;
};

export type RoomConfigurationRequirements = {
  readonly roomCount?: number;
  readonly extraBed?: boolean;
  readonly wheelchairAccessible?: boolean;
};

export type RoomConfigurationReasonCode =
  | "ADULT_CAPACITY_EXCEEDED"
  | "CHILD_CAPACITY_EXCEEDED"
  | "TOTAL_CAPACITY_EXCEEDED"
  | "BED_CAPACITY_INSUFFICIENT"
  | "ACCESSIBILITY_AMENITY_NOT_DECLARED"
  | "ACCESSIBILITY_INFORMATION_MISSING"
  | "ROOM_CAPACITY_MISSING"
  | "ROOM_CAPACITY_INVALID"
  | "ROOM_CAPACITY_CONFLICT"
  | "ROOM_TYPE_ID_INVALID"
  | "BED_CONFIGURATION_MISSING"
  | "BED_CONFIGURATION_INVALID"
  | "OCCUPANCY_POLICY_MISSING"
  | "OCCUPANCY_POLICY_CONFLICTING"
  | "CHILD_AGE_POLICY_MISSING"
  | "CHILD_AGE_POLICY_REVIEW_REQUIRED"
  | "EXTRA_BED_POLICY_REQUIRED"
  | "MULTI_ROOM_POLICY_REQUIRED"
  | "INVALID_GUEST_COMPOSITION"
  | "DUPLICATE_ROOM_TYPE"
  | "FITS_DECLARED_OCCUPANCY"
  | "FITS_DECLARED_BEDS"
  | "WHEELCHAIR_AMENITY_MATCH"
  | "BEST_FIT_CAPACITY";

export type RoomConfigurationEligibility = "COMPATIBLE" | "INCOMPATIBLE" | "REVIEW_REQUIRED";

export type RoomConfigurationEvaluation = {
  readonly roomTypeId: string;
  readonly eligibility: RoomConfigurationEligibility;
  readonly reasonCodes: readonly RoomConfigurationReasonCode[];
};

export type CompatibleRoomConfiguration = {
  readonly roomTypeId: string;
  readonly roomCount: 1;
  readonly rank: number;
  readonly reasonCodes: readonly RoomConfigurationReasonCode[];
};

export type RoomConfigurationRecommendationStatus =
  | "RECOMMENDATIONS_AVAILABLE"
  | "NO_COMPATIBLE_CONFIGURATION"
  | "REVIEW_REQUIRED"
  | "POLICY_REQUIRED"
  | "INVALID_INPUT";

export type RoomConfigurationRecommendationResult = {
  readonly status: RoomConfigurationRecommendationStatus;
  readonly recommendations: readonly CompatibleRoomConfiguration[];
  readonly evaluations: readonly RoomConfigurationEvaluation[];
  readonly reviewRequired: boolean;
};

const OCCUPANCY_REASON: Readonly<Record<string, RoomConfigurationReasonCode>> = {
  ADULTS_EXCEED_ROOM_CAPACITY: "ADULT_CAPACITY_EXCEEDED",
  CHILDREN_EXCEED_ROOM_CAPACITY: "CHILD_CAPACITY_EXCEEDED",
  OCCUPANCY_EXCEEDS_ROOM_MAX: "TOTAL_CAPACITY_EXCEEDED",
  NOT_ENOUGH_BEDS: "BED_CAPACITY_INSUFFICIENT",
};

const BED_CAPACITIES: Readonly<Record<BedConfiguration["kind"], number>> = {
  single: 1,
  double: 2,
  queen: 2,
  king: 2,
  sofa: 2,
  bunk: 2,
  crib: 1,
};

function hasValidCapacity(capacity: RoomCapacity): boolean {
  return Number.isInteger(capacity.maxAdults) && capacity.maxAdults >= 1 &&
    Number.isInteger(capacity.maxChildren) && capacity.maxChildren >= 0 &&
    Number.isInteger(capacity.maxOccupancy) && capacity.maxOccupancy >= 1 &&
    capacity.maxOccupancy >= capacity.maxAdults && capacity.maxOccupancy >= capacity.maxChildren;
}

function hasValidBeds(beds: readonly BedConfiguration[]): boolean {
  return beds.every((bed) =>
    bed !== null && typeof bed === "object" &&
    Object.prototype.hasOwnProperty.call(BED_CAPACITIES, bed.kind) &&
    Number.isInteger(bed.count) && bed.count > 0 &&
    (bed.widthCm === undefined || (Number.isInteger(bed.widthCm) && bed.widthCm > 0)),
  );
}

function evaluateCandidate(
  candidate: RoomConfigurationCandidate,
  occupancy: Occupancy,
  requirements: RoomConfigurationRequirements,
): RoomConfigurationEvaluation {
  const review: RoomConfigurationReasonCode[] = [];
  const incompatible: RoomConfigurationReasonCode[] = [];

  if (!candidate.policy || candidate.policy.status === "MISSING") {
    review.push("OCCUPANCY_POLICY_MISSING");
  } else if (candidate.policy.status === "CONFLICTING" || candidate.policy.status !== "APPROVED") {
    review.push("OCCUPANCY_POLICY_CONFLICTING");
  }

  if (!candidate.capacity) {
    review.push("ROOM_CAPACITY_MISSING");
  } else if (!hasValidCapacity(candidate.capacity)) {
    review.push("ROOM_CAPACITY_INVALID");
  }

  if (candidate.capacity) {
    if (candidate.maxOccupancy === null) review.push("ROOM_CAPACITY_MISSING");
    else if (candidate.maxOccupancy !== candidate.capacity.maxOccupancy) review.push("ROOM_CAPACITY_CONFLICT");
  }

  if (!candidate.beds) {
    review.push("BED_CONFIGURATION_MISSING");
  } else if (!hasValidBeds(candidate.beds)) {
    review.push("BED_CONFIGURATION_INVALID");
  }

  if (candidate.policy?.status === "APPROVED" && candidate.policy.childAgeTreatment !== undefined &&
      candidate.policy.childAgeTreatment !== "AGE_INDEPENDENT" &&
      candidate.policy.childAgeTreatment !== "REVIEW_REQUIRED") {
    review.push("CHILD_AGE_POLICY_REVIEW_REQUIRED");
  }

  if (occupancy.childAges?.length && candidate.policy?.status === "APPROVED") {
    if (!candidate.policy.childAgeTreatment) review.push("CHILD_AGE_POLICY_MISSING");
    else if (candidate.policy.childAgeTreatment !== "AGE_INDEPENDENT") {
      review.push("CHILD_AGE_POLICY_REVIEW_REQUIRED");
    }
  }

  if (requirements.wheelchairAccessible) {
    if (candidate.amenities == null) review.push("ACCESSIBILITY_INFORMATION_MISSING");
    else if (!candidate.amenities.includes("wheelchair_accessible")) {
      incompatible.push("ACCESSIBILITY_AMENITY_NOT_DECLARED");
    }
  }

  if (review.length > 0) {
    return { roomTypeId: candidate.roomTypeId, eligibility: "REVIEW_REQUIRED", reasonCodes: review };
  }

  if (candidate.capacity && candidate.beds) {
    const fit = validateOccupancyFitsRoom(occupancy, candidate.capacity, candidate.beds);
    if (!fit.isValid) incompatible.push(OCCUPANCY_REASON[fit.reason] ?? "ROOM_CAPACITY_INVALID");
  }

  if (incompatible.length > 0) {
    return { roomTypeId: candidate.roomTypeId, eligibility: "INCOMPATIBLE", reasonCodes: incompatible };
  }

  return { roomTypeId: candidate.roomTypeId, eligibility: "COMPATIBLE", reasonCodes: [] };
}

/**
 * Deterministic, advisory single-room compatibility. This function deliberately
 * accepts no availability, rate, booking, or persistence inputs.
 */
export function recommendRoomConfigurations(input: {
  readonly occupancy: Occupancy;
  readonly candidates: readonly RoomConfigurationCandidate[];
  readonly requirements?: RoomConfigurationRequirements;
}): RoomConfigurationRecommendationResult {
  const requirements = input.requirements ?? {};
  const occupancyValidation = validateOccupancy(input.occupancy);
  const ids = input.candidates.map((candidate) => candidate.roomTypeId);
  const invalidIdentity = ids.some((id) => typeof id !== "string" || id.trim().length === 0);
  const duplicateIds = new Set(ids).size !== ids.length;

  if (!occupancyValidation.isValid || invalidIdentity || duplicateIds) {
    const reason: RoomConfigurationReasonCode = invalidIdentity
      ? "ROOM_TYPE_ID_INVALID"
      : duplicateIds
      ? "DUPLICATE_ROOM_TYPE"
      : "INVALID_GUEST_COMPOSITION";
    return {
      status: "INVALID_INPUT",
      recommendations: [],
      evaluations: input.candidates.map((candidate) => ({
        roomTypeId: candidate.roomTypeId,
        eligibility: "REVIEW_REQUIRED",
        reasonCodes: [reason],
      })),
      reviewRequired: true,
    };
  }

  if (requirements.roomCount !== undefined && (!Number.isInteger(requirements.roomCount) || requirements.roomCount < 1)) {
    return {
      status: "INVALID_INPUT",
      recommendations: [],
      evaluations: input.candidates.map((candidate) => ({
        roomTypeId: candidate.roomTypeId,
        eligibility: "REVIEW_REQUIRED",
        reasonCodes: ["INVALID_GUEST_COMPOSITION"],
      })),
      reviewRequired: true,
    };
  }

  if (requirements.extraBed === true) {
    const code = "EXTRA_BED_POLICY_REQUIRED" as const;
    return {
      status: "POLICY_REQUIRED",
      recommendations: [],
      evaluations: input.candidates.map((candidate) => ({
        roomTypeId: candidate.roomTypeId,
        eligibility: "REVIEW_REQUIRED",
        reasonCodes: [code],
      })),
      reviewRequired: true,
    };
  }

  if ((requirements.roomCount ?? 1) > 1) {
    return {
      status: "POLICY_REQUIRED",
      recommendations: [],
      evaluations: input.candidates.map((candidate) => ({
        roomTypeId: candidate.roomTypeId,
        eligibility: "REVIEW_REQUIRED",
        reasonCodes: ["MULTI_ROOM_POLICY_REQUIRED"],
      })),
      reviewRequired: true,
    };
  }

  const evaluations = input.candidates.map((candidate) =>
    evaluateCandidate(candidate, input.occupancy, requirements),
  );
  const compatible = evaluations
    .filter((evaluation) => evaluation.eligibility === "COMPATIBLE")
    .map((evaluation) => {
      const candidate = input.candidates.find((entry) => entry.roomTypeId === evaluation.roomTypeId)!;
      const capacitySlack = candidate.capacity!.maxOccupancy - input.occupancy.adults - input.occupancy.children;
      const bedSlack = bedCapacity(candidate.beds!) - input.occupancy.adults - input.occupancy.children;
      return { roomTypeId: candidate.roomTypeId, capacitySlack, bedSlack };
    })
    .sort((left, right) => {
      const capacityOrder = left.capacitySlack - right.capacitySlack;
      if (capacityOrder !== 0) return capacityOrder;
      const bedOrder = left.bedSlack - right.bedSlack;
      if (bedOrder !== 0) return bedOrder;
      return left.roomTypeId < right.roomTypeId ? -1 : left.roomTypeId > right.roomTypeId ? 1 : 0;
    });

  const recommendations: CompatibleRoomConfiguration[] = compatible.map((entry, index) => {
    const reasonCodes: RoomConfigurationReasonCode[] = [
      "FITS_DECLARED_OCCUPANCY",
      "FITS_DECLARED_BEDS",
      "BEST_FIT_CAPACITY",
    ];
    if (requirements.wheelchairAccessible) reasonCodes.push("WHEELCHAIR_AMENITY_MATCH");
    return { roomTypeId: entry.roomTypeId, roomCount: 1, rank: index + 1, reasonCodes };
  });
  const reviewRequired = evaluations.some((evaluation) => evaluation.eligibility === "REVIEW_REQUIRED");
  const status: RoomConfigurationRecommendationStatus = recommendations.length > 0
    ? "RECOMMENDATIONS_AVAILABLE"
    : reviewRequired
      ? "REVIEW_REQUIRED"
      : "NO_COMPATIBLE_CONFIGURATION";

  return { status, recommendations, evaluations, reviewRequired };
}
