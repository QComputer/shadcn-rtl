"use client";

import { useMemo, useState } from "react";

export type HotelOfflinePolicy = "DISABLED" | "CASH_ON_ARRIVAL" | "MINIMUM_VERIFIED_DEPOSIT";
export type HotelOfflinePaymentMethod = "CASH" | "BANK_TRANSFER";

export type HotelOfflinePolicySettingsValue = {
  mode: "RESERVATION";
  manualConfirmationPolicy: HotelOfflinePolicy;
  allowedOfflinePaymentMethods: HotelOfflinePaymentMethod[];
  minimumVerifiedDepositAmount: string | null;
};

type Locale = "fa" | "en" | "ar";

const copy = {
  fa: {
    title: "سیاست تأیید و پرداخت رزرو", policy: "سیاست تأیید دستی", disabled: "غیرفعال", cashArrival: "پرداخت نقدی هنگام ورود", deposit: "حداقل پیش‌پرداختِ تأییدشده", methods: "روش‌های پرداخت خارج از درگاه", cash: "نقدی", transfer: "واریز بانکی", depositAmount: "حداقل مبلغ پیش‌پرداختِ تأییدشده (تومان)", save: "ذخیره سیاست", saving: "در حال ذخیره…", saved: "سیاست ذخیره شد.", provisional: "سیاست رزرو هنوز پیکربندی نشده است؛ شرایط نمایش‌داده‌شده موقت‌اند و رزرو را تأیید نمی‌کنند.", configured: "این سیاست فقط شرایط پیشنهادی را مشخص می‌کند و به‌تنهایی رزرو را تأیید نمی‌کند.", role: "تغییر این تنظیمات به دسترسی مدیریتی مجاز برای همین هتل نیاز دارد.", requiredMethod: "برای فعال‌کردن سیاست، دست‌کم یک روش پرداخت خارج از درگاه انتخاب کنید.", invalidDeposit: "مبلغ پیش‌پرداخت باید یک عدد صحیح مثبت به تومان باشد.", loadError: "مقادیر سیاست معتبر نیستند.", saveError: "ذخیره سیاست انجام نشد. دوباره تلاش کنید.", access: "دسترسی برای تغییر سیاست مجاز نیست.", disabledMethods: "روش‌های خارج از درگاه هنگام غیرفعال بودن سیاست پاک می‌شوند.",
  },
  en: {
    title: "Reservation confirmation and payment policy", policy: "Manual confirmation policy", disabled: "Disabled", cashArrival: "Cash on arrival", deposit: "Minimum verified deposit", methods: "Offline payment methods", cash: "Cash", transfer: "Bank transfer", depositAmount: "Minimum verified deposit (Toman)", save: "Save policy", saving: "Saving…", saved: "Policy saved.", provisional: "The reservation policy is not configured yet. Displayed terms are provisional and do not confirm a reservation.", configured: "This policy describes proposed terms only; it does not confirm a reservation.", role: "Changing these settings requires authorized management access for this hotel.", requiredMethod: "Select at least one offline payment method to enable a policy.", invalidDeposit: "The deposit must be a positive whole Toman amount.", loadError: "The policy values are invalid.", saveError: "The policy could not be saved. Try again.", access: "You are not authorized to change this policy.", disabledMethods: "Offline methods are cleared while the policy is disabled.",
  },
  ar: {
    title: "سياسة تأكيد الحجز والدفع", policy: "سياسة التأكيد اليدوي", disabled: "معطلة", cashArrival: "الدفع نقداً عند الوصول", deposit: "حد أدنى لعربون مؤكد", methods: "طرق الدفع غير الإلكترونية", cash: "نقداً", transfer: "تحويل مصرفي", depositAmount: "الحد الأدنى للعربون المؤكد (تومان)", save: "حفظ السياسة", saving: "جارٍ الحفظ…", saved: "تم حفظ السياسة.", provisional: "لم تُضبط سياسة الحجز بعد. الشروط المعروضة مؤقتة ولا تؤكد الحجز.", configured: "تحدد هذه السياسة الشروط المقترحة فقط؛ ولا تؤكد الحجز.", role: "يتطلب تغيير هذه الإعدادات صلاحية إدارية مخولة لهذا الفندق.", requiredMethod: "اختر طريقة دفع غير إلكترونية واحدة على الأقل لتفعيل السياسة.", invalidDeposit: "يجب أن يكون مبلغ العربون عدداً صحيحاً موجباً بالتومان.", loadError: "قيم السياسة غير صالحة.", saveError: "تعذر حفظ السياسة. حاول مرة أخرى.", access: "غير مصرح لك بتغيير هذه السياسة.", disabledMethods: "تُمسح طرق الدفع غير الإلكترونية عند تعطيل السياسة.",
  },
} as const;

export function hotelReservationPolicyEndpoint(organizationId: string, propertyId: string) {
  return `/api/organizations/${encodeURIComponent(organizationId)}/hotels/${encodeURIComponent(propertyId)}/reservations`;
}

export function buildHotelOfflinePolicySettings(value: Omit<HotelOfflinePolicySettingsValue, "mode">): HotelOfflinePolicySettingsValue | null {
  if (!["DISABLED", "CASH_ON_ARRIVAL", "MINIMUM_VERIFIED_DEPOSIT"].includes(value.manualConfirmationPolicy)) return null;
  if (!Array.isArray(value.allowedOfflinePaymentMethods) || value.allowedOfflinePaymentMethods.some((method) => method !== "CASH" && method !== "BANK_TRANSFER")) return null;
  if (value.manualConfirmationPolicy === "DISABLED") {
    return { mode: "RESERVATION", manualConfirmationPolicy: "DISABLED", allowedOfflinePaymentMethods: [], minimumVerifiedDepositAmount: null };
  }
  if (!value.allowedOfflinePaymentMethods.length) return null;
  if (value.manualConfirmationPolicy === "CASH_ON_ARRIVAL" && !value.allowedOfflinePaymentMethods.includes("CASH")) return null;
  if (value.manualConfirmationPolicy === "MINIMUM_VERIFIED_DEPOSIT") {
    if (typeof value.minimumVerifiedDepositAmount !== "string" || !/^[1-9]\d{0,14}$/.test(value.minimumVerifiedDepositAmount)) return null;
    return { mode: "RESERVATION", manualConfirmationPolicy: value.manualConfirmationPolicy, allowedOfflinePaymentMethods: [...new Set(value.allowedOfflinePaymentMethods)], minimumVerifiedDepositAmount: value.minimumVerifiedDepositAmount };
  }
  return { mode: "RESERVATION", manualConfirmationPolicy: value.manualConfirmationPolicy, allowedOfflinePaymentMethods: [...new Set(value.allowedOfflinePaymentMethods)], minimumVerifiedDepositAmount: null };
}

export function HotelOfflinePolicySettings({ organizationId, propertyId, locale, initialValues, apiWired = false, onSaved }: {
  organizationId: string;
  propertyId: string;
  locale: string;
  initialValues: Omit<HotelOfflinePolicySettingsValue, "mode">;
  apiWired?: boolean;
  onSaved?: () => void;
}) {
  const language: Locale = locale === "en" || locale === "ar" ? locale : "fa";
  const t = copy[language];
  const endpoint = useMemo(() => hotelReservationPolicyEndpoint(organizationId, propertyId), [organizationId, propertyId]);
  const [policy, setPolicy] = useState<HotelOfflinePolicy>(initialValues.manualConfirmationPolicy || "DISABLED");
  const [methods, setMethods] = useState<HotelOfflinePaymentMethod[]>(initialValues.allowedOfflinePaymentMethods || []);
  const [deposit, setDeposit] = useState(initialValues.minimumVerifiedDepositAmount || "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const activeMethods = policy === "DISABLED" ? [] : methods;
  const provisional = policy === "DISABLED";

  function toggleMethod(method: HotelOfflinePaymentMethod, checked: boolean) {
    setMethods((current) => checked ? [...new Set([...current, method])] : current.filter((item) => item !== method));
  }

  async function save() {
    const payload = buildHotelOfflinePolicySettings({ manualConfirmationPolicy: policy, allowedOfflinePaymentMethods: activeMethods, minimumVerifiedDepositAmount: policy === "MINIMUM_VERIFIED_DEPOSIT" ? deposit : null });
    if (!payload) { setMessage(policy === "MINIMUM_VERIFIED_DEPOSIT" && !/^[1-9]\d{0,14}$/.test(deposit) ? t.invalidDeposit : t.requiredMethod); return; }
    if (!apiWired) { setMessage(t.saveError); return; }
    setBusy(true); setMessage("");
    try {
      const response = await fetch(endpoint, { method: "PATCH", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const data = await response.json().catch(() => null);
      if (response.status === 401 || response.status === 403) throw new Error(t.access);
      if (!response.ok || !data || data.manualConfirmationPolicy !== payload.manualConfirmationPolicy) throw new Error(t.saveError);
      setMessage(t.saved);
      onSaved?.();
    } catch (error) { setMessage(error instanceof Error ? error.message : t.saveError); }
    finally { setBusy(false); }
  }

  return <section className="space-y-4 rounded-xl border bg-card p-4 sm:p-6" dir={language === "en" ? "ltr" : "rtl"} aria-labelledby="hotel-offline-policy-title">
    <header><h2 id="hotel-offline-policy-title" className="text-xl font-semibold">{t.title}</h2><p className="mt-1 text-sm text-muted-foreground">{t.role}</p></header>
    {provisional ? <p className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-sm" role="note">{t.provisional}</p> : <p className="rounded-md border p-3 text-sm" role="note">{t.configured}</p>}
    <label className="grid gap-1 text-sm"><span className="font-medium">{t.policy}</span><select className="min-h-10 rounded-md border bg-background px-3" value={policy} disabled={busy} onChange={(event) => { const next = event.target.value as HotelOfflinePolicy; setPolicy(next); if (next === "DISABLED") setMethods([]); }}>{[["DISABLED", t.disabled], ["CASH_ON_ARRIVAL", t.cashArrival], ["MINIMUM_VERIFIED_DEPOSIT", t.deposit]].map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    <fieldset disabled={policy === "DISABLED" || busy} className="space-y-2 rounded-lg border p-3"><legend className="px-1 text-sm font-medium">{t.methods}</legend>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={methods.includes("CASH")} onChange={(event) => toggleMethod("CASH", event.target.checked)} />{t.cash}</label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={methods.includes("BANK_TRANSFER")} onChange={(event) => toggleMethod("BANK_TRANSFER", event.target.checked)} />{t.transfer}</label>
      {policy === "DISABLED" && <p className="text-xs text-muted-foreground">{t.disabledMethods}</p>}
    </fieldset>
    {policy === "MINIMUM_VERIFIED_DEPOSIT" && <label className="grid gap-1 text-sm"><span className="font-medium">{t.depositAmount}</span><input className="min-h-10 rounded-md border bg-background px-3" inputMode="numeric" pattern="[0-9]*" value={deposit} disabled={busy} onChange={(event) => setDeposit(event.target.value)} /></label>}
    {message && <p role="alert" className="rounded-md border border-destructive/40 p-3 text-sm">{message}</p>}
    <button type="button" className="min-h-10 rounded-md bg-primary px-4 text-primary-foreground disabled:opacity-50" disabled={!apiWired || busy} onClick={() => void save()}>{busy ? t.saving : t.save}</button>
  </section>;
}
