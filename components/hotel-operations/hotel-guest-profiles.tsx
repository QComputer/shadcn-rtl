"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { GuestProfileResponse, GuestProfile } from "@/lib/hotel/domain/guest-profiles";

const copy = {
  fa: { title: "پرونده مستقل مهمان", help: "پرونده فردی مستقل از حساب رزروکننده است. فقط پس از احراز دستی توسط پذیرش، اتصال را تأیید کنید.", inspect: "بررسی پرونده این مهمان", list: "فهرست پرونده‌ها", query: "نام پرونده", name: "نام نمایشی پرونده", noLink: "این مهمان هنوز به پرونده‌ای متصل نیست.", linked: "پرونده متصل", open: "مشاهده پرونده", create: "ایجاد پرونده برای این مهمان", link: "اتصال همین مهمان به پرونده انتخابی", unlink: "قطع اتصال این مهمان", rename: "اصلاح نام پرونده", confirm: "اتصال یا تغییر را بررسی کرده‌ام و تأیید می‌کنم.", empty: "موردی یافت نشد.", failed: "عملیات انجام نشد؛ مجوز، اتصال یا نسخه پرونده را بررسی و دوباره بارگذاری کنید.", saved: "عملیات ثبت شد؛ برای مشاهده سوابق دوباره پرونده را باز کنید.", working: "در حال دریافت…", previous: "صفحه قبل", next: "صفحه بعد", stays: "اقامت‌های متصل به این فرد", readonly: "دسترسی شما فقط خواندنی است.", close: "بستن پرونده" },
  en: { title: "Individual guest profile", help: "A person profile is separate from the booking account. Confirm a link only after manual reception verification.", inspect: "Inspect this guest profile", list: "Find profiles", query: "Profile name", name: "Profile display name", noLink: "This guest is not linked to a profile.", linked: "Linked profile", open: "Open profile", create: "Create profile for this guest", link: "Link this guest to selected profile", unlink: "Unlink this guest", rename: "Rename profile", confirm: "I have reviewed and confirm this link or change.", empty: "No records found.", failed: "Action failed; check permissions, the current link or profile version and reload.", saved: "Action saved; reopen the profile to view stays.", working: "Loading…", previous: "Previous page", next: "Next page", stays: "Stays explicitly linked to this person", readonly: "Your access is read-only.", close: "Close profile" },
  ar: { title: "ملف الضيف الفردي", help: "ملف الشخص مستقل عن حساب الحجز. أكد الربط فقط بعد التحقق اليدوي لدى الاستقبال.", inspect: "فحص ملف هذا الضيف", list: "البحث عن الملفات", query: "اسم الملف", name: "اسم العرض للملف", noLink: "هذا الضيف غير مرتبط بملف.", linked: "الملف المرتبط", open: "عرض الملف", create: "إنشاء ملف لهذا الضيف", link: "ربط هذا الضيف بالملف المحدد", unlink: "إلغاء ربط هذا الضيف", rename: "تعديل اسم الملف", confirm: "راجعت هذا الربط أو التغيير وأؤكده.", empty: "لا توجد نتائج.", failed: "تعذرت العملية؛ تحقق من الصلاحية والربط أو نسخة الملف وأعد التحميل.", saved: "تم الحفظ؛ افتح الملف مجدداً لعرض الإقامات.", working: "جار التحميل…", previous: "الصفحة السابقة", next: "الصفحة التالية", stays: "الإقامات المرتبطة صراحة بهذا الشخص", readonly: "صلاحيتك للقراءة فقط.", close: "إغلاق الملف" },
} as const;
type Anchor = { id: string; fullName: string };
type GuestInfo = Extract<GuestProfileResponse, { kind: "guest" }>;
type List = Extract<GuestProfileResponse, { kind: "list" }>;
type Detail = Extract<GuestProfileResponse, { kind: "detail" }>;

export function HotelGuestProfiles({ endpoint, locale, anchor, onClose, statusLabels }: { endpoint: string; locale: string; anchor: Anchor | null; onClose: () => void; statusLabels: Readonly<Record<string, string>> }) {
  const t = copy[locale as keyof typeof copy] ?? copy.fa;
  const [guest, setGuest] = useState<GuestInfo | null>(null);
  const [list, setList] = useState<List | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [query, setQuery] = useState("");
  const [listQuery, setListQuery] = useState("");
  const [name, setName] = useState(anchor?.fullName ?? "");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [saved, setSaved] = useState(false);
  const pending = useRef(false);
  const canManage = guest?.canManage ?? detail?.canManage ?? list?.canManage ?? false;
  async function request(input: Record<string, unknown>, after: (response: GuestProfileResponse) => void) {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError(false); setSaved(false); setConfirmed(false);
    try {
      const response = await fetch(`${endpoint}/guest-profiles`, { method: "POST", credentials: "same-origin", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
      if (!response.ok) throw new Error("guest profile request failed");
      after(await response.json() as GuestProfileResponse);
    } catch { setError(true); }
    finally { pending.current = false; setBusy(false); }
  }
  function inspect() {
    if (!anchor) return;
    void request({ action: "guest", guestId: anchor.id }, result => { if (result.kind === "guest") { setGuest(result); setDetail(null); setName(result.profile?.displayName ?? result.fullName); } });
  }
  function find(page: number, value: string) {
    void request({ action: "list", query: value, page }, result => { if (result.kind === "list") { setList(result); setListQuery(value); setDetail(null); } });
  }
  function open(profile: GuestProfile, page = 1) {
    void request({ action: "detail", profileId: profile.id, page }, result => { if (result.kind === "detail") { setDetail(result); setName(result.profile.displayName); } });
  }
  function mutate(input: Record<string, unknown>) {
    if (!confirmed || !canManage) return;
    void request({ ...input, confirmed: true }, result => { if (result.kind === "saved") { setSaved(true); setList(null); setDetail(null); setGuest(null); } });
  }
  const formatDate = (value: string) => new Intl.DateTimeFormat(locale === "fa" ? "fa-IR-u-ca-persian" : locale === "ar" ? "ar-u-ca-gregory" : "en-GB", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${value}T12:00:00Z`));
  return <section aria-label={t.title} className="min-w-0 space-y-3 rounded-md border p-3" dir={locale === "en" ? "ltr" : "rtl"}>
    <div className="flex flex-wrap items-center justify-between gap-2"><h4 className="font-semibold">{t.title}</h4><Button type="button" variant="ghost" size="sm" onClick={onClose}>{t.close}</Button></div>
    <p className="text-sm text-muted-foreground">{t.help}</p>
    {anchor ? <div className="space-y-2"><p className="font-medium">{anchor.fullName}</p><Button type="button" variant="outline" disabled={busy} onClick={inspect}>{t.inspect}</Button>{guest ? <p>{guest.profile ? <>{t.linked}: {guest.profile.displayName} <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => open(guest.profile!)}>{t.open}</Button></> : t.noLink}</p> : null}</div> : null}
    <form className="flex flex-wrap items-end gap-2" onSubmit={event => { event.preventDefault(); find(1, query.trim()); }}><label className="flex-1 space-y-1 text-sm">{t.query}<Input value={query} maxLength={160} disabled={busy} onChange={event => setQuery(event.target.value)} /></label><Button type="submit" disabled={busy}>{t.list}</Button></form>
    {list ? <div className="space-y-2">{list.items.length ? list.items.map(profile => <div key={profile.id} className="flex flex-wrap items-center justify-between gap-2 rounded border p-2"><span>{profile.displayName}</span><Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => open(profile)}>{t.open}</Button></div>) : <p>{t.empty}</p>}<div className="flex gap-2"><Button type="button" variant="outline" size="sm" disabled={busy || list.page <= 1} onClick={() => find(list.page - 1, listQuery)}>{t.previous}</Button><Button type="button" variant="outline" size="sm" disabled={busy || !list.hasMore} onClick={() => find(list.page + 1, listQuery)}>{t.next}</Button></div></div> : null}
    {detail ? <div className="space-y-2 rounded border p-2"><h5 className="font-semibold">{detail.profile.displayName}</h5><p className="text-sm">{t.stays}</p>{detail.stays.length ? detail.stays.map(stay => <p key={stay.guestId} className="text-sm"><bdi>{stay.reference}</bdi> · {stay.fullName} · {statusLabels[stay.status] ?? stay.status} · {formatDate(stay.checkIn)} – {formatDate(stay.checkOut)}</p>) : <p>{t.empty}</p>}<div className="flex gap-2"><Button type="button" variant="outline" size="sm" disabled={busy || detail.page <= 1} onClick={() => open(detail.profile, detail.page - 1)}>{t.previous}</Button><Button type="button" variant="outline" size="sm" disabled={busy || !detail.hasMore} onClick={() => open(detail.profile, detail.page + 1)}>{t.next}</Button></div></div> : null}
    {canManage ? <div className="space-y-2 rounded border p-2">{(guest && !guest.profile || detail) ? <label className="block space-y-1 text-sm">{t.name}<Input value={name} maxLength={160} disabled={busy} onChange={event => { setName(event.target.value); setConfirmed(false); }} /></label> : null}<label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={confirmed} disabled={busy} onChange={event => setConfirmed(event.target.checked)} />{t.confirm}</label><div className="flex flex-wrap gap-2">
      {guest && !guest.profile && !detail ? <Button type="button" disabled={busy || !confirmed || !name.trim()} onClick={() => mutate({ action: "create", guestId: guest.guestId, displayName: name })}>{t.create}</Button> : null}
      {guest && !guest.profile && detail ? <Button type="button" disabled={busy || !confirmed} onClick={() => mutate({ action: "link", guestId: guest.guestId, profileId: detail.profile.id })}>{t.link}</Button> : null}
      {guest?.profile ? <Button type="button" variant="outline" disabled={busy || !confirmed} onClick={() => mutate({ action: "unlink", guestId: guest.guestId, profileId: guest.profile!.id })}>{t.unlink}</Button> : null}
      {detail ? <Button type="button" variant="outline" disabled={busy || !confirmed || !name.trim()} onClick={() => mutate({ action: "rename", profileId: detail.profile.id, displayName: name, expectedVersion: detail.profile.version })}>{t.rename}</Button> : null}
    </div></div> : guest || detail || list ? <p className="text-sm">{t.readonly}</p> : null}
    {busy ? <p role="status">{t.working}</p> : null}{error ? <p role="alert">{t.failed}</p> : null}{saved ? <p role="status">{t.saved}</p> : null}
  </section>;
}
