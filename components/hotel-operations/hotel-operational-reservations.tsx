"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type RoomType = { id: string; name: string };
type RatePlan = { id: string; name: string; roomTypeId: string };
type Room = { id: string; code: string; roomTypeId: string };
type Reservation = { id: string; reference: string; status: string; checkIn: string; checkOut: string; totalAmount: string | number; currency: string; paidAmount: string | number; refundedAmount: string | number; nights: { roomId: string | null }[] };
type Snapshot = { mode: string; view: string; roomTypes: RoomType[]; ratePlans: RatePlan[]; reservations: Reservation[]; rooms: Room[] };
type PaymentRequest = { publicId: string; purpose: string; status: string; amountToman: string; currency: string; simulated: boolean; settlementStatus: string | null; reconciliationRequired: boolean; reconcilable: boolean };
type Guest = { fullName: string; isPrimary: boolean; isChild?: boolean; age?: number };

  const labels = {
  fa: { title: "رزروهای هتل", dates: "تاریخ ورود", checkout: "تاریخ خروج", room: "نوع اتاق", plan: "طرح نرخ", adults: "بزرگسالان", kids: "کودکان", age: "سن کودک", guests: "نام مهمانان", guest: "نام کامل مهمان", quote: "دریافت قیمت", quoteRequest: "قیمت‌گذاری این درخواست", hold: "نگه‌داری موقت", reserve: "ثبت رزرو", reservations: "رزروها", refresh: "بارگذاری دوباره", empty: "رزروی وجود ندارد.", reference: "کد پیگیری", status: "وضعیت", total: "مبلغ", paid: "پرداخت‌شده", refunded: "بازپرداخت‌شده", outstanding: "باقی‌مانده", simulate: "شبیه‌سازی", simulated: "شبیه‌سازی‌شده", requestPayment: "درخواست پرداخت", reconcilePayment: "تأیید پرداخت", requestRefund: "درخواست بازپرداخت", refundStatus: "وضعیت بازپرداخت", assign: "تخصیص اتاق", roomSelect: "اتاق فیزیکی", checkIn: "ثبت ورود", checkOut: "ثبت خروج", cancel: "لغو رزرو", loading: "در حال بارگذاری…", working: "در حال انجام…", paymentPending: "در انتظار پرداخت؛ پرداخت هنوز تأیید نشده است.", unmatchedPayment: "پرداخت نزد سرویس‌دهنده تأیید شده اما به این رزرو تخصیص نیافته است؛ بررسی دستی/بازپرداخت لازم است.", error: "انجام عملیات ناموفق بود.", guestError: "نام همه مهمانان را وارد کنید.", holdExpires: "انقضای نگه‌داری", nights: "شب‌ها" },
  en: { title: "Hotel reservations", dates: "Check-in", checkout: "Check-out", room: "Room type", plan: "Rate plan", adults: "Adults", kids: "Children", age: "Child age", guests: "Guest names", guest: "Guest full name", quote: "Get quote", quoteRequest: "Quote this request", hold: "Place temporary hold", reserve: "Create reservation", reservations: "Reservations", refresh: "Refresh", empty: "No reservations.", reference: "Reference", status: "Status", total: "Total", paid: "Paid", refunded: "Refunded", outstanding: "Outstanding", simulate: "Simulate", simulated: "SIMULATED", requestPayment: "Request Payment", reconcilePayment: "Reconcile Payment", requestRefund: "Request Refund", refundStatus: "Refund Status", assign: "Assign room", roomSelect: "Physical room", checkIn: "Check in", checkOut: "Check out", cancel: "Cancel reservation", loading: "Loading…", working: "Working…", paymentPending: "Payment pending; payment has not been confirmed.", unmatchedPayment: "Provider confirmed payment, but it was not allocated to this reservation. Manual reconciliation or refund is required.", error: "The action failed.", guestError: "Enter every guest name.", holdExpires: "Hold expires", nights: "Nights" },
  ar: { title: "حجوزات الفندق", dates: "تاريخ الوصول", checkout: "تاريخ المغادرة", room: "نوع الغرفة", plan: "خطة السعر", adults: "البالغون", kids: "الأطفال", age: "عمر الطفل", guests: "أسماء الضيوف", guest: "الاسم الكامل للضيف", quote: "طلب السعر", quoteRequest: "تسعير هذا الطلب", hold: "حجز مؤقت", reserve: "إنشاء الحجز", reservations: "الحجوزات", refresh: "تحديث", empty: "لا توجد حجوزات.", reference: "المرجع", status: "الحالة", total: "الإجمالي", paid: "المدفوع", refunded: "المسترد", outstanding: "الباقي", simulate: "محاكاة", simulated: "محاكاة", requestPayment: "طلب الدفع", reconcilePayment: "تأكيد الدفع", requestRefund: "طلب الاسترداد", refundStatus: "حالة الاسترداد", assign: "تخصيص الغرفة", roomSelect: "الغرفة الفعلية", checkIn: "تسجيل الوصول", checkOut: "تسجيل المغادرة", cancel: "إلغاء الحجز", loading: "جارٍ التحميل…", working: "جارٍ التنفيذ…", paymentPending: "الدفع قيد الانتظار؛ لم يتم تأكيد الدفع.", unmatchedPayment: "أكد مزود الدفع العملية لكنها لم تُخصص لهذا الحجز؛ يلزم التحقق اليدوي أو الاسترداد.", error: "فشلت العملية.", guestError: "أدخل أسماء جميع الضيوف.", holdExpires: "انتهاء الحجز المؤقت", nights: "الليالي" },
} as const;

function idempotencyKey() { return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`; }

export function HotelOperationalReservations({ organizationId, propertyId, locale, mode = "reception", initialStay, requestId }: { organizationId: string; propertyId: string; locale: string; mode?: "guest" | "reception"; initialStay?: { checkIn: string; checkOut: string; adults: number; childAges: Array<number | null> }; requestId?: string }) {
  const t = labels[locale as keyof typeof labels] ?? labels.fa;
  const endpoint = useMemo(() => `/api/organizations/${encodeURIComponent(organizationId)}/hotels/${encodeURIComponent(propertyId)}/reservations`, [organizationId, propertyId]);
  const paymentsEndpoint = useCallback((resId: string) => `/api/organizations/${encodeURIComponent(organizationId)}/hotels/${encodeURIComponent(propertyId)}/reservations/${encodeURIComponent(resId)}/payments`, [organizationId, propertyId]);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [paymentRequests, setPaymentRequests] = useState<Record<string, PaymentRequest[]>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [checkInDate, setCheckInDate] = useState(initialStay?.checkIn ?? "");
  const [checkOutDate, setCheckOutDate] = useState(initialStay?.checkOut ?? "");
  const [adults, setAdults] = useState(initialStay?.adults ?? 2);
  const [childAges, setChildAges] = useState<Array<number | null>>(initialStay?.childAges ?? []);
  const [roomTypeId, setRoomTypeId] = useState("");
  const [ratePlanId, setRatePlanId] = useState("");
  const [names, setNames] = useState<string[]>([""]);
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
    const payments = await Promise.all((body.reservations ?? []).map(async (reservation: Reservation) => {
      const paymentResponse = await fetch(`/api/organizations/${encodeURIComponent(organizationId)}/hotels/${encodeURIComponent(propertyId)}/reservations/${encodeURIComponent(reservation.id)}/payments`, { cache: "no-store", credentials: "same-origin" });
      const paymentBody = await paymentResponse.json().catch(() => null);
      if (!paymentResponse.ok) throw new Error(paymentBody?.error || t.error);
      return [reservation.id, paymentBody.requests as PaymentRequest[]] as const;
    }));
    setPaymentRequests(Object.fromEntries(payments));
    setRoomTypeId((value) => body.roomTypes?.some((item: RoomType) => item.id === value) ? value : (body.roomTypes?.[0]?.id ?? ""));
    setRatePlanId((value) => body.ratePlans?.some((item: RatePlan) => item.id === value) ? value : (body.ratePlans?.[0]?.id ?? ""));
  }, [endpoint, organizationId, propertyId, t.error]);

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

  const postPayment = useCallback(async (reservationId: string, payload: Record<string, unknown>): Promise<unknown> => {
    const url = paymentsEndpoint(reservationId);
    const body = JSON.stringify(payload);
    const key = idempotencyKey();
    const response = await fetch(url, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json", "Idempotency-Key": key }, body });
    const result = await response.json().catch(() => null);
    if (!response.ok) throw new Error(result?.error || t.error);
    return result;
  }, [paymentsEndpoint, t.error]);

  async function run(action: () => Promise<unknown>, reload = false) {
    setBusy(true); setError("");
    try { await action(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : t.error); }
    finally {
      if (reload) try { await load(); } catch (cause) { setError(cause instanceof Error ? cause.message : t.error); }
      setBusy(false);
    }
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
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <label className="space-y-1 text-sm"><span>{t.dates}</span><Input type="date" value={checkInDate} onChange={(e) => { setCheckInDate(e.target.value); invalidateQuote(); }} /></label>
      <label className="space-y-1 text-sm"><span>{t.checkout}</span><Input type="date" value={checkOutDate} onChange={(e) => { setCheckOutDate(e.target.value); invalidateQuote(); }} /></label>
      <label className="space-y-1 text-sm"><span>{t.room}</span><select className="h-10 w-full rounded-md border bg-background px-3" value={roomTypeId} onChange={(e) => { setRoomTypeId(e.target.value); setRatePlanId(""); invalidateQuote(); }}>{(snapshot?.roomTypes ?? []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label className="space-y-1 text-sm"><span>{t.plan}</span><select className="h-10 w-full rounded-md border bg-background px-3" value={effectivePlan} onChange={(e) => { setRatePlanId(e.target.value); invalidateQuote(); }}>{plans.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label className="space-y-1 text-sm"><span>{t.adults}</span><Input type="number" min={1} max={12} value={adults} onChange={(e) => { setAdults(Math.max(1, Math.min(12, Number(e.target.value) || 1))); invalidateQuote(); }} /></label>
      <label className="space-y-1 text-sm"><span>{t.kids}</span><Input type="number" min={0} max={8} value={childAges.length} onChange={(e) => { const n = Math.max(0, Math.min(8, Number(e.target.value) || 0)); setChildAges((ages) => Array.from({ length: n }, (_, i) => ages[i] ?? null)); invalidateQuote(); }} /></label>
      {childAges.map((age, i) => <label key={i} className="space-y-1 text-sm"><span>{t.age} {i + 1}</span><Input type="number" min={0} max={17} value={age ?? ""} onChange={(e) => { const value = e.target.value === "" ? null : Math.max(0, Math.min(17, Number(e.target.value))); setChildAges((ages) => ages.map((old, j) => i === j ? value : old)); invalidateQuote(); }} /></label>)}
    </div>
    {quote ? <div className="space-y-3 rounded-lg border p-3"><p>{t.total}: <bdi dir="ltr">{quote.totalAmount} {quote.currency}</bdi></p>{!hold ? <Button disabled={busy} onClick={() => void run(() => post<{ hold: { id: string; expiresAt: string } }>({ action: "hold", quoteId: quote.id }).then((result) => setHold(result.hold)))}>{busy ? t.working : t.hold}</Button> : <>
      <p className="text-sm">{t.holdExpires}: <bdi dir="ltr">{hold.expiresAt}</bdi></p><h2 className="font-medium">{t.guests}</h2>
      <div className="grid gap-2 sm:grid-cols-2">{Array.from({ length: adults + childAges.length }, (_, i) => <label key={i} className="space-y-1 text-sm"><span>{t.guest} {i + 1}</span><Input value={names[i] ?? ""} autoComplete={i === 0 ? "name" : "off"} onChange={(e) => { retryKeys.current.clear(); setNames((values) => Array.from({ length: adults + childAges.length }, (_, j) => i === j ? e.target.value : values[j] ?? "")); }} /></label>)}</div>
      <Button disabled={busy || !guestsPayload()} onClick={() => { const guests = guestsPayload(); if (!guests) { setError(t.guestError); return; } void run(() => post({ action: "reserve", quoteId: quote.id, holdId: hold.id, guests }).then(() => { setQuote(null); setHold(null); }), true); }}>{busy ? t.working : t.reserve}</Button>
    </>}</div> : <Button disabled={busy || (requestId ? false : !checkInDate || !checkOutDate || !roomTypeId || !effectivePlan || childAges.some(age => age === null))} onClick={() => void run(() => post<{ quote: { id: string; totalAmount: string | number; currency: string; checkIn: string; checkOut: string; adults: number; childAges: number[]; roomTypeId: string; ratePlanId: string } }>(requestId ? { action: "quote-request", requestId } : { action: "quote", roomTypeId, ratePlanId: effectivePlan, checkIn: checkInDate, checkOut: checkOutDate, adults, childAges }).then((result) => { setQuote(result.quote); setCheckInDate(result.quote.checkIn); setCheckOutDate(result.quote.checkOut); setAdults(result.quote.adults); setChildAges(result.quote.childAges); setRoomTypeId(result.quote.roomTypeId); setRatePlanId(result.quote.ratePlanId); }))}>{busy ? t.working : requestId ? t.quoteRequest : t.quote}</Button>}
    <div className="space-y-3"><h2 className="font-semibold">{t.reservations}</h2>{!snapshot ? <p className="text-sm text-muted-foreground">{t.loading}</p> : snapshot.reservations.length === 0 ? <p className="text-sm text-muted-foreground">{t.empty}</p> : <ul className="space-y-2">{snapshot.reservations.map((item) => {
      const assignedRoomId = item.nights.find((night) => night.roomId)?.roomId ?? "";
      const assigned = snapshot.rooms.find((room) => room.id === assignedRoomId);
      const chosen = selectedRooms[item.id] ?? assignedRoomId;
      const requests = paymentRequests[item.id] ?? [];
      const balancePayment = requests.find((request) => request.purpose === "RESERVATION_BALANCE");
      const refundPayment = requests.find((request) => request.purpose === "RESERVATION_REFUND");
      const unresolvedRefund = refundPayment && !["PAID", "FAILED", "EXPIRED", "CANCELLED"].includes(refundPayment.status);
      return <li key={item.id} className="space-y-2 rounded-lg border p-3"><div className="flex flex-wrap justify-between gap-2"><span className="font-medium"><bdi dir="ltr">{item.reference}</bdi> · {item.status}</span><span className="text-sm"><bdi dir="ltr">{item.checkIn} – {item.checkOut}</bdi> · {item.nights.length} {t.nights}</span></div>      <p className="text-sm">{t.total}: <bdi dir="ltr">{item.totalAmount} {item.currency}</bdi> · {t.paid}: <bdi dir="ltr">{item.paidAmount}</bdi> · {t.refunded}: <bdi dir="ltr">{item.refundedAmount}</bdi> · {t.outstanding}: <bdi dir="ltr">{String(BigInt(item.totalAmount) - BigInt(item.paidAmount))} {item.currency}</bdi></p>{balancePayment ? <p className="text-sm">{t.requestPayment}: <bdi dir="ltr">{balancePayment.status} · {balancePayment.amountToman} {balancePayment.currency}</bdi>{balancePayment.simulated ? <strong className="ms-2 text-amber-700">{t.simulated}</strong> : null}{balancePayment.reconciliationRequired ? <strong className="ms-2 text-amber-700">{t.unmatchedPayment}</strong> : null}</p> : null}{refundPayment ? <p className="text-sm">{t.refundStatus}: <bdi dir="ltr">{refundPayment.status} · {refundPayment.amountToman} {refundPayment.currency}</bdi>{refundPayment.simulated ? <strong className="ms-2 text-amber-700">{t.simulated}</strong> : null}</p> : null}{item.status === "PENDING_PAYMENT" ? <p className="text-sm text-amber-700">{t.paymentPending}</p> : null}
        <div className="flex flex-wrap items-center gap-2">{mode === "reception" && ["CONFIRMED", "PENDING_PAYMENT"].includes(item.status) ? <><label className="flex items-center gap-2 text-sm"><span>{t.roomSelect}</span><select className="h-9 rounded-md border bg-background px-2" value={chosen} onChange={(e) => { retryKeys.current.clear(); setSelectedRooms((values) => ({ ...values, [item.id]: e.target.value })); }}><option value="" />{snapshot.rooms.map((room) => <option key={room.id} value={room.id}>{room.code}</option>)}</select></label><Button size="sm" variant="outline" disabled={busy || !chosen || chosen === assignedRoomId} onClick={() => void run(() => post({ action: "assign-room", reservationId: item.id, roomId: chosen }), true)}>{t.assign}</Button>{item.status === "CONFIRMED" ? <Button size="sm" variant="outline" disabled={busy || !assignedRoomId} onClick={() => void run(() => post({ action: "check-in", reservationId: item.id }), true)}>{t.checkIn}</Button> : null}</> : null}{item.status === "PENDING_PAYMENT" && !balancePayment && BigInt(item.paidAmount) === BigInt(0) ? <Button size="sm" variant="outline" disabled={busy} onClick={() => void run(() => postPayment(item.id, { action: "create-payment", reservationId: item.id }), true)}>{t.requestPayment}</Button> : null}{mode === "reception" && balancePayment?.reconcilable && ["CREATED", "AWAITING_CUSTOMER", "PENDING_VERIFICATION"].includes(balancePayment.status) ? <Button size="sm" variant="outline" disabled={busy} onClick={() => void run(() => postPayment(item.id, { action: "reconcile-payment", reservationId: item.id, paymentRequestPublicId: balancePayment.publicId }), true)}>{t.reconcilePayment}</Button> : null}{mode === "reception" && item.status === "CHECKED_IN" ? <Button size="sm" variant="outline" disabled={busy} onClick={() => void run(() => post({ action: "check-out", reservationId: item.id }), true)}>{t.checkOut}</Button> : null}{mode === "reception" && ["CANCELLED", "NO_SHOW"].includes(item.status) && BigInt(item.paidAmount) > BigInt(item.refundedAmount) && !unresolvedRefund ? <Button size="sm" variant="outline" disabled={busy} onClick={() => void run(() => postPayment(item.id, { action: "request-refund", reservationId: item.id, paymentRequestPublicId: balancePayment?.publicId ?? "" }), true)}>{t.requestRefund}</Button> : null}{mode === "reception" && unresolvedRefund && refundPayment.reconcilable ? <Button size="sm" variant="outline" disabled={busy} onClick={() => void run(() => postPayment(item.id, { action: "reconcile-refund", reservationId: item.id, paymentRequestPublicId: refundPayment.publicId }), true)}>{t.reconcilePayment}</Button> : null}{["PENDING_PAYMENT", "CONFIRMED"].includes(item.status) ? <Button size="sm" variant="outline" disabled={busy} onClick={() => void run(() => post({ action: "cancel", reservationId: item.id }), true)}>{t.cancel}</Button> : null}
        </div>{assigned ? <p className="text-xs text-muted-foreground">{t.roomSelect}: <bdi dir="ltr">{assigned.code}</bdi></p> : null}</li>;
    })}</ul>}</div>
  </section>;
}
