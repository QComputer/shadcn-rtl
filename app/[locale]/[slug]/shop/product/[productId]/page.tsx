import { notFound } from "next/navigation";
import { ApiError } from "@/lib/api-guards";
import { prisma } from "@/lib/db";
import { getPublicCatalogProduct, getPublicCatalogSnapshot } from "@/lib/public-catalog/service.server";
import RetailPreview from "@/app/[locale]/retail-preview/[store]/retail-preview";
import LegacyProductClient from "../legacy-product-client";

export const dynamic = "force-dynamic";
type Params = { locale: string; slug: string; productId: string };

export default async function ShopProductPage({ params }: { params: Promise<Params> }) {
  const { locale, slug, productId } = await params;
  if (locale !== "fa") return <LegacyProductClient params={Promise.resolve({ locale, slug, productId })} />;
  const organization = await prisma.organization.findFirst({
    where: { slug, isActive: true, deletedAt: null, isPlatformOwner: false },
    select: { branding: { select: { retailPresentationTheme: true, retailPreviewOnly: true } } },
  });
  if (!organization?.branding?.retailPresentationTheme || organization.branding.retailPreviewOnly) {
    return <LegacyProductClient params={Promise.resolve({ locale, slug, productId })} />;
  }
  let catalog: Awaited<ReturnType<typeof getPublicCatalogSnapshot>>;
  let detail: Awaited<ReturnType<typeof getPublicCatalogProduct>>;
  try {
    [catalog, detail] = await Promise.all([getPublicCatalogSnapshot(slug), getPublicCatalogProduct(slug, productId)]);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
  const products = catalog.products.some((product) => product.id === detail.id) ? catalog.products : [...catalog.products, detail];
  const storefrontPath = `/${encodeURIComponent(locale)}/${encodeURIComponent(slug)}/shop`;
  return <RetailPreview liveView={{ identifier: catalog.organization.identifier, name: catalog.organization.name,
    description: catalog.organization.description, branding: catalog.organization.branding, theme: catalog.organization.theme,
    previewOnly: catalog.organization.previewOnly,
    categories: catalog.categories.map(({ id, slug: categorySlug, name }) => ({ id, slug: categorySlug, name })), products }}
    productId={detail.slug ?? detail.id} storefrontPath={storefrontPath} checkoutPath={`${storefrontPath}/checkout`} />;
}
