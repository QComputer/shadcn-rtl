import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildNewRetailVariantDrafts,
  generateRetailSizeRange,
  type DraftVariantGenerationInput,
} from "../../lib/retail/draft-variant-generation";

const colorDefinition = { id: "color", key: "color", label: "رنگ", scope: "VARIANT_OPTION", valueType: "ENUM", allowedValues: ["navy", "sand"] };
const sizeDefinition = { id: "size", key: "size", label: "سایز", scope: "VARIANT_OPTION", valueType: "ENUM", allowedValues: ["37", "37.5", "38", "38.5"] };
function input(overrides: Partial<DraftVariantGenerationInput> = {}): DraftVariantGenerationInput {
  return {
    colorDefinition, sizeDefinition, colors: ["navy", "sand"], sizes: ["37", "37.5"], existing: [],
    skuPrefix: "SHOE", price: "", inventory: "0", allowBackOrder: false, ...overrides,
  };
}

describe("new retail variant drafts", () => {
  it("builds raw color and half-size combinations with draft defaults", () => {
    const drafts = buildNewRetailVariantDrafts(input({ price: "1250", inventory: "3", allowBackOrder: true }));
    assert.equal(drafts.length, 4);
    assert.deepEqual(drafts[1], {
      galleryMode: "INHERIT", name: "navy / 37.5", sku: "SHOE-navy-37-5", price: "1250", inventory: "3",
      reservedQuantity: 0, allowBackOrder: true, manuallyUnavailable: false,
      options: { color: "navy", size: "37.5" }, imageIds: [],
    });
    assert.equal(new Set(drafts.map(draft => draft.sku.toLowerCase())).size, drafts.length);
  });

  it("accepts custom Persian color names for recognized color definitions", () => {
    const drafts = buildNewRetailVariantDrafts(input({ colors: ["مشکی", "زیتونی", "کرم استخوانی", "آبی نفتی"], sizes: ["37"] }));
    assert.deepEqual(drafts.map(d => d.options.color), ["مشکی", "زیتونی", "کرم استخوانی", "آبی نفتی"]);
    assert.deepEqual(drafts.map(d => d.options.size), ["37", "37", "37", "37"]);
  });

  it("supports mixing preset and custom colors", () => {
    const drafts = buildNewRetailVariantDrafts(input({ colors: ["navy", "آبی نفتی"], sizes: ["37"] }));
    assert.deepEqual(drafts.map(d => d.options.color), ["navy", "آبی نفتی"]);
  });

  it("omits existing raw combinations without overwriting them", () => {
    const existing = [{ options: { color: "navy", size: "37.5" } }];
    const drafts = buildNewRetailVariantDrafts(input({ existing }));
    assert.equal(drafts.length, 3);
    assert.equal(drafts.some(draft => draft.options.color === "navy" && draft.options.size === "37.5"), false);
    assert.equal(existing[0].options.size, "37.5");
  });

  it("deduplicates requested values and disambiguates colliding SKU suffixes", () => {
    const drafts = buildNewRetailVariantDrafts(input({ colors: ["navy", " navy ", "navy"], sizes: ["37", "37.5"] }));
    assert.equal(drafts.length, 2);
    assert.equal(new Set(drafts.map(draft => draft.sku)).size, 2);
  });

  it("rejects empty dimensions, unknown non-color enum choices, invalid inventory and invalid prices", () => {
    assert.throws(() => buildNewRetailVariantDrafts(input({ colors: [] })), /Colors/);
    assert.throws(() => buildNewRetailVariantDrafts(input({ sizes: ["39"] })), /allowed choices/);
    for (const inventory of ["-1", "1.5", "x", "1000000001"]) {
      assert.throws(() => buildNewRetailVariantDrafts(input({ inventory })), /Inventory/);
    }
    for (const price of ["0", "-1", "nope"]) {
      assert.throws(() => buildNewRetailVariantDrafts(input({ price })), /Price/);
    }
  });

  it("enforces the 100 variant product limit after duplicate combinations are removed", () => {
    const existing = Array.from({ length: 97 }, (_, index) => ({ options: { color: `existing-${index}`, size: "37" } }));
    assert.throws(() => buildNewRetailVariantDrafts(input({ existing })), /more than 100/);
    const valid = buildNewRetailVariantDrafts(input({ existing: [...existing.slice(0, 96), { options: { color: "navy", size: "37" } }] }));
    assert.equal(valid.length, 3);
  });
});

describe("retail size range generation", () => {
  it("generates canonical half sizes without locale formatting", () => {
    assert.deepEqual(generateRetailSizeRange({ start: 37, end: 38, step: 0.5 }), ["37", "37.5", "38"]);
    assert.deepEqual(generateRetailSizeRange({ start: 36, end: 42, step: 2 }), ["36", "38", "40", "42"]);
  });

  it("rejects non-finite or non-half-step endpoints, invalid steps, and non-aligned ranges", () => {
    assert.throws(() => generateRetailSizeRange({ start: 36.25, end: 38, step: 0.5 }), /half-step/);
    assert.throws(() => generateRetailSizeRange({ start: Number.NaN, end: 38, step: 0.5 }), /half-step/);
    assert.throws(() => generateRetailSizeRange({ start: 36, end: 38, step: 0.75 as 0.5 }), /invalid/);
    assert.throws(() => generateRetailSizeRange({ start: 36, end: 37, step: 2 }), /boundary/);
    assert.throws(() => generateRetailSizeRange({ start: 1, end: 101, step: 1 }), /100 values/);
  });
});
