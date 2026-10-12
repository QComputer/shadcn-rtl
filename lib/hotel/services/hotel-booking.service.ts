import { searchAvailability } from "@/lib/hotel/domain/availability";
import { decideReservationTransition, holdsInventory } from "@/lib/hotel/domain/booking-state";
import { enumerateStayNights } from "@/lib/hotel/domain/stay-dates";
import { quoteCancellation, type CancellationQuote } from "@/lib/hotel/domain/rate";
import { DEFAULT_HOTEL_HOLD_MINUTES, MAX_HOTEL_STAY_NIGHTS } from "@/lib/hotel/domain/policy";
import type {
  AvailabilityQuery,
  ReservationCancellationPolicySnapshot,
  ReservationGuest,
  StayDate,
} from "@/lib/hotel/domain/types";
import type {
  HotelBookingRepository,
  HotelPaymentSubjectRepository,
  HoldRecord,
  ReservationRecord,
  TenantScope,
} from "@/lib/hotel/persistence/hotel-repositories";

/** Re-exported so callers can compose the search path without a second import. */
export { searchAvailability, quoteCancellation };

/**
 * Hotel booking application service (H2).
 *
 * Orchestrates the H1 pure domain rules against the persistence contracts.
 * It owns no pricing, availability or state-machine logic of its own — those
 * live in `lib/hotel/domain/**` and are reused unchanged.
 *
 * Every write path is designed so that inventory is never permanently consumed
 * by an abandoned or failed booking:
 *  - a hold is claimed atomically for every night, or not at all;
 *  - a failed payment or an expired hold releases the hold, decrementing
 *    `held` back on every night;
 *  - cancellation releases the committed `booked` count;
 *  - settlement and confirmation happen in one atomic repository operation, so
 *    a reservation can never be "paid but not confirmed" or vice versa.
 */

export type BookingServiceDeps = {
  readonly booking: HotelBookingRepository
  readonly payments: HotelPaymentSubjectRepository
  /** Injectable so tests are deterministic; production passes `() => new Date()`. */
  readonly now: () => Date
};

export type CreateHoldCommand = {
  readonly scope: TenantScope
  readonly propertyId: string
  readonly roomTypeId: string
  readonly ratePlanId: string
  readonly query: AvailabilityQuery
  readonly reference: string
  readonly holdId: string
  readonly holdMinutes?: number
};

export type CreateHoldResult =
  | {
      readonly isHeld: true
      readonly holdId: string
      readonly reference: string
      readonly nights: readonly StayDate[]
      readonly expiresAt: Date
    }
  | {
      readonly isHeld: false
      readonly reason: string
      readonly failedDates?: readonly StayDate[]
    };

/**
 * Holds inventory for a stay.
 *
 * Correctness rests entirely on the atomic `claimInventoryAndCreateHold` call — an
 * availability read is never consulted here, because a read followed by a
 * write is exactly the double-booking bug. Pricing is deliberately NOT
 * returned: a hold reserves stock, it does not sell it, and a quoted total on
 * this result would invite callers to trust a price that is only valid once
 * `confirmBookingHold` resolves rates server-side.
 */
export async function createBookingHold(
  deps: BookingServiceDeps,
  command: CreateHoldCommand,
): Promise<CreateHoldResult> {
  const now = deps.now();
  const nights = enumerateStayNights(command.query.window.checkIn, command.query.window.checkOut);

  if (nights.length === 0) {
    return { isHeld: false, reason: "INVALID_STAY_WINDOW" };
  }
  if (nights.length > MAX_HOTEL_STAY_NIGHTS) {
    return { isHeld: false, reason: "MAX_STAY_EXCEEDED" };
  }

  const holdMinutes = command.holdMinutes ?? DEFAULT_HOTEL_HOLD_MINUTES;
  const expiresAt = new Date(now.getTime() + holdMinutes * 60_000);

  const holdInput = {
    id: command.holdId,
    organizationId: command.scope.organizationId,
    propertyId: command.propertyId,
    reference: command.reference,
    roomTypeId: command.roomTypeId,
    checkIn: command.query.window.checkIn,
    checkOut: command.query.window.checkOut,
    nights,
    quantity: 1,
    expiresAt,
    status: "ACTIVE" as const,
    createdAt: now,
  };
  const claim = await deps.booking.claimInventoryAndCreateHold({
    scope: command.scope,
    propertyId: command.propertyId,
    roomTypeId: command.roomTypeId,
    nights,
    quantity: 1,
    hold: holdInput,
    now,
  });

  if (!claim.isClaimed) {
    return {
      isHeld: false,
      reason: claim.reason,
      ...(claim.reason === "NO_INVENTORY" || claim.reason === "OUT_OF_SERVICE"
        ? { failedDates: claim.failedDates }
        : {}),
    };
  }

  const hold = (claim as typeof claim & { readonly hold?: HoldRecord }).hold ?? (await deps.booking.createHold(holdInput));

  return {
    isHeld: true,
    holdId: hold.id,
    reference: hold.reference,
    nights: hold.nights,
    expiresAt: hold.expiresAt,
  };
}

export type ConfirmHoldCommand = {
  readonly scope: TenantScope
  readonly holdId: string
  readonly reservationId: string
  readonly ratePlanId: string
  readonly guests: readonly ReservationGuest[]
  readonly policySnapshot: ReservationCancellationPolicySnapshot | null
  readonly nightlyRates: readonly number[]
  readonly totalAmount: number
  readonly idempotencyKey?: string
  readonly currency?: string
};

/**
 * Converts a hold into a pending reservation. Prices are supplied by the
 * caller from `resolveNightlyRatesForWindow` — the service never invents money.
 */
export async function confirmBookingHold(
  deps: BookingServiceDeps,
  command: ConfirmHoldCommand,
): Promise<{ isConfirmed: true; reservation: ReservationRecord } | { isConfirmed: false; reason: string }> {
  const now = deps.now();
  const hold = await deps.booking.findHold(command.scope, command.holdId);
  if (!hold) return { isConfirmed: false, reason: "HOLD_NOT_FOUND" };
  if (hold.organizationId !== command.scope.organizationId) {
    return { isConfirmed: false, reason: "TENANT_MISMATCH" };
  }
  if (hold.status !== "ACTIVE") return { isConfirmed: false, reason: "HOLD_NOT_ACTIVE" };
  if (hold.expiresAt.getTime() <= now.getTime()) {
    // Expired holds never become reservations, and their inventory goes back.
    await deps.booking.releaseHold(command.scope, command.holdId, now);
    return { isConfirmed: false, reason: "HOLD_EXPIRED" };
  }

  // Integrity check on server-resolved pricing. `resolveNightlyRatesForWindow`
  // produces one rate per night and a total equal to their sum; anything else
  // means a caller passed a mismatched or tampered price set and must not be
  // allowed to become a committed reservation.
  if (command.nightlyRates.length !== hold.nights.length) {
    return { isConfirmed: false, reason: "PRICING_NIGHT_COUNT_MISMATCH" };
  }
  const pricedTotal = command.nightlyRates.reduce((sum, rate) => sum + rate, 0);
  if (pricedTotal !== command.totalAmount) {
    return { isConfirmed: false, reason: "PRICING_TOTAL_MISMATCH" };
  }
  if (command.totalAmount < 0 || !Number.isInteger(command.totalAmount)) {
    return { isConfirmed: false, reason: "PRICING_INVALID_AMOUNT" };
  }

  const reservation = await deps.booking.createReservation({
    id: command.reservationId,
    organizationId: hold.organizationId,
    propertyId: hold.propertyId,
    reference: hold.reference,
    idempotencyKey: command.idempotencyKey ?? hold.reference,
    roomTypeId: hold.roomTypeId,
    ratePlanId: command.ratePlanId,
    status: "PENDING_PAYMENT",
    checkIn: hold.checkIn,
    checkOut: hold.checkOut,
    nights: hold.nights,
    guests: command.guests,
    nightlyRates: [...command.nightlyRates],
    totalAmount: command.totalAmount,
    currency: command.currency ?? "TOMAN",
    cancellationPolicySnapshot: command.policySnapshot,
    holdId: hold.id,
    createdAt: now,
    updatedAt: now,
  });

  return { isConfirmed: true, reservation };
}

/**
 * Applies a server-verified payment. Delegates to a single atomic repository
 * operation so settlement and confirmation cannot diverge, and so a replayed
 * verification is reported as an idempotent no-op rather than a second
 * confirmation.
 */
export async function reconcileVerifiedPayment(
  deps: BookingServiceDeps,
  input: {
    scope: TenantScope
    reservationId: string
    paymentRequestPublicId: string
    amountToman: bigint
    paidAt?: Date
  },
): Promise<{ isApplied: boolean; isIdempotentReplay: boolean; reservation?: ReservationRecord; reason?: string }> {
  const now = deps.now();
  const result = await deps.payments.applyVerifiedPayment({
    scope: input.scope,
    reservationId: input.reservationId,
    paymentRequestPublicId: input.paymentRequestPublicId,
    paidAt: input.paidAt ?? now,
    amountToman: input.amountToman,
    now,
  });

  if (!result.isApplied) return { isApplied: false, isIdempotentReplay: false, reason: result.reason };
  return { isApplied: true, isIdempotentReplay: result.isIdempotentReplay, reservation: result.reservation };
}

/**
 * Cancels a reservation and quotes the refund from the policy SNAPSHOT taken
 * at booking time, never from the hotel's current live policy.
 */
export async function cancelReservation(
  deps: BookingServiceDeps,
  input: {
    scope: TenantScope
    reservationId: string
    checkInAt: Date
    /** Repository hook that releases committed inventory for the reservation. */
    releaseInventory?: (reservationId: string, now: Date) => Promise<void> | void
  },
): Promise<
  | { isCancelled: true; reservation: ReservationRecord; quote: CancellationQuote }
  | { isCancelled: false; reason: string }
> {
  const now = deps.now();
  const reservation = await deps.booking.findReservation(input.scope, input.reservationId);
  if (!reservation) return { isCancelled: false, reason: "RESERVATION_NOT_FOUND" };

  const decision = decideReservationTransition({
    current: reservation.status,
    transition: "CANCEL",
    event: {
      type: "CANCELLATION_REQUESTED",
      at: now.toISOString(),
      refundableAmount: 0,
    },
    now: now.toISOString(),
  });

  if (!decision.isAllowed) return { isCancelled: false, reason: decision.reason };

  const quote = quoteCancellation({
    totalAmount: reservation.totalAmount,
    cancelledAt: now,
    checkInAt: input.checkInAt,
    policy: reservation.cancellationPolicySnapshot,
  });

  const updated = await deps.booking.updateReservationStatus({
    scope: input.scope,
    reservationId: input.reservationId,
    expectedStatus: ["HELD", "PENDING_PAYMENT", "CONFIRMED"],
    nextStatus: "CANCELLED",
    now,
  });

  if (!updated.isUpdated) return { isCancelled: false, reason: updated.reason };

  // Only a reservation that was actually holding inventory returns stock.
  if (holdsInventory(reservation.status)) {
    await input.releaseInventory?.(input.reservationId, now);
  }

  return { isCancelled: true, reservation: updated.reservation, quote };
}

/**
 * Expires overdue holds and returns their inventory.
 *
 * This is the sweeper body H3 must invoke from a real scheduler. It is
 * idempotent: `releaseHold` refuses a hold that is no longer ACTIVE, so a
 * repeated or overlapping run cannot double-decrement inventory.
 */
export async function expireOverdueHolds(
  deps: BookingServiceDeps,
  input: { scope: TenantScope; propertyId?: string; now?: Date; limit?: number },
): Promise<{ expired: number; skipped: number }> {
  const now = input.now ?? deps.now();
  const limit = input.limit ?? 100;

  const due = await deps.booking.listExpiredActiveHolds(input.scope, {
    ...(input.propertyId ? { propertyId: input.propertyId } : {}),
    now,
    limit,
  });

  let expired = 0;
  let skipped = 0;
  for (const hold of due) {
    const released = await deps.booking.releaseHold(input.scope, hold.id, now);
    if (released.isReleased) expired += 1;
    else skipped += 1;
  }
  return { expired, skipped };
}
