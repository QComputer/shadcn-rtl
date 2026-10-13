import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { HotelCmsWorkspace } from "@/components/hotel-cms/hotel-cms-workspace";
import { auth } from "@/lib/auth";
import { getHotelCmsDashboardOrganization } from "@/lib/hotel-cms/hotel-cms-dashboard-context.server";

export default async function HotelWebsitePropertyDashboardPage({
  params,
}: {
  params: Promise<{ locale: string; organizationId: string; propertyId: string }>;
}) {
  const [{ locale, organizationId, propertyId }, session] = await Promise.all([params, auth()]);
  if (!session?.user?.id || !session.user.role) {
    redirect(`/${locale}/login?callbackUrl=${encodeURIComponent(`/${locale}/dashboard/hotel-website`)}`);
  }

  const organization = await getHotelCmsDashboardOrganization({
    userId: session.user.id,
    sessionOrganizationId: session.user.organizationId,
    sessionRole: session.user.role,
    organizationId,
  });
  const property = organization?.properties.find((item) => item.id === propertyId);
  if (!organization || !property) notFound();

  return <main className="mx-auto max-w-[1600px] p-2 sm:p-4">
    <Link className="mb-4 inline-flex rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" href={`/${locale}/dashboard/hotel-website${organization.role === "SUPER_ADMIN" ? `?organizationId=${encodeURIComponent(organization.id)}` : ""}`}>
      ← {locale === "en" ? "All properties" : locale === "ar" ? "كل العقارات" : "بازگشت به املاک"}
    </Link>
    <HotelCmsWorkspace
      scope={{ organizationId: organization.id, propertyId: property.id }}
      role={organization.role}
      propertyLabel={`${organization.name} · ${property.name}`}
    />
  </main>;
}
