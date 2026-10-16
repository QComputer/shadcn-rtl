import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveTenantRetailStartPath, resolveTenantShopStartPath } from "@/lib/tenant-retail-pwa";

describe("tenant Retail PWA start path", () => {
  it("requires both an active SHOP capability and persisted Retail presentation", () => {
    const base = { locale: "fa" as const, slug: "aka-shoes", branding: { retailPresentationTheme: "FASHION" } };
    assert.equal(resolveTenantRetailStartPath({ ...base, hasActiveShopCapability: true }), "/fa/aka-shoes/shop");
    assert.equal(resolveTenantRetailStartPath({ ...base, hasActiveShopCapability: false }), null);
    assert.equal(resolveTenantRetailStartPath({ ...base, branding: { retailPresentationTheme: null }, hasActiveShopCapability: true }), null);
    assert.equal(resolveTenantRetailStartPath({ ...base, branding: { retailPresentationTheme: "RESTAURANT" }, hasActiveShopCapability: true }), null);
  });

  it("uses a safe encoded tenant route and only links to a supported Retail locale", () => {
    assert.equal(resolveTenantRetailStartPath({ locale: "fa", slug: "my shop", hasActiveShopCapability: true, branding: { retailPresentationTheme: "GENERAL" } }), "/fa/my%20shop/shop");
    assert.equal(resolveTenantRetailStartPath({ locale: "en", slug: "aka-shoes", hasActiveShopCapability: true, branding: { retailPresentationTheme: "FASHION" } }), null);
    assert.equal(resolveTenantRetailStartPath({ locale: "fa", slug: "../victim", hasActiveShopCapability: true, branding: { retailPresentationTheme: "FASHION" } }), null);
  });

  it("uses only the canonical shop route for trusted active SHOP tenants", () => {
    assert.equal(resolveTenantShopStartPath({ locale: "fa", hasActiveShopCapability: true }), "/fa/shop");
    assert.equal(resolveTenantShopStartPath({ locale: "en", hasActiveShopCapability: true }), "/en/shop");
    assert.equal(resolveTenantShopStartPath({ locale: "fa", hasActiveShopCapability: false }), null);
  });
});
