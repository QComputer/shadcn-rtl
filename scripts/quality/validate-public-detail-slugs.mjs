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

for (const rel of [
  "lib/detail-slugs.ts",
  "prisma/migrations/20260627000200_product_service_slugs/migration.sql",
  "docs/PHASE_52_PUBLIC_DETAIL_SLUGS.md",
  "docs/PHASE_52_OVERLAY_MANIFEST.md",
  "app/[locale]/shop/[slug]/product/[productId]/layout.tsx",
  "app/[locale]/appointment/[slug]/services/[serviceId]/layout.tsx",
]) {
  expectFile(rel);
}

expectIncludes("prisma/schema.prisma", "slug        String?", "product and service models include nullable slug fields");
expectIncludes("prisma/schema.prisma", "@@index([organizationId, slug])", "organization/id slug indexes are declared");
expectIncludes("prisma/schema.prisma", "@@index([organizationSlug, slug])", "product organizationSlug slug index is declared");
expectIncludes("lib/detail-slugs.ts", "normalizeDetailSlug", "shared detail slug normalizer exists");
expectIncludes("lib/detail-slugs.ts", "buildUniqueDetailSlug", "shared detail slug uniqueness helper exists");
expectIncludes("lib/services/product.service.ts", "buildUniqueSlug", "product service generates unique slugs");
expectIncludes("lib/services/service.service.ts", "buildUniqueSlug", "service service generates unique slugs");

expectIncludes("app/api/public/products/[id]/route.ts", "OR: [{ id }, { slug: id }]", "public product API resolves id or slug");
expectIncludes(
  "app/api/public/organizations/[slug]/services/[serviceId]/route.ts",
  "OR: [{ id: serviceId }, { slug: serviceId }]",
  "public service API resolves id or slug",
);
expectIncludes("app/[locale]/shop/[slug]/product/[productId]/layout.tsx", "redirect(`/${locale}/shop/${slug}/product/${product.slug}`", "product detail redirects id URL to slug URL");
expectIncludes(
  "app/[locale]/appointment/[slug]/services/[serviceId]/layout.tsx",
  "redirect(`/${locale}/appointment/${slug}/services/${service.slug}`",
  "service detail redirects id URL to slug URL",
);

for (const [rel, needle, label] of [
  ["app/[locale]/shop/[slug]/page.tsx", "product.slug || product.id", "shop cards prefer product slugs"],
  ["app/[locale]/shop/[slug]/category/[categoryId]/page.tsx", "product.slug || product.id", "shop category cards and JSON-LD prefer product slugs"],
  ["app/[locale]/appointment/[slug]/page.tsx", "service.slug || service.id", "appointment landing service cards prefer service slugs"],
  ["app/[locale]/appointment/[slug]/services/page.tsx", "service.slug || service.id", "appointment services cards prefer service slugs"],
  ["app/[locale]/appointment/[slug]/services/category/[categoryId]/page.tsx", "service.slug || service.id", "service category cards and JSON-LD prefer service slugs"],
  ["app/api/public/search/route.ts", "product.slug || product.id", "public search product hrefs prefer slugs"],
  ["app/api/public/search/route.ts", "service.slug || service.id", "public search service hrefs prefer slugs"],
  ["app/sitemap.ts", "product.slug || product.id", "sitemap product detail routes prefer slugs"],
  ["app/sitemap.ts", "service.slug || service.id", "sitemap service detail routes prefer slugs"],
]) {
  expectIncludes(rel, needle, label);
}

const packageJson = JSON.parse(read("package.json"));
add(
  "package.json exposes quality:public-detail-slugs",
  packageJson.scripts?.["quality:public-detail-slugs"] === "node scripts/quality/validate-public-detail-slugs.mjs",
);

console.table(results);
const failed = results.filter((result) => !result.ok);
if (failed.length) {
  console.error(`P52 public detail slug validation failed with ${failed.length} issue(s).`);
  process.exit(1);
}

console.log("P52 public detail slug validation passed.");
