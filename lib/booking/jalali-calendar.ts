/** ISO/Gregorian dates are canonical; Persian dates are presentation only. */
export type ISODate = string;

export interface StayRange {
  checkIn: ISODate;
  checkOut: ISODate;
}

export interface JalaliParts {
  year: number;
  month: number;
  day: number;
}

const numericCalendar = new Intl.DateTimeFormat("fa-IR-u-ca-persian-nu-latn", {
  timeZone: "UTC", year: "numeric", month: "numeric", day: "numeric",
});
const longCalendar = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
  timeZone: "UTC", year: "numeric", month: "long", day: "numeric",
});
const titleCalendar = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
  timeZone: "UTC", year: "numeric", month: "long",
});
const accessibleCalendar = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
  timeZone: "UTC", weekday: "long", year: "numeric", month: "long", day: "numeric",
});
const numberFormatter = new Intl.NumberFormat("fa-IR", { useGrouping: false });

/** Returns null for malformed, impossible, or unsupported date-only values. */
export function parseISODate(value: string): Date | null {
  if (!/^(19|20|21)\d{2}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date;
}

export function toISODate(date: Date): ISODate {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

export function todayLocalISO(now: Date = new Date()): ISODate {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function shiftISODate(value: ISODate, days: number): ISODate {
  const date = parseISODate(value);
  if (!date || !Number.isSafeInteger(days)) throw new RangeError("Invalid ISO date or day shift");
  date.setUTCDate(date.getUTCDate() + days);
  return toISODate(date);
}

export function jalaliParts(value: ISODate): JalaliParts {
  const date = parseISODate(value);
  if (!date) throw new RangeError(`Invalid ISO date: ${value}`);
  const parts = numericCalendar.formatToParts(date);
  const getPart = (type: "year" | "month" | "day") => Number(parts.find((part) => part.type === type)?.value);
  const result = { year: getPart("year"), month: getPart("month"), day: getPart("day") };
  if (!Number.isInteger(result.year) || !Number.isInteger(result.month) || !Number.isInteger(result.day)) {
    throw new RangeError("Persian calendar unsupported by this runtime");
  }
  return result;
}

export function jalaliDayLabel(value: ISODate): string {
  const date = parseISODate(value);
  return date ? longCalendar.format(date) : "انتخاب تاریخ شمسی";
}

export function jalaliAccessibleDay(value: ISODate): string {
  const date = parseISODate(value);
  if (!date) throw new RangeError("Invalid date for calendar label");
  return accessibleCalendar.format(date);
}

export function jalaliMonthTitle(value: ISODate): string {
  const date = parseISODate(value);
  if (!date) throw new RangeError("Invalid calendar month");
  return titleCalendar.format(date);
}

export function persianDigits(value: number): string {
  return numberFormatter.format(value);
}

export function startOfJalaliMonth(value: ISODate): ISODate {
  return shiftISODate(value, 1 - jalaliParts(value).day);
}

/** Accurate across Esfand, leap years, and Gregorian year boundaries. */
export function moveJalaliMonth(value: ISODate, offset: number): ISODate {
  if (!Number.isSafeInteger(offset) || Math.abs(offset) > 1200) throw new RangeError("Invalid month offset");
  let current = startOfJalaliMonth(value);
  for (let i = 0; i < Math.abs(offset); i += 1) {
    current = offset > 0
      ? startOfJalaliMonth(shiftISODate(current, 32))
      : startOfJalaliMonth(shiftISODate(current, -1));
  }
  return current;
}

/** Saturday=0, Sunday=1, ... Friday=6. */
export function persianWeekdayIndex(value: ISODate): number {
  const date = parseISODate(value);
  if (!date) throw new RangeError("Invalid weekday date");
  return (date.getUTCDay() + 1) % 7;
}

export interface CalendarDay {
  iso: ISODate;
  jalaliDay: number;
  currentMonth: boolean;
  disabled: boolean;
  friday: boolean;
}

/** Always 42 stable slots; neighboring-month days are visible but subdued. */
export function jalaliMonthGrid(month: ISODate, minISO: ISODate, maxISO?: ISODate): CalendarDay[] {
  const first = startOfJalaliMonth(month);
  const offset = persianWeekdayIndex(first);
  const firstCell = shiftISODate(first, -offset);
  const current = jalaliParts(first);
  return Array.from({ length: 42 }, (_, index) => {
    const iso = shiftISODate(firstCell, index);
    const parts = jalaliParts(iso);
    return {
      iso,
      jalaliDay: parts.day,
      currentMonth: parts.month === current.month && parts.year === current.year,
      disabled: iso < minISO || Boolean(maxISO && iso > maxISO),
      friday: persianWeekdayIndex(iso) === 6,
    };
  });
}

export type RangeSegment = "checkIn" | "checkOut";

export function selectStayDate(range: StayRange, iso: ISODate, segment: RangeSegment): { range: StayRange; nextSegment: RangeSegment; complete: boolean } {
  if (!parseISODate(iso)) throw new RangeError("Invalid selected date");
  if (segment === "checkIn" || !range.checkIn || iso <= range.checkIn) {
    return { range: { checkIn: iso, checkOut: "" }, nextSegment: "checkOut", complete: false };
  }
  return { range: { checkIn: range.checkIn, checkOut: iso }, nextSegment: "checkIn", complete: true };
}

export function validateStayRange(range: StayRange, minISO: ISODate): "MISSING" | "PAST" | "ORDER" | "OK" {
  if (!parseISODate(range.checkIn) || !parseISODate(range.checkOut)) return "MISSING";
  if (range.checkIn < minISO) return "PAST";
  if (range.checkOut <= range.checkIn) return "ORDER";
  return "OK";
}
