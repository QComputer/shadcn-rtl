import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { organizationBrandingPatchSchema } from "@/lib/organization-branding-management";

describe("organization branding management contract", () => {
  it("accepts organization-scoped regular, maskable, favicon, Apple and color values", () => {
    const result = organizationBrandingPatchSchema.parse({
      displayName: "Example Store",
      shortName: "Example",
      faviconUrl: "/brand/example/favicon.ico",
      appleTouchIconUrl: "/brand/example/apple-touch-icon.png",
      pwaIcon192Url: "/brand/example/icon-192.png",
      pwaIcon512Url: "/brand/example/icon-512.png",
      pwaMaskable192Url: "/brand/example/maskable-192.png",
      pwaMaskable512Url: "/brand/example/maskable-512.png",
      themeColor: "#123456",
      backgroundColor: "#ffffff",
    });
    assert.equal(result.pwaMaskable192Url, "/brand/example/maskable-192.png");
  });

  it("rejects unsafe remote protocols, credentials and unknown tenant fields", () => {
    for (const faviconUrl of ["javascript:alert(1)", "//other-tenant.invalid/icon.png", "http://assets.invalid/icon.png", "https://user:pass@assets.invalid/icon.png"]) {
      assert.equal(organizationBrandingPatchSchema.safeParse({ faviconUrl }).success, false);
    }
    assert.equal(organizationBrandingPatchSchema.safeParse({ organizationId: "another-tenant" }).success, false);
  });

  it("allows stable repeated partial updates and validates colors", () => {
    const patch = { pwaIcon192Url: "/brand/example/icon-192.png" };
    assert.deepEqual(organizationBrandingPatchSchema.parse(patch), patch);
    assert.equal(organizationBrandingPatchSchema.safeParse({ themeColor: "red" }).success, false);
  });
});
