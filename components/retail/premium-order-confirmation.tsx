import Image from "next/image";
import { ArrowRight, Check } from "lucide-react";
import {
  checkoutMoney,
  checkoutOptionLabel,
  checkoutOrderState,
  checkoutPaymentState,
  type CheckoutOrder,
} from "@/lib/retail/checkout-presentation";

type Props = { order: CheckoutOrder; storefrontPath: string; children?: React.ReactNode };

const focus = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-stone-700";
const paymentMethodLabel: Record<string, string> = {
  BANK_TRANSFER: "کارت‌به‌کارت",
  CASH: "پرداخت نقدی",
  INOTI_USSD: "پرداخت با کد USSD",
};

export function PremiumOrderConfirmation({ order, storefrontPath, children }: Props) {
  const cashUnpaid = order.paymentMethod === "CASH" && ["PENDING", "UNPAID", "AWAITING_PAYMENT"].includes(order.paymentStatus);
  const paymentState = cashUnpaid ? "پرداخت در انتظار ثبت و تأیید است" : checkoutPaymentState(order.paymentStatus);
  return <main dir="rtl" lang="fa" className="mx-auto max-w-3xl space-y-5 px-4 py-8 text-stone-900 sm:px-6 sm:py-12">
    <header className="rounded-3xl border border-stone-200/80 bg-white/80 p-5 sm:p-8">
      <div className="flex items-start gap-4">
        <span aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center rounded-full bg-stone-900 text-white"><Check className="size-5" /></span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-stone-500">سفارش ثبت شد</p>
          <h2 className="mt-1 text-xl font-semibold leading-8 sm:text-2xl">سپاس از خرید شما</h2>
          <p className="mt-2 text-sm leading-6 text-stone-600">شماره سفارش: <bdi dir="ltr" className="font-mono font-semibold text-stone-900">{order.orderNumber}</bdi></p>
          <dl className="mt-5 grid gap-3 border-t border-stone-200 pt-4 sm:grid-cols-2">
            <div className="space-y-1"><dt className="text-xs text-stone-500">وضعیت سفارش</dt><dd className="text-sm font-medium">{checkoutOrderState(order.orderStatus, order.type)}</dd></div>
            <div className="space-y-1"><dt className="text-xs text-stone-500">وضعیت پرداخت</dt><dd className="text-sm font-medium">{paymentState}</dd></div>
            {order.paymentMethod && <div className="space-y-1"><dt className="text-xs text-stone-500">روش پرداخت</dt><dd className="text-sm">{paymentMethodLabel[order.paymentMethod] ?? "روش ثبت‌شده برای سفارش"}</dd></div>}
            <div className="space-y-1"><dt className="text-xs text-stone-500">مبلغ سفارش</dt><dd className="text-sm font-semibold tabular-nums">{checkoutMoney(order.total)}</dd></div>
          </dl>
        </div>
      </div>
    </header>

    {order.fulfillment && <section aria-labelledby="fulfillment-tracking-title" className="rounded-3xl border border-stone-200/80 bg-white/80 p-5 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 id="fulfillment-tracking-title" className="text-base font-semibold">پیگیری دریافت سفارش</h2><span className="text-xs text-stone-600">{order.type === "PICK_UP" ? "دریافت حضوری" : "ارسال به نشانی"}</span></div>
      {order.fulfillmentInfo && <div className="mt-4 space-y-2 rounded-xl bg-stone-50 p-4 text-xs leading-7 text-stone-600"><p className="font-medium">راهنمای ثبت‌شده هنگام سفارش</p>{order.type === "PICK_UP" && <><p className="whitespace-pre-line">{order.fulfillmentInfo.pickupAddress}</p><p className="whitespace-pre-line">{order.fulfillmentInfo.pickupInstructions}</p></>}{order.type === "DELIVERY" && order.fulfillmentInfo.deliveryRestrictions && <p className="whitespace-pre-line">{order.fulfillmentInfo.deliveryRestrictions}</p>}{order.fulfillmentInfo.fulfillmentInstructions && <p className="whitespace-pre-line">{order.fulfillmentInfo.fulfillmentInstructions}</p>}{order.fulfillmentInfo.contact && <p>تماس فروشگاه: <bdi dir="ltr">{order.fulfillmentInfo.contact}</bdi></p>}</div>}      <p role="status" className="mt-3 text-sm font-medium">{order.fulfillment.label}</p>
      <p className="mt-2 text-xs leading-6 text-stone-500">وضعیت دریافت مستقل از پرداخت است. فقط اطلاعات ثبت‌شده فروشگاه نمایش داده می‌شود؛ رهگیری زنده شرکت حمل فعال نیست.</p>
      {order.fulfillment.events.length > 0 && <ol className="mt-5 space-y-4 border-s border-stone-200 ps-4">{order.fulfillment.events.map(event => <li key={event.id} className="space-y-1 text-sm"><p className="font-medium">{event.label}</p><time dateTime={event.at} className="text-xs text-stone-500">{new Intl.DateTimeFormat("fa-IR",{dateStyle:"medium",timeStyle:"short"}).format(new Date(event.at))}</time>{event.operatorName && <p className="break-words">تحویل به: {event.operatorName}</p>}{event.trackingReference && <p className="break-all">کد پیگیری ثبت‌شده: <bdi dir="ltr">{event.trackingReference}</bdi></p>}</li>)}</ol>}
      <button type="button" onClick={() => window.location.reload()} className={`${focus} mt-4 min-h-11 rounded-xl border border-stone-200 px-4 text-sm`}>تازه‌سازی وضعیت سفارش</button>
    </section>}
    <section aria-labelledby="confirmation-items-title" className="rounded-3xl border border-stone-200/80 bg-white/80 p-5 sm:p-8">
      <h2 id="confirmation-items-title" className="text-base font-semibold">اقلام سفارش</h2>
      <ul className="mt-4 divide-y divide-stone-200/80">
        {order.items.map(item => <li key={item.id} className="flex gap-3 py-4 first:pt-0 last:pb-0 sm:gap-4">
          <div className="relative size-16 shrink-0 overflow-hidden rounded-xl border border-stone-200/80 bg-stone-100 sm:size-20">
            {item.image ? <Image src={item.image} alt="" fill unoptimized sizes="80px" className="object-contain" /> : <span className="flex h-full items-center justify-center px-1 text-center text-[9px] text-stone-400">بدون تصویر</span>}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-medium leading-6">{item.productName}</h3>
            {item.variantName && <p className="mt-0.5 text-xs text-stone-600">{item.variantName}</p>}
            {item.options.length > 0 && <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-stone-500" aria-label="گزینه‌های سفارش">{item.options.map((option, index) => <li key={`${option.key ?? option.label ?? "option"}-${index}`}>{checkoutOptionLabel(option)}</li>)}</ul>}
            {item.sku && <p className="mt-1 text-[11px] text-stone-500">شناسه کالا: <bdi dir="ltr" className="font-mono">{item.sku}</bdi></p>}
            <p className="mt-2 text-xs text-stone-500">{new Intl.NumberFormat("fa-IR").format(item.quantity)} عدد <span aria-hidden="true">·</span> {checkoutMoney(item.unitPrice)} برای هر عدد</p>
          </div>
          <p className="shrink-0 self-center text-xs font-semibold tabular-nums sm:text-sm">{checkoutMoney(item.lineTotal)}</p>
        </li>)}
      </ul>
    </section>

    <section aria-label="جمع مبالغ" className="rounded-3xl border border-stone-200/80 bg-white/80 p-5 sm:p-8">
      <dl className="space-y-3 text-sm">
        <div className="flex justify-between gap-4"><dt className="text-stone-600">جمع کالاها</dt><dd className="shrink-0 tabular-nums">{checkoutMoney(order.subtotal)}</dd></div>
        {order.discount > 0 && <div className="flex justify-between gap-4"><dt className="text-stone-600">تخفیف ثبت‌شده</dt><dd className="shrink-0 tabular-nums">−{checkoutMoney(order.discount)}</dd></div>}
        {order.deliveryFee > 0 && <div className="flex justify-between gap-4"><dt className="text-stone-600">هزینه ارسال ثبت‌شده</dt><dd className="shrink-0 tabular-nums">{checkoutMoney(order.deliveryFee)}</dd></div>}
        <div className="flex justify-between gap-4 border-t border-stone-200 pt-4 text-base font-semibold"><dt>مبلغ نهایی</dt><dd className="shrink-0 tabular-nums">{checkoutMoney(order.total)}</dd></div>
      </dl>
    </section>

    {(order.type === "DELIVERY" && order.deliveryAddress || order.notes) && <section aria-labelledby="confirmation-delivery-title" className="rounded-3xl border border-stone-200/80 bg-white/80 p-5 sm:p-8">
      <h2 id="confirmation-delivery-title" className="text-sm font-semibold">اطلاعات دریافت</h2>
      {order.type === "DELIVERY" && order.deliveryAddress && <div className="mt-3"><h3 className="text-xs text-stone-500">نشانی تحویل</h3><p className="mt-1 whitespace-pre-line text-sm leading-7">{order.deliveryAddress}</p></div>}
      {order.notes && <div className="mt-4 border-t border-stone-200 pt-4"><h3 className="text-xs text-stone-500">یادداشت سفارش</h3><p className="mt-1 whitespace-pre-line text-sm leading-7">{order.notes}</p></div>}
    </section>}

    {children && <section aria-label="اقدام‌های مرتبط با پرداخت" className="rounded-3xl border border-stone-200/80 bg-white/80 p-5 sm:p-8">{children}</section>}
    <a href={storefrontPath} className={`${focus} flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-stone-200 bg-transparent px-5 text-sm font-medium text-stone-700 transition-colors hover:bg-white motion-reduce:transition-none`}><ArrowRight aria-hidden="true" className="size-4" />بازگشت به فروشگاه</a>
  </main>;
}
