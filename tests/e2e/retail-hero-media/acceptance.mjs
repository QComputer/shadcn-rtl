import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

function environment() {
  assert.equal(process.env.RETAIL_HERO_MEDIA_DISPOSABLE, "true");
  const base = new URL(process.env.E2E_BASE_URL ?? "");
  assert.equal(base.protocol, "http:");
  assert.equal(base.hostname, "127.0.0.1");
  assert.equal(base.port, "3421", "PR62's 3418 server must never be reused");
  assert.equal(base.pathname, "/");
  const db = new URL(process.env.DATABASE_URL ?? "");
  assert.equal(db.hostname, "127.0.0.1");
  assert.equal(db.port, process.env.RETAIL_HERO_MEDIA_DB_PORT);
  assert.match(db.pathname, /^\/retail_hero_e2e_[a-z0-9_]{8,32}$/i);
  assert.equal(process.env.DATABASE_URL, process.env.DIRECT_URL);
  return { base, output: path.resolve(process.env.E2E_OUTPUT_DIR ?? ".tmp/pr63-retail-hero-media-evidence"), root: path.resolve(process.env.MEDIA_STORAGE_ROOT ?? "") };
}

const { base, output, root } = environment();
const orgId = process.env.RETAIL_HERO_MEDIA_ORGANIZATION_ID;
const slug = process.env.RETAIL_HERO_MEDIA_SLUG;
const username = process.env.RETAIL_HERO_MEDIA_MANAGER;
const foreignOrgId = process.env.RETAIL_HERO_MEDIA_FOREIGN_ORGANIZATION_ID;
assert.ok(orgId && slug && username, "the disposable SHOP and manager seed outputs are required");
assert.ok(foreignOrgId, "the separate tenant fixture is required for isolation checks");
const password = "E2ePass!23456";
const fixturePath = path.resolve("public/retail-preview/preview-fashion-campaign.png");
const chromePath = "C:/Program Files/Google/Chrome/Application/chrome.exe";
assert.ok(await fs.stat(chromePath), "installed Chrome Stable is required");
await fs.mkdir(output, { recursive: true });

const report = { status: "FAILED", exitCode: 1, sourceSha: process.env.E2E_SOURCE_SHA, cases: [], network: [], console: [], screenshots: [], error: null };
let browser;
let context;
let page;
let uploaded;

function record(name, result = {}) { report.cases.push({ name, status: "PASSED", ...result }); }
function screenshot(name) { return page.screenshot({ path: path.join(output, `${name}.png`), fullPage: true }).then(() => report.screenshots.push(`${name}.png`)); }

try {
  browser = await chromium.launch({ headless: true, executablePath: chromePath, args: ["--disable-features=HttpsFirstBalancedModeAutoEnable,HttpsUpgrades"] });
  context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, baseURL: base.href });
  await context.addInitScript(() => localStorage.setItem("shadcn-rtl-theme", "system"));
  context.setDefaultNavigationTimeout(90_000);
  await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
  page = await context.newPage();
  page.on("pageerror", error => report.console.push({ type: "pageerror", message: error.message.slice(0, 500) }));
  page.on("console", message => { if (message.type() === "error") report.console.push({ type: "console", message: message.text().slice(0, 500) }); });
  page.on("request", request => report.network.push({ method: request.method(), path: new URL(request.url()).pathname, phase: "request" }));
  page.on("response", response => report.network.push({ method: response.request().method(), path: new URL(response.url()).pathname, status: response.status(), phase: "response" }));

  const studioPath = `/fa/dashboard/website-studio/${encodeURIComponent(orgId)}`;
  const login = new URL("/fa/login", base);
  login.searchParams.set("callbackUrl", studioPath);
  await page.goto(login.href, { waitUntil: "domcontentloaded" });
  await page.locator("#username").fill(username);
  await page.locator("#password").fill(password);
  await page.locator('form button[type="submit"]').click();
  await page.waitForURL(url => url.pathname === studioPath, { timeout: 60_000 });
  await page.getByText("استودیوی وب‌سایت فروشگاه", { exact: true }).waitFor({ state: "visible" });
  await page.getByRole("button", { name: "آماده‌سازی هیرو" }).click();
  const hero = page.locator('section[aria-labelledby="retail-hero-title"]');
  await hero.waitFor({ state: "visible" });
  await hero.getByRole("checkbox", { name: "نمایش بخش" }).check();
  await hero.getByLabel("تیتر اصلی").fill("Hero media acceptance · first published");
  await hero.getByLabel("توضیح کوتاه").fill("Disposable manager browser acceptance");
  await screenshot("01-hero-editor-empty");
  record("authorized manager opens the Website Studio Hero editor");

  await hero.getByRole("button", { name: /گالری فروشگاه/ }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.waitFor({ state: "visible" });
  const imageButtons = dialog.locator("button[aria-pressed]");
  await assertEventuallyCount(imageButtons, 24);
  await screenshot("02-gallery-page-one");
  await dialog.getByRole("button", { name: "بعدی" }).click();
  await assertEventuallyCount(imageButtons, 1);
  const selectedFromSecondPage = await imageButtons.nth(0).getAttribute("aria-pressed");
  const pageTwoFilename = await imageButtons.nth(0).locator("span").first().textContent();
  await imageButtons.nth(0).click();
  await dialog.waitFor({ state: "hidden" });
  await hero.getByText(pageTwoFilename.trim(), { exact: true }).waitFor({ state: "visible" });
  await hero.getByRole("button", { name: /گالری فروشگاه/ }).first().click();
  const reopenedDialog = page.getByRole("dialog");
  await reopenedDialog.waitFor({ state: "visible" });
  await reopenedDialog.getByText(pageTwoFilename.trim(), { exact: true }).first().waitFor({ state: "visible" });
  assert.equal(selectedFromSecondPage, "false");
  await screenshot("03-selected-image-retained-outside-page");
  record("gallery pagination is bounded to 24 and a page-two selection remains visible on page one", { pageOne: 24, pageTwo: 1, retainedFilename: pageTwoFilename.trim() });

  const searchResponse = page.waitForResponse(response => response.url().includes("/website/media") && response.url().includes("q=gallery-fixture-25"));
  await reopenedDialog.getByLabel("جست‌وجو در گالری فروشگاه").fill("gallery-fixture-25");
  await searchResponse;
  const searchResults = await imageButtons.count();
  assert.ok(searchResults <= 24 && searchResults > 0);
  await screenshot("04-gallery-server-search");
  record("gallery search filters results on the server", { results: searchResults });
  await page.keyboard.press("Escape");

  const uploadPromise = page.waitForResponse(response => response.url().includes("/website/media") && response.request().method() === "POST");
  await hero.getByRole("button", { name: /گالری فروشگاه/ }).first().click();
  const uploadDialog = page.getByRole("dialog");
  await uploadDialog.waitFor({ state: "visible" });
  await uploadDialog.locator('input[type="file"]').setInputFiles(fixturePath);
  const uploadResponse = await uploadPromise;
  assert.equal(uploadResponse.status(), 201, `direct upload returned ${uploadResponse.status()}`);
  uploaded = (await uploadResponse.json()).image;
  assert.ok(uploaded?.id && uploaded?.url && uploaded.organizationId === orgId);
  await uploadDialog.waitFor({ state: "hidden" });
  await hero.getByText(uploaded.filename, { exact: true }).waitFor({ state: "visible" });
  const delivery = await context.request.get(new URL(uploaded.url, base).href);
  assert.equal(delivery.status(), 200, "the stored image must be delivered through its real tenant media route");
  const scopedSearch = await context.request.get(new URL(`/api/organizations/${encodeURIComponent(orgId)}/website/media?q=gallery-fixture`, base).href);
  assert.equal(scopedSearch.status(), 200);
  const scopedBody = await scopedSearch.json();
  assert.equal(scopedBody.images.length, 24, "gallery query returns only the bounded first page despite a foreign matching record");
  assert.equal(scopedBody.images.some(image => image.organizationId !== orgId), false);
  assert.equal(scopedBody.images.some(image => image.filename.includes("foreign-gallery-fixture")), false);
  const foreignResponse = await context.request.get(new URL(`/api/organizations/${encodeURIComponent(foreignOrgId)}/website/media?q=gallery-fixture`, base).href);
  assert.equal(foreignResponse.status(), 403, "a manager cannot query another tenant's gallery");
  await screenshot("05-direct-upload-selected-and-delivered");
  record("direct upload becomes immediately selected and is delivered by the tenant media route", { uploadStatus: uploadResponse.status(), mediaStatus: delivery.status(), imageId: uploaded.id });
  record("gallery search is tenant isolated", { returned: scopedBody.images.length, ownerMatches: scopedBody.images.every(image => image.organizationId === orgId), foreignTenantStatus: foreignResponse.status() });

  await selectGalleryImage(hero, "تصویر نمایشگر موبایل (اختیاری)", pageTwoFilename.trim());
  await selectGalleryImage(hero, "تصویر رومیزی برای تم تیره (اختیاری)", "gallery-fixture-24");
  await selectGalleryImage(hero, "تصویر موبایل برای تم تیره (اختیاری)", "gallery-fixture-25");
  const slotLabels = ["تصویر نمایشگر رومیزی", "تصویر نمایشگر موبایل (اختیاری)", "تصویر رومیزی برای تم تیره (اختیاری)", "تصویر موبایل برای تم تیره (اختیاری)"];
  for (const label of slotLabels) await hero.getByText(label, { exact: true }).locator("..").getByText(/\.png$/, { exact: false }).first().waitFor({ state: "visible" });
  record("all desktop/mobile and light/dark Hero image slots accept explicit gallery or upload selections");

  await page.getByRole("button", { name: "ذخیره پیش‌نویس" }).click();
  await page.getByRole("status").filter({ hasText: "پیش‌نویس خصوصی ذخیره شد" }).waitFor({ state: "visible" });
  await page.reload({ waitUntil: "domcontentloaded" });
  await hero.getByLabel("تیتر اصلی").waitFor({ state: "visible" });
  assert.equal(await hero.getByText(/\.png$/).count(), 4, "all four selected image mappings must survive draft reload");
  await page.getByRole("button", { name: "پیش‌نمایش ذخیره‌شده" }).click();
  const previewFrame = page.frameLocator('iframe[title="پیش‌نمایش خصوصی وب‌سایت فروشگاه"]');
  const previewHero = previewFrame.locator("[data-retail-managed-hero]");
  await previewHero.waitFor({ state: "visible" });
  await previewHero.getByText("Hero media acceptance · first published", { exact: true }).waitFor({ state: "visible" });
  await waitForHeroImageCurrentSrc(previewHero.locator("img").first(), uploaded.filename);
  await screenshot("06-private-preview-desktop-light");
  await page.getByRole("button", { name: /موبایل/ }).click();
  await waitForHeroImageCurrentSrc(previewHero.locator("img").first(), pageTwoFilename.trim());
  await screenshot("06a-private-preview-mobile-light");
  await page.emulateMedia({ colorScheme: "dark" });
  await waitForHeroImageCurrentSrc(previewHero.locator("img").first(), "gallery-fixture-25");
  await screenshot("06b-private-preview-mobile-dark");
  await page.getByRole("button", { name: /رومیزی/ }).click();
  await waitForHeroImageCurrentSrc(previewHero.locator("img").first(), "gallery-fixture-24");
  await screenshot("06c-private-preview-desktop-dark");
  await page.emulateMedia({ colorScheme: "light" });
  record("draft persists after reload and private preview renders the uploaded media");
  await page.getByRole("button", { name: "ویرایش محتوا" }).click();

  await page.getByRole("button", { name: "انتشار نسخهٔ ذخیره‌شده" }).click();
  await page.getByRole("button", { name: "تأیید انتشار" }).click();
  await page.getByRole("status").filter({ hasText: "هیرو منتشر شد" }).waitFor({ state: "visible" });
  await hero.getByLabel("توضیح کوتاه").fill("Second published revision");
  await page.getByRole("button", { name: "ذخیره پیش‌نویس" }).click();
  await page.getByRole("status").filter({ hasText: "پیش‌نویس خصوصی ذخیره شد" }).waitFor({ state: "visible" });
  await page.getByRole("button", { name: "انتشار نسخهٔ ذخیره‌شده" }).click();
  await page.getByRole("button", { name: "تأیید انتشار" }).click();
  await page.getByRole("status").filter({ hasText: "هیرو منتشر شد" }).waitFor({ state: "visible" });
  await page.getByRole("button", { name: "بازگشت به هیروی قبلی" }).click();
  await page.getByRole("button", { name: "تأیید بازگشت" }).click();
  await page.getByRole("status").filter({ hasText: "هیرو به نسخهٔ قبلی بازگشت" }).waitFor({ state: "visible" });
  record("publication activates a saved revision and rollback restores the preceding revision");

  await page.goto(`/fa/${encodeURIComponent(slug)}/shop`, { waitUntil: "domcontentloaded" });
  const publicHero = page.locator("[data-retail-managed-hero]");
  await publicHero.waitFor({ state: "visible" });
  await publicHero.getByText("Hero media acceptance · first published", { exact: true }).waitFor({ state: "visible" });
  await page.locator(`img[src*="${uploaded.filename}"]`).first().waitFor({ state: "visible" });
  await screenshot("07-public-storefront-after-rollback");
  record("public storefront reflects the rolled-back immutable revision and tenant-owned image");

  const assetPath = path.resolve(root, "tenants", orgId, "uploads", uploaded.filename);
  assert.ok(assetPath.startsWith(`${root}${path.sep}`), "fixture object path remains inside the isolated media root");
  await fs.rm(assetPath, { force: false });
  const missingResponse = await context.request.get(new URL(uploaded.url, base).href);
  assert.equal(missingResponse.status(), 404, "missing persistent object must not be served");
  const missingGalleryResponse = await context.request.get(new URL(`/api/organizations/${encodeURIComponent(orgId)}/website/media?q=retail-hero`, base).href);
  assert.equal(missingGalleryResponse.status(), 200);
  assert.equal((await missingGalleryResponse.json()).images.some(image => image.id === uploaded.id), false, "missing persistent object must not appear in the gallery");
  await page.reload({ waitUntil: "domcontentloaded" });
  const textOnlyHero = page.locator("[data-retail-managed-hero]");
  await textOnlyHero.waitFor({ state: "visible" });
  await textOnlyHero.getByText("Hero media acceptance · first published", { exact: true }).waitFor({ state: "visible" });
  assert.equal(await textOnlyHero.locator(`img[src*="${uploaded.filename}"]`).count(), 0);
  await screenshot("08-published-media-unavailable-text-only");
  record("an unavailable published object returns 404, disappears from the gallery and leaves a text-only Hero without an unrelated fallback", { mediaStatus: missingResponse.status() });

  assert.equal(report.console.filter(item => item.type === "pageerror").length, 0, "there must be no browser hydration/runtime errors");
  report.status = "PASSED";
  report.exitCode = 0;
} catch (error) {
  report.error = String(error).slice(0, 1000);
  if (page) await page.screenshot({ path: path.join(output, "failure.png"), fullPage: true }).catch(() => undefined);
} finally {
  if (context) await context.tracing.stop({ path: path.join(output, "trace.zip") }).catch(() => undefined);
  if (context) await context.close().catch(() => undefined);
  if (browser) await browser.close().catch(() => undefined);
  report.cases = report.cases.map(test => ({ ...test, status: report.status === "PASSED" ? test.status : "PARTIAL" }));
  await fs.writeFile(path.join(output, "network.json"), JSON.stringify(report.network, null, 2));
  await fs.writeFile(path.join(output, "console.json"), JSON.stringify(report.console, null, 2));
  await fs.writeFile(path.join(output, "result.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ status: report.status, exitCode: report.exitCode, cases: report.cases, screenshots: report.screenshots, output }));
}
process.exitCode = report.exitCode;

async function assertEventuallyCount(locator, expected) {
  await locator.first().waitFor({ state: "visible", timeout: 30_000 });
  for (let attempt = 0; attempt < 40; attempt++) {
    if (await locator.count() === expected) return;
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  assert.equal(await locator.count(), expected);
}

async function waitForHeroImageCurrentSrc(image, expectedFilename) {
  await image.waitFor({ state: "visible", timeout: 30_000 });
  const deadline = Date.now() + 30_000;
  let currentSrc = "";
  while (Date.now() < deadline) {
    currentSrc = await image.evaluate(element => element.currentSrc).catch(() => "");
    if (currentSrc.includes(expectedFilename)) return;
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  assert.ok(currentSrc.includes(expectedFilename), `Expected visible Hero image currentSrc to include ${expectedFilename}; received ${currentSrc}`);
}

async function selectGalleryImage(hero, slotLabel, filenameSearch) {
  const slot = hero.getByText(slotLabel, { exact: true }).locator("..");
  await slot.getByRole("button").click();
  const dialog = page.getByRole("dialog");
  await dialog.waitFor({ state: "visible" });
  const response = page.waitForResponse(result => result.url().includes("/website/media") && result.url().includes(`q=${encodeURIComponent(filenameSearch)}`));
  await dialog.getByLabel("جست‌وجو در گالری فروشگاه").fill(filenameSearch);
  await response;
  const imageButton = dialog.locator("button[aria-pressed]").filter({ hasText: filenameSearch }).first();
  await imageButton.waitFor({ state: "visible" });
  await imageButton.click();
  await dialog.waitFor({ state: "hidden" });
  await slot.getByText(/\.png$/).first().waitFor({ state: "visible" });
}
