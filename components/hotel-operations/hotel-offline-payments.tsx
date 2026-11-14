"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type HotelOfflinePaymentEntry = {
  id: string;
  method: "CASH" | "BANK_TRANSFER";
  status: "SUBMITTED" | "VERIFIED";
  amountToman: string;
  createdAt?: string;
  verifiedAt?: string | null;
  hasReceipt?: boolean;
};

export type HotelOfflinePaymentSummary = {
  totalToman: string;
  paidToman: string;
  outstandingToman: string;
  entries: HotelOfflinePaymentEntry[];
};

type PaymentLocale = "fa" | "en" | "ar";
type PaymentLabels = {
  title: string; total: string; paid: string; outstanding: string; cashAmount: string; recordCash: string;
  verify: string; refresh: string; loading: string; empty: string; cash: string; transfer: string;
  submitted: string; verified: string; saved: string; loadError: string; saveError: string;
  invalidAmount: string; notWired: string; access: string; busy: string;
};

const labels: Record<PaymentLocale, PaymentLabels> = {
  fa: { title: "پرداخت‌های خارج از درگاه", total: "مبلغ کل", paid: "پرداخت تأییدشده", outstanding: "مانده", cashAmount: "مبلغ نقدی (تومان)", recordCash: "ثبت دریافت نقدی", verify: "تأیید و ثبت واریز", refresh: "تازه‌سازی", loading: "در حال دریافت پرداخت‌ها…", empty: "پرداختی ثبت نشده است.", cash: "نقدی", transfer: "واریز بانکی", submitted: "ثبت‌شده؛ تأییدنشده", verified: "تأییدشده و پرداخت‌شده", saved: "عملیات در سرور ثبت شد.", loadError: "دریافت اطلاعات پرداخت انجام نشد.", saveError: "نتیجه عملیات از سرور تأیید نشد. وضعیت را تازه کنید.", invalidAmount: "مبلغ باید عدد صحیح تومان و حداکثر برابر مانده باشد.", notWired: "این مؤلفه هنوز به مسیر API پرداخت‌های هتل متصل نشده است.", access: "دسترسی به عملیات پرداخت مجاز نیست.", busy: "در حال ثبت…" },
  en: { title: "Offline payments", total: "Total amount", paid: "Verified paid", outstanding: "Outstanding", cashAmount: "Cash amount (Toman)", recordCash: "Record cash received", verify: "Verify and record transfer", refresh: "Refresh", loading: "Loading payments…", empty: "No payments recorded.", cash: "Cash", transfer: "Bank transfer", submitted: "Submitted; not verified", verified: "Verified and paid", saved: "The server recorded the operation.", loadError: "Could not load payment information.", saveError: "The server did not confirm the operation. Refresh the status.", invalidAmount: "Enter a whole Toman amount no greater than the outstanding balance.", notWired: "This component is not yet wired to the hotel offline-payment API route.", access: "You are not authorized to manage these payments.", busy: "Saving…" },
  ar: { title: "المدفوعات غير الإلكترونية", total: "المبلغ الإجمالي", paid: "المدفوع المؤكد", outstanding: "المتبقي", cashAmount: "المبلغ النقدي (تومان)", recordCash: "تسجيل استلام نقدي", verify: "تأكيد التحويل وتسجيله", refresh: "تحديث", loading: "جارٍ تحميل المدفوعات…", empty: "لا توجد مدفوعات مسجلة.", cash: "نقداً", transfer: "تحويل مصرفي", submitted: "مُرسل؛ غير مؤكد", verified: "مؤكد ومدفوع", saved: "سجل الخادم العملية.", loadError: "تعذر تحميل معلومات الدفع.", saveError: "لم يؤكد الخادم العملية. حدّث الحالة.", invalidAmount: "أدخل مبلغاً صحيحاً بالتومان لا يتجاوز الرصيد المتبقي.", notWired: "لم يتم ربط هذا المكون بعد بمسار واجهة مدفوعات الفندق.", access: "غير مصرح لك بإدارة هذه المدفوعات.", busy: "جارٍ الحفظ…" },
};

function amount(value: unknown): string | null {
  if (typeof value === "string" && /^\d+$/.test(value)) return value;
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) return String(value);
  return null;
}

/** Defensive parser for the documented GET contract; values stay decimal strings to avoid rounding Toman. */
export function parseHotelOfflinePaymentSummary(value: unknown): HotelOfflinePaymentSummary | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Record<string, unknown>;
  const totalToman = amount(input.totalToman), paidToman = amount(input.paidToman), outstandingToman = amount(input.outstandingToman);
  if (totalToman === null || paidToman === null || outstandingToman === null || !Array.isArray(input.entries)) return null;
  const entries: HotelOfflinePaymentEntry[] = [];
  for (const raw of input.entries) {
    if (!raw || typeof raw !== "object") return null;
    const entry = raw as Record<string, unknown>;
    const amountToman = amount(entry.amountToman);
    if (typeof entry.id !== "string" || !entry.id || (entry.method !== "CASH" && entry.method !== "BANK_TRANSFER") || (entry.status !== "SUBMITTED" && entry.status !== "VERIFIED") || amountToman === null) return null;
    entries.push({ id: entry.id, method: entry.method, status: entry.status, amountToman,
      ...(typeof entry.createdAt === "string" ? { createdAt: entry.createdAt } : {}),
      ...(typeof entry.hasReceipt === "boolean" ? { hasReceipt: entry.hasReceipt } : {}),
      ...(typeof entry.verifiedAt === "string" ? { verifiedAt: entry.verifiedAt } : entry.verifiedAt === null ? { verifiedAt: null } : {}) });
  }
  return { totalToman, paidToman, outstandingToman, entries };
}

export function hotelOfflinePaymentEndpoint(organizationId: string, propertyId: string, reservationId: string) {
  return `/api/organizations/${encodeURIComponent(organizationId)}/hotels/${encodeURIComponent(propertyId)}/reservations/${encodeURIComponent(reservationId)}/offline-payments`;
}

export function formatHotelToman(value: string, locale: PaymentLocale) {
  try { return `${new Intl.NumberFormat(locale === "fa" ? "fa-IR" : locale, { maximumFractionDigits: 0 }).format(BigInt(value))} تومان`; }
  catch { return `${value} تومان`; }
}

function idempotencyKey() {
  if (typeof crypto === "undefined" || typeof crypto.randomUUID !== "function") throw new Error("Secure idempotency keys are unavailable");
  return `hotel-offline-${crypto.randomUUID()}`;
}

function confirmedMutation(value: unknown, action: "RECORD_CASH" | "VERIFY_BANK_TRANSFER") {
  if (!value || typeof value !== "object") return false;
  const result = value as { outcome?: unknown; entry?: Record<string, unknown> };
  return (result.outcome === "APPLIED" || result.outcome === "REPLAY") && !!result.entry &&
    (action === "RECORD_CASH" ? result.entry.method === "CASH" && result.entry.status === "VERIFIED" : result.entry.method === "BANK_TRANSFER" && result.entry.status === "VERIFIED");
}

/**
 * Reception-only offline-payment ledger UI. `apiWired` defaults false because
 * the target route is not present in this checkout; only pass true after it is
 * implemented and mounted behind the existing authenticated authorization.
 */
export function HotelOfflinePayments({ organizationId, propertyId, reservationId, locale, apiWired = false }: {
  organizationId: string; propertyId: string; reservationId: string; locale: string; apiWired?: boolean;
}) {
  const language: PaymentLocale = locale === "en" || locale === "ar" ? locale : "fa";
  const text = labels[language];
  const endpoint = useMemo(() => hotelOfflinePaymentEndpoint(organizationId, propertyId, reservationId), [organizationId, propertyId, reservationId]);
  const [summary, setSummary] = useState<HotelOfflinePaymentSummary | null>(null);
  const [cashAmount, setCashAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const pendingKeys = useRef(new Map<string, string>());

  const load = useCallback(async () => {
    if (!apiWired) return;
    setLoading(true); setMessage("");
    try {
      const response = await fetch(endpoint, { credentials: "same-origin", cache: "no-store" });
      const data = await response.json().catch(() => null);
      const parsed = parseHotelOfflinePaymentSummary(data);
      if (!response.ok || !parsed) {
        if (response.status === 401 || response.status === 403) throw new Error(text.access);
        throw new Error(text.loadError);
      }
      setSummary(parsed);
    } catch (error) { setMessage(error instanceof Error ? error.message : text.loadError); }
    finally { setLoading(false); }
  }, [apiWired, endpoint, text.access, text.loadError]);

  useEffect(() => { void load(); }, [load]);

  const send = async (action: "RECORD_CASH" | "VERIFY_BANK_TRANSFER", body: Record<string, string>, fingerprint: string) => {
    const existing = pendingKeys.current.get(fingerprint);
    const key = existing || idempotencyKey();
    pendingKeys.current.set(fingerprint, key);
    setBusy(true); setMessage("");
    try {
      const response = await fetch(endpoint, { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json", "idempotency-key": key }, body: JSON.stringify({ action, ...body }) });
      const data = await response.json().catch(() => null);
      if (!response.ok || !confirmedMutation(data, action)) {
        if (response.status === 401 || response.status === 403) throw new Error(text.access);
        throw new Error(typeof data?.error === "string" ? data.error : text.saveError);
      }
      pendingKeys.current.delete(fingerprint);
      setMessage(text.saved);
      await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : text.saveError); }
    finally { setBusy(false); }
  };

  const recordCash = () => {
    if (!summary || !/^[1-9]\d*$/.test(cashAmount) || BigInt(cashAmount) > BigInt(summary.outstandingToman)) { setMessage(text.invalidAmount); return; }
    void send("RECORD_CASH", { amountToman: cashAmount }, `RECORD_CASH:${cashAmount}`);
  };
  const verifyTransfer = (entry: HotelOfflinePaymentEntry) => {
    if (entry.method !== "BANK_TRANSFER" || entry.status !== "SUBMITTED") return;
    void send("VERIFY_BANK_TRANSFER", { ledgerEntryId: entry.id }, `VERIFY_BANK_TRANSFER:${entry.id}`);
  };

  return <section className="space-y-4 rounded-xl border bg-card p-4 sm:p-6" dir={language === "en" ? "ltr" : "rtl"} aria-label={text.title}>
    <header className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-xl font-semibold">{text.title}</h2>
      {apiWired && <button type="button" className="rounded-md border px-3 py-2 text-sm" disabled={loading || busy} onClick={() => void load()}>{text.refresh}</button>}
    </header>
    {!apiWired && <p className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-sm" role="note">{text.notWired}</p>}
    {message && <p className="rounded-md border border-destructive/40 p-3 text-sm" role="alert">{message}</p>}
    {apiWired && loading && <p role="status" className="text-sm text-muted-foreground">{text.loading}</p>}
    {apiWired && summary && <>
      <dl className="grid gap-3 sm:grid-cols-3">
        {[ [text.total, summary.totalToman], [text.paid, summary.paidToman], [text.outstanding, summary.outstandingToman] ].map(([label, value]) => <div key={label} className="rounded-lg border p-3"><dt className="text-sm text-muted-foreground">{label}</dt><dd className="mt-1 font-semibold">{formatHotelToman(value, language)}</dd></div>)}
      </dl>
      <div className="flex flex-wrap items-end gap-2 rounded-lg border p-3">
        <label className="grid gap-1 text-sm"><span>{text.cashAmount}</span><input inputMode="numeric" pattern="[0-9]*" value={cashAmount} onChange={(event) => setCashAmount(event.target.value)} className="min-h-10 rounded-md border bg-background px-3" /></label>
        <button type="button" className="min-h-10 rounded-md bg-primary px-4 text-primary-foreground disabled:opacity-50" disabled={busy || loading || BigInt(summary.outstandingToman) <= BigInt(0)} onClick={recordCash}>{busy ? text.busy : text.recordCash}</button>
      </div>
      {!summary.entries.length && <p className="rounded-lg border p-4 text-sm text-muted-foreground">{text.empty}</p>}
      <ul className="space-y-2">
        {summary.entries.map((entry) => <li key={entry.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
          <div><p className="font-medium">{entry.method === "CASH" ? text.cash : text.transfer} · {formatHotelToman(entry.amountToman, language)}</p><p className="text-sm text-muted-foreground">{entry.status === "VERIFIED" ? text.verified : text.submitted}</p></div>
          {entry.hasReceipt && <a href={`${endpoint}/${encodeURIComponent(entry.id)}/receipt`} target="_blank" rel="noopener noreferrer">{language === "fa" ? "مشاهده رسید" : language === "ar" ? "عرض الإيصال" : "View receipt"}</a>}
          {entry.method === "BANK_TRANSFER" && entry.status === "SUBMITTED" && <button type="button" className="rounded-md border px-3 py-2 text-sm disabled:opacity-50" disabled={busy} onClick={() => verifyTransfer(entry)}>{busy ? text.busy : text.verify}</button>}
        </li>)}
      </ul>
    </>}
  </section>;
}
