import {
  jalaliAccessibleDay,
  jalaliMonthGrid,
  jalaliMonthTitle,
  moveJalaliMonth,
  selectStayDate,
  todayLocalISO,
  validateStayRange,
} from "./calendar.js";
import { accommodationCategories, localeForPath, normalizePath, roomForPath } from "./content.js";
import translations from "./translations.js";
import {
  availableOptions,
  buildReservationEntryUrl,
  buildHoldPayload,
  buildGuestRequestPayload,
  createIdempotencyKey,
  formatMoney,
  holdAttemptFingerprint,
  parseChildAges,
  policySummary,
  requestAttemptFingerprint,
  validateContact,
  withStaySelection,
} from "./booking-flow.js";
import { isDamoonPublicBookingActivated } from "./booking-activation.js";

const STORAGE_KEY = "damoon-stay-selection-v2";
const LEGACY_STORAGE_KEY = "damoon-stay-selection-v1";
const COORDINATION_STORAGE_KEY = "damoon-coordination-request-v1";
const DAMOON_PROPERTY_SLUG = "damoon-hotel";
const FA_WEEKDAYS = ["شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه"];
const ADULT_OPTIONS = Array.from({ length: 8 }, (_, index) => index + 1);
const CHILD_OPTIONS = [0, 1, 2, 3, 4];
const dateIcon = '<svg class="booking-field__symbol" viewBox="0 0 32 32" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="4" y="6" width="24" height="23" rx="2"/><path d="M4 12h24M10 2v8M22 2v8M9 17h3m3 0h3m3 0h3M9 22h3m3 0h3m3 0h3"/></svg>';
const guestIcon = '<svg class="booking-field__symbol" viewBox="0 0 32 32" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="14" cy="9" r="6"/><path d="M3 29v-5c0-5 4-8 11-8s11 3 11 8v5H3Zm21-25c6 2 6 10 0 12m3 3c3 2 4 5 3 10"/></svg>';
const submitArrow = '<svg class="booking-submit__arrow" viewBox="0 0 32 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M2 12h27M21 4l8 8-8 8"/></svg>';
const requestCopy = {
  fa: { submit: "ارسال درخواست هماهنگی اقامت", notBooking: "این فرم فقط درخواست هماهنگی برای پذیرش می‌فرستد؛ اتاق نگه‌داری یا رزرو نمی‌شود و پرداخت آنلاین ندارد.", unavailable: "ثبت درخواست هماهنگی در حال حاضر فعال نیست.", received: "درخواست هماهنگی برای پذیرش ارسال شد", reference: "کد پیگیری امن", keepReference: "این کد را برای پیگیری نزد خود نگه دارید.", status: "وضعیت درخواست", check: "بررسی وضعیت", checking: "در حال بررسی وضعیت...", trackLabel: "پیگیری با کد امن", trackButton: "نمایش وضعیت", trackError: "درخواستی با این کد پیدا نشد یا کد معتبر نیست.", statuses: { RECEIVED: "دریافت‌شده", IN_REVIEW: "در حال بررسی", OPTION_OFFERED: "پیشنهاد برای بررسی شما آماده است", UNAVAILABLE: "در این زمان در دسترس نیست", DECLINED: "پذیرفته نشد", CLOSED: "بسته‌شده" } },
  en: { submit: "Send a stay coordination request", notBooking: "This form sends a coordination request to reception only. It does not select or hold a room, confirm a booking, or take payment.", unavailable: "Stay coordination requests are not enabled yet.", received: "Coordination request sent to reception", reference: "Secure tracking reference", keepReference: "Keep this reference to check your request later.", status: "Request status", check: "Check status", checking: "Checking status...", trackLabel: "Track with secure reference", trackButton: "Show status", trackError: "No request was found for this reference.", statuses: { RECEIVED: "Received", IN_REVIEW: "Under review", OPTION_OFFERED: "An option is ready for your review", UNAVAILABLE: "Unavailable for these dates", DECLINED: "Declined", CLOSED: "Closed" } },
  ar: { submit: "إرسال طلب تنسيق الإقامة", notBooking: "يرسل هذا النموذج طلب تنسيق إلى الاستقبال فقط. لا يختار غرفة ولا يحجزها ولا يؤكد الحجز أو يستلم دفعة.", unavailable: "طلبات تنسيق الإقامة غير مفعلة حالياً.", received: "تم إرسال طلب التنسيق إلى الاستقبال", reference: "رمز متابعة آمن", keepReference: "احتفظ بهذا الرمز لمتابعة طلبك لاحقاً.", status: "حالة الطلب", check: "تحقق من الحالة", checking: "جارٍ التحقق من الحالة...", trackLabel: "المتابعة باستخدام الرمز الآمن", trackButton: "عرض الحالة", trackError: "لم يتم العثور على طلب بهذا الرمز.", statuses: { RECEIVED: "تم الاستلام", IN_REVIEW: "قيد المراجعة", OPTION_OFFERED: "الخيار جاهز لمراجعتك", UNAVAILABLE: "غير متاح في هذه التواريخ", DECLINED: "مرفوض", CLOSED: "مغلق" } },
};

function validArrival(value, minISO) {
  if (typeof value !== "string" || !value) return false;
  try { return jalaliMonthGrid(value, minISO).some((day) => day.iso === value && !day.disabled); } catch { return false; }
}
function validCount(value, min, max) {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const number = typeof value === "number" ? value : Number(value);
  return Number.isInteger(number) && number >= min && number <= max ? number : null;
}
function normalizeChildAges(ages, children) {
  if (children === 0) return [];
  if (!Array.isArray(ages) || ages.length !== children) return Array.from({ length: children }, () => "");
  return ages.map(value => { const parsed = parseChildAges([value], 1); return parsed.ok ? parsed.ages[0] : ""; });
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
function readCoordinationDraft() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(COORDINATION_STORAGE_KEY) || "null");
    if (!saved || saved.version !== 1 || typeof saved !== "object") return null;
    const draftContact = {
      fullName: typeof saved.draftContact?.fullName === "string" ? saved.draftContact.fullName.slice(0, 120) : "",
      phone: typeof saved.draftContact?.phone === "string" ? saved.draftContact.phone.slice(0, 24) : "",
      email: typeof saved.draftContact?.email === "string" ? saved.draftContact.email.slice(0, 200) : "",
    };
    const draftSpecialRequests = typeof saved.draftSpecialRequests === "string" ? saved.draftSpecialRequests.slice(0, 500) : "";
    const pending = saved.pendingAttempt && typeof saved.pendingAttempt.body === "string" && saved.pendingAttempt.body.length <= 24000
      && typeof saved.pendingAttempt.key === "string" && /^damoon-[a-f0-9]{64}$/.test(saved.pendingAttempt.key)
      ? { body: saved.pendingAttempt.body, key: saved.pendingAttempt.key } : null;
    const request = saved.request && typeof saved.request.reference === "string" && /^[A-Za-z0-9_-]{32,128}$/.test(saved.request.reference)
      && typeof saved.request.status === "string"
      ? { reference: saved.request.reference, status: saved.request.status } : null;
    return {
      step: saved.step === "confirmed" && request ? "confirmed" : saved.step === "coordination-details" ? "coordination-details" : "search",
      draftContact,
      draftSpecialRequests,
      pendingAttempt: pending,
      request,
    };
  } catch { return null; }
}
function initialSelection(minISO) {
  const params = new URL(window.location.href).searchParams;
  const queryCheckIn = params.get("checkIn") || "";
  const queryCheckOut = params.get("checkOut") || "";
  const queryIsValidRange = validateStayRange({ checkIn: queryCheckIn, checkOut: queryCheckOut }, minISO) === "OK";
  const queryHasValidArrival = validArrival(queryCheckIn, minISO);
  const stored = readStored(minISO);
  const hasQueryDates = params.has("checkIn") || params.has("checkOut");
  const range = queryIsValidRange ? { checkIn: queryCheckIn, checkOut: queryCheckOut } : queryHasValidArrival ? { checkIn: queryCheckIn, checkOut: "" } : hasQueryDates ? { checkIn: "", checkOut: "" } : stored.range;
  const adults = params.has("adults") || params.has("guests") ? validCount(params.get("adults") ?? params.get("guests"), 1, 8) ?? 2 : stored.adults;
  const children = params.has("children") ? validCount(params.get("children"), 0, 4) ?? 0 : stored.children;
  const queryAges = params.get("childAges");
  const childAges = normalizeChildAges(params.has("childAges") ? queryAges.split(",") : params.has("children") ? [] : stored.childAges, children);
  return { range, adults, children, childAges };
}

let activeSelection;
export function readStaySelection() {
  const selection = activeSelection || initialSelection(todayLocalISO());
  const adults = selection.adults || 2;
  const children = selection.children || 0;
  return { range: { ...selection.range }, adults, children, childAges: Array.isArray(selection.childAges) ? [...selection.childAges] : null, guests: adults };
}

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

export function mountBooking(slot, { routeHref = (path) => path, locale = localeForPath(window.location.pathname), coordinationOnly = true, requestOnly = false, reservationEntry = false } = {}) {
  if (!(slot instanceof Element)) return () => {};
  const selectedRoom = roomForPath(normalizePath(window.location.pathname))?.slug;
  const provisionalCategory = accommodationCategories.some(({ slug }) => slug === selectedRoom);
  if (provisionalCategory) {
    coordinationOnly = true;
    requestOnly = false;
  }
  // Public booking stays disabled until the checked-in activation record contains
  // explicit property-owner approval. This central gate prevents a public route
  // from opting into availability, holds, reservations, or payment on its own.
  if (!isDamoonPublicBookingActivated()) requestOnly = true;
  const ui = { ...faUi, ...(translations[locale]?.ui || {}) };
  if (requestOnly) {
    ui.datePlanningOnly = locale === "fa" ? "تاریخ و تعداد مهمانان را برای درخواست هماهنگی با پذیرش انتخاب کنید؛ این فرم نرخ یا موجودی نشان نمی‌دهد." : locale === "ar" ? "اختر التواريخ وعدد الضيوف لإرسال طلب تنسيق إلى الاستقبال؛ لا يعرض هذا النموذج الأسعار أو التوفر." : "Choose dates and guest counts for reception coordination; this form does not show rates or availability.";
    ui.bookingSubmit = locale === "fa" ? "ادامه برای ثبت درخواست هماهنگی" : locale === "ar" ? "المتابعة لإرسال طلب التنسيق" : "Continue to coordination request";
  }
  if (coordinationOnly) {
    ui.datePlanningOnly = locale === "fa" ? "تاریخ و مهمانان را برای هماهنگی با پذیرش انتخاب کنید؛ این انتخاب تأیید اتاق، نرخ یا موجودی نیست." : locale === "ar" ? "اختر التواريخ والضيوف للتنسيق مع الاستقبال؛ هذا الاختيار لا يؤكد الغرفة أو السعر أو التوفر." : "Choose dates and guests to coordinate with reception; this does not confirm a room, rate or availability.";
    ui.bookingSubmit = locale === "fa" ? "ادامه برای هماهنگی اقامت" : locale === "ar" ? "المتابعة لتنسيق الإقامة" : "Continue to stay coordination";
  }
  if (reservationEntry) {
    ui.datePlanningOnly = locale === "fa" ? "این مسیر فقط درخواست هماهنگی به پذیرش می‌فرستد؛ موجودی و قیمت را بررسی نمی‌کند، اتاق نگه نمی‌دارد و پرداخت انجام نمی‌دهد." : locale === "ar" ? "يرسل هذا المسار طلب تنسيق إلى الاستقبال فقط؛ ولا يتحقق من التوفر أو الأسعار، ولا يحجز غرفة أو ينفذ دفعة." : "This route sends a coordination request to reception only. It does not check availability, confirm rates, hold a room, or take payment.";
  }
  const weekdays = weekdayLabels(locale);
  const today = todayLocalISO();
  let selection = initialSelection(today);
  let range = selection.range;
  let adults = selection.adults;
  let children = selection.children;
  let childAges = Array.isArray(selection.childAges) ? [...selection.childAges] : [];
  const savedCoordination = requestOnly && validateStayRange(range, today) === "OK" ? readCoordinationDraft() : null;
  let activeSegment = "checkIn";
  let monthCursor = range.checkIn || today;
  let dialogOpener = null;
  let focusISO = "";
  let flow = { step: savedCoordination?.step || "search", options: [], selected: null, hold: null, busy: false, message: "", error: false, draftContact: savedCoordination?.draftContact || { fullName: "", phone: "", email: "" }, draftSpecialRequests: savedCoordination?.draftSpecialRequests || "", request: savedCoordination?.request || null, requestStatus: savedCoordination?.request?.status || "", policyAccepted: false };
  let holdAttempt = { key: "", fingerprint: "", payload: null };
  let coordinationAttempt = savedCoordination?.pendingAttempt || null;
  function clearHoldAttempt() { holdAttempt = { key: "", fingerprint: "", payload: null }; }
  function persistCoordinationDraft() {
    try {
      if (!requestOnly) return;
      sessionStorage.setItem(COORDINATION_STORAGE_KEY, JSON.stringify({
        version: 1,
        step: flow.step === "confirmed" && flow.request ? "confirmed" : flow.step === "coordination-details" ? "coordination-details" : "search",
        draftContact: {
          fullName: String(flow.draftContact?.fullName || "").slice(0, 120),
          phone: String(flow.draftContact?.phone || "").slice(0, 24),
          email: String(flow.draftContact?.email || "").slice(0, 200),
        },
        draftSpecialRequests: String(flow.draftSpecialRequests || "").slice(0, 500),
        pendingAttempt: coordinationAttempt,
        request: flow.request ? { reference: flow.request.reference, status: flow.requestStatus || flow.request.status } : null,
      }));
    } catch {}
  }

  const persist = () => {
    activeSelection = { range: { ...range }, adults, children, childAges: [...childAges] };
    document.dispatchEvent(new CustomEvent("damoon:stay-change"));
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ ...range, adults, children, childAges })); } catch {}
  };
  const bookingIsValid = () => validateStayRange(range, today) === "OK";

  if (selectedRoom && (!coordinationOnly || provisionalCategory) && bookingIsValid()) {
    const contactUrl = new URL(routeHref("/contact"), window.location.href);
    contactUrl.searchParams.set("checkIn", range.checkIn); contactUrl.searchParams.set("checkOut", range.checkOut);
    contactUrl.searchParams.set("adults", String(adults)); contactUrl.searchParams.set("children", String(children));
    if (childAges.length === children && children) contactUrl.searchParams.set("childAges", childAges.join(","));
    contactUrl.searchParams.set("room", selectedRoom);
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
      ${reservationEntry && isDamoonPublicBookingActivated() ? `<button class="booking-link" type="button" data-reservation-entry>${escapeHtml(locale === "fa" ? "ادامه برای مشاهده گزینه‌های رزرو" : locale === "ar" ? "المتابعة لعرض خيارات الحجز" : "Continue to reservation options")}</button>` : ""}
      <div class="booking-child-ages-search" data-child-ages-root aria-live="polite"></div>
      <div class="booking-flow" data-booking-flow aria-live="polite"></div>
      <p class="booking-message" role="status" aria-live="polite"></p>
    </form>
    ${requestOnly ? `<form class="booking-step" data-track-request novalidate><label class="booking-field booking-field--text"><span>${escapeHtml(requestCopy[locale]?.trackLabel || requestCopy.en.trackLabel)}</span><input data-track-reference type="text" inputmode="text" autocomplete="off" minlength="40" maxlength="64" dir="ltr" /></label><button class="booking-link" type="submit">${escapeHtml(requestCopy[locale]?.trackButton || requestCopy.en.trackButton)}</button><p data-track-result role="status" aria-live="polite"></p></form>` : ""}
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
      range = result.range; activeSegment = result.nextSegment; monthCursor = selected; clearHoldAttempt(); flow = { step: "search", options: [], selected: null, hold: null, busy: false, message: "", error: false }; persist(); updateFields(); renderSearchChildAges();
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
      return `<label class="booking-field booking-field--child-age"><span>${escapeHtml(label)}</span><input data-child-age="${i}" type="text" inputmode="numeric" pattern="[0-9۰-۹٠-٩]{1,2}" maxlength="2" required value="${escapeHtml(value)}" /></label>`;
    }).join("")}</div>`;
  }
  function renderSearchChildAges() {
    const root = slot.querySelector("[data-child-ages-root]");
    if (!root) return;
    if (!children) { root.innerHTML = ""; return; }
    const ages = Array.isArray(childAges) && childAges.length === children ? childAges : Array.from({ length: children }, () => "");
    root.innerHTML = `<p class="booking-step__label">${escapeHtml(ui.childAgeRequired || "")}</p>${childAgeInputsHtml(ages)}`;
    root.querySelectorAll("[data-child-age]").forEach(input => input.addEventListener("input", () => {
      childAges = normalizeChildAges([...root.querySelectorAll("[data-child-age]")].map(node => node.value), children);
      persist();
    }));
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
    const ages = childAges.length === children ? childAges : Array.from({ length: children }, () => "");
    const draft = flow.draftContact || { fullName: "", phone: "", email: "" };
    return `<section class="booking-step"><div class="booking-step__head"><h4>${escapeHtml(option.roomType?.name || "")} · ${escapeHtml(option.ratePlan?.name || "")}</h4><button type="button" class="booking-link" data-flow-back>${escapeHtml(ui.backToOptions || "Back")}</button></div>
      <p class="booking-step__price">${escapeHtml(formatMoney(option.totalRate, option.ratePlan?.currency, locale))} · ${escapeHtml(nightsLabel((option.nights || []).length, locale, ui))}</p>
      ${children ? `<div class="booking-child-age-block"><p class="booking-step__label">${escapeHtml(ui.childAgeRequired || "")}</p>${childAgeInputsHtml(ages)}</div>` : ""}
      <div class="booking-guest-form"><p class="booking-step__label">${escapeHtml(ui.guestDetails || "Guest details")}</p>
        <label class="booking-field booking-field--text"><span>${escapeHtml(ui.fullName || "Full name")}</span><input data-guest-name type="text" autocomplete="name" required minlength="2" maxlength="120" value="${escapeHtml(draft.fullName || "")}" /></label>
        <label class="booking-field booking-field--text"><span>${escapeHtml(ui.phone || "Phone")}</span><input data-guest-phone type="tel" autocomplete="tel" required minlength="8" maxlength="24" dir="ltr" value="${escapeHtml(draft.phone || "")}" /></label>
        <label class="booking-field booking-field--text"><span>${escapeHtml(ui.email || "Email")}</span><input data-guest-email type="email" autocomplete="email" maxlength="200" dir="ltr" value="${escapeHtml(draft.email || "")}" /></label>
      </div>
      ${requestOnly ? `<p class="booking-policy__text">${escapeHtml(requestCopy[locale]?.notBooking || requestCopy.en.notBooking)}</p><label class="booking-field booking-field--text"><span>${escapeHtml(locale === "fa" ? "درخواست ویژه (اختیاری)" : locale === "ar" ? "طلبات خاصة (اختياري)" : "Special requests (optional)")}</span><textarea data-special-request maxlength="500">${escapeHtml(flow.draftSpecialRequests || "")}</textarea></label>` : `<div class="booking-policy"><p class="booking-step__label">${escapeHtml(ui.policies || "Policy")}</p><div class="booking-policy__text">${escapeHtml(summary || policy?.name || policy?.key || "—")}</div><label class="booking-policy__accept"><input type="checkbox" data-policy-accept ${policy?.key ? "" : "disabled"} ${flow.policyAccepted ? "checked" : ""} /> <span>${escapeHtml(ui.policyAcceptance || "I accept the cancellation policy.")}</span></label></div>`}
      <div class="booking-step__actions"><button type="button" class="booking-submit" data-create-${requestOnly ? "request" : "hold"} ${flow.busy || (!requestOnly && !policy?.key) ? "disabled" : ""}>${escapeHtml(requestOnly ? (requestCopy[locale]?.submit || requestCopy.en.submit) : (ui.holdRoom || "Reserve"))}</button></div>
    </section>`;
  }
  function coordinationRequestPanel() {
    const copy = requestCopy[locale] || requestCopy.en;
    const draft = flow.draftContact || { fullName: "", phone: "", email: "" };
    return `<section class="booking-step booking-step--coordination"><div class="booking-step__head"><h4>${escapeHtml(copy.submit)}</h4><button type="button" class="booking-link" data-coordination-back>${escapeHtml(ui.backToOptions || "Back")}</button></div>
      <p class="booking-policy__text">${escapeHtml(copy.notBooking)}</p>
      <div class="booking-guest-form"><p class="booking-step__label">${escapeHtml(ui.guestDetails || "Guest details")}</p>
        <label class="booking-field booking-field--text"><span>${escapeHtml(ui.fullName || "Full name")}</span><input data-coordination-name type="text" autocomplete="name" required minlength="2" maxlength="120" value="${escapeHtml(draft.fullName || "")}" /></label>
        <label class="booking-field booking-field--text"><span>${escapeHtml(ui.phone || "Phone")}</span><input data-coordination-phone type="tel" autocomplete="tel" required minlength="8" maxlength="24" dir="ltr" value="${escapeHtml(draft.phone || "")}" /></label>
        <label class="booking-field booking-field--text"><span>${escapeHtml(ui.email || "Email")}</span><input data-coordination-email type="email" autocomplete="email" maxlength="200" dir="ltr" value="${escapeHtml(draft.email || "")}" /></label>
        <label class="booking-field booking-field--text"><span>${escapeHtml(locale === "fa" ? "درخواست ویژه (اختیاری)" : locale === "ar" ? "طلب خاص (اختياري)" : "Special request (optional)")}</span><textarea data-coordination-note maxlength="500">${escapeHtml(flow.draftSpecialRequests || "")}</textarea></label>
      </div><div class="booking-step__actions"><button type="button" class="booking-submit" data-create-coordination-request ${flow.busy ? "disabled" : ""}>${escapeHtml(copy.submit)}</button></div>
    </section>`;
  }
  function confirmationPanel() {
    if (requestOnly && flow.request) {
      const request = flow.request;
      const status = flow.requestStatus || request.status;
      const copy = requestCopy[locale] || requestCopy.en;
      return `<section class="booking-step booking-step--confirmed"><h4>${escapeHtml(copy.received)}</h4><p><strong>${escapeHtml(copy.reference)}:</strong> <span dir="ltr">${escapeHtml(request.reference)}</span></p><p>${escapeHtml(copy.keepReference)}</p><p><strong>${escapeHtml(copy.status)}:</strong> ${escapeHtml(copy.statuses[status] || status)}</p>${request.managerMessage ? `<p class="booking-policy__text">${escapeHtml(request.managerMessage)}</p>` : ""}<div class="booking-step__actions"><button type="button" class="booking-link" data-check-request-status ${flow.busy ? "disabled" : ""}>${escapeHtml(copy.check)}</button><button type="button" class="booking-link" data-flow-reset>${escapeHtml(ui.backToOptions || "Back")}</button></div></section>`;
    }
    const h = flow.hold; if (!h) return "";
    const expires = h.expiresAt ? new Date(h.expiresAt) : null;
    const expiresText = expires && !Number.isNaN(expires.getTime()) ? expires.toLocaleString(locale === "fa" ? "fa-IR" : locale === "ar" ? "ar" : "en-US") : String(h.expiresAt || "");
    const reservation = h.reservation;
    const statusText = locale === "fa" ? (reservation?.status === "PENDING_PAYMENT" ? "در انتظار پرداخت و تأیید پذیرش" : "رزرو موقت") : locale === "ar" ? (reservation?.status === "PENDING_PAYMENT" ? "بانتظار الدفع وتأكيد الاستقبال" : "حجز مؤقت") : (reservation?.status === "PENDING_PAYMENT" ? "Awaiting payment and reception confirmation" : "Temporary hold");
    return `<section class="booking-step booking-step--confirmed"><h4>${escapeHtml(reservation ? (locale === "fa" ? "درخواست رزرو ثبت شد" : locale === "ar" ? "تم تسجيل طلب الحجز" : "Reservation request received") : (ui.holdCreated || "Hold created"))}</h4><p><strong>${escapeHtml(ui.holdReference || "Reference")}:</strong> <span dir="ltr">${escapeHtml(reservation?.reference || h.reference || h.holdId || "")}</span></p><p><strong>${escapeHtml(ui.totalPrice || "Total")}:</strong> ${escapeHtml(formatMoney(reservation?.totalAmount || h.totalRate || h.totalAmount, reservation?.currency || h.currency, locale))}</p><p><strong>${escapeHtml(locale === "fa" ? "وضعیت" : locale === "ar" ? "الحالة" : "Status")}:</strong> ${escapeHtml(reservation ? statusText : expiresText)}</p>${reservation ? `<p>${escapeHtml(locale === "fa" ? "وضعیت پرداخت: " + (reservation.paymentStatus === "PAID" ? "پرداخت آزمایشی تأیید شد" : "پرداخت‌نشده") + "؛ تأیید نهایی اقامت با پذیرش هتل است." : locale === "ar" ? "حالة الدفع: " + (reservation.paymentStatus === "PAID" ? "تم التحقق من الدفع التجريبي" : "غير مدفوع") + "؛ ويظل التأكيد النهائي لدى الاستقبال." : "Payment: " + (reservation.paymentStatus === "PAID" ? "sandbox payment verified" : "unpaid") + "; reception still confirms the stay.")}</p><div class="booking-step__actions">${reservation.paymentStatus !== "PAID" && reservation.status === "PENDING_PAYMENT" ? `<button type="button" class="booking-submit" data-start-sandbox-payment ${flow.busy ? "disabled" : ""}>${escapeHtml(locale === "fa" ? "پرداخت آزمایشی" : locale === "ar" ? "الدفع التجريبي" : "Sandbox payment")}</button>` : ""}<button type="button" class="booking-link" data-check-reservation>${escapeHtml(locale === "fa" ? "بررسی وضعیت" : locale === "ar" ? "تحقق من الحالة" : "Check status")}</button>${reservation.paymentStatus !== "PAID" && reservation.status === "PENDING_PAYMENT" ? `<button type="button" class="booking-link" data-cancel-reservation>${escapeHtml(locale === "fa" ? "لغو رزرو پرداخت‌نشده" : locale === "ar" ? "إلغاء الحجز غير المدفوع" : "Cancel unpaid reservation")}</button>` : ""}</div>` : ""}<div class="booking-step__actions"><button type="button" class="booking-link" data-flow-reset>${escapeHtml(ui.backToOptions || "Back")}</button></div></section>`;
  }
  function renderFlow() {
    if (message) message.textContent = flow.message || ""; else message.textContent = "";
    message.classList.toggle("is-error", Boolean(flow.error));
    if (flow.step === "confirmed") { flowNode.innerHTML = confirmationPanel(); bindFlow(); return; }
    if (flow.step === "coordination-details") { flowNode.innerHTML = coordinationRequestPanel(); bindFlow(); return; }
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
    return { ok: res.ok, status: res.status, data, rawText: text };
  }
  let trackingAttemptId = 0;
  slot.querySelector("[data-track-request]")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const trackingAttempt = ++trackingAttemptId;
    const copy = requestCopy[locale] || requestCopy.en;
    const reference = slot.querySelector("[data-track-reference]")?.value.trim() || "";
    const output = slot.querySelector("[data-track-result]");
    if (!reference || reference.length < 40) { output.textContent = copy.trackError; return; }
    output.textContent = copy.checking;
    try {
      const result = await postJson("/api/hotel/v1/requests/status", { reference });
      if (trackingAttempt !== trackingAttemptId) return;
      if (!result.ok || typeof result.data?.status !== "string") { output.textContent = copy.trackError; return; }
      const label = copy.statuses[result.data.status] || result.data.status;
      output.textContent = result.data.managerMessage ? `${label} · ${result.data.managerMessage}` : label;
    } catch { if (trackingAttempt === trackingAttemptId) output.textContent = copy.trackError; }
  });
  function apiErrorMessage(status, data, fallback) {
    const err = typeof data?.error === "string" ? data.error : data?.error?.message || "";
    if (requestOnly && status === 429) return locale === "fa" ? "درخواست‌های زیادی ثبت شده است. کمی بعد دوباره تلاش کنید." : locale === "ar" ? "تم إرسال طلبات كثيرة. حاول مرة أخرى بعد قليل." : "Too many requests. Try again shortly.";
    if (requestOnly && status === 400) return locale === "fa" ? "اطلاعات درخواست معتبر نیست. تاریخ و اطلاعات تماس را بررسی کنید." : locale === "ar" ? "بيانات الطلب غير صالحة. تحقق من التواريخ ومعلومات الاتصال." : "The request details are invalid. Check the dates and contact information.";
    if (requestOnly && status === 404) return locale === "fa" ? "درخواست هماهنگی برای این اقامتگاه در دسترس نیست." : locale === "ar" ? "طلبات التنسيق غير متاحة لهذا العقار." : "Coordination requests are unavailable for this property.";
    if (requestOnly && status === 409) return locale === "fa" ? "این درخواست با پیگیری قبلی هم‌خوان نیست. اطلاعات را بررسی و دوباره تلاش کنید." : locale === "ar" ? "لا يتطابق الطلب مع المحاولة السابقة. راجع البيانات وحاول مجدداً." : "This request does not match the previous attempt. Review the details and try again.";
    if (requestOnly && status === 503) return requestCopy[locale]?.unavailable || requestCopy.en.unavailable;
    if (requestOnly && status >= 500) return locale === "fa" ? "ثبت درخواست موقتاً ناموفق بود. کمی بعد با همان اطلاعات دوباره تلاش کنید." : locale === "ar" ? "تعذر إرسال الطلب مؤقتاً. حاول لاحقاً بالمعلومات نفسها." : "The request could not be sent temporarily. Retry later with the same details.";
    if (err && status < 500) return `${status}: ${err}`;
    if (status === 400) return locale === "fa" ? "درخواست نامعتبر است. تاریخ‌ها و اطلاعات را بررسی کنید." : locale === "ar" ? "طلب غير صالح. تحقق من التواريخ والمعلومات." : "Invalid request. Check dates and details.";
    if (status === 404) return locale === "fa" ? "این اقامتگاه یا انتشار آن در دسترس نیست." : locale === "ar" ? "هذا العقار أو نشره غير متاح." : "This property or its publication is unavailable.";
    if (status === 409) return locale === "fa" ? "وضعیت موجودی یا شرایط تغییر کرده است. دوباره بررسی کنید." : locale === "ar" ? "تغيرت حالة التوفر أو الشروط. تحقق مرة أخرى." : "Availability or terms changed. Review again.";
    if (status === 429) return locale === "fa" ? "درخواست‌های زیادی ارسال شد. کمی بعد دوباره تلاش کنید." : locale === "ar" ? "تم إرسال طلبات كثيرة. حاول مرة أخرى بعد قليل." : "Too many requests. Try again shortly.";
    if (status === 503) return requestOnly ? (requestCopy[locale]?.unavailable || requestCopy.en.unavailable) : (ui.holdUnavailable || (locale === "fa" ? "سرویس موقتاً در دسترس نیست." : locale === "ar" ? "الخدمة غير متاحة مؤقتاً." : "Service temporarily unavailable."));
    if (status >= 500) return locale === "fa" ? "خطای موقت سرور. کمی بعد دوباره تلاش کنید." : locale === "ar" ? "خطأ مؤقت في الخادم. حاول مرة أخرى لاحقاً." : "Temporary server error. Try again later.";
    return fallback || (locale === "fa" ? "خطایی رخ داد." : locale === "ar" ? "حدث خطأ." : "An error occurred.");
  }
  function collectChildAgesFromInputs() {
    if (!children) return { ok: true, ages: [] };
    // The search form keeps its own age inputs mounted while the selected-room
    // details panel renders editable copies. Submit only the active details panel.
    const inputs = [...flowNode.querySelectorAll("[data-child-age]")];
    return parseChildAges(inputs.map((i) => i.value), children);
  }
  function bindFlow() {
    const contactInputs = [
      ["[data-coordination-name]", "fullName"],
      ["[data-coordination-phone]", "phone"],
      ["[data-coordination-email]", "email"],
    ];
    for (const [selector, field] of contactInputs) {
      const input = slot.querySelector(selector);
      input?.addEventListener("input", () => {
        flow.draftContact = { ...(flow.draftContact || {}), [field]: input.value };
        persistCoordinationDraft();
      });
      input?.addEventListener("keydown", event => {
        if (event.key !== "Enter" || flow.busy) return;
        event.preventDefault();
        slot.querySelector("[data-create-coordination-request]")?.click();
      });
    }
    slot.querySelector("[data-coordination-note]")?.addEventListener("input", event => {
      flow.draftSpecialRequests = event.currentTarget.value;
      persistCoordinationDraft();
    });
    slot.querySelector("[data-coordination-back]")?.addEventListener("click", () => {
      flow = { ...flow, step: "search", message: "", error: false };
      persistCoordinationDraft();
      renderFlow();
    });
    slot.querySelector("[data-create-coordination-request]")?.addEventListener("click", async () => {
      if (flow.busy) return;
      const contact = validateContact({
        fullName: slot.querySelector("[data-coordination-name]")?.value || "",
        phone: slot.querySelector("[data-coordination-phone]")?.value || "",
        email: slot.querySelector("[data-coordination-email]")?.value || "",
      });
      if (!contact.ok) {
        setMessage(ui.invalidContact || "Invalid contact details.", true);
        slot.querySelector("[data-coordination-name]")?.focus();
        return;
      }
      const specialRequests = slot.querySelector("[data-coordination-note]")?.value.trim() || "";
      flow.draftContact = contact.value;
      flow.draftSpecialRequests = specialRequests;
      const payload = {
        kind: "coordination",
        property: DAMOON_PROPERTY_SLUG,
        checkIn: range.checkIn,
        checkOut: range.checkOut,
        occupancy: { adults, children, ...(children ? { childAges } : {}) },
        contact: contact.value,
        ...(specialRequests ? { specialRequests } : {}),
      };
      const body = JSON.stringify(payload);
      if (!coordinationAttempt || coordinationAttempt.body !== body) {
        coordinationAttempt = { body, key: createIdempotencyKey() };
      }
      persistCoordinationDraft();
      flow.busy = true;
      renderFlow();
      try {
        const result = await postJson("/api/hotel/v1/requests", payload, { "Idempotency-Key": coordinationAttempt.key });
        if (!result.ok || typeof result.data?.reference !== "string") {
          const errorText = typeof result.data?.error === "string" ? result.data.error : "";
          if (result.status === 409 && /idempotency-key was used with a different request/i.test(errorText)) {
            coordinationAttempt = null;
            persistCoordinationDraft();
          }
          flow.busy = false;
          renderFlow();
          setMessage(result.status === 503 ? (requestCopy[locale]?.unavailable || requestCopy.en.unavailable) : apiErrorMessage(result.status, result.data, errorText), true);
          return;
        }
        coordinationAttempt = null;
        flow = { ...flow, step: "confirmed", request: result.data, requestStatus: result.data.status, busy: false, message: "", error: false };
        persistCoordinationDraft();
        renderFlow();
      } catch {
        flow.busy = false;
        renderFlow();
        setMessage(locale === "fa" ? "پاسخی دریافت نشد؛ همان فرم را دوباره ارسال کنید." : locale === "ar" ? "لم يصل رد؛ أعد إرسال النموذج نفسه." : "No response received. Retry the same form.", true);
      }
    });
    slot.querySelector("[data-check-reservation]")?.addEventListener("click", async () => {
      const reservation = flow.hold?.reservation;
      if (!reservation?.reference || flow.busy) return;
      flow.busy = true; renderFlow();
      try {
        const result = await postJson("/api/hotel/v1/reservations/status", { reference: reservation.reference, contactPhone: flow.draftContact?.phone || "" });
        if (!result.ok || typeof result.data?.status !== "string") throw new Error(apiErrorMessage(result.status, result.data, "Status unavailable."));
        Object.assign(reservation, result.data);
        flow.message = locale === "fa" ? "وضعیت رزرو به‌روز شد." : locale === "ar" ? "تم تحديث حالة الحجز." : "Reservation status updated.";
      } catch (error) { flow.message = error instanceof Error ? error.message : "Status unavailable."; flow.error = true; }
      finally { flow.busy = false; renderFlow(); }
    });
    slot.querySelector("[data-cancel-reservation]")?.addEventListener("click", async () => {
      const reservation = flow.hold?.reservation;
      if (!reservation?.reference || flow.busy) return;
      flow.busy = true; renderFlow();
      try {
        const result = await postJson("/api/hotel/v1/reservations/cancel", { reference: reservation.reference, contactPhone: flow.draftContact?.phone || "" });
        if (!result.ok || result.data?.status !== "CANCELLED") throw new Error(apiErrorMessage(result.status, result.data, "Cancellation unavailable."));
        reservation.status = "CANCELLED";
        flow.message = locale === "fa" ? "رزرو لغو و موجودی آزاد شد." : locale === "ar" ? "تم إلغاء الحجز وإعادة التوفر." : "Reservation cancelled and inventory released.";
      } catch (error) { flow.message = error instanceof Error ? error.message : "Cancellation unavailable."; flow.error = true; }
      finally { flow.busy = false; renderFlow(); }
    });
    slot.querySelector("[data-start-sandbox-payment]")?.addEventListener("click", async () => {
      const reservation = flow.hold?.reservation;
      if (!reservation?.reference || flow.busy) return;
      flow.busy = true; renderFlow();
      try {
        const started = await postJson("/api/hotel/v1/sandbox-payments", { reference: reservation.reference, idempotencyKey: flow.hold.idempotencyKey, contactPhone: flow.draftContact?.phone || "" });
        if (!started.ok || typeof started.data?.ticket !== "string") throw new Error(apiErrorMessage(started.status, started.data, "Sandbox payment unavailable."));
        const verified = await postJson("/api/hotel/v1/sandbox-payments/verify", { ticket: started.data.ticket });
        if (!verified.ok || !verified.data?.paymentStatus) throw new Error(apiErrorMessage(verified.status, verified.data, "Sandbox payment verification failed."));
        flow.hold.reservation.paymentStatus = verified.data.paymentStatus;
        flow.hold.reservation.status = verified.data.reservationStatus;
        flow.message = locale === "fa" ? "پرداخت آزمایشی توسط سرور تأیید شد؛ رزرو همچنان در انتظار پذیرش است." : locale === "ar" ? "أكد الخادم الدفع التجريبي؛ ولا يزال الحجز بانتظار الاستقبال." : "Sandbox payment was verified by the server; reception confirmation is still pending.";
      } catch (error) { flow.message = error instanceof Error ? error.message : "Sandbox payment failed."; flow.error = true; }
      finally { flow.busy = false; renderFlow(); }
    });
    slot.querySelectorAll("[data-select-option]").forEach((btn) => btn.addEventListener("click", () => {
      const option = availableOptions({ options: flow.options })[Number(btn.dataset.selectOption)];
      if (!option) return;
      flow = { ...flow, step: "details", selected: option, hold: null, message: "", error: false, policyAccepted: false };
      if (!Array.isArray(childAges) || childAges.length !== children) childAges = [];
      clearHoldAttempt();
      renderFlow();
    }));
    slot.querySelector("[data-flow-back]")?.addEventListener("click", () => { clearHoldAttempt(); flow = { ...flow, step: "options", selected: null, hold: null, message: "", error: false }; renderFlow(); });
    slot.querySelector("[data-flow-reset]")?.addEventListener("click", () => { clearHoldAttempt(); coordinationAttempt = null; flow = { step: requestOnly ? "search" : "options", options: flow.options, selected: null, hold: null, busy: false, message: "", error: false, draftContact: { fullName: "", phone: "", email: "" }, draftSpecialRequests: "", request: null, requestStatus: "", policyAccepted: false }; persistCoordinationDraft(); renderFlow(); });
    slot.querySelector("[data-check-request-status]")?.addEventListener("click", async () => {
      if (flow.busy || !flow.request?.reference) return;
      flow.busy = true; renderFlow();
      const copy = requestCopy[locale] || requestCopy.en;
      setMessage(copy.checking);
      try {
        const result = await postJson("/api/hotel/v1/requests/status", { reference: flow.request.reference });
        if (!result.ok || typeof result.data?.status !== "string") {
          setMessage(apiErrorMessage(result.status, result.data, copy.check), true);
          return;
        }
        flow.requestStatus = result.data.status;
        flow.request.managerMessage = typeof result.data.managerMessage === "string" ? result.data.managerMessage : "";
        persistCoordinationDraft();
        setMessage("");
      } catch {
        setMessage(locale === "fa" ? "بررسی وضعیت ناموفق بود؛ دوباره تلاش کنید." : locale === "ar" ? "تعذر التحقق من الحالة؛ حاول مرة أخرى." : "Status check failed. Try again.", true);
      } finally {
        flow.busy = false; renderFlow();
      }
    });
    slot.querySelector(`[data-create-${requestOnly ? "request" : "hold"}]`)?.addEventListener("click", async () => {
      if (flow.busy || !flow.selected) return;
      const agesResult = collectChildAgesFromInputs();
      if (!agesResult.ok) { setMessage(ui.childAgeRequired || "Enter valid ages for each child.", true); slot.querySelector("[data-child-age]")?.focus(); return; }
      childAges = agesResult.ages;
      const draft = { fullName: slot.querySelector("[data-guest-name]")?.value || "", phone: slot.querySelector("[data-guest-phone]")?.value || "", email: slot.querySelector("[data-guest-email]")?.value || "" };
      const contact = validateContact(draft);
      if (!contact.ok) { flow.draftContact = draft; setMessage(ui.invalidContact || "Invalid contact details.", true); renderFlow(); slot.querySelector("[data-guest-name]")?.focus(); return; }
      flow.draftContact = contact.value;
      if (requestOnly) {
        const specialRequests = slot.querySelector("[data-special-request]")?.value || "";
        flow.draftSpecialRequests = specialRequests;
        const payload = buildGuestRequestPayload({ property: DAMOON_PROPERTY_SLUG, range, adults, children, childAges, option: flow.selected, contact: contact.value, specialRequests });
        const fingerprint = requestAttemptFingerprint({ property: DAMOON_PROPERTY_SLUG, range, adults, children, childAges, option: flow.selected, contact: contact.value, specialRequests });
        if (!holdAttempt.key || holdAttempt.fingerprint !== fingerprint) holdAttempt = { key: createIdempotencyKey(), fingerprint, payload };
        flow.busy = true; persist(); renderFlow();
        setMessage(locale === "fa" ? "در حال ارسال درخواست هماهنگی..." : locale === "ar" ? "جارٍ إرسال طلب التنسيق..." : "Submitting your stay request...");
        try {
          const result = await postJson("/api/hotel/v1/requests", holdAttempt.payload || payload, { "Idempotency-Key": holdAttempt.key });
          if (result.ok && typeof result.data?.reference === "string") {
            clearHoldAttempt();
            flow = { ...flow, step: "confirmed", request: result.data, requestStatus: result.data.status, busy: false, message: "", error: false };
            renderFlow();
            return;
          }
          const errorText = typeof result.data?.error === "string" ? result.data.error : result.data?.error?.message || "";
          if (result.status === 409 && /idempotency-key was used with a different request/i.test(errorText)) clearHoldAttempt();
          setMessage(result.status === 503 ? (requestCopy[locale]?.unavailable || requestCopy.en.unavailable) : apiErrorMessage(result.status, result.data, errorText), true);
        } catch {
          setMessage(locale === "fa" ? "پاسخ سرور دریافت نشد؛ همان درخواست را دوباره ارسال کنید." : locale === "ar" ? "لم يصل رد من الخادم؛ أعد إرسال الطلب نفسه." : "No server response. Retry the same request.", true);
        } finally {
          flow.busy = false; renderFlow();
        }
        return;
      }
      const accepted = slot.querySelector("[data-policy-accept]")?.checked;
      const policyKey = flow.selected.ratePlan?.cancellationPolicy?.key || "";
      if (!policyKey || !accepted) { flow.draftContact = contact.value; flow.policyAccepted = Boolean(accepted); setMessage(ui.policyRequired || "Accept the cancellation policy.", true); renderFlow(); return; }
      flow.policyAccepted = true;
      flow.busy = true; persist(); renderFlow();
      setMessage(locale === "fa" ? "در حال ثبت رزرو موقت..." : locale === "ar" ? "جارٍ إنشاء الحجز المؤقت..." : "Creating hold...");
      const payload = buildHoldPayload({ property: DAMOON_PROPERTY_SLUG, range, adults, children, childAges, option: flow.selected, contact: contact.value });
      const fingerprint = holdAttemptFingerprint({ property: DAMOON_PROPERTY_SLUG, range, adults, children, childAges, option: flow.selected, contact: contact.value });
      if (!holdAttempt.key || holdAttempt.fingerprint !== fingerprint) holdAttempt = { key: createIdempotencyKey(), fingerprint, payload };
      const submitPayload = holdAttempt.payload || payload;
      let result;
      try {
        result = await postJson("/api/hotel/v1/holds", submitPayload, { "Idempotency-Key": holdAttempt.key });
      } catch {
        setMessage(locale === "fa" ? "خطای شبکه هنگام ثبت رزرو موقت. وضعیت نامشخص است؛ با همان درخواست دوباره تلاش کنید." : locale === "ar" ? "خطأ في الشبكة أثناء الحجز المؤقت. الحالة غير واضحة؛ أعد المحاولة بنفس الطلب." : "Network error while creating the hold. Outcome is ambiguous; retry the same request.", true);
        renderFlow();
        return;
      } finally {
        flow.busy = false;
      }
      if (result.ok && result.data?.holdId) {
        const holdKey = holdAttempt.key;
        const confirmation = await postJson("/api/hotel/v1/reservations", { ...submitPayload, idempotencyKey: holdKey, holdId: result.data.holdId, holdIdempotencyKey: holdKey });
        if (confirmation.ok && typeof confirmation.data?.reference === "string") {
          clearHoldAttempt();
          flow = { ...flow, step: "confirmed", hold: { ...result.data, idempotencyKey: holdKey, reservation: confirmation.data }, message: "", error: false, policyAccepted: false };
          renderFlow(); return;
        }
        flow.busy = false;
        setMessage(apiErrorMessage(confirmation.status, confirmation.data, locale === "fa" ? "ثبت رزرو انجام نشد؛ همان درخواست را دوباره ارسال کنید." : locale === "ar" ? "تعذر تسجيل الحجز؛ أعد إرسال الطلب نفسه." : "Reservation could not be created; retry the same request."), true);
        renderFlow(); return;
      }
      const err = typeof result.data?.error === "string" ? result.data.error : result.data?.error?.message || "";
      const lower = String(err).toLower();
      const policyChanged = result.status === 409 && /policy|terms|acceptance does not match|changed/i.test(lower);
      const inventoryChanged = result.status === 409 && /inventory|not available|no longer active/i.test(lower);
      if (policyChanged) {
        clearHoldAttempt();
        flow = { step: "search", options: [], selected: null, hold: null, busy: false, message: "", error: false, draftContact: flow.draftContact, policyAccepted: false };
        renderFlow();
        setMessage(locale === "fa" ? "قوانین لغو یا شرایط/قیمت تغییر کرده است. موجودی و قوانین را دوباره بررسی و تأیید کنید." : locale === "ar" ? "تغيرت سياسة الإلغاء أو الشروط/السعر. راجع التوفر والسياسة وأكدها مرة أخرى." : (err || "Policy or terms changed. Review availability and policy again."), true);
        return;
      }
      if (inventoryChanged) {
        clearHoldAttempt();
        flow = { step: "search", options: [], selected: null, hold: null, busy: false, message: "", error: false, draftContact: flow.draftContact, policyAccepted: false };
        renderFlow();
        setMessage(locale === "fa" ? "این گزینه دیگر در دسترس نیست. موجودی را دوباره بررسی کنید." : locale === "ar" ? "لم يعد هذا الخيار متاحاً. تحقق من التوفر مرة أخرى." : (err || "This option is no longer available. Check availability again."), true);
        return;
      }
      if (result.status === 503) { setMessage(ui.holdUnavailable || "Hold service unavailable.", true); renderFlow(); return; }
      if (result.status === 409) {
        const permanentConflict = /idempotency-key was used with a different request/i.test(lower);
        if (permanentConflict) {
          clearHoldAttempt();
          setMessage(locale === "fa" ? "این درخواست با کلید قبلی ناسازگار است. لطفاً جزئیات را بررسی و دوباره ثبت کنید." : locale === "ar" ? "هذا الطلب غير متوافق مع المفتاح السابق. راجع التفاصيل وأعد الإرسال." : (err || "Request conflicts with a previous idempotency key. Review details and submit a new request."), true);
        } else {
          setMessage(locale === "fa" ? "تعارض در درخواست رزرو موقت. با همان درخواست دوباره تلاش کنید." : locale === "ar" ? "تعارض في طلب الحجز المؤقت. أعد المحاولة بنفس الطلب." : (err || "Hold request conflict. Retry the same request."), true);
        }
        renderFlow();
        return;
      }
      if (!err) { setMessage(locale === "fa" ? "پاسخ نامشخص دریافت شد. با همان درخواست دوباره تلاش کنید." : locale === "ar" ? "تم استلام استجابة غير واضحة. أعد المحاولة بنفس الطلب." : "Ambiguous response. Retry the same request.", true); renderFlow(); return; }
      setMessage(`${result.status}: ${err}`, true);
      renderFlow();
    });
  }

  slot.querySelectorAll("[data-date-field]").forEach((button) => button.addEventListener("click", () => openCalendar(button.dataset.dateField)));
  slot.querySelector("[data-calendar-close]").addEventListener("click", () => dialog.close());
  dialog.addEventListener("close", () => { dialogOpener?.setAttribute("aria-expanded", "false"); dialogOpener?.focus(); });
  slot.querySelector("[data-month-prev]").addEventListener("click", () => { monthCursor = moveJalaliMonth(monthCursor, -1); drawCalendar(); slot.querySelector("[data-month-prev]").focus(); });
  slot.querySelector("[data-month-next]").addEventListener("click", () => { monthCursor = moveJalaliMonth(monthCursor, 1); drawCalendar(); slot.querySelector("[data-month-next]").focus(); });
  adultSelect.addEventListener("change", () => { adults = validCount(adultSelect.value, 1, 8) || 2; clearHoldAttempt(); flow = { step: "search", options: [], selected: null, hold: null, busy: false, message: "", error: false }; persist(); renderSearchChildAges(); renderFlow(); });
  childSelect.addEventListener("change", () => {
    children = validCount(childSelect.value, 0, 4) ?? 0;
    if (children === 0) childAges = []; else if (childAges.length !== children) childAges = Array.from({ length: children }, (_, i) => (Number.isInteger(childAges[i]) ? childAges[i] : ""));
    clearHoldAttempt();
    flow = { step: "search", options: [], selected: null, hold: null, busy: false, message: "", error: false }; persist(); renderSearchChildAges(); renderFlow();
  });

  slot.querySelector("[data-reservation-entry]")?.addEventListener("click", () => {
    if (flow.busy) return;
    const validation = validateStayRange(range, today);
    if (validation !== "OK") {
      setMessage(validation === "PAST" ? ui.arrivalCannotBePast : validation === "ORDER" ? ui.departureAfterArrival : ui.selectBothDates, true);
      if (validation === "MISSING") openCalendar(range.checkIn ? "checkOut" : "checkIn");
      return;
    }
    const ageInputs = [...slot.querySelectorAll("[data-child-age]")].map((input) => input.value);
    const agesResult = children ? parseChildAges(ageInputs, children) : { ok: true, ages: [] };
    if (!agesResult.ok) {
      setMessage(ui.childAgeRequired || "Enter a valid age (0-17) for each child.", true);
      slot.querySelector("[data-child-age]")?.focus();
      return;
    }
    const target = buildReservationEntryUrl(new URL(routeHref("/hotel-reservations/start"), window.location.href), DAMOON_PROPERTY_SLUG, { range, adults, children, childAges: agesResult.ages });
    window.location.assign(target.href);
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
    let validatedAges = [];
    if (children) {
      const ageInputs = slot.querySelectorAll("[data-child-age]");
      const raw = ageInputs.length === children ? [...ageInputs].map((i) => i.value) : (childAges.length === children ? childAges : []);
      const agesResult = parseChildAges(raw, children);
      if (!agesResult.ok) {
        childAges = normalizeChildAges(raw, children);
        persist();
        flow = { step: "search", options: [], selected: null, hold: null, busy: false, message: ui.childAgeRequired || "Enter a valid age (0-17) for each child.", error: true };
        renderSearchChildAges(); renderFlow();
        slot.querySelector("[data-child-age]")?.focus();
        return;
      }
      validatedAges = agesResult.ages;
      childAges = validatedAges;
    }
    persist();
    if (coordinationOnly) {
      const target = withStaySelection(new URL(routeHref("/contact"), window.location.href), { range, adults, children, childAges: validatedAges });
      if (selectedRoom) target.searchParams.set("room", selectedRoom);
      window.location.assign(target.href);
      return;
    }
    if (requestOnly) {
      coordinationAttempt = null;
      flow = { step: "coordination-details", options: [], selected: null, hold: null, busy: false, message: "", error: false, draftContact: { fullName: "", phone: "", email: "" }, draftSpecialRequests: "" };
      persistCoordinationDraft();
      renderFlow();
      slot.querySelector("[data-coordination-name]")?.focus();
      return;
    }
    clearHoldAttempt();
    flow = { step: "search", options: [], selected: null, hold: null, busy: true, message: ui.searching || "Checking availability...", error: false }; renderFlow();
    const submitButton = form.querySelector(".booking-submit[type=submit]"); if (submitButton) submitButton.disabled = true;
    try {
      const { ok, status, data } = await postJson("/api/hotel/v1/availability/search", { property: DAMOON_PROPERTY_SLUG, checkIn: range.checkIn, checkOut: range.checkOut, occupancy: { adults, children, childAges: validatedAges } });
      const items = ok ? availableOptions(data) : [];
      if (!ok) {
        flow = { step: "search", options: [], selected: null, hold: null, busy: false, message: apiErrorMessage(status, data, locale === "fa" ? "دریافت موجودی ناموفق بود." : locale === "ar" ? "فشل التحقق من التوفر." : "Availability check failed."), error: true };
        renderFlow();
        return;
      }
      // Successful response with no bookable options is genuine sold-out/unavailable inventory.
      if (!items.length) { flow = { step: "search", options: [], selected: null, hold: null, busy: false, message: locale === "fa" ? "برای این تاریخ اتاقی موجود نیست." : locale === "ar" ? "لا توجد غرف متاحة." : "No rooms available for these dates.", error: true }; renderFlow(); return; }
      flow = { step: "options", options: data?.options || items, selected: null, hold: null, busy: false, message: (locale === "fa" ? "گزینه‌های موجود: " : locale === "ar" ? "الخيارات المتاحة: " : "Available options: ") + items.length, error: false, draftContact: flow.draftContact, policyAccepted: false }; renderFlow();
      slot.querySelector("[data-booking-flow]")?.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
    } catch {
      flow = { step: "search", options: [], selected: null, hold: null, busy: false, message: locale === "fa" ? "خطای شبکه در دریافت موجودی. وضعیت نامشخص است؛ دوباره تلاش کنید." : locale === "ar" ? "خطأ في الشبكة أثناء التحقق من التوفر. أعد المحاولة." : "Network error while checking availability. Try again.", error: true }; renderFlow();
    } finally { if (submitButton) submitButton.disabled = false; }
  });

  updateFields(); renderSearchChildAges(); renderFlow(); if (bookingIsValid()) persist();
  return () => { if (dialog.open) dialog.close(); slot.replaceChildren(); };
}
