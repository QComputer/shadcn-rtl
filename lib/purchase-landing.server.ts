import "server-only";

import { prisma } from "@/lib/db";
import { activePublicBusinessCapabilities } from "@/lib/organization-public-home";

export type ResolvedProduct = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  basePrice: number;
  image: string | null;
  aiPrimaryMediaAssetId: string | null;
  trackInventory: boolean;
  organization: {
    id: string;
    name: string;
    slug: string;
    isActive: boolean;
    isPlatformOwner: boolean;
    capabilities: { key: string; status: string }[];
  };
  category: {
    id: string;
    name: string;
    isActive: boolean;
  };
  variants: {
    id: string;
    name: string | null;
    price: number | null;
    inventory: number;
    sku: string | null;
  }[];
};

export async function getResolvedProduct(input: {
  organizationId: string;
  productId: string;
}): Promise<ResolvedProduct> {
  const product = await prisma.product.findFirst({
    where: {
      id: input.productId,
      organizationId: input.organizationId,
      isActive: true,
      deletedAt: null,
      category: { isActive: true, deletedAt: null },
    },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      basePrice: true,
      image: true,
      aiPrimaryMediaAssetId: true,
      trackInventory: true,
      organization: {
        select: {
          id: true,
          name: true,
          slug: true,
          isActive: true,
          isPlatformOwner: true,
          capabilities: { select: { key: true, status: true } },
        },
      },
      category: {
        select: {
          id: true,
          name: true,
          isActive: true,
        },
      },
      variants: {
        select: {
          id: true,
          name: true,
          price: true,
          inventory: true,
          sku: true,
        },
        where: { deletedAt: null },
        orderBy: { name: "asc" },
      },
    },
  });

  if (!product?.organization) {
    throw new Error("NOT_FOUND");
  }

  const { organization, category } = product;

  if (organization.id !== input.organizationId) {
    throw new Error("NOT_FOUND");
  }

  if (
    !organization.isActive ||
    organization.isPlatformOwner ||
    !activePublicBusinessCapabilities(organization.capabilities as any).includes("SHOP")
  ) {
    throw new Error("NOT_FOUND");
  }

  if (!category?.isActive) {
    throw new Error("NOT_FOUND");
  }

  return product as unknown as ResolvedProduct;
}
