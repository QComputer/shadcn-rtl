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

async function makeRemoteFontsDeterministic(page) {
  await page.route("https://fonts.googleapis.com/**", (route) => route.fulfill({ status: 200, contentType: "text/css", body: "" }));
  await page.route("https://fonts.gstatic.com/**", (route) => route.abort());
}

async function captureRenderedViewport(page, outputPath) {
  const session = await page.context().newCDPSession(page);
  try {
    const { data } = await session.send("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false });
    await fs.writeFile(outputPath, Buffer.from(data, "base64"));
  } finally {
    await session.detach();
  }
}

async function login(browser, email, locale = "fa", { expectedCatalogStatus = 200 } = {}) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await makeRemoteFontsDeterministic(page);
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
  if (catalogResponse.status() === 403 && expectedCatalogStatus !== 403) {
    const body = await catalogResponse.json().catch(() => ({}));
    throw new Error(`MERCHANT_AUTHORIZATION_OR_CAPABILITY_DENIAL: authenticated manager catalog read returned HTTP 403: ${body.error ?? "no message"}`);
  }
  assert.equal(catalogResponse.status(), expectedCatalogStatus, `authenticated merchant catalog read returned HTTP ${catalogResponse.status()}`);
  if (expectedCatalogStatus === 403) return { context, page };
  // The credentials callback may return the dashboard root when callbackUrl is
  // normalized by the app. Navigate explicitly to the merchant catalog route;
  // the browser session and server-side route authorization remain in force.
  await page.goto(`${baseUrl}/${locale}/dashboard/retail-catalog`);
  const addProductLink = page.getByRole("link", { name: locale === "fa" ? "افزودن محصول" : locale === "ar" ? "إضافة منتج" : "Add product" });
  try {
    await addProductLink.waitFor({ timeout: 30000 });
  } catch (error) {
    const renderedText = (await page.locator("body").innerText()).slice(0, 1600);
    await captureRenderedViewport(page, path.join(evidenceDir, `${email.split("@")[0]}-catalog-route-diagnostic.png`));
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

  const variantLabels = option === "color-storage"
    ? { color: "رنگ دستگاه آزمایشی", dimension: "حافظه داخلی آزمایشی" }
    : { color: "رنگ", dimension: "سایز (EU)" };
  if (option === "color-storage") {
    for (const definition of [
      { key: "r3_mobile_color", label: variantLabels.color, valueType: "ENUM", allowedValues: "آبی, مشکی" },
      { key: "r3_mobile_storage", label: variantLabels.dimension, valueType: "NUMBER", allowedValues: "" },
    ]) {
      await page.getByPlaceholder("کلید (لاتین)").fill(definition.key);
      await page.getByPlaceholder("نام نمایشی").fill(definition.label);
      await page.getByLabel("کاربرد").selectOption("VARIANT_OPTION");
      await page.getByLabel("نوع مقدار").selectOption(definition.valueType);
      if (definition.valueType === "ENUM") await page.getByPlaceholder("گزینه‌ها با ویرگول جدا شوند").fill(definition.allowedValues);
      const createDefinition = page.waitForResponse((response) => response.url().endsWith("/api/dashboard/retail/attributes") && response.request().method() === "POST");
      await page.getByRole("button", { name: "ثبت ویژگی" }).click();
      assert.equal((await createDefinition).status(), 201, `merchant must create variant option ${definition.key}`);
      await page.locator("li").filter({ hasText: definition.key }).waitFor({ timeout: 10000 });
    }
  }

  const addProductLink = page.getByRole("link", { name: locale === "fa" ? "افزودن محصول" : "Add product" });
  if (await addProductLink.count() !== 1) {
    const renderedText = (await page.locator("body").innerText()).slice(0, 1600);
    await captureRenderedViewport(page, path.join(evidenceDir, `${organization}-dashboard-diagnostic.png`));
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
    await page.getByLabel(variantLabels.color).selectOption({ index: 1 });
    await page.getByLabel(variantLabels.dimension).fill("256");
  }
  await page.getByLabel("عنوان گونه").fill("پیش‌نمایش مشکی");
  await page.getByLabel("شناسه کالا (SKU)").fill(sku);
  await page.getByLabel("قیمت (تومان)").fill(attribute === "ram" ? "45900000" : "650000");
  const inventoryInput = page.locator("label").filter({ hasText: /^موجودی/ }).locator('input[type="number"]');
  assert.equal(await inventoryInput.count(), 1, "the variant inventory field must be uniquely identifiable");
  await inventoryInput.fill("3");
  const availableMediaResponse = await context.request.get(`${baseUrl}/api/dashboard/retail/media`);
  assert.equal(availableMediaResponse.status(), 200, "manager must load eligible organization media");
  const availableMedia = (await availableMediaResponse.json()).images ?? [];
  const previewAsset = availableMedia.find((image) => image.filename === "PREVIEW-R3-synthetic-test-asset.png");
  assert.ok(previewAsset, `tenant-owned PREVIEW media missing from gallery: ${JSON.stringify(availableMedia.map(({ filename, purpose, access }) => ({ filename, purpose, access })))}`);
  const previewImage = page.locator('button[aria-label$="PREVIEW-R3-synthetic-test-asset.png"]');
  try {
    await previewImage.waitFor({ timeout: 15000 });
  } catch (error) {
    await captureRenderedViewport(page, path.join(evidenceDir, `${organization}-media-gallery-diagnostic.png`));
    throw new Error(`MERCHANT_MEDIA_GALLERY_MISSING: API returned eligible image id=${previewAsset.id}, filename=${previewAsset.filename}; browser page=${page.url()}; ${String(error)}`);
  }
  await previewImage.click();
  assert.equal(await previewImage.getAttribute("aria-pressed"), "true", "same-tenant PREVIEW media must be attachable to a product");
  await page.getByRole("button", { name: "ذخیره پیش‌نویس" }).click();
  await page.waitForURL((url) => {
    const segments = url.pathname.split("/").filter(Boolean);
    return segments.at(-2) === "retail-catalog" && segments.at(-1) !== "new";
  }, { timeout: 60000 });
  const productId = page.url().split("/").at(-1);
  await page.getByRole("button", { name: "پیش‌نمایش" }).click();
  await page.locator("div").filter({ hasText: /^پیش‌نمایش مدیر فروشگاه · این کالا هنوز برای مشتریان منتشر نشده است$/ }).waitFor();
  await captureRenderedViewport(page, path.join(evidenceDir, `${organization}-draft-preview.png`));
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
  const managedDetailResponse = await page.context().request.get(`${baseUrl}/api/dashboard/retail/catalog/${productId}`);
  assert.equal(managedDetailResponse.status(), 200, `manager must still read product ${productId} after publication: ${await managedDetailResponse.text()}`);
  const managedProduct = (await managedDetailResponse.json()).product;
  const managedVariant = managedProduct.variants[0];
  assert.equal(managedVariant.price, attribute === "ram" ? 45900000 : 650000, `persisted variant price mismatch: ${JSON.stringify({ price: managedVariant.price, inventory: managedVariant.inventory, reservedQuantity: managedVariant.reservedQuantity })}`);
  assert.equal(managedVariant.inventory, 3, `persisted variant inventory mismatch: ${JSON.stringify({ price: managedVariant.price, inventory: managedVariant.inventory, reservedQuantity: managedVariant.reservedQuantity })}`);
  assert.equal(data.variants[0].price.amount, attribute === "ram" ? 45900000 : 650000);
  assert.equal(data.variants[0].orderable, true, `published variant with inventory must be orderable: ${JSON.stringify({ price: data.variants[0].price.amount, orderable: data.variants[0].orderable })}`);
  await page.goto(`${baseUrl}/fa/retail/${organization}/product/${slug}`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.getByRole("heading", { name: `${name} ویرایش‌شده` }).waitFor({ timeout: 20000 });
  await captureRenderedViewport(page, path.join(evidenceDir, `${organization}-published-detail.png`));
  const storefrontPage = await context.newPage();
  await makeRemoteFontsDeterministic(storefrontPage);
  await storefrontPage.goto(`${baseUrl}/fa/retail/${organization}`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await storefrontPage.getByRole("link", { name: `${name} ویرایش‌شده` }).waitFor({ timeout: 20000 });
  await captureRenderedViewport(storefrontPage, path.join(evidenceDir, `${organization}-published-catalog.png`));
  await storefrontPage.close();
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

    const staff = await login(browser, "r3-fashion-staff@example.test", "fa", { expectedCatalogStatus: 403 });
    const denied = await staff.page.context().request.post(`${baseUrl}/api/dashboard/retail/catalog`, {
      headers: { origin: baseUrl, "sec-fetch-site": "same-origin" },
      data: {},
    });
    assert.equal(denied.status(), 403, "staff member must not write the catalog");
    await staff.context.close();

    const mobileManager = await login(browser, "r3-mobile-manager@example.test", "fa");
    const crossTenant = await mobileManager.page.context().request.get(`${baseUrl}/api/dashboard/retail/catalog/${fashion}`);
    assert.equal(crossTenant.status(), 404, "another tenant's product ID must remain inaccessible");
    await mobileManager.context.close();

    const publicPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await makeRemoteFontsDeterministic(publicPage);
    await publicPage.goto(`${baseUrl}/fa/retail/retail-r3-fashion-preview`, { waitUntil: "domcontentloaded", timeout: 60000 });
    assert.equal(await publicPage.locator("html").getAttribute("dir"), "rtl");
    await publicPage.getByRole("link", { name: "نمونه فروشگاه کفش R3" }).waitFor({ timeout: 20000 });
    await captureRenderedViewport(publicPage, path.join(evidenceDir, "fashion-storefront-rtl-390.png"));
    console.log(JSON.stringify({ status: "PASSED", fashionProductId: fashion, electronicsProductId: electronics, viewport: "390x844", screenshots: evidenceDir }));
  } finally {
    await browser.close();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
