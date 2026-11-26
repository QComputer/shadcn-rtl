"use client";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { HotelJalaliDateField } from "./hotel-jalali-date-field";
import { offsetPropertyDate, receptionDateIssue } from "@/lib/hotel/domain/property-calendar";
import { WAITLIST_STATUSES, waitlistTransitionAllowed, type WaitlistEntry, type WaitlistResponse, type WaitlistStatus } from "@/lib/hotel/domain/reception-waitlist";
const copy = {
  fa: { title: "لیست انتظار", hint: "ثبت درخواست بدون رزرو یا نگه‌داری ظرفیت. تماس با مهمان دستی است؛ برای تکمیل، ابتدا رزرو عادی را ثبت و سپس کد آن را وارد کنید.", name: "نام مهمان", phone: "شماره همراه", type: "نوع اتاق انتظار", arrival: "ورود درخواستی", departure: "خروج درخواستی", adults: "تعداد بزرگسال", children: "سن کودکان (با ویرگول جدا کنید)", create: "ثبت درخواست انتظار", refresh: "بارگذاری درخواست‌ها", empty: "درخواستی یافت نشد", error: "عملیات انجام نشد؛ اطلاعات را بررسی یا فهرست را تازه کنید. در قطع ارتباط همان ثبت را تکرار کنید.", saved: "درخواست ذخیره شد", open: "درخواست‌های باز", prev: "صفحه قبل", next: "صفحه بعد", reference: "کد رزرو تأییدشده", confirm: "تأیید ثبت این تغییر؟", states: { WAITING: "در انتظار", CONTACTED: "تماس انجام شد", BOOKED: "رزرو ثبت شد", CANCELLED: "لغو درخواست", EXPIRED: "منقضی" } },
  en: { title: "Waitlist", hint: "Request only: no booking or inventory hold. Contact guests manually; complete after creating a normal reservation, then enter its reference.", name: "Guest name", phone: "Mobile phone", type: "Requested room type", arrival: "Requested arrival", departure: "Requested departure", adults: "Adults", children: "Child ages (comma separated)", create: "Add waitlist request", refresh: "Load requests", empty: "No requests found", error: "Action failed; check details or reload. If disconnected, retry the same submission.", saved: "Request saved", open: "Open requests", prev: "Previous page", next: "Next page", reference: "Confirmed reservation reference", confirm: "Confirm this change?", states: { WAITING: "Waiting", CONTACTED: "Contacted", BOOKED: "Booked", CANCELLED: "Cancelled", EXPIRED: "Expired" } },
  ar: { title: "قائمة الانتظار", hint: "طلب فقط دون حجز أو تخصيص السعة. اتصل بالضيف يدوياً؛ أكمل بعد إنشاء حجز عادي ثم أدخل مرجعه.", name: "اسم الضيف", phone: "الهاتف المحمول", type: "نوع الغرفة المطلوبة", arrival: "الوصول المطلوب", departure: "المغادرة المطلوبة", adults: "البالغون", children: "أعمار الأطفال (مفصولة بفواصل)", create: "إضافة طلب انتظار", refresh: "تحميل الطلبات", empty: "لا توجد طلبات", error: "فشلت العملية؛ تحقق من البيانات أو أعد التحميل. عند انقطاع الاتصال أعد إرسال الطلب نفسه.", saved: "تم حفظ الطلب", open: "الطلبات المفتوحة", prev: "الصفحة السابقة", next: "الصفحة التالية", reference: "مرجع الحجز المؤكد", confirm: "تأكيد هذا التغيير؟", states: { WAITING: "قيد الانتظار", CONTACTED: "تم الاتصال", BOOKED: "تم الحجز", CANCELLED: "ملغى", EXPIRED: "منتهي" } },
} as const;
function digits(value: string) { return value.replace(/[۰-۹٠-٩]/g, digit => String(digit.charCodeAt(0) - (digit >= "۰" ? 1776 : 1632))); }
function ages(value: string) { const parts = digits(value).trim().split(/[,،]/).map(s => s.trim()); return !value.trim() ? [] : parts.every(s => /^\d{1,2}$/.test(s) && Number(s) <= 17) ? parts.map(Number) : null; }
// Generate only from the submission event; no render-time entropy or insecure fallback.
function newRequestKey() {
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
}
function dateLabel(value: string, locale: string) { return new Intl.DateTimeFormat(locale === "fa" ? "fa-IR-u-ca-persian" : locale === "ar" ? "ar-u-ca-gregory" : "en-GB", { timeZone: "UTC", dateStyle: "medium" }).format(new Date(value + "T12:00:00Z")); }
export function HotelReceptionWaitlist({ endpoint, roomTypes, today, locale }: { endpoint: string; roomTypes: Array<{ id: string; name: string }>; today: string; locale: string }) {
  const t = copy[locale === "en" || locale === "ar" ? locale : "fa"];
  const [open, setOpen] = useState(false), [name, setName] = useState(""), [phone, setPhone] = useState(""), [roomTypeId, setRoomTypeId] = useState(""), [checkIn, setCheckIn] = useState(today), [checkOut, setCheckOut] = useState(offsetPropertyDate(today, 1)), [adults, setAdults] = useState("1"), [children, setChildren] = useState("");
  const [filter, setFilter] = useState<WaitlistStatus | "OPEN">("OPEN"), [result, setResult] = useState<WaitlistResponse | null>(null), [refs, setRefs] = useState<Record<string, string>>({}), [busy, setBusy] = useState(false), [error, setError] = useState(""), [message, setMessage] = useState("");
  const lock = useRef(false), attempt = useRef<{ fingerprint: string; requestKey: string } | null>(null);
  const childAges = ages(children), adultCount = Number(digits(adults));
  const valid = name.trim() && phone.trim() && roomTypes.some(room => room.id === roomTypeId) && !receptionDateIssue(checkIn, checkOut, today) && Number.isInteger(adultCount) && adultCount >= 1 && adultCount <= 30 && childAges !== null && childAges.length <= 20;
  async function call<T>(body: unknown): Promise<T> {
    const response = await fetch(`${endpoint}/waitlist`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), cache: "no-store" });
    if (!response.ok) throw new Error("Waitlist request failed");
    return await response.json() as T;
  }
  async function load(status = filter, page = 1) { setResult(await call<WaitlistResponse>({ action: "list", status, page })); }
  async function run(work: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(""); setMessage("");
    try { await work(); } catch { setError(t.error); } finally { lock.current = false; setBusy(false); }
  }
  async function create() {
    if (!valid || !childAges) return;
    const body = { guestName: name, phone, roomTypeId, checkIn, checkOut, adults: adultCount, childAges }, fingerprint = JSON.stringify(body);
    await run(async () => {
      if (attempt.current?.fingerprint !== fingerprint) attempt.current = { fingerprint, requestKey: newRequestKey() };
      const requestKey = attempt.current.requestKey;
      await call<WaitlistEntry>({ action: "create", ...body, requestKey });
      setName(""); setPhone(""); attempt.current = null; setMessage(t.saved); await load();
    });
  }
  async function transition(item: WaitlistEntry, status: WaitlistStatus) {
    if (!window.confirm(t.confirm)) return;
    await run(async () => { await call<WaitlistEntry>({ action: "transition", id: item.id, expectedVersion: item.version, status, ...(status === "BOOKED" ? { reservationReference: refs[item.id]?.trim(), confirmed: true } : {}) }); setMessage(t.saved); await load(filter, result?.page ?? 1); });
  }
  return <section aria-label={t.title} className="min-w-0 space-y-3 rounded-lg border p-3">
    <Button type="button" variant="outline" aria-expanded={open} disabled={busy} onClick={() => { setOpen(!open); if (!open) void run(() => load()); }}>{t.title}</Button>
    {open ? <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{t.hint}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm"><span>{t.name}</span><Input value={name} maxLength={160} disabled={busy} onChange={e => setName(e.target.value)} /></label>
        <label className="space-y-1 text-sm"><span>{t.phone}</span><Input value={phone} type="tel" maxLength={32} dir="ltr" disabled={busy} onChange={e => setPhone(e.target.value)} /></label>
        <label className="space-y-1 text-sm"><span>{t.type}</span><select className="h-10 w-full rounded-md border bg-background px-3" value={roomTypeId} disabled={busy} onChange={e => setRoomTypeId(e.target.value)}><option value="">—</option>{roomTypes.map(room => <option key={room.id} value={room.id}>{room.name}</option>)}</select></label>
        <HotelJalaliDateField label={t.arrival} value={checkIn} onChange={setCheckIn} today={today} min={today} locale={locale} disabled={busy} />
        <HotelJalaliDateField label={t.departure} value={checkOut} onChange={setCheckOut} today={today} min={today} locale={locale} disabled={busy} />
        <label className="space-y-1 text-sm"><span>{t.adults}</span><Input value={adults} inputMode="numeric" maxLength={2} disabled={busy} onChange={e => setAdults(e.target.value)} /></label>
        <label className="space-y-1 text-sm"><span>{t.children}</span><Input value={children} maxLength={100} disabled={busy} onChange={e => setChildren(e.target.value)} /></label>
      </div>
      <Button type="button" disabled={busy || !valid} onClick={() => void create()}>{t.create}</Button>
      <div className="flex flex-wrap items-center gap-2"><select aria-label={t.open} className="h-10 rounded-md border bg-background px-3" value={filter} disabled={busy} onChange={e => { const value = e.target.value as WaitlistStatus | "OPEN"; setFilter(value); setResult(null); void run(() => load(value)); }}><option value="OPEN">{t.open}</option>{WAITLIST_STATUSES.map(status => <option key={status} value={status}>{t.states[status]}</option>)}</select><Button type="button" variant="outline" disabled={busy} onClick={() => void run(() => load())}>{t.refresh}</Button></div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}{message && <p role="status" className="text-sm">{message}</p>}
      {result?.items.length === 0 && <p className="text-sm">{t.empty}</p>}
      {result?.items.map(item => <article key={item.id} className="space-y-2 rounded-lg border p-3 text-sm">
        <p className="font-medium">{item.guestName} · {t.states[item.status]}</p><p><bdi dir="ltr">{item.phone}</bdi> · {item.roomTypeName}</p><p>{dateLabel(item.checkIn, locale)} – {dateLabel(item.checkOut, locale)} · {t.adults}: {item.adults} · {t.children}: {item.childAges.join(", ") || "—"}</p>
        {item.reservationReference && <p>{t.reference}: <bdi dir="ltr">{item.reservationReference}</bdi></p>}
        {waitlistTransitionAllowed(item.status, "BOOKED", item.checkIn, today) && <label className="block space-y-1"><span>{t.reference}</span><Input value={refs[item.id] ?? ""} maxLength={120} disabled={busy} onChange={e => setRefs(old => ({ ...old, [item.id]: e.target.value }))} /></label>}
        <div className="flex flex-wrap gap-2">{WAITLIST_STATUSES.filter(status => waitlistTransitionAllowed(item.status, status, item.checkIn, today)).map(status => <Button key={status} size="sm" type="button" variant="outline" disabled={busy || (status === "BOOKED" && !refs[item.id]?.trim())} onClick={() => void transition(item, status)}>{t.states[status]}</Button>)}</div>
      </article>)}
      {result && <div className="flex gap-2"><Button type="button" variant="outline" disabled={busy || result.page === 1} onClick={() => void run(() => load(filter, result.page - 1))}>{t.prev}</Button><Button type="button" variant="outline" disabled={busy || !result.hasMore} onClick={() => void run(() => load(filter, result.page + 1))}>{t.next}</Button></div>}
    </div> : null}
  </section>;
}
