import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft, ChevronRight, Package, ShoppingBag } from "lucide-react";
import prisma from "@/lib/db";
import { JsonLd } from "@/components/seo/json-ld";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { normalizePagination } from "@/lib/pagination";
import {
  buildBreadcrumbJsonLd,
  buildPublicMetadata,
  getCanonicalUrl,
  getSeoImageUrl,
  getUploadedOrGeneratedSeoImageUrl,
  truncateSeoText,
} from "@/lib/seo";
import { formatToman } from "@/lib/persian";
import { cn } from "@/lib/utils";

const CATEGORY_PAGE_SIZE = 24;

type ShopCategoryPageProps = {
  params: Promise<{
    locale: string;
    slug: string;
    categoryId: string;
  }>;
  searchParams?: Promise<{
    page?: string | string[];
  }>;
};

type CategoryPagination = ReturnType<typeof normalizePagination>;

function getRequestedPagination(searchParams?: { page?: string | string[] }): CategoryPagination {
  const rawPage = Array.isArray(searchParams?.page) ? searchParams?.page[0] : searchParams?.page;
  return normalizePagination(
    { page: rawPage, pageSize: CATEGORY_PAGE_SIZE },
    { defaultPageSize: CATEGORY_PAGE_SIZE, maxPageSize: CATEGORY_PAGE_SIZE },
  );
}

function categoryPath(locale: string, shopSlug: string, categorySegment: string, page = 1) {
  const path = `/${locale}/shop/${shopSlug}/category/${categorySegment}`;
  return page > 1 ? `${path}?page=${page}` : path;
}

const visibleProductWhere = {
  isActive: true,
  deletedAt: null,
  OR: [
    { trackInventory: false },
    { variants: { some: { deletedAt: null, inventory: { gt: 0 } } } },
  ],
};

async function getShopCategory(slug: string, categoryId: string, pagination: CategoryPagination) {
  return prisma.productCategory.findFirst({
    where: {
      OR: [{ id: categoryId }, { slug: categoryId }],
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
      image: true,
      updatedAt: true,
      _count: {
        select: {
          products: { where: visibleProductWhere },
        },
      },
      organization: {
        select: {
          name: true,
          slug: true,
          logo: true,
          coverImage: true,
        },
      },
      products: {
        where: visibleProductWhere,
        select: {
          id: true,
          slug: true,
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
        skip: pagination.skip,
        take: pagination.take,
      },
    },
  });
}

type ShopCategory = NonNullable<Awaited<ReturnType<typeof getShopCategory>>>;
type ShopCategoryProduct = ShopCategory["products"][number];

function getProductPrice(product: ShopCategoryProduct) {
  const variantPrices = product.variants
    .map((variant) => (variant.price == null ? null : Number(variant.price)))
    .filter((price): price is number => price != null);
  return variantPrices.length > 0 ? Math.min(...variantPrices) : Number(product.basePrice);
}

export async function generateMetadata({ params, searchParams }: ShopCategoryPageProps): Promise<Metadata> {
  const { locale, slug, categoryId } = await params;
  const pagination = getRequestedPagination(await searchParams);
  const category = await getShopCategory(slug, categoryId, pagination);

  if (!category) {
    return { title: "Category Not Found" };
  }

  const categorySegment = category.slug || category.id;
  const path = categoryPath(locale, slug, categorySegment, pagination.page);
  const categoryUploadedShareImage = category.image || category.organization.coverImage || category.organization.logo;

  return buildPublicMetadata({
    locale,
    path,
    title: `${category.name} | ${category.organization.name}${pagination.page > 1 ? ` - Page ${pagination.page}` : ""}`,
    description: category.description || `${category.name} products from ${category.organization.name}.`,
    image: getUploadedOrGeneratedSeoImageUrl(categoryUploadedShareImage, {
      kind: "category",
      locale,
      title: category.name,
      subtitle: category.description || `${category.name} products from ${category.organization.name}.`,
      organizationName: category.organization.name,
    }),
    keywords: ["Bazar Baz", "shop category", category.name, category.organization.slug],
    alternatePath: (nextLocale) => categoryPath(nextLocale, slug, categorySegment, pagination.page),
  });
}

export default async function ShopCategoryPage({ params, searchParams }: ShopCategoryPageProps) {
  const { locale, slug, categoryId } = await params;
  const pagination = getRequestedPagination(await searchParams);
  const category = await getShopCategory(slug, categoryId, pagination);

  if (!category) notFound();

  const categorySegment = category.slug || category.id;
  if (category.slug && categoryId !== category.slug) {
    redirect(categoryPath(locale, slug, category.slug, pagination.page));
  }

  const products = category.products;
  const totalProducts = category._count.products;
  const totalPages = Math.max(1, Math.ceil(totalProducts / pagination.pageSize));
  const path = categoryPath(locale, slug, categorySegment, pagination.page);
  const canonicalCategoryPath = categoryPath(locale, slug, categorySegment);
  const previousPath = pagination.page > 1 ? categoryPath(locale, slug, categorySegment, pagination.page - 1) : null;
  const nextPath = pagination.page < totalPages ? categoryPath(locale, slug, categorySegment, pagination.page + 1) : null;
  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "@id": `${getCanonicalUrl(path)}#products`,
    name: `${category.name} products`,
    numberOfItems: totalProducts,
    itemListElement: products.map((product, index) => ({
      "@type": "ListItem",
      position: pagination.skip + index + 1,
      url: getCanonicalUrl(`/${locale}/shop/${slug}/product/${product.slug || product.id}`),
      item: {
        "@type": "Product",
        name: product.name,
        description: truncateSeoText(product.description, `${product.name} from ${category.organization.name}.`),
        image: getSeoImageUrl(product.image || category.image || category.organization.coverImage || category.organization.logo),
        offers: {
          "@type": "Offer",
          price: getProductPrice(product),
          priceCurrency: "IRR",
          url: getCanonicalUrl(`/${locale}/shop/${slug}/product/${product.slug || product.id}`),
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
            mainEntity: { "@id": `${getCanonicalUrl(path)}#products` },
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
          <p className="mt-3 text-sm text-muted-foreground">
            {totalProducts} products
            {pagination.page > 1 ? ` - page ${pagination.page} of ${totalPages}` : ""}
          </p>
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
              <Link key={product.id} href={`/${locale}/shop/${slug}/product/${product.slug || product.id}`}>
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

        {totalPages > 1 && (
          <nav className="mt-8 flex flex-wrap items-center justify-center gap-3" aria-label="Product category pagination">
            {previousPath ? (
              <Link rel="prev" href={previousPath} className={cn(buttonVariants({ variant: "outline" }))}>
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Link>
            ) : null}
            <Link href={canonicalCategoryPath} className={cn(buttonVariants({ variant: pagination.page === 1 ? "default" : "outline", size: "sm" }))}>
              1
            </Link>
            {pagination.page > 2 && <span className="text-sm text-muted-foreground">...</span>}
            {pagination.page > 1 && pagination.page < totalPages && (
              <span className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}>{pagination.page}</span>
            )}
            {pagination.page < totalPages - 1 && <span className="text-sm text-muted-foreground">...</span>}
            {totalPages > 1 && (
              <Link
                href={categoryPath(locale, slug, categorySegment, totalPages)}
                className={cn(buttonVariants({ variant: pagination.page === totalPages ? "default" : "outline", size: "sm" }))}
              >
                {totalPages}
              </Link>
            )}
            {nextPath ? (
              <Link rel="next" href={nextPath} className={cn(buttonVariants({ variant: "outline" }))}>
                Next
                <ChevronRight className="h-4 w-4" />
              </Link>
            ) : null}
          </nav>
        )}
      </section>
    </main>
  );
}
