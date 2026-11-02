import assert from "node:assert/strict";
import test from "node:test";
import { formatRetailSize } from "../../lib/retail/format-size";

test("Persian size display preserves fractions, ranges and letter sizes", () => {
  assert.equal(formatRetailSize("40"), "۴۰");
  assert.equal(formatRetailSize("٣٨.٥ – 40½"), "۳۸.۵ – ۴۰½");
  assert.equal(formatRetailSize("4XL / XL"), "۴XL / XL");
  assert.equal(formatRetailSize("۴۲"), "۴۲");
  assert.equal(formatRetailSize(""), "");
});

test("other locales and canonical option values remain unchanged", () => {
  const option = { value: "40.5" };
  assert.equal(formatRetailSize(option.value, "fa-IR"), "۴۰.۵");
  assert.equal(option.value, "40.5");
  assert.equal(formatRetailSize(option.value, "en"), "40.5");
});
