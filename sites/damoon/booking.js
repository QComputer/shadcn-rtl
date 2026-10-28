import {
  jalaliAccessibleDay,
  jalaliMonthGrid,
  jalaliMonthTitle,
  moveJalaliMonth,
  selectStayDate,
  todayLocalISO,
  validateStayRange,
} from "./calendar.js";
import { localeForPath, normalizePath } from "./content.js";
import translations from "./translations.js";

const STORAGE_KEY = "damoon-stay-selection-v1";
const FA_WEEKDAYS = ["شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه"];
const GUEST_OPTIONS = Array.from({ length: 8 }, (_, index) => index + 1);
const dateIcon = '<svg class="booking-field__symbol" viewBox="0 0 32 32" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="4" y="6" width="24" height="23" rx="2"/><path d="M4 12h24M10 2v8M22 2v8M9 17h3m3 0h3m3 0h3M9 22h3m3 0h3m3 0h3"/></svg>';
const guestIcon = '<svg class="booking-field__symbol" viewBox="0 0 32 32" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="14" cy="9" r="6"/><path d="M3 29v-5c0-5 4-8 11-8s11 3 11 8v5H3Zm21-25c6 2 6 10 0 12m3 3c3 2 4 5 3 10"/></svg>';
const submitArrow = '<svg class="booking-submit__arrow" viewBox="0 0 32 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M2 12h27M21 4l8 8-8 8"/></svg>';

function validArrival(value, minISO) {
  if (typeof value !== "string" || !value) return false;
  try {
    return jalaliMonthGrid(value, minISO).some((day) => day.iso === value && !day.disabled);
  } catch {
    return false;
  }
}

function validGuestCount(value) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isInteger(number) && number >= 1 && number <= 8 ? number : null;
}

function safeStoredSelection(minISO) {
  try {
    const stored = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "null");
    if (!stored || typeof stored !== "object") return { range: { checkIn: "", checkOut: "" }, guests: null };
    let range = { checkIn: "", checkOut: "" };
    if (validArrival(stored.checkIn, minISO)) {
      range = { checkIn: stored.checkIn, checkOut: "" };
      if (typeof stored.checkOut === "string" && validateStayRange({ checkIn: stored.checkIn, checkOut: stored.checkOut }, minISO) === "OK") {
        range.checkOut = stored.checkOut;
      }
    }
    return { range, guests: validGuestCount(stored.guests) };
  } catch {
    return { range: { checkIn: "", checkOut: "" }, guests: null };
  }
}

function initialSelection(minISO) {
  const params = new URL(window.location.href).searchParams;
  const queryCheckIn = params.get("checkIn") || "";
  const queryCheckOut = params.get("checkOut") || "";
  const queryRange = { checkIn: queryCheckIn, checkOut: queryCheckOut };
  const queryIsValidRange = validateStayRange(queryRange, minISO) === "OK";
  const queryHasValidArrival = validArrival(queryCheckIn, minISO);
  const stored = safeStoredSelection(minISO);
  const range = queryIsValidRange
    ? queryRange
    : queryHasValidArrival
      ? { checkIn: queryCheckIn, checkOut: "" }
      : stored.range;
  const guestCount = validGuestCount(params.get("guests")) || stored.guests || 2;
  return { range, guests: guestCount };
}

function routeRoomDetail() {
  return /^\/rooms\/(single|double|suite-3-bed|suite-4-5-bed)$/.test(normalizePath(window.location.pathname));
}

function rangeSummary(range, locale) {
  const separator = locale === "fa" ? " تا " : locale === "ar" ? " إلى " : " – ";
  return `${jalaliAccessibleDay(range.checkIn, locale)}${separator}${jalaliAccessibleDay(range.checkOut, locale)}`;
}

const faUi = {
  bookingSummary: "انتخاب فعلی", guests: "تعداد مهمانان", guestCountOne: "{count} مهمان", guestCountOther: "{count} مهمان", checkIn: "تاریخ ورود", checkOut: "تاریخ خروج", datePlanningOnly: "انتخاب تاریخ برای هماهنگی اقامت؛ رزرو آنلاین هنوز فعال نیست.", contactForStay: "تماس برای هماهنگی این اقامت", stayPlanning: "برنامه‌ریزی اقامت", selectStayDates: "تاریخ اقامتتان را انتخاب کنید", selectArrivalDate: "انتخاب تاریخ ورود", selectDepartureDate: "انتخاب تاریخ خروج", selectDate: "انتخاب تاریخ", selectGuestCount: "تعداد مهمانان", bookingSubmit: "بررسی گزینه‌های اقامت", calendar: "تاریخ ورود و خروج", closeCalendar: "بستن تقویم", previousMonth: "ماه قبل", nextMonth: "ماه بعد", chooseArrivalFirst: "ابتدا روز ورود را انتخاب کنید.", chooseDepartureNext: "حالا روز خروج را انتخاب کنید.", arrivalCannotBePast: "تاریخ ورود نمی‌تواند در گذشته باشد.", departureAfterArrival: "تاریخ خروج باید پس از تاریخ ورود باشد.", selectBothDates: "ابتدا تاریخ ورود و خروج را انتخاب کنید.",
};

function weekdayLabels(locale) {
  if (locale === "fa") return FA_WEEKDAYS;
  const saturday = Date.UTC(2023, 2, 25);
  return Array.from({ length: 7 }, (_, index) => new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" }).format(new Date(saturday + index * 86400000)));
}

function formattedCount(value, locale) {
  return new Intl.NumberFormat(locale, { useGrouping: false }).format(value);
}

function guestCountLabel(value, locale, ui) {
  if (locale === "fa") return `${formattedCount(value, locale)} مهمان`;
  const category = new Intl.PluralRules(locale).select(value);
  const key = `guestCount${category[0].toUpperCase()}${category.slice(1)}`;
  return (ui[key] || ui.guestCountOther).replace("{count}", formattedCount(value, locale));
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[char]);
}

export function mountBooking(slot, { routeHref = (path) => path, locale = localeForPath(window.location.pathname) } = {}) {
  if (!(slot instanceof Element)) return () => {};

  const ui = translations[locale]?.ui || faUi;
  const weekdays = weekdayLabels(locale);

  const today = todayLocalISO();
  let { range, guests } = initialSelection(today);
  let activeSegment = "checkIn";
  let monthCursor = range.checkIn || today;
  let dialogOpener = null;
  let focusISO = "";

  const persist = () => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ ...range, guests }));
    } catch {
      // The selection remains usable in memory if session storage is unavailable.
    }
  };

  const bookingIsValid = () => validateStayRange(range, today) === "OK";

  if (routeRoomDetail() && bookingIsValid()) {
    const contactUrl = new URL(routeHref("/contact"), window.location.href);
    contactUrl.searchParams.set("checkIn", range.checkIn);
    contactUrl.searchParams.set("checkOut", range.checkOut);
    contactUrl.searchParams.set("guests", String(guests));
    slot.innerHTML = `<section class="booking-summary" aria-labelledby="booking-summary-title">
      <div class="booking-summary__details"><p class="booking-kicker">${escapeHtml(ui.bookingSummary)}</p><h2 id="booking-summary-title">${escapeHtml(rangeSummary(range, locale))}</h2><p>${escapeHtml(guestCountLabel(guests, locale, ui))} · ${escapeHtml(ui.datePlanningOnly)}</p></div>
      <a class="booking-submit" href="${escapeHtml(contactUrl.href)}">${escapeHtml(ui.contactForStay)}</a>
    </section>`;
    return () => {};
  }

  slot.innerHTML = `<section class="booking-strip" aria-labelledby="booking-title">
    <div class="booking-strip__heading"><p class="booking-kicker">${escapeHtml(ui.stayPlanning)}</p><h2 id="booking-title">${escapeHtml(ui.selectStayDates)}</h2><p>${escapeHtml(ui.datePlanningOnly)}</p></div>
    <form class="booking-form" novalidate>
      <div class="booking-form__fields">
        <button class="booking-field" type="button" data-date-field="checkIn" aria-haspopup="dialog" aria-controls="booking-calendar" aria-expanded="false" aria-label="${escapeHtml(ui.selectArrivalDate)}">${dateIcon}<span>${escapeHtml(ui.checkIn)}</span><strong data-date-value="checkIn">${escapeHtml(ui.selectDate)}</strong><span class="booking-field__icon" aria-hidden="true">⌄</span></button>
        <button class="booking-field" type="button" data-date-field="checkOut" aria-haspopup="dialog" aria-controls="booking-calendar" aria-expanded="false" aria-label="${escapeHtml(ui.selectDepartureDate)}">${dateIcon}<span>${escapeHtml(ui.checkOut)}</span><strong data-date-value="checkOut">${escapeHtml(ui.selectDate)}</strong><span class="booking-field__icon" aria-hidden="true">⌄</span></button>
        <label class="booking-field booking-field--guests">${guestIcon}<span>${escapeHtml(ui.guests)}</span><select aria-label="${escapeHtml(ui.selectGuestCount)}">${GUEST_OPTIONS.map((count) => `<option value="${count}">${escapeHtml(guestCountLabel(count, locale, ui))}</option>`).join("")}</select><span class="booking-field__icon" aria-hidden="true">⌄</span></label>
        <button class="booking-submit" type="submit">${escapeHtml(ui.bookingSubmit)}${submitArrow}</button>
      </div>
      <p class="booking-message" role="status" aria-live="polite"></p>
    </form>
    <dialog id="booking-calendar" class="booking-calendar" aria-labelledby="booking-calendar-title">
      <div class="booking-calendar__panel">
        <div class="booking-calendar__top"><div><p class="booking-kicker" data-calendar-active-label></p><h3 id="booking-calendar-title">${escapeHtml(ui.calendar)}</h3></div><button class="booking-calendar__close" type="button" data-calendar-close aria-label="${escapeHtml(ui.closeCalendar)}">×</button></div>
        <div class="booking-calendar__month"><button type="button" data-month-prev aria-label="${escapeHtml(ui.previousMonth)}">‹</button><h4 data-month-title></h4><button type="button" data-month-next aria-label="${escapeHtml(ui.nextMonth)}">›</button></div>
        <div class="booking-calendar__weekdays" role="row">${weekdays.map((day) => `<span role="columnheader">${escapeHtml(day)}</span>`).join("")}</div>
        <div class="booking-calendar__days" role="grid" aria-labelledby="booking-calendar-title"></div>
        <p class="booking-calendar__hint" data-calendar-hint></p>
      </div>
    </dialog>
  </section>`;

  const form = slot.querySelector(".booking-form");
  const dialog = slot.querySelector(".booking-calendar");
  const message = slot.querySelector(".booking-message");
  const guestSelect = slot.querySelector("select[aria-label]");
  const dateValues = Object.fromEntries([...slot.querySelectorAll("[data-date-value]")].map((node) => [node.dataset.dateValue, node]));
  guestSelect.value = String(guests);

  function updateFields() {
    for (const segment of ["checkIn", "checkOut"]) {
      const iso = range[segment];
      dateValues[segment].textContent = iso ? jalaliAccessibleDay(iso, locale) : ui.selectDate;
      const button = slot.querySelector(`[data-date-field="${segment}"]`);
      button.setAttribute("aria-label", iso
        ? `${segment === "checkIn" ? ui.checkIn : ui.checkOut}: ${jalaliAccessibleDay(iso, locale)}`
        : segment === "checkIn" ? ui.selectArrivalDate : ui.selectDepartureDate);
    }
    guestSelect.value = String(guests);
  }

  function focusDay(iso) {
    if (!iso) return;
    slot.querySelector(`[data-calendar-day="${iso}"]`)?.focus();
  }

  function drawCalendar() {
    slot.querySelector("[data-month-title]").textContent = jalaliMonthTitle(monthCursor, locale);
    const activeDateLabel = activeSegment === "checkIn" ? ui.selectArrivalDate : ui.selectDepartureDate;
    slot.querySelector("#booking-calendar-title").textContent = activeDateLabel;
    slot.querySelector("[data-calendar-active-label]").textContent = activeDateLabel;
    slot.querySelector("[data-calendar-hint]").textContent = activeSegment === "checkIn" ? ui.chooseArrivalFirst : ui.chooseDepartureNext;
    const days = jalaliMonthGrid(monthCursor, today);
    const rows = Array.from({ length: 6 }, (_, rowIndex) => days.slice(rowIndex * 7, rowIndex * 7 + 7));
    slot.querySelector(".booking-calendar__days").innerHTML = rows.map((week) => `<div class="booking-calendar__week" role="row">${week.map((day) => {
      const isStart = day.iso === range.checkIn;
      const isEnd = day.iso === range.checkOut;
      const inRange = range.checkIn && range.checkOut && day.iso > range.checkIn && day.iso < range.checkOut;
      const classes = [
        "booking-day",
        !day.currentMonth && "is-outside",
        day.friday && "is-friday",
        isStart && "is-range-start",
        isEnd && "is-range-end",
        inRange && "is-in-range",
      ].filter(Boolean).join(" ");
      return `<div role="gridcell" aria-selected="${isStart || isEnd}"><button class="${classes}" type="button" data-calendar-day="${day.iso}" aria-label="${escapeHtml(jalaliAccessibleDay(day.iso, locale))}"${day.disabled ? " disabled" : ""}${focusISO === day.iso ? ' data-focus-target="true"' : ""}>${formattedCount(day.jalaliDay, locale)}</button></div>`;
    }).join("")}</div>`).join("");
    if (focusISO) {
      const focusTarget = slot.querySelector('[data-focus-target="true"]');
      focusTarget?.focus();
      focusISO = "";
    }
    slot.querySelectorAll("[data-calendar-day]").forEach((button) => button.addEventListener("click", () => {
      const selected = button.dataset.calendarDay;
      const result = selectStayDate(range, selected, activeSegment);
      range = result.range;
      activeSegment = result.nextSegment;
      monthCursor = selected;
      message.textContent = "";
      persist();
      updateFields();
      if (result.complete && bookingIsValid()) {
        drawCalendar();
        dialog.close();
      } else {
        focusISO = selected;
        drawCalendar();
      }
    }));
  }

  function openCalendar(segment) {
    activeSegment = segment === "checkOut" && !range.checkIn ? "checkIn" : segment;
    monthCursor = range.checkIn || today;
    dialogOpener = slot.querySelector(`[data-date-field="${activeSegment}"]`);
    message.textContent = "";
    dialogOpener.setAttribute("aria-expanded", "true");
    drawCalendar();
    dialog.showModal();
    slot.querySelector("[data-calendar-close]").focus();
  }

  slot.querySelectorAll("[data-date-field]").forEach((button) => button.addEventListener("click", () => openCalendar(button.dataset.dateField)));
  slot.querySelector("[data-calendar-close]").addEventListener("click", () => dialog.close());
  dialog.addEventListener("close", () => {
    dialogOpener?.setAttribute("aria-expanded", "false");
    dialogOpener?.focus();
  });
  slot.querySelector("[data-month-prev]").addEventListener("click", () => {
    monthCursor = moveJalaliMonth(monthCursor, -1);
    drawCalendar();
    slot.querySelector("[data-month-prev]").focus();
  });
  slot.querySelector("[data-month-next]").addEventListener("click", () => {
    monthCursor = moveJalaliMonth(monthCursor, 1);
    drawCalendar();
    slot.querySelector("[data-month-next]").focus();
  });

  guestSelect.addEventListener("change", () => {
    guests = validGuestCount(guestSelect.value) || 2;
    persist();
    message.textContent = "";
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const validation = validateStayRange(range, today);
    if (validation !== "OK") {
      message.textContent = validation === "PAST"
        ? ui.arrivalCannotBePast
        : validation === "ORDER"
          ? ui.departureAfterArrival
          : ui.selectBothDates;
      if (validation === "MISSING") openCalendar(range.checkIn ? "checkOut" : "checkIn");
      return;
    }
    const params = new URLSearchParams({ checkIn: range.checkIn, checkOut: range.checkOut, guests: String(guests) });
    persist();
    window.location.assign(routeHref(`/rooms?${params.toString()}`));
  });

  updateFields();
  if (bookingIsValid()) persist();

  return () => {
    if (dialog.open) dialog.close();
    slot.replaceChildren();
  };
}
