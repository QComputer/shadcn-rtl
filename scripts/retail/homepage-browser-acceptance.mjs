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
const expectedInjectedConsole = [];
const expectedAuthConsole = [];
const expectedProjectionRejectionConsole = [];
const outcomes = [];
const injectedFailures = [];
const externalAssetStubs = [];
const unsafeMediaRequests = [];
const expectedAuthResponses = [];
const record = (item) => records.push({ at: new Date().toISOString(), ...item });
async function captureScreenshot(page, filePath) {
  const session = await page.context().newCDPSession(page);
  try {
    const dimensions = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight }));
    const { data } = await session.send("Page.captureScreenshot", {
      format: "png",
      captureBeyondViewport: true,
      clip: { x: 0, y: 0, width: dimensions.width, height: dimensions.height, scale: 1 },
    });
    await fs.writeFile(filePath, Buffer.from(data, "base64"));
  } finally {
    await session.detach();
  }
}
async function waitForRetailHydration(page) {
  await page.waitForFunction(() => {
    const control = document.querySelector("#categories button");
    return control && Object.keys(control).some((key) => key.startsWith("__reactProps$"));
  });
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}
let context;
let traceStarted = false;
try {
  context = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: "block" });
  await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
  traceStarted = true;
  await context.route("https://trustseal.enamad.ir/logo.aspx**", async (route) => {
    externalAssetStubs.push({ url: route.request().url(), reason: "third-party trust-seal asset is outside the disposable browser test" });
    await route.fulfill({ status: 200, contentType: "image/png", body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jWZcAAAAASUVORK5CYII=", "base64") });
  });
  const page = await context.newPage();
  page.on("console", (msg) => {
    const location = msg.location();
    if (msg.type() === "error" && injectedFailures.length > 0 && /503 \(Service Unavailable\)/i.test(msg.text())) {
      expectedInjectedConsole.push({ type: "expected-injected-api-failure", text: msg.text() });
      return;
    }
    if (msg.type() === "error" && location.url.includes("/api/retail/v1/favorites") && /401|Unauthorized/i.test(msg.text())) {
      expectedAuthConsole.push({ type: "expected-anonymous-auth-denial", text: msg.text(), url: location.url });
      return;
    }
    const projectionUrl = (() => { try { return new URL(location.url); } catch { return null; } })();
    const expectedProjectionRejection = projectionUrl?.pathname === "/api/public/products/avid-preview"
      && ((projectionUrl.search === "" && /400 \(Bad Request\)/i.test(msg.text()))
        || (projectionUrl.searchParams.get("organizationSlug") === "retail-r3-mobile-preview" && /404 \(Not Found\)/i.test(msg.text())));
    if (msg.type() === "error" && expectedProjectionRejection) {
      expectedProjectionRejectionConsole.push({ type: "expected-tenant-projection-rejection", text: msg.text(), url: location.url });
      return;
    }
    if (msg.type() === "error" || /hydration|did not match/i.test(msg.text())) consoleRecords.push({ type: msg.type(), text: msg.text(), url: location.url });
  });
  page.on("pageerror", (error) => consoleRecords.push({ type: "pageerror", text: error.message }));
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.protocol === "javascript:") unsafeMediaRequests.push({ url: request.url(), referer: request.headers().referer ?? null });
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
    const responseUrl = new URL(response.url());
    if (responseUrl.pathname === "/api/retail/v1/favorites" && response.status() === 401) {
      expectedAuthResponses.push({ url: response.url(), status: response.status() });
    }
    const item = response.request().__homeRecord;
    if (item) record({ ...item, phase: "response", status: response.status() });
  });
  page.on("requestfailed", (request) => { if (request.__homeRecord) record({ ...request.__homeRecord, phase: "failed", error: request.failure()?.errorText }); });

  const scenario = { name: "cold-homepage", result: "running" };
  outcomes.push(scenario);
  const response = await page.goto(`${baseUrl}/fa/retail/${encodeURIComponent(tenant)}`, { waitUntil: "domcontentloaded" });
  assert.equal(response?.status(), 200, "public homepage responds successfully");
  const homepageSsr = await response.text();
  assert.equal(homepageSsr.includes("javascript:alert(1)"), false, "SSR does not serialize rejected media schemes");
  assert.equal(homepageSsr.includes("/retail-preview/preview-mobile-campaign.png"), false, "SSR does not serialize another tenant's media reference");
  await page.locator("#products [data-retail-product-card]").first().waitFor();
  await waitForRetailHydration(page);
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
  const publicProjection = await page.evaluate(async (organization) => {
    const [listResponse, detailResponse, legacyUnscopedResponse, legacyWrongTenantResponse, sharedAssetResponse] = await Promise.all([
      fetch(`/api/public/v1/organizations/${encodeURIComponent(organization)}/products?page=1&limit=20`),
      fetch(`/api/public/v1/organizations/${encodeURIComponent(organization)}/products/avid-preview`),
      fetch("/api/public/products/avid-preview"),
      fetch("/api/public/products/avid-preview?organizationSlug=retail-r3-mobile-preview"),
      fetch("/retail-preview/preview-mobile-campaign.png"),
    ]);
    return {
      listStatus: listResponse.status,
      list: await listResponse.json(),
      detailStatus: detailResponse.status,
      detail: await detailResponse.json(),
      legacyUnscopedStatus: legacyUnscopedResponse.status,
      legacyWrongTenantStatus: legacyWrongTenantResponse.status,
      crossTenantFixtureAssetStatus: sharedAssetResponse.status,
    };
  }, tenant);
  assert.equal(publicProjection.listStatus, 200);
  assert.equal(publicProjection.detailStatus, 200);
  assert.equal(publicProjection.legacyUnscopedStatus, 400, "legacy public product API requires an explicit tenant context");
  assert.equal(publicProjection.legacyWrongTenantStatus, 404, "legacy public product API cannot resolve Tenant A's product under Tenant B");
  assert.equal(publicProjection.crossTenantFixtureAssetStatus, 200, "the referenced URL is a publicly served shared fixture asset, not a tenant-private media endpoint");
  assert.equal(publicProjection.list.data.products.some((product) => product.media.card === "/retail-preview/preview-fashion-campaign.png"), true, "Tenant A's valid public image remains available");
  assert.equal(publicProjection.detail.data.media.detail, "/retail-preview/preview-fashion-campaign.png", "the valid same-tenant detail image remains available");
  const serializedProjection = JSON.stringify({ list: publicProjection.list, detail: publicProjection.detail });
  assert.equal(serializedProjection.includes("javascript:alert(1)"), false, "v1 list and product API bodies exclude unsafe media schemes");
  assert.equal(serializedProjection.includes("/retail-preview/preview-mobile-campaign.png"), false, "v1 list and product API bodies exclude another tenant's image reference");
  scenario.publicProjectionAudit = {
    listStatus: publicProjection.listStatus,
    productDetailStatus: publicProjection.detailStatus,
    unsafeOrForeignReferences: 0,
    sharedStaticFixtureUrlStatus: publicProjection.crossTenantFixtureAssetStatus,
  };
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
    const returnedPage1Ids = await cards.evaluateAll((items) => items.map((item) => item.querySelector('a[href*="/product/"]')?.getAttribute("href")).filter(Boolean));
    const backRequest = records.filter((x) => x.kind === "catalog-api" && x.phase === "request").at(-1);
    assert.equal(backRequest.page, 1); assert.equal(backRequest.limit, 20); assert.equal(backRequest.tenant, tenant);
    assert.deepEqual(returnedPage1Ids, page1Ids, "page 1 product identity and order remain stable after returning from page 2");
    assert.equal(new Set([...page1Ids, ...page2Cards]).size, 25, "page boundaries contain no duplicate or missing product identities");
    outcomes.push({ name: "page-1-2-1", result: "passed", page2VisibleCards: page2Cards.length, orderedPage1Ids: page1Ids, orderedPage2Ids: page2Cards, requests: [request, backRequest] });
  } else {
    outcomes.push({ name: "page-1-2-1", result: "skipped", reason: "Seed tenant has no second page; dedicated 25-product fixture is required" });
  }

  const categoryButton = page.getByRole("button", { name: "لوازم نمونه" });
  const categoryResponse = page.waitForResponse((r) => r.url().includes("/api/public/v1/organizations/") && new URL(r.url()).searchParams.get("category") === "perf-home-accessories" && r.status() === 200);
  await categoryButton.click();
  await categoryResponse;
  assert.equal(await cards.count(), 12, "category filter returns only its 12 assigned products");
  const resetResponse = page.waitForResponse((r) => r.url().includes("/api/public/v1/organizations/") && !new URL(r.url()).searchParams.has("category") && r.status() === 200);
  await page.getByRole("button", { name: "حذف فیلتر دسته‌بندی" }).click();
  await resetResponse;
  await page.waitForFunction(() => document.querySelectorAll("#products [data-retail-product-card]").length === 20);
  outcomes.push({ name: "category-filter-reset", result: "passed", filteredCards: 12, restoredCards: 20 });

  const catalogRequestsBeforeRemount = records.filter((item) => item.kind === "catalog-api" && item.phase === "request").length;
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator("#products [data-retail-product-card]").first().waitFor();
  await waitForRetailHydration(page);
  const remountCatalogRequestCount = records.filter((item) => item.kind === "catalog-api" && item.phase === "request").length - catalogRequestsBeforeRemount;
  assert.equal(remountCatalogRequestCount, 0, "page remount reuses the server snapshot without an initial browser catalog request");
  outcomes.push({ name: "remount-no-duplicate-request", result: "passed" });

  const pageTwoMatcher = "**/api/public/v1/organizations/retail-r3-fashion-preview/products**";
  await context.route(pageTwoMatcher, async (route) => {
    const requested = new URL(route.request().url());
    if (!requested.pathname.endsWith("/organizations/retail-r3-fashion-preview/products") || requested.searchParams.get("page") !== "2" || requested.searchParams.get("limit") !== "20") return route.continue();
    injectedFailures.push({ url: route.request().url(), method: route.request().method(), status: 503, at: new Date().toISOString() });
    await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "synthetic temporary failure" }) });
  });
  const injectedResponse = page.waitForResponse((r) => r.status() === 503 && r.url().includes("/organizations/retail-r3-fashion-preview/products?page=2&limit=20"));
  await page.getByRole("navigation", { name: "صفحه‌های محصولات" }).getByRole("button", { name: "بعدی" }).click();
  await injectedResponse;
  const catalogError = page.locator('#products [role="alert"]');
  await catalogError.waitFor();
  assert.equal(injectedFailures.length, 1, "the intended page-two catalog request is intercepted exactly once");
  await context.unroute(pageTwoMatcher);
  await catalogError.getByRole("button", { name: "تلاش دوباره" }).click();
  await page.getByText(/صفحه ۲ از/).waitFor();
  await page.waitForFunction(() => document.querySelectorAll("#products [data-retail-product-card]").length === 5);
  outcomes.push({ name: "failure-retry", result: "passed" });

  await page.context().setOffline(true);
  const reconnectResponse = page.waitForResponse((r) => r.url().includes("/api/public/v1/organizations/retail-r3-fashion-preview/products") && r.status() === 200);
  await page.context().setOffline(false);
  const reconnect = await reconnectResponse;
  assert.equal(new URL(reconnect.url()).searchParams.get("limit"), "20");
  outcomes.push({ name: "offline-online-reconnect", result: "passed" });

  const returnResponse = page.waitForResponse((r) => r.url().includes("/api/public/v1/organizations/retail-r3-fashion-preview/products") && new URL(r.url()).searchParams.get("page") === "1" && r.status() === 200);
  await page.getByRole("navigation", { name: "صفحه‌های محصولات" }).getByRole("button", { name: "قبلی" }).click();
  await returnResponse;
  let releaseRefresh;
  let refreshRequestSeen;
  const refreshSeen = new Promise((resolve) => { refreshRequestSeen = resolve; });
  const refreshGate = new Promise((resolve) => { releaseRefresh = resolve; });
  await context.route(pageTwoMatcher, async (route) => {
    const requested = new URL(route.request().url());
    if (!requested.pathname.endsWith("/organizations/retail-r3-fashion-preview/products") || requested.searchParams.get("page") !== "2" || requested.searchParams.get("limit") !== "20") return route.continue();
    refreshRequestSeen();
    await refreshGate;
    await route.continue();
  });
  const firstPageHref = await cards.first().locator('a[href*="/product/"]').first().getAttribute("href");
  await page.getByRole("navigation", { name: "صفحه‌های محصولات" }).getByRole("button", { name: "بعدی" }).click();
  await refreshSeen;
  assert.equal(await cards.count(), 20, "existing products stay visible during refresh");
  assert.equal(await cards.first().locator('a[href*="/product/"]').first().getAttribute("href"), firstPageHref);
  assert.equal(await page.getByRole("status").count() > 0, true, "refresh progress is announced without hiding the grid");
  releaseRefresh();
  await page.waitForFunction(() => document.querySelectorAll("#products [data-retail-product-card]").length === 5);
  await context.unroute(pageTwoMatcher);
  outcomes.push({ name: "background-refresh-keeps-grid", result: "passed" });

  let releaseStaleCategory;
  let staleCategoryStarted;
  const staleCategorySeen = new Promise((resolve) => { staleCategoryStarted = resolve; });
  const staleCategoryGate = new Promise((resolve) => { releaseStaleCategory = resolve; });
  const delayedCategoryMatcher = "**/api/public/v1/organizations/retail-r3-fashion-preview/products**";
  await context.route(delayedCategoryMatcher, async (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.get("category") !== "perf-home-accessories") return route.continue();
    const upstream = await route.fetch();
    const body = await upstream.text();
    staleCategoryStarted({ url: route.request().url(), status: upstream.status() });
    await staleCategoryGate;
    await route.fulfill({ response: upstream, body });
  });
  const accessoryRequest = page.waitForRequest((request) => request.url().includes("category=perf-home-accessories"));
  await page.getByRole("button", { name: "لوازم نمونه" }).click();
  await accessoryRequest;
  const staleStarted = await staleCategorySeen;
  const staleRequestOutcome = Promise.race([
    page.waitForEvent("requestfailed", (request) => request.url() === staleStarted.url).then(() => "aborted"),
    page.waitForResponse((response) => response.url() === staleStarted.url && response.status() === 200).then(() => "completed"),
  ]);
  const resetAfterRace = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return url.pathname.endsWith("/products") && !url.searchParams.has("category") && response.status() === 200;
  });
  await page.getByRole("button", { name: "حذف فیلتر دسته‌بندی" }).click();
  await resetAfterRace;
  await page.waitForFunction(() => document.querySelectorAll("#products [data-retail-product-card]").length === 20);
  releaseStaleCategory();
  const staleRequestDisposition = await staleRequestOutcome;
  assert.equal(await cards.count(), 20, "the delayed category response cannot replace newer all-category results");
  assert.equal(await page.getByRole("button", { name: "همه دسته‌بندی‌ها" }).getAttribute("aria-pressed"), "true");
  await context.unroute(delayedCategoryMatcher);
  outcomes.push({ name: "concurrent-category-stale-response", result: "passed", intercepted: staleStarted, staleRequestDisposition });

  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.locator("#products [data-retail-product-card]").count(), 20, "mobile viewport retains the product grid");
  assert.equal(await page.getByRole("navigation", { name: "پیمایش موبایل فروشگاه" }).isVisible(), true, "mobile navigation is visible");
  await captureScreenshot(page, path.join(outputDir, "homepage-mobile.png"));
  await page.setViewportSize({ width: 1280, height: 900 });
  assert.equal(await page.locator("#products [data-retail-product-card]").count(), 20, "desktop viewport retains the product grid");
  outcomes.push({ name: "mobile-desktop-smoke", result: "passed" });

  for (const routePath of [
    "/fa/retail/retail-r3-fashion-preview/product/avid-preview",
    "/fa/retail-r3-fashion-preview/shop/product/avid-preview",
  ]) {
    const legacyProductApi = routePath.includes("/shop/product/")
      ? page.waitForResponse((response) => response.url().includes("/api/public/products/avid-preview?organizationSlug=retail-r3-fashion-preview") && response.status() === 200)
      : null;
    const detail = await page.goto(`${baseUrl}${routePath}`, { waitUntil: "domcontentloaded" });
    assert.equal(detail?.status(), 200, `product detail route renders: ${routePath}`);
    const detailSsrRsc = await detail.text();
    assert.equal(detailSsrRsc.includes("javascript:alert(1)"), false, `SSR/RSC payload excludes unsafe media: ${routePath}`);
    assert.equal(detailSsrRsc.includes("/retail-preview/preview-mobile-campaign.png"), false, `SSR/RSC payload excludes foreign media: ${routePath}`);
    await page.getByRole("heading", { name: "کتانی نمونه آوید", level: 1 }).waitFor();
    const detailHtml = await page.content();
    assert.equal(detailHtml.includes("javascript:alert(1)"), false, `SSR/RSC detail rendering excludes unsafe media: ${routePath}`);
    assert.equal(detailHtml.includes("/retail-preview/preview-mobile-campaign.png"), false, `SSR/RSC detail rendering excludes foreign media: ${routePath}`);
    if (legacyProductApi) {
      const response = await legacyProductApi;
      const payload = await response.json();
      assert.equal(response.headers()["cache-control"], "private, no-store", "tenant-scoped legacy product projection is not shared-cached");
      assert.equal(payload.product.image, "/retail-preview/preview-fashion-campaign.png", "legacy detail retains its tenant-owned safe primary image");
      assert.deepEqual(payload.product.images, [], "legacy detail excludes duplicate, private and cross-tenant media");
      assert.equal(JSON.stringify(payload).includes("javascript:"), false, "legacy public product payload excludes unsafe URL schemes");
      assert.equal("aiPrimaryMediaAssetId" in payload.product, false, "legacy public product payload omits internal AI media identifiers");
    }
  }
  assert.equal(unsafeMediaRequests.length, 0, "no browser request uses an unsafe media URL scheme");
  assert.equal(expectedAuthResponses.length >= 1, true, "anonymous favorites reads remain denied by the real API");
  outcomes.push({ name: "both-product-detail-routes", result: "passed" });

  const tenantBResponse = await page.goto(`${baseUrl}/fa/retail/retail-r3-mobile-preview`, { waitUntil: "domcontentloaded" });
  assert.equal(tenantBResponse?.status(), 200);
  await page.locator("#products [data-retail-product-card]").first().waitFor();
  await waitForRetailHydration(page);
  assert.equal(await page.getByText("کتانی نمونه آوید").count(), 0, "Tenant A product is absent after switching to Tenant B");
  assert.equal(await page.locator("#products [data-retail-product-card]").count(), 5, "Tenant B renders only its five published products");
  assert.equal((await page.content()).includes("perf-home-a-"), false, "Tenant B SSR contains no Tenant A product identifiers");
  const tenantBRequests = records.filter((item) => item.kind === "catalog-api" && item.phase === "request" && item.tenant === "retail-r3-mobile-preview");
  assert.equal(tenantBRequests.length, 0, "tenant B uses its own SSR snapshot without a redundant fetch");
  outcomes.push({ name: "tenant-a-to-b-isolation", result: "passed", visibleCards: 5, initialCatalogApiRequests: tenantBRequests.length });
  const emptyResponse = await page.goto(`${baseUrl}/fa/retail/retail-home-empty-preview`, { waitUntil: "domcontentloaded" });
  assert.equal(emptyResponse?.status(), 200);
  await waitForRetailHydration(page);
  await page.getByText("محصولی با این مشخصات پیدا نشد. فیلترها را تغییر دهید.").waitFor();
  assert.equal(await page.getByRole("navigation", { name: "صفحه‌های محصولات" }).count(), 0, "empty catalog has no invalid pagination controls");
  assert.equal((await page.content()).includes("perf-home-a-"), false, "empty Tenant C SSR contains no Tenant A products");
  const emptyCategoryResponse = page.waitForResponse((response) => response.url().includes("category=empty-category") && response.status() === 200);
  await page.getByRole("button", { name: "دسته خالی" }).click();
  await emptyCategoryResponse;
  await page.getByText("محصولی با این مشخصات پیدا نشد. فیلترها را تغییر دهید.").waitFor();
  assert.equal(await page.getByRole("navigation", { name: "صفحه‌های محصولات" }).count(), 0, "empty category has no invalid page controls");
  outcomes.push({ name: "empty-catalog-and-category", result: "passed", visibleCards: 0, pageControls: 0 });

  assert.equal(consoleRecords.length, 0, "browser console and hydration errors absent");
} catch (error) {
  outcomes.push({ name: "homepage-acceptance", result: "failed", error: error.stack ?? String(error) });
  if (context) await captureScreenshot(context.pages()[0], path.join(outputDir, "failure.png")).catch(() => {});
  throw error;
} finally {
  if (context && traceStarted) await context.tracing.stop({ path: path.join(outputDir, "homepage-trace.zip") }).catch(() => {});
  await fs.writeFile(path.join(outputDir, "network-requests.json"), JSON.stringify(records, null, 2));
  await fs.writeFile(path.join(outputDir, "browser-console.json"), JSON.stringify(consoleRecords, null, 2));
  await fs.writeFile(path.join(outputDir, "homepage-browser-results.json"), JSON.stringify({ baseUrl, tenant, outcomes, injectedFailures, expectedInjectedConsole, expectedAuthResponses, expectedAuthConsole, expectedProjectionRejectionConsole, externalAssetStubs, unsafeMediaRequests, consoleErrors: consoleRecords.length }, null, 2));
  await browser.close();
}
console.log(JSON.stringify({ outcomes, requestCount: records.length, artifacts: outputDir }, null, 2));
