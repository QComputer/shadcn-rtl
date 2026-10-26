import assert from "node:assert/strict";
import test from "node:test";
import { resolveLegacyProductRedirect } from "../../lib/public-catalog/legacy-product-routing.ts";

test("legacy tenant-less product URL resolves to the tenant's canonical product route", () => {
  assert.equal(resolveLegacyProductRedirect("fa", [
    { id: "product-id", slug: "cold-coffee-1", organizationSlug: "cafe-leo" },
  ]), "/fa/cafe-leo/shop/product/cold-coffee-1");
});

test("legacy tenant-less product URL falls back to the product ID when no slug exists", () => {
  assert.equal(resolveLegacyProductRedirect("en", [
    { id: "product-id", slug: null, organizationSlug: "cafe-leo" },
  ]), "/en/cafe-leo/shop/product/product-id");
});

test("ambiguous or unsupported legacy product URLs do not select a tenant", () => {
  const matches = [
    { id: "one", slug: "same-product", organizationSlug: "shop-one" },
    { id: "two", slug: "same-product", organizationSlug: "shop-two" },
  ];
  assert.equal(resolveLegacyProductRedirect("fa", matches), null);
  assert.equal(resolveLegacyProductRedirect("fa-IR", [matches[0]]), null);
  assert.equal(resolveLegacyProductRedirect("fa", []), null);
});

test("legacy product redirects safely encode path segments", () => {
  assert.equal(resolveLegacyProductRedirect("fa", [
    { id: "product-id", slug: "cold coffee/1", organizationSlug: "cafe leo" },
  ]), "/fa/cafe%20leo/shop/product/cold%20coffee%2F1");
});
