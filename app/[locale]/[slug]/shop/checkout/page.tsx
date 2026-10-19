import RetailCheckoutClient from "@/components/retail/checkout-client";
import { prisma } from "@/lib/db";
import LegacyCheckoutClient from "./legacy-checkout-client";

export const dynamic = "force-dynamic";

type CheckoutPageProps = {
  params: Promise<{ locale: string; slug: string }>;
};

export default async function CheckoutPage({ params }: CheckoutPageProps) {
  const { locale, slug } = await params;
  const organization = await prisma.organization.findFirst({
    where: { slug, isActive: true, deletedAt: null, isPlatformOwner: false },
    select: {
      branding: {
        select: {
          retailPresentationTheme: true,
          retailPreviewOnly: true,
        },
      },
    },
  });

  const hasPublishedRetailPresentation = Boolean(
    organization?.branding?.retailPresentationTheme &&
    organization.branding.retailPreviewOnly === false,
  );

  if (hasPublishedRetailPresentation) {
    return <RetailCheckoutClient locale={locale} organization={slug} storefrontPath={`/${encodeURIComponent(locale)}/${encodeURIComponent(slug)}/shop`} checkoutPath={`/${encodeURIComponent(locale)}/${encodeURIComponent(slug)}/shop/checkout`} />;
  }

  return <LegacyCheckoutClient locale={locale} slug={slug} />;
}
