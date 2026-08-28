import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { buildOrganizationPublicPath, buildTenantPublicPath, customDomainLocales, normalizeDomainHost, type OrganizationPublicSurface } from "@/lib/custom-domain-routing";
import { getCanonicalUrl } from "@/lib/seo";
import { hasOrganizationCapability } from "@/lib/organization-capabilities";

export const dynamic = "force-dynamic";

type SitemapEntry = {
  loc: string;
  lastmod?: Date | string | null;
  priority?: string;
  changefreq?: string;
};

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function formatDate(value: Date | string | null | undefined) {
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
}

function entryXml(entry: SitemapEntry) {
  const parts = [
    "  <url>",
    `    <loc>${escapeXml(entry.loc)}</loc>`,
  ];

  const lastmod = formatDate(entry.lastmod);
  if (lastmod) parts.push(`    <lastmod>${lastmod}</lastmod>`);
  if (entry.changefreq) parts.push(`    <changefreq>${entry.changefreq}</changefreq>`);
  if (entry.priority) parts.push(`    <priority>${entry.priority}</priority>`);
  parts.push("  </url>");
  return parts.join("\n");
}

function tenantEntries(input: {
  baseUrl: string;
  subPath: string;
  surface?: OrganizationPublicSurface;
  lastModified?: Date | null;
  priority?: string;
}): SitemapEntry[] {
  return customDomainLocales.map((locale) => ({
    loc: getCanonicalUrl(input.surface
      ? buildOrganizationPublicPath({
          locale,
          organizationSlug: "resolved-by-host",
          surface: input.surface,
          subPath: input.subPath,
          isCustomDomain: true,
        })
      : buildTenantPublicPath(locale, input.subPath), input.baseUrl),
    lastmod: input.lastModified,
    changefreq: "daily",
    priority: input.priority || (locale === "fa" ? "0.8" : "0.7"),
  }));
}

export async function GET(request: Request) {
  const headerList = new Headers(request.headers);
  const tenantDomain = normalizeDomainHost(
    headerList.get("x-bazar-tenant-domain") || headerList.get("host") || "",
  );
  const baseUrl = headerList.get("x-bazar-tenant-public-base-url") || `https://${tenantDomain}`;

  if (!tenantDomain) {
    return new NextResponse("Missing tenant domain", { status: 400 });
  }

  const domain = await prisma.organizationDomain.findUnique({
    where: { normalizedDomain: tenantDomain },
    select: {
      status: true,
      organization: {
        select: {
          id: true,
          slug: true,
          type: true,
          capabilitiesInitializedAt: true,
          capabilities: { select: { key: true, status: true } },
          isActive: true,
          deletedAt: true,
          updatedAt: true,
          fanpagePosts: {
            where: { isPublished: true, deletedAt: null },
            select: { updatedAt: true },
            orderBy: { updatedAt: "desc" },
            take: 1,
          },
          productCategories: {
            where: {
              isActive: true,
              deletedAt: null,
              products: { some: { isActive: true, deletedAt: null } },
            },
            select: { id: true, slug: true, updatedAt: true },
            orderBy: { updatedAt: "desc" },
            take: 1000,
          },
          products: {
            where: { isActive: true, deletedAt: null },
            select: { id: true, slug: true, updatedAt: true },
            orderBy: { updatedAt: "desc" },
            take: 1000,
          },
          serviceCategories: {
            where: {
              isActive: true,
              deletedAt: null,
              services: { some: { isActive: true, deletedAt: null } },
            },
            select: { id: true, slug: true, updatedAt: true },
            orderBy: { updatedAt: "desc" },
            take: 1000,
          },
          services: {
            where: { isActive: true, deletedAt: null },
            select: { id: true, slug: true, updatedAt: true },
            orderBy: { updatedAt: "desc" },
            take: 1000,
          },
        },
      },
    },
  });

  if (
    !domain ||
    domain.status !== "ACTIVE" ||
    !domain.organization.isActive ||
    domain.organization.deletedAt
  ) {
    return new NextResponse("Custom domain is not active", { status: 404 });
  }

  const organization = domain.organization;
  const hasShop = hasOrganizationCapability({
    legacyType: organization.type,
    capabilitiesInitializedAt: organization.capabilitiesInitializedAt,
    capabilities: organization.capabilities,
  }, "SHOP");
  const hasAppointment = hasOrganizationCapability({
    legacyType: organization.type,
    capabilitiesInitializedAt: organization.capabilitiesInitializedAt,
    capabilities: organization.capabilities,
  }, "APPOINTMENT");

  if (!hasShop && !hasAppointment) {
    return new NextResponse("Custom domain is not active", { status: 404 });
  }

  const entries: SitemapEntry[] = [
    ...tenantEntries({ baseUrl, subPath: "/", lastModified: organization.updatedAt, priority: "1.0" }),
  ];

  if (hasShop) {
    entries.push(
      ...tenantEntries({ baseUrl, surface: "shop", subPath: "/", lastModified: organization.updatedAt, priority: "0.9" }),
      ...tenantEntries({ baseUrl, surface: "shop", subPath: "/profile", lastModified: organization.updatedAt, priority: "0.8" }),
      ...tenantEntries({
        baseUrl,
        surface: "shop",
        subPath: "/fanpage",
        lastModified: organization.fanpagePosts[0]?.updatedAt || organization.updatedAt,
        priority: "0.7",
      }),
    );

    for (const category of organization.productCategories) {
      entries.push(
        ...tenantEntries({
          baseUrl,
          surface: "shop",
          subPath: `/category/${category.slug || category.id}`,
          lastModified: category.updatedAt,
          priority: "0.7",
        }),
      );
    }

    for (const product of organization.products) {
      entries.push(
        ...tenantEntries({
          baseUrl,
          surface: "shop",
          subPath: `/product/${product.slug || product.id}`,
          lastModified: product.updatedAt,
          priority: "0.6",
        }),
      );
    }
  }

  if (hasAppointment) {
    entries.push(
      ...tenantEntries({ baseUrl, surface: "appointment", subPath: "/", lastModified: organization.updatedAt, priority: "0.9" }),
      ...tenantEntries({ baseUrl, surface: "appointment", subPath: "/services", lastModified: organization.updatedAt, priority: "0.8" }),
    );

    for (const category of organization.serviceCategories) {
      entries.push(
        ...tenantEntries({
          baseUrl,
          surface: "appointment",
          subPath: `/services/category/${category.slug || category.id}`,
          lastModified: category.updatedAt,
          priority: "0.7",
        }),
      );
    }

    for (const service of organization.services) {
      entries.push(
        ...tenantEntries({
          baseUrl,
          surface: "appointment",
          subPath: `/services/${service.slug || service.id}`,
          lastModified: service.updatedAt,
          priority: "0.6",
        }),
      );
    }
  }

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...entries.map(entryXml),
    '</urlset>',
  ].join("\n");

  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=300, stale-while-revalidate=86400",
    },
  });
}
