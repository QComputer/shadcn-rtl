import assert from "node:assert/strict";
import test from "node:test";
import { usesRetailProductWorkspace } from "@/lib/retail/product-workspace";

test("retail product organizations use the full catalog workspace", () => {
  assert.equal(usesRetailProductWorkspace({ organizationType: "SHOP", organizationVertical: "SHOE_STORE", organizationCapabilities: ["SHOP"] }), true);
  assert.equal(usesRetailProductWorkspace({ organizationType: "SHOP", organizationVertical: "CLOTHING_STORE", organizationCapabilities: ["SHOP"] }), true);
});

test("non-retail organizations keep their existing product editor", () => {
  assert.equal(usesRetailProductWorkspace({ organizationType: "SHOP", organizationVertical: "RESTAURANT", organizationCapabilities: ["SHOP"] }), false);
  assert.equal(usesRetailProductWorkspace({ organizationType: "APPOINTMENT", organizationVertical: "SHOE_STORE", organizationCapabilities: ["SHOP"] }), false);
  assert.equal(usesRetailProductWorkspace({ organizationType: "SHOP", organizationVertical: "SHOE_STORE", organizationCapabilities: [] }), false);
  assert.equal(usesRetailProductWorkspace({ organizationType: "SHOP", organizationVertical: "SHOE_STORE", organizationCapabilities: ["SHOP"] }, true), false);
  assert.equal(usesRetailProductWorkspace(null), false);
});
