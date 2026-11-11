import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { createServer as createHttpServer } from "node:http";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { chromium } from "playwright";

const siteRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const sharedPublicRoot = resolve(siteRoot, "../../public");

async function freePort() {
  const server = createServer();
  await new Promise((resolve, reject) => server.once("error", reject).listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  return port;
}

async function waitReady(url, child) {
  for (let attempt = 0; attempt < 40; attempt++) {
    if (child.exitCode !== null) throw new Error(`Damoon server exited early (${child.exitCode}).`);
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch { /* The server is still starting. */ }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error("Damoon local server did not become ready.");
}

async function startSharedBundleServer() {
  const contentTypes = {
    ".css": "text/css; charset=utf-8", ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8",
    ".png": "image/png", ".svg": "image/svg+xml", ".ttf": "font/ttf", ".webp": "image/webp",
  };
  const server = createHttpServer(async (request, response) => {
    if (request.method !== "GET" && request.method !== "HEAD") {
      response.writeHead(405, { allow: "GET, HEAD" });
      response.end();
      return;
    }
    let pathname;
    try { pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname); }
    catch { response.writeHead(400); response.end(); return; }

    if (pathname === "/healthz") { response.writeHead(200); response.end("ok"); return; }
    let file;
    if (pathname === "/damoon-front" || pathname === "/damoon-front/") {
      file = resolve(sharedPublicRoot, "damoon-front/index.html");
    } else if (pathname.startsWith("/damoon-front/")) {
      file = resolve(sharedPublicRoot, `.${pathname}`);
      const bundleRoot = resolve(sharedPublicRoot, "damoon-front");
      if (!file.startsWith(bundleRoot + sep)) { response.writeHead(404); response.end(); return; }
    } else if (!extname(pathname)) {
      file = resolve(sharedPublicRoot, "damoon-front/index.html");
    } else {
      response.writeHead(404); response.end(); return;
    }

    try {
      const body = await readFile(file);
      response.writeHead(200, {
        "content-type": contentTypes[extname(file).toLowerCase()] || "application/octet-stream",
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
      });
      response.end(request.method === "HEAD" ? undefined : body);
    } catch { response.writeHead(404); response.end(); }
  });
  await new Promise((resolveListen, reject) => server.once("error", reject).listen(0, "127.0.0.1", resolveListen));
  const { port } = server.address();
  return { base: `http://127.0.0.1:${port}`, close: () => new Promise((resolveClose, reject) => server.close(error => error ? reject(error) : resolveClose())) };
}

test("standalone and shared Damoon bundles preserve localized contact party details", { timeout: 120000 }, async t => {
  const executablePath = process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";
  if (!existsSync(executablePath)) {
    t.skip("Installed Chrome is unavailable; this regression requires the existing browser runtime.");
    return;
  }

  const port = await freePort();
  const base = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, [join(siteRoot, "server.mjs")], {
    cwd: siteRoot,
    env: { ...process.env, PORT: String(port) },
    windowsHide: true,
    stdio: "ignore",
  });
  let browser;
  let sharedServer;
  try {
    await waitReady(`${base}/healthz`, child);
    browser = await chromium.launch({ headless: true, executablePath, args: ["--disable-features=HttpsFirstBalancedModeAutoEnable,HttpsUpgrades"] });
    sharedServer = await startSharedBundleServer();
    const now = new Date();
    now.setUTCDate(now.getUTCDate() + 60);
    const checkIn = now.toISOString().slice(0, 10);
    now.setUTCDate(now.getUTCDate() + 2);
    const checkOut = now.toISOString().slice(0, 10);

    const locales = [
      { locale: "fa", adults: "۲ بزرگسال", children: "۱ کودک", ages: "سن کودکان: ۷" },
      { locale: "en", adults: "2 adults", children: "1 child", ages: "Child ages: 7" },
      { locale: "ar", adults: "2 بالغين", children: "1 طفل", ages: "أعمار الأطفال: 7" },
    ];

    for (const runtime of [{ name: "standalone source", base }, { name: "shared public bundle", base: sharedServer.base }]) {
      for (const expected of locales) {
        const context = await browser.newContext();
        const page = await context.newPage();
        const query = new URLSearchParams({ checkIn, checkOut, guests: "2", children: "1", childAges: "7" });
        await page.goto(`${runtime.base}/${expected.locale}/rooms/single?${query}`, { waitUntil: "networkidle" });
        await page.locator("#booking-title").waitFor();
        assert.equal(await page.locator("[data-adult-count]").inputValue(), "2");
        assert.equal(await page.locator("[data-child-count]").inputValue(), "1");
        assert.equal(await page.locator('[data-child-age="0"]').inputValue(), "7");

        const contactHref = await page.locator(".accommodation-coordination__actions .accommodation-link").getAttribute("href");
        const contactUrl = new URL(contactHref, runtime.base);
        assert.equal(contactUrl.pathname, `/${expected.locale}/contact`, `${runtime.name} ${expected.locale} contact locale`);
        assert.equal(contactUrl.searchParams.get("room"), "single", `${runtime.name} ${expected.locale} room`);
        assert.equal(contactUrl.searchParams.get("checkIn"), checkIn, `${runtime.name} ${expected.locale} check-in`);
        assert.equal(contactUrl.searchParams.get("checkOut"), checkOut, `${runtime.name} ${expected.locale} check-out`);
        assert.equal(contactUrl.searchParams.get("guests"), "2", `${runtime.name} ${expected.locale} adults`);
        assert.equal(contactUrl.searchParams.get("children"), "1", `${runtime.name} ${expected.locale} children`);
        assert.equal(contactUrl.searchParams.get("childAges"), "7", `${runtime.name} ${expected.locale} ages`);

        // A separate browser context has empty sessionStorage, so the contact view
        // must rehydrate the complete plan from the URL alone.
        const freshContext = await browser.newContext();
        const freshPage = await freshContext.newPage();
        await freshPage.goto(contactUrl.href, { waitUntil: "networkidle" });
        assert.equal(await freshPage.evaluate(() => sessionStorage.length), 0);
        assert.equal(await freshPage.locator("html").getAttribute("lang"), expected.locale);
        const summary = freshPage.locator(".hospitality-stay-context");
        await summary.waitFor({ state: "visible" });
        const text = await summary.innerText();
        assert.match(text, new RegExp(expected.adults), `${runtime.name} ${expected.locale} adults summary`);
        assert.match(text, new RegExp(expected.children), `${runtime.name} ${expected.locale} children summary`);
        assert.match(text, new RegExp(expected.ages), `${runtime.name} ${expected.locale} age summary`);
        await freshContext.close();

        const zeroChildrenPage = await context.newPage();
        const staleAgeQuery = new URLSearchParams({ checkIn, checkOut, guests: "2", children: "0", childAges: "7" });
        await zeroChildrenPage.goto(`${runtime.base}/${expected.locale}/rooms/single?${staleAgeQuery}`, { waitUntil: "networkidle" });
        await zeroChildrenPage.locator("#booking-title").waitFor();
        const zeroChildrenHref = await zeroChildrenPage.locator(".accommodation-coordination__actions .accommodation-link").getAttribute("href");
        const zeroChildrenUrl = new URL(zeroChildrenHref, runtime.base);
        assert.equal(zeroChildrenUrl.searchParams.get("children"), "0", `${runtime.name} ${expected.locale} zero children`);
        assert.equal(zeroChildrenUrl.searchParams.has("childAges"), false, `${runtime.name} ${expected.locale} stale ages removed`);
        await context.close();
      }
    }
  } finally {
    await browser?.close();
    await sharedServer?.close();
    child.kill();
  }
});
