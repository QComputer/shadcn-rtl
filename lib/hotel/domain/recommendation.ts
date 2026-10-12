import { bedCapacity } from "@/lib/hotel/domain/stay-dates";
import type {
  HotelAmenityKey,
  RoomTypeAvailability,
  StayPreference,
} from "@/lib/hotel/domain/types";

/**
 * Explainable, deterministic room recommendation.
 *
 * Design constraints that are intentional, not incidental:
 *
 *  - NO personal characteristics. Gender, family/marital status, ethnicity,
 *    religion, disability, age (other than a child age the guest supplied for
 *    an occupancy/pricing rule) and similar attributes are never inputs to
 *    ranking. Ranking may not become a proxy for denial of service, and the
 *    only occupancy data considered is what the guest explicitly asked for.
 *  - NO model dependency. Same input always yields the same output and the
 *    same explanations, so a result can be audited and re-derived later.
 *  - HARD constraints (capacity, availability, required amenities) already
 *    removed a room type upstream in `searchAvailability`. This module only
 *    *ranks* survivors and never re-admits an excluded option.
 *
 * Where accommodation law genuinely requires handling certain information, it
 * belongs in a separate, explicit, consent-driven flow (see the architecture
 * document) — not inside a preference ranking function.
 */

export type RecommendationReasonCode =
  | "ONLY_AVAILABLE_OPTION"
  | "MATCHES_REQUESTED_AMENITIES"
  | "WITHIN_BUDGET"
  | "BEST_AVAILABILITY"
  | "SMALLEST_SUFFICIENT_CAPACITY"
  | "MATCHES_VIEW_PREFERENCE"
  | "FLEXIBLE_CANCELLATION"
  | "FALLBACK_LOWEST_PRICE";

export type RecommendationExplanation = {
  readonly code: RecommendationReasonCode
  /** Human-readable, already-localised by the caller. */
  readonly detail: string
};

export type RoomRecommendation = {
  readonly roomTypeId: string
  readonly rank: number
  readonly score: number
  readonly totalRate: number
  readonly availableRoomCount: number
  readonly reasons: readonly RecommendationExplanation[]
};

export type RecommendationResult = {
  readonly recommendations: readonly RoomRecommendation[]
  /** Rooms excluded before ranking, with the exclusion reason. */
  readonly excluded: ReadonlyArray<{ roomTypeId: string; reason: string }>;
  /** Populated when the query could not be satisfied, for UI messaging. */
  readonly shortfall: string | null;
};

export type RecommendationQuery = {
  readonly guests: number
  readonly adults: number
  readonly children: number
  readonly preferences: StayPreference
  /** Availability window has already been applied to the options. */
  readonly stayLengthNights: number
  readonly now: Date
};

const VIEW_AMENITY: Readonly<Record<NonNullable<StayPreference["viewPreference"]>, HotelAmenityKey>> = {
  sea: "sea_view",
  city: "city_view",
  garden: "garden_view",
  any: "city_view",
};

/**
 * Ranking is a weighted sum of independent, auditable signals. Weights are
 * constants in one place so they can be reviewed by product and legal, and so
 * a change is a reviewable diff rather than a scattered magic number.
 */
const WEIGHTS = {
  requestedAmenityMatch: 40,
  withinBudget: 25,
  availabilityHeadroom: 20,
  capacityEfficiency: 10,
  viewPreferenceMatch: 5,
} as const;

function matchesRequestedAmenities(option: RoomTypeAvailability, preferences: StayPreference): number {
  const requested = [
    ...(preferences.amenities ?? []),
    ...(preferences.accessibilityNeeds ?? []),
  ];
  if (requested.length === 0) return 0;

  const available = new Set(option.roomType.amenities.map((amenity) => amenity.key));
  const matched = requested.filter((key) => available.has(key));
  return matched.length / requested.length;
}

function matchesViewPreference(option: RoomTypeAvailability, preferences: StayPreference): boolean {
  const view = preferences.viewPreference;
  if (!view || view === "any") return false;
  const available = new Set(option.roomType.amenities.map((amenity) => amenity.key));
  return available.has(VIEW_AMENITY[view]);
}

function isRefundable(option: RoomTypeAvailability): boolean {
  return option.ratePlan.isRefundable;
}

export function recommendRooms(input: {
  options: readonly RoomTypeAvailability[];
  query: RecommendationQuery;
}): RecommendationResult {
  const { options, query } = input;
  const excluded: Array<{ roomTypeId: string; reason: string }> = [];
  const candidates: RoomRecommendation[] = [];

  for (const option of options) {
    // Hard gate. A ranking function must never surface an unsellable option.
    if (!option.isAvailable) {
      excluded.push({
        roomTypeId: option.roomType.id,
        reason: option.unavailableNights[0]?.reason ?? "UNAVAILABLE",
      });
      continue;
    }

    const reasons: RecommendationExplanation[] = [];
    let score = 0;

    const amenityMatch = matchesRequestedAmenities(option, query.preferences);
    if (amenityMatch > 0) {
      score += Math.round(WEIGHTS.requestedAmenityMatch * amenityMatch);
      reasons.push({
        code: "MATCHES_REQUESTED_AMENITIES",
        detail: `${Math.round(amenityMatch * 100)}% of your requested amenities`,
      });
    }

    const budget = query.preferences.budgetPerNight;
    if (budget !== undefined) {
      if (option.averageNightlyRate <= budget) {
        score += WEIGHTS.withinBudget;
        reasons.push({ code: "WITHIN_BUDGET", detail: "Within your nightly budget" });
      } else {
        excluded.push({ roomTypeId: option.roomType.id, reason: "ABOVE_BUDGET" });
        continue;
      }
    }

    const headroom = Math.min(option.availableRoomCount, 5);
    if (headroom > 0) {
      score += Math.round(WEIGHTS.availabilityHeadroom * (headroom / 5));
      if (headroom >= 3) {
        reasons.push({ code: "BEST_AVAILABILITY", detail: "Multiple rooms available for your dates" });
      }
    }

    // Prefer the smallest room that comfortably fits the party. Credit is
    // applied comparatively below, once the whole candidate set is known.
    const capacitySlack = option.roomType.maxOccupancy - query.guests;
    if (capacitySlack === 0) {
      score += WEIGHTS.capacityEfficiency;
    }

    if (matchesViewPreference(option, query.preferences)) {
      score += WEIGHTS.viewPreferenceMatch;
      reasons.push({ code: "MATCHES_VIEW_PREFERENCE", detail: "Matches your view preference" });
    }

    if (isRefundable(option) && query.stayLengthNights <= 2) {
      score += WEIGHTS.viewPreferenceMatch;
      reasons.push({ code: "FLEXIBLE_CANCELLATION", detail: "Free cancellation available" });
    }

    candidates.push({
      roomTypeId: option.roomType.id,
      rank: 0,
      score,
      totalRate: option.totalRate,
      availableRoomCount: option.availableRoomCount,
      reasons,
    });
  }

  // Comparative pass: among rooms that actually fit the party, credit the
  // smallest physical bed capacity. Upgrading someone into a larger room they
  // did not ask for is not a benefit, and this cannot be decided per-room.
  const capacityByRoomType = new Map(
    options
      .filter((option) => option.isAvailable)
      .map((option) => [option.roomType.id, bedCapacity(option.roomType.beds)]),
  );
  const capacities = [...capacityByRoomType.values()].filter((value) => value >= query.guests);
  if (capacities.length > 0) {
    const smallest = Math.min(...capacities);
    for (const candidate of candidates) {
      if (capacityByRoomType.get(candidate.roomTypeId) === smallest) {
        const index = candidates.findIndex((entry) => entry.roomTypeId === candidate.roomTypeId);
        candidates[index] = {
          ...candidate,
          score: candidate.score + WEIGHTS.capacityEfficiency,
          reasons: [
            ...candidate.reasons,
            { code: "SMALLEST_SUFFICIENT_CAPACITY", detail: "Right-sized room for your party size" },
          ],
        };
      }
    }
  }

  candidates.sort((left, right) => {
    if (right.score !== left.score) return right.score - left.score;
    if (left.totalRate !== right.totalRate) return left.totalRate - right.totalRate;
    return left.roomTypeId.localeCompare(right.roomTypeId);
  });

  if (candidates.length > 0) {
    if (candidates.length === 1) {
      candidates[0] = {
        ...candidates[0],
        reasons: [...candidates[0].reasons, { code: "ONLY_AVAILABLE_OPTION", detail: "Only room available for these dates" }],
      };
    } else {
      const cheapest = candidates.reduce((best, current) => (current.totalRate < best.totalRate ? current : best));
      if (!cheapest.reasons.some((reason) => reason.code === "WITHIN_BUDGET")) {
        const index = candidates.findIndex((entry) => entry.roomTypeId === cheapest.roomTypeId);
        candidates[index] = {
          ...cheapest,
          reasons: [...cheapest.reasons, { code: "FALLBACK_LOWEST_PRICE", detail: "Lowest total for your dates" }],
        };
      }
    }
  }

  const ranked = candidates.map((entry, index) => ({ ...entry, rank: index + 1 }));

  const shortfall =
    ranked.length === 0
      ? query.preferences.budgetPerNight !== undefined
        ? "No rooms match your dates within the stated budget."
        : "No rooms are available for the selected dates and party size."
      : null;

  return { recommendations: ranked, excluded, shortfall };
}