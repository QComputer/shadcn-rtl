"use client";

import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { FolderPlus, PackagePlus, RefreshCw, Tags, Search } from "lucide-react";
import { CategoryImageField } from "./category-image-field";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Locale = "fa" | "en" | "ar";
type Category = { id: string; name: string; slug: string | null; description: string | null; image?: string | null; darkImage?: string | null; isActive: boolean; sortOrder: number };
type Definition = { id: string; key: string; label: string; scope: "PRODUCT" | "VARIANT_OPTION"; valueType: "TEXT" | "NUMBER" | "BOOLEAN" | "ENUM"; displayUnit: string | null; allowedValues: unknown; isFilterable: boolean };
type Product = { id: string; name: string; brand?: string | null; slug: string | null; isActive: boolean; category: { name: string; isActive: boolean }; variants: Array<{ id: string; sku: string | null; price: number | null; inventory: number }> };

const copy = {
  fa: {
    title: "کاتالوگ فروشگاه", name: "نام محصول", intro: "محصولات، ویژگی‌ها و دسته‌بندی‌های فروشگاه را مدیریت کنید.", bulkImport: "ورود و خروج گروهی",
    addProduct: "افزودن محصول", reload: "بارگذاری دوباره", published: "منتشرشده", draft: "پیش‌نویس", category: "دسته‌بندی",
    variants: "گونه‌های خرید", price: "کمترین قیمت", status: "وضعیت", actions: "مدیریت", edit: "ویرایش و پیش‌نمایش", empty: "هنوز محصولی ثبت نشده است.", search: "جست‌وجوی نام یا برند", all: "همه وضعیت‌ها", clear: "پاک‌کردن فیلتر", retry: "تلاش دوباره", stock: "موجودی کل", noMatches: "محصولی با این جست‌وجو پیدا نشد.", page: "صفحه", of: "از",
    categories: "دسته‌بندی‌ها", categoryName: "نام دسته‌بندی", categoryDescription: "توضیحات (اختیاری)", addCategory: "ثبت دسته‌بندی", active: "فعال", inactive: "غیرفعال", deactivate: "غیرفعال‌کردن", activate: "فعال‌کردن",
    editCategory: "ویرایش", save: "ذخیره تغییرات", cancel: "انصراف",
    attributes: "ویژگی‌های قابل‌تنظیم", key: "کلید (لاتین)", label: "نام نمایشی", scope: "کاربرد", productAttribute: "ویژگی محصول", variantOption: "گزینه گونه خرید", valueType: "نوع مقدار", text: "متن", number: "عدد", boolean: "بله/خیر", enum: "فهرست انتخابی", unit: "واحد نمایش", allowed: "گزینه‌ها با ویرگول جدا شوند", filterable: "در فیلترها نمایش داده شود", addAttribute: "ثبت ویژگی", error: "ذخیره انجام نشد. ورودی‌ها را بررسی و دوباره تلاش کنید.", loading: "در حال بارگذاری…",
  },
  en: {
    title: "Retail catalog", name: "Product name", intro: "Manage this store’s products, attributes, and categories.", bulkImport: "Bulk import and export",
    addProduct: "Add product", reload: "Reload", published: "Published", draft: "Draft", category: "Category",
    variants: "Variants", price: "Lowest price", status: "Status", actions: "Manage", edit: "Edit and preview", empty: "No products yet.", search: "Search name or brand", all: "All statuses", clear: "Clear filters", retry: "Try again", stock: "Total stock", noMatches: "No products match these filters.", page: "Page", of: "of",
    categories: "Categories", categoryName: "Category name", categoryDescription: "Description (optional)", addCategory: "Add category", active: "Active", inactive: "Inactive", deactivate: "Deactivate", activate: "Activate",
    editCategory: "Edit", save: "Save changes", cancel: "Cancel",
    attributes: "Configurable attributes", key: "Key (Latin)", label: "Display label", scope: "Usage", productAttribute: "Product attribute", variantOption: "Variant option", valueType: "Value type", text: "Text", number: "Number", boolean: "Yes/no", enum: "Choice list", unit: "Display unit", allowed: "Choices separated by commas", filterable: "Show in filters", addAttribute: "Add attribute", error: "Could not save. Check the fields and try again.", loading: "Loading…",
  },
  ar: {
    title: "كتالوج المتجر", name: "اسم المنتج", intro: "إدارة منتجات المتجر وسماته وفئاته.", bulkImport: "استيراد وتصدير جماعي",
    addProduct: "إضافة منتج", reload: "إعادة التحميل", published: "منشور", draft: "مسودة", category: "الفئة",
    variants: "الخيارات", price: "أقل سعر", status: "الحالة", actions: "الإدارة", edit: "تعديل ومعاينة", empty: "لا توجد منتجات بعد.", search: "البحث بالاسم أو العلامة التجارية", all: "كل الحالات", clear: "مسح عوامل التصفية", retry: "أعد المحاولة", stock: "إجمالي المخزون", noMatches: "لا توجد منتجات تطابق عوامل التصفية.", page: "الصفحة", of: "من",
    categories: "الفئات", categoryName: "اسم الفئة", categoryDescription: "الوصف (اختياري)", addCategory: "إضافة فئة", active: "نشطة", inactive: "غير نشطة", deactivate: "تعطيل", activate: "تفعيل",
    editCategory: "تعديل", save: "حفظ التغييرات", cancel: "إلغاء",
    attributes: "السمات القابلة للضبط", key: "المفتاح (لاتيني)", label: "الاسم المعروض", scope: "الاستخدام", productAttribute: "سمة المنتج", variantOption: "خيار المنتج", valueType: "نوع القيمة", text: "نص", number: "رقم", boolean: "نعم/لا", enum: "قائمة اختيار", unit: "وحدة العرض", allowed: "افصل الخيارات بفواصل", filterable: "إظهار في عوامل التصفية", addAttribute: "إضافة سمة", error: "تعذر الحفظ. تحقق من الحقول وحاول مرة أخرى.", loading: "جارٍ التحميل…",
  },
} as const;

export function RetailCatalogManager({ locale }: { locale: Locale }) {
  const t = copy[locale];
  const rtl = locale === "fa" || locale === "ar";
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [definitions, setDefinitions] = useState<Definition[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [stateFilter, setStateFilter] = useState<"all" | "published" | "draft">("all");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 25, total: 0, totalPages: 1 });
  const [categoryName, setCategoryName] = useState("");
  const [categoryDescription, setCategoryDescription] = useState("");
  const [categoryImage, setCategoryImage] = useState<string | null | undefined>(undefined);
  const [categoryImageUrl, setCategoryImageUrl] = useState<string | null>(null);
  const [categoryImageUploading, setCategoryImageUploading] = useState(false);
  const [categoryDarkImage, setCategoryDarkImage] = useState<string | null | undefined>(undefined);
  const [categoryDarkImageUrl, setCategoryDarkImageUrl] = useState<string | null>(null);
  const [categoryDarkUploading, setCategoryDarkUploading] = useState(false);
  const [editDarkImage, setEditDarkImage] = useState<string | null | undefined>(undefined);
  const [editDarkImageUrl, setEditDarkImageUrl] = useState<string | null>(null);
  const [editDarkUploading, setEditDarkUploading] = useState(false);
  const [categoryCreating, setCategoryCreating] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editImage, setEditImage] = useState<string | null | undefined>(undefined);
  const [editImageUrl, setEditImageUrl] = useState<string | null>(null);
  const [editImageUploading, setEditImageUploading] = useState(false);
  const [categorySaving, setCategorySaving] = useState(false);
  const [key, setKey] = useState("");
  const [label, setLabel] = useState("");
  const [scope, setScope] = useState<"PRODUCT" | "VARIANT_OPTION">("PRODUCT");
  const [valueType, setValueType] = useState<"TEXT" | "NUMBER" | "BOOLEAN" | "ENUM">("TEXT");
  const [unit, setUnit] = useState("");
  const [allowed, setAllowed] = useState("");
  const [filterable, setFilterable] = useState(true);
  const loadSequence = useRef(0);

  const load = useCallback(async () => {
    const sequence = ++loadSequence.current;
    setBusy(true);
    setError("");
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: "25", state: stateFilter });
      if (query.trim()) params.set("query", query.trim());
      const [productResponse, categoryResponse, definitionResponse] = await Promise.all([
        fetch(`/api/dashboard/retail/catalog?${params}`, { credentials: "same-origin" }),
        fetch("/api/dashboard/retail/categories", { credentials: "same-origin" }),
        fetch("/api/dashboard/retail/attributes", { credentials: "same-origin" }),
      ]);
      const [productData, categoryData, definitionData] = await Promise.all([productResponse.json(), categoryResponse.json(), definitionResponse.json()]);
      if (sequence !== loadSequence.current) return;
      if (!productResponse.ok || !categoryResponse.ok || !definitionResponse.ok) throw new Error("catalog-load-failed");
      setProducts(productData.products ?? []);
      setPagination(productData.pagination ?? { page, pageSize: 25, total: 0, totalPages: 1 });
      setCategories(categoryData.categories ?? []);
      setDefinitions(definitionData.definitions ?? []);
    } catch {
      if (sequence === loadSequence.current) setError(t.error);
    } finally {
      if (sequence === loadSequence.current) setBusy(false);
    }
  }, [page, query, stateFilter, t.error]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 220);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function submitCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (categoryImageUploading || categoryDarkUploading || categoryCreating) return;
    setCategoryCreating(true);
    setError("");
    try {
      const body: { name: string; description?: string; sortOrder: number; imageId?: string | null; darkImageId?: string | null } = { name: categoryName, description: categoryDescription || undefined, sortOrder: categories.length };
      if (categoryImage !== undefined) body.imageId = categoryImage;
      if (categoryDarkImage !== undefined) body.darkImageId = categoryDarkImage;
      const response = await fetch("/api/dashboard/retail/categories", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      if (!response.ok) throw new Error("category-save-failed");
      setCategoryName(""); setCategoryDescription(""); setCategoryImage(undefined); setCategoryImageUrl(null); setCategoryDarkImage(undefined); setCategoryDarkImageUrl(null); await load();
    } catch { setError(t.error); }
    finally { setCategoryCreating(false); }
  }

  function openCategoryEditor(category: Category) {
    setError("");
    setEditingCategory(category);
    setEditName(category.name);
    setEditDescription(category.description ?? "");
    setEditImage(undefined);
    setEditImageUrl(category.image ?? null);
    setEditDarkImage(undefined);
    setEditDarkImageUrl(category.darkImage ?? null);
  }

  async function saveCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingCategory || categorySaving || editImageUploading || editDarkUploading) return;
    setCategorySaving(true);
    setError("");
    try {
      const body: { name: string; description: string; imageId?: string | null; darkImageId?: string | null } = { name: editName, description: editDescription };
      if (editImage !== undefined) body.imageId = editImage;
      if (editDarkImage !== undefined) body.darkImageId = editDarkImage;
      const response = await fetch(`/api/dashboard/retail/categories/${editingCategory.id}`, { method: "PATCH", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      if (!response.ok) throw new Error("category-save-failed");
      setEditingCategory(null);
      await load();
    } catch { setError(t.error); }
    finally { setCategorySaving(false); }
  }

  async function toggleCategory(category: Category) {
    try {
      const response = await fetch(`/api/dashboard/retail/categories/${category.id}`, { method: "PATCH", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify({ isActive: !category.isActive }) });
      if (!response.ok) throw new Error("category-toggle-failed");
      await load();
    } catch { setError(t.error); }
  }

  async function submitDefinition(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    try {
      const response = await fetch("/api/dashboard/retail/attributes", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify({ key, label, scope, valueType, displayUnit: unit || null, allowedValues: valueType === "ENUM" ? allowed.split(",").map((value) => value.trim()).filter(Boolean) : null, isFilterable: filterable }) });
      if (!response.ok) throw new Error("attribute-save-failed");
      setKey(""); setLabel(""); setUnit(""); setAllowed(""); await load();
    } catch { setError(t.error); }
  }

  return (
    <main className="space-y-6 p-4 lg:p-6" dir={rtl ? "rtl" : "ltr"} lang={locale}>
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div><h1 className="text-2xl font-bold tracking-tight">{t.title}</h1><p className="mt-1 text-sm text-muted-foreground">{t.intro}</p></div>
        <div className="flex flex-wrap gap-2">
          <Link className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted" href={`/${locale}/dashboard/imports#retail-bulk`}>{t.bulkImport}</Link>
          <button className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted" type="button" onClick={() => void load()} aria-label={t.reload}><RefreshCw className="me-2 inline size-4" />{t.reload}</button>
          <Link className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90" href={`/${locale}/dashboard/retail-catalog/new`}><PackagePlus className="me-2 inline size-4" />{t.addProduct}</Link>
        </div>
      </header>
      {error && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"><span>{error}</span><button type="button" onClick={() => void load()} className="rounded-md border border-destructive/30 px-3 py-1.5 font-medium hover:bg-destructive/10">{t.retry}</button></div>}
      <section className="overflow-hidden rounded-xl border bg-card">
        <div className="flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between"><h2 className="font-semibold">{t.title}</h2><div className="flex flex-col gap-2 sm:flex-row"><label className="relative"><Search className="pointer-events-none absolute start-3 top-2.5 size-4 text-muted-foreground" /><input maxLength={100} value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder={t.search} className="w-full rounded-lg border bg-background py-2 ps-9 pe-3 text-sm sm:w-64" /></label><select aria-label={t.status} value={stateFilter} onChange={(event) => { setStateFilter(event.target.value as typeof stateFilter); setPage(1); }} className="rounded-lg border bg-background px-3 py-2 text-sm"><option value="all">{t.all}</option><option value="published">{t.published}</option><option value="draft">{t.draft}</option></select>{(query || stateFilter !== "all") && <button type="button" onClick={() => { setQuery(""); setStateFilter("all"); setPage(1); }} className="rounded-lg border px-3 py-2 text-sm">{t.clear}</button>}</div></div>
        {busy ? <p role="status" className="p-6 text-sm text-muted-foreground">{t.loading}</p> : products.length === 0 ? <p className="p-6 text-sm text-muted-foreground">{pagination.total === 0 && !query.trim() && stateFilter === "all" ? t.empty : t.noMatches}</p> : (
          <>
          <div className="space-y-3 p-3 md:hidden">{products.map((product) => <article key={product.id} className="space-y-3 rounded-xl border p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="truncate font-semibold">{product.name}</h3>{product.brand && <p className="text-sm text-muted-foreground">{product.brand}</p>}</div><span className={`shrink-0 rounded-full px-2.5 py-1 text-xs ${product.isActive ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200" : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"}`}>{product.isActive ? t.published : t.draft}</span></div><dl className="grid grid-cols-2 gap-3 text-sm"><div><dt className="text-xs text-muted-foreground">{t.category}</dt><dd>{product.category.name}</dd></div><div><dt className="text-xs text-muted-foreground">{t.variants}</dt><dd>{product.variants.length}</dd></div><div><dt className="text-xs text-muted-foreground">{t.price}</dt><dd>{product.variants.map((variant) => variant.price).filter((price): price is number => price !== null).sort((a, b) => a - b)[0]?.toLocaleString(locale) ?? "—"}</dd></div><div><dt className="text-xs text-muted-foreground">{t.stock}</dt><dd>{product.variants.reduce((sum, variant) => sum + variant.inventory, 0).toLocaleString(locale)}</dd></div></dl><Link className="block rounded-lg bg-primary px-4 py-2.5 text-center text-sm font-semibold text-primary-foreground" href={`/${locale}/dashboard/retail-catalog/${product.id}`}>{t.edit}</Link></article>)}</div>
          <div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[640px] text-start text-sm">
            <thead className="bg-muted/50 text-muted-foreground"><tr>{["name", "category", "variants", "price", "status", "actions"].map((head) => <th key={head} className="px-4 py-3 text-start font-medium">{t[head as keyof typeof t]}</th>)}</tr></thead>
            <tbody className="divide-y">{products.map((product) => <tr key={product.id}>
              <td className="px-4 py-3 font-medium">{product.name}</td><td className="px-4 py-3">{product.category.name}</td>
              <td className="px-4 py-3">{product.variants.length}</td>
              <td className="px-4 py-3">{product.variants.map((variant) => variant.price).filter((price): price is number => price !== null).sort((a, b) => a - b)[0]?.toLocaleString(locale) ?? "—"}</td>
              <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs ${product.isActive ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200" : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"}`}>{product.isActive ? t.published : t.draft}</span></td>
              <td className="px-4 py-3"><Link className="font-medium text-primary underline-offset-4 hover:underline" href={`/${locale}/dashboard/retail-catalog/${product.id}`}>{t.edit}</Link></td>
            </tr>)}</tbody>
          </table></div>
          {pagination.totalPages > 1 && <nav aria-label={t.title} className="flex items-center justify-center gap-3 border-t p-3 text-sm"><button type="button" disabled={page <= 1 || busy} onClick={() => setPage((current) => Math.max(1, current - 1))} className="rounded-md border px-3 py-1.5 disabled:opacity-50">{locale === "fa" ? "قبلی" : locale === "ar" ? "السابق" : "Previous"}</button><span aria-live="polite">{t.page} {pagination.page.toLocaleString(locale)} {t.of} {pagination.totalPages.toLocaleString(locale)} · {pagination.total.toLocaleString(locale)}</span><button type="button" disabled={page >= pagination.totalPages || busy} onClick={() => setPage((current) => Math.min(pagination.totalPages, current + 1))} className="rounded-md border px-3 py-1.5 disabled:opacity-50">{locale === "fa" ? "بعدی" : locale === "ar" ? "التالي" : "Next"}</button></nav>}
          </>
        )}
      </section>
      <div className="grid gap-6 xl:grid-cols-2">
        <section className="space-y-4 rounded-xl border bg-card p-4">
          <h2 className="flex items-center gap-2 font-semibold"><FolderPlus className="size-4" />{t.categories}</h2>
          <form className="grid gap-3 sm:grid-cols-2" onSubmit={submitCategory}>
            <input aria-label={t.categoryName} required minLength={2} maxLength={200} className="rounded-lg border bg-background px-3 py-2 text-sm" placeholder={t.categoryName} value={categoryName} onChange={(event) => setCategoryName(event.target.value)} />
            <input aria-label={t.categoryDescription} maxLength={5000} className="rounded-lg border bg-background px-3 py-2 text-sm" placeholder={t.categoryDescription} value={categoryDescription} onChange={(event) => setCategoryDescription(event.target.value)} />
            <CategoryImageField title={locale === "fa" ? "تصویر تم روشن" : locale === "ar" ? "صورة الوضع الفاتح" : "Light theme image"} locale={locale} imageId={categoryImage} imageUrl={categoryImageUrl} disabled={categoryCreating} onChange={(id, url) => { setCategoryImage(id); setCategoryImageUrl(url); }} onUploadingChange={setCategoryImageUploading} />
            <CategoryImageField title={locale === "fa" ? "تصویر تم تاریک" : locale === "ar" ? "صورة الوضع الداكن" : "Dark theme image"} locale={locale} imageId={categoryDarkImage} imageUrl={categoryDarkImageUrl} disabled={categoryCreating} onChange={(id, url) => { setCategoryDarkImage(id); setCategoryDarkImageUrl(url); }} onUploadingChange={setCategoryDarkUploading} />
            <button disabled={categoryImageUploading || categoryDarkUploading || categoryCreating} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50 sm:col-span-2" type="submit">{categoryCreating ? t.loading : t.addCategory}</button>
          </form>
          <ul className="divide-y">{categories.map((category) => <li key={category.id} className="flex items-center justify-between gap-3 py-2 text-sm"><span className="flex min-w-0 items-center gap-2">{category.image && <Image src={category.image} alt="" width={40} height={40} unoptimized className="size-10 rounded object-cover" />}<span>{category.name}<span className="ms-2 text-xs text-muted-foreground">{category.isActive ? t.active : t.inactive}</span></span></span><span className="flex shrink-0 gap-2"><button className="rounded border px-3 py-1.5 text-xs hover:bg-muted" type="button" onClick={() => openCategoryEditor(category)}>{t.editCategory}</button><button className="rounded border px-3 py-1.5 text-xs hover:bg-muted" type="button" onClick={() => void toggleCategory(category)}>{category.isActive ? t.deactivate : t.activate}</button></span></li>)}</ul>
        </section>
        <section className="space-y-4 rounded-xl border bg-card p-4">
          <h2 className="flex items-center gap-2 font-semibold"><Tags className="size-4" />{t.attributes}</h2>
          <form className="grid gap-3 sm:grid-cols-2" onSubmit={submitDefinition}>
            <input required pattern="[A-Za-z0-9._-]+" maxLength={80} className="rounded-lg border bg-background px-3 py-2 text-sm" placeholder={t.key} value={key} onChange={(event) => setKey(event.target.value)} />
            <input required maxLength={120} className="rounded-lg border bg-background px-3 py-2 text-sm" placeholder={t.label} value={label} onChange={(event) => setLabel(event.target.value)} />
            <select className="rounded-lg border bg-background px-3 py-2 text-sm" value={scope} onChange={(event) => setScope(event.target.value as typeof scope)} aria-label={t.scope}><option value="PRODUCT">{t.productAttribute}</option><option value="VARIANT_OPTION">{t.variantOption}</option></select>
            <select className="rounded-lg border bg-background px-3 py-2 text-sm" value={valueType} onChange={(event) => setValueType(event.target.value as typeof valueType)} aria-label={t.valueType}><option value="TEXT">{t.text}</option><option value="NUMBER">{t.number}</option><option value="BOOLEAN">{t.boolean}</option><option value="ENUM">{t.enum}</option></select>
            <input maxLength={24} className="rounded-lg border bg-background px-3 py-2 text-sm" placeholder={t.unit} value={unit} onChange={(event) => setUnit(event.target.value)} />
            {valueType === "ENUM" && <input required maxLength={1000} className="rounded-lg border bg-background px-3 py-2 text-sm" placeholder={t.allowed} value={allowed} onChange={(event) => setAllowed(event.target.value)} />}
            <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={filterable} onChange={(event) => setFilterable(event.target.checked)} />{t.filterable}</label>
            <button className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground sm:col-span-2" type="submit">{t.addAttribute}</button>
          </form>
          <ul className="divide-y">{definitions.map((definition) => <li key={definition.id} className="py-2 text-sm"><span className="font-medium">{definition.label}</span><span className="ms-2 text-xs text-muted-foreground">{definition.key} · {definition.scope === "PRODUCT" ? t.productAttribute : t.variantOption}</span></li>)}</ul>
        </section>
      </div>
      <Dialog open={!!editingCategory} onOpenChange={(open) => { if (!open && !categorySaving && !editImageUploading && !editDarkUploading) setEditingCategory(null); }}>
        <DialogContent dir={rtl ? "rtl" : "ltr"} lang={locale} className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader><DialogTitle>{t.editCategory}</DialogTitle><DialogDescription>{editingCategory?.name}</DialogDescription></DialogHeader>
          <form id="edit-retail-category" className="grid gap-3" onSubmit={saveCategory}>
            {error && <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
            <input aria-label={t.categoryName} required minLength={2} maxLength={200} className="rounded-lg border bg-background px-3 py-2 text-sm" placeholder={t.categoryName} value={editName} onChange={(event) => setEditName(event.target.value)} />
            <input aria-label={t.categoryDescription} maxLength={5000} className="rounded-lg border bg-background px-3 py-2 text-sm" placeholder={t.categoryDescription} value={editDescription} onChange={(event) => setEditDescription(event.target.value)} />
            <CategoryImageField key={editingCategory?.id} title={locale === "fa" ? "تصویر تم روشن" : locale === "ar" ? "صورة الوضع الفاتح" : "Light theme image"} locale={locale} imageId={editImage} imageUrl={editImageUrl} disabled={categorySaving || editImageUploading || editDarkUploading} onChange={(id, url) => { setEditImage(id); setEditImageUrl(url); }} onUploadingChange={setEditImageUploading} />
            <CategoryImageField key={`${editingCategory?.id}-dark`} title={locale === "fa" ? "تصویر تم تاریک" : locale === "ar" ? "صورة الوضع الداكن" : "Dark theme image"} locale={locale} imageId={editDarkImage} imageUrl={editDarkImageUrl} disabled={categorySaving || editImageUploading || editDarkUploading} onChange={(id, url) => { setEditDarkImage(id); setEditDarkImageUrl(url); }} onUploadingChange={setEditDarkUploading} />
          </form>
          <DialogFooter><button type="button" disabled={categorySaving || editImageUploading || editDarkUploading} onClick={() => setEditingCategory(null)} className="rounded-lg border px-4 py-2 text-sm">{t.cancel}</button><button form="edit-retail-category" disabled={categorySaving || editImageUploading || editDarkUploading} type="submit" className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">{categorySaving ? t.loading : t.save}</button></DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
