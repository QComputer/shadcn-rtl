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
  "lib/category-slugs.ts",
  "lib/shop-public-paths.ts",
  "prisma/migrations/20260627000100_category_slugs/migration.sql",
  "docs/PHASE_51_CATEGORY_SLUGS_PAGINATION.md",
  "docs/PHASE_51_OVERLAY_MANIFEST.md",
  ...categoryPages,
]) {
  expectFile(rel);
}

add(
  "category models include nullable slug fields",
  /model\s+ProductCategory\s*{[^}]*\bslug\s+String\?/.test(read("prisma/schema.prisma")) &&
    /model\s+ServiceCategory\s*{[^}]*\bslug\s+String\?/.test(read("prisma/schema.prisma")),
  "slug String?",
);
expectIncludes("prisma/schema.prisma", "@@index([organizationId, slug])", "category slug indexes are declared");
expectIncludes("lib/category-slugs.ts", "normalizeCategorySlug", "shared slug normalizer exists");
expectIncludes("lib/category-slugs.ts", "buildUniqueCategorySlug", "shared slug uniqueness helper exists");
expectIncludes("lib/shop-public-paths.ts", "buildShopCategoryPath", "shared shop category path builder exists");
expectIncludes("lib/shop-public-paths.ts", "?page=${input.page}", "shared shop category path builder preserves page query");
expectIncludes("lib/services/category.service.ts", "buildUniqueSlug", "category service generates unique slugs");
expectIncludes("lib/services/category.service.ts", "revalidateCategoryPublicPages", "category service revalidates public category paths");

for (const rel of categoryPages) {
  expectIncludes(rel, "OR: [{ id: categoryId }, { slug: categoryId }]", `${rel} resolves category by id or slug`);
  expectIncludes(rel, "redirect(categoryPath", `${rel} redirects legacy id URLs to slug URLs`);
  expectIncludes(rel, "CATEGORY_PAGE_SIZE = 24", `${rel} caps public category page size`);
  expectIncludes(rel, "normalizePagination", `${rel} normalizes page query`);
  expectIncludes(rel, "rel=\"prev\"", `${rel} renders previous pagination link`);
  expectIncludes(rel, "rel=\"next\"", `${rel} renders next pagination link`);
  add(
    `${rel} uses query-string pagination for page 2+`,
    read(rel).includes("?page=${page}") ||
      (rel.includes("/shop/") && read(rel).includes("buildShopCategoryPath")) ||
      (rel.includes("/appointment/") && read(rel).includes("?page=${page}")),
    "?page=${page}",
  );
}

expectIncludes(
  "app/[locale]/shop/[slug]/page.tsx",
  "category.slug || category.id",
  "shop listing prefers category slug with id fallback",
);
expectIncludes(
  "app/[locale]/appointment/[slug]/services/page.tsx",
  "category.slug || category.id",
  "appointment services listing prefers category slug with id fallback",
);
expectIncludes("app/sitemap.ts", "category.slug || category.id", "sitemap prefers category slugs with id fallback");

const packageJson = JSON.parse(read("package.json"));
add(
  "package.json exposes quality:public-category-slugs-pagination",
  packageJson.scripts?.["quality:public-category-slugs-pagination"] ===
    "node scripts/quality/validate-public-category-slugs-pagination.mjs",
);

console.table(results);
const failed = results.filter((result) => !result.ok);
if (failed.length) {
  console.error(`P51 public category slug/pagination validation failed with ${failed.length} issue(s).`);
  process.exit(1);
}

console.log("P51 public category slug/pagination validation passed.");
