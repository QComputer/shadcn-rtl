"use client";

import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { appPath } from "@/lib/app-base-path";

type Locale = "fa" | "en";
type Report = { id: string; orderNumber: string; total: number | string; paymentStatus: string; paymentMethod: string; kind: string; status: string; reportedAt: string | null; createdAt: string; reviewedAt: string | null; reviewedById: string | null; reviewReason: string | null; hasReceipt: boolean };
type Action = "APPROVE" | "REJECT" | "REQUEST_CORRECTION";
const copy = {
  fa: { title: "گزارش‌های پرداخت", intro: "رسیدها و گزارش‌های پرداخت سفارش را بررسی کنید و نتیجه بررسی را ثبت کنید.", reload: "بارگذاری دوباره", loading: "در حال بارگذاری…", empty: "گزارش پرداختی برای بررسی وجود ندارد.", error: "بارگذاری یا ثبت نتیجه انجام نشد. دوباره تلاش کنید.", noReceipt: "برای این گزارش رسیدی بارگذاری نشده است.", order: "سفارش", amount: "مبلغ سفارش", payment: "وضعیت پرداخت", method: "روش پرداخت", kind: "نوع گزارش", reportStatus: "وضعیت بررسی", submitted: "زمان ارسال گزارش", created: "زمان ثبت سفارش", reviewed: "زمان بررسی", reviewer: "شناسه بررسی‌کننده", reason: "دلیل یا پیام برای فروشنده", reasonPlaceholder: "برای رد یا درخواست اصلاح، دلیل را بنویسید", approve: "تأیید پرداخت", reject: "رد گزارش", correction: "درخواست اصلاح", save: "ثبت نتیجه", cancel: "لغو", pending: "در انتظار بررسی", paid: "پرداخت تأیید شده", unpaid: "پرداخت نشده یا تأیید نشده", bank: "انتقال بانکی", cash: "نقدی", card: "کارت بانکی", wallet: "کیف پول", ussd: "کد دستوری اینوتی", time: "گزارش زمان پرداخت", receipt: "رسید بانکی", cashCollection: "گزارش دریافت نقدی", approved: "تأیید شده", rejected: "رد شده", correctionRequested: "اصلاح درخواست شده", openReceipt: "مشاهده رسید", honest: "ارسال گزارش یا رسید به‌تنهایی به معنی پرداخت موفق نیست؛ وضعیت «پرداخت تأیید شده» فقط پس از بررسی ثبت می‌شود.", saved: "نتیجه بررسی ثبت شد." },
  en: { title: "Payment reports", intro: "Inspect order payment reports and receipts, then record your review decision.", reload: "Reload", loading: "Loading…", empty: "There are no payment reports to review.", error: "Could not load reports or save the review. Please try again.", noReceipt: "No receipt was uploaded for this report.", order: "Order", amount: "Order total", payment: "Payment status", method: "Payment method", kind: "Report type", reportStatus: "Review status", submitted: "Report submitted", created: "Order created", reviewed: "Reviewed at", reviewer: "Reviewer ID", reason: "Reason or message to seller", reasonPlaceholder: "Explain why you are rejecting or requesting a correction", approve: "Approve payment", reject: "Reject report", correction: "Request correction", save: "Record decision", cancel: "Cancel", pending: "Awaiting review", paid: "Payment confirmed", unpaid: "Not paid or not confirmed", bank: "Bank transfer", cash: "Cash", card: "Bank card", wallet: "Wallet", ussd: "Inoti USSD", time: "Payment time report", receipt: "Bank receipt", cashCollection: "Cash collection report", approved: "Approved", rejected: "Rejected", correctionRequested: "Correction requested", openReceipt: "View receipt", honest: "Submitting a report or receipt alone does not mean payment succeeded; “Payment confirmed” is shown only after review.", saved: "Review decision recorded." },
} as const;
function displayStatus(value: string, t: typeof copy[Locale]) { if (value === "COMPLETED") return { label: t.paid, style: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200" }; if (["FAILED", "REFUNDED"].includes(value)) return { label: t.unpaid, style: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200" }; return { label: t.pending, style: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200" }; }
function paymentMethod(value: string, t: typeof copy[Locale]) { return value === "BANK_TRANSFER" ? t.bank : value === "CASH" ? t.cash : value === "CREDIT_CARD" || value === "DEBIT_CARD" ? t.card : value === "WALLET" ? t.wallet : value === "INOTI_USSD" ? t.ussd : value; }
function date(value: string | null, locale: Locale) { if (!value) return "—"; const parsed = new Date(value); return Number.isNaN(parsed.valueOf()) ? "—" : new Intl.DateTimeFormat(locale === "fa" ? "fa-IR" : "en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Tehran" }).format(parsed); }

export function RetailPaymentReports({ locale }: { locale: Locale }) {
  const t = copy[locale];
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selected, setSelected] = useState<Report | null>(null);
  const [action, setAction] = useState<Action | null>(null);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const load = useCallback(async () => {
    setLoading(true); setError(""); setNotice("");
    try { const response = await fetch(appPath("/api/dashboard/retail/payment-reports"), { credentials: "same-origin", cache: "no-store" }); const data = await response.json(); if (!response.ok) throw new Error("load"); setReports(Array.isArray(data.reports) ? data.reports : []); }
    catch { setError(t.error); } finally { setLoading(false); }
  }, [t.error]);
  useEffect(() => { void load(); }, [load]);
  function begin(report: Report, next: Action) { setSelected(report); setAction(next); setReason(""); setError(""); }
  async function submitReview() {
    if (!selected || !action) return;
    if (action !== "APPROVE" && !reason.trim()) { setError(t.reasonPlaceholder); return; }
    setSaving(true); setError(""); setNotice("");
    try { const response = await fetch(appPath(`/api/dashboard/retail/payment-reports/${encodeURIComponent(selected.id)}`), { method: "PATCH", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, ...(reason.trim() ? { reason: reason.trim() } : {}) }) }); if (!response.ok) throw new Error("review"); setSelected(null); setAction(null); setReason(""); setNotice(t.saved); await load(); }
    catch { setError(t.error); } finally { setSaving(false); }
  }
  const field = "w-full rounded-lg border bg-background px-3 py-2 text-sm";
  const meta = (label: string, value: ReactNode) => <div className="min-w-0"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 break-words text-sm">{value}</dd></div>;
  const localeActionLabel = action === "APPROVE" ? t.approve : action === "REJECT" ? t.reject : t.correction;
  return <main className="space-y-6 p-4 lg:p-6" dir={locale === "en" ? "ltr" : "rtl"} lang={locale}>
    <header className="flex flex-wrap items-center justify-between gap-4"><div><h1 className="text-2xl font-bold tracking-tight">{t.title}</h1><p className="mt-1 text-sm text-muted-foreground">{t.intro}</p></div><button type="button" onClick={() => void load()} disabled={loading} className="rounded-lg border px-4 py-2 text-sm hover:bg-muted disabled:opacity-50">{t.reload}</button></header>
    <p className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm">{t.honest}</p>
    {error && <p role="alert" className="rounded-lg border border-destructive/40 p-3 text-sm text-destructive">{error}</p>}{notice && <p role="status" className="rounded-lg border border-emerald-500/40 bg-emerald-500/5 p-3 text-sm">{notice}</p>}
    {loading ? <p role="status" className="rounded-xl border p-6 text-sm text-muted-foreground">{t.loading}</p> : reports.length === 0 ? <p className="rounded-xl border p-6 text-sm text-muted-foreground">{t.empty}</p> : <section aria-label={t.title} className="grid gap-4 xl:grid-cols-2">{reports.map(report => {
      const paid = displayStatus(report.paymentStatus, t);
      const review = report.status === "APPROVED" ? t.approved : report.status === "REJECTED" ? t.rejected : report.status === "CORRECTION_REQUESTED" ? t.correctionRequested : t.pending;
      const kind = report.kind === "BANK_TIME" ? t.time : report.kind === "CASH_COLLECTION" ? t.cashCollection : t.receipt;
      const imageUrl = appPath(`/api/dashboard/retail/payment-reports/${encodeURIComponent(report.id)}/receipt`);
      return <article key={report.id} className="space-y-4 rounded-xl border bg-card p-4">
        <header className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-semibold">{t.order} <span dir="ltr" className="font-mono">{report.orderNumber}</span></h2><p className="mt-1 text-sm text-muted-foreground">{t.amount}: {Number(report.total).toLocaleString(locale)} </p></div><span className={`rounded-full px-2.5 py-1 text-xs ${paid.style}`}>{paid.label}</span></header>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">{meta(t.method, paymentMethod(report.paymentMethod, t))}{meta(t.kind, kind)}{meta(t.reportStatus, review)}{meta(t.submitted, date(report.reportedAt, locale))}{meta(t.created, date(report.createdAt, locale))}{meta(t.reviewed, date(report.reviewedAt, locale))}{report.reviewedById && meta(t.reviewer, <span dir="ltr" className="font-mono">{report.reviewedById}</span>)}</dl>
        {report.reviewReason && <p className="rounded-lg bg-muted/60 p-3 text-sm"><span className="font-medium">{t.reason}: </span>{report.reviewReason}</p>}
        {report.hasReceipt ? <div className="space-y-2"><p className="text-sm font-medium">{t.receipt}</p><a href={imageUrl} target="_blank" rel="noreferrer" className="inline-flex rounded-lg border px-3 py-2 text-sm underline underline-offset-4">{t.openReceipt}</a><img src={imageUrl} alt={`${t.receipt} ${report.orderNumber}`} className="max-h-80 max-w-full rounded-lg border object-contain" loading="lazy" /></div> : <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">{t.noReceipt}</p>}
        {report.status === "PENDING_REVIEW" && <div className="flex flex-wrap gap-2 border-t pt-3"><button type="button" onClick={() => begin(report, "APPROVE")} className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-medium text-white">{t.approve}</button><button type="button" onClick={() => begin(report, "REJECT")} className="rounded-lg border border-destructive/50 px-3 py-2 text-sm text-destructive">{t.reject}</button><button type="button" onClick={() => begin(report, "REQUEST_CORRECTION")} className="rounded-lg border px-3 py-2 text-sm">{t.correction}</button></div>}
        {selected?.id === report.id && action && <section aria-label={localeActionLabel} className="space-y-3 rounded-lg border bg-muted/30 p-3"><h3 className="font-medium">{localeActionLabel}</h3><label className="grid gap-1.5 text-sm">{t.reason}<textarea className={field} rows={3} maxLength={1000} required={action !== "APPROVE"} placeholder={t.reasonPlaceholder} value={reason} onChange={event => setReason(event.target.value)} /></label><div className="flex gap-2"><button type="button" onClick={() => void submitReview()} disabled={saving || (action !== "APPROVE" && !reason.trim())} className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">{saving ? t.loading : t.save}</button><button type="button" onClick={() => { setSelected(null); setAction(null); setError(""); }} disabled={saving} className="rounded-lg border px-3 py-2 text-sm">{t.cancel}</button></div></section>}
      </article>;
    })}</section>}
  </main>;
}
