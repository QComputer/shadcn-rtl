import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Calendar, ChevronLeft, ChevronRight, Clock, User } from "lucide-react";
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
import { getServicePrimaryMediaUrl } from "@/lib/ai-media/entity-primary-media";
import { canReadAiMediaEntityAttachmentColumns } from "@/lib/services/ai-media-entity-attachment-service";
import { buildOrganizationPublicPath } from "@/lib/custom-domain-routing";
import { getTenantSeoContext } from "@/lib/custom-domain-seo";

const CATEGORY_PAGE_SIZE = 24;

type ServiceCategoryPageProps = {
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

function categoryPath(locale: string, appointmentSlug: string, categorySegment: string, page = 1, isCustomDomain = false) {
  const path = buildOrganizationPublicPath({
    locale,
    organizationSlug: appointmentSlug,
    surface: "appointment",
    subPath: `/services/category/${categorySegment}`,
    isCustomDomain,
  });
  return page > 1 ? `${path}?page=${page}` : path;
}

const visibleServiceWhere = {
  isActive: true,
  deletedAt: null,
};

async function getServiceCategory(slug: string, categoryId: string, pagination: CategoryPagination) {
  const includeAiMediaAttachment = canReadAiMediaEntityAttachmentColumns();
  return prisma.serviceCategory.findFirst({
    where: {
      OR: [{ id: categoryId }, { slug: categoryId }],
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
      image: true,
      updatedAt: true,
      _count: {
        select: {
          services: { where: visibleServiceWhere },
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
      services: {
        where: visibleServiceWhere,
        select: {
          id: true,
          slug: true,
          name: true,
          description: true,
          image: true,
          ...(includeAiMediaAttachment ? { aiPrimaryMediaAssetId: true } : {}),
          price: true,
          duration: true,
          sortOrder: true,
          serviceProvider: {
            select: {
              name: true,
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        skip: pagination.skip,
        take: pagination.take,
      },
    },
  });
}

function getProviderName(service: NonNullable<Awaited<ReturnType<typeof getServiceCategory>>>["services"][number]) {
  const provider = service.serviceProvider;
  if (!provider) return null;
  return provider.name || [provider.firstName, provider.lastName].filter(Boolean).join(" ") || null;
}

export async function generateMetadata({ params, searchParams }: ServiceCategoryPageProps): Promise<Metadata> {
  const { locale, slug, categoryId } = await params;
  const pagination = getRequestedPagination(await searchParams);
  const category = await getServiceCategory(slug, categoryId, pagination);

  if (!category) {
    return { title: "Category Not Found" };
  }

  const categorySegment = category.slug || category.id;
  const seoContext = await getTenantSeoContext({ locale, slug, organizationType: "APPOINTMENT", subPath: `/services/category/${categorySegment}` });
  const path = pagination.page > 1 ? `${seoContext.path}?page=${pagination.page}` : seoContext.path;
  const categoryUploadedShareImage = category.image || category.organization.coverImage || category.organization.logo;

  return buildPublicMetadata({
    locale,
    baseUrl: seoContext.baseUrl,
    path,
    title: `${category.name} | ${category.organization.name}${pagination.page > 1 ? ` - Page ${pagination.page}` : ""}`,
    description: category.description || `${category.name} services from ${category.organization.name}.`,
    image: getUploadedOrGeneratedSeoImageUrl(categoryUploadedShareImage, {
      kind: "category",
      locale,
      title: category.name,
      subtitle: category.description || `${category.name} services from ${category.organization.name}.`,
      organizationName: category.organization.name,
    }),
    keywords: ["Bazarbaaz", "service category", category.name, category.organization.slug],
    alternatePath: (nextLocale) => categoryPath(nextLocale, slug, categorySegment, pagination.page, seoContext.isCustomDomain),
  });
}

export default async function ServiceCategoryPage({ params, searchParams }: ServiceCategoryPageProps) {
  const { locale, slug, categoryId } = await params;
  const pagination = getRequestedPagination(await searchParams);
  const category = await getServiceCategory(slug, categoryId, pagination);

  if (!category) notFound();

  const categorySegment = category.slug || category.id;
  const seoContext = await getTenantSeoContext({ locale, slug, organizationType: "APPOINTMENT", subPath: `/services/category/${categorySegment}` });
  if (category.slug && categoryId !== category.slug) {
    redirect(categoryPath(locale, slug, category.slug, pagination.page, seoContext.isCustomDomain));
  }

  const totalServices = category._count.services;
  const totalPages = Math.max(1, Math.ceil(totalServices / pagination.pageSize));
  const path = categoryPath(locale, slug, categorySegment, pagination.page, seoContext.isCustomDomain);
  const canonicalCategoryPath = categoryPath(locale, slug, categorySegment, 1, seoContext.isCustomDomain);
  const previousPath = pagination.page > 1 ? categoryPath(locale, slug, categorySegment, pagination.page - 1, seoContext.isCustomDomain) : null;
  const nextPath = pagination.page < totalPages ? categoryPath(locale, slug, categorySegment, pagination.page + 1, seoContext.isCustomDomain) : null;
  const appointmentPath = (subPath = "/") => buildOrganizationPublicPath({
    locale,
    organizationSlug: slug,
    surface: "appointment",
    subPath,
    isCustomDomain: seoContext.isCustomDomain,
  });
  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "@id": `${getCanonicalUrl(path)}#services`,
    name: `${category.name} services`,
    numberOfItems: totalServices,
    itemListElement: category.services.map((service, index) => ({
      "@type": "ListItem",
      position: pagination.skip + index + 1,
      url: getCanonicalUrl(appointmentPath(`/services/${service.slug || service.id}`), seoContext.baseUrl),
      item: {
        "@type": "Service",
        name: service.name,
        description: truncateSeoText(service.description, `Book ${service.name} at ${category.organization.name}.`),
        image: getSeoImageUrl(service.image || category.image || category.organization.coverImage || category.organization.logo),
        serviceType: category.name,
        offers: {
          "@type": "Offer",
          price: Number(service.price),
          priceCurrency: "IRR",
          url: getCanonicalUrl(appointmentPath(`/services/${service.slug || service.id}`), seoContext.baseUrl),
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
            description: truncateSeoText(category.description, `${category.name} services from ${category.organization.name}.`),
            url: getCanonicalUrl(path),
            image: getSeoImageUrl(category.image || category.organization.coverImage || category.organization.logo),
            mainEntity: { "@id": `${getCanonicalUrl(path)}#services` },
          },
          itemListJsonLd,
          buildBreadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: category.organization.name, path: appointmentPath() },
            { name: category.name, path },
          ], seoContext.baseUrl),
        ]}
      />

      <section className="border-b bg-muted/30">
        <div className="container mx-auto px-4 py-10">
          <Badge variant="secondary" className="mb-4 gap-2">
            <Calendar className="h-4 w-4" />
            {category.organization.name}
          </Badge>
          <h1 className="text-3xl font-bold md:text-4xl">{category.name}</h1>
          {category.description && <p className="mt-3 max-w-2xl text-muted-foreground">{category.description}</p>}
          <p className="mt-3 text-sm text-muted-foreground">
            {totalServices} services
            {pagination.page > 1 ? ` - page ${pagination.page} of ${totalPages}` : ""}
          </p>
        </div>
      </section>

      <section className="container mx-auto px-4 py-8">
        {category.services.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center text-muted-foreground">
              <Calendar className="h-10 w-10" />
              <p>No active services are available in this category.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {category.services.map((service) => {
              const providerName = getProviderName(service);

              return (
                <Card key={service.id} className="h-full overflow-hidden transition-shadow hover:shadow-md">
                  {getServicePrimaryMediaUrl(service) && (
                    <img src={getServicePrimaryMediaUrl(service) || undefined} alt={service.name} className="h-44 w-full object-cover" />
                  )}
                  <CardHeader>
                    <CardTitle className="line-clamp-2 text-lg">
                      <Link href={appointmentPath(`/services/${service.slug || service.id}`)} className="hover:text-primary">
                        {service.name}
                      </Link>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {service.description && <p className="mb-4 line-clamp-2 text-sm text-muted-foreground">{service.description}</p>}
                    <div className="mb-4 flex flex-wrap gap-3 text-sm text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        {service.duration} min
                      </span>
                      {providerName && (
                        <span className="inline-flex items-center gap-1">
                          <User className="h-4 w-4" />
                          {providerName}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-bold text-primary">{formatToman(Number(service.price))}</p>
                      <Link
                        href={appointmentPath(`/booking?service=${service.id}`)}
                        className={cn(buttonVariants())}
                      >
                        Book
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {totalPages > 1 && (
          <nav className="mt-8 flex flex-wrap items-center justify-center gap-3" aria-label="Service category pagination">
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
                href={categoryPath(locale, slug, categorySegment, totalPages, seoContext.isCustomDomain)}
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
