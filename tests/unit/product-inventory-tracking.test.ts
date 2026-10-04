import assert from "node:assert/strict";
import test from "node:test";

import { updateProductSchema } from "@/lib/validators";
import { serializePublicCatalogProduct } from "@/lib/public-catalog/serializers";

const baseProduct = {
  id: "product-1",
  slug: "untracked-zero-stock",
  name: "Untracked product",
  description: null,
  image: null,
  basePrice: 100,
  category: { id: "category-1", slug: "general", name: "General" },
};

test("admin updates preserve an explicit false trackInventory value", () => {
  const parsed = updateProductSchema.parse({ trackInventory: false });
  assert.equal(parsed.trackInventory, false);
  assert.equal(updateProductSchema.parse({ trackInventory: true }).trackInventory, true);
});

test("public serialization makes a zero-stock untracked product orderable", () => {
  const product = serializePublicCatalogProduct({
    ...baseProduct,
    trackInventory: false,
    variants: [{ id: "variant-1", name: "Default", price: 100, inventory: 0, allowBackOrder: false }],
  });

  assert.equal(product.orderable, true);
  assert.equal(product.variants[0].orderable, true);
});

test("public serialization keeps zero-stock tracked products unavailable", () => {
  const product = serializePublicCatalogProduct({
    ...baseProduct,
    trackInventory: true,
    variants: [{ id: "variant-1", name: "Default", price: 100, inventory: 0, allowBackOrder: false }],
  });

  assert.equal(product.orderable, false);
  assert.equal(product.variants[0].orderable, false);
});

test("backorders make zero-stock tracked variants orderable", () => {
  const product = serializePublicCatalogProduct({
    ...baseProduct,
    trackInventory: true,
    variants: [{ id: "variant-1", name: "Default", price: 100, inventory: 0, allowBackOrder: true }],
  });

  assert.equal(product.orderable, true);
  assert.equal(product.variants[0].orderable, true);
});
