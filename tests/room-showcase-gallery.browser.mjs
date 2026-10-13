import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const resolveFromPreview = createRequire(import.meta.url);
const requireFromTsx = createRequire(resolveFromPreview.resolve("tsx/package.json"));
const esbuild = requireFromTsx("esbuild");
const baseUrl = process.env.F1_PREVIEW_URL ?? "http://127.0.0.1:3117";
const artifacts = fileURLToPath(new URL("../artifacts/", import.meta.url));
await mkdir(artifacts, { recursive: true });

const fixtureBundle = await esbuild.build({
  entryPoints: [fileURLToPath(new URL("./fixtures/room-showcase-gallery.tsx", import.meta.url))],
  bundle: true,
  write: false,
  platform: "browser",
  format: "iife",
  jsx: "automatic",
  alias: { "next/image": fileURLToPath(new URL("./fixtures/room-showcase-image.tsx", import.meta.url)) },
  plugins: [{
    name: "test-only-css-module",
    setup(build) {
      build.onLoad({ filter: /room-showcase\.module\.css$/ }, async ({ path }) => {
        const css = await readFile(path, "utf8");
        const classes = [...new Set([...css.matchAll(/\.([A-Za-z_][\w-]*)/g)].map((match) => match[1]))];
        return {
          loader: "js",
          contents: `const style = document.createElement("style"); style.textContent = ${JSON.stringify(css)}; document.head.append(style); export default ${JSON.stringify(Object.fromEntries(classes.map((name) => [name, name])))};`,
        };
      });
    },
  }],
});
const bundle = fixtureBundle.outputFiles[0];
assert.ok(bundle, "browser fixture must bundle successfully");

const chromePath = process.env.F1_CHROME_PATH ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const browser = await chromium.launch({
  headless: true,
  args: ["--disable-extensions", "--disable-component-extensions-with-background-pages"],
  ...(existsSync(chromePath) ? { executablePath: chromePath } : {}),
});
const failures = [];
const canceledResponsiveImages = [];
const pageErrors = [];
const requests = [];
const page = await browser.newPage({ viewport: { width: 1665, height: 896 }, deviceScaleFactor: 1 });
page.on("pageerror", (error) => pageErrors.push(error.message));
page.on("request", (request) => requests.push(request.url()));
page.on("requestfailed", (request) => {
  const reason = request.failure()?.errorText;
  if (reason === "net::ERR_ABORTED" && new URL(request.url()).pathname === "/_next/image") canceledResponsiveImages.push(request.url());
  else failures.push(`${request.url()}: ${reason}`);
});
page.on("response", (response) => { if (response.status() >= 400) failures.push(`${response.status()} ${response.url()}`); });

async function assertVisibleImagesDecoded() {
  await page.waitForFunction(() => [...document.images].filter((image) => {
    const rect = image.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < innerHeight && rect.right > 0 && rect.left < innerWidth;
  }).every((image) => image.complete && image.naturalWidth > 0), null, { timeout: 15000 });
  const broken = await page.evaluate(() => [...document.images].filter((image) => {
    const rect = image.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < innerHeight && rect.right > 0 && rect.left < innerWidth && image.naturalWidth === 0;
  }).map((image) => image.currentSrc || image.src));
  assert.deepEqual(broken, [], "no visible responsive image remains broken after canceled requests");
}

try {
  const response = await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
  assert.equal(response?.status(), 200);
  const normalShowcase = page.getByTestId("room-showcase");
  await normalShowcase.scrollIntoViewIfNeeded();
  const normalOpener = normalShowcase.getByRole("button", { name: "مشاهده تصاویر نمونه‌ی تصویری یک" });
  await normalOpener.click();
  const normalDialog = page.getByTestId("room-gallery-dialog");
  await normalDialog.waitFor();
  await normalDialog.locator("img").evaluate((image) => image.decode());
  assert.equal(await normalDialog.getByRole("button", { name: "تصویر قبلی اتاق" }).isDisabled(), true);
  assert.equal(await normalDialog.getByRole("button", { name: "تصویر بعدی اتاق" }).isDisabled(), true);
  assert.match(await normalDialog.innerText(), /۱ از ۱/);
  await page.keyboard.press("Escape");
  await normalDialog.waitFor({ state: "detached" });
  assert.equal(await normalOpener.evaluate((button) => document.activeElement === button), true);
  let releaseObsoleteImage;
  const obsoleteImageCaptured = new Promise((resolve) => { releaseObsoleteImage = resolve; });
  let obsoleteImageRoute;
  const holdOneResponsiveImage = async (route) => {
    if (!obsoleteImageRoute) {
      obsoleteImageRoute = route;
      releaseObsoleteImage();
      return;
    }
    await route.continue();
  };
  await page.route("**/_next/image**", holdOneResponsiveImage);
  await page.setViewportSize({ width: 390, height: 844 });
  await Promise.race([
    obsoleteImageCaptured,
    new Promise((_, reject) => setTimeout(() => reject(new Error("No responsive image request to cancel")), 5000)),
  ]);
  await page.setViewportSize({ width: 820, height: 896 });
  await obsoleteImageRoute.abort("aborted").catch(() => {});
  await page.unroute("**/_next/image**", holdOneResponsiveImage);
  for (const width of [1665, 390, 820, 360, 390]) {
    await page.setViewportSize({ width, height: width <= 390 ? 844 : 896 });
  }
  await page.getByTestId("room-showcase").scrollIntoViewIfNeeded();
  await assertVisibleImagesDecoded();
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));

  await page.setViewportSize({ width: 1665, height: 896 });
  await page.setContent('<!doctype html><html lang="fa" dir="rtl"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#f9f6f0;font-family:sans-serif"><main id="root" style="max-width:1000px;margin:50px auto;padding:0 16px"></main></body></html>');
  await page.addScriptTag({ content: bundle.text });
  const showcase = page.getByTestId("room-showcase");
  await showcase.getByRole("button", { name: "مشاهده تصاویر نمونه‌ی تصویری چندگانه" }).waitFor();
  const multiOpener = showcase.getByRole("button", { name: "مشاهده تصاویر نمونه‌ی تصویری چندگانه" });
  await multiOpener.click();
  const dialog = page.getByTestId("room-gallery-dialog");
  await dialog.waitFor();
  const photo = dialog.locator("img");
  const next = dialog.getByRole("button", { name: "تصویر بعدی اتاق" });
  const previous = dialog.getByRole("button", { name: "تصویر قبلی اتاق" });
  const assertPhoto = async (number) => {
    assert.match(await photo.getAttribute("src"), new RegExp(`room-concept-${number}\\.webp$`));
    assert.match(await photo.getAttribute("alt"), /عکس واقعی هتل نیست/);
    await photo.evaluate((image) => image.decode());
    assert.match(await dialog.innerText(), new RegExp(`[۱۲۳] از ۳`));
  };
  await assertPhoto(1);
  assert.equal(await page.evaluate(() => document.body.style.overflow), "hidden");
  await previous.click();
  await assertPhoto(3);
  await next.click();
  await assertPhoto(1);
  await next.click();
  await assertPhoto(2);
  await page.keyboard.press("ArrowLeft");
  await assertPhoto(3);
  await page.keyboard.press("ArrowRight");
  await assertPhoto(2);
  await page.screenshot({ path: `${artifacts}/room-gallery-multi-desktop-open.png`, fullPage: false });
  await dialog.getByRole("button", { name: "بستن تصاویر اتاق" }).focus();
  await page.keyboard.press("Shift+Tab");
  assert.equal(await next.evaluate((button) => document.activeElement === button), true, "Shift+Tab wraps inside dialog");
  await page.keyboard.press("Tab");
  assert.equal(await dialog.getByRole("button", { name: "بستن تصاویر اتاق" }).evaluate((button) => document.activeElement === button), true, "Tab wraps inside dialog");
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "detached" });
  assert.equal(await multiOpener.evaluate((button) => document.activeElement === button), true, "Escape returns focus to opener");
  assert.notEqual(await page.evaluate(() => document.body.style.overflow), "hidden");

  const singleOpener = showcase.getByRole("button", { name: "مشاهده تصاویر نمونه‌ی تصویری تک‌عکس" });
  await singleOpener.click();
  await dialog.waitFor();
  assert.equal(await previous.isDisabled(), true);
  assert.equal(await next.isDisabled(), true);
  assert.match(await dialog.innerText(), /۱ از ۱/);
  await page.keyboard.press("ArrowLeft");
  await assertVisibleImagesDecoded();
  assert.match(await photo.getAttribute("src"), /room-concept-1\.webp$/);
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "detached" });
  assert.equal(await singleOpener.evaluate((button) => document.activeElement === button), true);

  await page.setViewportSize({ width: 390, height: 844 });
  await multiOpener.click();
  await dialog.waitFor();
  const bounds = await dialog.boundingBox();
  assert.ok(bounds && bounds.x >= 0 && bounds.x + bounds.width <= 390, "gallery dialog fits mobile viewport");
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "mobile gallery has no horizontal overflow");
  await next.click();
  await assertPhoto(2);
  await page.screenshot({ path: `${artifacts}/room-gallery-multi-mobile-open.png`, fullPage: false });
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "detached" });
  assert.equal(await multiOpener.evaluate((button) => document.activeElement === button), true);
  await assertVisibleImagesDecoded();

  assert.deepEqual(pageErrors, [], `browser errors: ${pageErrors.join(" | ")}`);
  assert.deepEqual(failures, [], `failed requests: ${failures.join(" | ")}`);
  assert.ok(requests.every((url) => new URL(url).origin === new URL(baseUrl).origin));
  assert.ok(requests.every((url) => !/\/api\/|\/holds(?:\/|$)|\/payments(?:\/|$)/.test(new URL(url).pathname)));
  process.stdout.write(JSON.stringify({ status: "PASS", cases: ["normal single-image controls", "three-image order and wrap-around", "keyboard navigation and focus restoration", "mobile gallery fit", "visible images after obsolete responsive request cancellation"], multiImageCount: 3, responsiveCanceledRequests: canceledResponsiveImages.length, screenshots: ["artifacts/room-gallery-multi-desktop-open.png", "artifacts/room-gallery-multi-mobile-open.png"] }) + "\n");
} finally {
  await browser.close();
}
