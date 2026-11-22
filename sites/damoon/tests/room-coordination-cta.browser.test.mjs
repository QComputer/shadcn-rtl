import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import test from "node:test";
import { chromium } from "playwright";

async function freePort() {
  const server = createServer();
  await new Promise((resolve, reject) => server.once("error", reject).listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  return port;
}

test("room cards offer accessible request-only coordination and preserve stay details in fa/en/ar", { timeout: 60000 }, async () => {
  const port = await freePort();
  const base = `http://127.0.0.1:${port}`;
  const server = spawn(process.execPath, ["sites/damoon/server.mjs"], {
    cwd: process.cwd(), env: { ...process.env, PORT: String(port) }, windowsHide: true, stdio: "ignore",
  });
  let browser;
  const apiRequests = [];
  try {
    let ready = false;
    for (let attempt = 0; attempt < 60; attempt += 1) {
      if (server.exitCode !== null) throw new Error(`Damoon server exited with ${server.exitCode}`);
      try { ready = (await fetch(`${base}/healthz`)).ok; if (ready) break; } catch { /* Wait for startup. */ }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.equal(ready, true, "standalone Damoon server becomes ready");
    browser = await chromium.launch({ headless: true, args: ["--disable-extensions"] });
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await context.route(url => url.pathname.startsWith("/api/hotel/"), route => {
      apiRequests.push(route.request().url());
      return route.abort();
    });
    const page = await context.newPage();
    const query = new URLSearchParams({ checkIn: "2027-05-10", checkOut: "2027-05-13", adults: "2", guests: "2", children: "1", childAges: "7" });

    for (const [locale, category] of [["fa", "vip-suite"], ["en", "standard-room"], ["ar", "studio-suite"]]) {
      await page.goto(`${base}/${locale}/rooms?${query}`, { waitUntil: "domcontentloaded" });
      const cta = page.locator(`.accommodation-card__coordinate[href*="room=${category}"]`);
      assert.equal(await cta.count(), 1, `${locale} renders a category-specific coordination link`);
      assert.ok(await cta.getAttribute("aria-label"), `${locale} link has an accessible name`);
      assert.ok((await cta.boundingBox())?.height >= 44, `${locale} link meets the 44px touch target`);
      const requestUrl = new URL(await cta.getAttribute("href"), base);
      assert.equal(requestUrl.pathname, `/${locale}/contact`, `${locale} link stays in locale`);
      assert.equal(requestUrl.searchParams.get("room"), category, `${locale} selection is retained`);
      for (const [key, value] of Object.entries({ checkIn: "2027-05-10", checkOut: "2027-05-13", adults: "2", guests: "2", children: "1", childAges: "7" })) {
        assert.equal(requestUrl.searchParams.get(key), value, `${locale} retains ${key}`);
      }
      assert.match(await cta.locator("xpath=..").locator("p").innerText(), /request|رزرو|طلب|تأیید|تأكيد/iu, `${locale} discloses request-only status`);
      const languageLinks = page.locator(".language-switcher__options a");
      assert.equal(await languageLinks.count(), 3, `${locale} offers FA, EN and AR navigation`);
      const englishHref = new URL(await languageLinks.filter({ hasText: "English" }).getAttribute("href"), base);
      assert.equal(englishHref.searchParams.get("checkIn"), "2027-05-10", `${locale} language switch preserves stay context`);
    }
    assert.deepEqual(apiRequests, [], "room discovery does not call booking or inventory APIs");
    await context.close();
  } finally {
    await browser?.close();
    server.kill();
  }
});
