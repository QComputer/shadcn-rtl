import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import path from "node:path";

/**
 * Verify the real service worker, its cache boundary, and offline/reconnect
 * behavior for one tenant-facing start path.
 */
export async function verifyWorkerAcceptance({ browser, origin, startPath, expectedName, artifactDir, label }) {
  const baseUrl = new URL(origin);
  const startUrl = new URL(startPath, baseUrl);
  assert.equal(startUrl.origin, baseUrl.origin, "start path must stay on the supplied origin");
  assert.ok(expectedName.trim(), "expected tenant name is required");
  assert.ok(label.trim(), "artifact label is required");

  const safeLabel = label.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "tenant";
  const outputDir = path.resolve(artifactDir);
  mkdirSync(outputDir, { recursive: true });
  const offlineScreenshot = path.join(outputDir, `${safeLabel}-offline.png`);
  const reconnectedScreenshot = path.join(outputDir, `${safeLabel}-reconnected.png`);
  const page = await browser.newPage();

  try {
    const response = await page.goto(startUrl.href, { waitUntil: "domcontentloaded" });
    assert.equal(response?.status(), 200, "tenant start page loads before worker checks");

    const workerState = await page.waitForFunction(async () => {
      if (!globalThis.isSecureContext || !("serviceWorker" in navigator)) return null;
      const registration = await navigator.serviceWorker.ready;
      return {
        scope: registration.scope,
        active: Boolean(registration.active),
        controller: Boolean(navigator.serviceWorker.controller),
      };
    }, undefined, { timeout: 20_000 });
    const initialWorker = await workerState.jsonValue();
    assert.equal(new URL(initialWorker.scope).origin, baseUrl.origin, "worker scope uses the tested origin");
    assert.equal(new URL(initialWorker.scope).pathname, "/", "worker controls the origin root");
    assert.equal(initialWorker.active, true, "a service worker is active");

    if (!initialWorker.controller) {
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => Boolean(navigator.serviceWorker?.controller), undefined, { timeout: 10_000 });
    }

    const cacheInventory = await page.evaluate(async () => {
      const names = await caches.keys();
      const entries = [];
      for (const cacheName of names) {
        if (!cacheName.startsWith("bazar-baz-static-")) continue;
        const cache = await caches.open(cacheName);
        for (const request of await cache.keys()) {
          const response = await cache.match(request);
          entries.push({
            cacheName,
            url: request.url,
            contentType: response?.headers.get("content-type") || "",
            cacheControl: response?.headers.get("cache-control") || "",
          });
        }
      }
      return entries;
    });
    assert.ok(cacheInventory.length > 0, "worker static cache has its offline shell");
    const offlineShellUrl = new URL("offline.html", initialWorker.scope).href;
    for (const entry of cacheInventory) {
      const cachedUrl = new URL(entry.url);
      assert.doesNotMatch(cachedUrl.pathname, /\/api(?:\/|$)/i, `API response is not cached: ${entry.url}`);
      assert.doesNotMatch(cachedUrl.pathname, /(?:^|\/)manifest\.webmanifest$/i, `manifest is not cached: ${entry.url}`);
      assert.doesNotMatch(cachedUrl.pathname, /(?:^|\/)favicon\.ico$/i, `favicon identity is not cached: ${entry.url}`);
      assert.doesNotMatch(entry.cacheControl, /(?:private|no-store)/i, `private response is not cached: ${entry.url}`);
      if (/^text\/html\b/i.test(entry.contentType)) {
        assert.equal(entry.url, offlineShellUrl, `only the generic offline shell may be cached as HTML: ${entry.url}`);
      }
      assert.doesNotMatch(cachedUrl.pathname, /\/(?:fa|en|ar)\/(?:retail|shop|dashboard|checkout|account|profile|order|product)(?:\/|$)/i,
        `tenant or private HTML path is not cached: ${entry.url}`);
    }

    await page.context().setOffline(true);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByRole("heading", { level: 1 }).waitFor({ state: "visible", timeout: 10_000 });
    const offlineBody = await page.locator("body").innerText();
    assert.match(offlineBody, /اتصال (?:به )?اینترنت برقرار نیست/, "offline reload shows the generic offline screen");
    assert.doesNotMatch(offlineBody, /Bazarbaaz|بازارباز/i, "offline screen has no platform identity");
    assert.ok(!offlineBody.toLocaleLowerCase().includes(expectedName.toLocaleLowerCase()), "offline screen has no tenant identity");
    await page.screenshot({ path: offlineScreenshot, fullPage: true });

    await page.context().setOffline(false);
    const reconnected = await page.goto(startUrl.href, { waitUntil: "domcontentloaded" });
    assert.equal(reconnected?.status(), 200, "tenant start page reloads after reconnect");
    await page.getByText(expectedName, { exact: false }).first().waitFor({ state: "visible", timeout: 15_000 });
    const reconnectedBody = await page.locator("body").innerText();
    assert.ok(reconnectedBody.toLocaleLowerCase().includes(expectedName.toLocaleLowerCase()), "reconnected page restores the expected tenant identity");
    await page.screenshot({ path: reconnectedScreenshot, fullPage: true });

    return {
      status: "PASSED",
      scope: initialWorker.scope,
      cacheEntries: cacheInventory.length,
      offlineScreenshot,
      reconnectedScreenshot,
    };
  } finally {
    await page.context().setOffline(false).catch(() => undefined);
    await page.close();
  }
}
