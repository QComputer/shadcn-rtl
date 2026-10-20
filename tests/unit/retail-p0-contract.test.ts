import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { retailProductCreateSchema, retailProductUpdateSchema } from "@/lib/retail/merchant-catalog.server";
import { publicCatalogProductSchema } from "@/lib/public-catalog/contracts";

const validCreate = {
  name: "Generic Shirt",
  brand: "Studio Example",
  categoryId: "category-primary",
  categoryIds: ["category-primary", "category-secondary"],
  tagNames: ["New season", "Cotton"],
  imageIds: ["image-main"],
  variants: [{
    name: "Red / Small",
    sku: "GENERIC-RED-S",
    price: 1250,
    inventory: 4,
    options: [{ definitionId: "attribute-color", value: "Red" }, { definitionId: "attribute-size", value: "S" }],
    imageIds: ["image-red-front", "image-red-back"],
  }],
};

describe("Retail P0 catalog contracts", () => {
  it("accepts generic brand, taxonomy, typed option assignments, variant SKUs, and ordered galleries", () => {
    const result = retailProductCreateSchema.safeParse(validCreate);
    assert.equal(result.success, true);
    if (result.success) {
      assert.equal(result.data.brand, "Studio Example");
      assert.deepEqual(result.data.categoryIds, ["category-primary", "category-secondary"]);
      assert.deepEqual(result.data.variants[0]?.imageIds, ["image-red-front", "image-red-back"]);
    }
  });

  it("rejects repeated product and variant image IDs before persistence", () => {
    assert.equal(retailProductCreateSchema.safeParse({ ...validCreate, imageIds: ["image-main", "image-main"] }).success, false);
    const duplicateVariantImages = structuredClone(validCreate);
    duplicateVariantImages.variants[0]!.imageIds = ["image-red-front", "image-red-front"];
    assert.equal(retailProductCreateSchema.safeParse(duplicateVariantImages).success, false);
  });

  it("rejects repeated attribute definitions in one variant option set", () => {
    const duplicateOptions = structuredClone(validCreate);
    duplicateOptions.variants[0]!.options = [
      { definitionId: "attribute-color", value: "Red" },
      { definitionId: "attribute-color", value: "Blue" },
    ];
    assert.equal(retailProductCreateSchema.safeParse(duplicateOptions).success, false);
    assert.equal(retailProductUpdateSchema.safeParse({ variantUpdates: [{
      id: "variant-one", options: duplicateOptions.variants[0]!.options,
    }] }).success, false);
  });

  it("allows blank draft SKUs in the contract while SKU uniqueness remains a database write rule", () => {
    const draft = structuredClone(validCreate);
    draft.variants[0]!.sku = "";
    assert.equal(retailProductCreateSchema.safeParse(draft).success, true);
    const databaseEnforcedDuplicate = structuredClone(validCreate);
    databaseEnforcedDuplicate.variants.push({ ...databaseEnforcedDuplicate.variants[0]!, name: "Another option", sku: databaseEnforcedDuplicate.variants[0]!.sku,
      options: [{ definitionId: "attribute-color", value: "Red" }, { definitionId: "attribute-size", value: "M" }] });
    assert.equal(retailProductCreateSchema.safeParse(databaseEnforcedDuplicate).success, true);
  });

  it("keeps public brand and variant gallery additive and excludes stock counters", () => {
    const product = {
      id: "product-one", slug: "shirt", name: "Shirt", brand: "Studio Example", description: null,
      category: { id: "category-one", slug: "clothing", name: "Clothing" },
      price: { amount: 1250, currency: "TOMAN" as const }, listPrice: null,
      media: { card: null, detail: null, alt: "Shirt", gallery: [] }, orderable: true,
      variants: [{ id: "variant-one", name: "Red / Small", price: { amount: 1250, currency: "TOMAN" as const }, listPrice: null,
        orderable: true, sku: "GENERIC-RED-S", options: [], media: { gallery: ["https://media.example.test/red.webp"] } }],
      attributes: [], purchase: null,
    };
    assert.equal(publicCatalogProductSchema.safeParse(product).success, true);
    assert.equal(/inventory|reservedQuantity|allowBackOrder/.test(JSON.stringify(product)), false);
  });
});
