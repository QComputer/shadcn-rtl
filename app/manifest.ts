import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { resolveAppBasePath } from "@/lib/app-base-path";
import { normalizeDomainHost } from "@/lib/custom-domain-routing";
import { resolveActiveTenantForHost } from "@/lib/domains/domain-resolver.server";
import { prisma } from "@/lib/db";
import { resolveOrganizationBranding } from "@/lib/organization-branding";
import { buildOperationalAppManifest } from "@/lib/operational-app-manifest";

export const dynamic = "force-dynamic";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const basePath = resolveAppBasePath();
  const requestHeaders = await headers();
  const trustedForwardedOrganizationId = requestHeaders.get("x-bazar-forwarded-app") === "true"
    ? requestHeaders.get("x-bazar-tenant-organization-id")
    : null;
  const host = normalizeDomainHost(requestHeaders.get("host"));

  if (trustedForwardedOrganizationId) {
    const tenant = await prisma.organization.findFirst({
      where: { id: trustedForwardedOrganizationId, isActive: true, deletedAt: null },
      select: {
        id: true,
        name: true,
        logo: true,
        coverImage: true,
        branding: true,
      },
    });
    if (tenant) {
      return buildOperationalAppManifest({
        basePath,
        branding: resolveOrganizationBranding({
          organizationId: tenant.id,
          name: tenant.name,
          logo: tenant.logo,
          coverImage: tenant.coverImage,
          branding: tenant.branding,
        }),
      });
    }
  }

  if (host) {
    try {
      const tenant = await resolveActiveTenantForHost(prisma, host);
      if (tenant) {
        return buildOperationalAppManifest({ basePath, branding: tenant.branding });
      }
    } catch {
      // A manifest must remain available during resolver/database degradation.
      // Tenant branding is fail-closed to the platform fallback.
    }
  }

  return buildOperationalAppManifest({ basePath });
}
