import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { RetailProduct, RetailVariant } from "../../lib/retail/variant-selection";
import { compareRetailSizes, exactProductVariant, productDetailGallery, reliableColorSwatch, variantSelection, verifiedRetailProductJsonLd } from "../../lib/retail/product-detail";

const variant = (id: string, color: string, size: string, orderable = true): RetailVariant => ({ id, name: `${color} ${size}`, sku: id, price: { amount: 1200, currency: "TOMAN" }, listPrice: null, orderable, options: [
  { key: "color", label: "رنگ", valueType: "TEXT", value: color, displayUnit: null, filterable: true },
  { key: "size", label: "سایز", valueType: "TEXT", value: size, displayUnit: null, filterable: true },
], media: { gallery: [`/uploads/${id}.png`] } });
const product: RetailProduct = { id: "product", slug: "shoe", name: "کفش", brand: "Merchant brand", description: null, category: { id: "category", slug: "shoes", name: "کفش" }, price: { amount: 1200, currency: "TOMAN" }, listPrice: null, media: { detail: "/uploads/main.png", card: "/uploads/main.png", alt: "کفش", gallery: ["/uploads/back.png"] }, variants: [variant("red38", "Red", "38"), variant("red39", "Red", "39", false), variant("navy39", "Navy", "39")], attributes: [], orderable: true, purchase: null };

describe("premium Retail product detail", () => {
  it("does not silently pick among ambiguous optionless variants", () => {
    assert.equal(exactProductVariant({ ...product, variants: product.variants.map(v => ({ ...v, options: [] })) }, {}), undefined);
    assert.equal(exactProductVariant({ ...product, variants: [{ ...product.variants[0], options: [] }] }, {})?.id, "red38");
  });
  it("orders actual clothing sizes in their conventional sequence", () => {
    assert.deepEqual(["XL", "M", "XS", "L", "S"].sort(compareRetailSizes), ["XS", "S", "M", "L", "XL"]);
  });
  it("selects only the exact color/size and never substitutes an absent combination", () => {
    assert.equal(exactProductVariant(product, { color: "Navy", size: "38" }), undefined);
    assert.equal(exactProductVariant(product, { color: "Red" }), undefined);
    assert.equal(exactProductVariant(product, { color: "Red", size: "38" })?.id, "red38");
    assert.equal(exactProductVariant(product, { color: "Red", size: "39" })?.orderable, false);
    assert.equal(exactProductVariant(product, { color: "Red", size: "38", foreign: "x" }), undefined);
  });
  it("retains the selected size when color changes rather than selecting a different size", () => {
    const initial = variantSelection(product.variants[0]);
    assert.deepEqual({ ...initial, color: "Navy" }, { color: "Navy", size: "38" });
    assert.equal(exactProductVariant(product, { ...initial, color: "Navy" }), undefined);
  });
  it("orders Persian, Arabic and Latin numeric sizes numerically", () => {
    assert.deepEqual(["۴۲", "39", "٣٨", "۴۰", "10", "۹"].sort(compareRetailSizes), ["۹", "10", "٣٨", "39", "۴۰", "۴۲"]);
  });
  it("uses exact variant media and includes the primary image in fallback", () => {
    assert.deepEqual(productDetailGallery(product, product.variants[0]), ["/uploads/red38.png"]);
    assert.deepEqual(productDetailGallery(product, { ...product.variants[0], media: { gallery: [] } }), ["/uploads/main.png", "/uploads/back.png"]);
    assert.deepEqual(productDetailGallery({ ...product, media: { ...product.media, gallery: ["/uploads/main.png", "/uploads/back.png"] } }), ["/uploads/main.png", "/uploads/back.png"]);
  });
  it("does not invent a swatch for unknown merchant color names", () => {
    assert.equal(reliableColorSwatch("قرمز QA"), undefined);
    assert.equal(reliableColorSwatch("unmapped-color"), undefined);
    assert.equal(reliableColorSwatch("#abc"), "#abc");
    assert.ok(reliableColorSwatch("سرمه‌ای"));
  });
  it("uses verified brand, prices and inventory in structured data without fabricated ratings", () => {
    const data = verifiedRetailProductJsonLd(product, "https://merchant.example/shop/product/shoe");
    assert.equal(data.offers?.lowPrice, 12000);
    assert.equal(data.offers?.priceCurrency, "IRR");
    assert.equal(data.brand?.name, "Merchant brand");
    assert.equal(data.offers?.availability, "https://schema.org/InStock");
    assert.equal("aggregateRating" in data, false);
    assert.deepEqual(data.image, ["https://merchant.example/uploads/main.png", "https://merchant.example/uploads/back.png"]);
    assert.equal(verifiedRetailProductJsonLd({ ...product, variants: product.variants.map(v => ({ ...v, orderable: false })) }, "https://merchant.example/p").offers?.availability, "https://schema.org/OutOfStock");
    assert.equal(verifiedRetailProductJsonLd({ ...product, variants: [] }, "https://merchant.example/p").offers, undefined);
  });
});
