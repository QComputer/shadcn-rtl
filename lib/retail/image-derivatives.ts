export type StoredImageVariant = { url: string; width: number; height: number; bytes: number };
export type ImageDerivatives = { version: 1; card: StoredImageVariant[]; detail?: StoredImageVariant };

export function selectRetailCardImage(derivatives: ImageDerivatives | null | undefined, fallbackUrl: string, targetWidth = 640): string {
  const variants = derivatives?.version === 1 ? derivatives.card : [];
  if (variants.length === 0) return fallbackUrl;
  return [...variants].sort((a, b) => a.width - b.width).find((variant) => variant.width >= targetWidth)?.url
    ?? [...variants].sort((a, b) => b.width - a.width)[0]!.url;
}

export function selectRetailDetailImage(derivatives: ImageDerivatives | null | undefined, fallbackUrl: string): string {
  return derivatives?.version === 1 ? derivatives.detail?.url ?? fallbackUrl : fallbackUrl;
}

export function getCardImage(derivatives: ImageDerivatives | null | undefined, originalUrl: string): { src: string; srcSet?: string } {
  const variants = derivatives?.version === 1 ? [...derivatives.card].sort((a, b) => a.width - b.width) : [];
  if (variants.length === 0) return { src: originalUrl };
  const src = variants.find((variant) => variant.width >= 640)?.url ?? variants.at(-1)!.url;
  return {
    src,
    srcSet: variants.map((variant) => `${variant.url} ${variant.width}w`).join(", "),
  };
}
