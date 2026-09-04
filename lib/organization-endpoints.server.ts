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
  if (!organization) return null;
  return resolveOrganizationEndpoint({
    organizationId: organization.id,
    role: input.role,
    settings: organization.settings?.settings,
    domains: organization.domains,
  });
}
