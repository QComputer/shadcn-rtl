"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ThemeAwareCategoryImage } from "@/components/retail/theme-aware-category-image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Home, LayoutGrid, Share2, ShoppingBag, UserRound } from "lucide-react";
import { RetailProductCard } from "@/components/retail/retail-product-card";
import { RetailCardViewToggle, useRetailCardView } from "@/components/retail/retail-card-view-toggle";
import { RetailManagedHero } from "@/components/retail/retail-managed-hero";
import type { PublishedRetailHero } from "@/lib/website-studio/retail-hero-contract";
import { PremiumProductDetail } from "@/components/retail/premium-product-detail";
import { appPath } from "@/lib/app-base-path";
import type { RetailProduct } from "@/lib/retail/variant-selection";


type RetailView = {
  managedHero?: { hero: PublishedRetailHero; products: RetailProduct[] } | null;
  identifier: string;
  name: string;
  description: string | null;
  branding: { logo: string | null; cover: string | null };
  theme: "FASHION" | "ELECTRONICS" | "GENERAL";
  previewOnly: boolean;
  categories: Array<{ id: string; slug: string | null; name: string; image?: string | null; darkImage?: string | null }>;
  products: RetailProduct[];
};

export default function RetailLiveCatalog({ view, productSlug, storefrontPath, checkoutPath, embedded = false }: { view: RetailView; productSlug?: string; storefrontPath?: string; checkoutPath?: string; embedded?: boolean }) {
  const [cardView, setCardView] = useRetailCardView(view.identifier);
  const [products, setProducts] = useState(view.products);
  const [category, setCategory] = useState("");
  const [error, setError] = useState(false);


  const [busy, setBusy] = useState(false);
  const [page, setPage] = useState(1);
  const [retryKey, setRetryKey] = useState(0);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1 });
  const [online, setOnline] = useState<boolean | null>(null);
  const [reconnected, setReconnected] = useState(false);
  const [standalone, setStandalone] = useState(false);
  const [shareMessage, setShareMessage] = useState("");
  const reconnectTimer = useRef<number | null>(null);
  const params = useParams<{ locale: string }>();
  const locale = params.locale || "fa";
  const base = appPath(storefrontPath ?? `/${encodeURIComponent(locale)}/retail/${encodeURIComponent(view.identifier)}`);
  const checkoutHref = appPath(checkoutPath ?? `/${encodeURIComponent(locale)}/retail/${encodeURIComponent(view.identifier)}/checkout`);
  const accountHref = appPath(storefrontPath
    ? `${storefrontPath}/profile`
    : `/${encodeURIComponent(locale)}/retail/${encodeURIComponent(view.identifier)}/account`);

  const isFashion = view.theme === "FASHION";
  useEffect(() => {
    setOnline(navigator.onLine);
    const onOffline = () => {
      setOnline(false);
      setReconnected(false);
    };
    const onOnline = () => {
      setOnline(true);
      setReconnected(true);
      setRetryKey((current) => current + 1);
      if (reconnectTimer.current !== null) window.clearTimeout(reconnectTimer.current);
      reconnectTimer.current = window.setTimeout(() => setReconnected(false), 3200);
    };
    const displayMode = window.matchMedia("(display-mode: standalone)");
    const updateDisplayMode = () => setStandalone(displayMode.matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);
    updateDisplayMode();
    displayMode.addEventListener("change", updateDisplayMode);
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    return () => {
      displayMode.removeEventListener("change", updateDisplayMode);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
      if (reconnectTimer.current !== null) window.clearTimeout(reconnectTimer.current);
    };
  }, []);

  useEffect(() => {
    if (productSlug) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setBusy(true);
      const params = new URLSearchParams({ page: String(page), limit: "50" });
      if (category) params.set("category", category);
      try {
        const response = await fetch(appPath(`/api/public/v1/organizations/${encodeURIComponent(view.identifier)}/products?${params}`), { signal: controller.signal, headers: { Accept: "application/json" } });
        if (!response.ok) throw new Error("catalog request failed");
        const body = await response.json() as { version: string; data: { products: RetailProduct[]; pagination: { page: number; totalPages: number } } };
        if (body.version !== "v1" || !Array.isArray(body.data.products)) throw new Error("catalog response invalid");
        setProducts(body.data.products);
        setPagination(body.data.pagination);
        setError(false);
      } catch {
        if (!controller.signal.aborted) setError(true);
      } finally {
        if (!controller.signal.aborted) setBusy(false);
      }
    }, 180);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [view.identifier, category, page, productSlug, retryKey]);



  const detail = productSlug ? products.find((product) => product.slug === productSlug || product.id === productSlug) : undefined;
  const categoryProducts = view.categories;
  const selectedCategory = categoryProducts.find((item) => item.id === category || item.slug === category);
  const changeCategory = (value: string) => {
    if (value === category && page === 1) return;
    setBusy(true);
    setError(false);
    setCategory(value);
    setPage(1);
  };
  const shareStore = async () => {
    setShareMessage("");
    const shareData = { title: view.name, text: `فروشگاه ${view.name}`, url: window.location.href };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
        setShareMessage("نشانی فروشگاه به اشتراک گذاشته شد.");
        return;
      }
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(window.location.href);
        setShareMessage("نشانی فروشگاه کپی شد.");
        return;
      }
      setShareMessage("برای نگه‌داشتن فروشگاه، نشانی آن را از نوار آدرس مرورگر کپی کنید.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setShareMessage("اشتراک‌گذاری انجام نشد. نشانی را از نوار آدرس مرورگر کپی کنید.");
    }
  };
  const renderProduct = (product: RetailProduct) => <RetailProductCard key={product.id} product={product} organization={view.identifier} storefrontPath={base} previewOnly={view.previewOnly} view={cardView} />;

  if (productSlug && detail) return <PremiumProductDetail key={detail.id} product={detail} organization={view.identifier} storeName={view.name} logo={view.branding.logo} storefrontPath={base} checkoutPath={checkoutHref} accountPath={accountHref} embedded={embedded} previewOnly={view.previewOnly} />;

  return <main dir="rtl" lang="fa" data-retail-display-mode={standalone ? "standalone" : "browser"} className="bg-background text-foreground min-h-screen pb-24 md:pb-0">
    {view.previewOnly && <div className="bg-[#252720] px-4 py-2 text-center text-xs text-white">پیش‌نمایش نمایشی · این محصولات و تصاویر نمونه هستند و برای خرید واقعی نیستند</div>}
    {online === false && <div role="status" aria-live="polite" className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-center text-sm text-amber-950">اتصال اینترنت قطع است. اطلاعات همین صفحه در دسترس می‌ماند؛ برای تازه‌کردن محصولات یا ادامه خرید دوباره متصل شوید.</div>}
    {reconnected && online && <div role="status" aria-live="polite" className="border-b border-emerald-200 bg-emerald-50 px-4 py-3 text-center text-sm text-emerald-950">اتصال برقرار شد؛ فهرست فروشگاه دوباره بررسی می‌شود.</div>}
    {!embedded && <><header className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4 md:px-10 md:py-5">
      <a href={base} className="flex min-w-0 items-center gap-3 text-lg font-bold tracking-tight md:text-xl" aria-label={`صفحه اصلی فروشگاه ${view.name}`}>
        {view.branding.logo && <Image src={view.branding.logo} width={42} height={42} unoptimized alt={view.name} className="h-10 w-10 shrink-0 rounded-xl object-contain" />}
        <span className="truncate">{view.name}</span>
      </a>
      {!productSlug && <nav aria-label="ناوبری فروشگاه" className="hidden gap-8 text-sm md:flex"><a href={`${base}#categories`}>دسته‌بندی‌ها</a><a href={`${base}#products`}>محصولات</a><a href={`${base}/discover`}>جست‌وجوی پیشرفته</a></nav>}
      <div className="flex shrink-0 items-center gap-2">{!view.previewOnly && <><a href={accountHref} className="hidden min-h-11 items-center rounded-full border border-[#d9d5cd] px-4 py-3 text-sm sm:flex">حساب من</a><a href={checkoutHref} className="min-h-11 rounded-full border border-[#d9d5cd] px-3 py-2.5 text-sm sm:px-4 sm:py-3">سبد خرید</a></>}<a href={`${base}#products`} className="hidden min-h-11 items-center rounded-full border border-[#d9d5cd] px-4 py-3 text-sm sm:flex">مشاهده کالاها <span aria-hidden>⌕</span></a></div>
    </header>
    <section aria-label="دسترسی و نصب فروشگاه" className="mx-auto flex max-w-7xl flex-col gap-3 px-4 pb-4 md:flex-row md:items-center md:justify-between md:px-10">
      <div className="flex items-start gap-3 rounded-2xl border border-[#e2dfd8] bg-white/80 p-4">
        <span className="mt-0.5 rounded-full bg-[#f1eee8] p-2 text-[#756047]" aria-hidden><Share2 className="h-4 w-4" /></span>
        <div><p className="text-sm font-semibold">دسترسی به {view.name}</p><p className="mt-1 text-xs leading-6 text-[#6e6a60]">{standalone ? "این صفحه در حالت تمام‌صفحه نمایش داده می‌شود؛ نام و نشان برنامه نصب‌شده را پلتفرم تعیین می‌کند." : "نصب اختصاصی این فروشگاه از این مسیر هنوز تأیید نشده است. می‌توانید نشانی همین فروشگاه را ذخیره یا هم‌رسانی کنید."}</p></div>
      </div>
      <button type="button" onClick={() => void shareStore()} className="min-h-11 shrink-0 rounded-full border border-[#d9d5cd] bg-white px-5 py-3 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9b7653]">هم‌رسانی نشانی فروشگاه</button>
      {shareMessage && <p role="status" aria-live="polite" className="text-xs text-[#6e6a60] md:basis-full">{shareMessage}</p>}
    </section></>}
    {!productSlug && <>
    {!category && view.managedHero && <RetailManagedHero {...view.managedHero} name={view.name} storefrontPath={base} />}
    <section id="categories" className="mx-auto max-w-7xl px-4 py-8 md:px-10">
      <div className="flex items-end justify-between gap-4 border-b border-border pb-4"><div><span className="text-xs text-muted-foreground">{isFashion ? "انتخاب بر اساس دسته" : "دسته‌بندی محصولات"}</span><h2 className="mt-2 text-2xl font-semibold">دسته‌بندی‌ها</h2></div><button type="button" onClick={() => changeCategory("")} aria-pressed={!category} className="rounded-md px-2 py-1 text-sm text-muted-foreground transition hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">همه دسته‌بندی‌ها</button></div>
      {categoryProducts.length ? <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">{categoryProducts.map((item) => {
        const value = item.slug ?? item.id;
        const active = category === value;
        return <button key={item.id} type="button" onClick={() => { changeCategory(active ? "" : value); document.getElementById("products")?.scrollIntoView({ behavior: "smooth" }); }} aria-pressed={active} className={`group relative min-h-32 overflow-hidden rounded-2xl text-start focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${active ? "ring-2 ring-primary" : ""}`}>
          {(item.image || item.darkImage || view.products.some((product) => product.category.id === item.id && product.media.card)) ? <ThemeAwareCategoryImage light={item.image} dark={item.darkImage} fallback={view.products.find((product) => product.category.id === item.id && product.media.card)?.media.card} /> : <span className="absolute inset-0 bg-gradient-to-br from-[#e9e5dc] to-[#d3cdc2]" />}
          <span className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-transparent" /><span className="absolute inset-x-0 bottom-0 p-3 text-xs font-semibold text-white">{item.name}</span>
        </button>;
      })}</div> : <p className="bg-card text-card-foreground mt-5 rounded-xl p-5 text-sm">دسته‌بندی فعالی برای نمایش ثبت نشده است.</p>}
    </section>
    <section id="products" className="mx-auto max-w-7xl px-5 pb-20 pt-7 md:px-10">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between"><div><span className="text-xs text-[#92704e]">{selectedCategory ? "دسته‌بندی انتخاب‌شده" : "فهرست منتشرشده فروشگاه"}</span><h2 className="mt-2 text-3xl font-semibold">{selectedCategory ? selectedCategory.name : view.theme === "ELECTRONICS" ? "دستگاه‌ها و مشخصات" : "محصولات فروشگاه"}</h2></div>
        <div className="flex flex-wrap items-center gap-2">
          <RetailCardViewToggle value={cardView} onChange={setCardView} />
          <Link href={`${base}/discover`} className="min-h-11 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">جست‌وجوی پیشرفته</Link>
          {category && <button type="button" onClick={() => changeCategory("")} className="min-h-11 rounded-xl border border-border bg-card px-4 py-2.5 text-sm text-foreground hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">حذف فیلتر دسته‌بندی</button>}
        </div>
      </div>
      {error ? <div role="alert" className="mt-8 rounded-2xl bg-card p-8 text-center text-destructive"><p>{online === false ? "اتصال اینترنت برقرار نیست. پس از اتصال دوباره تلاش کنید." : "دریافت محصولات ممکن نشد. اتصال را بررسی کنید و دوباره تلاش کنید."}</p><button type="button" onClick={() => { setError(false); setRetryKey((current) => current + 1); }} className="mt-4 min-h-11 rounded-full border border-border px-5 text-sm text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">تلاش دوباره</button></div> : busy ? <p role="status" className="mt-8 rounded-2xl bg-card p-10 text-center text-foreground">در حال دریافت محصولات…</p> : products.length ? <><div className="mt-7 grid auto-rows-fr grid-cols-2 gap-3 md:grid-cols-3 md:gap-5 xl:grid-cols-4">{products.map(renderProduct)}</div><nav aria-label="صفحه‌های محصولات" className="mt-8 flex items-center justify-center gap-4"><button disabled={pagination.page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))} className="min-h-11 rounded-full border border-border px-5 text-foreground disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">قبلی</button><span className="text-sm text-muted-foreground" aria-live="polite">صفحه {new Intl.NumberFormat("fa-IR").format(pagination.page)} از {new Intl.NumberFormat("fa-IR").format(pagination.totalPages)}</span><button disabled={pagination.page >= pagination.totalPages} onClick={() => setPage((current) => Math.min(pagination.totalPages, current + 1))} className="min-h-11 rounded-full border border-border px-5 text-foreground disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">بعدی</button></nav></> : <div className="mt-8 rounded-2xl border border-dashed border-border bg-card p-10 text-center text-muted-foreground">محصولی با این مشخصات پیدا نشد. فیلترها را تغییر دهید.</div>}
      <p className="mt-6 text-center text-xs text-[#77736a]">قیمت و وضعیت موجودی از فهرست منتشرشده فروشگاه دریافت شده‌اند.</p>
    </section>
    </>}
    {!embedded && <><footer className="border-t border-[#e1ded7] bg-[#f0eee8] px-5 py-8 text-center text-sm text-[#6e6a60]">{view.name} · فروشگاه خرده‌فروشی بازارباز</footer>
    <nav aria-label="پیمایش موبایل فروشگاه" className={`fixed inset-x-0 bottom-0 z-40 grid ${view.previewOnly ? "grid-cols-2" : "grid-cols-4"} border-t border-[#e2dfd8] bg-[#fffefa]/95 px-2 pt-2 shadow-[0_-6px_24px_rgba(36,36,31,.08)] backdrop-blur md:hidden`} style={{ paddingBottom: "max(.5rem, env(safe-area-inset-bottom))" }}>
      <a href={base} className="flex min-h-12 flex-col items-center justify-center gap-1 text-[10px] text-[#4c4a43] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#9b7653]"><Home className="h-4 w-4" /><span>فروشگاه</span></a>
      <a href={`${base}#categories`} className="flex min-h-12 flex-col items-center justify-center gap-1 text-[10px] text-[#4c4a43] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#9b7653]"><LayoutGrid className="h-4 w-4" /><span>دسته‌ها</span></a>
      {!view.previewOnly && <a href={checkoutHref} className="flex min-h-12 flex-col items-center justify-center gap-1 text-[10px] text-[#4c4a43] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#9b7653]"><ShoppingBag className="h-4 w-4" /><span>سبد</span></a>}
      {!view.previewOnly && <a href={accountHref} className="flex min-h-12 flex-col items-center justify-center gap-1 text-[10px] text-[#4c4a43] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#9b7653]"><UserRound className="h-4 w-4" /><span>حساب</span></a>}
    </nav></>}
  </main>;
}
