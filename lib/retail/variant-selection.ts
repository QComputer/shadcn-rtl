import type { PublicCatalogProduct } from "@/lib/public-catalog/contracts";

export type RetailProduct = PublicCatalogProduct;
export type RetailVariant = PublicCatalogProduct["variants"][number];

export function retailAttributeText(attribute: { value: string | number | boolean; displayUnit: string | null }) {
  return `${attribute.value}${attribute.displayUnit ? ` ${attribute.displayUnit}` : ""}`;
}

const normalizedKey = (value: string) => value.normalize("NFKD").toLocaleLowerCase("fa").replace(/[\s_-]+/g, "");

export function optionDimensions(product: RetailProduct) {
  const options = product.variants.flatMap((variant) => variant.options);
  const unique = new Map(options.map((option) => [option.key, option]));
  const values = [...unique.values()];
  const find = (kind: "color" | "size") => values.find((option) => {
    const key = normalizedKey(`${option.key}${option.label}`);
    return kind === "color" ? /colou?r|رنگ/.test(key) : /size|shoe|footwear|اندازه|سایز|شماره/.test(key);
  })?.key;
  return { color: find("color"), size: find("size") };
}

export function preferredVariant(product: RetailProduct): RetailVariant | undefined {
  return product.variants.find((variant) => variant.orderable) ?? product.variants[0];
}

export function resolveSelectedVariant(product: RetailProduct, selectedId?: string | null): RetailVariant | undefined {
  return product.variants.find((variant) => variant.id === selectedId) ?? preferredVariant(product);
}

export function findVariantOption(variant: RetailVariant | undefined, key?: string) {
  return key ? variant?.options.find((option) => option.key === key) : undefined;
}

export function chooseVariant(product: RetailProduct, current: RetailVariant | undefined, dimension: string, value: string): RetailVariant | undefined {
  const candidates = product.variants.filter((variant) => {
    const option = findVariantOption(variant, dimension);
    return option ? retailAttributeText(option) === value : false;
  });
  if (!candidates.length) return current;
  const otherCurrent = current?.options.filter((option) => option.key !== dimension) ?? [];
  const compatible = candidates.find((variant) => otherCurrent.every((option) =>
    !product.variants.some((candidate) => candidate.options.some((candidateOption) => candidateOption.key === option.key)) ||
    variant.options.some((candidateOption) => candidateOption.key === option.key && retailAttributeText(candidateOption) === retailAttributeText(option))));
  return compatible ?? candidates.find((variant) => variant.orderable) ?? candidates[0];
}

export function resolveVariantGallery(product: RetailProduct, variant?: RetailVariant): string[] {
  return variant?.media?.gallery.length ? variant.media.gallery : product.media.gallery;
}
