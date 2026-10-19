import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  averageNightlyRate,
  isRatePlanSellableForWindow,
  quoteCancellation,
  resolveNightlyRatesForWindow,
} from "../../../lib/hotel/domain/rate";
import type { HotelProperty, RatePlan, SeasonalRate } from "../../../lib/hotel/domain/types";

function property(input: Partial<HotelProperty> = {}): HotelProperty {
  return {
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
    ...input,
  };
}

function plan(input: Partial<RatePlan> = {}): RatePlan {
  return {
    id: "rp1",
    propertyId: "prop_1",
    roomTypeId: "rt1",
    code: "FLEX",
    name: "Flexible",
    baseNightlyRate: 2_000_000,
    currency: "TOMAN",
    mealPlan: "none",
    minNights: 1,
    maxNights: 0,
    isRefundable: true,
    isActive: true,
    ...input,
  };
}

describe("nightly rate resolution", () => {
  it("prices every night of a multi-night stay at the base rate", () => {
    const result = resolveNightlyRatesForWindow({
      property: property(),
      ratePlan: plan(),
      seasonalRates: [],
      checkIn: "2026-03-21",
      checkOut: "2026-03-24",
    });

    assert.equal(result.isResolved, true);
    if (!result.isResolved) return;
    assert.equal(result.nights.length, 3);
    assert.equal(result.total, 6_000_000);
    assert.ok(result.nights.every((night) => night.source === "BASE"));
  });

  it("applies a seasonal override only to the nights it covers", () => {
    const seasonal: SeasonalRate[] = [
      { id: "sr1", ratePlanId: "rp1", from: "2026-03-22", to: "2026-03-22", nightlyRate: 5_000_000 },
    ];
    const result = resolveNightlyRatesForWindow({
      property: property(),
      ratePlan: plan(),
      seasonalRates: seasonal,
      checkIn: "2026-03-21",
      checkOut: "2026-03-24",
    });

    assert.equal(result.isResolved, true);
    if (!result.isResolved) return;
    assert.deepEqual(result.nights.map((night) => night.amount), [2_000_000, 5_000_000, 2_000_000]);
    assert.equal(result.nights[1].source, "SEASONAL");
    assert.equal(result.nights[1].seasonalRateId, "sr1");
    assert.equal(result.total, 9_000_000);
  });

  it("prefers the narrowest matching seasonal window", () => {
    const seasonal: SeasonalRate[] = [
      { id: "broad", ratePlanId: "rp1", from: "2026-03-01", to: "2026-03-31", nightlyRate: 3_000_000 },
      { id: "narrow", ratePlanId: "rp1", from: "2026-03-21", to: "2026-03-22", nightlyRate: 4_000_000 },
    ];
    const result = resolveNightlyRatesForWindow({
      property: property(),
      ratePlan: plan(),
      seasonalRates: seasonal,
      checkIn: "2026-03-21",
      checkOut: "2026-03-23",
    });

    assert.equal(result.isResolved, true);
    if (!result.isResolved) return;
    assert.deepEqual(result.nights.map((night) => night.amount), [4_000_000, 4_000_000]);
  });

  it("ignores seasonal rates belonging to another rate plan", () => {
    const seasonal: SeasonalRate[] = [
      { id: "other", ratePlanId: "rp_other", from: "2026-03-21", to: "2026-03-24", nightlyRate: 9_000_000 },
    ];
    const result = resolveNightlyRatesForWindow({
      property: property(),
      ratePlan: plan(),
      seasonalRates: seasonal,
      checkIn: "2026-03-21",
      checkOut: "2026-03-22",
    });

    assert.equal(result.isResolved, true);
    if (!result.isResolved) return;
    assert.equal(result.total, 2_000_000);
  });

  it("applies a seasonal min-stay override when pricing", () => {
    const seasonal: SeasonalRate[] = [
      { id: "sr1", ratePlanId: "rp1", from: "2026-03-21", to: "2026-03-24", nightlyRate: 3_000_000, minNights: 3 },
    ];
    const short = resolveNightlyRatesForWindow({
      property: property(),
      ratePlan: plan(),
      seasonalRates: seasonal,
      checkIn: "2026-03-21",
      checkOut: "2026-03-22",
    });
    assert.equal(short.isResolved, false);
    assert.equal(!short.isResolved && short.reason, "MIN_STAY_NOT_MET");

    const full = resolveNightlyRatesForWindow({
      property: property(),
      ratePlan: plan(),
      seasonalRates: seasonal,
      checkIn: "2026-03-21",
      checkOut: "2026-03-24",
    });
    assert.equal(full.isResolved, true);
  });

  it("rejects an inverted stay window", () => {
    const result = resolveNightlyRatesForWindow({
      property: property(),
      ratePlan: plan(),
      seasonalRates: [],
      checkIn: "2026-03-24",
      checkOut: "2026-03-21",
    });
    assert.equal(!result.isResolved && result.reason, "WINDOW_INVALID");
  });

  it("rejects an inactive rate plan", () => {
    const result = resolveNightlyRatesForWindow({
      property: property(),
      ratePlan: plan({ isActive: false }),
      seasonalRates: [],
      checkIn: "2026-03-21",
      checkOut: "2026-03-22",
    });
    assert.equal(!result.isResolved && result.reason, "RATE_PLAN_INACTIVE");
  });

  it("requires validity across the whole stay, not just arrival night", () => {
    const closingPlan = plan({ validTo: "2026-03-22" });

    assert.equal(isRatePlanSellableForWindow(closingPlan, "2026-03-21", "2026-03-22"), true);
    assert.equal(isRatePlanSellableForWindow(closingPlan, "2026-03-21", "2026-03-24"), false);

    const result = resolveNightlyRatesForWindow({
      property: property(),
      ratePlan: closingPlan,
      seasonalRates: [],
      checkIn: "2026-03-21",
      checkOut: "2026-03-24",
    });
    assert.equal(!result.isResolved && result.reason, "RATE_PLAN_OUT_OF_VALIDITY");
  });

  it("enforces the stricter of the property and rate plan max stay", () => {
    const result = resolveNightlyRatesForWindow({
      property: property({ maxStayNights: 10 }),
      ratePlan: plan({ maxNights: 2 }),
      seasonalRates: [],
      checkIn: "2026-03-21",
      checkOut: "2026-03-25",
    });
    assert.equal(!result.isResolved && result.reason, "MAX_STAY_EXCEEDED");
  });

  it("computes a rounded average nightly rate", () => {
    assert.equal(averageNightlyRate(7_000_000, "2026-03-21", "2026-03-24"), 2_333_333);
    assert.equal(averageNightlyRate(1_000_000, "2026-03-21", "2026-03-21"), 0);
  });
});

describe("cancellation quoting", () => {
  const checkInAt = new Date("2026-04-01T14:00:00.000Z");

  const policy = (input: {
    key?: string;
    freeCancellationCutoffHours?: number;
    fullCancellationRetention?: number;
  }) => ({
    key: input.key ?? "flexible",
    name: "Flexible",
    freeCancellationCutoffHours: input.freeCancellationCutoffHours ?? 48,
    fullCancellationRetention: input.fullCancellationRetention ?? 0,
    description: "",
  });

  it("refunds in full inside the free cancellation window", () => {
    const quote = quoteCancellation({
      totalAmount: 8_000_000,
      cancelledAt: new Date("2026-03-25T10:00:00.000Z"),
      checkInAt,
      policy: policy({ fullCancellationRetention: 0.5 }),
    });
    assert.equal(quote.isFreeCancellation, true);
    assert.equal(quote.refundableAmount, 8_000_000);
    assert.equal(quote.retainedAmount, 0);
  });

  it("attributes the quote to the published policy", () => {
    const quote = quoteCancellation({
      totalAmount: 8_000_000,
      cancelledAt: new Date("2026-03-25T10:00:00.000Z"),
      checkInAt,
      policy: policy({ key: "non-refundable-advance" }),
    });
    assert.equal(quote.policyKey, "non-refundable-advance");
  });

  it("retains the configured fraction inside the penalty window", () => {
    const quote = quoteCancellation({
      totalAmount: 8_000_000,
      cancelledAt: new Date("2026-03-31T10:00:00.000Z"),
      checkInAt,
      policy: policy({ fullCancellationRetention: 0.5 }),
    });
    assert.equal(quote.isFreeCancellation, false);
    assert.equal(quote.retainedAmount, 4_000_000);
    assert.equal(quote.refundableAmount, 4_000_000);
    assert.equal(quote.reason, "PARTIAL_RETENTION");
  });

  it("fails closed when no policy is published", () => {
    const quote = quoteCancellation({
      totalAmount: 8_000_000,
      cancelledAt: new Date("2026-03-01T10:00:00.000Z"),
      checkInAt,
      policy: null,
    });
    assert.equal(quote.refundableAmount, 0);
    assert.equal(quote.retainedAmount, 8_000_000);
    assert.equal(quote.reason, "CANCELLATION_NOT_PERMITTED");
    assert.equal(quote.policyKey, "");
  });

  it("never refunds more than the reservation total", () => {
    const quote = quoteCancellation({
      totalAmount: 8_000_000,
      cancelledAt: new Date("2026-03-31T10:00:00.000Z"),
      checkInAt,
      policy: policy({ fullCancellationRetention: 2 }),
    });
    assert.equal(quote.refundableAmount, 0);
    assert.equal(quote.retainedAmount, 8_000_000);
  });

  it("treats a zero-retention penalty window as a free cancellation", () => {
    const quote = quoteCancellation({
      totalAmount: 8_000_000,
      cancelledAt: new Date("2026-03-31T10:00:00.000Z"),
      checkInAt,
      policy: policy({ fullCancellationRetention: 0 }),
    });
    assert.equal(quote.isFreeCancellation, true);
    assert.equal(quote.reason, "FREE_CANCELLATION");
  });
});