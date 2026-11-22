"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type RequestStatus = "RECEIVED" | "IN_REVIEW" | "OPTION_OFFERED" | "UNAVAILABLE" | "DECLINED" | "CLOSED";
type RequestFilter = RequestStatus | "ALL" | "NEEDS_ACTION";
type GuestRequest = {
  id: string;
  status: RequestStatus;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  childAges: number[];
  preferredCategory: string | null;
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
    title: "درخواست‌های اقامت", refresh: "به‌روزرسانی", autoRefresh: "درخواست‌های تازه هر ۶۰ ثانیه، تا وقتی این صفحه باز است، بررسی می‌شوند.", all: "همه وضعیت‌ها", searchLabel: "نام یا شماره تماس مهمان", searchPlaceholder: "جست‌وجوی نام یا شماره تماس", searchButton: "جست‌وجو", clearSearch: "پاک‌کردن جست‌وجو", loading: "در حال دریافت درخواست‌ها…", empty: "درخواستی ثبت نشده است.", emptyFiltered: "درخواستی با این وضعیت پیدا نشد.", error: "دریافت درخواست‌ها ناموفق بود.", saveError: "تغییر وضعیت ذخیره نشد. فهرست را تازه کنید.", retry: "تلاش دوباره", guest: "مهمان", receivedAt: "زمان دریافت", dates: "ورود / خروج", party: "مهمانان", room: "ترجیح اتاق", note: "درخواست مهمان", availability: "بررسی هنگام ثبت", status: "وضعیت", update: "تغییر وضعیت", more: "درخواست‌های قدیمی‌تر", received: "دریافت‌شده", review: "در حال بررسی", offered: "پیشنهاد برای بررسی", unavailable: "ناموجود", declined: "ردشده", closed: "بسته‌شده", checkAvailability: "بررسی دوباره موجودی", checking: "در حال بررسی…", available: "موجود در بررسی ثبت درخواست", noAvailability: "ناموجود در بررسی ثبت درخواست", unknown: "بررسی نشده", refreshAvailabilityError: "بررسی موجودی انجام نشد. دوباره تلاش کنید.",
  },
  en: {
    title: "Stay requests", refresh: "Refresh", autoRefresh: "New requests are checked every 60 seconds while this page is open.", all: "All statuses", searchLabel: "Guest name or phone number", searchPlaceholder: "Search name or phone number", searchButton: "Search", clearSearch: "Clear search", loading: "Loading requests…", empty: "No stay requests yet.", emptyFiltered: "No requests match this status.", error: "Could not load stay requests.", saveError: "Status was not saved. Refresh and retry.", retry: "Retry", guest: "Guest", receivedAt: "Received at", dates: "Check-in / check-out", party: "Guests", room: "Room preference", note: "Guest request", availability: "At submission", status: "Status", update: "Change status", more: "Load older requests", received: "Received", review: "Under review", offered: "Option offered", unavailable: "Unavailable", declined: "Declined", closed: "Closed", checkAvailability: "Recheck availability", checking: "Checking…", available: "Available when request was submitted", noAvailability: "Unavailable when request was submitted", unknown: "Not checked", refreshAvailabilityError: "Availability could not be checked. Try again.",
  },
  ar: {
    title: "طلبات الإقامة", refresh: "تحديث", autoRefresh: "يتم التحقق من الطلبات الجديدة كل ٦٠ ثانية ما دامت الصفحة مفتوحة.", all: "كل الحالات", searchLabel: "اسم الضيف أو رقم الهاتف", searchPlaceholder: "ابحث بالاسم أو رقم الهاتف", searchButton: "بحث", clearSearch: "مسح البحث", loading: "جارٍ تحميل الطلبات…", empty: "لا توجد طلبات إقامة بعد.", emptyFiltered: "لا توجد طلبات بهذه الحالة.", error: "تعذر تحميل الطلبات.", saveError: "لم تُحفظ الحالة. حدّث القائمة ثم أعد المحاولة.", retry: "إعادة المحاولة", guest: "الضيف", receivedAt: "وقت الاستلام", dates: "الوصول / المغادرة", party: "الضيوف", room: "تفضيل الغرفة", note: "طلب الضيف", availability: "عند الإرسال", status: "الحالة", update: "تغيير الحالة", more: "تحميل الطلبات الأقدم", received: "تم الاستلام", review: "قيد المراجعة", offered: "تم تقديم خيار", unavailable: "غير متاح", declined: "مرفوض", closed: "مغلق", checkAvailability: "إعادة التحقق من التوفر", checking: "جارٍ التحقق…", available: "كان متاحاً عند إرسال الطلب", noAvailability: "لم يكن متاحاً عند إرسال الطلب", unknown: "لم يتم التحقق", refreshAvailabilityError: "تعذر التحقق من التوفر. حاول مرة أخرى.",
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
  const [filter, setFilter] = useState<RequestFilter>("ALL");
  const [searchInput, setSearchInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copyFeedback, setCopyFeedback] = useState<{ id: string; ok: boolean } | null>(null);
  const [messages, setMessages] = useState<Record<string, string>>({});
  const [noteFeedback, setNoteFeedback] = useState<Record<string, "saved" | "error" | "conflict">>({});
  const noteText = language === "fa" ? { save: "ذخیره یادداشت", saving: "در حال ذخیره…", saved: "ذخیره شد", unsaved: "تغییرات ذخیره‌نشده", error: "ذخیره ناموفق بود؛ متن حفظ شد.", conflict: "درخواست تغییر کرده است؛ پس از نگهداری متن، فهرست را تازه کنید." } : language === "ar" ? { save: "حفظ الملاحظة", saving: "جارٍ الحفظ…", saved: "تم الحفظ", unsaved: "تغييرات غير محفوظة", error: "تعذر الحفظ؛ تم الاحتفاظ بالنص.", conflict: "تغير الطلب؛ احتفظ بالنص ثم حدّث القائمة." } : { save: "Save note", saving: "Saving…", saved: "Saved", unsaved: "Unsaved changes", error: "Could not save; your text is preserved.", conflict: "This request changed; keep your text and refresh the list." };
  const latestLoadId = useRef(0);
  const selectedFilter = useRef<RequestFilter>("ALL");
  const selectedSearch = useRef("");
  const loadInFlight = useRef(false);
  const loadedOlderPages = useRef(false);
  const dirtyMessages = useRef(new Set<string>());

  const load = useCallback(async (nextCursor?: string | null, append = false, statusFilter: RequestFilter = filter, searchFilter = selectedSearch.current) => {
    loadInFlight.current = true;
    if (!append) loadedOlderPages.current = false;
    const loadId = ++latestLoadId.current;
    setLoading(true); setError("");
    try {
      const url = new URL(base, window.location.origin);
      if (nextCursor) url.searchParams.set("cursor", nextCursor);
      if (statusFilter !== "ALL") url.searchParams.set("status", statusFilter);
      if (searchFilter) url.searchParams.set("search", searchFilter);
      const response = await fetch(url, { credentials: "same-origin", cache: "no-store" });
      const data = await response.json().catch(() => null) as { requests?: GuestRequest[]; nextCursor?: string | null } | null;
      if (!response.ok || !Array.isArray(data?.requests)) throw new Error(text.error);
      if (loadId !== latestLoadId.current) return;
      setRequests((current) => {
        if (!append) return data.requests!;
        loadedOlderPages.current = true;
        return [...current, ...data.requests!];
      });
      setCursor(data.nextCursor || null);
    } catch (cause) {
      if (loadId === latestLoadId.current) setError(cause instanceof Error ? cause.message : text.error);
    } finally {
      loadInFlight.current = false;
      if (loadId === latestLoadId.current) setLoading(false);
    }
  }, [base, filter, text.error]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState !== "visible" || loadInFlight.current || loadedOlderPages.current || busyId || dirtyMessages.current.size > 0 || document.activeElement instanceof HTMLTextAreaElement) return;
      void load(null, false, selectedFilter.current);
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [busyId, load]);

  const update = async (request: GuestRequest, status: RequestStatus) => {
    const filterAtStart = selectedFilter.current;
    setBusyId(request.id); setError("");
    try {
      const response = await fetch(`${base}/${encodeURIComponent(request.id)}`, {
        method: "PATCH", credentials: "same-origin", headers: { "content-type": "application/json" },
        body: JSON.stringify({ status, expectedVersion: request.version, managerMessage: messages[request.id] || "" }),
      });
      if (!response.ok) throw new Error(text.saveError);
      const updated = await response.json() as Pick<GuestRequest, "id" | "status" | "managerMessage" | "version">;
      const activeFilter = selectedFilter.current;
      if (activeFilter !== filterAtStart || (activeFilter !== "ALL" && (activeFilter === "NEEDS_ACTION" ? !["RECEIVED", "IN_REVIEW"].includes(updated.status) : updated.status !== activeFilter))) {
        setRequests((current) => current.filter((item) => item.id !== updated.id));
        setCursor(null);
        void load(null, false, activeFilter);
      } else {
        setRequests((current) => current.map((item) => item.id === updated.id ? { ...item, status: updated.status, managerMessage: updated.managerMessage, version: updated.version } : item));
      }
      dirtyMessages.current.delete(request.id);
      setMessages((current) => ({ ...current, [request.id]: updated.managerMessage || "" }));
    } catch { setError(text.saveError); }
    finally { setBusyId(null); }
  };

  const saveNote = async (request: GuestRequest) => {
    const submitted = messages[request.id] ?? request.managerMessage ?? "";
    setBusyId(request.id);
    setNoteFeedback((current) => { const next = { ...current }; delete next[request.id]; return next; });
    try {
      const response = await fetch(`${base}/${encodeURIComponent(request.id)}`, {
        method: "PATCH", credentials: "same-origin", headers: { "content-type": "application/json" },
        body: JSON.stringify({ expectedVersion: request.version, managerMessage: submitted }),
      });
      if (!response.ok) { setNoteFeedback((current) => ({ ...current, [request.id]: response.status === 409 ? "conflict" : "error" })); return; }
      const updated = await response.json() as Pick<GuestRequest, "id" | "status" | "managerMessage" | "version">;
      setRequests((current) => current.map((item) => item.id === updated.id ? { ...item, managerMessage: updated.managerMessage, version: updated.version } : item));
      setMessages((current) => ({ ...current, [request.id]: updated.managerMessage || "" }));
      dirtyMessages.current.delete(request.id);
      setNoteFeedback((current) => ({ ...current, [request.id]: "saved" }));
    } catch { setNoteFeedback((current) => ({ ...current, [request.id]: "error" })); }
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
  const receivedAt = (value: string) => {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return new Intl.DateTimeFormat(language === "fa" ? "fa-IR" : language === "ar" ? "ar" : "en", {
      dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Tehran",
    }).format(parsed);
  };
  const shown = requests;
  const needsAction = (status: RequestStatus) => status === "RECEIVED" || status === "IN_REVIEW";
  const newCount = shown.filter((request) => request.status === "RECEIVED").length;
  const actionCount = shown.filter((request) => needsAction(request.status)).length;
  const indicators = language === "fa"
    ? { scope: "درخواست‌های بارگذاری‌شده", fresh: "جدید و بررسی‌نشده", action: "نیازمند اقدام پذیرش" }
    : language === "ar"
      ? { scope: "الطلبات المحمّلة", fresh: "جديد ولم يُراجع", action: "يتطلب إجراء الاستقبال" }
      : { scope: "Loaded requests", fresh: "New and unreviewed", action: "Reception action needed" };
  const changeFilter = (nextFilter: RequestFilter) => {
    if (nextFilter === selectedFilter.current) return;
    selectedFilter.current = nextFilter; loadedOlderPages.current = false; latestLoadId.current += 1;
    setCursor(null); setRequests([]); setFilter(nextFilter);
  };
  const copyPhone = async (request: GuestRequest) => {
    try { await navigator.clipboard.writeText(request.guestPhone); setCopyFeedback({ id: request.id, ok: true }); }
    catch { setCopyFeedback({ id: request.id, ok: false }); }
  };
  const copyLabels = language === "fa" ? { copy: "کپی شماره", copied: "شماره کپی شد", failed: "کپی انجام نشد؛ شماره را دستی انتخاب کنید" } : language === "ar" ? { copy: "نسخ الرقم", copied: "تم نسخ الرقم", failed: "تعذر النسخ؛ حدد الرقم يدوياً" } : { copy: "Copy number", copied: "Number copied", failed: "Could not copy; select the number manually" };
  const applySearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextSearch = searchInput.trim();
    selectedSearch.current = nextSearch;
    setAppliedSearch(nextSearch);
    loadedOlderPages.current = false;
    latestLoadId.current += 1;
    setCursor(null);
    void load(null, false, selectedFilter.current, nextSearch);
  };
  const clearSearch = () => {
    setSearchInput("");
    selectedSearch.current = "";
    setAppliedSearch("");
    loadedOlderPages.current = false;
    latestLoadId.current += 1;
    setCursor(null);
    void load(null, false, selectedFilter.current, "");
  };

  return <section className="mt-8 space-y-4 rounded-xl border bg-card p-4 sm:p-6" dir={language === "fa" || language === "ar" ? "rtl" : "ltr"} aria-labelledby="hotel-stay-requests-title">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <h2 id="hotel-stay-requests-title" className="text-xl font-semibold">{text.title}</h2>
      <div className="flex flex-wrap gap-2">
        <label className="sr-only" htmlFor="hotel-request-status-filter">{text.status}</label>
        <select id="hotel-request-status-filter" className="rounded-md border bg-background px-3 py-2 text-sm" value={filter} onChange={(event) => changeFilter(event.target.value as RequestFilter)}>
          <option value="ALL">{text.all}</option>
          <option value="NEEDS_ACTION">{indicators.action}</option>
          {statuses.map((status) => <option key={status} value={status}>{text[statusLabelKey[status]]}</option>)}
        </select>
        <button type="button" className="rounded-md border px-3 py-2 text-sm" onClick={() => void load()} disabled={loading}>{text.refresh}</button>
      </div>
    </header>
    <button type="button" className="rounded-md border border-amber-600 px-4 py-2 font-medium" aria-pressed={filter === "NEEDS_ACTION"} onClick={() => changeFilter(filter === "NEEDS_ACTION" ? "ALL" : "NEEDS_ACTION")}>{indicators.action}</button>
    <form className="flex flex-wrap gap-2" onSubmit={applySearch}>
      <label className="sr-only" htmlFor="hotel-request-search">{text.searchLabel}</label>
      <input id="hotel-request-search" className="min-w-56 flex-1 rounded-md border bg-background px-3 py-2 text-sm" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder={text.searchPlaceholder} minLength={2} maxLength={80} />
      <button type="submit" className="rounded-md border px-3 py-2 text-sm" disabled={loading}>{text.searchButton}</button>
      {appliedSearch && <button type="button" className="rounded-md border px-3 py-2 text-sm" onClick={clearSearch} disabled={loading}>{text.clearSearch}</button>}
    </form>
    <p className="text-xs text-muted-foreground">{text.autoRefresh}</p>
    <div className="flex flex-wrap gap-2 text-sm" aria-live="polite"><span>{indicators.scope}:</span><span>{indicators.fresh}: {newCount}</span><span>{indicators.action}: {actionCount}</span></div>
    {error && <p className="rounded-md border border-destructive/40 p-3 text-sm text-destructive" role="alert">{error} <button className="underline" onClick={() => void load()}>{text.retry}</button></p>}
    {loading && <p className="text-sm text-muted-foreground" role="status">{text.loading}</p>}
    {!loading && !shown.length && !error && <p className="rounded-lg border p-4 text-sm text-muted-foreground">{filter === "ALL" ? text.empty : text.emptyFiltered}</p>}
    <div className="grid gap-3">
      {shown.map((request) => {
        const coordination = request.roomTypeSlug === null && request.ratePlanCode === null;
        const nextStatuses = transitions[request.status].filter((status) => !coordination || (status !== "OPTION_OFFERED" && status !== "UNAVAILABLE"));
        const categoryLabels: Record<string, Record<string, string>> = {
          "vip-suite": { fa: "سوئیت VIP دو اتاقه", en: "VIP Two-Room Suite", ar: "جناح VIP بغرفتين" },
          "standard-room": { fa: "اتاق استاندارد", en: "Standard Room", ar: "غرفة قياسية" },
          "studio-suite": { fa: "سوئیت استودیو", en: "Studio Suite", ar: "جناح استوديو" },
        };
        const category = request.preferredCategory ? categoryLabels[request.preferredCategory]?.[language] ?? request.preferredCategory : null;
        const availabilityText = request.availabilityHint === "AVAILABLE" ? text.available : request.availabilityHint === "UNAVAILABLE" ? text.noAvailability : text.unknown;
        return <article key={request.id} className={`space-y-3 rounded-lg border p-4 ${needsAction(request.status) ? "border-amber-500 bg-amber-50/40 dark:bg-amber-950/20" : ""}`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><h3 className="font-semibold">{request.guestName}</h3><a className="text-sm underline" href={`tel:${encodeURIComponent(request.guestPhone)}`} dir="ltr">{request.guestPhone}</a> <button type="button" className="min-h-11 rounded-md border px-3 text-sm" onClick={() => void copyPhone(request)}>{copyLabels.copy}</button>{copyFeedback?.id === request.id && <span className="ms-2 text-sm" role="status">{copyFeedback.ok ? copyLabels.copied : copyLabels.failed}</span>}{request.guestEmail && <p className="text-sm" dir="ltr">{request.guestEmail}</p>}<p className="mt-1 text-xs text-muted-foreground"><span>{text.receivedAt}: </span><time dateTime={request.createdAt}>{receivedAt(request.createdAt)}</time></p></div>
            <div className="flex flex-wrap gap-2"><span className="rounded-full border px-3 py-1 text-sm">{text[statusLabelKey[request.status]]}</span>{needsAction(request.status) && <span className="rounded-full border border-amber-600 px-3 py-1 text-sm font-medium">{request.status === "RECEIVED" ? indicators.fresh : indicators.action}</span>}</div>
          </div>
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div><dt className="font-medium">{text.dates}</dt><dd>{date(request.checkIn)} – {date(request.checkOut)}</dd></div>
            <div><dt className="font-medium">{text.party}</dt><dd>{request.adults} + {request.children}{request.childAges.length ? ` (${request.childAges.join(", ")})` : ""}</dd></div>
            <div><dt className="font-medium">{text.room}</dt><dd>{coordination ? category || "—" : [request.roomTypeSlug, request.ratePlanCode].filter(Boolean).join(" · ") || "—"}</dd></div>
            {!coordination && <div><dt className="font-medium">{text.availability}</dt><dd>{availabilityText} <button type="button" className="ms-2 underline" disabled={busyId === request.id} onClick={() => void recheckAvailability(request)}>{busyId === request.id ? text.checking : text.checkAvailability}</button></dd></div>}
          </dl>
          {request.guestNote && <p className="rounded-md bg-muted p-3 text-sm"><strong>{text.note}: </strong>{request.guestNote}</p>}
          <label className="grid gap-1 text-sm"><span className="font-medium">{coordination ? (language === "fa" ? "یادداشت داخلی پذیرش (برای مهمان نمایش داده نمی‌شود)" : language === "ar" ? "ملاحظة داخلية للاستقبال (لا تظهر للضيف)" : "Internal reception note (not shown to guest)") : (language === "fa" ? "پیام پذیرش برای مهمان" : language === "ar" ? "رسالة الاستقبال إلى الضيف" : "Reception message to guest")}</span><textarea className="min-h-20 rounded-md border bg-background p-3" maxLength={500} disabled={busyId === request.id} value={messages[request.id] ?? request.managerMessage ?? ""} onChange={(event) => { const value = event.target.value; if (value === (request.managerMessage ?? "")) dirtyMessages.current.delete(request.id); else dirtyMessages.current.add(request.id); setMessages((current) => ({ ...current, [request.id]: value })); }} /></label>
          <div className="flex flex-wrap items-center gap-2"><button type="button" className="min-h-11 rounded-md border px-3 text-sm" disabled={Boolean(busyId) || (messages[request.id] ?? request.managerMessage ?? "") === (request.managerMessage ?? "")} onClick={() => void saveNote(request)}>{busyId === request.id ? noteText.saving : noteText.save}</button>{(noteFeedback[request.id] || (messages[request.id] ?? request.managerMessage ?? "") !== (request.managerMessage ?? "")) && <span role="status" className="text-sm">{noteFeedback[request.id] === "conflict" ? noteText.conflict : noteFeedback[request.id] === "error" ? noteText.error : (messages[request.id] ?? request.managerMessage ?? "") !== (request.managerMessage ?? "") ? noteText.unsaved : noteFeedback[request.id] === "saved" ? noteText.saved : ""}</span>}</div>
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
