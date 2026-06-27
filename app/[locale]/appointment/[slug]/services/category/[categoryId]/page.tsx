import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Calendar, Clock, User } from "lucide-react";
import prisma from "@/lib/db";
import { JsonLd } from "@/components/seo/json-ld";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  buildBreadcrumbJsonLd,
  buildPublicMetadata,
  getCanonicalUrl,
  getSeoImageUrl,
  truncateSeoText,
} from "@/lib/seo";
import { formatToman } from "@/lib/persian";
import { cn } from "@/lib/utils";

type ServiceCategoryPageProps = {
  params: Promise<{
    locale: string;
    slug: string;
    categoryId: string;
  }>;
};

async function getServiceCategory(slug: string, categoryId: string) {
  return prisma.serviceCategory.findFirst({
    where: {
      id: categoryId,
      isActive: true,
      deletedAt: null,
      organization: {
        slug,
        type: "APPOINTMENT",
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
      services: {
        where: {
          isActive: true,
          deletedAt: null,
        },
        select: {
          id: true,
          name: true,
          description: true,
          image: true,
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
        take: 60,
      },
    },
  });
}

function getProviderName(service: NonNullable<Awaited<ReturnType<typeof getServiceCategory>>>["services"][number]) {
  const provider = service.serviceProvider;
  if (!provider) return null;
  return provider.name || [provider.firstName, provider.lastName].filter(Boolean).join(" ") || null;
}

export async function generateMetadata({ params }: ServiceCategoryPageProps): Promise<Metadata> {
  const { locale, slug, categoryId } = await params;
  const category = await getServiceCategory(slug, categoryId);

  if (!category) {
    return { title: "Category Not Found" };
  }

  return buildPublicMetadata({
    locale,
    path: `/${locale}/appointment/${slug}/services/category/${category.id}`,
    title: `${category.name} | ${category.organization.name}`,
    description: category.description || `${category.name} services from ${category.organization.name}.`,
    image: category.image || category.organization.coverImage || category.organization.logo,
    keywords: ["Bazar Baz", "service category", category.name, category.organization.slug],
    alternatePath: (nextLocale) => `/${nextLocale}/appointment/${slug}/services/category/${category.id}`,
  });
}

export default async function ServiceCategoryPage({ params }: ServiceCategoryPageProps) {
  const { locale, slug, categoryId } = await params;
  const category = await getServiceCategory(slug, categoryId);

  if (!category) notFound();

  const path = `/${locale}/appointment/${slug}/services/category/${category.id}`;
  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "@id": `${getCanonicalUrl(path)}#services`,
    name: `${category.name} services`,
    numberOfItems: category.services.length,
    itemListElement: category.services.map((service, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: getCanonicalUrl(`/${locale}/appointment/${slug}/services/${service.id}`),
      item: {
        "@type": "Service",
        name: service.name,
        description: truncateSeoText(service.description, `Book ${service.name} at ${category.organization.name}.`),
        image: getSeoImageUrl(service.image || category.image || category.organization.logo),
        serviceType: category.name,
        offers: {
          "@type": "Offer",
          price: Number(service.price),
          priceCurrency: "IRR",
          url: getCanonicalUrl(`/${locale}/appointment/${slug}/services/${service.id}`),
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
          },
          itemListJsonLd,
          buildBreadcrumbJsonLd([
            { name: "Home", path: `/${locale}` },
            { name: category.organization.name, path: `/${locale}/appointment/${slug}` },
            { name: category.name, path },
          ]),
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
                  {service.image && <img src={service.image} alt={service.name} className="h-44 w-full object-cover" />}
                  <CardHeader>
                    <CardTitle className="line-clamp-2 text-lg">{service.name}</CardTitle>
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
                        href={`/${locale}/appointment/${slug}/booking?service=${service.id}`}
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
      </section>
    </main>
  );
}
