"use client";
import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { HotelOperationalReservations } from "./hotel-operational-reservations";
export function HotelOperationalReception({ organizationId, propertyId, locale, canConfigure }: { organizationId: string; propertyId: string; locale: string; canConfigure: boolean }) {
  const [version, setVersion] = useState(0), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const text = locale === "en" ? { title: "Reservation reception", open: "Guest reservations", enable: "Enable operational reservations", requests: "Use request-only mode", error: "Configuration failed" } : locale === "ar" ? { title: "استقبال الحجوزات", open: "حجوزات الضيوف", enable: "تفعيل الحجوزات التشغيلية", requests: "الطلبات فقط", error: "فشل الإعداد" } : { title: "پذیرش رزروها", open: "رزروهای مهمان", enable: "فعال‌کردن رزرو عملیاتی", requests: "حالت درخواست اقامت", error: "تنظیمات ذخیره نشد" };
  async function configure(mode: "RESERVATION" | "REQUEST_ONLY") {
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/organizations/${encodeURIComponent(organizationId)}/hotels/${encodeURIComponent(propertyId)}/reservations`, { method: "PATCH", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode }) });
      if (!response.ok) throw new Error(text.error);
      setVersion(v => v + 1);
    } catch (cause) { setError(cause instanceof Error ? cause.message : text.error); } finally { setBusy(false); }
  }
  return <section className="space-y-3 rounded-xl border p-4"><h2 className="text-lg font-semibold">{text.title}</h2><Link className="underline" href={`/${locale}/hotel-reservations/${encodeURIComponent(organizationId)}/${encodeURIComponent(propertyId)}`}>{text.open}</Link>{canConfigure ? <div className="flex flex-wrap gap-2"><Button disabled={busy} onClick={() => void configure("RESERVATION")}>{text.enable}</Button><Button disabled={busy} variant="outline" onClick={() => void configure("REQUEST_ONLY")}>{text.requests}</Button></div> : null}{error ? <p role="alert">{error}</p> : null}<HotelOperationalReservations key={version} organizationId={organizationId} propertyId={propertyId} locale={locale} mode="reception" /></section>;
}
