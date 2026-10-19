import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PublicCatalogProduct } from "@/lib/public-catalog/contracts";
import {
  chooseVariant,
  optionDimensions,
  resolveSelectedVariant,
  resolveVariantGallery,
  type RetailProduct,
  type RetailVariant,
} from "@/lib/retail/variant-selection";

function option(key: string, label: string, value: string) {
  return { key, label, valueType: "TEXT" as const, value, displayUnit: null, filterable: false };
}

function variant(id: string, color: string, size: string, orderable: boolean, gallery: string[] = []): RetailVariant {
  return {
    id,
    name: `${color} · ${size}`,
    price: { amount: 2500, currency: "TOMAN" },
    listPrice: null,
    orderable,
    sku: `${color}-${size}`,
    options: [option("color", "Color", color), option("size", "Size", size)],
    ...(gallery.length ? { media: { gallery } } : {}),
  };
}

function product(variants: RetailVariant[], gallery: string[] = []): RetailProduct {
  return {
    id: "product-one",
    slug: "shirt",
    name: "Everyday shirt",
    brand: "Example label",
    description: null,
    category: { id: "category-one", slug: null, name: "Clothing" },
    price: { amount: 2500, currency: "TOMAN" },
    listPrice: null,
    media: { card: gallery[0] ?? null, detail: gallery[0] ?? null, alt: "Shirt", gallery },
    orderable: variants.some((item) => item.orderable),
    variants,
    attributes: [],
    purchase: null,
  } satisfies PublicCatalogProduct;
}

describe("retail variant selection", () => {
  it("recognizes tenant-defined color and size option dimensions", () => {
    const catalogProduct = product([variant("red-s", "Red", "S", true)]);
    assert.deepEqual(optionDimensions(catalogProduct), { color: "color", size: "size" });
  });

  it("keeps the selected size compatible when changing color, including a valid out-of-stock pair", () => {
    const catalogProduct = product([
      variant("red-s", "Red", "S", true),
      variant("red-m", "Red", "M", true),
      variant("blue-s", "Blue", "S", false),
      variant("blue-m", "Blue", "M", true),
    ]);
    const selected = chooseVariant(catalogProduct, catalogProduct.variants[0], "color", "Blue");
    assert.equal(selected?.id, "blue-s");
    assert.equal(selected?.options.find((item) => item.key === "size")?.value, "S");
    assert.equal(selected?.orderable, false);
  });

  it("falls back to an orderable variant carrying the requested value when the current combination is absent", () => {
    const catalogProduct = product([
      variant("red-s", "Red", "S", false),
      variant("blue-m", "Blue", "M", true),
    ]);
    const selected = chooseVariant(catalogProduct, catalogProduct.variants[0], "size", "M");
    assert.equal(selected?.id, "blue-m");
    assert.equal(selected?.options.find((item) => item.key === "size")?.value, "M");
  });

  it("keeps an explicitly selected valid out-of-stock variant so its unavailable status can be shown", () => {
    const catalogProduct = product([
      variant("red-s", "Red", "S", true),
      variant("red-m", "Red", "M", false),
    ]);
    const selected = chooseVariant(catalogProduct, catalogProduct.variants[0], "size", "M");
    assert.equal(selected?.id, "red-m");
    assert.equal(selected?.orderable, false);
  });

  it("replaces a stale selected variant ID with the first orderable variant", () => {
    const catalogProduct = product([
      variant("red-s", "Red", "S", false),
      variant("blue-m", "Blue", "M", true),
    ]);
    assert.equal(resolveSelectedVariant(catalogProduct, "deleted-variant")?.id, "blue-m");
  });

  it("uses the selected variant gallery and falls back to the product gallery when it is empty", () => {
    const catalogProduct = product([
      variant("red-s", "Red", "S", true, ["/owned/red-front.webp", "/owned/red-side.webp"]),
      variant("blue-s", "Blue", "S", true),
    ], ["/owned/product-main.webp", "/owned/product-back.webp"]);
    assert.deepEqual(resolveVariantGallery(catalogProduct, catalogProduct.variants[0]), ["/owned/red-front.webp", "/owned/red-side.webp"]);
    assert.deepEqual(resolveVariantGallery(catalogProduct, catalogProduct.variants[1]), ["/owned/product-main.webp", "/owned/product-back.webp"]);
  });
});
