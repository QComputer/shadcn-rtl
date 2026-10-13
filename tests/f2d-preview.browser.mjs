import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const baseUrl = process.env.F2D_PREVIEW_URL ?? "http://127.0.0.1:3117/fa/hotel-preview";
const output = new URL("../artifacts/f4/", import.meta.url);
await mkdir(output, { recursive: true });
const contrastRatio = (foreground, background) => {
  const luminance = (value) => {
    const channels = value.match(/[\d.]+/g).slice(0, 3).map(Number).map((channel) => {
      const normalized = channel / 255;
      return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
    });
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  };
  const first = luminance(foreground);
  const second = luminance(background);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
};
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

  const websiteGate = await page.evaluate(async () => {
    const response = await fetch("/api/hotel/v1/website/properties/f2d-runtime-probe?locale=fa", { cache: "no-store" });
    return { status: response.status, body: await response.json() };
  });
  assert.equal(websiteGate.status, 503, "public website route remains disabled in local runtime");
  assert.equal(websiteGate.body.error, "WEBSITE_DISABLED");
  assert.equal(JSON.stringify(websiteGate.body).includes("preview"), false, "disabled public API does not leak preview content");

  for (const width of [360, 390, 430, 768, 820, 1024, 1440, 1665]) {
    await page.setViewportSize({ width, height: width < 500 ? 844 : 896 });
    await page.waitForTimeout(80);
    const dimensions = await page.evaluate(() => ({ document: document.documentElement.scrollWidth, viewport: innerWidth }));
    assert.ok(dimensions.document <= dimensions.viewport + 1, `no horizontal overflow at ${width}px: ${JSON.stringify(dimensions)}`);
  }

  const visualColors = await page.evaluate(() => {
    const color = (element) => getComputedStyle(element).color;
    const background = (element) => getComputedStyle(element).backgroundColor;
    const main = document.querySelector('main[data-provenance="PREVIEW"]');
    const title = main?.querySelector("h1");
    const heroCopy = title?.parentElement;
    const cta = heroCopy?.querySelector('a[href="#booking"]');
    const firstNavLink = document.querySelector("header nav a");
    const arrivalTrigger = document.querySelector('button[aria-label="انتخاب تاریخ ورود شمسی"]');
    const guestTrigger = document.querySelector('button[aria-label="انتخاب ترکیب مهمانان"]');
    const roomDescription = document.querySelector('article[data-room-kind] p');
    return {
      title: color(title), lead: color(title?.nextElementSibling), nav: color(firstNavLink),
      cta: color(cta), ctaBackground: background(cta),
      dateLabel: color(arrivalTrigger?.querySelector("small")),
      guestLabel: color(guestTrigger?.querySelector("small")),
      roomDescription: color(roomDescription), roomCardBackground: background(roomDescription?.closest("article")),
      siteBackground: background(main),
    };
  });
  assert.notEqual(visualColors.title, "rgb(255, 255, 255)", "hero title is not inherited white on ivory");
  assert.notEqual(visualColors.lead, "rgb(255, 255, 255)", "hero subtitle is not inherited white on ivory");
  assert.equal(visualColors.siteBackground, "rgb(249, 246, 240)", "preview has a self-contained light background");
  const heroSurface = "rgb(247, 243, 236)";
  assert.ok(contrastRatio(visualColors.title, heroSurface) >= 4.5, "hero title meets normal-text WCAG AA contrast");
  assert.ok(contrastRatio(visualColors.lead, heroSurface) >= 4.5, "hero subtitle meets normal-text WCAG AA contrast");
  assert.ok(contrastRatio(visualColors.nav, "rgb(255, 255, 255)") >= 4.5, "header navigation meets WCAG AA contrast");
  assert.ok(contrastRatio(visualColors.cta, visualColors.ctaBackground) >= 4.5, "primary CTA meets WCAG AA contrast");
  assert.ok(contrastRatio(visualColors.dateLabel, "rgb(255, 255, 255)") >= 4.5, "date control labels meet WCAG AA contrast");
  assert.ok(contrastRatio(visualColors.guestLabel, "rgb(255, 255, 255)") >= 4.5, "guest control labels meet WCAG AA contrast");
  assert.ok(contrastRatio(visualColors.roomDescription, visualColors.roomCardBackground) >= 4.5, "room-card description meets WCAG AA contrast");

  await page.setViewportSize({ width: 1665, height: 896 });
  await page.screenshot({ path: fileURLToPath(new URL("desktop-1665x896-viewport.png", output)), fullPage: false });
  await page.screenshot({ path: fileURLToPath(new URL("desktop-full.png", output)), fullPage: true });

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.screenshot({ path: fileURLToPath(new URL("desktop-1440x900-viewport.png", output)), fullPage: false });
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.screenshot({ path: fileURLToPath(new URL("tablet-768x1024-viewport.png", output)), fullPage: false });
  await page.setViewportSize({ width: 1665, height: 896 });

  const firstRoom = page.getByRole("button", { name: /مشاهده تصاویر/ }).first();
  await firstRoom.click();
  const roomDialog = page.getByTestId("room-gallery-dialog");
  await roomDialog.waitFor();
  assert.ok(await roomDialog.locator("img").evaluate(async (image) => { await image.decode(); return image.naturalWidth > 0; }), "room gallery image is loaded");
  assert.equal(await roomDialog.getByRole("button", { name: "تصویر قبلی اتاق" }).isDisabled(), true, "single-image preview keeps gallery navigation disabled");
  assert.equal(await roomDialog.getByRole("button", { name: "تصویر بعدی اتاق" }).isDisabled(), true, "single-image preview keeps gallery navigation disabled");
  await page.screenshot({ path: fileURLToPath(new URL("desktop-room-gallery-open-1665x896.png", output)), fullPage: false });
  await page.keyboard.press("Escape");
  await roomDialog.waitFor({ state: "detached" });
  assert.equal(await firstRoom.evaluate((button) => document.activeElement === button), true, "room gallery Escape restores trigger focus");

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
  assert.equal(await guestDialog.getByRole("status", { name: "تعداد بزرگسالان" }).innerText(), "۲");
  await page.keyboard.press("Escape");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.screenshot({ path: fileURLToPath(new URL("mobile-390x844-viewport.png", output)), fullPage: false });
  await page.screenshot({ path: fileURLToPath(new URL("mobile-full.png", output)), fullPage: true });
  const mobileRoomTrigger = page.getByRole("button", { name: /مشاهده تصاویر/ }).first();
  await mobileRoomTrigger.click();
  const mobileRoomDialog = page.getByTestId("room-gallery-dialog");
  await mobileRoomDialog.waitFor();
  const galleryBounds = await mobileRoomDialog.boundingBox();
  assert.ok(galleryBounds && galleryBounds.x >= 0 && galleryBounds.x + galleryBounds.width <= 390, "room gallery fits mobile viewport");
  await page.screenshot({ path: fileURLToPath(new URL("mobile-room-gallery-open-390x844.png", output)), fullPage: false });
  await page.keyboard.press("Escape");
  await mobileRoomDialog.waitFor({ state: "detached" });
  assert.equal(await mobileRoomTrigger.evaluate((button) => document.activeElement === button), true, "mobile room gallery Escape restores trigger focus");
  const menu = page.getByRole("button", { name: "باز کردن منو" });
  await menu.click();
  assert.equal(await page.getByRole("navigation", { name: "پیمایش موبایل" }).isVisible(), true);
  await page.getByRole("link", { name: "درباره‌ی دامون" }).click();
  await page.getByRole("button", { name: "انتخاب تاریخ ورود شمسی" }).click();
  const mobileCalendar = page.getByTestId("jalali-calendar-dialog");
  await mobileCalendar.waitFor();
  const calendarBounds = await mobileCalendar.boundingBox();
  assert.ok(calendarBounds && calendarBounds.x >= 0 && calendarBounds.x + calendarBounds.width <= 390 && calendarBounds.y >= 0 && calendarBounds.y + calendarBounds.height <= 844, "Jalali calendar fits mobile viewport");
  await page.screenshot({ path: fileURLToPath(new URL("mobile-calendar-open-390x844.png", output)), fullPage: false });
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "انتخاب ترکیب مهمانان" }).click();
  const mobileGuestDialog = page.getByRole("dialog", { name: "ترکیب مهمانان" });
  await mobileGuestDialog.waitFor();
  const guestBounds = await mobileGuestDialog.boundingBox();
  assert.ok(guestBounds && guestBounds.x >= 0 && guestBounds.x + guestBounds.width <= 390 && guestBounds.y >= 0 && guestBounds.y + guestBounds.height <= 844, "guest selector fits mobile viewport");
  await page.screenshot({ path: fileURLToPath(new URL("mobile-guests-open-390x844.png", output)), fullPage: false });
  await page.keyboard.press("Escape");

  await page.locator("#booking").getByRole("button", { name: /بررسی تاریخ‌ها/ }).click();
  assert.match(await page.locator("#booking").innerText(), /تاریخ ورود و خروج|تاریخ انتخاب‌شده|هیچ درخواستی ارسال نشد/);
  assert.deepEqual(forbiddenRequests, [], "preview did not call booking, hold or payment APIs");
  assert.deepEqual(pageErrors, [], "no uncaught browser errors");
  console.log(JSON.stringify({ result: "PASS", route: baseUrl, viewports: [360, 390, 768, 820, 1024, 1440, 1665], visualColors, websiteGate: websiteGate.status, forbiddenRequests: forbiddenRequests.length, pageErrors: pageErrors.length, screenshots: ["desktop-1665x896-viewport.png", "desktop-1440x900-viewport.png", "tablet-768x1024-viewport.png", "desktop-full.png", "desktop-room-gallery-open-1665x896.png", "desktop-calendar-open-1665x896.png", "desktop-guests-open-1665x896.png", "mobile-390x844-viewport.png", "mobile-full.png", "mobile-room-gallery-open-390x844.png", "mobile-calendar-open-390x844.png", "mobile-guests-open-390x844.png"] }, null, 2));
} finally {
  await browser.close();
}
