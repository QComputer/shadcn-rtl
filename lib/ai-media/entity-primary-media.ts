export function getProductPrimaryMediaUrl(product: { id: string; image?: string | null; aiPrimaryMediaAssetId?: string | null }) {
  return product.aiPrimaryMediaAssetId ? `/api/public/products/${product.id}/media` : product.image ?? null;
}

export function getProductThumbnailUrl(product: { id: string; image?: string | null; aiPrimaryMediaAssetId?: string | null; galleryItems?: Array<{ thumbnailUrl?: string | null; image?: { thumbnailUrl?: string | null; url?: string | null } | null }> }) {
  if (product.aiPrimaryMediaAssetId) return `/api/public/products/${product.id}/media`;
  const primary = product.galleryItems?.[0];
  return primary?.thumbnailUrl || primary?.image?.thumbnailUrl || primary?.image?.url || product.image || null;
}

export function getServicePrimaryMediaUrl(service: { id: string; image?: string | null; aiPrimaryMediaAssetId?: string | null }) {
  return service.aiPrimaryMediaAssetId ? `/api/public/services/${service.id}/media` : service.image ?? null;
}
