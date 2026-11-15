import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";

const baseUrl = process.env.RETAIL_HOME_BASE_URL ?? "http://127.0.0.1:3000";
const tenant = process.env.RETAIL_HOME_TENANT_A ?? "retail-r3-fashion-preview";
const outputDir = path.resolve(process.env.RETAIL_HOME_ARTIFACT_DIR ?? "artifacts/retail-homepage");
const entry = process.env.RETAIL_HOME_PLAYWRIGHT_ENTRY ?? process.env.RETAIL_R3_PLAYWRIGHT_ENTRY;
if (!entry) throw new Error("RETAIL_HOME_PLAYWRIGHT_ENTRY must point to Playwright");
await fs.mkdir(outputDir, { recursive: true });
const { chromium } = await import(pathToFileURL(entry).href);
const browser = await chromium.launch({ headless: true });
const records = [];
const consoleRecords = [];
const outcomes = [];
const record = (item) => records.push({ at: new Date().toISOString(), ...item });
let context;
let traceStarted = false;
try {
  context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
  traceStarted = true;
  const page = await context.newPage();
  page.on("console", (msg) => { if (msg.type() === "error" || /hydration|did not match/i.test(msg.text())) consoleRecords.push({ type: msg.type(), text: msg.text() }); });
  page.on("pageerror", (error) => consoleRecords.push({ type: "pageerror", text: error.message }));
  page.on("request", (request) => {
    const url = new URL(request.url());
    const catalog = /\/api\/public\/v1\/organizations\/([^/]+)\/products(?:\?|$)/.exec(url.pathname);
    const kind = catalog ? "catalog-api" : request.resourceType() === "document" ? "document" : request.headers()["rsc"] ? "rsc" : request.resourceType() === "image" ? "image-media" : null;
    if (!kind) return;
    const item = { kind, phase: "request", method: request.method(), url: request.url(), tenant: catalog?.[1] ?? null,
      page: catalog ? Number(url.searchParams.get("page") ?? 1) : null, limit: catalog ? Number(url.searchParams.get("limit") ?? 20) : null,
      resourceType: request.resourceType() };
    record(item);
    request.__homeRecord = item;
  });
  page.on("response", async (response) => {
    const item = response.request().__homeRecord;
    if (item) record({ ...item, phase: "response", status: response.status() });
  });
  page.on("requestfailed", (request) => { if (request.__homeRecord) record({ ...request.__homeRecord, phase: "failed", error: request.failure()?.errorText }); });

  const scenario = { name: "cold-homepage", result: "running" };
  outcomes.push(scenario);
  const response = await page.goto(`${baseUrl}/fa/retail/${encodeURIComponent(tenant)}`, { waitUntil: "domcontentloaded" });
  assert.equal(response?.status(), 200, "public homepage responds successfully");
  await page.locator("#products [data-retail-product-card]").first().waitFor();
  await page.waitForTimeout(500);
  const cards = page.locator("#products [data-retail-product-card]");
  const initialNames = await cards.locator("h3").allTextContents().catch(async () => cards.locator("article").allTextContents());
  const initialApi = records.filter((x) => x.kind === "catalog-api" && x.phase === "request");
  scenario.productCardCount = await cards.count();
  scenario.initialNames = initialNames;
  scenario.initialCatalogApiRequests = initialApi.length;
  scenario.documentRequests = records.filter((x) => x.kind === "document" && x.phase === "request").length;
  scenario.rscRequests = records.filter((x) => x.kind === "rsc" && x.phase === "request").length;
  scenario.imageRequests = records.filter((x) => x.kind === "image-media" && x.phase === "request").length;
  assert.equal(initialApi.length, 0, "SSR snapshot hydration must not redundantly request the initial product list");
  assert.equal(scenario.productCardCount, 20, "SSR renders exactly the first 20 products");
  await page.screenshot({ path: path.join(outputDir, "homepage-cold.png"), fullPage: true });
  scenario.result = "passed";

  const pageNav = page.getByRole("navigation", { name: "صفحه‌های محصولات" });
  const navExists = await pageNav.count();
  if (navExists && await pageNav.getByRole("button", { name: "بعدی" }).isEnabled()) {
    const next = pageNav.getByRole("button", { name: "بعدی" });
    const before = records.filter((x) => x.kind === "catalog-api" && x.phase === "request").length;
    const page1Ids = await cards.evaluateAll((items) => items.map((item) => item.querySelector('a[href*="/product/"]')?.getAttribute("href")).filter(Boolean));
    const page2Response = page.waitForResponse((r) => r.url().includes("/api/public/v1/organizations/") && new URL(r.url()).searchParams.get("page") === "2" && r.status() === 200);
    await next.click();
    await page2Response;
    await page.getByText(/صفحه ۲ از/).waitFor();
    await page.waitForFunction(() => document.querySelectorAll("#products [data-retail-product-card]").length === 5);
    const page2Cards = await cards.evaluateAll((items) => items.map((item) => item.querySelector('a[href*="/product/"]')?.getAttribute("href")).filter(Boolean));
    assert.equal(records.filter((x) => x.kind === "catalog-api" && x.phase === "request").length, before + 1);
    const request = records.filter((x) => x.kind === "catalog-api" && x.phase === "request").at(-1);
    assert.equal(request.page, 2); assert.equal(request.limit, 20); assert.equal(request.tenant, tenant);
    assert.equal(page2Cards.length, 5, "page 2 renders the remaining five products");
    assert.equal(new Set([...page1Ids, ...page2Cards]).size, 25, "both pages contain 25 unique product links");
    const page1Response = page.waitForResponse((r) => r.url().includes("/api/public/v1/organizations/") && new URL(r.url()).searchParams.get("page") === "1" && r.status() === 200);
    await pageNav.getByRole("button", { name: "قبلی" }).click();
    await page1Response;
    await page.getByText(/صفحه ۱ از/).waitFor();
    const backRequest = records.filter((x) => x.kind === "catalog-api" && x.phase === "request").at(-1);
    assert.equal(backRequest.page, 1); assert.equal(backRequest.limit, 20); assert.equal(backRequest.tenant, tenant);
    outcomes.push({ name: "page-1-2-1", result: "passed", page2VisibleCards: page2Cards.length, requests: [request, backRequest] });
  } else {
    outcomes.push({ name: "page-1-2-1", result: "skipped", reason: "Seed tenant has no second page; dedicated 25-product fixture is required" });
  }
  assert.equal(consoleRecords.length, 0, "browser console and hydration errors absent");
} catch (error) {
  outcomes.push({ name: "homepage-acceptance", result: "failed", error: error.stack ?? String(error) });
  if (context) await context.pages()[0]?.screenshot({ path: path.join(outputDir, "failure.png"), fullPage: true }).catch(() => {});
  throw error;
} finally {
  if (context && traceStarted) await context.tracing.stop({ path: path.join(outputDir, "homepage-trace.zip") }).catch(() => {});
  await fs.writeFile(path.join(outputDir, "network-requests.json"), JSON.stringify(records, null, 2));
  await fs.writeFile(path.join(outputDir, "browser-console.json"), JSON.stringify(consoleRecords, null, 2));
  await fs.writeFile(path.join(outputDir, "homepage-browser-results.json"), JSON.stringify({ baseUrl, tenant, outcomes, consoleErrors: consoleRecords.length }, null, 2));
  await browser.close();
}
console.log(JSON.stringify({ outcomes, requestCount: records.length, artifacts: outputDir }, null, 2));
