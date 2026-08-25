import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { normalizeDomainHost, type CustomDomainLocale } from "@/lib/custom-domain-routing";
import { resolveActiveTenantForHost } from "@/lib/domains/domain-resolver.server";

export type ResolvedCustomDomain = {
  slug: string;
  locale: CustomDomainLocale;
  organizationId: string;
  organizationType: "SHOP" | "APPOINTMENT";
  capabilities: Array<"SHOP" | "APPOINTMENT">;
  publicHome?: {
    kind: "business";
    capability: "SHOP" | "APPOINTMENT";
    publicSurface: "shop" | "appointment";
    publicEntryPath: "/shop" | "/services";
  } | {
    kind: "generic";
    reason: "NO_PUBLIC_CAPABILITY" | "MULTIPLE_WITHOUT_VALID_DEFAULT";
  };
};

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

  const normalizedHost = normalizeDomainHost(request.nextUrl.searchParams.get("host"));
  if (!normalizedHost) {
    return NextResponse.json({ error: "Missing host" }, { status: 400 });
  }

  const resolved = await resolveActiveTenantForHost(prisma, normalizedHost);

  if (!resolved) {
    return NextResponse.json({ error: "Domain not found" }, { status: 404 });
  }

  return NextResponse.json(resolved);
}
