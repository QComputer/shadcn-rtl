import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { HotelOperationsWorkspace } from "@/components/hotel-operations/hotel-operations-workspace";
import { auth } from "@/lib/auth";
import { getHotelOperationsOrganization } from "@/lib/hotel/management/hotel-operations-dashboard-context.server";

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

  return <main className="mx-auto min-w-0 w-full max-w-[1600px] space-y-4 p-3 sm:p-6">
    <Link className="inline-flex rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" href={`/${locale}/dashboard/hotel-operations${organization.role === "SUPER_ADMIN" ? `?organizationId=${encodeURIComponent(organization.id)}` : ""}`}>
      ← {locale === "en" ? "All properties" : locale === "ar" ? "كل العقارات" : "بازگشت به املاک"}
    </Link>
    <HotelOperationsWorkspace
      key={`${organization.id}:${property.id}`}
      organizationId={organization.id}
      propertyId={property.id}
      propertyName={`${organization.name} · ${property.name}`}
      propertyTimezone={property.timezone}
      locale={locale}
    />
  </main>;
}
