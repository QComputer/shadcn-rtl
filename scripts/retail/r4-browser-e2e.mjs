import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import { PrismaClient } from "@prisma/client";

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
const prisma = new PrismaClient();
const receiptBytes = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j2ioAAAAASUVORK5CYII=", "base64");

async function capture(page, filename) {
  const session = await page.context().newCDPSession(page);
  try {
    const { data } = await session.send("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false });
    await fs.writeFile(path.join(evidenceDir, filename), Buffer.from(data, "base64"));
  } finally {
    await session.detach();
  }
}

async function login(browser, email, callback = "/fa/retail/retail-r4-synthetic-fashion") {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  page.on("request", (request) => {
    if (!request.url().includes("/api/auth/callback/credentials")) return;
    const fields = new URLSearchParams(request.postData() ?? "");
    console.error(JSON.stringify({
      credentialsRequest: {
        method: request.method(),
        usernameMatches: fields.get("username") === email,
        passwordMatches: fields.get("password") === password,
        usernamePresent: fields.has("username"),
        passwordPresent: fields.has("password"),
      },
    }));
  });
  page.on("response", (response) => {
    if (!response.url().includes("/api/auth/callback/credentials")) return;
    console.error(JSON.stringify({ credentialsResponse: { status: response.status(), url: new URL(response.url()).pathname } }));
  });
  await page.route("https://fonts.googleapis.com/**", (route) => route.fulfill({ status: 200, contentType: "text/css", body: "" }));
  await page.route("https://fonts.gstatic.com/**", (route) => route.abort());
  await page.goto(`${baseUrl}/fa/login?callbackUrl=${encodeURIComponent(callback)}`);
  await page.locator("#username").fill(email);
  await page.locator("#password").fill(password);
  await page.locator('button[type="submit"]').click();
  try {
    await page.waitForURL((url) => !url.pathname.endsWith("/login"), { timeout: 20000 });
  } catch (error) {
    await capture(page, `login-failure-${email.split("@")[0]}.png`);
    console.error(JSON.stringify({ loginEmail: email, url: page.url(), title: await page.title(), bodyText: (await page.locator("body").innerText()).slice(0, 1200) }));
    throw error;
  }
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

async function prepareInventoryCart(organizationSlug, customerId, variantId) {
  const cart = await prisma.shopCart.upsert({
    where: { organizationSlug_customerId: { organizationSlug, customerId } },
    create: { organizationSlug, customerId },
    update: { status: "ACTIVE" },
  });
  await prisma.shopCartItem.deleteMany({ where: { cartId: cart.id } });
  await prisma.shopCartItem.create({ data: { cartId: cart.id, variantId, quantity: 1 } });
}

async function submitInventoryCheckout(page, organizationSlug, idempotencyKey) {
  const response = await api(page, `${baseUrl}/api/retail/v1/checkout`, {
    method: "POST",
    body: { organization: organizationSlug, idempotencyKey, type: "PICK_UP", paymentMethod: "BANK_TRANSFER" },
  });
  assert.equal(response.status, 201, `synthetic checkout must succeed: ${JSON.stringify(response.body)}`);
  const order = await prisma.order.findFirstOrThrow({ where: { retailCheckoutKey: idempotencyKey, organizationSlug } });
  return { order, idempotencyKey };
}

async function prepareInventoryCheckout(page, organizationSlug, customerId, variantId) {
  await prepareInventoryCart(organizationSlug, customerId, variantId);
  return submitInventoryCheckout(page, organizationSlug, randomUUID());
}

async function runWithRowsLocked(variantId, orderId, operations) {
  let markLocked;
  let releaseLock;
  const locked = new Promise((resolve) => { markLocked = resolve; });
  const released = new Promise((resolve) => { releaseLock = resolve; });
  const holder = prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "ProductVariant" WHERE "id" = ${variantId} FOR UPDATE`;
    if (orderId) await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${orderId} FOR UPDATE`;
    markLocked();
    await released;
  }, { timeout: 45000 });
  await locked;

  let waiting = 0;
  let outcomes;
  try {
    outcomes = Promise.allSettled(operations.map((operation) => operation()));
    for (let attempt = 0; attempt < 600; attempt += 1) {
      const rows = await prisma.$queryRaw`SELECT COUNT(DISTINCT pid)::int AS count
        FROM pg_stat_activity
        WHERE datname = current_database() AND pid <> pg_backend_pid()
          AND wait_event_type = 'Lock'`;
      waiting = rows[0]?.count ?? 0;
      if (waiting >= operations.length) break;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  } finally {
    releaseLock();
  }

  const settled = await outcomes;
  await holder;
  const rejected = settled.filter((result) => result.status === "rejected");
  assert.deepEqual(rejected.map((result) => String(result.reason)), [], "concurrent HTTP operations must not fail partially");
  assert.ok(waiting >= operations.length,
    `expected ${operations.length} independent HTTP-backed operations to overlap on PostgreSQL row locks, observed ${waiting} waiters`);
  return settled.map((result) => result.value);
}

async function assertMovementLedger(variantId, initialInventory, priorMovementIds) {
  const [variant, movements] = await Promise.all([
    prisma.productVariant.findUniqueOrThrow({ where: { id: variantId }, select: { inventory: true } }),
    prisma.inventoryMovement.findMany({ where: { variantId }, select: {
      id: true, quantityDelta: true, quantityBefore: true, quantityAfter: true,
    } }),
  ]);
  const created = movements.filter((movement) => !priorMovementIds.has(movement.id));
  assert.ok(created.length > 0, "every stock-changing race must produce inventory movement evidence");
  for (const movement of created) {
    assert.notEqual(movement.quantityBefore, null);
    assert.notEqual(movement.quantityAfter, null);
    assert.equal(movement.quantityAfter, movement.quantityBefore + movement.quantityDelta,
      "movement snapshot must describe its actual inventory operation");
  }
  const totalDelta = created.reduce((sum, movement) => sum + movement.quantityDelta, 0);
  assert.equal(variant.inventory, initialInventory + totalDelta,
    "movement deltas must reconcile to final persisted inventory after a concurrent H2/R5 operation");
  return variant.inventory;
}

async function setVariantStock(page, productId, variantId, inventory) {
  const response = await api(page, `${baseUrl}/api/products/${productId}/variants`, {
    method: "PATCH",
    body: { id: variantId, inventory },
  });
  assert.equal(response.status, 200, `authorized variant stock edit must succeed: ${JSON.stringify(response.body)}`);
  assert.equal(response.body.inventory, inventory);
}

async function movementIds(variantId) {
  const rows = await prisma.inventoryMovement.findMany({ where: { variantId }, select: { id: true } });
  return new Set(rows.map((row) => row.id));
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
  await page.goto(`${baseUrl}/fa/retail/${org}/checkout`, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "تکمیل سفارش" }).waitFor();
  await page.getByRole("button", { name: "ثبت سفارش" }).waitFor();
  assert.equal(await page.locator("select").inputValue(), "BANK_TRANSFER", "customer checkout must display the enabled bank method");
  if (reportType === "RECEIPT") await capture(page, "customer-checkout.png");
  await page.getByRole("button", { name: "ثبت سفارش" }).click();
  const orderHeading = page.getByRole("heading", { name: /^سفارش RET-[A-Z0-9-]+ ثبت شد$/ });
  await orderHeading.waitFor({ timeout: 30000 });
  const orderNumber = (await orderHeading.innerText()).match(/RET-[A-Z0-9-]+/)?.[0];
  assert.ok(orderNumber, "the persisted order number must be shown after UI checkout");
  assert.ok(await page.getByText("در انتظار بررسی").count(), "checkout must leave payment pending");
  await page.getByText("مهلت پرداخت").waitFor();
  const receiptRadio = page.getByLabel("بارگذاری تصویر رسید");
  const timeRadio = page.getByLabel("ثبت زمان پرداخت");
  assert.equal(await receiptRadio.isChecked(), true);
  assert.equal(await timeRadio.isChecked(), false);
  if (reportType === "RECEIPT") {
    await page.locator('input[type="file"]').setInputFiles({ name: "synthetic-r4-receipt.png", mimeType: "image/png", buffer: receiptBytes });
  } else {
    await timeRadio.click();
    const localTime = new Date(Date.now() - 60_000).toISOString().slice(0, 16);
    await page.locator('input[type="datetime-local"]').fill(localTime);
    assert.equal(await timeRadio.isChecked(), true);
    assert.equal(await receiptRadio.isChecked(), false);
  }
  const reportResponsePromise = page.waitForResponse((response) => response.url().includes("/bank-report?") && response.request().method() === "POST");
  await page.getByRole("button", { name: "ارسال گزارش پرداخت" }).click();
  const reportResponse = await reportResponsePromise;
  const reportResponseBody = await reportResponse.text();
  assert.equal(reportResponse.status(), 201, `${reportType} submission must return a created report: ${reportResponseBody.slice(0, 800)}`);
  const reportBody = JSON.parse(reportResponseBody);
  await page.getByText("گزارش پرداخت ارسال شد.").waitFor({ timeout: 30000 });
  assert.equal(reportBody.report.kind, reportType === "RECEIPT" ? "BANK_RECEIPT" : "BANK_TIME");
  assert.equal(reportBody.report.status, "PENDING_REVIEW");
  return { orderNumber, reportId: reportBody.report.id };
}

async function main() {
  await fs.mkdir(evidenceDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    const fashionOrg = await prisma.organization.findUniqueOrThrow({ where: { slug: fashion }, select: { id: true } });
    const fashionProduct = await prisma.product.findFirstOrThrow({ where: { slug: "r4-synthetic-avid", organizationId: fashionOrg.id }, select: { id: true } });
    const fashionManagerContext = await login(browser, fashionManager, `/fa/dashboard/products/${fashionProduct.id}`);
    const sizeColorVariant = await prisma.productVariant.findFirstOrThrow({ where: { product: { organizationId: fashionOrg.id, slug: "r4-synthetic-avid" }, sku: "R4-SYN-SHOE-42-BK" }, select: { id: true, inventory: true, optionValues: { select: { valueText: true, valueNumber: true, definition: { select: { key: true } } } } } });
    assert.ok(sizeColorVariant.optionValues.some(option => option.definition.key === "color" && option.valueText === "مشکی"));
    assert.ok(sizeColorVariant.optionValues.some(option => option.definition.key === "size" && Number(option.valueNumber) === 42));
    await fashionManagerContext.page.getByRole("button", { name: /مشکی.*۴۲/ }).click();
    await fashionManagerContext.page.locator('[role="dialog"] #inventory').fill("8");
    const variantUpdatePromise = fashionManagerContext.page.waitForResponse(response => response.url().endsWith(`/api/products/${fashionProduct.id}/variants`) && response.request().method() === "PATCH");
    await fashionManagerContext.page.locator('[role="dialog"]').getByRole("button", { name: /ذخیره|Save/ }).click();
    const variantUpdateResponse = await variantUpdatePromise;
    assert.equal(variantUpdateResponse.status(), 200, `variant inventory update failed: ${await variantUpdateResponse.text()}`);
    assert.equal(variantUpdateResponse.request().postDataJSON().inventory, 8, "manager form must submit the requested stock value");
    assert.equal((await variantUpdateResponse.json()).inventory, 8, "variant update response must contain the saved stock value");
    await fashionManagerContext.page.locator('[role="dialog"]').waitFor({ state: "hidden" });
    const revisedStock = await prisma.productVariant.findUniqueOrThrow({ where: { id: sizeColorVariant.id }, select: { inventory: true } });
    assert.equal(revisedStock.inventory, 8, "authorized manager stock change must persist for the selected size/color variant");
    await fashionManagerContext.page.getByRole("heading", { name: "دسته‌بندی‌ها و تگ‌ها" }).waitFor();
    const caps = fashionManagerContext.page.locator("label").filter({ hasText: "کلاه" }).locator("input[type=checkbox]");
    await caps.check();
    await fashionManagerContext.page.getByPlaceholder("مثلاً: اسپرت، راحت، مناسب پیاده‌روی").fill("روزمره، سبک هفتگی");
    const taxonomyPatchPromise = fashionManagerContext.page.waitForResponse(response => response.url().endsWith(`/api/products/${fashionProduct.id}/taxonomy`) && response.request().method() === "PATCH");
    await fashionManagerContext.page.getByRole("button", { name: "ذخیره دسته‌بندی‌ها و تگ‌ها" }).click();
    const taxonomyPatchResponse = await taxonomyPatchPromise;
    assert.equal(taxonomyPatchResponse.status(), 200, `taxonomy update failed: ${await taxonomyPatchResponse.text()}`);
    await fashionManagerContext.page.getByText("دسته‌بندی‌ها و تگ‌ها ذخیره شدند.", { exact: true }).waitFor();
    await capture(fashionManagerContext.page, "manager-product-taxonomy.png");
    const taxonomy = await fashionManagerContext.context.request.get(`${baseUrl}/api/products/${fashionProduct.id}/taxonomy`);
    assert.equal(taxonomy.status(), 200, "authorized manager must read taxonomy");
    const taxonomyJson = await taxonomy.json();
    assert.ok(taxonomyJson.categoryIds.length >= 2, "manager category selection persists");
    assert.deepEqual(taxonomyJson.tags.map(tag => tag.name), ["روزمره", "سبک هفتگی"]);
    const anonymousTaxonomy = await browser.newPage();
    const anonymousResponse = await anonymousTaxonomy.request.get(`${baseUrl}/api/products/${fashionProduct.id}/taxonomy`);
    assert.equal(anonymousResponse.status(), 401, "anonymous taxonomy reads must be rejected");
    await anonymousTaxonomy.close();
    const mobileMerchant = await login(browser, mobileManager, `/fa/dashboard/products/${fashionProduct.id}`);
    const crossTenant = await mobileMerchant.context.request.get(`${baseUrl}/api/products/${fashionProduct.id}/taxonomy`);
    assert.equal(crossTenant.status(), 403, "foreign tenant cannot read product taxonomy");
    const crossTenantWrite = await api(mobileMerchant.page, `${baseUrl}/api/products/${fashionProduct.id}/taxonomy`, { method: "PATCH", body: { tagNames: ["foreign-write" ] } });
    assert.equal(crossTenantWrite.status, 403, "foreign tenant cannot write product taxonomy");
    await mobileMerchant.context.close();
    const publicFiltered = await fashionManagerContext.context.request.get(`${baseUrl}/api/public/v1/organizations/${fashion}/products?category=caps&tag=%D8%B1%D9%88%D8%B2%D9%85%D8%B1%D9%87`);
    assert.equal(publicFiltered.status(), 200);
    assert.ok((await publicFiltered.text()).includes("r4-synthetic-avid"), "public category and tag filters expose the intended published product");

    // Exercise H2's absolute stock editing through the authenticated manager
    // route against the same rows that R5 checkout, expiry, cancellation and
    // payment approval mutate. The DB lock barrier proves real overlap.
    const inventoryCustomer = await login(browser, customerEmail);
    const customerUser = await prisma.user.findUniqueOrThrow({ where: { email: customerEmail }, select: { id: true } });

    await setVariantStock(fashionManagerContext.page, fashionProduct.id, sizeColorVariant.id, 20);
    let baseline = await prisma.productVariant.findUniqueOrThrow({ where: { id: sizeColorVariant.id }, select: { inventory: true } });
    let beforeMovements = await movementIds(sizeColorVariant.id);
    await prepareInventoryCart(fashion, customerUser.id, sizeColorVariant.id);
    const checkoutRaceKey = randomUUID();
    const checkoutRace = await runWithRowsLocked(sizeColorVariant.id, null, [
      () => api(fashionManagerContext.page, `${baseUrl}/api/products/${fashionProduct.id}/variants`, {
        method: "PATCH", body: { id: sizeColorVariant.id, inventory: 12 },
      }).then(response => { assert.equal(response.status, 200); return response; }),
      () => submitInventoryCheckout(inventoryCustomer.page, fashion, checkoutRaceKey),
    ]);
    assert.equal(checkoutRace[0].body.inventory, 12);
    const checkoutRaceOrder = checkoutRace[1].order;
    assert.equal(checkoutRaceOrder.status, "PENDING");
    const afterCheckoutRace = await assertMovementLedger(sizeColorVariant.id, baseline.inventory, beforeMovements);
    assert.ok([11, 12].includes(afterCheckoutRace), `serialized checkout/stock edit should end at 11 or 12, got ${afterCheckoutRace}`);

    await setVariantStock(fashionManagerContext.page, fashionProduct.id, sizeColorVariant.id, 20);
    const expiryCheckout = await prepareInventoryCheckout(inventoryCustomer.page, fashion, customerUser.id, sizeColorVariant.id);
    await prisma.order.update({ where: { id: expiryCheckout.order.id }, data: { retailPaymentDeadlineAt: new Date(Date.now() - 60_000) } });
    baseline = await prisma.productVariant.findUniqueOrThrow({ where: { id: sizeColorVariant.id }, select: { inventory: true } });
    beforeMovements = await movementIds(sizeColorVariant.id);
    const expirationRace = await runWithRowsLocked(sizeColorVariant.id, expiryCheckout.order.id, [
      () => api(fashionManagerContext.page, `${baseUrl}/api/products/${fashionProduct.id}/variants`, {
        method: "PATCH", body: { id: sizeColorVariant.id, inventory: 15 },
      }).then(response => { assert.equal(response.status, 200); return response; }),
      () => api(inventoryCustomer.page, `${baseUrl}/api/internal/retail/payment-expiration?limit=100`, {
        method: "POST",
      }).then(response => { assert.equal(response.status, 200); assert.ok(response.body.expired >= 1); return response; }),
    ]);
    assert.equal(expirationRace[0].body.inventory, 15);
    const expiredOrder = await prisma.order.findUniqueOrThrow({ where: { id: expiryCheckout.order.id }, select: { status: true } });
    assert.equal(expiredOrder.status, "CANCELLED");
    const afterExpirationRace = await assertMovementLedger(sizeColorVariant.id, baseline.inventory, beforeMovements);
    assert.ok([15, 16].includes(afterExpirationRace), `serialized expiry/stock edit should end at 15 or 16, got ${afterExpirationRace}`);

    await setVariantStock(fashionManagerContext.page, fashionProduct.id, sizeColorVariant.id, 20);
    const cancellationCheckout = await prepareInventoryCheckout(inventoryCustomer.page, fashion, customerUser.id, sizeColorVariant.id);
    baseline = await prisma.productVariant.findUniqueOrThrow({ where: { id: sizeColorVariant.id }, select: { inventory: true } });
    beforeMovements = await movementIds(sizeColorVariant.id);
    const cancellationRace = await runWithRowsLocked(sizeColorVariant.id, cancellationCheckout.order.id, [
      () => api(fashionManagerContext.page, `${baseUrl}/api/products/${fashionProduct.id}/variants`, {
        method: "PATCH", body: { id: sizeColorVariant.id, inventory: 15 },
      }).then(response => { assert.equal(response.status, 200); return response; }),
      () => api(fashionManagerContext.page, `${baseUrl}/api/orders/${cancellationCheckout.order.id}`, {
        method: "DELETE",
      }).then(response => { assert.equal(response.status, 200); return response; }),
    ]);
    assert.equal(cancellationRace[0].body.inventory, 15);
    const cancelledOrder = await prisma.order.findUniqueOrThrow({ where: { id: cancellationCheckout.order.id }, select: { status: true } });
    assert.equal(cancelledOrder.status, "CANCELLED");
    const afterCancellationRace = await assertMovementLedger(sizeColorVariant.id, baseline.inventory, beforeMovements);
    assert.ok([15, 16].includes(afterCancellationRace), `serialized cancellation/stock edit should end at 15 or 16, got ${afterCancellationRace}`);

    await setVariantStock(fashionManagerContext.page, fashionProduct.id, sizeColorVariant.id, 20);
    const reconciliationCheckout = await prepareInventoryCheckout(inventoryCustomer.page, fashion, customerUser.id, sizeColorVariant.id);
    const bankReportResponse = await api(inventoryCustomer.page,
      `${baseUrl}/api/retail/v1/orders/${reconciliationCheckout.order.orderNumber}/bank-report?organization=${fashion}`,
      { method: "POST", body: { method: "TIME", reportedAt: new Date().toISOString(), submittedLocalTime: "synthetic H2/R5 concurrency acceptance" } });
    assert.equal(bankReportResponse.status, 201, `synthetic bank-time report must be created: ${JSON.stringify(bankReportResponse.body)}`);
    const reportId = bankReportResponse.body.report.id;
    baseline = await prisma.productVariant.findUniqueOrThrow({ where: { id: sizeColorVariant.id }, select: { inventory: true } });
    beforeMovements = await movementIds(sizeColorVariant.id);
    const reconciliationRace = await runWithRowsLocked(sizeColorVariant.id, reconciliationCheckout.order.id, [
      () => api(fashionManagerContext.page, `${baseUrl}/api/products/${fashionProduct.id}/variants`, {
        method: "PATCH", body: { id: sizeColorVariant.id, inventory: 15 },
      }).then(response => { assert.equal(response.status, 200); return response; }),
      () => api(fashionManagerContext.page, `${baseUrl}/api/dashboard/retail/payment-reports/${reportId}`, {
        method: "PATCH", body: { action: "APPROVE" },
      }).then(response => { assert.equal(response.status, 200); return response; }),
    ]);
    assert.equal(reconciliationRace[0].body.inventory, 15);
    const reconciledOrder = await prisma.order.findUniqueOrThrow({ where: { id: reconciliationCheckout.order.id }, select: { paymentStatus: true, status: true } });
    assert.equal(reconciledOrder.paymentStatus, "COMPLETED");
    const afterReconciliationRace = await assertMovementLedger(sizeColorVariant.id, baseline.inventory, beforeMovements);
    assert.equal(afterReconciliationRace, 15, "payment settlement must not restore already reserved stock");
    await inventoryCustomer.context.close();
    await fashionManagerContext.context.close();
    const customer = await login(browser, customerEmail);
    await customer.page.goto(`${baseUrl}/fa/retail/${fashion}`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await customer.page.getByRole("heading", { level: 1 }).waitFor({ timeout: 30000 });
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
    try {
      await manager.page.getByRole("heading", { name: "گزارش‌های پرداخت" }).waitFor({ timeout: 30000 });
    } catch (error) {
      await capture(manager.page, "merchant-dashboard-failure.png");
      console.error(JSON.stringify({ merchantDashboardUrl: manager.page.url(), title: await manager.page.title(), bodyText: (await manager.page.locator("body").innerText()).slice(0, 4000) }));
      throw error;
    }
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
    await prisma.$disconnect();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
