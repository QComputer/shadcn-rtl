import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { chromium } from "playwright";

const siteRoot = dirname(dirname(fileURLToPath(import.meta.url)));

async function freePort() {
  const server = createServer();
  await new Promise((resolve, reject) => server.once("error", reject).listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  return port;
}

test("guest coordination sends only requested stay details and keeps the feature gate visible", { timeout: 60000 }, async t => {
  const executablePath = process.env.CHROME_PATH || (process.platform === "win32" ? "C:/Program Files/Google/Chrome/Application/chrome.exe" : undefined);
  if (executablePath && !existsSync(executablePath)) {
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
  try {
    for (let attempt = 0; attempt < 40; attempt++) {
      if (child.exitCode !== null) throw new Error(`Damoon server exited early (${child.exitCode}).`);
      try { if ((await fetch(`${base}/healthz`)).ok) break; } catch { /* wait for startup */ }
      await new Promise(resolve => setTimeout(resolve, 100));
      if (attempt === 39) throw new Error("Damoon local server did not become ready.");
    }
    const executable = executablePath && existsSync(executablePath) ? executablePath : undefined;
    browser = await chromium.launch({ headless: true, ...(executable ? { executablePath: executable } : {}), args: ["--disable-features=HttpsFirstBalancedModeAutoEnable,HttpsUpgrades"] });
    const page = await browser.newPage();
    await page.setViewportSize({ width: 390, height: 844 });
    const checkIn = new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10);
    const checkOut = new Date(Date.now() + 12 * 86400000).toISOString().slice(0, 10);
    await page.goto(`${base}/en/rooms?checkIn=${checkIn}&checkOut=${checkOut}&adults=2&children=1&childAges=7`, { waitUntil: "networkidle" });

    const availabilityRequests = [];
    page.on("request", request => {
      if (request.url().endsWith("/api/hotel/v1/availability/search")) availabilityRequests.push(request.url());
    });
    await page.locator(".booking-form .booking-submit[type=submit]").click();
    await page.locator("[data-create-coordination-request]").waitFor({ state: "visible" });
    await page.locator("[data-coordination-name]").fill("Guest Test");
    await page.locator("[data-coordination-phone]").fill("09123456789");
    await page.locator("[data-coordination-note]").fill("Please contact me in the afternoon");
    await page.goto(`${base}/fa/rooms?checkIn=${checkIn}&checkOut=${checkOut}&adults=2&children=1&childAges=7`, { waitUntil: "networkidle" });
    await page.locator("[data-create-coordination-request]").waitFor({ state: "visible" });
    const bookingBounds = await page.locator(".booking-strip").boundingBox();
    assert.ok(bookingBounds && bookingBounds.x >= 0 && bookingBounds.x + bookingBounds.width <= 390, "the coordination form stays within the mobile viewport");
    assert.equal(await page.locator("[data-coordination-name]").inputValue(), "Guest Test", "contact details survive a locale navigation");
    assert.equal(await page.locator("[data-coordination-note]").inputValue(), "Please contact me in the afternoon", "special requests survive a locale navigation");

    let requestPayload;
    let idempotencyKey;
    await page.route("**/api/hotel/v1/requests", async route => {
      requestPayload = route.request().postDataJSON();
      idempotencyKey = route.request().headers()["idempotency-key"];
      await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ reference: "R".repeat(43), status: "RECEIVED", inventoryReserved: false, bookingConfirmed: false }) });
    });
    const response = page.waitForResponse(r => r.url().endsWith("/api/hotel/v1/requests") && r.request().method() === "POST");
    await page.locator("[data-coordination-phone]").press("Enter");
    await response;

    assert.deepEqual(availabilityRequests, [], "coordination requests do not call the availability API");
    assert.equal(requestPayload.kind, "coordination");
    assert.equal(requestPayload.property, "damoon-hotel");
    assert.equal(requestPayload.checkIn, checkIn);
    assert.equal(requestPayload.checkOut, checkOut);
    assert.deepEqual(requestPayload.occupancy, { adults: 2, children: 1, childAges: [7] });
    assert.deepEqual(requestPayload.contact, { fullName: "Guest Test", phone: "09123456789" });
    assert.equal(requestPayload.specialRequests, "Please contact me in the afternoon");
    assert.equal(Object.keys(requestPayload).some(key => /room|rate|price|payment/i.test(key)), false);
    assert.match(idempotencyKey, /^damoon-[a-f0-9]{64}$/);
    assert.match(await page.locator("[data-booking-flow]").innerText(), /درخواست هماهنگی برای پذیرش ارسال شد/);
    assert.match(await page.locator("[data-booking-flow]").innerText(), /R{20}/);
    await page.goto(`${base}/en/rooms?checkIn=${checkIn}&checkOut=${checkOut}&adults=2&children=1&childAges=7`, { waitUntil: "networkidle" });
    assert.match(await page.locator("[data-booking-flow]").innerText(), /coordination request sent to reception/i, "the secure tracking reference and status survive a locale navigation");
    assert.match(await page.locator("[data-booking-flow]").innerText(), /R{20}/);

    const disabledPage = await browser.newPage();
    await disabledPage.goto(`${base}/en/rooms?checkIn=${checkIn}&checkOut=${checkOut}`, { waitUntil: "networkidle" });
    const retryKeys = [];
    let disabledAttempts = 0;
    await disabledPage.route("**/api/hotel/v1/requests", route => {
      retryKeys.push(route.request().headers()["idempotency-key"]);
      disabledAttempts += 1;
      return route.fulfill(disabledAttempts === 1
        ? { status: 503, contentType: "application/json", body: JSON.stringify({ error: "Stay requests are not enabled" }) }
        : disabledAttempts === 2
          ? { status: 429, contentType: "application/json", body: JSON.stringify({ error: "Too many requests" }) }
          : { status: 201, contentType: "application/json", body: JSON.stringify({ reference: "S".repeat(43), status: "RECEIVED" }) });
    });
    await disabledPage.locator(".booking-form .booking-submit[type=submit]").click();
    await disabledPage.locator("[data-coordination-name]").fill("Guest Test");
    await disabledPage.locator("[data-coordination-phone]").fill("09123456789");
    await disabledPage.locator("[data-create-coordination-request]").click();
    await disabledPage.locator(".booking-message").getByText(/not enabled yet/i).waitFor({ state: "visible" });
    assert.equal(await disabledPage.locator("[data-coordination-name]").inputValue(), "Guest Test", "a disabled feature keeps the entered form available for retry");
    await disabledPage.goto(`${base}/fa/rooms?checkIn=${checkIn}&checkOut=${checkOut}`, { waitUntil: "networkidle" });
    await disabledPage.locator("[data-create-coordination-request]").waitFor({ state: "visible" });
    assert.equal(await disabledPage.locator("[data-coordination-phone]").inputValue(), "09123456789", "retry details survive a second locale navigation");
    await disabledPage.locator("[data-coordination-phone]").press("Enter");
    await disabledPage.locator(".booking-message").getByText(/درخواست‌های زیادی ثبت شده است/).waitFor({ state: "visible" });
    assert.equal(await disabledPage.locator("[data-coordination-name]").inputValue(), "Guest Test", "rate limiting preserves the editable draft");
    await disabledPage.locator("[data-coordination-phone]").press("Enter");
    await disabledPage.locator("[data-booking-flow]").getByText(/درخواست هماهنگی برای پذیرش ارسال شد/).waitFor({ state: "visible" });
    assert.equal(disabledAttempts, 3);
    assert.equal(new Set(retryKeys).size, 1, "ambiguous and rate-limited retries reuse the same idempotency key");
    await disabledPage.close();
  } finally {
    await browser?.close();
    child.kill();
  }
});

test("direct localized reservation URLs stay request-only and never call booking operations", { timeout: 60000 }, async t => {
  const executablePath = process.env.CHROME_PATH || (process.platform === "win32" ? "C:/Program Files/Google/Chrome/Application/chrome.exe" : undefined);
  if (executablePath && !existsSync(executablePath)) {
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
  try {
    for (let attempt = 0; attempt < 40; attempt++) {
      if (child.exitCode !== null) throw new Error(`Damoon server exited early (${child.exitCode}).`);
      try { if ((await fetch(`${base}/healthz`)).ok) break; } catch { /* wait for startup */ }
      await new Promise(resolve => setTimeout(resolve, 100));
      if (attempt === 39) throw new Error("Damoon local server did not become ready.");
    }
    const executable = executablePath && existsSync(executablePath) ? executablePath : undefined;
    browser = await chromium.launch({ headless: true, ...(executable ? { executablePath: executable } : {}), args: ["--disable-features=HttpsFirstBalancedModeAutoEnable,HttpsUpgrades"] });
    const checkIn = new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10);
    const checkOut = new Date(Date.now() + 12 * 86400000).toISOString().slice(0, 10);
    const forbiddenOperations = [];

    for (const [routeLocale, locale] of [["", "fa"], ["fa", "fa"], ["en", "en"], ["ar", "ar"]]) {
      const page = await browser.newPage();
      const route = `${routeLocale ? `/${routeLocale}` : ""}/hotel-reservations/start?checkIn=${checkIn}&checkOut=${checkOut}&adults=2&children=0`;
      await page.route("**/api/hotel/v1/**", async intercepted => {
        const pathname = new URL(intercepted.request().url()).pathname;
        if (pathname !== "/api/hotel/v1/requests") forbiddenOperations.push(`${locale} ${pathname}`);
        await intercepted.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ reference: "D".repeat(43), status: "RECEIVED", inventoryReserved: false, bookingConfirmed: false }) });
      });
      await page.goto(`${base}${route}`, { waitUntil: "networkidle" });
      assert.equal(await page.locator("html").getAttribute("lang"), locale, `${locale}: direct route keeps its language`);
      assert.equal(await page.locator("html").getAttribute("dir"), locale === "en" ? "ltr" : "rtl", `${locale}: direct route keeps its direction`);
      assert.match(await page.locator('meta[name="robots"]').getAttribute("content"), /noindex/);
      assert.doesNotMatch(await page.locator("main").innerText(), /live hotel availability and pricing|التحقق من التوفر والسعر|موجودی و قیمت را از سامانه/i, `${locale}: direct route does not promise price or availability lookup`);
      assert.equal(await page.locator("[data-reservation-entry]").count(), 0, `${locale}: unapproved reservation-preview navigation is absent`);
      await page.locator(".booking-form .booking-submit[type=submit]").click();
      await page.locator("[data-coordination-name]").fill("Guest Test");
      await page.locator("[data-coordination-phone]").fill("09123456789");
      const coordinationText = await page.locator(".booking-step--coordination").innerText();
      assert.match(coordinationText, locale === "fa" ? /هماهنگی.*پذیرش/ : locale === "ar" ? /طلب تنسيق.*الاستقبال/ : /coordination request to reception only/i, `${locale}: direct route explains its request-only behavior`);
      const response = page.waitForResponse(r => r.url().endsWith("/api/hotel/v1/requests") && r.request().method() === "POST");
      await page.locator("[data-create-coordination-request]").click();
      await response;
      await page.locator(".booking-step--confirmed").waitFor({ state: "visible" });
      await page.close();
    }

    assert.deepEqual(forbiddenOperations, [], "direct reservation URLs never call availability, holds, reservations, cancellation, or payment operations");
  } finally {
    await browser?.close();
    child.kill();
  }
});
