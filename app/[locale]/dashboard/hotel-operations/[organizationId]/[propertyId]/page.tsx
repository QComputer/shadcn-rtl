import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { HotelGuestBookingRequests } from "@/components/hotel-operations/hotel-guest-booking-requests";
import { HotelRequestReception } from "@/components/hotel-operations/hotel-request-reception";
import { HotelDraftAccommodations } from "@/components/hotel-operations/hotel-draft-accommodations";
import { HotelOperationsWorkspace } from "@/components/hotel-operations/hotel-operations-workspace";
import { auth } from "@/lib/auth";
import { getHotelOperationsOrganization } from "@/lib/hotel/management/hotel-operations-dashboard-context.server";
import { DAMOON_DEMO_BOOKING, damoonDemoBookingUrl, isDamoonDemoOrganizationSlug } from "@/lib/hotel/services/damoon-demo-booking";

export default async function HotelOperationsPropertyPage({
  params,
}: {
  params: Promise<{ locale: string; organizationId: string; propertyId: string }>;
}) {
  const [{ locale, organizationId, propertyId }, session] = await Promise.all([params, auth()]);
  if (!session?.user?.id || !session.user.role) {
    redirect(`/${locale}/login?callbackUrl=${encodeURIComponent(`/${locale}/dashboard/hotel-operations`)}`);
  }
  const organization = await getHotelOperationsOrganization({
    userId: session.user.id,
    sessionOrganizationId: session.user.organizationId,
    sessionRole: session.user.role,
    organizationId,
  });
  const property = organization?.properties.find((item) => item.id === propertyId);
  if (!organization || !property) notFound();
  const demoGuestUrl = isDamoonDemoOrganizationSlug(organization.slug) && property.slug === DAMOON_DEMO_BOOKING.propertySlug
    ? damoonDemoBookingUrl(locale)
    : null;

  return <main className="mx-auto min-w-0 w-full max-w-[1600px] space-y-4 p-3 sm:p-6">
    <div className="flex flex-wrap items-center justify-between gap-2"><Link className="inline-flex min-h-10 items-center rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" href={`/${locale}/dashboard/hotel-operations${organization.role === "SUPER_ADMIN" ? `?organizationId=${encodeURIComponent(organization.id)}` : ""}`}>
      ← {locale === "en" ? "All properties" : locale === "ar" ? "كل العقارات" : "بازگشت به املاک"}
    </Link><Link className="inline-flex min-h-10 items-center rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" href={`/${locale}/dashboard/hotel-operations/${encodeURIComponent(organization.id)}/${encodeURIComponent(property.id)}/reservations`}>
      {locale === "en" ? "Reservation center" : locale === "ar" ? "مركز الحجوزات" : "رزرواسیون"}
    </Link></div>
    <HotelGuestBookingRequests organizationId={organization.id} propertyId={property.id} locale={locale} />
    <HotelRequestReception organizationId={organization.id} propertyId={property.id} locale={locale} canConfigure={organization.role === "ADMIN" || organization.role === "SUPER_ADMIN"} showGuestPortal={false} demoGuestUrl={demoGuestUrl} />
    <HotelDraftAccommodations
      key={`drafts:${organization.id}:${property.id}`}
      organizationId={organization.id}
      propertyId={property.id}
      locale={locale}
    />
    <HotelOperationsWorkspace
      key={`${organization.id}:${property.id}`}
      organizationId={organization.id}
      propertyId={property.id}
      propertyName={`${organization.name} · ${property.name}`}
      propertyTimezone={property.timezone}
      locale={locale}
      canPreviewAvailability={organization.role === "ADMIN" || organization.role === "SUPER_ADMIN"}
    />
  </main>;
}
