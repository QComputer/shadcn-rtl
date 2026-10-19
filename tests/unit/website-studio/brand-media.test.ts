import assert from "node:assert/strict";
import test from "node:test";
import { isEligibleRetailWebsiteMedia } from "@/lib/website-studio/retail-contract";
import { resolveOrganizationHomeContent } from "@/lib/organization-home-content";
import { retailWebsiteMedia, tenantBrandMediaId, tenantBrandWebsiteMedia } from "@/lib/website-studio/brand-media";

test("Aka Shoes media contains only deduplicated assets from its approved homepage registry", () => {
  const content = resolveOrganizationHomeContent({ organizationSlug: "aka-shoes", locale: "fa" });
  assert.ok(content);
  const expected = [content.hero.desktopImage, content.hero.mobileImage, ...content.collections.map((item) => item.image), ...content.featured.items.map((item) => item.image), ...content.lookbook.items.map((item) => item.image)];
  const media = tenantBrandWebsiteMedia("aka-shoes");
  assert.deepEqual(media.map((image) => image.url), [...new Set(expected.map((image) => image.src))]);
  assert.equal(media.length, new Set(expected.map((image) => image.src)).size);
  assert.equal(media.every((image) => image.id.startsWith("brand:aka-shoes:") && image.id.length <= 128 && image.source === "TENANT_BRAND"), true);
  assert.equal(media.every((image) => image.filename === image.url.split("/").at(-1) && image.mimeType === "image/webp" && Boolean(image.alt)), true);
  assert.equal(media.every(isEligibleRetailWebsiteMedia), true);
});

test("tenant brand ids and media never cross organization registry boundaries", () => {
  const aka = tenantBrandWebsiteMedia("aka-shoes");
  const restaurant = tenantBrandWebsiteMedia("italiano-13");
  assert.ok(aka.length > 0);
  assert.ok(restaurant.length > 0);
  assert.equal(restaurant.some((image) => image.url.includes("aka-shoes")), false);
  assert.equal(aka.some((image) => image.url.includes("italiano-13")), false);
  assert.deepEqual(tenantBrandWebsiteMedia("unknown-tenant"), []);
  assert.equal(isEligibleRetailWebsiteMedia({ ...aka[0]!, id: tenantBrandMediaId("italiano-13", aka[0]!.url) }), false);
  assert.equal(isEligibleRetailWebsiteMedia({ ...aka[0]!, url: "/brand/tenants/italiano-13/home/fake.webp" }), false);
});

test("local legacy uploads are hidden without a Blob token while direct public Blob uploads stay eligible", () => {
  const images = [
    { id: "legacy", url: "/uploads/legacy.webp", filename: "legacy.webp", mimeType: "image/webp" },
    { id: "blob", url: "https://shop.public.blob.vercel-storage.com/current.webp", filename: "current.webp", mimeType: "image/webp" },
  ];
  const withoutToken = retailWebsiteMedia("aka-shoes", images, false);
  assert.equal(withoutToken.some((image) => image.id === "legacy"), false);
  assert.equal(withoutToken.some((image) => image.id === "blob"), true);
  assert.equal(withoutToken.some((image) => image.source === "TENANT_BRAND"), true);
  const withToken = retailWebsiteMedia("aka-shoes", images, true);
  assert.equal(withToken.some((image) => image.id === "legacy"), true);
  assert.equal(withToken.some((image) => image.id === "blob"), true);
});

test("brand media predicate rejects forged source, id, path, filename, and MIME metadata", () => {
  const valid = tenantBrandWebsiteMedia("aka-shoes")[0]!;
  assert.equal(isEligibleRetailWebsiteMedia(valid), true);
  for (const invalid of [
    { ...valid, id: "forged" },
    { ...valid, url: "/uploads/aka.webp" },
    { ...valid, url: "https://evil.example/aka.webp" },
    { ...valid, filename: "other.webp" },
    { ...valid, mimeType: "image/svg+xml" },
  ]) assert.equal(isEligibleRetailWebsiteMedia(invalid), false);
});
