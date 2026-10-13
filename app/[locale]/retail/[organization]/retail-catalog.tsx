"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useParams } from "next/navigation";
import { appPath } from "@/lib/app-base-path";
import type { PublicCatalogProduct } from "@/lib/public-catalog/contracts";

type RetailView = {
  identifier: string;
  name: string;
  description: string | null;
  theme: "FASHION" | "ELECTRONICS" | "GENERAL";
  previewOnly: boolean;
  categories: Array<{ id: string; slug: string | null; name: string }>;
  products: PublicCatalogProduct[];
};

const toman = (amount: number) => `${new Intl.NumberFormat("fa-IR").format(amount)} تومان`;
const attributeText = (attribute: { value: string | number | boolean; displayUnit: string | null }) => `${attribute.value}${attribute.displayUnit ? ` ${attribute.displayUnit}` : ""}`;

export default function RetailLiveCatalog({ view, productSlug }: { view: RetailView; productSlug?: string }) {
  const [products, setProducts] = useState(view.products);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [filter, setFilter] = useState("");
  const [minimumPrice, setMinimumPrice] = useState("");
  const [maximumPrice, setMaximumPrice] = useState("");
  const [sort, setSort] = useState("featured");
  const [error, setError] = useState(false);
  const [variantChoice, setVariantChoice] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1 });
  const params = useParams<{ locale: string }>();
  const locale = params.locale || "fa";
  const base = appPath(`/${encodeURIComponent(locale)}/retail/${encodeURIComponent(view.identifier)}`);
  const [cartNotice, setCartNotice] = useState("");
  const isFashion = view.theme === "FASHION";

  useEffect(() => {
    if (productSlug) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setBusy(true);
      const params = new URLSearchParams({ page: String(page), limit: "50" });
      if (query.trim()) params.set("q", query.trim());
      if (category) params.set("category", category);
      if (filter) params.set("filter", filter);
      try {
        const response = await fetch(appPath(`/api/public/v1/organizations/${encodeURIComponent(view.identifier)}/products?${params}`), { signal: controller.signal, headers: { Accept: "application/json" } });
        if (!response.ok) throw new Error("catalog request failed");
        const body = await response.json() as { version: string; data: { products: PublicCatalogProduct[]; pagination: { page: number; totalPages: number } } };
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
  }, [view.identifier, query, category, filter, page, productSlug]);

  const availableFilters = useMemo(() => {
    const options = new Map<string, Set<string>>();
    for (const product of products) {
      for (const attribute of [...product.attributes, ...product.variants.flatMap((variant) => variant.options)]) {
        if (!attribute.filterable) continue;
        const key = `${attribute.key}:${attributeText(attribute)}`;
        const label = `${attribute.label}: ${attributeText(attribute)}`;
        if (!options.has(key)) options.set(key, new Set());
        options.get(key)!.add(label);
      }
    }
    return [...options].map(([value, labels]) => ({ value, label: [...labels][0] }));
  }, [products]);

  const sortedProducts = useMemo(() => {
    const result = [...products];
    if (sort === "name") result.sort((a, b) => a.name.localeCompare(b.name, "fa"));
    if (sort === "price-asc") result.sort((a, b) => a.price.amount - b.price.amount);
    if (sort === "price-desc") result.sort((a, b) => b.price.amount - a.price.amount);
    const minimum = minimumPrice === "" ? null : Number(minimumPrice);
    const maximum = maximumPrice === "" ? null : Number(maximumPrice);
    return result.filter((product) => (minimum === null || product.price.amount >= minimum) && (maximum === null || product.price.amount <= maximum));
  }, [products, sort, minimumPrice, maximumPrice]);

  const detail = productSlug ? products.find((product) => product.slug === productSlug || product.id === productSlug) : undefined;
  const addToCart = async (variantId?: string) => {
    if (!variantId || view.previewOnly) return;
    setCartNotice("");
    try {
      const response = await fetch(appPath("/api/retail/v1/cart"), {
        method: "POST", credentials: "same-origin", headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ organization: view.identifier, variantId, quantity: 1 }),
      });
      if (response.status === 401) {
        const callbackUrl = `${base}/checkout`;
        window.location.assign(appPath(`/${encodeURIComponent(locale)}/login?callbackUrl=${encodeURIComponent(callbackUrl)}`));
        return;
      }
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "افزودن کالا به سبد خرید ممکن نشد.");
      setCartNotice("کالا به سبد خرید اضافه شد.");
    } catch (error) {
      setCartNotice(error instanceof Error ? error.message : "افزودن کالا به سبد خرید ممکن نشد.");
    }
  };
  const renderProduct = (product: PublicCatalogProduct) => {
    const image = product.media.card;
    const selectedId = variantChoice[product.id] ?? product.variants.find((variant) => variant.orderable)?.id ?? product.variants[0]?.id;
    const selectedVariant = product.variants.find((variant) => variant.id === selectedId);
    const href = `${base}/product/${encodeURIComponent(product.slug ?? product.id)}`;
    return <article key={product.id} className="group overflow-hidden rounded-2xl bg-white shadow-sm">
      <a href={href} className="relative block aspect-[.82] overflow-hidden bg-[#eeeae3] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9b7653]">
        {image ? <Image unoptimized fill sizes="(max-width: 768px) 50vw, (max-width: 1280px) 33vw, 25vw" src={image} alt={product.media.alt || product.name} className="object-cover transition-transform duration-500 group-hover:scale-[1.03]" /> : <div className="grid h-full place-items-center text-sm text-[#77736a]">تصویری برای این کالا ثبت نشده است</div>}
      </a>
      <div className="p-4 md:p-5"><span className="text-xs text-[#977553]">{product.category.name}</span>
        <h2 className="mt-1 text-base font-medium md:text-lg"><a href={href} className="hover:underline">{product.name}</a></h2>
        {product.attributes.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{product.attributes.slice(0, 3).map((attribute) => <span key={attribute.key} className="rounded-full bg-[#f5f3ef] px-2 py-1 text-[10px] text-[#666158]">{attribute.label}: {attributeText(attribute)}</span>)}</div>}
        {product.variants.length > 1 && <label className="sr-only" htmlFor={`variant-${product.id}`}>انتخاب گزینه برای {product.name}</label>}
        {product.variants.length > 1 && <select id={`variant-${product.id}`} value={selectedId} onChange={(event) => setVariantChoice({ ...variantChoice, [product.id]: event.target.value })} className="mt-4 min-h-11 w-full rounded-lg border border-[#e2dfd8] bg-white px-2 py-2 text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#9b7653]">{product.variants.map((variant) => <option key={variant.id} value={variant.id}>{variant.name ?? variant.options.map((option) => `${option.label}: ${attributeText(option)}`).join(" · ")}</option>)}</select>}
        <div className="mt-4 flex items-center justify-between gap-2"><div><strong className="block text-sm">{toman(selectedVariant?.price.amount ?? product.price.amount)}</strong><span className={`mt-1 block text-[11px] ${selectedVariant?.orderable ? "text-emerald-700" : "text-[#a45041]"}`}>{selectedVariant ? (selectedVariant.orderable ? "موجود" : "ناموجود") : "وضعیت فروش ثبت نشده"}</span></div>
          <button disabled={view.previewOnly || !selectedVariant?.orderable} onClick={() => void addToCart(selectedVariant?.id)} className="min-h-11 rounded-full bg-[#292a24] px-3 py-2 text-xs text-white disabled:cursor-not-allowed disabled:bg-[#eeece7] disabled:text-[#77736a]">{view.previewOnly ? "پیش‌نمایش" : selectedVariant?.orderable ? "افزودن به سبد" : "ناموجود"}</button>
        </div>
      </div>
    </article>;
  };

  return <main dir="rtl" lang="fa" className="min-h-screen bg-[#f8f7f4] text-[#24241f]">
    {view.previewOnly && <div className="bg-[#252720] px-4 py-2 text-center text-xs text-white">پیش‌نمایش نمایشی · این محصولات و تصاویر نمونه هستند و برای خرید واقعی نیستند</div>}
    <header className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-5 md:px-10">
      <a href={base} className="text-xl font-bold tracking-tight">{view.name}<span className="mr-2 text-[#9b7653]" aria-hidden>●</span></a>
      {!productSlug && <nav aria-label="ناوبری فروشگاه" className="hidden gap-8 text-sm md:flex"><a href={`${base}#categories`}>دسته‌بندی‌ها</a><a href={`${base}#products`}>محصولات</a></nav>}
      <div className="flex items-center gap-2">{!view.previewOnly && <a href={`${base}/checkout`} className="min-h-11 rounded-full border border-[#d9d5cd] px-4 py-3 text-sm">سبد خرید</a>}<a href={`${base}#products`} className="min-h-11 rounded-full border border-[#d9d5cd] px-4 py-3 text-sm">مشاهده کالاها <span aria-hidden>⌕</span></a></div>
    </header>
    {!productSlug && <>
    <section className="mx-auto grid max-w-7xl gap-5 px-4 pb-8 md:grid-cols-[1fr_1.15fr] md:px-10">
      <div className="flex min-h-[340px] flex-col justify-center rounded-[2rem] bg-[#e9e5dc] p-8 md:min-h-[460px] md:p-14">
        <span className="text-xs font-semibold tracking-[.18em] text-[#8a6849]">{isFashion ? "انتخاب‌های این فصل" : view.theme === "ELECTRONICS" ? "فناوری، با مشخصات روشن" : "فروشگاه خرده‌فروشی"}</span>
        <h1 className="mt-5 max-w-lg text-4xl font-semibold leading-[1.4] md:text-6xl">{isFashion ? <>سادگی‌ای که<br />به چشم می‌آید.</> : <>انتخابی دقیق،<br />برای هر روز.</>}</h1>
        <p className="mt-5 max-w-md leading-8 text-[#67655e]">{view.description ?? "محصولات و مشخصات این فروشگاه از فهرست منتشرشده آن نمایش داده می‌شوند."}</p>
        <a href={`${base}#products`} className="mt-8 w-fit rounded-full bg-[#292a24] px-7 py-3 text-sm text-white">دیدن محصولات <span className="mr-2">←</span></a>
      </div>
      <div id="categories" className="flex min-h-[340px] flex-col justify-center overflow-hidden rounded-[2rem] bg-[#e5e1d8] p-7 md:min-h-[460px]">
        <span className="text-xs text-[#8a6849]">{view.theme === "ELECTRONICS" ? "مشخصات قابل بررسی" : "دسته‌بندی محصولات"}</span>
        <h2 className="mt-3 text-3xl font-semibold">{view.categories.length ? "کالاها، مرتب و روشن" : "محصولات فروشگاه"}</h2>
        <div className="mt-6 flex flex-wrap gap-3">{view.categories.map((item) => <button key={item.id} onClick={() => { setCategory(category === (item.slug ?? item.id) ? "" : item.slug ?? item.id); setPage(1); }} className={`min-h-11 rounded-full px-5 py-3 text-sm ${category === (item.slug ?? item.id) ? "bg-[#292a24] text-white" : "bg-white text-[#55534c]"}`}>{item.name}</button>)}</div>
      </div>
    </section>
    <section id="products" className="mx-auto max-w-7xl px-5 pb-20 pt-7 md:px-10">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between"><div><span className="text-xs text-[#92704e]">فهرست منتشرشده فروشگاه</span><h2 className="mt-2 text-3xl font-semibold">{view.theme === "ELECTRONICS" ? "دستگاه‌ها و مشخصات" : "محصولات فروشگاه"}</h2></div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6"><label className="sr-only" htmlFor="retail-search">جستجوی محصول</label><input id="retail-search" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="جستجوی محصول..." className="min-h-11 rounded-xl border border-[#ddd9d0] bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#9b7653]" />
          <label className="sr-only" htmlFor="retail-filter">فیلتر ویژگی</label><select id="retail-filter" value={filter} onChange={(event) => { setFilter(event.target.value); setPage(1); }} className="min-h-11 rounded-xl border border-[#ddd9d0] bg-white px-4 py-3 text-sm"><option value="">همه ویژگی‌ها</option>{availableFilters.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
          <label className="sr-only" htmlFor="retail-price-min">کمترین قیمت به تومان</label><input id="retail-price-min" type="number" min="0" value={minimumPrice} onChange={(event) => setMinimumPrice(event.target.value)} placeholder="حداقل قیمت" className="min-h-11 min-w-0 rounded-xl border border-[#ddd9d0] bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#9b7653]" />
          <label className="sr-only" htmlFor="retail-price-max">بیشترین قیمت به تومان</label><input id="retail-price-max" type="number" min="0" value={maximumPrice} onChange={(event) => setMaximumPrice(event.target.value)} placeholder="حداکثر قیمت" className="min-h-11 min-w-0 rounded-xl border border-[#ddd9d0] bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#9b7653]" />
          <label className="sr-only" htmlFor="retail-sort">مرتب‌سازی</label><select id="retail-sort" value={sort} onChange={(event) => setSort(event.target.value)} className="min-h-11 rounded-xl border border-[#ddd9d0] bg-white px-4 py-3 text-sm"><option value="featured">پیشنهادی</option><option value="name">نام محصول</option><option value="price-asc">قیمت: کم به زیاد</option><option value="price-desc">قیمت: زیاد به کم</option></select>
        </div>
      </div>
      {error ? <div role="alert" className="mt-8 rounded-2xl bg-white p-10 text-center text-[#8c3329]">دریافت محصولات ممکن نشد. چند لحظه دیگر دوباره تلاش کنید.</div> : busy ? <p role="status" className="mt-8 rounded-2xl bg-white p-10 text-center">در حال دریافت محصولات…</p> : sortedProducts.length ? <><div className="mt-7 grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-5 xl:grid-cols-4">{sortedProducts.map(renderProduct)}</div><nav aria-label="صفحه‌های محصولات" className="mt-8 flex items-center justify-center gap-4"><button disabled={pagination.page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))} className="min-h-11 rounded-full border border-[#d9d5cd] px-5 disabled:opacity-40">قبلی</button><span className="text-sm" aria-live="polite">صفحه {new Intl.NumberFormat("fa-IR").format(pagination.page)} از {new Intl.NumberFormat("fa-IR").format(pagination.totalPages)}</span><button disabled={pagination.page >= pagination.totalPages} onClick={() => setPage((current) => Math.min(pagination.totalPages, current + 1))} className="min-h-11 rounded-full border border-[#d9d5cd] px-5 disabled:opacity-40">بعدی</button></nav></> : <div className="mt-8 rounded-2xl bg-white p-10 text-center text-[#6e6a60]">محصولی با این مشخصات پیدا نشد. فیلترها را تغییر دهید.</div>}
      {cartNotice && <p role="status" aria-live="polite" className="mt-5 text-center text-sm text-[#6e6a60]">{cartNotice}</p>}
      <p className="mt-6 text-center text-xs text-[#77736a]">قیمت و وضعیت موجودی از فهرست منتشرشده فروشگاه دریافت شده‌اند.</p>
    </section>
    </>}
    {productSlug && <section className="mx-auto max-w-7xl px-5 pb-20 md:px-10">
      {!detail ? <div role="status" className="rounded-2xl bg-white p-10 text-center">محصول پیدا نشد یا منتشر نیست.</div> : <article className="grid gap-8 md:grid-cols-2">
        <div><div className="relative aspect-square overflow-hidden rounded-3xl bg-[#e9e5dc]">{(detail.media.detail ?? detail.media.card) ? <Image fill unoptimized priority sizes="(max-width: 768px) 100vw, 50vw" src={detail.media.detail ?? detail.media.card!} alt={detail.media.alt || detail.name} className="object-cover" /> : <div className="grid h-full place-items-center text-[#77736a]">تصویری برای این کالا ثبت نشده است</div>}</div>
          {detail.media.gallery.length > 0 && <div className="mt-3 grid grid-cols-3 gap-3">{detail.media.gallery.map((src, index) => <div key={`${src}-${index}`} className="relative aspect-square overflow-hidden rounded-xl bg-[#e9e5dc]"><Image fill unoptimized sizes="(max-width: 768px) 33vw, 16vw" src={src} alt={`${detail.media.alt} · نمای ${index + 1}`} className="object-cover" /></div>)}</div>}</div>
        <div className="py-2 md:py-8"><a href={`${base}#products`} className="text-sm text-[#766d61]">← بازگشت به محصولات</a><span className="mt-6 block text-sm text-[#92704e]">{detail.category.name}</span><h1 className="mt-3 text-3xl font-semibold md:text-4xl">{detail.name}</h1><p className="mt-4 whitespace-pre-line leading-8 text-[#67655e]">{detail.description}</p>
          {detail.variants.length > 0 ? <><label htmlFor="detail-variant" className="mt-7 block text-sm font-medium">انتخاب گزینه</label><select id="detail-variant" value={variantChoice[detail.id] ?? detail.variants.find((variant) => variant.orderable)?.id ?? detail.variants[0].id} onChange={(event) => setVariantChoice({ ...variantChoice, [detail.id]: event.target.value })} className="mt-2 min-h-12 w-full rounded-xl border border-[#ddd9d0] bg-white px-4 py-3">{detail.variants.map((variant) => <option key={variant.id} value={variant.id}>{variant.name ?? variant.options.map((option) => `${option.label}: ${attributeText(option)}`).join(" · ")}</option>)}</select>
            {(() => { const defaultId = detail.variants.find((item) => item.orderable)?.id ?? detail.variants[0].id; const variant = detail.variants.find((item) => item.id === (variantChoice[detail.id] ?? defaultId)) ?? detail.variants[0]; return <><strong className="mt-6 block text-xl">{toman(variant.price.amount)}</strong><span className="mt-2 block text-sm">{variant.orderable ? "موجود" : "ناموجود"}</span></>; })()}</> : <><strong className="mt-6 block text-xl">{toman(detail.price.amount)}</strong><span className="mt-2 block text-sm">وضعیت فروش ثبت نشده است</span></>}
          {(() => { const variant = detail.variants.find((item) => item.id === (variantChoice[detail.id] ?? detail.variants.find((item) => item.orderable)?.id ?? detail.variants[0]?.id)); return <button disabled={view.previewOnly || !variant?.orderable} onClick={() => void addToCart(variant?.id)} className="mt-5 min-h-12 w-full rounded-full bg-[#292a24] px-7 py-4 text-sm text-white disabled:cursor-not-allowed disabled:bg-[#eeece7] disabled:text-[#77736a]">{view.previewOnly ? "پیش‌نمایش فروشگاه" : variant?.orderable ? "افزودن به سبد خرید" : "این گزینه ناموجود است"}</button>; })()}
          {cartNotice && <p role="status" aria-live="polite" className="mt-3 text-sm text-[#6e6a60]">{cartNotice}</p>}
          {(detail.attributes.length > 0 || detail.variants.some((variant) => variant.options.length > 0)) && <section className="mt-8 border-t border-[#dfdcd4] pt-5"><h2 className="text-lg font-semibold">مشخصات محصول</h2><dl className="mt-3 divide-y divide-[#e8e5de]">{detail.attributes.map((attribute) => <div key={attribute.key} className="flex justify-between gap-4 py-3 text-sm"><dt className="text-[#77736a]">{attribute.label}</dt><dd className="font-medium">{attributeText(attribute)}</dd></div>)}{(detail.variants.find((variant) => variant.id === (variantChoice[detail.id] ?? detail.variants.find((item) => item.orderable)?.id ?? detail.variants[0]?.id)))?.options.map((option) => <div key={option.key} className="flex justify-between gap-4 py-3 text-sm"><dt className="text-[#77736a]">{option.label}</dt><dd className="font-medium">{attributeText(option)}</dd></div>)}</dl></section>}
        </div></article>}
    </section>}
    <footer className="border-t border-[#e1ded7] bg-[#f0eee8] px-5 py-8 text-center text-sm text-[#6e6a60]">{view.name} · فروشگاه خرده‌فروشی بازارباز</footer>
  </main>;
}
