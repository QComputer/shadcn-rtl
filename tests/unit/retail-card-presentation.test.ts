import assert from "node:assert/strict";
import { test } from "node:test";
import type { PublicCatalogProduct, PublicCatalogVariant } from "../../lib/public-catalog/contracts";
import { colorSlides, constrainedDimensions, filterCardVariants } from "../../lib/retail/card-presentation";

function option(key: string, label: string, value: string | number | boolean, valueType: "TEXT" | "NUMBER" | "BOOLEAN" = "TEXT") {
  return { key, label, value, valueType, displayUnit: null, filterable: true } as const;
}

function variant(id: string, options: PublicCatalogVariant["options"], gallery: string[] = []): PublicCatalogVariant {
  return { id, name: null, price: { amount: 100, currency: "TOMAN" }, listPrice: null, orderable: true, sku: null, options,
    media: { gallery } };
}

function product(variants: PublicCatalogVariant[], attributes: PublicCatalogProduct["attributes"] = []): PublicCatalogProduct {
  return { id: "p1", slug: "shoe", name: "Shoe", brand: null, description: null,
    category: { id: "c1", slug: "shoes", name: "Shoes" }, price: { amount: 100, currency: "TOMAN" }, listPrice: null,
    media: { card: "/merchant-card.jpg", detail: null, alt: "Shoe", gallery: [] }, orderable: true, variants,
    attributes, purchase: null };
}

const red38 = variant("red38", [option("color", "Color", "red"), option("size", "Size", "38")], ["/red.jpg"]);
const red39 = variant("red39", [option("color", "Color", "red"), option("size", "Size", "39")], ["/red.jpg"]);
const blue38 = variant("blue38", [option("color", "Color", "blue"), option("size", "Size", "38")], ["/blue.jpg"]);

test("card variant filters use same-key OR and different-key AND with exact values", () => {
  const source = product([red38, red39, blue38]);
  const filtered = filterCardVariants(source, ["color:red", "color:blue", "size:38"]);
  assert.deepEqual(filtered.variants.map(({ id }) => id), ["red38", "blue38"]);
  assert.equal(filtered.category, source.category);
  assert.deepEqual(filterCardVariants(source, ["color:re", "size:38"]).variants, []);
  assert.equal(filterCardVariants(source, ["color:blue:extra"]).variants.length, 0);
});

test("PRODUCT filters do not constrain variant choices or mark variant dimensions", () => {
  const source = product([red38, blue38], [option("material", "Material", "leather") as PublicCatalogProduct["attributes"][number]]);
  assert.equal(filterCardVariants(source, ["material:leather"]).variants.length, 2);
  assert.deepEqual(constrainedDimensions(source, ["material:leather"]), []);
});

test("unavailable variants remain represented when availability was not filtered", () => {
  const unavailable = { ...red38, id: "unavailable", orderable: false };
  const source = product([unavailable, blue38]);
  assert.deepEqual(filterCardVariants(source, ["size:38"]).variants.map(({ id }) => id), ["unavailable", "blue38"]);
});

test("NUMBER and BOOLEAN filters follow backend scalar matching rules", () => {
  const source = product([
    variant("forty-active", [option("shoe_size", "Size", 40, "NUMBER"), option("backorder", "Backorder", true, "BOOLEAN")]),
    variant("forty-inactive", [option("shoe_size", "Size", 40, "NUMBER"), option("backorder", "Backorder", false, "BOOLEAN")]),
    variant("forty-one", [option("shoe_size", "Size", 41, "NUMBER"), option("backorder", "Backorder", true, "BOOLEAN")]),
  ]);
  assert.deepEqual(filterCardVariants(source, ["shoe_size:۴۰", "backorder:TRUE"]).variants.map(({ id }) => id), ["forty-active"]);
  assert.deepEqual(filterCardVariants(source, ["shoe_size:40.1"]).variants, []);
});

test("non-filterable option keys do not constrain variants", () => {
  const source = product([variant("a", [{ ...option("internal", "Internal", "x"), filterable: false }, option("size", "Size", "38")])]);
  assert.equal(filterCardVariants(source, ["internal:other"]).variants.length, 1);
  assert.deepEqual(constrainedDimensions(source, ["internal:other"]), []);
});

test("canonical dimensions are marked only when their raw variant keys are filtered", () => {
  const source = product([variant("a", [option("shoe_size", "Size", "38"), option("body_color", "Color", "red")])]);
  assert.deepEqual(constrainedDimensions(source, ["shoe_size:38"]).map(({ id, keys }) => ({ id, keys })), [
    { id: "size", keys: ["shoe_size"] },
  ]);
});

test("color slides use distinct merchant variant images and omit missing images", () => {
  const source = product([
    red38,
    red39,
    variant("blue", [option("color", "Color", "blue")], ["/blue.jpg"]),
    variant("green", [option("color", "Color", "green")]),
    variant("gold", [option("color", "Color", "gold")], ["/blue.jpg"]),
  ]);
  assert.deepEqual(colorSlides(source), [
    { value: "red", src: "/red.jpg" },
    { value: "blue", src: "/blue.jpg" },
  ]);
  assert.deepEqual(colorSlides(product([variant("plain", [option("size", "Size", "38")])])), []);
});

test("storefront shoe_color options support the real tenant filter and color image contract", () => {
  const source = product([
    variant("red", [option("shoe_color", "رنگ کفش", "قرمز"), option("shoe_size", "سایز کفش", "40")], ["/red.jpg"]),
    variant("blue", [option("shoe_color", "رنگ کفش", "آبی"), option("shoe_size", "سایز کفش", "40")], ["/blue.jpg"]),
  ]);
  assert.deepEqual(colorSlides(source).map(slide => slide.value), ["قرمز", "آبی"]);
  assert.deepEqual(constrainedDimensions(source, ["shoe_color:آبی"]).map(dimension => dimension.id), ["color"]);
  assert.deepEqual(filterCardVariants(source, ["shoe_color:آبی"]).variants.map(variant => variant.id), ["blue"]);
});

test("incomplete color and size records do not borrow the product fallback image", () => {
  const source = product([
    variant("red-no-size-or-image", [option("color", "Color", "red")]),
    variant("blue-with-image-no-size", [option("color", "Color", "blue")], ["/blue.jpg"]),
    variant("size-only", [option("size", "Size", "38")], ["/size.jpg"]),
  ]);
  assert.deepEqual(colorSlides(source), [{ value: "blue", src: "/blue.jpg" }]);
});
