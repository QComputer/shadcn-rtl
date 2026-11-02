import type { PublicCatalogProduct } from "@/lib/public-catalog/contracts";
import { canonicalDimensions, retailAttributeText } from "@/lib/retail/variant-selection";
import { colorSlides } from "@/lib/retail/card-presentation";

export type RetailProduct = PublicCatalogProduct;
export type RetailHeroSlide = {
  id: string;
  product: RetailProduct;
  src: string;
  color?: string;
  price: number;
  fromPrice: boolean;
  listPrice?: number;
};

function pricesFor(variants: RetailProduct["variants"], fallback: number) {
  const amounts = variants.map((variant) => variant.price.amount);
  if (!amounts.length) return { price: fallback, fromPrice: false, listPrice: undefined };
  const uniquePrices = [...new Set(amounts)];
  const price = Math.min(...amounts);
  const cheapest = variants.filter(variant => variant.price.amount === price);
  const listPrice = cheapest[0]?.listPrice?.amount;
  return {
    price,
    fromPrice: uniquePrices.length > 1,
    ...(listPrice !== undefined && listPrice > price && cheapest.every(variant => variant.listPrice?.amount === listPrice) ? { listPrice } : {}),
  };
}

/** Build a bounded, media-backed hero sequence without mutating catalog products. */
export function buildRetailHeroSlides(products: readonly RetailProduct[]): RetailHeroSlide[] {
  const result: RetailHeroSlide[] = [];
  const seenProducts = new Set<string>();
  let selectedProducts = 0;
  for (const product of products) {
    if (selectedProducts >= 5) break;
    if (seenProducts.has(product.id)) continue;
    const slides = colorSlides(product);
    const productImage = product.media.detail?.trim()
      || product.media.card?.trim()
      || product.media.gallery.find((image) => image.trim())?.trim()
      || slides[0]?.src;
    if (!productImage) continue;
    seenProducts.add(product.id);
    selectedProducts += 1;

    if (slides.length > 1) {
      const colorDimension = canonicalDimensions(product).find((dimension) => dimension.id === "color");
      if (colorDimension) {
        for (const slide of slides.slice(0, 3)) {
          const variants = product.variants.filter((variant) => {
            const option = variant.options.find((entry) => colorDimension.keys.includes(entry.key));
            return option !== undefined && retailAttributeText(option) === slide.value;
          });
          result.push({
            id: `${product.id}:color:${encodeURIComponent(slide.value)}`,
            product,
            src: slide.src,
            color: slide.value,
            ...pricesFor(variants, product.price.amount),
          });
        }
        continue;
      }
    }

    result.push({
      id: `${product.id}:product`,
      product,
      src: productImage,
      ...pricesFor(product.variants, product.price.amount),
    });
  }
  return result;
}
