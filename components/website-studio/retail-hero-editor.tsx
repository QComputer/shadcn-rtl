"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { ArrowDown, ArrowUp, ImagePlus, LoaderCircle, Sparkles, Trash2, Upload } from "lucide-react";
import { isEligibleRetailWebsiteMedia, type WebsiteMedia } from "@/lib/website-studio/retail-contract";
import type { PublicCatalogProduct } from "@/lib/public-catalog/contracts";
import type { RetailHeroConfig } from "@/lib/website-studio/retail-hero-contract";
import styles from "./retail-hero-editor.module.css";

type Props = {
  value: RetailHeroConfig;
  onChange: (hero: RetailHeroConfig) => void;
  media: WebsiteMedia[];
  products: PublicCatalogProduct[];
  disabled: boolean;
  onUpload: (file: File, field: "desktopImageId" | "mobileImageId" | "darkDesktopImageId" | "darkMobileImageId") => Promise<void>;
};

const money = new Intl.NumberFormat("fa-IR");

export function RetailHeroEditor({ value, onChange, media, products, disabled, onUpload }: Props) {
  const [productSearch, setProductSearch] = useState("");
  const [uploading, setUploading] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState("");
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});
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

  const renderImagePicker = (label: string, selectedId: string, field: "desktopImageId" | "mobileImageId" | "darkDesktopImageId" | "darkMobileImageId") => {
    const selected = availableMedia.find((item) => item.id === selectedId);
    return <div className={styles.field}>
      <span>{label}</span>
      <select aria-label={label} value={selectedId} disabled={disabled || Boolean(uploading)} onChange={(event) => update({ [field]: event.target.value })}>
        <option value="">انتخاب از تصاویر سازمان</option>
        {availableMedia.map((item) => <option key={item.id} value={item.id}>{item.alt || item.filename || "تصویر فروشگاه"}</option>)}
      </select>
      {selected ? <div className={styles.imagePreview}>
        <Image src={selected.url} alt={selected.alt || selected.filename || `پیش‌نمایش ${label}`} width={720} height={420} unoptimized />
        <span>{selected.filename || "تصویر انتخاب‌شده"}</span>
      </div> : <span className={styles.hint}>برای این حالت تصویری انتخاب نشده است.</span>}
      <div className={styles.imageActions}>
        <input ref={(node) => { fileInputs.current[field] = node; }} type="file" accept="image/jpeg,image/png,image/webp" hidden disabled={disabled || Boolean(uploading)} aria-label={`بارگذاری ${label}`} onChange={async (event) => {
          const file = event.target.files?.[0]; event.target.value = ""; if (!file) return;
          if (!/[.](jpe?g|png|webp)$/i.test(file.name) || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) { setUploadError("فقط فایل JPEG، PNG یا WebP انتخاب کنید."); return; }
          if (file.size > 5 * 1024 * 1024) { setUploadError("حجم تصویر باید حداکثر ۵ مگابایت باشد."); return; }
          setUploading(field); setUploadError("");
          try { await onUpload(file, field); } catch (cause) { setUploadError(cause instanceof Error ? cause.message : "بارگذاری تصویر انجام نشد."); } finally { setUploading(null); }
        }} />
        <button type="button" disabled={disabled || Boolean(uploading)} onClick={() => fileInputs.current[field]?.click()}>{uploading === field ? <LoaderCircle className={styles.spinner} size={15} /> : <Upload size={15} />} بارگذاری تصویر</button>
        {selected && <button type="button" disabled={disabled || Boolean(uploading)} onClick={() => update({ [field]: "" })}><Trash2 size={15} /> پاک‌کردن</button>}
      </div>
      {uploading === field && <span role="status" className={styles.hint}>تصویر در حال بارگذاری است…</span>}
      {uploadError && <span role="alert" className={styles.uploadError}>{uploadError}</span>}
    </div>;
  };

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
