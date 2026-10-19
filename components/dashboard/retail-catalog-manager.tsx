"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { FolderPlus, PackagePlus, RefreshCw, Tags } from "lucide-react";

type Locale = "fa" | "en" | "ar";
type Category = { id: string; name: string; slug: string | null; description: string | null; isActive: boolean; sortOrder: number };
type Definition = { id: string; key: string; label: string; scope: "PRODUCT" | "VARIANT_OPTION"; valueType: "TEXT" | "NUMBER" | "BOOLEAN" | "ENUM"; displayUnit: string | null; allowedValues: unknown; isFilterable: boolean };
type Product = { id: string; name: string; slug: string | null; isActive: boolean; category: { name: string; isActive: boolean }; variants: Array<{ id: string; sku: string | null; price: number | null; inventory: number }> };

const copy = {
  fa: {
    title: "کاتالوگ فروشگاه", intro: "محصولات، ویژگی‌ها و دسته‌بندی‌های فروشگاه را مدیریت کنید.",
    addProduct: "افزودن محصول", reload: "بارگذاری دوباره", published: "منتشرشده", draft: "پیش‌نویس", category: "دسته‌بندی",
    variants: "گونه‌های خرید", price: "کمترین قیمت", status: "وضعیت", actions: "مدیریت", edit: "ویرایش و پیش‌نمایش", empty: "هنوز محصولی ثبت نشده است.",
    categories: "دسته‌بندی‌ها", categoryName: "نام دسته‌بندی", categoryDescription: "توضیحات (اختیاری)", addCategory: "ثبت دسته‌بندی", active: "فعال", inactive: "غیرفعال", deactivate: "غیرفعال‌کردن", activate: "فعال‌کردن",
    attributes: "ویژگی‌های قابل‌تنظیم", key: "کلید (لاتین)", label: "نام نمایشی", scope: "کاربرد", productAttribute: "ویژگی محصول", variantOption: "گزینه گونه خرید", valueType: "نوع مقدار", text: "متن", number: "عدد", boolean: "بله/خیر", enum: "فهرست انتخابی", unit: "واحد نمایش", allowed: "گزینه‌ها با ویرگول جدا شوند", filterable: "در فیلترها نمایش داده شود", addAttribute: "ثبت ویژگی", error: "ذخیره انجام نشد. ورودی‌ها را بررسی و دوباره تلاش کنید.", loading: "در حال بارگذاری…",
  },
  en: {
    title: "Retail catalog", intro: "Manage this store’s products, attributes, and categories.",
    addProduct: "Add product", reload: "Reload", published: "Published", draft: "Draft", category: "Category",
    variants: "Variants", price: "Lowest price", status: "Status", actions: "Manage", edit: "Edit and preview", empty: "No products yet.",
    categories: "Categories", categoryName: "Category name", categoryDescription: "Description (optional)", addCategory: "Add category", active: "Active", inactive: "Inactive", deactivate: "Deactivate", activate: "Activate",
    attributes: "Configurable attributes", key: "Key (Latin)", label: "Display label", scope: "Usage", productAttribute: "Product attribute", variantOption: "Variant option", valueType: "Value type", text: "Text", number: "Number", boolean: "Yes/no", enum: "Choice list", unit: "Display unit", allowed: "Choices separated by commas", filterable: "Show in filters", addAttribute: "Add attribute", error: "Could not save. Check the fields and try again.", loading: "Loading…",
  },
  ar: {
    title: "كتالوج المتجر", intro: "إدارة منتجات المتجر وسماته وفئاته.",
    addProduct: "إضافة منتج", reload: "إعادة التحميل", published: "منشور", draft: "مسودة", category: "الفئة",
    variants: "الخيارات", price: "أقل سعر", status: "الحالة", actions: "الإدارة", edit: "تعديل ومعاينة", empty: "لا توجد منتجات بعد.",
    categories: "الفئات", categoryName: "اسم الفئة", categoryDescription: "الوصف (اختياري)", addCategory: "إضافة فئة", active: "نشطة", inactive: "غير نشطة", deactivate: "تعطيل", activate: "تفعيل",
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
  const [categoryName, setCategoryName] = useState("");
  const [categoryDescription, setCategoryDescription] = useState("");
  const [key, setKey] = useState("");
  const [label, setLabel] = useState("");
  const [scope, setScope] = useState<"PRODUCT" | "VARIANT_OPTION">("PRODUCT");
  const [valueType, setValueType] = useState<"TEXT" | "NUMBER" | "BOOLEAN" | "ENUM">("TEXT");
  const [unit, setUnit] = useState("");
  const [allowed, setAllowed] = useState("");
  const [filterable, setFilterable] = useState(true);

  const load = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const [productResponse, categoryResponse, definitionResponse] = await Promise.all([
        fetch("/api/dashboard/retail/catalog?page=1&pageSize=100", { credentials: "same-origin" }),
        fetch("/api/dashboard/retail/categories", { credentials: "same-origin" }),
        fetch("/api/dashboard/retail/attributes", { credentials: "same-origin" }),
      ]);
      const [productData, categoryData, definitionData] = await Promise.all([productResponse.json(), categoryResponse.json(), definitionResponse.json()]);
      if (!productResponse.ok || !categoryResponse.ok || !definitionResponse.ok) throw new Error("catalog-load-failed");
      setProducts(productData.products ?? []);
      setCategories(categoryData.categories ?? []);
      setDefinitions(definitionData.definitions ?? []);
    } catch {
      setError(t.error);
    } finally {
      setBusy(false);
    }
  }, [t.error]);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => { if (active) void load(); });
    return () => { active = false; };
  }, [load]);

  async function submitCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    try {
      const response = await fetch("/api/dashboard/retail/categories", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: categoryName, description: categoryDescription || undefined, sortOrder: categories.length }) });
      if (!response.ok) throw new Error("category-save-failed");
      setCategoryName(""); setCategoryDescription(""); await load();
    } catch { setError(t.error); }
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
          <button className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted" type="button" onClick={() => void load()} aria-label={t.reload}><RefreshCw className="me-2 inline size-4" />{t.reload}</button>
          <Link className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90" href={`/${locale}/dashboard/retail-catalog/new`}><PackagePlus className="me-2 inline size-4" />{t.addProduct}</Link>
        </div>
      </header>
      {error && <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
      <section className="overflow-hidden rounded-xl border bg-card">
        <div className="border-b px-4 py-3"><h2 className="font-semibold">{t.title}</h2></div>
        {busy ? <p className="p-6 text-sm text-muted-foreground">{t.loading}</p> : products.length === 0 ? <p className="p-6 text-sm text-muted-foreground">{t.empty}</p> : (
          <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-start text-sm">
            <thead className="bg-muted/50 text-muted-foreground"><tr>{["name", "category", "variants", "price", "status", "actions"].map((head) => <th key={head} className="px-4 py-3 text-start font-medium">{t[head as keyof typeof t]}</th>)}</tr></thead>
            <tbody className="divide-y">{products.map((product) => <tr key={product.id}>
              <td className="px-4 py-3 font-medium">{product.name}</td><td className="px-4 py-3">{product.category.name}</td>
              <td className="px-4 py-3">{product.variants.length}</td>
              <td className="px-4 py-3">{product.variants.map((variant) => variant.price).filter((price): price is number => price !== null).sort((a, b) => a - b)[0]?.toLocaleString(locale) ?? "—"}</td>
              <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs ${product.isActive ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200" : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"}`}>{product.isActive ? t.published : t.draft}</span></td>
              <td className="px-4 py-3"><Link className="font-medium text-primary underline-offset-4 hover:underline" href={`/${locale}/dashboard/retail-catalog/${product.id}`}>{t.edit}</Link></td>
            </tr>)}</tbody>
          </table></div>
        )}
      </section>
      <div className="grid gap-6 xl:grid-cols-2">
        <section className="space-y-4 rounded-xl border bg-card p-4">
          <h2 className="flex items-center gap-2 font-semibold"><FolderPlus className="size-4" />{t.categories}</h2>
          <form className="grid gap-3 sm:grid-cols-2" onSubmit={submitCategory}>
            <input required minLength={2} maxLength={200} className="rounded-lg border bg-background px-3 py-2 text-sm" placeholder={t.categoryName} value={categoryName} onChange={(event) => setCategoryName(event.target.value)} />
            <input maxLength={5000} className="rounded-lg border bg-background px-3 py-2 text-sm" placeholder={t.categoryDescription} value={categoryDescription} onChange={(event) => setCategoryDescription(event.target.value)} />
            <button className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground sm:col-span-2" type="submit">{t.addCategory}</button>
          </form>
          <ul className="divide-y">{categories.map((category) => <li key={category.id} className="flex items-center justify-between gap-3 py-2 text-sm"><span>{category.name}<span className="ms-2 text-xs text-muted-foreground">{category.isActive ? t.active : t.inactive}</span></span><button className="rounded border px-3 py-1.5 text-xs hover:bg-muted" type="button" onClick={() => void toggleCategory(category)}>{category.isActive ? t.deactivate : t.activate}</button></li>)}</ul>
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
    </main>
  );
}
