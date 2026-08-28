import { permanentRedirect } from "next/navigation";
import { appendPublicRouteSearchParams, buildOrganizationRootPath, type PublicRouteSearchParams } from "@/lib/custom-domain-routing";

export default async function LegacyOrganizationHome({ params, searchParams }: {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<PublicRouteSearchParams>;
}) {
  const { locale, slug } = await params;
  permanentRedirect(appendPublicRouteSearchParams(
    buildOrganizationRootPath({ locale, organizationSlug: slug }),
    await searchParams,
  ));
}
