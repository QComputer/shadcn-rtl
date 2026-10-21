import type { Metadata } from "next";
import { CartPage } from "@/components/shop/cart-page";
import { prisma } from "@/lib/db";
import RetailCheckoutClient from "@/components/retail/checkout-client";
import { hasModernRetailProductExperience } from "@/lib/retail/shop-experience";
import { getShopTenantSeoContext } from "@/lib/custom-domain-seo";
import { buildShopProductsPath } from "@/lib/shop-public-paths";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function ShopCartPage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  const organization = await prisma.organization.findFirst({
    where: { slug, isActive: true, deletedAt: null, isPlatformOwner: false },
    select: { settings: { select: { settings: true } }, branding: { select: { retailPresentationTheme: true, retailPreviewOnly: true } } },
  });
  if (organization && hasModernRetailProductExperience(organization.settings?.settings, organization.branding ?? {})) {
    const seo = await getShopTenantSeoContext({ locale, slug });
    const storefrontPath = buildShopProductsPath({ locale, shopSlug: slug, isCustomDomain: seo.isCustomDomain });
    return <RetailCheckoutClient embedded locale={locale} organization={slug} storefrontPath={storefrontPath} checkoutPath={`${storefrontPath}/checkout`} cartOnly />;
  }
  return <CartPage />;
}
