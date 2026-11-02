import type { PublicCatalogAttribute, PublicCatalogProduct } from "@/lib/public-catalog/contracts";
import { canonicalDimensions, retailAttributeText, type CanonicalDimension } from "@/lib/retail/variant-selection";
import { normalizeRetailSearch } from "@/lib/retail/discovery";

export type RetailProduct = PublicCatalogProduct;
export type CardColorSlide = { value: string; src: string };

type ParsedFilter = { key: string; value: string };

function parseFilter(token: string): ParsedFilter | null {
  const separator = token.indexOf(":");
  if (separator < 1 || separator === token.length - 1) return null;
  return { key: token.slice(0, separator), value: token.slice(separator + 1) };
}

function optionMatches(option: PublicCatalogAttribute, rawValue: string) {
  if (option.valueType === "NUMBER") {
    const normalized = normalizeRetailSearch(rawValue);
    const value = normalized.trim() ? Number(normalized) : Number.NaN;
    return Number.isFinite(value) && option.value === value;
  }
  if (option.valueType === "BOOLEAN") {
    if (!/^(true|false)$/i.test(rawValue)) return false;
    return option.value === (rawValue.toLowerCase() === "true");
  }
  return (option.valueType === "TEXT" || option.valueType === "ENUM") && option.value === rawValue;
}

function variantFilterGroups(product: RetailProduct, filters: readonly string[]) {
  const productKeys = new Set(product.attributes.map((attribute) => attribute.key));
  const variantKeys = new Set(product.variants.flatMap((variant) => variant.options.filter((option) => option.filterable).map((option) => option.key)));
  const groups = new Map<string, string[]>();
  for (const token of filters) {
    const filter = parseFilter(token);
    // The payload separates PRODUCT attributes from variant options. Ignore a
    // token for product-level keys even if the same spelling appears on a variant.
    if (!filter || productKeys.has(filter.key) || !variantKeys.has(filter.key)) continue;
    groups.set(filter.key, [...(groups.get(filter.key) ?? []), filter.value]);
  }
  return groups;
}

/** Keep variants matching variant-option filters (OR within a key, AND across keys). */
export function filterCardVariants(product: RetailProduct, filters: readonly string[]): RetailProduct {
  const groups = variantFilterGroups(product, filters);
  if (!groups.size) return product;
  const variants = product.variants.filter((variant) => [...groups].every(([key, values]) => {
    const option = variant.options.find((entry) => entry.key === key);
    return option !== undefined && values.some((value) => optionMatches(option, value));
  }));
  return variants.length === product.variants.length ? product : { ...product, variants };
}

/** Return at most one real variant image per color value; never synthesize a slide. */
export function colorSlides(product: RetailProduct): CardColorSlide[] {
  const color = canonicalDimensions(product).find((dimension) => dimension.id === "color");
  if (!color) return [];
  const seenValues = new Set<string>();
  const seenSources = new Set<string>();
  const slides: CardColorSlide[] = [];
  for (const variant of product.variants) {
    const option = variant.options.find((entry) => color.keys.includes(entry.key));
    const value = option ? retailAttributeText(option) : "";
    const src = variant.media?.gallery[0]?.trim();
    if (!value || !src || seenValues.has(value) || seenSources.has(src)) continue;
    seenValues.add(value);
    seenSources.add(src);
    slides.push({ value, src });
  }
  return slides;
}

/** Canonical color/size dimensions constrained by active variant-option filters. */
export function constrainedDimensions(product: RetailProduct, filters: readonly string[]): CanonicalDimension[] {
  const activeKeys = new Set(variantFilterGroups(product, filters).keys());
  return canonicalDimensions(product).filter((dimension) =>
    (dimension.id === "color" || dimension.id === "size") && dimension.keys.some((key) => activeKeys.has(key)),
  );
}
