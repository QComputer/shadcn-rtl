import type { PublicCatalogProduct } from "@/lib/public-catalog/contracts";

export type RetailProduct = PublicCatalogProduct;
export type RetailVariant = PublicCatalogProduct["variants"][number];

export function retailAttributeText(attribute: { value: string | number | boolean; displayUnit: string | null }) {
  return `${attribute.value}${attribute.displayUnit ? ` ${attribute.displayUnit}` : ""}`;
}

const normalizedKey = (value: string) => value.normalize("NFKD").toLocaleLowerCase("fa").replace(/[\s_-]+/g, "");

/** Canonical logical dimension that groups semantically identical raw option keys. */
export interface CanonicalDimension {
  id: "color" | "size" | string;
  keys: string[];
  label: string;
}

const dimensionCategory = (normalized: string): "color" | "size" | null => {
  if (/colou?r|رنگ/.test(normalized)) return "color";
  if (/size|shoe|footwear|اندازه|سایز|شماره/.test(normalized)) return "size";
  return null;
};

/** Group all semantically identical dimension keys into one canonical dimension. */
export function canonicalDimensions(product: RetailProduct): CanonicalDimension[] {
  const options = product.variants.flatMap((variant) => variant.options);
  const unique = new Map(options.map((option) => [option.key, option]));
  const values = [...unique.values()];

  const groups = new Map<string, { keys: string[]; label: string }>();

  for (const option of values) {
    const category = dimensionCategory(normalizedKey(`${option.key}${option.label}`));
    if (!category) continue;

    if (!groups.has(category)) {
      groups.set(category, { keys: [], label: option.label });
    }
    groups.get(category)!.keys.push(option.key);
  }

  return [...groups.entries()].map(([id, { keys, label }]) => ({ id, keys, label }));
}

/** Legacy-compatible: deduplicated arrays of color/size keys (one canonical dimension each). */
export function optionDimensions(product: RetailProduct) {
  const dims = canonicalDimensions(product);
  return {
    color: dims.find((d) => d.id === "color")?.keys ?? [],
    size: dims.find((d) => d.id === "size")?.keys ?? [],
  };
}

/** Find the canonical dimension that contains the given raw option key. */
export function findCanonicalDimension(product: RetailProduct, key: string): CanonicalDimension | undefined {
  return canonicalDimensions(product).find((d) => d.keys.includes(key));
}

/** Collect all unique values for a canonical dimension across all its raw keys. */
export function dimensionValues(product: RetailProduct, dimension: CanonicalDimension): string[] {
  const values = new Set<string>();
  for (const variant of product.variants) {
    for (const key of dimension.keys) {
      const option = findVariantOption(variant, key);
      if (option) values.add(retailAttributeText(option));
    }
  }
  return [...values];
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
  const dims = canonicalDimensions(product);
  const dim = dims.find((d) => d.id === dimension || d.keys.includes(dimension));
  const keys = dim ? dim.keys : [dimension];

  const candidates = product.variants.filter((variant) =>
    keys.some((key) => {
      const option = findVariantOption(variant, key);
      return option ? retailAttributeText(option) === value : false;
    }),
  );
  if (!candidates.length) return current;
  const otherCurrent = current?.options.filter((option) => {
    const d = dims.find((cd) => cd.keys.includes(option.key));
    return d ? !d.keys.includes(dimension) : option.key !== dimension;
  }) ?? [];
  const compatible = candidates.find((variant) => otherCurrent.every((option) =>
    !product.variants.some((candidate) => candidate.options.some((candidateOption) => {
      const cd = dims.find((d) => d.keys.includes(candidateOption.key));
      return cd ? cd.keys.includes(option.key) : candidateOption.key === option.key;
    })) ||
    variant.options.some((candidateOption) => {
      const cd = dims.find((d) => d.keys.includes(candidateOption.key));
      return (cd ? cd.keys.includes(option.key) : candidateOption.key === option.key) && retailAttributeText(candidateOption) === retailAttributeText(option);
    })),
  );
  return compatible ?? candidates.find((variant) => variant.orderable) ?? candidates[0];
}

export function resolveVariantGallery(product: RetailProduct, variant?: RetailVariant): string[] {
  return variant?.media?.gallery.length ? variant.media.gallery : product.media.gallery;
}
