import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { filterTenantPublicProductImages, isSafePublicMediaUrl } from "@/lib/public-catalog/media-policy";

describe("tenant public product media policy", () => {
  it("keeps same-origin paths and HTTPS CDN media only", () => {
    assert.equal(isSafePublicMediaUrl("/uploads/tenant-a/shoe.webp"), true);
    assert.equal(isSafePublicMediaUrl("https://cdn.example.test/tenant-a/shoe.webp"), true);
    for (const url of [
      "//cdn.example.test/shoe.webp",
      "http://cdn.example.test/shoe.webp",
      "https://user:secret@cdn.example.test/shoe.webp",
      "javascript:alert(1)",
      "data:image/svg+xml,<svg/>",
      "vbscript:msgbox(1)",
      "/\\\\evil.example/shoe.webp",
    ]) assert.equal(isSafePublicMediaUrl(url), false, `reject ${url}`);
  });

  it("returns only distinct public image relations owned by the requested tenant", () => {
    const result = filterTenantPublicProductImages([
      { url: "/uploads/tenant-a/public.webp", organizationId: "tenant-a", access: "PUBLIC" },
      { url: "https://cdn.example.test/tenant-a/detail.webp", organizationId: "tenant-a", access: "PUBLIC" },
      { url: "/uploads/tenant-b/private.webp", organizationId: "tenant-b", access: "PUBLIC" },
      { url: "/uploads/tenant-a/private.webp", organizationId: "tenant-a", access: "PRIVATE" },
      { url: "javascript:alert(1)", organizationId: "tenant-a", access: "PUBLIC" },
      { url: "data:image/png;base64,AA==", organizationId: "tenant-a", access: "PUBLIC" },
      { url: "vbscript:msgbox(1)", organizationId: "tenant-a", access: "PUBLIC" },
      { url: "/uploads/unowned/shared.webp", organizationId: null, access: "PUBLIC" },
      { url: "/uploads/tenant-a/public.webp", organizationId: "tenant-a", access: "PUBLIC" },
    ], "tenant-a");

    assert.deepEqual(result.map((image) => image.url), [
      "/uploads/tenant-a/public.webp",
      "https://cdn.example.test/tenant-a/detail.webp",
    ]);
    assert.equal(JSON.stringify(result).includes("tenant-b"), false);
    assert.equal(JSON.stringify(result).includes("PRIVATE"), false);
    assert.equal(JSON.stringify(result).includes("javascript:"), false);
    assert.equal(JSON.stringify(result).includes("data:"), false);
    assert.equal(JSON.stringify(result).includes("vbscript:"), false);
  });
});
