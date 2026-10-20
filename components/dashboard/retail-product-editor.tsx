"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { ArrowLeft, Eye, ImagePlus, Plus, Save, Store, Trash2, UploadCloud } from "lucide-react";

type Locale = "fa" | "en" | "ar";
type Definition = { id: string; key: string; label: string; scope: "PRODUCT" | "VARIANT_OPTION"; valueType: "TEXT" | "NUMBER" | "BOOLEAN" | "ENUM"; displayUnit: string | null; allowedValues: unknown };
type Category = { id: string; name: string; isActive: boolean };
type ImageItem = { id: string; url: string; filename?: string | null };
type Attribute = { definitionId: string; value: string | number | boolean };
type ProductRecord = { id: string; name: string; brand: string | null; slug: string | null; description: string | null; isActive: boolean; category: { id: string; name: string; isActive: boolean }; categoryIds: string[]; tags: Array<{ id: string; name: string }>; imageIds: string[]; images: ImageItem[]; attributes: Attribute[]; variants: VariantRecord[] };
type VariantRecord = { id: string; name: string | null; sku: string | null; price: number | null; inventory: number; reservedQuantity: number; allowBackOrder: boolean; options: Attribute[]; imageIds: string[]; images: ImageItem[] };
type VariantDraft = { id?: string; name: string; sku: string; price: string; inventory: string; reservedQuantity: number; allowBackOrder: boolean; options: Record<string, string>; imageIds: string[] };

const strings = {
  fa: {
    titleNew: "افزودن محصول فروشگاه", titleEdit: "مدیریت محصول فروشگاه", intro: "مشخصات محصول، دسته‌ها، تگ‌ها و گونه‌های قابل خرید را وارد کنید.", back: "بازگشت به کاتالوگ", name: "نام محصول", brand: "برند", slug: "نشانی کوتاه (اختیاری)", description: "توضیحات محصول", category: "دسته‌بندی اصلی", categories: "دسته‌بندی‌های دیگر", tags: "تگ‌ها", tagsHelp: "هر تگ را با ویرگول جدا کنید", choose: "انتخاب کنید", productAttributes: "ویژگی‌های محصول", variantOptions: "گزینه‌های گونه خرید", noDefinitions: "برای تعریف ویژگی‌ها به کاتالوگ فروشگاه بروید.", addVariant: "افزودن گونه خرید", variant: "گونه خرید", variantName: "عنوان گونه", sku: "شناسه کالا (SKU)", price: "قیمت (تومان)", inventory: "موجودی", reserved: "رزرو شده", backorder: "پذیرش سفارش در نبود موجودی", images: "تصاویر محصول", variantImages: "تصاویر این گونه", upload: "افزودن تصویر", remove: "حذف تصویر", save: "ذخیره پیش‌نویس", saveChanges: "ذخیره تغییرات", preview: "پیش‌نمایش", publish: "انتشار در فروشگاه", unpublish: "برداشتن از فروشگاه", storeLink: "نمایش در فروشگاه", draft: "پیش‌نویس خصوصی", previewBanner: "پیش‌نمایش مدیر فروشگاه · این کالا هنوز برای مشتریان منتشر نشده است", closePreview: "بستن پیش‌نمایش", noImage: "تصویری انتخاب نشده است", variantsRequired: "برای انتشار، هر گونه به شناسه کالا و قیمت معتبر نیاز دارد و محصول باید تصویر عمومی داشته باشد.", uploadError: "بارگذاری تصویر انجام نشد. نوع یا اندازه فایل را بررسی کنید.", genericError: "ذخیره انجام نشد. اطلاعات را بررسی و دوباره تلاش کنید.", saved: "تغییرات ذخیره شد.", publishNotice: "محصول منتشر شد.", unpublishNotice: "محصول از فروشگاه برداشته شد.", loading: "در حال بارگذاری اطلاعات…", inactiveCategory: "این دسته‌بندی غیرفعال است؛ برای انتشار آن را فعال کنید.", trueLabel: "بله", falseLabel: "خیر", add: "افزودن", deleting: "در حال بارگذاری…", stockConflict: "موجودی نمی‌تواند کمتر از مقدار رزروشده باشد.", public: "عمومی", matrix: "ساخت گونه‌ها از دو گزینه", matrixHelp: "دو ویژگی گونه را انتخاب کنید تا ترکیب‌های ممکن ساخته شوند.", firstOption: "ویژگی اول", secondOption: "ویژگی دوم", generate: "ساخت ترکیب‌ها", removeVariant: "حذف گونه", sameOption: "همین ویژگی و مقدار", optionValue: "مقدار ویژگی", applyGallery: "اعمال گالری محصول روی گونه‌های هم‌ویژگی",
  },
  en: {
    titleNew: "Add retail product", titleEdit: "Manage retail product", intro: "Enter product details, categories, tags, and purchasable variants.", back: "Back to catalog", name: "Product name", brand: "Brand", slug: "URL slug (optional)", description: "Product description", category: "Primary category", categories: "Additional categories", tags: "Tags", tagsHelp: "Separate tags with commas", choose: "Choose…", productAttributes: "Product attributes", variantOptions: "Variant options", noDefinitions: "Add attribute definitions in Retail catalog first.", addVariant: "Add variant", variant: "Variant", variantName: "Variant name", sku: "SKU", price: "Price (Toman)", inventory: "Inventory", reserved: "Reserved", backorder: "Allow back-ordering", images: "Product gallery", variantImages: "Images for this variant", upload: "Add image", remove: "Remove image", save: "Save draft", saveChanges: "Save changes", preview: "Preview", publish: "Publish to storefront", unpublish: "Unpublish", storeLink: "View storefront", draft: "Private draft", previewBanner: "Merchant preview · This product is not visible to customers yet", closePreview: "Close preview", noImage: "No image selected", variantsRequired: "Each variant needs a SKU and valid price to publish. Add at least one public product image.", uploadError: "Image upload failed. Check the file type and size.", genericError: "Could not save. Check the fields and try again.", saved: "Changes saved.", publishNotice: "Product published.", unpublishNotice: "Product removed from the storefront.", loading: "Loading product data…", inactiveCategory: "This category is inactive. Activate it before publishing.", trueLabel: "Yes", falseLabel: "No", add: "Add", deleting: "Uploading…", stockConflict: "Inventory cannot be lower than the quantity already reserved.", public: "Public", matrix: "Build variants from two options", matrixHelp: "Choose two variant attributes to create their possible combinations.", firstOption: "First option", secondOption: "Second option", generate: "Create combinations", removeVariant: "Remove variant", sameOption: "Apply by option", optionValue: "Option value", applyGallery: "Apply product gallery to matching variants",
  },
  ar: {
    titleNew: "إضافة منتج للبيع بالتجزئة", titleEdit: "إدارة المنتج", intro: "أدخل تفاصيل المنتج والفئات والوسوم وخيارات الشراء.", back: "العودة إلى الكتالوج", name: "اسم المنتج", brand: "العلامة التجارية", slug: "الرابط المختصر (اختياري)", description: "وصف المنتج", category: "الفئة الرئيسية", categories: "فئات إضافية", tags: "الوسوم", tagsHelp: "افصل الوسوم بفواصل", choose: "اختر…", productAttributes: "سمات المنتج", variantOptions: "خيارات المنتج", noDefinitions: "أضف تعريفات السمات في كتالوج المتجر أولاً.", addVariant: "إضافة خيار", variant: "الخيار", variantName: "اسم الخيار", sku: "رمز المنتج", price: "السعر (تومان)", inventory: "المخزون", reserved: "محجوز", backorder: "السماح بالطلب عند نفاد المخزون", images: "صور المنتج", variantImages: "صور هذا الخيار", upload: "إضافة صورة", remove: "إزالة الصورة", save: "حفظ كمسودة", saveChanges: "حفظ التغييرات", preview: "معاينة", publish: "النشر في المتجر", unpublish: "إلغاء النشر", storeLink: "عرض المتجر", draft: "مسودة خاصة", previewBanner: "معاينة التاجر · المنتج غير ظاهر للعملاء بعد", closePreview: "إغلاق المعاينة", noImage: "لم يتم اختيار صورة", variantsRequired: "يحتاج كل خيار إلى رمز وسعر صالحين للنشر. أضف صورة عامة واحدة على الأقل للمنتج.", uploadError: "فشل تحميل الصورة. تحقق من النوع والحجم.", genericError: "تعذر الحفظ. تحقق من الحقول وحاول مرة أخرى.", saved: "تم حفظ التغييرات.", publishNotice: "تم نشر المنتج.", unpublishNotice: "تمت إزالة المنتج من المتجر.", loading: "جارٍ تحميل بيانات المنتج…", inactiveCategory: "هذه الفئة غير نشطة. فعّلها قبل النشر.", trueLabel: "نعم", falseLabel: "لا", add: "إضافة", deleting: "جارٍ التحميل…", stockConflict: "لا يمكن أن يقل المخزون عن الكمية المحجوزة.", public: "عام", matrix: "إنشاء الخيارات من سمتين", matrixHelp: "اختر سمتين لإنشاء التركيبات الممكنة.", firstOption: "السمة الأولى", secondOption: "السمة الثانية", generate: "إنشاء التركيبات", removeVariant: "إزالة الخيار", sameOption: "التطبيق حسب السمة", optionValue: "قيمة السمة", applyGallery: "تطبيق معرض المنتج على الخيارات المطابقة",
  },
} as const;

function newVariant(definitions: Definition[]): VariantDraft {
  return { name: "", sku: "", price: "", inventory: "0", reservedQuantity: 0, allowBackOrder: false, options: Object.fromEntries(definitions.filter((definition) => definition.scope === "VARIANT_OPTION").map((definition) => [definition.id, ""])), imageIds: [] };
}

function restoreVariants(variants: VariantRecord[]): VariantDraft[] {
  return variants.map((variant) => ({
    id: variant.id, name: variant.name ?? "", sku: variant.sku ?? "",
    price: variant.price === null ? "" : String(variant.price),
    inventory: String(variant.inventory), reservedQuantity: variant.reservedQuantity,
    allowBackOrder: variant.allowBackOrder,
    options: Object.fromEntries(variant.options.map((option) => [option.definitionId, String(option.value)])),
    imageIds: variant.imageIds ?? [],
  }));
}

function recordSnapshot(product: ProductRecord) {
  return JSON.stringify({ name: product.name, brand: product.brand ?? "", slug: product.slug ?? "", description: product.description ?? "", categoryId: product.category.id, categoryIds: product.categoryIds ?? [product.category.id], tagText: (product.tags ?? []).map((tag) => tag.name).join(", "), attributes: Object.fromEntries(product.attributes.map((attribute) => [attribute.definitionId, String(attribute.value)])), variants: restoreVariants(product.variants), selectedImageIds: product.images.map((image) => image.id) });
}

function valueFromInput(definition: Definition, value: string): string | number | boolean {
  if (definition.valueType === "NUMBER") return Number(value);
  if (definition.valueType === "BOOLEAN") return value === "true";
  return value;
}

function allowedValues(definition: Definition): string[] {
  return Array.isArray(definition.allowedValues) ? definition.allowedValues.filter((value): value is string => typeof value === "string") : [];
}

function ErrorMessage({ text }: { text: string }) { return text ? <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">{text}</p> : null; }

function friendlyError(message: string, locale: Locale, fallback: string, stockMessage: string, publishMessage: string) {
  const normalized = message.toLocaleLowerCase();
  if (normalized.includes("sku") && (normalized.includes("unique") || normalized.includes("duplicate") || normalized.includes("already"))) {
    return locale === "fa" ? "این شناسه کالا قبلاً برای گونه دیگری استفاده شده است. برای هر گونه یک شناسه یکتا وارد کنید." : locale === "ar" ? "رمز المنتج مستخدم بالفعل. أدخل رمزًا فريدًا لكل خيار." : "That SKU is already used. Enter a unique SKU for each variant.";
  }
  if ((normalized.includes("stock") || normalized.includes("inventory")) && (normalized.includes("reserved") || normalized.includes("below"))) return stockMessage;
  if (normalized.includes("image") && (normalized.includes("public") || normalized.includes("store") || normalized.includes("belong") || normalized.includes("owned"))) {
    return locale === "fa" ? "تصویر انتخابی عمومی یا متعلق به همین فروشگاه نیست. از گالری فروشگاه تصویر دیگری انتخاب کنید." : locale === "ar" ? "الصورة المختارة غير عامة أو لا تخص هذا المتجر. اختر صورة أخرى من المعرض." : "The selected image is private or belongs to another store. Choose an image from this store’s gallery.";
  }
  if (normalized.includes("option") && (normalized.includes("duplicate") || normalized.includes("only once"))) {
    return locale === "fa" ? "برای هر ویژگی گونه فقط یک مقدار وارد کنید." : locale === "ar" ? "أدخل قيمة واحدة فقط لكل سمة خيار." : "Each variant option can be set only once.";
  }
  if (normalized.includes("image") || normalized.includes("sku")) return publishMessage;
  return fallback;
}

export function RetailProductEditor({ locale, productId }: { locale: Locale; productId?: string }) {
  const router = useRouter();
  const t = strings[locale];
  const rtl = locale === "fa" || locale === "ar";
  const [definitions, setDefinitions] = useState<Definition[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [images, setImages] = useState<ImageItem[]>([]);
  const [selectedImageIds, setSelectedImageIds] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [tagText, setTagText] = useState("");
  const [attributes, setAttributes] = useState<Record<string, string>>({});
  const [variants, setVariants] = useState<VariantDraft[]>([]);
  const [published, setPublished] = useState(false);
  const [organizationSlug, setOrganizationSlug] = useState("");
  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [preview, setPreview] = useState(false);
  const [fileBusy, setFileBusy] = useState(false);
  const [matrixDefinitions, setMatrixDefinitions] = useState<[string, string]>(["", ""]);
  const [imageGroupDefinitionId, setImageGroupDefinitionId] = useState("");
  const [imageGroupValue, setImageGroupValue] = useState("");
  const [savedState, setSavedState] = useState<string | null>(null);
  const editorState = JSON.stringify({ name, brand, slug, description, categoryId, categoryIds, tagText, attributes, variants, selectedImageIds });
  const unsaved = savedState !== null && savedState !== editorState;
  const leaveWarning = locale === "fa" ? "تغییرات ذخیره نشده‌اند. بدون ذخیره خارج می‌شوید؟" : locale === "ar" ? "لم يتم حفظ التغييرات. هل تريد المغادرة؟" : "You have unsaved changes. Leave without saving?";

  useEffect(() => {
    if (!unsaved) return;
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    const beforeNavigate = (event: MouseEvent) => {
      const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!(link instanceof HTMLAnchorElement) || link.target === "_blank" || link.href === window.location.href || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return;
      if (!window.confirm(leaveWarning)) { event.preventDefault(); event.stopPropagation(); }
    };
    // Chromium's Navigation API also covers client-side Back/Forward, which
    // does not emit beforeunload when the router reuses the current document.
    const navigation = (window as Window & { navigation?: EventTarget }).navigation;
    const beforeHistoryNavigate = (event: Event & { navigationType?: string }) => {
      if (event.navigationType === "traverse" && event.cancelable && !window.confirm(leaveWarning)) event.preventDefault();
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", beforeNavigate, true);
    navigation?.addEventListener("navigate", beforeHistoryNavigate);
    return () => { window.removeEventListener("beforeunload", beforeUnload); document.removeEventListener("click", beforeNavigate, true); navigation?.removeEventListener("navigate", beforeHistoryNavigate); };
  }, [unsaved, leaveWarning]);

  const productAttributeDefinitions = useMemo(() => definitions.filter((definition) => definition.scope === "PRODUCT"), [definitions]);
  const optionDefinitions = useMemo(() => definitions.filter((definition) => definition.scope === "VARIANT_OPTION"), [definitions]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setBusy(true);
      setSavedState(null);
      setNotice("");
      setPreview(false);
      setMatrixDefinitions(["", ""]);
      setImageGroupDefinitionId("");
      setImageGroupValue("");
      setError("");
      try {
        const requests = ["/api/dashboard/retail/attributes", "/api/dashboard/retail/categories", "/api/dashboard/retail/media", "/api/dashboard/retail/context"].map((url) => fetch(url, { credentials: "same-origin" }));
        if (productId) requests.push(fetch(`/api/dashboard/retail/catalog/${productId}`, { credentials: "same-origin" }));
        const responses = await Promise.all(requests);
        const payloads = await Promise.all(responses.map((response) => response.json()));
        if (responses.some((response) => !response.ok)) throw new Error("load-failed");
        if (cancelled) return;
        const [definitionData, categoryData, mediaData, contextData, productData] = payloads;
        const defs: Definition[] = definitionData.definitions ?? [];
        setDefinitions(defs);
        setCategories(categoryData.categories ?? []);
        setImages(mediaData.images ?? []);
        setOrganizationSlug(contextData.organizationSlug ?? "");
        if (productData?.product) {
          const product = productData.product as ProductRecord;
          setSavedState(recordSnapshot(product));
          setName(product.name);
          setBrand(product.brand ?? "");
          setSlug(product.slug ?? "");
          setDescription(product.description ?? "");
          setCategoryId(product.category.id);
          setCategoryIds(product.categoryIds ?? [product.category.id]);
          setTagText((product.tags ?? []).map((tag) => tag.name).join(", "));
          setPublished(product.isActive);
          setAttributes(Object.fromEntries(product.attributes.map((attribute) => [attribute.definitionId, String(attribute.value)])));
          setImages((current) => {
            const merged = new Map(current.map((image) => [image.id, image]));
            for (const image of product.images) merged.set(image.id, image);
            return [...merged.values()];
          });
          setSelectedImageIds(product.images.map((image) => image.id));
          setVariants(restoreVariants(product.variants));
        } else {
          setName(""); setBrand(""); setSlug(""); setDescription("");
          setCategoryId(""); setCategoryIds([]); setTagText(""); setAttributes({}); setPublished(false);
          setVariants([newVariant(defs)]);
          setSelectedImageIds([]);
          setSavedState(JSON.stringify({ name: "", brand: "", slug: "", description: "", categoryId: "", categoryIds: [], tagText: "", attributes: {}, variants: [newVariant(defs)], selectedImageIds: [] }));
        }
      } catch {
        if (!cancelled) setError(t.genericError);
      } finally {
        if (!cancelled) setBusy(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [productId, t.genericError]);

  function updateVariant(index: number, patch: Partial<VariantDraft>) {
    setVariants((current) => current.map((variant, currentIndex) => currentIndex === index ? { ...variant, ...patch } : variant));
  }

  function generateVariantMatrix() {
    const [firstId, secondId] = matrixDefinitions;
    const first = optionDefinitions.find((definition) => definition.id === firstId);
    const second = optionDefinitions.find((definition) => definition.id === secondId);
    if (!first || !second || first.id === second.id) return;
    const firstValues = allowedValues(first);
    const secondValues = allowedValues(second);
    if (!firstValues.length || !secondValues.length) return;
    const combinations = firstValues.flatMap((firstValue) => secondValues.map((secondValue) => ({ firstValue, secondValue })));
    setVariants((current) => {
      // Replace the untouched initial row, while keeping every merchant-entered
      // or persisted variant when generating a color × size matrix.
      const next = current.filter((variant) => variant.id || variant.name.trim() || variant.sku.trim() || variant.price || variant.inventory !== "0" || variant.allowBackOrder || variant.imageIds.length || Object.values(variant.options).some(Boolean));
      for (const { firstValue, secondValue } of combinations) {
        const options = { [first.id]: firstValue, [second.id]: secondValue };
        const existingIndex = next.findIndex((variant) => variant.options[first.id] === firstValue && variant.options[second.id] === secondValue);
        if (existingIndex >= 0) next[existingIndex] = { ...next[existingIndex]!, options: { ...next[existingIndex]!.options, ...options } };
        else {
          const blank = newVariant(definitions);
          next.push({ ...blank, name: `${firstValue} · ${secondValue}`, options: { ...blank.options, ...options } });
        }
      }
      return next;
    });
  }

  function toggleVariantImage(index: number, imageId: string) {
    const variant = variants[index];
    if (!variant) return;
    const imageIds = variant.imageIds.includes(imageId) ? variant.imageIds.filter((id) => id !== imageId) : [...variant.imageIds, imageId];
    updateVariant(index, { imageIds });
  }

  function applyGalleryToMatchingVariants() {
    if (!imageGroupDefinitionId || !imageGroupValue) return;
    setVariants((current) => current.map((variant) => variant.options[imageGroupDefinitionId] === imageGroupValue ? { ...variant, imageIds: [...selectedImageIds] } : variant));
  }

  async function uploadImages(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) return;
    setFileBusy(true); setError("");
    try {
      const uploads = await Promise.all(files.map(async (file) => {
        const form = new FormData(); form.set("file", file);
        const response = await fetch("/api/dashboard/retail/media", { method: "POST", credentials: "same-origin", body: form });
        const data = await response.json();
        if (!response.ok) throw new Error("image-upload-failed");
        return data.image as ImageItem;
      }));
      setImages((current) => [...new Map([...current, ...uploads].map((image) => [image.id, image])).values()]);
      setSelectedImageIds((current) => [...new Set([...current, ...uploads.map((image) => image.id)])].slice(0, 20));
    } catch { setError(t.uploadError); }
    finally { setFileBusy(false); event.target.value = ""; }
  }

  const selectedImages = images.filter((image) => selectedImageIds.includes(image.id));

  function buildAssignments(scope: "PRODUCT" | "VARIANT_OPTION", values: Record<string, string>) {
    return definitions.filter((definition) => definition.scope === scope && values[definition.id] !== undefined && values[definition.id] !== "").map((definition) => ({ definitionId: definition.id, value: valueFromInput(definition, values[definition.id]!) }));
  }

  async function saveProduct(action: "save" | "publish" | "unpublish") {
    setSaving(true); setError(""); setNotice("");
    try {
      if (!categoryId) throw new Error("missing-category");
      if ((!variants.length && (!productId || action === "publish")) || variants.some((variant) => !variant.name.trim() || !variant.price || !Number.isFinite(Number(variant.price)) || Number(variant.price) <= 0 || !Number.isInteger(Number(variant.inventory)) || Number(variant.inventory) < variant.reservedQuantity) || (action === "publish" && variants.some((variant) => !variant.sku.trim()))) throw new Error(t.variantsRequired);
      if (action === "publish" && selectedImageIds.length === 0) throw new Error(t.variantsRequired);
      const variantInput = variants.map((variant) => ({
        name: variant.name.trim(), sku: variant.sku.trim() || null, price: Number(variant.price), inventory: Number(variant.inventory), allowBackOrder: variant.allowBackOrder,
        options: buildAssignments("VARIANT_OPTION", variant.options), imageIds: variant.imageIds,
      }));
      const productAttributes = buildAssignments("PRODUCT", attributes);
      const categoriesToSave = [...new Set([categoryId, ...categoryIds].filter(Boolean))];
      const tagNames = [...new Set(tagText.split(/[,،\n]/u).map((tag) => tag.trim()).filter(Boolean))];
      const payload = productId ? {
        name, brand: brand || null, slug: slug || undefined, description: description || null, categoryId, categoryIds: categoriesToSave, tagNames, imageIds: selectedImageIds, attributes: productAttributes,
        variantUpdates: variants.filter((variant) => variant.id).map((variant) => ({ id: variant.id!, name: variant.name.trim(), sku: variant.sku.trim() || null, price: Number(variant.price), inventory: Number(variant.inventory), allowBackOrder: variant.allowBackOrder, options: variantInput[variants.indexOf(variant)]!.options, imageIds: variant.imageIds })),
        newVariants: variantInput.filter((_, index) => !variants[index]?.id),
        ...(action === "publish" ? { isActive: true } : action === "unpublish" ? { isActive: false } : {}),
      } : {
        name, brand: brand || null, slug: slug || undefined, description: description || null, categoryId, categoryIds: categoriesToSave, tagNames, imageIds: selectedImageIds, attributes: productAttributes,
        variants: variantInput,
      };
      const response = await fetch(productId ? `/api/dashboard/retail/catalog/${productId}` : "/api/dashboard/retail/catalog", { method: productId ? "PATCH" : "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const data = await response.json();
      if (!response.ok) throw new Error(friendlyError(data.error ?? "", locale, t.genericError, t.stockConflict, t.variantsRequired));
      if (!productId) {
        const createdId = data.product.id as string;
        router.replace(`/${locale}/dashboard/retail-catalog/${createdId}`);
        return;
      }
      const updated = data.product as ProductRecord;
      setName(updated.name); setBrand(updated.brand ?? ""); setDescription(updated.description ?? "");
      setCategoryId(updated.category.id); setCategoryIds(updated.categoryIds ?? [updated.category.id]);
      setTagText((updated.tags ?? []).map((tag) => tag.name).join(", "));
      setAttributes(Object.fromEntries(updated.attributes.map((attribute) => [attribute.definitionId, String(attribute.value)])));
      setSelectedImageIds(updated.images.map((image) => image.id));
      setVariants(restoreVariants(updated.variants));
      setSlug(updated.slug ?? "");
      setSavedState(recordSnapshot(updated));
      setPublished(updated.isActive);
      setNotice(action === "publish" ? t.publishNotice : action === "unpublish" ? t.unpublishNotice : t.saved);
      if (action === "publish") setPreview(false);
      if (action === "unpublish") setPreview(true);
      router.refresh();
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : t.genericError;
      setError(message === "missing-category" ? t.category : message || t.genericError);
    } finally { setSaving(false); }
  }

  const currency = locale === "en" ? "Toman" : "تومان";
  if (busy) return <main className="p-6" dir={rtl ? "rtl" : "ltr"}><p>{t.loading}</p></main>;

  return (
    <main className="space-y-5 p-4 lg:p-6" dir={rtl ? "rtl" : "ltr"} lang={locale}>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div><Link href={`/${locale}/dashboard/retail-catalog`} className="mb-2 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" />{t.back}</Link><h1 className="text-2xl font-bold">{productId ? t.titleEdit : t.titleNew}</h1><p className="mt-1 text-sm text-muted-foreground">{t.intro}</p></div>
        {published && organizationSlug && <Link href={`/${locale}/${encodeURIComponent(organizationSlug)}/shop`} target="_blank" rel="noreferrer" className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted"><Store className="me-2 inline size-4" />{t.storeLink}</Link>}
      </header>
      <ErrorMessage text={error} />
      {notice && <p role="status" className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm text-emerald-800 dark:text-emerald-200">{notice}</p>}
      {!published && <div className="rounded-lg border border-amber-400/50 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-950/20 dark:text-amber-100">{t.draft}</div>}
      {productId && variants.length === 0 && <p role="status" className="rounded-lg border border-amber-400/50 bg-amber-50 p-4 text-sm text-amber-900 dark:bg-amber-950/20 dark:text-amber-100">{locale === "fa" ? "اطلاعات خرید این محصول قدیمی هنوز تکمیل نشده است. تصویر و مشخصات را می‌توانید ذخیره کنید؛ برای فعال شدن خرید، گونه‌های واقعی رنگ و سایز را با شناسه کالا، قیمت و موجودی دقیق وارد کنید." : locale === "ar" ? "بيانات شراء هذا المنتج القديم غير مكتملة. يمكنك حفظ الصور والتفاصيل؛ أضف خيارات حقيقية مع الرمز والسعر والمخزون لتمكين الشراء." : "This legacy product has no purchase options yet. You can save images and details; add real variants with accurate SKU, price and stock before enabling purchases."}</p>}

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <fieldset disabled={saving || fileBusy} className="min-w-0 space-y-5 border-0 p-0">
          <section className="grid gap-4 rounded-xl border bg-card p-4 sm:grid-cols-2">
            <label className="space-y-1.5 text-sm font-medium"><span>{t.name}</span><input required minLength={2} maxLength={200} value={name} onChange={(event) => setName(event.target.value)} className="w-full rounded-lg border bg-background px-3 py-2.5" /></label>
            <label className="space-y-1.5 text-sm font-medium"><span>{t.brand}</span><input maxLength={160} value={brand} onChange={(event) => setBrand(event.target.value)} className="w-full rounded-lg border bg-background px-3 py-2.5" /></label>
            <label className="space-y-1.5 text-sm font-medium"><span>{t.slug}</span><input maxLength={100} value={slug} onChange={(event) => setSlug(event.target.value)} className="w-full rounded-lg border bg-background px-3 py-2.5" /></label>
            <label className="space-y-1.5 text-sm font-medium sm:col-span-2"><span>{t.description}</span><textarea maxLength={5000} rows={4} value={description} onChange={(event) => setDescription(event.target.value)} className="w-full rounded-lg border bg-background px-3 py-2.5" /></label>
            <label className="space-y-1.5 text-sm font-medium sm:col-span-2"><span>{t.category}</span><select required value={categoryId} onChange={(event) => { setCategoryId(event.target.value); setCategoryIds((current) => [...new Set([event.target.value, ...current].filter(Boolean))]); }} className="w-full rounded-lg border bg-background px-3 py-2.5"><option value="">{t.choose}</option>{categories.map((category) => <option key={category.id} value={category.id} disabled={!category.isActive}>{category.name}</option>)}</select></label>
            <fieldset className="space-y-2 sm:col-span-2"><legend className="text-sm font-medium">{t.categories}</legend><div className="grid gap-2 sm:grid-cols-2">{categories.filter((category) => category.isActive && category.id !== categoryId).map((category) => <label key={category.id} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"><input type="checkbox" checked={categoryIds.includes(category.id)} onChange={() => setCategoryIds((current) => current.includes(category.id) ? current.filter((id) => id !== category.id) : [...current, category.id])} />{category.name}</label>)}</div></fieldset>
            <label className="space-y-1.5 text-sm font-medium sm:col-span-2"><span>{t.tags}</span><input value={tagText} onChange={(event) => setTagText(event.target.value)} placeholder={t.tagsHelp} className="w-full rounded-lg border bg-background px-3 py-2.5" /></label>
            {productAttributeDefinitions.length === 0 ? <p className="text-sm text-muted-foreground sm:col-span-2">{t.noDefinitions} <Link className="text-primary underline" href={`/${locale}/dashboard/retail-catalog`}>{t.back}</Link></p> : <div className="grid gap-3 sm:col-span-2 sm:grid-cols-2"><h2 className="font-semibold sm:col-span-2">{t.productAttributes}</h2>{productAttributeDefinitions.map((definition) => <AttributeControl key={definition.id} definition={definition} locale={locale} value={attributes[definition.id] ?? ""} onChange={(value) => setAttributes((current) => ({ ...current, [definition.id]: value }))} />)}</div>}
          </section>

          <section className="space-y-4 rounded-xl border bg-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">{t.variant}</h2><p className="mt-1 text-xs text-muted-foreground">{t.variantsRequired}</p></div><button type="button" onClick={() => setVariants((current) => [...current, newVariant(definitions)])} className="rounded-lg border px-3 py-2 text-sm hover:bg-muted"><Plus className="me-1 inline size-4" />{t.addVariant}</button></div>
            {optionDefinitions.length >= 2 && <div className="grid gap-3 rounded-lg bg-muted/30 p-3 sm:grid-cols-[1fr_1fr_auto]"><div className="sm:col-span-3"><h3 className="text-sm font-semibold">{t.matrix}</h3><p className="text-xs text-muted-foreground">{t.matrixHelp}</p></div><label className="space-y-1 text-xs font-medium"><span>{t.firstOption}</span><select className="w-full rounded-md border bg-background px-3 py-2 text-sm" value={matrixDefinitions[0]} onChange={(event) => setMatrixDefinitions([event.target.value, matrixDefinitions[1]])}><option value="">{t.choose}</option>{optionDefinitions.map((definition) => <option key={definition.id} value={definition.id}>{definition.label}</option>)}</select></label><label className="space-y-1 text-xs font-medium"><span>{t.secondOption}</span><select className="w-full rounded-md border bg-background px-3 py-2 text-sm" value={matrixDefinitions[1]} onChange={(event) => setMatrixDefinitions([matrixDefinitions[0], event.target.value])}><option value="">{t.choose}</option>{optionDefinitions.filter((definition) => definition.id !== matrixDefinitions[0]).map((definition) => <option key={definition.id} value={definition.id}>{definition.label}</option>)}</select></label><button type="button" disabled={!matrixDefinitions[0] || !matrixDefinitions[1]} onClick={generateVariantMatrix} className="self-end rounded-md border px-3 py-2 text-sm disabled:opacity-50">{t.generate}</button></div>}
            {optionDefinitions.length > 0 && <div className="grid gap-3 rounded-lg border p-3 sm:grid-cols-[1fr_1fr_auto]"><label className="space-y-1 text-xs font-medium"><span>{t.sameOption}</span><select className="w-full rounded-md border bg-background px-3 py-2 text-sm" value={imageGroupDefinitionId} onChange={(event) => { setImageGroupDefinitionId(event.target.value); setImageGroupValue(""); }}><option value="">{t.choose}</option>{optionDefinitions.map((definition) => <option key={definition.id} value={definition.id}>{definition.label}</option>)}</select></label><label className="space-y-1 text-xs font-medium"><span>{t.optionValue}</span><select className="w-full rounded-md border bg-background px-3 py-2 text-sm" value={imageGroupValue} onChange={(event) => setImageGroupValue(event.target.value)} disabled={!imageGroupDefinitionId}><option value="">{t.choose}</option>{allowedValues(optionDefinitions.find((definition) => definition.id === imageGroupDefinitionId) ?? optionDefinitions[0]!).map((value) => <option key={value} value={value}>{value}</option>)}</select></label><button type="button" disabled={!imageGroupDefinitionId || !imageGroupValue || !selectedImageIds.length} onClick={applyGalleryToMatchingVariants} className="self-end rounded-md border px-3 py-2 text-sm disabled:opacity-50">{t.applyGallery}</button></div>}
            <div className="space-y-4">{variants.map((variant, index) => <div key={variant.id ?? `new-${index}`} className="grid gap-3 rounded-lg border bg-muted/10 p-3 sm:grid-cols-2 xl:grid-cols-3">
              <label className="space-y-1 text-xs font-medium"><span>{t.variantName}</span><input required maxLength={200} value={variant.name} onChange={(event) => updateVariant(index, { name: event.target.value })} className="w-full rounded-md border bg-background px-3 py-2 text-sm" /></label>
              <label className="space-y-1 text-xs font-medium"><span>{t.sku}</span><input maxLength={100} value={variant.sku} onChange={(event) => updateVariant(index, { sku: event.target.value })} className="w-full rounded-md border bg-background px-3 py-2 text-sm" /></label>
              <label className="space-y-1 text-xs font-medium"><span>{t.price}</span><input required type="number" min="0.01" step="0.01" value={variant.price} onChange={(event) => updateVariant(index, { price: event.target.value })} className="w-full rounded-md border bg-background px-3 py-2 text-sm" /></label>
              <label className="space-y-1 text-xs font-medium"><span>{t.inventory}</span><input required type="number" min={variant.reservedQuantity} step="1" value={variant.inventory} onChange={(event) => updateVariant(index, { inventory: event.target.value })} className="w-full rounded-md border bg-background px-3 py-2 text-sm" /><small className="block text-muted-foreground">{t.reserved}: {variant.reservedQuantity}</small></label>
              {optionDefinitions.map((definition) => <AttributeControl key={definition.id} definition={definition} locale={locale} value={variant.options[definition.id] ?? ""} onChange={(value) => updateVariant(index, { options: { ...variant.options, [definition.id]: value } })} />)}
              <div className="space-y-2 sm:col-span-2 xl:col-span-3"><span className="text-xs font-medium">{t.variantImages}</span><div className="flex flex-wrap gap-2">{images.map((image) => { const checked = variant.imageIds.includes(image.id); return <button key={image.id} type="button" aria-pressed={checked} onClick={() => toggleVariantImage(index, image.id)} className={`size-16 overflow-hidden rounded-md border ${checked ? "ring-2 ring-primary" : "opacity-70"}`}><Image src={image.url} alt="" width={64} height={64} unoptimized className="size-full object-cover" /></button>; })}{images.length === 0 && <span className="text-xs text-muted-foreground">{t.noImage}</span>}</div><button type="button" className="text-xs text-primary underline" onClick={() => updateVariant(index, { imageIds: [...selectedImageIds] })}>{locale === "fa" ? "استفاده از گالری محصول" : locale === "ar" ? "استخدام معرض المنتج" : "Use product gallery"}</button></div>
              <label className="flex items-center gap-2 text-xs font-medium sm:col-span-2 xl:col-span-3"><input type="checkbox" checked={variant.allowBackOrder} onChange={(event) => updateVariant(index, { allowBackOrder: event.target.checked })} />{t.backorder}</label>
              {!variant.id && variants.length > 1 && <button className="justify-self-start rounded-md border border-destructive/30 px-3 py-1.5 text-xs text-destructive hover:bg-destructive/5" type="button" onClick={() => setVariants((current) => current.filter((_, currentIndex) => currentIndex !== index))}><Trash2 className="me-1 inline size-3.5" />{t.removeVariant}</button>}
            </div>)}</div>
            <p className="text-xs text-muted-foreground">{currency}</p>
          </section>

          <section className="space-y-3 rounded-xl border bg-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">{t.images}</h2><p className="mt-1 text-xs text-muted-foreground">{t.public}</p></div><label className="cursor-pointer rounded-lg border px-3 py-2 text-sm font-medium hover:bg-muted"><UploadCloud className="me-2 inline size-4" />{fileBusy ? t.deleting : t.upload}<input className="sr-only" type="file" accept="image/*" multiple disabled={fileBusy} onChange={(event) => void uploadImages(event)} /></label></div>
            {images.length === 0 ? <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground"><ImagePlus className="mx-auto mb-2 size-5" />{t.noImage}</p> : <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{images.map((image) => {
              const selected = selectedImageIds.includes(image.id);
              return <div key={image.id} className={`overflow-hidden rounded-lg border ${selected ? "ring-2 ring-primary" : "opacity-65"}`}><button type="button" className="block aspect-square w-full bg-muted" aria-pressed={selected} aria-label={`${selected ? t.remove : t.upload}: ${image.filename ?? image.id}`} onClick={() => setSelectedImageIds((current) => selected ? current.filter((id) => id !== image.id) : current.length < 20 ? [...current, image.id] : current)}><Image src={image.url} alt="" width={320} height={320} unoptimized className="h-full w-full object-cover" /></button><p className="truncate px-2 py-1 text-xs">{image.filename ?? image.id}</p></div>;
            })}</div>}
          </section>
          <div className="flex flex-wrap gap-2">
            <button disabled={saving || !name.trim()} type="button" onClick={() => void saveProduct("save")} className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"><Save className="me-2 inline size-4" />{saving ? t.deleting : productId ? t.saveChanges : t.save}</button>
            <button type="button" onClick={() => setPreview((current) => !current)} className="rounded-lg border px-4 py-2.5 text-sm font-semibold hover:bg-muted"><Eye className="me-2 inline size-4" />{preview ? t.closePreview : t.preview}</button>
            {productId && !published && <button disabled={saving} type="button" onClick={() => void saveProduct("publish")} className="rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50">{t.publish}</button>}
            {productId && published && <button disabled={saving} type="button" onClick={() => void saveProduct("unpublish")} className="rounded-lg border border-amber-500/50 px-4 py-2.5 text-sm font-semibold text-amber-800 hover:bg-amber-50 dark:text-amber-200">{t.unpublish}</button>}
          </div>
        </fieldset>

        {preview && <aside className="sticky top-4 overflow-hidden rounded-xl border bg-card shadow-sm"><div className="border-b bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">{t.previewBanner}</div>{selectedImages[0] ? <Image src={selectedImages[0].url} alt="" width={640} height={480} unoptimized className="aspect-[4/3] w-full object-cover" /> : <div className="grid aspect-[4/3] place-items-center bg-muted text-sm text-muted-foreground">{t.noImage}</div>}<div className="space-y-3 p-4"><h2 className="text-lg font-semibold">{name || t.titleNew}</h2><p className="whitespace-pre-wrap text-sm text-muted-foreground">{description}</p>{attributes && <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">{productAttributeDefinitions.filter((definition) => attributes[definition.id]).map((definition) => <div key={definition.id}><dt className="text-xs text-muted-foreground">{definition.label}</dt><dd>{attributes[definition.id]}{definition.displayUnit ? ` ${definition.displayUnit}` : ""}</dd></div>)}</dl>}<div className="divide-y rounded-lg border">{variants.map((variant, index) => <div key={variant.id ?? index} className="flex items-center justify-between gap-2 p-3 text-sm"><span>{variant.name || `${t.variant} ${index + 1}`}{Object.entries(variant.options).filter(([, value]) => value).map(([id, value]) => <small key={id} className="ms-2 text-muted-foreground">{optionDefinitions.find((definition) => definition.id === id)?.label}: {value}</small>)}</span><span className="font-semibold">{Number(variant.price || 0).toLocaleString(locale)} {currency}</span></div>)}</div><button disabled className="w-full rounded-lg bg-muted px-4 py-2 text-sm text-muted-foreground" type="button">{t.previewBanner}</button></div></aside>}
      </div>
    </main>
  );
}

function AttributeControl({ definition, locale, value, onChange }: { definition: Definition; locale: Locale; value: string; onChange: (value: string) => void }) {
  const t = strings[locale];
  const id = `retail-attribute-${definition.id}`;
  const options = allowedValues(definition);
  return <label htmlFor={id} className="space-y-1.5 text-sm font-medium"><span>{definition.label}{definition.displayUnit ? ` (${definition.displayUnit})` : ""}</span>{definition.valueType === "ENUM" ? <select id={id} value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-lg border bg-background px-3 py-2.5"><option value="">{t.choose}</option>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select> : definition.valueType === "BOOLEAN" ? <select id={id} value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-lg border bg-background px-3 py-2.5"><option value="">{t.choose}</option><option value="true">{t.trueLabel}</option><option value="false">{t.falseLabel}</option></select> : <input id={id} type={definition.valueType === "NUMBER" ? "number" : "text"} step={definition.valueType === "NUMBER" ? "any" : undefined} value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-lg border bg-background px-3 py-2.5" />}</label>;
}
