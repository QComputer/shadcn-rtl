import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { chromium } from "playwright";
import test from "node:test";

async function freePort() {
  const server = createServer();
  await new Promise((resolve, reject) => server.once("error", reject).listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return port;
}

test("Damoon room gallery remains readable and usable across locales, themes, and viewports", async () => {
  const port = await freePort();
  const server = spawn(process.execPath, ["sites/damoon/server.mjs"], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(port) },
    stdio: "ignore",
  });
  let browser;

  try {
    const baseUrl = `http://127.0.0.1:${port}`;
    let ready = false;
    for (let attempt = 0; attempt < 60; attempt += 1) {
      if (server.exitCode !== null) throw new Error(`Damoon test server exited with ${server.exitCode}`);
      try {
        ready = (await fetch(`${baseUrl}/healthz`)).ok;
        if (ready) break;
      } catch { /* Wait for the local server to bind. */ }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert.equal(ready, true, "local Damoon server becomes ready");

    browser = await chromium.launch({ headless: true, args: ["--disable-extensions"] });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));

    for (const locale of ["fa", "en", "ar"]) {
      const response = await page.goto(`${baseUrl}/${locale}/rooms/vip-suite`, { waitUntil: "networkidle" });
      assert.equal(response?.status(), 200, `${locale} room page loads`);
      assert.equal(await page.locator(".accommodation-page").getAttribute("dir"), locale === "en" ? "ltr" : "rtl");

      const gallery = page.locator(".accommodation-gallery__main");
      assert.ok((await gallery.getAttribute("aria-label"))?.length, `${locale} gallery opener has an accessible name`);
      assert.match(await gallery.locator("span").innerText(), /تصویر مفهومی|concept|تصميم/iu);

      for (const width of [360, 390, 640, 768, 1024, 1440]) {
        await page.setViewportSize({ width, height: 844 });
        const bounds = await gallery.boundingBox();
        assert.ok(bounds && bounds.width >= 44 && bounds.height >= 44, `${locale} gallery control remains a usable target at ${width}px`);
        if (width <= 640) {
          assert.ok(Math.abs(bounds.width / bounds.height - 4 / 3) < 0.03, `${locale} mobile gallery uses its compact 4:3 frame at ${width}px`);
        }
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${locale} has no horizontal overflow at ${width}px`);
      }

      await page.setViewportSize({ width: 390, height: 844 });
      const themeToggle = page.locator("[data-theme-toggle]");
      const lightSurface = await page.locator("body").evaluate((element) => getComputedStyle(element).backgroundColor);
      await themeToggle.click();
      const darkSurface = await page.locator("body").evaluate((element) => getComputedStyle(element).backgroundColor);
      assert.notEqual(darkSurface, lightSurface, `${locale} dark mode changes the page surface`);
      assert.equal(await themeToggle.getAttribute("aria-pressed"), "true", `${locale} theme state is announced accessibly`);
      await themeToggle.click();
      assert.equal(await themeToggle.getAttribute("aria-pressed"), "false", `${locale} light mode is restored`);
    }

    await page.goto(`${baseUrl}/fa/gallery`, { waitUntil: "networkidle" });
    const galleryTiles = page.locator(".gallery-tile");
    assert.ok(await galleryTiles.count() > 0, "public gallery contains its approved conceptual set");
    for (const width of [360, 390, 640, 768, 1024]) {
      await page.setViewportSize({ width, height: 844 });
      const firstTile = await galleryTiles.first().boundingBox();
      assert.ok(firstTile && firstTile.width >= 44 && firstTile.height >= 44, `gallery tile is a usable target at ${width}px`);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `gallery has no horizontal overflow at ${width}px`);
    }
    assert.ok((await galleryTiles.first().getAttribute("aria-label"))?.length, "gallery tiles have accessible names");

    assert.deepEqual(pageErrors, [], "room pages render without browser exceptions");
  } finally {
    await browser?.close();
    server.kill();
  }
});
