"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { hotelOfflinePaymentEndpoint, parseHotelOfflinePaymentSummary, type HotelOfflinePaymentSummary } from "./hotel-offline-payments";

const labels = {
  fa: { title: "پرداخت اقامت", due: "مانده (تومان)", amount: "مبلغ واریز (تومان)", reference: "شماره پیگیری واریز", submit: "ثبت واریز برای بررسی", refresh: "تازه‌سازی", pending: "ثبت‌شده؛ تأییدنشده", verified: "تأییدشده", error: "دریافت یا ثبت اطلاعات پرداخت انجام نشد.", notice: "ثبت شماره واریز به معنی تأیید پرداخت یا رزرو نیست." },
  en: { title: "Stay payment", due: "Outstanding (Toman)", amount: "Transfer amount (Toman)", reference: "Transfer reference", submit: "Submit transfer for review", refresh: "Refresh", pending: "Submitted; unverified", verified: "Verified", error: "Payment information could not be loaded or submitted.", notice: "Submitting a reference does not confirm payment or reservation." },
  ar: { title: "دفع الإقامة", due: "المبلغ المتبقي (تومان)", amount: "مبلغ التحويل (تومان)", reference: "مرجع التحويل", submit: "إرسال التحويل للمراجعة", refresh: "تحديث", pending: "مرسل؛ غير مؤكد", verified: "تم التأكيد", error: "تعذر تحميل معلومات الدفع أو إرسالها.", notice: "إرسال المرجع لا يعني تأكيد الدفع أو الحجز." },
} as const;

export function HotelGuestOfflinePayment({ organizationId, propertyId, reservationId, locale }: { organizationId: string; propertyId: string; reservationId: string; locale: string }) {
  const t = labels[locale === "fa" || locale === "ar" ? locale : "en"];
  const endpoint = hotelOfflinePaymentEndpoint(organizationId, propertyId, reservationId);
  const [summary, setSummary] = useState<HotelOfflinePaymentSummary | null>(null);
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const retry = useRef<{ fingerprint: string; key: string } | null>(null);
  const refresh = useCallback(async () => {
    const response = await fetch(endpoint, { credentials: "same-origin", cache: "no-store" });
    const parsed = response.ok ? parseHotelOfflinePaymentSummary(await response.json()) : null;
    if (!parsed) throw new Error("Payment status unavailable");
    setSummary(parsed);
  }, [endpoint]);
  useEffect(() => { void refresh().catch(() => setError(t.error)); }, [refresh, t.error]);
  async function submit() {
    if (!/^[1-9][0-9]{0,14}$/.test(amount) || !reference.trim() || reference.trim().length > 160 || !globalThis.crypto?.randomUUID) { setError(t.error); return; }
    const fingerprint = JSON.stringify([amount, reference.trim()]);
    const key = retry.current?.fingerprint === fingerprint ? retry.current.key : crypto.randomUUID();
    retry.current = { fingerprint, key };
    setBusy(true); setError("");
    try {
      const response = await fetch(endpoint, { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json", "idempotency-key": key }, body: JSON.stringify({ action: "SUBMIT_BANK_TRANSFER", amountToman: amount, bankReference: reference.trim() }) });
      const data = await response.json().catch(() => null);
      if (!response.ok || !["APPLIED", "REPLAY"].includes(data?.outcome) || data?.entry?.status !== "SUBMITTED") throw new Error("Transfer submission failed");
      retry.current = null; setAmount(""); setReference(""); await refresh();
    } catch { setError(t.error); } finally { setBusy(false); }
  }
  return <section className="space-y-2 rounded border p-3" aria-label={t.title}><h3 className="font-semibold">{t.title}</h3>
    <p>{t.notice}</p>{summary ? <><p>{t.due}: <bdi>{summary.outstandingToman}</bdi></p><ul>{summary.entries.map((entry) => <li key={entry.id}>{entry.method}: <bdi>{entry.amountToman}</bdi> — {entry.status === "VERIFIED" ? t.verified : t.pending}</li>)}</ul></> : null}
    <label className="block">{t.amount}<input className="block w-full rounded border p-2" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} /></label>
    <label className="block">{t.reference}<input className="block w-full rounded border p-2" value={reference} onChange={(e) => setReference(e.target.value)} /></label>
    <button type="button" disabled={busy} onClick={() => void submit()}>{t.submit}</button>{" "}<button type="button" disabled={busy} onClick={() => void refresh().catch(() => setError(t.error))}>{t.refresh}</button>{error ? <p role="alert">{error}</p> : null}</section>;
}
