import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeRetailSearch, isSyntheticRetailLabel } from "../../lib/retail/discovery";
import { publicCatalogListQuerySchema } from "../../lib/public-catalog/contracts";

test("Persian search normalizes letters, digits, marks and separators without changing stored identities", () => {
  assert.equal(normalizeRetailSearch("  كِفش‌ ياسي ۴۰ / NIKE ٤١ "), "کفش یاسی 40 nike 41");
  assert.equal(normalizeRetailSearch("آدیداس پاییزه‌زمستانه"), normalizeRetailSearch("آدیداس پاییزه زمستانه"));
});
test("Discovery query validates bounded filters, private saved mode and price ranges", () => {
  assert.equal(publicCatalogListQuerySchema.parse({ available: "true", saved: "1", sort: "relevance" }).available, true);
  assert.equal(publicCatalogListQuerySchema.safeParse({ minPrice: 20, maxPrice: 10 }).success, false);
  assert.equal(publicCatalogListQuerySchema.safeParse({ filter: Array(13).fill("color:red") }).success, false);
  assert.equal(publicCatalogListQuerySchema.safeParse({ favoriteId: "untrusted" }).success, false);
});
test("Synthetic labels are excluded from merchandise recommendations without changing publication", () => {
  assert.equal(isSyntheticRetailLabel("کفش آزمایشی", "p0-qa-shoe"), true);
  assert.equal(isSyntheticRetailLabel("Adidas", "kids-adidas-100"), false);
});
