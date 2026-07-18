import "server-only";

import { prisma } from "@/lib/db";
import { streamApplicationAssetContent } from "@/lib/storage/application-storage";
import { isAiMediaAssetUsable, buildSafeAiMediaAssetMetadata } from "@/lib/ai-media/asset-visibility";
import { assertAiMediaAssetConsumptionEnabled } from "@/lib/ai-media/asset-consumption-feature-guard";
import type { AiMediaAsset, AiMediaImport } from "@prisma/client";

type AiMediaDbClient = typeof prisma;

export type AiMediaAssetListInput = {
  organizationId: string;
  page?: number;
  pageSize?: number;
  requestedByUserId?: string | null;
};

export type AiMediaAssetListResult = {
  items: SafeAiMediaAsset[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

export type SafeAiMediaAsset = {
  id: string;
  organizationId: string;
  mimeType: string | null;
  width: number | null;
  height: number | null;
  byteSize: number | null;
  storageProvider: string | null;
  checksumSha256: string | null;
  visibilityScope: string;
  acceptedAt: string | null;
  createdAt: string;
  previewUrl: string | null;
  sourceType: string | null;
  requestedByUserId: string;
};

const MAX_PAGE_SIZE = 50;
const DEFAULT_PAGE_SIZE = 20;

export async function listAvailableAiMediaAssets(
  input: AiMediaAssetListInput,
  db: AiMediaDbClient = prisma,
): Promise<AiMediaAssetListResult> {
  const client = db as any;
  const page = Math.max(1, input.page ?? 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, input.pageSize ?? DEFAULT_PAGE_SIZE));

  assertAiMediaAssetConsumptionEnabled();

  const where: Record<string, unknown> = {
    organizationId: input.organizationId,
    deletedAt: null,
    import: { is: { status: "IMPORTED" } },
    ...(input.requestedByUserId ? { requestedByUserId: input.requestedByUserId } : {}),
  };

  const rawAssets = await client.aiMediaAsset.findMany({
    where,
    include: { import: true },
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * pageSize,
    take: pageSize,
  });

  const items: SafeAiMediaAsset[] = [];
  for (const asset of rawAssets as (AiMediaAsset & { import: AiMediaImport | null })[]) {
    const visibility = isAiMediaAssetUsable(asset, asset.import);
    if (!visibility.usable) continue;

    const previewUrl = buildSafePreviewUrl(asset);
    const sourceType = deriveSourceType(asset);

    items.push({
      id: asset.id,
      organizationId: asset.organizationId,
      mimeType: asset.mimeType,
      width: asset.width,
      height: asset.height,
      byteSize: asset.byteSize,
      storageProvider: asset.storageProvider,
      checksumSha256: asset.checksumSha256,
      visibilityScope: asset.visibilityScope,
      acceptedAt: asset.acceptedAt ? asset.acceptedAt.toISOString() : null,
      createdAt: asset.createdAt.toISOString(),
      previewUrl,
      sourceType,
      requestedByUserId: asset.requestedByUserId,
    });
  }

  return {
    items,
    page,
    pageSize,
    totalItems: items.length,
    totalPages: Math.ceil(items.length / pageSize) || 1,
  };
}

export async function getAiMediaAssetForUse(
  assetId: string,
  organizationId: string,
  db: AiMediaDbClient = prisma,
): Promise<SafeAiMediaAsset | null> {
  const client = db as any;
  const asset = await client.aiMediaAsset.findFirst({
    where: { id: assetId, organizationId, deletedAt: null },
    include: { import: true },
  });
  if (!asset) return null;

  assertAiMediaAssetConsumptionEnabled();

  const visibility = isAiMediaAssetUsable(asset, asset.import);
  if (!visibility.usable) return null;

  return {
    id: asset.id,
    organizationId: asset.organizationId,
    mimeType: asset.mimeType,
    width: asset.width,
    height: asset.height,
    byteSize: asset.byteSize,
    storageProvider: asset.storageProvider,
    checksumSha256: asset.checksumSha256,
    visibilityScope: asset.visibilityScope,
    acceptedAt: asset.acceptedAt ? asset.acceptedAt.toISOString() : null,
    createdAt: asset.createdAt.toISOString(),
    previewUrl: buildSafePreviewUrl(asset),
    sourceType: deriveSourceType(asset),
    requestedByUserId: asset.requestedByUserId,
  };
}

export async function assertAiMediaAssetOwnership(
  assetId: string,
  organizationId: string,
  db: AiMediaDbClient = prisma,
) {
  const client = db as any;
  const asset = await client.aiMediaAsset.findFirst({
    where: { id: assetId, organizationId, deletedAt: null },
    include: { import: true },
  });
  if (!asset) {
    throw new AiMediaAssetConsumptionError(404, "ASSET_NOT_FOUND", "AI media asset not found");
  }
  const visibility = isAiMediaAssetUsable(asset, asset.import);
  if (!visibility.usable) {
    throw new AiMediaAssetConsumptionError(404, "ASSET_NOT_AVAILABLE", "AI media asset is not available");
  }
  return asset;
}

export async function getSafeAiMediaAssetMetadata(
  assetId: string,
  organizationId: string,
  db: AiMediaDbClient = prisma,
) {
  const asset = await assertAiMediaAssetOwnership(assetId, organizationId, db);
  return buildSafeAiMediaAssetMetadata(asset, asset.import);
}

export async function streamAiMediaAssetContent(
  asset: AiMediaAsset & { import: AiMediaImport | null },
  organizationId: string,
) {
  const visibility = isAiMediaAssetUsable(asset, asset.import);
  if (!visibility.usable) {
    throw new AiMediaAssetConsumptionError(404, "ASSET_NOT_AVAILABLE", "AI media asset is not available");
  }
  if (asset.organizationId !== organizationId) {
    throw new AiMediaAssetConsumptionError(404, "ASSET_NOT_FOUND", "AI media asset not found");
  }
  const key = asset.storageKey || asset.storageKeyFingerprint;
  if (!key) {
    throw new AiMediaAssetConsumptionError(404, "ASSET_NO_STORAGE_KEY", "AI media asset has no storage reference");
  }
  const mimeType = asset.mimeType ?? "application/octet-stream";
  return streamApplicationAssetContent({ organizationId, key, mimeType });
}

function buildSafePreviewUrl(asset: AiMediaAsset): string | null {
  return `/api/dashboard/ai-media/assets/${asset.id}/content`;
}

function deriveSourceType(asset: AiMediaAsset): string | null {
  const metadata = asset.safeMetadata as Record<string, unknown> | null;
  if (!metadata || typeof metadata !== "object") return null;
  const provider = typeof metadata.provider === "string" ? metadata.provider : null;
  const targetType = typeof metadata.targetType === "string" ? metadata.targetType : null;
  if (provider && targetType) return `${provider}:${targetType}`;
  return provider ?? targetType ?? "IMPORTED_MEDIA";
}

export class AiMediaAssetConsumptionError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}
