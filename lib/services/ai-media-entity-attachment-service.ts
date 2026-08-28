import "server-only";

import { revalidatePath, revalidateTag } from "next/cache";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/api-guards";
import { supportedLocales } from "@/lib/i18n";
import { buildOrganizationPublicPath } from "@/lib/custom-domain-routing";
import { validateAiMediaAssetForSelection } from "@/lib/services/ai-media-asset-selection-service";
import { streamAiMediaAssetContent } from "@/lib/services/ai-media-asset-service";
import { hasPermission, type UserRole } from "@/lib/types";
import { APPLICATION_STORAGE_ALLOWED_IMAGE_TYPES } from "@/lib/storage/image-validation";
import {
  assertAiMediaAssetConsumptionEnabled,
  getAiMediaAssetConsumptionFeatureState,
} from "@/lib/ai-media/asset-consumption-feature-guard";

type AttachmentDbClient = typeof prisma;

type EntityKind = "product" | "service";

export function canReadAiMediaEntityAttachmentColumns() {
  return getAiMediaAssetConsumptionFeatureState().storageKeyColumnExpected;
}

export type AiMediaEntityAttachmentResult = {
  entityType: EntityKind;
  entityId: string;
  organizationId: string;
  attached: boolean;
  manualImageUrl: string | null;
  publicMediaUrl: string | null;
  aiMediaAsset: {
    id: string;
    mimeType: string | null;
    width: number | null;
    height: number | null;
    checksumSha256: string | null;
    byteSize: number | null;
    storageProvider: string | null;
    visibilityScope: string;
  } | null;
};

function requireUpdatePermission(role: UserRole, permission: "product:update" | "service:update") {
  if (!hasPermission(role, permission)) {
    throw new ApiError(403, "Forbidden");
  }
}

function toSafeResult(input: {
  entityType: EntityKind;
  entityId: string;
  organizationId: string;
  manualImageUrl: string | null;
  asset: Awaited<ReturnType<typeof validateAiMediaAssetForSelection>> | null;
}): AiMediaEntityAttachmentResult {
  return {
    entityType: input.entityType,
    entityId: input.entityId,
    organizationId: input.organizationId,
    attached: Boolean(input.asset),
    manualImageUrl: input.manualImageUrl,
    publicMediaUrl: input.asset ? `/api/public/${input.entityType}s/${input.entityId}/media` : null,
    aiMediaAsset: input.asset
      ? {
          id: input.asset.id,
          mimeType: input.asset.mimeType,
          width: input.asset.width,
          height: input.asset.height,
          checksumSha256: input.asset.checksumSha256,
          byteSize: input.asset.byteSize,
          storageProvider: input.asset.storageProvider,
          visibilityScope: input.asset.visibilityScope,
        }
      : null,
  };
}

function revalidateProductAttachment(product: { id: string; slug: string | null; organizationSlug: string }) {
  for (const locale of supportedLocales) {
    safelyRevalidatePath(buildOrganizationPublicPath({ locale, organizationSlug: product.organizationSlug, surface: "shop" }));
    safelyRevalidatePath(buildOrganizationPublicPath({ locale, organizationSlug: product.organizationSlug, surface: "shop", subPath: `/product/${product.id}` }));
    if (product.slug) safelyRevalidatePath(buildOrganizationPublicPath({ locale, organizationSlug: product.organizationSlug, surface: "shop", subPath: `/product/${product.slug}` }));
  }
  safelyRevalidateTag("home-page");
}

function revalidateServiceAttachment(service: { id: string; slug: string | null; organization: { slug: string } }) {
  for (const locale of supportedLocales) {
    safelyRevalidatePath(buildOrganizationPublicPath({ locale, organizationSlug: service.organization.slug, surface: "appointment" }));
    safelyRevalidatePath(buildOrganizationPublicPath({ locale, organizationSlug: service.organization.slug, surface: "appointment", subPath: "/services" }));
    safelyRevalidatePath(buildOrganizationPublicPath({ locale, organizationSlug: service.organization.slug, surface: "appointment", subPath: `/services/${service.id}` }));
    if (service.slug) safelyRevalidatePath(buildOrganizationPublicPath({ locale, organizationSlug: service.organization.slug, surface: "appointment", subPath: `/services/${service.slug}` }));
  }
  safelyRevalidateTag("home-page");
}

function safelyRevalidatePath(path: string) {
  try {
    revalidatePath(path);
  } catch (error) {
    if (process.env.NODE_ENV !== "test") throw error;
  }
}

function safelyRevalidateTag(tag: string) {
  try {
    revalidateTag(tag, "max");
  } catch (error) {
    if (process.env.NODE_ENV !== "test") throw error;
  }
}

export async function attachAiMediaAssetToProduct(input: {
  productId: string;
  aiMediaAssetId: string;
  actorRole: UserRole;
  db?: AttachmentDbClient;
}) {
  assertAiMediaAssetConsumptionEnabled();
  requireUpdatePermission(input.actorRole, "product:update");
  const client = (input.db ?? prisma) as any;
  const product = await client.product.findFirst({
    where: { id: input.productId, deletedAt: null },
    select: {
      id: true,
      image: true,
      slug: true,
      organizationId: true,
      organizationSlug: true,
      aiPrimaryMediaAssetId: true,
    },
  });
  if (!product) throw new ApiError(404, "Product not found");

  const asset = await validateAiMediaAssetForSelection(input.aiMediaAssetId, product.organizationId, input.db ?? prisma);

  if (product.aiPrimaryMediaAssetId !== asset.id) {
    const updated = await client.product.updateMany({
      where: { id: product.id, organizationId: product.organizationId, deletedAt: null },
      data: { aiPrimaryMediaAssetId: asset.id },
    });
    if (updated.count !== 1) throw new ApiError(404, "Product not found");
  }

  revalidateProductAttachment(product);
  return toSafeResult({
    entityType: "product",
    entityId: product.id,
    organizationId: product.organizationId,
    manualImageUrl: product.image,
    asset,
  });
}

export async function detachAiMediaAssetFromProduct(input: {
  productId: string;
  actorRole: UserRole;
  db?: AttachmentDbClient;
}) {
  assertAiMediaAssetConsumptionEnabled();
  requireUpdatePermission(input.actorRole, "product:update");
  const client = (input.db ?? prisma) as any;
  const product = await client.product.findFirst({
    where: { id: input.productId, deletedAt: null },
    select: { id: true, image: true, slug: true, organizationId: true, organizationSlug: true },
  });
  if (!product) throw new ApiError(404, "Product not found");

  await client.product.updateMany({
    where: { id: product.id, organizationId: product.organizationId, deletedAt: null },
    data: { aiPrimaryMediaAssetId: null },
  });

  revalidateProductAttachment(product);
  return toSafeResult({
    entityType: "product",
    entityId: product.id,
    organizationId: product.organizationId,
    manualImageUrl: product.image,
    asset: null,
  });
}

export async function attachAiMediaAssetToService(input: {
  serviceId: string;
  aiMediaAssetId: string;
  actorRole: UserRole;
  db?: AttachmentDbClient;
}) {
  assertAiMediaAssetConsumptionEnabled();
  requireUpdatePermission(input.actorRole, "service:update");
  const client = (input.db ?? prisma) as any;
  const service = await client.service.findFirst({
    where: { id: input.serviceId, deletedAt: null },
    select: {
      id: true,
      image: true,
      slug: true,
      organizationId: true,
      aiPrimaryMediaAssetId: true,
      organization: { select: { slug: true } },
    },
  });
  if (!service) throw new ApiError(404, "Service not found");

  const asset = await validateAiMediaAssetForSelection(input.aiMediaAssetId, service.organizationId, input.db ?? prisma);

  if (service.aiPrimaryMediaAssetId !== asset.id) {
    const updated = await client.service.updateMany({
      where: { id: service.id, organizationId: service.organizationId, deletedAt: null },
      data: { aiPrimaryMediaAssetId: asset.id },
    });
    if (updated.count !== 1) throw new ApiError(404, "Service not found");
  }

  revalidateServiceAttachment(service);
  return toSafeResult({
    entityType: "service",
    entityId: service.id,
    organizationId: service.organizationId,
    manualImageUrl: service.image,
    asset,
  });
}

export async function detachAiMediaAssetFromService(input: {
  serviceId: string;
  actorRole: UserRole;
  db?: AttachmentDbClient;
}) {
  assertAiMediaAssetConsumptionEnabled();
  requireUpdatePermission(input.actorRole, "service:update");
  const client = (input.db ?? prisma) as any;
  const service = await client.service.findFirst({
    where: { id: input.serviceId, deletedAt: null },
    select: {
      id: true,
      image: true,
      slug: true,
      organizationId: true,
      organization: { select: { slug: true } },
    },
  });
  if (!service) throw new ApiError(404, "Service not found");

  await client.service.updateMany({
    where: { id: service.id, organizationId: service.organizationId, deletedAt: null },
    data: { aiPrimaryMediaAssetId: null },
  });

  revalidateServiceAttachment(service);
  return toSafeResult({
    entityType: "service",
    entityId: service.id,
    organizationId: service.organizationId,
    manualImageUrl: service.image,
    asset: null,
  });
}

export async function streamPublicProductAiMedia(input: { productId: string; db?: AttachmentDbClient }) {
  assertAiMediaAssetConsumptionEnabled();
  const client = (input.db ?? prisma) as any;
  const product = await client.product.findFirst({
    where: { id: input.productId, deletedAt: null, isActive: true },
    include: {
      aiPrimaryMediaAsset: { include: { import: true } },
      organization: { select: { isActive: true, deletedAt: true } },
    },
  });
  if (!product || !product.organization?.isActive || product.organization.deletedAt) return null;
  if (!product.aiPrimaryMediaAsset) return null;
  const stream = await streamAiMediaAssetContent(product.aiPrimaryMediaAsset, product.organizationId);
  return buildPublicStreamResult(product.aiPrimaryMediaAsset, stream);
}

export async function streamPublicServiceAiMedia(input: { serviceId: string; db?: AttachmentDbClient }) {
  assertAiMediaAssetConsumptionEnabled();
  const client = (input.db ?? prisma) as any;
  const service = await client.service.findFirst({
    where: { id: input.serviceId, deletedAt: null, isActive: true },
    include: {
      aiPrimaryMediaAsset: { include: { import: true } },
      organization: { select: { isActive: true, deletedAt: true } },
    },
  });
  if (!service || !service.organization?.isActive || service.organization.deletedAt) return null;
  if (!service.aiPrimaryMediaAsset) return null;
  const stream = await streamAiMediaAssetContent(service.aiPrimaryMediaAsset, service.organizationId);
  return buildPublicStreamResult(service.aiPrimaryMediaAsset, stream);
}

function buildPublicStreamResult(asset: { id: string; mimeType: string | null }, stream: ReadableStream<Uint8Array> | null) {
  if (!stream) return null;
  const mimeType = asset.mimeType ?? "application/octet-stream";
  if (!APPLICATION_STORAGE_ALLOWED_IMAGE_TYPES.has(mimeType)) {
    throw new ApiError(415, "Unsupported content type");
  }
  return {
    stream,
    mimeType,
    filename: `${asset.id}.${APPLICATION_STORAGE_ALLOWED_IMAGE_TYPES.get(mimeType) ?? "bin"}`,
  };
}
