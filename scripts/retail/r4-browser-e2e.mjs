import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const playwrightEntry = process.env.RETAIL_R4_PLAYWRIGHT_ENTRY;
if (!playwrightEntry) throw new Error("RETAIL_R4_PLAYWRIGHT_ENTRY must point at the local Playwright entry point.");
const { chromium } = await import(pathToFileURL(playwrightEntry).href);
const baseUrl = process.env.RETAIL_R4_BASE_URL || "http://127.0.0.1:3000";
const password = process.env.RETAIL_R4_TEST_PASSWORD;
if (!password) throw new Error("RETAIL_R4_TEST_PASSWORD is required.");
const fashion = "retail-r4-synthetic-fashion";
const mobile = "retail-r4-synthetic-mobile";
const customerEmail = "r4-synthetic-customer@example.test";
const fashionManager = "r4-synthetic-fashion-manager@example.test";
const mobileManager = "r4-synthetic-mobile-manager@example.test";
const evidenceDir = path.resolve("artifacts/retail-r4-browser");
const receiptBytes = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j2ioAAAAASUVORK5CYII=", "base64");

async function capture(page, filename) {
  await page.screenshot({ path: path.join(evidenceDir, filename), fullPage: false });
}

async function login(browser, email, callback = "/fa/retail/retail-r4-synthetic-fashion") {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.route("https://fonts.googleapis.com/**", (route) => route.fulfill({ status: 200, contentType: "text/css", body: "" }));
  await page.route("https://fonts.gstatic.com/**", (route) => route.abort());
  await page.goto(`${baseUrl}/fa/login?callbackUrl=${encodeURIComponent(callback)}`);
  await page.locator("#username").fill(email);
  await page.locator("#password").fill(password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((url) => !url.pathname.endsWith("/login"), { timeout: 60000 });
  const sessionResponse = await context.request.get(`${baseUrl}/api/auth/session`);
  assert.equal(sessionResponse.status(), 200);
  assert.ok((await sessionResponse.json()).user?.id, `${email} must authenticate`);
  return { context, page };
}

async function api(page, url, { method = "GET", body, form } = {}) {
  const response = await page.evaluate(async ({ url, method, body, formData }) => {
    const options = { method, credentials: "same-origin", headers: {} };
    if (formData) {
      const data = new FormData();
      data.set("method", "RECEIPT");
      data.set("receipt", new Blob([Uint8Array.from(formData.bytes)], { type: "image/png" }), "synthetic-r4-receipt.png");
      options.body = data;
    } else if (body !== undefined) {
      options.headers["content-type"] = "application/json";
      options.body = JSON.stringify(body);
    }
    const result = await fetch(url, options);
    return { status: result.status, body: await result.json().catch(() => ({})) };
  }, { url, method, body, formData: form ? { bytes: [...form] } : null });
  return response;
}

async function checkoutWithReport(page, org, sku, reportType) {
  const detailResponse = await page.context().request.get(`${baseUrl}/api/public/v1/organizations/${org}/products/${sku}`);
  assert.equal(detailResponse.status(), 200, `published synthetic product ${sku} must be visible`);
  const detailJson = await detailResponse.json();
  const detail = detailJson.data ?? detailJson;
  const variant = detail.variants?.find((candidate) => candidate.orderable && candidate.id);
  assert.ok(variant, `orderable variant ID is required for ${sku}`);
  const cart = await api(page, `${baseUrl}/api/retail/v1/cart`, { method: "POST", body: { organization: org, variantId: variant.id, quantity: 1 } });
  assert.equal(cart.status, 201, `customer must add ${sku} to cart: ${JSON.stringify(cart.body)}`);
  const cartRead = await page.context().request.get(`${baseUrl}/api/retail/v1/cart?organization=${org}`);
  assert.equal(cartRead.status(), 200);
  assert.ok(JSON.stringify(await cartRead.json()).includes(variant.id), "cart read must include the selected fixture variant");
  const checkout = await api(page, `${baseUrl}/api/retail/v1/checkout`, { method: "POST", body: {
    organization: org, idempotencyKey: crypto.randomUUID(), type: "PICK_UP", paymentMethod: "BANK_TRANSFER",
  } });
  assert.equal(checkout.status, 201, `bank transfer checkout must succeed: ${JSON.stringify(checkout.body)}`);
  assert.equal(checkout.body.paymentStatus, "PENDING", "checkout must not claim payment success");
  const reportUrl = `${baseUrl}/api/retail/v1/orders/${encodeURIComponent(checkout.body.orderNumber)}/bank-report?organization=${org}`;
  const report = reportType === "RECEIPT"
    ? await api(page, reportUrl, { method: "POST", form: receiptBytes })
    : await api(page, reportUrl, { method: "POST", body: {
      method: "TIME", reportedAt: new Date().toISOString(), submittedLocalTime: "Synthetic R4 test time",
    } });
  assert.equal(report.status, 201, `${reportType} submission must create a pending review: ${JSON.stringify(report.body)}`);
  assert.equal(report.body.report.kind, reportType === "RECEIPT" ? "BANK_RECEIPT" : "BANK_TIME");
  assert.equal(report.body.report.status, "PENDING_REVIEW");
  return { orderNumber: checkout.body.orderNumber, reportId: report.body.report.id };
}

async function main() {
  await fs.mkdir(evidenceDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    const customer = await login(browser, customerEmail);
    await customer.page.goto(`${baseUrl}/fa/retail/${fashion}`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await capture(customer.page, "customer-fashion-storefront.png");
    const receipt = await checkoutWithReport(customer.page, fashion, "r4-synthetic-avid", "RECEIPT");
    const time = await checkoutWithReport(customer.page, fashion, "r4-synthetic-avid", "TIME");
    const unauth = await browser.newPage();
    const unauthReports = await unauth.request.get(`${baseUrl}/api/dashboard/retail/payment-reports`);
    assert.equal(unauthReports.status(), 401, "anonymous report listing must be unauthorized");
    await unauth.close();
    const customerDenied = await api(customer.page, `${baseUrl}/api/dashboard/retail/payment-reports/${receipt.reportId}`, { method: "PATCH", body: { action: "APPROVE" } });
    assert.equal(customerDenied.status, 403, "customer cannot approve reports");
    await customer.context.close();

    const wrongTenant = await login(browser, mobileManager, "/fa/dashboard/retail-payment-reports");
    const scopedBefore = await wrongTenant.context.request.get(`${baseUrl}/api/dashboard/retail/payment-reports`);
    assert.equal(scopedBefore.status(), 200);
    assert.ok(!(await scopedBefore.text()).includes(receipt.reportId), "mobile merchant must not list fashion reports");
    const crossTenantReview = await api(wrongTenant.page, `${baseUrl}/api/dashboard/retail/payment-reports/${receipt.reportId}`, { method: "PATCH", body: { action: "APPROVE" } });
    assert.equal(crossTenantReview.status, 404, "cross-tenant report review must be hidden");
    await wrongTenant.context.close();

    const manager = await login(browser, fashionManager, "/fa/dashboard/retail-payment-reports");
    await manager.page.goto(`${baseUrl}/fa/dashboard/retail-payment-reports`);
    await manager.page.getByRole("heading", { name: "گزارش‌های پرداخت" }).waitFor({ timeout: 30000 });
    await manager.page.getByText(receipt.orderNumber).waitFor();
    await manager.page.getByText(time.orderNumber).waitFor();
    await capture(manager.page, "merchant-pending-payment-reports.png");
    const approve = await api(manager.page, `${baseUrl}/api/dashboard/retail/payment-reports/${receipt.reportId}`, { method: "PATCH", body: { action: "APPROVE" } });
    assert.equal(approve.status, 200, "manager can approve receipt report");
    const reject = await api(manager.page, `${baseUrl}/api/dashboard/retail/payment-reports/${time.reportId}`, { method: "PATCH", body: { action: "REJECT", reason: "[R4-SYNTHETIC] test rejection" } });
    assert.equal(reject.status, 200, "manager can reject time-only report");
    const finalReports = await manager.context.request.get(`${baseUrl}/api/dashboard/retail/payment-reports`);
    assert.equal(finalReports.status(), 200);
    const reports = (await finalReports.json()).reports;
    assert.equal(reports.find((item) => item.id === receipt.reportId)?.status, "APPROVED");
    assert.equal(reports.find((item) => item.id === time.reportId)?.status, "REJECTED");
    await manager.page.reload();
    await manager.page.getByText("تأیید شده").first().waitFor();
    await manager.page.getByText("رد شده").first().waitFor();
    await capture(manager.page, "merchant-reviewed-payment-reports.png");
    await manager.context.close();
    console.log(JSON.stringify({ status: "PASSED", orderNumbers: [receipt.orderNumber, time.orderNumber], reportIds: [receipt.reportId, time.reportId], screenshots: evidenceDir, liveProviders: 0 }));
  } finally {
    await browser.close();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
