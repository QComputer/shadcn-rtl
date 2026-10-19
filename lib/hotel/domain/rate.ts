import {
  compareStayDates,
  enumerateStayNights,
  stayNightCount,
  validateStayWindow,
} from "@/lib/hotel/domain/stay-dates";
import type {
  CancellationPolicySet,
  HotelProperty,
  RatePlan,
  ReservationCancellationPolicySnapshot,
  SeasonalRate,
  StayDate,
  TomanAmount,
} from "@/lib/hotel/domain/types";

/**
 * Rate resolution. Deterministic and side-effect free.
 *
 * Precedence for a given night, highest first:
 *   1. a matching `SeasonalRate` override
 *   2. the rate plan's `baseNightlyRate`
 *
 * There is no occupancy-based multiplier here on purpose. Per-adult and
 * per-child pricing, if a property ever needs it, is a policy decision that
 * belongs in configuration — never an implicit constant buried in pricing
 * code where it would be invisible and hard to audit.
 */

export type NightlyRateResolution = {
  readonly date: StayDate
  readonly amount: TomanAmount
  readonly source: "SEASONAL" | "BASE"
  readonly seasonalRateId?: string
};

export type RateResolution =
  | {
      readonly isResolved: true;
      readonly nights: readonly NightlyRateResolution[];
      readonly total: TomanAmount;
      readonly reason?: undefined;
    }
  | {
      readonly isResolved: false;
      readonly reason: RateRejectionReason;
      readonly nights?: undefined;
      readonly total?: undefined;
    };

export type RateRejectionReason =
  | "WINDOW_INVALID"
  | "MIN_STAY_NOT_MET"
  | "MAX_STAY_EXCEEDED"
  | "RATE_PLAN_INACTIVE"
  | "RATE_PLAN_OUT_OF_VALIDITY";

export function isRatePlanSellableForWindow(plan: RatePlan, checkIn: StayDate, checkOut: StayDate): boolean {
  if (!plan.isActive) return false;
  // A plan must be valid for the whole stay, not merely the arrival night,
  // otherwise a cheaper plan would be quoted for a stay it cannot honour.
  if (plan.validFrom && compareStayDates(checkIn, plan.validFrom) < 0) return false;
  if (plan.validTo && compareStayDates(checkOut, plan.validTo) > 0) return false;
  return true;
}

function seasonalRatesForNight(
  seasonalRates: readonly SeasonalRate[],
  planId: string,
  date: StayDate,
): SeasonalRate | undefined {
  let best: SeasonalRate | undefined;
  for (const rate of seasonalRates) {
    if (rate.ratePlanId !== planId) continue;
    if (compareStayDates(date, rate.from) < 0) continue;
    if (compareStayDates(date, rate.to) > 0) continue;
    // Narrowest matching window wins so a specific date override beats a
    // broad seasonal band deterministically.
    if (!best || (compareStayDates(rate.from, best.from) > 0 || (rate.from === best.from && compareStayDates(rate.to, best.to) < 0))) {
      best = rate;
    }
  }
  return best;
}

/**
 * The strictest stay-length constraint imposed by any seasonal window that
 * overlaps the requested stay. Without this a peak-season minimum stay could
 * be silently ignored, which would let a guest book a 1-night rate on dates
 * the property requires 3.
 */
function seasonalStayConstraint(
  seasonalRates: readonly SeasonalRate[],
  planId: string,
  checkIn: StayDate,
  checkOut: StayDate,
): { minNights: number; maxNights: number } {
  let minNights = 0;
  let maxNights = 0;

  for (const rate of seasonalRates) {
    if (rate.ratePlanId !== planId) continue;
    // Overlap test on `[from, to]` against `[checkIn, checkOut)`.
    if (compareStayDates(checkOut, rate.from) <= 0) continue;
    if (compareStayDates(rate.to, checkIn) < 0) continue;
    if (typeof rate.minNights === "number") minNights = Math.max(minNights, rate.minNights);
    if (typeof rate.maxNights === "number") maxNights = Math.max(maxNights, rate.maxNights);
  }

  return { minNights, maxNights };
}

export function resolveNightlyRatesForWindow(input: {
  property: HotelProperty;
  ratePlan: RatePlan;
  seasonalRates: readonly SeasonalRate[];
  checkIn: StayDate;
  checkOut: StayDate;
}): RateResolution {
  const { property, ratePlan, seasonalRates, checkIn, checkOut } = input;

  const seasonalConstraint = seasonalStayConstraint(seasonalRates, ratePlan.id, checkIn, checkOut);

  // Minimums compose by taking the strictest; maximums also compose by taking
  // the strictest (the smallest positive ceiling), because a property-level cap
  // must never be widened by a permissive rate plan.
  const effectiveMinNights = Math.max(property.minStayNights, ratePlan.minNights, seasonalConstraint.minNights);
  const maxCandidates = [property.maxStayNights, ratePlan.maxNights, seasonalConstraint.maxNights].filter(
    (value) => value > 0,
  );
  const effectiveMaxNights = maxCandidates.length > 0 ? Math.min(...maxCandidates) : 0;

  const windowCheck = validateStayWindow(checkIn, checkOut, {
    minNights: effectiveMinNights,
    maxNights: effectiveMaxNights,
  });
  if (!windowCheck.isValid) {
    const reason: RateRejectionReason =
      windowCheck.reason === "MIN_STAY_NOT_MET"
        ? "MIN_STAY_NOT_MET"
        : windowCheck.reason === "MAX_STAY_EXCEEDED"
          ? "MAX_STAY_EXCEEDED"
          : "WINDOW_INVALID";
    return { isResolved: false, reason };
  }

  if (!ratePlan.isActive) return { isResolved: false, reason: "RATE_PLAN_INACTIVE" };
  if (!isRatePlanSellableForWindow(ratePlan, checkIn, checkOut)) {
    return { isResolved: false, reason: "RATE_PLAN_OUT_OF_VALIDITY" };
  }

  const nights = enumerateStayNights(checkIn, checkOut);
  const resolved: NightlyRateResolution[] = nights.map((date) => {
    const seasonal = seasonalRatesForNight(seasonalRates, ratePlan.id, date);
    if (seasonal && typeof seasonal.nightlyRate === "number") {
      return {
        date,
        amount: seasonal.nightlyRate,
        source: "SEASONAL" as const,
        seasonalRateId: seasonal.id,
      };
    }
    return { date, amount: ratePlan.baseNightlyRate, source: "BASE" as const };
  });

  const total = resolved.reduce((sum, night) => sum + night.amount, 0);
  return { isResolved: true, nights: resolved, total };
}

export function averageNightlyRate(total: TomanAmount, checkIn: StayDate, checkOut: StayDate): TomanAmount {
  const nights = stayNightCount(checkIn, checkOut);
  if (nights <= 0) return 0;
  return Math.round(total / nights);
}

/**
 * Cancellation outcome for a reservation cancelled at `cancelledAt`.
 * Pure and clock-injected so policy behaviour is deterministic under test.
 *
 * Design rules:
 *  - The `policy` passed in MUST be the reservation's frozen snapshot, not the
 *    hotel's current live policy. Editing terms after booking must not change
 *    an existing guest's penalty.
 *  - `checkInAt` MUST come from `resolvePropertyInstant` (property-local date
 *    and `HH:mm` + IANA zone), never from parsing an ISO date string.
 *  - Fails closed: a missing or numerically invalid policy retains the full
 *    amount rather than refunding on an assumption.
 *  - Money stays integral and the refund is clamped to `[0, totalAmount]`, so
 *    a negative total or an out-of-range retention can never produce a
 *    negative or over-refund.
 */
export type CancellationQuote = {
  readonly policyKey: string
  readonly isFreeCancellation: boolean
  readonly refundableAmount: TomanAmount
  readonly retainedAmount: TomanAmount
  readonly reason:
    | "FREE_CANCELLATION"
    | "PARTIAL_RETENTION"
    | "NON_REFUNDABLE"
    | "CANCELLATION_NOT_PERMITTED"
    | "INVALID_POLICY"
};

function isUsableCancellationPolicy(
  policy: CancellationPolicySet | ReservationCancellationPolicySnapshot | null | undefined,
): policy is CancellationPolicySet {
  if (!policy) return false;
  if (typeof policy.key !== "string" || policy.key.length === 0) return false;
  const cutoff = policy.freeCancellationCutoffHours;
  const retention = policy.fullCancellationRetention;
  if (typeof cutoff !== "number" || !Number.isFinite(cutoff) || cutoff < 0) return false;
  if (typeof retention !== "number" || !Number.isFinite(retention) || retention < 0 || retention > 1) return false;
  if (policy.cancellationTiers !== undefined && policy.cancellationTiers.some((tier) => !Number.isSafeInteger(tier.cutoffHours) || tier.cutoffHours < 0 || !Number.isSafeInteger(tier.retentionBasisPoints) || tier.retentionBasisPoints < 0 || tier.retentionBasisPoints > 10000 || !["RESERVATION_TOTAL", "FIRST_NIGHT"].includes(tier.penaltyBasis))) return false;
  return true;
}

export function quoteCancellation(input: {
  totalAmount: TomanAmount
  cancelledAt: Date
  checkInAt: Date
  firstNightAmount?: TomanAmount
  policy: CancellationPolicySet | ReservationCancellationPolicySnapshot | null | undefined
}): CancellationQuote {
  const { totalAmount, cancelledAt, checkInAt, policy } = input;

  const total = Number.isFinite(totalAmount) && totalAmount > 0 ? Math.round(totalAmount) : 0;
  const policyKey = typeof policy?.key === "string" ? policy.key : "";

  if (!isUsableCancellationPolicy(policy)) {
    return {
      policyKey,
      isFreeCancellation: false,
      refundableAmount: 0,
      retainedAmount: total,
      reason: policy ? "INVALID_POLICY" : "CANCELLATION_NOT_PERMITTED",
    };
  }

  const hoursBeforeCheckIn = (checkInAt.getTime() - cancelledAt.getTime()) / 3_600_000;

  const tier = policy.cancellationTiers?.find((candidate) => hoursBeforeCheckIn < candidate.cutoffHours);
  if (tier) {
    const basis = tier.penaltyBasis === "FIRST_NIGHT" ? Math.max(0, Math.round(input.firstNightAmount ?? 0)) : total;
    const retainedAmount = Math.min(total, Math.max(0, Math.round(basis * tier.retentionBasisPoints / 10000)));
    return { policyKey: policy.key, isFreeCancellation: retainedAmount === 0, refundableAmount: total - retainedAmount, retainedAmount, reason: retainedAmount === 0 ? "FREE_CANCELLATION" : retainedAmount === total ? "NON_REFUNDABLE" : "PARTIAL_RETENTION" };
  }

  // Landing exactly on the cutoff still counts as inside the free window: the
  // guest retained the full advertised notice period.
  if (hoursBeforeCheckIn >= policy.freeCancellationCutoffHours) {
    return {
      policyKey: policy.key,
      isFreeCancellation: true,
      refundableAmount: total,
      retainedAmount: 0,
      reason: "FREE_CANCELLATION",
    };
  }

  // Inside the penalty window.
  if (policy.fullCancellationRetention >= 1) {
    return {
      policyKey: policy.key,
      isFreeCancellation: false,
      refundableAmount: 0,
      retainedAmount: total,
      reason: "NON_REFUNDABLE",
    };
  }

  if (policy.fullCancellationRetention <= 0) {
    return {
      policyKey: policy.key,
      isFreeCancellation: true,
      refundableAmount: total,
      retainedAmount: 0,
      reason: "FREE_CANCELLATION",
    };
  }

  const retainedAmount = Math.min(total, Math.max(0, Math.round(total * policy.fullCancellationRetention)));
  return {
    policyKey: policy.key,
    isFreeCancellation: false,
    refundableAmount: total - retainedAmount,
    retainedAmount,
    reason: "PARTIAL_RETENTION",
  };
}
