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
  let simulateUnavailable = false;
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
    await context.route(url => url.pathname.startsWith("/api/hotel/"), async (route) => {
      apiRequests.push(`${route.request().method()} ${route.request().url()}`);
      const url = new URL(route.request().url());
      if (url.pathname === "/api/hotel/v1/website/properties/damoon") {
        if (simulateUnavailable) return route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "UNAVAILABLE" }) });
        const locale = url.searchParams.get("locale");
        const categories = ["single", "double", "suite-3-person", "suite-4-person", "suite-5-person"].map((slug, index) => ({
          slug, kind: index < 2 ? "ROOM" : "SUITE", order: index, count: [3, 17, 6, 3, 2][index],
          title: `Published ${slug} ${locale}`, description: `Published description ${locale}`,
        }));
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ mode: "PUBLISHED", locale, propertySlug: "damoon", content: { accommodationCatalog: { totalRooms: 20, totalSuites: 11, categories } } }) });
      }
      return route.abort();
    });
    const page = await context.newPage();
    const query = new URLSearchParams({ checkIn: "2027-05-10", checkOut: "2027-05-13", adults: "2", guests: "2", children: "1", childAges: "7" });

    const categories = ["single", "double", "suite-3-person", "suite-4-person", "suite-5-person"];
    for (const locale of ["fa", "en", "ar"]) {
      await page.goto(`${base}/${locale}/rooms?${query}`, { waitUntil: "domcontentloaded" });
      const cards = page.locator(".accommodation-card");
      assert.equal(await cards.count(), 5, `${locale} shows the five selected categories`);
      await page.waitForFunction((activeLocale) => document.querySelector('[data-accommodation-category="single"] [data-accommodation-title]')?.textContent === `Published single ${activeLocale}`, locale);
      for (let index = 0; index < categories.length; index += 1) {
        const category = categories[index];
        const card = cards.nth(index);
        const cta = card.locator(`.accommodation-card__coordinate[href*="room=${category}"]`);
        assert.equal(await cta.count(), 1, `${locale} renders a coordination link for ${category}`);
        assert.ok(await cta.getAttribute("aria-label"), `${locale} ${category} link has an accessible name`);
        assert.ok((await cta.boundingBox())?.height >= 44, `${locale} ${category} link meets the 44px touch target`);
        assert.ok(await card.locator(".accommodation-card__count").innerText(), `${locale} displays the owner-selected category count`);
        const requestUrl = new URL(await cta.getAttribute("href"), base);
        assert.equal(requestUrl.pathname, `/${locale}/contact`, `${locale} link stays in locale`);
        assert.equal(requestUrl.searchParams.get("room"), category, `${locale} selection is retained`);
        for (const [key, value] of Object.entries({ checkIn: "2027-05-10", checkOut: "2027-05-13", adults: "2", guests: "2", children: "1", childAges: "7" })) {
          assert.equal(requestUrl.searchParams.get(key), value, `${locale} ${category} retains ${key}`);
        }
        assert.match(await card.locator(".accommodation-card__actions p").innerText(), /request|رزرو|طلب|تأیید|تأكيد/iu, `${locale} discloses request-only status`);
      }
      const languageLinks = page.locator(".language-switcher__options a");
      assert.equal(await languageLinks.count(), 3, `${locale} offers FA, EN and AR navigation`);
      const englishHref = new URL(await languageLinks.filter({ hasText: "English" }).getAttribute("href"), base);
      assert.equal(englishHref.searchParams.get("checkIn"), "2027-05-10", `${locale} language switch preserves stay context`);
      await page.goto(`${base}/${locale}/rooms/suite-3-person?${query}`, { waitUntil: "domcontentloaded" });
      await page.waitForFunction((activeLocale) => document.querySelector('[data-accommodation-category="suite-3-person"] [data-accommodation-title]')?.textContent === `Published suite-3-person ${activeLocale}`, locale);
      assert.match(await page.locator("[data-accommodation-count]").innerText(), /6/);
    }
    simulateUnavailable = true;
    await page.goto(`${base}/fa/rooms?${query}`, { waitUntil: "domcontentloaded" });
    const fallbackCards = page.locator(".accommodation-card");
    assert.equal(await fallbackCards.count(), 5, "a failed public CMS read retains the bundled five-category fallback");
    for (const count of [3, 17, 6, 3, 2]) assert.ok((await fallbackCards.allInnerTexts()).some((text) => text.includes(String(count))), `fallback retains approved category count ${count}`);
    assert.match(await fallbackCards.first().locator(".accommodation-card__actions p").innerText(), /request|رزرو|طلب|تأیید|تأكيد/iu, "fallback remains request-only");
    assert.ok(apiRequests.every((request) => /^GET http:\/\/127\.0\.0\.1:\d+\/api\/hotel\/v1\/website\/properties\/damoon\?locale=(fa|en|ar)$/.test(request)), "room discovery reads only the published public website content endpoint");
    assert.equal(apiRequests.some((request) => /availability|quote|hold|reservation|payment|requests/i.test(request)), false, "room discovery never calls booking, availability, or payment operations");
    await context.close();
  } finally {
    await browser?.close();
    server.kill();
  }
});
