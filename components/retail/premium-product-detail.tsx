"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { ArrowLeft, Check, ChevronDown, LoaderCircle, ShoppingBag } from "lucide-react";
import { appPath } from "@/lib/app-base-path";
import { useOptionalCart } from "@/lib/contexts/cart-context";
import { canonicalDimensions, dimensionValues, findVariantOption, preferredVariant, retailAttributeText, type CanonicalDimension, type RetailProduct } from "@/lib/retail/variant-selection";
import { compareRetailSizes, exactProductVariant, productDetailGallery, reliableColorSwatch, variantSelection } from "@/lib/retail/product-detail";
import { PremiumProductGallery } from "./premium-product-gallery";
import { FavoriteButton } from "./favorite-button";
import { Button } from "@/components/ui/button";

type Props = { product: RetailProduct; organization: string; storeName: string; logo: string | null; storefrontPath: string; checkoutPath: string; accountPath: string; embedded?: boolean; previewOnly: boolean };
const price = (amount: number) => new Intl.NumberFormat("fa-IR").format(amount);
const focus = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring";

export function PremiumProductDetail({ product, organization, storeName, logo, storefrontPath, checkoutPath, embedded = false, previewOnly }: Props) {
  const [selection, setSelection] = useState(() => variantSelection(preferredVariant(product)));
  const [explicitVariant, setExplicitVariant] = useState(() => preferredVariant(product)?.id);
  const cart = useOptionalCart();
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const inFlight = useRef(false);
  const dims = canonicalDimensions(product);
  const colorDim = dims.find((d) => d.id === "color");
  const sizeDim = dims.find((d) => d.id === "size");
  const optionless = product.variants.length > 0 && product.variants.every(variant => variant.options.length === 0);
  const selected = optionless ? product.variants.find(variant => variant.id === explicitVariant) : exactProductVariant(product, selection);
  const options = [...new Map(product.variants.flatMap(v => v.options).map(o => [o.key, o])).values()];
  const colorKey = colorDim?.keys[0];
  const colorVariants = colorKey ? product.variants.filter(v => { const option = findVariantOption(v, colorKey); return option && retailAttributeText(option) === selection[colorKey]; }) : product.variants;
  const imageVariant = selected ?? colorVariants[0];
  const gallery = productDetailGallery(product, imageVariant);
  const minimum = Math.min(...(colorVariants.length ? colorVariants.map(v => v.price.amount) : [product.price.amount]));
  const purchasable = Boolean(selected?.orderable) && !previewOnly;
  const footwear = /کفش|کتانی|صندل|پاپوش|بوت|shoe|footwear|sneaker|boot/i.test(`${product.name} ${product.category.name}`);
  const availability = !product.variants.length ? "اطلاعات گزینه‌های خرید هنوز تکمیل نشده است" : !selected ? "این ترکیب ارائه نشده؛ گزینه دیگری انتخاب کنید" : selected.orderable ? "موجود و قابل سفارش" : "این رنگ و اندازه فعلاً ناموجود است";

  function choose(key: string, value: string) { setSelection(current => { const next = { ...current }; const dim = dims.find((d) => d.keys.includes(key)); const targetKeys = dim ? dim.keys : [key]; for (const k of targetKeys) next[k] = value; return next; }); setNotice(null); }
  async function add() {
    if (!selected || !purchasable || inFlight.current) return;
    const variantId = selected.id;
    inFlight.current = true; setPending(true); setNotice(null);
    try {
      const response = await fetch(appPath("/api/retail/v1/cart"), { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json", accept: "application/json" }, body: JSON.stringify({ organization, variantId, quantity: 1 }) });
      if (response.status === 401) { window.location.assign(appPath(`/fa/login?callbackUrl=${encodeURIComponent(window.location.pathname + window.location.search)}`)); return; }
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(response.status === 409 ? "موجودی این گزینه تغییر کرده است؛ گزینه دیگری انتخاب کنید یا دوباره بررسی کنید." : "افزودن به سبد انجام نشد؛ دوباره تلاش کنید.");
      if (payload.item?.variantId !== variantId) throw new Error("پاسخ سبد خرید با گزینه انتخاب‌شده مطابقت ندارد؛ سبد را بررسی کنید.");
      setNotice({ kind: "success", text: "همین گزینه به سبد خرید اضافه شد." });
      void cart?.refreshCart();
    } catch (error) { setNotice({ kind: "error", text: error instanceof Error ? error.message : "ارتباط برقرار نشد؛ دوباره تلاش کنید." }); }
    finally { inFlight.current = false; setPending(false); }
  }

  function dimension(dim: CanonicalDimension) {
    const values = dimensionValues(product, dim);
    if (dim.id === "size") values.sort(compareRetailSizes);
    const isColor = dim.id === "color";
    const selKey = dim.keys[0];
    const definition = options.find(o => dim.keys.includes(o.key));
    return <fieldset key={dim.id} className="min-w-0 space-y-3" disabled={pending}>
      <legend className="mb-3 flex w-full items-center gap-2 text-sm font-semibold">{definition?.label ?? dim.label}<span className="text-muted-foreground font-normal">{dim.keys.map(k => selection[k]).find(Boolean) ?? ""}</span></legend>
      <div className={`flex flex-wrap gap-2.5 ${isColor ? "" : "max-w-md"}`}>
        {values.map(value => {
          const matches = product.variants.filter(v => dim.keys.some(k => { const option = findVariantOption(v, k); return option && retailAttributeText(option) === value; }));
          const testSelection = { ...selection };
          for (const k of dim.keys) testSelection[k] = value;
          const exact = exactProductVariant(product, testSelection);
          const offered = isColor || Boolean(exact);
          const available = isColor ? matches.some(v => v.orderable) : Boolean(exact?.orderable);
          const active = dim.keys.some(k => selection[k] === value);
          const thumbnail = isColor ? (matches.find(v => v.id === exact?.id) ?? matches.find(v => v.orderable) ?? matches[0])?.media?.gallery[0] : null;
          const swatch = reliableColorSwatch(value);
          return <button key={`${dim.id}:${value}`} type="button" aria-pressed={active} aria-label={`${definition?.label ?? dim.label}: ${value}${available ? "" : "، ناموجود"}`} disabled={!offered} onClick={() => choose(selKey, value)} className={`${focus} relative inline-flex min-h-12 min-w-14 items-center justify-center gap-2.5 overflow-hidden rounded-xl border px-4 py-3 text-sm transition-colors motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-35 ${active ? "border-primary bg-primary text-primary-foreground ring-1 ring-primary" : "border-border bg-card text-card-foreground hover:border-ring"} ${!available && !isColor ? "decoration-muted-foreground line-through" : ""}`}>
            {thumbnail ? <Image src={thumbnail} alt="" width={48} height={48} unoptimized className="-my-2 -ms-2 size-12 rounded-lg bg-muted object-contain" /> : isColor && swatch ? <span aria-hidden="true" className="size-5 rounded-full border border-border" style={{ background: swatch }} /> : null}
            <span>{value}</span>{active && <Check aria-hidden="true" className="size-3.5 shrink-0" />}{!available && isColor && <span className="text-[10px] opacity-70">ناموجود</span>}
          </button>;
        })}
      </div>
    </fieldset>;
  }

  const purchaseButton = (sticky = false) => <Button type="button" onClick={() => void add()} disabled={!purchasable || pending} aria-label={sticky ? "خرید گزینه انتخاب‌شده" : `افزودن ${product.name} به سبد خرید`} size="lg" className={`min-h-14 rounded-2xl px-6 py-4 ${sticky ? "flex-1" : "w-full"}`}>
    {pending ? <LoaderCircle className="size-5 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <ShoppingBag className="size-5" aria-hidden="true" />}{pending ? "در حال افزودن…" : previewOnly ? "خرید در این پیش‌نمایش غیرفعال است" : !product.variants.length ? "فعلاً قابل سفارش نیست" : !selected ? "گزینه‌های خرید را انتخاب کنید" : selected.orderable ? "افزودن به سبد خرید" : "این گزینه ناموجود است"}
  </Button>;
  return <div dir="rtl" lang="fa" data-premium-product className="bg-background text-foreground min-h-screen pb-52 md:pb-16">
    {!embedded && <header className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 border-b border-stone-200/70 px-5 py-5 lg:px-12"><a className={`${focus} flex min-w-0 items-center gap-3 font-semibold`} href={storefrontPath}>{logo && <Image src={logo} width={36} height={36} unoptimized alt="" className="size-9 rounded-full object-contain" />}<span className="truncate">{storeName}</span></a><a href={checkoutPath} className={`${focus} flex min-h-11 items-center gap-2 text-sm`}><ShoppingBag className="size-4" />سبد خرید</a></header>}
    <div className="mx-auto max-w-[1440px] px-5 pt-5 lg:px-12 lg:pt-8">
      <nav aria-label="مسیر محصول" className="text-muted-foreground mb-5 flex flex-wrap items-center gap-2 text-xs leading-6"><a className={focus} href={storefrontPath}>فروشگاه {storeName}</a><span aria-hidden> / </span><span>{product.category.name}</span><span aria-hidden> / </span><span className="text-foreground">{product.name}</span></nav>
      <article className="grid items-start gap-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.85fr)] lg:gap-16">
        <div className="min-w-0"><PremiumProductGallery images={gallery} alt={product.media.alt || product.name} resetKey={selected?.id ?? JSON.stringify(selection)} /></div>
        <div className="min-w-0 space-y-7 lg:sticky lg:top-8 lg:py-5">
          <div className="space-y-4">{product.brand && <p className="text-xs font-semibold tracking-wider text-stone-500">{product.brand}</p>}<div className="flex items-start justify-between gap-4"><h1 className="text-2xl font-semibold leading-[1.6] tracking-tight sm:text-3xl lg:text-[2rem]">{product.name}</h1><FavoriteButton organization={organization} productId={product.id} favoritesAvailable={!previewOnly} /></div><div aria-live="polite" aria-atomic="true" className="flex flex-wrap items-baseline gap-3"><strong className="text-2xl font-semibold tabular-nums">{!selected && product.variants.length > 0 ? "از " : ""}{price(selected?.price.amount ?? minimum)} <span className="text-sm font-normal text-stone-500">تومان</span></strong>{selected?.listPrice && <del className="text-sm text-stone-400">{price(selected.listPrice.amount)} تومان</del>}</div></div>
          {(options.length > 0 || (optionless && product.variants.length > 1)) && <div className="space-y-6 border-y border-border/80 py-6">{optionless && product.variants.length > 1 && <fieldset disabled={pending}><legend className="mb-3 text-sm font-semibold">گزینه خرید</legend><div className="flex flex-wrap gap-2">{product.variants.map(variant => <button type="button" key={variant.id} aria-pressed={selected?.id === variant.id} onClick={() => { setExplicitVariant(variant.id); setNotice(null); }} className={`${focus} min-h-12 rounded-xl border px-4 py-3 text-sm ${selected?.id === variant.id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-card-foreground"}`}>{variant.name || variant.sku}{!variant.orderable && " · ناموجود"}</button>)}</div></fieldset>}{colorDim && dimension(colorDim)}{sizeDim && dimension(sizeDim)}{options.filter(o => !colorDim?.keys.includes(o.key) && !sizeDim?.keys.includes(o.key)).map(o => dimension({ id: o.key, keys: [o.key], label: o.label }))}
            {sizeDim && <details className="group rounded-xl bg-stone-100/80 p-3"><summary className={`${focus} flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 text-xs font-medium`}>{footwear ? "راهنمای اندازه‌گیری پا و انتخاب سایز" : "راهنمای انتخاب اندازه"}<ChevronDown className="size-4 transition-transform group-open:rotate-180" /></summary><div className="mt-3 space-y-2 text-xs leading-7 text-stone-600"><p>{footwear ? "روی کاغذ بایستید، پاشنه و بلندترین انگشت را علامت بزنید و فاصله را اندازه بگیرید. هر دو پا را اندازه‌گیری کنید و اندازه بزرگ‌تر را مبنا قرار دهید." : "ابعاد موردنیاز را اندازه بگیرید و با مشخصات واقعی همین محصول مقایسه کنید."}</p><p>جدول اندازه تأییدشده‌ای از برند برای این محصول ثبت نشده است. این راهنما جایگزین جدول سازنده نیست؛ پیش از خرید، تناسب اندازه را از فروشنده بررسی کنید.</p></div></details>}
          </div>}
          <div className="space-y-4"><p role="status" aria-live="polite" className={`flex items-start gap-2 text-sm leading-7 ${purchasable ? "text-emerald-800" : "text-stone-600"}`}><span aria-hidden className={`mt-2.5 size-1.5 shrink-0 rounded-full ${purchasable ? "bg-emerald-600" : "bg-stone-400"}`} />{availability}</p>{selected?.sku && <p className="text-xs text-stone-500">شناسه گزینه <span dir="ltr" className="ms-2 font-mono">{selected.sku}</span></p>}{purchaseButton()}
            {notice && <div role={notice.kind === "error" ? "alert" : "status"} className={`rounded-xl border p-4 text-sm leading-7 ${notice.kind === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-rose-200 bg-rose-50 text-rose-900"}`}>{notice.text}{notice.kind === "success" && <a href={checkoutPath} className={`${focus} mt-2 flex w-fit items-center gap-2 font-semibold underline underline-offset-4`}>مشاهده سبد و ادامه خرید<ArrowLeft className="size-4" /></a>}</div>}
          </div>
          {(product.description || product.brand || product.attributes.length > 0) && <section className="space-y-5 border-t border-stone-200 pt-6"><h2 className="text-sm font-semibold">درباره این محصول</h2>{product.description && <p className="whitespace-pre-line text-sm leading-8 text-stone-600">{product.description}</p>}{(product.brand || product.attributes.length > 0) && <dl className="divide-y divide-stone-200 text-sm">{product.brand && <div className="flex justify-between gap-5 py-3"><dt className="text-stone-500">برند</dt><dd>{product.brand}</dd></div>}{product.attributes.map(a => <div key={a.key} className="flex justify-between gap-5 py-3"><dt className="text-stone-500">{a.label}</dt><dd className="text-end">{retailAttributeText(a)}</dd></div>)}</dl>}</section>}
        </div>
      </article>
    </div>
    <div data-purchase-bar className="bg-background/95 fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-40 border-t border-border px-4 py-3 shadow-[0_-8px_28px_-18px_rgba(0,0,0,.22)] backdrop-blur md:hidden"><div className="mx-auto flex max-w-lg items-center gap-4"><div className="min-w-24"><p className="text-sm font-semibold tabular-nums">{!selected && product.variants.length > 0 ? "از " : ""}{price(selected?.price.amount ?? minimum)}</p><p className="text-muted-foreground mt-1 text-[10px]">تومان · {purchasable ? "موجود" : "قابل خرید نیست"}</p></div>{purchaseButton(true)}</div></div>
    {!embedded && <nav aria-label="پیمایش موبایل فروشگاه" className="fixed inset-x-0 bottom-0 z-50 flex h-[calc(4rem+env(safe-area-inset-bottom))] items-start justify-around border-t border-stone-200 bg-[#fcfbf8] px-4 pt-3 text-xs md:hidden"><a className={`${focus} min-h-11 px-5 py-2`} href={storefrontPath}>فروشگاه</a><a className={`${focus} min-h-11 px-5 py-2`} href={checkoutPath}>سبد خرید</a></nav>}
  </div>;
}
