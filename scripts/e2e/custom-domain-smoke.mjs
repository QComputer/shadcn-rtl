#!/usr/bin/env node

const DEFAULT_TIMEOUT_MS = Number(process.env.CUSTOM_DOMAIN_SMOKE_TIMEOUT_MS || 20000);

const REQUIRED_ENV = [
  "CUSTOM_DOMAIN_SMOKE_BASE_URL",
  "CUSTOM_DOMAIN_SMOKE_PLATFORM_URL",
  "CUSTOM_DOMAIN_SMOKE_SHOP_SLUG",
];

const OPTIONAL_ENV = {
  CUSTOM_DOMAIN_SMOKE_EXPECTED_LOCALE: process.env.CUSTOM_DOMAIN_SMOKE_EXPECTED_LOCALE || "fa",
  CUSTOM_DOMAIN_SMOKE_PRIMARY_HOST: process.env.CUSTOM_DOMAIN_SMOKE_PRIMARY_HOST || "",
  CUSTOM_DOMAIN_SMOKE_CATEGORY_LIMIT: process.env.CUSTOM_DOMAIN_SMOKE_CATEGORY_LIMIT || "3",
  CUSTOM_DOMAIN_SMOKE_CATEGORY_SEGMENTS: process.env.CUSTOM_DOMAIN_SMOKE_CATEGORY_SEGMENTS || "",
  CUSTOM_DOMAIN_SMOKE_SKIP_AR: process.env.CUSTOM_DOMAIN_SMOKE_SKIP_AR || "false",
  CUSTOM_DOMAIN_SMOKE_SKIP_EN: process.env.CUSTOM_DOMAIN_SMOKE_SKIP_EN || "false",
};

function fail(message) {
  console.error(`✗ ${message}`);
  process.exitCode = 1;
}

function pass(message) {
  console.log(`✓ ${message}`);
}

function info(message) {
  console.log(`ℹ ${message}`);
}

function normalizeBaseUrl(value, name) {
  if (!value) return "";
  try {
    const url = new URL(value);
    url.pathname = url.pathname.replace(/\/+$/, "");
    url.search = "";
    url.hash = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    throw new Error(`${name} must be a valid absolute URL. Received: ${value}`);
  }
}

function joinUrl(base, path) {
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

function hostnameOf(value) {
  try {
    return new URL(value).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

function header(response, name) {
  return response.headers.get(name) || "";
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    return await fetch(url, {
      redirect: options.redirect || "follow",
      method: options.method || "GET",
      headers: options.headers,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

function assertOkResponse(name, response) {
  if (!response.ok) {
    throw new Error(`${name} returned ${response.status} ${response.statusText}`);
  }
}

function looksPersianFirst(html, expectedLocale) {
  if (expectedLocale !== "fa") return true;

  const normalized = html.toLowerCase();
  return (
    normalized.includes('lang="fa"') ||
    normalized.includes("lang='fa'") ||
    normalized.includes('dir="rtl"') ||
    normalized.includes("dir='rtl'") ||
    /[\u0600-\u06ff]/.test(html)
  );
}

async function testCustomDomainDefaultLocale(baseUrl, expectedLocale) {
  const response = await fetchWithTimeout(joinUrl(baseUrl, "/"));
  assertOkResponse("custom-domain root", response);

  const body = await response.text();
  if (!looksPersianFirst(body, expectedLocale)) {
    throw new Error(
      `custom-domain root did not look ${expectedLocale}-first. Expected lang=fa, dir=rtl, or Persian text.`,
    );
  }

  pass(`custom-domain root is reachable and ${expectedLocale}-first`);
}

async function testCustomDomainPathDefaultLocale(baseUrl, expectedLocale) {
  const response = await fetchWithTimeout(joinUrl(baseUrl, "/profile"));
  if (response.status === 404) {
    info("custom-domain /profile returned 404; skipping default-locale subpath assertion because the shop may not expose profile.");
    return;
  }

  assertOkResponse("custom-domain /profile", response);
  const body = await response.text();
  if (!looksPersianFirst(body, expectedLocale)) {
    throw new Error("custom-domain /profile did not preserve Persian-first default locale.");
  }

  pass("custom-domain bare subpath preserves Persian-first default locale");
}

async function testExplicitLocale(baseUrl, locale) {
  const response = await fetchWithTimeout(joinUrl(baseUrl, `/${locale}`));
  if (response.status === 404) {
    info(`custom-domain explicit /${locale} returned 404; skipping because that locale route may not be published for this shop.`);
    return;
  }

  assertOkResponse(`custom-domain explicit /${locale}`, response);
  const finalUrl = response.url || "";

  if (finalUrl.includes("/fa/") && locale !== "fa") {
    throw new Error(`explicit /${locale} unexpectedly resolved through /fa in final URL: ${finalUrl}`);
  }

  pass(`custom-domain explicit /${locale} route is reachable`);
}

async function testRobots(baseUrl) {
  const response = await fetchWithTimeout(joinUrl(baseUrl, "/robots.txt"));
  assertOkResponse("custom-domain robots.txt", response);

  const contentType = header(response, "content-type").toLowerCase();
  const body = await response.text();

  if (!contentType.includes("text/plain") && !contentType.includes("text")) {
    throw new Error(`robots.txt content-type did not look textual: ${contentType}`);
  }

  if (!/user-agent/i.test(body)) {
    throw new Error("robots.txt does not contain User-agent.");
  }

  pass("custom-domain robots.txt is reachable");
}

async function testSitemap(baseUrl) {
  const response = await fetchWithTimeout(joinUrl(baseUrl, "/sitemap.xml"));
  assertOkResponse("custom-domain sitemap.xml", response);

  const body = await response.text();
  const baseHost = hostnameOf(baseUrl);

  if (!body.includes("<urlset") && !body.includes("<sitemapindex")) {
    throw new Error("sitemap.xml does not look like an XML sitemap.");
  }

  if (baseHost && !body.toLowerCase().includes(baseHost)) {
    throw new Error(`sitemap.xml does not include the custom-domain host ${baseHost}.`);
  }

  pass("custom-domain sitemap.xml is reachable and tenant-host aware");
}

async function testPlatformShopRedirect(platformUrl, shopSlug, baseUrl, primaryHost) {
  const url = joinUrl(platformUrl, `/fa/shop/${shopSlug}`);
  const response = await fetchWithTimeout(url, { redirect: "manual" });

  if (![301, 302, 307, 308].includes(response.status)) {
    throw new Error(`platform shop URL should redirect, got ${response.status}. URL: ${url}`);
  }

  const location = header(response, "location");
  if (!location) {
    throw new Error("platform shop redirect did not include a Location header.");
  }

  const expectedHost = hostnameOf(primaryHost || baseUrl);
  const actualHost = hostnameOf(location);

  if (expectedHost && actualHost !== expectedHost) {
    throw new Error(`platform shop redirect host mismatch. Expected ${expectedHost}, got ${actualHost}. Location: ${location}`);
  }

  pass("platform shop URL redirects to the custom primary domain");
}

function parseCategorySegments(value) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

async function getCategorySegments(platformUrl, shopSlug) {
  const configured = parseCategorySegments(OPTIONAL_ENV.CUSTOM_DOMAIN_SMOKE_CATEGORY_SEGMENTS);
  if (configured.length) return configured;

  const response = await fetchWithTimeout(joinUrl(platformUrl, `/api/public/organizations/${shopSlug}/shop`));
  assertOkResponse("public shop API for category smoke", response);

  const body = await response.json();
  const categories = Array.isArray(body?.categories) ? body.categories : [];
  const limit = Math.max(1, Number(OPTIONAL_ENV.CUSTOM_DOMAIN_SMOKE_CATEGORY_LIMIT) || 3);

  return categories
    .map((category) => category?.slug || category?.id)
    .filter(Boolean)
    .slice(0, limit);
}

async function testCustomDomainCategoryRoutes(baseUrl, platformUrl, shopSlug) {
  const categorySegments = await getCategorySegments(platformUrl, shopSlug);
  if (!categorySegments.length) {
    info("public shop API returned no categories; skipping custom-domain category assertions.");
    return;
  }

  for (const categorySegment of categorySegments) {
    const customCategoryPath = `/category/${encodeURIComponent(categorySegment)}`;
    const customResponse = await fetchWithTimeout(joinUrl(baseUrl, customCategoryPath));
    assertOkResponse(`custom-domain category ${categorySegment}`, customResponse);

    const customFinalPath = new URL(customResponse.url).pathname;
    if (customFinalPath.includes(`/shop/${shopSlug}/category/`)) {
      throw new Error(`custom-domain category leaked platform path: ${customResponse.url}`);
    }

    const platformResponse = await fetchWithTimeout(joinUrl(platformUrl, `/fa/shop/${shopSlug}/category/${encodeURIComponent(categorySegment)}`), {
      redirect: "manual",
    });
    if (![200, 301, 302, 307, 308].includes(platformResponse.status)) {
      throw new Error(`platform category ${categorySegment} returned ${platformResponse.status}`);
    }
  }

  pass("custom-domain category routes are reachable and canonical");
}

async function testDashboardApiProtected(platformUrl) {
  const response = await fetchWithTimeout(joinUrl(platformUrl, "/api/dashboard/shop-domains"), {
    redirect: "manual",
  });

  if ([200, 201, 204].includes(response.status)) {
    throw new Error("unauthenticated /api/dashboard/shop-domains returned a success status.");
  }

  if (![401, 403, 307, 308].includes(response.status)) {
    info(`unauthenticated shop-domain API returned ${response.status}; treating as protected as long as it is not success.`);
  }

  pass("SUPER_ADMIN shop-domain API is not publicly accessible");
}

async function main() {
  const missing = REQUIRED_ENV.filter((name) => !process.env[name]);
  if (missing.length) {
    console.error("Missing required env vars:");
    for (const name of missing) console.error(`- ${name}`);
    console.error("\nExample:");
    console.error("$env:CUSTOM_DOMAIN_SMOKE_BASE_URL='https://www.khalae.ir'");
    console.error("$env:CUSTOM_DOMAIN_SMOKE_PLATFORM_URL='https://www.bazar-baz.ir'");
    console.error("$env:CUSTOM_DOMAIN_SMOKE_SHOP_SLUG='ahmad'");
    process.exit(1);
  }

  const baseUrl = normalizeBaseUrl(process.env.CUSTOM_DOMAIN_SMOKE_BASE_URL, "CUSTOM_DOMAIN_SMOKE_BASE_URL");
  const platformUrl = normalizeBaseUrl(process.env.CUSTOM_DOMAIN_SMOKE_PLATFORM_URL, "CUSTOM_DOMAIN_SMOKE_PLATFORM_URL");
  const shopSlug = process.env.CUSTOM_DOMAIN_SMOKE_SHOP_SLUG;
  const expectedLocale = OPTIONAL_ENV.CUSTOM_DOMAIN_SMOKE_EXPECTED_LOCALE;
  const primaryHost = OPTIONAL_ENV.CUSTOM_DOMAIN_SMOKE_PRIMARY_HOST;

  console.log("Custom-domain smoke test");
  console.log(`Base URL: ${baseUrl}`);
  console.log(`Platform URL: ${platformUrl}`);
  console.log(`Shop slug: ${shopSlug}`);
  console.log(`Expected default locale: ${expectedLocale}`);
  console.log("");

  const tests = [
    () => testCustomDomainDefaultLocale(baseUrl, expectedLocale),
    () => testCustomDomainPathDefaultLocale(baseUrl, expectedLocale),
    () => testRobots(baseUrl),
    () => testSitemap(baseUrl),
    () => testCustomDomainCategoryRoutes(baseUrl, platformUrl, shopSlug),
    () => testPlatformShopRedirect(platformUrl, shopSlug, baseUrl, primaryHost),
    () => testDashboardApiProtected(platformUrl),
  ];

  if (OPTIONAL_ENV.CUSTOM_DOMAIN_SMOKE_SKIP_EN.toLowerCase() !== "true") {
    tests.splice(2, 0, () => testExplicitLocale(baseUrl, "en"));
  }

  if (OPTIONAL_ENV.CUSTOM_DOMAIN_SMOKE_SKIP_AR.toLowerCase() !== "true") {
    tests.splice(3, 0, () => testExplicitLocale(baseUrl, "ar"));
  }

  for (const runTest of tests) {
    try {
      await runTest();
    } catch (error) {
      fail(error instanceof Error ? error.message : String(error));
    }
  }

  if (process.exitCode) {
    console.error("\nCustom-domain smoke test failed.");
    process.exit(process.exitCode);
  }

  console.log("\nCustom-domain smoke test passed.");
}

main().catch((error) => {
  fail(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
