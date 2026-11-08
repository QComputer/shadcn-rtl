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

  it("accepts arbitrary valid custom colors for recognized VARIANT_OPTION color enums while keeping presets optional", () => {
    const colorDef = { valueType: "ENUM" as const, allowedValues: ["Black", "White"], key: "shoe_color", label: "رنگ کفش", scope: "VARIANT_OPTION" };
    assert.deepEqual(validateRetailAttributeValue(colorDef, "زیتونی"), { valueText: "زیتونی", valueNumber: null, valueBoolean: null });
    assert.deepEqual(validateRetailAttributeValue(colorDef, "کرم استخوانی"), { valueText: "کرم استخوانی", valueNumber: null, valueBoolean: null });
    assert.deepEqual(validateRetailAttributeValue(colorDef, "آبی نفتی"), { valueText: "آبی نفتی", valueNumber: null, valueBoolean: null });
    assert.deepEqual(validateRetailAttributeValue(colorDef, "Black"), { valueText: "Black", valueNumber: null, valueBoolean: null });
    assert.throws(() => validateRetailAttributeValue(colorDef, "   "), /non-empty/);
  });

  it("still rejects disallowed values for unrelated non-color enums", () => {
    assert.throws(() => validateRetailAttributeValue({ valueType: "ENUM", allowedValues: ["S", "M"], key: "material", label: "جنس", scope: "PRODUCT" }, "L"), /allowed values/);
    assert.throws(() => validateRetailAttributeValue({ valueType: "ENUM", allowedValues: ["Cotton"], key: "fabric", label: "پارچه", scope: "VARIANT_OPTION" }, "Linen"), /allowed values/);
  });
});
