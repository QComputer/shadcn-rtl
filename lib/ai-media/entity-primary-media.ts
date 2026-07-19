export function getProductPrimaryMediaUrl(product: { id: string; image?: string | null; aiPrimaryMediaAssetId?: string | null }) {
  return product.aiPrimaryMediaAssetId ? `/api/public/products/${product.id}/media` : product.image ?? null;
}

export function getServicePrimaryMediaUrl(service: { id: string; image?: string | null; aiPrimaryMediaAssetId?: string | null }) {
  return service.aiPrimaryMediaAssetId ? `/api/public/services/${service.id}/media` : service.image ?? null;
}
