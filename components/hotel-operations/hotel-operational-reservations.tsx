"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { HotelOfflinePayments } from "@/components/hotel-operations/hotel-offline-payments";
import { HotelGuestOfflinePayment } from "@/components/hotel-operations/hotel-guest-offline-payment";
import { HotelOfflinePolicySettings } from "@/components/hotel-operations/hotel-offline-policy-settings";

type RoomType = { id: string; name: string };
type RatePlan = { id: string; name: string; roomTypeId: string };
type Room = { id: string; code: string; roomTypeId: string };
type Reservation = { id: string; reference: string; status: string; source?: string | null; paymentMethod?: "CASH" | "BANK_TRANSFER" | null; checkIn: string; checkOut: string; totalAmount: string | number; currency: string; paidAmount: string | number; refundedAmount: string | number; nights: { roomId: string | null }[] };
type Snapshot = { mode: string; view: string; manualRoomManagementEnabled?: boolean; roomTypes: RoomType[]; ratePlans: RatePlan[]; reservations: Reservation[]; rooms: Room[]; confirmationPolicy?: { manualConfirmationPolicy: "DISABLED" | "CASH_ON_ARRIVAL" | "MINIMUM_VERIFIED_DEPOSIT"; allowedOfflinePaymentMethods: Array<"CASH" | "BANK_TRANSFER">; minimumVerifiedDepositAmount: string | null; pendingPaymentMinutes: number } };
type Guest = { fullName: string; isPrimary: boolean; isChild?: boolean; age?: number };

const labels = {
  fa: { title: "رزروهای هتل", dates: "تاریخ ورود", checkout: "تاریخ خروج", room: "نوع اتاق", plan: "طرح نرخ", adults: "بزرگسالان", kids: "کودکان", age: "سن کودک", guests: "نام مهمانان", guest: "نام کامل مهمان", quote: "دریافت قیمت", quoteRequest: "قیمت‌گذاری این درخواست", hold: "نگه‌داری موقت", reserve: "ثبت رزرو", reservations: "رزروها", refresh: "بارگذاری دوباره", empty: "رزروی وجود ندارد.", reference: "کد پیگیری", status: "وضعیت", total: "مبلغ", paid: "پرداخت‌شده", refunded: "بازپرداخت‌شده", assign: "تخصیص اتاق", roomSelect: "اتاق فیزیکی", checkIn: "ثبت ورود", checkOut: "ثبت خروج", cancel: "لغو رزرو", loading: "در حال بارگذاری…", working: "در حال انجام…", paymentPending: "در انتظار پرداخت؛ پرداخت هنوز تأیید نشده است.", error: "انجام عملیات ناموفق بود.", guestError: "نام همه مهمانان را وارد کنید.", holdExpires: "انقضای نگه‌داری", nights: "شب‌ها", noRooms: "نوع اتاقی برای رزرو تنظیم نشده است؛ لطفاً با پذیرش تماس بگیرید.", noRates: "نرخ تأییدشده‌ای برای این اتاق ثبت نشده است.", noInventory: "برای این تاریخ‌ها ظرفیت قابل رزرو وجود ندارد.", noPolicy: "قانون لغو برای این نرخ تنظیم نشده است؛ پذیرش باید آن را تکمیل کند.", manualTitle: "ثبت رزرو حضوری", manualSource: "روش دریافت", walkIn: "مراجعه حضوری", phoneSource: "تلفنی", receptionSource: "پذیرش", phone: "شماره تماس مهمان اصلی (اختیاری)", createManual: "ثبت رزرو و تخصیص اتاق", manualInfo: "رزرو با نرخ فعال ثبت می‌شود. پرداختی ثبت نمی‌شود و وضعیت پرداخت‌نشده باقی می‌ماند.", savedManual: "رزرو پذیرش ثبت شد و اتاق تخصیص یافت.", noPhysicalRooms: "اتاق فیزیکی فعالی برای این نوع اتاق موجود نیست.", source: "مبدأ" },
  en: { title: "Hotel reservations", dates: "Check-in", checkout: "Check-out", room: "Room type", plan: "Rate plan", adults: "Adults", kids: "Children", age: "Child age", guests: "Guest names", guest: "Guest full name", quote: "Get quote", quoteRequest: "Quote this request", hold: "Place temporary hold", reserve: "Create reservation", reservations: "Reservations", refresh: "Refresh", empty: "No reservations.", reference: "Reference", status: "Status", total: "Total", paid: "Paid", refunded: "Refunded", assign: "Assign room", roomSelect: "Physical room", checkIn: "Check in", checkOut: "Check out", cancel: "Cancel reservation", loading: "Loading…", working: "Working…", paymentPending: "Payment pending; payment has not been confirmed.", error: "The action failed.", guestError: "Enter every guest name.", holdExpires: "Hold expires", nights: "Nights", noRooms: "No room type is configured. Contact reception.", noRates: "No confirmed rate is configured for this room.", noInventory: "No reservable inventory is available for these dates.", noPolicy: "No cancellation policy is configured for this rate. Reception must complete it.", manualTitle: "Manual reception reservation", manualSource: "Source", walkIn: "Walk-in", phoneSource: "Phone", receptionSource: "Reception", phone: "Primary guest phone (optional)", createManual: "Create reservation and assign room", manualInfo: "The active rate is used. No payment is recorded; payment remains unpaid.", savedManual: "Reception reservation saved and room assigned.", noPhysicalRooms: "No active physical room is configured for this room type.", source: "Source" },
  ar: { title: "حجوزات الفندق", dates: "تاريخ الوصول", checkout: "تاريخ المغادرة", room: "نوع الغرفة", plan: "خطة السعر", adults: "البالغون", kids: "الأطفال", age: "عمر الطفل", guests: "أسماء الضيوف", guest: "الاسم الكامل للضيف", quote: "طلب السعر", quoteRequest: "تسعير هذا الطلب", hold: "حجز مؤقت", reserve: "إنشاء الحجز", reservations: "الحجوزات", refresh: "تحديث", empty: "لا توجد حجوزات.", reference: "المرجع", status: "الحالة", total: "الإجمالي", paid: "المدفوع", refunded: "المسترد", assign: "تخصيص الغرفة", roomSelect: "الغرفة الفعلية", checkIn: "تسجيل الوصول", checkOut: "تسجيل المغادرة", cancel: "إلغاء الحجز", loading: "جارٍ التحميل…", working: "جارٍ التنفيذ…", paymentPending: "الدفع قيد الانتظار؛ لم يتم تأكيد الدفع.", error: "فشلت العملية.", guestError: "أدخل أسماء الضيوف جميعاً.", holdExpires: "انتهاء الحجز المؤقت", nights: "الليالي", noRooms: "لم يتم إعداد نوع غرفة للحجز؛ تواصل مع الاستقبال.", noRates: "لم يتم إعداد سعر مؤكد لهذه الغرفة.", noInventory: "لا توجد سعة قابلة للحجز في هذه التواريخ.", noPolicy: "لم يتم إعداد سياسة إلغاء لهذا السعر؛ يجب على الاستقبال إكمالها.", manualTitle: "تسجيل حجز الاستقبال", manualSource: "المصدر", walkIn: "حضور مباشر", phoneSource: "هاتف", receptionSource: "الاستقبال", phone: "هاتف الضيف الرئيسي (اختياري)", createManual: "إنشاء الحجز وتخصيص الغرفة", manualInfo: "يُستخدم السعر النشط. لا يتم تسجيل دفعة ويبقى الحجز غير مدفوع.", savedManual: "تم حفظ حجز الاستقبال وتخصيص الغرفة.", noPhysicalRooms: "لا توجد غرفة فعلية نشطة لهذا النوع.", source: "المصدر" },
} as const;

function idempotencyKey() { return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`; }

export function HotelOperationalReservations({ organizationId, propertyId, locale, mode = "reception", canConfigure = false, initialStay, requestId }: { organizationId: string; propertyId: string; locale: string; mode?: "guest" | "reception"; canConfigure?: boolean; initialStay?: { checkIn: string; checkOut: string; adults: number; childAges: Array<number | null> }; requestId?: string }) {
  const t = labels[locale as keyof typeof labels] ?? labels.fa;
  const endpoint = useMemo(() => `/api/organizations/${encodeURIComponent(organizationId)}/hotels/${encodeURIComponent(propertyId)}/reservations`, [organizationId, propertyId]);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [checkInDate, setCheckInDate] = useState(initialStay?.checkIn ?? "");
  const [checkOutDate, setCheckOutDate] = useState(initialStay?.checkOut ?? "");
  const [adults, setAdults] = useState(initialStay?.adults ?? 2);
  const [childAges, setChildAges] = useState<Array<number | null>>(initialStay?.childAges ?? []);
  const [roomTypeId, setRoomTypeId] = useState("");
  const [ratePlanId, setRatePlanId] = useState("");
  const [names, setNames] = useState<string[]>([""]);
  const [manualRoomId, setManualRoomId] = useState("");
  const [manualSource, setManualSource] = useState<"WALK_IN" | "PHONE" | "RECEPTION">("WALK_IN");
  const [primaryPhone, setPrimaryPhone] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [quote, setQuote] = useState<{ id: string; totalAmount: string | number; currency: string } | null>(null);
  const [hold, setHold] = useState<{ id: string; expiresAt: string } | null>(null);
  const [selectedRooms, setSelectedRooms] = useState<Record<string, string>>({});
  const retryKeys = useRef(new Map<string, string>());
  const plans = (snapshot?.ratePlans ?? []).filter((plan) => plan.roomTypeId === roomTypeId);
  const effectivePlan = plans.some((plan) => plan.id === ratePlanId) ? ratePlanId : (plans[0]?.id ?? "");

  const load = useCallback(async () => {
    const response = await fetch(endpoint, { cache: "no-store", credentials: "same-origin" });
    const body = await response.json().catch(() => null);
    if (!response.ok) throw new Error(body?.error || t.error);
    setSnapshot(body as Snapshot);
    setRoomTypeId((value) => body.roomTypes?.some((item: RoomType) => item.id === value) ? value : (body.roomTypes?.[0]?.id ?? ""));
    setRatePlanId((value) => body.ratePlans?.some((item: RatePlan) => item.id === value) ? value : (body.ratePlans?.[0]?.id ?? ""));
  }, [endpoint, t.error]);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => load()).catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : t.error); });
    return () => { active = false; };
  }, [load, t.error]);

  const post = useCallback(async <T,>(payload: Record<string, unknown>): Promise<T> => {
    const body = JSON.stringify(payload);
    const key = retryKeys.current.get(body) ?? idempotencyKey();
    retryKeys.current.set(body, key);
    const response = await fetch(endpoint, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json", "Idempotency-Key": key }, body });
    const result = await response.json().catch(() => null);
    if (!response.ok) throw new Error(result?.error || t.error);
    retryKeys.current.delete(body);
    return result as T;
  }, [endpoint, t.error]);

  const postManual = useCallback(async (payload: Record<string, unknown>) => {
    const body = JSON.stringify(payload);
    const key = retryKeys.current.get(body) ?? idempotencyKey();
    retryKeys.current.set(body, key);
    const response = await fetch(`${endpoint}/manual`, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json", "Idempotency-Key": key }, body });
    const result = await response.json().catch(() => null);
    if (!response.ok) throw new Error(result?.error || t.error);
    retryKeys.current.delete(body);
    return result;
  }, [endpoint, t.error]);

  async function run(action: () => Promise<unknown>, reload = false) {
    setBusy(true); setError("");
    try { await action(); if (reload) await load(); }
    catch (cause) {
      const message = cause instanceof Error ? cause.message : "";
      const lower = message.toLowerCase();
      setError(lower.includes("no inventory") || lower.includes("requested hotel inventory") ? t.noInventory : lower.includes("cancellation policy") ? t.noPolicy : message || t.error);
    }
    finally { setBusy(false); }
  }
  function invalidateQuote() { retryKeys.current.clear(); setQuote(null); setHold(null); }
  function guestsPayload(): Guest[] | null {
    const count = adults + childAges.length;
    const values = Array.from({ length: count }, (_, index) => names[index]?.trim() ?? "");
    if (values.some((name) => !name) || childAges.some(age => age === null)) return null;
    return values.map((fullName, index) => index < adults ? { fullName, isPrimary: index === 0 } : { fullName, isPrimary: false, isChild: true, age: childAges[index - adults] ?? undefined });
  }

  const rtl = locale === "fa" || locale === "ar";
  return <section className="space-y-5 rounded-xl border bg-card p-4 sm:p-6" dir={rtl ? "rtl" : "ltr"} aria-label={t.title}>
    <header className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-xl font-semibold">{t.title}</h1><Button type="button" variant="outline" disabled={busy} onClick={() => void run(load)}>{t.refresh}</Button></header>
    {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
    {mode === "reception" && canConfigure && snapshot?.mode !== "MANUAL" && snapshot?.confirmationPolicy ? <HotelOfflinePolicySettings key={JSON.stringify(snapshot.confirmationPolicy)} organizationId={organizationId} propertyId={propertyId} locale={locale} initialValues={snapshot.confirmationPolicy} apiWired onSaved={() => void run(load)} /> : null}
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <label className="space-y-1 text-sm"><span>{t.dates}</span><Input type="date" value={checkInDate} onChange={(e) => { setCheckInDate(e.target.value); invalidateQuote(); }} /></label>
      <label className="space-y-1 text-sm"><span>{t.checkout}</span><Input type="date" value={checkOutDate} onChange={(e) => { setCheckOutDate(e.target.value); invalidateQuote(); }} /></label>
      <label className="space-y-1 text-sm"><span>{t.room}</span><select className="h-10 w-full rounded-md border bg-background px-3" value={roomTypeId} onChange={(e) => { setRoomTypeId(e.target.value); setRatePlanId(""); invalidateQuote(); }}>{(snapshot?.roomTypes ?? []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label className="space-y-1 text-sm"><span>{t.plan}</span><select className="h-10 w-full rounded-md border bg-background px-3" value={effectivePlan} onChange={(e) => { setRatePlanId(e.target.value); invalidateQuote(); }}>{plans.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label className="space-y-1 text-sm"><span>{t.adults}</span><Input type="number" min={1} max={12} value={adults} onChange={(e) => { setAdults(Math.max(1, Math.min(12, Number(e.target.value) || 1))); invalidateQuote(); }} /></label>
      <label className="space-y-1 text-sm"><span>{t.kids}</span><Input type="number" min={0} max={8} value={childAges.length} onChange={(e) => { const n = Math.max(0, Math.min(8, Number(e.target.value) || 0)); setChildAges((ages) => Array.from({ length: n }, (_, i) => ages[i] ?? null)); invalidateQuote(); }} /></label>
      {childAges.map((age, i) => <label key={i} className="space-y-1 text-sm"><span>{t.age} {i + 1}</span><Input type="number" min={0} max={17} value={age ?? ""} onChange={(e) => { const value = e.target.value === "" ? null : Math.max(0, Math.min(17, Number(e.target.value))); setChildAges((ages) => ages.map((old, j) => i === j ? value : old)); invalidateQuote(); }} /></label>)}
    </div>
    {mode === "reception" && snapshot?.manualRoomManagementEnabled ? <section className="space-y-3 rounded-lg border p-3" aria-label={t.manualTitle}>
      <h2 className="font-semibold">{t.manualTitle}</h2><p className="text-sm text-muted-foreground">{t.manualInfo}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm"><span>{t.roomSelect}</span><select className="h-10 w-full rounded-md border bg-background px-3" value={manualRoomId} onChange={(event) => setManualRoomId(event.target.value)}><option value="" />{(snapshot.rooms ?? []).filter((room) => room.roomTypeId === roomTypeId).map((room) => <option key={room.id} value={room.id}>{room.code}</option>)}</select></label>
        <label className="space-y-1 text-sm"><span>{t.manualSource}</span><select className="h-10 w-full rounded-md border bg-background px-3" value={manualSource} onChange={(event) => setManualSource(event.target.value as typeof manualSource)}><option value="WALK_IN">{t.walkIn}</option><option value="PHONE">{t.phoneSource}</option><option value="RECEPTION">{t.receptionSource}</option></select></label>
        {Array.from({ length: adults + childAges.length }, (_, index) => <label key={index} className="space-y-1 text-sm"><span>{t.guest} {index + 1}</span><Input value={names[index] ?? ""} autoComplete={index === 0 ? "name" : "off"} onChange={(event) => setNames((values) => Array.from({ length: adults + childAges.length }, (_, item) => item === index ? event.target.value : values[item] ?? ""))} /></label>)}
        <label className="space-y-1 text-sm"><span>{t.phone}</span><Input type="tel" inputMode="tel" autoComplete="tel" value={primaryPhone} onChange={(event) => setPrimaryPhone(event.target.value)} /></label>
      </div>
      {!snapshot.rooms.some((room) => room.roomTypeId === roomTypeId) ? <p role="status" className="text-sm text-amber-700">{t.noPhysicalRooms}</p> : null}
      <Button type="button" disabled={busy || !manualRoomId || !checkInDate || !checkOutDate || !roomTypeId || !effectivePlan || childAges.some((age) => age === null) || !guestsPayload()} onClick={() => {
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
    <div className="space-y-3"><h2 className="font-semibold">{t.reservations}</h2>{!snapshot ? <p className="text-sm text-muted-foreground">{t.loading}</p> : snapshot.reservations.length === 0 ? <p className="text-sm text-muted-foreground">{t.empty}</p> : <ul className="space-y-2">{snapshot.reservations.map((item) => {
      const assignedRoomId = item.nights.find((night) => night.roomId)?.roomId ?? "";
      const assigned = snapshot.rooms.find((room) => room.id === assignedRoomId);
      const chosen = selectedRooms[item.id] ?? assignedRoomId;
      return <li key={item.id} className="space-y-2 rounded-lg border p-3"><div className="flex flex-wrap justify-between gap-2"><span className="font-medium"><bdi dir="ltr">{item.reference}</bdi> · {item.status}</span><span className="text-sm"><bdi dir="ltr">{item.checkIn} – {item.checkOut}</bdi> · {item.nights.length} {t.nights}</span></div><p className="text-sm">{t.total}: <bdi dir="ltr">{item.totalAmount} {item.currency}</bdi> · {t.paid}: <bdi dir="ltr">{item.paidAmount}</bdi> · {t.refunded}: <bdi dir="ltr">{item.refundedAmount}</bdi>{item.source ? ` · ${t.source}: ${item.source === "WALK_IN" ? t.walkIn : item.source === "PHONE" ? t.phoneSource : t.receptionSource}` : ""}</p>{item.status === "PENDING_PAYMENT" ? <p className="text-sm text-amber-700">{t.paymentPending}</p> : null}
        {mode === "guest" && item.status === "PENDING_PAYMENT" ? <div className="flex flex-wrap gap-2">{snapshot.confirmationPolicy?.allowedOfflinePaymentMethods.map(method => <Button key={method} size="sm" variant="outline" disabled={busy || item.paymentMethod === method} onClick={() => void run(() => post({ action: "select-payment-method", reservationId: item.id, method }), true)}>{method === "CASH" ? (locale === "fa" ? "نقدی در هتل" : locale === "ar" ? "نقداً في الفندق" : "Cash at hotel") : (locale === "fa" ? "واریز بانکی" : locale === "ar" ? "تحويل بنكي" : "Bank transfer")}{item.paymentMethod === method ? " ✓" : ""}</Button>)}</div> : null}
        <div className="flex flex-wrap items-center gap-2">{mode === "reception" && ["CONFIRMED", "PENDING_PAYMENT"].includes(item.status) ? <><label className="flex items-center gap-2 text-sm"><span>{t.roomSelect}</span><select className="h-9 rounded-md border bg-background px-2" value={chosen} onChange={(e) => { retryKeys.current.clear(); setSelectedRooms((values) => ({ ...values, [item.id]: e.target.value })); }}><option value="" />{snapshot.rooms.map((room) => <option key={room.id} value={room.id}>{room.code}</option>)}</select></label><Button size="sm" variant="outline" disabled={busy || item.status !== "CONFIRMED" || !chosen || chosen === assignedRoomId} onClick={() => void run(() => post({ action: "assign-room", reservationId: item.id, roomId: chosen }), true)}>{t.assign}</Button>{item.status === "PENDING_PAYMENT" ? <Button size="sm" variant="outline" disabled={busy || !item.paymentMethod} onClick={() => void run(() => post({ action: "confirm-reservation", reservationId: item.id }), true)}>{locale === "fa" ? "تأیید رزرو" : locale === "ar" ? "تأكيد الحجز" : "Confirm reservation"}</Button> : null}{item.status === "CONFIRMED" ? <Button size="sm" variant="outline" disabled={busy || !assignedRoomId} onClick={() => void run(() => post({ action: "check-in", reservationId: item.id }), true)}>{t.checkIn}</Button> : null}</> : null}
          {mode === "reception" && item.status === "CHECKED_IN" ? <Button size="sm" variant="outline" disabled={busy} onClick={() => void run(() => post({ action: "check-out", reservationId: item.id }), true)}>{t.checkOut}</Button> : null}
          {["PENDING_PAYMENT", "CONFIRMED"].includes(item.status) ? <Button size="sm" variant="outline" disabled={busy} onClick={() => void run(() => post({ action: "cancel", reservationId: item.id }), true)}>{t.cancel}</Button> : null}
        </div>{assigned ? <p className="text-xs text-muted-foreground">{t.roomSelect}: <bdi dir="ltr">{assigned.code}</bdi></p> : null}
        {mode === "reception" && !item.source ? <HotelOfflinePayments organizationId={organizationId} propertyId={propertyId} reservationId={item.id} locale={locale} apiWired /> : mode !== "reception" && !item.source && item.paymentMethod === "BANK_TRANSFER" ? <HotelGuestOfflinePayment organizationId={organizationId} propertyId={propertyId} reservationId={item.id} locale={locale} /> : null}</li>;
    })}</ul>}</div>
  </section>;
}
