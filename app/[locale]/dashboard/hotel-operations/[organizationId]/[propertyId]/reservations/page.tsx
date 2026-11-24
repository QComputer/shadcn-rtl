import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { HotelOperationalReservations } from "@/components/hotel-operations/hotel-operational-reservations";
import { HotelReservationOccupancyCalendar } from "@/components/hotel-operations/hotel-reservation-occupancy-calendar";
import { auth } from "@/lib/auth";
import { getHotelReservationCenterContext } from "@/lib/hotel/management/hotel-operations-dashboard-context.server";

const title = { fa: "مرکز رزرواسیون", en: "Reservation center", ar: "مركز الحجوزات" } as const;
const intro = { fa: "ورود و خروج امروز، وضعیت اتاق‌ها و رزروهای هتل را از یک صفحه مدیریت کنید.", en: "Manage today's arrivals and departures, room occupancy, and hotel reservations in one place.", ar: "أدر وصول اليوم ومغادرته وإشغال الغرف والحجوزات من مكان واحد." } as const;

export default async function HotelReservationCenterPage({ params }: { params: Promise<{ locale: string; organizationId: string; propertyId: string }> }) {
  const [{ locale, organizationId, propertyId }, session] = await Promise.all([params, auth()]);
  if (!session?.user?.id || !session.user.role) redirect(`/${locale}/login?callbackUrl=${encodeURIComponent(`/${locale}/dashboard/hotel-operations/${organizationId}/${propertyId}/reservations`)}`);
  const access = await getHotelReservationCenterContext({ userId: session.user.id, sessionOrganizationId: session.user.organizationId, sessionRole: session.user.role, organizationId, propertyId });
  if (!access) notFound();
  const copy = title[locale as keyof typeof title] ?? title.fa;
  const direction = locale === "en" ? "ltr" : "rtl";
  const back = `/${locale}/dashboard/hotel-operations/${encodeURIComponent(organizationId)}/${encodeURIComponent(propertyId)}`;
  return <main className="mx-auto min-w-0 w-full max-w-[1600px] space-y-4 p-3 sm:p-6 [overflow-wrap:anywhere]" dir={direction}>
    <header className="min-w-0 space-y-2"><Link className="inline-flex min-h-10 items-center rounded-md px-3 text-sm text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" href={back}>{locale === "en" ? "← Hotel operations" : locale === "ar" ? "→ عمليات الفندق" : "→ بازگشت به عملیات هتل"}</Link><h1 className="min-w-0 text-2xl font-bold">{copy} · {access.property.name}</h1><p className="text-sm text-muted-foreground">{intro[locale as keyof typeof intro] ?? intro.fa}</p></header>
    <HotelOperationalReservations key={`${organizationId}:${propertyId}:${session.user.id}`} organizationId={organizationId} propertyId={propertyId} locale={locale} mode="reception" canConfigure={session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN"} centerMode propertyTimezone={access.property.timezone} />
    <HotelReservationOccupancyCalendar key={`${organizationId}:${propertyId}:${session.user.id}`} organizationId={organizationId} propertyId={propertyId} propertyTimezone={access.property.timezone} locale={locale} />
  </main>;
}
