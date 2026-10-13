import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const playwrightEntry = process.env.RETAIL_R3_PLAYWRIGHT_ENTRY;
if (!playwrightEntry) throw new Error("RETAIL_R3_PLAYWRIGHT_ENTRY must point at the local Playwright entry point.");
const { chromium } = await import(pathToFileURL(playwrightEntry).href);

const baseUrl = process.env.RETAIL_R3_BASE_URL || "http://127.0.0.1:3102";
const password = process.env.RETAIL_R3_TEST_PASSWORD;
if (!password) throw new Error("RETAIL_R3_TEST_PASSWORD is required for local browser acceptance.");
const evidenceDir = path.resolve("artifacts/retail-r3-browser");
const imagePath = path.join(evidenceDir, "synthetic-preview.png");
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j2ioAAAAASUVORK5CYII=", "base64");

async function login(browser, email, locale = "fa") {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto(`${baseUrl}/${locale}/login?callbackUrl=${encodeURIComponent(`/${locale}/dashboard/retail-catalog`)}`);
  console.log(`login page ${page.url()} title=${await page.title()}`);
  await page.locator("#username").fill(email);
  await page.locator("#password").fill(password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(`**/${locale}/dashboard/retail-catalog`, { timeout: 60000 });
  assert.equal(new URL(page.url()).origin, new URL(baseUrl).origin, "credential login must remain on the configured local test origin");
  const sessionResponse = await page.evaluate(async () => {
    const response = await fetch("/api/auth/session");
    return { status: response.status, session: await response.json() };
  });
  const session = sessionResponse.session;
  if (!session.user?.id || !session.user?.role) {
    throw new Error(`AUTH_SESSION_MISSING: credentials login navigated but the session endpoint returned HTTP ${sessionResponse.status} without an authenticated user.`);
  }
  if (!session.user.organizationId) {
    throw new Error(`ACTIVE_ORGANIZATION_MISSING: authenticated user ${session.user.role} has no server-resolved organization context.`);
  }
  const cookieNames = (await context.cookies(baseUrl)).map((cookie) => cookie.name);
  console.log(`authenticated session established role=${session.user.role} organization=true cookieNames=${cookieNames.join(",")}`);
  const catalogResponse = await context.request.get(`${baseUrl}/api/dashboard/retail/catalog`);
  if (catalogResponse.status() === 401) {
    throw new Error("AUTH_COOKIE_PROPAGATION_OR_SERVER_SESSION_FAILURE: /api/auth/session was authenticated in the browser, but the merchant API returned HTTP 401.");
  }
  if (catalogResponse.status() === 403) {
    const body = await catalogResponse.json().catch(() => ({}));
    throw new Error(`MERCHANT_AUTHORIZATION_OR_CAPABILITY_DENIAL: authenticated manager catalog read returned HTTP 403: ${body.error ?? "no message"}`);
  }
  assert.equal(catalogResponse.status(), 200, `authenticated merchant catalog read returned HTTP ${catalogResponse.status()}`);
  // The credentials callback may return the dashboard root when callbackUrl is
  // normalized by the app. Navigate explicitly to the merchant catalog route;
  // the browser session and server-side route authorization remain in force.
  await page.goto(`${baseUrl}/${locale}/dashboard/retail-catalog`);
  const addProductLink = page.getByRole("link", { name: locale === "fa" ? "افزودن محصول" : locale === "ar" ? "إضافة منتج" : "Add product" });
  try {
    await addProductLink.waitFor({ timeout: 30000 });
  } catch (error) {
    const renderedText = (await page.locator("body").innerText()).slice(0, 1600);
    await page.screenshot({ path: path.join(evidenceDir, `${email.split("@")[0]}-catalog-route-diagnostic.png`), fullPage: true });
    await fs.writeFile(path.join(evidenceDir, `${email.split("@")[0]}-catalog-route-diagnostic.txt`), JSON.stringify({ url: page.url(), title: await page.title(), renderedText, linkCount: await addProductLink.count(), error: String(error) }, null, 2));
    throw new Error(`MERCHANT_CATALOG_ROUTE_MISSING: expected localized add-product link at ${page.url()}; rendered body starts: ${renderedText}; ${String(error)}`);
  }
  return { context, page };
}

async function createAndPublish({ browser, email, locale, organization, category, attribute, option, slug, sku, name }) {
  const { context, page } = await login(browser, email, locale);
  const unauthorizedPage = await browser.newPage();
  const unauthorized = await unauthorizedPage.context().request.get(`${baseUrl}/api/dashboard/retail/catalog`);
  assert.equal(unauthorized.status(), 401, "unauthenticated catalog read must be rejected");
  await unauthorizedPage.close();

  const addProductLink = page.getByRole("link", { name: locale === "fa" ? "افزودن محصول" : "Add product" });
  if (await addProductLink.count() !== 1) {
    const renderedText = (await page.locator("body").innerText()).slice(0, 1600);
    await page.screenshot({ path: path.join(evidenceDir, `${organization}-dashboard-diagnostic.png`), fullPage: true });
    throw new Error(`MERCHANT_DASHBOARD_CONTROL_MISSING: expected one localized add-product link; rendered body starts: ${renderedText}`);
  }
  await addProductLink.click();
  await page.getByLabel(locale === "fa" ? "نام محصول" : "Product name").fill(name);
  await page.getByLabel(locale === "fa" ? "نشانی کوتاه (اختیاری)" : "URL slug (optional)").fill(slug);
  await page.getByLabel(locale === "fa" ? "توضیحات محصول" : "Product description").fill("پیش‌نمایش مصنوعی برای آزمون جریان مدیریت کالا.");
  await page.getByLabel(locale === "fa" ? "دسته‌بندی" : "Category").selectOption({ label: category });
  const attributeLabels = {
    material: "جنس", style: "سبک", color: "رنگ", size: "سایز (EU)", ram: "حافظه RAM (GB)", processor: "پردازنده", display: "نمایشگر", warranty: "گارانتی",
  };
  const productAttr = attributeLabels[attribute];
  if (attribute === "material" || attribute === "display") await page.getByLabel(productAttr).selectOption({ index: 1 });
  else await page.getByLabel(productAttr).fill(attribute === "ram" ? "12" : "چرم مصنوعی");
  if (attribute === "material") await page.getByLabel(attributeLabels.style).fill("روزمره");
  if (option === "color-size") {
    await page.getByLabel("رنگ").selectOption({ index: 1 });
    await page.getByLabel("سایز (EU)").fill("41");
  } else {
    await page.getByLabel("رنگ").selectOption({ index: 1 });
    await page.getByLabel("حافظه داخلی (GB)").fill("256");
  }
  await page.getByLabel("عنوان گونه").fill("پیش‌نمایش مشکی");
  await page.getByLabel("شناسه کالا (SKU)").fill(sku);
  await page.getByLabel("قیمت (تومان)").fill(attribute === "ram" ? "45900000" : "650000");
  await page.locator('input[type="number"]').last().fill("3");
  const upload = page.locator('input[type="file"]');
  const mediaUpload = page.waitForResponse((response) => response.url().includes("/api/dashboard/retail/media") && response.request().method() === "POST");
  await upload.setInputFiles(imagePath);
  const mediaResponse = await mediaUpload;
  const mediaHeaders = await mediaResponse.request().allHeaders();
  assert.equal(mediaResponse.status(), 201, `eligible product image upload must be accepted; url=${mediaResponse.url()} origin=${mediaHeaders.origin ?? "missing"} secFetchSite=${mediaHeaders["sec-fetch-site"] ?? "missing"} response=${await mediaResponse.text()}`);
  await page.getByRole("button", { name: "ذخیره پیش‌نویس" }).click();
  await page.waitForURL("**/fa/dashboard/retail-catalog/*", { timeout: 60000 });
  const productId = page.url().split("/").at(-1);
  await page.getByRole("button", { name: "پیش‌نمایش" }).click();
  await page.getByText(/پیش‌نمایش مدیر فروشگاه/).waitFor();
  await page.screenshot({ path: path.join(evidenceDir, `${organization}-draft-preview.png`), fullPage: true });
  await page.getByLabel("نام محصول").fill(`${name} ویرایش‌شده`);
  const savedResponse = page.waitForResponse((response) => response.url().includes("/api/dashboard/retail/catalog/") && response.request().method() === "PATCH");
  await page.getByRole("button", { name: "ذخیره تغییرات" }).click();
  assert.equal((await savedResponse).status(), 200, "product edit must persist");
  await page.reload();
  assert.equal(await page.getByLabel("نام محصول").inputValue(), `${name} ویرایش‌شده`, "edited name must persist after reload");
  await page.getByRole("button", { name: "انتشار در فروشگاه" }).click();
  await page.waitForTimeout(500);
  const publicDetail = await page.context().request.get(`${baseUrl}/api/public/v1/organizations/${organization}/products/${slug}`);
  assert.equal(publicDetail.status(), 200, "published product detail must be public");
  const detailBody = await publicDetail.json();
  const data = detailBody.data ?? detailBody;
  assert.equal(data.variants[0].price.amount, attribute === "ram" ? 45900000 : 650000);
  assert.equal(data.variants[0].orderable, true);
  await page.goto(`${baseUrl}/fa/retail/${organization}/product/${slug}`);
  await page.getByText(`${name} ویرایش‌شده`).waitFor();
  await page.screenshot({ path: path.join(evidenceDir, `${organization}-published-detail.png`), fullPage: true });
  await page.goto(`${baseUrl}/fa/dashboard/retail-catalog/${productId}`);
  await page.getByRole("button", { name: "برداشتن از فروشگاه" }).click();
  await page.waitForTimeout(300);
  const hidden = await page.context().request.get(`${baseUrl}/api/public/v1/organizations/${organization}/products/${slug}`);
  assert.equal(hidden.status(), 404, "unpublished product detail must disappear");
  await context.close();
  return productId;
}

async function main() {
  await fs.mkdir(evidenceDir, { recursive: true });
  await fs.writeFile(imagePath, png);
  const browser = await chromium.launch({ headless: true });
  try {
    const fashion = await createAndPublish({ browser, email: "r3-fashion-manager@example.test", locale: "fa", organization: "retail-r3-fashion-preview", category: "کتانی", attribute: "material", option: "color-size", slug: "browser-r3-fashion", sku: "R3-BROWSER-SHOE-41", name: "کفش پیش‌نمایش مرورگر" });
    const electronics = await createAndPublish({ browser, email: "r3-mobile-manager@example.test", locale: "fa", organization: "retail-r3-mobile-preview", category: "گوشی هوشمند", attribute: "ram", option: "color-storage", slug: "browser-r3-phone", sku: "R3-BROWSER-PHONE-256", name: "موبایل پیش‌نمایش مرورگر" });

    const staff = await login(browser, "r3-fashion-staff@example.test", "fa");
    const denied = await staff.page.context().request.post(`${baseUrl}/api/dashboard/retail/catalog`, { data: {} });
    assert.equal(denied.status(), 403, "staff member must not write the catalog");
    await staff.context.close();

    const mobileManager = await login(browser, "r3-mobile-manager@example.test", "fa");
    const crossTenant = await mobileManager.page.context().request.get(`${baseUrl}/api/dashboard/retail/catalog/${fashion}`);
    assert.equal(crossTenant.status(), 404, "another tenant's product ID must remain inaccessible");
    await mobileManager.context.close();

    const publicPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await publicPage.goto(`${baseUrl}/fa/retail/retail-r3-fashion-preview`);
    assert.equal(await publicPage.locator("html").getAttribute("dir"), "rtl");
    await publicPage.screenshot({ path: path.join(evidenceDir, "fashion-storefront-rtl-390.png"), fullPage: true });
    console.log(JSON.stringify({ status: "PASSED", fashionProductId: fashion, electronicsProductId: electronics, viewport: "390x844", screenshots: evidenceDir }));
  } finally {
    await browser.close();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
