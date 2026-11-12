import type { Metadata } from "next";
import { redirect } from "next/navigation";
import prisma from "@/lib/db";
import { JsonLd } from "@/components/seo/json-ld";
import {
  buildBreadcrumbJsonLd,
  buildPublicMetadata,
  getCanonicalUrl,
  getSeoImageUrl,
  getUploadedOrGeneratedSeoImageUrl,
  truncateSeoText,
} from "@/lib/seo";
import { getShopTenantSeoContext } from "@/lib/custom-domain-seo";
import { buildOrganizationPublicPath } from "@/lib/custom-domain-routing";
import { encodePublicRouteSegment } from "@/lib/shop-public-paths";
import { headers } from "next/headers";
import { logProductRouteDiagnostic, productRouteTraceId } from "@/lib/product-route-diagnostics";
import { hasModernRetailProductExperience } from "@/lib/retail/shop-experience";
import { getPublicCatalogProduct } from "@/lib/public-catalog/service.server";
import { verifiedRetailProductJsonLd } from "@/lib/retail/product-detail";
import { ApiError } from "@/lib/api-guards";

type ProductDetailLayoutProps = {
  children: React.ReactNode;
  params: Promise<{
    locale: string;
    slug: string;
    productId: string;
  }>;
};

async function getPublicProduct(slug: string, productId: string) {
  const traceId = productRouteTraceId(await headers());
  const identifierKind = /^[a-z0-9]{20,}$/i.test(productId) ? "id" : "slug";
  logProductRouteDiagnostic(traceId, "layout.prisma-lookup.start", { identifierKind });
  try {
    const product = await prisma.product.findFirst({
      where: {
        OR: [{ id: productId }, { slug: productId }],
        organizationSlug: slug,
        isActive: true,
        deletedAt: null,
        organization: {
          slug,
          isActive: true,
          deletedAt: null,
        },
      },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        basePrice: true,
        image: true,
        sku: true,
        updatedAt: true,
        organization: {
          select: {
            name: true,
            slug: true,
            logo: true,
            coverImage: true,
            settings: { select: { settings: true } },
            branding: { select: { retailPresentationTheme: true, retailPreviewOnly: true } },
          },
        },
        category: {
          select: {
            name: true,
          },
        },
      },
    });
    logProductRouteDiagnostic(traceId, "layout.prisma-lookup.result", { found: Boolean(product) });
    return product;
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error && typeof error.code === "string" ? error.code : null;
    logProductRouteDiagnostic(traceId, "layout.prisma-lookup.error", { errorName: error instanceof Error ? error.name : "UnknownError", errorCode: code });
    throw error;
  }
}

export async function generateMetadata({ params }: ProductDetailLayoutProps): Promise<Metadata> {
  const { locale, slug, productId } = await params;
  const traceId = productRouteTraceId(await headers());
  logProductRouteDiagnostic(traceId, "layout.metadata.start");
  const product = await getPublicProduct(slug, productId);

  if (!product) {
    logProductRouteDiagnostic(traceId, "layout.metadata.product-missing");
    return { title: "Product Not Found" };
  }

  logProductRouteDiagnostic(traceId, "layout.metadata.product-found");

  const productSegment = product.slug || product.id;
  const seoContext = await getShopTenantSeoContext({ locale, slug, subPath: `/product/${encodePublicRouteSegment(productSegment)}` });
  const productUploadedShareImage = product.image || product.organization.coverImage || product.organization.logo;

  const metadata = buildPublicMetadata({
    locale,
    baseUrl: seoContext.baseUrl,
    path: seoContext.path,
    title: `${product.name} | ${product.organization.name}`,
    description: product.description || `${product.name} from ${product.organization.name}.`,
    image: getUploadedOrGeneratedSeoImageUrl(productUploadedShareImage, {
      kind: "product",
      locale,
      title: product.name,
      subtitle: product.description || `${product.name} from ${product.organization.name}.`,
      organizationName: product.organization.name,
    }, seoContext.baseUrl),
    keywords: ["Bazarbaaz", "product", product.name, product.organization.slug, product.category.name],
    alternatePath: seoContext.alternatePath,
  });
  logProductRouteDiagnostic(traceId, "layout.metadata.ready");
  return metadata;
}

export default async function ProductDetailLayout({ children, params }: ProductDetailLayoutProps) {
  const { locale, slug, productId } = await params;
  const traceId = productRouteTraceId(await headers());
  logProductRouteDiagnostic(traceId, "layout.render.start");
  const product = await getPublicProduct(slug, productId);

  if (!product) {
    logProductRouteDiagnostic(traceId, "layout.render.product-missing");
    return children;
  }

  const productSegment = product.slug || product.id;
  if (product.slug && productId !== product.slug) {
    logProductRouteDiagnostic(traceId, "layout.canonical-redirect");
    const redirectContext = await getShopTenantSeoContext({ locale, slug, subPath: `/product/${encodePublicRouteSegment(product.slug)}` });
    redirect(redirectContext.path);
  }

  const seoContext = await getShopTenantSeoContext({ locale, slug, subPath: `/product/${encodePublicRouteSegment(productSegment)}` });
  const path = seoContext.path;
  const productUploadedShareImage = product.image || product.organization.coverImage || product.organization.logo;
  const modern = hasModernRetailProductExperience(product.organization.settings?.settings, product.organization.branding ?? {});
  let verified: Awaited<ReturnType<typeof getPublicCatalogProduct>> | null = null;
  if (modern) {
    logProductRouteDiagnostic(traceId, "layout.catalog-lookup.start");
    try {
      verified = await getPublicCatalogProduct(slug, productId);
      logProductRouteDiagnostic(traceId, "layout.catalog-lookup.result", { found: true });
    } catch (error) {
      const status = error instanceof ApiError ? error.status : null;
      logProductRouteDiagnostic(traceId, "layout.catalog-lookup.error", { status });
      if (!(error instanceof ApiError && error.status === 404)) throw error;
    }
  }
  const productJsonLd = modern ? verified ? verifiedRetailProductJsonLd(verified, getCanonicalUrl(path, seoContext.baseUrl)) : null : {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${getCanonicalUrl(path, seoContext.baseUrl)}#product`,
    name: product.name,
    description: truncateSeoText(product.description, `${product.name} from ${product.organization.name}.`),
    image: getSeoImageUrl(productUploadedShareImage, seoContext.baseUrl),
    sku: product.sku || product.id,
    category: product.category.name,
    brand: {
      "@type": "Brand",
      name: product.organization.name,
    },
    offers: {
      "@type": "Offer",
      price: Number(product.basePrice),
      priceCurrency: "IRR",
      availability: "https://schema.org/InStock",
      url: getCanonicalUrl(path, seoContext.baseUrl),
    },
  };

  return (
    <>
      <JsonLd
        data={[
          ...(productJsonLd ? [productJsonLd] : []),
          buildBreadcrumbJsonLd([
            { name: "Home", path: seoContext.isCustomDomain ? "/" : `/${locale}` },
            { name: product.organization.name, path: buildOrganizationPublicPath({ locale, organizationSlug: slug, surface: "shop", isCustomDomain: seoContext.isCustomDomain }) },
            { name: product.name, path },
          ], seoContext.baseUrl),
        ]}
      />
      {children}
    </>
  );
}
