"use client";
import { useEffect, useState } from "react";
import { appFetch } from "@/lib/app-base-path";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { GuestClaimKind } from "@/lib/customer-auth/guest-claim.contract";
import { normalizeDigits } from "@/lib/integrations/inoti-ussd/parser";
const copy = {
  fa: { title: "انتقال سوابق مهمان به حساب", note: "حداکثر ۲۰ سابقه اخیر از همین نوع در این مرورگر بررسی می‌شود؛ برای هر مورد تأیید جداگانه لازم است. عضویت باشگاه یا پرداخت تغییر نمی‌کند.", load: "بررسی سوابق قابل انتقال", none: "سابقه قابل انتقال یافت نشد.", consent: "می‌خواهم همین سابقه به حساب من متصل شود.", request: "درخواست کد تأیید", sent: "اگر شرایط انتقال برقرار باشد، کد ارسال می‌شود.", code: "کد چهار رقمی", verify: "تأیید و انتقال", done: "سابقه به حساب متصل شد. برای مشاهده، صفحه سوابق را تازه کنید.", error: "انتقال در دسترس نیست. وارد حساب همین کسب‌وکار شوید و از مرورگر ثبت اولیه استفاده کنید.", reset: "لغو / انتخاب دوباره" },
  en: { title: "Attach guest records to your account", note: "Checks up to 20 recent records of this kind from this browser. Confirm each record separately. Club membership and payments do not change.", load: "Check eligible records", none: "No eligible record found.", consent: "I want to attach this specific record to my account.", request: "Request verification code", sent: "A code will be sent if the record is eligible.", code: "Four-digit code", verify: "Confirm and attach", done: "Record attached. Refresh your history to view it.", error: "Claim unavailable. Sign in to this business and use the original browser.", reset: "Cancel / choose again" },
  ar: { title: "ربط سجلات الضيف بالحساب", note: "يتم فحص ما يصل إلى 20 سجلاً حديثاً من هذا النوع من هذا المتصفح. أكد كل سجل بشكل منفصل. لا تتغير العضوية أو المدفوعات.", load: "عرض السجلات المؤهلة", none: "لا توجد سجلات مؤهلة.", consent: "أوافق على ربط هذا السجل المحدد بحسابي.", request: "طلب رمز التحقق", sent: "سيتم إرسال رمز إذا كان السجل مؤهلاً.", code: "رمز من أربعة أرقام", verify: "تأكيد وربط", done: "تم ربط السجل. حدّث صفحة السجلات لعرضه.", error: "الربط غير متاح. سجل الدخول لهذه المنشأة واستخدم المتصفح الأصلي.", reset: "إلغاء / اختيار جديد" },
};
type Item = { recordId: string; reference: string | null; date: string };
export function GuestClaimPanel({ locale, slug, kind }: { locale: string; slug: string; kind: GuestClaimKind }) {
  const t = copy[locale === "en" || locale === "ar" ? locale : "fa"];
  const [enabled, setEnabled] = useState(false);
  const [items, setItems] = useState<Item[] | null>(null);
  const [selected, setSelected] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [challenge, setChallenge] = useState("");
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    appFetch(`/api/auth/customer/config?organization=${encodeURIComponent(slug)}`, { cache: "no-store", signal: controller.signal })
      .then(r => r.ok ? r.json() : null).then(data => { if (!controller.signal.aborted) setEnabled(data?.guestClaim === true); }).catch(() => {});
    return () => controller.abort();
  }, [slug]);
  function reset() { setSelected(""); setConfirmed(false); setChallenge(""); setOtp(""); }
  async function act(action: "LIST" | "REQUEST" | "CLAIM") {
    if (busy || (action !== "LIST" && (!selected || !confirmed)) || (action === "CLAIM" && (!challenge || !/^\d{4}$/.test(otp)))) return;
    setBusy(true); setMessage("");
    try {
      const response = await appFetch("/api/auth/customer/guest-claim", { method: "POST", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify(action === "LIST" ? { action, kind } : { action, kind, recordId: selected, claimConfirmed: true, ...(action === "CLAIM" ? { challengeId: challenge, otp } : {}) }) });
      if (!response.ok) throw Error("unavailable");
      const data = await response.json();
      if (action === "LIST") { if (!Array.isArray(data.items)) throw Error("unavailable"); reset(); setItems(data.items); }
      else if (action === "REQUEST") { if (data.accepted !== true || typeof data.challengeId !== "string") throw Error("unavailable"); setChallenge(data.challengeId); setOtp(""); setMessage(t.sent); }
      else { if (data.outcome !== "CLAIMED" || data.kind !== kind || data.recordId !== selected) throw Error("unavailable"); setItems(old => old?.filter(x => x.recordId !== selected) ?? null); reset(); setMessage(t.done); }
    } catch { setMessage(t.error); } finally { setBusy(false); }
  }
  if (!enabled) return null;
  return <section data-testid="guest-claim-panel" className="space-y-3 rounded-lg border bg-card p-4" dir={locale === "en" ? "ltr" : "rtl"}>
    <h2 className="font-semibold">{t.title}</h2><p className="text-sm text-muted-foreground">{t.note}</p>
    <Button type="button" disabled={busy} data-testid="guest-claim-load" onClick={() => void act("LIST")}>{t.load}</Button>
    {items && (items.length ? <ul className="space-y-2">{items.map(item => <li key={item.recordId}><label className="flex items-center gap-2"><input type="radio" name={`guest-claim-${kind}`} disabled={busy || !!challenge} checked={selected === item.recordId} onChange={() => { reset(); setSelected(item.recordId); setMessage(""); }} data-testid="guest-claim-record" /><span>{item.reference ?? "—"} · {new Intl.DateTimeFormat(locale === "en" || locale === "ar" ? locale : "fa", { dateStyle: "medium" }).format(new Date(item.date))}</span></label></li>)}</ul> : <p>{t.none}</p>)}
    {selected && <div className="space-y-2"><label className="flex items-start gap-2"><input type="checkbox" data-testid="guest-claim-consent" checked={confirmed} disabled={busy || !!challenge} onChange={e => setConfirmed(e.target.checked)} />{t.consent}</label>
      {!challenge ? <Button type="button" data-testid="guest-claim-request" disabled={!confirmed || busy} onClick={() => void act("REQUEST")}>{t.request}</Button> : <><label className="block">{t.code}<Input data-testid="guest-claim-otp" dir="ltr" inputMode="numeric" autoComplete="one-time-code" maxLength={4} value={otp} disabled={busy} onChange={e => setOtp(normalizeDigits(e.target.value).replace(/[^0-9]/g, "").slice(0,4))} /></label><Button type="button" data-testid="guest-claim-verify" disabled={busy || !/^\d{4}$/.test(otp)} onClick={() => void act("CLAIM")}>{t.verify}</Button></>}
      <Button type="button" variant="outline" disabled={busy} onClick={() => { reset(); setMessage(""); }}>{t.reset}</Button></div>}
    {message && <p role="status" data-testid="guest-claim-message">{message}</p>}
  </section>;
}
