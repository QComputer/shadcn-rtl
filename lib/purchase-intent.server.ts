import "server-only";

import { ApiError } from "@/lib/api-guards";
import { prisma } from "@/lib/db";
import { activePublicBusinessCapabilities } from "@/lib/organization-public-home";
import { resolveOrganizationEndpointForTenant } from "@/lib/organization-endpoints.server";
import { purchaseAttributionSchema } from "@/lib/purchase-intent";
import { buildShopProductPath } from "@/lib/shop-public-paths";

export async function resolveOperationalProductHandoff(input: {
  organizationIdentifier: string;
  productId: string;
  locale: string;
  query?: Record<string, string | string[] | undefined>;
}) {
  const organization = await prisma.organization.findFirst({
    where: { slug: input.organizationIdentifier, isActive: true, deletedAt: null, isPlatformOwner: false },
    select: { id: true, slug: true, capabilities: { select: { key: true, status: true } } },
  });
  if (!organization || !activePublicBusinessCapabilities(organization.capabilities).includes("SHOP")) {
    throw new ApiError(404, "Product not found");
  }
  if (!await resolveOrganizationEndpointForTenant({ organizationId: organization.id, role: "APP" })) {
    throw new ApiError(404, "Product not found");
  }
  const product = await prisma.product.findFirst({
    where: {
      id: input.productId,
      organizationId: organization.id,
      isActive: true,
      deletedAt: null,
      category: { isActive: true, deletedAt: null },
    },
    select: { id: true, slug: true },
  });
  if (!product) throw new ApiError(404, "Product not found");

  const source = typeof input.query?.source === "string" ? input.query.source : undefined;
  const campaign = typeof input.query?.campaign === "string" ? input.query.campaign : undefined;
  const attribution = purchaseAttributionSchema.safeParse({ source, campaign });
  const query = new URLSearchParams();
  if (attribution.success) {
    if (attribution.data.source) query.set("source", attribution.data.source);
    if (attribution.data.campaign) query.set("campaign", attribution.data.campaign);
  }
  const target = buildShopProductPath({
    locale: input.locale,
    shopSlug: organization.slug,
    productSegment: product.slug || product.id,
  });
  return query.size ? `${target}?${query}` : target;
}
