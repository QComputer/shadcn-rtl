"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ImagePlus, Sparkles, Trash2 } from "lucide-react";
import { isEligibleRetailWebsiteMedia, type WebsiteMedia } from "@/lib/website-studio/retail-contract";
import type { PublicCatalogProduct } from "@/lib/public-catalog/contracts";
import type { RetailHeroConfig } from "@/lib/website-studio/retail-hero-contract";
import styles from "./retail-hero-editor.module.css";

type Props = {
  value: RetailHeroConfig;
  onChange: (hero: RetailHeroConfig) => void;
  media: WebsiteMedia[];
  products: PublicCatalogProduct[];
  organizationId: string;
  onMediaAdded: (image: WebsiteMedia) => void;
  disabled: boolean;
};

const money = new Intl.NumberFormat("fa-IR");

export function RetailHeroEditor({ value, onChange, media, products, organizationId, onMediaAdded, disabled }: Props) {
  const [productSearch, setProductSearch] = useState("");
  const availableMedia = media.filter(isEligibleRetailWebsiteMedia);
  const selectedProducts = value.productIds.map((id, index) => ({
    id,
    index,
    product: products.find((product) => product.id === id),
  }));
  const remainingProducts = products.filter((product) => !value.productIds.includes(product.id));
  const normalizedSearch = productSearch.trim().toLocaleLowerCase("fa-IR");
  const filteredProducts = remainingProducts.filter((product) =>
    `${product.name} ${product.brand ?? ""} ${product.category.name}`.toLocaleLowerCase("fa-IR").includes(normalizedSearch),
  );

  const update = (patch: Partial<RetailHeroConfig>) => onChange({ ...value, ...patch });
  const moveProduct = (index: number, direction: -1 | 1) => {
    const next = [...value.productIds];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    update({ productIds: next });
  };

  const renderImagePicker = (label: string, selectedId: string, field: "desktopImageId" | "mobileImageId" | "darkDesktopImageId" | "darkMobileImageId") => <HeroImagePicker
    label={label} selectedId={selectedId} media={availableMedia} disabled={disabled} organizationId={organizationId}
    onSelect={(id) => update({ [field]: id })} onMediaAdded={onMediaAdded}
  />;

  return <section className={styles.editor} aria-labelledby="retail-hero-title" dir="rtl">
    <div className={styles.headingRow}>
      <div className={styles.headingIcon} aria-hidden="true"><Sparkles size={18} /></div>
      <div><p className={styles.eyebrow}>ویترین فروشگاه</p><h2 id="retail-hero-title">ویرایش بخش اصلی</h2></div>
      <label className={styles.switch}>
        <input type="checkbox" checked={value.enabled} disabled={disabled} onChange={(event) => update({ enabled: event.target.checked })} />
        <span>نمایش بخش</span>
      </label>
    </div>

    <fieldset className={styles.fieldset} disabled={disabled}>
      <legend className={styles.srOnly}>تنظیمات بخش اصلی فروشگاه</legend>
      <div className={styles.modePicker} role="group" aria-label="نوع محتوای بخش اصلی">
        <button type="button" aria-pressed={value.mode === "CAMPAIGN"} onClick={() => {
          if (value.mode !== "CAMPAIGN") update({ mode: "CAMPAIGN", imageFit: "cover" });
        }}>
          <strong>معرفی مجموعه</strong><span>تصویر و پیام اصلی برند</span>
        </button>
        <button type="button" aria-pressed={value.mode === "PRODUCTS"} onClick={() => {
          if (value.mode !== "PRODUCTS") update({ mode: "PRODUCTS", imageFit: "contain" });
        }}>
          <strong>محصولات منتخب</strong><span>نمایش تا سه محصول</span>
        </button>
      </div>

      <div className={styles.fields}>
        <label className={`${styles.field} ${styles.full}`}>
          <span>تیتر اصلی</span>
          <input value={value.heading} maxLength={100} onChange={(event) => update({ heading: event.target.value })} />
          <small>{value.heading.length} از ۱۰۰ نویسه</small>
        </label>
        <label className={`${styles.field} ${styles.full}`}>
          <span>توضیح کوتاه</span>
          <textarea value={value.description} maxLength={240} rows={3} onChange={(event) => update({ description: event.target.value })} />
          <small>{value.description.length} از ۲۴۰ نویسه</small>
        </label>
        {renderImagePicker("تصویر نمایشگر رومیزی", value.desktopImageId, "desktopImageId")}
        {renderImagePicker("تصویر نمایشگر موبایل (اختیاری)", value.mobileImageId, "mobileImageId")}
        {renderImagePicker("تصویر رومیزی برای تم تیره (اختیاری)", value.darkDesktopImageId, "darkDesktopImageId")}
        {renderImagePicker("تصویر موبایل برای تم تیره (اختیاری)", value.darkMobileImageId, "darkMobileImageId")}
        <label className={styles.field}>
          <span>متن جایگزین تصویر</span>
          <input value={value.imageAlt} maxLength={180} onChange={(event) => update({ imageAlt: event.target.value })} />
          <small>برای توصیف تصویر به کاربرانی که تصویر را نمی‌بینند</small>
        </label>
        <label className={styles.field}>
          <span>نحوه نمایش تصویر</span>
          <select value={value.imageFit} onChange={(event) => update({ imageFit: event.target.value as RetailHeroConfig["imageFit"] })}>
            <option value="cover">پر کردن قاب با برش تصویر</option>
            <option value="contain">نمایش کامل تصویر</option>
          </select>
        </label>
      </div>

      <div className={styles.focalPanel}>
        <div><h3>جایگاه کانون تصویر</h3><p>نقطه‌ای را تنظیم کنید که هنگام برش تصویر در مرکز قاب بماند.</p></div>
        <label className={styles.rangeField}><span>افقی <b>{value.focalX}٪</b></span><input type="range" min="0" max="100" value={value.focalX} onChange={(event) => update({ focalX: Number(event.target.value) })} /></label>
        <label className={styles.rangeField}><span>عمودی <b>{value.focalY}٪</b></span><input type="range" min="0" max="100" value={value.focalY} onChange={(event) => update({ focalY: Number(event.target.value) })} /></label>
      </div>

      {value.mode === "PRODUCTS" && <div className={styles.productPanel}>
        <div className={styles.subheading}><div><h3>محصولات منتخب</h3><p>ترتیب این فهرست، ترتیب نمایش محصولات را تعیین می‌کند.</p></div><span>{value.productIds.length} از ۳</span></div>
        {selectedProducts.length > 0 ? <ol className={styles.productList}>
          {selectedProducts.map(({ id, index, product }) => <li key={`${id}-${index}`}>
            {product ? <>
              <div className={styles.productImage}>{product.media.card ? <Image src={product.media.card} alt={product.media.alt || product.name} width={96} height={96} unoptimized /> : <ImagePlus size={20} aria-hidden="true" />}</div>
              <div className={styles.productInfo}><strong>{product.name}</strong><span>{money.format(product.price.amount)} تومان</span></div>
            </> : <div className={styles.unavailableProduct}><strong>محصول در فهرست فعلی موجود نیست</strong><span dir="ltr">شناسه: {id.slice(0, 16)}{id.length > 16 ? "…" : ""}</span></div>}
            <div className={styles.productActions}>
              <button type="button" aria-label={`انتقال ${product?.name ?? "محصول ناموجود"} به بالا`} title="انتقال به بالا" disabled={index === 0} onClick={() => moveProduct(index, -1)}><ArrowUp size={16} /></button>
              <button type="button" aria-label={`انتقال ${product?.name ?? "محصول ناموجود"} به پایین`} title="انتقال به پایین" disabled={index === selectedProducts.length - 1} onClick={() => moveProduct(index, 1)}><ArrowDown size={16} /></button>
              <button type="button" aria-label={`حذف ${product?.name ?? `محصول ${id.slice(0, 8)}`}`} title="حذف محصول" onClick={() => update({ productIds: value.productIds.filter((selectedId) => selectedId !== id) })}><Trash2 size={16} /></button>
            </div>
          </li>)}
        </ol> : <p className={styles.emptyProducts}>برای شروع، یک محصول از فهرست انتخاب کنید.</p>}
        <label className={styles.field}>
          <span>جست‌وجو در محصولات برای افزودن</span>
          <input type="search" value={productSearch} maxLength={100} placeholder="نام، برند یا دسته‌بندی محصول" onChange={(event) => setProductSearch(event.target.value)} />
        </label>
        <label className={styles.field}>
          <span>افزودن محصول</span>
          <select value="" disabled={value.productIds.length >= 3 || filteredProducts.length === 0} onChange={(event) => {
            if (event.target.value) update({ productIds: [...value.productIds, event.target.value] });
          }}>
            <option value="">{filteredProducts.length ? "انتخاب محصول" : remainingProducts.length ? "نتیجه‌ای برای جست‌وجو پیدا نشد" : "محصول دیگری در دسترس نیست"}</option>
            {filteredProducts.map((product) => <option key={product.id} value={product.id}>{product.name} · {money.format(product.price.amount)} تومان</option>)}
          </select>
        </label>
      </div>}

      <div className={styles.ctaPanel}>
        <h3>دکمه اقدام</h3>
        <div className={styles.fields}>
          <label className={styles.field}>
            <span>متن دکمه</span>
            <input value={value.ctaLabel} maxLength={40} onChange={(event) => update({ ctaLabel: event.target.value })} />
          </label>
          <label className={styles.field}>
            <span>مسیر داخلی مقصد</span>
            <input value={value.ctaHref} maxLength={500} dir="ltr" placeholder="خالی = مقصد خودکار فروشگاه" onChange={(event) => update({ ctaHref: event.target.value })} />
          </label>
        </div>
        <div className={styles.ctaHint}><span>مقصد خالی: فهرست محصولات در حالت مجموعه، یا صفحهٔ محصول فعال در حالت محصولات منتخب.</span><button type="button" onClick={() => update({ ctaHref: "" })}>استفاده از مقصد خودکار</button></div>
      </div>

      <label className={styles.autoplay}>
        <input type="checkbox" checked={value.autoplay} onChange={(event) => update({ autoplay: event.target.checked })} />
        <span><strong>حرکت خودکار اسلایدها</strong><small>به‌صورت پیش‌فرض خاموش است؛ فقط در صورت نیاز فعال کنید.</small></span>
      </label>
    </fieldset>
  </section>;
}

function HeroImagePicker({ label, selectedId, media, disabled, organizationId, onSelect, onMediaAdded }: {
  label: string; selectedId: string; media: WebsiteMedia[]; disabled: boolean; organizationId: string;
  onSelect(id: string): void; onMediaAdded(image: WebsiteMedia): void;
}) {
  const [search, setSearch] = useState("");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [retryFile, setRetryFile] = useState<File | null>(null);
  const selected = media.find((image) => image.id === selectedId);
  const filtered = useMemo(() => media.filter((image) => `${image.filename ?? ""}`.toLocaleLowerCase("fa-IR").includes(search.trim().toLocaleLowerCase("fa-IR"))), [media, search]);
  function upload(file?: File) {
    if (!file) return;
    setRetryFile(file);
    setError(""); setUploading(true); setProgress(0);
    const body = new FormData(); body.append("file", file);
    const request = new XMLHttpRequest();
    request.open("POST", `/api/organizations/${encodeURIComponent(organizationId)}/website/media`);
    request.withCredentials = true;
    request.upload.onprogress = (event) => { if (event.lengthComputable) setProgress(Math.round(event.loaded / event.total * 100)); };
    request.onload = () => {
      try {
        const result = JSON.parse(request.responseText) as { image?: WebsiteMedia; error?: string };
        if (request.status < 200 || request.status >= 300 || !result.image) throw new Error(result.error || "آپلود تصویر انجام نشد.");
        onMediaAdded(result.image); onSelect(result.image.id); setProgress(100);
      } catch (cause) { setError(cause instanceof Error ? cause.message : "آپلود تصویر انجام نشد."); }
      finally { setUploading(false); }
    };
    request.onerror = () => { setError("ارتباط با سرور قطع شد. دوباره تلاش کنید."); setUploading(false); };
    request.send(body);
  }
  return <fieldset className={`${styles.field} min-w-0`} disabled={disabled || uploading}>
    <legend className="mb-2 text-sm font-medium">{label}</legend>
    <div className="space-y-3 rounded-xl border p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <strong className="text-sm">گالری فروشگاه</strong>
        <label className="inline-flex min-h-10 cursor-pointer items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground focus-within:ring-2 focus-within:ring-ring">
          {selected ? "جایگزینی تصویر" : "آپلود تصویر جدید"}
          <input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp,image/gif" disabled={disabled || uploading} onChange={(event) => { upload(event.currentTarget.files?.[0]); event.currentTarget.value = ""; }} />
        </label>
      </div>
      <label className="block"><span className="sr-only">جست‌وجو در گالری فروشگاه</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="جست‌وجو بر اساس نام فایل" className="min-h-10 w-full rounded-md border bg-background px-3 text-sm" /></label>
      {uploading && <div role="status" aria-live="polite" className="space-y-1 text-xs"><span>در حال آپلود تصویر… {progress}%</span><progress className="block h-2 w-full" max={100} value={progress} /></div>}
      {error && <div className="flex flex-wrap items-center gap-2 text-sm text-destructive"><p role="alert">{error}</p><button type="button" disabled={!retryFile || uploading} className="rounded border px-2 py-1" onClick={() => retryFile && upload(retryFile)}>تلاش دوباره</button></div>}
      {selected ? <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-2">
        <Image src={selected.url} alt={selected.alt || selected.filename || "پیش‌نمایش تصویر"} width={120} height={88} unoptimized className="h-20 w-28 rounded object-contain" />
        <div className="min-w-0 flex-1"><strong className="block truncate text-sm">{selected.filename}</strong><span className="text-xs text-muted-foreground">پیش‌نمایش · {selected.mimeType || "نوع نامشخص"}{selected.sizeBytes ? ` · ${(selected.sizeBytes / 1024).toFixed(0)} KB` : ""}</span></div>
        <button type="button" className="rounded border px-2 py-1 text-xs" onClick={() => onSelect("")}>حذف انتخاب</button>
      </div> : <p className="rounded border border-dashed p-3 text-center text-sm text-muted-foreground">هیچ تصویری انتخاب نشده است</p>}
      {media.length === 0 ? <p className="rounded border border-dashed p-4 text-center text-sm text-muted-foreground">گالری فروشگاه خالی است. تصویری آپلود کنید تا در گالری این سازمان ذخیره شود.</p> : filtered.length ? <div className="grid max-h-56 grid-cols-3 gap-2 overflow-auto sm:grid-cols-4">{filtered.map((image) => <button key={image.id} type="button" aria-pressed={selectedId === image.id} onClick={() => onSelect(image.id)} className={`min-w-0 rounded-md border p-1 text-start focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring ${selectedId === image.id ? "border-primary ring-2 ring-primary" : "hover:border-primary"}`}><Image src={image.url} alt="" width={160} height={120} unoptimized className="aspect-[4/3] w-full rounded object-cover" /><span className="block truncate px-1 py-1 text-xs" title={image.filename ?? ""}>{image.filename}</span><span className="block px-1 pb-1 text-[11px] text-primary">{selectedId === image.id ? "انتخاب‌شده" : "انتخاب تصویر"}</span></button>)}</div> : <p className="text-center text-sm text-muted-foreground">نتیجه‌ای پیدا نشد.</p>}
    </div>
  </fieldset>;
}
