"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { getBusinessShowcaseSamples } from "@/lib/public-experience/business-showcase";

export function HomepageHeroVisual({ locale }: { locale: string }) {
  const samples = getBusinessShowcaseSamples(locale === "en" || locale === "ar" ? locale : "fa");
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [reduced, setReduced] = useState(true);
  const labels = locale === "en" ? { title: "Real businesses on Bazarbaaz", pause: "Pause slideshow", play: "Play slideshow", visit: "View business", slide: "Choose example" } : locale === "ar" ? { title: "أعمال حقيقية على بازارباز", pause: "إيقاف العرض", play: "تشغيل العرض", visit: "زيارة النشاط", slide: "اختيار المثال" } : { title: "کسب‌وکارهای واقعی در بازارباز", pause: "توقف نمایش خودکار", play: "پخش خودکار", visit: "مشاهده کسب‌وکار", slide: "انتخاب نمونه" };
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    if (paused || hovered || focused || reduced) return;
    const timer = window.setInterval(() => {
      if (!document.hidden) setActive(value => (value + 1) % 3);
    }, 6000);
    return () => window.clearInterval(timer);
  }, [paused, hovered, focused, reduced]);
  const sample = samples[active];
  return (
    <section aria-label={labels.title} aria-roledescription="carousel" className="mx-auto w-full max-w-2xl overflow-hidden rounded-2xl border bg-card shadow-2xl" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} onFocusCapture={() => setFocused(true)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}>
      <div className="flex items-center justify-between border-b bg-muted/50 px-4 py-3"><span className="text-sm font-semibold">{labels.title}</span><span aria-hidden="true" className="flex gap-1.5"><i className="h-2 w-2 rounded-full bg-primary/30" /><i className="h-2 w-2 rounded-full bg-primary/50" /><i className="h-2 w-2 rounded-full bg-primary" /></span></div>
      <div className="relative aspect-[1100/760] overflow-hidden bg-muted">
        {samples.map((item, index) => <div key={item.id} aria-hidden={index !== active} className={`absolute inset-0 motion-safe:transition-opacity motion-safe:duration-700 ${index === active ? "opacity-100" : "pointer-events-none opacity-0"}`}><Image src={item.image} alt={item.alt} fill priority={index === 0} sizes="(max-width: 768px) 100vw, 600px" className="object-cover" /></div>)}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t p-4"><a href={sample.href} className="text-sm font-bold underline underline-offset-4">{sample.name} · {labels.visit}</a><button type="button" onClick={() => setPaused(value => !value)} aria-pressed={paused} className="rounded-lg border px-3 py-2 text-xs hover:bg-accent">{paused ? labels.play : labels.pause}</button></div>
      <div className="flex flex-wrap gap-2 px-4 pb-4" aria-label={labels.slide}>{samples.map((item, index) => <button type="button" key={item.id} onClick={() => { setActive(index); setPaused(true); }} aria-pressed={index === active} className={`rounded-full border px-3 py-2 text-xs transition ${index === active ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}>{item.name}</button>)}</div>
    </section>
  );
}
