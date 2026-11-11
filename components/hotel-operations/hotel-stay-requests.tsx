"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type RoomType = { id: string; name: string };
type RatePlan = { id: string; name: string; roomTypeId: string };
type Stay = { checkIn: string; checkOut: string; adults: number; childAges: Array<number | null> };
type Quote = Stay & { id: string; totalAmount: string; currency: string; policyVersion: number; expiresAt: string };
type StayRequest = { id: string; status: string; guestName: string; message?: string | null; snapshot: { checkIn: string; checkOut: string; adults: number; childAges: number[]; totalAmount: string; currency: string }; createdAt: string };
type Snapshot = { enabled: boolean; mode: "DISABLED" | "REQUEST_ONLY" | "RESERVATION"; view: "guest" | "reception"; roomTypes: RoomType[]; ratePlans: RatePlan[]; requests: StayRequest[] };

const copy = {
  fa: { title: "درخواست هماهنگی اقامت", badge: "درخواست به‌معنای رزرو قطعی یا پرداخت نیست.", dates: "ورود", departure: "خروج", room: "گروه اتاق", plan: "طرح نرخ", adults: "بزرگسالان", children: "تعداد کودکان", age: "سن کودک", quote: "دریافت برآورد", guestName: "نام مهمان", message: "پیام برای پذیرش (اختیاری)", submit: "ارسال درخواست هماهنگی", requests: "درخواست‌ها", none: "درخواستی ثبت نشده است.", cancel: "لغو درخواست", contacted: "علامت‌گذاری تماس انجام شد", decline: "رد درخواست", amount: "برآورد نمایشی", policy: "نسخه شرایط", expires: "اعتبار تا", status: "وضعیت", created: "ثبت‌شده", refresh: "بارگذاری دوباره", working: "در حال انجام…", error: "عملیات انجام نشد.", required: "نام مهمان را وارد کنید.", simulation: "اطلاعات برآوردشده توسط سامانه؛ منتظر بررسی پذیرش", ages: "برای هر کودک سن معتبر ۰ تا ۱۷ وارد کنید." },
  en: { title: "Stay coordination requests", badge: "A request is not a confirmed booking or payment.", dates: "Check-in", departure: "Check-out", room: "Room type", plan: "Rate plan", adults: "Adults", children: "Number of children", age: "Child age", quote: "Get estimate", guestName: "Guest name", message: "Message for reception (optional)", submit: "Send coordination request", requests: "Requests", none: "No requests yet.", cancel: "Cancel request", contacted: "Mark contacted", decline: "Decline request", amount: "Display estimate", policy: "Policy version", expires: "Valid until", status: "Status", created: "Created", refresh: "Reload", working: "Working…", error: "Operation failed.", required: "Enter the guest name.", simulation: "System estimate; pending reception review", ages: "Enter a valid age from 0 to 17 for each child." },
  ar: { title: "طلبات تنسيق الإقامة", badge: "الطلب لا يعني تأكيد الحجز أو الدفع.", dates: "الوصول", departure: "المغادرة", room: "نوع الغرفة", plan: "خطة السعر", adults: "البالغون", children: "عدد الأطفال", age: "عمر الطفل", quote: "الحصول على تقدير", guestName: "اسم الضيف", message: "رسالة إلى الاستقبال (اختياري)", submit: "إرسال طلب التنسيق", requests: "الطلبات", none: "لا توجد طلبات بعد.", cancel: "إلغاء الطلب", contacted: "تم التواصل", decline: "رفض الطلب", amount: "التقدير المعروض", policy: "إصدار السياسة", expires: "صالح حتى", status: "الحالة", created: "تاريخ الإنشاء", refresh: "إعادة التحميل", working: "جارٍ التنفيذ…", error: "فشلت العملية.", required: "أدخل اسم الضيف.", simulation: "تقدير النظام؛ بانتظار مراجعة الاستقبال", ages: "أدخل عمراً صحيحاً من 0 إلى 17 لكل طفل." },
} as const;

function idempotencyKey() { return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`; }

export function HotelStayRequests({ organizationId, propertyId, locale, initialStay }: { organizationId: string; propertyId: string; locale: string; initialStay: Stay }) {
  const t = copy[locale as keyof typeof copy] ?? copy.fa;
  const endpoint = useMemo(() => `/api/organizations/${encodeURIComponent(organizationId)}/hotels/${encodeURIComponent(propertyId)}/stay-requests`, [organizationId, propertyId]);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [checkIn, setCheckIn] = useState(initialStay.checkIn);
  const [checkOut, setCheckOut] = useState(initialStay.checkOut);
  const [adults, setAdults] = useState(String(initialStay.adults));
  const [childAges, setChildAges] = useState<number[]>(initialStay.childAges);
  const [roomTypeId, setRoomTypeId] = useState("");
  const [ratePlanId, setRatePlanId] = useState("");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [guestName, setGuestName] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const pendingKeys = useRef(new Map<string, string>());
  const plans = (snapshot?.ratePlans ?? []).filter((plan) => plan.roomTypeId === roomTypeId);
  const effectivePlan = plans.some((plan) => plan.id === ratePlanId) ? ratePlanId : (plans[0]?.id ?? "");

  const load = useCallback(async () => {
    const response = await fetch(endpoint, { method: "GET", cache: "no-store", credentials: "same-origin" });
    const body = await response.json().catch(() => null);
    if (!response.ok) throw new Error(body?.error || t.error);
    if (body?.enabled !== true) { setSnapshot({ enabled: false, mode: "DISABLED", view: "guest", roomTypes: [], ratePlans: [], requests: [] }); return; }
    setSnapshot(body as Snapshot);
    setRoomTypeId((current) => body.roomTypes.some((item: RoomType) => item.id === current) ? current : (body.roomTypes[0]?.id ?? ""));
    setRatePlanId((current) => body.ratePlans.some((item: RatePlan) => item.id === current) ? current : "");
  }, [endpoint, t.error]);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => load()).catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : t.error); });
    return () => { active = false; };
  }, [load, t.error]);

  const mutate = useCallback(async <T,>(payload: Record<string, unknown>): Promise<T> => {
    const bodyText = JSON.stringify(payload);
    const key = pendingKeys.current.get(bodyText) ?? idempotencyKey();
    pendingKeys.current.set(bodyText, key);
    const response = await fetch(endpoint, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json", "Idempotency-Key": key }, body: bodyText });
    const body = await response.json().catch(() => null);
    if (!response.ok) throw new Error(body?.error || t.error);
    pendingKeys.current.delete(bodyText);
    return body as T;
  }, [endpoint, t.error]);

  async function run(action: () => Promise<unknown>, success?: string) {
    setBusy(true); setError(""); setNotice("");
    try { await action(); if (success) setNotice(success); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : t.error); }
    finally { setBusy(false); }
  }

  function criteria() { return { action: "quote", roomTypeId, ratePlanId: effectivePlan, checkIn, checkOut, adults: Number(adults), childAges: childAges.filter((age): age is number => age !== null) }; }

  if (snapshot?.enabled === false || snapshot?.mode === "DISABLED") return null;
  const isGuest = snapshot?.view === "guest";
  const canQuote = !!checkIn && !!checkOut && !!roomTypeId && !!effectivePlan && Number(adults) >= 1 && childAges.every((age) => age !== null && Number.isInteger(age) && age >= 0 && age <= 17);

  return <section dir={locale === "fa" || locale === "ar" ? "rtl" : "ltr"} aria-label={t.title} className="space-y-4 rounded-xl border bg-card p-4">
    <header className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="text-lg font-semibold">{t.title}</h2><p className="text-xs text-muted-foreground">{t.badge}</p></div><Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void run(load)}>{t.refresh}</Button></header>
    {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}{notice ? <p role="status" className="text-sm text-green-700">{notice}</p> : null}
    {isGuest ? <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="space-y-1 text-sm"><span>{t.dates}</span><Input type="date" value={checkIn} onChange={(e) => { setCheckIn(e.target.value); setQuote(null); }} /></label>
        <label className="space-y-1 text-sm"><span>{t.departure}</span><Input type="date" value={checkOut} onChange={(e) => { setCheckOut(e.target.value); setQuote(null); }} /></label>
        <label className="space-y-1 text-sm"><span>{t.room}</span><select className="h-10 w-full rounded-md border bg-background px-3" value={roomTypeId} onChange={(e) => { const value = e.target.value; setRoomTypeId(value); setRatePlanId(""); setQuote(null); }}>{(snapshot?.roomTypes ?? []).map((room) => <option key={room.id} value={room.id}>{room.name}</option>)}</select></label>
        <label className="space-y-1 text-sm"><span>{t.plan}</span><select className="h-10 w-full rounded-md border bg-background px-3" value={effectivePlan} disabled={!plans.length} onChange={(e) => { setRatePlanId(e.target.value); setQuote(null); }}>{plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name}</option>)}</select></label>
        <label className="space-y-1 text-sm"><span>{t.adults}</span><Input type="number" min={1} max={12} value={adults} onChange={(e) => { setAdults(e.target.value); setQuote(null); }} /></label>
        <label className="space-y-1 text-sm"><span>{t.children}</span><Input type="number" min={0} max={8} value={childAges.length} onChange={(e) => { const count = Math.max(0, Math.min(8, Number(e.target.value) || 0)); setChildAges((current) => Array.from({ length: count }, (_, i) => current[i] ?? null)); setQuote(null); }} /></label>
        {childAges.map((age, index) => <label key={index} className="space-y-1 text-sm"><span>{t.age} {index + 1}</span><Input type="number" min={0} max={17} value={age ?? ""} onChange={(e) => { const value = e.target.value === "" ? null : Number(e.target.value); setChildAges((current) => current.map((item, i) => i === index ? value : item)); setQuote(null); }} /></label>)}
      </div>
      <Button type="button" disabled={busy || !canQuote} onClick={() => void run(async () => { const result = await mutate<{ quote: Quote }>(criteria()); setQuote(result.quote); })}>{busy ? t.working : t.quote}</Button>
      {quote ? <div className="space-y-3 rounded-lg border p-3"><p className="text-sm">{t.amount}: <bdi dir="ltr">{quote.totalAmount} {quote.currency}</bdi></p><p className="text-xs text-muted-foreground">{t.policy}: {quote.policyVersion} · {t.expires}: <bdi dir="ltr">{quote.expiresAt}</bdi> · {t.simulation}</p>
        <label className="block space-y-1 text-sm"><span>{t.guestName}</span><Input autoComplete="name" value={guestName} onChange={(e) => setGuestName(e.target.value)} /></label>
        <label className="block space-y-1 text-sm"><span>{t.message}</span><textarea className="min-h-20 w-full rounded-md border bg-background p-2" maxLength={1000} value={message} onChange={(e) => setMessage(e.target.value)} /></label>
        <Button type="button" disabled={busy || guestName.trim().length < 2} onClick={() => void run(() => mutate({ action: "request", quoteId: quote.id, guestName: guestName.trim(), ...(message.trim() ? { message: message.trim() } : {}) }), t.badge)}>{busy ? t.working : t.submit}</Button>
      </div> : null}
    </div> : null}
    <div className="space-y-2"><h3 className="font-semibold">{t.requests}</h3>{!snapshot?.requests.length ? <p className="text-sm text-muted-foreground">{t.none}</p> : <ul className="space-y-2">{snapshot.requests.map((request) => <li key={request.id} className="space-y-2 rounded-lg border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2"><strong>{request.guestName} · {request.status}</strong><span className="text-xs text-muted-foreground">{t.created}: <bdi dir="ltr">{request.createdAt}</bdi></span></div>
      <p className="text-sm"><bdi dir="ltr">{request.snapshot.checkIn} – {request.snapshot.checkOut}</bdi> · {request.snapshot.adults} {t.adults}{request.snapshot.childAges.length ? ` · ${t.children}: ${request.snapshot.childAges.join(", ")}` : ""} · <bdi dir="ltr">{request.snapshot.totalAmount} {request.snapshot.currency}</bdi></p>
      {request.message ? <p className="text-sm">{request.message}</p> : null}
      <span className="block text-xs text-muted-foreground">{t.simulation}</span>
      <div className="flex flex-wrap gap-2">{isGuest ? <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void run(() => mutate({ action: "cancel-request", requestId: request.id }))}>{t.cancel}</Button> : <><Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void run(() => mutate({ action: "review-request", requestId: request.id, status: "CONTACTED" }))}>{t.contacted}</Button><Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void run(() => mutate({ action: "review-request", requestId: request.id, status: "DECLINED" }))}>{t.decline}</Button></>}</div>
    </li>)}</ul>}</div>
  </section>;
}
