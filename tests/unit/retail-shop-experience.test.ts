import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hasModernRetailProductExperience } from "@/lib/retail/shop-experience";

describe("modern retail product experience opt-in", () => {
  it("defaults to the legacy product experience", () => {
    assert.equal(hasModernRetailProductExperience(null, {}), false);
    assert.equal(hasModernRetailProductExperience({}, {}), false);
  });

  it("opts in only for the exact VARIANTS_V1 setting", () => {
    assert.equal(hasModernRetailProductExperience({ retailCatalog: { productExperience: "VARIANTS_V1" } }, {}), true);
  });

  it("ignores malformed settings and retail catalog values", () => {
    for (const settings of [undefined, null, "VARIANTS_V1", [], { retailCatalog: null }, { retailCatalog: [] }, { retailCatalog: "VARIANTS_V1" }]) {
      assert.equal(hasModernRetailProductExperience(settings, {}), false);
    }
  });

  it("does not opt in for truthy strings or other product experience values", () => {
    assert.equal(hasModernRetailProductExperience({ retailCatalog: { productExperience: "true" } }, {}), false);
    assert.equal(hasModernRetailProductExperience({ retailCatalog: { productExperience: true } }, {}), false);
    assert.equal(hasModernRetailProductExperience({ retailCatalog: { productExperience: "variants_v1" } }, {}), false);
  });

  it("lets preview-only branding take precedence over both opt-in sources", () => {
    assert.equal(hasModernRetailProductExperience(
      { retailCatalog: { productExperience: "VARIANTS_V1" } },
      { retailPresentationTheme: "FASHION", retailPreviewOnly: true },
    ), false);
  });

  it("retains existing published retail presentation themes", () => {
    assert.equal(hasModernRetailProductExperience({}, { retailPresentationTheme: "FASHION" }), true);
    assert.equal(hasModernRetailProductExperience({}, { retailPresentationTheme: "GENERAL", retailPreviewOnly: false }), true);
  });
});
