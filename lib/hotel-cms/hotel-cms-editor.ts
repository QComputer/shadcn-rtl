import { moveWebsiteSection } from "@/lib/website-studio/core";
import type { HotelWebsiteContent, HotelWebsiteMediaAssociationInput } from "@/lib/hotel/content/hotel-website-contract";
import type { HotelCmsDraft, HotelCmsLocale } from "./hotel-cms-api";

export type EditorContent = HotelWebsiteContent;
export type EditorMedia = HotelWebsiteMediaAssociationInput;
export const locales: readonly HotelCmsLocale[] = ["fa", "en", "ar"];

export function isDamoonWebsiteScope(siteScope?: { organizationSlug: string; propertySlug: string }): boolean {
  return Boolean(siteScope && ["damoon", "damoon-hotel"].includes(siteScope.organizationSlug) && siteScope.propertySlug === "damoon");
}

export function damoonSelectedAccommodationCatalog(): NonNullable<EditorContent["accommodationCatalog"]> {
  return {
    totalRooms: 20,
    totalSuites: 11,
    categories: [
      { slug: "single", kind: "ROOM", order: 0, visible: true, count: 3, title: { fa: "اتاق یک‌نفره", en: "Single room", ar: "غرفة مفردة" }, description: { fa: "گروه اتاق یک‌نفره برای هماهنگی درخواست؛ ظرفیت و جزئیات واحد را پذیرش تأیید می‌کند.", en: "Single room category for coordination requests; reception confirms unit details and capacity.", ar: "فئة غرفة مفردة لطلبات التنسيق؛ يؤكد الاستقبال تفاصيل الوحدة وسعتها." }, amenities: [], capacitySpecification: {} },
      { slug: "double", kind: "ROOM", order: 1, visible: true, count: 17, title: { fa: "اتاق دونفره", en: "Double room", ar: "غرفة مزدوجة" }, description: { fa: "گروه اتاق دونفره برای هماهنگی درخواست؛ ظرفیت و جزئیات واحد را پذیرش تأیید می‌کند.", en: "Double room category for coordination requests; reception confirms unit details and capacity.", ar: "فئة غرفة مزدوجة لطلبات التنسيق؛ يؤكد الاستقبال تفاصيل الوحدة وسعتها." }, amenities: [], capacitySpecification: {} },
      { slug: "suite-3-person", kind: "SUITE", order: 2, visible: true, count: 6, title: { fa: "سوئیت سه‌نفره", en: "Three-person suite", ar: "جناح لثلاثة أشخاص" }, description: { fa: "گروه سوئیت سه‌نفره برای هماهنگی درخواست؛ ظرفیت و جزئیات واقعی را از پذیرش بپرسید.", en: "Three-person suite category for coordination requests; ask reception to confirm actual unit details and capacity.", ar: "فئة جناح لثلاثة أشخاص لطلبات التنسيق؛ يرجى تأكيد تفاصيل الوحدة وسعتها الفعلية مع الاستقبال." }, amenities: [], capacitySpecification: {} },
      { slug: "suite-4-person", kind: "SUITE", order: 3, visible: true, count: 3, title: { fa: "سوئیت چهارنفره", en: "Four-person suite", ar: "جناح لأربعة أشخاص" }, description: { fa: "گروه سوئیت چهارنفره برای هماهنگی درخواست؛ ظرفیت و جزئیات واقعی را از پذیرش بپرسید.", en: "Four-person suite category for coordination requests; ask reception to confirm actual unit details and capacity.", ar: "فئة جناح لأربعة أشخاص لطلبات التنسيق؛ يرجى تأكيد تفاصيل الوحدة وسعتها الفعلية مع الاستقبال." }, amenities: [], capacitySpecification: {} },
      { slug: "suite-5-person", kind: "SUITE", order: 4, visible: true, count: 2, title: { fa: "سوئیت پنج‌نفره", en: "Five-person suite", ar: "جناح لخمسة أشخاص" }, description: { fa: "گروه سوئیت پنج‌نفره برای هماهنگی درخواست؛ ظرفیت و جزئیات واقعی را از پذیرش بپرسید.", en: "Five-person suite category for coordination requests; ask reception to confirm actual unit details and capacity.", ar: "فئة جناح لخمسة أشخاص لطلبات التنسيق؛ يرجى تأكيد تفاصيل الوحدة وسعتها الفعلية مع الاستقبال." }, amenities: [], capacitySpecification: {} },
    ],
  };
}

export function blankContent(siteScope?: { organizationSlug: string; propertySlug: string }): EditorContent {
  return {
    title: {}, hero: { heading: {} }, introduction: { body: {} }, sections: [], contact: {},
    ...(isDamoonWebsiteScope(siteScope) ? { accommodationCatalog: damoonSelectedAccommodationCatalog() } : {}),
  };
}
export function blankDraft(siteScope?: { organizationSlug: string; propertySlug: string }): HotelCmsDraft { return { content: blankContent(siteScope), media: [] }; }
export function withSiteDefaults(content: EditorContent, siteScope?: { organizationSlug: string; propertySlug: string }): EditorContent {
  if (!isDamoonWebsiteScope(siteScope) || content.accommodationCatalog) return content;
  return { ...content, accommodationCatalog: damoonSelectedAccommodationCatalog() };
}
export function localized(text: Partial<Record<HotelCmsLocale, string>> | undefined, locale: HotelCmsLocale): string {
  return text?.[locale] ?? "";
}
export function setLocalized<T extends Partial<Record<HotelCmsLocale, string>>>(source: T | undefined, locale: HotelCmsLocale, value: string): T {
  const next = { ...(source ?? {}) } as T;
  if (value.length) (next as Record<string, string>)[locale] = value;
  else delete (next as Record<string, string>)[locale];
  return next;
}
export function checkDraftMinimum(draft: HotelCmsDraft): string | null {
  const hasText = (obj: Partial<Record<HotelCmsLocale, string>>) => locales.some((language) => Boolean(obj?.[language]?.trim()));
  if (!hasText(draft.content.title)) return "عنوان صفحه را در دست‌کم یک زبان وارد کنید.";
  if (!hasText(draft.content.hero.heading)) return "عنوان اصلی را وارد کنید.";
  if (!hasText(draft.content.introduction.body)) return "توضیح معرفی هتل را وارد کنید.";
  if (draft.content.sections.length > 40) return "حداکثر ۴۰ بخش در هر صفحه مجاز است.";
  const keys = new Set<string>();
  const orders = new Set<number>();
  for (const section of draft.content.sections) {
    if (keys.has(section.key) || orders.has(section.order)) return "شناسه و ترتیب بخش‌ها باید یکتا باشند.";
    keys.add(section.key); orders.add(section.order);
    if (section.kind === "TEXT" && !hasText(section.body)) return "متن بخش‌های اضافه‌شده را تکمیل کنید.";
    if (section.kind === "FEATURE_LIST") {
      if (!hasText(section.heading)) return "عنوان بخش امکانات را تکمیل کنید.";
      if (section.items.length > 30) return "هر فهرست می‌تواند حداکثر ۳۰ مورد داشته باشد.";
      const itemKeys = new Set<string>();
      for (const item of section.items) {
        if (itemKeys.has(item.key)) return "شناسه‌های موارد امکانات باید یکتا باشند.";
        itemKeys.add(item.key);
        if (!hasText(item.label)) return "عنوان هر مورد از امکانات را تکمیل کنید.";
      }
    }
    if (section.kind === "FAQ") {
      if (section.items.length > 30) return "هر بخش پرسش‌های متداول می‌تواند حداکثر ۳۰ پرسش داشته باشد.";
      for (const item of section.items) {
        if (!hasText(item.question) || !hasText(item.answer)) return "پرسش و پاسخ هر مورد را تکمیل کنید.";
      }
    }
  }
  const catalog = draft.content.accommodationCatalog;
  if (catalog) {
    const categorySlugs = new Set<string>();
    const categoryOrders = new Set<number>();
    let roomTotal = 0;
    let suiteTotal = 0;
    for (const category of catalog.categories) {
      if (categorySlugs.has(category.slug) || categoryOrders.has(category.order)) return "شناسه و ترتیب دسته‌های اقامت باید یکتا باشند.";
      categorySlugs.add(category.slug); categoryOrders.add(category.order);
      if (!locales.every((language) => Boolean(category.title[language]?.trim()))) return "عنوان هر دسته را به فارسی، انگلیسی و عربی تکمیل کنید.";
      if (!Number.isSafeInteger(category.count) || category.count < 0 || category.count > 1000) return "تعداد دسته باید عدد صحیح غیرمنفی باشد.";
      if (category.kind === "ROOM") roomTotal += category.count; else suiteTotal += category.count;
    }
    if (roomTotal !== catalog.totalRooms || suiteTotal !== catalog.totalSuites) return "جمع تعداد اتاق‌ها و سوئیت‌ها باید با جمع کل دسته‌های متناظر برابر باشد.";
    if (roomTotal + suiteTotal > 1000) return "جمع واحدها از حد مجاز فراتر است.";
  }
  if (draft.media.length > 80) return "حداکثر ۸۰ تصویر در هر نسخه مجاز است.";
  const seen = new Set<string>();
  for (const item of draft.media) {
    if (!item.imageId.trim()) return "شناسه تصویر نمی‌تواند خالی باشد.";
    if (item.scope === "PROPERTY" && item.roomTypeId !== null) return "تصویر عمومی نباید شناسه اتاق داشته باشد.";
    if (item.scope === "ROOM_CATEGORY" && !item.roomTypeId) return "برای تصویر اتاق، شناسه دسته اتاق ضروری است.";
    const key = [item.scope, item.roomTypeId ?? "", item.slot, item.sortOrder].join("|");
    if (seen.has(key)) return "ترتیب تصاویر در یک گالری باید یکتا باشد.";
    seen.add(key);
  }
  return null;
}

export function addAccommodationCategory(catalog: NonNullable<EditorContent["accommodationCatalog"]>) {
  if (catalog.categories.length >= 30) return catalog;
  const slugs = new Set(catalog.categories.map((category) => category.slug));
  let index = 1;
  while (slugs.has(`accommodation-${index}`)) index++;
  const order = catalog.categories.reduce((maximum, category) => Math.max(maximum, category.order), -1) + 1;
  return { ...catalog, categories: [...catalog.categories, { slug: `accommodation-${index}`, kind: "ROOM" as const, order, visible: false, count: 0, title: {}, description: {}, amenities: [], capacitySpecification: {} }] };
}
export type HotelCmsSectionKind = EditorContent["sections"][number]["kind"];
export function addSection(content: EditorContent, kind: HotelCmsSectionKind): EditorContent {
  if (content.sections.length >= 40) return content;
  const keys = new Set(content.sections.map((section) => section.key));
  let index = 1;
  while (keys.has(`section-${index}`)) index++;
  const order = content.sections.reduce((maximum, section) => Math.max(maximum, section.order), -1) + 1;
  const common = { key: `section-${index}`, order, visible: true };
  const section: EditorContent["sections"][number] =
    kind === "TEXT" ? { ...common, kind, heading: {}, body: {} } :
    kind === "FEATURE_LIST" ? { ...common, kind, heading: {}, items: [] } :
    { ...common, kind: "FAQ", heading: {}, items: [] };
  return { ...content, sections: [...content.sections, section] };
}
export function addTextSection(content: EditorContent): EditorContent { return addSection(content, "TEXT"); }

/** Reorders sections using the persisted order field while leaving all other
 * section data untouched. Sorting is deterministic for legacy drafts. */
export const moveSection = moveWebsiteSection<EditorContent>;

export function addFeatureItem(section: Extract<EditorContent["sections"][number], { kind: "FEATURE_LIST" }>) {
  if (section.items.length >= 30) return section;
  const keys = new Set(section.items.map((item) => item.key));
  let index = 1;
  while (keys.has(`feature-${index}`)) index++;
  return { ...section, items: [...section.items, { key: `feature-${index}`, label: {} }] };
}
export function addFaqItem(section: Extract<EditorContent["sections"][number], { kind: "FAQ" }>) {
  if (section.items.length >= 30) return section;
  return { ...section, items: [...section.items, { question: {}, answer: {} }] };
}
