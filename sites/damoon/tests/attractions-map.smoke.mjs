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
  const tileRequests = [];
  let failTiles = false;
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
    await page.route("https://tile.openstreetmap.org/**", async route => {
      tileRequests.push(route.request().url());
      if (failTiles) return route.abort();
      return route.fulfill({ status: 200, contentType: "image/png", body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/OioAAAAASUVORK5CYII=", "base64"), headers: { "cache-control": "public, max-age=86400" } });
    });
    page.on("pageerror", error => pageErrors.push(error.message));
    page.on("request", request => { if (!request.url().startsWith(base) && new URL(request.url()).hostname !== "tile.openstreetmap.org") externalRequests.push(request.url()); });
    for (const locale of locales) for (const width of [390, 1440]) for (const prefix of prefixes[locale]) {
      if (prefix === "/fa" && width === 1440) continue;
      await page.setViewportSize({ width, height: 900 });
      const listTilesBefore = tileRequests.length;
      const response = await page.goto(`${base}${prefix}/attractions`, { waitUntil: "networkidle" });
      const csp = response.headers()["content-security-policy"];
      assert.match(csp, /img-src 'self' data: https:\/\/tile\.openstreetmap\.org(?:;|\s)/);
      assert.doesNotMatch(csp, /img-src[^;]*\*/);
      assert.doesNotMatch(csp, /unsafe-inline|unsafe-eval/);
      assert.match(response.headers()["referrer-policy"], /^strict-origin-when-cross-origin$/);
      assert.equal(await page.locator("html").getAttribute("lang"), locale);
      assert.equal(await page.locator("html").getAttribute("dir"), locale === "en" ? "ltr" : "rtl");
      assert.equal(await page.locator(".da-card").count(), 8);
      assert.equal(await page.locator(".da-details").count(), 8);
      assert.equal(await page.locator(".da-pin-pending").count(), 1);
      assert.equal(await page.locator("iframe").count(), 0);
      assert.equal(await page.locator("[data-da-map]").count(), 1);
      assert.equal(await page.locator("script[data-damoon-leaflet]").count(), 0, "Leaflet stays unloaded before the map enters view");
      assert.equal(tileRequests.length, listTilesBefore, "no tiles are requested before map intersection");
      assert.equal(await page.locator('.da-card a[href*="google.com/maps/dir/"][target="_blank"][rel="noopener noreferrer"]').count(), 8);
      const origins = await page.locator('.da-card a[href*="google.com/maps/dir/"]').evaluateAll(links => links.map(link => new URL(link.href).searchParams.has("origin")));
      assert.ok(origins.every(value => value === false), "destination links do not assume the unverified hotel pin as origin");
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), `${locale} list has no overflow at ${width}px`);
      await page.locator("[data-da-map]").scrollIntoViewIfNeeded();
      await page.waitForFunction(() => document.querySelector('[data-da-map]')?.dataset.mapLoaded === "true");
      await page.waitForFunction(() => document.querySelectorAll(".leaflet-tile").length > 0);
      assert.equal(await page.locator(".leaflet-marker-icon").count(), 9, "attractions overview includes hotel and all eight places");
      const markerTitles = await page.locator(".leaflet-marker-icon").evaluateAll(nodes => nodes.map(node => node.getAttribute("title")));
      const localizedHotelName = { fa: damoonAttractionsData.hotel.name, en: "Damoon Hotel", ar: "فندق دامون" }[locale];
      for (const name of [localizedHotelName, ...damoonAttractionsData.attractions.map(item => item.content[locale].name)]) assert.ok(markerTitles.includes(name), `${locale} marker ${name}`);
      const firstMarker = page.locator(".leaflet-marker-icon").nth(1);
      await firstMarker.focus();
      await firstMarker.press("Enter");
      const popupDirections = page.locator('.leaflet-popup-content a[href*="google.com/maps/dir/"]');
      await popupDirections.waitFor({ state: "visible" });
      const popupDirectionUrl = new URL(await popupDirections.getAttribute("href"));
      assert.ok(popupDirectionUrl.searchParams.has("destination") && !popupDirectionUrl.searchParams.has("origin"));
      assert.equal(await page.locator('.leaflet-popup-content a[href*="/attractions/"]').count(), 1, "marker popup links to the canonical detail route");
      assert.ok(await page.locator(".leaflet-control-attribution").innerText().then(value => value.includes("OpenStreetMap")), "Leaflet attribution is visible");
      assert.ok(tileRequests.every(url => new URL(url).hostname === "tile.openstreetmap.org" && new URL(url).pathname.endsWith(".png")), "tiles use the exact OSM hostname");
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
        const detailTilesBefore = tileRequests.length;
        await page.goto(`${base}${prefix}/attractions/${slug}`, { waitUntil: "networkidle" });
        assert.equal(await page.locator("html").getAttribute("lang"), locale);
        assert.equal(await page.locator("html").getAttribute("dir"), locale === "en" ? "ltr" : "rtl");
        assert.equal(await page.locator(".da-detail").count(), 1);
        assert.equal(await page.locator("[data-da-map]").count(), 1);
        assert.ok(await page.locator('.da-detail-sources a[target="_blank"][rel="noopener noreferrer"]').count() > 0);
        assert.equal(await page.locator("iframe").count(), 0);
        assert.equal(await page.locator('meta[name="robots"]').getAttribute("content"), "noindex, nofollow");
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), `${locale}/${slug} has no overflow at ${width}px`);
        assert.equal(await page.locator("script[data-damoon-leaflet]").count(), 0, "Leaflet is not injected on a detail page until its map is visible");
        assert.equal(tileRequests.length, detailTilesBefore, "detail pages do not fetch tiles before intersection");
        if (slug === "mellat-park" && locale === "en" && width === 390) failTiles = true;
        await page.locator("[data-da-map]").scrollIntoViewIfNeeded();
        await page.waitForFunction(() => document.querySelector('[data-da-map]')?.dataset.mapLoaded === "true");
        assert.equal(await page.locator(".leaflet-marker-icon").count(), 1, "detail map shows only its destination marker");
        assert.equal(await page.locator(".leaflet-marker-icon").getAttribute("title"), damoonAttractionsData.attractions.find(item => item.id === slug).content[locale].name);
        if (failTiles) {
          await page.waitForFunction(() => document.querySelector('[data-map-status]')?.textContent.includes("unavailable"));
          assert.ok(await page.locator(".da-map-external").isVisible(), "tile error leaves the OSM fallback link usable");
          assert.ok(await page.locator(".da-detail-main").isVisible(), "tile error preserves the editorial detail");
          failTiles = false;
        }
      }
    }
    const contactTilesBefore = tileRequests.length;
    const contactResponse = await page.goto(`${base}/en/contact`, { waitUntil: "networkidle" });
    assert.match(contactResponse.headers()["content-security-policy"], /img-src 'self' data: https:\/\/tile\.openstreetmap\.org/);
    assert.equal(await page.locator("[data-map-kind=hotel]").count(), 1);
    assert.ok(await page.locator("[data-map-kind=hotel] + .da-pin-pending, .hospitality-contact-location .da-pin-pending").count() > 0);
    assert.equal(tileRequests.length, contactTilesBefore, "contact map remains deferred until visible");
    await page.locator("[data-map-kind=hotel]").scrollIntoViewIfNeeded();
    await page.waitForFunction(() => document.querySelector('[data-map-kind=hotel]')?.dataset.mapLoaded === "true");
    assert.equal(await page.locator(".leaflet-marker-icon").count(), 1, "contact page maps the hotel point only");
    assert.deepEqual(pageErrors, [], "no browser JavaScript errors");
    assert.deepEqual(externalRequests, [], "rendering pages does not load third-party scripts, styles or non-tile resources");
    const unknown = await fetch(`${base}/attractions/not-a-real-place`);
    assert.equal(unknown.status, 404, "unknown attraction details remain 404");
  } finally {
    await browser?.close();
    child.kill();
  }
});
