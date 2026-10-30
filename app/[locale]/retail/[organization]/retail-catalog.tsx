"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useParams } from "next/navigation";
import { Home, LayoutGrid, Share2, ShoppingBag, UserRound } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PremiumProductDetail } from "@/components/retail/premium-product-detail";
import { appPath } from "@/lib/app-base-path";
import { chooseVariant, findVariantOption, optionDimensions, resolveSelectedVariant, retailAttributeText, type RetailProduct, type RetailVariant } from "@/lib/retail/variant-selection";

type RetailView = {
  identifier: string;
  name: string;
  description: string | null;
  branding: { logo: string | null; cover: string | null };
  theme: "FASHION" | "ELECTRONICS" | "GENERAL";
  previewOnly: boolean;
  categories: Array<{ id: string; slug: string | null; name: string }>;
  products: RetailProduct[];
};

function optionValues(product: RetailProduct, dimension: string) {
  const values = new Map<string, string>();
  for (const variant of product.variants) {
    const option = findVariantOption(variant, dimension);
    if (option) values.set(attributeText(option), option.label);
  }
  return [...values].map(([value, label]) => ({ value, label }));
}

function colorToken(value: string) {
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value)) return value;
  const color = value.normalize("NFKD").toLocaleLowerCase("fa").replace(/[\s_-]+/g, "");
  const colors: Record<string, string> = {
    black: "#242424", مشکی: "#242424", سفید: "#ffffff", white: "#ffffff", قرمز: "#cf3e36", red: "#cf3e36",
    آبی: "#3478c5", آبیروشن: "#66a4d9", blue: "#3478c5", سبز: "#4b8f55", green: "#4b8f55",
    زرد: "#e4bd38", yellow: "#e4bd38", صورتی: "#d987a5", pink: "#d987a5", قهوهای: "#82583d", brown: "#82583d",
    خاکستری: "#8b8b88", gray: "#8b8b88", grey: "#8b8b88", بنفش: "#8462a9", purple: "#8462a9",
  };
  return colors[color] ?? "#b7b3ab";
}

function VariantDimension({ product, dimension, selected, onChange }: {
  product: RetailProduct; dimension: string; selected: RetailVariant | undefined; onChange: (variant: RetailVariant) => void;
}) {
  const first = product.variants.flatMap((variant) => variant.options).find((option) => option.key === dimension);
  if (!first) return null;
  const values = optionValues(product, dimension);
  const selectedValue = findVariantOption(selected ?? resolveSelectedVariant(product), dimension);
  const isColor = /colou?r|رنگ/.test(`${first.key}${first.label}`.normalize("NFKD").toLocaleLowerCase("fa").replace(/[\s_-]+/g, ""));
  return <fieldset className="mt-3"><legend className="text-xs font-medium">{first.label}</legend><div className="mt-2 flex flex-wrap gap-2">
    {values.map(({ value }) => {
      const target = chooseVariant(product, selected, dimension, value);
      const active = selectedValue ? attributeText(selectedValue) === value : false;
      return <button key={value} type="button" disabled={!target} aria-pressed={active} onClick={() => target && onChange(target)}
        className={`min-h-10 rounded-full border px-3 py-2 text-xs transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9b7653] disabled:opacity-35 ${active ? "border-[#292a24] bg-[#292a24] text-white" : "border-[#ddd9d0] bg-white text-[#4c4a43]"}`}>
        {isColor && <span aria-hidden className="ml-1 inline-block h-2.5 w-2.5 rounded-full border border-black/15" style={{ backgroundColor: colorToken(value) }} />}{value}
      </button>;
    })}
  </div></fieldset>;
}

const toman = (amount: number) => `${new Intl.NumberFormat("fa-IR").format(amount)} تومان`;
const attributeText = retailAttributeText;
const cartErrorText = (value: unknown) => value instanceof Error && /currently available stock|insufficient inventory/i.test(value.message)
  ? "موجودی این گزینه برای این تعداد کافی نیست. تعداد را کم کنید یا گزینه دیگری را انتخاب کنید."
  : value instanceof Error ? value.message : "افزودن کالا به سبد خرید ممکن نشد.";

export default function RetailLiveCatalog({ view, productSlug, storefrontPath, checkoutPath, embedded = false }: { view: RetailView; productSlug?: string; storefrontPath?: string; checkoutPath?: string; embedded?: boolean }) {
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
  const [cartNotice, setCartNotice] = useState("");
  const [newArrivals, setNewArrivals] = useState<RetailProduct[]>([]);
  const [newArrivalsAvailable, setNewArrivalsAvailable] = useState(false);
  const isFashion = view.theme === "FASHION";
  const selectedVariantFor = (product: RetailProduct) =>
    resolveSelectedVariant(product, variantChoice[product.id]);

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
      if (query.trim()) params.set("q", query.trim());
      if (category) params.set("category", category);
      if (filter) params.set("filter", filter);
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
  }, [view.identifier, query, category, filter, page, productSlug, retryKey]);

  useEffect(() => {
    if (productSlug) return;
    const controller = new AbortController();
    (async () => {
      try {
        const params = new URLSearchParams({ page: "1", limit: "8", sort: "newest" });
        const response = await fetch(appPath(`/api/public/v1/organizations/${encodeURIComponent(view.identifier)}/products?${params}`), { signal: controller.signal, headers: { Accept: "application/json" } });
        if (!response.ok) throw new Error("newest request failed");
        const body = await response.json() as { version: string; data: { products: RetailProduct[] } };
        if (body.version !== "v1" || !Array.isArray(body.data.products)) throw new Error("newest response invalid");
        setNewArrivals(body.data.products);
        setNewArrivalsAvailable(body.data.products.length > 0);
      } catch {
        if (!controller.signal.aborted) setNewArrivalsAvailable(false);
      }
    })();
    return () => controller.abort();
  }, [view.identifier, productSlug]);


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
  const heroProduct = view.products.find((product) => product.media.detail || product.media.card) ?? view.products[0];
  const heroImage = view.branding.cover || heroProduct?.media.detail || heroProduct?.media.card || null;
  const categoryProducts = view.categories.map((item) => ({
    ...item,
    product: view.products.find((product) => product.category.id === item.id && product.media.card),
  }));
  const addToCart = async (variantId?: string) => {
    if (!variantId || view.previewOnly) return;
    setCartNotice("");
    try {
      const response = await fetch(appPath("/api/retail/v1/cart"), {
        method: "POST", credentials: "same-origin", headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ organization: view.identifier, variantId, quantity: 1 }),
      });
      if (response.status === 401) {
        const callbackUrl = checkoutHref;
        window.location.assign(appPath(`/${encodeURIComponent(locale)}/login?callbackUrl=${encodeURIComponent(callbackUrl)}`));
        return;
      }
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "افزودن کالا به سبد خرید ممکن نشد.");
      setCartNotice("کالا به سبد خرید اضافه شد.");
    } catch (error) {
      setCartNotice(cartErrorText(error));
    }
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
  const renderProduct = (product: RetailProduct) => {
    const selectedVariant = selectedVariantFor(product);
    const selectedId = selectedVariant?.id ?? "";
    const image = selectedVariant?.media?.gallery[0] ?? product.media.card;
    const dimensions = optionDimensions(product);
    const selectVariant = (variant: RetailVariant) => setVariantChoice((current) => ({ ...current, [product.id]: variant.id }));
    const href = `${base}/product/${encodeURIComponent(product.slug ?? product.id)}`;
    return <Card key={product.id} className="bg-card text-card-foreground group overflow-hidden rounded-2xl border-0 shadow-sm">
      <a href={href} className="bg-muted relative block aspect-[.82] overflow-hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
        {image ? <Image unoptimized fill sizes="(max-width: 768px) 50vw, (max-width: 1280px) 33vw, 25vw" src={image} alt={product.media.alt || product.name} className="object-cover transition-transform duration-500 group-hover:scale-[1.03]" /> : <div className="grid h-full place-items-center text-sm text-[#77736a]">تصویری برای این کالا ثبت نشده است</div>}
</a>
      <div className="p-4 md:p-5"><span className="text-muted-foreground text-xs">{product.brand ? `${product.brand} · ` : ""}{product.category.name}</span>
        <h2 className="mt-1 text-base font-medium leading-6 md:text-lg"><a href={href} className="hover:underline">{product.name}</a></h2>
        {product.attributes.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{product.attributes.slice(0, 3).map((attribute) => <span key={attribute.key} className="rounded-full bg-[#f5f3ef] px-2 py-1 text-[10px] text-[#666158]">{attribute.label}: {attributeText(attribute)}</span>)}</div>}
        {dimensions.color.length > 0 && <VariantDimension product={product} dimension={dimensions.color[0]} selected={selectedVariant} onChange={selectVariant} />}
        {dimensions.size.length > 0 && <VariantDimension product={product} dimension={dimensions.size[0]} selected={selectedVariant} onChange={selectVariant} />}
        {dimensions.color.length === 0 && dimensions.size.length === 0 && product.variants.length > 1 && <label className="mt-4 block text-xs">گزینه قابل انتخاب<select aria-label={`گزینه قابل انتخاب برای ${product.name}`} value={selectedId} onChange={(event) => setVariantChoice((current) => ({ ...current, [product.id]: event.target.value }))} className="mt-2 min-h-11 w-full rounded-lg border border-border bg-card px-2 py-2 text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">{product.variants.map((variant) => <option key={variant.id} value={variant.id}>{variant.name ?? variant.options.map((option) => `${option.label}: ${attributeText(option)}`).join(" · ")}</option>)}</select></label>}
        <div className="mt-4 flex items-center justify-between gap-2"><div className="min-w-0">{(() => {
  const selectedList = selectedVariant?.listPrice?.amount;
  const selectedPrice = selectedVariant?.price.amount ?? product.price.amount;
  const variantSale = selectedVariant && selectedList !== undefined && selectedList > selectedPrice;
  const productSale = !selectedVariant && product.listPrice && product.listPrice.amount > product.price.amount;
  const showBadge = variantSale || productSale;
  return showBadge ? <span className="mb-1 inline-block rounded-full bg-destructive px-2 py-0.5 text-[10px] text-destructive-foreground">تخفیف</span> : null;
})()}<strong className="block truncate text-sm">{toman(selectedVariant?.price.amount ?? product.price.amount)}</strong>{(() => {
  const selectedList = selectedVariant?.listPrice?.amount;
  const showList = selectedList && selectedList > (selectedVariant?.price.amount ?? 0);
  const fallback = !selectedVariant && product.listPrice && product.listPrice.amount > product.price.amount;
  if (showList) return <span className="mt-1 block text-[11px] line-through text-muted-foreground">{toman(selectedList)}</span>;
  if (fallback) return <span className="mt-1 block text-[11px] line-through text-muted-foreground">{toman(product.listPrice!.amount)}</span>;
  return null;
})()}<span className={`mt-1 block text-[11px] ${selectedVariant?.orderable ? "text-emerald-700" : "text-destructive"}`}>{selectedVariant ? (selectedVariant.orderable ? "موجود" : "ناموجود") : "وضعیت فروش ثبت نشده"}</span></div>
          <Button type="button" aria-label={`افزودن ${product.name} به سبد خرید`} disabled={view.previewOnly || !selectedVariant?.orderable} onClick={() => void addToCart(selectedVariant?.id)} size="sm" className="min-h-11 shrink-0 rounded-full px-3 py-2 text-xs">{view.previewOnly ? "پیش‌نمایش" : selectedVariant?.orderable ? "افزودن به سبد" : "ناموجود"}</Button>
        </div>
      </div>
    </Card>;
  };

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
      {!productSlug && <nav aria-label="ناوبری فروشگاه" className="hidden gap-8 text-sm md:flex"><a href={`${base}#categories`}>دسته‌بندی‌ها</a><a href={`${base}#new-arrivals`}>تازه‌واردها</a><a href={`${base}#sale`}>تخفیف‌دارها</a><a href={`${base}#products`}>محصولات</a></nav>}
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
    <section className="mx-auto grid max-w-7xl gap-4 px-4 pb-8 md:grid-cols-[.88fr_1.12fr] md:px-10">
      <div className="bg-card text-card-foreground flex min-h-[360px] flex-col justify-center rounded-[2rem] p-7 ring-1 ring-border sm:p-10 md:min-h-[500px] md:p-14">
        <div className="mb-8 flex items-center gap-3">
          {view.branding.logo && <Image src={view.branding.logo} width={48} height={48} unoptimized alt="" className="size-12 rounded-xl bg-white object-contain p-1" />}
          <div><p className="text-xs font-semibold tracking-[.12em] text-[#8a6849]">{isFashion ? "ویترین پوشاک و کفش" : view.theme === "ELECTRONICS" ? "فروشگاه لوازم الکترونیکی" : "فروشگاه خرده‌فروشی"}</p><p className="mt-1 text-sm font-medium">{view.name}</p></div>
        </div>
        <h1 className="max-w-xl text-4xl font-semibold leading-[1.4] md:text-6xl">{isFashion ? <>استایل خودت را<br />از اینجا پیدا کن.</> : <>انتخابی دقیق،<br />برای هر روز.</>}</h1>
        <p className="mt-5 max-w-md leading-8 text-[#67655e]">{view.description ?? "محصولات منتشرشده فروشگاه را ببینید و گزینه مناسب خود را انتخاب کنید."}</p>
        <div className="mt-8 flex flex-wrap gap-3"><a href={`${base}#products`} className="min-h-12 rounded-full bg-[#292a24] px-7 py-3.5 text-sm font-semibold text-white">مشاهده محصولات <span className="mr-2" aria-hidden>←</span></a>{view.categories[0] && <button type="button" onClick={() => { setCategory(view.categories[0]!.slug ?? view.categories[0]!.id); setPage(1); document.getElementById("products")?.scrollIntoView({ behavior: "smooth" }); }} className="min-h-12 rounded-full border border-[#cfc9bd] px-6 py-3 text-sm">دسته‌بندی‌ها</button>}</div>
      </div>
      <div className="relative min-h-[360px] overflow-hidden rounded-[2rem] bg-[#d8d2c7] md:min-h-[500px]">
        {heroImage ? <Image src={heroImage} alt={heroProduct?.media.alt || view.name} fill unoptimized priority sizes="(max-width: 768px) 100vw, 55vw" className="object-cover" /> : <div className="absolute inset-0 grid place-items-center bg-gradient-to-br from-[#eeeae3] to-[#c9c1b4] p-8 text-center text-[#655d51]"><span className="text-lg font-medium">{view.name}</span></div>}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent p-6 pt-24 text-white md:p-9 md:pt-32">
          <p className="text-xs text-white/80">{heroProduct ? heroProduct.category.name : "محصولات فروشگاه"}</p>
          {heroProduct ? <><h2 className="mt-2 text-2xl font-semibold md:text-3xl">{heroProduct.name}</h2><div className="mt-4 flex flex-wrap items-center gap-4"><span className="text-sm">{toman(heroProduct.price.amount)}</span><a href={`${base}/product/${encodeURIComponent(heroProduct.slug ?? heroProduct.id)}`} className="min-h-11 rounded-full bg-white px-5 py-3 text-sm font-semibold text-[#292a24]">جزئیات محصول</a></div></> : <h2 className="mt-2 text-2xl font-semibold">{view.name}</h2>}
        </div>
      </div>
    </section>
    <section id="categories" className="mx-auto max-w-7xl px-4 py-8 md:px-10">
      <div className="flex items-end justify-between gap-4 border-b border-[#e1ded7] pb-4"><div><span className="text-xs text-[#8a6849]">{isFashion ? "انتخاب بر اساس دسته" : "دسته‌بندی محصولات"}</span><h2 className="mt-2 text-2xl font-semibold">دسته‌بندی‌ها</h2></div><a href={`${base}#products`} className="text-sm text-[#726c61]">همه محصولات ←</a></div>
      {categoryProducts.length ? <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{categoryProducts.map((item) => <button key={item.id} type="button" onClick={() => { const value = item.slug ?? item.id; setCategory(category === value ? "" : value); setPage(1); document.getElementById("products")?.scrollIntoView({ behavior: "smooth" }); }} aria-pressed={category === (item.slug ?? item.id)} className={`group relative min-h-36 overflow-hidden rounded-2xl text-start focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9b7653] ${category === (item.slug ?? item.id) ? "ring-2 ring-[#292a24]" : ""}`}>
        {item.product?.media.card ? <Image src={item.product.media.card} alt="" fill unoptimized sizes="(max-width: 768px) 50vw, 25vw" className="object-cover transition-transform duration-300 group-hover:scale-105" /> : <span className="absolute inset-0 bg-gradient-to-br from-[#e9e5dc] to-[#d3cdc2]" />}
        <span className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-transparent" /><span className="absolute inset-x-0 bottom-0 p-4 text-sm font-semibold text-white">{item.name}<span className="mt-1 block text-[11px] font-normal text-white/80">مشاهده محصولات این دسته</span></span>
      </button>)}</div> : <p className="bg-card text-card-foreground mt-5 rounded-xl p-5 text-sm">دسته‌بندی فعالی برای نمایش ثبت نشده است.</p>}
    </section>
    {newArrivalsAvailable && newArrivals.length > 0 && <section id="new-arrivals" className="mx-auto max-w-7xl px-5 pb-8 pt-2 md:px-10"><div className="flex items-end justify-between gap-4 border-b border-border pb-4"><div><span className="text-primary text-xs">جدیدترین محصولات</span><h2 className="mt-2 text-2xl font-semibold">تازه‌واردها</h2></div><a href={`${base}#products`} className="text-muted-foreground text-sm hover:text-foreground">همه محصولات ←</a></div><div className="mt-7 grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-5 xl:grid-cols-4">{newArrivals.map(renderProduct)}</div></section>}
    {view.products.some((product) => product.listPrice && product.listPrice.amount > product.price.amount) && <section id="sale" className="mx-auto max-w-7xl px-5 pb-8 pt-2 md:px-10"><div className="flex items-end justify-between gap-4 border-b border-border pb-4"><div><span className="text-destructive text-xs">پیشنهادهای ویژه</span><h2 className="mt-2 text-2xl font-semibold">حراج</h2></div><a href={`${base}#products`} className="text-muted-foreground text-sm hover:text-foreground">همه محصولات ←</a></div><div className="mt-7 grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-5 xl:grid-cols-4">{view.products.filter((product) => product.listPrice && product.listPrice.amount > product.price.amount).map(renderProduct)}</div></section>}
    <section id="products" className="mx-auto max-w-7xl px-5 pb-20 pt-7 md:px-10">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between"><div><span className="text-xs text-[#92704e]">فهرست منتشرشده فروشگاه</span><h2 className="mt-2 text-3xl font-semibold">{view.theme === "ELECTRONICS" ? "دستگاه‌ها و مشخصات" : "محصولات فروشگاه"}</h2></div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6"><label className="sr-only" htmlFor="retail-search">جستجوی محصول</label><input id="retail-search" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="جستجوی محصول..." className="min-h-11 rounded-xl border border-[#ddd9d0] bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#9b7653]" />
          <label className="sr-only" htmlFor="retail-filter">فیلتر ویژگی</label><select id="retail-filter" value={filter} onChange={(event) => { setFilter(event.target.value); setPage(1); }} className="min-h-11 rounded-xl border border-[#ddd9d0] bg-white px-4 py-3 text-sm"><option value="">همه ویژگی‌ها</option>{availableFilters.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
          <label className="sr-only" htmlFor="retail-price-min">کمترین قیمت به تومان</label><input id="retail-price-min" type="number" min="0" value={minimumPrice} onChange={(event) => setMinimumPrice(event.target.value)} placeholder="حداقل قیمت" className="min-h-11 min-w-0 rounded-xl border border-[#ddd9d0] bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#9b7653]" />
          <label className="sr-only" htmlFor="retail-price-max">بیشترین قیمت به تومان</label><input id="retail-price-max" type="number" min="0" value={maximumPrice} onChange={(event) => setMaximumPrice(event.target.value)} placeholder="حداکثر قیمت" className="min-h-11 min-w-0 rounded-xl border border-[#ddd9d0] bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#9b7653]" />
          <label className="sr-only" htmlFor="retail-sort">مرتب‌سازی</label><select id="retail-sort" value={sort} onChange={(event) => setSort(event.target.value)} className="min-h-11 rounded-xl border border-[#ddd9d0] bg-white px-4 py-3 text-sm"><option value="featured">پیشنهادی</option><option value="name">نام محصول</option><option value="price-asc">قیمت: کم به زیاد</option><option value="price-desc">قیمت: زیاد به کم</option></select>
        </div>
      </div>
      {error ? <div role="alert" className="mt-8 rounded-2xl bg-white p-8 text-center text-[#8c3329]"><p>{online === false ? "اتصال اینترنت برقرار نیست. پس از اتصال دوباره تلاش کنید." : "دریافت محصولات ممکن نشد. اتصال را بررسی کنید و دوباره تلاش کنید."}</p><button type="button" onClick={() => { setError(false); setRetryKey((current) => current + 1); }} className="mt-4 min-h-11 rounded-full border border-[#d9d5cd] px-5 text-sm text-[#24241f] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9b7653]">تلاش دوباره</button></div> : busy ? <p role="status" className="mt-8 rounded-2xl bg-white p-10 text-center">در حال دریافت محصولات…</p> : sortedProducts.length ? <><div className="mt-7 grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-5 xl:grid-cols-4">{sortedProducts.map(renderProduct)}</div><nav aria-label="صفحه‌های محصولات" className="mt-8 flex items-center justify-center gap-4"><button disabled={pagination.page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))} className="min-h-11 rounded-full border border-[#d9d5cd] px-5 disabled:opacity-40">قبلی</button><span className="text-sm" aria-live="polite">صفحه {new Intl.NumberFormat("fa-IR").format(pagination.page)} از {new Intl.NumberFormat("fa-IR").format(pagination.totalPages)}</span><button disabled={pagination.page >= pagination.totalPages} onClick={() => setPage((current) => Math.min(pagination.totalPages, current + 1))} className="min-h-11 rounded-full border border-[#d9d5cd] px-5 disabled:opacity-40">بعدی</button></nav></> : <div className="mt-8 rounded-2xl bg-white p-10 text-center text-[#6e6a60]">محصولی با این مشخصات پیدا نشد. فیلترها را تغییر دهید.</div>}
      {cartNotice && <p role="status" aria-live="polite" className="mt-5 text-center text-sm text-[#6e6a60]">{cartNotice}</p>}
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
