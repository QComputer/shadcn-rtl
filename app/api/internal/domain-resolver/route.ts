import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { normalizeDomainHost, type CustomDomainLocale } from "@/lib/custom-domain-routing";
import { resolveActiveTenantForHost } from "@/lib/domains/domain-resolver.server";
import { resolveOrganizationEndpointForTenant } from "@/lib/organization-endpoints.server";

export type ResolvedCustomDomain = {
  slug: string;
  locale: CustomDomainLocale;
  organizationId: string;
  organizationType: "SHOP" | "APPOINTMENT";
  capabilities: Array<"SHOP" | "APPOINTMENT">;
  publicHomeMode?: string | null;
  brandLandingProvider?: string | null;
  publicHome?: {
    kind: "capability";
    mode: "SHOP" | "APPOINTMENT";
    capability: "SHOP" | "APPOINTMENT";
    publicSurface: "shop" | "appointment";
    publicEntryPath: "/shop" | "/services";
  } | {
    kind: "brand";
    provider: "BAZARBAAZ" | "CUSTOM_INTERNAL";
  } | {
    kind: "external";
    provider: "CUSTOM_EXTERNAL";
  } | {
    kind: "visitor-choice";
    capabilities: Array<"SHOP" | "APPOINTMENT">;
  } | {
    kind: "generic";
    reason: "NO_PUBLIC_CAPABILITY" | "MULTIPLE_WITHOUT_VALID_DEFAULT";
  } | {
    kind: "invalid";
    reason: "MODE_REQUIRES_MISSING_CAPABILITY";
    mode: "SHOP" | "APPOINTMENT" | "BRAND";
  };
  branding?: {
    organizationId: string;
    displayName: string | null;
    shortName: string | null;
    favicon: string | null;
    appleTouchIcon: string | null;
    pwaIcons: {
      icon192: string | null;
      icon512: string | null;
    };
    ogImage: string | null;
    source: "BAZARBAAZ_MANAGED" | "EXTERNAL_SYNC" | "PLATFORM_FALLBACK";
  };
  appEndpoint?: {
    origin: string;
    pathPrefix: string;
  } | null;
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

  const appEndpoint = await resolveOrganizationEndpointForTenant({
    organizationId: resolved.organizationId,
    role: "APP",
  }).catch(() => null);

  return NextResponse.json({
    ...resolved,
    appEndpoint: appEndpoint
      ? { origin: appEndpoint.origin, pathPrefix: appEndpoint.pathPrefix }
      : null,
  });
}
