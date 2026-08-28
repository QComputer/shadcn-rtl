import { permanentRedirect } from "next/navigation";
import { buildLegacyPlatformCapabilityRedirect, type PublicRouteSearchParams } from "@/lib/custom-domain-routing";

export default async function LegacyPlatformShopRoute({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; slug: string; legacyPath?: string[] }>;
  searchParams: Promise<PublicRouteSearchParams>;
}) {
  const { locale, slug, legacyPath } = await params;
  permanentRedirect(buildLegacyPlatformCapabilityRedirect({
    locale,
    organizationSlug: slug,
    surface: "shop",
    legacySegments: legacyPath,
    searchParams: await searchParams,
  }));
}
