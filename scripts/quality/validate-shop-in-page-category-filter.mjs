#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const checks = [];

function addCheck(name, ok, detail = "") {
  checks.push({ name, ok, detail });
}

function read(path) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

function has(path) {
  return existsSync(resolve(process.cwd(), path));
}

const shopPagePath = "app/[locale]/[slug]/shop/page.tsx";
const categoryPagePath = "app/[locale]/[slug]/shop/category/[categoryId]/page.tsx";
const filterPath = "lib/shop-menu-filter.ts";
const pathsPath = "lib/shop-public-paths.ts";
const unitTestPath = "tests/unit/shop-menu-filter.test.ts";
const e2ePath = "scripts/e2e/shop-local-docker-in-page-category-filter.mjs";
const docsPath = "docs/shop/SHOP_IN_PAGE_CATEGORY_FILTER.md";
const packagePath = "package.json";

for (const path of [shopPagePath, categoryPagePath, filterPath, pathsPath, unitTestPath, e2ePath, docsPath, packagePath]) {
  addCheck(`${path} exists`, has(path));
}

if (has(shopPagePath)) {
  const shopPage = read(shopPagePath);
  const categoryBlock = shopPage.slice(shopPage.indexOf("{/* Categories */}"), shopPage.indexOf("{/* Products */}"));
  addCheck("shop menu uses selectedCategoryId client state", shopPage.includes("selectedCategoryId") && shopPage.includes("setSelectedCategoryId"));
  addCheck("normal category controls are buttons", categoryBlock.includes("<button") && categoryBlock.includes("type=\"button\""));
  addCheck("category controls are not category navigation links", !categoryBlock.includes("<Link") && !categoryBlock.includes("href={categoryHref"));
  addCheck("category controls do not call router.push", !shopPage.includes("router.push") && !shopPage.includes("useRouter"));
  addCheck("all-products control exists", categoryBlock.includes("shop.allProducts") && categoryBlock.includes("setSelectedCategoryId(null)"));
  addCheck("active state is accessible", categoryBlock.includes("aria-pressed={selectedCategoryId === null}") && categoryBlock.includes("aria-pressed={selectedCategoryId === category.id}"));
  addCheck("mobile overflow category bar exists", categoryBlock.includes("overflow-x-auto") && categoryBlock.includes("w-max"));
  addCheck("search and category filters combine through helper", shopPage.includes("getVisibleShopMenuProducts(data.categories, { selectedCategoryId, searchQuery })"));
  addCheck("product links still use productHref", shopPage.includes("href={productHref(product)}"));
  addCheck("cart context remains in shop page", shopPage.includes("useCart()") && shopPage.includes("addToCart"));
}

if (has(filterPath)) {
  const filter = read(filterPath);
  addCheck("filter helper uses stable category IDs", filter.includes("selectedCategoryId") && filter.includes("product.categoryId === input.selectedCategoryId"));
  addCheck("filter helper preserves availability policy", filter.includes("trackInventory") && filter.includes("getShopMenuProductInventory"));
  addCheck("filter helper preserves ordering", filter.includes("sort((a, b) => b.sortOrder - a.sortOrder)"));
  addCheck("filter helper supports empty category result", filter.includes("return products.sort"));
}

if (has(categoryPagePath)) {
  const categoryPage = read(categoryPagePath);
  addCheck("direct category compatibility page remains", categoryPage.includes("ShopCategoryPage") && categoryPage.includes("getShopCategory"));
  addCheck("invalid direct category remains safe 404", categoryPage.includes("if (!category) notFound()"));
  addCheck("encoded Persian direct slug support remains", categoryPage.includes("decodePublicRouteSegment(categoryId)"));
  addCheck("custom-domain category helper remains reused", categoryPage.includes("buildShopCategoryPath"));
}

if (has(pathsPath)) {
  const paths = read(pathsPath);
  addCheck("custom-domain root path helper remains", paths.includes("buildShopPublicPath") && paths.includes("isCustomDomain"));
  addCheck("encoded route decoder remains safe", paths.includes("decodeURIComponent") && paths.includes("catch"));
}

if (has(unitTestPath)) {
  const unit = read(unitTestPath);
  for (const phrase of [
    "initial state displays all visible products",
    "clicking a category filters in place",
    "all-products state restores",
    "Persian category labels work",
    "Arabic product/category labels work",
    "English labels work",
    "category with no products",
    "search and category filters combine",
    "filtering is pure and preserves cart",
    "product ordering is preserved",
    "uncategorized products are absent",
    "hidden products remain hidden",
    "tenant-scoped source data",
    "product links remain functional",
    "direct category compatibility path remains",
    "encoded Persian legacy category slugs",
  ]) {
    addCheck(`unit test covers: ${phrase}`, unit.includes(phrase));
  }
}

if (has(e2ePath)) {
  const e2e = read(e2ePath);
  addCheck("Docker E2E uses disposable Postgres", e2e.includes("postgres:16-alpine") && e2e.includes("docker"));
  addCheck("Docker E2E runs migrations", e2e.includes("prisma") && e2e.includes("migrate") && e2e.includes("deploy"));
  addCheck("Docker E2E verifies path does not change", e2e.includes("pathname stays unchanged") || e2e.includes("initialPathname"));
  addCheck("Docker E2E verifies no category request on normal click", e2e.includes("categoryRequests"));
  addCheck("Docker E2E verifies custom-domain host", e2e.includes("cafechakme.lvh.me") && e2e.includes(`http://\${customHost}:\${appPort}/`));
}

for (const locale of ["fa", "en", "ar"]) {
  const dictionaryPath = `dictionaries/${locale}.json`;
  if (has(dictionaryPath)) {
    const dictionary = JSON.parse(read(dictionaryPath));
    addCheck(`${locale} all-products localization exists`, typeof dictionary.shop?.allProducts === "string" && dictionary.shop.allProducts.length > 0);
    addCheck(`${locale} empty-state localization exists`, typeof dictionary.shop?.noMatchingProducts === "string" && typeof dictionary.shop?.adjustFilters === "string");
  }
}

if (has(packagePath)) {
  const scripts = JSON.parse(read(packagePath)).scripts || {};
  addCheck("package has unit test script", scripts["test:shop:in-page-category-filter"] === "npx tsx --require=./scripts/e2e/register-server-only.cjs --test tests/unit/shop-menu-filter.test.ts");
  addCheck("package has quality script", scripts["quality:shop:in-page-category-filter"] === "node scripts/quality/validate-shop-in-page-category-filter.mjs");
  addCheck("package has Docker E2E script", scripts["e2e:shop:local-docker-in-page-category-filter"] === "node scripts/e2e/shop-local-docker-in-page-category-filter-runner.mjs");
}

const migrations = readdirSync(resolve(process.cwd(), "prisma", "migrations"), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);
addCheck("no shop in-page category filter migration added", !migrations.some((name) => /in_page_category_filter|category_filter/i.test(name)));

const failed = checks.filter((check) => !check.ok);

if (failed.length) {
  console.error("Shop in-page category filter validation failed:");
  for (const check of failed) {
    console.error(`- ${check.name}${check.detail ? `: ${check.detail}` : ""}`);
  }
  process.exit(1);
}

console.log("Shop in-page category filter validation passed.");
