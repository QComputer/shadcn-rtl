import type { AiMediaAsset, AiMediaImport } from "@prisma/client";

export type AiMediaAssetVisibility = {
  usable: boolean;
  reason?: string;
};

export function isAiMediaAssetUsable(asset: AiMediaAsset, importRecord: AiMediaImport | null): AiMediaAssetVisibility {
  if (asset.deletedAt) {
    return { usable: false, reason: "deleted" };
  }
  if (!importRecord || importRecord.status !== "IMPORTED" || !importRecord.acceptedAssetId) {
    return { usable: false, reason: "not-imported" };
  }
  if (!asset.storageKey && !asset.storageKeyFingerprint && !asset.storageProvider) {
    return { usable: false, reason: "no-storage-reference" };
  }
  const allowedMime = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
  if (asset.mimeType && !allowedMime.has(asset.mimeType)) {
    return { usable: false, reason: "unsupported-mime" };
  }
  return { usable: true };
}

export function assertAiMediaAssetUsable(asset: AiMediaAsset, importRecord: AiMediaImport | null): asserts asset is AiMediaAsset & { __usable: true } {
  const visibility = isAiMediaAssetUsable(asset, importRecord);
  if (!visibility.usable) {
    throw new Error(`Asset is not usable: ${visibility.reason}`);
  }
}

export function buildSafeAiMediaAssetMetadata(asset: AiMediaAsset, importRecord: AiMediaImport | null) {
  const visibility = isAiMediaAssetUsable(asset, importRecord);
  return {
    id: asset.id,
    usable: visibility.usable,
    blocker: visibility.reason ?? null,
    mimeType: asset.mimeType,
    width: asset.width,
    height: asset.height,
    byteSize: asset.byteSize,
    storageProvider: asset.storageProvider,
    storageKeyFingerprint: asset.storageKeyFingerprint,
    checksumSha256: asset.checksumSha256,
    visibilityScope: asset.visibilityScope,
    acceptedAt: asset.acceptedAt,
    createdAt: asset.createdAt,
    importStatus: importRecord?.status ?? null,
  };
}
