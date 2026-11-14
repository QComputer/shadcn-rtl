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

async function waitReady(url, child) {
  for (let attempt = 0; attempt < 40; attempt++) {
    if (child.exitCode !== null) throw new Error(`Damoon server exited early (${child.exitCode}).`);
    try { if ((await fetch(url)).ok) return; } catch { /* wait for startup */ }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error("Damoon local server did not become ready.");
}

test("guest tracking keeps the result for the latest submitted reference", { timeout: 30000 }, async t => {
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
    await waitReady(`${base}/healthz`, child);
    browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}), args: ["--disable-features=HttpsFirstBalancedModeAutoEnable,HttpsUpgrades"] });
    const page = await browser.newPage();
    const firstReference = "first-reference-" + "a".repeat(40);
    const latestReference = "latest-reference-" + "b".repeat(40);
    let releaseFirst;
    const firstHeld = new Promise(resolve => { releaseFirst = resolve; });
    let markFirstArrived;
    const firstArrived = new Promise(resolve => { markFirstArrived = resolve; });

    await page.route("**/api/hotel/v1/requests/status", async route => {
      const { reference } = route.request().postDataJSON();
      if (reference === firstReference) {
        markFirstArrived();
        await firstHeld;
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "RECEIVED" }) });
        return;
      }
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "IN_REVIEW" }) });
    });

    await page.goto(`${base}/en/`, { waitUntil: "networkidle" });
    const input = page.locator("[data-track-reference]");
    const submit = page.locator("[data-track-request] button[type=submit]");
    const result = page.locator("[data-track-result]");

    await input.fill(firstReference);
    await submit.click();
    await firstArrived;

    await input.fill(latestReference);
    const latestResponse = page.waitForResponse(response => response.url().endsWith("/api/hotel/v1/requests/status") && response.request().postData()?.includes(latestReference));
    await submit.click();
    await latestResponse;
    await result.getByText("Under review").waitFor({ state: "visible", timeout: 3000 });

    const receivedResponse = page.waitForResponse(response => response.url().endsWith("/api/hotel/v1/requests/status") && response.request().postData()?.includes(firstReference));
    releaseFirst();
    await receivedResponse;
    await page.waitForTimeout(50);
    await result.getByText("Under review").waitFor({ state: "visible", timeout: 3000 });
    assert.equal((await result.textContent()).trim(), "Under review");
  } finally {
    await browser?.close();
    child.kill();
  }
});
