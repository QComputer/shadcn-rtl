import {
  BED_CAPACITY,
  type BedConfiguration,
  type Occupancy,
  type RoomCapacity,
  type StayDate,
} from "@/lib/hotel/domain/types";

/**
 * Calendar helpers for hotel stays.
 *
 * All dates are property-local `YYYY-MM-DD` strings. We deliberately avoid
 * `Date` parsing for comparisons: a `new Date("2026-03-21")` is UTC midnight
 * and shifts by a day for any timezone east of UTC (Iran is +03:30), which is
 * exactly the class of bug that makes multi-night availability wrong.
 */

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export type ParsedStayDate = { year: number; month: number; day: number };

export function parseStayDate(value: string): ParsedStayDate | null {
  const match = ISO_DATE.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) return null;
  return { year, month, day };
}

export function isStayDate(value: string): boolean {
  return parseStayDate(value) !== null;
}

function daysInMonth(year: number, month: number): number {
  // Day 0 of the next month is the last day of this one.
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function toOrdinal(value: string): number {
  const parsed = parseStayDate(value);
  if (!parsed) throw new RangeError(`Invalid stay date: ${value}`);
  return Math.round(
    Date.UTC(parsed.year, parsed.month - 1, parsed.day) / 86_400_000,
  );
}

function fromOrdinal(ordinal: number): StayDate {
  const date = new Date(ordinal * 86_400_000);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  const day = date.getUTCDate();
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function compareStayDates(left: StayDate, right: StayDate): number {
  return toOrdinal(left) - toOrdinal(right);
}

export function addStayDays(value: StayDate, days: number): StayDate {
  return fromOrdinal(toOrdinal(value) + days);
}

export function stayNightCount(checkIn: StayDate, checkOut: StayDate): number {
  return toOrdinal(checkOut) - toOrdinal(checkIn);
}

/**
 * The nights actually occupied by a stay: `[checkIn, checkOut)`.
 * A 1-night stay has exactly one night; check-out day is never occupied.
 */
export function enumerateStayNights(checkIn: StayDate, checkOut: StayDate): StayDate[] {
  const count = stayNightCount(checkIn, checkOut);
  if (count <= 0) return [];
  const nights: StayDate[] = [];
  for (let offset = 0; offset < count; offset += 1) {
    nights.push(addStayDays(checkIn, offset));
  }
  return nights;
}

/**
 * Note on shape: this repo compiles with `strict: false`, so TypeScript cannot
 * narrow these unions by their boolean discriminant. The optional
 * `reason?: undefined` members keep property access legal on both branches
 * without weakening the documented intent.
 */
export type StayWindowValidation =
  | { readonly isValid: true; readonly nights: number; readonly reason?: undefined }
  | { readonly isValid: false; readonly reason: string; readonly nights?: undefined };

export function validateStayWindow(
  checkIn: StayDate,
  checkOut: StayDate,
  policy: { minNights: number; maxNights: number },
): StayWindowValidation {
  if (!isStayDate(checkIn)) return { isValid: false, reason: "CHECK_IN_INVALID" };
  if (!isStayDate(checkOut)) return { isValid: false, reason: "CHECK_OUT_INVALID" };

  const nights = stayNightCount(checkIn, checkOut);
  if (nights <= 0) {
    return { isValid: false, reason: "CHECK_OUT_MUST_BE_AFTER_CHECK_IN" };
  }
  if (nights < policy.minNights) {
    return { isValid: false, reason: "MIN_STAY_NOT_MET" };
  }
  if (policy.maxNights > 0 && nights > policy.maxNights) {
    return { isValid: false, reason: "MAX_STAY_EXCEEDED" };
  }
  return { isValid: true, nights };
}

export type OccupancyValidation =
  | { readonly isValid: true; readonly reason?: undefined }
  | { readonly isValid: false; readonly reason: string };

/**
 * Property-local wall-clock helpers.
 *
 * A hotel's cancellation deadline is expressed against LOCAL time ("48 hours
 * before 14:00 on the arrival date"), not against UTC. `new Date("2026-04-01")`
 * is UTC midnight and is therefore wrong by the property's offset, so all
 * local-time resolution goes through these functions.
 *
 * `Intl` is used in exactly one place, for offset lookup. Everything else is
 * pure integer arithmetic and therefore deterministic under test.
 *
 * Note: `lib/services/appointment.service.ts:112-142` keeps a private copy of
 * an equivalent offset resolver. Consolidating the two is out of H2 scope
 * (it would touch appointment booking), but the duplication is now recorded
 * in `docs/HOTEL-PERSISTENCE-DESIGN.md`.
 */

const CLOCK_TIME = /^(\d{1,2}):(\d{2})$/;

export function parseClockTime(value: string): { hour: number; minute: number } | null {
  const match = CLOCK_TIME.exec(value.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return { hour, minute };
}

/** Offset in minutes east of UTC for an IANA zone at a given instant. */
export function resolveUtcOffsetMinutes(timeZone: string, at: Date): number {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    const parts = formatter.formatToParts(at);
    const read = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? "NaN");
    const asUtc = Date.UTC(
      read("year"),
      read("month") - 1,
      read("day"),
      read("hour") % 24,
      read("minute"),
      read("second"),
    );
    return Math.round((asUtc - at.getTime()) / 60_000);
  } catch {
    return 0;
  }
}

/**
 * Resolves a property-local date + `HH:mm` into an absolute instant.
 * The offset is resolved for the specific date so a zone that changes offset
 * across a DST boundary stays correct.
 */
export function resolvePropertyInstant(input: {
  date: StayDate
  time: string
  timeZone: string
}): Date | null {
  const parsedDate = parseStayDate(input.date);
  const parsedTime = parseClockTime(input.time);
  if (!parsedDate || !parsedTime) return null;

  const wallClockUtcMs = Date.UTC(
    parsedDate.year,
    parsedDate.month - 1,
    parsedDate.day,
    parsedTime.hour,
    parsedTime.minute,
  );

  // Two passes converge for every real zone; the second corrects the guess
  // made by the first near an offset transition.
  let instantMs = wallClockUtcMs - resolveUtcOffsetMinutes(input.timeZone, new Date(wallClockUtcMs)) * 60_000;
  instantMs =
    wallClockUtcMs - resolveUtcOffsetMinutes(input.timeZone, new Date(instantMs)) * 60_000;

  return new Date(instantMs);
}

export function validateOccupancy(occupancy: Occupancy): OccupancyValidation {
  const { adults, children } = occupancy;
  if (!Number.isInteger(adults) || adults < 1) {
    return { isValid: false, reason: "AT_LEAST_ONE_ADULT_REQUIRED" };
  }
  if (!Number.isInteger(children) || children < 0) {
    return { isValid: false, reason: "INVALID_CHILD_COUNT" };
  }
  if (occupancy.childAges) {
    if (occupancy.childAges.length !== children) {
      return { isValid: false, reason: "CHILD_AGE_COUNT_MISMATCH" };
    }
    if (occupancy.childAges.some((age) => !Number.isInteger(age) || age < 0 || age > 17)) {
      return { isValid: false, reason: "INVALID_CHILD_AGE" };
    }
  }
  return { isValid: true };
}

export function bedCapacity(beds: readonly BedConfiguration[]): number {
  return beds.reduce((sum, bed) => sum + BED_CAPACITY[bed.kind] * bed.count, 0);
}

/**
 * Capacity is checked against three independent limits so that a room cannot
 * be sold into a configuration the physical beds cannot actually hold.
 */
export function validateOccupancyFitsRoom(
  occupancy: Occupancy,
  capacity: RoomCapacity,
  beds: readonly BedConfiguration[],
): OccupancyValidation {
  const base = validateOccupancy(occupancy);
  if (!base.isValid) return base;

  const totalGuests = occupancy.adults + occupancy.children;
  if (totalGuests > capacity.maxOccupancy) {
    return { isValid: false, reason: "OCCUPANCY_EXCEEDS_ROOM_MAX" };
  }
  if (occupancy.adults > capacity.maxAdults) {
    return { isValid: false, reason: "ADULTS_EXCEED_ROOM_CAPACITY" };
  }
  if (occupancy.children > capacity.maxChildren) {
    return { isValid: false, reason: "CHILDREN_EXCEED_ROOM_CAPACITY" };
  }
  if (totalGuests > bedCapacity(beds)) {
    return { isValid: false, reason: "NOT_ENOUGH_BEDS" };
  }
  return { isValid: true };
}