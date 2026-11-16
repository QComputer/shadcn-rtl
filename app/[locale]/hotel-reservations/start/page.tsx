import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { HotelOperationalReservations } from "@/components/hotel-operations/hotel-operational-reservations";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db-runtime";
import { resolveHotelTenantForHost } from "@/lib/hotel/services/hotel-publication.service";

type Search = Record<string, string | string[] | undefined>;
function first(value: string | string[] | undefined) { return typeof value === "string" ? value : ""; }
function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
}
function safeStayQuery(search: Search) {
  const query = new URLSearchParams();
  const property = first(search.property);
  if (/^[a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?$/.test(property)) query.set("property", property);
  const checkIn = first(search.checkIn);
  const checkOut = first(search.checkOut);
  if (validDate(checkIn)) query.set("checkIn", checkIn);
  if (validDate(checkOut) && (!validDate(checkIn) || checkOut > checkIn)) query.set("checkOut", checkOut);
  const adults = first(search.adults);
  query.set("adults", /^([1-9]|1[0-2])$/.test(adults) ? adults : "2");
  const children = first(search.children);
  const count = /^(0|[1-8])$/.test(children) ? Number(children) : 0;
  query.set("children", String(count));
  const ages = first(search.childAges).split(",");
  if (count && ages.length === count && ages.every((age) => age === "" || (/^\d{1,2}$/.test(age) && Number(age) <= 17))) query.set("childAges", ages.join(","));
  return query.toString();
}
function initialStay(search: Search) {
  const checkIn = first(search.checkIn);
  const checkOut = first(search.checkOut);
  const rawAdults = first(search.adults);
  const adults = /^([1-9]|1[0-2])$/.test(rawAdults) ? Number(rawAdults) : 2;
  const rawChildren = first(search.children);
  const count = /^(0|[1-8])$/.test(rawChildren) ? Number(rawChildren) : 0;
  const ages = first(search.childAges).split(",");
  const childAges = count && ages.length === count && ages.every((age) => age === "" || (/^\d{1,2}$/.test(age) && Number(age) <= 17))
    ? ages.map((age) => age === "" ? null : Number(age))
    : Array.from({ length: count }, () => null);
  return { checkIn: validDate(checkIn) ? checkIn : "", checkOut: validDate(checkOut) && (!validDate(checkIn) || checkOut > checkIn) ? checkOut : "", adults, childAges };
}

/** Resolves the property from the verified request host before opening the existing authenticated guest flow. */
export default async function HotelReservationStartPage({ params, searchParams }: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Search>;
}) {
  const [{ locale }, search, requestHeaders, session] = await Promise.all([params, searchParams, headers(), auth()]);
  const host = requestHeaders.get("host");
  const tenant = await resolveHotelTenantForHost(host);
  if (!tenant) notFound();

  const propertySlug = first(search.property);
  if (!/^[a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?$/.test(propertySlug)) notFound();
  const property = await prisma.hotelProperty.findFirst({
    where: { organizationId: tenant.organizationId, slug: propertySlug, isActive: true, deletedAt: null, operationalMode: "RESERVATION" },
    select: { id: true },
  });
  if (!property) notFound();

  if (!session?.user?.id) {
    const query = safeStayQuery(search);
    const path = `/${locale}/hotel-reservations/start${query ? `?${query}` : ""}`;
    redirect(`/${locale}/login?callbackUrl=${encodeURIComponent(path)}`);
  }
  if (session.user.role !== "CUSTOMER") notFound();
  const membership = await prisma.customerClubMembership.findFirst({
    where: { organizationId: tenant.organizationId, customerId: session.user.id, status: "ACTIVE" },
    select: { id: true },
  });
  if (!membership) notFound();

  const previewNotice = locale === "fa"
    ? "پیش‌نمایش هتل دامون: نرخ، موجودی، اتاق‌ها و قوانین این محیط نمونه‌اند و تا تأیید مالک هتل اطلاعات قطعی نیستند. ثبت درخواست در این پیش‌نمایش جایگزین تأیید پذیرش نمی‌شود."
    : locale === "ar"
      ? "معاينة فندق دامون: الأسعار والتوفر والغرف والسياسات بيانات تجريبية وليست نهائية حتى يؤكدها مالك الفندق. إرسال الطلب هنا لا يحل محل تأكيد الاستقبال."
      : "Hotel Damoon preview: room, rate, inventory, and policy data are examples until confirmed by the hotel owner. A submission here is not a reception confirmation.";
  return <main className="mx-auto min-w-0 w-full max-w-5xl p-4 sm:p-6" dir={locale === "en" ? "ltr" : "rtl"}>
    <aside role="note" className="mb-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">{previewNotice}</aside>
    <HotelOperationalReservations key={`${tenant.organizationId}:${property.id}:${session.user.id}`} organizationId={tenant.organizationId} propertyId={property.id} locale={locale} mode="guest" canConfigure={false} initialStay={initialStay(search)} />
  </main>;
}
