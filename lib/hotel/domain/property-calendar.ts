/** Gregorian ISO civil date at the property, independent of ICU's display order. */
export function propertyCalendarDate(timeZone: string, at: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US-u-ca-gregory-nu-latn", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(at);
  const read = (name: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === name)?.value;
  const year = read("year"), month = read("month"), day = read("day");
  if (!year || !month || !day) throw new RangeError("Property calendar date unavailable");
  return `${year.padStart(4, "0")}-${month}-${day}`;
}

export function isPropertyDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const instant = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(instant.getTime()) && instant.toISOString().slice(0, 10) === value;
}

export function offsetPropertyDate(value: string, days: number): string {
  if (!isPropertyDate(value) || !Number.isInteger(days)) throw new RangeError("Invalid property calendar date or offset");
  const instant = new Date(`${value}T00:00:00.000Z`);
  instant.setUTCDate(instant.getUTCDate() + days);
  return instant.toISOString().slice(0, 10);
}

export type ReceptionDateIssue = "REQUIRED" | "INVALID" | "PAST" | "ORDER" | "TOO_LONG";

export function receptionDateIssue(checkIn: string, checkOut: string, today: string): ReceptionDateIssue | null {
  if (!checkIn || !checkOut) return "REQUIRED";
  if (![checkIn, checkOut, today].every(isPropertyDate)) return "INVALID";
  if (checkIn < today) return "PAST";
  if (checkOut <= checkIn) return "ORDER";
  if (checkOut > offsetPropertyDate(checkIn, 31)) return "TOO_LONG";
  return null;
}
