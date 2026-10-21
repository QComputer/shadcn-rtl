import RetailCheckoutClient from "@/components/retail/checkout-client";
import { prisma } from "@/lib/db";
import LegacyCheckoutClient from "./legacy-checkout-client";
import { hasModernRetailProductExperience } from "@/lib/retail/shop-experience";
import { getShopTenantSeoContext } from "@/lib/custom-domain-seo";
import { buildShopProductsPath } from "@/lib/shop-public-paths";

export const dynamic = "force-dynamic";

type CheckoutPageProps = {
  params: Promise<{ locale: string; slug: string }>;
};

export default async function CheckoutPage({ params }: CheckoutPageProps) {
  const { locale, slug } = await params;
  const organization = await prisma.organization.findFirst({
    where: { slug, isActive: true, deletedAt: null, isPlatformOwner: false },
    select: {
      settings: { select: { settings: true } },
      branding: {
        select: {
          retailPresentationTheme: true,
          retailPreviewOnly: true,
        },
      },
    },
  });

  const hasPublishedRetailPresentation = Boolean(organization && hasModernRetailProductExperience(organization.settings?.settings, organization.branding ?? {}));

  if (hasPublishedRetailPresentation) {
    const seo = await getShopTenantSeoContext({ locale, slug });
    const storefrontPath = buildShopProductsPath({ locale, shopSlug: slug, isCustomDomain: seo.isCustomDomain });
    return <RetailCheckoutClient embedded locale={locale} organization={slug} storefrontPath={storefrontPath} checkoutPath={`${storefrontPath}/checkout`} />;
  }

  return <LegacyCheckoutClient locale={locale} slug={slug} />;
}
