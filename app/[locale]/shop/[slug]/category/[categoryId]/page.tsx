import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Package, ShoppingBag } from "lucide-react";
import prisma from "@/lib/db";
import { JsonLd } from "@/components/seo/json-ld";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  buildBreadcrumbJsonLd,
  buildPublicMetadata,
  getCanonicalUrl,
  getSeoImageUrl,
  truncateSeoText,
} from "@/lib/seo";
import { formatToman } from "@/lib/persian";

type ShopCategoryPageProps = {
  params: Promise<{
    locale: string;
    slug: string;
    categoryId: string;
  }>;
};

async function getShopCategory(slug: string, categoryId: string) {
  return prisma.productCategory.findFirst({
    where: {
      id: categoryId,
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
      description: true,
      image: true,
      updatedAt: true,
      organization: {
        select: {
          name: true,
          slug: true,
          logo: true,
          coverImage: true,
        },
      },
      products: {
        where: {
          isActive: true,
          deletedAt: null,
        },
        select: {
          id: true,
          name: true,
          description: true,
          image: true,
          basePrice: true,
          sortOrder: true,
          trackInventory: true,
          variants: {
            where: { deletedAt: null },
            select: {
              inventory: true,
              price: true,
            },
          },
        },
        orderBy: [{ sortOrder: "desc" }, { name: "asc" }],
        take: 60,
      },
    },
  });
}

type ShopCategory = NonNullable<Awaited<ReturnType<typeof getShopCategory>>>;
type ShopCategoryProduct = ShopCategory["products"][number];

function isVisibleProduct(product: ShopCategoryProduct) {
  if (!product.trackInventory) return true;
  return product.variants.reduce((sum, variant) => sum + (variant.inventory || 0), 0) > 0;
}

function getProductPrice(product: ShopCategoryProduct) {
  const variantPrices = product.variants
    .map((variant) => (variant.price == null ? null : Number(variant.price)))
    .filter((price): price is number => price != null);
  return variantPrices.length > 0 ? Math.min(...variantPrices) : Number(product.basePrice);
}

export async function generateMetadata({ params }: ShopCategoryPageProps): Promise<Metadata> {
  const { locale, slug, categoryId } = await params;
  const category = await getShopCategory(slug, categoryId);

  if (!category) {
    return { title: "Category Not Found" };
  }

  return buildPublicMetadata({
    locale,
    path: `/${locale}/shop/${slug}/category/${category.id}`,
    title: `${category.name} | ${category.organization.name}`,
    description: category.description || `${category.name} products from ${category.organization.name}.`,
    image: category.image || category.organization.coverImage || category.organization.logo,
    keywords: ["Bazar Baz", "shop category", category.name, category.organization.slug],
    alternatePath: (nextLocale) => `/${nextLocale}/shop/${slug}/category/${category.id}`,
  });
}

export default async function ShopCategoryPage({ params }: ShopCategoryPageProps) {
  const { locale, slug, categoryId } = await params;
  const category = await getShopCategory(slug, categoryId);

  if (!category) notFound();

  const products = category.products.filter(isVisibleProduct);
  const path = `/${locale}/shop/${slug}/category/${category.id}`;
  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "@id": `${getCanonicalUrl(path)}#products`,
    name: `${category.name} products`,
    numberOfItems: products.length,
    itemListElement: products.map((product, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: getCanonicalUrl(`/${locale}/shop/${slug}/product/${product.id}`),
      item: {
        "@type": "Product",
        name: product.name,
        description: truncateSeoText(product.description, `${product.name} from ${category.organization.name}.`),
        image: getSeoImageUrl(product.image || category.image || category.organization.logo),
        offers: {
          "@type": "Offer",
          price: getProductPrice(product),
          priceCurrency: "IRR",
          url: getCanonicalUrl(`/${locale}/shop/${slug}/product/${product.id}`),
        },
      },
    })),
  };

  return (
    <main className="min-h-screen bg-background">
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            "@id": `${getCanonicalUrl(path)}#category`,
            name: category.name,
            description: truncateSeoText(category.description, `${category.name} products from ${category.organization.name}.`),
            url: getCanonicalUrl(path),
            image: getSeoImageUrl(category.image || category.organization.coverImage || category.organization.logo),
          },
          itemListJsonLd,
          buildBreadcrumbJsonLd([
            { name: "Home", path: `/${locale}` },
            { name: category.organization.name, path: `/${locale}/shop/${slug}` },
            { name: category.name, path },
          ]),
        ]}
      />

      <section className="border-b bg-muted/30">
        <div className="container mx-auto px-4 py-10">
          <Badge variant="secondary" className="mb-4 gap-2">
            <ShoppingBag className="h-4 w-4" />
            {category.organization.name}
          </Badge>
          <h1 className="text-3xl font-bold md:text-4xl">{category.name}</h1>
          {category.description && <p className="mt-3 max-w-2xl text-muted-foreground">{category.description}</p>}
        </div>
      </section>

      <section className="container mx-auto px-4 py-8">
        {products.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center text-muted-foreground">
              <Package className="h-10 w-10" />
              <p>No active products are available in this category.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {products.map((product) => (
              <Link key={product.id} href={`/${locale}/shop/${slug}/product/${product.id}`}>
                <Card className="h-full overflow-hidden transition-shadow hover:shadow-md">
                  {product.image && <img src={product.image} alt={product.name} className="h-44 w-full object-cover" />}
                  <CardHeader>
                    <CardTitle className="line-clamp-2 text-lg">{product.name}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {product.description && <p className="mb-4 line-clamp-2 text-sm text-muted-foreground">{product.description}</p>}
                    <p className="font-bold text-primary">{formatToman(getProductPrice(product))}</p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
