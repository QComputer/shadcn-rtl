"use client";

import Image from "next/image";
import { retailOrderStatusLabel } from "@/lib/retail/order-operations";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { appFetch, appPath } from "@/lib/app-base-path";
import { formatPersianDate, formatToman, toPersianDigits } from "@/lib/persian";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Locale = "fa" | "en";
type OrderSummary = { id: string; orderNumber: string; status: string; type: string; createdAt: string; total: number; paymentStatus: string; paymentMethod: string | null; customer: { name: string | null; phone: string | null } | null };
type Order = OrderSummary & {
  subtotal: number; deliveryFee: number; tax: number; discount: number; deliveryAddress: string | null; notes: string | null;
  legacyOrder: boolean; imageNotice: string | null;
  items: Array<{ id: string; name: string; sku: string | null; options: string[]; quantity: number; unitPrice: number; lineTotal: number; imageUrl: string | null }>;
  history: Array<{ id: string; previousStatus: string | null; newStatus: string; note: string | null; createdAt: string }>;
  actions: Array<{ status: string; label: string }>; canConfirmCash: boolean;
};
type Filters = { query: string; status: string; paymentStatus: string; from: string; to: string; sort: "newest" | "oldest" | "highest" };
type ListResult = { orders: OrderSummary[]; total: number; page: number; pageSize: number; totalPages: number; counts: Array<{ status: string; count: number }> };

const text = {
  fa: { title: "سفارش‌های فروشگاه", intro: "پیگیری وضعیت آماده‌سازی و پرداخت سفارش‌ها در یک نمای روشن و به‌روز.", reload: "تازه‌سازی", loading: "در حال بارگذاری سفارش‌ها…", failed: "دریافت سفارش‌ها انجام نشد. دوباره تلاش کنید.", detailFailed: "جزئیات سفارش دریافت نشد. دوباره تلاش کنید.", empty: "سفارشی با این فیلترها پیدا نشد.", search: "جست‌وجوی شماره سفارش یا مشتری", status: "وضعیت سفارش", allStatuses: "همه وضعیت‌ها", paymentStatus: "وضعیت پرداخت", allPayments: "همه پرداخت‌ها", from: "از تاریخ", to: "تا تاریخ", sort: "مرتب‌سازی", newest: "جدیدترین", oldest: "قدیمی‌ترین", highest: "بیشترین مبلغ", pageSize: "تعداد در صفحه", previous: "قبلی", next: "بعدی", page: "صفحه", of: "از", total: "سفارش", order: "سفارش", customer: "مشتری", date: "زمان ثبت", totalAmount: "مبلغ نهایی", payment: "پرداخت", method: "روش پرداخت", detail: "مشاهده جزئیات", noCustomer: "مشتری مهمان", item: "قلم سفارش", items: "اقلام سفارش", quantity: "تعداد", unitPrice: "قیمت واحد", lineTotal: "جمع ردیف", sku: "شناسه کالا", options: "ویژگی‌ها", address: "نشانی تحویل", notes: "یادداشت سفارش", history: "تاریخچه تغییر وضعیت", noHistory: "تغییری ثبت نشده است.", before: "وضعیت پیشین", after: "وضعیت جدید", subtotal: "جمع کالاها", delivery: "هزینه ارسال", tax: "مالیات", discount: "تخفیف", cashConfirm: "تأیید دریافت نقدی", cashWarning: "با تأیید، دریافت وجه نقد به‌صورت قطعی ثبت می‌شود و وضعیت پرداخت به «تأیید شده» تغییر می‌کند. این عملیات را فقط پس از دریافت واقعی وجه انجام دهید.", confirm: "تأیید و ثبت دریافت", cancel: "بازگشت", saving: "در حال ثبت…", cashSaved: "دریافت وجه نقد ثبت شد؛ وضعیت پرداخت به‌روز شد.", statusSaved: "وضعیت سفارش به‌روز شد.", mutationError: "ثبت تغییر انجام نشد. وضعیت سفارش را تازه‌سازی و دوباره بررسی کنید.", staleError: "این سفارش هم‌زمان تغییر کرده است. جزئیات تازه را بررسی کنید.", permissionError: "برای انجام این تغییر دسترسی ندارید.", notFoundError: "این سفارش دیگر در دسترس نیست.", returnBoundary: "سفارش تحویل‌شده پایان فرایند عملیاتی فروشگاه است. بررسی بازپرداخت یا اختلاف پرداخت از این صفحه انجام نمی‌شود.", reports: "گزارش‌های پرداخت", openReports: "رفتن به گزارش‌های پرداخت", noAddress: "نشانی ثبت نشده است", notPaid: "در انتظار پرداخت", paid: "پرداخت تأیید شده", failedPayment: "ناموفق", refunded: "بازپرداخت‌شده", pending: "در انتظار بررسی", bank: "انتقال بانکی", cash: "نقدی", card: "کارت بانکی", wallet: "کیف پول", pickup: "تحویل حضوری", deliveryType: "ارسال با پیک", orderStatus: "وضعیت سفارش", apply: "اعمال", clear: "پاک‌کردن فیلتر", showing: "نمایش", count: "مورد", counts: "نمای کلی وضعیت سفارش", dateInvalid: "تاریخ شروع باید پیش از تاریخ پایان باشد.", galleryNotice: "تصاویر این کالا از گالری فعلی نمایش داده می‌شوند و ممکن است با تصاویر زمان ثبت سفارش تفاوت داشته باشند.", callCustomer: "تماس با مشتری" },
  en: { title: "Store orders", intro: "Track fulfillment and payment for every order in one clear, current view.", reload: "Refresh", loading: "Loading orders…", failed: "Could not load orders. Please try again.", detailFailed: "Could not load order details. Please try again.", empty: "No orders match these filters.", search: "Search order number or customer", status: "Order status", allStatuses: "All statuses", paymentStatus: "Payment status", allPayments: "All payments", from: "From date", to: "To date", sort: "Sort", newest: "Newest", oldest: "Oldest", highest: "Highest total", pageSize: "Per page", previous: "Previous", next: "Next", page: "Page", of: "of", total: "orders", order: "Order", customer: "Customer", date: "Created", totalAmount: "Total", payment: "Payment", method: "Method", detail: "View details", noCustomer: "Guest customer", item: "item", items: "Order items", quantity: "Quantity", unitPrice: "Unit price", lineTotal: "Line total", sku: "SKU", options: "Options", address: "Delivery address", notes: "Order notes", history: "Status history", noHistory: "No status changes recorded.", before: "Previous status", after: "New status", subtotal: "Subtotal", delivery: "Delivery fee", tax: "Tax", discount: "Discount", cashConfirm: "Confirm cash collection", cashWarning: "Confirming records cash as received and changes payment status to confirmed. Only do this after you have actually received the money.", confirm: "Confirm collection", cancel: "Go back", saving: "Saving…", cashSaved: "Cash collection recorded and payment status refreshed.", statusSaved: "Order status updated.", mutationError: "Could not save the change. Refresh the order and check again.", staleError: "This order changed while you were viewing it. Review the refreshed details.", permissionError: "You do not have permission to make this change.", notFoundError: "This order is no longer available.", returnBoundary: "A delivered order marks the end of store fulfillment. Refunds and payment disputes are not handled on this page.", reports: "Payment reports", openReports: "Open payment reports", noAddress: "No address provided", notPaid: "Awaiting payment", paid: "Payment confirmed", failedPayment: "Failed", refunded: "Refunded", pending: "Pending review", bank: "Bank transfer", cash: "Cash", card: "Bank card", wallet: "Wallet", pickup: "Pickup", deliveryType: "Courier delivery", orderStatus: "Order status", apply: "Apply", clear: "Clear filters", showing: "Showing", count: "items", counts: "Order status overview", dateInvalid: "Start date must be before end date.", galleryNotice: "Images come from the product's current gallery and may differ from those shown when this order was placed.", callCustomer: "Call customer" },
} as const;

const statusNames: Record<string, { fa: string; en: string }> = {
  PENDING: { fa: "در انتظار تأیید", en: "Pending" }, PLACED: { fa: "ثبت‌شده", en: "Placed" }, ACCEPTED: { fa: "پذیرفته‌شده", en: "Accepted" }, CONFIRMED: { fa: "تأییدشده", en: "Confirmed" }, PREPARING: { fa: "در حال آماده‌سازی", en: "Preparing" }, READY: { fa: "آماده تحویل", en: "Ready" }, SHIPPED: { fa: "ارسال‌شده", en: "Shipped" }, DELIVERED: { fa: "تحویل‌شده", en: "Delivered" }, RECEIVED: { fa: "دریافت‌شده", en: "Received" }, COMPLETED: { fa: "تکمیل‌شده", en: "Completed" }, CANCELLED: { fa: "لغوشده", en: "Cancelled" }, REFUNDED: { fa: "بازپرداخت‌شده", en: "Refunded" }, REJECTED: { fa: "ردشده", en: "Rejected" }, PICKED_UP: { fa: "تحویل حضوری‌شده", en: "Picked up" }, PROCESSING: { fa: "در حال پردازش", en: "Processing" },
};
function statusLabel(value: string, locale: Locale, type?: string) {
  if (locale === "fa") return retailOrderStatusLabel(value, type);
  if (value === "PICKED_UP" && type) return type === "DELIVERY" ? "Dispatched" : "Collected";
  return statusNames[value]?.[locale] ?? value.replaceAll("_", " ");
}
function paymentLabel(value: string | null, locale: Locale) {
  if (!value) return locale === "fa" ? "ثبت نشده" : "Not recorded";
  const labels: Record<string, { fa: string; en: string }> = { PENDING: { fa: "در انتظار پرداخت", en: "Awaiting payment" }, PENDING_REVIEW: { fa: "در انتظار بررسی", en: "Pending review" }, COMPLETED: { fa: "تأیید شده", en: "Confirmed" }, FAILED: { fa: "ناموفق", en: "Failed" }, REFUNDED: { fa: "بازپرداخت‌شده", en: "Refunded" }, BANK_TRANSFER: { fa: "انتقال بانکی", en: "Bank transfer" }, CASH: { fa: "نقدی", en: "Cash" }, CREDIT_CARD: { fa: "کارت بانکی", en: "Bank card" }, DEBIT_CARD: { fa: "کارت بانکی", en: "Bank card" }, WALLET: { fa: "کیف پول", en: "Wallet" }, INOTI_USSD: { fa: "کد دستوری اینوتی", en: "Inoti USSD" } };
  return labels[value]?.[locale] ?? value.replaceAll("_", " ");
}
function formatDate(value: string, locale: Locale) { return locale === "fa" ? formatPersianDate(value, "datetime") : new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }
function statusTone(status: string) { if (["DELIVERED", "COMPLETED", "PICKED_UP"].includes(status)) return "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"; if (["CANCELLED", "REJECTED"].includes(status)) return "border-rose-500/30 bg-rose-500/10 text-rose-800 dark:text-rose-200"; if (["READY", "SHIPPED"].includes(status)) return "border-sky-500/30 bg-sky-500/10 text-sky-800 dark:text-sky-200"; return "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200"; }
function paymentTone(status: string) { return status === "COMPLETED" ? "text-emerald-700 dark:text-emerald-300" : ["FAILED", "REFUNDED"].includes(status) ? "text-rose-700 dark:text-rose-300" : "text-amber-700 dark:text-amber-300"; }
const initialFilters: Filters = { query: "", status: "", paymentStatus: "", from: "", to: "", sort: "newest" };
const orderStatuses = ["PENDING", "PLACED", "ACCEPTED", "PREPARING", "READY", "PICKED_UP", "DELIVERED", "RECEIVED", "CANCELLED", "REFUNDED"];
const paymentStatuses = ["PENDING", "COMPLETED", "FAILED", "REFUNDED"];
const knownHistoryNotes: Record<string, { fa: string; en: string }> = {
  "Order created": { fa: "سفارش ثبت شد", en: "Order created" },
  "Guest order created": { fa: "ثبت سفارش مهمان", en: "Guest order created" },
  "Order status updated": { fa: "وضعیت سفارش به‌روزرسانی شد", en: "Order status updated" },
  "Order cancelled": { fa: "سفارش لغو شد", en: "Order cancelled" },
};
function historyNote(note: string, locale: Locale) { return knownHistoryNotes[note]?.[locale] ?? note; }
function apiError(status: number, locale: Locale) { if (status === 409) return text[locale].staleError; if (status === 403) return text[locale].permissionError; if (status === 404) return text[locale].notFoundError; return text[locale].mutationError; }

export function MerchantOrders({ locale }: { locale: Locale }) {
  const t = text[locale];
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [appliedFilters, setAppliedFilters] = useState<Filters>(initialFilters);
  const [page, setPage] = useState(1);
  const [advancedFilters, setAdvancedFilters] = useState(false);
  const [pageSize, setPageSize] = useState(20);
  const [list, setList] = useState<ListResult>({ orders: [], total: 0, page: 1, pageSize: 20, totalPages: 0, counts: [] });
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<Order | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedNumber, setSelectedNumber] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<{ status: string; label: string } | null>(null);
  const [cashConfirm, setCashConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [dateError, setDateError] = useState("");
  const mutationLock = useRef(false);
  const listRequestId = useRef(0);
  const detailRequestId = useRef(0);
  const params = useMemo(() => {
    const search = new URLSearchParams({ page: String(page), pageSize: String(pageSize), sort: appliedFilters.sort });
    if (appliedFilters.query.trim()) search.set("query", appliedFilters.query.trim());
    if (appliedFilters.status) search.set("status", appliedFilters.status);
    if (appliedFilters.paymentStatus) search.set("paymentStatus", appliedFilters.paymentStatus);
    if (appliedFilters.from) search.set("from", appliedFilters.from);
    if (appliedFilters.to) search.set("to", appliedFilters.to);
    return search.toString();
  }, [appliedFilters, page, pageSize]);
  const loadList = useCallback(async () => {
    const requestId = ++listRequestId.current;
    setLoading(true); setError("");

    try {
      const response = await appFetch(`/api/dashboard/retail/orders?${params}`, { credentials: "same-origin", cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error("list");
      if (requestId === listRequestId.current) setList({ orders: Array.isArray(data.orders) ? data.orders : [], total: Number(data.total) || 0, page: Number(data.page) || page, pageSize: Number(data.pageSize) || pageSize, totalPages: Number(data.totalPages) || 0, counts: Array.isArray(data.counts) ? data.counts : [] });
    } catch { if (requestId === listRequestId.current) setError(t.failed); }
    finally { if (requestId === listRequestId.current) setLoading(false); }
  }, [page, pageSize, params, t.failed]);
  useEffect(() => {
    // Coalesce rapid page/filter changes and cancel scheduled requests on unmount.
    const requests = listRequestId;
    const timer = setTimeout(() => { void loadList(); }, 120);
    return () => { clearTimeout(timer); requests.current++; };
  }, [loadList]);

  async function openDetail(orderNumber: string) {
    const requestId = ++detailRequestId.current;
    setSelectedNumber(orderNumber); setDetail(null); setDetailLoading(true); setError(""); setNotice(""); setPendingAction(null); setCashConfirm(false);
    try {
      const response = await appFetch(`/api/dashboard/retail/orders/${encodeURIComponent(orderNumber)}`, { credentials: "same-origin", cache: "no-store" });
      const data = await response.json();
      if (!response.ok || !data.order) throw new Error("detail");
      if (requestId === detailRequestId.current) setDetail(data.order as Order);
    } catch { if (requestId === detailRequestId.current) setError(t.detailFailed); }
    finally { if (requestId === detailRequestId.current) setDetailLoading(false); }
  }

  async function refreshDetail() {
    if (!selectedNumber) return;
    const orderNumber = selectedNumber;
    const requestId = detailRequestId.current;
    try {
      const response = await appFetch(`/api/dashboard/retail/orders/${encodeURIComponent(orderNumber)}`, { credentials: "same-origin", cache: "no-store" });
      const data = await response.json();
      if (!response.ok || !data.order) throw new Error("detail");
      if (requestId === detailRequestId.current && orderNumber === selectedNumber) setDetail(data.order as Order);
      return requestId === detailRequestId.current && orderNumber === selectedNumber;
    } catch { if (requestId === detailRequestId.current && orderNumber === selectedNumber) setError(t.detailFailed); return false; }
  }

  async function mutate(kind: "status" | "cash", status?: string) {
    if (!detail || !selectedNumber || mutationLock.current) return;
    mutationLock.current = true; setBusy(true); setError(""); setNotice("");
    try {
      const response = kind === "cash"
        ? await appFetch(`/api/dashboard/retail/orders/${encodeURIComponent(selectedNumber)}/cash-collection`, { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: "{}" })
        : await appFetch(`/api/dashboard/retail/orders/${encodeURIComponent(selectedNumber)}`, { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify({ status, expectedStatus: detail.status }) });
      if (!response.ok) {
        if (response.status === 409 && kind === "status") {
          setPendingAction(null);
          await refreshDetail();
        }
        setError(apiError(response.status, locale));
        return;
      }
      if (kind === "cash") { await refreshDetail(); setNotice(t.cashSaved); setCashConfirm(false); }
      else { setNotice(t.statusSaved); setPendingAction(null); await refreshDetail(); }
      await loadList();
    } catch { setError(t.mutationError); }
    finally { setBusy(false); mutationLock.current = false; }
  }

  function updateFilter<K extends keyof Filters>(key: K, value: Filters[K]) { setFilters(current => ({ ...current, [key]: value })); }
  function applyFilters() {
    if (filters.from && filters.to && filters.from > filters.to) { setDateError(t.dateInvalid); return; }
    setDateError(""); setPage(1); setAppliedFilters(filters);
  }
  const field = "h-10 w-full rounded-xl border border-border/80 bg-background px-3 text-sm shadow-sm outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-primary/15";
  const card = "rounded-2xl border border-border/70 bg-card shadow-sm";

  return <main className="min-h-full space-y-6 p-4 lg:p-7" dir={locale === "en" ? "ltr" : "rtl"} lang={locale}>
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div><p className="mb-2 text-xs font-semibold tracking-wide text-primary">{locale === "fa" ? "مدیریت فروشگاه" : "STORE OPERATIONS"}</p><h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t.title}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{t.intro}</p></div>
      <div className="flex flex-wrap gap-2"><a href={appPath(`/${locale}/dashboard/retail-payment-reports`)} className="inline-flex h-10 items-center rounded-xl border px-4 text-sm font-medium transition hover:bg-muted">{t.openReports}</a><button type="button" onClick={() => void loadList()} disabled={loading} className="h-10 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-90 disabled:opacity-50">{t.reload}</button></div>
    </header>

    <section aria-label={t.counts} className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <div className={`${card} flex items-center justify-between p-4`}><span className="text-sm text-muted-foreground">{t.total}</span><strong className="text-2xl tabular-nums">{toPersianDigits(list.total)}</strong></div>
      {list.counts.map(item => <div key={item.status} className={`${card} flex items-center justify-between gap-3 p-4`}><span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${statusTone(item.status)}`}>{statusLabel(item.status, locale)}</span><strong className="text-2xl tabular-nums">{toPersianDigits(item.count)}</strong></div>)}
    </section>

    <section className={`${card} space-y-4 p-4 sm:p-5`} aria-label={t.title}>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <label className="grid gap-1.5 text-xs font-medium text-muted-foreground sm:col-span-2">{t.search}<input className={field} value={filters.query} onChange={event => updateFilter("query", event.target.value)} onKeyDown={event => { if (event.key === "Enter") applyFilters(); }} placeholder={t.search} /></label>
        <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">{t.status}<select className={field} value={filters.status} onChange={event => updateFilter("status", event.target.value)}><option value="">{t.allStatuses}</option>{orderStatuses.map(value => <option key={value} value={value}>{statusLabel(value, locale)}</option>)}</select></label>
        <div className={advancedFilters ? "contents" : "hidden sm:contents"}>
        <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">{t.paymentStatus}<select className={field} value={filters.paymentStatus} onChange={event => updateFilter("paymentStatus", event.target.value)}><option value="">{t.allPayments}</option>{paymentStatuses.map(value => <option key={value} value={value}>{paymentLabel(value, locale)}</option>)}</select></label>
        <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">{t.from}<input className={field} type="date" value={filters.from} onChange={event => updateFilter("from", event.target.value)} /></label>
        <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">{t.to}<input className={field} type="date" value={filters.to} onChange={event => updateFilter("to", event.target.value)} /></label>
        <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">{t.sort}<select className={field} value={filters.sort} onChange={event => updateFilter("sort", event.target.value as Filters["sort"])}><option value="newest">{t.newest}</option><option value="oldest">{t.oldest}</option><option value="highest">{t.highest}</option></select></label>
        <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">{t.pageSize}<select className={field} value={pageSize} onChange={event => { setPageSize(Number(event.target.value)); setPage(1); }}><option value={10}>۱۰</option><option value={20}>۲۰</option><option value={50}>۵۰</option></select></label>
        </div>
      </div>
      <button type="button" aria-expanded={advancedFilters} onClick={() => setAdvancedFilters(value => !value)} className="rounded-lg border px-3 py-2 text-sm sm:hidden">{locale === "fa" ? (advancedFilters ? "بستن فیلترهای بیشتر" : "فیلتر پرداخت، تاریخ و مرتب‌سازی") : "More filters"}</button>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/70 pt-4"><p className="text-xs text-muted-foreground">{t.showing} {toPersianDigits(list.orders.length)} {t.count} · {toPersianDigits(list.total)} {t.total}</p><div className="flex gap-2"><button type="button" onClick={() => { setFilters(initialFilters); setAppliedFilters(initialFilters); setDateError(""); setPage(1); }} className="h-9 rounded-lg px-3 text-sm text-muted-foreground transition hover:bg-muted">{t.clear}</button><button type="button" onClick={applyFilters} className="h-9 rounded-lg border border-primary/30 bg-primary/5 px-4 text-sm font-semibold text-primary transition hover:bg-primary/10">{t.apply}</button></div></div>
      {dateError && <p role="alert" className="text-sm text-destructive">{dateError}</p>}
    </section>

    {error && !selectedNumber && <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
    {loading ? <div role="status" className={`${card} p-8 text-center text-sm text-muted-foreground`}>{t.loading}</div> : list.orders.length === 0 ? <div className={`${card} p-10 text-center`}><div className="mx-auto mb-3 grid size-12 place-items-center rounded-full bg-muted text-xl">⌕</div><p className="font-medium">{t.empty}</p></div> : <section className="grid gap-3 xl:grid-cols-2">{list.orders.map(order => <article key={order.id} className={`${card} ${["PENDING", "PLACED", "READY"].includes(order.status) ? "border-s-4 border-s-amber-500" : ""} group p-4 transition hover:border-primary/25 hover:shadow-md sm:p-5`}>
      <div className="flex flex-wrap items-start justify-between gap-3"><button type="button" onClick={() => void openDetail(order.orderNumber)} className="text-start"><span className="text-xs text-muted-foreground">{t.order}{["PENDING", "PLACED", "READY"].includes(order.status) && <strong className="ms-2 text-amber-700">{locale === "fa" ? "نیازمند اقدام" : "Needs action"}</strong>}</span><h2 className="mt-1 font-mono text-lg font-bold tracking-tight" dir="ltr">{order.orderNumber}</h2></button><span className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusTone(order.status)}`}>{statusLabel(order.status, locale, order.type)}</span></div>
      <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3"><div><p className="text-xs text-muted-foreground">{t.customer}</p><p className="mt-1 truncate font-medium">{order.customer?.name || t.noCustomer}</p>{order.customer?.phone && <p dir="ltr" className="mt-0.5 text-start text-xs text-muted-foreground">{order.customer.phone}</p>}</div><div><p className="text-xs text-muted-foreground">{t.date}</p><p className="mt-1">{formatDate(order.createdAt, locale)}</p></div><div><p className="text-xs text-muted-foreground">{t.totalAmount}</p><p className="mt-1 font-bold tabular-nums">{formatToman(order.total)}</p></div></div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border/70 pt-3"><div className={`text-sm font-medium ${paymentTone(order.paymentStatus)}`}>{t.payment}: {paymentLabel(order.paymentStatus, locale)} <span className="font-normal text-muted-foreground">· {paymentLabel(order.paymentMethod, locale)}</span></div><button type="button" onClick={() => void openDetail(order.orderNumber)} className="rounded-lg px-3 py-1.5 text-sm font-semibold text-primary transition hover:bg-primary/5">{t.detail} ←</button></div>
    </article>)}</section>}

    {!loading && list.totalPages > 1 && <nav aria-label={t.page} className="flex flex-wrap items-center justify-center gap-3"><button type="button" disabled={page <= 1} onClick={() => setPage(value => Math.max(1, value - 1))} className="rounded-lg border px-4 py-2 text-sm disabled:opacity-40">{t.previous}</button><span className="text-sm text-muted-foreground">{t.page} {toPersianDigits(page)} {t.of} {toPersianDigits(list.totalPages)}</span><button type="button" disabled={page >= list.totalPages} onClick={() => setPage(value => Math.min(list.totalPages, value + 1))} className="rounded-lg border px-4 py-2 text-sm disabled:opacity-40">{t.next}</button></nav>}

    <Dialog open={selectedNumber !== null} onOpenChange={open => { if (!open && !busy) { detailRequestId.current += 1; setSelectedNumber(null); setDetail(null); setDetailLoading(false); setError(""); setNotice(""); } }}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto p-4 sm:p-6">
        <DialogHeader><DialogTitle>{t.order} <span dir="ltr" className="font-mono">{selectedNumber}</span></DialogTitle><DialogDescription>{detail ? `${statusLabel(detail.status, locale, detail.type)} · ${formatDate(detail.createdAt, locale)}` : t.loading}</DialogDescription></DialogHeader>
        {error && selectedNumber && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}{notice && <p role="status" className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm">{notice}</p>}
        {detailLoading ? <div role="status" className="py-8 text-center text-sm text-muted-foreground">{t.loading}</div> : !detail ? <div className="space-y-3 py-6 text-center"><p className="text-sm text-muted-foreground">{t.detailFailed}</p><button type="button" onClick={() => selectedNumber && void openDetail(selectedNumber)} className="rounded-lg border px-3 py-2 text-sm">{t.reload}</button></div> : <div className="space-y-5">
          {detail.legacyOrder && <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm leading-6"><p>{locale === "fa" ? "این سفارش قدیمی و فقط‌خواندنی است؛ تغییر وضعیت یا ثبت دریافت وجه از این صفحه ممکن نیست." : "This legacy order is read-only here; status and payment changes are unavailable."}</p><a className="mt-2 inline-flex font-semibold text-primary underline-offset-4 hover:underline" href={appPath(`/${locale}/dashboard/orders`)}>{locale === "fa" ? "مشاهده در مدیریت عمومی سفارش‌ها" : "Open general order management"}</a></div>}
          <section className="grid gap-3 rounded-xl border bg-muted/20 p-4 sm:grid-cols-2"><div><p className="text-xs text-muted-foreground">{t.customer}</p><p className="mt-1 font-medium">{detail.customer?.name || t.noCustomer}</p>{detail.customer?.phone && <a href={`tel:${detail.customer.phone}`} dir="ltr" className="mt-2 inline-flex items-center rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground">{t.callCustomer}: {detail.customer.phone}</a>}</div><div><p className="text-xs text-muted-foreground">{t.payment} · {t.method}</p><p className={`mt-1 font-medium ${paymentTone(detail.paymentStatus)}`}>{paymentLabel(detail.paymentStatus, locale)} · {paymentLabel(detail.paymentMethod, locale)}</p><p className="mt-1 text-xs text-muted-foreground">{statusLabel(detail.status, locale, detail.type)}</p></div>{detail.deliveryAddress && <div className="sm:col-span-2"><p className="text-xs text-muted-foreground">{t.address}</p><p className="mt-1 text-sm leading-6">{detail.deliveryAddress || t.noAddress}</p></div>}{detail.notes && <div className="sm:col-span-2"><p className="text-xs text-muted-foreground">{t.notes}</p><p className="mt-1 text-sm leading-6">{detail.notes}</p></div>}</section>
          <section className="space-y-3"><h3 className="font-semibold">{t.items}</h3>{detail.imageNotice && <p className="rounded-lg border border-amber-500/25 bg-amber-500/5 p-3 text-xs leading-5 text-muted-foreground">{detail.imageNotice}</p>}{detail.items.map(item => <article key={item.id} className="flex gap-3 rounded-xl border p-3"><div className="size-16 shrink-0 overflow-hidden rounded-lg bg-muted">{item.imageUrl && <Image unoptimized width={80} height={80} src={item.imageUrl} alt="" className="size-full object-cover" />}</div><div className="min-w-0 flex-1"><h4 className="font-medium">{item.name}</h4><div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">{item.sku && <span>{t.sku}: <bdi dir="ltr">{item.sku}</bdi></span>}{item.options?.length > 0 && <span>{t.options}: {item.options.join("، ")}</span>}</div><div className="mt-2 flex flex-wrap justify-between gap-2 text-xs"><span>{t.quantity}: {toPersianDigits(item.quantity)} × {formatToman(item.unitPrice)}</span><strong>{formatToman(item.lineTotal)}</strong></div></div></article>)}</section>
          <section className="space-y-2 rounded-xl border p-4 text-sm"><div className="flex justify-between gap-4"><span className="text-muted-foreground">{t.subtotal}</span><span>{formatToman(detail.subtotal)}</span></div><div className="flex justify-between gap-4"><span className="text-muted-foreground">{t.delivery}</span><span>{formatToman(detail.deliveryFee)}</span></div><div className="flex justify-between gap-4"><span className="text-muted-foreground">{t.tax}</span><span>{formatToman(detail.tax)}</span></div><div className="flex justify-between gap-4"><span className="text-muted-foreground">{t.discount}</span><span>−{formatToman(detail.discount)}</span></div><div className="flex justify-between gap-4 border-t pt-2 font-bold"><span>{t.totalAmount}</span><span>{formatToman(detail.total)}</span></div></section>
          <section className="space-y-3"><h3 className="font-semibold">{t.history}</h3>{detail.history.length ? <ol className="space-y-0 border-s border-border ps-4">{detail.history.map(entry => <li key={entry.id} className="relative pb-4 last:pb-0"><span className="absolute -start-[21px] top-1 size-2.5 rounded-full border-2 border-primary bg-background" /><p className="text-sm font-medium">{entry.previousStatus ? `${statusLabel(entry.previousStatus, locale, detail.type)} ← ` : ""}{statusLabel(entry.newStatus, locale, detail.type)}</p><p className="mt-1 text-xs text-muted-foreground">{formatDate(entry.createdAt, locale)}</p>{entry.note && <p className="mt-2 rounded-lg bg-muted/60 p-2 text-sm">{historyNote(entry.note, locale)}</p>}</li>)}</ol> : <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">{t.noHistory}</p>}</section>
          {(detail.status === "DELIVERED" || detail.type === "PICK_UP" && detail.status === "PICKED_UP") && <p className="rounded-xl border border-sky-500/30 bg-sky-500/5 p-3 text-sm leading-6 text-muted-foreground">{t.returnBoundary}</p>}
          {!detail.legacyOrder && <section className="space-y-2 border-t pt-4"><h3 className="text-sm font-semibold">{t.orderStatus}</h3><div className="flex flex-wrap gap-2">{detail.actions.map(action => <button key={action.status} type="button" disabled={busy || action.status === detail.status} onClick={() => setPendingAction(action)} className="rounded-lg border border-primary/30 px-3 py-2 text-sm font-medium text-primary transition hover:bg-primary/5 disabled:opacity-40">{action.label}</button>)}{detail.canConfirmCash && <button type="button" disabled={busy} onClick={() => setCashConfirm(true)} className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:opacity-50">{t.cashConfirm}</button>}</div></section>}
        </div>}
        <DialogFooter className="flex-row justify-between border-t pt-3"><a href={appPath(`/${locale}/dashboard/retail-payment-reports`)} className="text-sm font-medium text-primary underline-offset-4 hover:underline">{t.reports}</a><button type="button" onClick={() => selectedNumber && void openDetail(selectedNumber)} disabled={busy || detailLoading} className="rounded-lg border px-3 py-2 text-sm">{t.reload}</button></DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog open={pendingAction !== null} onOpenChange={open => { if (!open && !busy) setPendingAction(null); }}><DialogContent className="max-w-md"><DialogHeader><DialogTitle>{pendingAction?.label}</DialogTitle><DialogDescription>{locale === "fa" ? "وضعیت سفارش پس از ثبت از سوی سرور بازخوانی می‌شود." : "The server will return the updated order status after saving."}</DialogDescription></DialogHeader><DialogFooter><button type="button" disabled={busy} onClick={() => setPendingAction(null)} className="rounded-lg border px-4 py-2 text-sm">{t.cancel}</button><button type="button" disabled={busy || !pendingAction} onClick={() => pendingAction && void mutate("status", pendingAction.status)} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">{busy ? t.saving : pendingAction?.label}</button></DialogFooter></DialogContent></Dialog>

    <Dialog open={cashConfirm} onOpenChange={open => { if (!open && !busy) setCashConfirm(false); }}><DialogContent className="max-w-md"><DialogHeader><DialogTitle>{t.cashConfirm}</DialogTitle><DialogDescription className="leading-6">{t.cashWarning}</DialogDescription></DialogHeader><DialogFooter><button type="button" disabled={busy} onClick={() => setCashConfirm(false)} className="rounded-lg border px-4 py-2 text-sm">{t.cancel}</button><button type="button" disabled={busy} onClick={() => void mutate("cash")} className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? t.saving : t.confirm}</button></DialogFooter></DialogContent></Dialog>
  </main>;
}
