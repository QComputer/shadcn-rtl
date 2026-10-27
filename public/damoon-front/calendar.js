// Derived from accepted lib/booking/jalali-calendar.ts at c03176f; ISO dates are canonical.
const numericCalendar = new Intl.DateTimeFormat("fa-IR-u-ca-persian-nu-latn", {
    timeZone: "UTC", year: "numeric", month: "numeric", day: "numeric",
});
function calendarFormatter(locale, options) {
    const numbering = locale === "fa" ? "arabext" : locale === "ar" ? "arab" : "latn";
    return new Intl.DateTimeFormat(`${locale}-u-ca-persian-nu-${numbering}`, { timeZone: "UTC", ...options });
}
const arabicJalaliMonths = ["فروردين", "أرديبهشت", "خرداد", "تير", "مرداد", "شهريور", "مهر", "آبان", "آذر", "دي", "بهمن", "اسفند"];
function arabicJalaliDate(value, includeWeekday = false) {
    const date = parseISODate(value);
    if (!date)
        return null;
    const { year, month, day } = jalaliParts(value);
    const number = new Intl.NumberFormat("ar-u-nu-arab", { useGrouping: false });
    const weekday = includeWeekday ? `${new Intl.DateTimeFormat("ar", { timeZone: "UTC", weekday: "long" }).format(date)}، ` : "";
    return `${weekday}${number.format(day)} ${arabicJalaliMonths[month - 1]} ${number.format(year)}`;
}
/** Returns null for malformed, impossible, or unsupported date-only values. */
export function parseISODate(value) {
    if (!/^(19|20|21)\d{2}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(value))
        return null;
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day, 12));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day)
        return null;
    return date;
}
export function toISODate(date) {
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}
export function todayLocalISO(now = new Date()) {
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}
export function shiftISODate(value, days) {
    const date = parseISODate(value);
    if (!date || !Number.isSafeInteger(days))
        throw new RangeError("Invalid ISO date or day shift");
    date.setUTCDate(date.getUTCDate() + days);
    return toISODate(date);
}
export function jalaliParts(value) {
    const date = parseISODate(value);
    if (!date)
        throw new RangeError(`Invalid ISO date: ${value}`);
    const parts = numericCalendar.formatToParts(date);
    const getPart = (type) => Number(parts.find((part) => part.type === type)?.value);
    const result = { year: getPart("year"), month: getPart("month"), day: getPart("day") };
    if (!Number.isInteger(result.year) || !Number.isInteger(result.month) || !Number.isInteger(result.day)) {
        throw new RangeError("Persian calendar unsupported by this runtime");
    }
    return result;
}
export function jalaliDayLabel(value, locale = "fa") {
    const date = parseISODate(value);
    if (!date)
        return ({ fa: "انتخاب تاریخ شمسی", en: "Select a Jalali date", ar: "اختر تاريخًا شمسيًا" })[locale];
    if (locale === "ar")
        return arabicJalaliDate(value);
    return calendarFormatter(locale, { year: "numeric", month: "long", day: "numeric" }).format(date);
}
export function jalaliAccessibleDay(value, locale = "fa") {
    const date = parseISODate(value);
    if (!date)
        throw new RangeError("Invalid date for calendar label");
    if (locale === "ar")
        return arabicJalaliDate(value, true);
    return calendarFormatter(locale, { weekday: "long", year: "numeric", month: "long", day: "numeric" }).format(date);
}
export function jalaliMonthTitle(value, locale = "fa") {
    const date = parseISODate(value);
    if (!date)
        throw new RangeError("Invalid calendar month");
    if (locale === "ar") {
        const { year, month } = jalaliParts(value);
        return `${arabicJalaliMonths[month - 1]} ${new Intl.NumberFormat("ar-u-nu-arab", { useGrouping: false }).format(year)}`;
    }
    return calendarFormatter(locale, { year: "numeric", month: "long" }).format(date);
}
export function persianDigits(value, locale = "fa") {
    return new Intl.NumberFormat(locale, { useGrouping: false }).format(value);
}
export function startOfJalaliMonth(value) {
    return shiftISODate(value, 1 - jalaliParts(value).day);
}
/** Accurate across Esfand, leap years, and Gregorian year boundaries. */
export function moveJalaliMonth(value, offset) {
    if (!Number.isSafeInteger(offset) || Math.abs(offset) > 1200)
        throw new RangeError("Invalid month offset");
    let current = startOfJalaliMonth(value);
    for (let i = 0; i < Math.abs(offset); i += 1) {
        current = offset > 0
            ? startOfJalaliMonth(shiftISODate(current, 32))
            : startOfJalaliMonth(shiftISODate(current, -1));
    }
    return current;
}
/** Saturday=0, Sunday=1, ... Friday=6. */
export function persianWeekdayIndex(value) {
    const date = parseISODate(value);
    if (!date)
        throw new RangeError("Invalid weekday date");
    return (date.getUTCDay() + 1) % 7;
}
/** Always 42 stable slots; neighboring-month days are visible but subdued. */
export function jalaliMonthGrid(month, minISO, maxISO) {
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
export function selectStayDate(range, iso, segment) {
    if (!parseISODate(iso))
        throw new RangeError("Invalid selected date");
    if (segment === "checkIn" || !range.checkIn || iso <= range.checkIn) {
        return { range: { checkIn: iso, checkOut: "" }, nextSegment: "checkOut", complete: false };
    }
    return { range: { checkIn: range.checkIn, checkOut: iso }, nextSegment: "checkIn", complete: true };
}
export function validateStayRange(range, minISO) {
    if (!parseISODate(range.checkIn) || !parseISODate(range.checkOut))
        return "MISSING";
    if (range.checkIn < minISO)
        return "PAST";
    if (range.checkOut <= range.checkIn)
        return "ORDER";
    return "OK";
}
