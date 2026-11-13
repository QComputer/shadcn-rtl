"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type RequestStatus = "RECEIVED" | "IN_REVIEW" | "OPTION_OFFERED" | "UNAVAILABLE" | "DECLINED" | "CLOSED";
type GuestRequest = {
  id: string;
  status: RequestStatus;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  childAges: number[];
  roomTypeSlug: string | null;
  ratePlanCode: string | null;
  availabilityHint: "AVAILABLE" | "UNAVAILABLE" | "UNKNOWN";
  managerMessage: string | null;
  guestName: string;
  guestPhone: string;
  guestEmail: string | null;
  guestNote: string | null;
  version: number;
  createdAt: string;
};

const labels = {
  fa: {
    title: "درخواست‌های اقامت", refresh: "به‌روزرسانی", all: "همه وضعیت‌ها", loading: "در حال دریافت درخواست‌ها…", empty: "درخواستی ثبت نشده است.", error: "دریافت درخواست‌ها ناموفق بود.", saveError: "تغییر وضعیت ذخیره نشد. فهرست را تازه کنید.", retry: "تلاش دوباره", guest: "مهمان", dates: "ورود / خروج", party: "مهمانان", room: "ترجیح اتاق", note: "درخواست مهمان", availability: "بررسی هنگام ثبت", status: "وضعیت", update: "تغییر وضعیت", more: "درخواست‌های قدیمی‌تر", received: "دریافت‌شده", review: "در حال بررسی", offered: "پیشنهاد برای بررسی", unavailable: "ناموجود", declined: "ردشده", closed: "بسته‌شده", checkAvailability: "بررسی دوباره موجودی", checking: "در حال بررسی…", available: "موجود در بررسی ثبت درخواست", noAvailability: "ناموجود در بررسی ثبت درخواست", unknown: "بررسی نشده", refreshAvailabilityError: "بررسی موجودی انجام نشد. دوباره تلاش کنید.",
  },
  en: {
    title: "Stay requests", refresh: "Refresh", all: "All statuses", loading: "Loading requests…", empty: "No stay requests yet.", error: "Could not load stay requests.", saveError: "Status was not saved. Refresh and retry.", retry: "Retry", guest: "Guest", dates: "Check-in / check-out", party: "Guests", room: "Room preference", note: "Guest request", availability: "At submission", status: "Status", update: "Change status", more: "Load older requests", received: "Received", review: "Under review", offered: "Option offered", unavailable: "Unavailable", declined: "Declined", closed: "Closed", checkAvailability: "Recheck availability", checking: "Checking…", available: "Available when request was submitted", noAvailability: "Unavailable when request was submitted", unknown: "Not checked", refreshAvailabilityError: "Availability could not be checked. Try again.",
  },
  ar: {
    title: "طلبات الإقامة", refresh: "تحديث", all: "كل الحالات", loading: "جارٍ تحميل الطلبات…", empty: "لا توجد طلبات إقامة بعد.", error: "تعذر تحميل الطلبات.", saveError: "لم تُحفظ الحالة. حدّث القائمة ثم أعد المحاولة.", retry: "إعادة المحاولة", guest: "الضيف", dates: "الوصول / المغادرة", party: "الضيوف", room: "تفضيل الغرفة", note: "طلب الضيف", availability: "عند الإرسال", status: "الحالة", update: "تغيير الحالة", more: "تحميل الطلبات الأقدم", received: "تم الاستلام", review: "قيد المراجعة", offered: "تم تقديم خيار", unavailable: "غير متاح", declined: "مرفوض", closed: "مغلق", checkAvailability: "إعادة التحقق من التوفر", checking: "جارٍ التحقق…", available: "كان متاحاً عند إرسال الطلب", noAvailability: "لم يكن متاحاً عند إرسال الطلب", unknown: "لم يتم التحقق", refreshAvailabilityError: "تعذر التحقق من التوفر. حاول مرة أخرى.",
  },
} as const;

const statuses: RequestStatus[] = ["RECEIVED", "IN_REVIEW", "OPTION_OFFERED", "UNAVAILABLE", "DECLINED", "CLOSED"];
const statusLabelKey: Record<RequestStatus, keyof typeof labels.en> = {
  RECEIVED: "received", IN_REVIEW: "review", OPTION_OFFERED: "offered", UNAVAILABLE: "unavailable", DECLINED: "declined", CLOSED: "closed",
};
const transitions: Record<RequestStatus, RequestStatus[]> = {
  RECEIVED: ["IN_REVIEW", "OPTION_OFFERED", "UNAVAILABLE", "DECLINED", "CLOSED"],
  IN_REVIEW: ["OPTION_OFFERED", "UNAVAILABLE", "DECLINED", "CLOSED"],
  OPTION_OFFERED: ["IN_REVIEW", "CLOSED"],
  UNAVAILABLE: ["IN_REVIEW", "CLOSED"],
  DECLINED: ["CLOSED"],
  CLOSED: [],
};

export function HotelGuestBookingRequests({ organizationId, propertyId, locale }: { organizationId: string; propertyId: string; locale: string }) {
  const language = locale === "en" || locale === "ar" ? locale : "fa";
  const text = labels[language];
  const base = useMemo(() => `/api/organizations/${encodeURIComponent(organizationId)}/hotels/${encodeURIComponent(propertyId)}/booking-requests`, [organizationId, propertyId]);
  const [requests, setRequests] = useState<GuestRequest[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [filter, setFilter] = useState<RequestStatus | "ALL">("ALL");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [messages, setMessages] = useState<Record<string, string>>({});

  const load = useCallback(async (nextCursor?: string | null, append = false) => {
    setLoading(true); setError("");
    try {
      const url = new URL(base, window.location.origin);
      if (nextCursor) url.searchParams.set("cursor", nextCursor);
      const response = await fetch(url, { credentials: "same-origin", cache: "no-store" });
      const data = await response.json().catch(() => null) as { requests?: GuestRequest[]; nextCursor?: string | null } | null;
      if (!response.ok || !Array.isArray(data?.requests)) throw new Error(text.error);
      setRequests((current) => append ? [...current, ...data.requests!] : data.requests!);
      setCursor(data.nextCursor || null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : text.error); }
    finally { setLoading(false); }
  }, [base, text.error]);

  useEffect(() => { void load(); }, [load]);

  const update = async (request: GuestRequest, status: RequestStatus) => {
    setBusyId(request.id); setError("");
    try {
      const response = await fetch(`${base}/${encodeURIComponent(request.id)}`, {
        method: "PATCH", credentials: "same-origin", headers: { "content-type": "application/json" },
        body: JSON.stringify({ status, expectedVersion: request.version, managerMessage: messages[request.id] || "" }),
      });
      if (!response.ok) throw new Error(text.saveError);
      const updated = await response.json() as Pick<GuestRequest, "id" | "status" | "managerMessage" | "version">;
      setRequests((current) => current.map((item) => item.id === updated.id ? { ...item, status: updated.status, managerMessage: updated.managerMessage, version: updated.version } : item));
      setMessages((current) => ({ ...current, [request.id]: updated.managerMessage || "" }));
    } catch { setError(text.saveError); }
    finally { setBusyId(null); }
  };

  const recheckAvailability = async (request: GuestRequest) => {
    setBusyId(request.id); setError("");
    try {
      const response = await fetch(`${base}/${encodeURIComponent(request.id)}/availability`, { method: "POST", credentials: "same-origin" });
      const result = await response.json().catch(() => null) as { availabilityHint?: GuestRequest["availabilityHint"]; version?: number } | null;
      if (!response.ok || !result?.availabilityHint || typeof result.version !== "number") throw new Error(text.refreshAvailabilityError);
      setRequests((current) => current.map((item) => item.id === request.id ? { ...item, availabilityHint: result.availabilityHint!, version: result.version! } : item));
    } catch { setError(text.refreshAvailabilityError); }
    finally { setBusyId(null); }
  };

  const date = (value: string) => {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? value : new Intl.DateTimeFormat(language === "fa" ? "fa-IR" : language === "ar" ? "ar" : "en", { dateStyle: "medium", timeZone: "UTC" }).format(parsed);
  };
  const shown = filter === "ALL" ? requests : requests.filter((request) => request.status === filter);

  return <section className="mt-8 space-y-4 rounded-xl border bg-card p-4 sm:p-6" dir={language === "fa" || language === "ar" ? "rtl" : "ltr"} aria-labelledby="hotel-stay-requests-title">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <h2 id="hotel-stay-requests-title" className="text-xl font-semibold">{text.title}</h2>
      <div className="flex flex-wrap gap-2">
        <label className="sr-only" htmlFor="hotel-request-status-filter">{text.status}</label>
        <select id="hotel-request-status-filter" className="rounded-md border bg-background px-3 py-2 text-sm" value={filter} onChange={(event) => setFilter(event.target.value as RequestStatus | "ALL")}>
          <option value="ALL">{text.all}</option>
          {statuses.map((status) => <option key={status} value={status}>{text[statusLabelKey[status]]}</option>)}
        </select>
        <button type="button" className="rounded-md border px-3 py-2 text-sm" onClick={() => void load()} disabled={loading}>{text.refresh}</button>
      </div>
    </header>
    {error && <p className="rounded-md border border-destructive/40 p-3 text-sm text-destructive" role="alert">{error} <button className="underline" onClick={() => void load()}>{text.retry}</button></p>}
    {loading && <p className="text-sm text-muted-foreground" role="status">{text.loading}</p>}
    {!loading && !shown.length && !error && <p className="rounded-lg border p-4 text-sm text-muted-foreground">{text.empty}</p>}
    <div className="grid gap-3">
      {shown.map((request) => {
        const nextStatuses = transitions[request.status];
        const availabilityText = request.availabilityHint === "AVAILABLE" ? text.available : request.availabilityHint === "UNAVAILABLE" ? text.noAvailability : text.unknown;
        return <article key={request.id} className="space-y-3 rounded-lg border p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><h3 className="font-semibold">{request.guestName}</h3><a className="text-sm underline" href={`tel:${encodeURIComponent(request.guestPhone)}`} dir="ltr">{request.guestPhone}</a>{request.guestEmail && <p className="text-sm" dir="ltr">{request.guestEmail}</p>}</div>
            <span className="rounded-full border px-3 py-1 text-sm">{text[statusLabelKey[request.status]]}</span>
          </div>
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div><dt className="font-medium">{text.dates}</dt><dd>{date(request.checkIn)} – {date(request.checkOut)}</dd></div>
            <div><dt className="font-medium">{text.party}</dt><dd>{request.adults} + {request.children}{request.childAges.length ? ` (${request.childAges.join(", ")})` : ""}</dd></div>
            <div><dt className="font-medium">{text.room}</dt><dd>{[request.roomTypeSlug, request.ratePlanCode].filter(Boolean).join(" · ") || "—"}</dd></div>
            <div><dt className="font-medium">{text.availability}</dt><dd>{availabilityText} <button type="button" className="ms-2 underline" disabled={busyId === request.id} onClick={() => void recheckAvailability(request)}>{busyId === request.id ? text.checking : text.checkAvailability}</button></dd></div>
          </dl>
          {request.guestNote && <p className="rounded-md bg-muted p-3 text-sm"><strong>{text.note}: </strong>{request.guestNote}</p>}
          <label className="grid gap-1 text-sm"><span className="font-medium">{language === "fa" ? "پیام پذیرش برای مهمان" : language === "ar" ? "رسالة الاستقبال إلى الضيف" : "Reception message to guest"}</span><textarea className="min-h-20 rounded-md border bg-background p-3" maxLength={500} value={messages[request.id] ?? request.managerMessage ?? ""} onChange={(event) => setMessages((current) => ({ ...current, [request.id]: event.target.value }))} /></label>
          {nextStatuses.length > 0 && <div className="flex flex-wrap items-center gap-2">
            <label className="sr-only" htmlFor={`request-status-${request.id}`}>{text.update}</label>
            <select id={`request-status-${request.id}`} className="rounded-md border bg-background px-3 py-2 text-sm" value="" disabled={busyId === request.id} onChange={(event) => { const value = event.target.value as RequestStatus; if (value) void update(request, value); }}>
              <option value="" disabled>{text.update}</option>
              {nextStatuses.map((status) => <option key={status} value={status}>{text[statusLabelKey[status]]}</option>)}
            </select>
            {busyId === request.id && <span className="text-sm text-muted-foreground" role="status">…</span>}
          </div>}
        </article>;
      })}
    </div>
    {cursor && <button type="button" className="w-full rounded-md border px-3 py-2 text-sm" disabled={loading} onClick={() => void load(cursor, true)}>{text.more}</button>}
  </section>;
}
