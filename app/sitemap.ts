import type { MetadataRoute } from "next";
import prisma from "@/lib/db";
import { supportedLocales } from "@/lib/i18n";
import { getCanonicalUrl } from "@/lib/seo";
import { hasOrganizationCapability } from "@/lib/organization-capabilities";
import { buildOrganizationPublicPath, buildOrganizationRootPath } from "@/lib/custom-domain-routing";

export const dynamic = "force-dynamic";

function localizedEntries(pathForLocale: (locale: string) => string, lastModified?: Date): MetadataRoute.Sitemap {
  return supportedLocales.map((locale) => ({
    url: getCanonicalUrl(pathForLocale(locale)),
    lastModified,
    changeFrequency: "daily",
    priority: locale === "fa" ? 0.8 : 0.7,
  }));
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [
    ...localizedEntries((locale) => `/${locale}`, new Date()),
  ];

  try {
    const [organizations, productCategories, serviceCategories, products, services] = await Promise.all([
      prisma.organization.findMany({
        where: { isActive: true, deletedAt: null, isPlatformOwner: false },
        select: {
          slug: true,
          type: true,
          capabilitiesInitializedAt: true,
          capabilities: { select: { key: true, status: true } },
          updatedAt: true,
          domains: {
            where: { status: "ACTIVE", isPrimary: true },
            select: { normalizedDomain: true },
            take: 1,
          },
          fanpagePosts: {
            where: { isPublished: true, deletedAt: null },
            select: { updatedAt: true },
            orderBy: { updatedAt: "desc" },
            take: 1,
          },
        },
        orderBy: { updatedAt: "desc" },
        take: 500,
      }),
      prisma.productCategory.findMany({
        where: {
          isActive: true,
          deletedAt: null,
          organization: {
            isActive: true,
            deletedAt: null,
            isPlatformOwner: false,
            domains: { none: { status: "ACTIVE", isPrimary: true } },
          },
          products: { some: { isActive: true, deletedAt: null } },
        },
        select: {
          id: true,
          slug: true,
          organizationSlug: true,
          updatedAt: true, organization: { select: { type: true, capabilitiesInitializedAt: true, capabilities: { select: { key: true, status: true } } } },
        },
        orderBy: { updatedAt: "desc" },
        take: 1000,
      }),
      prisma.serviceCategory.findMany({
        where: {
          isActive: true,
          deletedAt: null,
          organization: { isActive: true, deletedAt: null, isPlatformOwner: false },
          services: { some: { isActive: true, deletedAt: null } },
        },
        select: {
          id: true,
          slug: true,
          updatedAt: true,
          organization: {
            select: { slug: true, type: true, capabilitiesInitializedAt: true, capabilities: { select: { key: true, status: true } } },
          },
        },
        orderBy: { updatedAt: "desc" },
        take: 1000,
      }),
      prisma.product.findMany({
        where: {
          isActive: true,
          deletedAt: null,
          organization: {
            isActive: true,
            deletedAt: null,
            isPlatformOwner: false,
            domains: { none: { status: "ACTIVE", isPrimary: true } },
          },
        },
        select: {
          id: true,
          slug: true,
          organizationSlug: true,
          updatedAt: true, organization: { select: { type: true, capabilitiesInitializedAt: true, capabilities: { select: { key: true, status: true } } } },
        },
        orderBy: { updatedAt: "desc" },
        take: 1000,
      }),
      prisma.service.findMany({
        where: {
          isActive: true,
          deletedAt: null,
          organization: { isActive: true, deletedAt: null, isPlatformOwner: false },
        },
        select: {
          id: true,
          slug: true,
          updatedAt: true,
          organization: {
            select: { slug: true, type: true, capabilitiesInitializedAt: true, capabilities: { select: { key: true, status: true } } },
          },
        },
        orderBy: { updatedAt: "desc" },
        take: 1000,
      }),
    ]);

    for (const organization of organizations) {
      entries.push(...localizedEntries((locale) => buildOrganizationRootPath({ locale, organizationSlug: organization.slug }), organization.updatedAt));

      if (hasOrganizationCapability({ legacyType: organization.type, capabilitiesInitializedAt: organization.capabilitiesInitializedAt, capabilities: organization.capabilities }, "SHOP")) {
        // Shops with active primary custom domains publish their public SEO
        // surface through the tenant-domain sitemap. Keep them out of the
        // platform sitemap to avoid platform/custom-domain duplication.
        if (organization.domains.length === 0) {
          entries.push(
            ...localizedEntries((locale) => buildOrganizationPublicPath({ locale, organizationSlug: organization.slug, surface: "shop" }), organization.updatedAt),
            ...localizedEntries((locale) => buildOrganizationPublicPath({ locale, organizationSlug: organization.slug, surface: "shop", subPath: "/profile" }), organization.updatedAt),
            ...localizedEntries(
              (locale) => buildOrganizationPublicPath({ locale, organizationSlug: organization.slug, surface: "shop", subPath: "/fanpage" }),
              organization.fanpagePosts[0]?.updatedAt || organization.updatedAt,
            ),
          );
        }
      }

      if (hasOrganizationCapability({ legacyType: organization.type, capabilitiesInitializedAt: organization.capabilitiesInitializedAt, capabilities: organization.capabilities }, "APPOINTMENT")) {
        entries.push(
          ...localizedEntries((locale) => buildOrganizationPublicPath({ locale, organizationSlug: organization.slug, surface: "appointment" }), organization.updatedAt),
          ...localizedEntries((locale) => buildOrganizationPublicPath({ locale, organizationSlug: organization.slug, surface: "appointment", subPath: "/services" }), organization.updatedAt),
          ...localizedEntries(
            (locale) => buildOrganizationPublicPath({ locale, organizationSlug: organization.slug, surface: "appointment", subPath: "/fanpage" }),
            organization.fanpagePosts[0]?.updatedAt || organization.updatedAt,
          ),
        );
      }
    }

    for (const category of productCategories.filter((item) => hasOrganizationCapability({ legacyType: item.organization.type, capabilitiesInitializedAt: item.organization.capabilitiesInitializedAt, capabilities: item.organization.capabilities }, "SHOP"))) {
      entries.push(
        ...localizedEntries(
          (locale) => buildOrganizationPublicPath({ locale, organizationSlug: category.organizationSlug, surface: "shop", subPath: `/category/${category.slug || category.id}` }),
          category.updatedAt,
        ),
      );
    }

    for (const category of serviceCategories.filter((item) => hasOrganizationCapability({ legacyType: item.organization.type, capabilitiesInitializedAt: item.organization.capabilitiesInitializedAt, capabilities: item.organization.capabilities }, "APPOINTMENT"))) {
      entries.push(
        ...localizedEntries(
          (locale) => buildOrganizationPublicPath({ locale, organizationSlug: category.organization.slug, surface: "appointment", subPath: `/services/category/${category.slug || category.id}` }),
          category.updatedAt,
        ),
      );
    }

    for (const product of products.filter((item) => hasOrganizationCapability({ legacyType: item.organization.type, capabilitiesInitializedAt: item.organization.capabilitiesInitializedAt, capabilities: item.organization.capabilities }, "SHOP"))) {
      entries.push(
        ...localizedEntries(
          (locale) => buildOrganizationPublicPath({ locale, organizationSlug: product.organizationSlug, surface: "shop", subPath: `/product/${product.slug || product.id}` }),
          product.updatedAt,
        ),
      );
    }

    for (const service of services.filter((item) => hasOrganizationCapability({ legacyType: item.organization.type, capabilitiesInitializedAt: item.organization.capabilitiesInitializedAt, capabilities: item.organization.capabilities }, "APPOINTMENT"))) {
      entries.push(
        ...localizedEntries(
          (locale) => buildOrganizationPublicPath({ locale, organizationSlug: service.organization.slug, surface: "appointment", subPath: `/services/${service.slug || service.id}` }),
          service.updatedAt,
        ),
      );
    }
  } catch (error) {
    console.warn("Unable to build full sitemap from database", error);
  }

  return entries;
}
