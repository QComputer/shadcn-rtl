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

function expectIncludes(rel, needle, label = `${rel} includes ${needle}`) {
  if (!exists(rel)) {
    add(label, false, `${rel} is missing`);
    return;
  }
  add(label, read(rel).includes(needle), needle);
}

const categoryPages = [
  "app/[locale]/shop/[slug]/category/[categoryId]/page.tsx",
  "app/[locale]/appointment/[slug]/services/category/[categoryId]/page.tsx",
];

for (const rel of [
  ...categoryPages,
  "docs/PHASE_50_PUBLIC_CATEGORY_SEO.md",
  "docs/PHASE_50_OVERLAY_MANIFEST.md",
]) {
  expectFile(rel);
}

for (const rel of categoryPages) {
  expectIncludes(rel, "generateMetadata", `${rel} exports route metadata`);
  expectIncludes(rel, "buildPublicMetadata", `${rel} uses shared public metadata builder`);
  expectIncludes(rel, "<JsonLd", `${rel} renders JSON-LD`);
  expectIncludes(rel, '"@type": "CollectionPage"', `${rel} emits CollectionPage JSON-LD`);
  expectIncludes(rel, '"@type": "ItemList"', `${rel} emits ItemList JSON-LD`);
  expectIncludes(rel, "buildBreadcrumbJsonLd", `${rel} emits breadcrumb JSON-LD`);
}

expectIncludes(
  "app/[locale]/shop/[slug]/page.tsx",
  "/shop/${slug}/category/${category.slug || category.id}",
  "shop listing links to product category pages",
);
expectIncludes(
  "app/[locale]/appointment/[slug]/services/page.tsx",
  "/appointment/${slug}/services/category/${category.slug || category.id}",
  "appointment services listing links to service category pages",
);

expectIncludes("app/sitemap.ts", "productCategory.findMany", "sitemap queries product categories");
expectIncludes("app/sitemap.ts", "serviceCategory.findMany", "sitemap queries service categories");
expectIncludes(
  "app/sitemap.ts",
  "/shop/${category.organizationSlug}/category/${category.slug || category.id}",
  "sitemap includes product category routes",
);
expectIncludes(
  "app/sitemap.ts",
  "/appointment/${category.organization.slug}/services/category/${category.slug || category.id}",
  "sitemap includes service category routes",
);

const packageJson = JSON.parse(read("package.json"));
add(
  "package.json exposes quality:public-category-seo",
  packageJson.scripts?.["quality:public-category-seo"] === "node scripts/quality/validate-public-category-seo.mjs",
);

console.table(results);
const failed = results.filter((result) => !result.ok);
if (failed.length) {
  console.error(`P50 public category SEO validation failed with ${failed.length} issue(s).`);
  process.exit(1);
}

console.log("P50 public category SEO validation passed.");
