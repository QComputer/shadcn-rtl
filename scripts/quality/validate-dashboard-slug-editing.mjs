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

const categoryPages = [
  "app/[locale]/dashboard/product-categories/page.tsx",
  "app/[locale]/dashboard/service-categories/page.tsx",
];

const detailPages = [
  "app/[locale]/dashboard/products/new/page.tsx",
  "app/[locale]/dashboard/products/[id]/page.tsx",
  "app/[locale]/dashboard/services/new/page.tsx",
  "app/[locale]/dashboard/services/[id]/page.tsx",
];

for (const rel of [
  ...categoryPages,
  ...detailPages,
  "docs/PHASE_54_DASHBOARD_SLUG_EDITING_UI.md",
  "docs/PHASE_54_OVERLAY_MANIFEST.md",
]) {
  expectFile(rel);
}

for (const rel of categoryPages) {
  expectIncludes(rel, "slug: string | null", `${rel} models category slug`);
  expectIncludes(rel, "slug: formData.slug.trim() || undefined", `${rel} sends optional slug payload`);
  expectIncludes(rel, "/{category.slug}", `${rel} displays saved slug`);
  expectIncludes(rel, "Saved slugs are normalized and kept unique.", `${rel} explains slug normalization`);
}

for (const rel of detailPages) {
  expectIncludes(rel, "const [slug, setSlug] = useState(\"\")", `${rel} tracks slug state`);
  expectIncludes(rel, "slug: slug.trim() || undefined", `${rel} sends optional slug payload`);
  expectIncludes(rel, "dir=\"ltr\"", `${rel} renders slug input left-to-right`);
  expectIncludes(rel, "Saved slugs are normalized and kept unique.", `${rel} explains slug normalization`);
}

expectIncludes("lib/services/category.service.ts", "normalizeCategorySlug(data.slug)", "category services normalize manual slugs");
expectIncludes("lib/services/product.service.ts", "normalizeDetailSlug(data.slug, \"product\")", "product service normalizes manual slugs");
expectIncludes("lib/services/service.service.ts", "normalizeDetailSlug(data.slug, \"service\")", "service service normalizes manual slugs");

const packageJson = JSON.parse(read("package.json"));
add(
  "package.json exposes quality:dashboard-slug-editing",
  packageJson.scripts?.["quality:dashboard-slug-editing"] === "node scripts/quality/validate-dashboard-slug-editing.mjs",
);

console.table(results);
const failed = results.filter((result) => !result.ok);
if (failed.length) {
  console.error(`P54 dashboard slug editing validation failed with ${failed.length} issue(s).`);
  process.exit(1);
}

console.log("P54 dashboard slug editing validation passed.");
