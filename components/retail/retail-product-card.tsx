"use client";

import { formatRetailSize } from "@/lib/retail/format-size";

import Image from "next/image";
import { Pause, Play, ChevronLeft } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { colorSlides, constrainedDimensions, filterCardVariants } from "@/lib/retail/card-presentation";
import { compareRetailSizes, reliableColorSwatch } from "@/lib/retail/product-detail";
import { canonicalDimensions, chooseVariant, dimensionValues, resolveSelectedVariant, retailAttributeText, type RetailProduct, type RetailVariant } from "@/lib/retail/variant-selection";
import type { RetailCardView } from "./retail-card-view-toggle";
import { formatRetailPriceNumber } from "@/lib/retail/format-price";

const noFilters: readonly string[] = [];
const focus = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

function CardMedia({ product, selected, pinned, href, favorite }: { product: RetailProduct; selected?: RetailVariant; pinned: boolean; href: string; favorite?: ReactNode }) {
  const slides = useMemo(() => colorSlides(product), [product]);
  const [index, setIndex] = useState(0);
  const [previous, setPrevious] = useState<string | null>(null);
  const [loaded, setLoaded] = useState("");
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [visible, setVisible] = useState(false);
  const [motionAllowed, setMotionAllowed] = useState(false);
  const region = useRef<HTMLDivElement>(null);
  const slide = slides[index % Math.max(1, slides.length)];
  const baseImage = selected?.media?.gallery[0] || product.media.card || product.media.gallery[0];
  const src = (!pinned && slide ? slide.src : baseImage) || null;
  const animated = !pinned && slides.length > 1;

  useEffect(() => {
    const node = region.current;
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.2 });
    observer.observe(node);
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotion = () => setMotionAllowed(!motion.matches && document.visibilityState === "visible");
    updateMotion();
    motion.addEventListener("change", updateMotion);
    document.addEventListener("visibilitychange", updateMotion);
    return () => { observer.disconnect(); motion.removeEventListener("change", updateMotion); document.removeEventListener("visibilitychange", updateMotion); };
  }, []);

  useEffect(() => {
    if (!animated || !visible || !motionAllowed || paused || hovered || focused) return;
    const timer = window.setInterval(() => { setPrevious(src); setIndex(current => (current + 1) % slides.length); }, 4500);
    return () => window.clearInterval(timer);
  }, [animated, visible, motionAllowed, paused, hovered, focused, src, slides.length]);

  return <div ref={region} className="relative aspect-square shrink-0 overflow-hidden bg-muted" onPointerEnter={() => setHovered(true)} onPointerLeave={() => setHovered(false)} onFocusCapture={() => setFocused(true)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}>
    <a href={href} aria-label={`مشاهده ${product.name}`} className={`absolute inset-0 ${focus}`}>
      {src ? <>
        <Image src={previous || baseImage || src} alt="" aria-hidden fill unoptimized sizes="(max-width: 640px) 50vw, (max-width: 1280px) 33vw, 300px" className="object-cover" />
        <Image key={src} src={src} alt={`${product.media.alt || product.name}${animated && slide ? `، ${slide.value}` : ""}`} fill unoptimized sizes="(max-width: 640px) 50vw, (max-width: 1280px) 33vw, 300px" onLoad={() => setLoaded(src)} className={`object-cover transition-opacity duration-700 motion-reduce:transition-none ${loaded === src ? "opacity-100" : "opacity-0"}`} />
      </> : <span className="grid h-full place-items-center px-3 text-center text-xs text-muted-foreground">تصویری برای این کالا ثبت نشده است</span>}
    </a>
    {favorite && <div className="absolute end-2 top-2 z-10">{favorite}</div>}
    {animated && motionAllowed && <button type="button" aria-label={paused ? `پخش تصاویر رنگ‌های ${product.name}` : `توقف تصاویر رنگ‌های ${product.name}`} aria-pressed={paused} onClick={() => setPaused(value => !value)} className={`absolute start-2 top-2 z-10 grid size-8 place-items-center rounded-full border border-border/60 bg-card/90 text-card-foreground backdrop-blur ${focus}`}>{paused ? <Play className="size-3.5" /> : <Pause className="size-3.5" />}</button>}
    {animated && slide && <span className="pointer-events-none absolute bottom-2 start-2 max-w-[calc(100%-1rem)] truncate rounded-full border border-border/60 bg-card/90 px-2 py-1 text-[10px] text-card-foreground backdrop-blur">پیش‌نمایش رنگ: {slide.value}</span>}
  </div>;
}

type Props = { product: RetailProduct; organization: string; storefrontPath: string; filters?: readonly string[]; previewOnly?: boolean; favorite?: ReactNode; view?: RetailCardView };

export function RetailProductCard({ product, storefrontPath, filters = noFilters, favorite, view = "detailed" }: Props) {
  const eligible = useMemo(() => filterCardVariants(product, filters), [product, filters]);
  const dimensions = canonicalDimensions(eligible);
  const constrained = constrainedDimensions(product, filters);
  const [choice, setChoice] = useState<string | null>(null);
  const selected = resolveSelectedVariant(eligible, choice);
  const unmatched = product.variants.length > 0 && eligible.variants.length === 0;
  const selectedExplicitly = eligible.variants.some(variant => variant.id === choice);
  const pinned = selectedExplicitly || constrained.some(dimension => dimension.id === "color");
  const compact = view === "compact";
  const href = `${storefrontPath.replace(/\/$/, "")}/product/${encodeURIComponent(product.slug || product.id)}`;
  const amount = compact ? product.price.amount : selected?.price.amount ?? product.price.amount;
  const fromPrice = compact && eligible.variants.some(variant => variant.price.amount !== amount);
  const list = compact ? product.listPrice?.amount : selected?.listPrice?.amount ?? (!selected ? product.listPrice?.amount : undefined);
  const available = compact ? eligible.variants.some(variant => variant.orderable) : selected?.orderable;

  function choose(variant: RetailVariant) { setChoice(variant.id); }

  return <article data-retail-product-card data-card-view={view} className="group flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border border-border/70 bg-card text-card-foreground shadow-sm">
    <CardMedia product={eligible} selected={compact ? undefined : selected} pinned={!compact && pinned} href={href} favorite={favorite} />
    <div className="flex min-w-0 flex-1 flex-col p-3 sm:p-4">
      <p className="truncate text-xs text-muted-foreground">{product.category.name}{product.brand ? ` · ${product.brand}` : ""}</p>
      <h2 className="mt-1 h-12 text-base font-semibold leading-6"><a href={href} className={`line-clamp-2 hover:underline ${focus}`}>{product.name}</a></h2>
      {!compact && <p className="mt-1 line-clamp-2 h-12 text-[13px] leading-6 text-muted-foreground">{product.description?.trim() || "جزئیات و مشخصات در صفحهٔ محصول"}</p>}
      {compact ? <div className="my-2 min-w-0 space-y-1.5">{dimensions.map(dimension => {
        const values = dimensionValues(eligible, dimension);
        if (dimension.id === "size") values.sort(compareRetailSizes);
        const label = dimension.id === "color" ? "رنگ" : dimension.id === "size" ? "سایز" : dimension.label;
        const summary = values.length === 1 ? `${label}: ${dimension.id === "size" ? formatRetailSize(values[0]) : values[0]}` : `${new Intl.NumberFormat("fa-IR").format(values.length)} ${label}`;
        return <div key={dimension.id} title={`${dimension.label}: ${values.map(value => dimension.id === "size" ? formatRetailSize(value) : value).join("، ")}`} className="flex min-w-0 items-center gap-1.5 text-xs leading-5 text-muted-foreground"><span className="truncate">{summary}</span>{dimension.id === "color" && values.length > 1 && <span className="flex shrink-0 gap-1" aria-hidden>{values.slice(0, 3).map(value => { const color = reliableColorSwatch(value); return color ? <span key={value} className="size-3 rounded-full border border-foreground/20" style={{ backgroundColor: color }} /> : null; })}</span>}</div>;
      })}</div> : <div className="my-3 min-w-0 space-y-2.5">
        {dimensions.map(dimension => {
          const values = dimensionValues(eligible, dimension);
          if (dimension.id === "size") values.sort(compareRetailSizes);
          const locked = constrained.some(item => item.id === dimension.id) && values.length === 1;
          const option = selected?.options.find(item => dimension.keys.includes(item.key));
          const current = option ? retailAttributeText(option) : "";
          return <fieldset key={dimension.id} className="min-w-0"><legend className="mb-1 text-[13px] font-medium">{dimension.label}{locked ? `: ${dimension.id === "size" ? formatRetailSize(current) : current}` : ""}{locked && <span className="ms-1 text-[10px] font-normal text-muted-foreground">طبق فیلتر</span>}</legend>{!locked && <div className="flex gap-1 overflow-x-auto overscroll-x-contain px-0.5 pb-1 [scrollbar-width:thin] dark:[color-scheme:dark]">
            {values.map(value => { const variant = chooseVariant(eligible, selected, dimension.keys[0], value); const swatch = dimension.id === "color" ? reliableColorSwatch(value) : undefined; return <button key={value} type="button" aria-pressed={current === value} title={dimension.id === "size" ? formatRetailSize(value) : value} onClick={() => variant && choose(variant)} className={`flex min-h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg border px-2 text-[13px] tabular-nums transition-colors ${focus} ${current === value ? "border-primary bg-primary/10 text-foreground" : "border-border bg-background text-foreground hover:bg-muted"}`}>
              {swatch && <span aria-hidden className="size-3 shrink-0 rounded-full border border-foreground/20" style={{ backgroundColor: swatch }} />}{dimension.id === "size" ? formatRetailSize(value) : value}
            </button>; })}
          </div>}</fieldset>;
        })}
        {!dimensions.length && eligible.variants.length > 1 && <label className="block text-[13px]">گزینهٔ خرید<select aria-label={`گزینهٔ خرید ${product.name}`} value={selected?.id || ""} onChange={event => { const variant = eligible.variants.find(item => item.id === event.target.value); if (variant) choose(variant); }} className={`mt-1 h-9 w-full rounded-lg border border-input bg-background px-2 ${focus}`}>{eligible.variants.map(variant => <option key={variant.id} value={variant.id}>{variant.name || variant.options.map(retailAttributeText).join(" · ")}</option>)}</select></label>}
      </div>}
      <div className="mt-auto border-t border-border/60 pt-3">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1"><strong data-retail-price className="inline-flex flex-wrap items-baseline gap-x-1 text-xl font-bold tabular-nums leading-7 sm:text-[22px]">{fromPrice && <span className="text-xs font-medium">از</span>}<bdi dir="ltr" className="whitespace-nowrap">{formatRetailPriceNumber(amount)}</bdi><span className="text-xs font-medium">تومان</span></strong>{list !== undefined && list > amount && <del className="text-xs text-muted-foreground"><bdi dir="ltr">{formatRetailPriceNumber(list)}</bdi> تومان</del>}</div>
        <p className={`mt-1 min-h-10 text-xs leading-5 ${available ? "text-emerald-700 dark:text-emerald-300" : "text-muted-foreground"}`}>{available ? "موجود" : unmatched ? "ترکیبی مطابق فیلترها ارائه نشده است" : eligible.variants.length ? compact ? "ناموجود" : "این گزینه ناموجود است" : compact ? "جزئیات در صفحهٔ محصول" : "اطلاعات گزینه‌های خرید تکمیل نشده است"}</p>
        {!compact && <a href={href} className={`mt-3 flex min-h-10 items-center justify-center gap-1 rounded-xl border border-border px-2 text-sm font-medium hover:bg-muted ${focus}`}>مشاهدهٔ محصول<ChevronLeft aria-hidden className="size-4" /></a>}
      </div>
    </div>
  </article>;
}
