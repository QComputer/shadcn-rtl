"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useOptimistic, useRef, useState, useTransition, type FormEvent } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowDownUp, ChevronLeft, ChevronRight, Filter, Heart, LoaderCircle, Search, SlidersHorizontal, X } from "lucide-react";
import { appPath } from "@/lib/app-base-path";
import type { PublicCatalogProduct } from "@/lib/public-catalog/contracts";
import { shouldSkipInitialCatalogFetch } from "@/lib/public-catalog/discovery-initial-fetch";
import { FavoriteButton } from "./favorite-button";
import { RetailProductCard } from "./retail-product-card";
import { DiscoveryFacet } from "./discovery-facet";
import { formatRetailSize } from "@/lib/retail/format-size";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

type Pagination = { page: number; limit: number; total: number; totalPages: number };
type Facets = {
  categories: Array<{ id: string; slug: string | null; name: string; count: number }>;
  brands: Array<{ value: string; count: number }>;
  attributes: Array<{ key: string; label: string; scope: "PRODUCT" | "VARIANT_OPTION"; values: Array<{ value: string; count: number }> }>;
};
type Props = {
  organization: string; storeName: string; logo: string | null; storefrontPath: string; previewOnly?: boolean;
  initialProducts: PublicCatalogProduct[]; initialPagination: Pagination; facets: Facets; initialQuery: string; canReuseInitialProducts: boolean;
};
type FilterState = { category?: string; brand?: string; minPrice?: string; maxPrice?: string; available?: string; filters: string[]; page: number; sort: string; saved: boolean };
const field = "h-11 min-w-0 rounded-xl border border-input bg-background px-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/30";
function parseState(params: URLSearchParams): FilterState {
  return { category: params.get("category") ?? undefined, brand: params.get("brand") ?? undefined,
    minPrice: params.get("minPrice") ?? undefined, maxPrice: params.get("maxPrice") ?? undefined,
    available: params.get("available") ?? undefined, filters: params.getAll("filter"),
    page: Math.max(1, Number(params.get("page") || 1)), sort: params.get("sort") || "newest", saved: params.get("saved") === "1" };
}
function queryString(params: URLSearchParams) { const value = params.toString(); return value ? `?${value}` : ""; }
function normalizeDigits(value: string) { return value.replace(/[۰-۹٠-٩]/g, digit => String.fromCharCode(digit.charCodeAt(0) >= 0x06f0 ? digit.charCodeAt(0) - 0x06f0 + 48 : digit.charCodeAt(0) - 0x0660 + 48)); }

export function ProductDiscovery({ organization, storeName, logo, storefrontPath, previewOnly = false, initialProducts, initialPagination, facets, initialQuery, canReuseInitialProducts }: Props) {
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
  const [initialServerRequestKey] = useState(canReuseInitialProducts ? `${organization}\0${paramsText}` : "");
  const hasNavigatedSinceInitialRender = useRef(false);
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

  const requestKey = `${organization}\0${paramsText}`;
  useEffect(() => {
    if (requestKey !== initialServerRequestKey) hasNavigatedSinceInitialRender.current = true;
  }, [initialServerRequestKey, requestKey]);

  useEffect(() => {
    // The server supplied this exact initial query. Keep the marker through StrictMode's
    // repeated mount effect; any URL change clears it and must fetch normally.
    if (shouldSkipInitialCatalogFetch({
      currentRequestKey: requestKey,
      initialRequestKey: initialServerRequestKey,
      hasNavigated: hasNavigatedSinceInitialRender.current,
      saved: new URLSearchParams(paramsText).get("saved") === "1",
      retryKey,
      favoriteRefreshKey,
      canReuseInitialProducts,
    })) return;
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
  }, [organization, paramsText, requestKey, initialServerRequestKey, retryKey, favoriteRefreshKey, canReuseInitialProducts]);

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
    state.available && { key: "available", label: "فقط کالاهای موجود" }, state.saved && { key: "saved", label: "علاقه‌مندی‌ها" }, ...state.filters.map(token => {
      const [key, ...parts] = token.split(":");
      const value = parts.join(":");
      const attribute = facets.attributes.find(item => item.key === key);
      return { key: token, label: /size|سایز|اندازه|شماره/i.test(`${key} ${attribute?.label ?? ""}`) ? formatRetailSize(value) : value };
    })].filter(Boolean) as Array<{key: string; label: string}>;

  function controls() { return <div className="space-y-5"><p className="text-xs leading-5 text-muted-foreground">تعداد کنار هر گزینه بر اساس همه محصولات فروشگاه است.</p>
    <label className="grid gap-2 text-sm font-semibold text-foreground">دسته‌بندی<select className={field} value={state.category ?? ""} onChange={event => setFilter("category", event.target.value)}><option value="">همه دسته‌ها</option>{facets.categories.map(item => <option key={item.id} value={item.slug ?? item.id}>{item.name} ({new Intl.NumberFormat("fa-IR").format(item.count)})</option>)}</select></label>
    <label className="grid gap-2 text-sm font-semibold text-foreground">برند<select className={field} value={state.brand ?? ""} onChange={event => setFilter("brand", event.target.value)}><option value="">همه برندها</option>{facets.brands.map(item => <option key={item.value} value={item.value}>{item.value} ({new Intl.NumberFormat("fa-IR").format(item.count)})</option>)}</select></label>
    <fieldset className="grid gap-2"><legend className="mb-2 text-sm font-semibold text-foreground">بازه قیمت (تومان)</legend><input aria-label="حداقل قیمت" className={field} inputMode="numeric" placeholder="از" value={state.minPrice ?? ""} onChange={event => updateUrl(params => { const value = normalizeDigits(event.target.value).replace(/[^0-9]/g, ""); const maximumText = params.get("maxPrice"); if (value && maximumText !== null && Number(value) > Number(maximumText)) { setError("حداقل قیمت نمی‌تواند از حداکثر قیمت بیشتر باشد."); return; } setError(""); if (value) params.set("minPrice", value); else params.delete("minPrice"); params.delete("page"); }, true)} /><input aria-label="حداکثر قیمت" className={field} inputMode="numeric" placeholder="تا" value={state.maxPrice ?? ""} onChange={event => updateUrl(params => { const value = normalizeDigits(event.target.value).replace(/[^0-9]/g, ""); const minimumText = params.get("minPrice"); if (value && minimumText !== null && Number(value) < Number(minimumText)) { setError("حداکثر قیمت نمی‌تواند از حداقل قیمت کمتر باشد."); return; } setError(""); if (value) params.set("maxPrice", value); else params.delete("maxPrice"); params.delete("page"); }, true)} /></fieldset>
    <label className="flex min-h-11 items-center gap-3 rounded-xl border border-border px-3 text-sm font-medium"><input type="checkbox" checked={state.available === "true"} onChange={event => setFilter("available", event.target.checked ? "true" : "")} className="size-4 accent-primary" />فقط کالاهای موجود</label>
    {facets.attributes.map(attribute => <DiscoveryFacet key={attribute.key} attribute={attribute} filters={state.filters} onChange={setAttr} />)}
  </div>; }

  return <div className="min-h-screen w-full bg-background text-foreground"><section dir="rtl" lang="fa" className="mx-auto w-full max-w-[1440px] min-w-0 px-4 pb-20 pt-8 sm:px-6 lg:px-10">
    <header className="mb-8 flex min-w-0 items-center gap-3 border-b border-border pb-6">{logo && <Image src={logo} alt="" width={48} height={48} unoptimized className="size-12 rounded-2xl border border-border bg-card object-contain p-1" />}<div className="min-w-0"><p className="text-xs font-medium tracking-wide text-muted-foreground">فروشگاه</p><h1 className="truncate text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{storeName}</h1></div><div className="ms-auto hidden items-center gap-2 text-xs text-muted-foreground sm:flex"><span className="size-2 rounded-full bg-emerald-500" />خرید مستقیم از فروشگاه</div></header>
    <div className="grid min-w-0 gap-7 lg:grid-cols-[248px_minmax(0,1fr)]">
      <aside className="hidden min-w-0 self-start rounded-2xl border border-border bg-card p-4 lg:sticky lg:top-24 lg:flex lg:max-h-[calc(100dvh-7rem)] lg:flex-col"><div className="mb-5 flex items-center gap-2"><SlidersHorizontal className="size-4" /><h2 className="text-sm font-semibold">فیلتر محصولات</h2></div><div className="min-h-0 overflow-y-auto pe-1 [scrollbar-width:thin]">{controls()}</div><button type="button" onClick={clearFilters} className="mt-4 w-full shrink-0 rounded-xl border border-border py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground">پاک کردن فیلترها</button></aside>
      <div className="min-w-0">
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row">
          <form onSubmit={submitSearch} role="search" className="flex min-w-0 flex-1 items-center gap-2 rounded-2xl border border-border bg-card p-1.5 shadow-sm"><Search aria-hidden="true" className="ms-3 size-4 shrink-0 text-muted-foreground" /><input value={queryDraft} onChange={event => setQueryDraft(event.target.value)} placeholder="جست‌وجو در محصولات فروشگاه" aria-label="جست‌وجوی محصولات" className="h-10 min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground" /><button className="h-10 shrink-0 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90">جست‌وجو</button></form>
          <div className="flex min-w-0 gap-2"><button type="button" onClick={() => setMobileFilters(true)} className="inline-flex h-[54px] flex-1 items-center justify-center gap-2 rounded-2xl border border-border bg-card px-4 text-sm font-semibold lg:hidden"><Filter className="size-4" />فیلترها</button><label className="flex h-[54px] min-w-0 flex-1 items-center gap-2 rounded-2xl border border-border bg-card px-3 text-sm text-foreground"><ArrowDownUp className="size-4 shrink-0 text-muted-foreground" /><span className="sr-only">مرتب‌سازی محصولات</span><select aria-label="مرتب‌سازی محصولات" className="min-w-0 flex-1 bg-card text-foreground outline-none" value={state.sort} onChange={event => setFilter("sort", event.target.value)}><option value="newest">جدیدترین</option><option value="price-asc">قیمت: کم به زیاد</option><option value="price-desc">قیمت: زیاد به کم</option><option value="relevance">مرتبط‌ترین</option></select></label><button type="button" onClick={() => { updateUrl(params => { const saved = params.get("saved") === "1"; if (saved) params.delete("saved"); else params.set("saved", "1"); params.delete("page"); }); }} aria-pressed={state.saved} className={`grid size-[54px] shrink-0 place-items-center rounded-2xl border transition ${state.saved ? "border-rose-300 bg-rose-100 text-rose-800 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-200" : "border-border bg-card text-muted-foreground"}`} aria-label="نمایش علاقه‌مندی‌ها"><Heart className={`size-5 ${state.saved ? "fill-current" : ""}`} /></button></div>
        </div>
        {chips.length > 0 && <div className="mt-4 flex flex-wrap items-center gap-2" aria-label="فیلترهای فعال">{chips.map(chip => <button type="button" key={chip.key} onClick={() => removeChip(state.filters.includes(chip.key) ? chip.key : `${chip.key}:${chip.label}`)} className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs text-foreground"><span className="max-w-[180px] truncate">{chip.label}</span><X className="size-3 shrink-0" /></button>)}<button type="button" onClick={clearFilters} className="px-2 py-1.5 text-xs font-semibold text-muted-foreground underline underline-offset-4">حذف همه</button></div>}
        <div className="mb-4 mt-6 flex min-h-7 items-center justify-between gap-3"><p className="text-sm text-muted-foreground">{state.saved ? `علاقه‌مندی‌ها · ${new Intl.NumberFormat("fa-IR").format(pagination.total)} کالا` : `${new Intl.NumberFormat("fa-IR").format(pagination.total)} محصول`}</p>{loading && <span className="inline-flex items-center gap-2 text-xs text-muted-foreground" role="status"><LoaderCircle className="size-4 animate-spin" />در حال به‌روزرسانی</span>}</div>
        {error && <div role="alert" className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-300 bg-rose-50 p-4 text-sm text-rose-900 dark:border-rose-900/70 dark:bg-rose-950/40 dark:text-rose-200">{error}{state.saved && error.includes("وارد حساب") ? <a href={appPath(`/fa/login?callbackUrl=${encodeURIComponent(loginCallback)}`)} className="shrink-0 font-semibold underline">ورود به حساب</a> : <button type="button" onClick={() => { setError(""); setSettledRequestKey(`!${paramsText}`); setRetryKey(value => value + 1); }} className="shrink-0 font-semibold underline">تلاش دوباره</button>}</div>}
        {!error && products.length === 0 && !loading && <div className="rounded-3xl border border-dashed border-border bg-card px-6 py-16 text-center"><p className="text-lg font-semibold text-card-foreground">محصولی پیدا نشد</p><p className="mt-2 text-sm text-muted-foreground">فیلترها را تغییر دهید یا عبارت دیگری جست‌وجو کنید.</p><button type="button" onClick={clearFilters} className="mt-5 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground">پاک کردن فیلترها</button></div>}
        <div className="grid min-w-0 auto-rows-fr grid-cols-2 gap-3 sm:gap-5 xl:grid-cols-3">{products.map(product => <RetailProductCard key={product.id} product={product} organization={organization} storefrontPath={storefrontPath} previewOnly={previewOnly} filters={state.filters} favorite={<FavoriteButton organization={organization} productId={product.id} initialSaved={savedIds.has(product.id)} favoritesAvailable={favoritesAvailable} onChange={saved => favoriteChanged(product.id, saved)} />} />)}</div>
        {pagination.totalPages > 1 && <nav aria-label="صفحه‌بندی محصولات" className="mt-8 flex items-center justify-center gap-3"><button type="button" disabled={pagination.page <= 1 || loading} onClick={() => updateUrl(params => { params.set("page", String(pagination.page - 1)); })} className="inline-flex h-11 items-center gap-1 rounded-xl border border-border bg-card px-3 text-sm text-foreground disabled:opacity-40"><ChevronRight className="size-4" />قبلی</button><span className="text-sm text-muted-foreground">صفحه {new Intl.NumberFormat("fa-IR").format(pagination.page)} از {new Intl.NumberFormat("fa-IR").format(pagination.totalPages)}</span><button type="button" disabled={pagination.page >= pagination.totalPages || loading} onClick={() => updateUrl(params => { params.set("page", String(pagination.page + 1)); })} className="inline-flex h-11 items-center gap-1 rounded-xl border border-border bg-card px-3 text-sm text-foreground disabled:opacity-40">بعدی<ChevronLeft className="size-4" /></button></nav>}
      </div>
    </div>
    <Sheet open={mobileFilters} onOpenChange={setMobileFilters}><SheetContent side="right" dir="rtl" className="flex h-[100dvh] w-[min(88vw,380px)] flex-col gap-0 overflow-hidden bg-background p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-foreground [&>button]:end-4 [&>button]:top-4" aria-describedby={undefined}><SheetHeader className="mb-6 shrink-0 border-b border-border pe-8 pb-4 text-right"><SheetTitle className="text-base text-foreground">فیلتر محصولات</SheetTitle></SheetHeader><div className="min-h-0 flex-1 overflow-y-auto pe-1 [scrollbar-width:thin]">{controls()}</div><div className="mt-4 grid shrink-0 grid-cols-2 gap-2 border-t border-border pt-4"><button type="button" onClick={clearFilters} className="min-h-11 rounded-xl border border-border bg-background px-2 text-xs font-semibold text-foreground">پاک کردن فیلترها</button><button type="button" onClick={() => setMobileFilters(false)} className="min-h-11 rounded-xl bg-primary px-2 text-xs font-semibold text-primary-foreground">نمایش کالاها</button></div></SheetContent></Sheet>
  </section></div>;
}
