import {
  jalaliAccessibleDay,
  jalaliMonthGrid,
  jalaliMonthTitle,
  moveJalaliMonth,
  persianDigits,
  selectStayDate,
  todayLocalISO,
  validateStayRange,
} from "./calendar.js";

const STORAGE_KEY = "damoon-stay-selection-v1";
const WEEKDAYS = ["شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه"];
const GUEST_OPTIONS = Array.from({ length: 8 }, (_, index) => index + 1);

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
  const path = window.location.pathname.replace(/\/+$/, "") || "/";
  const localizedPath = path.startsWith("/fa/") ? path.slice(3) : path;
  return /^\/rooms\/(single|double|suite-3-bed|suite-4-5-bed)$/.test(localizedPath);
}

function rangeSummary(range) {
  return `${jalaliAccessibleDay(range.checkIn, "fa")} تا ${jalaliAccessibleDay(range.checkOut, "fa")}`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[char]);
}

export function mountBooking(slot, { routeHref = (path) => path } = {}) {
  if (!(slot instanceof Element)) return () => {};

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
      <div class="booking-summary__details"><p class="booking-kicker">انتخاب فعلی</p><h2 id="booking-summary-title">${escapeHtml(rangeSummary(range))}</h2><p>${persianDigits(guests, "fa")} مهمان · انتخاب تاریخ برای هماهنگی اقامت؛ رزرو آنلاین هنوز فعال نیست.</p></div>
      <a class="booking-submit" href="${escapeHtml(contactUrl.href)}">تماس برای هماهنگی این اقامت</a>
    </section>`;
    return () => {};
  }

  slot.innerHTML = `<section class="booking-strip" aria-labelledby="booking-title">
    <div class="booking-strip__heading"><p class="booking-kicker">برنامه‌ریزی اقامت</p><h2 id="booking-title">تاریخ اقامتتان را انتخاب کنید</h2><p>انتخاب تاریخ برای هماهنگی اقامت؛ رزرو آنلاین هنوز فعال نیست.</p></div>
    <form class="booking-form" novalidate>
      <div class="booking-form__fields">
        <button class="booking-field" type="button" data-date-field="checkIn" aria-haspopup="dialog" aria-controls="booking-calendar" aria-expanded="false" aria-label="انتخاب تاریخ ورود"><span>تاریخ ورود</span><strong data-date-value="checkIn">انتخاب تاریخ</strong><span class="booking-field__icon" aria-hidden="true">⌄</span></button>
        <button class="booking-field" type="button" data-date-field="checkOut" aria-haspopup="dialog" aria-controls="booking-calendar" aria-expanded="false" aria-label="انتخاب تاریخ خروج"><span>تاریخ خروج</span><strong data-date-value="checkOut">انتخاب تاریخ</strong><span class="booking-field__icon" aria-hidden="true">⌄</span></button>
        <label class="booking-field booking-field--guests"><span>تعداد مهمانان</span><select aria-label="تعداد مهمانان">${GUEST_OPTIONS.map((count) => `<option value="${count}">${persianDigits(count, "fa")} مهمان</option>`).join("")}</select><span class="booking-field__icon" aria-hidden="true">⌄</span></label>
        <button class="booking-submit" type="submit">بررسی گزینه‌های اقامت</button>
      </div>
      <p class="booking-message" role="status" aria-live="polite"></p>
    </form>
    <dialog id="booking-calendar" class="booking-calendar" aria-labelledby="booking-calendar-title">
      <div class="booking-calendar__panel">
        <div class="booking-calendar__top"><div><p class="booking-kicker">انتخاب تاریخ ${activeSegment === "checkIn" ? "ورود" : "خروج"}</p><h3 id="booking-calendar-title">تاریخ ورود و خروج</h3></div><button class="booking-calendar__close" type="button" data-calendar-close aria-label="بستن تقویم">×</button></div>
        <div class="booking-calendar__month"><button type="button" data-month-prev aria-label="ماه قبل">‹</button><h4 data-month-title></h4><button type="button" data-month-next aria-label="ماه بعد">›</button></div>
        <div class="booking-calendar__weekdays" role="row">${WEEKDAYS.map((day) => `<span role="columnheader">${day}</span>`).join("")}</div>
        <div class="booking-calendar__days" role="grid" aria-labelledby="booking-calendar-title"></div>
        <p class="booking-calendar__hint">${activeSegment === "checkIn" ? "ابتدا روز ورود را انتخاب کنید." : "حالا روز خروج را انتخاب کنید."}</p>
      </div>
    </dialog>
  </section>`;

  const form = slot.querySelector(".booking-form");
  const dialog = slot.querySelector(".booking-calendar");
  const message = slot.querySelector(".booking-message");
  const guestSelect = slot.querySelector("select[aria-label='تعداد مهمانان']");
  const dateValues = Object.fromEntries([...slot.querySelectorAll("[data-date-value]")].map((node) => [node.dataset.dateValue, node]));
  guestSelect.value = String(guests);

  function updateFields() {
    for (const segment of ["checkIn", "checkOut"]) {
      const iso = range[segment];
      dateValues[segment].textContent = iso ? jalaliAccessibleDay(iso, "fa") : "انتخاب تاریخ";
      const button = slot.querySelector(`[data-date-field="${segment}"]`);
      button.setAttribute("aria-label", iso
        ? `تاریخ ${segment === "checkIn" ? "ورود" : "خروج"}: ${jalaliAccessibleDay(iso, "fa")}`
        : `انتخاب تاریخ ${segment === "checkIn" ? "ورود" : "خروج"}`);
    }
    guestSelect.value = String(guests);
  }

  function focusDay(iso) {
    if (!iso) return;
    slot.querySelector(`[data-calendar-day="${iso}"]`)?.focus();
  }

  function drawCalendar() {
    slot.querySelector("[data-month-title]").textContent = jalaliMonthTitle(monthCursor, "fa");
    slot.querySelector("#booking-calendar-title").textContent = `انتخاب تاریخ ${activeSegment === "checkIn" ? "ورود" : "خروج"}`;
    slot.querySelector(".booking-calendar__top .booking-kicker").textContent = `انتخاب تاریخ ${activeSegment === "checkIn" ? "ورود" : "خروج"}`;
    slot.querySelector(".booking-calendar__hint").textContent = activeSegment === "checkIn" ? "ابتدا روز ورود را انتخاب کنید." : "حالا روز خروج را انتخاب کنید.";
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
      return `<div role="gridcell" aria-selected="${isStart || isEnd}"><button class="${classes}" type="button" data-calendar-day="${day.iso}" aria-label="${escapeHtml(jalaliAccessibleDay(day.iso, "fa"))}"${day.disabled ? " disabled" : ""}${focusISO === day.iso ? ' data-focus-target="true"' : ""}>${persianDigits(day.jalaliDay, "fa")}</button></div>`;
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
        ? "تاریخ ورود نمی‌تواند در گذشته باشد."
        : validation === "ORDER"
          ? "تاریخ خروج باید پس از تاریخ ورود باشد."
          : "ابتدا تاریخ ورود و خروج را انتخاب کنید.";
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
