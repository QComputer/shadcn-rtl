"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { appFetch, appPath } from "@/lib/app-base-path";
import { formatToman } from "@/lib/persian";

type Settings = {
  enablePickup: boolean;
  enableDelivery: boolean;
  deliveryFee: number | null;
  pickupAddress: string;
  pickupInstructions: string;
  deliveryRestrictions: string;
  fulfillmentInstructions: string;
};
type ResponseDto = { settings: Settings; contact: { address: string | null; phone: string | null }; version: string };

const emptySettings: Settings = { enablePickup: false, enableDelivery: false, deliveryFee: null, pickupAddress: "", pickupInstructions: "", deliveryRestrictions: "", fulfillmentInstructions: "" };
const labels = {
  fa: { title: "روش‌های دریافت سفارش", intro: "روش‌های حضوری و ارسال فروشگاه و اطلاعاتی را که مشتری پیش از ثبت سفارش می‌بیند تنظیم کنید.", loading: "در حال دریافت تنظیمات…", loadError: "دریافت تنظیمات انجام نشد. دوباره تلاش کنید.", reload: "بارگذاری دوباره", pickup: "دریافت حضوری فعال باشد", delivery: "ارسال فعال باشد", pickupAddress: "نشانی دریافت حضوری", addressHint: "در صورت خالی‌بودن، نشانی ثبت‌شده در اطلاعات سازمان نمایش داده می‌شود.", instructions: "راهنمای دریافت حضوری", restrictions: "محدودیت‌های ارسال", fulfillment: "راهنمای تکمیلی دریافت سفارش", fee: "هزینه ارسال برای هر سفارش (تومان)", feeHint: "این مبلغ به مشتری نمایش داده می‌شود. خالی‌گذاشتن یعنی هزینه هنوز تنظیم نشده است.", saving: "در حال ذخیره…", save: "ذخیره تغییرات", saved: "تنظیمات ذخیره شد.", saveError: "ذخیره تنظیمات انجام نشد. دوباره تلاش کنید.", conflict: "تنظیمات هم‌زمان تغییر کرده‌اند. ابتدا نسخه تازه را بارگذاری و بررسی کنید.", conflictReload: "بارگذاری نسخه تازه", contact: "اطلاعات نشانی و تماس سازمان در صفحه تنظیمات سازمان مدیریت می‌شود.", orgSettings: "تنظیمات سازمان", noAddress: "نشانی سازمان ثبت نشده است", noFee: "هزینه ارسال تنظیم نشده است", requiredFee: "برای فعال‌کردن ارسال، هزینه را به تومان مشخص کنید.", invalidFee: "هزینه باید عددی صحیح و نامنفی باشد." },
  en: { title: "Order fulfillment", intro: "Choose how customers can receive orders and set the details shown before checkout.", loading: "Loading settings…", loadError: "Could not load settings. Please try again.", reload: "Reload", pickup: "Enable pickup", delivery: "Enable delivery", pickupAddress: "Pickup address", addressHint: "When blank, the organization address is shown.", instructions: "Pickup instructions", restrictions: "Delivery restrictions", fulfillment: "Additional fulfillment instructions", fee: "Delivery fee per order (Toman)", feeHint: "Customers see this amount. Leave blank to mark the fee as unconfigured.", saving: "Saving…", save: "Save changes", saved: "Settings saved.", saveError: "Could not save settings. Please try again.", conflict: "Settings changed while you were editing. Reload and review the latest version.", conflictReload: "Reload latest version", contact: "Organization address and contact details are managed on the organization settings page.", orgSettings: "Organization settings", noAddress: "No organization address is set", noFee: "Delivery fee is not configured", requiredFee: "Set a fee in Toman to enable delivery.", invalidFee: "Enter a whole, non-negative amount." },
} as const;

export function RetailFulfillmentSettings({ locale = "fa", organizationId }: { locale?: "fa" | "en"; organizationId?: string }) {
  const t = labels[locale];
  const endpoint = `/api/dashboard/retail/fulfillment-settings${organizationId ? `?organizationId=${encodeURIComponent(organizationId)}` : ""}`;
  const [settings, setSettings] = useState<Settings>(emptySettings);
  const [contact, setContact] = useState<ResponseDto["contact"]>({ address: null, phone: null });
  const [version, setVersion] = useState("");
  const [feeInput, setFeeInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [conflict, setConflict] = useState(false);
  const requestId = useRef(0);
  const mutationLock = useRef(false);

  const load = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true); setError(""); setNotice(""); setConflict(false);
    try {
      const response = await appFetch(endpoint, { credentials: "same-origin", cache: "no-store" });
      const data = await response.json() as ResponseDto;
      if (!response.ok || !data.settings || typeof data.version !== "string") throw new Error("load");
      if (id === requestId.current) {
        setSettings(data.settings); setContact(data.contact ?? { address: null, phone: null }); setVersion(data.version);
        setFeeInput(data.settings.deliveryFee === null ? "" : String(data.settings.deliveryFee));
      }
    } catch { if (id === requestId.current) setError(t.loadError); }
    finally { if (id === requestId.current) setLoading(false); }
  }, [t.loadError, endpoint]);
  useEffect(() => { const timer = setTimeout(() => { void load(); }, 0); return () => clearTimeout(timer); }, [load]);

  const setField = <K extends keyof Settings>(key: K, value: Settings[K]) => setSettings(current => ({ ...current, [key]: value }));
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (mutationLock.current || !version) return;
    const normalizedFee = feeInput.trim() === "" ? null : Number(feeInput);
    if (normalizedFee !== null && (!Number.isSafeInteger(normalizedFee) || normalizedFee < 0)) { setError(t.invalidFee); return; }
    if (settings.enableDelivery && normalizedFee === null) { setError(t.requiredFee); return; }
    mutationLock.current = true; setSaving(true); setError(""); setNotice("");
    try {
      const response = await appFetch(endpoint, { method: "PATCH", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...settings, deliveryFee: normalizedFee, expectedVersion: version }) });
      if (response.status === 409) { setConflict(true); setError(t.conflict); return; }
      const data = await response.json() as ResponseDto;
      if (!response.ok || !data.settings || typeof data.version !== "string") throw new Error("save");
      setSettings(data.settings); setContact(data.contact ?? { address: null, phone: null }); setVersion(data.version);
      setFeeInput(data.settings.deliveryFee === null ? "" : String(data.settings.deliveryFee)); setNotice(t.saved);
    } catch { setError(t.saveError); }
    finally { mutationLock.current = false; setSaving(false); }
  };

  const inputClass = "mt-2 w-full min-w-0 rounded-xl border border-stone-300 bg-card px-3 py-3 text-sm text-foreground outline-none focus:border-stone-700 focus:ring-2 focus:ring-stone-300";
  return <section id="retail-fulfillment" dir={locale === "fa" ? "rtl" : "ltr"} className="w-full min-w-0 rounded-2xl border border-border bg-card p-4 text-foreground shadow-sm sm:p-6">
    <header className="mb-5"><h2 className="text-lg font-bold">{t.title}</h2><p className="mt-2 text-sm leading-7 text-muted-foreground">{t.intro}</p></header>
    <p className="mb-5 rounded-xl bg-muted p-3 text-sm leading-7 text-muted-foreground">{t.contact} <a className="font-semibold text-foreground underline underline-offset-4" href={appPath("/dashboard/settings/organization")}>{t.orgSettings}</a></p>
    {loading ? <p role="status" className="py-8 text-center text-sm text-muted-foreground">{t.loading}</p> : <>
      {error && <div role="alert" className="mb-4 rounded-xl bg-rose-50 p-3 text-sm leading-6 text-rose-800">{error}{conflict && <button type="button" onClick={() => void load()} className="ms-3 font-semibold underline underline-offset-4">{t.conflictReload}</button>}{!conflict && !version && <button type="button" onClick={() => void load()} className="ms-3 font-semibold underline underline-offset-4">{t.reload}</button>}</div>}
      {notice && <p role="status" className="mb-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
      {version && <form onSubmit={submit} className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2">
          {([["enablePickup", t.pickup], ["enableDelivery", t.delivery]] as const).map(([key, label]) => <label key={key} className="flex min-h-14 items-center justify-between gap-3 rounded-xl border border-border px-4 py-3 text-sm font-medium"><span>{label}</span><input type="checkbox" checked={settings[key]} onChange={e => setField(key, e.target.checked)} className="size-5 shrink-0 accent-primary" /></label>)}
        </div>
        <div className="grid min-w-0 gap-5 sm:grid-cols-2">
          <label className="block min-w-0 text-sm font-medium">{t.pickupAddress}<input aria-label={t.pickupAddress} className={inputClass} maxLength={500} value={settings.pickupAddress} onChange={e => setField("pickupAddress", e.target.value)} placeholder={contact.address ?? t.noAddress} /></label>
          <label className="block min-w-0 text-sm font-medium">{t.fee}<input aria-label={t.fee} className={inputClass} inputMode="numeric" type="number" min="0" step="1" value={feeInput} onChange={e => setFeeInput(e.target.value)} placeholder={t.noFee} />{feeInput !== "" && Number.isFinite(Number(feeInput)) && <span className="mt-1 block text-xs text-muted-foreground">{formatToman(Number(feeInput))}</span>}<span className="mt-1 block text-xs font-normal leading-6 text-muted-foreground">{t.feeHint}</span></label>
        </div>
        <p className="-mt-3 text-xs leading-6 text-muted-foreground">{t.addressHint}</p>
        <label className="block text-sm font-medium">{t.instructions}<textarea aria-label={t.instructions} className={inputClass} rows={3} maxLength={1000} value={settings.pickupInstructions} onChange={e => setField("pickupInstructions", e.target.value)} /></label>
        <label className="block text-sm font-medium">{t.restrictions}<textarea aria-label={t.restrictions} className={inputClass} rows={3} maxLength={1000} value={settings.deliveryRestrictions} onChange={e => setField("deliveryRestrictions", e.target.value)} /></label>
        <label className="block text-sm font-medium">{t.fulfillment}<textarea aria-label={t.fulfillment} className={inputClass} rows={3} maxLength={1000} value={settings.fulfillmentInstructions} onChange={e => setField("fulfillmentInstructions", e.target.value)} /></label>
        <div className="flex flex-col-reverse gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between"><span className="text-xs leading-6 text-muted-foreground">{contact.address ? `${locale === "fa" ? "نشانی سازمان:" : "Organization address:"} ${contact.address}` : t.noAddress}{contact.phone ? ` · ${contact.phone}` : ""}{settings.deliveryFee === null ? ` · ${t.noFee}` : ` · ${locale === "fa" ? "هزینه فعلی:" : "Current fee:"} ${formatToman(settings.deliveryFee)}`}</span><button type="submit" disabled={saving || conflict} className="min-h-12 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50">{saving ? t.saving : t.save}</button></div>
      </form>}
    </>}
  </section>;
}
