import assert from "node:assert/strict";
import { test } from "node:test";
import { isCustomDomainApplicationPath } from "@/lib/custom-domain-routing";

test("recovery stays on the shared application surface for tenant custom domains", () => {
  for (const path of ["/forgot-password", "/fa/forgot-password", "/en/forgot-password", "/ar/forgot-password"]) {
    assert.equal(isCustomDomainApplicationPath(path), true);
  }
  for (const path of ["/shop", "/shop/product/kids-adidas-100", "/fa/shop", "/forgot-password/unrelated", "/forgot-password-extra"]) {
    assert.equal(isCustomDomainApplicationPath(path), false);
  }
  assert.equal(isCustomDomainApplicationPath("/fa/login"), true);
  assert.equal(isCustomDomainApplicationPath("/fa/dashboard/settings"), true);
});
