import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { resolveOperationalAppRoute } from "@/lib/custom-domain-routing";

describe("CafeLeo CL-3A source identity contract", () => {
  it("uses an explicit checked-in source key rather than a presentation name", () => {
    const first = { slug: "hot-coffee-1", name: "اسپرسو" };
    const renamed = { ...first, name: "اسپرسو ویژه" };
    assert.equal(first.slug, renamed.slug);
    assert.notEqual(first.name, renamed.name);
    const source = readFileSync("docs/architecture/cafeleo-cl3a-foundation.md", "utf8");
    assert.match(source, /CAFELEO_PUBLIC_CATALOG_V1/);
    assert.match(source, /reject duplicate keys/);
  });

  it("does not misuse REJECTED for source disappearance", () => {
    const source = readFileSync("lib/external-product-mapping.ts", "utf8");
    assert.match(source, /sourcePresent: false/);
    assert.doesNotMatch(source, /data:\s*\{\s*status:\s*"REJECTED"/);
  });
});

describe("generic APP_PATH adapter", () => {
  it("maps clean browser paths to organization-first internal routes", () => {
    assert.deepEqual(resolveOperationalAppRoute("/", "tenant-a"), {
      locale: "fa", internalPathname: "/fa/tenant-a", surface: "HOME",
    });
    assert.deepEqual(resolveOperationalAppRoute("/purchase/product/prod-1", "tenant-a"), {
      locale: "fa", internalPathname: "/fa/tenant-a/purchase/product/prod-1", surface: "PURCHASE_INTENT",
    });
    assert.deepEqual(resolveOperationalAppRoute("/shop/product/latte", "tenant-a"), {
      locale: "fa", internalPathname: "/fa/tenant-a/shop/product/latte", surface: "SHOP",
    });
    assert.equal(resolveOperationalAppRoute("/shop/cart", "tenant-a")?.internalPathname, "/fa/tenant-a/shop/cart");
    assert.equal(resolveOperationalAppRoute("/shop/checkout", "tenant-a")?.internalPathname, "/fa/tenant-a/shop/checkout");
    assert.equal(resolveOperationalAppRoute("/login", "tenant-a")?.internalPathname, "/fa/login");
  });

  it("preserves an explicit locale but never requires the organization slug", () => {
    assert.equal(resolveOperationalAppRoute("/en/shop", "tenant-a")?.internalPathname, "/en/tenant-a/shop");
    assert.equal(resolveOperationalAppRoute("/purchase/product/a%2Fb", "tenant-a"), null);
    assert.equal(resolveOperationalAppRoute("/purchase/product/..", "tenant-a"), null);
    assert.equal(resolveOperationalAppRoute("/https://evil.example", "tenant-a"), null);
  });
});
