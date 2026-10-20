import {
  PUBLIC_CATALOG_PRICE_UNIT,
  publicCatalogProductSchema,
  publicCatalogCategorySchema,
  type PublicCatalogCategory,
  type PublicCatalogAttribute,
  type PublicCatalogMedia,
  type PublicCatalogMoney,
  type PublicCatalogProduct,
  type PublicCatalogPurchase,
  type PublicCatalogVariant,
  type PublicCatalogVariantMedia,
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

function attributeValue(input: { key: string; label: string; valueType: "TEXT" | "NUMBER" | "BOOLEAN" | "ENUM"; displayUnit: string | null; filterable: boolean; valueText?: string | null; valueNumber?: MoneyLike | null; valueBoolean?: boolean | null }): PublicCatalogAttribute | null {
  const identifier = `${input.key} ${input.label}`.toLocaleLowerCase().replace(/[\s._-]+/g, " ");
  const compactKey = input.key.toLocaleLowerCase().replace(/[^a-z0-9]/g, "");
  if (/(?:imei|meid|esn|serialnumber|serialno|deviceid|deviceidentifier|macaddress)/.test(compactKey)
    || /\b(?:imei|meid|esn|serial(?: number| no)?|device id|device identifier|mac address)\b/.test(identifier)
    || /شماره\s*سریال|شناسه\s*دستگاه/.test(identifier)) return null;
  const value = input.valueType === "NUMBER" ? (input.valueNumber == null ? null : Number(input.valueNumber.toString()))
    : input.valueType === "BOOLEAN" ? input.valueBoolean ?? null : input.valueText ?? null;
  if (value === null || (typeof value === "number" && !Number.isFinite(value))) return null;
  return { key: input.key, label: input.label, valueType: input.valueType, value, displayUnit: input.displayUnit, filterable: input.filterable };
}

function discountedAmount(base: number, discountType?: string | null, discountValue?: MoneyLike | null) {
  const discount = discountValue === null || discountValue === undefined ? 0 : amount(discountValue);
  if (discountType === "percentage" && discount > 0) return Math.max(0, base * (1 - Math.min(discount, 100) / 100));
  if (discountType === "fixed" && discount > 0) return Math.max(0, base - discount);
  return base;
}

export function serializePublicCatalogMedia(input: { image?: string | null; images?: string[]; name: string }): PublicCatalogMedia {
  const primary = input.image ?? null;
  const gallery = (input.images ?? []).filter((url) => url !== primary);
  return { card: primary, detail: primary, alt: input.name, gallery };
}

export function serializePublicCatalogCategory(input: {
  id: string; slug?: string | null; name: string; description?: string | null;
  sortOrder: number; image?: string | null; productCount: number;
}): PublicCatalogCategory {
  return publicCatalogCategorySchema.parse({
    id: input.id,
    slug: input.slug ?? null,
    name: input.name,
    description: input.description ?? null,
    sortOrder: input.sortOrder,
    image: input.image ?? null,
    productCount: input.productCount,
  }) as unknown as PublicCatalogCategory;
}

export function serializePublicCatalogProduct(input: {
  id: string; slug?: string | null; name: string; brand?: string | null; description?: string | null; image?: string | null; images?: string[];
  basePrice: MoneyLike; discountType?: string | null; discountValue?: MoneyLike | null; trackInventory: boolean;
  category: { id: string; slug?: string | null; name: string };
  attributes?: Array<Parameters<typeof attributeValue>[0]>;
  variants: Array<{ id: string; sku?: string | null; name?: string | null; price?: MoneyLike | null; inventory: number; reservedQuantity?: number; allowBackOrder: boolean; options?: Array<Parameters<typeof attributeValue>[0]>; media?: PublicCatalogVariantMedia }>;
  purchase?: PublicCatalogPurchase | null;
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
      orderable: !input.trackInventory || variant.allowBackOrder || variant.inventory - (variant.reservedQuantity ?? 0) > 0,
      sku: variant.sku ?? null,
      options: (variant.options ?? []).map(attributeValue).filter((value): value is PublicCatalogAttribute => value !== null),
      ...(variant.media ? { media: variant.media } : {}),
    };
  });
  const attributes = (input.attributes ?? []).map(attributeValue).filter((value): value is PublicCatalogAttribute => value !== null);
  const availableVariants = variants.filter((variant) => variant.orderable);
  const displayedVariant = [...(availableVariants.length ? availableVariants : variants)].sort((left, right) => left.price.amount - right.price.amount)[0];
  const displayPrice = displayedVariant?.price.amount ?? productPrice;
  const displayListPrice = displayedVariant?.listPrice?.amount ?? (variants.length ? null : (productPrice === productBase ? null : productBase));
  return publicCatalogProductSchema.parse({
    id: input.id,
    slug: input.slug ?? null,
    name: input.name,
    ...(input.brand === undefined ? {} : { brand: input.brand }),
    description: input.description ?? null,
    category: { id: input.category.id, slug: input.category.slug ?? null, name: input.category.name },
    price: money(displayPrice),
    listPrice: displayListPrice === null || displayListPrice === displayPrice ? null : money(displayListPrice),
    media: serializePublicCatalogMedia(input),
    orderable: variants.some((variant) => variant.orderable),
    variants,
    attributes,
    purchase: input.purchase ?? null,
  }) as unknown as PublicCatalogProduct;
}
