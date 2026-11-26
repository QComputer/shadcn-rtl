"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { HotelOfflinePayments } from "@/components/hotel-operations/hotel-offline-payments";
import { HotelJalaliDateField } from "@/components/hotel-operations/hotel-jalali-date-field";
import { HotelReceptionDirectory } from "@/components/hotel-operations/hotel-reception-directory";
import { HotelReceptionLifecycle, type ReceptionSchedule } from "@/components/hotel-operations/hotel-reception-lifecycle";
import { HotelStayActions, type AmendmentPreview } from "@/components/hotel-operations/hotel-stay-actions";
import { HotelGuestOfflinePayment } from "@/components/hotel-operations/hotel-guest-offline-payment";
import { HotelOfflinePolicySettings } from "@/components/hotel-operations/hotel-offline-policy-settings";
import { getReservationCenterReadinessIssues } from "@/lib/hotel/management/reservation-center-readiness";
import { isPropertyDate, offsetPropertyDate, propertyCalendarDate, receptionDateIssue } from "@/lib/hotel/domain/property-calendar";
import { canMarkManualNoShow, currentReceptionRoom, matchesReceptionSearch, type ReceptionHistoryEvent, type ReceptionHistoryAction } from "@/lib/hotel/domain/reception-professional";
import type { ReceptionDateIssue } from "@/lib/hotel/domain/property-calendar";
import { receptionActionSuccess, receptionDateMessage, receptionReloadMessage, reservationActionMessage, reservationCenterRefreshEvent, ReservationRequestError } from "@/lib/hotel/management/reservation-center-feedback";

type RoomType = { id: string; name: string };
type RatePlan = { id: string; name: string; roomTypeId: string };
type Room = { id: string; code: string; roomTypeId: string };
type Reservation = { id: string; reference: string; guestName?: string; guests?: Array<{ fullName: string; isPrimary: boolean; isChild: boolean; age: number | null }>; checkedInAt?: string | null; checkedOutAt?: string | null; status: string; source?: string | null; simulatedPaymentStatus?: string; paymentMethod?: "CASH" | "BANK_TRANSFER" | null; roomTypeId?: string; checkIn: string; checkOut: string; totalAmount: string | number; currency: string; paidAmount: string | number; refundedAmount: string | number; nights: { date: string; roomId: string | null }[] };
type Snapshot = { receptionSchedule?: ReceptionSchedule; receptionHistory?: ReceptionHistoryEvent[]; mode: string; view: string; demoBooking?: boolean; maintenanceAvailable?: boolean; manualRoomManagementEnabled?: boolean; roomTypes: RoomType[]; ratePlans: RatePlan[]; reservations: Reservation[]; rooms: Room[]; confirmationPolicy?: { manualConfirmationPolicy: "DISABLED" | "CASH_ON_ARRIVAL" | "MINIMUM_VERIFIED_DEPOSIT"; allowedOfflinePaymentMethods: Array<"CASH" | "BANK_TRANSFER">; minimumVerifiedDepositAmount: string | null; pendingPaymentMinutes: number } };
type Guest = { fullName: string; isPrimary: boolean; isChild?: boolean; age?: number };
const professionalCopy = {
  fa: { search: "جست‌وجوی نام مهمان یا همراه، کد رزرو یا اتاق", limit: "جست‌وجو فقط در رزروهای بارگذاری‌شده است.", guests: "پرونده مهمانان این رزرو", primary: "مهمان اصلی", child: "کودک", adult: "بزرگسال", age: "سن", history: "آخرین رخدادهای ثبت‌شده پذیرش", historyLimit: "نمایش رخدادهای موجود از ۲۰۰ رکورد اخیر ملک؛ تاریخچه کامل حسابرسی نیست.", none: "رخداد ثبت‌شده‌ای در این بازه وجود ندارد.", noShow: "ثبت عدم مراجعه", confirm: "عدم مراجعه ثبت و ظرفیت تمام شب‌های این رزرو آزاد شود؟ مبلغ و سوابق مالی تغییر نمی‌کنند.", actions: { CREATE_MANUAL_RESERVATION: "رزرو حضوری", reserve: "ایجاد رزرو", "confirm-reservation": "تأیید رزرو", "assign-room": "تخصیص اتاق", "move-room": "انتقال اتاق", "amend-stay": "تغییر اقامت", "check-in": "ثبت ورود", "check-out": "ثبت خروج", cancel: "لغو", "mark-no-show": "عدم مراجعه", expire: "انقضا" } },
  en: { search: "Search guest, companion, reference or room", limit: "Search is limited to loaded reservations.", guests: "Guests on this reservation", primary: "Primary guest", child: "Child", adult: "Adult", age: "Age", history: "Recent recorded reception events", historyLimit: "Events from the latest 200 property records; not a complete audit history.", none: "No recorded events in this window.", noShow: "Mark no-show", confirm: "Mark no-show and release all reserved nights? Financial amounts and records will not change.", actions: { CREATE_MANUAL_RESERVATION: "Manual reservation", reserve: "Reservation created", "confirm-reservation": "Confirmed", "assign-room": "Room assigned", "move-room": "Room moved", "amend-stay": "Stay amended", "check-in": "Checked in", "check-out": "Checked out", cancel: "Cancelled", "mark-no-show": "No-show", expire: "Expired" } },
  ar: { search: "البحث عن الضيف أو المرافق أو المرجع أو الغرفة", limit: "البحث ضمن الحجوزات المحملة فقط.", guests: "ضيوف هذا الحجز", primary: "الضيف الرئيسي", child: "طفل", adult: "بالغ", age: "العمر", history: "أحدث أحداث الاستقبال المسجلة", historyLimit: "الأحداث من أحدث 200 سجل للمنشأة؛ ليست سجلاً تدقيقياً كاملاً.", none: "لا توجد أحداث مسجلة في هذه الفترة.", noShow: "تسجيل عدم الحضور", confirm: "تسجيل عدم الحضور وتحرير كل الليالي المحجوزة؟ لن تتغير المبالغ والسجلات المالية.", actions: { CREATE_MANUAL_RESERVATION: "حجز يدوي", reserve: "إنشاء حجز", "confirm-reservation": "تأكيد الحجز", "assign-room": "تخصيص الغرفة", "move-room": "نقل الغرفة", "amend-stay": "تعديل الإقامة", "check-in": "تسجيل الوصول", "check-out": "تسجيل المغادرة", cancel: "إلغاء", "mark-no-show": "عدم الحضور", expire: "انتهاء الصلاحية" } },
} as const;
const demoCatalog = [
  { slug: "demo-single", fa: "اتاق یک‌نفره", en: "Single room", ar: "غرفة مفردة" },
  { slug: "demo-double", fa: "اتاق دونفره", en: "Double room", ar: "غرفة مزدوجة" },
  { slug: "demo-suite-3", fa: "سوئیت سه‌نفره", en: "Three-person suite", ar: "جناح لثلاثة أشخاص" },
  { slug: "demo-suite-4", fa: "سوئیت چهارنفره", en: "Four-person suite", ar: "جناح لأربعة أشخاص" },
  { slug: "demo-suite-5", fa: "سوئیت پنج‌نفره", en: "Five-person suite", ar: "جناح لخمسة أشخاص" },
] as const;

const labels = {
  fa: { title: "رزروهای هتل", centerTitle: "مرکز رزرواسیون", dates: "تاریخ ورود", checkout: "تاریخ خروج", room: "نوع اتاق", plan: "طرح نرخ", adults: "بزرگسالان", kids: "کودکان", age: "سن کودک", guests: "نام مهمانان", guest: "نام کامل مهمان", quote: "دریافت قیمت", quoteRequest: "قیمت‌گذاری این درخواست", hold: "نگه‌داری موقت", reserve: "ثبت رزرو", reservations: "رزروها", refresh: "بارگذاری دوباره", empty: "رزروی وجود ندارد.", reference: "کد پیگیری", status: "وضعیت", total: "مبلغ", paid: "پرداخت‌شده", refunded: "بازپرداخت‌شده", assign: "تخصیص اتاق", roomSelect: "اتاق فیزیکی", checkIn: "ثبت ورود", checkOut: "ثبت خروج", cancel: "لغو رزرو", loading: "در حال بارگذاری…", working: "در حال انجام…", paymentPending: "در انتظار پرداخت؛ پرداخت هنوز تأیید نشده است.", error: "انجام عملیات ناموفق بود.", guestError: "نام همه مهمانان را وارد کنید.", holdExpires: "انقضای نگه‌داری", nights: "شب‌ها", noRooms: "نوع اتاقی برای رزرو تنظیم نشده است؛ لطفاً با پذیرش تماس بگیرید.", noRates: "نرخ تأییدشده‌ای برای این اتاق ثبت نشده است.", noInventory: "برای این تاریخ‌ها ظرفیت قابل رزرو وجود ندارد.", noPolicy: "قانون لغو برای این نرخ تنظیم نشده است؛ پذیرش باید آن را تکمیل کند.", manualTitle: "ثبت رزرو حضوری", manualSource: "روش دریافت", walkIn: "مراجعه حضوری", phoneSource: "تلفنی", receptionSource: "پذیرش", phone: "شماره تماس مهمان اصلی (اختیاری)", createManual: "ثبت رزرو و تخصیص اتاق", manualInfo: "رزرو با نرخ فعال ثبت می‌شود. پرداختی ثبت نمی‌شود و وضعیت پرداخت‌نشده باقی می‌ماند.", savedManual: "رزرو پذیرش ثبت شد و اتاق تخصیص یافت.", noPhysicalRooms: "اتاق فیزیکی فعالی برای این نوع اتاق موجود نیست.", source: "مبدأ", demo: "رزرو نمایشی", simulatedPayment: "پرداخت شبیه‌سازی‌شده", simulatedSuccess: "موفق (شبیه‌سازی)", simulatedPending: "در انتظار شبیه‌سازی", search: "جست‌وجو با نام مهمان یا کد رزرو", filterStatus: "فیلتر وضعیت", filterKind: "نوع رزرو", all: "همه", operational: "عملیاتی", arrivalsToday: "ورودهای امروز", departuresToday: "خروج‌های امروز", occupiedToday: "اتاق اشغال‌شده امروز", details: "جزئیات", selectedDetails: "جزئیات رزرو انتخاب‌شده", noMatch: "رزروی با این فیلترها پیدا نشد.", demoKind: "نمایشی", statusLabels: { HELD: "نگه‌داشته‌شده", PENDING_PAYMENT: "در انتظار پرداخت", CONFIRMED: "تأییدشده", CHECKED_IN: "ورود ثبت‌شده", CHECKED_OUT: "خروج ثبت‌شده", CANCELLED: "لغوشده", EXPIRED: "منقضی‌شده", NO_SHOW: "عدم مراجعه", REFUNDED: "بازپرداخت‌شده" } },
  en: { title: "Hotel reservations", centerTitle: "Reservation center", dates: "Check-in", checkout: "Check-out", room: "Room type", plan: "Rate plan", adults: "Adults", kids: "Children", age: "Child age", guests: "Guest names", guest: "Guest full name", quote: "Get quote", quoteRequest: "Quote this request", hold: "Place temporary hold", reserve: "Create reservation", reservations: "Reservations", refresh: "Refresh", empty: "No reservations.", reference: "Reference", status: "Status", total: "Total", paid: "Paid", refunded: "Refunded", assign: "Assign room", roomSelect: "Physical room", checkIn: "Check in", checkOut: "Check out", cancel: "Cancel reservation", loading: "Loading…", working: "Working…", paymentPending: "Payment pending; payment has not been confirmed.", error: "The action failed.", guestError: "Enter every guest name.", holdExpires: "Hold expires", nights: "Nights", noRooms: "No room type is configured. Contact reception.", noRates: "No confirmed rate is configured for this room.", noInventory: "No reservable inventory is available for these dates.", noPolicy: "No cancellation policy is configured for this rate. Reception must complete it.", manualTitle: "Manual reception reservation", manualSource: "Source", walkIn: "Walk-in", phoneSource: "Phone", receptionSource: "Reception", phone: "Primary guest phone (optional)", createManual: "Create reservation and assign room", manualInfo: "The active rate is used. No payment is recorded; payment remains unpaid.", savedManual: "Reception reservation saved and room assigned.", noPhysicalRooms: "No active physical room is configured for this room type.", source: "Source", demo: "Demo reservation", simulatedPayment: "Simulated payment", simulatedSuccess: "Succeeded (simulated)", simulatedPending: "Pending simulation", search: "Search guest or reference", filterStatus: "Filter by status", filterKind: "Reservation type", all: "All", operational: "Operational", arrivalsToday: "Arrivals today", departuresToday: "Departures today", occupiedToday: "Rooms occupied today", details: "Details", selectedDetails: "Selected reservation details", noMatch: "No reservations match these filters.", demoKind: "Demo", statusLabels: { HELD: "Held", PENDING_PAYMENT: "Payment pending", CONFIRMED: "Confirmed", CHECKED_IN: "Checked in", CHECKED_OUT: "Checked out", CANCELLED: "Cancelled", EXPIRED: "Expired", NO_SHOW: "No-show", REFUNDED: "Refunded" } },
  ar: { title: "حجوزات الفندق", centerTitle: "مركز الحجوزات", dates: "تاريخ الوصول", checkout: "تاريخ المغادرة", room: "نوع الغرفة", plan: "خطة السعر", adults: "البالغون", kids: "الأطفال", age: "عمر الطفل", guests: "أسماء الضيوف", guest: "الاسم الكامل للضيف", quote: "طلب السعر", quoteRequest: "تسعير هذا الطلب", hold: "حجز مؤقت", reserve: "إنشاء الحجز", reservations: "الحجوزات", refresh: "تحديث", empty: "لا توجد حجوزات.", reference: "المرجع", status: "الحالة", total: "الإجمالي", paid: "المدفوع", refunded: "المسترد", assign: "تخصيص الغرفة", roomSelect: "الغرفة الفعلية", checkIn: "تسجيل الوصول", checkOut: "تسجيل المغادرة", cancel: "إلغاء الحجز", loading: "جارٍ التحميل…", working: "جارٍ التنفيذ…", paymentPending: "الدفع قيد الانتظار؛ لم يتم تأكيد الدفع.", error: "فشلت العملية.", guestError: "أدخل أسماء الضيوف جميعاً.", holdExpires: "انتهاء الحجز المؤقت", nights: "الليالي", noRooms: "لم يتم إعداد نوع غرفة للحجز؛ تواصل مع الاستقبال.", noRates: "لم يتم إعداد سعر مؤكد لهذه الغرفة.", noInventory: "لا توجد سعة قابلة للحجز في هذه التواريخ.", noPolicy: "لم يتم إعداد سياسة إلغاء لهذا السعر؛ يجب على الاستقبال إكمالها.", manualTitle: "تسجيل حجز الاستقبال", manualSource: "المصدر", walkIn: "حضور مباشر", phoneSource: "هاتف", receptionSource: "الاستقبال", phone: "هاتف الضيف الرئيسي (اختياري)", createManual: "إنشاء الحجز وتخصيص الغرفة", manualInfo: "يُستخدم السعر النشط. لا يتم تسجيل دفعة ويبقى الحجز غير مدفوع.", savedManual: "تم حفظ حجز الاستقبال وتخصيص الغرفة.", noPhysicalRooms: "لا توجد غرفة فعلية نشطة لهذا النوع.", source: "المصدر", demo: "حجز تجريبي", simulatedPayment: "الدفع المحاكى", simulatedSuccess: "نجاح (محاكاة)", simulatedPending: "بانتظار المحاكاة", search: "البحث باسم الضيف أو المرجع", filterStatus: "تصفية الحالة", filterKind: "نوع الحجز", all: "الكل", operational: "تشغيلي", arrivalsToday: "وصول اليوم", departuresToday: "مغادرة اليوم", occupiedToday: "الغرف المشغولة اليوم", details: "التفاصيل", selectedDetails: "تفاصيل الحجز المحدد", noMatch: "لا توجد حجوزات تطابق عوامل التصفية.", demoKind: "تجريبي", statusLabels: { HELD: "محتجز", PENDING_PAYMENT: "بانتظار الدفع", CONFIRMED: "مؤكد", CHECKED_IN: "تم تسجيل الوصول", CHECKED_OUT: "تم تسجيل المغادرة", CANCELLED: "ملغى", EXPIRED: "منتهي", NO_SHOW: "عدم الحضور", REFUNDED: "مسترد" } },
} as const;

function idempotencyKey() { return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`; }
function formatStayDate(value: string, locale: string) {
  const language = locale === "fa" ? "fa-IR-u-ca-persian" : locale === "ar" ? "ar-u-ca-gregory" : "en-GB";
  return new Intl.DateTimeFormat(language, { timeZone: "UTC", dateStyle: "medium" }).format(new Date(`${value.slice(0, 10)}T12:00:00.000Z`));
}

export function HotelOperationalReservations({ organizationId, propertyId, locale, mode = "reception", canConfigure = false, initialStay, requestId, centerMode = false, propertyTimezone = "Asia/Tehran" }: { organizationId: string; propertyId: string; locale: string; mode?: "guest" | "reception"; canConfigure?: boolean; initialStay?: { checkIn: string; checkOut: string; adults: number; childAges: Array<number | null> }; requestId?: string; centerMode?: boolean; propertyTimezone?: string }) {
  const router = useRouter();
  const searchInputId = useId();
  const t = labels[locale as keyof typeof labels] ?? labels.fa;
  const endpoint = useMemo(() => `/api/organizations/${encodeURIComponent(organizationId)}/hotels/${encodeURIComponent(propertyId)}/reservations`, [organizationId, propertyId]);
  const readEndpoint = centerMode ? `${endpoint}?view=center` : endpoint;
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [checkInDate, setCheckInDate] = useState(() => initialStay?.checkIn ?? (centerMode && mode === "reception" ? propertyCalendarDate(propertyTimezone) : ""));
  const [checkOutDate, setCheckOutDate] = useState(() => initialStay?.checkOut ?? (centerMode && mode === "reception" ? offsetPropertyDate(propertyCalendarDate(propertyTimezone), 1) : ""));
  const [adults, setAdults] = useState(initialStay?.adults ?? 2);
  const [childAges, setChildAges] = useState<Array<number | null>>(initialStay?.childAges ?? []);
  const [roomTypeId, setRoomTypeId] = useState("");
  const [ratePlanId, setRatePlanId] = useState("");
  const [names, setNames] = useState<string[]>([""]);
  const [manualRoomId, setManualRoomId] = useState("");
  const [manualSource, setManualSource] = useState<"WALK_IN" | "PHONE" | "RECEPTION">("WALK_IN");
  const [primaryPhone, setPrimaryPhone] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [demoSetup, setDemoSetup] = useState<{ available: boolean; configured: boolean; canConfigure: boolean; propertyId: string | null; categories?: Array<{ slug: string; quantity: number; nightlyRate: string }>; totalUnits?: number } | null>(null);
  const [demoRates, setDemoRates] = useState<Record<string, string>>(Object.fromEntries(demoCatalog.map(category => [category.slug, "125000"])));
  const [quote, setQuote] = useState<{ id: string; totalAmount: string | number; currency: string } | null>(null);
  const [hold, setHold] = useState<{ id: string; expiresAt: string } | null>(null);
  const [selectedRooms, setSelectedRooms] = useState<Record<string, string>>({});
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [kindFilter, setKindFilter] = useState("ALL");
  const [selectedReservationId, setSelectedReservationId] = useState<string | null>(null);
  const retryKeys = useRef(new Map<string, string>());
  const plans = (snapshot?.ratePlans ?? []).filter((plan) => plan.roomTypeId === roomTypeId);
  const effectivePlan = plans.some((plan) => plan.id === ratePlanId) ? ratePlanId : (plans[0]?.id ?? "");
  const today = propertyCalendarDate(snapshot?.receptionSchedule?.timezone ?? propertyTimezone);
  const manualDateIssue: ReceptionDateIssue | null = receptionDateIssue(checkInDate, checkOutDate, today);
  const centerReception = centerMode && mode === "reception";
  const professional = professionalCopy[locale as keyof typeof professionalCopy] ?? professionalCopy.fa;
  const isDemoReservation = (item: Reservation) => snapshot?.demoBooking === true || item.source === "DEMO_BOOKING";
  const visibleReservations = useMemo(() => (snapshot?.reservations ?? []).filter((item) => {
    const matchesSearch = matchesReceptionSearch(searchTerm, [item.reference, item.guestName, ...(item.guests ?? []).map(guest => guest.fullName), ...item.nights.map(night => snapshot?.rooms.find(room => room.id === night.roomId)?.code)]);
    const matchesStatus = statusFilter === "ALL" || item.status === statusFilter;
    const demo = snapshot?.demoBooking === true || item.source === "DEMO_BOOKING";
    const matchesKind = kindFilter === "ALL" || (kindFilter === "DEMO" ? demo : !demo);
    return matchesSearch && matchesStatus && matchesKind;
  }), [snapshot, searchTerm, statusFilter, kindFilter]);
  const selectedReservation = visibleReservations.find((item) => item.id === selectedReservationId) ?? null;
  const summary = (() => {
    const reservations = snapshot?.reservations ?? [];
    return {
      arrivals: reservations.filter((item) => item.checkIn === today && ["CONFIRMED", "CHECKED_IN"].includes(item.status)).length,
      departures: reservations.filter((item) => item.checkOut === today && ["CONFIRMED", "CHECKED_IN"].includes(item.status)).length,
      occupied: new Set(reservations.filter((item) => item.status === "CHECKED_IN").flatMap((item) => item.nights.flatMap((night) => night.date.slice(0, 10) === today && night.roomId ? [night.roomId] : []))).size,
    };
  })();

  const load = useCallback(async () => {
    const response = await fetch(readEndpoint, { cache: "no-store", credentials: "same-origin" });
    const body = await response.json().catch(() => null);
    if (!response.ok) throw new ReservationRequestError(typeof body?.error === "string" ? body.error : t.error, response.status);
    setSnapshot(body as Snapshot);
    setRoomTypeId((value) => body.roomTypes?.some((item: RoomType) => item.id === value) ? value : (body.roomTypes?.[0]?.id ?? ""));
    setRatePlanId((value) => body.ratePlans?.some((item: RatePlan) => item.id === value) ? value : (body.ratePlans?.[0]?.id ?? ""));
  }, [readEndpoint, t.error]);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => load()).catch((cause) => { if (active) setError(reservationActionMessage(cause instanceof Error ? cause.message : "", locale, t.error, cause instanceof ReservationRequestError ? cause.status : undefined)); });
    return () => { active = false; };
  }, [load, locale, t.error]);

  useEffect(() => {
    if (mode !== "reception") return;
    let active = true;
    void fetch("/api/hotel/v1/demo-bookings/provision", { cache: "no-store", credentials: "same-origin" })
      .then(async response => response.ok ? response.json() : null)
      .then(value => { if (active && value?.available === true) { setDemoSetup(value); if (Array.isArray(value.categories)) setDemoRates(current => Object.fromEntries(demoCatalog.map(category => [category.slug, value.categories.find((item: { slug: string }) => item.slug === category.slug)?.nightlyRate || current[category.slug] || "125000"]))); } })
      .catch(() => {});
    return () => { active = false; };
  }, [mode, organizationId]);

  const post = useCallback(async <T,>(payload: Record<string, unknown>): Promise<T> => {
    const body = JSON.stringify(payload);
    const key = retryKeys.current.get(body) ?? idempotencyKey();
    retryKeys.current.set(body, key);
    const response = await fetch(endpoint, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json", "Idempotency-Key": key }, body });
    const result = await response.json().catch(() => null);
    if (!response.ok) throw new ReservationRequestError(typeof result?.error === "string" ? result.error : t.error, response.status);
    retryKeys.current.delete(body);
    if (centerReception) {
      const message = receptionActionSuccess(payload.action, locale);
      if (message) setStatusMessage(message);
    }
    return result as T;
  }, [endpoint, centerReception, locale, t.error]);

  const postManual = useCallback(async (payload: Record<string, unknown>) => {
    const body = JSON.stringify(payload);
    const key = retryKeys.current.get(body) ?? idempotencyKey();
    retryKeys.current.set(body, key);
    const response = await fetch(`${endpoint}/manual`, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json", "Idempotency-Key": key }, body });
    const result = await response.json().catch(() => null);
    if (!response.ok) throw new ReservationRequestError(typeof result?.error === "string" ? result.error : t.error, response.status);
    retryKeys.current.delete(body);
    return result;
  }, [endpoint, t.error]);

  const provisionDemo = async () => {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/hotel/v1/demo-bookings/provision", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ catalogVersion: "DAMOON_31_UNIT_V1", rates: Object.fromEntries(demoCatalog.map(category => [category.slug, Number(demoRates[category.slug])])) }) });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.propertyId) throw new Error(result?.error || t.error);
      router.push(`/${locale}/hotel-reservations/${encodeURIComponent(organizationId)}/${encodeURIComponent(result.propertyId)}`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : t.error); }
    finally { setBusy(false); }
  };

  async function run(action: () => Promise<unknown>, reload = false) {
    setBusy(true); setError(""); setStatusMessage("");
    const refreshCalendar = () => {
      if (centerReception) window.dispatchEvent(new CustomEvent(reservationCenterRefreshEvent, { detail: { organizationId, propertyId } }));
    };
    try {
      // The list and calendar are independent reads; a failure of one must not hide the other.
      if (action === load) refreshCalendar();
      await action();
      if (reload) {
        refreshCalendar();
        try { await load(); }
        catch { setError(receptionReloadMessage(locale)); }
      }
    } catch (cause) {
      setError(reservationActionMessage(cause instanceof Error ? cause.message : "", locale, t.error, cause instanceof ReservationRequestError ? cause.status : undefined));
    } finally { setBusy(false); }
  }
  function invalidateQuote() { retryKeys.current.clear(); setQuote(null); setHold(null); }
  function guestsPayload(): Guest[] | null {
    const count = adults + childAges.length;
    const values = Array.from({ length: count }, (_, index) => names[index]?.trim() ?? "");
    if (values.some((name) => !name) || childAges.some(age => age === null)) return null;
    return values.map((fullName, index) => index < adults ? { fullName, isPrimary: index === 0 } : { fullName, isPrimary: false, isChild: true, age: childAges[index - adults] ?? undefined });
  }

  const rtl = locale === "fa" || locale === "ar";
  const readinessCopy = locale === "en"
    ? { title: "Manual reservation readiness", disabled: "Manual telephone and walk-in reservations are disabled for this property. Ask an authorized manager to review the existing setting." }
    : locale === "ar"
      ? { title: "جاهزية الحجز اليدوي", disabled: "حجوزات الهاتف والحضور المباشر معطلة لهذا العقار. اطلب من مدير مخول مراجعة الإعداد الحالي." }
      : { title: "آمادگی ثبت رزرو دستی", disabled: "ثبت رزرو تلفنی و حضوری برای این ملک غیرفعال است. از مدیر مجاز بخواهید تنظیم موجود را بررسی کند." };
  const readinessIssues = snapshot && centerMode && mode === "reception"
    ? getReservationCenterReadinessIssues({
      roomTypeCount: snapshot.roomTypes.length,
      ratePlanCount: plans.length,
      selectedRoomHasPhysicalRooms: snapshot.rooms.some((room) => room.roomTypeId === roomTypeId),
      manualRoomManagementEnabled: snapshot.manualRoomManagementEnabled,
    })
    : [];
  const showReservationInputs = !centerMode || mode !== "reception" || snapshot?.manualRoomManagementEnabled === true;
  return <section className="min-w-0 max-w-full space-y-5 rounded-xl border bg-card p-4 sm:p-6 [overflow-wrap:anywhere]" dir={rtl ? "rtl" : "ltr"} aria-label={centerMode ? t.centerTitle : t.title}>
    {demoSetup?.available ? <aside className="space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-950" aria-label={locale === "fa" ? "نمایش رزرو دامون" : locale === "ar" ? "عرض حجز دامون" : "Damoon booking demo"}>
      <p className="font-semibold">{locale === "fa" ? "نمایش رزرو دامون · اطلاعات و موجودی ساختگی" : locale === "ar" ? "عرض حجز دامون · بيانات وتوفر اصطناعيان" : "Damoon booking demo · synthetic data and inventory"}</p>
      <p className="text-sm">{locale === "fa" ? `کاتالوگ پیشنهادی: ${demoSetup.totalUnits ?? 31} واحد آزمایشی؛ قیمت‌ها ساختگی‌اند.` : locale === "ar" ? `الكتالوج التجريبي: ${demoSetup.totalUnits ?? 31} وحدة؛ الأسعار اصطناعية.` : `Proposed catalog: ${demoSetup.totalUnits ?? 31} synthetic units; all rates are simulated.`}</p>
      {demoSetup.categories?.length ? <ul className="grid gap-1 text-xs sm:grid-cols-2 xl:grid-cols-3">{demoSetup.categories.map(category => { const label = demoCatalog.find(item => item.slug === category.slug); return <li key={category.slug}>{locale === "fa" ? label?.fa : locale === "ar" ? label?.ar : label?.en}: {category.quantity} · {Number(category.nightlyRate).toLocaleString(locale === "fa" ? "fa-IR" : locale === "ar" ? "ar" : "en-US")} {locale === "fa" ? "تومان نمونه/شب" : locale === "ar" ? "تومان تجريبي/ليلة" : "sample Toman/night"}</li>; })}</ul> : null}
      {demoSetup.configured && demoSetup.propertyId ? <Button type="button" variant="outline" onClick={() => router.push(`/${locale}/hotel-reservations/${encodeURIComponent(organizationId)}/${encodeURIComponent(demoSetup.propertyId!)}`)}>{locale === "fa" ? "بازکردن پذیرش رزروهای نمایشی" : locale === "ar" ? "فتح استقبال الحجوزات التجريبية" : "Open demo reception reservations"}</Button> : null}
      {demoSetup.canConfigure ? <><div className="grid w-full gap-3 sm:grid-cols-2 xl:grid-cols-3">{demoCatalog.map(category => <label key={category.slug} className="space-y-1 text-sm"><span>{locale === "fa" ? category.fa : locale === "ar" ? category.ar : category.en} · {locale === "fa" ? "نرخ نمونه هر شب (تومان ساختگی)" : locale === "ar" ? "سعر الليلة التجريبي (تومان اصطناعي)" : "Synthetic sample rate per night (Toman)"}</span><Input aria-label={`${locale === "fa" ? category.fa : locale === "ar" ? category.ar : category.en} synthetic nightly rate`} type="number" min={1} max={100000000} step={1000} value={demoRates[category.slug] ?? "125000"} onChange={event => setDemoRates(current => ({ ...current, [category.slug]: event.target.value }))} /></label>)}</div><Button type="button" disabled={busy || demoCatalog.some(category => !Number.isSafeInteger(Number(demoRates[category.slug])) || Number(demoRates[category.slug]) < 1 || Number(demoRates[category.slug]) > 100000000)} onClick={() => void provisionDemo()}>{busy ? t.working : demoSetup.configured ? locale === "fa" ? "به‌روزرسانی کاتالوگ نمایشی" : locale === "ar" ? "تحديث كتالوج العرض التجريبي" : "Update demo catalog" : locale === "fa" ? "آماده‌سازی کاتالوگ ۳۱ واحد نمایشی" : locale === "ar" ? "إعداد كتالوج العرض من ٣١ وحدة" : "Set up 31-unit demo catalog"}</Button></> : null}
      <p className="text-xs">{locale === "fa" ? "این بخش موجودی عملیاتی را تغییر نمی‌دهد و هیچ پرداختی دریافت نمی‌کند." : locale === "ar" ? "لا يغير هذا القسم التوفر التشغيلي ولا يحصل أي دفعة." : "This does not change operational inventory or collect payments."}</p>
    </aside> : null}
    <header className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-xl font-semibold">{centerMode ? t.centerTitle : t.title}</h1><Button type="button" variant="outline" disabled={busy} onClick={() => void run(load)}>{t.refresh}</Button></header>
    {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
    {snapshot?.demoBooking && snapshot.maintenanceAvailable === false ? <p role="status" aria-live="polite" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">{locale === "fa" ? "اطلاعات نگهداری اتاق در پایگاه‌داده آماده نیست؛ تخصیص، رزرو حضوری و ثبت ورود تا آماده‌شدن جدول نگهداری متوقف است." : locale === "ar" ? "بيانات صيانة الغرف غير جاهزة في قاعدة البيانات؛ تم إيقاف التخصيص والحجوزات الحضورية وتسجيل الوصول حتى تجهيز جدول الصيانة." : "Room-maintenance data is unavailable; assignment, manual reservations and check-in are blocked until the maintenance table is ready."}</p> : null}
    {readinessIssues.length > 0 ? <aside role="status" aria-live="polite" aria-label={readinessCopy.title} className="space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
      <h2 className="font-semibold">{readinessCopy.title}</h2>
      <ul className="list-inside list-disc space-y-1">
        {readinessIssues.map((issue) => <li key={issue}>{issue === "NO_ROOM_TYPES" ? t.noRooms : issue === "NO_RATE_PLANS" ? t.noRates : issue === "NO_PHYSICAL_ROOMS" ? t.noPhysicalRooms : readinessCopy.disabled}</li>)}
      </ul>
    </aside> : null}
    {centerMode && mode === "reception" ? <div className="grid min-w-0 gap-3 sm:grid-cols-3" aria-label={t.centerTitle}>
      {[ [t.arrivalsToday, summary.arrivals], [t.departuresToday, summary.departures], [t.occupiedToday, summary.occupied] ].map(([label, value]) => <article key={String(label)} className="min-w-0 rounded-lg border bg-background p-3"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-semibold" dir="auto">{value}</p></article>)}
    </div> : null}
    {mode === "reception" && canConfigure && !centerMode && snapshot?.mode !== "MANUAL" && snapshot?.confirmationPolicy ? <HotelOfflinePolicySettings key={JSON.stringify(snapshot.confirmationPolicy)} organizationId={organizationId} propertyId={propertyId} locale={locale} initialValues={snapshot.confirmationPolicy} apiWired onSaved={() => void run(load)} /> : null}
    {showReservationInputs ? <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {mode === "reception" ? <>
        <HotelJalaliDateField label={t.dates} value={checkInDate} today={today} locale={locale} min={centerReception ? today : undefined} onChange={value => { setCheckInDate(value); if (centerReception && isPropertyDate(value) && (!isPropertyDate(checkOutDate) || checkOutDate <= value)) setCheckOutDate(offsetPropertyDate(value, 1)); invalidateQuote(); }} />
        <HotelJalaliDateField label={t.checkout} value={checkOutDate} today={today} locale={locale} min={centerReception && isPropertyDate(checkInDate) ? offsetPropertyDate(checkInDate, 1) : undefined} max={centerReception && isPropertyDate(checkInDate) ? offsetPropertyDate(checkInDate, 31) : undefined} onChange={value => { setCheckOutDate(value); invalidateQuote(); }} />
      </> : <>
      <label className="min-w-0 space-y-1 text-sm"><span>{t.dates}</span><Input type="date" value={checkInDate} min={centerReception ? today : undefined} onChange={(e) => { const value = e.target.value; setCheckInDate(value); if (centerReception && isPropertyDate(value) && (!isPropertyDate(checkOutDate) || checkOutDate <= value)) setCheckOutDate(offsetPropertyDate(value, 1)); invalidateQuote(); }} /></label>
      <label className="min-w-0 space-y-1 text-sm"><span>{t.checkout}</span><Input type="date" value={checkOutDate} min={centerReception && isPropertyDate(checkInDate) ? offsetPropertyDate(checkInDate, 1) : undefined} max={centerReception && isPropertyDate(checkInDate) ? offsetPropertyDate(checkInDate, 31) : undefined} onChange={(e) => { setCheckOutDate(e.target.value); invalidateQuote(); }} /></label>
      </>}
      <label className="min-w-0 space-y-1 text-sm"><span>{t.room}</span><select className="h-10 w-full min-w-0 rounded-md border bg-background px-3" value={roomTypeId} onChange={(e) => { setRoomTypeId(e.target.value); setRatePlanId(""); invalidateQuote(); }}>{(snapshot?.roomTypes ?? []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label className="min-w-0 space-y-1 text-sm"><span>{t.plan}</span><select className="h-10 w-full min-w-0 rounded-md border bg-background px-3" value={effectivePlan} onChange={(e) => { setRatePlanId(e.target.value); invalidateQuote(); }}>{plans.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label className="space-y-1 text-sm"><span>{t.adults}</span><Input type="number" min={1} max={12} value={adults} onChange={(e) => { setAdults(Math.max(1, Math.min(12, Number(e.target.value) || 1))); invalidateQuote(); }} /></label>
      <label className="space-y-1 text-sm"><span>{t.kids}</span><Input type="number" min={0} max={8} value={childAges.length} onChange={(e) => { const n = Math.max(0, Math.min(8, Number(e.target.value) || 0)); setChildAges((ages) => Array.from({ length: n }, (_, i) => ages[i] ?? null)); invalidateQuote(); }} /></label>
      {childAges.map((age, i) => <label key={i} className="space-y-1 text-sm"><span>{t.age} {i + 1}</span><Input type="number" min={0} max={17} value={age ?? ""} onChange={(e) => { const value = e.target.value === "" ? null : Math.max(0, Math.min(17, Number(e.target.value))); setChildAges((ages) => ages.map((old, j) => i === j ? value : old)); invalidateQuote(); }} /></label>)}
    </div> : null}
    {mode === "reception" && snapshot?.manualRoomManagementEnabled ? <section className="space-y-3 rounded-lg border p-3" aria-label={t.manualTitle}>
      <h2 className="font-semibold">{t.manualTitle}</h2><p className="text-sm text-muted-foreground">{t.manualInfo}</p>
      <div className="grid min-w-0 gap-3 sm:grid-cols-2">
        <label className="min-w-0 space-y-1 text-sm"><span>{t.roomSelect}</span><select className="h-10 w-full min-w-0 rounded-md border bg-background px-3" value={manualRoomId} onChange={(event) => setManualRoomId(event.target.value)}><option value="" />{(snapshot.rooms ?? []).filter((room) => room.roomTypeId === roomTypeId).map((room) => <option key={room.id} value={room.id}>{room.code}</option>)}</select></label>
        <label className="min-w-0 space-y-1 text-sm"><span>{t.manualSource}</span><select className="h-10 w-full min-w-0 rounded-md border bg-background px-3" value={manualSource} onChange={(event) => setManualSource(event.target.value as typeof manualSource)}><option value="WALK_IN">{t.walkIn}</option><option value="PHONE">{t.phoneSource}</option><option value="RECEPTION">{t.receptionSource}</option></select></label>
        {Array.from({ length: adults + childAges.length }, (_, index) => <label key={index} className="min-w-0 space-y-1 text-sm"><span>{t.guest} {index + 1}</span><Input value={names[index] ?? ""} autoComplete={index === 0 ? "name" : "off"} onChange={(event) => setNames((values) => Array.from({ length: adults + childAges.length }, (_, item) => item === index ? event.target.value : values[item] ?? ""))} /></label>)}
        <label className="min-w-0 space-y-1 text-sm"><span>{t.phone}</span><Input type="tel" inputMode="tel" autoComplete="tel" value={primaryPhone} onChange={(event) => setPrimaryPhone(event.target.value)} /></label>
      </div>
      {!snapshot.rooms.some((room) => room.roomTypeId === roomTypeId) ? <p role="status" className="text-sm text-amber-700">{t.noPhysicalRooms}</p> : null}
      {manualDateIssue ? <p role="status" className="text-sm text-destructive">{receptionDateMessage(manualDateIssue, locale)}</p> : null}
      <Button type="button" disabled={busy || Boolean(manualDateIssue) || !manualRoomId || !snapshot.rooms.some(room => room.id === manualRoomId && room.roomTypeId === roomTypeId) || !roomTypeId || !effectivePlan || childAges.some((age) => age === null) || !guestsPayload()} onClick={() => {
        const issue = receptionDateIssue(checkInDate, checkOutDate, propertyCalendarDate(propertyTimezone));
        if (issue) { setError(receptionDateMessage(issue, locale)); return; }
        const guests = guestsPayload();
        if (!guests) { setError(t.guestError); return; }
        setStatusMessage("");
        void run(() => postManual({ roomId: manualRoomId, roomTypeId, ratePlanId: effectivePlan, checkIn: checkInDate, checkOut: checkOutDate, adults, childAges: childAges as number[], source: manualSource, guests: guests.map((guest, index) => index === 0 && primaryPhone.trim() ? { ...guest, phone: primaryPhone.trim() } : guest) }).then(() => { setStatusMessage(t.savedManual); setNames([""]); setPrimaryPhone(""); }), true);
      }}>{busy ? t.working : t.createManual}</Button>
    </section> : null}
    {mode === "guest" && snapshot && (snapshot.roomTypes.length === 0 || Boolean(roomTypeId && plans.length === 0)) ? <p role="status" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">{snapshot.roomTypes.length === 0 ? t.noRooms : t.noRates}</p> : null}
    {statusMessage ? <p role="status" className="text-sm text-green-700">{statusMessage}</p> : null}
    {snapshot?.mode !== "MANUAL" ? (quote ? <div className="space-y-3 rounded-lg border p-3"><p>{t.total}: <bdi dir="ltr">{quote.totalAmount} {quote.currency}</bdi></p>{!hold ? <Button disabled={busy} onClick={() => void run(() => post<{ hold: { id: string; expiresAt: string } }>({ action: "hold", quoteId: quote.id }).then((result) => setHold(result.hold)))}>{busy ? t.working : t.hold}</Button> : <>
      <p className="text-sm">{t.holdExpires}: <bdi dir="ltr">{hold.expiresAt}</bdi></p><h2 className="font-medium">{t.guests}</h2>
      <div className="grid gap-2 sm:grid-cols-2">{Array.from({ length: adults + childAges.length }, (_, i) => <label key={i} className="space-y-1 text-sm"><span>{t.guest} {i + 1}</span><Input value={names[i] ?? ""} autoComplete={i === 0 ? "name" : "off"} onChange={(e) => { retryKeys.current.clear(); setNames((values) => Array.from({ length: adults + childAges.length }, (_, j) => i === j ? e.target.value : values[j] ?? "")); }} /></label>)}</div>
      <Button disabled={busy || !guestsPayload()} onClick={() => { const guests = guestsPayload(); if (!guests) { setError(t.guestError); return; } void run(() => post({ action: "reserve", quoteId: quote.id, holdId: hold.id, guests }).then(() => { setQuote(null); setHold(null); }), true); }}>{busy ? t.working : t.reserve}</Button>
    </>}</div> : <Button disabled={busy || (requestId ? false : !checkInDate || !checkOutDate || !roomTypeId || !effectivePlan || childAges.some(age => age === null))} onClick={() => void run(() => post<{ quote: { id: string; totalAmount: string | number; currency: string; checkIn: string; checkOut: string; adults: number; childAges: number[]; roomTypeId: string; ratePlanId: string } }>(requestId ? { action: "quote-request", requestId } : { action: "quote", roomTypeId, ratePlanId: effectivePlan, checkIn: checkInDate, checkOut: checkOutDate, adults, childAges }).then((result) => { setQuote(result.quote); setCheckInDate(result.quote.checkIn); setCheckOutDate(result.quote.checkOut); setAdults(result.quote.adults); setChildAges(result.quote.childAges); setRoomTypeId(result.quote.roomTypeId); setRatePlanId(result.quote.ratePlanId); }))}>{busy ? t.working : requestId ? t.quoteRequest : t.quote}</Button>) : null}
    {centerReception && snapshot ? <HotelReceptionDirectory key={endpoint} endpoint={endpoint} locale={locale} statusLabels={t.statusLabels} /> : null}
    <div className="min-w-0 space-y-3"><h2 className="font-semibold">{t.reservations}</h2>{centerMode && snapshot ? <div className="grid min-w-0 gap-2 sm:grid-cols-3">
      <div className="min-w-0 space-y-1 text-sm">
        <label htmlFor={searchInputId}>{centerReception ? professional.search : t.search}</label>
        <Input id={searchInputId} type="search" aria-describedby={centerReception ? `${searchInputId}-hint` : undefined} value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} />
        {centerReception ? <p id={`${searchInputId}-hint`} className="text-xs text-muted-foreground">{professional.limit}</p> : null}
      </div>
      <label className="min-w-0 space-y-1 text-sm"><span>{t.filterStatus}</span><select className="h-10 w-full min-w-0 rounded-md border bg-background px-3" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="ALL">{t.all}</option>{Object.keys(t.statusLabels).map((status) => <option key={status} value={status}>{t.statusLabels[status as keyof typeof t.statusLabels]}</option>)}</select></label>
      <label className="min-w-0 space-y-1 text-sm"><span>{t.filterKind}</span><select className="h-10 w-full min-w-0 rounded-md border bg-background px-3" value={kindFilter} onChange={(event) => setKindFilter(event.target.value)}><option value="ALL">{t.all}</option><option value="DEMO">{t.demoKind}</option><option value="OPERATIONAL">{t.operational}</option></select></label>
    </div> : null}{!snapshot ? <p className="text-sm text-muted-foreground">{t.loading}</p> : snapshot.reservations.length === 0 ? <p className="text-sm text-muted-foreground">{t.empty}</p> : visibleReservations.length === 0 ? <p role="status" className="text-sm text-muted-foreground">{t.noMatch}</p> : <ul className="space-y-2">{visibleReservations.map((item) => {
      const assignedRoomId = (item.status === "CHECKED_IN" ? currentReceptionRoom(item.nights, today) : item.nights.find(night => night.roomId)?.roomId) ?? "";
      const assigned = snapshot.rooms.find((room) => room.id === assignedRoomId);
      const chosen = selectedRooms[item.id] ?? assignedRoomId;
      return <li key={item.id} className="space-y-2 rounded-lg border p-3">{isDemoReservation(item) ? <p className="inline-flex rounded bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-950 dark:bg-amber-950 dark:text-amber-100">{t.demo}</p> : null}<div className="flex flex-wrap justify-between gap-2"><span className="font-medium"><bdi dir="ltr">{item.reference}</bdi> · {t.statusLabels[item.status as keyof typeof t.statusLabels] ?? item.status}</span><span className="text-sm"><time dateTime={item.checkIn} dir="auto">{centerMode ? formatStayDate(item.checkIn, locale) : item.checkIn}</time> – <time dateTime={item.checkOut} dir="auto">{centerMode ? formatStayDate(item.checkOut, locale) : item.checkOut}</time> · {item.nights.length} {t.nights}</span></div>{item.guestName ? <p className="text-sm">{item.guestName} · {snapshot.roomTypes.find((roomType) => roomType.id === item.roomTypeId)?.name}</p> : null}<p className="text-sm">{t.total}: <bdi dir="ltr">{item.totalAmount} {item.currency}</bdi> · {t.paid}: <bdi dir="ltr">{item.paidAmount}</bdi> · {t.refunded}: <bdi dir="ltr">{item.refundedAmount}</bdi>{item.source ? ` · ${t.source}: ${item.source === "WALK_IN" ? t.walkIn : item.source === "PHONE" ? t.phoneSource : item.source === "DEMO_BOOKING" ? t.demo : t.receptionSource}` : ""}</p>{isDemoReservation(item) && item.simulatedPaymentStatus ? <p className="text-sm">{t.simulatedPayment}: {item.simulatedPaymentStatus === "SIMULATED_SUCCESS" ? t.simulatedSuccess : t.simulatedPending}</p> : null}{item.status === "PENDING_PAYMENT" ? <p className="text-sm text-amber-700">{t.paymentPending}</p> : null}
        {centerMode ? <Button type="button" size="sm" variant="outline" aria-expanded={selectedReservationId === item.id} onClick={() => setSelectedReservationId((current) => current === item.id ? null : item.id)}>{t.details}</Button> : null}
        {mode === "guest" && item.status === "PENDING_PAYMENT" ? <div className="flex flex-wrap gap-2">{snapshot.confirmationPolicy?.allowedOfflinePaymentMethods.map(method => <Button key={method} size="sm" variant="outline" disabled={busy || item.paymentMethod === method} onClick={() => void run(() => post({ action: "select-payment-method", reservationId: item.id, method }), true)}>{method === "CASH" ? (locale === "fa" ? "نقدی در هتل" : locale === "ar" ? "نقداً في الفندق" : "Cash at hotel") : (locale === "fa" ? "واریز بانکی" : locale === "ar" ? "تحويل بنكي" : "Bank transfer")}{item.paymentMethod === method ? " ✓" : ""}</Button>)}</div> : null}
        <div className="flex flex-wrap items-center gap-2">{mode === "reception" && ["CONFIRMED", "PENDING_PAYMENT"].includes(item.status) ? <><label className="flex items-center gap-2 text-sm"><span>{t.roomSelect}</span><select className="h-9 rounded-md border bg-background px-2" value={chosen} onChange={(e) => { retryKeys.current.clear(); setSelectedRooms((values) => ({ ...values, [item.id]: e.target.value })); }}><option value="" />{snapshot.rooms.filter((room) => !item.roomTypeId || room.roomTypeId === item.roomTypeId).map((room) => <option key={room.id} value={room.id}>{room.code}</option>)}</select></label><Button size="sm" variant="outline" disabled={busy || item.status !== "CONFIRMED" || !chosen || chosen === assignedRoomId} onClick={() => void run(() => post({ action: "assign-room", reservationId: item.id, roomId: chosen }), true)}>{t.assign}</Button>{item.status === "PENDING_PAYMENT" ? <Button size="sm" variant="outline" disabled={busy || !item.paymentMethod} onClick={() => void run(() => post({ action: "confirm-reservation", reservationId: item.id }), true)}>{locale === "fa" ? "تأیید رزرو" : locale === "ar" ? "تأكيد الحجز" : "Confirm reservation"}</Button> : null}</> : null}
          
          {centerReception && snapshot.manualRoomManagementEnabled && ["WALK_IN", "PHONE", "RECEPTION"].includes(item.source ?? "") && Number(item.paidAmount) === 0 && Number(item.refundedAmount) === 0 && !item.paymentMethod && canMarkManualNoShow({ status: item.status, checkIn: item.checkIn, today, checkedInAt: item.checkedInAt }) ? <Button size="sm" variant="outline" disabled={busy} onClick={() => { if (window.confirm(professional.confirm)) void run(() => post({ action: "mark-no-show", reservationId: item.id }), true); }}>{professional.noShow}</Button> : null}
          {["PENDING_PAYMENT", "CONFIRMED"].includes(item.status) ? <Button size="sm" variant="outline" disabled={busy} onClick={() => void run(() => post({ action: "cancel", reservationId: item.id }), true)}>{t.cancel}</Button> : null}
        </div>{assigned ? <p className="text-xs text-muted-foreground">{t.roomSelect}: <bdi dir="ltr">{assigned.code}</bdi></p> : null}
        {mode === "reception" && snapshot.receptionSchedule ? <HotelReceptionLifecycle
          key={`${item.id}:${item.status}:${item.checkIn}:${item.checkOut}:${assignedRoomId}`}
          locale={locale} schedule={snapshot.receptionSchedule} status={item.status} checkIn={item.checkIn} checkOut={item.checkOut}
          checkedInAt={item.checkedInAt} checkedOutAt={item.checkedOutAt} assigned={Boolean(assignedRoomId)} busy={busy}
          canPreview={Boolean(snapshot.manualRoomManagementEnabled && snapshot.maintenanceAvailable !== false && assignedRoomId && ["WALK_IN", "PHONE", "RECEPTION"].includes(item.source ?? "") && Number(item.paidAmount) === 0 && Number(item.refundedAmount) === 0 && !item.paymentMethod)}
          onArrival={allowEarlyArrival => void run(() => post({ action: "check-in", reservationId: item.id, allowEarlyArrival }), true)}
          onDeparture={retainBookedNights => void run(() => post({ action: "check-out", reservationId: item.id, retainBookedNights }), true)}
          onPreview={(checkOut, receive) => void run(() => post<{ amendment: AmendmentPreview }>({ action: "preview-amend-stay", reservationId: item.id, checkIn: item.checkIn, checkOut }).then(result => receive(result.amendment)))}
          onEarlyDeparture={preview => void run(() => post({ action: "check-out", reservationId: item.id, earlyDeparture: { checkOut: preview.checkOut, expectedVersion: preview.version, expectedTotal: preview.total } }), true)}
        /> : null}
        {centerReception && snapshot.manualRoomManagementEnabled && snapshot.maintenanceAvailable !== false && (item.status === "CONFIRMED" || item.status === "CHECKED_IN") ? <HotelStayActions
          key={`${item.id}:${item.checkIn}:${item.checkOut}:${assignedRoomId}`}
          locale={locale} busy={busy} status={item.status} today={today} checkIn={item.checkIn} checkOut={item.checkOut} currentRoomId={assignedRoomId} roomTypeId={item.roomTypeId} rooms={snapshot.rooms}
          canAmend={Boolean(assignedRoomId && item.source && ["WALK_IN", "PHONE", "RECEPTION"].includes(item.source) && Number(item.paidAmount) === 0 && Number(item.refundedAmount) === 0 && !item.paymentMethod)}
          onPreview={(dates, receive) => void run(() => post<{ amendment: AmendmentPreview }>({ action: "preview-amend-stay", reservationId: item.id, ...dates }).then(result => receive(result.amendment)))}
          onApply={(dates, preview, done) => void run(() => post({ action: "amend-stay", reservationId: item.id, ...dates, expectedVersion: preview.version, expectedTotal: preview.total }).then(() => done()), true)}
          onMove={(roomId, expectedRoomId) => void run(() => post({ action: "move-room", reservationId: item.id, roomId, expectedRoomId }), true)}
        /> : null}
        {mode === "reception" && !item.source ? <HotelOfflinePayments organizationId={organizationId} propertyId={propertyId} reservationId={item.id} locale={locale} apiWired /> : mode !== "reception" && !item.source && item.paymentMethod === "BANK_TRANSFER" ? <HotelGuestOfflinePayment organizationId={organizationId} propertyId={propertyId} reservationId={item.id} locale={locale} /> : null}</li>;
    })}</ul>}{centerMode && selectedReservation ? <aside className="space-y-2 rounded-lg border bg-background p-4" aria-label={t.selectedDetails}>
      <h3 className="font-semibold">{t.selectedDetails}</h3>
      <p>{t.reference}: <bdi dir="ltr">{selectedReservation.reference}</bdi></p>
      {selectedReservation.guestName ? <p>{t.guest}: {selectedReservation.guestName}</p> : null}
      <p>{t.room}: {snapshot?.roomTypes.find((item) => item.id === selectedReservation.roomTypeId)?.name ?? "—"}</p>
      <p>{t.dates}: <time dateTime={selectedReservation.checkIn} dir="auto">{formatStayDate(selectedReservation.checkIn, locale)}</time> · {t.checkout}: <time dateTime={selectedReservation.checkOut} dir="auto">{formatStayDate(selectedReservation.checkOut, locale)}</time></p>
      <p>{t.status}: {t.statusLabels[selectedReservation.status as keyof typeof t.statusLabels] ?? selectedReservation.status}</p>
      <p>{t.roomSelect}: <bdi dir="ltr">{snapshot?.rooms.find((room) => room.id === selectedReservation.nights.find((night) => night.roomId)?.roomId)?.code ?? "—"}</bdi></p>
      <p>{t.total}: <bdi dir="ltr">{selectedReservation.totalAmount} {selectedReservation.currency}</bdi></p>
      {centerReception ? <div className="space-y-3 border-t pt-3">
        <section><h4 className="font-medium">{professional.guests}</h4><ul className="mt-1 space-y-1 text-sm">{(selectedReservation.guests ?? []).map((guest, index) => <li key={index}><bdi>{guest.fullName}</bdi> · {guest.isPrimary ? professional.primary : guest.isChild ? professional.child : professional.adult}{guest.age !== null ? ` · ${professional.age}: ${guest.age}` : ""}</li>)}</ul></section>
        <section><h4 className="font-medium">{professional.history}</h4><p className="text-xs text-muted-foreground">{professional.historyLimit}</p><ul className="mt-1 space-y-1 text-sm">{(snapshot?.receptionHistory ?? []).filter(event => event.reservationId === selectedReservation.id).map(event => <li key={event.id}>{professional.actions[event.action as ReceptionHistoryAction]} · <time dateTime={event.at}>{new Intl.DateTimeFormat(locale === "fa" ? "fa-IR" : locale === "ar" ? "ar" : "en", { dateStyle: "short", timeStyle: "short", timeZone: propertyTimezone }).format(new Date(event.at))}</time></li>)}</ul>{!(snapshot?.receptionHistory ?? []).some(event => event.reservationId === selectedReservation.id) ? <p className="text-xs text-muted-foreground">{professional.none}</p> : null}</section>
      </div> : null}
      {isDemoReservation(selectedReservation) ? <p className="font-medium text-amber-800 dark:text-amber-200">{t.demo}{selectedReservation.simulatedPaymentStatus ? ` · ${t.simulatedPayment}: ${selectedReservation.simulatedPaymentStatus === "SIMULATED_SUCCESS" ? t.simulatedSuccess : t.simulatedPending}` : ""}</p> : null}
    </aside> : null}</div>
  </section>;
}
