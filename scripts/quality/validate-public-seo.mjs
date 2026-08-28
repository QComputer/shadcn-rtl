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

const requiredFiles = [
  "lib/seo.ts",
  "components/seo/json-ld.tsx",
  "app/robots.ts",
  "app/sitemap.ts",
  "app/[locale]/[slug]/shop/layout.tsx",
  "app/[locale]/[slug]/appointment/layout.tsx",
  "app/[locale]/[slug]/shop/product/[productId]/layout.tsx",
  "app/[locale]/[slug]/appointment/services/[serviceId]/layout.tsx",
  "docs/PHASE_48_PUBLIC_SEO_FOUNDATION.md",
  "docs/PHASE_48_OVERLAY_MANIFEST.md",
];

for (const rel of requiredFiles) {
  expectFile(rel);
}

for (const rel of ["public/robots.txt", "public/sitemap.xml", "public/sitemap-0.xml"]) {
  add(`${rel} is replaced by metadata route`, !exists(rel), rel);
}

expectIncludes("lib/seo.ts", "buildPublicMetadata", "shared metadata builder exists");
expectIncludes("lib/seo.ts", "buildLocaleAlternates", "locale alternate builder exists");
expectIncludes("lib/seo.ts", "buildOrganizationJsonLd", "organization JSON-LD builder exists");
expectIncludes("components/seo/json-ld.tsx", "application/ld+json", "JSON-LD component emits application/ld+json");

for (const needle of ['"/api/"', '"/auth/"', '"/dashboard/"', '"/fa/dashboard/"', '"/en/dashboard/"', '"/ar/dashboard/"']) {
  expectIncludes("app/robots.ts", needle, `robots blocks private app surface ${needle}`);
}
expectIncludes("app/robots.ts", 'sitemap: getCanonicalUrl("/sitemap.xml")', "robots points at dynamic sitemap");

expectIncludes("app/sitemap.ts", "buildOrganizationRootPath", "sitemap includes organization roots through the shared route builder");
expectIncludes("app/sitemap.ts", "buildOrganizationPublicPath", "sitemap includes capability children through the shared route builder");
for (const needle of ['surface: "shop"', 'surface: "appointment"', 'subPath: "/profile"', 'subPath: "/services"']) {
  expectIncludes("app/sitemap.ts", needle, `sitemap includes ${needle}`);
}

for (const rel of [
  "app/[locale]/[slug]/shop/layout.tsx",
  "app/[locale]/[slug]/appointment/layout.tsx",
  "app/[locale]/[slug]/shop/product/[productId]/layout.tsx",
  "app/[locale]/[slug]/appointment/services/[serviceId]/layout.tsx",
  "app/[locale]/[slug]/shop/fanpage/page.tsx",
  "app/[locale]/[slug]/appointment/fanpage/page.tsx",
]) {
  expectIncludes(rel, "generateMetadata", `${rel} exports route metadata`);
  expectIncludes(rel, "buildPublicMetadata", `${rel} uses shared metadata builder`);
}

for (const rel of [
  "app/[locale]/[slug]/shop/layout.tsx",
  "app/[locale]/[slug]/appointment/layout.tsx",
  "app/[locale]/[slug]/shop/product/[productId]/layout.tsx",
  "app/[locale]/[slug]/appointment/services/[serviceId]/layout.tsx",
  "app/[locale]/[slug]/shop/fanpage/page.tsx",
  "app/[locale]/[slug]/appointment/fanpage/page.tsx",
]) {
  expectIncludes(rel, "<JsonLd", `${rel} renders JSON-LD`);
}

const packageJson = JSON.parse(read("package.json"));
add(
  "package.json exposes quality:public-seo",
  packageJson.scripts?.["quality:public-seo"] === "node scripts/quality/validate-public-seo.mjs",
);

console.table(results);
const failed = results.filter((result) => !result.ok);
if (failed.length) {
  console.error(`P48 public SEO validation failed with ${failed.length} issue(s).`);
  process.exit(1);
}

console.log("P48 public SEO validation passed.");
