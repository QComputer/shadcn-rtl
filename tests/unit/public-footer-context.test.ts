import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getPublicFooterContextForPathname } from "@/lib/public-footer-context";
import { buildShopPublicPath } from "@/lib/shop-public-paths";

describe("context-aware public footer", () => {
  it("keeps platform pages on the platform footer", () => {
    assert.equal(getPublicFooterContextForPathname("/fa"), "platform");
    assert.equal(getPublicFooterContextForPathname("/fa/features"), "platform");
    assert.equal(getPublicFooterContextForPathname("/en/pricing"), "platform");
  });

  it("lets organization roots own their tenant footer", () => {
    assert.equal(getPublicFooterContextForPathname("/fa/aka-shoes"), "none");
    assert.equal(getPublicFooterContextForPathname("/en/cafe-leo"), "none");
    assert.equal(getPublicFooterContextForPathname("/fa/features"), "platform");
  });

  it("uses the shop footer for shop routes and compatibility children", () => {
    assert.equal(getPublicFooterContextForPathname("/fa/shop/chakme"), "shop");
    assert.equal(getPublicFooterContextForPathname("/fa/shop/chakme/product/latte"), "shop");
    assert.equal(getPublicFooterContextForPathname("/fa/shop/chakme/category/%DA%A9%D8%A7%D9%81%D9%87"), "shop");
    assert.equal(getPublicFooterContextForPathname("/en/shop/chakme/checkout"), "shop");
    assert.equal(getPublicFooterContextForPathname("/fa/chakme/shop"), "shop");
    assert.equal(getPublicFooterContextForPathname("/en/chakme/shop/product/latte"), "shop");
  });

  it("uses the service organization footer for appointment routes", () => {
    assert.equal(getPublicFooterContextForPathname("/fa/appointment/clinic"), "service");
    assert.equal(getPublicFooterContextForPathname("/ar/appointment/clinic/services"), "service");
    assert.equal(getPublicFooterContextForPathname("/en/appointment/clinic/booking"), "service");
    assert.equal(getPublicFooterContextForPathname("/fa/clinic/appointment"), "service");
    assert.equal(getPublicFooterContextForPathname("/en/clinic/appointment/booking"), "service");
  });

  it("suppresses public footers for app and auth shells", () => {
    assert.equal(getPublicFooterContextForPathname("/fa/dashboard"), "none");
    assert.equal(getPublicFooterContextForPathname("/fa/dashboard/products"), "none");
    assert.equal(getPublicFooterContextForPathname("/fa/login"), "none");
    assert.equal(getPublicFooterContextForPathname("/auth/signin"), "none");
  });

  it("keeps custom-domain shop links capability-namespaced", () => {
    assert.equal(buildShopPublicPath({ locale: "fa", shopSlug: "chakme", isCustomDomain: true }), "/shop");
    assert.equal(buildShopPublicPath({ locale: "fa", shopSlug: "chakme", subPath: "/checkout", isCustomDomain: true }), "/shop/checkout");
    assert.equal(buildShopPublicPath({ locale: "en", shopSlug: "chakme", subPath: "/product/latte", isCustomDomain: true }), "/en/shop/product/latte");
  });

  it("keeps platform shop links locale and slug scoped", () => {
    assert.equal(buildShopPublicPath({ locale: "fa", shopSlug: "chakme" }), "/fa/chakme/shop");
    assert.equal(buildShopPublicPath({ locale: "ar", shopSlug: "chakme", subPath: "/product/latte" }), "/ar/chakme/shop/product/latte");
  });
});
