import assert from "node:assert/strict";
import test from "node:test";
import { isEligibleWebsiteImage, moveWebsiteSection } from "@/lib/website-studio/core";
import { initialRetailContent, retailContentSchema, websiteDestination } from "@/lib/website-studio/retail-contract";

const organization = { name: "نمونه", description: null, phone: null, address: null, email: null };

test("initial retail content has the five editable section kinds with stable unique order and keys", () => {
  const parsed = retailContentSchema.parse(initialRetailContent(organization));
  assert.deepEqual(parsed.sections.map(({ key, kind, order, visible }) => [key, kind, order, visible]), [
    ["hero", "HERO", 0, true], ["about", "ABOUT", 1, true], ["gallery", "GALLERY", 2, true],
    ["features", "FEATURES", 3, true], ["contact", "CONTACT", 4, true],
  ]);
  assert.equal(parsed.sections[1].kind === "ABOUT" ? parsed.sections[1].body : null, "");
  assert.equal(parsed.sections[4].kind === "CONTACT" ? parsed.sections[4].phone : null, "");
  assert.equal(parsed.sections[0].kind === "HERO" ? parsed.sections[0].ctaHref : null, "");
  assert.equal(parsed.sections.every((section) => section.visible), true);
});

test("retail content requires exactly one section of each kind and unique keys and orders", () => {
  const content = initialRetailContent(organization);
  assert.equal(retailContentSchema.safeParse({ ...content, sections: content.sections.slice(1) }).success, false);
  assert.equal(retailContentSchema.safeParse({ ...content, sections: content.sections.map((s, i) => i ? s : { ...s, key: content.sections[1].key }) }).success, false);
  assert.equal(retailContentSchema.safeParse({ ...content, sections: content.sections.map((s, i) => i ? s : { ...s, order: 1 }) }).success, false);
  assert.equal(retailContentSchema.safeParse({ ...content, sections: content.sections.map((s, i) => i ? s : { ...s, kind: "ABOUT" }) }).success, false);
});

test("website destinations accept safe local, HTTPS, telephone and email links only", () => {
  for (const value of ["", "/fa/shop", "/contact?from=studio", "https://example.ir/page", "tel:+9821123456", "mailto:hello@example.ir"]) {
    assert.equal(websiteDestination.safeParse(value).success, true, value);
  }
  for (const value of ["//evil.example/path", "javascript:alert(1)", "data:text/html,hi", "http://example.ir", "https://user:pass@example.ir", "/has space", "/line\nbreak"]) {
    assert.equal(websiteDestination.safeParse(value).success, false, value);
  }
});

test("shared media eligibility follows Hotel public upload rules", () => {
  assert.equal(isEligibleWebsiteImage({ filename: "photo-1.webp", url: "/uploads/photo-1.webp", mimeType: "image/webp" }), true);
  assert.equal(isEligibleWebsiteImage({ filename: "x.jpg", url: "https://store.public.blob.vercel-storage.com/x.jpg", mimeType: "image/jpeg" }), true);
  for (const image of [
    { filename: "x.jpg", url: "/uploads/x.jpg?external=1", mimeType: "image/jpeg" },
    { filename: "../x.jpg", url: "/uploads/../x.jpg", mimeType: "image/jpeg" },
    { filename: "x.jpg", url: "https://evil.example/x.jpg", mimeType: "image/jpeg" },
    { filename: "x.jpg", url: "http://store.public.blob.vercel-storage.com/x.jpg", mimeType: "image/jpeg" },
    { filename: "x.svg", url: "/uploads/x.svg", mimeType: "image/svg+xml" },
    { filename: "x.jpg", url: "/uploads/other.jpg", mimeType: "image/jpeg" },
  ]) assert.equal(isEligibleWebsiteImage(image), false, JSON.stringify(image));
});

test("moving a section swaps adjacent order and preserves content at the boundaries", () => {
  const content = initialRetailContent(organization);
  const moved = moveWebsiteSection(content, "about", 1);
  assert.deepEqual(moved.sections.map((section) => [section.key, section.order]), content.sections.map((section) => [section.key, section.order === 1 ? 2 : section.order === 2 ? 1 : section.order]));
  assert.equal(moveWebsiteSection(content, "hero", -1), content);
  assert.equal(moveWebsiteSection(content, "contact", 1), content);
  assert.equal(moveWebsiteSection(content, "missing", 1), content);
});
