import "server-only";

import { prisma } from "@/lib/db";
import { activePublicBusinessCapabilities } from "@/lib/organization-public-home";
import { resolveOrganizationEndpointForTenant } from "@/lib/organization-endpoints.server";
import { buildProductPurchaseHandoff } from "@/lib/purchase-intent";
import { ApiError } from "@/lib/api-guards";
import { publicHandoffQuerySchema, type PublicHandoffData } from "./contracts";

export async function listPublicProductHandoffs(input: {
  organizationIdentifier: string;
  externalSource: string;
  page: number;
  limit: number;
}): Promise<PublicHandoffData> {
  const organization = await prisma.organization.findFirst({
    where: { slug: input.organizationIdentifier, isActive: true, deletedAt: null, isPlatformOwner: false },
    select: { id: true, slug: true, capabilities: { select: { key: true, status: true } } },
  });
  if (!organization || !activePublicBusinessCapabilities(organization.capabilities).includes("SHOP")) {
    throw new ApiError(404, "Organization not found");
  }

  const appEndpoint = await resolveOrganizationEndpointForTenant({ organizationId: organization.id, role: "APP" });
  if (!appEndpoint) {
    throw new ApiError(404, "Organization not found");
  }

  const baseWhere = {
    organizationId: organization.id,
    externalSource: input.externalSource,
    externalEntityType: "PRODUCT" as const,
    internalEntityType: "PRODUCT" as const,
    status: "APPROVED" as const,
    internalEntityId: { not: null },
  };

  const [mappings, total] = await Promise.all([
    prisma.externalEntityMapping.findMany({
      where: baseWhere,
      select: { externalId: true, internalEntityId: true, metadata: true },
      skip: (input.page - 1) * input.limit,
      take: input.limit,
      orderBy: { externalId: "asc" },
    }),
    prisma.externalEntityMapping.count({ where: baseWhere }),
  ]);

  const candidateIds = mappings.map((m) => m.internalEntityId).filter((id): id is string => Boolean(id));
  const eligibleProductIds = new Set<string>();

  if (candidateIds.length > 0) {
    const products = await prisma.product.findMany({
      where: {
        id: { in: candidateIds },
        organizationId: organization.id,
        isActive: true,
        deletedAt: null,
        category: { isActive: true, deletedAt: null },
      },
      select: {
        id: true,
        variants: { where: { deletedAt: null }, select: { inventory: true, allowBackOrder: true } },
      },
    });

    for (const product of products) {
      const hasOrderableVariant = product.variants.some((v) => v.inventory > 0 || v.allowBackOrder);
      if (hasOrderableVariant) eligibleProductIds.add(product.id);
    }
  }

  const items = mappings
    .filter((m) => {
      if (!m.internalEntityId || !eligibleProductIds.has(m.internalEntityId)) return false;
      const metadata = m.metadata && typeof m.metadata === "object" ? (m.metadata as Record<string, unknown>) : {};
      if (metadata.sourcePresent === false) return false;
      return true;
    })
    .map((m) => ({
      externalId: m.externalId,
      purchase: m.internalEntityId
        ? { href: buildProductPurchaseHandoff({ productId: m.internalEntityId, appEndpoint }).href }
        : null,
    }));

  return {
    organization: { slug: organization.slug },
    externalSource: input.externalSource,
    items,
    pagination: { page: input.page, limit: input.limit, total, totalPages: Math.ceil(total / input.limit) },
  };
}

export async function getPublicProductHandoff(input: {
  organizationIdentifier: string;
  externalSource: string;
  externalId: string;
}): Promise<{ externalId: string; purchase: { href: string } | null } | null> {
  const organization = await prisma.organization.findFirst({
    where: { slug: input.organizationIdentifier, isActive: true, deletedAt: null, isPlatformOwner: false },
    select: { id: true, slug: true, capabilities: { select: { key: true, status: true } } },
  });
  if (!organization || !activePublicBusinessCapabilities(organization.capabilities).includes("SHOP")) {
    throw new ApiError(404, "Organization not found");
  }

  const appEndpoint = await resolveOrganizationEndpointForTenant({ organizationId: organization.id, role: "APP" });
  if (!appEndpoint) {
    throw new ApiError(404, "Organization not found");
  }

  const mapping = await prisma.externalEntityMapping.findUnique({
    where: {
      organizationId_externalSource_externalEntityType_externalId_internalEntityType: {
        organizationId: organization.id,
        externalSource: input.externalSource,
        externalEntityType: "PRODUCT",
        externalId: input.externalId,
        internalEntityType: "PRODUCT",
      },
    },
    select: { externalId: true, internalEntityId: true, metadata: true, status: true },
  });
  if (!mapping || mapping.status !== "APPROVED" || !mapping.internalEntityId) return null;

  const product = await prisma.product.findFirst({
    where: { id: mapping.internalEntityId, organizationId: organization.id, isActive: true, deletedAt: null, category: { isActive: true, deletedAt: null } },
    select: { id: true, variants: { where: { deletedAt: null }, select: { inventory: true, allowBackOrder: true } } },
  });
  if (!product) return null;

  const hasOrderableVariant = product.variants.some((v) => v.inventory > 0 || v.allowBackOrder);
  if (!hasOrderableVariant) return null;

  const metadata = mapping.metadata && typeof mapping.metadata === "object" ? (mapping.metadata as Record<string, unknown>) : {};
  if (metadata.sourcePresent === false) return null;

  return {
    externalId: mapping.externalId,
    purchase: { href: buildProductPurchaseHandoff({ productId: mapping.internalEntityId, appEndpoint }).href },
  };
}
