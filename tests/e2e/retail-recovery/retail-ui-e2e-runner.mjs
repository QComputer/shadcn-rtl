import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { assertRetailRecoveryEnvironment } from "./safety.mjs";
import { fixtureId } from "./fixture-ids.mjs";

assertRetailRecoveryEnvironment();

const STAMP = process.env.E2E_STAMP || "20261109";
const SLUG = `retail-e2e-${STAMP}`;
const ADMIN = `admin-e2e-${STAMP}`;
const CUSTOMER = `customer-e2e-${STAMP}`;
const PASS = "E2ePass!23456";
const BASE = process.env.E2E_BASE_URL || "http://127.0.0.1:3107";
const PUB_PRODUCT = fixtureId("product", STAMP);
const EXIST_PRODUCT = fixtureId("existingProduct", STAMP);
const OUT = path.resolve(process.env.E2E_OUTPUT_DIR || path.join(process.cwd(), ".tmp", "retail-ui-e2e"));
fs.mkdirSync(OUT, { recursive: true });

let passed = 0, failed = 0;
const results = [];

async function login(page, username, callbackPath) {
  const expectedPath = new URL(callbackPath, BASE).pathname;
  const loginUrl = new URL("/fa/login", BASE);
  loginUrl.searchParams.set("callbackUrl", expectedPath);
  await page.goto(loginUrl.toString(), { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle");
  await page.locator("#username").fill(username);
  await page.locator("#password").fill(PASS);
  // The form mounts after hydration; wait for its initial session requests too.
  await page.waitForLoadState("networkidle");
  await page.locator('form button[type="submit"]').click();
  await page.waitForURL((url) => url.pathname === expectedPath, { timeout: 60000 });
  await page.waitForLoadState("networkidle");
}

async function saveAndWait(page) {
  const save = page.getByRole("button", { name: /ذخیره پیش.?نویس|ذخیره تغییرات|Save draft|Save changes/ }).first();
  await save.waitFor({ state: "visible", timeout: 30000 });
  const saved = page.waitForResponse(response => /\/api\/dashboard\/retail\/catalog(?:\/[a-z0-9]+)?$/.test(new URL(response.url()).pathname) && ['POST', 'PATCH'].includes(response.request().method()));
  await save.click();
  const response = await saved;
  if (!response.ok()) throw new Error('Product save request failed.');
  return response.json();
}

function bodyText(page) { return page.locator("body").innerText(); }

async function run(name, fn) {
  const browser = await chromium.launch({ headless: true, executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", args: ["--disable-features=HttpsFirstBalancedModeAutoEnable,HttpsUpgrades"] });
  const context = await browser.newContext({ baseURL: BASE });
  const page = await context.newPage();
  page.on("pageerror", (e) => { console.log(`  [console error] ${name}: ${e.message}`); });
  const started = Date.now();
  try {
    await fn(page, context);
    const ms = Date.now() - started;
    passed += 1;
    results.push({ name, status: "passed", ms });
    console.log(`PASS ${name} (${ms}ms)`);
  } catch (e) {
    failed += 1;
    const ms = Date.now() - started;
    results.push({ name, status: "failed", ms, error: String(e) });
    console.log(`FAIL ${name} (${ms}ms): ${String(e).slice(0, 400)}`);
    const safeName = name.split(":")[0].trim().replace(/[^a-z0-9_-]+/gi, "-");
    try { await page.screenshot({ path: path.join(OUT, `fail-${safeName}-${STAMP}.png`), fullPage: true }); } catch {}
    try { await page.screenshot({ path: path.join(OUT, `fail-${safeName}-${STAMP}-thumb.png`)}); } catch {}
  }
  await context.close();
  await browser.close();
}

(async () => {
  // A: merchant creates product with Persian custom colors, generates matrix, saves and reloads
  await run("A: create product custom colors matrix save reload", async (page) => {
    await login(page, ADMIN, `${BASE}/fa/dashboard/retail-catalog/new`);
    await expectVisible(page.getByText(/افزودن محصول فروشگاه|Add retail product/), 60000);
    await page.locator('input[minlength="2"]').first().fill(`کفش ماتریس ${STAMP}`);
    await page.locator('input[type="number"][min="0.01"]').first().fill("450000");
    await page.locator('select[required]').first().selectOption({ label: "کفش ورزشی" });
    await page.getByText(/ساخت گونه.?ها از رنگ و سایز|Generate variants from color/).click();
    const generator = page.locator('details').filter({ hasText: /ساخت گونه.?ها از رنگ و سایز/ });
    const genSelects = generator.locator('select');
    await genSelects.nth(0).selectOption({ label: "رنگ" });
    await genSelects.nth(1).selectOption({ label: "سایز" });
    await generator.getByRole("button", { name: /^(استاندارد|Standard)$/ }).click();
    for (const size of [/^(40|۴۰)$/, /^(41|۴۱)$/]) await page.getByRole("button", { name: size }).click();
    const customColors = "مشکی، زیتونی، کرم استخوانی، آبی نفتی، custom navy";
    await generator.locator('input[placeholder*="زیتونی"], input[placeholder*="Black"]').first().fill(customColors);
    await generator.getByLabel("موجودی", { exact: true }).fill("۱۰");
    await page.getByRole("button", { name: /پیش.?نمایش ترکیب|Preview combinations/ }).click();
    await page.locator("text=/ترکیب جدید|New combinations/").first().waitFor({ state: "visible", timeout: 30000 });
    const errs = page.locator('details .text-destructive, details [class*="destructive"]').filter({ hasText: /./ });
    const errCount = await errs.count();
    if (errCount !== 0) throw new Error(`preview errors present: ${errCount}`);
    await page.getByRole("button", { name: /^ایجاد ترکیب|Generate variants$/ }).click();
    const created = await saveAndWait(page);
    if (created.product?.variants?.length !== 10) throw new Error('Expected all ten color/size combinations to be persisted.');
    await page.waitForURL(url => url.pathname === `/fa/dashboard/retail-catalog/${created.product.id}`, { timeout: 60000 });
    const editUrl = page.url();
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle");
    await page.getByText(/مدیریت محصول فروشگاه|Manage retail product/).waitFor({ state: "visible", timeout: 60000 });
    const body = await bodyText(page);
    for (const token of ["زیتونی", "کرم استخوانی", "آبی نفتی"]) if (!body.includes(token)) throw new Error(`missing ${token} after reload`);
    if (!body.match(/40|۴۰/)) throw new Error("size 40 missing after reload");
    if (!body.match(/41|۴۱/)) throw new Error("size 41 missing after reload");
    console.log(`  evidence A: ${editUrl}`);
  });

  // A2: existing product preservation
  await run("A2: existing product edit preserves SKU price inventory", async (page) => {
    await login(page, ADMIN, `${BASE}/fa/dashboard/retail-catalog/${EXIST_PRODUCT}`);
    await page.getByText(/مدیریت محصول فروشگاه|Manage retail product/).waitFor({ state: "visible", timeout: 60000 });
    await page.getByRole("button", { name: /ویرایش کامل تنوع‌ها|Full variant editor/ }).click();
    const skuBefore = page.getByLabel(/شناسه کالا \(SKU\)/).first();
    if (await skuBefore.inputValue() !== `EXIST-BLK-39-${STAMP}`) throw new Error("SKU not loaded");
    await page.locator('input[minlength="2"]').first().fill(`محصول موجود ویرایش ${STAMP}`);
    await saveAndWait(page);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle");
    if (await page.locator('input[minlength="2"]').first().inputValue() !== `محصول موجود ویرایش ${STAMP}`) throw new Error('Product name not persisted after reload.');
    await page.getByRole("button", { name: /ویرایش کامل تنوع‌ها|Full variant editor/ }).click();
    if (await page.getByLabel(/شناسه کالا \(SKU\)/).first().inputValue() !== `EXIST-BLK-39-${STAMP}`) throw new Error("SKU not preserved after reload");
    if (Number(await page.getByLabel(/^قیمت اختصاصی/).and(page.locator('input[type="number"]')).first().inputValue()) !== 320000) throw new Error("price not preserved after reload");
    if (Number(await page.getByLabel(/^موجودی/).and(page.locator('input[type="number"]')).first().inputValue()) !== 7) throw new Error("inventory not preserved after reload");
    const foreign = await page.request.get(`${BASE}/api/dashboard/retail/catalog/${fixtureId("foreignProduct", STAMP)}`);
    if (![403, 404].includes(foreign.status())) throw new Error(`cross-tenant product read not rejected: ${foreign.status()}`);
  });

  // B: storefront custom color/size add-to-cart + cart persistence
  await run("B: storefront custom color size add-to-cart persistence", async (page, context) => {
    await login(page, CUSTOMER, `${BASE}/fa/${SLUG}/shop/product/${PUB_PRODUCT}`);
    await page.goto(`${BASE}/fa/${SLUG}/shop/product/${PUB_PRODUCT}`, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle");
    await page.locator("h1").first().waitFor({ state: "visible", timeout: 60000 });
    const navy = page.getByRole("button", { name: /آبی نفتی/ }).first();
    if (await navy.count()) await navy.click();
    const size41 = page.getByRole("button", { name: /41|۴۱/ }).first();
    if (await size41.count()) await size41.click();
    await page.locator(`text=/PUB-NAVY-41/`).first().waitFor({ state: "visible", timeout: 30000 });
    const add = page.getByRole("button", { name: /افزودن .* به سبد|افزودن به سبد خرید/ }).first();
    await add.waitFor({ state: "visible", timeout: 30000 });
    if (!(await add.isEnabled())) throw new Error("add to cart disabled");
    const added = page.waitForResponse(response => response.url().includes('/api/retail/v1/cart') && response.request().method() === 'POST');
    await add.click();
    const addResponse = await added;
    if (addResponse.status() !== 201) throw new Error(`cart POST ${addResponse.status()}`);
    await page.getByRole("status").filter({ hasText: "همین گزینه به سبد خرید اضافه شد." }).waitFor({ state: "visible", timeout: 30000 });
    const r1 = await context.request.get(`${BASE}/api/retail/v1/cart?organization=${encodeURIComponent(SLUG)}`);
    if (!r1.ok()) throw new Error(`cart GET ${r1.status()}`);
    const c1 = await r1.json();
    const s1 = JSON.stringify(c1);
    if (!s1.includes(`PUB-NAVY-41-${STAMP}`) && !s1.includes("آبی نفتی")) throw new Error(`cart missing variant: ${s1.slice(0,500)}`);
    await page.reload({ waitUntil: "domcontentloaded" });
    const r2 = await context.request.get(`${BASE}/api/retail/v1/cart?organization=${encodeURIComponent(SLUG)}`);
    const s2 = JSON.stringify(await r2.json());
    if (!s2.includes("آبی نفتی")) throw new Error("cart not persisted after reload");
    console.log("  evidence B: cart persisted variant ABI NAFTI");
  });

  // B2: cross-tenant cart rejection
  await run("B2: cross-tenant cart rejection", async (page, context) => {
    await login(page, CUSTOMER, `${BASE}/fa/${SLUG}/shop/product/${PUB_PRODUCT}`);
    const cartUrl = `${BASE}/api/retail/v1/cart?organization=${encodeURIComponent(SLUG)}`;
    const beforeResponse = await context.request.get(cartUrl);
    if (!beforeResponse.ok()) throw new Error(`cart baseline GET ${beforeResponse.status()}`);
    const before = (await beforeResponse.json()).cart;
    const item = before?.items.find(value => value.variantId === fixtureId("pub2", STAMP));
    if (!item) throw new Error("Expected the real persisted navy cart item before tenant mutation checks.");
    const bad = await context.request.post(`${BASE}/api/retail/v1/cart`, { headers: { origin: BASE }, data: { organization: `retail-e2e-other-${STAMP}`, variantId: fixtureId("pub1", STAMP), quantity: 1 } });
    if (bad.status() !== 404) throw new Error(`cross-tenant variant must be unavailable: ${bad.status()}`);
    for (const method of ["patch", "delete"]) {
      const response = await context.request[method](`${BASE}/api/retail/v1/cart`, {
        headers: { origin: BASE },
        data: { organization: `retail-e2e-other-${STAMP}`, itemId: item.id,
          ...(method === "patch" ? { quantity: item.quantity + 1 } : {}) },
      });
      if (response.status() !== 404) throw new Error(`cross-tenant cart ${method} must be rejected: ${response.status()}`);
    }
    const afterResponse = await context.request.get(cartUrl);
    if (!afterResponse.ok()) throw new Error(`cart verification GET ${afterResponse.status()}`);
    const after = (await afterResponse.json()).cart;
    const snapshot = cart => JSON.stringify(cart.items.map(value => ({
      id: value.id, variantId: value.variantId, quantity: value.quantity,
    })).sort((a, b) => a.id.localeCompare(b.id)));
    if (snapshot(after) !== snapshot(before)) throw new Error("Rejected cross-tenant mutations changed the original cart.");
    console.log("  evidence B2: cross-tenant POST/PATCH/DELETE rejected; persisted cart unchanged");
  });

  // D: real XLSX upload/preview/execute
  await run("D: Import Hub XLSX upload preview execute", async (page) => {
    await login(page, ADMIN, `${BASE}/fa/dashboard/imports`);
    await page.getByText(/ورود و خروج گروهی کاتالوگ فروشگاه|Retail catalog bulk import/i).first().waitFor({ state: "visible", timeout: 60000 });
    const XLSX = await import("xlsx");
    const rows = [
      ["product_key","product_name","brand","category_id","published","track_inventory","base_price_toman","variant_name","sku","price_toman","stock","allow_backorder","attribute:color","attribute:size"],
      [`imp-${STAMP}`,"محصول ایمپورت E2E","E2E",fixtureId("category", STAMP),"false","true","390000","زیتونی / 42",`IMP-OLIVE-42-${STAMP}`,"390000","4","false","زیتونی","42"],
      [`imp-${STAMP}`,"محصول ایمپورت E2E","E2E",fixtureId("category", STAMP),"false","true","390000","آبی نفتی / 43",`IMP-NAVY-43-${STAMP}`,"390000","2","false","آبی نفتی","43"],
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), "Retail");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    const fixture = path.join(OUT, `import-${STAMP}.xlsx`);
    fs.writeFileSync(fixture, buf);
    await page.locator('input[type="file"]').first().setInputFiles(fixture);
    const previewResponse = page.waitForResponse(response => response.url().includes('/api/dashboard/imports/retail/preview') && response.request().method() === 'POST');
    await page.getByRole("button", { name: /ساخت پیش.?نمایش|Build preview/ }).click();
    const preview = await (await previewResponse).json();
    const { token: _token, ...previewEvidence } = preview;
    void _token;
    fs.writeFileSync(path.join(OUT, 'import-preview.json'), JSON.stringify(previewEvidence, null, 2));
    if (preview.counts?.invalidRows !== 0) throw new Error(`import preview invalid: ${JSON.stringify(previewEvidence).slice(0, 900)}`);
    await page.getByText(/پیش.?نمایش بررسی.?شده|Validated preview/i).first().waitFor({ state: "visible", timeout: 60000 });
    const body = await bodyText(page);
    if (!body.includes("زیتونی")) throw new Error("زیتونی missing in preview");
    if (!body.includes("آبی نفتی")) throw new Error("آبی نفتی missing in preview");
    const confirm = page.getByRole('checkbox', { name: /ردیف‌ها و هشدارها|reviewed the rows and warnings/ });
    await confirm.check();
    await page.getByRole("button", { name: /تأیید و اجرای ورود|Confirm and run import/ }).click();
    await page.getByText(/ورود گروهی تکمیل شد|Bulk import completed/i).first().waitFor({ state: "visible", timeout: 120000 });
    const importedList = await page.request.get(`${BASE}/api/dashboard/retail/catalog?query=${encodeURIComponent('محصول ایمپورت E2E')}`);
    const imported = (await importedList.json()).products?.find(product => product.name === 'محصول ایمپورت E2E');
    if (!imported || imported.basePrice !== 390000 || imported.variants.length !== 2) throw new Error('Imported product values were not persisted.');
    for (const [suffix, color, inventory] of [['OLIVE-42', 'زیتونی', 4], ['NAVY-43', 'آبی نفتی', 2]]) {
      const variant = imported.variants.find(value => value.sku === `IMP-${suffix}-${STAMP}`);
      if (!variant || variant.inventory !== inventory || !JSON.stringify(variant.options).includes(color)) throw new Error('Imported custom color or inventory was not persisted.');
    }
    console.log("  evidence D: real XLSX execute completed and persisted variants verified");
  });

  // C/E: RTL mobile
  await run("C/E: RTL mobile storefront custom color", async (page) => {
    await page.setViewportSize({ width: 375, height: 812 });
    for (const pathname of [`/fa/${SLUG}`, `/fa/${SLUG}/shop`]) {
      await page.goto(`${BASE}${pathname}`, { waitUntil: "networkidle" });
      await page.getByText('کفش منتشرشده E2E', { exact: true }).first().waitFor({ state: 'visible' });
      if (await page.getByRole('button', { name: /افزودن.*به سبد/ }).count()) throw new Error('Catalog cards must not expose add-to-cart buttons.');
    }
    await page.goto(`${BASE}/fa/${SLUG}/shop/product/${PUB_PRODUCT}`, { waitUntil: "domcontentloaded" });
    await page.locator("h1").first().waitFor({ state: "visible", timeout: 60000 });
    const dirCount = await page.locator('[dir="rtl"], html[dir="rtl"], body[dir="rtl"]').count();
    if (dirCount === 0) throw new Error("no RTL container");
    await page.getByRole("button", { name: /آبی نفتی/ }).first().waitFor({ state: "visible", timeout: 30000 });
    await page.screenshot({ path: path.join(OUT, `storefront-mobile-${STAMP}.png`), fullPage: true });
    console.log(`  evidence C/E: RTL mobile screenshot`);
  });

  console.log(`\n=== RESULTS: ${passed} passed, ${failed} failed ===`);
  for (const r of results) console.log(`  ${r.status.toUpperCase()} ${r.name} (${r.ms}ms)`);
  fs.writeFileSync(path.join(OUT, "browser-results.json"), JSON.stringify({
    status: failed === 0 ? "PASSED" : "FAILED", exitCode: failed === 0 ? 0 : 1,
    passed, failed, skipped: 0,
    results: results.map(({ name, status, ms, error }) => ({
      name, status, durationMs: ms,
      ...(error ? { error: String(error).replace(/(?:postgres(?:ql)?:\/\/)[^\s]+/gi, "[redacted database URL]") } : {}),
    })),
  }, null, 2));
  if (failed > 0) process.exit(1);
})();

async function expectVisible(locator, ms) { await locator.waitFor({ state: "visible", timeout: ms }); }
