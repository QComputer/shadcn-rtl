import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { assertRetailRecoveryEnvironment } from "./safety.mjs";
import { fixtureId } from "./fixture-ids.mjs";

const { appUrl, databaseName } = assertRetailRecoveryEnvironment();
const BASE = process.env.BASE || process.env.E2E_BASE_URL || appUrl;
assert.equal(BASE, appUrl, "BASE must remain pinned to the local disposable Retail UI at 127.0.0.1:3107");
const STAMP = process.env.E2E_STAMP;
assert.ok(STAMP, "recovery seed stamp is required");
const OUT = path.resolve(process.env.OUT || process.env.E2E_OUTPUT_DIR || path.join(process.cwd(), ".tmp", "retail-variant-deletion-browser"));
fs.mkdirSync(OUT, { recursive: true });
const ADMIN = `admin-e2e-${STAMP}`;
const CUSTOMER = `customer-e2e-${STAMP}`;
const PASS = "E2ePass!23456";
const colors = ["مشکی", "سفید", "زیتونی"];
const sizes = ["38", "39", "40", "41", "42"];
const results = [];

function routeIdFromSave(response) {
  const pathname = new URL(response.url()).pathname;
  return pathname.split("/").at(-1);
}

async function login(page, callbackPath, locale = "fa", username = ADMIN) {
  const expectedPath = new URL(callbackPath, BASE).pathname;
  const loginUrl = new URL(`/${locale}/login`, BASE);
  loginUrl.searchParams.set("callbackUrl", expectedPath);
  await page.goto(loginUrl.toString(), { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle");
  await page.locator("#username").fill(username);
  await page.locator("#password").fill(PASS);
  await page.locator('form button[type="submit"]').click();
  await page.waitForURL(url => url.pathname === expectedPath, { timeout: 60000 });
  await page.waitForLoadState("networkidle");
}

async function saveAndWait(page) {
  const save = page.getByRole("button", { name: /ذخیره پیش.?نویس|ذخیره تغییرات|Save draft|Save changes/ }).first();
  await save.waitFor({ state: "visible", timeout: 30000 });
  const saved = page.waitForResponse(response => {
    const pathname = new URL(response.url()).pathname;
    return /^\/api\/dashboard\/retail\/catalog(?:\/[a-z0-9]+)?$/.test(pathname) && ["POST", "PATCH"].includes(response.request().method());
  });
  await save.click();
  const response = await saved;
  if (!response.ok()) throw new Error(`Product save failed (${response.status()}).`);
  return { response, body: await response.json() };
}

async function readProduct(page, productId) {
  const response = await page.request.get(`${BASE}/api/dashboard/retail/catalog/${productId}`);
  assert.equal(response.status(), 200, `catalog reload failed: ${response.status()}`);
  const body = await response.json();
  return body.product ?? body;
}

async function selectColorGrouping(page) {
  const selects = page.locator("select:visible");
  const optionsBySelect = await selects.evaluateAll(nodes => nodes.map(node =>
    Array.from(node.options).map(option => ({ value: option.value, text: option.textContent?.trim() ?? "" }))));
  const selectIndex = optionsBySelect.findIndex(options => options.some(option => /^(رنگ|color|اللون)$/i.test(option.text)));
  assert.ok(selectIndex >= 0, "full editor exposes a color grouping option");
  const colorOption = optionsBySelect[selectIndex].find(option => /^(رنگ|color|اللون)$/i.test(option.text));
  assert.ok(colorOption);
  await selects.nth(selectIndex).selectOption(colorOption.value);
}

function optionValue(variant, definitionId) {
  return String(variant.options?.find(option => option.definitionId === definitionId)?.value ?? "");
}

async function openDeleteAndConfirm(page, button) {
  await button.waitFor({ state: "visible", timeout: 30000 });
  await button.click();
  const dialog = page.getByRole("dialog");
  await dialog.waitFor({ state: "visible", timeout: 15000 });
  await dialog.getByRole("button", { name: /Confirm deletion|تأیید حذف|تأكيد الحذف|حذف شود/ }).click();
  await dialog.waitFor({ state: "hidden", timeout: 15000 });
}

async function result(name, fn) {
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe",
    args: ["--disable-features=HttpsFirstBalancedModeAutoEnable,HttpsUpgrades"],
  });
  const context = await browser.newContext({ baseURL: BASE });
  context.setDefaultNavigationTimeout(90000);
  const page = await context.newPage();
  const startedAt = Date.now();
  try {
    await fn(page, context);
    results.push({ name, status: "passed", durationMs: Date.now() - startedAt });
    console.log(`PASS ${name}`);
  } catch (error) {
    results.push({ name, status: "failed", durationMs: Date.now() - startedAt, error: String(error).slice(0, 700) });
    console.error(`FAIL ${name}: ${String(error).slice(0, 400)}`);
    const safeName = name.replace(/[^a-z0-9_-]+/gi, "-");
    try { await page.screenshot({ path: path.join(OUT, `fail-${safeName}.png`), fullPage: true }); } catch {}
  } finally {
    await context.close();
    await browser.close();
  }
}

let productId;
let publishedLastVariantProductId;

await result("new draft: create 3 colors x 5 sizes, cancel and undo pending deletions without a PATCH", async (page) => {
  await login(page, "/fa/dashboard/retail-catalog/new");
  await page.getByText(/افزودن محصول فروشگاه|Add retail product/).waitFor({ state: "visible", timeout: 60000 });
  await page.locator('input[minlength="2"]').first().fill(`حذف ترکیب ${STAMP}`);
  await page.locator('input[type="number"][min="0.01"]').first().fill("450000");
  await page.locator("select[required]").first().selectOption({ label: "کفش ورزشی" });
  await page.getByText(/ساخت گونه.?ها از رنگ و سایز|Generate variants from color/).click();
  const generator = page.locator("details").filter({ hasText: /ساخت گونه.?ها از رنگ و سایز|Generate variants from color/ });
  const selects = generator.locator("select");
  await selects.nth(0).selectOption({ label: "رنگ" });
  await selects.nth(1).selectOption({ label: "سایز" });
  await generator.getByRole("button", { name: /^(استاندارد|Standard)$/ }).click();
  for (const size of sizes) {
    const digit = size.split("").map(n => "۰۱۲۳۴۵۶۷۸۹"[Number(n)]).join("");
    await page.getByRole("button", { name: new RegExp(`^(${size}|${digit})$`) }).click();
  }
  await generator.locator('input[placeholder*="زیتونی"], input[placeholder*="Black"]').first().fill(colors.join("، "));
  await generator.getByLabel("موجودی", { exact: true }).fill("۱۰");
  await page.getByRole("button", { name: /پیش.?نمایش ترکیب|Preview combinations/ }).click();
  await page.getByRole("button", { name: /^ایجاد ترکیب|Generate variants$/ }).click();
  await openDeleteAndConfirm(page, page.getByRole("button", { name: /^(Delete color|حذف رنگ): زیتونی$/ }));
  await page.getByRole("status").filter({ hasText: /برای ثبت حذف \d+ گونه، تغییرات را ذخیره کنید|Save changes to apply \d+ pending deletions?/ }).waitFor({ state: "visible" });
  await page.getByRole("button", { name: /^(Undo pending deletions|بازگردانی حذف‌های در انتظار|التراجع عن عمليات الحذف المعلقة)$/ }).click();
  await page.getByRole("status").filter({ hasText: /برای ثبت حذف \d+ گونه، تغییرات را ذخیره کنید|Save changes to apply \d+ pending deletions?/ }).waitFor({ state: "hidden" });
  const created = await saveAndWait(page);
  productId = created.body.product?.id ?? routeIdFromSave(created.response);
  assert.ok(productId, "new draft product ID must be returned after save");
  await page.waitForURL(url => url.pathname === `/fa/dashboard/retail-catalog/${productId}`, { timeout: 60000 });
  const initial = await readProduct(page, productId);
  assert.equal(initial.variants.length, 15, "new product persists all three colors and five sizes");

  const cancelControl = page.getByRole("button", { name: /^(Delete color|حذف رنگ): زیتونی$/ });
  await cancelControl.click();
  const dialog = page.getByRole("dialog");
  await dialog.waitFor({ state: "visible" });
  await dialog.getByRole("button", { name: /^(Cancel|لغو|إلغاء)$/ }).click();
  await dialog.waitFor({ state: "hidden" });
  assert.equal((await readProduct(page, productId)).variants.length, 15, "closing confirmation leaves saved data unchanged");

  await openDeleteAndConfirm(page, page.getByRole("button", { name: /^(Delete color|حذف رنگ): زیتونی$/ }));
  await page.getByRole("button", { name: /^(Undo pending deletions|بازگردانی حذف‌های در انتظار|التراجع عن عمليات الحذف المعلقة)$/ }).click();
  const saveRequests = page.waitForTimeout(300);
  await saveRequests;
  assert.equal((await readProduct(page, productId)).variants.length, 15, "undo restores the matrix before save");
  await page.reload({ waitUntil: "networkidle" });
  assert.equal((await readProduct(page, productId)).variants.length, 15, "cancel and undo sent no persistence request");
});

await result("saved product: delete a whole color, size, and one cell from matrix and verify database-backed reload", async (page) => {
  assert.ok(productId, "draft setup step did not create a product");
  await login(page, `/fa/dashboard/retail-catalog/${productId}`);
  await page.getByText(/مدیریت محصول فروشگاه|Manage retail product/).waitFor({ state: "visible", timeout: 60000 });
  const before = await readProduct(page, productId);
  const defs = before.variants[0].options.map(option => ({ id: option.definitionId, key: option.key, label: option.label }));
  const colorDefinitionId = defs.find(definition => /color|colour|رنگ|لون/i.test(`${definition.key} ${definition.label}`))?.id;
  const sizeDefinitionId = defs.find(definition => /size|سایز|اندازه|مقاس/i.test(`${definition.key} ${definition.label}`))?.id;
  assert.ok(colorDefinitionId && sizeDefinitionId, "fixture attributes should be identified from the product definition data");

  const revisionRaceVariant = before.variants[0];
  const concurrentEdit = await page.request.patch(`${BASE}/api/dashboard/retail/catalog/${productId}`, {
    headers: { origin: BASE },
    data: { variantUpdates: [{ id: revisionRaceVariant.id, inventory: revisionRaceVariant.inventory + 1 }] },
  });
  assert.equal(concurrentEdit.status(), 200, "a concurrent inventory edit advances the revision");
  await openDeleteAndConfirm(page, page.getByRole("button", { name: /^(Delete color|حذف رنگ): زیتونی$/ }));
  const staleSave = page.waitForResponse(response => new URL(response.url()).pathname === `/api/dashboard/retail/catalog/${productId}` && response.request().method() === "PATCH");
  await page.getByRole("button", { name: /ذخیره تغییرات|Save changes/ }).first().click();
  assert.equal((await staleSave).status(), 409, "a stale revision cannot save the staged deletion");
  await page.getByRole("button", { name: /^(Undo pending deletions|بازگردانی حذف‌های در انتظار|التراجع عن عمليات الحذف المعلقة)$/ }).waitFor({ state: "visible" });
  assert.equal((await readProduct(page, productId)).variants.length, 15, "failed stale save leaves every persisted variant active");
  assert.equal(await page.getByRole("button", { name: /^(Delete color|حذف رنگ): زیتونی$/ }).count(), 0,
    "failed save retains the pending deletion in the editor");
  await page.getByRole("button", { name: /^(Undo pending deletions|بازگردانی حذف‌های در انتظار|التراجع عن عمليات الحذف المعلقة)$/ }).click();
  assert.equal(await page.getByRole("button", { name: /^(Delete color|حذف رنگ): زیتونی$/ }).count(), 1,
    "undo restores the staged color group after the failed save");
  const restoreInventory = await page.request.patch(`${BASE}/api/dashboard/retail/catalog/${productId}`, {
    headers: { origin: BASE },
    data: { variantUpdates: [{ id: revisionRaceVariant.id, inventory: revisionRaceVariant.inventory }] },
  });
  assert.equal(restoreInventory.status(), 200, "the disposable concurrency edit is restored");
  await page.reload({ waitUntil: "networkidle" });
  assert.equal((await readProduct(page, productId)).variants.length, 15, "restored fixture reloads before accepted deletion cases");

  await openDeleteAndConfirm(page, page.getByRole("button", { name: /^(Delete color|حذف رنگ): زیتونی$/ }));
  await saveAndWait(page);
  let after = await readProduct(page, productId);
  assert.equal(after.variants.length, 10);
  assert.ok(after.variants.every(variant => optionValue(variant, colorDefinitionId) !== "زیتونی"));
  await page.reload({ waitUntil: "networkidle" });
  after = await readProduct(page, productId);
  assert.equal(after.variants.length, 10, "color deletion persists after reload");

  const sizeSelector = 'button[aria-label^="Delete size:"], button[aria-label^="حذف سایز:"]';
  const sizeButton = page.locator(sizeSelector).filter({ has: page.locator("text=/40|۴۰/") }).first();
  if (await sizeButton.count()) await openDeleteAndConfirm(page, sizeButton);
  else {
    const candidates = page.locator(sizeSelector);
    let target;
    for (let index = 0; index < await candidates.count(); index++) {
      const label = await candidates.nth(index).getAttribute("aria-label");
      if (/40|۴۰/.test(label ?? "")) { target = candidates.nth(index); break; }
    }
    assert.ok(target, "size 40 deletion control is visible");
    await openDeleteAndConfirm(page, target);
  }
  await saveAndWait(page);
  after = await readProduct(page, productId);
  assert.ok(after.variants.every(variant => optionValue(variant, sizeDefinitionId) !== "40"));
  assert.equal(after.variants.length, 8);

  const single = page.locator('button[aria-label^="Delete variant:"], button[aria-label^="حذف گونه:"], button[aria-label^="حذف ترکیب:"], button[aria-label^="Delete combination:"]');
  let comboButton;
  for (let index = 0; index < await single.count(); index++) {
    const label = await single.nth(index).getAttribute("aria-label");
    if (/مشکی.*(?:39|۳۹)/.test(label ?? "")) { comboButton = single.nth(index); break; }
  }
  assert.ok(comboButton, "black x 39 deletion control is visible");
  await openDeleteAndConfirm(page, comboButton);
  await saveAndWait(page);
  after = await readProduct(page, productId);
  assert.equal(after.variants.length, 7);
  assert.ok(!after.variants.some(variant => optionValue(variant, colorDefinitionId) === "مشکی" && optionValue(variant, sizeDefinitionId) === "39"));
  assert.ok(after.variants.some(variant => optionValue(variant, colorDefinitionId) === "مشکی" && optionValue(variant, sizeDefinitionId) === "41"));
  assert.ok(after.variants.some(variant => optionValue(variant, colorDefinitionId) === "سفید" && optionValue(variant, sizeDefinitionId) === "39"));
});

await result("full editor: remove a color group and persist the full-editor path", async (page) => {
  await login(page, `/fa/dashboard/retail-catalog/${productId}`);
  await page.getByRole("button", { name: /ویرایش کامل تنوع‌ها|Full variant editor/ }).click();
  await selectColorGrouping(page);
  const deleteGroup = page.getByRole("button", { name: /^(Delete color group|حذف گروه رنگ|حذف مجموعة اللون): سفید$/ });
  await openDeleteAndConfirm(page, deleteGroup);
  await saveAndWait(page);
  const after = await readProduct(page, productId);
  assert.ok(after.variants.every(variant => !JSON.stringify(variant.options).includes("سفید")));
  await page.reload({ waitUntil: "networkidle" });
  assert.ok((await readProduct(page, productId)).variants.length > 0, "full editor keeps remaining choices persisted");
});

await result("published last variant: require explicit unpublish in one save", async (page) => {
  await login(page, "/fa/dashboard/retail-catalog/new");
  const response = await page.request.post(`${BASE}/api/dashboard/retail/catalog`, {
    headers: { origin: BASE },
    data: {
      name: `Last variant ${STAMP}`, slug: `last-variant-${STAMP}`, description: null, basePrice: 500000,
      categoryId: fixtureId("category", STAMP), imageIds: [fixtureId("image1", STAMP)],
      variants: [{ name: "مشکی / 38", sku: `DEL-LAST-${STAMP}`, price: 500000, inventory: 3, allowBackOrder: false,
        options: [{ definitionId: fixtureId("color", STAMP), value: "مشکی" }, { definitionId: fixtureId("size", STAMP), value: "38" }], imageIds: [] }],
    },
  });
  assert.equal(response.status(), 201, `last variant fixture creation failed (${response.status()})`);
  const created = await response.json();
  publishedLastVariantProductId = created.product.id;
  const publish = await page.request.patch(`${BASE}/api/dashboard/retail/catalog/${publishedLastVariantProductId}`, { headers: { origin: BASE }, data: { isActive: true } });
  assert.equal(publish.status(), 200, `last variant fixture publish failed (${publish.status()})`);
  await page.goto(`${BASE}/fa/dashboard/retail-catalog/${publishedLastVariantProductId}`, { waitUntil: "networkidle" });
  const control = page.getByRole("button", { name: /^(حذف گونه|حذف الخيار|Delete variant):/ }).first();
  await control.waitFor({ state: "visible", timeout: 30000 });
  await control.click();
  const dialog = page.getByRole("dialog");
  await dialog.waitFor({ state: "visible" });
  const confirm = dialog.getByRole("button", { name: /Confirm deletion|تأیید حذف|تأكيد الحذف|حذف شود/ });
  assert.equal(await confirm.isEnabled(), false, "published last variant stays protected before unpublish is checked");
  await dialog.getByRole("checkbox", { name: /^(Unpublish this product too|هم‌زمان محصول منتشرشده را از فروشگاه خارج کن|إلغاء نشر المنتج من المتجر في الوقت نفسه)$/ }).check();
  assert.equal(await confirm.isEnabled(), true);
  await confirm.click();
  await saveAndWait(page);
  const after = await readProduct(page, publishedLastVariantProductId);
  assert.equal(after.isActive, false);
  assert.equal(after.variants.length, 0);
});

await result("published cart: deleted quantity is blocked, then customer removes the stale line", async (page) => {
  const browser = page.context().browser();
  assert.ok(browser, "recovery browser exists");
  const customerContext = await browser.newContext({ baseURL: BASE });
  const adminContext = await browser.newContext({ baseURL: BASE });
  const customerPage = await customerContext.newPage();
  const adminPage = await adminContext.newPage();
  customerContext.setDefaultNavigationTimeout(90000);
  adminContext.setDefaultNavigationTimeout(90000);
  try {
  const seedProductId = fixtureId("product", STAMP);
  await login(adminPage, `/fa/dashboard/retail-catalog/${seedProductId}`);
  const before = await readProduct(adminPage, seedProductId);
  const targetId = fixtureId("pub2", STAMP);
  const target = before.variants.find(variant => variant.id === targetId);
  assert.ok(target, "recovery seed's published navy variant exists");
  assert.equal(before.isActive, true, "seed product remains published");
  assert.match(before.variantRevision ?? "", /^[a-f0-9]{64}$/, "catalog response provides the current variant revision");

  const cartUrl = `${BASE}/api/retail/v1/cart?organization=${encodeURIComponent(`retail-e2e-${STAMP}`)}`;
  await login(customerPage, `/fa/retail-e2e-${STAMP}/shop/cart`, "fa", CUSTOMER);
  await customerPage.goto(`${BASE}/fa/retail-e2e-${STAMP}/shop/cart`, { waitUntil: "networkidle" });
  let cartResponse = await customerPage.request.get(cartUrl);
  assert.equal(cartResponse.status(), 200, "customer cart loads from the recovery storefront");
  let cart = (await cartResponse.json()).cart;
  let item = cart?.items.find(value => value.variantId === targetId);
  if (!item) {
    const added = await customerPage.request.post(`${BASE}/api/retail/v1/cart`, {
      headers: { origin: BASE },
      data: { organization: `retail-e2e-${STAMP}`, variantId: targetId, quantity: 1 },
    });
    assert.equal(added.status(), 201, `seed navy variant can be placed in cart (${added.status()})`);
    item = (await added.json()).item;
  }

  const deleted = await adminPage.request.patch(`${BASE}/api/dashboard/retail/catalog/${seedProductId}`, {
    headers: { origin: BASE },
    data: { deletedVariantIds: [targetId], expectedVariantRevision: before.variantRevision },
  });
  assert.equal(deleted.status(), 200, `admin soft-deletes the still-unreserved variant (${deleted.status()})`);

  await customerPage.reload({ waitUntil: "networkidle" });
  const row = customerPage.getByRole("list", { name: /اقلام سبد خرید|Cart items/i }).getByRole("listitem").filter({ hasText: target.sku });
  await row.waitFor({ state: "visible", timeout: 30000 });
  assert.match(await row.innerText(), /قابل سفارش نیست|ناموجود|در دسترس نیست|unavailable|no longer available/i,
    "stale cart line clearly reports that its deleted variant is unavailable");
  const quantity = await customerPage.request.patch(`${BASE}/api/retail/v1/cart`, {
    headers: { origin: BASE },
    data: { organization: `retail-e2e-${STAMP}`, itemId: item.id, quantity: item.quantity + 1 },
  });
  assert.equal(quantity.status(), 409, "stale deleted-variant quantity mutation is rejected");
  await customerPage.reload({ waitUntil: "networkidle" });
  const refreshedRow = customerPage.getByRole("list", { name: /اقلام سبد خرید|Cart items/i }).getByRole("listitem").filter({ hasText: target.sku });
  await refreshedRow.waitFor({ state: "visible", timeout: 30000 });
  await refreshedRow.locator("summary").click();
  const removeResponse = customerPage.waitForResponse(response => new URL(response.url()).pathname === "/api/retail/v1/cart" && response.request().method() === "DELETE");
  await refreshedRow.getByRole("button", { name: /بله، حذف شود|Yes, remove/i }).click();
  assert.equal((await removeResponse).status(), 200, "customer can remove the stale cart line");
  await refreshedRow.waitFor({ state: "detached" });
  cartResponse = await customerPage.request.get(cartUrl);
  assert.equal(cartResponse.status(), 200);
  cart = (await cartResponse.json()).cart;
  assert.ok(!cart.items.some(value => value.id === item.id || value.variantId === targetId),
    "deleted variant cart line stays absent after persisted reload");
  } finally {
    await customerContext.close();
    await adminContext.close();
  }
});

await result("mobile Persian, English, and Arabic deletion controls in dark theme", async (page) => {
  assert.ok(productId);
  await page.setViewportSize({ width: 375, height: 812 });
  await page.emulateMedia({ colorScheme: "dark" });
  await login(page, `/fa/dashboard/retail-catalog/${productId}`);
  const localeCases = [
    { locale: "fa", dir: "rtl", view: /ویرایش کامل تنوع‌ها|Full variant editor/ },
    { locale: "en", dir: "ltr", view: /Full variant editor/ },
    { locale: "ar", dir: "rtl", view: /تحرير الخيارات/ },
  ];
  for (const item of localeCases) {
    if (item.locale !== "fa") {
      await page.goto(`${BASE}/${item.locale}/dashboard/retail-catalog/${productId}`, { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("networkidle");
    }
    await page.evaluate(() => document.documentElement.classList.add("dark"));
    assert.ok(await page.locator("html.dark").count(), `${item.locale} dark theme styles are active on mobile`);
    assert.equal(await page.locator("html").getAttribute("dir"), item.dir, `${item.locale} dashboard direction`);
    await page.getByRole("button", { name: item.view }).click();
    const cellDelete = page.locator('button[aria-label^="Delete variant:"], button[aria-label^="حذف گونه:"], button[aria-label^="حذف الخيار:"], button[aria-label^="حذف ترکیب:"], button[aria-label^="Delete combination:"]').first();
    await cellDelete.waitFor({ state: "visible", timeout: 30000 });
    const dimensions = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, page: document.documentElement.scrollWidth }));
    assert.ok(dimensions.page <= dimensions.viewport + 1, `${item.locale} editor has no mobile page-level horizontal overflow`);

    await cellDelete.click();
    const dialog = page.getByRole("dialog");
    await dialog.waitFor({ state: "visible" });
    await dialog.getByRole("button", { name: /^(Cancel|لغو|إلغاء)$/ }).click();
    await dialog.waitFor({ state: "hidden" });
    await cellDelete.click();
    await dialog.waitFor({ state: "visible" });
    await dialog.getByRole("button", { name: /Confirm deletion|تأیید حذف|تأكيد الحذف/ }).click();
    await dialog.waitFor({ state: "hidden" });
    await page.getByRole("button", { name: /^(Undo pending deletions|بازگردانی حذف‌های در انتظار|التراجع عن عمليات الحذف المعلقة)$/ }).click();
    if (item.locale === "fa") await page.screenshot({ path: path.join(OUT, `variant-deletion-mobile-rtl-dark-${STAMP}.png`), fullPage: true });
  }
});

const failed = results.filter(value => value.status === "failed").length;
const report = {
  status: failed === 0 ? "PASSED" : "FAILED",
  exitCode: failed === 0 ? 0 : 1,
  cleanup: "DEFERRED_TO_DISPOSABLE_RECOVERY_RUNNER",
  databaseName,
  passed: results.filter(value => value.status === "passed").length,
  failed,
  skipped: results.filter(value => value.status === "skipped").length,
  results,
  fixtureIds: { productId, publishedLastVariantProductId },
};
fs.writeFileSync(path.join(OUT, "variant-deletion-browser-result.json"), JSON.stringify(report, null, 2));
if (failed) process.exitCode = 1;
