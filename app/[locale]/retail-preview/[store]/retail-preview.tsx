"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { phones, shoes, type RetailStore as Store } from "./retail-data";
import type { PublicCatalogProduct } from "@/lib/public-catalog/contracts";
import RetailLiveCatalog from "@/app/[locale]/retail/[organization]/retail-catalog";
const rial = (n: number) => new Intl.NumberFormat("fa-IR").format(n) + " تومان";

type LiveView = { identifier: string; name: string; description: string | null; theme: "FASHION" | "ELECTRONICS" | "GENERAL"; previewOnly: boolean; categories: Array<{ id: string; name: string; slug: string | null }>; products: PublicCatalogProduct[] };

export default function RetailPreview({ store, productId, liveView, storefrontPath, checkoutPath }: { store?: Store; productId?: string; liveView?: LiveView; storefrontPath?: string; checkoutPath?: string }) {
  if (liveView) return <RetailLiveCatalog view={liveView} productSlug={productId} storefrontPath={storefrontPath} checkoutPath={checkoutPath} />;
  if (!store) return null;
  return <RetailPreviewFixture store={store} productId={productId} />;
}

function RetailPreviewFixture({ store, productId }: { store: Store; productId?: string }) {
  const fashion = store === "fashion";
  const products = fashion ? shoes : phones;
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("همه");
  const [attribute, setAttribute] = useState("همه");
  const [priceRange, setPriceRange] = useState("all");
  const [sort, setSort] = useState("featured");
  const [selected, setSelected] = useState<Record<string, number>>({});
  const categories = ["همه", ...Array.from(new Set(products.map((p) => p.category)))];
  const attrs = fashion ? ["همه", "چرم", "روزمره", "اسپرت", "رسمی"] : ["همه", "۸ گیگابایت", "۱۲ گیگابایت", "۱۲۸ گیگابایت", "۲۵۶ گیگابایت", "5G"];
  const filtered = useMemo(() => {
    let list = products.filter((p) => `${p.title} ${p.note} ${Object.values(p.attrs).join(" ")}`.toLowerCase().includes(query.trim().toLowerCase()) && (category === "همه" || p.category === category) && (attribute === "همه" || Object.values(p.attrs).some((v) => v.includes(attribute))) && (priceRange === "all" || (priceRange === "under-3m" && p.price < 3000000) || (priceRange === "3m-10m" && p.price >= 3000000 && p.price <= 10000000) || (priceRange === "over-10m" && p.price > 10000000)));
    if (sort === "price-asc") list = [...list].sort((a, b) => a.price - b.price);
    if (sort === "price-desc") list = [...list].sort((a, b) => b.price - a.price);
    return list;
  }, [products, query, category, attribute, priceRange, sort]);
  const storeTitle = fashion ? "بوتیک آکا" : "تک‌استور";
  if (productId) {
    const product = products.find((item) => item.id === productId);
    if (!product) return <main dir="rtl" className="min-h-screen bg-[#f8f7f4] p-10 text-center">این محصول نمونه پیدا نشد.</main>;
    const ix = selected[product.id] ?? 0;
    const variant = product.variants[ix];
    return <main dir="rtl" className="min-h-screen bg-[#f8f7f4] text-[#24241f]"><div className="bg-[#252720] px-4 py-2 text-center text-xs text-white">پیش‌نمایش نمایشی · محصول و مشخصات نمونه</div><div className="mx-auto max-w-7xl px-5 py-6 md:px-10"><a href={`/fa/retail-preview/${store}#products`} className="text-sm text-[#766d61]">← بازگشت به محصولات</a><div className="mt-6 grid gap-8 md:grid-cols-2"><div><div className="relative aspect-square overflow-hidden rounded-3xl bg-[#e9e5dc]"><Image fill unoptimized priority sizes="(max-width: 768px) 100vw, 50vw" className="object-cover" src={`product.image`} alt={`${product.title} · تصویر اصلی نمونه`} /></div><div className="mt-3 grid grid-cols-3 gap-3">{[product.image, product.image, product.image].map((image, i) => <div key={`${image}-${i}`} className="relative aspect-square overflow-hidden rounded-xl bg-[#e9e5dc]"><Image fill unoptimized sizes="(max-width: 768px) 33vw, 16vw" className="object-cover" src={image} alt={`${product.title} · نمای ${i + 1} · نمونه`} /></div>)}</div><p className="mt-2 text-center text-xs text-[#77736a]">تصاویر چندزاویه‌ای نمونه پیش‌نمایش هستند.</p></div><div className="py-2 md:py-8"><span className="text-sm text-[#92704e]">{product.category} · تصویر و داده نمونه</span><h1 className="mt-3 text-3xl font-semibold md:text-4xl">{product.title}</h1><p className="mt-4 leading-8 text-[#67655e]">{product.note}. این توضیح صرفاً برای نمایش چیدمان صفحه جزئیات نوشته شده است.</p><strong className="mt-6 block text-xl">{rial(variant.price)}</strong><span className="mt-2 block text-sm">{variant.stock > 0 ? `موجود در داده نمونه · ${variant.stock} عدد` : "ناموجود در داده نمونه"}</span><label htmlFor="detail-variant" className="mt-7 block text-sm font-medium">انتخاب گزینه</label><select id="detail-variant" value={ix} onChange={(e) => setSelected({ ...selected, [product.id]: Number(e.target.value) })} className="mt-2 w-full rounded-xl border border-[#ddd9d0] bg-white px-4 py-3">{product.variants.map((v, i) => <option key={v.sku} value={i}>{v.label} · {v.sku}</option>)}</select><button disabled className="mt-5 w-full cursor-not-allowed rounded-full bg-[#292a24] px-7 py-4 text-sm text-white/60">خرید در پیش‌نمایش غیرفعال است</button><section className="mt-8 border-t border-[#dfdcd4] pt-5"><h2 className="text-lg font-semibold">مشخصات محصول</h2><dl className="mt-3 divide-y divide-[#e8e5de]">{Object.entries(product.attrs).map(([key, value]) => <div key={key} className="flex justify-between gap-4 py-3 text-sm"><dt className="text-[#77736a]">{key}</dt><dd className="font-medium">{value}</dd></div>)}<div className="flex justify-between gap-4 py-3 text-sm"><dt className="text-[#77736a]">کد نمونه (SKU)</dt><dd className="font-medium">{variant.sku}</dd></div></dl></section></div></div></div></main>;
  }
  return <main dir="rtl" className="min-h-screen bg-[#f8f7f4] text-[#24241f]">
    <div className="bg-[#252720] px-4 py-2 text-center text-xs text-white">پیش‌نمایش نمایشی · قیمت، موجودی و تصاویر نمونه هستند و برای خرید واقعی نیستند</div>
    <header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 md:px-10">
      <a href="#home" className="text-xl font-bold tracking-tight">{storeTitle}<span className="mr-2 text-[#9b7653]">●</span></a>
      <nav className="hidden gap-8 text-sm md:flex"><a href="#collection">کالکشن تازه</a><a href="#products">{fashion ? "کفش‌ها" : "گوشی‌ها"}</a><a href="#about">درباره فروشگاه</a></nav>
      <a href="#products" className="rounded-full border border-[#d9d5cd] px-4 py-2 text-sm">مشاهده محصولات <span aria-hidden>⌕</span></a>
    </header>
    <section id="home" className="mx-auto grid max-w-7xl gap-5 px-4 pb-8 md:grid-cols-[1fr_1.15fr] md:px-10">
      <div className="flex min-h-[390px] flex-col justify-center rounded-[2rem] bg-[#e9e5dc] p-8 md:min-h-[530px] md:p-14">
        <span className="text-xs font-semibold tracking-[.18em] text-[#8a6849]">{fashion ? "کالکشن بهار · ۱۴۰۵" : "انتخاب هوشمند · ۱۴۰۵"}</span>
        <h1 className="mt-5 max-w-lg text-4xl font-semibold leading-[1.4] md:text-6xl">{fashion ? <>سادگی‌ای که<br/>به چشم می‌آید.</> : <>فناوری برای<br/>زندگی روزمره.</>}</h1>
        <p className="mt-5 max-w-md leading-8 text-[#67655e]">{fashion ? "انتخاب‌هایی خوش‌ساخت برای قدم‌های هر روز؛ با نگاهی آرام به فرم و جزئیات." : "مشخصات شفاف، انتخاب ساده‌تر؛ دستگاه مناسب خودتان را با خیال راحت پیدا کنید."}</p>
        <a href="#products" className="mt-8 w-fit rounded-full bg-[#292a24] px-7 py-3 text-sm text-white">دیدن محصولات <span className="mr-2">←</span></a>
        <div className="mt-10 flex gap-8 border-t border-[#d2cec4] pt-5 text-xs text-[#6e6a60]"><span>ارسال به سراسر ایران</span><span>پشتیبانی پاسخ‌گو</span></div>
      </div>
      <div className="relative min-h-[360px] overflow-hidden rounded-[2rem] bg-[#d3cdc2] md:min-h-[530px]">
        <Image fill unoptimized priority sizes="(max-width: 768px) 100vw, 55vw" className="object-cover" src={fashion ? "/retail-preview/preview-fashion-campaign.png" : "/retail-preview/preview-mobile-campaign.png"} alt={fashion ? "نمایش هنری کفش زنانه، تصویر نمونه پیش‌نمایش" : "نمایش گوشی هوشمند، تصویر نمونه پیش‌نمایش"} />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-7 pt-24 text-white"><span className="text-xs">{fashion ? "فرم، بافت، حرکت" : "انتخاب دقیق‌تر"}</span><p className="mt-2 text-2xl">{fashion ? "برای روزهای خودت" : "جزئیاتی که اهمیت دارند"}</p></div>
        <span className="absolute left-5 top-5 rounded-full bg-white/90 px-4 py-2 text-xs">تصویر نمونه</span>
      </div>
    </section>
    <section id="collection" className="mx-auto max-w-7xl px-5 py-8 md:px-10"><div className="flex items-end justify-between border-b border-[#e1ded7] pb-5"><div><span className="text-xs text-[#92704e]">انتخاب‌شده برای شما</span><h2 className="mt-2 text-2xl font-semibold">{fashion ? "کالکشن‌های این فصل" : "دسته‌بندی محصولات"}</h2></div><a href="#products" className="text-sm text-[#726c61]">همه محصولات ←</a></div><div className="mt-5 flex gap-3 overflow-auto pb-2">{categories.map((c) => <button key={c} onClick={() => setCategory(c)} className={`shrink-0 rounded-full px-5 py-3 text-sm ${category === c ? "bg-[#292a24] text-white" : "bg-white text-[#55534c]"}`}>{c === "همه" ? "همه محصولات" : c}</button>)}</div></section>
    <section id="products" className="mx-auto max-w-7xl px-5 pb-20 pt-7 md:px-10"><div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between"><div><span className="text-xs text-[#92704e]">{fashion ? "با دقت انتخاب شده" : "مشخصات قابل بررسی"}</span><h2 className="mt-2 text-3xl font-semibold">{fashion ? "محبوب‌های ما" : "گوشی‌های منتخب"}</h2></div><div className="grid gap-3 sm:grid-cols-3"><label className="sr-only" htmlFor="retail-search">جستجوی محصول</label><input id="retail-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="جستجوی محصول..." className="rounded-xl border border-[#ddd9d0] bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#9b7653]"/><label className="sr-only" htmlFor="retail-filter">فیلتر ویژگی</label><select id="retail-filter" value={attribute} onChange={(e) => setAttribute(e.target.value)} className="rounded-xl border border-[#ddd9d0] bg-white px-4 py-3 text-sm"><option value="همه">همه ویژگی‌ها</option>{attrs.slice(1).map((a) => <option key={a}>{a}</option>)}</select><label className="sr-only" htmlFor="retail-price">فیلتر قیمت</label><select id="retail-price" value={priceRange} onChange={(e) => setPriceRange(e.target.value)} className="rounded-xl border border-[#ddd9d0] bg-white px-4 py-3 text-sm"><option value="all">همه قیمت‌ها</option><option value="under-3m">کمتر از ۳ میلیون</option><option value="3m-10m">۳ تا ۱۰ میلیون</option><option value="over-10m">بیشتر از ۱۰ میلیون</option></select><label className="sr-only" htmlFor="retail-sort">مرتب‌سازی</label><select id="retail-sort" value={sort} onChange={(e) => setSort(e.target.value)} className="rounded-xl border border-[#ddd9d0] bg-white px-4 py-3 text-sm"><option value="featured">مرتب‌سازی: پیشنهادی</option><option value="price-asc">قیمت: کم به زیاد</option><option value="price-desc">قیمت: زیاد به کم</option></select></div></div>
      {filtered.length ? <div className="mt-7 grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-5 xl:grid-cols-4">{filtered.map((p) => { const ix = selected[p.id] ?? 0; const variant = p.variants[ix]; const available = variant.stock > 0; return <article key={p.id} className="group overflow-hidden rounded-2xl bg-white"><div className="relative aspect-[.82] overflow-hidden bg-[#eeeae3]"><Image unoptimized width={750} height={915} sizes="(max-width: 768px) 50vw, (max-width: 1280px) 33vw, 25vw" src={`${p.image}`} alt={`${p.title} · تصویر نمونه پیش‌نمایش`} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"/><span className="absolute right-3 top-3 rounded-full bg-white/90 px-3 py-1.5 text-[10px]">تصویر نمونه</span></div><div className="p-4 md:p-5"><span className="text-xs text-[#977553]">{p.category}</span><h3 className="mt-1 text-base font-medium md:text-lg"><a href={`/fa/retail-preview/${store}/product/${p.id}`} className="hover:underline focus-visible:outline focus-visible:outline-2">{p.title}</a></h3><p className="mt-1 line-clamp-1 text-xs text-[#77736a]">{p.note}</p><div className="mt-3 flex flex-wrap gap-1.5">{Object.entries(p.attrs).slice(0, 3).map(([k, v]) => <span key={k} className="rounded-full bg-[#f5f3ef] px-2 py-1 text-[10px] text-[#666158]">{k}: {v}</span>)}</div><label className="sr-only" htmlFor={`variant-${p.id}`}>گزینه محصول {p.title}</label><select id={`variant-${p.id}`} value={ix} onChange={(e) => setSelected({ ...selected, [p.id]: Number(e.target.value) })} className="mt-4 w-full rounded-lg border border-[#e2dfd8] bg-white px-2 py-2 text-xs">{p.variants.map((v, i) => <option value={i} key={v.sku}>{v.label} · کد نمونه {v.sku.replace("PREVIEW-", "")}</option>)}</select><div className="mt-3 flex items-center justify-between gap-2"><div><strong className="block text-sm">{rial(variant.price)}</strong><span className={`mt-1 block text-[11px] ${available ? "text-emerald-700" : "text-[#a45041]"}`}>{available ? `موجود · ${variant.stock} عدد نمونه` : "ناموجود در داده نمونه"}</span></div><button disabled className="cursor-not-allowed rounded-full bg-[#eeece7] px-3 py-2 text-xs text-[#77736a]" title="خرید در این پیش‌نمایش فعال نیست">خرید غیرفعال</button></div></div></article>; })}</div> : <div className="mt-8 rounded-2xl bg-white p-10 text-center text-[#6e6a60]">محصولی با این مشخصات پیدا نشد. فیلترها را تغییر دهید.</div>}
      <p className="mt-6 text-center text-xs text-[#77736a]">موجودی و قیمت‌های بالا صرفاً داده ساختگی برای ارزیابی رابط هستند؛ هیچ سفارش یا تغییری در موجودی ثبت نمی‌شود.</p>
    </section>
    <footer id="about" className="border-t border-[#e1ded7] bg-[#f0eee8] px-5 py-8 text-center text-sm text-[#6e6a60]">{storeTitle} · نمای آزمایشی موتور فروشگاه خرده‌فروشی بازارباز</footer>
  </main>;
}
