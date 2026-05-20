"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Calendar, Clock, Loader2, MapPin, Search, ShoppingBag, Sparkles, Store, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Locale = "fa" | "en" | "ar";
type ResultType = "ORGANIZATION" | "PRODUCT" | "SERVICE";

type HeroSlide = {
  id: string;
  title: string;
  subtitle: string | null;
  href: string;
  image: string | null;
  type: "SHOP" | "APPOINTMENT";
  badge: string;
};

type SearchResult = {
  id: string;
  type: ResultType;
  title: string;
  subtitle: string | null;
  href: string;
  image: string | null;
  organizationName?: string;
  price?: number | null;
  duration?: number | null;
};

type SearchResponse = {
  query: string;
  results: SearchResult[];
  total: number;
};

const labels = {
  fa: {
    eyebrow: "کشف، خرید و رزرو در یک جا",
    title: "سریع‌تر پیدا کن، راحت‌تر سفارش بده",
    subtitle: "بین فروشگاه‌ها، محصولات، خدمات و مراکز نوبت‌دهی جستجو کن و مستقیم وارد خرید یا رزرو شو.",
    searchPlaceholder: "جستجوی فروشگاه، محصول، خدمت، آدرس یا دسته‌بندی...",
    searchButton: "جستجو",
    empty: "نتیجه‌ای پیدا نشد",
    hint: "برای جستجوی دقیق‌تر حداقل ۲ کاراکتر وارد کن",
    shops: "فروشگاه‌ها",
    appointments: "نوبت‌دهی‌ها",
    products: "محصولات",
    services: "خدمات",
    open: "مشاهده",
    dashboard: "پنل مدیریت",
    register: "ثبت کسب‌وکار",
    featured: "پیشنهاد امروز",
    statsOrganizations: "کسب‌وکار فعال",
    statsProducts: "محصول",
    statsServices: "خدمت",
    toman: "تومان",
    minutes: "دقیقه",
  },
  en: {
    eyebrow: "Discover, shop, and book in one place",
    title: "Find faster, order easier",
    subtitle: "Search shops, products, services, and appointment businesses, then jump straight into checkout or booking.",
    searchPlaceholder: "Search shops, products, services, address, or category...",
    searchButton: "Search",
    empty: "No results found",
    hint: "Type at least 2 characters for better results",
    shops: "Shops",
    appointments: "Appointments",
    products: "Products",
    services: "Services",
    open: "Open",
    dashboard: "Dashboard",
    register: "Register business",
    featured: "Featured today",
    statsOrganizations: "active businesses",
    statsProducts: "products",
    statsServices: "services",
    toman: "Toman",
    minutes: "min",
  },
  ar: {
    eyebrow: "اكتشف، تسوّق، واحجز في مكان واحد",
    title: "اعثر أسرع واطلب أسهل",
    subtitle: "ابحث بين المتاجر، المنتجات، الخدمات ومراكز الحجز ثم انتقل مباشرة للشراء أو الحجز.",
    searchPlaceholder: "ابحث عن متجر، منتج، خدمة، عنوان أو تصنيف...",
    searchButton: "بحث",
    empty: "لم يتم العثور على نتائج",
    hint: "اكتب حرفين على الأقل لنتائج أفضل",
    shops: "المتاجر",
    appointments: "الحجوزات",
    products: "المنتجات",
    services: "الخدمات",
    open: "عرض",
    dashboard: "لوحة التحكم",
    register: "تسجيل نشاط",
    featured: "مميز اليوم",
    statsOrganizations: "نشاط فعال",
    statsProducts: "منتج",
    statsServices: "خدمة",
    toman: "تومان",
    minutes: "دقيقة",
  },
} satisfies Record<Locale, Record<string, string>>;

const resultIcons: Record<ResultType, typeof Store> = {
  ORGANIZATION: Store,
  PRODUCT: ShoppingBag,
  SERVICE: Calendar,
};

function formatPrice(value: number | null | undefined, locale: Locale) {
  if (value == null) return null;
  return new Intl.NumberFormat(locale === "fa" ? "fa-IR" : locale === "ar" ? "ar" : "en-US").format(value);
}

export function HomeHero({
  locale,
  slides,
  stats,
}: {
  locale: Locale;
  slides: HeroSlide[];
  stats: { organizations: number; products: number; services: number };
}) {
  const text = labels[locale] ?? labels.fa;
  const isRTL = locale === "fa" || locale === "ar";
  const [activeSlide, setActiveSlide] = useState(0);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const searchAbortRef = useRef<AbortController | null>(null);

  const safeSlides = useMemo(() => {
    if (slides.length > 0) return slides;
    return [
      {
        id: "fallback",
        title: text.title,
        subtitle: text.subtitle,
        href: `/${locale}/register/organization`,
        image: null,
        type: "SHOP" as const,
        badge: text.featured,
      },
    ];
  }, [slides, locale, text.title, text.subtitle, text.featured]);

  const currentSlide = safeSlides[activeSlide % safeSlides.length];

  useEffect(() => {
    if (safeSlides.length <= 1) return;
    const timer = window.setInterval(() => {
      setActiveSlide((value) => (value + 1) % safeSlides.length);
    }, 5500);
    return () => window.clearInterval(timer);
  }, [safeSlides.length]);

  useEffect(() => {
    const trimmed = query.trim();
    searchAbortRef.current?.abort();

    if (trimmed.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    searchAbortRef.current = controller;
    setLoading(true);

    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/public/search?q=${encodeURIComponent(trimmed)}&locale=${locale}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Search failed");
        const payload = (await response.json()) as SearchResponse;
        setResults(payload.results ?? []);
        setOpen(true);
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          setResults([]);
        }
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, locale]);

  const groupedResults = useMemo(() => {
    return results.reduce<Record<ResultType, SearchResult[]>>(
      (acc, item) => {
        acc[item.type].push(item);
        return acc;
      },
      { ORGANIZATION: [], PRODUCT: [], SERVICE: [] },
    );
  }, [results]);

  const submitSearch = () => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setOpen(true);
      return;
    }
    setOpen(true);
  };

  return (
    <section className="relative overflow-hidden border-b bg-gradient-to-br from-primary/10 via-background to-secondary/20">
      <div className="absolute inset-0 -z-10 opacity-60 [background:radial-gradient(circle_at_top_left,hsl(var(--primary)/.22),transparent_34%),radial-gradient(circle_at_bottom_right,hsl(var(--primary)/.12),transparent_32%)]" />
      <div className="container mx-auto grid min-h-[620px] gap-10 px-4 py-12 lg:grid-cols-[1.05fr_.95fr] lg:items-center lg:py-20">
        <div className="space-y-8">
          <div className="inline-flex items-center gap-2 rounded-full border bg-background/70 px-3 py-1.5 text-sm text-muted-foreground shadow-sm backdrop-blur">
            <Sparkles className="h-4 w-4 text-primary" />
            {text.eyebrow}
          </div>

          <div className="space-y-5">
            <h1 className="max-w-3xl text-4xl font-black tracking-tight text-foreground sm:text-5xl lg:text-6xl">
              {text.title}
            </h1>
            <p className="max-w-2xl text-lg leading-8 text-muted-foreground sm:text-xl">
              {text.subtitle}
            </p>
          </div>

          <div className="relative max-w-2xl">
            <div className="rounded-2xl border bg-background/95 p-2 shadow-2xl shadow-primary/10 backdrop-blur">
              <div className="flex items-center gap-2">
                <Search className="mx-2 h-5 w-5 shrink-0 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onFocus={() => setOpen(true)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") submitSearch();
                    if (event.key === "Escape") setOpen(false);
                  }}
                  className="h-12 border-0 bg-transparent px-1 text-base shadow-none focus-visible:ring-0"
                  placeholder={text.searchPlaceholder}
                  aria-label={text.searchPlaceholder}
                />
                {query && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setQuery("");
                      setResults([]);
                    }}
                    aria-label="Clear search"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
                <Button type="button" className="hidden h-12 rounded-xl px-5 sm:inline-flex" onClick={submitSearch}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : text.searchButton}
                </Button>
              </div>
            </div>

            {open && (query.trim().length > 0 || results.length > 0) && (
              <div className="absolute inset-x-0 top-full z-40 mt-3 max-h-[440px] overflow-y-auto rounded-2xl border bg-background p-3 shadow-2xl">
                {query.trim().length < 2 ? (
                  <p className="px-3 py-4 text-sm text-muted-foreground">{text.hint}</p>
                ) : loading ? (
                  <div className="flex items-center gap-2 px-3 py-4 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {text.searchButton}...
                  </div>
                ) : results.length === 0 ? (
                  <p className="px-3 py-4 text-sm text-muted-foreground">{text.empty}</p>
                ) : (
                  <div className="space-y-4">
                    {([
                      ["ORGANIZATION", text.shops],
                      ["PRODUCT", text.products],
                      ["SERVICE", text.services],
                    ] as const).map(([type, title]) => {
                      const group = groupedResults[type];
                      if (group.length === 0) return null;
                      return (
                        <div key={type}>
                          <div className="mb-2 px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            {title}
                          </div>
                          <div className="space-y-1">
                            {group.map((item) => {
                              const Icon = resultIcons[item.type];
                              const price = formatPrice(item.price, locale);
                              return (
                                <Link
                                  key={`${item.type}-${item.id}`}
                                  href={item.href}
                                  className="flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-muted"
                                  onClick={() => setOpen(false)}
                                >
                                  <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-primary/10 text-primary">
                                    {item.image ? (
                                      <img src={item.image} alt="" className="h-full w-full object-cover" loading="lazy" />
                                    ) : (
                                      <Icon className="h-5 w-5" />
                                    )}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate font-medium">{item.title}</p>
                                    <p className="truncate text-xs text-muted-foreground">
                                      {item.organizationName || item.subtitle || ""}
                                      {price ? ` · ${price} ${text.toman}` : ""}
                                      {item.duration ? ` · ${item.duration} ${text.minutes}` : ""}
                                    </p>
                                  </div>
                                  <span className="text-xs text-primary">{text.open}</span>
                                </Link>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-3">
            <Link href={`/${locale}/dashboard`}>
              <Button size="lg" className="rounded-xl">
                {text.dashboard}
                {isRTL ? <ArrowLeft className="ms-2 h-4 w-4" /> : <ArrowRight className="ms-2 h-4 w-4" />}
              </Button>
            </Link>
            <Link href={`/${locale}/register/organization`}>
              <Button size="lg" variant="outline" className="rounded-xl bg-background/60">
                {text.register}
              </Button>
            </Link>
          </div>

          <div className="grid max-w-2xl grid-cols-3 gap-3">
            <StatCard value={stats.organizations} label={text.statsOrganizations} locale={locale} />
            <StatCard value={stats.products} label={text.statsProducts} locale={locale} />
            <StatCard value={stats.services} label={text.statsServices} locale={locale} />
          </div>
        </div>

        <div className="relative">
          <div className="absolute -inset-6 rounded-[2rem] bg-primary/10 blur-3xl" />
          <Link href={currentSlide.href} className="group relative block overflow-hidden rounded-[2rem] border bg-background shadow-2xl">
            <div className="aspect-[4/3] bg-muted">
              {currentSlide.image ? (
                <img
                  src={currentSlide.image}
                  alt={currentSlide.title}
                  className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                  loading="eager"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
                  {currentSlide.type === "SHOP" ? (
                    <ShoppingBag className="h-24 w-24 text-primary/40" />
                  ) : (
                    <Calendar className="h-24 w-24 text-primary/40" />
                  )}
                </div>
              )}
            </div>
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/45 to-transparent p-6 text-white">
              <Badge variant="secondary" className="mb-3 bg-white/90 text-foreground">
                {currentSlide.badge}
              </Badge>
              <h2 className="text-2xl font-bold">{currentSlide.title}</h2>
              {currentSlide.subtitle && <p className="mt-2 line-clamp-2 text-sm text-white/80">{currentSlide.subtitle}</p>}
              <div className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-white">
                {text.open}
                {isRTL ? <ArrowLeft className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
              </div>
            </div>
          </Link>

          {safeSlides.length > 1 && (
            <div className="mt-4 flex justify-center gap-2">
              {safeSlides.map((slide, index) => (
                <button
                  key={slide.id}
                  type="button"
                  className={cn("h-2 rounded-full transition-all", index === activeSlide ? "w-8 bg-primary" : "w-2 bg-muted-foreground/30")}
                  onClick={() => setActiveSlide(index)}
                  aria-label={`Show slide ${index + 1}`}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function StatCard({ value, label, locale }: { value: number; label: string; locale: Locale }) {
  const formatted = new Intl.NumberFormat(locale === "fa" ? "fa-IR" : locale === "ar" ? "ar" : "en-US", {
    notation: value > 999 ? "compact" : "standard",
  }).format(value);

  return (
    <div className="rounded-2xl border bg-background/70 p-4 text-center shadow-sm backdrop-blur">
      <div className="text-2xl font-black text-primary">{formatted}</div>
      <div className="mt-1 text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
