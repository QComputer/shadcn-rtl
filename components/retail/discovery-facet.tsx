"use client";

import { ChevronDown } from "lucide-react";
import { compareRetailSizes, reliableColorSwatch } from "@/lib/retail/product-detail";

type Attribute = { key: string; label: string; scope: "PRODUCT" | "VARIANT_OPTION"; values: Array<{ value: string; count: number }> };
type Props = { attribute: Attribute; filters: readonly string[]; onChange: (key: string, value: string, active: boolean) => void };

export function DiscoveryFacet({ attribute, filters, onChange }: Props) {
  const isSize = /size|سایز|اندازه|شماره/i.test(`${attribute.key} ${attribute.label}`);
  const isColor = /colou?r|رنگ/i.test(`${attribute.key} ${attribute.label}`);
  const values = isSize ? [...attribute.values].sort((a, b) => compareRetailSizes(a.value, b.value)) : attribute.values;
  const selectedCount = values.filter(item => filters.includes(`${attribute.key}:${item.value}`)).length;

  return <details open className="group/facet min-w-0 border-t border-border/70 pt-3">
    <summary className="flex min-h-9 cursor-pointer list-none items-center gap-2 rounded-md text-xs font-semibold text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
      <span>{attribute.label}</span>{selectedCount > 0 && <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">{new Intl.NumberFormat("fa-IR").format(selectedCount)} انتخاب</span>}<ChevronDown aria-hidden className="ms-auto size-3.5 shrink-0 text-muted-foreground transition-transform group-open/facet:rotate-180" />
    </summary>
    <fieldset className="mt-2 min-w-0"><legend className="sr-only">{attribute.label}</legend>
      <div role="group" aria-label={`گزینه‌های ${attribute.label}`} tabIndex={0} className={`grid max-h-44 content-start gap-1.5 overflow-y-auto overscroll-contain rounded-xl border border-border/60 bg-muted/20 p-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring [scrollbar-width:thin] dark:[color-scheme:dark] ${isSize ? "grid-cols-4" : "grid-cols-2"}`}>
        {values.map(item => {
          const checked = filters.includes(`${attribute.key}:${item.value}`);
          const swatch = isColor ? reliableColorSwatch(item.value) : undefined;
          return <label key={item.value} title={`${item.value} · ${new Intl.NumberFormat("fa-IR").format(item.count)} محصول در فروشگاه`} className="relative min-w-0 cursor-pointer">
            <input type="checkbox" checked={checked} onChange={event => onChange(attribute.key, item.value, event.target.checked)} className="peer sr-only" aria-label={`${attribute.label}: ${item.value}`} />
            <span className={`flex min-h-10 min-w-0 items-center gap-1.5 rounded-lg border border-border/60 bg-background px-1.5 text-[11px] text-foreground transition-colors hover:bg-muted peer-checked:border-primary peer-checked:bg-primary/10 peer-checked:font-semibold peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-1 peer-focus-visible:outline-ring ${isSize ? "justify-center tabular-nums" : ""}`}>
              {swatch && <span aria-hidden className="size-3 shrink-0 rounded-full border border-foreground/20" style={{ backgroundColor: swatch }} />}<span className={isSize ? "" : "min-w-0 flex-1 truncate"}>{item.value}</span>
              {!isSize && <span aria-hidden className="ms-auto text-[9px] tabular-nums text-muted-foreground">{new Intl.NumberFormat("fa-IR").format(item.count)}</span>}
            </span>
          </label>;
        })}
      </div>
      {isSize && values.length > 12 && <p className="mt-1.5 text-[10px] leading-5 text-muted-foreground">برای دیدن همهٔ سایزها، داخل کادر پیمایش کنید.</p>}
    </fieldset>
  </details>;
}
