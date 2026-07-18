import "server-only";

import { prisma } from "@/lib/db";
import { isAiMediaAssetUsable } from "@/lib/ai-media/asset-visibility";
import { assertAiMediaAssetConsumptionEnabled } from "@/lib/ai-media/asset-consumption-feature-guard";
import { AiMediaAssetConsumptionError } from "@/lib/services/ai-media-asset-service";

type AiMediaDbClient = typeof prisma;

export type CanonicalAiMediaAssetReference = {
  id: string;
  organizationId: string;
  mimeType: string | null;
  width: number | null;
  height: number | null;
  storageProvider: string | null;
  storageKeyFingerprint: string | null;
  checksumSha256: string | null;
  byteSize: number | null;
  visibilityScope: string;
};

export async function validateAiMediaAssetForSelection(
  assetId: string,
  organizationId: string,
  db: AiMediaDbClient = prisma,
): Promise<CanonicalAiMediaAssetReference> {
  const client = db as any;

  assertAiMediaAssetConsumptionEnabled();

  const asset = await client.aiMediaAsset.findFirst({
    where: { id: assetId, organizationId, deletedAt: null },
    include: { import: true },
  });
  if (!asset) {
    throw new AiMediaAssetConsumptionError(404, "ASSET_NOT_FOUND", "AI media asset not found for selection");
  }
  const visibility = isAiMediaAssetUsable(asset, asset.import);
  if (!visibility.usable) {
    throw new AiMediaAssetConsumptionError(404, "ASSET_NOT_AVAILABLE", "AI media asset is not available for selection");
  }

  return {
    id: asset.id,
    organizationId: asset.organizationId,
    mimeType: asset.mimeType,
    width: asset.width,
    height: asset.height,
    storageProvider: asset.storageProvider,
    storageKeyFingerprint: asset.storageKeyFingerprint,
    checksumSha256: asset.checksumSha256,
    byteSize: asset.byteSize,
    visibilityScope: asset.visibilityScope,
  };
}
