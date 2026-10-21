import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  colorGroupKey,
  gallerySettingsInputSchema,
  inferColorGallery,
  orderedImages,
  readGallerySettings,
} from "../../lib/retail/product-galleries";

describe("retail product galleries", () => {
  it("orders requested images first and retains images missing from saved metadata", () => {
    const images = [{ id: "a" }, { id: "b" }, { id: "c" }];
    assert.deepEqual(orderedImages(images, ["c", "missing", "c"]), [images[2], images[0], images[1]]);
  });

  it("rejects duplicate image IDs and configured limits", () => {
    const valid = { version: 1 as const, productImageIds: [], colors: [] };
    assert.equal(gallerySettingsInputSchema.safeParse({ ...valid, productImageIds: ["x", "x"] }).success, false);
    assert.equal(gallerySettingsInputSchema.safeParse({ ...valid, productImageIds: Array.from({ length: 21 }, (_, i) => `${i}`) }).success, false);
    assert.equal(gallerySettingsInputSchema.safeParse({ ...valid, colors: Array.from({ length: 101 }, (_, i) => ({ definitionId: `${i}`, value: "v", imageIds: [] })) }).success, false);
    assert.equal(gallerySettingsInputSchema.safeParse({ ...valid, colors: [{ definitionId: "d", value: "v", imageIds: ["x", "x"] }] }).success, false);
  });

  it("enforces identifier and color value bounds", () => {
    const valid = { version: 1 as const, productImageIds: [], colors: [] };
    assert.equal(gallerySettingsInputSchema.safeParse({ ...valid, productImageIds: [""] }).success, false);
    assert.equal(gallerySettingsInputSchema.safeParse({ ...valid, productImageIds: ["x".repeat(65)] }).success, false);
    assert.equal(gallerySettingsInputSchema.safeParse({ ...valid, colors: [{ definitionId: "", value: "v", imageIds: [] }] }).success, false);
    assert.equal(gallerySettingsInputSchema.safeParse({ ...valid, colors: [{ definitionId: "d", value: "", imageIds: [] }] }).success, false);
    assert.equal(gallerySettingsInputSchema.safeParse({ ...valid, colors: [{ definitionId: "d", value: "v".repeat(1001), imageIds: [] }] }).success, false);
    assert.equal(gallerySettingsInputSchema.safeParse({ ...valid, colors: [{ definitionId: "d".repeat(65), value: "v", imageIds: [] }] }).success, false);
    assert.equal(gallerySettingsInputSchema.safeParse({ ...valid, colors: [{ definitionId: "d", value: "v", imageIds: ["x".repeat(65)] }] }).success, false);
  });

  it("rejects duplicate color groups using the full definition and value pair", () => {
    const valid = { version: 1 as const, productImageIds: [], colors: [] };
    assert.equal(gallerySettingsInputSchema.safeParse({
      ...valid,
      colors: [
        { definitionId: "color", value: "red", imageIds: [] },
        { definitionId: "color", value: "red", imageIds: ["another"] },
      ],
    }).success, false);
    assert.equal(gallerySettingsInputSchema.safeParse({
      ...valid,
      colors: [
        { definitionId: "a:b", value: "c", imageIds: [] },
        { definitionId: "a", value: "b:c", imageIds: [] },
      ],
    }).success, true);
  });

  it("rejects editor-only overrides in input and fails closed on malformed persisted settings", () => {
    const input = { version: 1, productImageIds: [], colors: [], overrides: ["variant-1"] };
    assert.equal(gallerySettingsInputSchema.safeParse(input).success, false);
    assert.equal(readGallerySettings({ version: 2, productImageIds: [], colors: [] }), null);
    assert.equal(readGallerySettings({ version: 1, productImageIds: ["x", "x"], colors: [] }), null);
    assert.equal(readGallerySettings({ version: 1, productImageIds: [], colors: [], extra: true }), null);
    assert.equal(readGallerySettings({ version: 1, productImageIds: [], colors: [], overrides: [""] }), null);
    assert.equal(readGallerySettings({ version: 1, productImageIds: [], colors: [], overrides: ["v", "v"] }), null);
    assert.equal(readGallerySettings({ version: 1, productImageIds: [], colors: [
      { definitionId: "color", value: "red", imageIds: [] },
      { definitionId: "color", value: "red", imageIds: ["image"] },
    ] }), null);
    assert.equal(readGallerySettings({ version: 1, productImageIds: [], colors: [], overrides: Array.from({ length: 101 }, (_, i) => `v${i}`) }), null);
  });

  it("normalizes absent stored overrides to an empty list", () => {
    assert.deepEqual(readGallerySettings({ version: 1, productImageIds: ["p"], colors: [] }), {
      version: 1,
      productImageIds: ["p"],
      colors: [],
      overrides: [],
    });
  });

  it("chooses the most common exact ordered gallery and breaks ties by first appearance", () => {
    assert.deepEqual(inferColorGallery([
      { id: "one", imageIds: ["a", "b"] },
      { id: "two", imageIds: ["b", "a"] },
    ]), { imageIds: ["a", "b"], overrideIds: ["two"] });
    assert.deepEqual(inferColorGallery([
      { id: "one", imageIds: ["a"] },
      { id: "two", imageIds: ["a"] },
      { id: "three", imageIds: [] },
    ]), { imageIds: ["a"], overrideIds: ["three"] });
  });

  it("keeps distinct and empty variant galleries explicit as overrides", () => {
    assert.deepEqual(inferColorGallery([
      { id: "empty", imageIds: [] },
      { id: "red", imageIds: ["red-1"] },
      { id: "blue", imageIds: ["blue-1"] },
    ]), { imageIds: [], overrideIds: ["red", "blue"] });
  });

  it("creates collision-safe keys for color definition and value pairs", () => {
    assert.notEqual(colorGroupKey("a:b", "c"), colorGroupKey("a", "b:c"));
    assert.notEqual(colorGroupKey("a", "bc"), colorGroupKey("ab", "c"));
  });
});
