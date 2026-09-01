import "server-only";

import { Prisma } from "@prisma/client";
import prisma from "@/lib/db";

export type PurchaseIntentResolution = {
  organizationId: string;
  organizationSlug: string;
  productId: string;
  product: {
    id: string;
    name: string;
    slug: string | null;
    basePrice: Prisma.Decimal;
    isActive: boolean;
  } | null;
};

export type PurchaseIntentAttribution = {
  source?: string;
  campaign?: string;
};

export async function resolvePurchaseIntent(input: {
  organizationId: string;
  productId: string;
  attribution?: PurchaseIntentAttribution;
}): Promise<PurchaseIntentResolution | null> {
  const organization = await prisma.organization.findFirst({
    where: {
      id: input.organizationId,
      isActive: true,
      deletedAt: null,
    },
    select: {
      id: true,
      slug: true,
    },
  });

  if (!organization) return null;

  const product = await prisma.product.findFirst({
    where: {
      id: input.productId,
      organizationId: input.organizationId,
      deletedAt: null,
    },
    select: {
      id: true,
      name: true,
      slug: true,
      basePrice: true,
      isActive: true,
    },
  });

  return {
    organizationId: organization.id,
    organizationSlug: organization.slug,
    productId: input.productId,
    product: product ? {
      ...product,
      basePrice: product.basePrice,
    } : null,
  };
}

export async function resolvePurchaseIntentBySlug(input: {
  organizationId: string;
  productSlug: string;
  attribution?: PurchaseIntentAttribution;
}): Promise<PurchaseIntentResolution | null> {
  const organization = await prisma.organization.findFirst({
    where: {
      id: input.organizationId,
      isActive: true,
      deletedAt: null,
    },
    select: {
      id: true,
      slug: true,
    },
  });

  if (!organization) return null;

  const product = await prisma.product.findFirst({
    where: {
      slug: input.productSlug,
      organizationId: input.organizationId,
      deletedAt: null,
    },
    select: {
      id: true,
      name: true,
      slug: true,
      basePrice: true,
      isActive: true,
    },
  });

  if (!product) return null;

  return {
    organizationId: organization.id,
    organizationSlug: organization.slug,
    productId: product.id,
    product: {
      ...product,
      basePrice: product.basePrice,
    },
  };
}

export function sanitizeAttribution(
  attribution: PurchaseIntentAttribution | undefined,
): PurchaseIntentAttribution {
  const result: PurchaseIntentAttribution = {};

  if (attribution?.source && isValidAttributionToken(attribution.source)) {
    result.source = attribution.source;
  }
  if (attribution?.campaign && isValidAttributionToken(attribution.campaign)) {
    result.campaign = attribution.campaign;
  }

  return result;
}

function isValidAttributionToken(value: string): boolean {
  if (value.length < 1 || value.length > 80) return false;
  return /^[\p{L}\p{N}][\p{L}\p{N}._~-]*$/u.test(value);
}
