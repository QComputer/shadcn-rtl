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

const metadataRoutes = [
  "app/[locale]/shop/[slug]/layout.tsx",
  "app/[locale]/appointment/[slug]/layout.tsx",
  "app/[locale]/shop/[slug]/category/[categoryId]/page.tsx",
  "app/[locale]/appointment/[slug]/services/category/[categoryId]/page.tsx",
  "app/[locale]/shop/[slug]/product/[productId]/layout.tsx",
  "app/[locale]/appointment/[slug]/services/[serviceId]/layout.tsx",
];

for (const rel of [
  "app/og-image/route.tsx",
  "proxy.ts",
  "lib/seo.ts",
  "docs/PHASE_56_TENANT_OG_IMAGES.md",
  "docs/PHASE_56_OVERLAY_MANIFEST.md",
  ...metadataRoutes,
]) {
  expectFile(rel);
}

expectIncludes("app/og-image/route.tsx", "new URL(request.url)", "generated OG route reads request query params");
expectIncludes("app/og-image/route.tsx", "kindLabels", "generated OG route supports typed card labels");
expectIncludes("app/og-image/route.tsx", "kindColors", "generated OG route supports kind-specific palettes");
expectIncludes("app/og-image/route.tsx", "searchParams.get(key)", "generated OG route sanitizes query params");
expectIncludes("app/og-image/route.tsx", "1200", "generated OG route keeps Open Graph width");
expectIncludes("app/og-image/route.tsx", "630", "generated OG route keeps Open Graph height");
expectIncludes("proxy.ts", 'pathname.startsWith("/og-image")', "proxy leaves generated OG image route unlocalized");

expectIncludes("lib/seo.ts", "GeneratedOgImageKind", "SEO helper defines generated OG image kinds");
expectIncludes("lib/seo.ts", "buildGeneratedOgImagePath", "SEO helper builds deterministic generated OG paths");
expectIncludes("lib/seo.ts", "getUploadedOrGeneratedSeoImageUrl", "SEO helper preserves uploaded image precedence");
expectIncludes("lib/seo.ts", "isDurableSeoImage", "SEO helper filters non-durable uploaded image paths");
expectIncludes("lib/seo.ts", "!value.startsWith(\"/uploads/\")", "legacy local uploads are not used as durable SEO images");
expectIncludes("lib/seo.ts", "isDurableSeoImage(uploadedImage)", "durable uploaded images remain first priority");
expectIncludes("lib/seo.ts", "DEFAULT_IMAGE}?${params.toString()}", "generated OG image URLs are query based and cacheable");
expectIncludes("lib/seo.ts", "getSupportedLocale(input.locale)", "generated OG image helper normalizes locales");

for (const rel of metadataRoutes) {
  expectIncludes(rel, "getUploadedOrGeneratedSeoImageUrl", `${rel} uses generated OG fallback helper`);
}

expectIncludes("app/[locale]/shop/[slug]/layout.tsx", "organization.coverImage || organization.logo", "shop organization uploaded image precedence is preserved");
expectIncludes("app/[locale]/appointment/[slug]/layout.tsx", "organization.coverImage || organization.logo", "appointment organization uploaded image precedence is preserved");
expectIncludes("app/[locale]/shop/[slug]/category/[categoryId]/page.tsx", "category.image || category.organization.coverImage || category.organization.logo", "shop category uploaded image precedence is preserved");
expectIncludes("app/[locale]/appointment/[slug]/services/category/[categoryId]/page.tsx", "category.image || category.organization.coverImage || category.organization.logo", "service category uploaded image precedence is preserved");
expectIncludes("app/[locale]/shop/[slug]/product/[productId]/layout.tsx", "product.image || product.organization.coverImage || product.organization.logo", "product uploaded image precedence is preserved");
expectIncludes("app/[locale]/appointment/[slug]/services/[serviceId]/layout.tsx", "service.image || service.organization.coverImage || service.organization.logo", "service uploaded image precedence is preserved");

for (const kind of ["organization", "category", "product", "service"]) {
  const source = metadataRoutes.map((rel) => read(rel)).join("\n");
  add(`metadata uses ${kind} generated OG kind`, source.includes(`kind: "${kind}"`), kind);
}

const packageJson = JSON.parse(read("package.json"));
add(
  "package.json exposes quality:tenant-og-images",
  packageJson.scripts?.["quality:tenant-og-images"] === "node scripts/quality/validate-tenant-og-images.mjs",
);

console.table(results);
const failed = results.filter((result) => !result.ok);
if (failed.length) {
  console.error(`P56 tenant OG image validation failed with ${failed.length} issue(s).`);
  process.exit(1);
}

console.log("P56 tenant OG image validation passed.");
