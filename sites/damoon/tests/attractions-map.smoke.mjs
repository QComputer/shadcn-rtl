import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import test from "node:test";
import { chromium } from "playwright";

const siteRoot = new URL("../", import.meta.url).pathname.replace(/^\/[A-Za-z]:/, value => value.slice(1));

test("attractions and contact map render without overflow on desktop and mobile in fa/en/ar", { timeout: 120000 }, async () => {
  const portServer = createServer();
  await new Promise((resolve, reject) => portServer.once("error", reject).listen(0, "127.0.0.1", resolve));
  const { port } = portServer.address();
  await new Promise((resolve, reject) => portServer.close(error => error ? reject(error) : resolve()));
  const child = spawn(process.execPath, ["server.mjs"], { cwd: siteRoot, env: { ...process.env, PORT: String(port) }, windowsHide: true, stdio: "ignore" });
  let browser;
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
    for (const locale of ["fa", "en", "ar"]) for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      const prefix = locale === "fa" ? "" : `/${locale}`;
      await page.goto(`${base}${prefix}/attractions`, { waitUntil: "networkidle" });
      assert.equal(await page.locator("html").getAttribute("lang"), locale);
      assert.equal(await page.locator("html").getAttribute("dir"), locale === "en" ? "ltr" : "rtl");
      assert.equal(await page.locator(".hospitality-card").count(), 2);
      assert.equal(await page.locator(".hospitality-road-distance").count(), 2);
      assert.equal(await page.locator('.hospitality-card a[target="_blank"][rel="noopener noreferrer"]').count(), 2);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth));
      await page.goto(`${base}${prefix}/contact`, { waitUntil: "networkidle" });
      assert.equal(await page.locator(".hospitality-contact-location a[target=_blank]").count(), 1);
      assert.equal(await page.locator(".hospitality-contact-location iframe").count(), 0);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth));
    }
  } finally {
    await browser?.close();
    child.kill();
  }
});
