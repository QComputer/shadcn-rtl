import assert from "node:assert/strict";
import { test } from "node:test";
import { findRetailOptionDefinition, parseRetailOptionList, retailNumericInput } from "../../lib/retail/merchant-size-input";

test("merchant option lists normalize pasted digits, trim values, and support Persian/English comma separators", () => {
  assert.deepEqual(parseRetailOptionList("۳۸، ٣٨٫٥;39\n۳۸\nXL", true), ["38", "38.5", "39", "XL"]);
  assert.deepEqual(parseRetailOptionList("مشکی، سفید\nمشکی", false), ["مشکی", "سفید"]);
  assert.deepEqual(parseRetailOptionList("Black, Olive, Bone cream, Navy blue", false), ["Black", "Olive", "Bone cream", "Navy blue"]);
  assert.equal(retailNumericInput("٣٩٫٥"), "39.5");
  assert.equal(retailNumericInput(""), "");
});

test("merchant dimensions follow this product rather than earlier unrelated test attributes", () => {
  const definitions = [
    { id: "old-color", key: "qa_color", label: "رنگ آزمایشی" },
    { id: "old-size", key: "qa_size", label: "سایز آزمایشی" },
    { id: "real-color", key: "shoe_color", label: "رنگ کفش" },
    { id: "real-size", key: "shoe_size", label: "سایز کفش" },
  ];
  const variants = [{ options: { "real-color": "مشکی", "real-size": "40" } }];
  assert.equal(findRetailOptionDefinition(definitions, variants, "color")?.id, "real-color");
  assert.equal(findRetailOptionDefinition(definitions, variants, "size")?.id, "real-size");
  assert.equal(findRetailOptionDefinition(definitions, [], "size")?.id, "real-size");
});
