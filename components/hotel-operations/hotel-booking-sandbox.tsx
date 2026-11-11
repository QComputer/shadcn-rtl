"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type RoomType = { id: string; name: string };
type RatePlan = { id: string; roomTypeId: string; name: string };
type PhysicalRoom = { id: string; roomTypeId: string; code: string };
type Reservation = { id: string; reference: string; status: string; checkIn: string; checkOut: string; totalAmount: string; currency: string; roomTypeId: string; assignedRoomId: string | null; simulated: true };
type Quote = { id: string; checkIn: string; checkOut: string; totalAmount: string; currency: string; expiresAt: string; policyVersion: number };
type Hold = { id: string; reference: string; expiresAt: string };
type Snapshot = { enabled: boolean; roomTypes: RoomType[]; ratePlans: RatePlan[]; reservations: Reservation[]; rooms?: PhysicalRoom[] };
type Guest = { fullName: string; isPrimary: boolean; isChild?: boolean; age?: number };

const copy = {
  fa: {
    title: "رزرو آزمایشی هتل", badge: "محیط شبیه‌سازی؛ بدون پرداخت واقعی", loading: "در حال بررسی دسترسی رزرو…", disabled: "",
    dates: "تاریخ ورود", departure: "تاریخ خروج", room: "نوع اتاق", plan: "طرح نرخ", adults: "بزرگسالان", children: "کودکان", childAge: "سن کودک", search: "بررسی ظرفیت", quote: "محاسبه قیمت", hold: "ایجاد نگه‌داری موقت", guests: "نام مهمانان", guestName: "نام کامل مهمان", reserve: "ثبت رزرو آزمایشی", pay: "شبیه‌سازی پرداخت", success: "موفق", failed: "ناموفق", expired: "منقضی", bookings: "رزروها", noBookings: "رزروی ثبت نشده است.", cancel: "لغو رزرو", checkIn: "پذیرش ورود", checkOut: "ثبت خروج", assignRoom: "تخصیص اتاق", physicalRoom: "اتاق فیزیکی", selectPhysicalRoom: "انتخاب اتاق", available: "ظرفیت موجود است", unavailable: "ظرفیت موجود نیست", remaining: "اتاق باقی‌مانده", total: "مبلغ نمایشی", expires: "انقضا", status: "وضعیت", reference: "کد پیگیری", refresh: "بارگذاری دوباره", working: "در حال انجام…", error: "عملیات انجام نشد.", childrenAgeHelp: "برای هر کودک سن وارد کنید.", guestRequired: "نام همه مهمانان را وارد کنید.", simulated: "شبیه‌سازی‌شده", refundable: "مبلغ قابل بازگشت", retained: "مبلغ کسرشده", cancelReason: "دلیل", policy: "نسخه شرایط", searchFirst: "ابتدا ظرفیت را بررسی کنید.", holdRequired: "برای رزرو، نگه‌داری موقت فعال لازم است.",
  },
  en: {
    title: "Hotel booking sandbox", badge: "Simulation only · no real payment", loading: "Checking booking access…", disabled: "",
    dates: "Check-in", departure: "Check-out", room: "Room type", plan: "Rate plan", adults: "Adults", children: "Children", childAge: "Child age", search: "Search availability", quote: "Get quote", hold: "Create temporary hold", guests: "Guest names", guestName: "Guest full name", reserve: "Create simulated reservation", pay: "Simulate payment", success: "Success", failed: "Failed", expired: "Expired", bookings: "Reservations", noBookings: "No reservations yet.", cancel: "Cancel reservation", checkIn: "Check in", checkOut: "Check out", assignRoom: "Assign room", physicalRoom: "Physical room", selectPhysicalRoom: "Select a room", available: "Available", unavailable: "Unavailable", remaining: "Rooms remaining", total: "Display total", expires: "Expires", status: "Status", reference: "Reference", refresh: "Reload", working: "Working…", error: "Operation failed.", childrenAgeHelp: "Enter one age for each child.", guestRequired: "Enter every guest name.", simulated: "Simulated", refundable: "Refundable amount", retained: "Retained amount", cancelReason: "Reason", policy: "Policy version", searchFirst: "Search availability first.", holdRequired: "An active temporary hold is required.",
  },
  ar: {
    title: "حجز فندقي تجريبي", badge: "محاكاة فقط · دون دفع حقيقي", loading: "جارٍ التحقق من صلاحية الحجز…", disabled: "",
    dates: "تاريخ الوصول", departure: "تاريخ المغادرة", room: "نوع الغرفة", plan: "خطة السعر", adults: "البالغون", children: "الأطفال", childAge: "عمر الطفل", search: "البحث عن التوفر", quote: "عرض السعر", hold: "إنشاء حجز مؤقت", guests: "أسماء الضيوف", guestName: "الاسم الكامل للضيف", reserve: "إنشاء حجز تجريبي", pay: "محاكاة الدفع", success: "ناجح", failed: "فاشل", expired: "منتهي", bookings: "الحجوزات", noBookings: "لا توجد حجوزات بعد.", cancel: "إلغاء الحجز", checkIn: "تسجيل الوصول", checkOut: "تسجيل المغادرة", assignRoom: "تخصيص الغرفة", physicalRoom: "الغرفة الفعلية", selectPhysicalRoom: "اختر غرفة", available: "متاح", unavailable: "غير متاح", remaining: "الغرف المتبقية", total: "الإجمالي المعروض", expires: "ينتهي", status: "الحالة", reference: "المرجع", refresh: "إعادة التحميل", working: "جارٍ التنفيذ…", error: "فشلت العملية.", childrenAgeHelp: "أدخل عمرًا لكل طفل.", guestRequired: "أدخل أسماء جميع الضيوف.", simulated: "محاكاة", refundable: "المبلغ المسترد", retained: "المبلغ المحتفظ به", cancelReason: "السبب", policy: "إصدار السياسة", searchFirst: "ابحث عن التوفر أولاً.", holdRequired: "يلزم وجود حجز مؤقت نشط.",
  },
} as const;

function makeKey() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function HotelBookingSandbox({ organizationId, propertyId, locale, mode = "reception" }: {
  organizationId: string; propertyId: string; locale: string; mode?: "reception" | "guest";
}) {
  const t = copy[locale as keyof typeof copy] ?? copy.fa;
  const endpoint = useMemo(() => `/api/organizations/${encodeURIComponent(organizationId)}/hotels/${encodeURIComponent(propertyId)}/sandbox-booking`, [organizationId, propertyId]);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [adults, setAdults] = useState("1");
  const [childAges, setChildAges] = useState<number[]>([]);
  const [roomTypeId, setRoomTypeId] = useState("");
  const [ratePlanId, setRatePlanId] = useState("");
  const [availability, setAvailability] = useState<{ available: boolean; remaining: number } | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [hold, setHold] = useState<Hold | null>(null);
  const [guestNames, setGuestNames] = useState<string[]>([""]);
  const [selectedRoomIds, setSelectedRoomIds] = useState<Record<string, string>>({});
  const pendingKeys = useRef(new Map<string, string>());
  const plans = (snapshot?.ratePlans ?? []).filter((item) => item.roomTypeId === roomTypeId);
  const effectiveRatePlanId = plans.some((item) => item.id === ratePlanId) ? ratePlanId : (plans[0]?.id ?? "");

  const load = useCallback(async () => {
    const response = await fetch(endpoint, { method: "GET", cache: "no-store", credentials: "same-origin" });
    const body = await response.json().catch(() => null);
    if (!response.ok) throw new Error(body?.error || t.error);
    if (body?.enabled !== true) { setSnapshot({ enabled: false, roomTypes: [], ratePlans: [], reservations: [] }); return; }
    setSnapshot(body as Snapshot);
    setRoomTypeId((current) => body.roomTypes.some((item: RoomType) => item.id === current) ? current : (body.roomTypes[0]?.id ?? ""));
    setRatePlanId((current) => body.ratePlans.some((item: RatePlan) => item.id === current) ? current : (body.ratePlans[0]?.id ?? ""));
  }, [endpoint, t.error]);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => load()).catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : t.error); })
      .finally(() => { if (active) setChecking(false); });
    return () => { active = false; };
  }, [load, t.error]);

  const mutate = useCallback(async <T,>(payload: Record<string, unknown>): Promise<T> => {
    const signature = JSON.stringify(payload);
    const key = pendingKeys.current.get(signature) ?? makeKey();
    pendingKeys.current.set(signature, key);
    const response = await fetch(endpoint, {
      method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json", "Idempotency-Key": key }, body: signature,
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) throw new Error(body?.error || t.error);
    pendingKeys.current.delete(signature);
    return body as T;
  }, [endpoint, t.error]);

  async function run<T,>(action: () => Promise<T>, after?: (result: T) => void | Promise<void>) {
    setBusy(true); setError(""); setNotice("");
    try { const result = await action(); await after?.(result); }
    catch (cause) { setError(cause instanceof Error ? cause.message : t.error); }
    finally { setBusy(false); }
  }

  function criteria(action: "search" | "quote") {
    return { action, roomTypeId, ratePlanId: effectiveRatePlanId, checkIn, checkOut, adults: Number(adults), childAges };
  }

  function guestPayload(): Guest[] | null {
    const count = Number(adults) + childAges.length;
    const names = Array.from({ length: count }, (_, index) => guestNames[index]?.trim() ?? "");
    if (names.some((name) => !name)) return null;
    const guests = names.map((fullName, index) => index < Number(adults)
      ? { fullName, isPrimary: index === 0 }
      : { fullName, isPrimary: false, isChild: true, age: childAges[index - Number(adults)] });
    if (guests.length !== count || guests.filter((guest) => guest.isPrimary).length !== 1 ||
      guests.filter((guest) => guest.isChild).length !== childAges.length) return null;
    return guests;
  }

  async function search() {
    if (!checkIn || !checkOut || !roomTypeId || !effectiveRatePlanId || Number(adults) < 1) return;
    setAvailability(null); setQuote(null); setHold(null);
    await run(() => mutate<{ available: boolean; remaining: number }>(criteria("search")), setAvailability);
  }

  async function getQuote() {
    await run(() => mutate<{ quote: Quote }>(criteria("quote")), (result) => { setQuote(result.quote); setHold(null); });
  }

  async function createHold() {
    if (!quote) return;
    await run(() => mutate<{ hold: Hold }>({ action: "hold", quoteId: quote.id }), (result) => setHold(result.hold));
  }

  async function reserve() {
    if (!quote || !hold) { setError(t.holdRequired); return; }
    const guests = guestPayload();
    if (!guests) { setError(t.guestRequired); return; }
    await run(() => mutate<{ reservation: Reservation }>({ action: "reserve", quoteId: quote.id, holdId: hold.id, guests }), async (result) => {
      setNotice(`${t.reference}: ${result.reservation.reference} · ${t.simulated}`); setQuote(null); setHold(null); await load();
    });
  }

  async function pay(reservationId: string, outcome: "SUCCESS" | "FAILED" | "EXPIRED") {
    await run(() => mutate<{ payment: { status: string } }>({ action: "pay", reservationId, outcome }), async (result) => { setNotice(`${t.simulated}: ${result.payment.status || outcome}`); await load(); });
  }

  async function reservationAction(action: "cancel" | "check-in" | "check-out", reservationId: string) {
    await run(() => mutate<{ cancellation?: { refundableAmount: number | string; retainedAmount: number | string; reason: string } }>({ action, reservationId }), async (result) => {
      const cancellation = result.cancellation;
      if (cancellation) setNotice(`${t.refundable}: ${cancellation.refundableAmount} · ${t.retained}: ${cancellation.retainedAmount} · ${t.cancelReason}: ${cancellation.reason}`);
      await load();
    });
  }

  async function assignRoom(reservationId: string, roomId: string) {
    if (!roomId) return;
    await run(() => mutate({ action: "assign-room", reservationId, roomId }), async () => {
      setSelectedRoomIds((current) => ({ ...current, [reservationId]: roomId }));
      await load();
    });
  }

  if (checking) return null;
  if (error && !snapshot?.enabled) return <p role="alert" className="text-sm text-destructive">{error}</p>;
  if (!snapshot?.enabled) return null;
  const guestCount = Math.max(1, Number(adults) + childAges.length || 1);
  const guestError = !!error && error === t.guestRequired;

  return <section className="space-y-4 rounded-xl border border-dashed border-primary/50 bg-card p-4" dir={locale === "fa" || locale === "ar" ? "rtl" : "ltr"} aria-label={t.title}>
    <header className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="text-lg font-semibold">{t.title}</h2><p className="text-xs text-muted-foreground">{t.badge}</p></div><Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void run(load)}>{t.refresh}</Button></header>
    {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
    {notice ? <p role="status" className="text-sm text-green-700">{notice}</p> : null}

    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <label className="space-y-1 text-sm"><span>{t.dates}</span><Input type="date" value={checkIn} onChange={(event) => { setCheckIn(event.target.value); setAvailability(null); setQuote(null); setHold(null); }} /></label>
      <label className="space-y-1 text-sm"><span>{t.departure}</span><Input type="date" value={checkOut} onChange={(event) => { setCheckOut(event.target.value); setAvailability(null); setQuote(null); setHold(null); }} /></label>
      <label className="space-y-1 text-sm"><span>{t.room}</span><select className="h-10 w-full rounded-md border bg-background px-3" value={roomTypeId} onChange={(event) => { const nextRoomTypeId = event.target.value; setRoomTypeId(nextRoomTypeId); setRatePlanId(snapshot.ratePlans.find((plan) => plan.roomTypeId === nextRoomTypeId)?.id ?? ""); setAvailability(null); setQuote(null); setHold(null); }}>{snapshot.roomTypes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label className="space-y-1 text-sm"><span>{t.plan}</span><select className="h-10 w-full rounded-md border bg-background px-3" value={effectiveRatePlanId} disabled={plans.length === 0} onChange={(event) => { setRatePlanId(event.target.value); setAvailability(null); setQuote(null); setHold(null); }}>{plans.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label className="space-y-1 text-sm"><span>{t.adults}</span><Input type="number" min={1} max={12} value={adults} onChange={(event) => { const value = event.target.value; setAdults(value); setGuestNames((current) => current.slice(0, Math.max(1, Number(value) + childAges.length))); setAvailability(null); setQuote(null); setHold(null); }} /></label>
      <label className="space-y-1 text-sm"><span>{t.children}</span><Input type="number" min={0} max={8} value={childAges.length} onChange={(event) => { const count = Math.max(0, Math.min(8, Number(event.target.value) || 0)); setChildAges((current) => Array.from({ length: count }, (_, index) => current[index] ?? 0)); setGuestNames((current) => current.slice(0, Math.max(1, Number(adults) + count))); setAvailability(null); setQuote(null); setHold(null); }} /></label>
      {childAges.map((age, index) => <label key={`child-age-${index}`} className="space-y-1 text-sm"><span>{t.childAge} {index + 1}</span><Input type="number" min={0} max={17} value={age} onChange={(event) => { const value = Math.max(0, Math.min(17, Number(event.target.value) || 0)); setChildAges((current) => current.map((entry, childIndex) => childIndex === index ? value : entry)); setAvailability(null); setQuote(null); setHold(null); }} /></label>)}
    </div>
    {childAges.length ? <p className="text-xs text-muted-foreground">{t.childrenAgeHelp}</p> : null}
    <div className="flex flex-wrap gap-2"><Button type="button" disabled={busy || !checkIn || !checkOut || !roomTypeId || !effectiveRatePlanId || Number(adults) < 1} onClick={() => void search()}>{busy ? t.working : t.search}</Button>{availability?.available ? <Button type="button" variant="outline" disabled={busy} onClick={() => void getQuote()}>{t.quote}</Button> : null}</div>
    {availability ? <p role="status" className="text-sm">{availability.available ? t.available : t.unavailable}{availability.available ? ` · ${t.remaining}: ${availability.remaining}` : ""}</p> : null}
    {quote ? <div className="space-y-3 rounded-lg border p-3"><p className="text-sm">{t.total}: <bdi dir="ltr">{quote.totalAmount} {quote.currency}</bdi></p><p className="text-xs text-muted-foreground">{t.policy}: {quote.policyVersion} · {t.expires}: <bdi dir="ltr">{quote.expiresAt}</bdi></p><div className="flex flex-wrap gap-2"><Button type="button" variant="outline" disabled={busy || !!hold} onClick={() => void createHold()}>{t.hold}</Button></div>
      {hold ? <div className="space-y-3 border-t pt-3"><p className="text-sm">{t.reference}: <bdi dir="ltr">{hold.reference}</bdi> · {t.expires}: <bdi dir="ltr">{hold.expiresAt}</bdi></p><h3 className="font-medium">{t.guests}</h3><div className="grid gap-2 sm:grid-cols-2">{Array.from({ length: guestCount }, (_, index) => <label key={`guest-${index}`} className="space-y-1 text-sm"><span>{t.guestName} {index + 1}</span><Input autoComplete={index === 0 ? "name" : "off"} value={guestNames[index] ?? ""} onChange={(event) => setGuestNames((current) => Array.from({ length: guestCount }, (_, guestIndex) => guestIndex === index ? event.target.value : current[guestIndex] ?? ""))} aria-invalid={guestError} /></label>)}</div><Button type="button" disabled={busy || guestNames.slice(0, guestCount).length !== guestCount || guestNames.slice(0, guestCount).some((name) => !name.trim())} onClick={() => void reserve()}>{t.reserve}</Button></div> : null}
    </div> : null}

    <div className="space-y-2">
      <h3 className="font-semibold">{t.bookings}</h3>
      {snapshot.reservations.length === 0 ? <p className="text-sm text-muted-foreground">{t.noBookings}</p> : <ul className="space-y-2">
        {snapshot.reservations.map((item) => {
          const rooms = mode === "reception" ? (snapshot.rooms ?? []).filter((room) => room.roomTypeId === item.roomTypeId) : [];
          const selectedRoomId = selectedRoomIds[item.id] ?? item.assignedRoomId ?? "";
          const assignedRoom = rooms.find((room) => room.id === item.assignedRoomId);
          return <li key={item.id} className="space-y-2 rounded-lg border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium"><bdi dir="ltr">{item.reference}</bdi> · {item.status}</span>
              <span className="text-sm"><bdi dir="ltr">{item.checkIn} – {item.checkOut}</bdi> · <bdi dir="ltr">{item.totalAmount} {item.currency}</bdi></span>
            </div>
            <span className="block text-xs text-muted-foreground">{t.simulated}</span>
            {mode === "reception" && item.assignedRoomId ? <p className="text-sm">{t.physicalRoom}: <bdi dir="ltr">{assignedRoom?.code ?? item.assignedRoomId}</bdi></p> : null}
            <div className="flex flex-wrap gap-2">
              {item.status === "PENDING_PAYMENT" ? <>
                <Button type="button" size="sm" disabled={busy} onClick={() => void pay(item.id, "SUCCESS")}>{t.pay}: {t.success}</Button>
                <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void pay(item.id, "FAILED")}>{t.failed}</Button>
                <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void pay(item.id, "EXPIRED")}>{t.expired}</Button>
              </> : null}
              {["CONFIRMED", "PENDING_PAYMENT"].includes(item.status) ? <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void reservationAction("cancel", item.id)}>{t.cancel}</Button> : null}
              {mode === "reception" && item.status === "CONFIRMED" ? <>
                <label className="flex items-center gap-2 text-sm">
                  <span>{t.physicalRoom}</span>
                  <select className="h-9 rounded-md border bg-background px-2" value={selectedRoomId} onChange={(event) => setSelectedRoomIds((current) => ({ ...current, [item.id]: event.target.value }))}>
                    <option value="">{t.selectPhysicalRoom}</option>
                    {rooms.map((room) => <option key={room.id} value={room.id}>{room.code}</option>)}
                  </select>
                </label>
                <Button type="button" size="sm" variant="outline" disabled={busy || !selectedRoomId || selectedRoomId === item.assignedRoomId} onClick={() => void assignRoom(item.id, selectedRoomId)}>{t.assignRoom}</Button>
                <Button type="button" size="sm" variant="outline" disabled={busy || !item.assignedRoomId} onClick={() => void reservationAction("check-in", item.id)}>{t.checkIn}</Button>
              </> : null}
              {mode === "reception" && item.status === "CHECKED_IN" ? <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void reservationAction("check-out", item.id)}>{t.checkOut}</Button> : null}
            </div>
          </li>;
        })}
      </ul>}
    </div>
  </section>;
}
