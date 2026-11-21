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

    let requestPayload;
    let idempotencyKey;
    await page.route("**/api/hotel/v1/requests", async route => {
      requestPayload = route.request().postDataJSON();
      idempotencyKey = route.request().headers()["idempotency-key"];
      await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ reference: "R".repeat(43), status: "RECEIVED", inventoryReserved: false, bookingConfirmed: false }) });
    });
    const response = page.waitForResponse(r => r.url().endsWith("/api/hotel/v1/requests") && r.request().method() === "POST");
    await page.locator("[data-create-coordination-request]").click();
    await response;

    assert.deepEqual(availabilityRequests, [], "coordination requests do not call the availability API");
    assert.equal(requestPayload.kind, "coordination");
    assert.equal(requestPayload.property, "damoon-hotel");
    assert.equal(requestPayload.checkIn, checkIn);
    assert.equal(requestPayload.checkOut, checkOut);
    assert.deepEqual(requestPayload.occupancy, { adults: 2, children: 1, childAges: [7] });
    assert.deepEqual(requestPayload.contact, { fullName: "Guest Test", phone: "09123456789" });
    assert.equal(Object.keys(requestPayload).some(key => /room|rate|price|payment/i.test(key)), false);
    assert.match(idempotencyKey, /^damoon-[a-f0-9]{64}$/);
    assert.match(await page.locator("[data-booking-flow]").innerText(), /coordination request sent to reception/i);
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
        : { status: 201, contentType: "application/json", body: JSON.stringify({ reference: "S".repeat(43), status: "RECEIVED" }) });
    });
    await disabledPage.locator(".booking-form .booking-submit[type=submit]").click();
    await disabledPage.locator("[data-coordination-name]").fill("Guest Test");
    await disabledPage.locator("[data-coordination-phone]").fill("09123456789");
    await disabledPage.locator("[data-create-coordination-request]").click();
    await disabledPage.locator(".booking-message").getByText(/not enabled yet/i).waitFor({ state: "visible" });
    assert.equal(await disabledPage.locator("[data-coordination-name]").inputValue(), "Guest Test", "a disabled feature keeps the entered form available for retry");
    await disabledPage.locator("[data-create-coordination-request]").click();
    await disabledPage.locator("[data-booking-flow]").getByText(/coordination request sent to reception/i).waitFor({ state: "visible" });
    assert.equal(disabledAttempts, 2);
    assert.equal(retryKeys[0], retryKeys[1], "an ambiguous first response retries with the same idempotency key");
    await disabledPage.close();
  } finally {
    await browser?.close();
    child.kill();
  }
});
