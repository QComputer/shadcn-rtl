import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const MAX_QUERY_LENGTH = 80;
const MAX_RESULTS_PER_GROUP = 6;
const supportedLocales = new Set(["fa", "en", "ar"]);

type SearchResult = {
  id: string;
  type: "ORGANIZATION" | "PRODUCT" | "SERVICE";
  title: string;
  subtitle: string | null;
  href: string;
  image: string | null;
  organizationName?: string;
  price?: number | null;
  duration?: number | null;
};

function normalizeQuery(value: string | null) {
  return (value ?? "").trim().replace(/\s+/g, " ").slice(0, MAX_QUERY_LENGTH);
}

function normalizeLocale(value: string | null) {
  return supportedLocales.has(value ?? "") ? value! : "fa";
}

function decimalToNumber(value: unknown) {
  if (value == null) return null;
  if (typeof value === "number") return value;
  if (typeof value === "object" && "toNumber" in value && typeof value.toNumber === "function") {
    return value.toNumber();
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function GET(request: NextRequest) {
  try {
    const query = normalizeQuery(request.nextUrl.searchParams.get("q"));
    const locale = normalizeLocale(request.nextUrl.searchParams.get("locale"));

    if (query.length < 2) {
      return NextResponse.json({ query, results: [], total: 0 });
    }

    const contains = { contains: query, mode: "insensitive" as const };

    const [organizations, products, services] = await Promise.all([
      prisma.organization.findMany({
        where: {
          isActive: true,
          deletedAt: null,
          OR: [
            { name: contains },
            { slug: contains },
            { description: contains },
            { address: contains },
          ],
        },
        select: {
          id: true,
          name: true,
          slug: true,
          type: true,
          description: true,
          address: true,
          logo: true,
          coverImage: true,
        },
        orderBy: [{ isOpen: "desc" }, { createdAt: "desc" }],
        take: MAX_RESULTS_PER_GROUP,
      }),
      prisma.product.findMany({
        where: {
          isActive: true,
          deletedAt: null,
          organization: {
            isActive: true,
            deletedAt: null,
            type: "SHOP",
          },
          OR: [
            { name: contains },
            { description: contains },
            { sku: contains },
            { category: { name: contains } },
            { organization: { name: contains } },
          ],
        },
        select: {
          id: true,
          name: true,
          description: true,
          image: true,
          basePrice: true,
          organization: {
            select: {
              name: true,
              slug: true,
            },
          },
        },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
        take: MAX_RESULTS_PER_GROUP,
      }),
      prisma.service.findMany({
        where: {
          isActive: true,
          deletedAt: null,
          organization: {
            isActive: true,
            deletedAt: null,
            type: "APPOINTMENT",
          },
          OR: [
            { name: contains },
            { description: contains },
            { category: { name: contains } },
            { organization: { name: contains } },
          ],
        },
        select: {
          id: true,
          name: true,
          description: true,
          image: true,
          price: true,
          duration: true,
          organization: {
            select: {
              name: true,
              slug: true,
            },
          },
        },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
        take: MAX_RESULTS_PER_GROUP,
      }),
    ]);

    const organizationResults: SearchResult[] = organizations.map((organization) => ({
      id: organization.id,
      type: "ORGANIZATION",
      title: organization.name,
      subtitle: organization.address || organization.description,
      href:
        organization.type === "SHOP"
          ? `/${locale}/shop/${organization.slug}`
          : `/${locale}/organizations/${organization.slug}`,
      image: organization.logo || organization.coverImage,
      organizationName: organization.type === "SHOP" ? "Shop" : "Appointment",
    }));

    const productResults: SearchResult[] = products.map((product) => ({
      id: product.id,
      type: "PRODUCT",
      title: product.name,
      subtitle: product.description,
      href: `/${locale}/shop/${product.organization.slug}/product/${product.id}`,
      image: product.image,
      organizationName: product.organization.name,
      price: decimalToNumber(product.basePrice),
    }));

    const serviceResults: SearchResult[] = services.map((service) => ({
      id: service.id,
      type: "SERVICE",
      title: service.name,
      subtitle: service.description,
      href: `/${locale}/organizations/${service.organization.slug}/services/${service.id}`,
      image: service.image,
      organizationName: service.organization.name,
      price: decimalToNumber(service.price),
      duration: service.duration,
    }));

    const results = [...organizationResults, ...productResults, ...serviceResults];

    return NextResponse.json({
      query,
      results,
      total: results.length,
    });
  } catch (error) {
    console.error("Public search error:", error);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
