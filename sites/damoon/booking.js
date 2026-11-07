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
import {
  availableOptions,
  buildHoldPayload,
  createIdempotencyKey,
  formatMoney,
  parseChildAges,
  policySummary,
  validateContact,
} from "./booking-flow.js";

const STORAGE_KEY = "damoon-stay-selection-v2";
const LEGACY_STORAGE_KEY = "damoon-stay-selection-v1";
const DAMOON_PROPERTY_SLUG = "damoon-hotel";
const FA_WEEKDAYS = ["شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه"];
const ADULT_OPTIONS = Array.from({ length: 8 }, (_, index) => index + 1);
const CHILD_OPTIONS = [0, 1, 2, 3, 4];
const dateIcon = '<svg class="booking-field__symbol" viewBox="0 0 32 32" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="4" y="6" width="24" height="23" rx="2"/><path d="M4 12h24M10 2v8M22 2v8M9 17h3m3 0h3m3 0h3M9 22h3m3 0h3m3 0h3"/></svg>';
const guestIcon = '<svg class="booking-field__symbol" viewBox="0 0 32 32" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="14" cy="9" r="6"/><path d="M3 29v-5c0-5 4-8 11-8s11 3 11 8v5H3Zm21-25c6 2 6 10 0 12m3 3c3 2 4 5 3 10"/></svg>';
const submitArrow = '<svg class="booking-submit__arrow" viewBox="0 0 32 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M2 12h27M21 4l8 8-8 8"/></svg>';

function validArrival(value, minISO) {
  if (typeof value !== "string" || !value) return false;
  try { return jalaliMonthGrid(value, minISO).some((day) => day.iso === value && !day.disabled); } catch { return false; }
}
function validCount(value, min, max) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isInteger(number) && number >= min && number <= max ? number : null;
}
function normalizeChildAges(ages, children) {
  if (children === 0) return [];
  if (!Array.isArray(ages) || ages.length !== children) return null;
  const parsed = parseChildAges(ages, children);
  return parsed.ok ? parsed.ages : null;
}
function readStored(minISO) {
  for (const key of [STORAGE_KEY, LEGACY_STORAGE_KEY]) {
    try {
      const stored = JSON.parse(sessionStorage.getItem(key) || "null");
      if (!stored || typeof stored !== "object") continue;
      let range = { checkIn: "", checkOut: "" };
      if (validArrival(stored.checkIn, minISO)) {
        range = { checkIn: stored.checkIn, checkOut: "" };
        if (typeof stored.checkOut === "string" && validateStayRange({ checkIn: stored.checkIn, checkOut: stored.checkOut }, minISO) === "OK") range.checkOut = stored.checkOut;
      }
      const adults = validCount(stored.adults ?? stored.guests, 1, 8) ?? 2;
      const children = validCount(stored.children, 0, 4) ?? 0;
      return { range, adults, children, childAges: normalizeChildAges(stored.childAges, children) };
    } catch {}
  }
  return { range: { checkIn: "", checkOut: "" }, adults: 2, children: 0, childAges: [] };
}
function initialSelection(minISO) {
  const params = new URL(window.location.href).searchParams;
  const queryCheckIn = params.get("checkIn") || "";
  const queryCheckOut = params.get("checkOut") || "";
  const queryIsValidRange = validateStayRange({ checkIn: queryCheckIn, checkOut: queryCheckOut }, minISO) === "OK";
  const queryHasValidArrival = validArrival(queryCheckIn, minISO);
  const stored = readStored(minISO);
  const range = queryIsValidRange ? { checkIn: queryCheckIn, checkOut: queryCheckOut } : queryHasValidArrival ? { checkIn: queryCheckIn, checkOut: "" } : stored.range;
  const adults = validCount(params.get("adults") ?? params.get("guests"), 1, 8) || stored.adults || 2;
  const children = validCount(params.get("children"), 0, 4) ?? stored.children ?? 0;
  const queryAges = params.get("childAges");
  const childAges = normalizeChildAges(queryAges ? queryAges.split(",") : stored.childAges, children);
  return { range, adults, children, childAges };
}

let activeSelection;
export function readStaySelection() {
  const selection = activeSelection || initialSelection(todayLocalISO());
  const adults = selection.adults || 2;
  const children = selection.children || 0;
  return { range: { ...selection.range }, adults, children, childAges: Array.isArray(selection.childAges) ? [...selection.childAges] : null, guests: adults };
}

function routeRoomDetail() { return /^\/rooms\/(single|double|suite-3-bed|suite-4-5-bed)$/.test(normalizePath(window.location.pathname)); }
function shortStayDate(iso, locale) { return new Intl.DateTimeFormat(`${locale}-u-ca-persian`, { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "UTC" }).format(new Date(`${iso}T12:00:00Z`)); }
function rangeSummary(range, locale) { const separator = locale === "fa" ? " تا " : locale === "ar" ? " إلى " : " – "; return `${jalaliAccessibleDay(range.checkIn, locale)}${separator}${jalaliAccessibleDay(range.checkOut, locale)}`; }

const faUi = {
  bookingSummary: "انتخاب فعلی", guests: "بزرگسالان", adults: "بزرگسالان", children: "کودکان", checkIn: "تاریخ ورود", checkOut: "تاریخ خروج", datePlanningOnly: "انتخاب تاریخ برای بررسی موجودی و رزرو موقت.", contactForStay: "تماس برای هماهنگی این اقامت", stayPlanning: "برنامه‌ریزی اقامت", selectStayDates: "تاریخ اقامتتان را انتخاب کنید", selectArrivalDate: "انتخاب تاریخ ورود", selectDepartureDate: "انتخاب تاریخ خروج", selectDate: "انتخاب تاریخ", selectGuestCount: "تعداد بزرگسالان", bookingSubmit: "بررسی گزینه‌های اقامت", calendar: "تاریخ ورود و خروج", closeCalendar: "بستن تقویم", previousMonth: "ماه قبل", nextMonth: "ماه بعد", chooseArrivalFirst: "ابتدا روز ورود را انتخاب کنید.", chooseDepartureNext: "حالا روز خروج را انتخاب کنید.", arrivalCannotBePast: "تاریخ ورود نمی‌تواند در گذشته باشد.", departureAfterArrival: "تاریخ خروج باید پس از تاریخ ورود باشد.", selectBothDates: "ابتدا تاریخ ورود و خروج را انتخاب کنید.", childAge: "سن کودک {index}", childAgeRequired: "برای هر کودک سن معتبر (۰ تا ۱۷) وارد کنید.", selectRoom: "انتخاب اتاق", pricePerNight: "هر شب", totalPrice: "جمع", nightsCountOther: "{count} شب", guestDetails: "اطلاعات مهمان", fullName: "نام و نام خانوادگی", phone: "شماره تماس", email: "ایمیل (اختیاری)", policyAcceptance: "قوانین لغو را خوانده‌ام و می‌پذیرم.", policyRequired: "برای ادامه باید قوانین لغو را بپذیرید.", holdRoom: "رزرو موقت این اتاق", holdUnavailable: "سرویس رزرو موقت در حال حاضر فعال نیست.", holdCreated: "اتاق به‌صورت موقت رزرو شد.", holdReference: "کد پیگیری", holdExpires: "انقضای رزرو موقت", backToOptions: "بازگشت به گزینه‌ها", invalidContact: "نام کامل و شماره تماس معتبر وارد کنید.", searching: "در حال بررسی موجودی...", adultsCountOther: "{count} بزرگسال",
};

function weekdayLabels(locale) { if (locale === "fa") return FA_WEEKDAYS; const saturday = Date.UTC(2023, 2, 25); return Array.from({ length: 7 }, (_, index) => new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" }).format(new Date(saturday + index * 86400000))); }
function formattedCount(value, locale) { return new Intl.NumberFormat(locale, { useGrouping: false }).format(value); }
function adultsCountLabel(value, locale, ui) {
  if (locale === "fa") return `${formattedCount(value, locale)} بزرگسال`;
  const category = new Intl.PluralRules(locale).select(value);
  const key = `adultsCount${category[0].toUpperCase()}${category.slice(1)}`;
  return (ui[key] || ui.adultsCountOther || "{count} adults").replace("{count}", formattedCount(value, locale));
}
function nightsLabel(count, locale, ui) {
  if (locale === "fa") return `${formattedCount(count, locale)} شب`;
  const category = new Intl.PluralRules(locale).select(count);
  const key = `nightsCount${category[0].toUpperCase()}${category.slice(1)}`;
  return (ui[key] || ui.nightsCountOther || "{count} nights").replace("{count}", formattedCount(count, locale));
}
function escapeHtml(value) { return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]); }
function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

export function mountBooking(slot, { routeHref = (path) => path, locale = localeForPath(window.location.pathname) } = {}) {
  if (!(slot instanceof Element)) return () => {};
  const ui = { ...faUi, ...(translations[locale]?.ui || {}) };
  const weekdays = weekdayLabels(locale);
  const today = todayLocalISO();
  let selection = initialSelection(today);
  let range = selection.range;
  let adults = selection.adults;
  let children = selection.children;
  let childAges = Array.isArray(selection.childAges) ? [...selection.childAges] : [];
  let activeSegment = "checkIn";
  let monthCursor = range.checkIn || today;
  let dialogOpener = null;
  let focusISO = "";
  let flow = { step: "search", options: [], selected: null, hold: null, busy: false, message: "", error: false };

  const persist = () => {
    activeSelection = { range: { ...range }, adults, children, childAges: [...childAges] };
    document.dispatchEvent(new CustomEvent("damoon:stay-change"));
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ ...range, adults, children, childAges })); } catch {}
  };
  const bookingIsValid = () => validateStayRange(range, today) === "OK";

  if (routeRoomDetail() && bookingIsValid()) {
    const contactUrl = new URL(routeHref("/contact"), window.location.href);
    contactUrl.searchParams.set("checkIn", range.checkIn); contactUrl.searchParams.set("checkOut", range.checkOut);
    contactUrl.searchParams.set("adults", String(adults)); contactUrl.searchParams.set("children", String(children));
    if (childAges.length === children && children) contactUrl.searchParams.set("childAges", childAges.join(","));
    slot.innerHTML = `<section class="booking-summary" aria-labelledby="booking-summary-title"><div class="booking-summary__details"><p class="booking-kicker">${escapeHtml(ui.bookingSummary)}</p><h2 id="booking-summary-title">${escapeHtml(rangeSummary(range, locale))}</h2><p>${escapeHtml(adultsCountLabel(adults, locale, ui))} · ${escapeHtml(ui.datePlanningOnly)}</p></div><a class="booking-submit" href="${escapeHtml(contactUrl.href)}">${escapeHtml(ui.contactForStay)}</a></section>`;
    persist();
    return () => {};
  }

  slot.innerHTML = `<section class="booking-strip" aria-labelledby="booking-title">
    <div class="booking-strip__heading"><p class="booking-kicker">${escapeHtml(ui.stayPlanning)}</p><h2 id="booking-title">${escapeHtml(ui.selectStayDates)}</h2><p>${escapeHtml(ui.datePlanningOnly)}</p></div>
    <form class="booking-form" novalidate>
      <div class="booking-form__fields">
        <button class="booking-field" type="button" data-date-field="checkIn" aria-haspopup="dialog" aria-controls="booking-calendar" aria-expanded="false" aria-label="${escapeHtml(ui.selectArrivalDate)}">${dateIcon}<span>${escapeHtml(ui.checkIn)}</span><strong data-date-value="checkIn">${escapeHtml(ui.selectDate)}</strong><span class="booking-field__icon" aria-hidden="true">⌄</span></button>
        <button class="booking-field" type="button" data-date-field="checkOut" aria-haspopup="dialog" aria-controls="booking-calendar" aria-expanded="false" aria-label="${escapeHtml(ui.selectDepartureDate)}">${dateIcon}<span>${escapeHtml(ui.checkOut)}</span><strong data-date-value="checkOut">${escapeHtml(ui.selectDate)}</strong><span class="booking-field__icon" aria-hidden="true">⌄</span></button>
        <label class="booking-field booking-field--guests">${guestIcon}<span>${escapeHtml(ui.adults || ui.guests)}</span><select data-adult-count aria-label="${escapeHtml(ui.selectGuestCount)}">${ADULT_OPTIONS.map((count) => `<option value="${count}">${escapeHtml(adultsCountLabel(count, locale, ui))}</option>`).join("")}</select><span class="booking-field__icon" aria-hidden="true">⌄</span></label>
        <label class="booking-field booking-field--children"><span>${escapeHtml(ui.children)}</span><select data-child-count aria-label="${escapeHtml(ui.children)}">${CHILD_OPTIONS.map((c) => `<option value="${c}">${escapeHtml(formattedCount(c, locale))}</option>`).join("")}</select><span class="booking-field__icon" aria-hidden="true">⌄</span></label>
        <button class="booking-submit" type="submit">${escapeHtml(ui.bookingSubmit)}${submitArrow}</button>
      </div>
      <div class="booking-flow" data-booking-flow aria-live="polite"></div>
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
  const flowNode = slot.querySelector("[data-booking-flow]");
  const adultSelect = slot.querySelector("[data-adult-count]");
  const childSelect = slot.querySelector("[data-child-count]");
  const dateValues = Object.fromEntries([...slot.querySelectorAll("[data-date-value]")].map((node) => [node.dataset.dateValue, node]));

  function setMessage(text, isError = false) { flow.message = text || ""; flow.error = Boolean(isError); renderFlow(); }
  function updateFields() {
    for (const segment of ["checkIn", "checkOut"]) {
      const iso = range[segment];
      dateValues[segment].textContent = iso ? shortStayDate(iso, locale) : ui.selectDate;
      const button = slot.querySelector(`[data-date-field="${segment}"]`);
      button.setAttribute("aria-label", iso ? `${segment === "checkIn" ? ui.checkIn : ui.checkOut}: ${jalaliAccessibleDay(iso, locale)}` : segment === "checkIn" ? ui.selectArrivalDate : ui.selectDepartureDate);
    }
    adultSelect.value = String(adults); childSelect.value = String(children);
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
      const isStart = day.iso === range.checkIn; const isEnd = day.iso === range.checkOut; const inRange = range.checkIn && range.checkOut && day.iso > range.checkIn && day.iso < range.checkOut;
      const classes = ["booking-day", !day.currentMonth && "is-outside", day.friday && "is-friday", isStart && "is-range-start", isEnd && "is-range-end", inRange && "is-in-range"].filter(Boolean).join(" ");
      return `<div role="gridcell" aria-selected="${isStart || isEnd}"><button class="${classes}" type="button" data-calendar-day="${day.iso}" aria-label="${escapeHtml(jalaliAccessibleDay(day.iso, locale))}"${day.disabled ? " disabled" : ""}${focusISO === day.iso ? ' data-focus-target="true"' : ""}>${formattedCount(day.jalaliDay, locale)}</button></div>`;
    }).join("")}</div>`).join("");
    if (focusISO) { slot.querySelector('[data-focus-target="true"]')?.focus(); focusISO = ""; }
    slot.querySelectorAll("[data-calendar-day]").forEach((button) => button.addEventListener("click", () => {
      const selected = button.dataset.calendarDay; const result = selectStayDate(range, selected, activeSegment);
      range = result.range; activeSegment = result.nextSegment; monthCursor = selected; flow = { step: "search", options: [], selected: null, hold: null, busy: false, message: "", error: false }; persist(); updateFields();
      if (result.complete && bookingIsValid()) { drawCalendar(); dialog.close(); } else { focusISO = selected; drawCalendar(); }
    }));
  }
  function openCalendar(segment) {
    activeSegment = segment === "checkOut" && !range.checkIn ? "checkIn" : segment; monthCursor = range.checkIn || today; dialogOpener = slot.querySelector(`[data-date-field="${activeSegment}"]`);
    dialogOpener.setAttribute("aria-expanded", "true"); drawCalendar(); dialog.showModal(); slot.querySelector("[data-calendar-close]").focus();
  }
  function childAgeInputsHtml(values) {
    if (!children) return "";
    return `<div class="booking-child-ages">${Array.from({ length: children }, (_, i) => {
      const label = (ui.childAge || "Child {index} age").replace("{index}", formattedCount(i + 1, locale));
      const value = Number.isInteger(values?.[i]) ? values[i] : "";
      return `<label class="booking-field booking-field--child-age"><span>${escapeHtml(label)}</span><input data-child-age="${i}" type="number" min="0" max="17" inputmode="numeric" required value="${escapeHtml(value)}" /></label>`;
    }).join("")}</div>`;
  }
  function optionCard(option, index) {
    const nights = Array.isArray(option.nights) ? option.nights.length : 0;
    const policy = option.ratePlan?.cancellationPolicy;
    const summary = policySummary(policy, locale);
    return `<article class="booking-option"><div class="booking-option__main"><h4>${escapeHtml(option.roomType?.name || option.roomType?.slug || "")}</h4><p>${escapeHtml(option.ratePlan?.name || option.ratePlan?.code || "")} · ${escapeHtml(nightsLabel(nights, locale, ui))}</p>${summary ? `<p class="booking-option__policy">${escapeHtml(summary)}</p>` : ""}</div><div class="booking-option__price"><strong>${escapeHtml(formatMoney(option.totalRate, option.ratePlan?.currency, locale))}</strong><span>${escapeHtml(ui.totalPrice || "Total")}</span><button type="button" class="booking-option__select" data-select-option="${index}">${escapeHtml(ui.selectRoom || "Select")}</button></div></article>`;
  }
  function selectedOptionPanel() {
    const option = flow.selected; if (!option) return "";
    const policy = option.ratePlan?.cancellationPolicy; const summary = policySummary(policy, locale);
    const policyKey = policy?.key || "";
    const ages = childAges.length === children ? childAges : Array.from({ length: children }, () => "");
    return `<section class="booking-step"><div class="booking-step__head"><h4>${escapeHtml(option.roomType?.name || "")} · ${escapeHtml(option.ratePlan?.name || "")}</h4><button type="button" class="booking-link" data-flow-back>${escapeHtml(ui.backToOptions || "Back")}</button></div>
      <p class="booking-step__price">${escapeHtml(formatMoney(option.totalRate, option.ratePlan?.currency, locale))} · ${escapeHtml(nightsLabel((option.nights || []).length, locale, ui))}</p>
      ${children ? `<div class="booking-child-age-block"><p class="booking-step__label">${escapeHtml(ui.childAgeRequired || "")}</p>${childAgeInputsHtml(ages)}</div>` : ""}
      <div class="booking-guest-form"><p class="booking-step__label">${escapeHtml(ui.guestDetails || "Guest details")}</p>
        <label class="booking-field booking-field--text"><span>${escapeHtml(ui.fullName || "Full name")}</span><input data-guest-name type="text" autocomplete="name" required minlength="2" maxlength="120" /></label>
        <label class="booking-field booking-field--text"><span>${escapeHtml(ui.phone || "Phone")}</span><input data-guest-phone type="tel" autocomplete="tel" required minlength="8" maxlength="24" dir="ltr" /></label>
        <label class="booking-field booking-field--text"><span>${escapeHtml(ui.email || "Email")}</span><input data-guest-email type="email" autocomplete="email" maxlength="200" dir="ltr" /></label>
      </div>
      <div class="booking-policy"><p class="booking-step__label">${escapeHtml(ui.policies || "Policy")}</p><p>${escapeHtml(summary || policy?.name || policyKey || "—")}</p><label class="booking-policy__accept"><input type="checkbox" data-policy-accept ${policyKey ? "" : "disabled"} /> <span>${escapeHtml(ui.policyAcceptance || "I accept the cancellation policy.")}</span></label></div>
      <div class="booking-step__actions"><button type="button" class="booking-submit" data-create-hold ${flow.busy || !policyKey ? "disabled" : ""}>${escapeHtml(ui.holdRoom || "Reserve")}</button></div>
    </section>`;
  }
  function confirmationPanel() {
    const h = flow.hold; if (!h) return "";
    const expires = h.expiresAt ? new Date(h.expiresAt) : null;
    const expiresText = expires && !Number.isNaN(expires.getTime()) ? expires.toLocaleString(locale === "fa" ? "fa-IR" : locale === "ar" ? "ar" : "en-US") : String(h.expiresAt || "");
    return `<section class="booking-step booking-step--confirmed"><h4>${escapeHtml(ui.holdCreated || "Hold created")}</h4><p><strong>${escapeHtml(ui.holdReference || "Reference")}:</strong> <span dir="ltr">${escapeHtml(h.reference || h.holdId || "")}</span></p><p><strong>${escapeHtml(ui.totalPrice || "Total")}:</strong> ${escapeHtml(formatMoney(h.totalRate || h.totalAmount, h.currency, locale))}</p><p><strong>${escapeHtml(ui.holdExpires || "Expires")}:</strong> <span dir="ltr">${escapeHtml(expiresText)}</span></p><div class="booking-step__actions"><button type="button" class="booking-link" data-flow-reset>${escapeHtml(ui.backToOptions || "Back")}</button></div></section>`;
  }
  function renderFlow() {
    if (message) message.textContent = flow.message || ""; else message.textContent = "";
    message.classList.toggle("is-error", Boolean(flow.error));
    if (flow.step === "confirmed") { flowNode.innerHTML = confirmationPanel(); bindFlow(); return; }
    if (flow.step === "details" || flow.selected) { flowNode.innerHTML = selectedOptionPanel(); bindFlow(); return; }
    if (flow.step === "options") {
      const items = availableOptions({ options: flow.options });
      if (!items.length) { flowNode.innerHTML = ""; return; }
      flowNode.innerHTML = `<section class="booking-options" aria-label="${escapeHtml(ui.bookingSubmit)}">${items.map((o, i) => optionCard(o, i)).join("")}</section>`;
      bindFlow(); return;
    }
    flowNode.innerHTML = "";
  }
  async function postJson(path, body, headers = {}) {
    const res = await fetch(path, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });
    const text = await res.text();
    let data = null; try { data = text ? JSON.parse(text) : null; } catch { data = { error: text }; }
    return { ok: res.ok, status: res.status, data };
  }
  function collectChildAgesFromInputs() {
    if (!children) return { ok: true, ages: [] };
    const inputs = [...slot.querySelectorAll("[data-child-age]")];
    return parseChildAges(inputs.map((i) => i.value), children);
  }
  function bindFlow() {
    slot.querySelectorAll("[data-select-option]").forEach((btn) => btn.addEventListener("click", () => {
      const option = availableOptions({ options: flow.options })[Number(btn.dataset.selectOption)];
      if (!option) return;
      flow = { ...flow, step: "details", selected: option, hold: null, message: "", error: false };
      if (!Array.isArray(childAges) || childAges.length !== children) childAges = [];
      renderFlow();
    }));
    slot.querySelector("[data-flow-back]")?.addEventListener("click", () => { flow = { ...flow, step: "options", selected: null, hold: null, message: "", error: false }; renderFlow(); });
    slot.querySelector("[data-flow-reset]")?.addEventListener("click", () => { flow = { step: "options", options: flow.options, selected: null, hold: null, busy: false, message: "", error: false }; renderFlow(); });
    slot.querySelector("[data-create-hold]")?.addEventListener("click", async () => {
      if (flow.busy || !flow.selected) return;
      const agesResult = collectChildAgesFromInputs();
      if (!agesResult.ok) { setMessage(ui.childAgeRequired || "Enter valid ages for each child.", true); slot.querySelector("[data-child-age]")?.focus(); return; }
      childAges = agesResult.ages;
      const contact = validateContact({ fullName: slot.querySelector("[data-guest-name]")?.value, phone: slot.querySelector("[data-guest-phone]")?.value, email: slot.querySelector("[data-guest-email]")?.value });
      if (!contact.ok) { setMessage(ui.invalidContact || "Invalid contact details.", true); slot.querySelector("[data-guest-name]")?.focus(); return; }
      const accepted = slot.querySelector("[data-policy-accept]")?.checked;
      const policyKey = flow.selected.ratePlan?.cancellationPolicy?.key || "";
      if (!policyKey || !accepted) { setMessage(ui.policyRequired || "Accept the cancellation policy.", true); return; }
      flow.busy = true; persist(); renderFlow();
      setMessage(locale === "fa" ? "در حال ثبت رزرو موقت..." : locale === "ar" ? "جارٍ إنشاء الحجز المؤقت..." : "Creating hold...");
      const payload = buildHoldPayload({ property: DAMOON_PROPERTY_SLUG, range, adults, children, childAges, option: flow.selected, contact: contact.value });
      const result = await postJson("/api/hotel/v1/holds", payload, { "Idempotency-Key": createIdempotencyKey() });
      flow.busy = false;
      if (result.ok && result.data?.holdId) { flow = { ...flow, step: "confirmed", hold: result.data, message: "", error: false }; renderFlow(); return; }
      if (result.status === 503) { setMessage(ui.holdUnavailable || "Hold service unavailable.", true); renderFlow(); return; }
      const err = typeof result.data?.error === "string" ? result.data.error : result.data?.error?.message || "";
      setMessage(err ? `${result.status}: ${err}` : (locale === "fa" ? "ثبت رزرو موقت ناموفق بود." : "Hold request failed."), true);
      renderFlow();
    });
  }

  slot.querySelectorAll("[data-date-field]").forEach((button) => button.addEventListener("click", () => openCalendar(button.dataset.dateField)));
  slot.querySelector("[data-calendar-close]").addEventListener("click", () => dialog.close());
  dialog.addEventListener("close", () => { dialogOpener?.setAttribute("aria-expanded", "false"); dialogOpener?.focus(); });
  slot.querySelector("[data-month-prev]").addEventListener("click", () => { monthCursor = moveJalaliMonth(monthCursor, -1); drawCalendar(); slot.querySelector("[data-month-prev]").focus(); });
  slot.querySelector("[data-month-next]").addEventListener("click", () => { monthCursor = moveJalaliMonth(monthCursor, 1); drawCalendar(); slot.querySelector("[data-month-next]").focus(); });
  adultSelect.addEventListener("change", () => { adults = validCount(adultSelect.value, 1, 8) || 2; flow = { step: "search", options: [], selected: null, hold: null, busy: false, message: "", error: false }; persist(); renderFlow(); });
  childSelect.addEventListener("change", () => {
    children = validCount(childSelect.value, 0, 4) ?? 0;
    if (children === 0) childAges = []; else if (childAges.length !== children) childAges = Array.from({ length: children }, (_, i) => (Number.isInteger(childAges[i]) ? childAges[i] : ""));
    flow = { step: "search", options: [], selected: null, hold: null, busy: false, message: "", error: false }; persist(); renderFlow();
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (flow.busy) return;
    const validation = validateStayRange(range, today);
    if (validation !== "OK") {
      setMessage(validation === "PAST" ? ui.arrivalCannotBePast : validation === "ORDER" ? ui.departureAfterArrival : ui.selectBothDates, true);
      if (validation === "MISSING") openCalendar(range.checkIn ? "checkOut" : "checkIn");
      return;
    }
    const agesResult = children ? parseChildAges(childAges.length === children ? childAges : [], children) : { ok: true, ages: [] };
    if (children && !agesResult.ok && childAges.length !== children) { /* ages collected in details step */ }
    persist();
    flow = { step: "search", options: [], selected: null, hold: null, busy: true, message: ui.searching || "Checking availability...", error: false }; renderFlow();
    const submitButton = form.querySelector(".booking-submit[type=submit]"); if (submitButton) submitButton.disabled = true;
    try {
      const safeAges = children ? (parseChildAges(childAges, children).ok ? childAges : Array.from({length: children}, (_, i) => (Number.isInteger(childAges[i]) ? childAges[i] : 0))) : [];
      const { ok, status, data } = await postJson("/api/hotel/v1/availability/search", { property: DAMOON_PROPERTY_SLUG, checkIn: range.checkIn, checkOut: range.checkOut, occupancy: { adults, children, childAges: safeAges } });
      const items = availableOptions(data);
      if (!items.length) { flow = { step: "search", options: [], selected: null, hold: null, busy: false, message: locale === "fa" ? "برای این تاریخ اتاقی موجود نیست." : locale === "ar" ? "لا توجد غرف متاحة." : "No rooms available for these dates.", error: true }; renderFlow(); return; }
      flow = { step: "options", options: data?.options || items, selected: null, hold: null, busy: false, message: (locale === "fa" ? "گزینه‌های موجود: " : locale === "ar" ? "الخيارات المتاحة: " : "Available options: ") + items.length, error: false }; renderFlow();
      slot.querySelector("[data-booking-flow]")?.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
    } catch {
      flow = { step: "search", options: [], selected: null, hold: null, busy: false, message: locale === "fa" ? "خطای شبکه در دریافت موجودی." : "Network error while checking availability.", error: true }; renderFlow();
    } finally { if (submitButton) submitButton.disabled = false; }
  });

  updateFields(); renderFlow(); if (bookingIsValid()) persist();
  return () => { if (dialog.open) dialog.close(); slot.replaceChildren(); };
}
