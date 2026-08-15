import "server-only";

import type { OrganizationCapabilityKey, Prisma } from "@prisma/client";
import { ApiError } from "@/lib/api-guards";
import prisma from "@/lib/db";
import { hasOrganizationCapability } from "@/lib/organization-capabilities";

type CapabilityDb = Pick<Prisma.TransactionClient, "organization">;

export async function requireActiveOrganizationCapability(input: {
  organizationId?: string;
  organizationSlug?: string;
  capability: OrganizationCapabilityKey;
  db?: CapabilityDb;
}) {
  if (!input.organizationId && !input.organizationSlug) {
    throw new ApiError(400, "Organization identity is required");
  }

  const db = input.db ?? prisma;
  const organization = await db.organization.findFirst({
    where: {
      ...(input.organizationId ? { id: input.organizationId } : {}),
      ...(input.organizationSlug ? { slug: input.organizationSlug } : {}),
      isActive: true,
      deletedAt: null,
    },
    select: {
      id: true,
      slug: true,
      type: true,
      capabilitiesInitializedAt: true,
      capabilities: { select: { key: true, status: true } },
    },
  });

  if (!organization) throw new ApiError(404, "Organization not found");
  if (!hasOrganizationCapability({
    legacyType: organization.type,
    capabilitiesInitializedAt: organization.capabilitiesInitializedAt,
    capabilities: organization.capabilities,
  }, input.capability)) {
    throw new ApiError(409, `${input.capability} capability is inactive`);
  }

  return organization;
}
