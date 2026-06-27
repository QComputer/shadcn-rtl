import type { MetadataRoute } from "next";
import prisma from "@/lib/db";
import { supportedLocales } from "@/lib/i18n";
import { getCanonicalUrl } from "@/lib/seo";

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
        where: { isActive: true, deletedAt: null },
        select: {
          slug: true,
          type: true,
          updatedAt: true,
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
          organization: { isActive: true, deletedAt: null, type: "SHOP" },
          products: { some: { isActive: true, deletedAt: null } },
        },
        select: {
          id: true,
          organizationSlug: true,
          updatedAt: true,
        },
        orderBy: { updatedAt: "desc" },
        take: 1000,
      }),
      prisma.serviceCategory.findMany({
        where: {
          isActive: true,
          deletedAt: null,
          organization: { isActive: true, deletedAt: null, type: "APPOINTMENT" },
          services: { some: { isActive: true, deletedAt: null } },
        },
        select: {
          id: true,
          updatedAt: true,
          organization: {
            select: { slug: true },
          },
        },
        orderBy: { updatedAt: "desc" },
        take: 1000,
      }),
      prisma.product.findMany({
        where: {
          isActive: true,
          deletedAt: null,
          organization: { isActive: true, deletedAt: null, type: "SHOP" },
        },
        select: {
          id: true,
          organizationSlug: true,
          updatedAt: true,
        },
        orderBy: { updatedAt: "desc" },
        take: 1000,
      }),
      prisma.service.findMany({
        where: {
          isActive: true,
          deletedAt: null,
          organization: { isActive: true, deletedAt: null, type: "APPOINTMENT" },
        },
        select: {
          id: true,
          updatedAt: true,
          organization: {
            select: { slug: true },
          },
        },
        orderBy: { updatedAt: "desc" },
        take: 1000,
      }),
    ]);

    for (const organization of organizations) {
      if (organization.type === "SHOP") {
        entries.push(
          ...localizedEntries((locale) => `/${locale}/shop/${organization.slug}`, organization.updatedAt),
          ...localizedEntries((locale) => `/${locale}/shop/${organization.slug}/profile`, organization.updatedAt),
          ...localizedEntries(
            (locale) => `/${locale}/shop/${organization.slug}/fanpage`,
            organization.fanpagePosts[0]?.updatedAt || organization.updatedAt,
          ),
        );
      }

      if (organization.type === "APPOINTMENT") {
        entries.push(
          ...localizedEntries((locale) => `/${locale}/appointment/${organization.slug}`, organization.updatedAt),
          ...localizedEntries((locale) => `/${locale}/appointment/${organization.slug}/services`, organization.updatedAt),
          ...localizedEntries(
            (locale) => `/${locale}/appointment/${organization.slug}/fanpage`,
            organization.fanpagePosts[0]?.updatedAt || organization.updatedAt,
          ),
        );
      }
    }

    for (const category of productCategories) {
      entries.push(
        ...localizedEntries(
          (locale) => `/${locale}/shop/${category.organizationSlug}/category/${category.id}`,
          category.updatedAt,
        ),
      );
    }

    for (const category of serviceCategories) {
      entries.push(
        ...localizedEntries(
          (locale) => `/${locale}/appointment/${category.organization.slug}/services/category/${category.id}`,
          category.updatedAt,
        ),
      );
    }

    for (const product of products) {
      entries.push(
        ...localizedEntries(
          (locale) => `/${locale}/shop/${product.organizationSlug}/product/${product.id}`,
          product.updatedAt,
        ),
      );
    }

    for (const service of services) {
      entries.push(
        ...localizedEntries(
          (locale) => `/${locale}/appointment/${service.organization.slug}/services/${service.id}`,
          service.updatedAt,
        ),
      );
    }
  } catch (error) {
    console.warn("Unable to build full sitemap from database", error);
  }

  return entries;
}
