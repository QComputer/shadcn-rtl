"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { GuestClaimPanel } from "@/components/customer/guest-claim-panel";
import { appFetch } from "@/lib/app-base-path";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { buildAppointmentPublicPath, useAppointmentRoutePaths } from "@/lib/contexts/appointment-route-context";

type Locale = "fa" | "en" | "ar";
type Item = { id: string; bookingReference: string | null; startTime: string; endTime: string; status: string; service: { id: string; name: string; duration: number; price: number; organization: { name: string; slug: string; timezone: string | null; address: string | null; phone: string | null }; serviceProvider: { firstName: string | null; lastName: string | null } | null } };
const labels = {
  fa: { title: "نوبت‌های من", note: "نوبت‌های این حساب یا همین مرورگر را ببینید. برای بازیابی در دستگاه دیگر با کسب‌وکار تماس بگیرید.", ref: "کد رزرو (اختیاری)", show: "نمایش نوبت‌ها", loading: "در حال دریافت…", none: "نوبتی در این نشست پیدا نشد.", denied: "دسترسی به این نوبت امکان‌پذیر نیست. از مرورگر رزروکننده استفاده کنید یا با کسب‌وکار تماس بگیرید.", retry: "دریافت دوباره", details: "جزئیات", back: "بازگشت به نوبت‌ها", more: "۵۰ نوبت اخیر نمایش داده شده است؛ با کد رزرو جست‌وجو کنید.", booking: "ثبت نوبت جدید", price: "تومان", statuses: { PENDING: "در انتظار", CONFIRMED: "تأیید شده", COMPLETED: "انجام شده", CANCELLED: "لغو شده", NO_SHOW: "عدم مراجعه" } },
  en: { title: "My appointments", note: "View appointments owned by this account or browser. Contact the business to recover access on another device.", ref: "Booking reference (optional)", show: "Show appointments", loading: "Loading…", none: "No appointments were found for this session.", denied: "Appointment access is unavailable. Use the booking browser or contact the business.", retry: "Try again", details: "Details", back: "Back to appointments", more: "Showing the latest 50; filter by booking reference.", booking: "New appointment", price: "toman", statuses: { PENDING: "Pending", CONFIRMED: "Confirmed", COMPLETED: "Completed", CANCELLED: "Cancelled", NO_SHOW: "No show" } },
  ar: { title: "مواعيدي", note: "اعرض مواعيد هذا الحساب أو المتصفح. تواصل مع المنشأة لاستعادة الوصول من جهاز آخر.", ref: "مرجع الحجز (اختياري)", show: "عرض المواعيد", loading: "جارٍ التحميل…", none: "لم يتم العثور على مواعيد لهذه الجلسة.", denied: "الوصول إلى الموعد غير متاح. استخدم متصفح الحجز أو تواصل مع المنشأة.", retry: "إعادة المحاولة", details: "التفاصيل", back: "العودة إلى المواعيد", more: "يتم عرض آخر 50 موعدًا؛ ابحث بمرجع الحجز.", booking: "موعد جديد", price: "تومان", statuses: { PENDING: "قيد الانتظار", CONFIRMED: "مؤكد", COMPLETED: "مكتمل", CANCELLED: "ملغى", NO_SHOW: "عدم الحضور" } },
};
function dateTime(value: string, locale: Locale, timezone: string | null) { const options: Intl.DateTimeFormatOptions = { dateStyle: "medium", timeStyle: "short", timeZone: timezone || "UTC" }; try { return new Intl.DateTimeFormat(locale === "fa" ? "fa-IR-u-ca-persian" : locale, options).format(new Date(value)); } catch { return new Intl.DateTimeFormat(locale, { ...options, timeZone: "UTC" }).format(new Date(value)); } }
function AppointmentCard({ item, locale, detail, href }: { item: Item; locale: Locale; detail?: boolean; href: (path?: string) => string }) {
  const t = labels[locale];
  const status = t.statuses[item.status as keyof typeof t.statuses] || item.status;
  return <Card><CardHeader><CardTitle className="flex flex-wrap items-center gap-2 justify-between"><span>{item.service.name}</span><Badge variant="secondary">{status}</Badge></CardTitle></CardHeader><CardContent className="space-y-3">
    <p>{item.service.organization.name}</p><p>{dateTime(item.startTime, locale, item.service.organization.timezone)} – {dateTime(item.endTime, locale, item.service.organization.timezone)}</p>
    {item.bookingReference && <p dir="ltr" className="font-mono text-start">{item.bookingReference}</p>}
    <p>{new Intl.NumberFormat(locale).format(item.service.price)} {t.price}</p>
    {detail ? <><p>{item.service.serviceProvider?.firstName} {item.service.serviceProvider?.lastName}</p><p>{item.service.organization.address}</p>{item.service.organization.phone && <a className="block underline" href={`tel:${item.service.organization.phone}`}>{item.service.organization.phone}</a>}</> : <Link className={buttonVariants({ variant: "outline" })} href={href(`/my-appointments/${encodeURIComponent(item.id)}`)}>{t.details}</Link>}
  </CardContent></Card>;
}
export function PrivateAppointmentTracking({ locale: rawLocale, slug, appointmentId }: { locale: string; slug: string; appointmentId?: string }) {
  const locale: Locale = rawLocale === "en" || rawLocale === "ar" ? rawLocale : "fa";
  const t = labels[locale];
  const routes = useAppointmentRoutePaths({ href: (subPath = "/") => buildAppointmentPublicPath({ locale, organizationSlug: slug, subPath }), organizationRootHref: "/", isCustomDomain: false });
  const [ref, setRef] = useState("");
  const [result, setResult] = useState<{ items: Item[]; hasMore: boolean } | null>(null);
  const [loading, setLoading] = useState(Boolean(appointmentId));
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!appointmentId) return;
    const controller = new AbortController();
    appFetch(`/api/public/appointments/${encodeURIComponent(appointmentId)}?organizationSlug=${encodeURIComponent(slug)}`, { cache: "no-store", signal: controller.signal })
      .then(async response => { if (!response.ok) throw new Error("unavailable"); return await response.json() as { appointment: Item }; })
      .then(data => { if (!controller.signal.aborted) setResult({ items: [data.appointment], hasMore: false }); })
      .catch(() => { if (!controller.signal.aborted) setError(true); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [appointmentId, slug]);
  async function lookup(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (loading) return;
    setLoading(true); setError(false); setResult(null);
    try {
      const response = await appFetch("/api/public/appointments/lookup", { method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store", body: JSON.stringify({ organizationSlug: slug, ...(ref.trim() ? { bookingReference: ref.trim() } : {}) }) });
      if (!response.ok) throw new Error("unavailable");
      const data = await response.json() as { appointments: Item[]; hasMore: boolean };
      setResult({ items: data.appointments, hasMore: data.hasMore });
    } catch { setError(true); } finally { setLoading(false); }
  }
  return <main className="container mx-auto max-w-3xl space-y-5 px-4 py-8" dir={locale === "en" ? "ltr" : "rtl"}>
    <h1 className="text-2xl font-bold">{t.title}</h1><p className="text-muted-foreground">{t.note}</p>
    {!appointmentId && <GuestClaimPanel key={slug} locale={locale} slug={slug} kind="APPOINTMENT" />}
    {!appointmentId && <form onSubmit={lookup} className="space-y-3"><label htmlFor="booking-reference">{t.ref}</label><Input id="booking-reference" value={ref} onChange={event => setRef(event.target.value.toUpperCase())} maxLength={64} autoComplete="off" dir="ltr" /><Button disabled={loading} type="submit">{loading ? t.loading : t.show}</Button></form>}
    {loading && <p role="status">{t.loading}</p>}{error && <p role="alert" className="text-destructive">{t.denied}</p>}
    {result && <section className="space-y-3">{result.items.length === 0 && <p>{t.none}</p>}{result.items.map(item => <AppointmentCard key={item.id} item={item} locale={locale} detail={Boolean(appointmentId)} href={routes.href} />)}{result.hasMore && <p>{t.more}</p>}</section>}
    <div className="flex flex-wrap gap-2">{appointmentId && <Link className={buttonVariants({ variant: "outline" })} href={routes.href("/my-appointments")}>{t.back}</Link>}<Link className={buttonVariants({ variant: "outline" })} href={routes.href("/booking")}>{t.booking}</Link></div>
  </main>;
}
