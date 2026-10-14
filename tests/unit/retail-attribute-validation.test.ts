import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { retailAttributeDefinitionInputSchema, validateRetailAttributeValue } from "@/lib/retail/attribute-validation";

describe("retail attribute contracts", () => {
  it("accepts localized typed definitions and requires explicit enum choices", () => {
    const parsed = retailAttributeDefinitionInputSchema.parse({ key: "ram", label: "حافظه RAM", localizedLabels: { en: "RAM" }, scope: "PRODUCT", valueType: "NUMBER", displayUnit: "GB", localizedUnits: {}, allowedValues: null, isFilterable: true });
    assert.equal(parsed.displayUnit, "GB");
    assert.throws(() => retailAttributeDefinitionInputSchema.parse({ key: "color", label: "رنگ", scope: "VARIANT_OPTION", valueType: "ENUM" }));
    assert.throws(() => retailAttributeDefinitionInputSchema.parse({ key: "bad key", label: "نام", scope: "PRODUCT", valueType: "TEXT" }));
  });

  it("stores exactly one correctly typed value and validates enum membership", () => {
    assert.deepEqual(validateRetailAttributeValue({ valueType: "NUMBER", allowedValues: null }, 12), { valueText: null, valueNumber: 12, valueBoolean: null });
    assert.deepEqual(validateRetailAttributeValue({ valueType: "BOOLEAN", allowedValues: null }, false), { valueText: null, valueNumber: null, valueBoolean: false });
    assert.deepEqual(validateRetailAttributeValue({ valueType: "ENUM", allowedValues: ["Black", "Blue"] }, "Black"), { valueText: "Black", valueNumber: null, valueBoolean: null });
    assert.throws(() => validateRetailAttributeValue({ valueType: "NUMBER", allowedValues: null }, "12"));
    assert.throws(() => validateRetailAttributeValue({ valueType: "ENUM", allowedValues: ["Black"] }, "Blue"));
  });
});
