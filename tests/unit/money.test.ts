import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Decimal } from "@prisma/client/runtime/library";
import { toMoneyDecimal, toMoneyNumber } from "@/lib/money";

describe("money coercion", () => {
  it("preserves Decimal and Decimal-like values instead of silently returning zero", () => {
    assert.equal(toMoneyDecimal(new Decimal("123000.50")).toString(), "123000.5");
    assert.equal(toMoneyNumber({ toString: () => "456000" }), 456000);
  });

  it("accepts numbers and numeric strings", () => {
    assert.equal(toMoneyNumber(123000), 123000);
    assert.equal(toMoneyNumber("  456000  "), 456000);
  });

  it("rejects missing or invalid money values", () => {
    assert.throws(() => toMoneyDecimal(null, "order item price"), /order item price is missing/);
    assert.throws(() => toMoneyDecimal(undefined, "order item price"), /order item price is missing/);
    assert.throws(() => toMoneyDecimal(NaN, "order item price"), /not finite/);
    assert.throws(() => toMoneyDecimal(Infinity, "order item price"), /not finite/);
    assert.throws(() => toMoneyDecimal(-Infinity, "order item price"), /not finite/);
    assert.throws(() => toMoneyDecimal("", "order item price"), /not a valid money value/);
    assert.throws(() => toMoneyDecimal("abc", "order item price"), /not a valid money value/);
    assert.throws(() => toMoneyDecimal({ toString: () => "[object Object]" }), /not a valid money value/);
    assert.throws(() => toMoneyDecimal({}, "order item price"), /not a valid money value/);
  });
});
