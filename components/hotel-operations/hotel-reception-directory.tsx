"use client";

import { useId, useRef, useState } from "react";
import { HotelGuestProfiles } from "./hotel-guest-profiles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ReceptionDirectoryResult, ReceptionDirectoryRow } from "@/lib/hotel/domain/reception-directory";

const copy = {
  fa: { title: "جست‌وجوی کل سوابق هتل", query: "نام، همراه، کد رزرو یا اتاق در کل سوابق", phone: "شماره همراه دقیق", text: "نام یا کد", phoneMode: "تلفن", submit: "جست‌وجوی سوابق", help: "نتایج خواندنی و محدود به همین هتل هستند؛ شامل رزروهای قدیمی نیز می‌شوند.", failed: "جست‌وجوی سوابق انجام نشد.", empty: "موردی یافت نشد.", previous: "صفحه قبل", next: "صفحه بعد", history: "سوابق مرتبط", account: "سوابق با شناسه مشتری مشترک؛ لزوماً یک شخص نیستند.", contact: "سوابق با شماره تماس اصلی مشترک؛ این تطبیق، تأیید هویت نیست.", single: "پیوند هویتی قابل اتکا ثبت نشده است؛ فقط همین رزرو نمایش داده می‌شود.", limit: "برای ادامه، عبارت جست‌وجو را دقیق‌تر کنید.", back: "بازگشت به نتایج جست‌وجو", primary: "اصلی", child: "کودک", dates: "اقامت", rooms: "اتاق", status: "وضعیت", page: "صفحه", working: "در حال دریافت…" },
  en: { title: "Search all property records", query: "Guest, companion, reference or room across all records", phone: "Exact mobile number", text: "Name or code", phoneMode: "Phone", submit: "Search records", help: "Read-only results for this property, including older reservations.", failed: "Unable to load reservation records.", empty: "No records found.", previous: "Previous page", next: "Next page", history: "Related stays", account: "Shared linked customer account; not necessarily the same person.", contact: "Shared primary contact number; this is not identity verification.", single: "No reliable identity link is recorded; only this reservation is shown.", limit: "Refine your search to see further results.", back: "Back to search results", primary: "Primary", child: "Child", dates: "Stay", rooms: "Rooms", status: "Status", page: "Page", working: "Loading…" },
  ar: { title: "البحث في جميع سجلات الفندق", query: "اسم الضيف أو المرافق أو المرجع أو الغرفة في جميع السجلات", phone: "رقم الهاتف المحمول الكامل", text: "الاسم أو الرمز", phoneMode: "الهاتف", submit: "البحث في السجلات", help: "نتائج للقراءة فقط لهذا الفندق، بما فيها الحجوزات القديمة.", failed: "تعذر تحميل سجلات الحجوزات.", empty: "لا توجد نتائج.", previous: "الصفحة السابقة", next: "الصفحة التالية", history: "الإقامات المرتبطة", account: "حساب عميل مشترك؛ ليس بالضرورة الشخص نفسه.", contact: "رقم اتصال رئيسي مشترك؛ لا يعد ذلك تحققاً من الهوية.", single: "لا يوجد ربط موثوق للهوية؛ يظهر هذا الحجز فقط.", limit: "حدد عبارة البحث بدقة أكبر.", back: "العودة إلى نتائج البحث", primary: "رئيسي", child: "طفل", dates: "الإقامة", rooms: "الغرف", status: "الحالة", page: "صفحة", working: "جار التحميل…" },
} as const;
type Query = { action: "search" | "phone"; query: string; page: number } | { action: "history"; reservationId: string; page: number };

export function HotelReceptionDirectory({ endpoint, locale, statusLabels }: { endpoint: string; locale: string; statusLabels: Readonly<Record<string, string>> }) {
  const t = copy[locale as keyof typeof copy] ?? copy.fa;
  const fieldId = useId();
  const [mode, setMode] = useState<"search" | "phone">("search");
  const [query, setQuery] = useState("");
  const [current, setCurrent] = useState<Query | null>(null);
  const [search, setSearch] = useState<Query | null>(null);
  const [result, setResult] = useState<ReceptionDirectoryResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const pending = useRef(false);
  const [profilePanel, setProfilePanel] = useState<{ id: string; fullName: string } | "browse" | null>(null);
  const profileLabel = locale === "en" ? "Guest profiles" : locale === "ar" ? "ملفات الضيوف" : "پرونده‌های مستقل مهمانان";
  const personLabel = locale === "en" ? "Individual profile" : locale === "ar" ? "الملف الفردي" : "پرونده فردی";
  async function load(input: Query) {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError(false); setResult(null); setCurrent(input);
    try {
      const response = await fetch(`${endpoint}/directory`, { method: "POST", cache: "no-store", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
      if (!response.ok) throw new Error("directory request failed");
      setResult(await response.json() as ReceptionDirectoryResult);
    } catch { setError(true); }
    finally { pending.current = false; setBusy(false); }
  }
  function showHistory(row: ReceptionDirectoryRow) {
    void load({ action: "history", reservationId: row.id, page: 1 });
  }
  const formatDate = (value: string) => new Intl.DateTimeFormat(locale === "fa" ? "fa-IR-u-ca-persian" : locale === "ar" ? "ar-u-ca-gregory" : "en-GB", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${value}T12:00:00Z`));
  return <section aria-label={t.title} className="min-w-0 space-y-3 rounded-lg border p-3" dir={locale === "en" ? "ltr" : "rtl"}>
    <h3 className="font-semibold">{t.title}</h3><p className="text-sm text-muted-foreground">{t.help}</p>
    <form className="flex flex-wrap items-end gap-2" onSubmit={event => { event.preventDefault(); if (busy || query.trim().length < (mode === "phone" ? 8 : 2)) return; const input: Query = { action: mode, query: query.trim(), page: 1 }; setSearch(input); void load(input); }}>
      <div className="flex flex-wrap gap-2"><Button type="button" size="sm" variant={mode === "search" ? "default" : "outline"} aria-pressed={mode === "search"} disabled={busy} onClick={() => { setMode("search"); setQuery(""); setResult(null); setCurrent(null); setSearch(null); setError(false); }}>{t.text}</Button><Button type="button" size="sm" variant={mode === "phone" ? "default" : "outline"} aria-pressed={mode === "phone"} disabled={busy} onClick={() => { setMode("phone"); setQuery(""); setResult(null); setCurrent(null); setSearch(null); setError(false); }}>{t.phoneMode}</Button></div>
      <div className="min-w-0 flex-1 basis-48 space-y-1"><label className="text-sm" htmlFor={fieldId}>{mode === "phone" ? t.phone : t.query}</label><Input id={fieldId} type="search" inputMode={mode === "phone" ? "tel" : "search"} maxLength={mode === "phone" ? 32 : 120} autoComplete="off" disabled={busy} value={query} onChange={event => { setQuery(event.target.value); setResult(null); setCurrent(null); setSearch(null); setError(false); }} /></div>
      <Button type="submit" disabled={busy || query.trim().length < (mode === "phone" ? 8 : 2)}>{t.submit}</Button>
    </form>
    <Button type="button" variant="outline" size="sm" onClick={() => setProfilePanel("browse")}>{profileLabel}</Button>
    {profilePanel ? <HotelGuestProfiles key={profilePanel === "browse" ? "browse" : profilePanel.id} endpoint={endpoint} locale={locale} anchor={profilePanel === "browse" ? null : profilePanel} statusLabels={statusLabels} onClose={() => setProfilePanel(null)} /> : null}
    {busy ? <p role="status">{t.working}</p> : null}{error ? <p role="alert">{t.failed}</p> : null}
    {current?.action === "history" && search ? <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void load(search)}>{t.back}</Button> : null}
    {result ? <div className="space-y-3" aria-live="polite">
      {result.basis ? <p className="text-sm text-muted-foreground">{result.basis === "LINKED_CUSTOMER" ? t.account : result.basis === "CONTACT" ? t.contact : t.single}</p> : null}
      {!result.rows.length ? <p>{t.empty}</p> : <div className="space-y-2">{result.rows.map(row => <article key={row.id} className="space-y-1 rounded-md border p-2 text-sm [overflow-wrap:anywhere]">
        <p className="font-medium"><bdi>{row.reference}</bdi> · {statusLabels[row.status] ?? row.status}</p>
        <p>{t.dates}: {formatDate(row.checkIn)} – {formatDate(row.checkOut)}</p>
        {row.rooms.length ? <p>{t.rooms}: <bdi>{row.rooms.join("، ")}</bdi></p> : null}
        {row.guests.map(guest => <div key={guest.id} className="flex flex-wrap items-center gap-2"><span>{guest.fullName}{guest.isPrimary ? ` · ${t.primary}` : ""}{guest.isChild ? ` · ${t.child}` : ""}</span><Button type="button" size="sm" variant="ghost" onClick={() => setProfilePanel({ id: guest.id, fullName: guest.fullName })}>{personLabel}</Button></div>)}
        {current?.action !== "history" ? <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => showHistory(row)}>{t.history}</Button> : null}
      </article>)}</div>}
      <div className="flex flex-wrap items-center gap-2"><Button type="button" size="sm" variant="outline" disabled={busy || result.page <= 1 || !current} onClick={() => { if (current) void load({ ...current, page: result.page - 1 }); }}>{t.previous}</Button><span className="text-sm">{t.page} {result.page}</span><Button type="button" size="sm" variant="outline" disabled={busy || !result.hasMore || !current} onClick={() => { if (current) void load({ ...current, page: result.page + 1 }); }}>{t.next}</Button></div>
      {result.pageLimitReached ? <p className="text-sm">{t.limit}</p> : null}
    </div> : null}
  </section>;
}
