"use client";

import Image from "next/image";
import { ArrowUpLeft, ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent } from "react";
import type { PublicCatalogProduct } from "@/lib/public-catalog/contracts";
import { resolveRetailHeroThemeImages, type PublishedRetailHero } from "@/lib/website-studio/retail-hero-contract";
import { appPath } from "@/lib/app-base-path";
import { formatRetailMoney } from "@/lib/retail/format-price";
import { themedCardImage } from "@/lib/retail/card-presentation";
import { useCatalogTheme } from "./use-catalog-theme";

export type RetailManagedHeroProps = {
  hero: PublishedRetailHero;
  products: PublicCatalogProduct[];
  name: string;
  storefrontPath: string;
  preview?: boolean;
};

const focus = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring";
const toman = formatRetailMoney;

export function RetailManagedHero({ hero, products, name, storefrontPath, preview = false }: RetailManagedHeroProps) {
  const theme = useCatalogTheme();
  const selected = useMemo(() => {
    if (!theme) return [];
    const byId = new Map(products.map(product => [product.id, product]));
    return hero.productIds.flatMap(id => {
      const product = byId.get(id);
      if (!product) return [];
      const fallback = product.media.detail?.trim() || product.media.card?.trim() || product.media.gallery.find(src => src.trim())?.trim() || "";
      const image = themedCardImage(product.cardAppearance, theme, fallback).src || "";
      return [{ product, image }];
    }).slice(0, 3);
  }, [hero.productIds, products, theme]);
  const slides = useMemo(() => selected.filter(item => Boolean(item.image)), [selected]);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [visible, setVisible] = useState(false);
  const [motionAllowed, setMotionAllowed] = useState(false);
  const section = useRef<HTMLElement>(null);
  const currentIndex = index % Math.max(1, slides.length);
  const slide = slides[currentIndex];
  const campaign = hero.mode === "CAMPAIGN";
  const themeImages = theme ? resolveRetailHeroThemeImages(hero, theme) : null;
  const defaultHref = campaign ? `${storefrontPath.replace(/\/$/, "")}#products` : slide ? `${storefrontPath.replace(/\/$/, "")}/product/${encodeURIComponent(slide.product.slug || slide.product.id)}` : `${storefrontPath.replace(/\/$/, "")}#products`;
  const href = hero.ctaHref || defaultHref;
  const ctaHref = appPath(href);

  useEffect(() => {
    const node = section.current;
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.1 });
    observer.observe(node);
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setMotionAllowed(!media.matches && document.visibilityState === "visible");
    update();
    media.addEventListener("change", update);
    document.addEventListener("visibilitychange", update);
    return () => { observer.disconnect(); media.removeEventListener("change", update); document.removeEventListener("visibilitychange", update); };
  }, [theme]);

  useEffect(() => {
    if (hero.mode !== "PRODUCTS" || !hero.autoplay || slides.length < 2 || !visible || !motionAllowed || paused || hovered || focused) return;
    const timer = window.setInterval(() => setIndex(current => (current + 1) % slides.length), 6500);
    return () => window.clearInterval(timer);
  }, [hero.mode, hero.autoplay, slides.length, visible, motionAllowed, paused, hovered, focused]);

  if (!themeImages || !hero.enabled || (campaign ? !themeImages.desktop : !slides.length)) return null;
  const targetProps = preview ? { onClick: (event: MouseEvent<HTMLAnchorElement>) => event.preventDefault() } : {};
  const go = (next: number) => { setIndex((next + slides.length) % slides.length); setPaused(true); };

  return <section ref={section} dir="rtl" lang="fa" aria-label={`بنر ${name}`} data-retail-managed-hero className="mx-auto max-w-7xl px-4 py-3 md:px-8 lg:px-10" onPointerEnter={() => setHovered(true)} onPointerLeave={() => setHovered(false)} onFocusCapture={() => setFocused(true)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}>
    <div className="grid overflow-hidden rounded-[1.5rem] border border-border/70 bg-card text-card-foreground shadow-sm sm:rounded-[2rem] lg:grid-cols-[2fr_3fr]">
      <div className="flex min-w-0 flex-col justify-center px-5 py-6 sm:px-8 sm:py-9 lg:order-1 lg:px-10 lg:py-12">
        <p className="text-xs font-medium tracking-wide text-muted-foreground">{name}</p>
        <h1 className="mt-3 text-[clamp(1.65rem,3.5vw,3rem)] font-semibold leading-[1.45] tracking-tight">{hero.heading}</h1>
        {hero.description && <p className="mt-3 max-w-xl whitespace-pre-line text-sm leading-7 text-muted-foreground sm:text-base">{hero.description}</p>}
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <a href={ctaHref} {...targetProps} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 ${focus}`}>{hero.ctaLabel}<ArrowUpLeft aria-hidden className="size-4" /></a>
          {!campaign && slide && <p className="text-sm font-semibold tabular-nums text-foreground">{toman(slide.product.price.amount)}</p>}
        </div>
        {!campaign && slide && <p className="mt-4 text-sm text-muted-foreground" aria-live={paused ? "polite" : "off"}>{slide.product.name}</p>}
      </div>

      <div className={`relative min-w-0 bg-muted/30 lg:order-2 ${campaign ? "" : "border-t border-border/60 p-2.5 sm:p-4 lg:border-e lg:border-t-0"}`}>
        {campaign ? <div className={`relative overflow-hidden bg-muted/40 ${themeImages.hasMobileImage ? "aspect-[3/4]" : "aspect-[4/3]"} sm:aspect-auto sm:h-[clamp(22rem,42vw,30rem)] lg:h-full lg:min-h-[420px]`}>
          <picture className="absolute inset-0">
            {themeImages.hasMobileImage && themeImages.mobile && <source media="(max-width: 639px)" srcSet={themeImages.mobile} />}
            <img src={themeImages.desktop!} alt={hero.imageAlt || hero.heading} width={1600} height={1000} className={`size-full ${hero.imageFit === "contain" ? "object-contain" : "object-cover"}`} style={{ objectPosition: `${hero.focalX}% ${hero.focalY}%` }} />
          </picture>
        </div> : <div className="relative h-[clamp(14rem,58vw,24rem)] overflow-hidden rounded-[1.1rem] bg-muted/40 sm:h-[clamp(18rem,42vw,30rem)] lg:h-[390px]">
          {slides.map((item, position) => <a key={item.product.id} href={appPath(`${storefrontPath.replace(/\/$/, "")}/product/${encodeURIComponent(item.product.slug || item.product.id)}`)} {...targetProps} tabIndex={position === currentIndex ? undefined : -1} aria-hidden={position === currentIndex ? undefined : true} aria-label={`مشاهده ${item.product.name}`} className={`absolute inset-0 transition-opacity duration-700 motion-reduce:transition-none ${position === currentIndex ? "opacity-100" : "pointer-events-none opacity-0"} ${focus}`}>
            <Image src={item.image} alt={position === currentIndex ? item.product.media.alt || item.product.name : ""} fill unoptimized sizes="(max-width: 1024px) 100vw, 60vw" className={`p-2 sm:p-4 ${hero.imageFit === "contain" ? "object-contain" : "object-cover"}`} />
          </a>)}
        </div>}
        {!campaign && slides.length > 1 && <div className="mt-3 flex items-center justify-between gap-3">
          <span className="text-xs text-muted-foreground" aria-hidden="true">{new Intl.NumberFormat("fa-IR").format(currentIndex + 1)} / {new Intl.NumberFormat("fa-IR").format(slides.length)}</span>
          <div className="flex items-center gap-2">
            {hero.autoplay && motionAllowed && <button type="button" onClick={() => setPaused(value => !value)} aria-label={paused ? "پخش خودکار" : "توقف پخش خودکار"} aria-pressed={paused} className={`grid size-9 place-items-center rounded-lg border border-border bg-card ${focus}`}>{paused ? <Play aria-hidden className="size-4" /> : <Pause aria-hidden className="size-4" />}</button>}
            <button type="button" onClick={() => go(currentIndex - 1)} aria-label="اسلاید قبلی" className={`grid size-9 place-items-center rounded-lg border border-border bg-card ${focus}`}><ChevronRight aria-hidden className="size-4" /></button>
            <button type="button" onClick={() => go(currentIndex + 1)} aria-label="اسلاید بعدی" className={`grid size-9 place-items-center rounded-lg border border-border bg-card ${focus}`}><ChevronLeft aria-hidden className="size-4" /></button>
          </div>
        </div>}
      </div>
    </div>
  </section>;
}
