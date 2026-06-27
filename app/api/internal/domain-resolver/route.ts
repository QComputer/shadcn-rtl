import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { normalizeDomainHost, type CustomDomainLocale } from "@/lib/custom-domain-routing";

const supportedLocales = new Set<CustomDomainLocale>(["fa", "en", "ar"]);

function getResolverSecret() {
  return process.env.CUSTOM_DOMAIN_RESOLVER_SECRET || process.env.INTERNAL_API_SECRET || "";
}

function toSupportedLocale(value: string | null | undefined): CustomDomainLocale {
  return supportedLocales.has(value as CustomDomainLocale) ? (value as CustomDomainLocale) : "fa";
}

export async function GET(request: NextRequest) {
  const resolverSecret = getResolverSecret();

  if (process.env.NODE_ENV === "production" && !resolverSecret) {
    return NextResponse.json(
      { error: "Custom-domain resolver secret is not configured" },
      { status: 503 },
    );
  }

  if (resolverSecret && request.headers.get("x-internal-secret") !== resolverSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const normalizedHost = normalizeDomainHost(request.nextUrl.searchParams.get("host"));
  if (!normalizedHost) {
    return NextResponse.json({ error: "Missing host" }, { status: 400 });
  }

  const domain = await prisma.organizationDomain.findUnique({
    where: { normalizedDomain: normalizedHost },
    select: {
      normalizedDomain: true,
      status: true,
      organization: {
        select: {
          id: true,
          slug: true,
          locale: true,
          type: true,
          isActive: true,
          deletedAt: true,
        },
      },
    },
  });

  if (
    !domain ||
    domain.status !== "ACTIVE" ||
    domain.organization.type !== "SHOP" ||
    !domain.organization.isActive ||
    domain.organization.deletedAt
  ) {
    return NextResponse.json({ error: "Domain not found" }, { status: 404 });
  }

  return NextResponse.json({
    slug: domain.organization.slug,
    locale: toSupportedLocale(domain.organization.locale),
    organizationId: domain.organization.id,
  });
}
