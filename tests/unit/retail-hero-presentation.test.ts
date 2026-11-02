import assert from "node:assert/strict";
import { test } from "node:test";
import type { PublicCatalogProduct, PublicCatalogVariant } from "../../lib/public-catalog/contracts";
import { buildRetailHeroSlides } from "../../lib/retail/hero-presentation";

function option(key: string, label: string, value: string) {
  return { key, label, value, valueType: "TEXT" as const, displayUnit: null, filterable: true };
}

function variant(id: string, color: string, price: number, image: string | null, listPrice?: number): PublicCatalogVariant {
  return { id, name: null, price: { amount: price, currency: "TOMAN" }, listPrice: listPrice === undefined ? null : { amount: listPrice, currency: "TOMAN" },
    orderable: true, sku: null, options: [option("color", "Color", color), option("size", "Size", "38")],
    media: { gallery: image ? [image] : [] } };
}

function product(id: string, variants: PublicCatalogVariant[], media: Partial<PublicCatalogProduct["media"]> = {}): PublicCatalogProduct {
  return { id, slug: id, name: id, brand: null, description: null,
    category: { id: "c1", slug: null, name: "Shoes" }, price: { amount: 500, currency: "TOMAN" }, listPrice: null,
    media: { detail: null, card: null, alt: id, gallery: [], ...media }, orderable: true, variants, attributes: [], purchase: null };
}

test("selects at most five distinct products with usable media and skips missing media", () => {
  const input = [product("missing", []), ...Array.from({ length: 6 }, (_, index) => product(`p${index}`, [], { card: `/p${index}.jpg` }))];
  const slides = buildRetailHeroSlides(input);
  assert.equal(slides.length, 5);
  assert.deepEqual(slides.map((slide) => slide.product.id), ["p0", "p1", "p2", "p3", "p4"]);
  assert.deepEqual(buildRetailHeroSlides([input[1], input[1]]).map((slide) => slide.id), ["p0:product"]);
});

test("creates color frames with prices calculated only from that canonical color", () => {
  const shoe = product("shoe", [
    variant("red38", "red", 120, "/red.jpg", 150),
    variant("red39", "red", 140, "/red.jpg", 170),
    variant("blue38", "blue", 200, "/blue.jpg"),
    variant("green38", "green", 90, "/green.jpg"),
    variant("black38", "black", 80, "/black.jpg"),
  ]);
  const slides = buildRetailHeroSlides([shoe]);
  assert.deepEqual(slides.map(({ color, src, price, fromPrice, listPrice }) => ({ color, src, price, fromPrice, listPrice })), [
    { color: "red", src: "/red.jpg", price: 120, fromPrice: true, listPrice: 150 },
    { color: "blue", src: "/blue.jpg", price: 200, fromPrice: false, listPrice: undefined },
    { color: "green", src: "/green.jpg", price: 90, fromPrice: false, listPrice: undefined },
  ]);
  assert.equal(new Set(slides.map(({ id }) => id)).size, slides.length);
});

test("uses product media precedence for non-color frames and variant price range", () => {
  const item = product("item", [variant("a", "red", 110, null), variant("b", "blue", 150, null)], {
    detail: "/detail.jpg", card: "/card.jpg", gallery: ["/gallery.jpg"],
  });
  const [slide] = buildRetailHeroSlides([item]);
  assert.equal(slide.src, "/detail.jpg");
  assert.equal(slide.price, 110);
  assert.equal(slide.fromPrice, true);
});

test("falls through to a real color image and returns no slides for an empty catalog", () => {
  const item = product("color-only", [variant("a", "red", 100, "/real-red.jpg"), variant("b", "red", 100, "/other-red.jpg")]);
  assert.deepEqual(buildRetailHeroSlides([item]).map(({ src }) => src), ["/real-red.jpg"]);
  assert.deepEqual(buildRetailHeroSlides([]), []);
});

test("does not borrow a crossed-out price from a more expensive variant", () => {
  const item = product("mixed", [variant("a", "red", 100, null), variant("b", "red", 200, null, 250)], { card: "/shoe.jpg" });
  const [slide] = buildRetailHeroSlides([item]);
  assert.equal(slide.price, 100);
  assert.equal(slide.listPrice, undefined);
});
