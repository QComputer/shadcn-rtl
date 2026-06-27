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

const noIndexLayouts = [
  "app/[locale]/shop/[slug]/checkout/layout.tsx",
  "app/[locale]/shop/[slug]/order/[orderNumber]/layout.tsx",
  "app/[locale]/appointment/[slug]/booking/layout.tsx",
  "app/[locale]/appointment/[slug]/my-appointments/layout.tsx",
  "app/[locale]/appointment/[slug]/appointment/[id]/layout.tsx",
];

for (const rel of [
  "app/og-image/route.tsx",
  "docs/PHASE_49_PUBLIC_SEO_QA_RICH_PREVIEW.md",
  "docs/PHASE_49_OVERLAY_MANIFEST.md",
  ...noIndexLayouts,
]) {
  expectFile(rel);
}

expectIncludes("app/og-image/route.tsx", "ImageResponse", "default rich preview image uses Next ImageResponse");
expectIncludes("app/og-image/route.tsx", "1200", "default rich preview width is 1200");
expectIncludes("app/og-image/route.tsx", "630", "default rich preview height is 630");
add(
  "default rich preview is served by a route handler",
  /export\s+(async\s+)?function\s+GET/.test(read("app/og-image/route.tsx")),
  "export function GET or export async function GET",
);

expectIncludes("lib/seo.ts", "const DEFAULT_IMAGE = \"/og-image\"", "SEO fallback image points to generated OG image");
expectIncludes("lib/seo.ts", "buildNoIndexMetadata", "shared noindex metadata helper exists");
expectIncludes("lib/seo.ts", "index: false", "noindex helper blocks indexing");
expectIncludes("lib/seo.ts", "follow: false", "noindex helper blocks following");
expectIncludes("app/[locale]/layout.tsx", 'url: getCanonicalUrl("/og-image")', "base Open Graph image uses generated route");
expectIncludes("app/[locale]/layout.tsx", 'images: [getCanonicalUrl("/og-image")]', "base Twitter image uses generated route");

for (const rel of noIndexLayouts) {
  expectIncludes(rel, "buildNoIndexMetadata", `${rel} uses shared noindex helper`);
  expectIncludes(rel, "export const metadata", `${rel} exports metadata`);
}

for (const needle of [
  "`/${locale}/shop/*/checkout`",
  "`/${locale}/shop/*/order/*`",
  "`/${locale}/appointment/*/booking`",
  "`/${locale}/appointment/*/my-appointments`",
  "`/${locale}/appointment/*/appointment/*`",
]) {
  expectIncludes("app/robots.ts", needle, `robots disallows ${needle}`);
}

for (const rel of [
  "app/[locale]/shop/[slug]/checkout/page.tsx",
  "app/[locale]/shop/[slug]/order/[orderNumber]/page.tsx",
  "app/[locale]/appointment/[slug]/booking/page.tsx",
  "app/[locale]/appointment/[slug]/my-appointments/page.tsx",
  "app/[locale]/appointment/[slug]/appointment/[id]/page.tsx",
]) {
  expectFile(rel);
}

const packageJson = JSON.parse(read("package.json"));
add(
  "package.json exposes quality:public-seo-qa",
  packageJson.scripts?.["quality:public-seo-qa"] === "node scripts/quality/validate-public-seo-qa.mjs",
);

console.table(results);
const failed = results.filter((result) => !result.ok);
if (failed.length) {
  console.error(`P49 public SEO QA validation failed with ${failed.length} issue(s).`);
  process.exit(1);
}

console.log("P49 public SEO QA validation passed.");
