import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const playwrightEntry = process.env.RETAIL_R5_PLAYWRIGHT_ENTRY;
if (!playwrightEntry) throw new Error("RETAIL_R5_PLAYWRIGHT_ENTRY must point to Playwright");
const password = process.env.RETAIL_R4_TEST_PASSWORD;
if (!password) throw new Error("RETAIL_R4_TEST_PASSWORD is required");
const baseUrl = process.env.RETAIL_R5_BASE_URL || "http://127.0.0.1:3000";
const evidenceDir = path.resolve("artifacts/retail-r5-browser");
const { chromium } = await import(pathToFileURL(playwrightEntry).href);

async function capture(page, filename) {
  const session = await page.context().newCDPSession(page);
  try {
    const { data } = await session.send("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false });
    await fs.writeFile(path.join(evidenceDir, filename), Buffer.from(data, "base64"));
  } finally {
    await session.detach();
  }
}

async function main() {
  await fs.mkdir(evidenceDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const externalCafeRequests = [];
  context.on("request", (request) => {
    const url = new URL(request.url());
    if (url.hostname === "iran.cafeleo.vip" || url.hostname.endsWith(".cafeleo.vip")) externalCafeRequests.push(request.url());
  });
  const page = await context.newPage();
  await page.route("https://fonts.googleapis.com/**", (route) => route.fulfill({ status: 200, contentType: "text/css", body: "" }));
  await page.route("https://fonts.gstatic.com/**", (route) => route.abort());
  try {
    await page.goto(`${baseUrl}/fa/login?callbackUrl=${encodeURIComponent("/fa/cafe-leo/shop/checkout")}`);
    await page.locator("#username").fill("r4-synthetic-customer@example.test");
    await page.locator("#password").fill(password);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL((url) => !url.pathname.endsWith("/login"), { timeout: 60000 });
    const session = await context.request.get(`${baseUrl}/api/auth/session`);
    assert.equal(session.status(), 200);
    assert.ok((await session.json()).user?.id, "synthetic Cafe Shop customer must authenticate");

    await page.goto(`${baseUrl}/fa/cafe-leo/shop`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.getByText("[R5-SYNTHETIC] قهوه آزمایشی").first().waitFor({ timeout: 30000 });
    const detailResponse = await context.request.get(`${baseUrl}/api/public/v1/organizations/cafe-leo/products/r5-synthetic-cafe-coffee`);
    assert.equal(detailResponse.status(), 200, "Cafe Leo synthetic retail product must be public through Bazarbaaz");
    const detailEnvelope = await detailResponse.json();
    const detail = detailEnvelope.data ?? detailEnvelope;
    const variant = detail.variants?.find((candidate) => candidate.orderable && candidate.id);
    assert.ok(variant, "Cafe Leo product must expose an available purchasable variant");
    const productLink = page.getByRole("link", { name: "[R5-SYNTHETIC] قهوه آزمایشی" }).first();
    await productLink.click();
    await page.getByRole("heading", { name: "[R5-SYNTHETIC] قهوه آزمایشی" }).waitFor();
    assert.ok(await page.getByText(/۱۲۵٬۰۰۰/).count(), "native Shop product detail shows the persisted fixture price");
    await capture(page, "cafe-native-product.png");
    await page.getByRole("button", { name: "افزودن به سبد خرید" }).click();
    await page.getByText("کالا به سبد خرید اضافه شد.", { exact: true }).waitFor();
    await page.getByRole("link", { name: "سبد خرید" }).click();
    await page.waitForURL((url) => url.pathname === "/fa/cafe-leo/shop/checkout", { timeout: 30000 });
    // Retail-configured shops use the shared storefront/cart/checkout engine
    // at native Shop paths; restaurant routes retain the legacy behavior.
    await page.getByRole("heading", { name: "تکمیل سفارش" }).waitFor({ timeout: 30000 });
    const method = page.locator("select").first();
    await method.waitFor();
    assert.equal(await method.locator('option[value="INOTI_USSD"]').count(), 1, "Cafe Leo Shop must offer its configured dedicated USSD option");
    await method.selectOption("INOTI_USSD");
    await capture(page, "cafe-native-checkout.png");
    await page.getByRole("button", { name: "ثبت سفارش" }).click();
    const confirmation = page.getByRole("heading", { name: /^سفارش RET-[A-Z0-9-]+ ثبت شد$/ });
    await confirmation.waitFor({ timeout: 30000 });
    const orderNumber = (await confirmation.innerText()).match(/RET-[A-Z0-9-]+/)?.[0];
    assert.ok(orderNumber, "native Cafe Shop checkout must create a persisted Bazarbaaz order");
    await page.getByText("در انتظار بررسی").waitFor();
    await page.getByText("R5CAFE", { exact: false }).waitFor();
    assert.ok(await page.locator("text=/تأیید ارائه‌دهنده/").count(), "customer must be told that payment remains pending until provider confirmation");
    await capture(page, "cafe-native-payment-pending.png");

    assert.deepEqual(externalCafeRequests, [], "Cafe native Shop browser flow must make zero requests to external Cafe Leo hosts");
    console.log(JSON.stringify({ status: "PASSED", orderNumber, paymentState: "PENDING", paymentInitiation: "NONE", externalCafeRequests: 0, screenshots: evidenceDir }));
  } finally {
    await context.close();
    await browser.close();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
