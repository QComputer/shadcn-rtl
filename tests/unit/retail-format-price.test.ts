import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatRetailMoney, formatRetailPriceNumber } from "../../lib/retail/format-price";

describe("Retail price formatting", () => {
  it("uses ordinary commas with Persian digits for grouped prices", () => {
    const formatted = formatRetailPriceNumber(3400000);
    assert.equal(formatted, "۳,۴۰۰,۰۰۰");
    assert.ok(!/[\u066c\u060c]/.test(formatted));
  });

  it("keeps up to two fractional digits and uses an ordinary decimal point", () => {
    assert.equal(formatRetailPriceNumber(1234.5), "۱,۲۳۴.۵");
    assert.equal(formatRetailPriceNumber(12.345), "۱۲.۳۵");
  });

  it("formats small and zero values without changing their value", () => {
    assert.equal(formatRetailPriceNumber(0), "۰");
    assert.equal(formatRetailPriceNumber(7), "۷");
    assert.equal(formatRetailPriceNumber(0.25), "۰.۲۵");
  });

  it("adds Toman after the formatted number", () => {
    assert.equal(formatRetailMoney(3400000), "۳,۴۰۰,۰۰۰ تومان");
  });
});
