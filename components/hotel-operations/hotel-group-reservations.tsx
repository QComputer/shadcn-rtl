"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { HotelJalaliDateField } from "@/components/hotel-operations/hotel-jalali-date-field";
import { distinctGroupRooms, MAX_GROUP_ROOMS, validGroupReference } from "@/lib/hotel/domain/group-reservations";
import { receptionDateIssue, offsetPropertyDate, isPropertyDate } from "@/lib/hotel/domain/property-calendar";
import { reservationActionMessage, receptionDateMessage } from "@/lib/hotel/management/reservation-center-feedback";

type Room = { id: string; code: string; roomTypeId: string };
type RatePlan = { id: string; name: string; roomTypeId: string };
type Draft = { roomId: string; ratePlanId: string; adults: string; children: string };
type Member = { reservationId: string; reference: string; totalAmount: string; currency: string; current?: { status: string; checkIn: string; checkOut: string; totalAmount: string; currency: string } | null };
type Group = { groupReference: string; name: string; checkIn: string; checkOut: string; members: Member[] };
const blank = (): Draft => ({ roomId: "", ratePlanId: "", adults: "", children: "" });
const lines = (text: string) => text.split(/\r?\n/).map(value => value.trim()).filter(Boolean);
const copy = {
  fa: { title: "رزرو گروهی", name: "نام گروه", arrival: "ورود گروه", departure: "خروج گروه", room: "اتاق گروه", plan: "طرح نرخ گروه", adults: "نام بزرگسالان (هر نفر یک خط)", children: "کودکان (اختیاری؛ هر خط نام | سن)", add: "افزودن اتاق", remove: "حذف آخرین اتاق", create: "ثبت همه اتاق‌های گروه", reset: "گروه جدید", recent: "آخرین گروه‌ها", lookup: "کد کامل گروه", search: "یافتن گروه", saved: "گروه ثبت شد", error: "عملیات گروه انجام نشد؛ در صورت قطع ارتباط، همان درخواست را دوباره ارسال کنید.", hint: "۲ تا ۸ اتاق با تاریخ مشترک؛ هر اتاق نرخ و مهمانان مستقل دارد. همه اتاق‌ها با نرخ معتبر زمان ثبت، بدون پرداخت ثبت می‌شوند یا هیچ‌کدام ثبت نمی‌شوند.", refreshError: "گروه ثبت شد، اما تازه‌سازی رزروها ناموفق بود؛ صفحه را تازه کنید.", missing: "رزرو در دسترس نیست", empty: "گروهی پیدا نشد", original: "بازه اولیه گروه", current: "وضعیت فعلی", searchInvalid: "کد کامل گروه را وارد کنید", select: "انتخاب کنید", source: "ثبت پذیرش" },
  en: { title: "Group reservations", name: "Group name", arrival: "Group arrival", departure: "Group departure", room: "Group room", plan: "Group rate plan", adults: "Adult names (one per line)", children: "Children (optional; one name | age per line)", add: "Add room", remove: "Remove last room", create: "Book all group rooms", reset: "New group", recent: "Recent groups", lookup: "Full group reference", search: "Find group", saved: "Group saved", error: "Group operation failed; if the connection was lost, retry the same request.", hint: "2–8 rooms with shared dates; each room has its own rate and guests. All rooms are booked unpaid at the valid rates when saved, or none are booked.", refreshError: "Group saved, but reservations could not refresh; reload the page.", missing: "Reservation unavailable", empty: "No groups found", original: "Original group dates", current: "Current status", searchInvalid: "Enter the full group reference", select: "Select", source: "Reception" },
  ar: { title: "حجوزات المجموعات", name: "اسم المجموعة", arrival: "وصول المجموعة", departure: "مغادرة المجموعة", room: "غرفة المجموعة", plan: "خطة سعر المجموعة", adults: "أسماء البالغين (اسم في كل سطر)", children: "الأطفال (اختياري؛ الاسم | العمر في كل سطر)", add: "إضافة غرفة", remove: "إزالة آخر غرفة", create: "حجز جميع غرف المجموعة", reset: "مجموعة جديدة", recent: "المجموعات الأخيرة", lookup: "رمز المجموعة الكامل", search: "البحث عن المجموعة", saved: "تم تسجيل المجموعة", error: "فشلت العملية؛ عند انقطاع الاتصال أعد إرسال الطلب نفسه.", hint: "٢ إلى ٨ غرف بتواريخ مشتركة؛ لكل غرفة سعر وضيوف مستقلون. تحجز جميع الغرف دون دفع بالسعر الساري عند الحفظ أو لا تحجز أي غرفة.", refreshError: "تم الحجز وتعذر تحديث القائمة؛ أعد تحميل الصفحة.", missing: "الحجز غير متاح", empty: "لا توجد مجموعات", original: "تواريخ المجموعة الأصلية", current: "الحالة الحالية", searchInvalid: "أدخل رمز المجموعة الكامل", select: "اختر", source: "الاستقبال" },
} as const;
function guestPayload(draft: Draft) {
  const adults = lines(draft.adults);
  const children = lines(draft.children).map(line => {
    const parts = line.split("|").map(item => item.trim());
    const ageText = (parts[1] ?? "").replace(/[۰-۹٠-٩]/g, digit => String(digit.charCodeAt(0) - (digit >= "۰" ? 1776 : 1632)));
    return { fullName: parts[0], age: /^\d{1,2}$/.test(ageText) && parts.length === 2 ? Number(ageText) : -1 };
  });
  if (!adults.length || adults.length > 30 || children.length > 20 || adults.some(name => name.length > 150) || children.some(child => !child.fullName || child.fullName.length > 150 || child.age < 0 || child.age > 17)) return null;
  return { adults: adults.length, childAges: children.map(child => child.age), guests: [...adults.map((fullName, index) => ({ fullName, isPrimary: index === 0, isChild: false })), ...children.map(child => ({ ...child, isPrimary: false, isChild: true }))] };
}
export function HotelGroupReservations({ endpoint, rooms, plans, today, locale, statusLabels, onCreated }: { endpoint: string; rooms: Room[]; plans: RatePlan[]; today: string; locale: string; statusLabels: Record<string, string>; onCreated: () => Promise<void> }) {
  const t = copy[locale === "en" || locale === "ar" ? locale : "fa"];
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [checkIn, setCheckIn] = useState(today);
  const [checkOut, setCheckOut] = useState(offsetPropertyDate(today, 1));
  const [drafts, setDrafts] = useState<Draft[]>([blank(), blank()]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState<Group | null>(null);
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [reference, setReference] = useState("");
  const inFlight = useRef(false);
  const attempts = useRef(new Map<string, string>());
  const dateIssue = receptionDateIssue(checkIn, checkOut, today);
  const roomPayload = drafts.map(draft => {
    const room = rooms.find(item => item.id === draft.roomId);
    const guests = guestPayload(draft);
    return room && guests && plans.some(plan => plan.id === draft.ratePlanId && plan.roomTypeId === room.roomTypeId) ? { roomId: room.id, roomTypeId: room.roomTypeId, ratePlanId: draft.ratePlanId, source: "RECEPTION", ...guests } : null;
  });
  const valid = Boolean(name.trim() && name.trim().length <= 120 && !dateIssue && roomPayload.every(Boolean) && distinctGroupRooms(drafts));
  const change = (index: number, patch: Partial<Draft>) => setDrafts(current => current.map((draft, i) => i === index ? { ...draft, ...patch } : draft));
  async function load(referenceValue?: string) {
    const response = await fetch(`${endpoint}/groups${referenceValue ? `?reference=${encodeURIComponent(referenceValue)}` : ""}`, { cache: "no-store", credentials: "same-origin" });
    if (!response.ok) throw new Error(t.error);
    const body = await response.json() as { groups: Group[] };
    setGroups(body.groups);
  }
  async function browse(value?: string) {
    if (inFlight.current) return;
    if (value !== undefined && !validGroupReference(value)) { setError(t.searchInvalid); return; }
    inFlight.current = true; setBusy(true); setError("");
    try { await load(value); } catch { setError(t.error); }
    finally { inFlight.current = false; setBusy(false); }
  }
  async function submit() {
    if (!valid || saved || inFlight.current) return;
    inFlight.current = true; setBusy(true); setError("");
    const body = JSON.stringify({ name: name.trim(), checkIn, checkOut, rooms: roomPayload });
    const key = attempts.current.get(body) ?? (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`);
    attempts.current.set(body, key);
    try {
      const response = await fetch(`${endpoint}/groups`, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json", "Idempotency-Key": key }, body });
      const data = await response.json().catch(() => null);
      if (!response.ok) { setError(reservationActionMessage(typeof data?.error === "string" ? data.error : "", locale, t.error, response.status)); return; }
      setSaved(data as Group);
      try { await onCreated(); await load(data.groupReference); } catch { setError(t.refreshError); }
    } catch { setError(t.error); }
    finally { inFlight.current = false; setBusy(false); }
  }
  return <section className="min-w-0 space-y-3 rounded-lg border p-3" aria-label={t.title}>
    <Button type="button" variant="outline" aria-expanded={open} disabled={busy} onClick={() => { setOpen(!open); if (!open) void browse(); }}>{t.title}</Button>
    {open ? <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{t.hint}</p>
      <label className="block space-y-1 text-sm">{t.name}<Input value={name} maxLength={120} disabled={busy || Boolean(saved)} onChange={event => setName(event.target.value)} /></label>
      <div className="grid gap-2 sm:grid-cols-2"><HotelJalaliDateField label={t.arrival} value={checkIn} onChange={setCheckIn} today={today} locale={locale} min={today} disabled={busy || Boolean(saved)} /><HotelJalaliDateField label={t.departure} value={checkOut} onChange={setCheckOut} today={today} locale={locale} min={isPropertyDate(checkIn) ? offsetPropertyDate(checkIn, 1) : today} disabled={busy || Boolean(saved)} /></div>
      {dateIssue ? <p className="text-sm text-destructive">{receptionDateMessage(dateIssue, locale)}</p> : null}
      {drafts.map((draft, index) => <fieldset key={index} disabled={busy || Boolean(saved)} className="min-w-0 space-y-2 rounded-md border p-3">
        <legend className="px-1 text-sm font-medium">{t.room} {index + 1}</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="space-y-1 text-sm">{t.room} {index + 1}<select className="h-10 w-full rounded-md border bg-background px-2" value={draft.roomId} onChange={event => change(index, { roomId: event.target.value, ratePlanId: "" })}><option value="">{t.select}</option>{rooms.filter(room => room.id === draft.roomId || !drafts.some(other => other.roomId === room.id)).map(room => <option key={room.id} value={room.id}>{room.code}</option>)}</select></label>
          <label className="space-y-1 text-sm">{t.plan} {index + 1}<select className="h-10 w-full rounded-md border bg-background px-2" value={draft.ratePlanId} onChange={event => change(index, { ratePlanId: event.target.value })}><option value="">{t.select}</option>{plans.filter(plan => plan.roomTypeId === rooms.find(room => room.id === draft.roomId)?.roomTypeId).map(plan => <option key={plan.id} value={plan.id}>{plan.name}</option>)}</select></label>
        </div>
        <label className="block space-y-1 text-sm">{t.adults} {index + 1}<textarea className="w-full rounded-md border bg-background p-2" rows={2} maxLength={4500} value={draft.adults} onChange={event => change(index, { adults: event.target.value })}/></label>
        <label className="block space-y-1 text-sm">{t.children} {index + 1}<textarea className="w-full rounded-md border bg-background p-2" rows={2} maxLength={3200} value={draft.children} onChange={event => change(index, { children: event.target.value })}/></label>
      </fieldset>)}
      <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" disabled={busy || Boolean(saved) || drafts.length >= Math.min(MAX_GROUP_ROOMS, rooms.length)} onClick={() => setDrafts(current => [...current, blank()])}>{t.add}</Button><Button type="button" variant="outline" disabled={busy || Boolean(saved) || drafts.length <= 2} onClick={() => setDrafts(current => current.slice(0, -1))}>{t.remove}</Button><Button type="button" disabled={busy || !valid || Boolean(saved)} onClick={() => void submit()}>{t.create}</Button>{saved ? <Button type="button" variant="outline" disabled={busy} onClick={() => { attempts.current.clear(); setSaved(null); setName(""); setDrafts([blank(), blank()]); setError(""); }}>{t.reset}</Button> : null}</div>
      {saved ? <p role="status" className="text-sm font-medium">{t.saved}: <bdi>{saved.groupReference}</bdi></p> : null}
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      <div className="flex flex-wrap items-end gap-2"><label className="min-w-0 flex-1 text-sm">{t.lookup}<Input value={reference} maxLength={39} onChange={event => setReference(event.target.value)} /></label><Button type="button" variant="outline" disabled={busy} onClick={() => void browse(reference.trim().toUpperCase())}>{t.search}</Button><Button type="button" variant="outline" disabled={busy} onClick={() => void browse()}>{t.recent}</Button></div>
      {groups?.length === 0 ? <p className="text-sm">{t.empty}</p> : null}
      {groups?.map(group => <article key={group.groupReference} className="space-y-1 rounded-md border p-3"><h3 className="font-medium">{group.name} · <bdi>{group.groupReference}</bdi></h3><p className="text-xs text-muted-foreground">{t.original}: <bdi>{group.checkIn} – {group.checkOut}</bdi></p><ul className="space-y-1 text-sm">{group.members.map(member => <li key={member.reservationId}><bdi>{member.reference}</bdi> · {member.current ? <>{statusLabels[member.current.status] ?? member.current.status} · <bdi>{member.current.checkIn} – {member.current.checkOut} · {member.current.totalAmount} {member.current.currency}</bdi></> : t.missing}</li>)}</ul></article>)}
    </div> : null}
  </section>;
}
