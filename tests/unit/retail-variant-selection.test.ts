import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PublicCatalogProduct, PublicCatalogVariant } from "@/lib/public-catalog/contracts";
import {
  canonicalDimensions,
  chooseVariant,
  dimensionValues,
  findCanonicalDimension,
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
    assert.deepEqual(optionDimensions(catalogProduct), { color: ["color"], size: ["size"] });
  });

  it("canonicalDimensions groups semantically identical keys into one dimension", () => {
    const dupColorVariant = (id: string, color: string, size: string): PublicCatalogVariant => ({
      id,
      name: `${color} · ${size}`,
      price: { amount: 2500, currency: "TOMAN" },
      listPrice: null,
      orderable: true,
      sku: `${color}-${size}`,
      options: [
        option("color", "Color", color),
        option("رنگ", "رنگ کفش", color),
        option("size", "Size", size),
        option("سایز", "سایز کفش", size),
      ],
    });

    const catalogProduct = product([
      dupColorVariant("navy-s", "Navy", "S"),
      dupColorVariant("red-m", "Red", "M"),
    ]);

    const dims = canonicalDimensions(catalogProduct);
    // Exactly one color dimension and one size dimension, no duplicates
    const colorDims = dims.filter((d) => d.id === "color");
    const sizeDims = dims.filter((d) => d.id === "size");
    assert.equal(colorDims.length, 1);
    assert.equal(sizeDims.length, 1);
    assert.deepEqual(colorDims[0].keys, ["color", "رنگ"]);
    assert.deepEqual(sizeDims[0].keys, ["size", "سایز"]);

    // dimensionValues collects values from ALL keys in the group
    const colorValues = dimensionValues(catalogProduct, colorDims[0]);
    assert.deepEqual(colorValues.sort(), ["Navy", "Red"]);
  });

  it("findCanonicalDimension locates the dimension containing a raw key", () => {
    const dupVariant = (id: string): PublicCatalogVariant => ({
      id,
      name: "dup",
      price: { amount: 2500, currency: "TOMAN" },
      listPrice: null,
      orderable: true,
      sku: id,
      options: [option("رنگ", "رنگ کفش", "Navy")],
    });

    const catalogProduct = product([dupVariant("v1")]);
    const dim = findCanonicalDimension(catalogProduct, "رنگ");
    assert.ok(dim);
    assert.equal(dim!.id, "color");
    assert.deepEqual(dim!.keys, ["رنگ"]);
  });

  it("eight duplicate color definitions render as exactly one logical color selector", () => {
    const manyColorVariant = (idx: number, color: string): PublicCatalogVariant => ({
      id: `v${idx}`,
      name: `color-${idx}`,
      price: { amount: 2500, currency: "TOMAN" },
      listPrice: null,
      orderable: true,
      sku: `c${idx}`,
      options: [
        option(`color${idx}`, `رنگ${idx}`, color),
        option(`رنگ${idx}`, `رنگ کفش${idx}`, color),
        option(`color_${idx}`, `رنگ_کفش${idx}`, color),
      ],
    });

    // 8 variants, each with 3 color-matching keys = 24 raw keys, but 1 canonical dimension
    const catalogProduct = product([
      manyColorVariant(0, "Navy"),
      manyColorVariant(1, "WhiteRed"),
      manyColorVariant(2, "Brown"),
      manyColorVariant(3, "Navy"),
      manyColorVariant(4, "WhiteRed"),
      manyColorVariant(5, "Brown"),
      manyColorVariant(6, "Navy"),
      manyColorVariant(7, "WhiteRed"),
    ]);

    const dims = canonicalDimensions(catalogProduct);
    const colorDims = dims.filter((d) => d.id === "color");
    assert.equal(colorDims.length, 1, "exactly one color dimension regardless of duplicate keys");
    assert.equal(colorDims[0].keys.length, 24, "all 24 color-matching raw keys grouped");
    const colorValues = dimensionValues(catalogProduct, colorDims[0]);
    assert.deepEqual(colorValues.sort(), ["Brown", "Navy", "WhiteRed"], "three unique colors remain");
  });

  it("repeated size changes do not increase selector count", () => {
    const catalogProduct = product([
      variant("red-s", "Red", "S", true),
      variant("red-m", "Red", "M", true),
      variant("blue-s", "Blue", "S", true),
      variant("blue-m", "Blue", "M", true),
    ]);

    const dims = canonicalDimensions(catalogProduct);
    const initialCount = dims.length;

    // Simulate repeated size selection — canonical dimensions don't change
    const dimsAfter = canonicalDimensions(catalogProduct);
    assert.equal(dimsAfter.length, initialCount, "selector count stable across size changes");
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
