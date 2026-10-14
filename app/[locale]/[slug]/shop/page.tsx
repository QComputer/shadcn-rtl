import { ApiError } from "@/lib/api-guards";
import { prisma } from "@/lib/db";
import { getPublicCatalogSnapshot } from "@/lib/public-catalog/service.server";
import RetailPreview from "@/app/[locale]/retail-preview/[store]/retail-preview";
import LegacyShopClient from "./legacy-shop-client";

export const dynamic = "force-dynamic";
type Params = { locale: string; slug: string };

async function loadPublishedRetail(slug: string, locale: string) {
  if (locale !== "fa") return null;
  const organization = await prisma.organization.findFirst({
    where: { slug, isActive: true, deletedAt: null, isPlatformOwner: false },
    select: { branding: { select: { retailPresentationTheme: true, retailPreviewOnly: true } } },
  });
  if (!organization?.branding?.retailPresentationTheme || organization.branding.retailPreviewOnly) return null;
  try { return await getPublicCatalogSnapshot(slug); }
  catch (error) { if (error instanceof ApiError && error.status === 404) return null; throw error; }
}

export default async function ShopPage({ params }: { params: Promise<Params> }) {
  const { locale, slug } = await params;
  const catalog = await loadPublishedRetail(slug, locale);
  if (!catalog) return <LegacyShopClient params={Promise.resolve({ locale, slug })} />;
  const storefrontPath = `/${encodeURIComponent(locale)}/${encodeURIComponent(slug)}/shop`;
  const checkoutPath = `${storefrontPath}/checkout`;
  return <RetailPreview liveView={{
    identifier: catalog.organization.identifier,
    name: catalog.organization.name,
    description: catalog.organization.description,
    theme: catalog.organization.theme,
    previewOnly: catalog.organization.previewOnly,
    categories: catalog.categories.map(({ id, slug: categorySlug, name }) => ({ id, slug: categorySlug, name })),
    products: catalog.products,
  }} storefrontPath={storefrontPath} checkoutPath={checkoutPath} />;
}
