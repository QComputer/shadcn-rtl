"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowRight, LoaderCircle, ShoppingBag, UserRound } from "lucide-react";
import { appPath } from "@/lib/app-base-path";
import { useOptionalCart } from "@/lib/contexts/cart-context";
import { checkoutDigits, checkoutError, checkoutFormErrors, checkoutMoney, checkoutQuantityValid, type CheckoutCart, type CheckoutCartItem, type CheckoutOrder, type CheckoutPaymentMethod, type CheckoutQuote } from "@/lib/retail/checkout-presentation";
import { PremiumCartItems } from "./premium-cart-items";
import { PremiumOrderConfirmation } from "./premium-order-confirmation";
import { RetailPaymentFollowup } from "./retail-payment-followup";

type Draft = { type: "PICK_UP" | "DELIVERY"; deliveryAddress: string; recipientName: string; recipientMobile: string; deliveryNotes: string; couponCode: string; paymentMethod: string; cashMode: string };
const initial: Draft = { type: "PICK_UP", deliveryAddress: "", recipientName: "", recipientMobile: "", deliveryNotes: "", couponCode: "", paymentMethod: "", cashMode: "" };
const focus = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-stone-700";
const field = "mt-2 min-h-12 w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-sm text-stone-900 outline-none focus:border-stone-700 focus:ring-1 focus:ring-stone-700 disabled:bg-stone-100";
const panel = "rounded-3xl border border-stone-200/80 bg-white/80 p-5 sm:p-7";
const cashLabels: Record<string, string> = { COUNTER: "پرداخت در پیشخوان فروشگاه", PICKUP: "پرداخت هنگام دریافت حضوری", COURIER: "پرداخت هنگام تحویل سفارش" };
const modes = (methods: CheckoutPaymentMethod[], draft: Draft) => methods.find(m => m.method === draft.paymentMethod)?.cashModes?.filter(m => m === "COUNTER" || (m === "PICKUP" && draft.type === "PICK_UP") || (m === "COURIER" && draft.type === "DELIVERY")) ?? [];
function stored(key: string) { try { return sessionStorage.getItem(key); } catch { return null; } }
function save(key: string, value: string | null) { try { if (value === null) sessionStorage.removeItem(key); else sessionStorage.setItem(key, value); } catch { /* The in-memory lock still protects this page. */ } }
function restore(value: string | null): Partial<Draft> { try { const data = JSON.parse(value ?? "{}"); return Object.fromEntries(Object.keys(initial).flatMap(k => typeof data[k] === "string" && data[k].length <= 500 && (k !== "type" || ["PICK_UP", "DELIVERY"].includes(data[k])) ? [[k, data[k]]] : [])); } catch { return {}; } }
function payload(org: string, d: Draft) {
  const mobile = checkoutDigits(d.recipientMobile).replace(/[\s-]/g, "");
  return { organization: org, type: d.type, ...(d.type === "DELIVERY" && d.deliveryAddress.trim().length >= 8 ? { deliveryAddress: d.deliveryAddress.trim() } : {}), ...(d.recipientName.trim().length >= 2 ? { recipientName: d.recipientName.trim() } : {}), ...(/^(?:09\d{9}|\+989\d{9})$/.test(mobile) ? { recipientMobile: mobile } : {}), ...(d.deliveryNotes.trim() ? { deliveryNotes: d.deliveryNotes.trim() } : {}), ...(d.couponCode.trim() ? { couponCode: d.couponCode.trim() } : {}), ...(d.paymentMethod ? { paymentMethod: d.paymentMethod } : {}), ...(d.paymentMethod === "CASH" && d.cashMode ? { cashMode: d.cashMode } : {}) };
}
export async function retailRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(appPath(url), { credentials: "same-origin", cache: "no-store", ...init, headers: { accept: "application/json", ...(init?.body instanceof FormData ? {} : { "content-type": "application/json" }), ...init?.headers } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) { if (response.status === 401) throw new Error("AUTH_REQUIRED"); throw new Error(checkoutError(body)); }
  return body as T;
}
export default function RetailCheckoutClient({ locale, organization, storefrontPath, checkoutPath, cartOnly = false, embedded = false, drawer = false }: { locale: string; organization: string; storefrontPath?: string; checkoutPath?: string; cartOnly?: boolean; embedded?: boolean; drawer?: boolean }) {
  const org = decodeURIComponent(organization), store = appPath(storefrontPath ?? `/${locale}/retail/${encodeURIComponent(org)}`), checkout = appPath(checkoutPath ?? `${store}/checkout`), cartPath = `${store}/cart`;
  const context = useOptionalCart();
  const [cart, setCart] = useState<CheckoutCart | null>(null), [methods, setMethods] = useState<CheckoutPaymentMethod[]>([]), [draft, setDraft] = useState<Draft>(initial);
  const [quote, setQuote] = useState<CheckoutQuote | null>(null), [customer, setCustomer] = useState<CheckoutQuote["customer"] | null>(null), [fulfillment, setFulfillment] = useState<CheckoutQuote["fulfillment"]>([]);
  const [order, setOrder] = useState<CheckoutOrder | null>(null), [loading, setLoading] = useState(true), [authenticated, setAuthenticated] = useState(true), [busy, setBusy] = useState(false), [busyItemId, setBusyItemId] = useState<string | null>(null), [reviewed, setReviewed] = useState(false);
  const [error, setError] = useState(""), [notice, setNotice] = useState(""), [errors, setErrors] = useState<Record<string, string>>({}), [reload, setReload] = useState(0);
  const lock = useRef(false), key = useRef<string | null>(null), scope = useRef(""), alert = useRef<HTMLDivElement>(null), form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [cartResult, paymentResult, session] = await Promise.all([
          retailRequest<{ cart: CheckoutCart | null }>(`/api/retail/v1/cart?organization=${encodeURIComponent(org)}`),
          cartOnly ? Promise.resolve({ methods: [] as CheckoutPaymentMethod[] }) : retailRequest<{ methods: CheckoutPaymentMethod[] }>(`/api/retail/v1/payment-methods?organization=${encodeURIComponent(org)}`),
          retailRequest<{ user?: { id?: string } }>("/api/auth/session"),
        ]);
        if (cancelled) return;
        if (!session.user?.id) throw new Error("AUTH_REQUIRED");
        scope.current = `retail-checkout:${org}:${session.user.id}`; key.current = stored(`${scope.current}:key`);
        setCart(cartResult.cart); setMethods(paymentResult.methods); setAuthenticated(true);
        const explicit = new URLSearchParams(window.location.search).get("order");
        const recovery = key.current && !explicit ? await retailRequest<{ orderNumber: string | null }>(`/api/retail/v1/checkout?organization=${encodeURIComponent(org)}&idempotencyKey=${encodeURIComponent(key.current)}`) : null;
        const orderNumber = explicit ?? recovery?.orderNumber;
        if (orderNumber && !cartOnly) {
          const result = await retailRequest<{ order: CheckoutOrder }>(`/api/retail/v1/orders/${encodeURIComponent(orderNumber)}?organization=${encodeURIComponent(org)}`);
          if (!cancelled) { setOrder(result.order); save(`${scope.current}:key`, null); key.current = null; }
          return;
        }
        const saved = restore(stored(`${scope.current}:draft`));
        let next: Draft = { ...initial, ...saved, paymentMethod: saved.paymentMethod ?? paymentResult.methods[0]?.method ?? "" };
        if (cartResult.cart?.items.length && !cartOnly) {
          const result = await retailRequest<{ quote: CheckoutQuote }>("/api/retail/v1/checkout/quote", { method: "POST", body: JSON.stringify({ organization: org, type: "PICK_UP" }) });
          if (cancelled) return;
          setCustomer(result.quote.customer); setFulfillment(result.quote.fulfillment); setQuote(result.quote);
          next = { ...next, recipientName: saved.recipientName ?? result.quote.customer.name ?? "", recipientMobile: saved.recipientMobile ?? result.quote.customer.mobile ?? "" };
          if (!result.quote.fulfillment.some(m => m.type === next.type) && result.quote.fulfillment[0]) next.type = result.quote.fulfillment[0].type;
        }
        if (!modes(paymentResult.methods, next).includes(next.cashMode)) next.cashMode = modes(paymentResult.methods, next)[0] ?? "";
        if (!cancelled) setDraft(next);
      } catch (e) { if (!cancelled) { if (e instanceof Error && e.message === "AUTH_REQUIRED") setAuthenticated(false); else setError(checkoutError(e)); } }
      finally { if (!cancelled) setLoading(false); }
    }
    void load(); return () => { cancelled = true; };
  }, [org, cartOnly, reload]);
  function update(patch: Partial<Draft>) {
    const next = { ...draft, ...patch };
    if (patch.type || patch.paymentMethod) { const available = modes(methods, next); if (!available.includes(next.cashMode)) next.cashMode = available[0] ?? ""; }
    setDraft(next); setReviewed(false); setErrors({}); setError(""); setNotice(""); if (scope.current) save(`${scope.current}:draft`, JSON.stringify(next));
  }
  function fail(e: unknown) { setError(checkoutError(e)); requestAnimationFrame(() => alert.current?.focus()); }
  async function mutate(item: CheckoutCartItem, quantity: number | null) {
    if (lock.current || (quantity !== null && !checkoutQuantityValid(quantity, quantity < item.quantity ? null : item.availability?.maxQuantity ?? null))) return;
    lock.current = true; setBusy(true); setBusyItemId(item.id); setError(""); setNotice("");
    try {
      await retailRequest("/api/retail/v1/cart", { method: quantity === null ? "DELETE" : "PATCH", body: JSON.stringify({ organization: org, itemId: item.id, ...(quantity === null ? {} : { quantity }) }) });
      const result = await retailRequest<{ cart: CheckoutCart | null }>(`/api/retail/v1/cart?organization=${encodeURIComponent(org)}`);
      setCart(result.cart); setReviewed(false); setQuote(null); setNotice(quantity === null ? "کالا از سبد حذف شد." : "تعداد و مبلغ سبد به‌روز شد."); void context?.refreshCart();
    } catch (e) { fail(e); } finally { lock.current = false; setBusy(false); setBusyItemId(null); }
  }
  async function submit(event: FormEvent) {
    event.preventDefault(); if (lock.current) return;
    const invalid = checkoutFormErrors(draft, modes(methods, draft));
    if (!fulfillment.some(m => m.type === draft.type)) invalid.type = "روش دریافت فعالی برای سفارش انتخاب نشده است.";
    if (Object.keys(invalid).length) { setErrors(invalid); setError("اطلاعات مشخص‌شده را کامل کنید."); requestAnimationFrame(() => form.current?.querySelector<HTMLElement>("[aria-invalid=true]")?.focus()); return; }
    lock.current = true; setBusy(true); setError(""); setNotice("");
    try {
      if (!reviewed || !quote) {
        const result = await retailRequest<{ quote: CheckoutQuote }>("/api/retail/v1/checkout/quote", { method: "POST", body: JSON.stringify(payload(org, draft)) });
        const freshCart = await retailRequest<{ cart: CheckoutCart | null }>(`/api/retail/v1/cart?organization=${encodeURIComponent(org)}`);
        const consistent = freshCart.cart?.items.length === result.quote.items.length && result.quote.items.every(line => freshCart.cart?.items.some(item => item.id === line.id && item.variant.id === line.variantId && item.quantity === line.quantity));
        setQuote(result.quote); setFulfillment(result.quote.fulfillment);
        setCart(freshCart.cart ? { ...freshCart.cart, subtotal: result.quote.subtotal, items: freshCart.cart.items.map(item => { const fresh = result.quote.items.find(line => line.id === item.id && line.variantId === item.variant.id); return fresh ? { ...item, unitPrice: fresh.unitPrice, availability: { orderable: fresh.orderable, reason: fresh.reason, maxQuantity: item.availability?.maxQuantity ?? null } } : item; }) } : null);
        setReviewed(!!consistent && result.quote.issues.length === 0 && result.quote.items.every(i => i.orderable));
        setNotice(!consistent ? "سبد خرید در جای دیگری تغییر کرده است. اقلام به‌روز را دوباره بررسی کنید." : result.quote.issues.length ? result.quote.issues.map(issue => checkoutError({ error: issue })).join(" ") : "مبلغ و موجودی بررسی شد. خلاصه سفارش را بخوانید و ثبت نهایی را تأیید کنید."); return;
      }
      key.current ??= crypto.randomUUID(); save(`${scope.current}:key`, key.current);
      const result = await retailRequest<{ orderNumber: string }>("/api/retail/v1/checkout", { method: "POST", body: JSON.stringify({ ...payload(org, draft), idempotencyKey: key.current, reviewToken: quote.reviewToken }) });
      const confirmed = await retailRequest<{ order: CheckoutOrder }>(`/api/retail/v1/orders/${encodeURIComponent(result.orderNumber)}?organization=${encodeURIComponent(org)}`);
      setOrder(confirmed.order); setCart(null); key.current = null; save(`${scope.current}:key`, null); save(`${scope.current}:draft`, null);
      const url = new URL(window.location.href); url.searchParams.set("order", result.orderNumber); window.history.replaceState({}, "", url); void context?.refreshCart(); window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) { setReviewed(false); setQuote(null); fail(e); } finally { lock.current = false; setBusy(false); }
  }
  const items = cart?.items ?? [], valid = items.length > 0 && items.every(i => i.availability?.orderable !== false), total = reviewed && quote ? quote.total : cart?.subtotal ?? 0;
  const login = appPath(`/${locale}/login?callbackUrl=${encodeURIComponent(cartOnly ? cartPath : checkout)}`);
  const action = (mobile = false) => cartOnly ? <a href={checkout} aria-disabled={!valid || busy} onClick={e => { if (!valid || busy) e.preventDefault(); }} className={`${focus} flex min-h-14 flex-1 items-center justify-center rounded-2xl px-5 py-4 text-sm font-semibold ${valid && !busy ? "bg-stone-900 text-white" : "bg-stone-200 text-stone-500"}`}>ادامه به تکمیل سفارش</a> : <button type="submit" form="retail-checkout-form" disabled={busy || !valid || !methods.length || !fulfillment.length} aria-label={mobile ? "ادامه سفارش در نوار خرید" : undefined} className={`${focus} flex min-h-14 flex-1 items-center justify-center gap-2 rounded-2xl bg-stone-900 px-5 py-4 text-sm font-semibold text-white disabled:bg-stone-200 disabled:text-stone-500`}>{busy && <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" />}{busy ? "در حال بررسی…" : reviewed ? "ثبت نهایی سفارش" : "بررسی مبلغ و موجودی"}</button>;
  const fieldError = (name: string) => errors[name] && <p id={`error-${name}`} className="mt-2 text-xs leading-6 text-rose-800">{errors[name]}</p>;
  return <div dir="rtl" lang="fa" data-premium-checkout data-mode={cartOnly ? "cart" : "checkout"} className={`bg-[#fcfbf8] text-stone-900 ${drawer ? "px-4 py-4" : "min-h-screen px-5 pb-52 pt-7 md:px-10 md:pb-16"}`}><div className={`mx-auto ${drawer ? "max-w-lg" : "max-w-6xl"}`}>
    {!drawer && <a href={store} className={`${focus} mb-7 inline-flex min-h-11 items-center gap-2 text-xs text-stone-500`}><ArrowRight className="size-4" />بازگشت به فروشگاه</a>}
    <header className="mb-7 flex flex-wrap items-end justify-between gap-3"><div><p className="mb-2 text-xs text-stone-500">{cartOnly ? "انتخاب‌های شما" : "یک قدم تا ثبت سفارش"}</p><h1 className="text-2xl font-semibold sm:text-3xl">{order ? "سفارش شما" : cartOnly ? "سبد خرید" : "تکمیل سفارش"}</h1></div>{!cartOnly && !order && <a className={`${focus} min-h-11 py-3 text-sm underline underline-offset-4`} href={cartPath}>ویرایش سبد خرید</a>}</header>
    {error && <div ref={alert} tabIndex={-1} role="alert" className="mb-5 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm leading-7 text-rose-900">{error}{!cart && <button type="button" onClick={() => { setError(""); setLoading(true); setReload(n => n + 1); }} className={`${focus} ms-3 underline`}>تلاش دوباره</button>}</div>}
    {notice && <p role="status" className="mb-5 rounded-2xl bg-stone-100 p-4 text-sm leading-7">{notice}</p>}
    {loading ? <section aria-busy="true" aria-label="در حال دریافت سبد" className="space-y-4">{[0,1].map(i => <div key={i} className="h-36 animate-pulse rounded-3xl bg-stone-200/60 motion-reduce:animate-none" />)}<p role="status" className="text-sm text-stone-500">در حال دریافت اطلاعات فروشگاه…</p></section> : !authenticated ? <section className={`${panel} space-y-5 py-10 text-center`}><UserRound className="mx-auto size-9 text-stone-400" /><h2 className="text-lg font-semibold">سبد شما همراه حساب شماست</h2><p className="text-sm leading-7 text-stone-500">برای دیدن سبد و ادامه خرید وارد حساب شوید؛ پس از ورود به همین صفحه برمی‌گردید.</p><a href={login} className={`${focus} inline-flex min-h-12 items-center rounded-xl bg-stone-900 px-7 text-sm text-white`}>ورود و ادامه خرید</a></section> : order ? <PremiumOrderConfirmation order={order} storefrontPath={store}><RetailPaymentFollowup organization={org} order={order} methods={methods} /></PremiumOrderConfirmation> : !items.length ? <section data-empty-cart className={`${panel} py-14 text-center`}><ShoppingBag className="mx-auto mb-5 size-12 text-stone-400" /><h2 className="text-lg font-semibold">سبد خریدتان هنوز خالی است</h2><p className="mt-3 text-sm leading-7 text-stone-500">رنگ و اندازه دلخواهتان را از صفحه محصول انتخاب کنید.</p><a href={store} className={`${focus} mt-7 inline-flex min-h-12 items-center rounded-xl bg-stone-900 px-6 text-sm text-white`}>دیدن محصولات فروشگاه</a></section> : <>
      <div className={`grid items-start gap-7 ${drawer ? "" : "lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-10"}`}><div className="min-w-0 space-y-5">
        {cartOnly ? <section className={panel}><h2 className="text-sm font-semibold">کالاهای انتخاب‌شده <span className="ms-2 font-normal text-stone-500">{new Intl.NumberFormat("fa-IR").format(cart?.itemCount ?? 0)} عدد</span></h2><PremiumCartItems items={items} storefrontPath={store} busy={busy} busyItemId={busyItemId} onQuantity={(item,q) => void mutate(item,q)} onRemove={item => void mutate(item,null)} /></section> : <form id="retail-checkout-form" ref={form} onSubmit={e => void submit(e)} noValidate className="space-y-5">
          <fieldset disabled={busy} className={panel}><legend className="sr-only">اطلاعات و روش دریافت</legend><h2 className="mb-4 text-base font-semibold">اطلاعات خریدار</h2><p className="text-sm leading-7">{customer?.name ?? "حساب کاربری شما"}{customer?.mobile && <bdi className="ms-3 text-stone-500">{customer.mobile}</bdi>}</p><p className="mt-2 text-xs leading-6 text-stone-500">سفارش به همین حساب متصل می‌شود؛ ایمیل لازم نیست.</p>
            <h2 className="mb-4 mt-7 border-t border-stone-200 pt-6 text-base font-semibold">روش دریافت</h2>{!fulfillment.length ? <p role="status" className="text-sm leading-7 text-amber-800">فروشگاه هنوز روش دریافت معتبری تنظیم نکرده است.</p> : <div className="grid gap-3 sm:grid-cols-2">{fulfillment.map(m => <label key={m.type} className={`flex min-h-20 cursor-pointer items-center gap-3 rounded-2xl border p-4 ${draft.type === m.type ? "border-stone-900 bg-stone-100" : "border-stone-200"}`}><input type="radio" name="type" value={m.type} checked={draft.type === m.type} onChange={() => update({type:m.type})} className="size-4 accent-stone-900" /><span><strong className="block text-sm font-medium">{m.type === "PICK_UP" ? "دریافت حضوری" : "ارسال به نشانی شما"}</strong><span className="mt-1 block text-xs text-stone-500">{m.type === "PICK_UP" ? "بدون هزینه ارسال" : checkoutMoney(m.fee)}</span></span></label>)}</div>}{fieldError("type")}
            {draft.type === "DELIVERY" && <div data-delivery-fields className="mt-5 space-y-4 border-t border-stone-200 pt-5"><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm">نام گیرنده<input name="recipientName" autoComplete="shipping name" maxLength={120} value={draft.recipientName} aria-invalid={!!errors.recipientName} aria-describedby={errors.recipientName ? "error-recipientName" : undefined} onChange={e=>update({recipientName:e.target.value})} className={field} />{fieldError("recipientName")}</label><label className="text-sm">شماره همراه گیرنده<input name="recipientMobile" autoComplete="shipping tel" inputMode="tel" dir="ltr" maxLength={24} value={draft.recipientMobile} aria-invalid={!!errors.recipientMobile} aria-describedby={errors.recipientMobile ? "error-recipientMobile" : undefined} onChange={e=>update({recipientMobile:e.target.value})} className={field} />{fieldError("recipientMobile")}</label></div>
              {customer?.address && <button type="button" onClick={()=>update({deliveryAddress:customer.address??""})} className={`${focus} min-h-11 text-xs underline underline-offset-4`}>استفاده از نشانی ذخیره‌شده حساب</button>}
              <label className="block text-sm">نشانی کامل تحویل<textarea name="deliveryAddress" autoComplete="shipping street-address" maxLength={500} value={draft.deliveryAddress} aria-invalid={!!errors.deliveryAddress} aria-describedby={errors.deliveryAddress ? "error-deliveryAddress" : "address-hint"} onChange={e=>update({deliveryAddress:e.target.value})} className={`${field} min-h-28 resize-y`} />{fieldError("deliveryAddress")}<span id="address-hint" className="mt-2 block text-xs leading-6 text-stone-500">استان، شهر، خیابان، پلاک و واحد را در همین نشانی بنویسید.</span></label>
              <label className="block text-sm">توضیحات تحویل (اختیاری)<textarea name="deliveryNotes" maxLength={500} value={draft.deliveryNotes} onChange={e=>update({deliveryNotes:e.target.value})} className={`${field} min-h-20 resize-y`} /></label></div>}
          </fieldset>
          <fieldset disabled={busy} className={panel}><legend className="sr-only">انتخاب پرداخت</legend><h2 className="mb-4 text-base font-semibold">روش پرداخت</h2>{!methods.length ? <p role="status" className="text-sm leading-7 text-amber-800">روش پرداخت فعالی برای این فروشگاه ثبت نشده است.</p> : <div className="space-y-3">{methods.map(m=><label key={m.method} className={`flex min-h-16 cursor-pointer items-center gap-3 rounded-2xl border p-4 ${draft.paymentMethod===m.method?"border-stone-900 bg-stone-100":"border-stone-200"}`}><input type="radio" name="paymentMethod" value={m.method} checked={draft.paymentMethod===m.method} onChange={()=>update({paymentMethod:m.method})} className="size-4 accent-stone-900" /><span className="text-sm font-medium">{m.label}</span></label>)}</div>}{fieldError("paymentMethod")}
            {draft.paymentMethod==="CASH" && <div className="mt-4"><label className="block text-sm">شیوه پرداخت نقدی<select name="cashMode" value={draft.cashMode} aria-invalid={!!errors.cashMode} onChange={e=>update({cashMode:e.target.value})} className={field}><option value="">انتخاب کنید</option>{modes(methods,draft).map(m=><option value={m} key={m}>{cashLabels[m]??m}</option>)}</select>{fieldError("cashMode")}</label><p className="mt-3 text-xs leading-6 text-stone-500">ثبت سفارش نقدی به معنی پرداخت شدن آن نیست؛ پرداخت جداگانه ثبت و بررسی می‌شود.</p></div>}
          </fieldset>
          <section className={panel}><div className="mb-4 flex items-center justify-between gap-3"><h2 className="text-base font-semibold">مرور کالاها</h2><a href={cartPath} className={`${focus} min-h-11 py-3 text-xs underline underline-offset-4`}>ویرایش تعداد یا حذف</a></div><PremiumCartItems items={items} storefrontPath={store} busy={busy} busyItemId={null} onQuantity={()=>undefined} onRemove={()=>undefined} compact /></section>
        </form>}
      </div><aside aria-label="خلاصه سفارش" className={`${panel} min-w-0 space-y-5 lg:sticky lg:top-6`}><h2 className="text-base font-semibold">{cartOnly?"خلاصه سبد":"خلاصه سفارش"}</h2>
        <dl className="space-y-4 text-sm"><div className="flex justify-between gap-3"><dt className="text-stone-500">جمع کالاها</dt><dd className="tabular-nums">{checkoutMoney(reviewed&&quote?quote.subtotal:cart?.subtotal??0)}</dd></div>{reviewed&&quote&&quote.discount>0&&<div className="flex justify-between gap-3 text-emerald-800"><dt>تخفیف تأییدشده</dt><dd>{checkoutMoney(quote.discount)}</dd></div>}<div className="flex justify-between gap-3"><dt className="text-stone-500">هزینه دریافت</dt><dd className="text-end">{cartOnly?"در تکمیل سفارش مشخص می‌شود":fulfillment.find(m=>m.type===draft.type)?checkoutMoney(fulfillment.find(m=>m.type===draft.type)!.fee):"نیازمند تنظیم فروشگاه"}</dd></div><div className="flex justify-between gap-3 border-t border-stone-200 pt-5 text-base font-semibold"><dt>{cartOnly?"جمع کالاها":reviewed?"مبلغ نهایی":"جمع کالاها پیش از بررسی"}</dt><dd data-checkout-total className="tabular-nums">{checkoutMoney(total)}</dd></div></dl>
        {!cartOnly&&<><details className="border-t border-stone-200 pt-4"><summary className={`${focus} min-h-11 cursor-pointer py-3 text-xs`}>کد تخفیف دارید؟</summary><label className="mt-2 block text-xs">کد تخفیف (اختیاری)<input name="couponCode" form="retail-checkout-form" value={draft.couponCode} maxLength={40} disabled={busy} onChange={e=>update({couponCode:e.target.value})} className={field} /><span className="mt-2 block leading-6 text-stone-500">اعتبار و مبلغ تخفیف هنگام بررسی محاسبه می‌شود.</span></label></details><div className="border-t border-stone-200 pt-4 text-xs leading-7 text-stone-500"><p>دریافت: {draft.type==="DELIVERY"?"ارسال به نشانی":"حضوری"}</p>{draft.type==="DELIVERY"&&draft.deliveryAddress&&<p className="mt-1 break-words">{draft.deliveryAddress}</p>}<p className="mt-1">پرداخت: {methods.find(m=>m.method===draft.paymentMethod)?.label??"انتخاب نشده"}</p></div></>}
        {!valid&&<p role="status" className="text-xs leading-7 text-amber-800">تعداد یا وضعیت کالاهای مشخص‌شده را در سبد اصلاح کنید.</p>}
        <div className="flex">{action()}</div><p className="text-[11px] leading-6 text-stone-500">{cartOnly?"موجودی و مبلغ نهایی پیش از ثبت سفارش دوباره بررسی می‌شود.":reviewed?"ثبت نهایی همین اقلام و مبلغ تأییدشده را ارسال می‌کند. تغییر هزینه یا موجودی نیازمند بررسی دوباره است.":"با دکمه بررسی سفارشی ثبت نمی‌شود؛ ابتدا مبلغ و موجودی را ببینید."}</p>{cartOnly&&<a href={store} className={`${focus} flex min-h-11 items-center justify-center text-xs`}>ادامه خرید</a>}
      </aside></div>
      {!drawer&&<div data-checkout-action className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-40 border-t border-stone-200 bg-[#fcfbf8]/95 px-4 py-3 backdrop-blur md:hidden"><div className="mx-auto flex max-w-lg items-center gap-3"><div className="min-w-24 text-xs"><strong className="block tabular-nums">{checkoutMoney(total)}</strong><span className="mt-1 block text-[10px] text-stone-500">{reviewed?"مبلغ نهایی":"پیش از بررسی"}</span></div>{action(true)}</div></div>}
    </>}
    {!embedded&&!drawer&&<nav aria-label="پیمایش موبایل فروشگاه" className="fixed inset-x-0 bottom-0 z-50 flex h-[calc(4rem+env(safe-area-inset-bottom))] items-start justify-around border-t border-stone-200 bg-[#fcfbf8] px-4 pt-3 text-xs md:hidden"><a href={store} className={`${focus} min-h-11 px-5 py-2`}>فروشگاه</a><a href={cartPath} className={`${focus} min-h-11 px-5 py-2`}>سبد خرید</a></nav>}
  </div></div>;
}
