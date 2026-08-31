import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { resolveOrganizationHomeContent } from "@/lib/organization-home-content";

describe("organization editorial home content", () => {
  it("resolves the localized Aka Shoes pilot through the generic adapter", () => {
    const home = resolveOrganizationHomeContent({ organizationSlug: "aka-shoes", locale: "fa" });
    assert.ok(home);
    assert.equal(home.seo.title, "آکا شوز شهرکرد | کفش و کتونی");
    assert.equal(home.hero.desktopImage.src.endsWith("aka-home-hero-desktop.webp"), true);
    assert.equal(home.hero.mobileImage.src.endsWith("aka-home-hero-mobile.webp"), true);
    assert.equal(home.collections.length, 4);
    assert.equal(home.featured.items.length, 6);
    assert.equal(home.lookbook.items.length, 4);
  });

  it("isolates foreign and missing tenants from Aka Shoes content", () => {
    assert.equal(resolveOrganizationHomeContent({ organizationSlug: "cafe-leo", locale: "fa" }), null);
    assert.equal(resolveOrganizationHomeContent({ organizationSlug: "partial-brand", locale: "fa" }), null);
    assert.equal(resolveOrganizationHomeContent({ organizationSlug: "unknown", locale: "en" }), null);
  });

  it("falls back to Persian content for an unsupported Aka locale", () => {
    const home = resolveOrganizationHomeContent({ organizationSlug: "aka-shoes", locale: "en" });
    assert.equal(home?.locale, "fa");
  });

  it("references every supplied homepage asset and keeps them outside Product media", () => {
    const home = resolveOrganizationHomeContent({ organizationSlug: "aka-shoes", locale: "fa" });
    assert.ok(home);
    const images = [home.hero.desktopImage, home.hero.mobileImage, ...home.collections.map((item) => item.image), ...home.featured.items.map((item) => item.image), ...home.lookbook.items.map((item) => item.image)];
    assert.equal(images.length, 16);
    assert.equal(new Set(images.map((image) => image.src)).size, 16);
    for (const image of images) {
      assert.match(image.src, /^\/brand\/tenants\/aka-shoes\/home\//);
      assert.equal(existsSync(join(process.cwd(), "public", image.src.replace(/^\//, ""))), true, image.src);
      assert.ok(image.alt.length > 0);
    }
  });

  it("keeps tenant lookup out of the generic presentation component", () => {
    const source = readFileSync(join(process.cwd(), "components/public/organization-brand-home.tsx"), "utf8");
    assert.doesNotMatch(source, /slug\s*===\s*["']aka-shoes["']/);
    assert.doesNotMatch(source, /case\s+["']aka-shoes["']/);
    assert.doesNotMatch(source, /آکا|AKA EDIT|CURATED STYLES/);
    assert.match(source, /resolveOrganizationHomeContent/);
    assert.match(source, /buildOrganizationPublicPath/);
  });

  it("resolves the localized Restaurant 13 pilot through the generic adapter", () => {
    const home = resolveOrganizationHomeContent({ organizationSlug: "italiano-13", locale: "fa" });
    assert.ok(home);
    assert.equal(home.seo.title, "رستوران ایتالیایی سیزده | شهرکرد");
    assert.equal(home.hero.desktopImage.src.endsWith("hero-main.webp"), true);
    assert.equal(home.hero.mobileImage.src.endsWith("hero-main-mobile.webp"), true);
    assert.equal(home.collections.length, 4);
    assert.equal(home.featured.items.length, 5);
    assert.equal(home.lookbook.items.length, 4);
    assert.equal(home.contact.phoneFallback, "03832251313");
    assert.equal(home.contact.instagramUrl, "https://www.instagram.com/restaurant_13_/");
  });

  it("references every supplied Restaurant 13 homepage asset and keeps them outside Product media", () => {
    const home = resolveOrganizationHomeContent({ organizationSlug: "italiano-13", locale: "fa" });
    assert.ok(home);
    const images = [home.hero.desktopImage, home.hero.mobileImage, ...home.collections.map((item) => item.image), ...home.featured.items.map((item) => item.image), ...home.lookbook.items.map((item) => item.image)];
    const referencedPaths = new Set(images.map((image) => image.src));
    const assetRoot = join(process.cwd(), "public", "brand", "tenants", "restaurant-13", "home");
    const suppliedPaths = readdirSync(assetRoot, { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => `/brand/tenants/restaurant-13/home/${join(entry.parentPath, entry.name).slice(assetRoot.length + 1).replaceAll("\\", "/")}`);
    assert.deepEqual([...referencedPaths].sort(), suppliedPaths.sort());
    for (const image of images) {
      assert.match(image.src, /^\/brand\/tenants\/restaurant-13\//);
      assert.equal(existsSync(join(process.cwd(), "public", image.src.replace(/^\//, ""))), true, image.src);
      assert.ok(image.alt.length > 0);
    }
  });
});
