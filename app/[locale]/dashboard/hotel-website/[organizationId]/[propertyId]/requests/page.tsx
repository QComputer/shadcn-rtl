import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { HotelGuestBookingRequests } from "@/components/hotel-operations/hotel-guest-booking-requests";
import { auth } from "@/lib/auth";
import { getHotelCmsDashboardOrganization } from "@/lib/hotel-cms/hotel-cms-dashboard-context.server";

const heading = { fa: "درخواست‌های پذیرش", en: "Reception requests", ar: "طلبات الاستقبال" } as const;

export default async function HotelRequestsPage({ params }: { params: Promise<{ locale: string; organizationId: string; propertyId: string }> }) {
  const [{ locale, organizationId, propertyId }, session] = await Promise.all([params, auth()]);
  if (!session?.user?.id || !session.user.role) redirect(`/${locale}/login?callbackUrl=${encodeURIComponent(`/${locale}/dashboard/hotel-website/${organizationId}/${propertyId}/requests`)}`);
  const organization = await getHotelCmsDashboardOrganization({
    userId: session.user.id,
    sessionOrganizationId: session.user.organizationId,
    sessionRole: session.user.role,
    organizationId,
  });
  const property = organization?.properties.find((item) => item.id === propertyId);
  if (!organization || !property) notFound();
  const language = locale === "en" || locale === "ar" ? locale : "fa";
  return <main className="mx-auto max-w-6xl space-y-4 p-4 sm:p-6">
    <Link className="inline-flex rounded-md border px-3 py-2 text-sm" href={`/${locale}/dashboard/hotel-website/${encodeURIComponent(organizationId)}/${encodeURIComponent(propertyId)}`}>{language === "fa" ? "بازگشت به مدیریت ملک" : language === "ar" ? "العودة إلى إدارة العقار" : "Back to property management"}</Link>
    <header><h1 className="text-2xl font-bold">{heading[language]}</h1><p className="text-sm text-muted-foreground">{organization.name} · {property.name}</p></header>
    <HotelGuestBookingRequests organizationId={organizationId} propertyId={propertyId} locale={language} />
  </main>;
}
