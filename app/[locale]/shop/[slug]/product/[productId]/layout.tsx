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

type ProductDetailLayoutProps = {
  children: React.ReactNode;
  params: Promise<{
    locale: string;
    slug: string;
    productId: string;
  }>;
};

async function getPublicProduct(slug: string, productId: string) {
  return prisma.product.findFirst({
    where: {
      OR: [{ id: productId }, { slug: productId }],
      organizationSlug: slug,
      isActive: true,
      deletedAt: null,
      organization: {
        slug,
        type: "SHOP",
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
        },
      },
      category: {
        select: {
          name: true,
        },
      },
    },
  });
}

export async function generateMetadata({ params }: ProductDetailLayoutProps): Promise<Metadata> {
  const { locale, slug, productId } = await params;
  const product = await getPublicProduct(slug, productId);

  if (!product) {
    return { title: "Product Not Found" };
  }

  const productSegment = product.slug || product.id;
  const path = `/${locale}/shop/${slug}/product/${productSegment}`;
  const productUploadedShareImage = product.image || product.organization.coverImage || product.organization.logo;

  return buildPublicMetadata({
    locale,
    path,
    title: `${product.name} | ${product.organization.name}`,
    description: product.description || `${product.name} from ${product.organization.name}.`,
    image: getUploadedOrGeneratedSeoImageUrl(productUploadedShareImage, {
      kind: "product",
      locale,
      title: product.name,
      subtitle: product.description || `${product.name} from ${product.organization.name}.`,
      organizationName: product.organization.name,
    }),
    keywords: ["Bazar Baz", "product", product.name, product.organization.slug, product.category.name],
    alternatePath: (nextLocale) => `/${nextLocale}/shop/${slug}/product/${productSegment}`,
  });
}

export default async function ProductDetailLayout({ children, params }: ProductDetailLayoutProps) {
  const { locale, slug, productId } = await params;
  const product = await getPublicProduct(slug, productId);

  if (!product) return children;

  const productSegment = product.slug || product.id;
  if (product.slug && productId !== product.slug) {
    redirect(`/${locale}/shop/${slug}/product/${product.slug}`);
  }

  const path = `/${locale}/shop/${slug}/product/${productSegment}`;
  const productUploadedShareImage = product.image || product.organization.coverImage || product.organization.logo;
  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${getCanonicalUrl(path)}#product`,
    name: product.name,
    description: truncateSeoText(product.description, `${product.name} from ${product.organization.name}.`),
    image: getSeoImageUrl(productUploadedShareImage),
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
      url: getCanonicalUrl(path),
    },
  };

  return (
    <>
      <JsonLd
        data={[
          productJsonLd,
          buildBreadcrumbJsonLd([
            { name: "Home", path: `/${locale}` },
            { name: product.organization.name, path: `/${locale}/shop/${slug}` },
            { name: product.name, path },
          ]),
        ]}
      />
      {children}
    </>
  );
}
