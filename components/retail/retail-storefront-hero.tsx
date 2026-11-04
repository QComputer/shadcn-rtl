"use client";

import Image from "next/image";
import { ArrowUpLeft, ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { buildRetailHeroSlides } from "@/lib/retail/hero-presentation";
import { formatRetailMoney } from "@/lib/retail/format-price";
import type { RetailProduct } from "@/lib/retail/variant-selection";
import { useCatalogTheme } from "./use-catalog-theme";

type Props = { name: string; description: string | null; logo: string | null; cover: string | null; theme: "FASHION" | "ELECTRONICS" | "GENERAL"; products: RetailProduct[]; storefrontPath: string };
const focus = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring";
const money = formatRetailMoney;

export function RetailStorefrontHero({ name, description, logo, cover, theme, products, storefrontPath }: Props) {
  const catalogTheme = useCatalogTheme();
  const slides = useMemo(() => catalogTheme ? buildRetailHeroSlides(products, catalogTheme) : [], [products, catalogTheme]);
  const [index, setIndex] = useState(0);
  const [previous, setPrevious] = useState<number | null>(null);
  const [ready, setReady] = useState("");
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [visible, setVisible] = useState(false);
  const [motionAllowed, setMotionAllowed] = useState(false);
  const section = useRef<HTMLElement>(null);
  const currentIndex = index % Math.max(1, slides.length);
  const slide = slides[currentIndex];
  const previousSlide = previous === null ? undefined : slides[previous % Math.max(1, slides.length)];
  const productChoices = slides.filter((item, position) => slides.findIndex(candidate => candidate.product.id === item.product.id) === position);
  const href = slide ? `${storefrontPath}/product/${encodeURIComponent(slide.product.slug || slide.product.id)}` : `${storefrontPath}#products`;

  useEffect(() => {
    const node = section.current;
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.15 });
    observer.observe(node);
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setMotionAllowed(!media.matches && document.visibilityState === "visible");
    update();
    media.addEventListener("change", update);
    document.addEventListener("visibilitychange", update);
    return () => { observer.disconnect(); media.removeEventListener("change", update); document.removeEventListener("visibilitychange", update); };
  }, []);

  useEffect(() => {
    if (slides.length < 2 || !visible || !motionAllowed || paused || hovered || focused) return;
    const timer = window.setInterval(() => { setPrevious(currentIndex); setIndex((currentIndex + 1) % slides.length); }, 6500);
    return () => window.clearInterval(timer);
  }, [slides.length, currentIndex, visible, motionAllowed, paused, hovered, focused]);

  function go(next: number) {
    setPrevious(currentIndex);
    setIndex((next + slides.length) % slides.length);
    setPaused(true);
  }

  return <section ref={section} data-retail-hero aria-label={`ویترین ${name}`} aria-roledescription="نمایش اسلاید محصولات" className="mx-auto max-w-7xl px-4 pb-3 md:px-10" onPointerEnter={() => setHovered(true)} onPointerLeave={() => setHovered(false)} onFocusCapture={() => setFocused(true)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }} onKeyDown={event => { if (event.target !== event.currentTarget || slides.length < 2) return; if (event.key === "ArrowLeft") { event.preventDefault(); go(currentIndex + 1); } if (event.key === "ArrowRight") { event.preventDefault(); go(currentIndex - 1); } }}>
    <div className="grid overflow-hidden rounded-[1.75rem] border border-border/70 bg-card text-card-foreground lg:grid-cols-[.8fr_1.4fr] lg:rounded-[2rem]">
      <div className="flex min-w-0 flex-col justify-center px-5 pb-5 pt-6 sm:px-8 sm:pt-8 lg:px-9 lg:py-10">
        <div className="flex min-w-0 items-center gap-2.5">{logo && <Image src={logo} alt="" width={40} height={40} unoptimized className="size-10 shrink-0 rounded-xl border border-border bg-background object-contain p-1" />}<p className="truncate text-xs font-medium text-muted-foreground">{name}</p><span className="ms-auto hidden h-px w-9 bg-border sm:block" /></div>
        <h1 className="mt-4 text-[clamp(1.7rem,3.6vw,3.1rem)] font-semibold leading-[1.45] tracking-tight">{theme === "ELECTRONICS" ? <>انتخابی دقیق،<br className="hidden lg:block" /> برای هر روز.</> : <>قدم بعدی،<br className="hidden lg:block" /> انتخاب توست.</>}</h1>
        <p className="mt-3 line-clamp-3 max-w-md text-xs leading-6 text-muted-foreground sm:text-sm sm:leading-7 lg:mt-5">{description?.trim() || (theme === "FASHION" ? "مدل‌ها را ببین؛ رنگ و سایز مناسب خودت را انتخاب کن." : "محصولات فروشگاه را ببین و انتخاب مناسب خودت را پیدا کن.")}</p>
        <div className="mt-5 flex flex-wrap gap-2 lg:mt-7"><a href={href} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-xs font-semibold text-primary-foreground transition hover:bg-primary/90 sm:text-sm ${focus}`}>{slide ? "مشاهدهٔ محصول" : "مشاهدهٔ محصولات"}<ArrowUpLeft aria-hidden className="size-4" /></a><a href={`${storefrontPath}#products`} className={`inline-flex min-h-11 items-center justify-center rounded-xl border border-border px-4 text-xs font-medium transition hover:bg-muted sm:text-sm ${focus}`}>همهٔ محصولات</a></div>
        <a href="#categories" className={`mt-5 hidden w-fit items-center gap-1 text-xs text-muted-foreground hover:text-foreground lg:inline-flex ${focus}`}>انتخاب بر اساس دسته‌بندی<ChevronLeft aria-hidden className="size-3.5" /></a>
      </div>
      <div className="min-w-0 border-t border-border/60 bg-muted/30 p-3 sm:p-4 lg:border-s lg:border-t-0">
        <div className="relative h-[clamp(15rem,65vw,21rem)] overflow-hidden rounded-2xl bg-muted/40 lg:h-[390px]">
          {slide ? <a href={href} aria-label={`مشاهده ${slide.product.name}${slide.color ? `، رنگ ${slide.color}` : ""}`} className={`absolute inset-0 ${focus}`}>
            <Image src={previousSlide?.src || slide.src} alt="" aria-hidden fill unoptimized sizes="(max-width: 1024px) 100vw, 65vw" className="object-contain p-2 sm:p-4" />
            <Image key={slide.id} src={slide.src} alt={`${slide.product.media.alt || slide.product.name}${slide.color ? `، ${slide.color}` : ""}`} fill unoptimized preload={currentIndex === 0} sizes="(max-width: 1024px) 100vw, 65vw" onLoad={() => setReady(slide.id)} className={`object-contain p-2 transition-opacity duration-700 motion-reduce:transition-none sm:p-4 ${ready === slide.id ? "opacity-100" : "opacity-0"}`} />
          </a> : cover ? <Image src={cover} alt={name} fill unoptimized preload sizes="(max-width: 1024px) 100vw, 65vw" className="object-contain p-4" /> : <div className="grid h-full place-items-center px-6 text-center text-2xl font-semibold text-muted-foreground">{name}</div>}
        </div>
        {slide && <div className="flex min-h-20 min-w-0 items-center gap-3 px-1 pb-1 pt-3" aria-live={paused ? "polite" : "off"} aria-atomic="true"><div className="min-w-0 flex-1"><p className="truncate text-[10px] text-muted-foreground sm:text-xs">{slide.product.category.name}{slide.color ? ` · رنگ ${slide.color}` : ""}</p><h2 className="mt-1 truncate text-sm font-semibold sm:text-base"><a href={href} className={focus}>{slide.product.name}</a></h2></div><div className="shrink-0 text-end"><p className="text-xs font-semibold tabular-nums sm:text-sm">{slide.fromPrice ? "از " : ""}{money(slide.price)}</p>{slide.listPrice !== undefined && slide.listPrice > slide.price && <del className="mt-1 block text-[10px] text-muted-foreground">{money(slide.listPrice)}</del>}</div></div>}
        {slides.length > 1 && <div className="flex min-w-0 items-center gap-2 border-t border-border/60 px-1 pt-3">
          <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto py-1 [scrollbar-width:thin] dark:[color-scheme:dark]" aria-label="انتخاب محصول ویترین">{productChoices.map(item => <button key={item.product.id} type="button" aria-label={`نمایش ${item.product.name}`} aria-pressed={slide?.product.id === item.product.id} onClick={() => go(slides.findIndex(candidate => candidate.id === item.id))} className={`relative size-10 shrink-0 overflow-hidden rounded-lg border bg-background transition ${focus} ${slide?.product.id === item.product.id ? "border-primary ring-1 ring-primary/30" : "border-border opacity-60 hover:opacity-100"}`}><Image src={item.src} alt="" fill unoptimized sizes="40px" className="object-contain p-0.5" /></button>)}</div>
          {motionAllowed && <button type="button" onClick={() => setPaused(value => !value)} aria-label={paused ? "پخش خودکار ویترین" : "توقف پخش ویترین"} aria-pressed={paused} className={`grid size-9 shrink-0 place-items-center rounded-lg border border-border bg-card text-foreground ${focus}`}>{paused ? <Play aria-hidden className="size-3.5" /> : <Pause aria-hidden className="size-3.5" />}</button>}
          <button type="button" onClick={() => go(currentIndex - 1)} aria-label="اسلاید قبلی" className={`grid size-9 shrink-0 place-items-center rounded-lg border border-border bg-card ${focus}`}><ChevronRight aria-hidden className="size-4" /></button><button type="button" onClick={() => go(currentIndex + 1)} aria-label="اسلاید بعدی" className={`grid size-9 shrink-0 place-items-center rounded-lg border border-border bg-card ${focus}`}><ChevronLeft aria-hidden className="size-4" /></button>
        </div>}
      </div>
    </div>
  </section>;
}
