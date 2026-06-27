import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

function getResolverSecret() {
  return process.env.CUSTOM_DOMAIN_RESOLVER_SECRET || process.env.INTERNAL_API_SECRET || "";
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

  const slug = request.nextUrl.searchParams.get("slug")?.trim();
  if (!slug) {
    return NextResponse.json({ error: "Missing shop slug" }, { status: 400 });
  }

  const domain = await prisma.organizationDomain.findFirst({
    where: {
      status: "ACTIVE",
      isPrimary: true,
      organization: {
        slug,
        type: "SHOP",
        isActive: true,
        deletedAt: null,
      },
    },
    select: {
      normalizedDomain: true,
      organization: {
        select: {
          id: true,
          slug: true,
        },
      },
    },
  });

  if (!domain) {
    return NextResponse.json({ error: "Primary domain not found" }, { status: 404 });
  }

  return NextResponse.json({
    domain: domain.normalizedDomain,
    slug: domain.organization.slug,
    organizationId: domain.organization.id,
  });
}
