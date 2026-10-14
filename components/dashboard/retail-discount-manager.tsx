"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { RefreshCw, Tag } from "lucide-react";
import { appPath } from "@/lib/app-base-path";

type Locale = "fa" | "en" | "ar";
type Coupon = { id: string; code: string; name: string; discountType: "PERCENTAGE" | "FIXED_AMOUNT"; discountValue: number; minOrderTotal: number | null; maxDiscountAmount: number | null; startsAt: string | null; expiresAt: string | null; usageLimit: number | null; usedCount: number; perCustomerLimit: number | null; isActive: boolean };
type FormValues = { code: string; name: string; discountType: Coupon["discountType"]; discountValue: string; minOrderTotal: string; maxDiscountAmount: string; startsAt: string; expiresAt: string; usageLimit: string; perCustomerLimit: string; isActive: boolean };
const blank: FormValues = { code: "", name: "", discountType: "PERCENTAGE", discountValue: "", minOrderTotal: "", maxDiscountAmount: "", startsAt: "", expiresAt: "", usageLimit: "", perCustomerLimit: "", isActive: true };
const copy = {
  fa: { title: "مدیریت تخفیف‌ها", intro: "کدهای تخفیف فروشگاه را بسازید و وضعیت آن‌ها را مدیریت کنید.", reload: "بارگذاری دوباره", code: "کد تخفیف", name: "عنوان تخفیف", type: "نوع تخفیف", percentage: "درصدی", fixed: "مبلغ ثابت", value: "مقدار تخفیف", minimum: "حداقل مبلغ سفارش", maximum: "سقف تخفیف", starts: "زمان آغاز (اختیاری)", expires: "زمان پایان (اختیاری)", usage: "محدودیت کل استفاده", customer: "محدودیت برای هر مشتری", active: "فعال باشد", create: "ثبت تخفیف", update: "ذخیره تغییرات", cancel: "لغو ویرایش", edit: "ویرایش", activate: "فعال‌کردن", deactivate: "غیرفعال‌کردن", status: "وضعیت", uses: "استفاده‌شده", empty: "هنوز کد تخفیفی ثبت نشده است.", loading: "در حال بارگذاری…", error: "بارگذاری یا ذخیره تخفیف انجام نشد. دوباره تلاش کنید.", on: "فعال", off: "غیرفعال", required: "این فیلد الزامی است." },
  en: { title: "Discounts", intro: "Create discount codes and manage their status for this store.", reload: "Reload", code: "Discount code", name: "Discount name", type: "Discount type", percentage: "Percentage", fixed: "Fixed amount", value: "Discount value", minimum: "Minimum order total", maximum: "Maximum discount", starts: "Starts at (optional)", expires: "Expires at (optional)", usage: "Total usage limit", customer: "Limit per customer", active: "Active", create: "Create discount", update: "Save changes", cancel: "Cancel editing", edit: "Edit", activate: "Activate", deactivate: "Deactivate", status: "Status", uses: "Used", empty: "No discount codes yet.", loading: "Loading…", error: "Could not load or save the discount. Please try again.", on: "Active", off: "Inactive", required: "This field is required." },
  ar: { title: "إدارة الخصومات", intro: "أنشئ رموز الخصم وأدر حالتها لهذا المتجر.", reload: "إعادة التحميل", code: "رمز الخصم", name: "اسم الخصم", type: "نوع الخصم", percentage: "نسبة مئوية", fixed: "مبلغ ثابت", value: "قيمة الخصم", minimum: "الحد الأدنى للطلب", maximum: "الحد الأقصى للخصم", starts: "يبدأ في (اختياري)", expires: "ينتهي في (اختياري)", usage: "حد الاستخدام الإجمالي", customer: "الحد لكل عميل", active: "نشط", create: "إنشاء الخصم", update: "حفظ التغييرات", cancel: "إلغاء التعديل", edit: "تعديل", activate: "تفعيل", deactivate: "تعطيل", status: "الحالة", uses: "مرات الاستخدام", empty: "لا توجد رموز خصم بعد.", loading: "جارٍ التحميل…", error: "تعذر تحميل الخصم أو حفظه. حاول مرة أخرى.", on: "نشط", off: "غير نشط", required: "هذا الحقل مطلوب." },
} as const;

function dateValue(value: string | null) { return value ? new Date(value).toISOString().slice(0, 16) : ""; }
function toPayload(form: FormValues) {
  const optionalNumber = (value: string) => value === "" ? undefined : Number(value);
  return { code: form.code.trim(), name: form.name.trim(), discountType: form.discountType, discountValue: Number(form.discountValue), minOrderTotal: optionalNumber(form.minOrderTotal), maxDiscountAmount: optionalNumber(form.maxDiscountAmount), startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : undefined, expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : undefined, usageLimit: optionalNumber(form.usageLimit), perCustomerLimit: optionalNumber(form.perCustomerLimit), isActive: form.isActive };
}

export function RetailDiscountManager({ locale }: { locale: Locale }) {
  const t = copy[locale];
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [form, setForm] = useState<FormValues>(blank);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setBusy(true); setError("");
    try { const response = await fetch(appPath("/api/dashboard/retail/discounts"), { credentials: "same-origin" }); const data = await response.json(); if (!response.ok) throw new Error("load"); setCoupons(data.coupons ?? []); }
    catch { setError(t.error); } finally { setBusy(false); }
  }, [t.error]);
  useEffect(() => { void load(); }, [load]);
  const field = <K extends keyof FormValues>(key: K, value: FormValues[K]) => setForm((current) => ({ ...current, [key]: value }));
  function startEdit(coupon: Coupon) { setEditingId(coupon.id); setForm({ code: coupon.code, name: coupon.name, discountType: coupon.discountType, discountValue: String(coupon.discountValue), minOrderTotal: coupon.minOrderTotal == null ? "" : String(coupon.minOrderTotal), maxDiscountAmount: coupon.maxDiscountAmount == null ? "" : String(coupon.maxDiscountAmount), startsAt: dateValue(coupon.startsAt), expiresAt: dateValue(coupon.expiresAt), usageLimit: coupon.usageLimit == null ? "" : String(coupon.usageLimit), perCustomerLimit: coupon.perCustomerLimit == null ? "" : String(coupon.perCustomerLimit), isActive: coupon.isActive }); }
  function cancelEdit() { setEditingId(null); setForm(blank); }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError("");
    try { const response = await fetch(appPath(editingId ? `/api/dashboard/retail/discounts/${encodeURIComponent(editingId)}` : "/api/dashboard/retail/discounts"), { method: editingId ? "PATCH" : "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify(toPayload(form)) }); if (!response.ok) throw new Error("save"); cancelEdit(); await load(); }
    catch { setError(t.error); } finally { setSaving(false); }
  }
  async function toggle(coupon: Coupon) {
    setError("");
    try { const response = await fetch(appPath(`/api/dashboard/retail/discounts/${encodeURIComponent(coupon.id)}`), { method: "PATCH", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify({ isActive: !coupon.isActive }) }); if (!response.ok) throw new Error("toggle"); await load(); }
    catch { setError(t.error); }
  }
  const inputClass = "w-full rounded-lg border bg-background px-3 py-2 text-sm";
  const numeric = (key: "discountValue" | "minOrderTotal" | "maxDiscountAmount" | "usageLimit" | "perCustomerLimit", label: string, required = false) => <label className="grid gap-1.5 text-sm" key={key}>{label}<input className={inputClass} type="number" min="0" step="any" required={required} value={form[key]} onChange={(event) => field(key, event.target.value)} /></label>;
  return <main className="space-y-6 p-4 lg:p-6" dir={locale === "en" ? "ltr" : "rtl"} lang={locale}>
    <header className="flex flex-wrap items-center justify-between gap-4"><div><h1 className="text-2xl font-bold tracking-tight">{t.title}</h1><p className="mt-1 text-sm text-muted-foreground">{t.intro}</p></div><button type="button" onClick={() => void load()} disabled={busy} className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"><RefreshCw className="me-2 inline size-4" />{t.reload}</button></header>
    {error && <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
    <section className="rounded-xl border bg-card p-4"><h2 className="mb-4 flex items-center gap-2 font-semibold"><Tag className="size-4" />{editingId ? t.update : t.create}</h2>
      <form className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" onSubmit={submit}>
        <label className="grid gap-1.5 text-sm">{t.code}<input className={inputClass} required maxLength={64} autoComplete="off" value={form.code} onChange={(event) => field("code", event.target.value)} /></label>
        <label className="grid gap-1.5 text-sm">{t.name}<input className={inputClass} required maxLength={160} value={form.name} onChange={(event) => field("name", event.target.value)} /></label>
        <label className="grid gap-1.5 text-sm">{t.type}<select className={inputClass} value={form.discountType} onChange={(event) => field("discountType", event.target.value as FormValues["discountType"])}><option value="PERCENTAGE">{t.percentage}</option><option value="FIXED_AMOUNT">{t.fixed}</option></select></label>
        {numeric("discountValue", t.value, true)}{numeric("minOrderTotal", t.minimum)}{numeric("maxDiscountAmount", t.maximum)}
        <label className="grid gap-1.5 text-sm">{t.starts}<input className={inputClass} type="datetime-local" value={form.startsAt} onChange={(event) => field("startsAt", event.target.value)} /></label>
        <label className="grid gap-1.5 text-sm">{t.expires}<input className={inputClass} type="datetime-local" value={form.expiresAt} onChange={(event) => field("expiresAt", event.target.value)} /></label>
        {numeric("usageLimit", t.usage)}{numeric("perCustomerLimit", t.customer)}
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isActive} onChange={(event) => field("isActive", event.target.checked)} />{t.active}</label>
        <div className="flex flex-wrap gap-2 sm:col-span-2 xl:col-span-3"><button type="submit" disabled={saving} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">{saving ? t.loading : editingId ? t.update : t.create}</button>{editingId && <button type="button" onClick={cancelEdit} className="rounded-lg border px-4 py-2 text-sm">{t.cancel}</button>}</div>
      </form>
    </section>
    <section className="overflow-hidden rounded-xl border bg-card"><div className="border-b px-4 py-3"><h2 className="font-semibold">{t.title}</h2></div>{busy ? <p className="p-6 text-sm text-muted-foreground" role="status">{t.loading}</p> : coupons.length === 0 ? <p className="p-6 text-sm text-muted-foreground">{t.empty}</p> : <div className="overflow-x-auto"><table className="w-full min-w-[680px] text-start text-sm"><thead className="bg-muted/50 text-muted-foreground"><tr><th className="px-4 py-3 text-start font-medium">{t.code}</th><th className="px-4 py-3 text-start font-medium">{t.name}</th><th className="px-4 py-3 text-start font-medium">{t.value}</th><th className="px-4 py-3 text-start font-medium">{t.uses}</th><th className="px-4 py-3 text-start font-medium">{t.status}</th><th className="px-4 py-3 text-start font-medium">{t.edit}</th></tr></thead><tbody className="divide-y">{coupons.map((coupon) => <tr key={coupon.id}><td className="px-4 py-3 font-mono font-medium" dir="ltr">{coupon.code}</td><td className="px-4 py-3">{coupon.name}</td><td className="px-4 py-3">{coupon.discountValue.toLocaleString(locale)}{coupon.discountType === "PERCENTAGE" ? "٪" : ""}</td><td className="px-4 py-3">{coupon.usedCount.toLocaleString(locale)}{coupon.usageLimit == null ? "" : ` / ${coupon.usageLimit.toLocaleString(locale)}`}</td><td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs ${coupon.isActive ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200" : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"}`}>{coupon.isActive ? t.on : t.off}</span></td><td className="flex gap-2 px-4 py-3"><button type="button" className="font-medium text-primary underline-offset-4 hover:underline" onClick={() => startEdit(coupon)}>{t.edit}</button><button type="button" className="text-xs underline" onClick={() => void toggle(coupon)}>{coupon.isActive ? t.deactivate : t.activate}</button></td></tr>)}</tbody></table></div>}</section>
  </main>;
}
