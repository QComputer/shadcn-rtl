import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const baseUrl = process.env.RETAIL_R2_BASE_URL ?? "http://127.0.0.1:3101";
const output = path.resolve(process.env.RETAIL_R2_SCREENSHOT_DIR ?? "artifacts/retail-r2-browser");
const fashion = "retail-r2-fashion-preview";
const mobile = "retail-r2-mobile-preview";
await fs.mkdir(output, { recursive: true });

const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const context = await browser.newContext({ locale: "fa-IR", timezoneId: "Asia/Tehran" });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));

  const catalogResponse = await page.request.get(`${baseUrl}/api/public/v1/organizations/${fashion}/catalog`);
  assert.equal(catalogResponse.status(), 200, "fashion catalog is publicly readable");
  const catalog = await catalogResponse.json();
  assert.equal(catalog.version, "v1");
  assert.equal(catalog.data.organization.theme, "FASHION");
  assert.equal(catalog.data.organization.previewOnly, true);
  const product = catalog.data.products.find((item) => item.slug === "avid-preview");
  assert.ok(product, "fashion product is present in persisted catalog");
  assert.equal(product.media.gallery.length, 0, "foreign/private gallery items are filtered");

  const filteredResponse = await page.request.get(`${baseUrl}/api/public/v1/organizations/${mobile}/products?filter=ram%3A12`);
  assert.equal(filteredResponse.status(), 200);
  const filtered = await filteredResponse.json();
  assert.deepEqual(filtered.data.products.map((item) => item.slug), ["nova-x-preview"], "mobile catalog uses the same structured attribute filter");
  const foreignResponse = await page.request.get(`${baseUrl}/api/public/v1/organizations/${mobile}/products/avid-preview`);
  assert.equal(foreignResponse.status(), 404, "tenant cannot read the fashion product");
  const restaurantResponse = await page.request.get(`${baseUrl}/api/public/v1/organizations/retail-r2-restaurant-compat/catalog`);
  assert.equal(restaurantResponse.status(), 404, "restaurant-only capability does not enable retail catalog");

  for (const width of [360, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const response = await page.goto(`${baseUrl}/fa/retail/${fashion}`, { waitUntil: "domcontentloaded" });
    assert.equal(response?.status(), 200, `fashion storefront renders at ${width}px`);
    await page.getByRole("heading", { name: "محصولات فروشگاه" }).waitFor();
    await page.getByRole("heading", { level: 2, name: "کتانی نمونه آوید" }).waitFor();
    const shoeCard = page.locator("article").filter({ hasText: "کتانی نمونه آوید" });
    if (await shoeCard.locator("select").count()) assert.equal(await shoeCard.locator("select").inputValue(), product.variants.find((variant) => variant.orderable)?.id, "storefront initially selects an orderable shoe variant");
    const dimensions = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }));
    assert.ok(dimensions.document <= dimensions.viewport + 1, `no horizontal overflow at ${width}px: ${JSON.stringify(dimensions)}`);
    if (width === 390 || width === 1440) await page.screenshot({ path: path.join(output, `fashion-${width}.png`), fullPage: true });
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${baseUrl}/fa/retail/${fashion}/product/avid-preview`, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { level: 1, name: "کتانی نمونه آوید" }).waitFor();
  assert.equal(await page.locator("#products").count(), 0, "product detail is a separate page from the catalog list");
  assert.equal(await page.getByRole("button", { name: /ثبت سفارش آنلاین/ }).isDisabled(), true, "retail checkout remains disabled");
  await page.screenshot({ path: path.join(output, "fashion-product-390.png"), fullPage: true });

  await page.goto(`${baseUrl}/fa/retail/${mobile}`, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "دستگاه‌ها و مشخصات" }).waitFor();
  await page.getByRole("heading", { level: 2, name: "موبایل نمونه Nova X" }).waitFor();
  await page.screenshot({ path: path.join(output, "electronics-390.png"), fullPage: true });
  await page.goto(`${baseUrl}/fa/retail/${mobile}/product/nova-x-preview`, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { level: 1, name: "موبایل نمونه Nova X" }).waitFor();
  assert.equal(await page.locator("#products").count(), 0, "electronics detail is a separate page from the catalog list");
  const electronicsDetail = await page.locator("main").innerText();
  assert.match(electronicsDetail, /گارانتی/);
  assert.match(electronicsDetail, /حافظه داخلی/);
  assert.doesNotMatch(electronicsDetail, /IMEI|شماره سریال/i);
  await page.screenshot({ path: path.join(output, "electronics-product-390.png"), fullPage: true });
  assert.deepEqual(errors, [], "browser has no uncaught page errors");
  process.stdout.write(JSON.stringify({ status: "PASS", browser: "Chrome", viewports: [360, 390, 768, 1024, 1440], api: ["catalog", "structured filter", "foreign tenant 404", "capability 404"], screenshots: await fs.readdir(output) }, null, 2) + "\n");
} finally {
  await browser.close();
}
