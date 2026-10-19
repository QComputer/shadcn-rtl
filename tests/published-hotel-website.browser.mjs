import assert from "node:assert/strict";
import { mkdir, readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import pathUtils from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const testRequire = createRequire(import.meta.url);
const requireFromTsx = createRequire(testRequire.resolve("tsx/package.json"));
const esbuild = requireFromTsx("esbuild");
const artifacts = process.env.HOTEL_WEBSITE_BROWSER_ARTIFACTS ? pathUtils.resolve(process.env.HOTEL_WEBSITE_BROWSER_ARTIFACTS) : fileURLToPath(new URL("../artifacts/hotel-f2-1/", import.meta.url));
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
    gallery: [
      { src: "/api/hotel/v1/website/media/test-room-gallery-1", altText: "تصویر مصنوعی اتاق، یک", sortOrder: 0, slot: "GALLERY" },
      { src: "/api/hotel/v1/website/media/test-room-gallery-2", altText: "تصویر مصنوعی اتاق، دو", sortOrder: 1, slot: "GALLERY" },
      { src: "/api/hotel/v1/website/media/test-room-gallery-3", altText: "تصویر مصنوعی اتاق، سه", sortOrder: 2, slot: "GALLERY" },
    ],
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
    await page.route("**/api/hotel/v1/website/media/**", (route) => {
      const pathname = new URL(route.request().url()).pathname;
      if (viewport.width === 390 && (pathname.endsWith("test-property-gallery") || pathname.endsWith("test-room-gallery-3"))) {
        return route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ code: "NOT_FOUND" }) });
      }
      return route.fulfill({ status: 200, contentType: "image/svg+xml", body: svg("Synthetic UI test only") });
    });
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
    if (viewport.width < 500) {
      const menuButton = page.getByRole("button", { name: "بازکردن فهرست" });
      await menuButton.click();
      const navigation = page.getByRole("navigation", { name: "پیمایش اصلی" });
      await navigation.locator("a").first().waitFor();
      assert.equal(await navigation.locator("a").first().evaluate((link) => document.activeElement === link), true, "opening mobile navigation moves focus to its first destination");
      await page.keyboard.press("Escape");
      assert.equal(await menuButton.evaluate((button) => document.activeElement === button), true, "Escape closes navigation and restores trigger focus");
      assert.equal(await menuButton.getAttribute("aria-expanded"), "false");
    }
    await page.screenshot({ path: `${artifacts}/published-page-${viewport.width}.png`, fullPage: false });
    await page.getByRole("button", { name: "انتخاب تاریخ ورود شمسی" }).click();
    const focusedISO = await page.evaluate(() => document.activeElement?.dataset?.date);
    assert.ok(focusedISO, "Jalali calendar moves focus to its selected Gregorian date");
    await page.keyboard.press("ArrowLeft");
    const forwardISO = await page.evaluate((iso) => { const date = new Date(`${iso}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + 1); return date.toISOString().slice(0, 10); }, focusedISO);
    await page.waitForFunction((iso) => document.activeElement?.dataset?.date === iso, forwardISO);
    await page.keyboard.press("ArrowRight");
    await page.waitForFunction((iso) => document.activeElement?.dataset?.date === iso, focusedISO);
    await page.screenshot({ path: `${artifacts}/jalali-calendar-${viewport.width === 1440 ? "desktop" : "mobile"}.png`, fullPage: false });
    const dayButtons = page.locator('[data-testid^="jalali-day-"]:not(:disabled)');
    const checkInButton = dayButtons.first();
    if (viewport.width < 500) assert.ok(await checkInButton.evaluate((button) => button.getBoundingClientRect().height) >= 44, "mobile Jalali day target is at least 44px tall");
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
    const adultIncrement = page.getByRole("button", { name: "افزایش بزرگسال" });
    if (viewport.width < 500) assert.ok(await adultIncrement.evaluate((button) => button.getBoundingClientRect().height) >= 44, "mobile guest stepper target is at least 44px tall");
    await adultIncrement.click();
    assert.equal(await page.locator('output[aria-label="تعداد بزرگسالان"]').innerText(), "۲");
    await page.getByRole("button", { name: "تأیید مهمانان" }).click();
    if (viewport.width === 390) {
      await page.getByTestId("published-media-unavailable").waitFor();
      const targetSizes = await Promise.all([
        page.getByRole("button", { name: "انتخاب تاریخ ورود شمسی" }).evaluate((element) => element.getBoundingClientRect().height),
        page.getByRole("button", { name: "مشاهده تصاویر دستهٔ آزمون" }).evaluate((element) => element.getBoundingClientRect().height),
      ]);
      assert.ok(targetSizes.every((height) => height >= 44), `touch targets meet 44px minimum: ${targetSizes}`);
      await page.emulateMedia({ reducedMotion: "reduce" });
      const transition = await page.locator('a[class*="_cta"]').first().evaluate((element) => getComputedStyle(element).transitionDuration);
      const seconds = Number.parseFloat(transition) * (transition.endsWith("ms") ? 0.001 : 1);
      assert.ok(seconds <= 0.001, `reduced-motion transition is effectively disabled (${transition})`);
    }
    const galleryOpener = page.getByRole("button", { name: /مشاهده تصاویر دستهٔ آزمون/ });
    await galleryOpener.click();
    const dialog = page.getByTestId("room-gallery-dialog");
    await dialog.waitFor();
    const previousImage = dialog.getByRole("button", { name: "تصویر قبلی اتاق" });
    const nextImage = dialog.getByRole("button", { name: "تصویر بعدی اتاق" });
    if (viewport.width < 500) {
      const galleryControls = await Promise.all([
        dialog.getByRole("button", { name: "بستن تصاویر اتاق" }).evaluate((button) => button.getBoundingClientRect().height),
        nextImage.evaluate((button) => button.getBoundingClientRect().height),
      ]);
      assert.ok(galleryControls.every((height) => height >= 44), `mobile gallery targets meet 44px minimum: ${galleryControls}`);
    }
    assert.equal(await previousImage.isDisabled(), false);
    assert.equal(await nextImage.isDisabled(), false);
    assert.equal(await dialog.locator("img").getAttribute("alt"), "تصویر مصنوعی اتاق، یک");
    await nextImage.click();
    assert.equal(await dialog.locator("img").getAttribute("alt"), "تصویر مصنوعی اتاق، دو", "next advances in the supplied image order");
    await page.keyboard.press("ArrowLeft");
    if (viewport.width === 390) {
      await page.getByTestId("published-room-gallery-unavailable").waitFor();
      assert.equal(await dialog.locator("img").count(), 0, "a failed published image is replaced by an accessible fallback, not a broken visible image");
    } else {
      assert.equal(await dialog.locator("img").getAttribute("alt"), "تصویر مصنوعی اتاق، سه");
    }
    await page.keyboard.press("ArrowRight");
    assert.equal(await dialog.locator("img").getAttribute("alt"), "تصویر مصنوعی اتاق، دو", "RTL arrow keys follow the localized reading direction");
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
    results.push({ viewport: `${viewport.width}x${viewport.height}`, locale: "fa", status: "PASS", jalaliSelection: true, guestSelector: true, keyboardNavigation: true, mobileNavigationFocus: viewport.width < 500, imageFailureFallback: viewport.width === 390, sourceUrlPreserved: originalMediaUrl === "/api/hotel/v1/website/media/test-room-gallery-1" });
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
    const activeDate = await page.evaluate(() => document.activeElement?.dataset?.date);
    assert.ok(activeDate, `${locale} calendar initially focuses a selectable Gregorian ISO date`);
    const forwardDateKey = locale === "en" ? "ArrowRight" : "ArrowLeft";
    const backwardDateKey = locale === "en" ? "ArrowLeft" : "ArrowRight";
    await page.keyboard.press(forwardDateKey);
    await page.waitForFunction((initial) => document.activeElement?.dataset?.date !== initial, activeDate);
    const nextDate = await page.evaluate((initial) => {
      const date = new Date(`${initial}T12:00:00Z`);
      date.setUTCDate(date.getUTCDate() + 1);
      return date.toISOString().slice(0, 10);
    }, activeDate);
    assert.equal(await page.evaluate(() => document.activeElement?.dataset?.date), nextDate, `${locale} horizontal date-key movement follows its reading direction and retains ISO state`);
    await page.keyboard.press(backwardDateKey);
    await page.waitForFunction((initial) => document.activeElement?.dataset?.date === initial, activeDate);
    await page.keyboard.press("Escape");
    const galleryOpener = page.getByRole("button", { name: /View images|عرض الصور/ });
    await galleryOpener.click();
    const roomDialog = page.getByTestId("room-gallery-dialog");
    assert.equal(await roomDialog.locator("img").getAttribute("alt"), "تصویر مصنوعی اتاق، یک", `${locale} starts from the first image`);
    await page.keyboard.press("ArrowRight");
    assert.equal(await roomDialog.locator("img").getAttribute("alt"), locale === "en" ? "تصویر مصنوعی اتاق، دو" : "تصویر مصنوعی اتاق، سه", `${locale} arrow keys follow the reading direction`);
    await page.keyboard.press("Escape");
    assert.equal(await galleryOpener.evaluate((button) => document.activeElement === button), true, "localized gallery Escape restores focus");
    results.push({ viewport: "390x844", locale, status: "PASS", jalaliCalendarLocalized: true, calendarKeyboardDirection: locale === "en" ? "LTR" : "RTL", galleryKeyboardDirection: locale === "en" ? "LTR" : "RTL", galleryFocusRestoration: true });
    await page.close();
  }
  const uiStateCases = [
    { name: "unpublished", title: "اطلاعاتی برای نمایش نیست", website: { status: 200, body: { mode: "UNPUBLISHED", locale: "fa", propertySlug: "synthetic-preview-property", content: null, propertyGallery: [], roomGalleries: [] } } },
    { name: "not-found", title: "این صفحه در دسترس نیست", website: { status: 404, body: { error: "NOT_FOUND" } } },
    { name: "website-disabled", title: "نمایش هتل فعلاً فعال نیست", website: { status: 503, body: { error: "WEBSITE_DISABLED" } } },
    { name: "temporary-error", title: "دریافت اطلاعات ممکن نشد", website: { status: 502, body: { error: "INTERNAL_DATABASE_FAILURE" } } },
    { name: "missing-translation", title: "متن این زبان آماده نیست", website: { status: 200, body: { ...property, content: { ...property.content, title: null } } } },
    { name: "empty-rooms", title: "اطلاعات اتاق‌ها موجود نیست", rooms: { ...roomCategories, roomCategories: [] } },
  ];
  for (const scenario of uiStateCases) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const requested = [];
    await page.on("request", (request) => requested.push(new URL(request.url()).pathname));
    await page.route("http://hotel-f2.test/**", (route) => new URL(route.request().url()).pathname === "/" ? route.fulfill({ status: 200, contentType: "text/html", body: '<!doctype html><html lang="fa" dir="rtl"><head><meta name="viewport" content="width=device-width,initial-scale=1" /></head><body style="margin:0"><div id="root"></div></body></html>' }) : route.fallback());
    await page.route("**/api/hotel/v1/website/properties/**", async (route) => {
      const pathname = new URL(route.request().url()).pathname;
      if (pathname.endsWith("/room-categories")) {
        const body = scenario.rooms ?? roomCategories;
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
      }
      const response = scenario.website ?? { status: 200, body: property };
      return route.fulfill({ status: response.status, contentType: "application/json", body: JSON.stringify(response.body) });
    });
    await page.goto("http://hotel-f2.test/?locale=fa");
    await page.addScriptTag({ content: bundle.text });
    await page.getByRole("status").getByText(scenario.title).waitFor();
    assert.equal(await page.getByText("INTERNAL_DATABASE_FAILURE").count(), 0, "internal response details are not shown to guests");
    assert.equal(requested.some((path) => /holds|payments|availability|quote|notification|sms/i.test(path)), false);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    results.push({ viewport: "390x844", locale: "fa", status: "PASS", uiState: scenario.name, internalDetailsHidden: true });
    await page.close();
  }
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    const page = await browser.newPage({ viewport });
    const requested = [];
    const pageErrors = [];
    page.on("request", (request) => requested.push(new URL(request.url()).pathname));
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.route("http://hotel-f2.test/**", (route) => new URL(route.request().url()).pathname === "/" ? route.fulfill({ status: 200, contentType: "text/html", body: '<!doctype html><html lang="fa" dir="rtl"><head><meta name="viewport" content="width=device-width,initial-scale=1" /></head><body style="margin:0"><div id="root"></div></body></html>' }) : route.fallback());
    await page.route("**/uploads/synthetic-preview.webp", (route) => route.fulfill({ status: 200, contentType: "image/svg+xml", body: svg("Conceptual preview only") }));
    await page.goto("http://hotel-f2.test/?locale=fa&mode=review");
    await page.addScriptTag({ content: bundle.text });
    await page.getByTestId("hotel-owner-preview-label").waitFor();
    assert.equal(await page.locator('main[data-provenance="AUTHENTICATED_CMS_PREVIEW"]').count(), 1);
    assert.equal(await page.getByRole("heading", { name: "محتوای مفهومی برای بازبینی" }).count(), 1);
    assert.equal(await page.getByRole("button", { name: "انتخاب تاریخ ورود شمسی" }).count(), 1, "preview retains the Jalali date control");
    assert.equal(await page.locator('[data-testid="room-showcase"]').count(), 0, "preview does not invent room categories");
    assert.equal(requested.some((path) => path.startsWith("/api/")), false, "preloaded private preview does not trigger a public or mutation API request");
    assert.equal(requested.some((path) => /holds|payments|availability|quote|notification|sms/i.test(path)), false);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    if (viewport.width === 390) await page.screenshot({ path: `${artifacts}/organization-owner-preview-mobile.png`, fullPage: false });
    else await page.screenshot({ path: `${artifacts}/organization-owner-preview-desktop.png`, fullPage: false });
    assert.deepEqual(pageErrors, []);
    results.push({ viewport: `${viewport.width}x${viewport.height}`, locale: "fa", status: "PASS", ownerPreviewLabeled: true, noPublicOrMutationRequests: true, noInventedRooms: true });
    await page.close();
  }
  for (const locale of ["en", "ar"]) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const requested = [];
    page.on("request", (request) => requested.push(new URL(request.url()).pathname));
    await page.route("http://hotel-f2.test/**", (route) => new URL(route.request().url()).pathname === "/" ? route.fulfill({ status: 200, contentType: "text/html", body: '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1" /></head><body style="margin:0"><div id="root"></div></body></html>' }) : route.fallback());
    await page.route("**/uploads/synthetic-preview.webp", (route) => route.fulfill({ status: 200, contentType: "image/svg+xml", body: svg("Conceptual preview only") }));
    await page.goto(`http://hotel-f2.test/?locale=${locale}&mode=review`);
    await page.addScriptTag({ content: bundle.text });
    const expectedHeading = locale === "en" ? "Conceptual content for review" : "محتوى تصوري للمراجعة";
    await page.getByTestId("hotel-owner-preview-label").waitFor();
    assert.equal(await page.getByRole("heading", { name: expectedHeading }).count(), 1);
    assert.equal(await page.locator("main").getAttribute("dir"), locale === "en" ? "ltr" : "rtl");
    assert.equal(requested.some((path) => path.startsWith("/api/")), false);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    results.push({ viewport: "390x844", locale, status: "PASS", ownerPreviewLocalized: true, direction: locale === "en" ? "LTR" : "RTL", noApiRequests: true });
    await page.close();
  }
  const syntheticPage = await browser.newPage();
  const syntheticRequests = [];
  syntheticPage.on("request", (request) => syntheticRequests.push(new URL(request.url()).pathname));
  await syntheticPage.route("http://hotel-f2.test/**", (route) => route.fulfill({ status: 200, contentType: "text/html", body: '<!doctype html><html><body><div id="root"></div></body></html>' }));
  await syntheticPage.goto("http://hotel-f2.test/?mode=synthetic-public");
  await syntheticPage.addScriptTag({ content: bundle.text });
  await syntheticPage.locator('[data-hotel-state="UNAVAILABLE_PROPERTY"]').waitFor();
  assert.equal(await syntheticPage.getByRole("heading", { name: "محتوای مفهومی برای بازبینی" }).count(), 0);
  assert.equal(syntheticRequests.some((url) => url.startsWith("/api/")), false);
  results.push({ status: "PASS", knownSyntheticPublicPresentationRejected: true, noApiRequests: true });
  await syntheticPage.close();
  process.stdout.write(`${JSON.stringify({ status: "PASS", fixtures: "synthetic browser-only C1B2-shaped responses", cases: results, screenshots: artifacts.replaceAll("\\", "/") })}\n`);
} finally {
  await browser.close();
}
