"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { appFetch } from "@/lib/app-base-path";

type Locale = "fa" | "en";
type Format = "CSV" | "XLSX";
type Mode = "CREATE" | "UPDATE" | "UPSERT";
type RetailInfo = {
  categories: Array<{ id: string; name: string }>;
  definitions: Array<{ id: string; key: string; label: string; scope: string }>;
  media: Array<{ id: string; url: string }>;
  jobs: Array<{ id: string; status: string; createdAt: string; summary: unknown }>;
};
type PreviewRow = { rowNumber: number; productKey: string | null; sku: string | null; action: string; values: Record<string, string>; errors: string[]; warnings: string[] };
type Counts = { productsCreate: number; variantsCreate: number; productsUpdate: number; variantsUpdate: number; unchanged: number; invalidRows: number; warnings: number };
type Preview = { token: string; rows: PreviewRow[]; counts: Counts };
type InputData = { format: Format; content: string; mode: Mode };
type BulkResult = { jobId: string; counts: Counts };

const copy = {
  fa: {
    title: "ورود و خروج گروهی کاتالوگ فروشگاه", intro: "فایل محصولات را ابتدا پیش‌نمایش کنید؛ هیچ تغییری پیش از تأیید نهایی اعمال نمی‌شود.", template: "قالب CSV", templateXlsx: "قالب XLSX", exportCsv: "خروجی CSV", exportXlsx: "خروجی XLSX", chooseFile: "انتخاب فایل CSV یا XLSX", mode: "روش ورود", create: "فقط ایجاد", update: "فقط به‌روزرسانی", upsert: "ایجاد یا به‌روزرسانی", preview: "ساخت پیش‌نمایش", previewTitle: "پیش‌نمایش بررسی‌شده", execute: "تأیید و اجرای ورود", confirmHelp: "ردیف‌ها و هشدارها را بررسی کردم و اجرای این ورود را تأیید می‌کنم.", preparing: "در حال آماده‌سازی…", uploading: "در حال ارسال…", done: "ورود گروهی تکمیل شد", error: "عملیات انجام نشد. فایل و اتصال را بررسی و دوباره تلاش کنید.", noFile: "ابتدا یک فایل انتخاب کنید.", tooLarge: "حداکثر اندازه فایل ۱ مگابایت است.", fileRead: "خواندن فایل انجام نشد.", access: "دسترسی به ورود گروهی فروشگاه فراهم نیست.", details: "راهنمای ستون‌ها و داده‌های مرجع", categories: "دسته‌بندی‌های موجود", definitions: "ویژگی‌ها", media: "شناسه‌های رسانه گالری", jobs: "آخرین اجرای گروهی", noData: "موردی ثبت نشده است.", refs: "در فایل، شناسه‌های رسانه متعلق به همین فروشگاه را وارد کنید. برای افزودن تصویر از گالری فروشگاه استفاده کنید.", format: "قالب فایل", countCreate: "محصول/گونه جدید", countUpdate: "محصول/گونه به‌روزشده", unchanged: "بدون تغییر", invalid: "ردیف نامعتبر", warnings: "هشدار", row: "ردیف", key: "کلید محصول", sku: "شناسه گونه (SKU)", action: "اقدام", errors: "خطاها", priceRule: "price_toman باید مبلغ دقیق تومان با حداکثر دو رقم اعشار باشد.", emptyRule: "سلول خالی یعنی مقدار قبلی حفظ شود؛ برای پاک‌کردن اختیاری از [[CLEAR]] استفاده کنید.", idRule: "شناسه‌های پایدار product_id و variant_id در خروجی حفظ می‌شوند.", batchRule: "هر دسته حداکثر ۵۰ ردیف گونه و ۱۰ محصول دارد و به‌صورت اتمی پردازش می‌شود.", columnRule: "ستون‌های ویژگی با attribute:<کلید ویژگی> نام‌گذاری می‌شوند. برای رنگ از color_attribute و color_value استفاده کنید.", mediaRule: "image_ids، color_image_ids و variant_image_ids فهرست شناسه‌های متعلق به گالری همین فروشگاه هستند؛ چند شناسه را با | جدا کنید.", status: "وضعیت", loadError: "اطلاعات فروشگاه بارگذاری نشد.", requireConfirm: "برای اجرا، تأیید را علامت بزنید.", rows: "ردیف‌های پیش‌نمایش", modeHelp: "ابتدا پیش‌نمایش را بسازید؛ انتخاب فایل به‌تنهایی چیزی را بارگذاری یا اعمال نمی‌کند.", cancelPreview: "پاک‌کردن پیش‌نمایش", csv: "CSV", xlsx: "XLSX", productName: "نام محصول", variantName: "نام گونه", price: "قیمت (تومان)", stock: "موجودی", invalidBlock: "تا زمانی که ردیف نامعتبر وجود دارد، تأیید و اجرا غیرفعال است.", upsertRule: "در حالت ایجاد یا به‌روزرسانی، ردیفی که product_id دارد همان محصول را به‌روزرسانی می‌کند؛ بدون product_id محصول جدید ساخته می‌شود. تطبیق بر اساس نام انجام نمی‌شود.", galleryRule: "INHERIT یعنی استفاده از گالری مشترک رنگ و در نبود آن گالری محصول؛ OVERRIDE یعنی استفاده از تصاویر اختصاصی گونه.", overrideWarning: "اگر تصویر اختصاصی گونه از قبل ثبت شده باشد، همان تصویر حفظ می‌شود.", result: "نتیجه ورود", created: "ایجاد شد", updated: "به‌روزرسانی شد", job: "شناسه اجرا", actions: { CREATE: "ایجاد", PRODUCT_CREATE: "ایجاد محصول", VARIANT_CREATE: "ایجاد گونه", UPDATE: "به‌روزرسانی", PRODUCT_UPDATE: "به‌روزرسانی محصول", VARIANT_UPDATE: "به‌روزرسانی گونه", UPSERT_CREATE: "ایجاد", UPSERT_UPDATE: "به‌روزرسانی", UNCHANGED: "بدون تغییر", INVALID: "نامعتبر" },
  },
  en: {
    title: "Retail catalog bulk import and export", intro: "Review a file preview first. No changes are applied before your final confirmation.", template: "CSV template", templateXlsx: "XLSX template", exportCsv: "Export CSV", exportXlsx: "Export XLSX", chooseFile: "Choose CSV or XLSX file", mode: "Import mode", create: "Create only", update: "Update only", upsert: "Create or update", preview: "Build preview", previewTitle: "Validated preview", execute: "Confirm and run import", confirmHelp: "I reviewed the rows and warnings and confirm this import.", preparing: "Preparing…", uploading: "Submitting…", done: "Bulk import completed", error: "The operation failed. Check the file and connection, then try again.", noFile: "Choose a file first.", tooLarge: "The maximum file size is 1 MB.", fileRead: "Could not read the file.", access: "Retail bulk import is unavailable for this account.", details: "Column guide and reference data", categories: "Available categories", definitions: "Attributes", media: "Gallery media IDs", jobs: "Latest bulk run", noData: "No entries.", refs: "Use media IDs owned by this store. Upload images through the existing merchant gallery.", format: "File format", countCreate: "New products / variants", countUpdate: "Updated products / variants", unchanged: "Unchanged", invalid: "Invalid rows", warnings: "Warnings", row: "Row", key: "Product key", sku: "Variant SKU", action: "Action", errors: "Errors", priceRule: "price_toman must be an exact Toman amount with at most two decimal places.", emptyRule: "An empty cell keeps the existing value; use [[CLEAR]] to explicitly clear an optional value.", idRule: "Stable product_id and variant_id values are preserved in exports.", batchRule: "Each atomic batch allows up to 50 variant rows and 10 products.", columnRule: "Name attribute columns attribute:<definition key>. For colors, use color_attribute and color_value.", mediaRule: "image_ids, color_image_ids, and variant_image_ids accept IDs from this store's gallery, separated by |.", status: "Status", loadError: "Could not load store information.", requireConfirm: "Check the confirmation before running the import.", rows: "Preview rows", modeHelp: "Build a preview first. Selecting a file does not upload or apply it.", cancelPreview: "Clear preview", csv: "CSV", xlsx: "XLSX", productName: "Product name", variantName: "Variant name", price: "Price (Toman)", stock: "Stock", invalidBlock: "Confirmation and execution stay disabled while any row is invalid.", upsertRule: "In Create or update mode, a row with product_id updates that product. Without product_id, a new product is created. No name matching is used.", galleryRule: "INHERIT uses the product gallery image for the variant; OVERRIDE uses images assigned to the variant.", overrideWarning: "If a variant-specific image override already exists, it is kept.", result: "Import result", created: "Created", updated: "Updated", job: "Job ID", actions: { CREATE: "Create", PRODUCT_CREATE: "Create product", VARIANT_CREATE: "Create variant", UPDATE: "Update", PRODUCT_UPDATE: "Update product", VARIANT_UPDATE: "Update variant", UPSERT_CREATE: "Create", UPSERT_UPDATE: "Update", UNCHANGED: "Unchanged", INVALID: "Invalid" },
  },
} as const;

function emptyCounts(): Counts { return { productsCreate: 0, variantsCreate: 0, productsUpdate: 0, variantsUpdate: 0, unchanged: 0, invalidRows: 0, warnings: 0 }; }
function formatDate(value: string, locale: Locale) { return new Intl.DateTimeFormat(locale === "fa" ? "fa-IR" : "en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }

export function BulkCatalog({ locale }: { locale: Locale }) {
  const t = copy[locale];
  const [info, setInfo] = useState<RetailInfo | null>(null);
  const [format, setFormat] = useState<Format>("CSV");
  const [mode, setMode] = useState<Mode>("CREATE");
  const [fileName, setFileName] = useState("");
  const [input, setInput] = useState<InputData | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [successResult, setSuccessResult] = useState<BulkResult | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);
  const [loadingInfo, setLoadingInfo] = useState(true);
  const requestLock = useRef(false);
  const idempotencyKey = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    setLoadingInfo(true); setError("");
    try {
      const response = await appFetch("/api/dashboard/imports/retail", { credentials: "same-origin", cache: "no-store" });
      if (response.status === 403) { setAccessDenied(true); setInfo(null); return; }
      if (!response.ok) throw new Error("load");
      const data = await response.json();
      setInfo({ categories: data.categories ?? [], definitions: data.definitions ?? [], media: data.media ?? [], jobs: data.jobs ?? [] });
      setAccessDenied(false);
    } catch { setError(t.loadError); }
    finally { setLoadingInfo(false); }
  }, [t.loadError]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void refresh(); }, 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);
  useEffect(() => {
    if (info && window.location.hash === "#retail-bulk") document.getElementById("retail-bulk")?.scrollIntoView({ block: "start" });
  }, [info]);

  async function readFile(file: File | undefined) {
    setError(""); setNotice(""); setSuccessResult(null); setPreview(null); setConfirmed(false); setInput(null); setFileName(""); idempotencyKey.current = null;
    if (!file) return;
    if (file.size > 1024 * 1024) { setError(t.tooLarge); return; }
    const ext = file.name.toLowerCase().split(".").pop();
    if (ext !== "csv" && ext !== "xlsx") { setError(t.fileRead); return; }
    const fileFormat: Format = ext === "xlsx" ? "XLSX" : "CSV";
    try {
      const content = fileFormat === "CSV" ? await file.text() : await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error("file-read"));
        reader.onload = () => {
          const result = String(reader.result ?? "");
          const comma = result.indexOf(",");
          resolve(comma >= 0 ? result.slice(comma + 1) : result);
        };
        reader.readAsDataURL(file);
      });
      setFormat(fileFormat); setFileName(file.name); setInput({ format: fileFormat, content, mode });
    } catch { setError(t.fileRead); }
  }

  async function download(kind: "template" | "export", requestedFormat: Format) {
    setError(""); setNotice("");
    try {
      const response = await appFetch(`/api/dashboard/imports/retail/download?kind=${kind}&format=${requestedFormat}`, { credentials: "same-origin", cache: "no-store" });
      if (!response.ok) { if (response.status === 403) setAccessDenied(true); throw new Error("download"); }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a"); anchor.href = url; anchor.download = `retail-catalog-${kind}.${requestedFormat.toLowerCase()}`; anchor.click(); URL.revokeObjectURL(url);
    } catch { setError(t.error); }
  }

  async function buildPreview() {
    if (!input || requestLock.current) { if (!input) setError(t.noFile); return; }
    requestLock.current = true; setBusy(true); setError(""); setNotice(""); setSuccessResult(null); setPreview(null); setConfirmed(false);
    const currentInput = { ...input, mode };
    try {
      const response = await appFetch("/api/dashboard/imports/retail/preview", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify(currentInput) });
      if (response.status === 403) setAccessDenied(true);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : t.error);
      setPreview({ token: data.token, rows: data.rows ?? [], counts: { ...emptyCounts(), ...(data.counts ?? {}) } });
      idempotencyKey.current = crypto.randomUUID();
      setInput(currentInput);
    } catch (cause) { setError(cause instanceof Error ? cause.message : t.error); }
    finally { setBusy(false); requestLock.current = false; }
  }

  async function execute() {
    if (!input || !preview || !confirmed) { if (!confirmed) setError(t.requireConfirm); return; }
    if (requestLock.current) return;
    requestLock.current = true; setBusy(true); setError(""); setNotice("");
    try {
      const response = await appFetch("/api/dashboard/imports/retail/execute", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...input, token: preview.token, idempotencyKey: idempotencyKey.current ?? crypto.randomUUID(), confirmed: true }) });
      if (response.status === 403) setAccessDenied(true);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : t.error);
      setNotice(t.done); setSuccessResult({ jobId: String(data.jobId ?? ""), counts: { ...emptyCounts(), ...(data.counts ?? {}) } }); setPreview(null); setConfirmed(false); setInput(null); setFileName(""); idempotencyKey.current = null; await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : t.error); }
    finally { setBusy(false); requestLock.current = false; }
  }

  if (accessDenied) return null;
  if (!info) return <section className="rounded-xl border bg-card p-4 text-sm" aria-live="polite">{loadingInfo ? t.preparing : <div role="alert" className="flex flex-wrap items-center justify-between gap-3"><span className="text-destructive">{error || t.loadError}</span><button type="button" onClick={() => void refresh()} className="rounded-lg border px-3 py-2">{t.preview}</button></div>}</section>;
  const field = "min-w-0 w-full rounded-lg border bg-background px-3 py-2 text-sm";
  const counts = preview?.counts;
  const invalidPreview = (counts?.invalidRows ?? 0) > 0;
  function actionLabel(action: string) {
    const translated = (t.actions as Record<string, string>)[action.toUpperCase()];
    return translated ?? (locale === "fa" ? "بررسی‌شده" : "Reviewed");
  }

  return <section id="retail-bulk" aria-labelledby="retail-bulk-title" dir={locale === "fa" ? "rtl" : "ltr"} lang={locale} className="min-w-0 scroll-mt-24 space-y-4 rounded-xl border bg-card p-4 sm:p-5">
    <header className="flex min-w-0 flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h2 id="retail-bulk-title" className="text-lg font-semibold">{t.title}</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">{t.intro}</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={() => void download("template", "CSV")} className="rounded-lg border px-3 py-2 text-sm">{t.template}</button><button type="button" onClick={() => void download("template", "XLSX")} className="rounded-lg border px-3 py-2 text-sm">{t.templateXlsx}</button></div></header>
    {error && <p role="alert" className="break-words rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}{notice && <p role="status" className="break-words rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm">{notice}</p>}
    {successResult && <div aria-label={t.result} className="grid grid-cols-2 gap-2 rounded-lg border border-emerald-500/30 p-3 sm:grid-cols-3"><Count label={t.countCreate} value={`${successResult.counts.productsCreate} / ${successResult.counts.variantsCreate}`} /><Count label={t.countUpdate} value={`${successResult.counts.productsUpdate} / ${successResult.counts.variantsUpdate}`} /><Count label={t.unchanged} value={successResult.counts.unchanged} /></div>}
    <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="min-w-0 space-y-3">
        <label className="grid gap-1.5 text-sm font-medium">{t.chooseFile}<input className={field} type="file" disabled={busy} accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={event => void readFile(event.currentTarget.files?.[0])} aria-label={t.chooseFile} />{fileName && <span className="break-all text-xs text-muted-foreground">{fileName} · {t.format}: {format}</span>}</label>
        <label className="grid gap-1.5 text-sm font-medium">{t.mode}<select aria-label="روش ورود گروهی به کاتالوگ" className={field} value={mode} onChange={event => { const next = event.target.value as Mode; setMode(next); setInput(current => current ? { ...current, mode: next } : null); setPreview(null); setConfirmed(false); }}><option value="CREATE">{t.create}</option><option value="UPDATE">{t.update}</option><option value="UPSERT">{t.upsert}</option></select></label>
        <p className="text-xs leading-5 text-muted-foreground">{t.modeHelp}</p>
        <div className="flex flex-wrap gap-2"><button type="button" disabled={busy || !input} onClick={() => void buildPreview()} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">{busy ? t.preparing : t.preview}</button><button type="button" onClick={() => void download("export", "CSV")} className="rounded-lg border px-3 py-2 text-sm">{t.exportCsv}</button><button type="button" onClick={() => void download("export", "XLSX")} className="rounded-lg border px-3 py-2 text-sm">{t.exportXlsx}</button></div>
      </div>
      <details className="min-w-0 self-start rounded-lg border p-3"><summary className="cursor-pointer text-sm font-semibold">{t.details}</summary><div className="mt-3 space-y-3 text-xs leading-5"><p>{t.priceRule}</p><p>{t.emptyRule}</p><p>{t.idRule}</p><p>{t.batchRule}</p><p>{t.columnRule}</p><p>{t.upsertRule}</p><p>{t.galleryRule}</p><p>{t.overrideWarning}</p><p>{t.mediaRule} {t.refs}</p><div><h3 className="font-semibold">{t.categories}</h3><p className="break-words text-muted-foreground">{info.categories.length ? info.categories.map(item => `${item.name} (${item.id})`).join(" · ") : t.noData}</p></div><div><h3 className="font-semibold">{t.definitions}</h3><ul className="break-words text-muted-foreground">{info.definitions.length ? info.definitions.map(item => <li key={item.id}>attribute:{item.key} · {item.label} · {item.scope}</li>) : <li>{t.noData}</li>}</ul></div><div><h3 className="font-semibold">{t.media}</h3><ul className="max-h-32 space-y-1 overflow-y-auto break-all text-muted-foreground">{info.media.length ? info.media.map(item => <li key={item.id}><code>{item.id}</code> · <bdi dir="ltr">{item.url}</bdi></li>) : <li>{t.noData}</li>}</ul></div>{successResult && <div className="rounded-md border border-emerald-500/25 bg-emerald-500/5 p-2"><h3 className="font-semibold">{t.result}</h3><p>{t.created}: {successResult.counts.productsCreate} {locale === "fa" ? "محصول" : "products"} · {successResult.counts.variantsCreate} {locale === "fa" ? "گونه" : "variants"}</p><p>{t.updated}: {successResult.counts.productsUpdate} {locale === "fa" ? "محصول" : "products"} · {successResult.counts.variantsUpdate} {locale === "fa" ? "گونه" : "variants"}</p><p>{t.unchanged}: {successResult.counts.unchanged} · {t.invalid}: {successResult.counts.invalidRows}</p><p className="break-all">{t.job}: <code>{successResult.jobId}</code></p></div>}<div><h3 className="font-semibold">{t.jobs}</h3>{info.jobs.slice(0, 5).map(job => <p key={job.id} className="break-all text-muted-foreground">{job.status} · {formatDate(job.createdAt, locale)}</p>)}{info.jobs.length === 0 && <p className="text-muted-foreground">{t.noData}</p>}</div></div></details>
    </div>
    {preview && <section aria-labelledby="bulk-preview-title" className="min-w-0 space-y-3 border-t pt-4"><div className="flex flex-wrap items-center justify-between gap-2"><h3 id="bulk-preview-title" className="font-semibold">{t.previewTitle} · {t.rows}: {preview.rows.length}</h3><button type="button" onClick={() => { setPreview(null); setConfirmed(false); idempotencyKey.current = null; }} className="rounded-lg border px-3 py-1.5 text-sm">{t.cancelPreview}</button></div><div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6"><Count label={t.countCreate} value={`${counts?.productsCreate ?? 0} / ${counts?.variantsCreate ?? 0}`} /><Count label={t.countUpdate} value={`${counts?.productsUpdate ?? 0} / ${counts?.variantsUpdate ?? 0}`} /><Count label={t.unchanged} value={counts?.unchanged ?? 0} /><Count label={t.invalid} value={counts?.invalidRows ?? 0} /><Count label={t.warnings} value={counts?.warnings ?? 0} /></div>{invalidPreview && <p role="alert" className="text-sm text-destructive">{t.invalidBlock}</p>}<ol className="max-h-[50vh] min-w-0 space-y-2 overflow-y-auto">{preview.rows.map(row => { const values = row.values ?? {}; const attributeEntries = Object.entries(values).filter(([name, value]) => name.startsWith("attribute:") && value !== ""); return <li key={`${row.rowNumber}:${row.sku ?? ""}`} className="min-w-0 rounded-lg border p-3 text-sm"><div className="flex min-w-0 flex-wrap justify-between gap-x-3 gap-y-1"><span>{t.row}: {row.rowNumber}</span><span className="max-w-full break-words">{t.action}: {actionLabel(row.action)}</span></div><dl className="mt-2 grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2"><PreviewValue label={t.key} value={row.productKey} /><PreviewValue label={t.sku} value={row.sku} /><PreviewValue label={t.productName} value={values.product_name} /><PreviewValue label={t.variantName} value={values.variant_name} /><PreviewValue label={t.price} value={values.price_toman} /><PreviewValue label={t.stock} value={values.stock} />{values.color_attribute && <PreviewValue label="color_attribute" value={values.color_attribute} />}{values.color_value && <PreviewValue label="color_value" value={values.color_value} />}{attributeEntries.map(([name, value]) => { const key = name.slice("attribute:".length); const definition = info.definitions.find(item => item.key === key); return <PreviewValue key={name} label={definition?.label ?? key} value={value} />; })}</dl>{row.errors.length > 0 && <p className="mt-2 break-words text-destructive">{t.errors}: {row.errors.join(" · ")}</p>}{row.warnings.length > 0 && <p className="mt-2 break-words text-amber-700 dark:text-amber-300">{t.warnings}: {row.warnings.join(" · ")}</p>}</li>; })}</ol><label className="flex min-w-0 items-start gap-2 text-sm"><input className="mt-1 size-4 shrink-0" type="checkbox" checked={confirmed} disabled={invalidPreview} onChange={event => setConfirmed(event.target.checked)} /><span className="break-words">{t.confirmHelp}</span></label><button type="button" disabled={busy || !confirmed || invalidPreview} onClick={() => void execute()} className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50 sm:w-auto">{busy ? t.uploading : t.execute}</button></section>}
  </section>;
}

function Count({ label, value }: { label: string; value: string | number }) { return <div className="min-w-0 rounded-lg bg-muted/50 p-2"><p className="break-words text-xs text-muted-foreground">{label}</p><p className="mt-1 break-all font-semibold tabular-nums">{value}</p></div>; }
function PreviewValue({ label, value }: { label: string; value: string | null | undefined }) { return <div className="min-w-0 rounded-md bg-muted/40 p-2"><dt className="break-words text-xs text-muted-foreground">{label}</dt><dd className="mt-1 break-all font-medium" dir="auto">{value || "—"}</dd></div>; }
