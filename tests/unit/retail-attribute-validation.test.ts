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
    // Canonical recognition still derives freeform for actual color defs in write/import assignment shapes.
    assert.deepEqual(validateRetailAttributeValue({ ...colorDef, allowFreeformColor: undefined }, "Persian Blue"), { valueText: "Persian Blue", valueNumber: null, valueBoolean: null });
  });

  it("rejects false-positive color names (tricolor_flag/discoloration/watercolor) and enforces ENUM choices on all assignment paths", () => {
    const falsePositives = [
      { key: "tricolor_flag", label: "Flag" },
      { key: "discoloration", label: "Issue" },
      { key: "watercolor", label: "Finish" },
    ] as const;
    for (const fp of falsePositives) {
      const def = { valueType: "ENUM" as const, allowedValues: ["Red", "Blue"], scope: "VARIANT_OPTION", ...fp };
      assert.throws(() => validateRetailAttributeValue(def, "Green"), /allowed values/, `${fp.key} must not bypass ENUM`);
      assert.deepEqual(validateRetailAttributeValue(def, "Red"), { valueText: "Red", valueNumber: null, valueBoolean: null });
      // Import Hub/product write shapes pass key/label/scope/valueType/allowedValues with no explicit allowFreeformColor.
      assert.throws(() => validateRetailAttributeValue({ ...def, allowFreeformColor: undefined }, "Green"), /allowed values/);
    }
    // Non-color keys remain strict even with misleading labels.
    assert.throws(() => validateRetailAttributeValue({ valueType: "ENUM", allowedValues: ["A"], key: "material", label: "watercolor material", scope: "VARIANT_OPTION" }, "B"), /allowed values/);
    // PRODUCT-scope color-like keys are never freeform.
    assert.throws(() => validateRetailAttributeValue({ valueType: "ENUM", allowedValues: ["A"], key: "primary_color", label: "رنگ", scope: "PRODUCT" }, "B"), /allowed values/);
  });

  it("still rejects disallowed values for unrelated non-color enums", () => {
    assert.throws(() => validateRetailAttributeValue({ valueType: "ENUM", allowedValues: ["S", "M"], key: "material", label: "جنس", scope: "PRODUCT" }, "L"), /allowed values/);
    assert.throws(() => validateRetailAttributeValue({ valueType: "ENUM", allowedValues: ["Cotton"], key: "fabric", label: "پارچه", scope: "VARIANT_OPTION" }, "Linen"), /allowed values/);
  });
});
