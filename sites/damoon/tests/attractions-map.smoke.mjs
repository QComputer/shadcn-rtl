import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { chromium } from "playwright";
import { damoonAttractionsData } from "../damoon-attractions-data.js";

const siteRoot = fileURLToPath(new URL("../", import.meta.url));
const slugs = damoonAttractionsData.attractions.map(item => item.id);
const locales = ["fa", "en", "ar"];
const prefixes = { fa: ["", "/fa"], en: ["/en"], ar: ["/ar"] };

test("all attraction list/detail aliases render responsively in fa/en/ar with no embedded map", { timeout: 180000 }, async () => {
  const portServer = createServer();
  await new Promise((resolve, reject) => portServer.once("error", reject).listen(0, "127.0.0.1", resolve));
  const { port } = portServer.address();
  await new Promise((resolve, reject) => portServer.close(error => error ? reject(error) : resolve()));
  const child = spawn(process.execPath, ["server.mjs"], { cwd: siteRoot, env: { ...process.env, PORT: String(port) }, windowsHide: true, stdio: "ignore" });
  let browser;
  const pageErrors = [];
  const externalRequests = [];
  try {
    const base = `http://127.0.0.1:${port}`;
    let ready = false;
    for (let attempt = 0; attempt < 60; attempt++) {
      try { if ((await fetch(`${base}/healthz`)).ok) { ready = true; break; } } catch { /* wait for the local server */ }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.ok(ready, "Damoon static server starts");
    browser = await chromium.launch({ ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}), headless: true });
    const page = await browser.newPage();
    page.on("pageerror", error => pageErrors.push(error.message));
    page.on("request", request => { if (!request.url().startsWith(base)) externalRequests.push(request.url()); });
    for (const locale of locales) for (const width of [390, 1440]) for (const prefix of prefixes[locale]) {
      if (prefix === "/fa" && width === 1440) continue;
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`${base}${prefix}/attractions`, { waitUntil: "networkidle" });
      assert.equal(await page.locator("html").getAttribute("lang"), locale);
      assert.equal(await page.locator("html").getAttribute("dir"), locale === "en" ? "ltr" : "rtl");
      assert.equal(await page.locator(".da-card").count(), 8);
      assert.equal(await page.locator(".da-details").count(), 8);
      assert.equal(await page.locator(".da-pin-pending").count(), 1);
      assert.equal(await page.locator("iframe").count(), 0);
      assert.equal(await page.locator("[data-da-load-map]").count(), 0);
      assert.equal(await page.locator('.da-card a[href*="google.com/maps/dir/"][target="_blank"][rel="noopener noreferrer"]').count(), 8);
      const origins = await page.locator('.da-card a[href*="google.com/maps/dir/"]').evaluateAll(links => links.map(link => new URL(link.href).searchParams.has("origin")));
      assert.ok(origins.every(value => value === false), "destination links do not assume the unverified hotel pin as origin");
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), `${locale} list has no overflow at ${width}px`);
      if (locale === "fa" && prefix === "" && width === 390) {
        await page.setViewportSize({ width: 1440, height: 900 });
        const paletteColors = [];
        for (const palette of ["hermes", "forest", "wood"]) {
          await page.locator(`button[data-palette="${palette}"]`).click();
          assert.equal(await page.locator("html").getAttribute("data-palette"), palette);
          paletteColors.push(await page.locator(".damoon-attractions").evaluate(element => getComputedStyle(element).backgroundColor));
        }
        assert.equal(new Set(paletteColors).size, 3, "each existing palette changes attractions colors");
        const lightColor = paletteColors.at(-1);
        await page.locator("[data-theme-toggle]").click();
        assert.equal(await page.locator("html").getAttribute("data-theme"), "dark");
        assert.notEqual(await page.locator(".damoon-attractions").evaluate(element => getComputedStyle(element).backgroundColor), lightColor);
        await page.locator("[data-theme-toggle]").click();
        assert.equal(await page.locator("html").getAttribute("data-theme"), "light");
        await page.setViewportSize({ width, height: 900 });
      }

      await page.locator('[data-da-filter="nature"]').click();
      const natureCount = damoonAttractionsData.attractions.filter(item => item.category === "nature").length;
      assert.equal(await page.locator(".da-card:not([hidden])").count(), natureCount);
      assert.equal(await page.locator('[data-da-filter="nature"]').getAttribute("aria-pressed"), "true");
      await page.locator('[data-da-filter="all"]').click();
      assert.equal(await page.locator(".da-card:not([hidden])").count(), 8);

      for (const slug of slugs) {
        await page.goto(`${base}${prefix}/attractions/${slug}`, { waitUntil: "networkidle" });
        assert.equal(await page.locator("html").getAttribute("lang"), locale);
        assert.equal(await page.locator("html").getAttribute("dir"), locale === "en" ? "ltr" : "rtl");
        assert.equal(await page.locator(".da-detail").count(), 1);
        assert.ok(await page.locator('.da-detail-sources a[target="_blank"][rel="noopener noreferrer"]').count() > 0);
        assert.equal(await page.locator("iframe").count(), 0);
        assert.equal(await page.locator('meta[name="robots"]').getAttribute("content"), "noindex, nofollow");
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), `${locale}/${slug} has no overflow at ${width}px`);
      }
    }
    assert.deepEqual(pageErrors, [], "no browser JavaScript errors");
    assert.deepEqual(externalRequests, [], "rendering pages does not load third-party resources");
    const unknown = await fetch(`${base}/attractions/not-a-real-place`);
    assert.equal(unknown.status, 404, "unknown attraction details remain 404");
  } finally {
    await browser?.close();
    child.kill();
  }
});
