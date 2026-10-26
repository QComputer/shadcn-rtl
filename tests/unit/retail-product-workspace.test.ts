import assert from "node:assert/strict";
import test from "node:test";
import { usesRetailProductWorkspace } from "@/lib/retail/product-workspace";
import { shouldLoadPublishedRetailCatalog, shouldLoadRetailShopCatalog } from "@/lib/retail/shop-experience";

test("retail product organizations use the full catalog workspace", () => {
  assert.equal(usesRetailProductWorkspace({ organizationType: "SHOP", organizationVertical: "SHOE_STORE", organizationCapabilities: ["SHOP"] }), true);
  assert.equal(usesRetailProductWorkspace({ organizationType: "SHOP", organizationVertical: "CLOTHING_STORE", organizationCapabilities: ["SHOP"] }), true);
  assert.equal(usesRetailProductWorkspace({ organizationType: "SHOP", organizationVertical: "PHARMACY", organizationCapabilities: ["SHOP"] }), true);
  assert.equal(usesRetailProductWorkspace({ organizationType: "SHOP", organizationVertical: "SUPERMARKET", organizationCapabilities: ["SHOP"] }), true);
  assert.equal(usesRetailProductWorkspace({ organizationType: "SHOP", organizationVertical: "FLORIST", organizationCapabilities: ["SHOP"] }), true);
});

test("non-retail organizations keep their existing product editor", () => {
  assert.equal(usesRetailProductWorkspace({ organizationType: "SHOP", organizationVertical: "RESTAURANT", organizationCapabilities: ["SHOP"] }), false);
  assert.equal(usesRetailProductWorkspace({ organizationType: "SHOP", organizationVertical: "RESTAURANT", organizationCapabilities: ["SHOP"], organizationRetailProductExperience: true }), false);
  assert.equal(usesRetailProductWorkspace({ organizationType: "SHOP", organizationVertical: "HOTEL", organizationCapabilities: ["SHOP"], organizationRetailProductExperience: true }), false);
  assert.equal(usesRetailProductWorkspace({ organizationType: "APPOINTMENT", organizationVertical: "SHOE_STORE", organizationCapabilities: ["SHOP"] }), false);
  assert.equal(usesRetailProductWorkspace({ organizationType: "SHOP", organizationVertical: "SHOE_STORE", organizationCapabilities: [] }), false);
  assert.equal(usesRetailProductWorkspace({ organizationType: "SHOP", organizationVertical: "SHOE_STORE", organizationCapabilities: ["SHOP"] }, true), false);
  assert.equal(usesRetailProductWorkspace(null), false);
});

test("unclassified shops require an explicit retail product experience opt-in", () => {
  assert.equal(usesRetailProductWorkspace({ organizationType: "SHOP", organizationVertical: null, organizationCapabilities: ["SHOP"] }), false);
  assert.equal(usesRetailProductWorkspace({ organizationType: "SHOP", organizationVertical: null, organizationCapabilities: ["SHOP"], organizationRetailProductExperience: true }), true);
  assert.equal(usesRetailProductWorkspace({ organizationType: "SHOP", organizationVertical: "", organizationCapabilities: ["SHOP"], organizationRetailProductExperience: true }), true);
  assert.equal(usesRetailProductWorkspace({ organizationType: "SHOP", organizationVertical: null, organizationCapabilities: [], organizationRetailProductExperience: true }), false);
  assert.equal(usesRetailProductWorkspace({ organizationType: "SHOP", organizationVertical: null, organizationCapabilities: ["SHOP"], organizationRetailProductExperience: true }, true), false);
});

test("a retail-goods root can use the published catalog without changing shop defaults", () => {
  assert.equal(shouldLoadPublishedRetailCatalog({
    locale: "fa",
    forcePublishedCatalog: true,
    hasPresentationTheme: false,
    previewOnly: false,
  }), true);
  assert.equal(shouldLoadPublishedRetailCatalog({
    locale: "fa",
    hasPresentationTheme: false,
    previewOnly: false,
  }), false);
  assert.equal(shouldLoadPublishedRetailCatalog({
    locale: "fa",
    forcePublishedCatalog: true,
    hasPresentationTheme: true,
    previewOnly: true,
  }), false);
  assert.equal(shouldLoadPublishedRetailCatalog({
    locale: "en",
    forcePublishedCatalog: true,
    hasPresentationTheme: false,
    previewOnly: false,
  }), false);
});

test("the shop route uses the retail catalog for explicitly opted-in unclassified shops", () => {
  const base = {
    locale: "fa",
    hasPresentationTheme: false,
    previewOnly: false,
    organizationType: "SHOP",
    organizationVertical: null,
    organizationCapabilities: ["SHOP"],
    modernProductExperience: true,
  } as const;

  assert.equal(shouldLoadRetailShopCatalog(base), true);
  assert.equal(shouldLoadRetailShopCatalog({ ...base, modernProductExperience: false }), false);
  assert.equal(shouldLoadRetailShopCatalog({ ...base, organizationVertical: "RESTAURANT" }), false);
  assert.equal(shouldLoadRetailShopCatalog({ ...base, previewOnly: true }), false);
  assert.equal(shouldLoadRetailShopCatalog({ ...base, locale: "en" }), false);
});
