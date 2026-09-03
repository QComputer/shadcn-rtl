import "server-only";

import { prisma } from "@/lib/db";
import {
  resolveOrganizationEndpoint,
  type OrganizationEndpointRole,
  type ResolvedOrganizationEndpoint,
} from "@/lib/organization-endpoints";

export async function resolveOrganizationEndpointForTenant(input: {
  organizationId: string;
  role: OrganizationEndpointRole;
}): Promise<ResolvedOrganizationEndpoint | null> {
  const organization = await prisma.organization.findFirst({
    where: { id: input.organizationId, isActive: true, deletedAt: null },
    select: {
      id: true,
      settings: { select: { settings: true } },
      domains: {
        select: {
          id: true,
          organizationId: true,
          normalizedDomain: true,
          status: true,
          providerVerified: true,
          dnsConfigured: true,
          sslReady: true,
          deletedAt: true,
        },
      },
    },
  });
  if (!organization) {
    console.error("[public-catalog-app-endpoint-diagnostic]", JSON.stringify({
      event: "public-catalog-app-endpoint-diagnostic",
      organizationId: input.organizationId,
      role: input.role,
      resolution: "no-organization",
      runtime: process.env.VERCEL_ENV || process.env.NODE_ENV,
    }));
    return null;
  }
  try {
    const result = resolveOrganizationEndpoint({
      organizationId: organization.id,
      role: input.role,
      settings: organization.settings?.settings,
      domains: organization.domains,
    });
    console.error("[public-catalog-app-endpoint-diagnostic]", JSON.stringify({
      event: "public-catalog-app-endpoint-diagnostic",
      organizationId: input.organizationId,
      role: input.role,
      settingsKeys: organization.settings?.settings ? Object.keys(organization.settings.settings) : null,
      endpointDefinitions: organization.settings?.settings?.["organizationEndpoints"] || null,
      domainsCount: organization.domains?.length ?? 0,
      resolution: result ? "resolved" : "null",
      endpointSource: result?.source ?? null,
      endpointOrigin: result?.origin ?? null,
      endpointPathPrefix: result?.pathPrefix ?? null,
      runtime: process.env.VERCEL_ENV || process.env.NODE_ENV,
    }));
    return result;
  } catch (error) {
    console.error("[public-catalog-app-endpoint-diagnostic]", JSON.stringify({
      event: "public-catalog-app-endpoint-diagnostic",
      organizationId: input.organizationId,
      role: input.role,
      settingsKeys: organization.settings?.settings ? Object.keys(organization.settings.settings) : null,
      endpointDefinitions: organization.settings?.settings?.["organizationEndpoints"] || null,
      domainsCount: organization.domains?.length ?? 0,
      resolution: "error",
      errorMessage: error instanceof Error ? error.message : String(error),
      runtime: process.env.VERCEL_ENV || process.env.NODE_ENV,
    }));
    throw error;
  }
}
