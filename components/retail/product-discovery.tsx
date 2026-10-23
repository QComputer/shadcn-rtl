"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useOptimistic, useRef, useState, useTransition, type FormEvent } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowDownUp, ChevronLeft, ChevronRight, Filter, Heart, LoaderCircle, Search, SlidersHorizontal, X } from "lucide-react";
import { appPath } from "@/lib/app-base-path";
import type { PublicCatalogProduct } from "@/lib/public-catalog/contracts";
import { FavoriteButton } from "./favorite-button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

type Pagination = { page: number; limit: number; total: number; totalPages: number };
type Facets = {
  categories: Array<{ id: string; slug: string | null; name: string; count: number }>;
  brands: Array<{ value: string; count: number }>;
  attributes: Array<{ key: string; label: string; scope: "PRODUCT" | "VARIANT_OPTION"; values: Array<{ value: string; count: number }> }>;
};
type Props = {
  organization: string; storeName: string; logo: string | null; storefrontPath: string;
  initialProducts: PublicCatalogProduct[]; initialPagination: Pagination; facets: Facets; initialQuery: string;
};
type FilterState = { category?: string; brand?: string; minPrice?: string; maxPrice?: string; available?: string; filters: string[]; page: number; sort: string; saved: boolean };
const rial = (amount: number) => `${new Intl.NumberFormat("fa-IR").format(amount)} تومان`;
const field = "h-11 min-w-0 rounded-xl border border-stone-200 bg-white px-3 text-sm text-stone-800 outline-none transition focus:border-stone-500 focus:ring-2 focus:ring-stone-200";
function availableColorLabels(product: PublicCatalogProduct) {
  return [...new Set(product.variants.filter(variant => variant.orderable).flatMap(variant => variant.options.filter(option => /colou?r|رنگ/i.test(`${option.key} ${option.label}`)).map(option => String(option.value))))].slice(0, 4);
}

function parseState(params: URLSearchParams): FilterState {
  return { category: params.get("category") ?? undefined, brand: params.get("brand") ?? undefined,
    minPrice: params.get("minPrice") ?? undefined, maxPrice: params.get("maxPrice") ?? undefined,
    available: params.get("available") ?? undefined, filters: params.getAll("filter"),
    page: Math.max(1, Number(params.get("page") || 1)), sort: params.get("sort") || "newest", saved: params.get("saved") === "1" };
}
function queryString(params: URLSearchParams) { const value = params.toString(); return value ? `?${value}` : ""; }
function normalizeDigits(value: string) { return value.replace(/[۰-۹٠-٩]/g, digit => String.fromCharCode(digit.charCodeAt(0) >= 0x06f0 ? digit.charCodeAt(0) - 0x06f0 + 48 : digit.charCodeAt(0) - 0x0660 + 48)); }

export function ProductDiscovery({ organization, storeName, logo, storefrontPath, initialProducts, initialPagination, facets, initialQuery }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const paramsText = searchParams.toString();
  const [products, setProducts] = useState(initialProducts);
  const [pagination, setPagination] = useState(initialPagination);
  const [settledRequestKey, setSettledRequestKey] = useState(paramsText);
  const [retryKey, setRetryKey] = useState(0);
  const [favoriteRefreshKey, setFavoriteRefreshKey] = useState(0);
  const [isNavigationPending, startTransition] = useTransition();
  const [optimisticParams, setOptimisticParams] = useOptimistic(paramsText, (_current, next: string) => next);
  const optimisticParamsRef = useRef(paramsText);
  const loading = settledRequestKey !== paramsText || isNavigationPending;
  const [error, setError] = useState("");
  const [mobileFilters, setMobileFilters] = useState(false);
  const [queryDraft, setQueryDraft] = useState(() => new URLSearchParams(paramsText).get("q") ?? initialQuery);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [favoritesAvailable, setFavoritesAvailable] = useState(true);
  const state = useMemo(() => parseState(new URLSearchParams(optimisticParams)), [optimisticParams]);
  const currentQuery = new URLSearchParams(optimisticParams).get("q") ?? initialQuery;
  const loginCallback = pathname + queryString(new URLSearchParams(optimisticParams));

  const updateUrl = useCallback((mutate: (params: URLSearchParams) => void, replace = false) => {
    const next = new URLSearchParams(optimisticParamsRef.current);
    mutate(next);
    const nextText = next.toString();
    optimisticParamsRef.current = nextText;
    const target = pathname + queryString(next);
    startTransition(() => {
      setOptimisticParams(nextText);
      if (replace) router.replace(target, { scroll: false }); else router.push(target, { scroll: false });
    });
  }, [pathname, router, setOptimisticParams, startTransition]);

  useEffect(() => {
    if (!isNavigationPending) optimisticParamsRef.current = paramsText;
  }, [isNavigationPending, paramsText]);

  useEffect(() => { startTransition(() => setQueryDraft(currentQuery)); }, [currentQuery, startTransition]);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    async function load() {
      try {
        const params = new URLSearchParams(paramsText);
        const response = await fetch(appPath(`/api/public/v1/organizations/${encodeURIComponent(organization)}/products${queryString(params)}`), { signal: controller.signal, headers: { accept: "application/json" } });
        if (!response.ok) {
          if (response.status === 401 && params.get("saved") === "1") throw new Error("برای دیدن علاقه‌مندی‌ها وارد حساب خود شوید.");
          throw new Error("بارگذاری محصولات انجام نشد. دوباره تلاش کنید.");
        }
        const payload = await response.json();
        const data = payload.data ?? payload;
        if (!Array.isArray(data.products) || !data.pagination) throw new Error("پاسخ فهرست محصولات معتبر نیست.");
        if (active) { setProducts(data.products); setPagination(data.pagination); setError(""); setSettledRequestKey(paramsText); }
      } catch (cause) {
        if (active && !(cause instanceof DOMException && cause.name === "AbortError")) { setError(cause instanceof Error ? cause.message : "خطا در دریافت محصولات."); setSettledRequestKey(paramsText); }
      }
    }
    void load();
    return () => { active = false; controller.abort(); };
  }, [organization, paramsText, retryKey, favoriteRefreshKey]);

  useEffect(() => {
    const controller = new AbortController();
    fetch(appPath(`/api/retail/v1/favorites?organization=${encodeURIComponent(organization)}`), { signal: controller.signal, credentials: "same-origin", headers: { accept: "application/json" } })
      .then(async response => {
        if (response.status === 401) return;
        if (!response.ok) throw new Error("favorites unavailable");
        const payload = await response.json();
        const ids = (payload.data ?? payload).productIds;
        if (!Array.isArray(ids)) throw new Error("invalid favorites response");
        setSavedIds(new Set(ids.filter((id: unknown): id is string => typeof id === "string")));
      }).catch(() => { setFavoritesAvailable(false); });
    return () => controller.abort();
  }, [organization]);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    updateUrl(params => { const value = queryDraft.trim(); if (value) params.set("q", value); else params.delete("q"); params.delete("page"); });
  }
  function setFilter(key: string, value: string) {
    updateUrl(params => { if (value) params.set(key, value); else params.delete(key); params.delete("page"); });
  }
  function setAttr(key: string, value: string, active: boolean) {
    const token = `${key}:${value}`;
    updateUrl(params => { const values = params.getAll("filter").filter(item => item !== token); params.delete("filter"); for (const item of values) params.append("filter", item); if (active) params.append("filter", token); params.delete("page"); });
  }
  function removeChip(token: string) {
    updateUrl(params => { const values = params.getAll("filter").filter(item => item !== token); params.delete("filter"); values.forEach(value => params.append("filter", value)); for (const key of ["category", "brand", "minPrice", "maxPrice", "available", "q", "saved"]) if (token.startsWith(`${key}:`)) params.delete(key); params.delete("page"); });
  }
  function clearFilters() { updateUrl(params => { for (const key of [...params.keys()]) params.delete(key); }); }
  function favoriteChanged(productId: string, saved: boolean) {
    setSavedIds(previous => { const next = new Set(previous); if (saved) next.add(productId); else next.delete(productId); return next; });
    if (state.saved && !saved) {
      setProducts(previous => previous.filter(product => product.id !== productId));
      setPagination(previous => { const total = Math.max(0, previous.total - 1); const totalPages = Math.ceil(total / previous.limit); return { ...previous, total, totalPages, page: Math.min(previous.page, Math.max(1, totalPages)) }; });
      setFavoriteRefreshKey(value => value + 1);
    }
  }

  const chips = [state.category && { key: "category", label: facets.categories.find(item => item.slug === state.category || item.id === state.category)?.name ?? state.category },
    state.brand && { key: "brand", label: state.brand }, state.minPrice && { key: "minPrice", label: `از ${state.minPrice}` }, state.maxPrice && { key: "maxPrice", label: `تا ${state.maxPrice}` },
    state.available && { key: "available", label: "فقط کالاهای موجود" }, state.saved && { key: "saved", label: "علاقه‌مندی‌ها" }, ...state.filters.map(token => ({ key: token, label: token.split(":").slice(1).join(":") }))].filter(Boolean) as Array<{key: string; label: string}>;

  function controls(compact = false) { return <div className="space-y-5"><p className="text-xs leading-5 text-stone-500">تعداد کنار هر گزینه بر اساس همه محصولات فروشگاه است.</p>
    <label className="grid gap-2 text-sm font-semibold text-stone-800">دسته‌بندی<select className={field} value={state.category ?? ""} onChange={event => setFilter("category", event.target.value)}><option value="">همه دسته‌ها</option>{facets.categories.map(item => <option key={item.id} value={item.slug ?? item.id}>{item.name} ({new Intl.NumberFormat("fa-IR").format(item.count)})</option>)}</select></label>
    <label className="grid gap-2 text-sm font-semibold text-stone-800">برند<select className={field} value={state.brand ?? ""} onChange={event => setFilter("brand", event.target.value)}><option value="">همه برندها</option>{facets.brands.map(item => <option key={item.value} value={item.value}>{item.value} ({new Intl.NumberFormat("fa-IR").format(item.count)})</option>)}</select></label>
    <fieldset className="grid gap-2"><legend className="mb-2 text-sm font-semibold text-stone-800">بازه قیمت (تومان)</legend><input aria-label="حداقل قیمت" className={field} inputMode="numeric" placeholder="از" value={state.minPrice ?? ""} onChange={event => updateUrl(params => { const value = normalizeDigits(event.target.value).replace(/[^0-9]/g, ""); const maximumText = params.get("maxPrice"); if (value && maximumText !== null && Number(value) > Number(maximumText)) { setError("حداقل قیمت نمی‌تواند از حداکثر قیمت بیشتر باشد."); return; } setError(""); if (value) params.set("minPrice", value); else params.delete("minPrice"); params.delete("page"); }, true)} /><input aria-label="حداکثر قیمت" className={field} inputMode="numeric" placeholder="تا" value={state.maxPrice ?? ""} onChange={event => updateUrl(params => { const value = normalizeDigits(event.target.value).replace(/[^0-9]/g, ""); const minimumText = params.get("minPrice"); if (value && minimumText !== null && Number(value) < Number(minimumText)) { setError("حداکثر قیمت نمی‌تواند از حداقل قیمت کمتر باشد."); return; } setError(""); if (value) params.set("maxPrice", value); else params.delete("maxPrice"); params.delete("page"); }, true)} /></fieldset>
    <label className="flex min-h-11 items-center gap-3 rounded-xl border border-stone-200 px-3 text-sm font-medium"><input type="checkbox" checked={state.available === "true"} onChange={event => setFilter("available", event.target.checked ? "true" : "")} className="size-4 accent-stone-800" />فقط کالاهای موجود</label>
    {facets.attributes.map(attribute => <fieldset key={attribute.key} className="grid gap-2"><legend className="mb-2 text-sm font-semibold text-stone-800">{attribute.label}</legend>{attribute.values.map(item => { const token = `${attribute.key}:${item.value}`; const checked = state.filters.includes(token); return <label key={item.value} className="flex min-h-9 items-center gap-2 text-sm text-stone-700"><input type="checkbox" checked={checked} onChange={event => setAttr(attribute.key, item.value, event.target.checked)} className="size-4 accent-stone-800" /><span className="min-w-0 flex-1 truncate">{item.value}</span><span className="text-xs text-stone-400">{new Intl.NumberFormat("fa-IR").format(item.count)}</span></label>; })}</fieldset>)}
    {compact && <div className="grid grid-cols-2 gap-2"><button type="button" onClick={clearFilters} className="min-h-12 rounded-xl border border-stone-300 bg-white px-2 text-sm font-semibold text-stone-800">پاک کردن فیلترها</button><button type="button" onClick={() => setMobileFilters(false)} className="min-h-12 rounded-xl bg-stone-900 px-2 text-sm font-semibold text-white">نمایش کالاها</button></div>}
  </div>; }

  return <div className="min-h-screen w-full bg-[#fcfbf8] text-stone-900"><section dir="rtl" lang="fa" className="mx-auto w-full max-w-[1440px] min-w-0 px-4 pb-20 pt-8 sm:px-6 lg:px-10">
    <header className="mb-8 flex min-w-0 items-center gap-3 border-b border-stone-200/80 pb-6">{logo && <Image src={logo} alt="" width={48} height={48} unoptimized className="size-12 rounded-2xl border border-stone-200 bg-white object-contain p-1" />}<div className="min-w-0"><p className="text-xs font-medium tracking-wide text-stone-500">فروشگاه</p><h1 className="truncate text-2xl font-semibold tracking-tight text-stone-900 sm:text-3xl">{storeName}</h1></div><div className="ms-auto hidden items-center gap-2 text-xs text-stone-500 sm:flex"><span className="size-2 rounded-full bg-emerald-500" />خرید مستقیم از فروشگاه</div></header>
    <div className="grid min-w-0 gap-7 lg:grid-cols-[248px_minmax(0,1fr)]">
      <aside className="hidden min-w-0 self-start rounded-2xl border border-stone-200/80 bg-[#fffefa] p-5 lg:block"><div className="mb-5 flex items-center gap-2"><SlidersHorizontal className="size-4" /><h2 className="text-sm font-semibold">فیلتر محصولات</h2></div>{controls()}<button type="button" onClick={clearFilters} className="mt-5 w-full rounded-xl border border-stone-200 py-2.5 text-sm font-medium text-stone-600 hover:bg-stone-50">پاک کردن فیلترها</button></aside>
      <div className="min-w-0">
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row">
          <form onSubmit={submitSearch} role="search" className="flex min-w-0 flex-1 items-center gap-2 rounded-2xl border border-stone-200 bg-white p-1.5 shadow-sm"><Search aria-hidden="true" className="ms-3 size-4 shrink-0 text-stone-400" /><input value={queryDraft} onChange={event => setQueryDraft(event.target.value)} placeholder="جست‌وجو در محصولات فروشگاه" aria-label="جست‌وجوی محصولات" className="h-10 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-stone-400" /><button className="h-10 shrink-0 rounded-xl bg-stone-900 px-4 text-sm font-semibold text-white hover:bg-stone-700">جست‌وجو</button></form>
          <div className="flex min-w-0 gap-2"><button type="button" onClick={() => setMobileFilters(true)} className="inline-flex h-[54px] flex-1 items-center justify-center gap-2 rounded-2xl border border-stone-200 bg-white px-4 text-sm font-semibold lg:hidden"><Filter className="size-4" />فیلترها</button><label className="flex h-[54px] min-w-0 flex-1 items-center gap-2 rounded-2xl border border-stone-200 bg-white px-3 text-sm text-stone-800"><ArrowDownUp className="size-4 shrink-0 text-stone-500" /><span className="sr-only">مرتب‌سازی محصولات</span><select aria-label="مرتب‌سازی محصولات" className="min-w-0 flex-1 bg-white text-stone-800 outline-none" value={state.sort} onChange={event => setFilter("sort", event.target.value)}><option value="newest">جدیدترین</option><option value="price-asc">قیمت: کم به زیاد</option><option value="price-desc">قیمت: زیاد به کم</option><option value="relevance">مرتبط‌ترین</option></select></label><button type="button" onClick={() => { updateUrl(params => { const saved = params.get("saved") === "1"; if (saved) params.delete("saved"); else params.set("saved", "1"); params.delete("page"); }); }} aria-pressed={state.saved} className={`grid size-[54px] shrink-0 place-items-center rounded-2xl border transition ${state.saved ? "border-rose-200 bg-rose-50 text-rose-700" : "border-stone-200 bg-white text-stone-600"}`} aria-label="نمایش علاقه‌مندی‌ها"><Heart className={`size-5 ${state.saved ? "fill-current" : ""}`} /></button></div>
        </div>
        {chips.length > 0 && <div className="mt-4 flex flex-wrap items-center gap-2" aria-label="فیلترهای فعال">{chips.map(chip => <button type="button" key={chip.key} onClick={() => removeChip(state.filters.includes(chip.key) ? chip.key : `${chip.key}:${chip.label}`)} className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-stone-200 bg-white px-3 py-1.5 text-xs text-stone-700"><span className="max-w-[180px] truncate">{chip.label}</span><X className="size-3 shrink-0" /></button>)}<button type="button" onClick={clearFilters} className="px-2 py-1.5 text-xs font-semibold text-stone-500 underline underline-offset-4">حذف همه</button></div>}
        <div className="mb-4 mt-6 flex min-h-7 items-center justify-between gap-3"><p className="text-sm text-stone-500">{state.saved ? `علاقه‌مندی‌ها · ${new Intl.NumberFormat("fa-IR").format(pagination.total)} کالا` : `${new Intl.NumberFormat("fa-IR").format(pagination.total)} محصول`}</p>{loading && <span className="inline-flex items-center gap-2 text-xs text-stone-500" role="status"><LoaderCircle className="size-4 animate-spin" />در حال به‌روزرسانی</span>}</div>
        {error && <div role="alert" className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}{state.saved && error.includes("وارد حساب") ? <a href={appPath(`/fa/login?callbackUrl=${encodeURIComponent(loginCallback)}`)} className="shrink-0 font-semibold underline">ورود به حساب</a> : <button type="button" onClick={() => { setError(""); setSettledRequestKey(`!${paramsText}`); setRetryKey(value => value + 1); }} className="shrink-0 font-semibold underline">تلاش دوباره</button>}</div>}
        {!error && products.length === 0 && !loading && <div className="rounded-3xl border border-dashed border-stone-300 bg-[#fffefa] px-6 py-16 text-center"><p className="text-lg font-semibold text-stone-800">محصولی پیدا نشد</p><p className="mt-2 text-sm text-stone-500">فیلترها را تغییر دهید یا عبارت دیگری جست‌وجو کنید.</p><button type="button" onClick={clearFilters} className="mt-5 rounded-xl bg-stone-900 px-5 py-2.5 text-sm font-semibold text-white">پاک کردن فیلترها</button></div>}
        <div className="grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-5 xl:grid-cols-3">{products.map(product => { const target = `${storefrontPath.replace(/\/$/, "")}/product/${encodeURIComponent(product.slug || product.id)}`; const colorLabels = availableColorLabels(product); return <article key={product.id} className="group min-w-0 overflow-hidden rounded-2xl border border-stone-200/80 bg-white shadow-[0_2px_12px_rgba(41,37,36,0.035)] transition hover:-translate-y-0.5 hover:shadow-[0_12px_32px_rgba(41,37,36,0.10)] sm:rounded-3xl"><div className="relative aspect-[4/5] overflow-hidden bg-stone-100"><a href={target} aria-label={`مشاهده ${product.name}`} className="absolute inset-0"><Image src={product.media.card || product.media.gallery[0] || "/images/product-placeholder.svg"} alt={product.media.alt || product.name} fill unoptimized sizes="(max-width: 640px) 50vw, (max-width: 1280px) 33vw, 300px" className="object-cover transition duration-500 group-hover:scale-[1.025]" /></a><div className="absolute end-2 top-2 z-10 sm:end-3 sm:top-3"><FavoriteButton organization={organization} productId={product.id} initialSaved={savedIds.has(product.id)} favoritesAvailable={favoritesAvailable} onChange={saved => favoriteChanged(product.id, saved)} /></div><div className="absolute bottom-2 start-2 max-w-[calc(100%-1rem)] sm:bottom-3 sm:start-3">{product.orderable ? <span className="rounded-full border border-white/60 bg-white/90 px-2.5 py-1 text-[10px] font-semibold text-emerald-800 shadow-sm backdrop-blur sm:text-xs">آماده سفارش</span> : <span className="rounded-full border border-white/60 bg-white/90 px-2.5 py-1 text-[10px] font-medium text-stone-600 shadow-sm backdrop-blur sm:text-xs">ناموجود</span>}</div></div><div className="min-w-0 p-3 sm:p-4"><p className="truncate text-[10px] text-stone-500 sm:text-xs">{product.category.name}{product.brand ? ` · ${product.brand}` : ""}</p><a href={target} className="mt-1.5 line-clamp-2 min-h-10 text-sm font-semibold leading-5 text-stone-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 sm:min-h-12 sm:text-base sm:leading-6">{product.name}</a>{colorLabels.length > 0 && <p className="mt-1 truncate text-[10px] text-stone-500 sm:text-xs" aria-label={`رنگ‌های قابل سفارش: ${colorLabels.join("، ")}`}>رنگ: {colorLabels.join("، ")}</p>}<div className="mt-3 flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">{product.listPrice && product.listPrice.amount > product.price.amount && <span className="text-[10px] text-stone-400 line-through sm:text-xs">{rial(product.listPrice.amount)}</span>}<span className="min-w-0 text-xs font-bold text-stone-900 sm:text-sm">{rial(product.price.amount)}</span></div><a href={target} className="mt-3 flex h-10 items-center justify-center gap-1 rounded-xl border border-stone-200 text-xs font-semibold text-stone-700 transition hover:border-stone-900 hover:bg-stone-900 hover:text-white sm:text-sm">مشاهده محصول<ChevronLeft className="size-3.5" /></a></div></article>; })}</div>
        {pagination.totalPages > 1 && <nav aria-label="صفحه‌بندی محصولات" className="mt-8 flex items-center justify-center gap-3"><button type="button" disabled={pagination.page <= 1 || loading} onClick={() => updateUrl(params => { params.set("page", String(pagination.page - 1)); })} className="inline-flex h-11 items-center gap-1 rounded-xl border border-stone-200 bg-white px-3 text-sm disabled:opacity-40"><ChevronRight className="size-4" />قبلی</button><span className="text-sm text-stone-600">صفحه {new Intl.NumberFormat("fa-IR").format(pagination.page)} از {new Intl.NumberFormat("fa-IR").format(pagination.totalPages)}</span><button type="button" disabled={pagination.page >= pagination.totalPages || loading} onClick={() => updateUrl(params => { params.set("page", String(pagination.page + 1)); })} className="inline-flex h-11 items-center gap-1 rounded-xl border border-stone-200 bg-white px-3 text-sm disabled:opacity-40">بعدی<ChevronLeft className="size-4" /></button></nav>}
      </div>
    </div>
    <Sheet open={mobileFilters} onOpenChange={setMobileFilters}><SheetContent side="right" dir="rtl" className="flex h-[100dvh] w-[min(88vw,380px)] flex-col gap-0 overflow-y-auto bg-[#fcfbf8] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-stone-900 [&>button]:end-4 [&>button]:top-4" aria-describedby={undefined}><SheetHeader className="mb-6 shrink-0 border-b border-stone-200 pe-8 pb-4 text-right"><SheetTitle className="text-base text-stone-900">فیلتر محصولات</SheetTitle></SheetHeader>{controls(true)}</SheetContent></Sheet>
  </section></div>;
}
