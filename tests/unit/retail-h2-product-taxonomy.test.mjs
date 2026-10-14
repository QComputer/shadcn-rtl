import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canonicalCategoryIds, canonicalTagNames, tagIdentityKey,
  MAX_PRODUCT_CATEGORIES, MAX_PRODUCT_TAGS,
} from "../../lib/retail/product-taxonomy-utils.ts";

describe("Retail H2 product taxonomy pure contracts", () => {
  it("always keeps the legacy primary category, including an empty selection", () => {
    assert.deepEqual(canonicalCategoryIds("primary", []), ["primary"]);
    assert.deepEqual(canonicalCategoryIds("primary", ["secondary", "primary", "secondary"]), ["primary", "secondary"]);
  });
  it("rejects malformed and overlimit category selections", () => {
    assert.throws(() => canonicalCategoryIds("", []));
    assert.throws(() => canonicalCategoryIds("primary", [" "]));
    assert.throws(() => canonicalCategoryIds("primary", Array.from({ length: MAX_PRODUCT_CATEGORIES }, (_, i) => `cat-${i}`)));
  });
  it("normalizes Arabic and Persian variants without duplicating tags", () => {
    const tags = canonicalTagNames(["  كفش  زنانه ", "کفش زنانه", "پیاده\u200cروی", "پیاده روی"]);
    assert.equal(tags.length, 2);
    assert.deepEqual(tags.map(t => t.name), ["کفش زنانه", "پیاده روی"]);
    assert.equal(tagIdentityKey("CASUAL"), tagIdentityKey("casual"));
  });
  it("preserves empty tag list as a clear operation", () => {
    assert.deepEqual(canonicalTagNames([]), []);
  });
  it("rejects blank, oversized and too many tags", () => {
    assert.throws(() => canonicalTagNames(["  "]));
    assert.throws(() => canonicalTagNames(["X".repeat(65)]));
    assert.throws(() => canonicalTagNames(Array.from({ length: MAX_PRODUCT_TAGS + 1 }, (_, i) => `tag${i}`)));
  });
});
