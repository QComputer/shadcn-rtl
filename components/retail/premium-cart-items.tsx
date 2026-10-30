import Image from "next/image";
import { Minus, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  checkoutItemImage,
  checkoutItemTotal,
  checkoutMoney,
  checkoutOptionLabel,
  checkoutQuantityValid,
  type CheckoutCartItem,
} from "@/lib/retail/checkout-presentation";

type Props = {
  items: CheckoutCartItem[];
  storefrontPath: string;
  busy: boolean;
  busyItemId: string | null;
  onQuantity: (item: CheckoutCartItem, quantity: number) => void;
  onRemove: (item: CheckoutCartItem) => void;
  compact?: boolean;
};

const focus = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring";

export function PremiumCartItems({ items, storefrontPath, busy, busyItemId, onQuantity, onRemove, compact = false }: Props) {
  if (!items.length) return <Card className="border-border bg-card text-muted-foreground px-5 py-8 text-center">سبد خرید خالی است.</Card>;

  return <ul dir="rtl" lang="fa" className="divide-y divide-stone-200/80" aria-label="اقلام سبد خرید">
    {items.map(item => {
      const image = checkoutItemImage(item);
      const isBusy = busy || busyItemId === item.id;
      const orderable = item.availability?.orderable !== false;
      const availability = !orderable
        ? (item.availability?.reason === "insufficient_stock" ? "موجودی برای این تعداد کافی نیست؛ تعداد را کم کنید" : "این گزینه فعلاً قابل سفارش نیست")
        : item.availability?.reason
          ? "قابل سفارش"
        : item.availability?.maxQuantity !== null && item.availability?.maxQuantity !== undefined
          ? `موجود؛ حداکثر ${new Intl.NumberFormat("fa-IR").format(item.availability.maxQuantity)} عدد`
          : "قابل سفارش";
      const productHref = item.variant.product.slug
        ? `${storefrontPath.replace(/\/$/, "")}/product/${encodeURIComponent(item.variant.product.slug)}`
        : null;
      return <li key={item.id} className={`flex min-w-0 gap-3 py-5 sm:gap-5 ${compact ? "first:pt-0 last:pb-0" : ""}`}>
        <div className="bg-muted relative size-[76px] shrink-0 overflow-hidden rounded-xl border border-border/80 sm:size-24">
          {image ? <Image src={image} alt="" fill unoptimized sizes="96px" className="object-contain" /> : <div className="text-muted-foreground flex h-full items-center justify-center px-2 text-center text-[10px]">تصویر ثبت نشده</div>}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-1.5">
              {item.variant.product.brand && <p className="truncate text-[11px] font-medium text-stone-500">{item.variant.product.brand}</p>}
              <h3 className="text-foreground text-sm font-semibold leading-6">{productHref ? <a href={productHref} className={`${focus} rounded-sm underline-offset-4 hover:underline`}>{item.variant.product.name}</a> : item.variant.product.name}</h3>
              {item.variant.name && <p className="text-xs text-stone-600">{item.variant.name}</p>}
            </div>
              {!compact && <details className="relative shrink-0 text-xs text-muted-foreground">
              <summary className={`${focus} flex min-h-11 cursor-pointer list-none items-center gap-1.5 rounded-lg px-2 hover:bg-muted`}><Trash2 aria-hidden="true" className="size-4" /><span>حذف</span></summary>
              <Card className="bg-popover text-popover-foreground absolute left-0 top-full z-10 mt-1 w-52 border p-3 shadow-lg">
                <p className="text-popover-foreground mb-3 text-xs leading-5">این کالا از سبد حذف شود؟</p>
                <div className="flex gap-2"><Button type="button" variant="destructive" size="sm" disabled={isBusy} onClick={() => onRemove(item)} className="min-h-11 flex-1">{busyItemId === item.id ? "در حال حذف…" : "بله، حذف شود"}</Button><Button type="button" variant="outline" size="sm" onClick={event => { event.currentTarget.closest("details")?.removeAttribute("open"); }} className="min-h-11">انصراف</Button></div>
              </Card>
            </details>}
          </div>
          {item.variant.options?.length ? <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-stone-500" aria-label="گزینه‌های انتخاب‌شده">{item.variant.options.map((option, index) => <li key={`${option.key ?? option.label ?? "option"}-${index}`}>{checkoutOptionLabel(option)}</li>)}</ul> : null}
          {item.variant.sku && <p className="mt-1.5 text-[11px] text-stone-500">شناسه کالا: <bdi dir="ltr" className="font-mono">{item.variant.sku}</bdi></p>}
          <p className={`text-muted-foreground mt-2 text-[11px] ${!orderable ? "font-medium text-amber-700 dark:text-amber-400" : ""}`} role="status">{availability}</p>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
            <div className="text-muted-foreground space-y-1 text-xs"><p>قیمت واحد: <span className="text-foreground font-medium">{checkoutMoney(item.unitPrice)}</span></p><p>جمع این کالا: <span className="text-foreground font-semibold">{checkoutMoney(checkoutItemTotal(item))}</span></p></div>
            {!compact && <div className="flex items-center gap-2" aria-label={`تعداد ${item.variant.product.name}`}>
              <button type="button" aria-label={`افزایش تعداد ${item.variant.product.name}`} disabled={isBusy || !orderable || !checkoutQuantityValid(item.quantity + 1, item.availability?.maxQuantity ?? null)} onClick={() => onQuantity(item, item.quantity + 1)} className={`${focus} flex size-11 items-center justify-center rounded-xl border border-stone-200 bg-white text-stone-800 transition-colors hover:border-stone-400 disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none`}><Plus aria-hidden="true" className="size-4" /></button>
              <span aria-live="polite" aria-atomic="true" className="min-w-8 text-center text-sm font-semibold tabular-nums">{new Intl.NumberFormat("fa-IR").format(item.quantity)}</span>
              <button type="button" aria-label={`کاهش تعداد ${item.variant.product.name}`} disabled={isBusy || item.quantity <= 1} onClick={() => onQuantity(item, item.quantity - 1)} className={`${focus} flex size-11 items-center justify-center rounded-xl border border-stone-200 bg-white text-stone-800 transition-colors hover:border-stone-400 disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none`}><Minus aria-hidden="true" className="size-4" /></button>
            </div>}
          </div>
        </div>
      </li>;
    })}
  </ul>;
}
