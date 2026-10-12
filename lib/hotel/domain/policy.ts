/**
 * Hotel vertical policy constants.
 *
 * Centralised so limits are reviewable in one place rather than scattered as
 * inline literals, and so tests can assert against the same values the
 * validation layer enforces.
 */

/** Hard ceiling on a single stay. Longer requests must be split. */
export const MAX_HOTEL_STAY_NIGHTS = 30;

/** Minimum lead time before arrival for a new reservation. */
export const MIN_HOTEL_LEAD_TIME_HOURS = 0;

/**
 * How long a temporary inventory hold survives. Chosen to sit comfortably
 * above a normal payment initiation while still bounding inventory lock-up
 * when a guest abandons checkout.
 */
export const DEFAULT_HOTEL_HOLD_MINUTES = 15;

/** Maximum advance booking horizon, in days from today. */
export const MAX_HOTEL_BOOKING_HORIZON_DAYS = 730;

/** Default property policy used when a property has not configured one. */
export const DEFAULT_HOTEL_POLICY = {
  checkInTime: "14:00",
  checkOutTime: "11:00",
  minStayNights: 1,
  maxStayNights: MAX_HOTEL_STAY_NIGHTS,
} as const;