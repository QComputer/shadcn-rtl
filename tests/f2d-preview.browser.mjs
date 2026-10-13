import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const baseUrl = process.env.F2D_PREVIEW_URL ?? "http://127.0.0.1:3117/fa/hotel-preview";
const output = new URL("../artifacts/f2d/", import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  ...(process.env.F2D_CHROME_EXECUTABLE
    ? { executablePath: process.env.F2D_CHROME_EXECUTABLE }
    : process.platform === "win32"
      ? { executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" }
      : {}),
});
const page = await browser.newPage({ viewport: { width: 1665, height: 896 }, deviceScaleFactor: 1 });
const forbiddenRequests = [];
const pageErrors = [];
page.on("pageerror", (error) => pageErrors.push(error.message));
page.on("request", (request) => {
  const url = new URL(request.url());
  if (/\/api\/hotel\/v1\/(availability|quotes|holds|payments)|\/api\/payments/i.test(url.pathname)) forbiddenRequests.push(request.url());
});

try {
  const response = await page.goto(baseUrl, { waitUntil: "networkidle", timeout: 60000 });
  assert.equal(response?.status(), 200, "preview route responds successfully");
  await page.getByRole("heading", { name: "هتل دامون" }).first().waitFor();
  assert.equal(await page.locator('main[data-provenance="PREVIEW"]').count(), 1);
  assert.equal(await page.locator("text=پیش‌نمایش داخلی طراحی").count(), 1);

  for (const width of [360, 390, 768, 820, 1024, 1665]) {
    await page.setViewportSize({ width, height: width < 500 ? 844 : 896 });
    await page.waitForTimeout(80);
    const dimensions = await page.evaluate(() => ({ document: document.documentElement.scrollWidth, viewport: innerWidth }));
    assert.ok(dimensions.document <= dimensions.viewport + 1, `no horizontal overflow at ${width}px: ${JSON.stringify(dimensions)}`);
  }

  await page.setViewportSize({ width: 1665, height: 896 });
  await page.screenshot({ path: fileURLToPath(new URL("desktop-1665x896-viewport.png", output)), fullPage: false });
  await page.screenshot({ path: fileURLToPath(new URL("desktop-full.png", output)), fullPage: true });

  const arrival = page.getByRole("button", { name: "انتخاب تاریخ ورود شمسی" });
  await arrival.click();
  const calendar = page.getByTestId("jalali-calendar-dialog");
  await calendar.waitFor();
  assert.match(await calendar.getByRole("group", { name: /^روزهای/ }).getAttribute("aria-label"), /روزهای/);
  await page.screenshot({ path: fileURLToPath(new URL("desktop-calendar-open-1665x896.png", output)), fullPage: false });
  await page.keyboard.press("Escape");
  await calendar.waitFor({ state: "detached" });
  assert.equal(await arrival.evaluate((button) => document.activeElement === button), true, "calendar Escape restores focus");

  await page.getByRole("button", { name: "انتخاب ترکیب مهمانان" }).click();
  const guestDialog = page.getByRole("dialog", { name: "ترکیب مهمانان" });
  await guestDialog.waitFor();
  await page.screenshot({ path: fileURLToPath(new URL("desktop-guests-open-1665x896.png", output)), fullPage: false });
  await guestDialog.getByRole("button", { name: "افزایش بزرگسال" }).click();
  assert.equal(await guestDialog.getByLabel("تعداد بزرگسالان").innerText(), "۲");
  await page.keyboard.press("Escape");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload({ waitUntil: "networkidle" });
  await page.screenshot({ path: fileURLToPath(new URL("mobile-390x844-viewport.png", output)), fullPage: false });
  await page.screenshot({ path: fileURLToPath(new URL("mobile-full.png", output)), fullPage: true });
  const menu = page.getByRole("button", { name: "باز کردن منو" });
  await menu.click();
  assert.equal(await page.getByRole("navigation", { name: "پیمایش موبایل" }).isVisible(), true);
  await page.getByRole("link", { name: "درباره‌ی دامون" }).click();
  await page.getByRole("button", { name: "انتخاب تاریخ ورود شمسی" }).click();
  await page.getByTestId("jalali-calendar-dialog").waitFor();
  await page.screenshot({ path: fileURLToPath(new URL("mobile-calendar-open-390x844.png", output)), fullPage: false });
  await page.keyboard.press("Escape");

  await page.locator("#booking").getByRole("button", { name: /بررسی تاریخ‌ها/ }).click();
  assert.match(await page.locator("#booking").innerText(), /تاریخ ورود و خروج|تاریخ انتخاب‌شده|هیچ درخواستی ارسال نشد/);
  assert.deepEqual(forbiddenRequests, [], "preview did not call booking, hold or payment APIs");
  assert.deepEqual(pageErrors, [], "no uncaught browser errors");
  console.log(JSON.stringify({ result: "PASS", route: baseUrl, viewports: [360, 390, 768, 820, 1024, 1665], forbiddenRequests: forbiddenRequests.length, pageErrors: pageErrors.length, screenshots: ["desktop-1665x896-viewport.png", "desktop-full.png", "desktop-calendar-open-1665x896.png", "desktop-guests-open-1665x896.png", "mobile-390x844-viewport.png", "mobile-full.png", "mobile-calendar-open-390x844.png"] }, null, 2));
} finally {
  await browser.close();
}
