import { notFound, redirect } from "next/navigation";
import { PublishedHotelWebsitePage } from "@/components/published-hotel-website-page";
import { auth } from "@/lib/auth";
import prisma from "@/lib/db";
import { getHotelCmsDashboardOrganization } from "@/lib/hotel-cms/hotel-cms-dashboard-context.server";
import { HotelWebsiteManagementService } from "@/lib/hotel/content/hotel-website-management.service";
import { adaptAuthenticatedHotelWebsitePreview } from "@/lib/hotel/organization-site-presentation";

export const dynamic = "force-dynamic";
const service = new HotelWebsiteManagementService();

export default async function PrivateHotelWebsiteRevisionPreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; organizationId: string; propertyId: string; revisionId: string }>;
  searchParams: Promise<{ locale?: string }>;
}) {
  const [{ locale: routeLocale, organizationId, propertyId, revisionId }, query, session] = await Promise.all([params, searchParams, auth()]);
  if (!session?.user?.id || !session.user.role) {
    redirect(`/${routeLocale}/login?callbackUrl=${encodeURIComponent(`/${routeLocale}/dashboard/hotel-website/${organizationId}/${propertyId}/preview/${revisionId}`)}`);
  }
  const organization = await getHotelCmsDashboardOrganization({
    userId: session.user.id,
    sessionOrganizationId: session.user.organizationId,
    sessionRole: session.user.role,
    organizationId,
  });
  const property = organization?.properties.find((item) => item.id === propertyId);
  if (!organization || !property) notFound();

  const locale = query.locale === "en" || query.locale === "ar" ? query.locale : "fa";
  let rawPreview: Awaited<ReturnType<typeof service.preview>>;
  try {
    rawPreview = await service.preview(
      { userId: session.user.id, role: session.user.role, organizationId: session.user.organizationId },
      { organizationId: organization.id, propertyId: property.id },
      revisionId,
      locale,
    );
  } catch {
    notFound();
  }
  const presentation = adaptAuthenticatedHotelWebsitePreview(rawPreview, {
    organizationId: organization.id,
    organizationSlug: organization.slug,
    propertySlug: property.slug,
    locale,
  });
  const branding = await prisma.organizationBranding.findUnique({
    where: { organizationId: organization.id },
    select: { displayName: true, logoUrl: true, themeColor: true, backgroundColor: true },
  });

  return <>
    <div style={{ padding: "8px 16px", background: "#f0f5f0", color: "#315849", font: "14px/1.6 sans-serif" }}>
      {routeLocale === "en" ? "Private website draft preview · this does not publish the site" : routeLocale === "ar" ? "معاينة خاصة لمسودة الموقع · لا يؤدي ذلك إلى نشر الموقع" : "پیش‌نمایش خصوصی پیش‌نویس · این کار سایت را منتشر نمی‌کند"}
    </div>
    <PublishedHotelWebsitePage
      propertySlug={property.slug}
      locale={locale}
      tenantKey={organization.id}
      presentation={presentation}
      branding={branding}
    />
  </>;
}
