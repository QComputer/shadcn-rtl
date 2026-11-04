"use client";

import { useId, useMemo, useState } from "react";

import { CategoryImageField } from "./category-image-field";

export type AppearancePair = {
  lightImageId?: string | null;
  darkImageId?: string | null;
};

export type AppearanceGroup = AppearancePair & { definitionId: string; value: string };
export type VariantAppearance = AppearancePair & { variantId: string };
export type ProductAppearanceSettings = {
  appearance?: AppearancePair;
  appearanceGroups?: AppearanceGroup[];
  variantAppearances?: VariantAppearance[];
};

type Locale = "fa" | "en" | "ar";
type Definition = { id: string; key: string; label: string };
type Variant = { id?: string; options: Record<string, string> };
type Image = { id: string; url: string };

const labels = {
  fa: { title: "تصاویر روشن و تاریک کارت", help: "این تصاویر برای نمایش کارت محصول در حالت روشن یا تاریک استفاده می‌شوند. در صورت خالی بودن، تصویر معمول محصول نمایش داده می‌شود.", product: "تصویر پیش‌فرض محصول", light: "تصویر حالت روشن", dark: "تصویر حالت تاریک", groups: "تصویر بر اساس گزینه محصول", variants: "جایگزینی برای گونه‌های موجود", empty: "برای گزینه‌های محصول، تصویری جداگانه تنظیم نشده است.", override: "تنظیم تصویر روشن و تاریک برای این گونه" },
  en: { title: "Light and dark card images", help: "These images are used for product cards in light or dark mode. If a field is empty, the regular product image is used.", product: "Product default images", light: "Light mode image", dark: "Dark mode image", groups: "Images by product option", variants: "Overrides for existing variants", empty: "No separate images are set for product options.", override: "Set light and dark images for this variant" },
  ar: { title: "صور البطاقة الفاتحة والداكنة", help: "تُستخدم هذه الصور لبطاقة المنتج في الوضع الفاتح أو الداكن. عند ترك الحقل فارغًا، تظهر صورة المنتج العادية.", product: "الصور الافتراضية للمنتج", light: "صورة الوضع الفاتح", dark: "صورة الوضع الداكن", groups: "صور حسب خيار المنتج", variants: "بدائل للخيارات الموجودة", empty: "لم يتم تعيين صور منفصلة لخيارات المنتج.", override: "تعيين صور فاتحة وداكنة لهذا الخيار" },
} as const;

function isSize(definition: Definition) {
  return /size|sizing|سایز|اندازه|مقاس/i.test(`${definition.key} ${definition.label}`);
}

function groupKey(definitionId: string, value: string) {
  return JSON.stringify([definitionId, value]);
}

export function ProductAppearanceEditor({
  locale,
  definitions,
  variants,
  images,
  value,
  onChange,
  onUploadingChange,
  disabled,
}: {
  locale: Locale;
  definitions: Definition[];
  variants: Variant[];
  images: Image[];
  value: ProductAppearanceSettings;
  onChange(value: ProductAppearanceSettings): void;
  onUploadingChange(uploading: boolean): void;
  disabled: boolean;
}) {
  const t = labels[locale];
  const id = useId();
  const [resolvedUrls, setResolvedUrls] = useState<Record<string, string>>({});
  const imageById = useMemo(() => new Map(images.map(image => [image.id, image])), [images]);
  const optionValues = useMemo(() => {
    const result: Array<{ definitionId: string; label: string; value: string }> = [];
    for (const definition of definitions.filter(item => !isSize(item))) {
      for (const optionValue of [...new Set(variants.map(variant => variant.options[definition.id]).filter(Boolean))]) {
        result.push({ definitionId: definition.id, label: definition.label, value: optionValue });
      }
    }
    return result;
  }, [definitions, variants]);

  function setPair(target: "appearance" | "appearanceGroups" | "variantAppearances", key: string | null, mode: "lightImageId" | "darkImageId", imageId: string | null) {
    if (target === "appearance") {
      onChange({ ...value, appearance: { ...value.appearance, [mode]: imageId } });
    } else if (target === "appearanceGroups") {
      const group = optionValues.find(item => groupKey(item.definitionId, item.value) === key);
      if (!group) return;
      const entries = [...(value.appearanceGroups ?? [])];
      const index = entries.findIndex(item => item.definitionId === group.definitionId && item.value === group.value);
      const next: AppearanceGroup = { ...(index >= 0 ? entries[index] : {}), definitionId: group.definitionId, value: group.value, [mode]: imageId };
      if (index >= 0) entries[index] = next;
      else entries.push(next);
      onChange({ ...value, appearanceGroups: entries });
    } else {
      if (!key) return;
      const entries = [...(value.variantAppearances ?? [])];
      const index = entries.findIndex(item => item.variantId === key);
      const next: VariantAppearance = { ...(index >= 0 ? entries[index] : {}), variantId: key, [mode]: imageId };
      if (index >= 0) entries[index] = next;
      else entries.push(next);
      onChange({ ...value, variantAppearances: entries });
    }
  }

  function fields(pair: AppearancePair | undefined, prefix: string, setter: (mode: "lightImageId" | "darkImageId", imageId: string | null, imageUrl: string | null) => void) {
    return (['lightImageId', 'darkImageId'] as const).map(mode => {
      const title = mode === "lightImageId" ? t.light : t.dark;
      const imageId = pair?.[mode] ?? null;
      return <CategoryImageField key={`${prefix}-${mode}`} locale={locale} className="" purpose="product" title={`${title}${prefix ? ` · ${prefix}` : ""}`} imageId={imageId} imageUrl={imageId ? imageById.get(imageId)?.url ?? resolvedUrls[imageId] ?? null : null} disabled={disabled} onChange={(nextId, url) => { if (nextId && url) setResolvedUrls(current => ({ ...current, [nextId]: url })); setter(mode, nextId, url); }} onUploadingChange={onUploadingChange} />;
    });
  }

  return (
    <details className="rounded-xl border bg-card p-4">
      <summary className="cursor-pointer py-2 font-semibold">{t.title}</summary>
      <p className="mb-4 text-sm text-muted-foreground">{t.help}</p>
      <section aria-labelledby={`${id}-product`} className="grid gap-3 sm:grid-cols-2">
        <h3 id={`${id}-product`} className="font-medium sm:col-span-2">{t.product}</h3>
        {fields(value.appearance, "", (mode, imageId) => setPair("appearance", null, mode, imageId))}
      </section>

      <section aria-labelledby={`${id}-groups`} className="mt-5 space-y-4 border-t pt-4">
        <h3 id={`${id}-groups`} className="font-medium">{t.groups}</h3>
        {optionValues.length === 0 ? <p className="text-sm text-muted-foreground">{t.empty}</p> : optionValues.map(group => {
          const key = groupKey(group.definitionId, group.value);
          const pair = value.appearanceGroups?.find(item => item.definitionId === group.definitionId && item.value === group.value);
          const prefix = `${group.label}: ${group.value}`;
          return <fieldset key={key} className="grid gap-3 rounded-lg border p-3 sm:grid-cols-2"><legend className="px-1 text-sm font-medium">{prefix}</legend>{fields(pair, prefix, (mode, imageId) => setPair("appearanceGroups", key, mode, imageId))}</fieldset>;
        })}
      </section>

      <section aria-labelledby={`${id}-variants`} className="mt-5 space-y-4 border-t pt-4">
        <h3 id={`${id}-variants`} className="font-medium">{t.variants}</h3>
        {variants.filter(variant => variant.id).map(variant => {
          const pair = value.variantAppearances?.find(item => item.variantId === variant.id);
          const prefix = variant.options && Object.keys(variant.options).length ? definitions.map(definition => variant.options[definition.id] ? `${definition.label}: ${variant.options[definition.id]}` : null).filter(Boolean).join(" · ") : variant.id!;
          return <details key={variant.id} className="rounded-lg border p-3"><summary className="cursor-pointer text-sm font-medium">{prefix || variant.id}</summary><p className="my-3 text-xs text-muted-foreground">{t.override}</p><div className="grid gap-3 sm:grid-cols-2">{fields(pair, prefix, (mode, imageId) => setPair("variantAppearances", variant.id!, mode, imageId))}</div></details>;
        })}
      </section>
    </details>
  );
}
