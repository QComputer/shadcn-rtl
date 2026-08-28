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
import { getTenantSeoContext } from "@/lib/custom-domain-seo";
import { buildOrganizationPublicPath } from "@/lib/custom-domain-routing";

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
          coverImage: true,
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
  const seoContext = await getTenantSeoContext({ locale, slug, organizationType: "APPOINTMENT", subPath: `/services/${serviceSegment}` });
  const path = seoContext.path;
  const serviceUploadedShareImage = service.image || service.organization.coverImage || service.organization.logo;

  return buildPublicMetadata({
    locale,
    baseUrl: seoContext.baseUrl,
    path,
    title: `${service.name} | ${service.organization.name}`,
    description: service.description || `Book ${service.name} at ${service.organization.name}.`,
    image: getUploadedOrGeneratedSeoImageUrl(serviceUploadedShareImage, {
      kind: "service",
      locale,
      title: service.name,
      subtitle: service.description || `Book ${service.name} at ${service.organization.name}.`,
      organizationName: service.organization.name,
    }, seoContext.baseUrl),
    keywords: ["Bazar Baz", "service", "appointment", service.name, service.organization.slug, service.category.name],
    alternatePath: seoContext.alternatePath,
  });
}

export default async function ServiceDetailLayout({ children, params }: ServiceDetailLayoutProps) {
  const { locale, slug, serviceId } = await params;
  const service = await getPublicService(slug, serviceId);

  if (!service) return children;

  const serviceSegment = service.slug || service.id;
  if (service.slug && serviceId !== service.slug) {
    const redirectContext = await getTenantSeoContext({ locale, slug, organizationType: "APPOINTMENT", subPath: `/services/${service.slug}` });
    redirect(redirectContext.path);
  }

  const seoContext = await getTenantSeoContext({ locale, slug, organizationType: "APPOINTMENT", subPath: `/services/${serviceSegment}` });
  const path = seoContext.path;
  const appointmentPath = (subPath = "/") => buildOrganizationPublicPath({
    locale,
    organizationSlug: slug,
    surface: "appointment",
    subPath,
    isCustomDomain: seoContext.isCustomDomain,
  });
  const providerName = getProviderName(service);
  const serviceUploadedShareImage = service.image || service.organization.coverImage || service.organization.logo;
  const serviceJsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Service",
    "@id": `${getCanonicalUrl(path, seoContext.baseUrl)}#service`,
    name: service.name,
    description: truncateSeoText(service.description, `Book ${service.name} at ${service.organization.name}.`),
    image: getSeoImageUrl(serviceUploadedShareImage, seoContext.baseUrl),
    serviceType: service.category.name,
    provider: {
      "@type": "LocalBusiness",
      name: service.organization.name,
      url: getCanonicalUrl(appointmentPath(), seoContext.baseUrl),
    },
    offers: {
      "@type": "Offer",
      price: Number(service.price),
      priceCurrency: "IRR",
      url: getCanonicalUrl(path, seoContext.baseUrl),
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
            { name: "Home", path: "/" },
            { name: service.organization.name, path: appointmentPath() },
            { name: service.name, path },
          ], seoContext.baseUrl),
        ]}
      />
      {children}
    </>
  );
}
