"use client";

import { formatRetailSize } from "@/lib/retail/format-size";
import { compareRetailSizes, normalizeRetailDigits } from "@/lib/retail/product-detail";
import { findRetailOptionDefinition } from "@/lib/retail/merchant-size-input";
import { Trash2 } from "lucide-react";

export type RetailVariantMatrixDraft = {
  id?: string;
  name: string;
  sku: string;
  price: string;
  inventory: string;
  reservedQuantity: number;
  options: Record<string, string>;
  manuallyUnavailable: boolean;
};

export type RetailVariantMatrixDefinition = { id: string; key: string; label: string };
type Locale = "fa" | "en" | "ar";

type Props = {
  variants: RetailVariantMatrixDraft[];
  definitions: RetailVariantMatrixDefinition[];
  locale: Locale;
  basePrice: number;
  onUpdate: (index: number, patch: Partial<RetailVariantMatrixDraft>) => void;
  onOpenDetails: (index: number) => void;
  onRequestDelete: (indices: number[], label: string) => void;
  disabled?: boolean;
};

const copy = {
  fa: { color: "رنگ", size: "سایز", inventory: "موجودی", price: "قیمت اختصاصی", inherit: "قیمت پایه", unavailable: "غیرفعال برای خرید", available: "فعال برای فروش", details: "جزئیات", variant: "گونه", sku: "شناسه کالا", none: "—", empty: "گونه‌ای تعریف نشده است", base: "قیمت پایه", deleteColor: "حذف رنگ", deleteSize: "حذف سایز", deleteVariant: "حذف گونه" },
  en: { color: "Color", size: "Size", inventory: "Inventory", price: "Price override", inherit: "Base price", unavailable: "Unavailable", available: "Enabled for sale", details: "Details", variant: "Variant", sku: "SKU", none: "—", empty: "No variants defined", base: "Base price", deleteColor: "Delete color", deleteSize: "Delete size", deleteVariant: "Delete variant" },
  ar: { color: "اللون", size: "المقاس", inventory: "المخزون", price: "سعر مخصص", inherit: "السعر الأساسي", unavailable: "غير متاح للبيع", available: "متاح للبيع", details: "التفاصيل", variant: "الخيار", sku: "رمز المنتج", none: "—", empty: "لم يتم تعريف خيارات", base: "السعر الأساسي", deleteColor: "حذف اللون", deleteSize: "حذف المقاس", deleteVariant: "حذف الخيار" },
} as const;

function optionValue(variant: RetailVariantMatrixDraft, definition: RetailVariantMatrixDefinition) {
  return variant.options[definition.id] ?? variant.options[definition.key] ?? "";
}
function inputNumber(value: string) { return normalizeRetailDigits(value); }
function canonicalSize(value: string) { return normalizeRetailDigits(value).replace(/٫/g, ".").trim(); }

export default function RetailVariantMatrix({ variants, definitions, locale, basePrice, onUpdate, onOpenDetails, onRequestDelete, disabled = false }: Props) {
  const t = copy[locale];
  const colorDefinition = findRetailOptionDefinition(definitions, variants, "color");
  const sizeDefinition = findRetailOptionDefinition(definitions, variants, "size");
  const rtl = locale !== "en";
  const money = new Intl.NumberFormat(locale === "fa" ? "fa-IR" : locale === "ar" ? "ar" : "en", { maximumFractionDigits: 0 }).format(basePrice);

  const editor = (index: number, variant: RetailVariantMatrixDraft, color: string, size: string) => {
    const identity = variant.sku || variant.id || `${t.variant} ${index + 1}`;
    const label = `${color}, ${t.size} ${formatRetailSize(size, locale)} · ${identity}`;
    return <div className="flex min-w-[9.5rem] flex-col gap-1.5 rounded-md border border-border bg-card p-2 text-card-foreground" key={`${variant.id ?? index}:${index}`}>
      <p className="break-all text-[10px] text-muted-foreground" title={identity}>{variant.sku ? `${t.sku}: ${variant.sku}` : variant.id ? `${t.variant}: ${variant.id.slice(-8)}` : `${t.variant} ${index + 1}`}</p>
      <label className="text-[11px] text-muted-foreground" htmlFor={`retail-inventory-${index}`}>{t.inventory}</label>
      <input id={`retail-inventory-${index}`} aria-label={`${t.inventory} · ${label}`} className="h-8 w-full rounded border border-input bg-background px-2 text-sm tabular-nums" type="text" inputMode="numeric" value={formatRetailSize(variant.inventory, locale)} disabled={disabled} onChange={event => onUpdate(index, { inventory: inputNumber(event.target.value) })} />
      <label className="text-[11px] text-muted-foreground" htmlFor={`retail-price-${index}`}>{t.price}</label>
      <input id={`retail-price-${index}`} aria-label={`${t.price} · ${label} (${t.inherit}: ${money})`} placeholder={t.base} title={`${t.inherit}: ${money}`} className="h-8 w-full rounded border border-input bg-background px-2 text-sm tabular-nums placeholder:text-muted-foreground" type="text" inputMode="numeric" value={formatRetailSize(variant.price, locale)} disabled={disabled} onChange={event => onUpdate(index, { price: inputNumber(event.target.value) })} />
      <div className="flex items-center justify-between gap-1">
        <span className={`text-[11px] ${variant.manuallyUnavailable ? "text-destructive" : "text-muted-foreground"}`}>{variant.manuallyUnavailable ? t.unavailable : t.available}</span>
        <div className="flex items-center gap-1"><button type="button" className="rounded px-1.5 py-1 text-xs text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50" disabled={disabled} aria-label={`${t.details}: ${label}`} onClick={() => onOpenDetails(index)}>{t.details}</button><button type="button" className="inline-flex min-h-8 min-w-8 items-center justify-center rounded text-destructive hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50" disabled={disabled} aria-label={`${t.deleteVariant}: ${label}`} title={t.deleteVariant} onClick={() => onRequestDelete([index], label)}><Trash2 aria-hidden="true" className="size-4" /></button></div>
      </div>
    </div>;
  };

  if (!variants.length) return <p className="rounded-md border border-border p-3 text-sm text-muted-foreground">{t.empty}</p>;

  if (!colorDefinition || !sizeDefinition) return <div dir={rtl ? "rtl" : "ltr"} className="max-h-[28rem] overflow-auto rounded-md border border-border">
    <table className="w-full min-w-[34rem] border-collapse text-sm">
      <thead className="sticky top-0 z-10 bg-muted text-start"><tr><th className="p-2">{t.variant}</th><th className="p-2">{t.sku}</th><th className="p-2">{t.inventory}</th><th className="p-2">{t.price}</th><th className="p-2">{t.base}</th><th className="p-2">{t.available}</th><th className="p-2">{t.details}</th><th className="p-2"><span className="sr-only">{t.deleteVariant}</span></th></tr></thead>
      <tbody>{variants.map((variant, index) => <tr key={variant.id ?? index} className="border-t border-border"><th scope="row" className="p-2 text-start font-medium">{variant.name || Object.values(variant.options).filter(Boolean).join(" · ") || `${t.variant} ${index + 1}`}</th><td className="p-2 text-muted-foreground">{variant.sku || t.none}</td><td className="p-2"><input aria-label={`${t.inventory} · ${variant.name || variant.sku || index + 1}`} className="h-8 w-24 rounded border border-input bg-background px-2 tabular-nums" type="text" inputMode="numeric" value={formatRetailSize(variant.inventory, locale)} disabled={disabled} onChange={event => onUpdate(index, { inventory: inputNumber(event.target.value) })} /></td><td className="p-2"><input aria-label={`${t.price} · ${variant.name || variant.sku || index + 1} (${money})`} title={`${t.inherit}: ${money}`} className="h-8 w-28 rounded border border-input bg-background px-2 tabular-nums placeholder:text-muted-foreground" placeholder={t.base} type="text" inputMode="numeric" value={formatRetailSize(variant.price, locale)} disabled={disabled} onChange={event => onUpdate(index, { price: inputNumber(event.target.value) })} /></td><td className="p-2 text-muted-foreground">{money}</td><td className="p-2"><span className={variant.manuallyUnavailable ? "text-destructive" : "text-muted-foreground"}>{variant.manuallyUnavailable ? t.unavailable : t.available}</span></td><td className="p-2"><button type="button" className="text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50" disabled={disabled} onClick={() => onOpenDetails(index)}>{t.details}</button></td><td className="p-2"><button type="button" disabled={disabled} aria-label={`${t.deleteVariant}: ${variant.name || variant.sku || index + 1}`} onClick={() => onRequestDelete([index], variant.name || variant.sku || `${t.variant} ${index + 1}`)} className="inline-flex min-h-8 min-w-8 items-center justify-center rounded text-destructive hover:bg-destructive/10 disabled:opacity-50"><Trash2 aria-hidden="true" className="size-4" /></button></td></tr>)}</tbody>
    </table>
  </div>;

  const colors = [...new Set(variants.map(variant => optionValue(variant, colorDefinition)).filter(Boolean))];
  const sizes = [...new Map(variants.map(variant => optionValue(variant, sizeDefinition)).filter(Boolean).map(size => [canonicalSize(size), size])).values()].sort(compareRetailSizes);
  const byCombination = new Map<string, number[]>();
  variants.forEach((variant, index) => {
    const color = optionValue(variant, colorDefinition), size = optionValue(variant, sizeDefinition);
    if (!color || !size) return;
    const key = JSON.stringify([color, canonicalSize(size)]);
    byCombination.set(key, [...(byCombination.get(key) ?? []), index]);
  });
  const combination = (color: string, size: string) => byCombination.get(JSON.stringify([color, canonicalSize(size)])) ?? [];

  return <div dir={rtl ? "rtl" : "ltr"} className="max-h-[30rem] max-w-full overflow-auto rounded-md border border-border">
    <table className="w-max min-w-full border-collapse text-sm">
      <caption className="sr-only">{`${colorDefinition.label} × ${sizeDefinition.label} ${t.variant}`}</caption>
      <thead className="sticky top-0 z-20 bg-muted text-start"><tr><th scope="col" className="sticky start-0 z-30 min-w-28 border-b border-e border-border bg-muted p-2">{colorDefinition.label || t.color}</th>{sizes.map(size => <th scope="col" key={canonicalSize(size)} className="min-w-40 border-b border-border p-2 text-center"><div className="flex items-center justify-center gap-2"><span>{formatRetailSize(size, locale)}</span><button type="button" disabled={disabled} aria-label={`${t.deleteSize}: ${size}`} title={t.deleteSize} onClick={() => onRequestDelete(variants.flatMap((variant, index) => canonicalSize(optionValue(variant, sizeDefinition)) === canonicalSize(size) ? [index] : []), `${sizeDefinition.label}: ${formatRetailSize(size, locale)}`)} className="inline-flex min-h-8 min-w-8 items-center justify-center rounded text-destructive hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"><Trash2 aria-hidden="true" className="size-4" /></button></div></th>)}</tr></thead>
      <tbody>{colors.map(color => <tr key={color} className="border-t border-border"><th scope="row" className="sticky start-0 z-10 border-e border-border bg-card p-2 text-start align-top font-medium"><div className="flex items-center justify-between gap-2"><span>{color}</span><button type="button" disabled={disabled} aria-label={`${t.deleteColor}: ${color}`} title={t.deleteColor} onClick={() => onRequestDelete(variants.flatMap((variant, index) => optionValue(variant, colorDefinition) === color ? [index] : []), `${colorDefinition.label}: ${color}`)} className="inline-flex min-h-8 min-w-8 items-center justify-center rounded text-destructive hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"><Trash2 aria-hidden="true" className="size-4" /></button></div></th>{sizes.map(size => {
        const indices = combination(color, size);
        return <td key={canonicalSize(size)} className="border-s border-border p-2 align-top">{indices.length ? <div className="flex flex-col gap-2">{indices.map(index => editor(index, variants[index], color, optionValue(variants[index], sizeDefinition)))}</div> : <span aria-label={`${color}, ${formatRetailSize(size, locale)}: ${locale === "fa" ? "تعریف نشده" : locale === "ar" ? "غير معرّف" : "Not created"}`} className="block py-2 text-center text-muted-foreground">{t.none}</span>}</td>;
      })}</tr>)}</tbody>
    </table>
    {variants.some(variant => !optionValue(variant, colorDefinition) || !optionValue(variant, sizeDefinition)) && <div className="border-t border-border p-2">
      <p className="mb-2 text-xs font-medium text-muted-foreground">{t.variant}</p><div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{variants.map((variant, index) => ({ variant, index })).filter(({ variant }) => !optionValue(variant, colorDefinition) || !optionValue(variant, sizeDefinition)).map(({ variant, index }) => editor(index, variant, optionValue(variant, colorDefinition) || t.color, optionValue(variant, sizeDefinition) || t.size))}</div>
    </div>}
  </div>;
}
