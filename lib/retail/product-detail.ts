import { canonicalDimensions, findVariantOption, retailAttributeText, type RetailProduct, type RetailVariant } from "./variant-selection";

export type ProductSelection = Record<string, string>;
export const variantSelection = (variant?: RetailVariant): ProductSelection => Object.fromEntries((variant?.options ?? []).map(option => [option.key, retailAttributeText(option)]));

/** Resolve the single variant matching the selection across canonical dimensions.
 * Never substitute another color/size when the requested combination is absent. */
export function exactProductVariant(product: RetailProduct, selection: ProductSelection) {
  const dims = canonicalDimensions(product);

  // Map each selection key to its canonical dimension id (if any)
  const selByDim: Record<string, string> = {};
  for (const [key, value] of Object.entries(selection)) {
    const dim = dims.find((d) => d.keys.includes(key));
    selByDim[dim ? dim.id : key] = value;
  }

  const matches = product.variants.filter((variant) => {
    // Every canonical dimension with a selected value must be present in the variant
    for (const [dimId, dimValue] of Object.entries(selByDim)) {
      const dim = dims.find((d) => d.id === dimId);
      if (dim) {
        const hasMatch = dim.keys.some((key) => {
          const option = findVariantOption(variant, key);
          return option && retailAttributeText(option) === dimValue;
        });
        if (!hasMatch) return false;
      } else {
        const option = findVariantOption(variant, dimId);
        if (!option || retailAttributeText(option) !== selByDim[dimId]) return false;
      }
    }

    // Variant's options belonging to a selected canonical dimension must match the selected value
    for (const option of variant.options) {
      const dim = dims.find((d) => d.keys.includes(option.key));
      const selKey = dim ? dim.id : option.key;
      if (selByDim[selKey] !== undefined && retailAttributeText(option) !== selByDim[selKey]) return false;
    }

    return true;
  });

  return matches.length === 1 ? matches[0] : undefined;
}

export const normalizeRetailDigits = (text: string) => text.replace(/[۰-۹]/g, digit => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit))).replace(/[٠-٩]/g, digit => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)));
export function compareRetailSizes(left: string, right: string) {
  const letters = ["XXXS", "XXS", "XS", "S", "M", "L", "XL", "XXL", "XXXL", "4XL", "5XL"];
  const a = letters.indexOf(left.trim().toUpperCase()), b = letters.indexOf(right.trim().toUpperCase());
  if (a >= 0 && b >= 0) return a - b;
  return normalizeRetailDigits(left).localeCompare(normalizeRetailDigits(right), "en", { numeric: true, sensitivity: "base" });
}

export function productDetailGallery(product: RetailProduct, variant?: RetailVariant) {
  return [...new Set(variant?.media?.gallery.length ? variant.media.gallery : [product.media.detail ?? product.media.card, ...product.media.gallery].filter((url): url is string => Boolean(url)))];
}

export function reliableColorSwatch(value: string) {
  if (/^#[0-9a-f]{6}$/i.test(value) || /^#[0-9a-f]{3}$/i.test(value)) return value;
  const colors: Record<string, string> = { black: "#262626", white: "#fff", red: "#b52c35", blue: "#345d97", navy: "#243852", green: "#38634d", brown: "#805d45", grey: "#868681", gray: "#868681", مشکی: "#262626", سفید: "#fff", قرمز: "#b52c35", آبی: "#345d97", سرمه‌ای: "#243852", سبز: "#38634d", قهوه‌ای: "#805d45", خاکستری: "#868681" };
  return colors[value.trim().toLocaleLowerCase("fa")];
}

/** Merchant-supplied facts only. Public prices are Toman; schema.org uses IRR. */
export function verifiedRetailProductJsonLd(product: RetailProduct, canonical: string) {
  const prices = product.variants.map(variant => variant.price.amount * 10);
  return { "@context": "https://schema.org", "@type": "Product", name: product.name, url: canonical,
    ...(product.description ? { description: product.description } : {}),
    ...(product.brand ? { brand: { "@type": "Brand", name: product.brand } } : {}),
    image: productDetailGallery(product).map(url => new URL(url, canonical).href), category: product.category.name,
    ...(prices.length ? { offers: { "@type": "AggregateOffer", priceCurrency: "IRR", lowPrice: Math.min(...prices), highPrice: Math.max(...prices), offerCount: product.variants.length, availability: product.variants.some(v => v.orderable) ? "https://schema.org/InStock" : "https://schema.org/OutOfStock", url: canonical } } : {}),
  };
}
