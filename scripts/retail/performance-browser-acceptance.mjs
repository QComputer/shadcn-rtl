import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";

const baseUrl = process.env.RETAIL_PERF_BASE_URL ?? "http://127.0.0.1:3000";
const tenant = process.env.RETAIL_PERF_TENANT ?? "retail-r3-fashion-preview";
const artifactDir = path.resolve(process.env.RETAIL_PERF_ARTIFACT_DIR ?? "artifacts/retail-performance");
const playwrightEntry = process.env.RETAIL_PERF_PLAYWRIGHT_ENTRY;
const sourceLabel = process.env.RETAIL_PERF_SOURCE_LABEL ?? "unknown";
const sourceSha = process.env.RETAIL_PERF_SOURCE_SHA ?? "unknown";
if (!playwrightEntry) throw new Error("RETAIL_PERF_PLAYWRIGHT_ENTRY is required");
await fs.mkdir(artifactDir, { recursive: true });
const { chromium } = await import(pathToFileURL(playwrightEntry).href);
const browser = await chromium.launch({ headless: true });
const results = { sourceLabel, sourceSha, tenant, baseUrl, themeRuns: [], performanceRuns: [], console: [], requests: [] };
const themeCases = [
  { theme: "light", scheme: "dark", expected: "light" },
  { theme: "dark", scheme: "light", expected: "dark" },
  { theme: "warm-cream", scheme: "dark", expected: "light" },
  { theme: "charcoal-gray", scheme: "light", expected: "dark" },
  { theme: "system", scheme: "dark", expected: "dark" },
  { theme: "system", scheme: "light", expected: "light" },
];

try {
  // Record first-paint theme and Web Vitals before application scripts execute.
  const run = async (args) => {
    // Per context, install the vitals observers before navigation and seed theme storage.
    const context = await browser.newContext({ viewport: { width: 1365, height: 900 }, colorScheme: args.scheme, serviceWorkers: "block" });
    await context.addInitScript((theme) => {
      localStorage.setItem("shadcn-rtl-theme", theme);
      window.__bbLcp = []; window.__bbCls = []; window.__bbFirstPaint = { samples: [], fcp: null };
      const root = document.documentElement;
      const sample = (phase) => window.__bbFirstPaint.samples.push({ phase, at: performance.now(), className: root.className, dataTheme: root.getAttribute("data-theme") });
      new MutationObserver(() => sample("mutation")).observe(root, { attributes: true, attributeFilter: ["class", "data-theme"] });
      try { new PerformanceObserver((list) => { for (const entry of list.getEntries()) { if (entry.name === "first-contentful-paint" && !window.__bbFirstPaint.fcp) window.__bbFirstPaint.fcp = { at: entry.startTime, className: root.className, dataTheme: root.getAttribute("data-theme") }; } }).observe({ type: "paint", buffered: true }); } catch {}
      try { new PerformanceObserver((list) => window.__bbLcp.push(...list.getEntries())).observe({ type: "largest-contentful-paint", buffered: true }); } catch {}
      try { new PerformanceObserver((list) => window.__bbCls.push(...list.getEntries())).observe({ type: "layout-shift", buffered: true }); } catch {}
      const frames = () => { if (!window.__bbFirstPaint.fcp && window.__bbFirstPaint.samples.length < 40) { sample("frame"); requestAnimationFrame(frames); } };
      requestAnimationFrame(frames);
    }, args.theme);
    await context.route("https://trustseal.enamad.ir/logo.aspx**", (route) => route.fulfill({ status: 200, contentType: "image/png", body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jWZcAAAAASUVORK5CYII=", "base64") }));
    const page = await context.newPage(); const reqs = []; const errors = [];
    page.on("console", (message) => { if (message.type() === "error" || /hydration|did not match/i.test(message.text())) errors.push({ type: message.type(), text: message.text(), url: message.location().url }); });
    page.on("pageerror", (error) => errors.push({ type: "pageerror", text: error.message }));
    page.on("request", (request) => {
      const url = new URL(request.url()); const type = request.resourceType();
      const kind = type === "document" ? "document" : request.headers()["rsc"] ? "rsc" : /\/api\/public\/v1\/organizations\/[^/]+\/products(?:\?|$)/.test(url.pathname) ? "catalog-api" : type === "image" ? "image-media" : type === "script" || /\.js(?:\?|$)/.test(url.pathname) ? "javascript" : null;
      if (!kind) return;
      const item = { scenario: args.label, tenant, kind, phase: "request", url: request.url(), method: request.method(), page: Number(url.searchParams.get("page") ?? 1), limit: Number(url.searchParams.get("limit") ?? 20), at: new Date().toISOString() };
      reqs.push(item); request.__perfRecord = item;
    });
    page.on("response", (response) => { if (response.request().__perfRecord) reqs.push({ ...response.request().__perfRecord, phase: "response", status: response.status() }); });
    const response = await page.goto(`${baseUrl}/fa/retail/${encodeURIComponent(tenant)}`, { waitUntil: "domcontentloaded" });
    assert.equal(response?.status(), 200, `${args.label} storefront document responds`);
    const html = await response.text();
    await page.waitForLoadState("load");
    await page.locator("#products [data-retail-product-card]").first().waitFor();
    await page.waitForFunction(() => { const category = document.querySelector("#categories button"); return category && Object.keys(category).some((key) => key.startsWith("__reactProps$")); });
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const metrics = await page.evaluate(() => {
      const navigation = performance.getEntriesByType("navigation")[0]; const resources = performance.getEntriesByType("resource");
      const cards = [...document.querySelectorAll("#products [data-retail-product-card]")];
      return {
        cardCount: cards.length, cardMarkupBytes: new TextEncoder().encode(cards.map((card) => card.outerHTML).join("")).length,
        inlineFlightBytes: [...document.scripts].filter((script) => script.textContent?.includes("self.__next_f.push")).reduce((sum, script) => sum + new TextEncoder().encode(script.textContent ?? "").length, 0),
        documentTransferBytes: navigation?.transferSize ?? null, documentEncodedBytes: navigation?.encodedBodySize ?? null,
        javascriptTransferBytes: resources.filter((entry) => entry.name.includes(".js")).reduce((sum, entry) => sum + (entry.transferSize || entry.encodedBodySize || 0), 0),
        javascriptResourceCount: resources.filter((entry) => entry.name.includes(".js")).length,
        firstPaint: performance.getEntriesByName("first-paint")[0]?.startTime ?? null, firstContentfulPaint: performance.getEntriesByName("first-contentful-paint")[0]?.startTime ?? null,
        lcp: window.__bbLcp.at(-1)?.startTime ?? null, cls: window.__bbCls.reduce((sum, entry) => sum + (entry.hadRecentInput ? 0 : entry.value), 0),
        currentTheme: document.documentElement.getAttribute("data-theme"), resolvedClass: document.documentElement.classList.contains("dark") ? "dark" : "light", paintRecord: window.__bbFirstPaint,
      };
    });
    const apiRequests = reqs.filter((item) => item.kind === "catalog-api" && item.phase === "request");
    const themePass = metrics.currentTheme === args.theme && metrics.resolvedClass === args.expected
      && metrics.paintRecord?.fcp?.dataTheme === args.theme
      && metrics.paintRecord?.fcp?.className?.split(/\s+/).includes(args.expected) === true;
    const ssrCardCount = (html.match(/data-retail-product-card/g) ?? []).length;
    const output = { label: args.label, iteration: args.iteration ?? null, theme: args.theme, scheme: args.scheme, expected: args.expected, status: response.status(), ssrCardCount, products: metrics.cardCount, hydrationProductDelta: metrics.cardCount - ssrCardCount, initialCatalogApiRequestCount: apiRequests.length, apiRequests, documentBytes: Buffer.byteLength(html), metrics, errors, themePass };
    if (args.testTheme) {
      if (sourceLabel === "pr77") assert.equal(themePass, true, `${args.label}: first paint already uses the selected theme and its resolved color scheme`);
      await page.screenshot({ path: path.join(artifactDir, `theme-${args.theme}-scheme-${args.scheme}.png`), fullPage: true });
      results.themeRuns.push(output);
    } else {
      if (sourceLabel === "pr77") {
        assert.equal(output.initialCatalogApiRequestCount, 0, `${args.label}: hydration reuses the SSR product page without an initial list request`);
        assert.equal(output.ssrCardCount, 20, `${args.label}: server rendered the agreed 20-product page size`);
      }
      results.performanceRuns.push(output);
    }
    results.console.push(...errors.map((item) => ({ scenario: args.label, ...item })));
    results.requests.push(...reqs);
    await context.close();
    return output;
  };

  // Six cold contexts cover all persisted modes and both system preferences.
  for (const item of themeCases) await run({ ...item, label: `theme-${item.theme}-${item.scheme}`, testTheme: true });
  // Three same-condition dark cold loads provide a small repeat sample for main-vs-PR metrics.
  for (let iteration = 1; iteration <= 3; iteration += 1) await run({ theme: "dark", scheme: "dark", expected: "dark", label: `perf-dark-${iteration}`, iteration });

  const summary = {
    sourceLabel, sourceSha, tenant,
    themeAssertions: results.themeRuns.length,
    themePaints: results.themeRuns.map(({ label, themePass, metrics }) => ({ label, themePass, theme: metrics.currentTheme, firstPaint: metrics.firstPaint, fcp: metrics.firstContentfulPaint, fcpClass: metrics.paintRecord?.fcp?.className, fcpDataTheme: metrics.paintRecord?.fcp?.dataTheme, observedFrames: metrics.paintRecord?.samples?.slice(0, 6) })),
    performance: results.performanceRuns.map(({ label, documentBytes, ssrCardCount, products, hydrationProductDelta, initialCatalogApiRequestCount, metrics }) => ({ label, documentBytes, ssrCardCount, hydratedCardCount: products, hydrationProductDelta, initialCatalogApiRequestCount, cardMarkupBytes: metrics.cardMarkupBytes, inlineFlightBytes: metrics.inlineFlightBytes, javascriptTransferBytes: metrics.javascriptTransferBytes, javascriptResourceCount: metrics.javascriptResourceCount, firstPaint: metrics.firstPaint, firstContentfulPaint: metrics.firstContentfulPaint, lcp: metrics.lcp, cls: metrics.cls, documentTransferBytes: metrics.documentTransferBytes, documentEncodedBytes: metrics.documentEncodedBytes })),
    initialRequests: results.performanceRuns.map(({ label, apiRequests }) => ({ label, catalogApi: apiRequests, document: results.requests.filter((item) => item.scenario === label && item.kind === "document" && item.phase === "request").length, rsc: results.requests.filter((item) => item.scenario === label && item.kind === "rsc" && item.phase === "request").length, images: results.requests.filter((item) => item.scenario === label && item.kind === "image-media" && item.phase === "request").length })),
    consoleErrors: results.console,
  };
  await fs.writeFile(path.join(artifactDir, "performance-browser-results.json"), JSON.stringify({ ...results, summary }, null, 2));
  await fs.writeFile(path.join(artifactDir, "performance-summary.json"), JSON.stringify(summary, null, 2));
  await fs.writeFile(path.join(artifactDir, "network-requests.json"), JSON.stringify(results.requests, null, 2));
  await fs.writeFile(path.join(artifactDir, "browser-console.json"), JSON.stringify(results.console, null, 2));
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
} finally {
  await browser.close();
}
