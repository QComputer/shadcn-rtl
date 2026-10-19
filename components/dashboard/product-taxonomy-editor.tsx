"use client";

import { useEffect, useState } from "react";

export type TaxonomyCategoryChoice = { id: string; name: string; isActive?: boolean };

type TaxonomyResponse = {
  primaryCategoryId: string;
  categoryIds: string[];
  tags: Array<{ id: string; name: string }>;
};

/**
 * Additive H2 editor. Mount inside an existing merchant product edit screen.
 * Parent must provide categories from the active authenticated organization only.
 * API enforces ownership again; the browser is not trusted for tenant identity.
 */
export function ProductTaxonomyEditor({
  productId, categories,
}: { productId: string; categories: TaxonomyCategoryChoice[] }) {
  const [primary, setPrimary] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [tagText, setTagText] = useState("");
  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    let active = true;
    setBusy(true);
    setError(null);
    fetch(`/api/products/${encodeURIComponent(productId)}/taxonomy`, {
      credentials: "same-origin", cache: "no-store",
    }).then(async response => {
      if (!response.ok) throw new Error("اطلاعات دسته‌بندی و تگ دریافت نشد.");
      return (await response.json()) as TaxonomyResponse;
    }).then(result => {
      if (!active) return;
      setPrimary(result.primaryCategoryId);
      setSelected(result.categoryIds);
      setTagText(result.tags.map(tag => tag.name).join("، "));
    }).catch(() => { if (active) setError("دریافت اطلاعات محصول ممکن نشد."); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [productId]);

  const toggle = (id: string) => {
    if (id === primary) return;
    setSuccess(false);
    setSelected(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);
  };

  const save = async () => {
    if (busy || saving || !primary) return;
    setError(null);
    setSuccess(false);
    setSaving(true);
    const tags = tagText.split(/[,،\n]/u).map(item => item.trim()).filter(Boolean);
    try {
      const response = await fetch(`/api/products/${encodeURIComponent(productId)}/taxonomy`, {
        method: "PATCH", credentials: "same-origin", cache: "no-store",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ categoryIds: selected, tagNames: tags }),
      });
      if (!response.ok) throw new Error("ذخیره انجام نشد. دسته‌ها و تگ‌ها را بررسی کنید.");
      const updated = (await response.json()) as TaxonomyResponse;
      setSelected(updated.categoryIds);
      setTagText(updated.tags.map(item => item.name).join("، "));
      setSuccess(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "خطا در ذخیره اطلاعات.");
    } finally { setSaving(false); }
  };

  return (
    <section dir="rtl" className="space-y-4 rounded-xl border p-4" aria-label="دسته‌بندی‌ها و تگ‌های محصول">
      <div>
        <h3 className="font-semibold">دسته‌بندی‌ها و تگ‌ها</h3>
        <p className="mt-1 text-sm text-muted-foreground">محصول می‌تواند در چند دسته دیده شود. دسته اصلی با علامت مشخص است.</p>
      </div>
      {busy ? <p role="status">در حال بارگذاری…</p> : (
        <>
          <fieldset className="grid gap-2 sm:grid-cols-2" disabled={saving}>
            <legend className="mb-2 text-sm font-medium">دسته‌بندی‌های محصول</legend>
            {categories.map(category => (
              <label key={category.id} className="flex items-center gap-2 rounded-md border p-2 text-sm">
                <input type="checkbox" checked={selected.includes(category.id) || primary === category.id}
                  disabled={category.id === primary || category.isActive === false}
                  onChange={() => toggle(category.id)} />
                <span>{category.name}</span>
                {category.id === primary && <span className="text-xs text-muted-foreground">(اصلی)</span>}
              </label>
            ))}
          </fieldset>
          <label className="block space-y-1 text-sm">
            <span className="font-medium">تگ‌ها</span>
            <textarea className="w-full rounded-md border bg-background p-2" value={tagText}
              disabled={saving} rows={2} onChange={event => { setTagText(event.target.value); setSuccess(false); }}
              placeholder="مثلاً: اسپرت، راحت، مناسب پیاده‌روی" />
            <span className="block text-xs text-muted-foreground">هر تگ را با ویرگول جدا کنید. حداکثر ۳۰ تگ.</span>
          </label>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          {success && <p role="status" className="text-sm">دسته‌بندی‌ها و تگ‌ها ذخیره شدند.</p>}
          <button type="button" onClick={save} disabled={saving || !primary}
            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50">
            {saving ? "در حال ذخیره…" : "ذخیره دسته‌بندی‌ها و تگ‌ها"}
          </button>
        </>
      )}
    </section>
  );
}
