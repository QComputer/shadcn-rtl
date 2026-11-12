import { notFound } from "next/navigation";
import { ApiError } from "@/lib/api-guards";
import { prisma } from "@/lib/db";
import { getPublicCatalogProduct, getPublicCatalogSnapshot, getRelatedPublicProducts } from "@/lib/public-catalog/service.server";
import RetailLiveCatalog from "@/app/[locale]/retail/[organization]/retail-catalog";
import LegacyProductClient from "../legacy-product-client";
import { hasModernRetailProductExperience } from "@/lib/retail/shop-experience";
import { getShopTenantSeoContext } from "@/lib/custom-domain-seo";
import { buildShopProductsPath } from "@/lib/shop-public-paths";
import { RelatedProducts } from "@/components/retail/related-products";
import { headers } from "next/headers";
import { logProductRouteDiagnostic, productRouteTraceId } from "@/lib/product-route-diagnostics";

export const dynamic = "force-dynamic";
type Params = { locale: string; slug: string; productId: string };

export default async function ShopProductPage({ params }: { params: Promise<Params> }) {
  const { locale, slug, productId } = await params;
  const traceId = productRouteTraceId(await headers());
  logProductRouteDiagnostic(traceId, "page.enter", { locale });
  if (locale !== "fa") {
    logProductRouteDiagnostic(traceId, "page.legacy-render", { reason: "unsupported-modern-locale" });
    return <LegacyProductClient params={Promise.resolve({ locale, slug, productId })} />;
  }
  const organization = await prisma.organization.findFirst({
    where: { slug, isActive: true, deletedAt: null, isPlatformOwner: false },
    select: { settings: { select: { settings: true } }, branding: { select: { retailPresentationTheme: true, retailPreviewOnly: true } } },
  });
  if (!organization || !hasModernRetailProductExperience(organization.settings?.settings, organization.branding ?? {})) {
    logProductRouteDiagnostic(traceId, "page.legacy-render", { reason: organization ? "legacy-experience" : "tenant-missing" });
    return <LegacyProductClient params={Promise.resolve({ locale, slug, productId })} />;
  }
  logProductRouteDiagnostic(traceId, "page.modern-tenant-resolved");
  let catalog: Awaited<ReturnType<typeof getPublicCatalogSnapshot>>;
  let detail: Awaited<ReturnType<typeof getPublicCatalogProduct>>;
  logProductRouteDiagnostic(traceId, "page.catalog-lookup.start");
  try {
    [catalog, detail] = await Promise.all([getPublicCatalogSnapshot(slug), getPublicCatalogProduct(slug, productId)]);
  } catch (error) {
    const status = error instanceof ApiError ? error.status : null;
    logProductRouteDiagnostic(traceId, "page.catalog-lookup.error", { status });
    if (error instanceof ApiError && error.status === 404) {
      logProductRouteDiagnostic(traceId, "page.explicit-not-found", { reason: "catalog-lookup-404" });
      notFound();
    }
    throw error;
  }
  logProductRouteDiagnostic(traceId, "page.catalog-lookup.result", { found: true });
  const relatedProducts = await getRelatedPublicProducts(slug, detail.id);
  const products = catalog.products.some((product) => product.id === detail.id) ? catalog.products : [...catalog.products, detail];
  const seo = await getShopTenantSeoContext({ locale, slug });
  const storefrontPath = buildShopProductsPath({ locale, shopSlug: slug, isCustomDomain: seo.isCustomDomain });
  logProductRouteDiagnostic(traceId, "page.render");
  return <><RetailLiveCatalog view={{ identifier: catalog.organization.identifier, name: catalog.organization.name,
    description: catalog.organization.description, branding: catalog.organization.branding, theme: catalog.organization.theme,
    previewOnly: catalog.organization.previewOnly,
    categories: catalog.categories.map(({ id, slug: categorySlug, name, image, darkImage }) => ({ id, slug: categorySlug, name, image, darkImage })), products }}
    productSlug={detail.slug ?? detail.id} storefrontPath={storefrontPath} checkoutPath={`${storefrontPath}/checkout`} embedded />
    <RelatedProducts products={relatedProducts} storefrontPath={storefrontPath} /></>;
}
