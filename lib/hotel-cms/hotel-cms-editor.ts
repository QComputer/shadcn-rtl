import type { HotelWebsiteContent, HotelWebsiteMediaAssociationInput } from "@/lib/hotel/content/hotel-website-contract";
import type { HotelCmsDraft, HotelCmsLocale } from "./hotel-cms-api";

export type EditorContent = HotelWebsiteContent;
export type EditorMedia = HotelWebsiteMediaAssociationInput;
export const locales: readonly HotelCmsLocale[] = ["fa", "en", "ar"];

export function blankContent(): EditorContent {
  return { title: {}, hero: { heading: {} }, introduction: { body: {} }, sections: [], contact: {} };
}
export function blankDraft(): HotelCmsDraft { return { content: blankContent(), media: [] }; }
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
export type HotelCmsSectionKind = EditorContent["sections"][number]["kind"];
export function addSection(content: EditorContent, kind: HotelCmsSectionKind): EditorContent {
  if (content.sections.length >= 40) return content;
  const keys = new Set(content.sections.map((section) => section.key));
  const orders = new Set(content.sections.map((section) => section.order));
  let index = 1;
  while (keys.has(`section-${index}`)) index++;
  let order = 0;
  while (orders.has(order)) order++;
  const common = { key: `section-${index}`, order, visible: true };
  const section: EditorContent["sections"][number] =
    kind === "TEXT" ? { ...common, kind, heading: {}, body: {} } :
    kind === "FEATURE_LIST" ? { ...common, kind, heading: {}, items: [] } :
    { ...common, kind: "FAQ", heading: {}, items: [] };
  return { ...content, sections: [...content.sections, section] };
}
export function addTextSection(content: EditorContent): EditorContent { return addSection(content, "TEXT"); }

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
