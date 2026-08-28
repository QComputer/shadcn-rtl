#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const results = [];

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}

function add(name, ok, detail = "") {
  results.push({ name, ok, detail });
}

function expectFile(rel) {
  add(`${rel} exists`, exists(rel), rel);
}

function expectIncludes(rel, needle, label) {
  if (!exists(rel)) {
    add(label, false, `${rel} is missing`);
    return;
  }
  add(label, read(rel).includes(needle), needle);
}

const dashboardPages = [
  "app/[locale]/dashboard/product-categories/page.tsx",
  "app/[locale]/dashboard/service-categories/page.tsx",
  "app/[locale]/dashboard/products/new/page.tsx",
  "app/[locale]/dashboard/products/[id]/page.tsx",
  "app/[locale]/dashboard/services/new/page.tsx",
  "app/[locale]/dashboard/services/[id]/page.tsx",
];

for (const rel of [
  "components/dashboard/slug-preview-actions.tsx",
  "docs/PHASE_55_PUBLIC_SLUG_PREVIEW_SHARE.md",
  "docs/PHASE_55_OVERLAY_MANIFEST.md",
  ...dashboardPages,
]) {
  expectFile(rel);
}

expectIncludes("components/dashboard/slug-preview-actions.tsx", "navigator.clipboard.writeText(publicUrl)", "slug preview copies public URLs");
expectIncludes("components/dashboard/slug-preview-actions.tsx", "window.open(publicUrl", "slug preview opens public URLs");
expectIncludes("components/dashboard/slug-preview-actions.tsx", "window.location.origin", "slug preview uses current deployment origin");

for (const rel of dashboardPages) {
  expectIncludes(rel, "SlugPreviewActions", `${rel} renders slug preview actions`);
}

expectIncludes("app/[locale]/dashboard/product-categories/page.tsx", "/shop/${organizationSlug}/category/${segment}", "product category preview uses public category route");
expectIncludes("app/[locale]/dashboard/service-categories/page.tsx", "/appointment/${organizationSlug}/services/category/${segment}", "service category preview uses public category route");
expectIncludes("app/[locale]/dashboard/products/new/page.tsx", "/shop/${selectedCategory.organizationSlug}/product/${slug.trim()}", "new product preview uses selected shop route");
expectIncludes("app/[locale]/dashboard/products/[id]/page.tsx", "/shop/${product.organizationSlug}/product/${productSlugSegment}", "edit product preview uses saved shop route");
expectIncludes("app/[locale]/dashboard/services/new/page.tsx", "/appointment/${selectedCategory.organization.slug}/services/${slug.trim()}", "new service preview uses selected appointment route");
expectIncludes("app/[locale]/dashboard/services/[id]/page.tsx", "/appointment/${service.organization.slug}/services/${serviceSlugSegment}", "edit service preview uses saved appointment route");
expectIncludes("lib/services/category.service.ts", "organization: {", "service category list exposes organization relation for previews");
expectIncludes("lib/services/category.service.ts", "slug: true", "service category list exposes organization slug for previews");

expectIncludes("lib/seo.ts", "width: 1200", "shared metadata declares Open Graph image width");
expectIncludes("lib/seo.ts", "height: 630", "shared metadata declares Open Graph image height");
expectIncludes("lib/seo.ts", "alt: input.title || DEFAULT_TITLE", "shared metadata declares image alt text");
expectIncludes("app/[locale]/[slug]/shop/product/[productId]/layout.tsx", "product.image || product.organization.coverImage || product.organization.logo", "product detail share image falls back to cover image");
expectIncludes("app/[locale]/[slug]/appointment/services/[serviceId]/layout.tsx", "service.image || service.organization.coverImage || service.organization.logo", "service detail share image falls back to cover image");
expectIncludes("app/[locale]/[slug]/shop/category/[categoryId]/page.tsx", "product.image || category.image || category.organization.coverImage || category.organization.logo", "shop category item JSON-LD uses cover-image fallback");
expectIncludes("app/[locale]/[slug]/appointment/services/category/[categoryId]/page.tsx", "service.image || category.image || category.organization.coverImage || category.organization.logo", "service category item JSON-LD uses cover-image fallback");

const packageJson = JSON.parse(read("package.json"));
add(
  "package.json exposes quality:public-slug-preview-share",
  packageJson.scripts?.["quality:public-slug-preview-share"] === "node scripts/quality/validate-public-slug-preview-share.mjs",
);

console.table(results);
const failed = results.filter((result) => !result.ok);
if (failed.length) {
  console.error(`P55 public slug preview/share validation failed with ${failed.length} issue(s).`);
  process.exit(1);
}

console.log("P55 public slug preview/share validation passed.");
