"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ImagePlus, Trash2, Upload } from "lucide-react";
import { RetailMediaPicker, type RetailImage } from "./retail-media-picker";

type Locale = "fa" | "en" | "ar";
type Props = {
  locale: Locale;
  purpose?: "product" | "category";
  title?: string;
  className?: string;
  imageId: string | null | undefined;
  imageUrl: string | null;
  disabled: boolean;
  onChange(id: string | null, url: string | null): void;
  onUploadingChange(uploading: boolean): void;
};

const labels = {
  fa: { image: "تصویر دسته‌بندی (اختیاری)", choose: "انتخاب از گالری", upload: "بارگذاری تصویر", remove: "حذف تصویر", uploading: "در حال بارگذاری…", failed: "بارگذاری تصویر انجام نشد. دوباره تلاش کنید." },
  en: { image: "Category image (optional)", choose: "Choose from gallery", upload: "Upload image", remove: "Remove image", uploading: "Uploading…", failed: "Image upload failed. Try again." },
  ar: { image: "صورة الفئة (اختياري)", choose: "اختيار من المعرض", upload: "تحميل صورة", remove: "إزالة الصورة", uploading: "جارٍ التحميل…", failed: "تعذر تحميل الصورة. حاول مرة أخرى." },
} as const;

export function CategoryImageField({ locale, imageId, imageUrl, disabled, onChange, onUploadingChange, purpose = "category", title, className = "sm:col-span-2" }: Props) {
  const t = labels[locale];
  const [pickerOpen, setPickerOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(false);
  const mounted = useRef(false);
  const uploadController = useRef<AbortController | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; uploadController.current?.abort(); };
  }, []);

  async function upload(file: File) {
    setUploading(true);
    onUploadingChange(true);
    setError(false);
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("purpose", purpose);
      const controller = new AbortController();
      uploadController.current = controller;
      const response = await fetch("/api/dashboard/retail/media", { method: "POST", credentials: "same-origin", body: form, signal: controller.signal });
      const payload = await response.json() as { image?: RetailImage };
      if (!response.ok || !payload.image?.id || !payload.image.url) throw new Error("category-image-upload-failed");
      if (!mounted.current) return;
      onChange(payload.image.id, payload.image.url);
    } catch {
      if (mounted.current) setError(true);
    } finally {
      uploadController.current = null;
      if (mounted.current) {
        setUploading(false);
        onUploadingChange(false);
      }
    }
  }

  async function chooseImage(id: string, fallbackUrl: string | null) {
    setUploading(true);
    onUploadingChange(true);
    setError(false);
    try {
      const controller = new AbortController();
      uploadController.current = controller;
      const response = await fetch(`/api/dashboard/retail/media/${encodeURIComponent(id)}/optimize`, { method: "POST", credentials: "same-origin", signal: controller.signal });
      if (!response.ok) throw new Error("image-optimization-failed");
      const payload = await response.json() as { image?: RetailImage };
      if (mounted.current) onChange(id, payload.image?.url ?? fallbackUrl);
    } catch {
      if (mounted.current) setError(true);
    } finally {
      uploadController.current = null;
      if (mounted.current) { setUploading(false); onUploadingChange(false); }
    }
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <span className="block text-sm font-medium">{title ?? t.image}</span>
      {imageUrl && <div className="flex items-center gap-3 rounded-lg border p-2">
        <Image src={imageUrl} alt="" width={96} height={96} unoptimized className="size-20 rounded-md object-cover" />
        <button type="button" disabled={disabled || uploading} onClick={() => onChange(null, null)} className="inline-flex min-h-10 items-center gap-2 rounded-md border px-3 text-sm hover:bg-muted disabled:opacity-50"><Trash2 className="size-4" aria-hidden="true" />{t.remove}</button>
      </div>}
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={disabled || uploading} onClick={() => setPickerOpen(true)} className="inline-flex min-h-10 items-center gap-2 rounded-md border px-3 text-sm hover:bg-muted disabled:opacity-50"><ImagePlus className="size-4" aria-hidden="true" />{t.choose}</button>
        <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm hover:bg-muted has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50"><Upload className="size-4" aria-hidden="true" />{uploading ? t.uploading : t.upload}<input type="file" accept="image/*" disabled={disabled || uploading} className="sr-only" onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; if (file) void upload(file); }} /></label>
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{t.failed}</p>}
      <RetailMediaPicker locale={locale} open={pickerOpen} onOpenChange={setPickerOpen} selectedIds={imageId ? [imageId] : []} maxSelection={1} disabled={disabled || uploading} onConfirm={(ids, images) => { const id = ids[0] ?? null; if (!id) { setPickerOpen(false); return; } const image = images.find((item) => item.id === id); if (!image && id !== imageId) return; setPickerOpen(false); void chooseImage(id, image?.url ?? imageUrl); }} />
    </div>
  );
}
