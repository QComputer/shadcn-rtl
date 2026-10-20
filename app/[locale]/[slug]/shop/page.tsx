import { ApiError } from "@/lib/api-guards";
import { prisma } from "@/lib/db";
import { getPublicCatalogSnapshot } from "@/lib/public-catalog/service.server";
import RetailPreview from "@/app/[locale]/retail-preview/[store]/retail-preview";
import LegacyShopClient from "./legacy-shop-client";
import { hasModernRetailProductExperience } from "@/lib/retail/shop-experience";

export const dynamic = "force-dynamic";
type Params = { locale: string; slug: string };

async function loadPublishedRetail(slug: string, locale: string) {
  if (locale !== "fa") return { catalog: null, modernProductExperience: false };
  const organization = await prisma.organization.findFirst({
    where: { slug, isActive: true, deletedAt: null, isPlatformOwner: false },
    select: { settings: { select: { settings: true } }, branding: { select: { retailPresentationTheme: true, retailPreviewOnly: true } } },
  });
  const modernProductExperience = Boolean(organization && hasModernRetailProductExperience(organization.settings?.settings, organization.branding ?? {}));
  // Product capability activation must not opt a tenant into a new homepage.
  if (!organization?.branding?.retailPresentationTheme || organization.branding.retailPreviewOnly) return { catalog: null, modernProductExperience };
  try { return { catalog: await getPublicCatalogSnapshot(slug), modernProductExperience }; }
  catch (error) { if (error instanceof ApiError && error.status === 404) return { catalog: null, modernProductExperience }; throw error; }
}

export default async function ShopPage({ params }: { params: Promise<Params> }) {
  const { locale, slug } = await params;
  const { catalog, modernProductExperience } = await loadPublishedRetail(slug, locale);
  if (!catalog) return <LegacyShopClient params={Promise.resolve({ locale, slug })} modernProductExperience={modernProductExperience} />;
  const storefrontPath = `/${encodeURIComponent(locale)}/${encodeURIComponent(slug)}/shop`;
  const checkoutPath = `${storefrontPath}/checkout`;
  return <RetailPreview liveView={{
    identifier: catalog.organization.identifier,
    name: catalog.organization.name,
    description: catalog.organization.description,
    branding: catalog.organization.branding,
    theme: catalog.organization.theme,
    previewOnly: catalog.organization.previewOnly,
    categories: catalog.categories.map(({ id, slug: categorySlug, name }) => ({ id, slug: categorySlug, name })),
    products: catalog.products,
  }} storefrontPath={storefrontPath} checkoutPath={checkoutPath} />;
}
