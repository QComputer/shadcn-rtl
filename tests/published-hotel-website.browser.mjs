import assert from "node:assert/strict";
import { mkdir, readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import pathUtils from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const testRequire = createRequire(import.meta.url);
const requireFromTsx = createRequire(testRequire.resolve("tsx/package.json"));
const esbuild = requireFromTsx("esbuild");
const artifacts = fileURLToPath(new URL("../artifacts/hotel-f2/", import.meta.url));
await mkdir(artifacts, { recursive: true });

const bundleResult = await esbuild.build({
  entryPoints: [fileURLToPath(new URL("./fixtures/published-hotel-website.browser.tsx", import.meta.url))],
  bundle: true,
  write: false,
  platform: "browser",
  format: "iife",
  jsx: "automatic",
  alias: { "next/image": fileURLToPath(new URL("./fixtures/room-showcase-image.tsx", import.meta.url)) },
  plugins: [{
    name: "browser-css-modules",
    setup(build) {
      build.onLoad({ filter: /\.module\.css$/ }, async ({ path: filePath }) => {
        const css = await readFile(filePath, "utf8");
        const names = [...new Set([...css.matchAll(/\.([A-Za-z_][\w-]*)/g)].map((match) => match[1]))];
        const prefix = `${pathUtils.basename(pathUtils.dirname(filePath))}_${pathUtils.basename(filePath).split(".")[0]}`.replace(/[^A-Za-z0-9_-]/g, "_");
        const scopedCss = css.replace(/\.([A-Za-z_][\w-]*)/g, `.${prefix}_$1`);
        return { loader: "js", contents: `const s=document.createElement('style');s.textContent=${JSON.stringify(scopedCss)};document.head.append(s);export default ${JSON.stringify(Object.fromEntries(names.map((name) => [name, `${prefix}_${name}`])))};` };
      });
    },
  }],
});
const bundle = bundleResult.outputFiles[0];
assert.ok(bundle, "published page browser fixture should bundle");

const property = {
  mode: "PUBLISHED", locale: "fa", propertySlug: "synthetic-preview-property", revisionNumber: 1,
  content: {
    title: "دامون · دادهٔ مصنوعی آزمون", hero: { eyebrow: "پیش‌نمایش آزمون", heading: "نمایش دادهٔ منتشرشدهٔ ساختگی", subheading: "این محتوا فقط برای آزمون رابط است." },
    introduction: { heading: "معرفی نمونه", body: "این متن برای آزمون مرورگر ساخته شده و محتوای واقعی هتل نیست." },
    sections: [], contact: {},
  },
  propertyGallery: [
    { src: "/api/hotel/v1/website/media/test-property-hero", altText: "تصویر مصنوعی آزمون رابط", sortOrder: 0, slot: "HERO_DESKTOP" },
    { src: "/api/hotel/v1/website/media/test-property-gallery", altText: "تصویر مصنوعی گالری آزمون", sortOrder: 1, slot: "GALLERY" },
  ], roomGalleries: [],
};
const roomCategories = {
  mode: "PUBLISHED", locale: "fa", propertySlug: "synthetic-preview-property",
  roomCategories: [{
    slug: "test-room", name: "دستهٔ آزمون", description: null, localizedText: "توضیح مصنوعی برای بررسی چیدمان.",
    maxAdults: 2, maxChildren: 0, maxOccupancy: 2, beds: [], sizeSqm: null,
    gallery: [{ src: "/api/hotel/v1/website/media/test-room-gallery", altText: "تصویر مصنوعی آزمون اتاق", sortOrder: 0, slot: "GALLERY" }],
  }],
};
const svg = (label) => `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="700"><rect width="100%" height="100%" fill="#e8ddce"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#593b29" font-size="42">Synthetic UI test image: ${label}</text></svg>`;
const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const browser = await chromium.launch({ headless: true, ...(process.platform === "win32" ? { executablePath: chromePath } : {}) });
const results = [];
try {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    const page = await browser.newPage({ viewport });
    const pageErrors = [];
    const consoleErrors = [];
    const requested = [];
    const responses = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
    page.on("request", (request) => requested.push(new URL(request.url()).pathname));
    page.on("response", async (response) => { if (new URL(response.url()).pathname.startsWith("/api/")) responses.push({ path: new URL(response.url()).pathname, status: response.status(), body: await response.text().catch(() => "") }); });
    await page.route("**/api/hotel/v1/website/properties/**", async (route) => {
      const url = new URL(route.request().url());
      const locale = url.searchParams.get("locale");
      if (url.pathname.endsWith("/room-categories")) {
        const body = { ...roomCategories, locale };
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body), headers: { "cache-control": "no-store" } });
      } else {
        const body = { ...property, locale };
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body), headers: { "cache-control": "no-store" } });
      }
    });
    await page.route("**/api/hotel/v1/website/media/**", (route) => route.fulfill({ status: 200, contentType: "image/svg+xml", body: svg("Synthetic UI test only") }));
    await page.route("http://hotel-f2.test/**", (route) => new URL(route.request().url()).pathname === "/" ? route.fulfill({ status: 200, contentType: "text/html", body: '<!doctype html><html lang="fa" dir="rtl"><head><meta name="viewport" content="width=device-width,initial-scale=1" /></head><body style="margin:0"><div id="root"></div></body></html>' }) : route.fallback());
    await page.goto(`http://hotel-f2.test/?locale=fa`);
    await page.addScriptTag({ content: bundle.text });
    try { await page.getByRole("heading", { name: "نمایش دادهٔ منتشرشدهٔ ساختگی" }).waitFor({ timeout: 6000 }); }
    catch { throw new Error(`Published component did not become ready: ${JSON.stringify({ pageErrors, consoleErrors, text: await page.locator("body").innerText(), requested, responses })}`); }
    assert.equal(await page.locator("main[data-provenance=PUBLISHED]").count(), 1);
    assert.ok(await page.getByText(/فرم فقط برای پیش‌نمایش/).count());
    assert.ok(await page.getByTestId("room-showcase").isVisible());
    const originalMediaUrl = await page.locator('[data-room-kind="published"] img').first().getAttribute("src").catch(() => null);
    assert.ok(requested.includes("/api/hotel/v1/website/properties/synthetic-preview-property"));
    assert.ok(requested.some((path) => path.endsWith("/room-categories")));
    assert.ok(requested.filter((path) => path.startsWith("/api/")).every((path) => path.startsWith("/api/hotel/v1/website/")), "only the two public read APIs and eligible media route are called");
    assert.equal(requested.some((path) => /holds|payments|availability|quote|notification|sms/i.test(path)), false);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "no horizontal overflow");
    await page.screenshot({ path: `${artifacts}/published-page-${viewport.width}.png`, fullPage: false });
    await page.getByRole("button", { name: "انتخاب تاریخ ورود شمسی" }).click();
    await page.screenshot({ path: `${artifacts}/jalali-calendar-${viewport.width === 1440 ? "desktop" : "mobile"}.png`, fullPage: false });
    const dayButtons = page.locator('[data-testid^="jalali-day-"]:not(:disabled)');
    const checkInButton = dayButtons.first();
    const calendarHitTest = await page.evaluate(() => { const day = document.querySelector('[data-testid^="jalali-day-"]:not(:disabled)'); const box = day?.getBoundingClientRect(); const hit = box ? document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2) : null; const dialog = document.querySelector('[data-testid="jalali-calendar-dialog"]'); const backdrop = document.querySelector('.backdrop'); return { dialog: dialog?.getBoundingClientRect().toJSON(), dialogStyle: dialog && { z: getComputedStyle(dialog).zIndex, position: getComputedStyle(dialog).position, pointer: getComputedStyle(dialog).pointerEvents }, portalStyle: dialog?.parentElement && { z: getComputedStyle(dialog.parentElement).zIndex, pointer: getComputedStyle(dialog.parentElement).pointerEvents }, backdropStyle: backdrop && { z: getComputedStyle(backdrop).zIndex, position: getComputedStyle(backdrop).position, pointer: getComputedStyle(backdrop).pointerEvents }, backdrop: backdrop?.getBoundingClientRect().toJSON(), day: box?.toJSON(), hit: hit?.outerHTML?.slice(0, 180) }; });
    if (!calendarHitTest.hit?.includes("data-testid=\"jalali-day-")) throw new Error(`Calendar day is occluded: ${JSON.stringify(calendarHitTest)}`);
    const checkInISO = await checkInButton.getAttribute("data-date");
    assert.ok(checkInISO);
    await checkInButton.click();
    const checkOutISO = await page.evaluate((iso) => { const date = new Date(`${iso}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + 1); return date.toISOString().slice(0, 10); }, checkInISO);
    await page.getByTestId(`jalali-day-${checkOutISO}`).click();
    const selected = await page.locator('[data-testid="jalali-date-range-picker"] button[data-iso-date]').evaluateAll((buttons) => buttons.map((button) => button.dataset.isoDate));
    assert.deepEqual(selected, [checkInISO, checkOutISO], "picker stores ordered Gregorian ISO values");
    await page.getByRole("button", { name: "انتخاب ترکیب مهمانان" }).click();
    await page.getByRole("button", { name: "افزایش بزرگسال" }).click();
    assert.equal(await page.locator('output[aria-label="تعداد بزرگسالان"]').innerText(), "۲");
    await page.getByRole("button", { name: "تأیید مهمانان" }).click();
    const galleryOpener = page.getByRole("button", { name: /مشاهده تصاویر دستهٔ آزمون/ });
    await galleryOpener.click();
    const dialog = page.getByTestId("room-gallery-dialog");
    await dialog.waitFor();
    assert.equal(await dialog.getByRole("button", { name: "تصویر قبلی اتاق" }).isDisabled(), true);
    assert.equal(await dialog.getByRole("button", { name: "تصویر بعدی اتاق" }).isDisabled(), true);
    if (viewport.width < 500) {
      const rect = await dialog.boundingBox();
      assert.ok(rect && rect.x >= 0 && rect.x + rect.width <= viewport.width);
      await page.screenshot({ path: `${artifacts}/published-room-gallery-mobile.png`, fullPage: false });
    } else {
      await page.screenshot({ path: `${artifacts}/published-page-desktop.png`, fullPage: false });
      await page.screenshot({ path: `${artifacts}/published-room-gallery-desktop.png`, fullPage: false });
    }
    await page.keyboard.press("Escape");
    await dialog.waitFor({ state: "detached" });
    assert.equal(await galleryOpener.evaluate((button) => document.activeElement === button), true, "gallery close restores focus to its opener");
    assert.deepEqual(pageErrors, []);
    results.push({ viewport: `${viewport.width}x${viewport.height}`, locale: "fa", status: "PASS", jalaliSelection: true, guestSelector: true, sourceUrlPreserved: originalMediaUrl === "/api/hotel/v1/website/media/test-room-gallery" });
    await page.close();
  }
  for (const locale of ["en", "ar"]) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.route("http://hotel-f2.test/**", (route) => new URL(route.request().url()).pathname === "/" ? route.fulfill({ status: 200, contentType: "text/html", body: '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1" /></head><body style="margin:0"><div id="root"></div></body></html>' }) : route.fallback());
    await page.route("**/api/hotel/v1/website/properties/**", async (route) => {
      const url = new URL(route.request().url());
      const body = url.pathname.endsWith("/room-categories") ? { ...roomCategories, locale } : { ...property, locale };
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body), headers: { "cache-control": "no-store" } });
    });
    await page.route("**/api/hotel/v1/website/media/**", (route) => route.fulfill({ status: 200, contentType: "image/svg+xml", body: svg("Synthetic UI test only") }));
    await page.goto(`http://hotel-f2.test/?locale=${locale}`);
    await page.addScriptTag({ content: bundle.text });
    const expected = locale === "en" ? "Choose Jalali check-in date" : "اختر تاريخ الوصول بالتقويم الشمسي";
    await page.getByRole("heading", { name: "نمایش دادهٔ منتشرشدهٔ ساختگی" }).waitFor();
    await page.getByRole("button", { name: expected }).click();
    assert.ok(await page.getByTestId("jalali-calendar-dialog").isVisible());
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    results.push({ viewport: "390x844", locale, status: "PASS", jalaliCalendarLocalized: true });
    await page.close();
  }
  process.stdout.write(`${JSON.stringify({ status: "PASS", fixtures: "synthetic browser-only C1B2-shaped responses", cases: results, screenshots: artifacts.replaceAll("\\", "/") })}\n`);
} finally {
  await browser.close();
}
