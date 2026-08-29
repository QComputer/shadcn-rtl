import {
  PUBLIC_CATALOG_PRICE_UNIT,
  type PublicCatalogCategory,
  type PublicCatalogMedia,
  type PublicCatalogMoney,
  type PublicCatalogProduct,
  type PublicCatalogVariant,
} from "@/lib/public-catalog/contracts";

type MoneyLike = number | string | { toString(): string };

function amount(value: MoneyLike): number {
  const parsed = Number(value.toString());
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error("Invalid public catalog price");
  return parsed;
}

function money(value: MoneyLike): PublicCatalogMoney {
  return { amount: amount(value), currency: PUBLIC_CATALOG_PRICE_UNIT };
}

function discountedAmount(base: number, discountType?: string | null, discountValue?: MoneyLike | null) {
  const discount = discountValue === null || discountValue === undefined ? 0 : amount(discountValue);
  if (discountType === "percentage" && discount > 0) return Math.max(0, base * (1 - Math.min(discount, 100) / 100));
  if (discountType === "fixed" && discount > 0) return Math.max(0, base - discount);
  return base;
}

export function serializePublicCatalogMedia(input: { image?: string | null; name: string }): PublicCatalogMedia {
  return { card: input.image ?? null, detail: input.image ?? null, alt: input.name };
}

export function serializePublicCatalogCategory(input: {
  id: string; slug?: string | null; name: string; description?: string | null;
  sortOrder: number; image?: string | null; productCount: number;
}): PublicCatalogCategory {
  return {
    id: input.id,
    slug: input.slug ?? null,
    name: input.name,
    description: input.description ?? null,
    sortOrder: input.sortOrder,
    image: input.image ?? null,
    productCount: input.productCount,
  };
}

export function serializePublicCatalogProduct(input: {
  id: string; slug?: string | null; name: string; description?: string | null; image?: string | null;
  basePrice: MoneyLike; discountType?: string | null; discountValue?: MoneyLike | null; trackInventory: boolean;
  category: { id: string; slug?: string | null; name: string };
  variants: Array<{ id: string; name?: string | null; price?: MoneyLike | null; inventory: number; allowBackOrder: boolean }>;
}): PublicCatalogProduct {
  const productBase = amount(input.basePrice);
  const productPrice = discountedAmount(productBase, input.discountType, input.discountValue);
  const variants: PublicCatalogVariant[] = input.variants.map((variant) => {
    const variantBase = variant.price === null || variant.price === undefined ? productBase : amount(variant.price);
    const variantPrice = discountedAmount(variantBase, input.discountType, input.discountValue);
    return {
      id: variant.id,
      name: variant.name ?? null,
      price: money(variantPrice),
      listPrice: variantPrice === variantBase ? null : money(variantBase),
      orderable: !input.trackInventory || variant.allowBackOrder || variant.inventory > 0,
    };
  });
  return {
    id: input.id,
    slug: input.slug ?? null,
    name: input.name,
    description: input.description ?? null,
    category: { id: input.category.id, slug: input.category.slug ?? null, name: input.category.name },
    price: money(productPrice),
    listPrice: productPrice === productBase ? null : money(productBase),
    media: serializePublicCatalogMedia(input),
    orderable: variants.some((variant) => variant.orderable),
    variants,
  };
}
