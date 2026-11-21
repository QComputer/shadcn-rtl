"use client";
import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { HotelStayRequests } from "./hotel-stay-requests";

export function HotelRequestReception({ organizationId, propertyId, locale, canConfigure, showGuestPortal = true }: { organizationId: string; propertyId: string; locale: string; canConfigure: boolean; showGuestPortal?: boolean }) {
  const [version, setVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const t = locale === "en" ? { title: "Guest request settings", open: "Open guest request page", enable: "Enable coordination requests", disable: "Disable coordination requests", error: "Configuration failed." }
    : locale === "ar" ? { title: "إعدادات طلبات الإقامة", open: "فتح صفحة طلب الضيف", enable: "تفعيل طلبات التنسيق", disable: "إيقاف طلبات التنسيق", error: "تعذر تحديث الإعدادات." }
    : { title: "تنظیم درخواست اقامت", open: "مشاهده صفحه درخواست مهمان", enable: "فعال‌سازی درخواست اقامت", disable: "غیرفعال‌سازی درخواست اقامت", error: "به‌روزرسانی تنظیمات ناموفق بود." };
  async function configure(mode: "DISABLED" | "REQUEST_ONLY") {
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/organizations/${encodeURIComponent(organizationId)}/hotels/${encodeURIComponent(propertyId)}/stay-requests`, { method: "PATCH", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode }) });
      if (!response.ok) throw new Error(t.error);
      setVersion(value => value + 1);
    } catch { setError(t.error); } finally { setBusy(false); }
  }
  return <section className="space-y-3 rounded-xl border p-4">
    <h2 className="font-semibold">{t.title}</h2>
    <Link className="underline" href={`/${locale}/hotel/${encodeURIComponent(organizationId)}/${encodeURIComponent(propertyId)}`}>{t.open}</Link>
    {canConfigure ? <div className="flex flex-wrap gap-2"><Button disabled={busy} onClick={() => void configure("REQUEST_ONLY")}>{t.enable}</Button><Button disabled={busy} variant="outline" onClick={() => void configure("DISABLED")}>{t.disable}</Button></div> : null}
    {error ? <p role="alert">{error}</p> : null}
    {showGuestPortal ? <HotelStayRequests key={`${organizationId}:${propertyId}:${version}`} organizationId={organizationId} propertyId={propertyId} locale={locale} initialStay={{ checkIn: "", checkOut: "", adults: 1, childAges: [] }} /> : null}
  </section>;
}
