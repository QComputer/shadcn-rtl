"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { appPath } from "@/lib/app-base-path";

type PaymentMethod = {
  method: "BANK_TRANSFER" | "CASH" | "INOTI_USSD";
  label: string;
  cashModes?: string[];
  bankCardNumber?: string | null;
  bankAccountOwner?: string | null;
  dialString?: string;
};
type CartItem = { id?: string; name?: string; productName?: string; variantName?: string; quantity?: number; variant?: { name?: string; product?: { name?: string } } };
type Cart = { items?: CartItem[] };
type OrderResult = { orderNumber: string; total: string; paymentStatus: string; orderStatus: string; paymentMethod: PaymentMethod["method"]; trackingToken?: string | null; bankCardNumber?: string | null; bankAccountOwner?: string | null };

const money = (value: number) => `${new Intl.NumberFormat("fa-IR").format(value)} تومان`;
const statusText: Record<string, string> = {
  PENDING: "در انتظار بررسی", PAID: "پرداخت‌شده", UNPAID: "پرداخت‌نشده", AWAITING_PAYMENT: "در انتظار پرداخت",
  CONFIRMED: "تأییدشده", PROCESSING: "در حال آماده‌سازی", COMPLETED: "تکمیل‌شده", CANCELLED: "لغوشده",
};
const cashModeText: Record<string, string> = { COUNTER: "پرداخت در پیشخوان فروشگاه", PICKUP: "پرداخت هنگام تحویل حضوری", COURIER: "پرداخت به پیک هنگام تحویل" };
const errorMessage = (value: unknown) => {
  if (value && typeof value === "object" && "error" in value && typeof value.error === "string") return value.error;
  return "درخواست انجام نشد. لطفاً دوباره تلاش کنید.";
};

function isoWithLocalOffset(local: string) {
  const date = new Date(local);
  if (Number.isNaN(date.getTime())) throw new Error("زمان پرداخت را به‌درستی وارد کنید.");
  const offset = -date.getTimezoneOffset();
  const sign = offset >= 0 ? "+" : "-";
  const hh = String(Math.floor(Math.abs(offset) / 60)).padStart(2, "0");
  const mm = String(Math.abs(offset) % 60).padStart(2, "0");
  return `${local.length === 16 ? `${local}:00` : local}${sign}${hh}:${mm}`;
}

export default function RetailCheckoutClient({ locale, organization, storefrontPath, checkoutPath }: { locale: string; organization: string; storefrontPath?: string; checkoutPath?: string }) {
  const org = useMemo(() => decodeURIComponent(organization), [organization]);
  const nativeStorefrontPath = appPath(storefrontPath ?? `/${encodeURIComponent(locale)}/retail/${encodeURIComponent(org)}`);
  const nativeCheckoutPath = appPath(checkoutPath ?? `/${encodeURIComponent(locale)}/retail/${encodeURIComponent(org)}/checkout`);
  const [cart, setCart] = useState<Cart | null>(null);
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [error, setError] = useState("");
  const [type, setType] = useState<"PICK_UP" | "DELIVERY">("PICK_UP");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [cashMode, setCashMode] = useState("");
  const [order, setOrder] = useState<OrderResult | null>(null);
  const [reportMode, setReportMode] = useState<"RECEIPT" | "TIME">("RECEIPT");
  const [receipt, setReceipt] = useState<File | null>(null);
  const [reportedAt, setReportedAt] = useState("");
  const [reportSubmitted, setReportSubmitted] = useState(false);
  const [reportMessage, setReportMessage] = useState("");
  const checkoutKey = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const query = `?organization=${encodeURIComponent(org)}`;
    void Promise.all([
      fetch(appPath(`/api/retail/v1/cart${query}`), { credentials: "same-origin", cache: "no-store", headers: { accept: "application/json" } }),
      fetch(appPath(`/api/retail/v1/payment-methods${query}`), { credentials: "same-origin", cache: "no-store", headers: { accept: "application/json" } }),
    ]).then(async ([cartResponse, methodsResponse]) => {
      if (cancelled) return;
      if (cartResponse.status === 401 || methodsResponse.status === 401) { setAuthenticated(false); return; }
      const [cartBody, methodsBody] = await Promise.all([cartResponse.json(), methodsResponse.json()]);
      if (!cartResponse.ok) throw new Error(errorMessage(cartBody));
      if (!methodsResponse.ok) throw new Error(errorMessage(methodsBody));
      setCart(cartBody.cart ?? null);
      const available = Array.isArray(methodsBody.methods) ? methodsBody.methods as PaymentMethod[] : [];
      setMethods(available);
      setPaymentMethod(available[0]?.method ?? "");
      const firstCash = available.find((method) => method.method === "CASH")?.cashModes?.[0];
      setCashMode(firstCash ?? "");
      setAuthenticated(true);
    }).catch((reason: unknown) => { if (!cancelled) setError(reason instanceof Error ? reason.message : "دریافت سبد خرید ممکن نشد."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [org]);

  const selectedMethod = methods.find((method) => method.method === paymentMethod);
  const availableCashModes = selectedMethod?.cashModes?.filter((mode) => mode === "COUNTER" ||
    (mode === "PICKUP" && type === "PICK_UP") || (mode === "COURIER" && type === "DELIVERY")) ?? [];
  const loginHref = appPath(`/${encodeURIComponent(locale)}/login?callbackUrl=${encodeURIComponent(nativeCheckoutPath)}`);
  const submitCheckout = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    if (type === "DELIVERY" && !deliveryAddress.trim()) { setError("نشانی تحویل را وارد کنید."); return; }
    if (!paymentMethod) { setError("روش پرداخت را انتخاب کنید."); return; }
    if (selectedMethod?.method === "CASH" && !availableCashModes.includes(cashMode)) { setError("شیوه پرداخت نقدی را انتخاب کنید."); return; }
    setBusy(true);
    try {
      const response = await fetch(appPath("/api/retail/v1/checkout"), {
        method: "POST", credentials: "same-origin", headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ organization: org, idempotencyKey: checkoutKey.current ??= crypto.randomUUID(), type, ...(type === "DELIVERY" ? { deliveryAddress: deliveryAddress.trim() } : {}), ...(couponCode.trim() ? { couponCode: couponCode.trim() } : {}), paymentMethod, ...(selectedMethod?.method === "CASH" && cashMode ? { cashMode } : {}) }),
      });
      const body = await response.json().catch(() => ({}));
      if (response.status === 401) { setAuthenticated(false); return; }
      if (!response.ok) throw new Error(errorMessage(body));
      if (typeof body.orderNumber !== "string" || typeof body.total !== "string" || typeof body.paymentStatus !== "string" || typeof body.orderStatus !== "string" || typeof body.paymentMethod !== "string") throw new Error("پاسخ تأیید سفارش کامل نیست.");
      setOrder(body as OrderResult);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "ثبت سفارش ممکن نشد."); }
    finally { setBusy(false); }
  };

  const submitBankReport = async () => {
    if (!order) return;
    setError(""); setReportMessage("");
    try {
      let response: Response;
      const url = appPath(`/api/retail/v1/orders/${encodeURIComponent(order.orderNumber)}/bank-report?organization=${encodeURIComponent(org)}`);
      if (reportMode === "RECEIPT") {
        if (!receipt) { setError("یک تصویر رسید را انتخاب کنید."); return; }
        const form = new FormData(); form.set("method", "RECEIPT"); form.set("receipt", receipt);
        response = await fetch(url, { method: "POST", credentials: "same-origin", body: form });
      } else {
        if (!reportedAt) { setError("زمان پرداخت را وارد کنید."); return; }
        let reportedAtIso: string;
        try { reportedAtIso = isoWithLocalOffset(reportedAt); } catch (reason) { setError(reason instanceof Error ? reason.message : "زمان نامعتبر است."); return; }
        response = await fetch(url, { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json", accept: "application/json" }, body: JSON.stringify({ method: "TIME", reportedAt: reportedAtIso, submittedLocalTime: reportedAt }) });
      }
      const body = await response.json().catch(() => ({}));
      if (response.status === 401) { setAuthenticated(false); return; }
      if (!response.ok) throw new Error(errorMessage(body));
      setReportSubmitted(true); setReportMessage("گزارش پرداخت ارسال شد.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "ارسال گزارش پرداخت ممکن نشد."); }
  };

  const items = cart?.items ?? [];
  return <main dir="rtl" lang="fa" className="min-h-screen bg-[#f8f7f4] px-4 py-8 text-[#24241f] md:px-8">
    <div className="mx-auto max-w-3xl">
      <a href={nativeStorefrontPath} className="text-sm text-[#766d61]">بازگشت به فروشگاه</a>
      <h1 className="mt-5 text-3xl font-semibold">تکمیل سفارش</h1>
      {loading ? <p role="status" className="mt-8 rounded-2xl bg-white p-8">در حال دریافت اطلاعات…</p> : authenticated === false ? <section className="mt-7 rounded-2xl bg-white p-7"><p>برای مشاهده سبد خرید و ثبت سفارش، ابتدا وارد حساب کاربری شوید.</p><a className="mt-5 inline-block rounded-full bg-[#292a24] px-6 py-3 text-sm text-white" href={loginHref}>ورود به حساب کاربری</a></section> : <>
        {error && <p role="alert" className="mt-5 rounded-xl bg-[#fff1ed] p-4 text-sm text-[#8c3329]">{error}</p>}
        {order ? <section className="mt-7 rounded-2xl bg-white p-6 md:p-8">
          <h2 className="text-xl font-semibold">سفارش {order.orderNumber} ثبت شد</h2>
          <dl className="mt-5 grid gap-4 sm:grid-cols-3"><div><dt className="text-xs text-[#77736a]">مبلغ سفارش</dt><dd className="mt-1 font-semibold">{money(Number(order.total))}</dd></div><div><dt className="text-xs text-[#77736a]">وضعیت پرداخت</dt><dd className="mt-1">{statusText[order.paymentStatus] ?? order.paymentStatus}</dd></div><div><dt className="text-xs text-[#77736a]">وضعیت سفارش</dt><dd className="mt-1">{statusText[order.orderStatus] ?? order.orderStatus}</dd></div></dl>
          {order.paymentMethod === "INOTI_USSD" && methods.find((method) => method.method === "INOTI_USSD")?.dialString && order.trackingToken && <div className="mt-7 rounded-2xl border border-[#e5e1d9] p-5 text-sm">
            <h3 className="font-semibold">پرداخت با کد دستوری</h3>
            <p className="mt-2">کد <b dir="ltr">{methods.find((method) => method.method === "INOTI_USSD")?.dialString}</b> را شماره‌گیری کنید و کد پیگیری زیر را وارد کنید.</p>
            <p className="mt-3 break-all rounded-lg bg-[#f8f7f4] p-3 font-mono" dir="ltr">{order.trackingToken}</p>
            <p className="mt-3 text-[#766d61]">پرداخت تا زمان تأیید ارائه‌دهنده در انتظار می‌ماند. کد پیگیری را فقط در درگاه کد دستوری همین فروشگاه وارد کنید.</p>
          </div>}
          {order.paymentMethod === "BANK_TRANSFER" && <div className="mt-7 border-t border-[#e5e1d9] pt-6"><h3 className="font-semibold">گزارش پرداخت بانکی</h3>
            {order.bankCardNumber && <p className="mt-3 text-sm">شماره کارت: <b dir="ltr">{order.bankCardNumber}</b></p>}{order.bankAccountOwner && <p className="mt-1 text-sm">به نام: {order.bankAccountOwner}</p>}
            {reportSubmitted ? <p role="status" className="mt-4 text-sm text-emerald-800">{reportMessage}</p> : <>
              <fieldset className="mt-5"><legend className="text-sm">یکی از روش‌های گزارش را انتخاب کنید</legend><div className="mt-2 flex flex-wrap gap-4 text-sm"><label className="flex items-center gap-2"><input type="radio" name="reportMode" checked={reportMode === "RECEIPT"} onChange={() => setReportMode("RECEIPT")} />بارگذاری تصویر رسید</label><label className="flex items-center gap-2"><input type="radio" name="reportMode" checked={reportMode === "TIME"} onChange={() => setReportMode("TIME")} />ثبت زمان پرداخت</label></div></fieldset>
              {reportMode === "RECEIPT" ? <label className="mt-4 block text-sm">تصویر رسید<input className="mt-2 block w-full rounded-xl border border-[#ddd9d0] bg-white p-3" type="file" accept="image/*" onChange={(event) => setReceipt(event.target.files?.[0] ?? null)} /></label> : <label className="mt-4 block text-sm">زمان پرداخت<input className="mt-2 block min-h-12 w-full rounded-xl border border-[#ddd9d0] bg-white px-3" type="datetime-local" value={reportedAt} onChange={(event) => setReportedAt(event.target.value)} /></label>}
              <button disabled={busy} onClick={() => void submitBankReport()} className="mt-5 min-h-11 rounded-full bg-[#292a24] px-6 py-3 text-sm text-white disabled:opacity-50">{busy ? "در حال ارسال…" : "ارسال گزارش پرداخت"}</button>
            </>}
          </div>}
        </section> : !items.length ? <section className="mt-7 rounded-2xl bg-white p-7"><p>سبد خرید شما خالی است.</p></section> : <>
          <section className="mt-7 rounded-2xl bg-white p-6"><h2 className="font-semibold">اقلام سبد خرید</h2><ul className="mt-4 divide-y divide-[#eeeae3]">{items.map((item, index) => <li key={item.id ?? index} className="flex justify-between gap-4 py-3 text-sm"><span>{item.productName ?? item.variant?.product?.name ?? item.name ?? "کالای فروشگاه"}{(item.variantName ?? item.variant?.name) ? ` · ${item.variantName ?? item.variant?.name}` : ""}</span><span>تعداد: {new Intl.NumberFormat("fa-IR").format(item.quantity ?? 1)}</span></li>)}</ul><p className="mt-4 text-xs text-[#77736a]">مبلغ نهایی پس از محاسبه و تأیید سرور نمایش داده می‌شود.</p></section>
          <form onSubmit={(event) => void submitCheckout(event)} className="mt-5 space-y-5 rounded-2xl bg-white p-6 md:p-8">
            <fieldset><legend className="font-semibold">روش دریافت</legend><div className="mt-3 flex gap-5 text-sm"><label className="flex items-center gap-2"><input type="radio" name="type" checked={type === "PICK_UP"} onChange={() => { setType("PICK_UP"); if (cashMode === "COURIER") setCashMode("COUNTER"); }} />دریافت حضوری</label><label className="flex items-center gap-2"><input type="radio" name="type" checked={type === "DELIVERY"} onChange={() => { setType("DELIVERY"); if (cashMode === "PICKUP") setCashMode("COUNTER"); }} />ارسال با پیک</label></div></fieldset>
            {type === "DELIVERY" && <label className="block text-sm">نشانی تحویل<textarea required value={deliveryAddress} onChange={(event) => setDeliveryAddress(event.target.value)} className="mt-2 min-h-24 w-full rounded-xl border border-[#ddd9d0] p-3" /></label>}
            <label className="block text-sm">کد تخفیف (اختیاری)<input value={couponCode} onChange={(event) => setCouponCode(event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-[#ddd9d0] px-3" /></label>
            <label className="block text-sm">روش پرداخت<select required value={paymentMethod} onChange={(event) => { setPaymentMethod(event.target.value); const nextCash = methods.find((method) => method.method === event.target.value)?.cashModes?.[0]; setCashMode(nextCash ?? ""); }} className="mt-2 min-h-11 w-full rounded-xl border border-[#ddd9d0] bg-white px-3"><option value="">انتخاب کنید</option>{methods.map((method) => <option key={method.method} value={method.method}>{method.label}</option>)}</select></label>
            {selectedMethod?.method === "CASH" && !!availableCashModes.length && <label className="block text-sm">شیوه پرداخت نقدی<select value={cashMode} onChange={(event) => setCashMode(event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-[#ddd9d0] bg-white px-3">{availableCashModes.map((mode) => <option key={mode} value={mode}>{cashModeText[mode] ?? mode}</option>)}</select></label>}
            <button disabled={busy || !methods.length} className="min-h-12 w-full rounded-full bg-[#292a24] px-6 py-3 text-sm text-white disabled:opacity-50">{busy ? "در حال ثبت سفارش…" : "ثبت سفارش"}</button>
          </form>
        </>}
      </>}
    </div>
  </main>;
}
