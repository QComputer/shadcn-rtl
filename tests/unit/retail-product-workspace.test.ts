import assert from "node:assert/strict";
import test from "node:test";
import { usesRetailProductWorkspace } from "@/lib/retail/product-workspace";
import { shouldLoadPublishedRetailCatalog } from "@/lib/retail/shop-experience";

test("retail product organizations use the full catalog workspace", () => {
  assert.equal(usesRetailProductWorkspace({ organizationType: "SHOP", organizationVertical: "SHOE_STORE", organizationCapabilities: ["SHOP"] }), true);
  assert.equal(usesRetailProductWorkspace({ organizationType: "SHOP", organizationVertical: "CLOTHING_STORE", organizationCapabilities: ["SHOP"] }), true);
  assert.equal(usesRetailProductWorkspace({ organizationType: "SHOP", organizationVertical: "PHARMACY", organizationCapabilities: ["SHOP"] }), true);
  assert.equal(usesRetailProductWorkspace({ organizationType: "SHOP", organizationVertical: "SUPERMARKET", organizationCapabilities: ["SHOP"] }), true);
  assert.equal(usesRetailProductWorkspace({ organizationType: "SHOP", organizationVertical: "FLORIST", organizationCapabilities: ["SHOP"] }), true);
});

test("non-retail organizations keep their existing product editor", () => {
  assert.equal(usesRetailProductWorkspace({ organizationType: "SHOP", organizationVertical: "RESTAURANT", organizationCapabilities: ["SHOP"] }), false);
  assert.equal(usesRetailProductWorkspace({ organizationType: "APPOINTMENT", organizationVertical: "SHOE_STORE", organizationCapabilities: ["SHOP"] }), false);
  assert.equal(usesRetailProductWorkspace({ organizationType: "SHOP", organizationVertical: "SHOE_STORE", organizationCapabilities: [] }), false);
  assert.equal(usesRetailProductWorkspace({ organizationType: "SHOP", organizationVertical: "SHOE_STORE", organizationCapabilities: ["SHOP"] }, true), false);
  assert.equal(usesRetailProductWorkspace(null), false);
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
