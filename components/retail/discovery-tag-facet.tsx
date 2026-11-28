"use client";

import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { MAX_PRODUCT_TAGS, tagIdentityKey } from "@/lib/retail/product-taxonomy-utils";

type TagOption = { value: string; count: number };
type Props = {
  tags: TagOption[];
  selectedTags: readonly string[];
  onChange: (tag: string, active: boolean) => void;
};

export function DiscoveryTagFacet({ tags, selectedTags, onChange }: Props) {
  const [search, setSearch] = useState("");
  const selectedKeys = useMemo(() => new Set(selectedTags.map(tagIdentityKey)), [selectedTags]);
  const filteredTags = useMemo(() => {
    const query = tagIdentityKey(search);
    return query ? tags.filter(tag => tagIdentityKey(tag.value).includes(query)) : tags;
  }, [search, tags]);

  return <details open className="group/facet min-w-0 border-t border-border/70 pt-3">
    <summary className="flex min-h-9 cursor-pointer list-none items-center gap-2 rounded-md text-sm font-semibold text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
      <span>تگ‌ها</span>{selectedTags.length > 0 && <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">{new Intl.NumberFormat("fa-IR").format(selectedTags.length)} انتخاب</span>}<ChevronDown aria-hidden className="ms-auto size-3.5 shrink-0 text-muted-foreground transition-transform group-open/facet:rotate-180" />
    </summary>
    <fieldset className="mt-2 min-w-0">
      <legend className="sr-only">تگ‌ها</legend>
      <p className="mb-2 text-xs leading-5 text-muted-foreground">با انتخاب چند تگ، کالاهایی با حداقل یکی از آن‌ها نمایش داده می‌شوند.</p>
      {tags.length > 8 && <label className="mb-2 grid gap-1 text-xs text-muted-foreground">
        <span className="sr-only">جست‌وجو در تگ‌ها</span>
        <input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="جست‌وجو در تگ‌ها" className="h-10 min-w-0 rounded-xl border border-input bg-background px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/30" />
      </label>}
      {tags.length === 0 ? <p className="rounded-lg px-2 py-3 text-sm text-muted-foreground">تگی برای فیلترکردن وجود ندارد.</p> : filteredTags.length === 0 ? <p className="rounded-lg px-2 py-3 text-sm text-muted-foreground">تگی با این عبارت پیدا نشد.</p> : <div role="group" aria-label="گزینه‌های تگ‌ها" className="grid max-h-56 gap-1.5 overflow-y-auto overscroll-contain rounded-xl border border-border/60 bg-muted/20 p-2 [scrollbar-width:thin] dark:[color-scheme:dark]">
        {filteredTags.map(tag => {
          const checked = selectedKeys.has(tagIdentityKey(tag.value));
          const disabled = !checked && selectedTags.length >= MAX_PRODUCT_TAGS;
          return <label key={tag.value} title={`${tag.value} · ${new Intl.NumberFormat("fa-IR").format(tag.count)} محصول در فروشگاه`} className={`relative min-w-0 ${disabled ? "cursor-not-allowed opacity-55" : "cursor-pointer"}`}>
            <input type="checkbox" checked={checked} disabled={disabled} onChange={event => onChange(tag.value, event.target.checked)} className="peer sr-only" aria-label={tag.value} />
            <span className="flex min-h-10 min-w-0 items-center gap-2 rounded-lg border border-border/60 bg-background px-2 text-[13px] text-foreground transition-colors hover:bg-muted peer-checked:border-primary peer-checked:bg-primary/10 peer-checked:font-semibold peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-1 peer-focus-visible:outline-ring">
              <span className="min-w-0 flex-1 truncate">{tag.value}</span><span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">{new Intl.NumberFormat("fa-IR").format(tag.count)}</span>
            </span>
          </label>;
        })}
      </div>}
      {selectedTags.length >= MAX_PRODUCT_TAGS && <p role="status" className="mt-2 text-xs text-muted-foreground">حداکثر ۳۰ تگ را می‌توانید هم‌زمان انتخاب کنید.</p>}
    </fieldset>
  </details>;
}
