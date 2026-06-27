import type { Metadata } from "next";
import { redirect } from "next/navigation";
import prisma from "@/lib/db";
import { JsonLd } from "@/components/seo/json-ld";
import { buildBreadcrumbJsonLd, buildPublicMetadata, getCanonicalUrl, getSeoImageUrl, truncateSeoText } from "@/lib/seo";

type ServiceDetailLayoutProps = {
  children: React.ReactNode;
  params: Promise<{
    locale: string;
    slug: string;
    serviceId: string;
  }>;
};

async function getPublicService(slug: string, serviceId: string) {
  return prisma.service.findFirst({
    where: {
      OR: [{ id: serviceId }, { slug: serviceId }],
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
      slug: true,
      description: true,
      price: true,
      duration: true,
      image: true,
      organization: {
        select: {
          name: true,
          slug: true,
          logo: true,
        },
      },
      category: {
        select: {
          name: true,
        },
      },
      serviceProvider: {
        select: {
          name: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });
}

function getProviderName(service: Awaited<ReturnType<typeof getPublicService>>) {
  const provider = service?.serviceProvider;
  if (!provider) return null;
  return provider.name || [provider.firstName, provider.lastName].filter(Boolean).join(" ") || null;
}

export async function generateMetadata({ params }: ServiceDetailLayoutProps): Promise<Metadata> {
  const { locale, slug, serviceId } = await params;
  const service = await getPublicService(slug, serviceId);

  if (!service) {
    return { title: "Service Not Found" };
  }

  const serviceSegment = service.slug || service.id;
  const path = `/${locale}/appointment/${slug}/services/${serviceSegment}`;

  return buildPublicMetadata({
    locale,
    path,
    title: `${service.name} | ${service.organization.name}`,
    description: service.description || `Book ${service.name} at ${service.organization.name}.`,
    image: service.image || service.organization.logo,
    keywords: ["Bazar Baz", "service", "appointment", service.name, service.organization.slug, service.category.name],
    alternatePath: (nextLocale) => `/${nextLocale}/appointment/${slug}/services/${serviceSegment}`,
  });
}

export default async function ServiceDetailLayout({ children, params }: ServiceDetailLayoutProps) {
  const { locale, slug, serviceId } = await params;
  const service = await getPublicService(slug, serviceId);

  if (!service) return children;

  const serviceSegment = service.slug || service.id;
  if (service.slug && serviceId !== service.slug) {
    redirect(`/${locale}/appointment/${slug}/services/${service.slug}`);
  }

  const path = `/${locale}/appointment/${slug}/services/${serviceSegment}`;
  const providerName = getProviderName(service);
  const serviceJsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Service",
    "@id": `${getCanonicalUrl(path)}#service`,
    name: service.name,
    description: truncateSeoText(service.description, `Book ${service.name} at ${service.organization.name}.`),
    image: getSeoImageUrl(service.image || service.organization.logo),
    serviceType: service.category.name,
    provider: {
      "@type": "LocalBusiness",
      name: service.organization.name,
      url: getCanonicalUrl(`/${locale}/appointment/${slug}`),
    },
    offers: {
      "@type": "Offer",
      price: Number(service.price),
      priceCurrency: "IRR",
      url: getCanonicalUrl(path),
    },
  };

  if (providerName) {
    serviceJsonLd.employee = {
      "@type": "Person",
      name: providerName,
    };
  }

  return (
    <>
      <JsonLd
        data={[
          serviceJsonLd,
          buildBreadcrumbJsonLd([
            { name: "Home", path: `/${locale}` },
            { name: service.organization.name, path: `/${locale}/appointment/${slug}` },
            { name: service.name, path },
          ]),
        ]}
      />
      {children}
    </>
  );
}
