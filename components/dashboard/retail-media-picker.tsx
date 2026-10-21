"use client";

import { memo, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import Image from "next/image";
import { ArrowDown, ArrowUp, Check, ImagePlus, LoaderCircle, Search, Trash2, Upload, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type RetailImage = { id: string; url: string; filename?: string | null; productNames?: string[] };
type Locale = "fa" | "en" | "ar";

const copy = {
  fa: {
    library: "انتخاب از کتابخانه تصاویر", addImages: "افزودن تصویر", empty: "هنوز تصویری به این گالری اضافه نشده است.",
    remove: "حذف تصویر", earlier: "جابجایی به قبل", later: "جابجایی به بعد", upload: "بارگذاری تصویر", uploading: "در حال بارگذاری…",
    title: "کتابخانه تصاویر", description: "تصاویر موردنظر را انتخاب کنید و سپس انتخاب را تأیید کنید.", search: "جستجوی نام فایل یا محصول", loading: "در حال دریافت تصاویر…",
    loadError: "دریافت تصاویر انجام نشد. دوباره تلاش کنید.", retry: "تلاش دوباره", none: "تصویری پیدا نشد.", more: "تصاویر بیشتر", selected: "انتخاب‌شده", confirm: "تأیید انتخاب", cancel: "انصراف",
    limit: "حداکثر ۲۰ تصویر می‌توانید انتخاب کنید.", selectedLimit: "به سقف ۲۰ تصویر رسیده‌اید.", pageError: "دریافت تصاویر بیشتر انجام نشد.",
  },
  en: {
    library: "Choose from image library", addImages: "Add images", empty: "No images have been added to this gallery.",
    remove: "Remove image", earlier: "Move earlier", later: "Move later", upload: "Upload images", uploading: "Uploading…",
    title: "Image library", description: "Choose images, then confirm your selection.", search: "Search filenames", loading: "Loading images…",
    loadError: "Could not load images. Try again.", retry: "Try again", none: "No images found.", more: "Load more", selected: "selected", confirm: "Confirm selection", cancel: "Cancel",
    limit: "You can select up to 20 images.", selectedLimit: "The 20 image limit has been reached.", pageError: "Could not load more images.",
  },
  ar: {
    library: "الاختيار من مكتبة الصور", addImages: "إضافة صور", empty: "لم تتم إضافة صور إلى هذا المعرض بعد.",
    remove: "إزالة الصورة", earlier: "نقل إلى الأعلى", later: "نقل إلى الأسفل", upload: "تحميل الصور", uploading: "جارٍ التحميل…",
    title: "مكتبة الصور", description: "اختر الصور ثم أكد اختيارك.", search: "البحث في أسماء الملفات", loading: "جارٍ تحميل الصور…",
    loadError: "تعذر تحميل الصور. حاول مرة أخرى.", retry: "إعادة المحاولة", none: "لم يتم العثور على صور.", more: "تحميل المزيد", selected: "محدد", confirm: "تأكيد الاختيار", cancel: "إلغاء",
    limit: "يمكنك اختيار ٢٠ صورة كحد أقصى.", selectedLimit: "تم الوصول إلى حد ٢٠ صورة.", pageError: "تعذر تحميل المزيد من الصور.",
  },
} as const;

export type AssignedGalleryProps = {
  images: RetailImage[];
  disabled?: boolean;
  onChange(ids: string[]): void;
  onOpenLibrary(): void;
  onUpload(files: File[]): Promise<void>;
  title: string;
  description?: string;
  locale: Locale;
};

function AssignedGalleryView({ images, disabled = false, onChange, onOpenLibrary, onUpload, title, description, locale }: AssignedGalleryProps) {
  const t = copy[locale];
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(false);

  async function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.currentTarget.files ?? []);
    event.currentTarget.value = "";
    if (!files.length) return;
    setUploading(true);
    setUploadError(false);
    try {
      await onUpload(files);
    } catch {
      setUploadError(true);
    } finally {
      setUploading(false);
    }
  }

  function move(index: number, offset: -1 | 1) {
    const target = index + offset;
    if (target < 0 || target >= images.length) return;
    const reordered = [...images];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    onChange(reordered.map((image) => image.id));
  }

  return (
    <section className="space-y-3" dir={locale === "en" ? "ltr" : "rtl"} aria-label={title}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">{title}</h3>
          {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={onOpenLibrary} disabled={disabled} className="inline-flex min-h-10 items-center gap-2 rounded-md border px-3 text-sm font-medium hover:bg-muted disabled:opacity-50">
            <ImagePlus className="size-4" aria-hidden="true" />{t.library}
          </button>
          <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm font-medium hover:bg-muted has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50">
            {uploading ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <Upload className="size-4" aria-hidden="true" />}
            {uploading ? t.uploading : t.upload}
            <input type="file" accept="image/*" multiple disabled={disabled || uploading} onChange={(event) => void handleUpload(event)} className="sr-only" />
          </label>
        </div>
      </div>
      {uploadError ? <p role="alert" className="text-sm text-destructive">{locale === "fa" ? "بارگذاری تصویر انجام نشد. نوع و اندازه فایل را بررسی و دوباره تلاش کنید." : "Image upload failed. Check its type and size and try again."}</p> : null}
      {images.length ? (
        <ol className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {images.map((image, index) => (
            <li key={image.id} className="overflow-hidden rounded-lg border bg-background">
              <Image src={image.url} alt={image.filename || `${title} ${index + 1}`} width={320} height={320} unoptimized className="aspect-square w-full object-cover" />
              <div className="flex items-center justify-between gap-1 p-2">
                <span className="truncate text-xs text-muted-foreground" title={image.filename ?? undefined}>{image.filename || `${index + 1} / ${images.length}`}</span>
                <div className="flex shrink-0 gap-1">
                  <button type="button" aria-label={t.earlier} title={t.earlier} disabled={disabled || index === 0} onClick={() => move(index, -1)} className="rounded p-1.5 hover:bg-muted disabled:opacity-40"><ArrowUp className="size-4" /></button>
                  <button type="button" aria-label={t.later} title={t.later} disabled={disabled || index === images.length - 1} onClick={() => move(index, 1)} className="rounded p-1.5 hover:bg-muted disabled:opacity-40"><ArrowDown className="size-4" /></button>
                  <button type="button" aria-label={t.remove} title={t.remove} disabled={disabled} onClick={() => onChange(images.filter((item) => item.id !== image.id).map((item) => item.id))} className="rounded p-1.5 text-destructive hover:bg-destructive/10 disabled:opacity-40"><Trash2 className="size-4" /></button>
                </div>
              </div>
            </li>
          ))}
        </ol>
      ) : <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground"><ImagePlus className="mx-auto mb-2 size-5" aria-hidden="true" />{t.empty}</p>}
    </section>
  );
}

export const AssignedGallery = memo(AssignedGalleryView);
AssignedGallery.displayName = "AssignedGallery";

type MediaResponse = { images?: RetailImage[]; nextCursor?: string | null };
type RetailMediaPickerProps = {
  open: boolean;
  onOpenChange(open: boolean): void;
  selectedIds: string[];
  onConfirm(ids: string[], images: RetailImage[]): void;
  locale: Locale;
  disabled?: boolean;
};

export function RetailMediaPicker({ open, onOpenChange, selectedIds, onConfirm, locale, disabled = false }: RetailMediaPickerProps) {
  const t = copy[locale];
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [stagedIds, setStagedIds] = useState<string[]>(selectedIds);
  const [images, setImages] = useState<RetailImage[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  const [pageError, setPageError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const selectedIdsRef = useRef(selectedIds);
  const wasOpen = useRef(false);
  const cache = useRef(new Map<string, RetailImage>());
  const pageRequest = useRef<AbortController | null>(null);

  useEffect(() => {
    selectedIdsRef.current = selectedIds;
  }, [selectedIds]);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [open, query]);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    pageRequest.current?.abort();
    setLoadingMore(false);
    setPageError(false);
    setLoading(true);
    setError(false);
    setImages([]);
    setNextCursor(null);
    const params = new URLSearchParams();
    params.set("q", debouncedQuery);
    fetch(`/api/dashboard/retail/media${params.size ? `?${params.toString()}` : ""}`, { credentials: "same-origin", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("media-load-failed");
        return await response.json() as MediaResponse;
      })
      .then((payload) => {
        if (controller.signal.aborted) return;
        for (const image of payload.images ?? []) cache.current.set(image.id, image);
        setImages(payload.images ?? []);
        setNextCursor(payload.nextCursor ?? null);
      })
      .catch(() => { if (!controller.signal.aborted) setError(true); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => { controller.abort(); pageRequest.current?.abort(); };
  }, [open, debouncedQuery, retryKey]);

  useEffect(() => {
    if (open && !wasOpen.current) setStagedIds(selectedIdsRef.current.slice(0, 20));
    wasOpen.current = open;
  }, [open]);

  const selectedSet = useMemo(() => new Set(stagedIds), [stagedIds]);

  async function loadMore() {
    if (!nextCursor || loading || loadingMore) return;
    const controller = new AbortController();
    pageRequest.current = controller;
    setLoadingMore(true);
    setPageError(false);
    const params = new URLSearchParams({ cursor: nextCursor });
    params.set("q", debouncedQuery);
    try {
      const response = await fetch(`/api/dashboard/retail/media?${params.toString()}`, { credentials: "same-origin", signal: controller.signal });
      if (!response.ok) throw new Error("media-page-failed");
      const payload = await response.json() as MediaResponse;
      if (controller.signal.aborted) return;
      for (const image of payload.images ?? []) cache.current.set(image.id, image);
      setImages((current) => {
        const known = new Set(current.map((image) => image.id));
        return [...current, ...(payload.images ?? []).filter((image) => !known.has(image.id))];
      });
      setNextCursor(payload.nextCursor ?? null);
    } catch {
      if (!controller.signal.aborted) setPageError(true);
    } finally {
      if (!controller.signal.aborted) setLoadingMore(false);
    }
  }

  function toggle(id: string) {
    setStagedIds((current) => {
      if (current.includes(id)) return current.filter((item) => item !== id);
      if (current.length >= 20) return current;
      return [...current, id];
    });
  }

  const direction = locale === "en" ? "ltr" : "rtl";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir={direction} className="flex max-h-[90dvh] w-[calc(100%-1.25rem)] max-w-3xl flex-col gap-0 overflow-hidden p-0 sm:w-full">
        <DialogHeader className="border-b p-5 pe-12 text-start sm:p-6 sm:pe-12">
          <DialogTitle>{t.title}</DialogTitle>
          <DialogDescription>{t.description}</DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-3 border-b px-5 py-3 sm:px-6">
          <label className="flex min-w-0 flex-1 items-center gap-2 rounded-md border px-3 focus-within:ring-2 focus-within:ring-ring">
            <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t.search} aria-label={t.search} className="h-10 min-w-0 flex-1 bg-transparent text-sm outline-none" />
            {query ? <button type="button" aria-label={t.cancel} onClick={() => setQuery("")} className="rounded p-1 hover:bg-muted"><X className="size-4" /></button> : null}
          </label>
          <span aria-live="polite" className="shrink-0 text-xs text-muted-foreground">{stagedIds.length} {t.selected}</span>
        </div>
        {stagedIds.length >= 20 ? <p role="status" className="px-5 pt-3 text-sm text-amber-700 dark:text-amber-400 sm:px-6">{t.limit}</p> : null}
        <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6">
          {loading ? <div role="status" className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin" />{t.loading}</div> : error ? <div className="py-12 text-center"><p role="alert" className="mb-3 text-sm text-destructive">{t.loadError}</p><button type="button" onClick={() => setRetryKey((n) => n + 1)} className="rounded-md border px-3 py-2 text-sm hover:bg-muted">{t.retry}</button></div> : images.length === 0 ? <p className="py-12 text-center text-sm text-muted-foreground">{t.none}</p> : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {images.map((image) => {
                const selected = selectedSet.has(image.id);
                const atLimit = stagedIds.length >= 20 && !selected;
                return <button key={image.id} type="button" aria-pressed={selected} disabled={disabled || atLimit} onClick={() => toggle(image.id)} className={`group relative overflow-hidden rounded-lg border text-start transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-55 ${selected ? "border-primary ring-2 ring-primary" : "hover:border-primary/60"}`}>
                  <Image src={image.url} alt={image.filename || t.title} width={320} height={320} unoptimized className="aspect-square w-full object-cover" />
                  <span className="block truncate px-2 py-2 text-xs" title={image.filename ?? undefined}>{image.filename || image.id}</span><span className="block truncate px-2 pb-2 text-xs text-muted-foreground">{image.productNames?.join("، ")}</span>
                  <span className={`absolute end-2 top-2 flex size-6 items-center justify-center rounded-full border bg-background/95 ${selected ? "border-primary bg-primary text-primary-foreground" : "text-transparent"}`} aria-hidden="true"><Check className="size-4" /></span>
                </button>;
              })}
            </div>
          )}
          {pageError ? <p role="alert" className="mt-4 text-center text-sm text-destructive">{t.pageError}</p> : null}
          {nextCursor && !loading ? <div className="mt-5 text-center"><button type="button" disabled={disabled || loadingMore} onClick={() => void loadMore()} className="inline-flex min-h-10 items-center gap-2 rounded-md border px-4 text-sm font-medium hover:bg-muted disabled:opacity-50">{loadingMore ? <LoaderCircle className="size-4 animate-spin" /> : null}{t.more}</button></div> : null}
        </div>
        <DialogFooter className="border-t p-4 sm:p-5">
          <button type="button" onClick={() => onOpenChange(false)} className="min-h-10 rounded-md border px-4 text-sm font-medium hover:bg-muted">{t.cancel}</button>
          <button type="button" disabled={disabled} onClick={() => { onConfirm(stagedIds, [...cache.current.values()]); onOpenChange(false); }} className="min-h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">{t.confirm} ({stagedIds.length})</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
