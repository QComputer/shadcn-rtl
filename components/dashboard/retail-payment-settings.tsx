"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { RefreshCw, WalletCards } from "lucide-react";
import { appPath } from "@/lib/app-base-path";

type Locale = "fa" | "en";
type CashMode = "COUNTER" | "PICKUP" | "COURIER";
type Settings = { bankTransferEnabled: boolean; cashEnabled: boolean; inotiUssdEnabled: boolean; bankCardNumber: string | null; bankAccountOwner: string | null; cashModes: CashMode[]; cashBeforeConfirmation: boolean; paymentDeadlinesMinutes: { bankTransfer: number; cash: number; inotiUssd: number } };
const defaults: Settings = { bankTransferEnabled: false, cashEnabled: false, inotiUssdEnabled: false, bankCardNumber: null, bankAccountOwner: null, cashModes: ["COUNTER"], cashBeforeConfirmation: true, paymentDeadlinesMinutes: { bankTransfer: 1440, cash: 2880, inotiUssd: 15 } };
const text = {
  fa: { title: "روش‌های پرداخت فروشگاه", intro: "روش‌های پرداخت و سیاست دریافت وجه نقد را برای سفارش‌های فروشگاه تنظیم کنید.", reload: "بارگذاری دوباره", bank: "انتقال بانکی", cash: "پرداخت نقدی", ussd: "پرداخت با کد دستوری اینوتی", card: "شماره کارت", owner: "نام صاحب حساب", modes: "محل‌های قابل پرداخت نقدی", counter: "پیشخوان فروشگاه", pickup: "هنگام تحویل حضوری", courier: "هنگام تحویل پیک", before: "دریافت وجه پیش از تأیید سفارش", deadlines: "مهلت پرداخت به دقیقه", bankDeadline: "مهلت انتقال بانکی", cashDeadline: "مهلت پرداخت نقدی", ussdDeadline: "مهلت پرداخت اینوتی", deadlineHelp: "پس از پایان مهلت، سفارش پرداخت‌نشده لغو و موجودی آن آزاد می‌شود. گزارشی که در انتظار بررسی فروشگاه است باعث انقضای خودکار نمی‌شود.", save: "ذخیره تنظیمات", saving: "در حال ذخیره…", loading: "در حال بارگذاری…", saved: "تنظیمات پرداخت ذخیره شد.", error: "بارگذاری یا ذخیره تنظیمات انجام نشد. دوباره تلاش کنید.", pending: "ثبت سفارش به معنی پرداخت‌شدن آن نیست؛ وضعیت پرداخت جداگانه بررسی می‌شود." },
  en: { title: "Store payment methods", intro: "Configure payment methods and cash collection policy for store orders.", reload: "Reload", bank: "Bank transfer", cash: "Cash payment", ussd: "Inoti USSD payment", card: "Bank card number", owner: "Account holder name", modes: "Cash collection locations", counter: "Store counter", pickup: "Customer pickup", courier: "Courier delivery", before: "Collect cash before confirming the order", deadlines: "Payment deadlines in minutes", bankDeadline: "Bank transfer deadline", cashDeadline: "Cash payment deadline", ussdDeadline: "Inoti payment deadline", deadlineHelp: "After the deadline, an unpaid order is cancelled and its stock is released. A report awaiting store review prevents automatic expiry.", save: "Save settings", saving: "Saving…", loading: "Loading…", saved: "Payment settings saved.", error: "Could not load or save settings. Please try again.", pending: "An order submission does not mean it is paid; payment status is reviewed separately." },
} as const;
const modeLabels: Record<Locale, Record<CashMode, string>> = { fa: { COUNTER: "پیشخوان فروشگاه", PICKUP: "هنگام تحویل حضوری", COURIER: "هنگام تحویل پیک" }, en: { COUNTER: "Store counter", PICKUP: "Customer pickup", COURIER: "Courier delivery" } };

export function RetailPaymentSettings({ locale }: { locale: Locale }) {
  const t = text[locale];
  const [settings, setSettings] = useState<Settings>(defaults);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true); setError(""); setNotice("");
    try { const response = await fetch(appPath("/api/dashboard/retail/payment-settings"), { credentials: "same-origin", cache: "no-store" }); const data = await response.json(); if (!response.ok) throw new Error("load"); setSettings({ ...defaults, ...data.settings, paymentDeadlinesMinutes: { ...defaults.paymentDeadlinesMinutes, ...data.settings?.paymentDeadlinesMinutes }, cashModes: Array.isArray(data.settings?.cashModes) ? data.settings.cashModes : [] }); }
    catch { setError(t.error); } finally { setLoading(false); }
  }, [t.error]);
  useEffect(() => { void load(); }, [load]);
  function toggleMode(mode: CashMode) { setSettings(current => ({ ...current, cashModes: current.cashModes.includes(mode) ? current.cashModes.filter(item => item !== mode) : [...current.cashModes, mode] })); }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(""); setNotice("");
    try { const response = await fetch(appPath("/api/dashboard/retail/payment-settings"), { method: "PUT", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify(settings) }); if (!response.ok) throw new Error("save"); const data = await response.json(); setSettings({ ...defaults, ...data.settings, paymentDeadlinesMinutes: { ...defaults.paymentDeadlinesMinutes, ...data.settings?.paymentDeadlinesMinutes }, cashModes: Array.isArray(data.settings?.cashModes) ? data.settings.cashModes : [] }); setNotice(t.saved); }
    catch { setError(t.error); } finally { setSaving(false); }
  }
  const input = "w-full rounded-lg border bg-background px-3 py-2 text-sm";
  const switcher = (key: "bankTransferEnabled" | "cashEnabled" | "inotiUssdEnabled", label: string) => <label key={key} className="flex items-center gap-3 rounded-lg border p-3 text-sm"><input type="checkbox" checked={settings[key]} onChange={event => setSettings(current => ({ ...current, [key]: event.target.checked }))} />{label}</label>;
  return <main className="space-y-6 p-4 lg:p-6" dir={locale === "en" ? "ltr" : "rtl"} lang={locale}>
    <header className="flex flex-wrap items-center justify-between gap-4"><div><h1 className="text-2xl font-bold tracking-tight">{t.title}</h1><p className="mt-1 text-sm text-muted-foreground">{t.intro}</p></div><button type="button" onClick={() => void load()} disabled={loading} className="rounded-lg border px-4 py-2 text-sm hover:bg-muted disabled:opacity-50"><RefreshCw className="me-2 inline size-4" />{t.reload}</button></header>
    {error && <p role="alert" className="rounded-lg border border-destructive/40 p-3 text-sm text-destructive">{error}</p>}{notice && <p role="status" className="rounded-lg border border-emerald-500/40 bg-emerald-500/5 p-3 text-sm">{notice}</p>}
    {loading ? <p role="status" className="rounded-xl border p-6 text-sm text-muted-foreground">{t.loading}</p> : <form onSubmit={save} className="space-y-5">
      <section className="space-y-3 rounded-xl border bg-card p-4"><h2 className="flex items-center gap-2 font-semibold"><WalletCards className="size-4" />{t.title}</h2><div className="grid gap-3 sm:grid-cols-3">{switcher("bankTransferEnabled", t.bank)}{switcher("cashEnabled", t.cash)}{switcher("inotiUssdEnabled", t.ussd)}</div>
        <div className="grid gap-4 pt-2 sm:grid-cols-2"><label className="grid gap-1.5 text-sm">{t.card}<input className={input} dir="ltr" inputMode="numeric" autoComplete="off" maxLength={32} value={settings.bankCardNumber ?? ""} onChange={event => setSettings(current => ({ ...current, bankCardNumber: event.target.value || null }))} /></label><label className="grid gap-1.5 text-sm">{t.owner}<input className={input} autoComplete="name" maxLength={120} value={settings.bankAccountOwner ?? ""} onChange={event => setSettings(current => ({ ...current, bankAccountOwner: event.target.value || null }))} /></label></div>
      </section>
      <section className="space-y-3 rounded-xl border bg-card p-4"><h2 className="font-semibold">{t.modes}</h2><div className="grid gap-2 sm:grid-cols-3">{(["COUNTER", "PICKUP", "COURIER"] as const).map(mode => <label key={mode} className="flex items-center gap-3 rounded-lg border p-3 text-sm"><input type="checkbox" checked={settings.cashModes.includes(mode)} onChange={() => toggleMode(mode)} />{modeLabels[locale][mode]}</label>)}</div><label className="flex items-center gap-3 rounded-lg border p-3 text-sm"><input type="checkbox" checked={settings.cashBeforeConfirmation} onChange={event => setSettings(current => ({ ...current, cashBeforeConfirmation: event.target.checked }))} />{t.before}</label></section>
      <section className="space-y-3 rounded-xl border bg-card p-4"><h2 className="font-semibold">{t.deadlines}</h2><div className="grid gap-4 sm:grid-cols-3">{([ ["bankTransfer", t.bankDeadline], ["cash", t.cashDeadline], ["inotiUssd", t.ussdDeadline] ] as const).map(([key, label]) => <label key={key} className="grid gap-1.5 text-sm">{label}<input className={input} type="number" min={5} max={43200} step={1} required value={settings.paymentDeadlinesMinutes[key]} onChange={event => setSettings(current => ({ ...current, paymentDeadlinesMinutes: { ...current.paymentDeadlinesMinutes, [key]: Number(event.target.value) } }))} /></label>)}</div><p className="text-sm text-muted-foreground">{t.deadlineHelp}</p></section>
      <p className="text-sm text-muted-foreground">{t.pending}</p><button type="submit" disabled={saving} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">{saving ? t.saving : t.save}</button>
    </form>}
  </main>;
}
