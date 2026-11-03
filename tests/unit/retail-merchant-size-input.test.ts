import assert from "node:assert/strict";
import { test } from "node:test";
import { parseRetailOptionList, retailNumericInput } from "../../lib/retail/merchant-size-input";

test("merchant size lists normalize pasted Persian and Arabic digits and common separators", () => {
  assert.deepEqual(parseRetailOptionList("۳۸، ٣٨٫٥;39\n۳۸\nXL", true), ["38", "38.5", "39", "XL"]);
  assert.deepEqual(parseRetailOptionList("مشکی، سفید\nمشکی"), ["مشکی", "سفید"]);
  assert.equal(retailNumericInput("٣٩٫٥"), "39.5");
  assert.equal(retailNumericInput(""), "");
});
