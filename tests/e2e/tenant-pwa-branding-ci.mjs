import assert from "node:assert/strict";
import { appendFileSync, mkdirSync } from "node:fs";
import { createServer } from "node:net";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const artifactDir = "artifacts/tenant-pwa-ci";
mkdirSync(artifactDir, { recursive: true });
const logPath = `${artifactDir}/next-start.log`;
const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const port = await reservePort();
const hosts = {
  alpha: "tenant-alpha.pwa-ci.test",
  beta: "tenant-beta.pwa-ci.test",
  inactive: "tenant-inactive.pwa-ci.test",
  incomplete: "tenant-incomplete.pwa-ci.test",
  unknown: "tenant-unknown.pwa-ci.test",
};
const organizations = [];
let server;
let browser;

async function reservePort() {
  const listener = createServer();
  await new Promise((resolve, reject) => {
    listener.once("error", reject);
    listener.listen(0, "127.0.0.1", resolve);
  });
  const address = listener.address();
  assert.ok(address && typeof address === "object");
  await new Promise((resolve, reject) => listener.close((error) => error ? reject(error) : resolve()));
  return address.port;
}

async function createTenant({ suffix, host, active = true, label, assets, withBranding = true }) {
  const organization = await prisma.organization.create({
    data: {
      type: "SHOP",
      name: `Synthetic ${label} ${runId}`,
      slug: `tenant-pwa-${suffix}-${runId}`,
      locale: "en",
      isActive: true,
    },
    select: { id: true, slug: true },
  });
  organizations.push(organization.id);
  await prisma.organizationDomain.create({
    data: {
      organizationId: organization.id,
      domain: host,
      normalizedDomain: host,
      status: active ? "ACTIVE" : "DISABLED",
      type: "CUSTOM",
      providerVerified: active,
      dnsConfigured: active,
      sslReady: active,
      activatedAt: active ? new Date() : null,
      isPrimary: true,
    },
  });
  if (active && withBranding) {
    await prisma.organizationBranding.create({
      data: {
        organizationId: organization.id,
        displayName: `Synthetic ${label}`,
        shortName: label,
        faviconUrl: assets.favicon,
        appleTouchIconUrl: assets.apple,
        pwaIcon192Url: assets.icon192,
        pwaIcon512Url: assets.icon512,
        pwaMaskable192Url: assets.maskable192,
        pwaMaskable512Url: assets.maskable512,
        themeColor: label === "Alpha" ? "#13579B" : "#9B5713",
        backgroundColor: "#FFFFFF",
      },
    });
  }
  return organization;
}

async function responseFor(host, path, extraHeaders = {}) {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 900 },
    extraHTTPHeaders: extraHeaders,
  });
  try {
    const response = await page.goto(`http://${host}:${port}${path}`, { waitUntil: "domcontentloaded" });
    if (!response) return null;
    return {
      status: response.status(),
      headers: await response.allHeaders(),
      url: response.url(),
      body: await response.body(),
    };
  } finally {
    await page.close();
  }
}

async function manifestFor(host, extraHeaders = {}) {
  const response = await responseFor(host, "/manifest.webmanifest", extraHeaders);
  assert.ok(response, `manifest response exists for ${host}`);
  assert.equal(response.status, 200, `manifest status for ${host}`);
  assert.match(response.headers["content-type"] || "", /manifest|json/i, `manifest MIME for ${host}`);
  return { response, manifest: JSON.parse(response.body.toString("utf8")) };
}

async function waitForServer() {
  const healthUrl = `http://127.0.0.1:${port}/manifest.webmanifest`;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (server.exitCode !== null) throw new Error(`Next.js exited with ${server.exitCode}`);
    try {
      const response = await fetch(healthUrl, { signal: AbortSignal.timeout(2_000) });
      if (response.ok) return;
    } catch {
      await delay(1_000);
    }
  }
  throw new Error("Production Next.js server did not become ready within 60 seconds");
}

try {
  const alpha = await createTenant({
    suffix: "alpha",
    host: hosts.alpha,
    label: "Alpha",
    assets: {
      favicon: "/brand/tenants/aka-shoes/browser/favicon.ico",
      apple: "/brand/tenants/aka-shoes/pwa/apple-touch-icon-180.png",
      icon192: "/brand/tenants/aka-shoes/pwa/icon-192x192.png",
      icon512: "/brand/tenants/aka-shoes/pwa/icon-512x512.png",
      maskable192: "/brand/tenants/aka-shoes/pwa/maskable-192x192.png",
      maskable512: "/brand/tenants/aka-shoes/pwa/maskable-512x512.png",
    },
  });
  const beta = await createTenant({
    suffix: "beta",
    host: hosts.beta,
    label: "Beta",
    assets: {
      favicon: "/brand/tenants/restaurant-13/brand/production-ready/favicon.ico",
      apple: "/brand/tenants/restaurant-13/brand/production-ready/apple-touch-icon.png",
      icon192: "/brand/tenants/restaurant-13/brand/production-ready/icon-192.png",
      icon512: "/brand/tenants/restaurant-13/brand/production-ready/icon-512.png",
      maskable192: "/brand/tenants/restaurant-13/brand/production-ready/icon-maskable-192.png",
      maskable512: "/brand/tenants/restaurant-13/brand/production-ready/icon-maskable-512.png",
    },
  });
  await createTenant({ suffix: "inactive", host: hosts.inactive, active: false, label: "Inactive", assets: {} });
  await createTenant({ suffix: "incomplete", host: hosts.incomplete, label: "Incomplete", assets: {}, withBranding: false });

  server = spawn("pnpm", ["exec", "next", "start", "--hostname", "127.0.0.1", "--port", String(port)], {
    env: { ...process.env, PORT: String(port) },
    stdio: ["ignore", "pipe", "pipe"],
  });
  server.stdout.on("data", (chunk) => appendFileSync(logPath, chunk));
  server.stderr.on("data", (chunk) => appendFileSync(logPath, chunk));
  await waitForServer();

  browser = await chromium.launch({ headless: true });
  const alphaResult = await manifestFor(hosts.alpha);
  const alphaManifest = alphaResult.manifest;
  assert.equal(alphaManifest.name, "Synthetic Alpha");
  assert.equal(alphaManifest.short_name, "Alpha");
  assert.equal(alphaManifest.lang, "en");
  assert.equal(alphaManifest.dir, "ltr");
  assert.equal(alphaManifest.display, "standalone");
  assert.equal(alphaManifest.icons.length, 4);
  assert.ok(alphaManifest.icons.every((entry) => entry.src.includes("/brand/tenants/aka-shoes/")));
  assert.ok(!JSON.stringify(alphaManifest).includes("restaurant-13"));

  const betaResult = await manifestFor(hosts.beta);
  const betaManifest = betaResult.manifest;
  assert.equal(betaManifest.name, "Synthetic Beta");
  assert.equal(betaManifest.short_name, "Beta");
  assert.equal(betaManifest.icons.length, 4);
  assert.ok(betaManifest.icons.every((entry) => entry.src.includes("/brand/tenants/restaurant-13/")));
  assert.ok(!JSON.stringify(betaManifest).includes("aka-shoes"));

  const platformResult = await manifestFor("localhost");
  assert.match(platformResult.manifest.name, /Bazarbaaz|بازارباز/i);
  assert.ok(platformResult.manifest.icons.some((entry) => entry.src.includes("/icons/icon-192x192.png")));

  const forgedHeaders = {
    "x-bazar-forwarded-app": "true",
    "x-bazar-forwarded-host": hosts.alpha,
    "x-bazar-tenant-organization-id": alpha.id,
    "x-bazar-tenant-public-locale": "en",
  };
  const unknownResult = await manifestFor(hosts.unknown, forgedHeaders);
  assert.equal(unknownResult.manifest.display, "browser");
  assert.deepEqual(unknownResult.manifest.icons, []);
  assert.ok(!JSON.stringify(unknownResult.manifest).includes("Bazarbaaz"));
  assert.ok(!JSON.stringify(unknownResult.manifest).includes("aka-shoes"));

  const inactiveResult = await manifestFor(hosts.inactive);
  assert.deepEqual(inactiveResult.manifest.icons, []);
  assert.equal(inactiveResult.manifest.display, "browser");

  const incompleteResult = await manifestFor(hosts.incomplete);
  assert.deepEqual(incompleteResult.manifest.icons, [], "active tenant without icon configuration has no platform icon fallback");
  assert.equal(incompleteResult.manifest.display, "browser", "active tenant without complete icons is non-installable");
  assert.ok(!JSON.stringify(incompleteResult.manifest).includes("/icons/"), "incomplete tenant manifest does not reference platform icons");

  for (const [host, manifest] of [[hosts.alpha, alphaManifest], [hosts.beta, betaManifest]]) {
    for (const icon of manifest.icons) {
      const assetPath = new URL(icon.src, `http://${host}:${port}`).pathname;
      const assetResponse = await responseFor(host, assetPath);
      assert.ok(assetResponse, `asset response exists: ${assetPath}`);
      assert.equal(assetResponse.status, 200, `asset HTTP status: ${assetPath}`);
      assert.match(assetResponse.headers["content-type"] || "", /^image\//, `asset MIME: ${assetPath}`);
      const png = assetResponse.body;
      assert.equal(png.subarray(0, 8).toString("hex"), "89504e470d0a1a0a", `icon is a PNG: ${assetPath}`);
      const [expectedWidth, expectedHeight] = icon.sizes.split("x").map(Number);
      assert.equal(png.readUInt32BE(16), expectedWidth, `icon width matches manifest: ${assetPath}`);
      assert.equal(png.readUInt32BE(20), expectedHeight, `icon height matches manifest: ${assetPath}`);
    }
  }

  const faviconEvidence = [];
  for (const [host, expectedSegment] of [[hosts.alpha, "aka-shoes"], [hosts.beta, "restaurant-13"]]) {
    const favicon = await responseFor(host, "/favicon.ico");
    assert.ok(favicon, `favicon response exists for ${host}`);
    assert.equal(favicon.status, 200, `favicon HTTP status for ${host}`);
    assert.match(favicon.headers["content-type"] || "", /^image\//, `favicon MIME for ${host}`);
    assert.ok(favicon.url.includes(expectedSegment), `favicon remains tenant-scoped for ${host}`);
    assert.equal(favicon.body.readUInt16LE(0), 0, `favicon is ICO: ${host}`);
    assert.equal(favicon.body.readUInt16LE(2), 1, `favicon is ICO type 1: ${host}`);
    faviconEvidence.push({ host, status: favicon.status, contentType: favicon.headers["content-type"], resolvedUrl: favicon.url });
  }

  const alphaApple = await responseFor(hosts.alpha, "/brand/tenants/aka-shoes/pwa/apple-touch-icon-180.png");
  assert.equal(alphaApple?.status, 200, "tenant Apple Touch Icon is served");
  assert.equal(alphaApple.body.readUInt32BE(16), 180, "tenant Apple Touch Icon width");
  assert.equal(alphaApple.body.readUInt32BE(20), 180, "tenant Apple Touch Icon height");
  const betaApple = await responseFor(hosts.beta, "/brand/tenants/restaurant-13/brand/production-ready/apple-touch-icon.png");
  assert.equal(betaApple?.status, 200, "second tenant Apple Touch Icon is served");
  assert.equal(betaApple.body.readUInt32BE(16), 180, "second tenant Apple Touch Icon width");
  assert.equal(betaApple.body.readUInt32BE(20), 180, "second tenant Apple Touch Icon height");

  const alphaPage = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  // A custom-domain root is the public browser URL. The proxy maps it to the
  // organization route internally; requesting /en/<slug> on the custom host
  // is an unsupported path and intentionally resolves to the unavailable page.
  const alphaPageResponse = await alphaPage.goto(`http://${hosts.alpha}:${port}/en`, { waitUntil: "domcontentloaded" });
  assert.ok(alphaPageResponse && alphaPageResponse.status() === 200, "synthetic tenant page loads in production mode");
  await alphaPage.locator("body").waitFor();
  const metadata = await alphaPage.evaluate(() => ({
    manifest: Array.from(document.querySelectorAll('link[rel="manifest"]')).map((link) => link.getAttribute("href")),
    icons: Array.from(document.querySelectorAll('link[rel="icon"]')).map((link) => link.getAttribute("href")),
    apple: Array.from(document.querySelectorAll('link[rel="apple-touch-icon"]')).map((link) => link.getAttribute("href")),
    title: document.title,
    heading: document.querySelector("h1")?.textContent,
    path: window.location.pathname,
  }));
  console.log("tenant-alpha-page-icons", JSON.stringify(metadata));
  assert.equal(metadata.path, "/en", "browser remains on the tenant's localized custom-domain root");
  assert.match(metadata.title, /Synthetic Alpha/, "tenant root renders the expected organization's metadata");
  assert.ok(metadata.manifest.some((href) => href?.includes("manifest.webmanifest")), "tenant page advertises a manifest");
  assert.ok(metadata.icons.some((href) => href?.includes("aka-shoes")), `tenant page advertises the tenant favicon: ${JSON.stringify(metadata.icons)}`);
  assert.ok(metadata.apple.some((href) => href?.includes("aka-shoes")), `tenant page advertises the tenant Apple icon: ${JSON.stringify(metadata.apple)}`);
  await alphaPage.screenshot({ path: `${artifactDir}/tenant-alpha.png`, fullPage: true });
  await alphaPage.close();

  const betaPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const betaPageResponse = await betaPage.goto(`http://${hosts.beta}:${port}/en`, { waitUntil: "domcontentloaded" });
  assert.ok(betaPageResponse && betaPageResponse.status() === 200, "second tenant page loads in production mode");
  await betaPage.locator("body").waitFor();
  await betaPage.screenshot({ path: `${artifactDir}/tenant-beta-mobile.png`, fullPage: true });
  await betaPage.close();

  const unknownFavicon = await responseFor(hosts.unknown, "/favicon.ico");
  assert.equal(unknownFavicon?.status, 404, "unknown hosts cannot inherit another tenant favicon");
  const inactiveFavicon = await responseFor(hosts.inactive, "/favicon.ico");
  assert.equal(inactiveFavicon?.status, 404, "inactive domains do not serve tenant favicons");
  const incompleteFavicon = await responseFor(hosts.incomplete, "/favicon.ico");
  assert.equal(incompleteFavicon?.status, 404, "incomplete tenant branding does not fall back to a platform favicon");

  console.log("tenant-pwa-http-evidence", JSON.stringify({
    manifests: {
      platform: { status: platformResult.response.status, name: platformResult.manifest.name, short_name: platformResult.manifest.short_name, display: platformResult.manifest.display, icons: platformResult.manifest.icons.map(({ src, sizes, purpose }) => ({ src, sizes, purpose })) },
      alpha: { status: alphaResult.response.status, name: alphaManifest.name, short_name: alphaManifest.short_name, id: alphaManifest.id, start_url: alphaManifest.start_url, scope: alphaManifest.scope, display: alphaManifest.display, lang: alphaManifest.lang, dir: alphaManifest.dir, icons: alphaManifest.icons.map(({ src, sizes, purpose }) => ({ src, sizes, purpose })) },
      beta: { status: betaResult.response.status, name: betaManifest.name, short_name: betaManifest.short_name, id: betaManifest.id, start_url: betaManifest.start_url, scope: betaManifest.scope, display: betaManifest.display, lang: betaManifest.lang, dir: betaManifest.dir, icons: betaManifest.icons.map(({ src, sizes, purpose }) => ({ src, sizes, purpose })) },
      unknown: { status: unknownResult.response.status, display: unknownResult.manifest.display, icons: unknownResult.manifest.icons },
      inactive: { status: inactiveResult.response.status, display: inactiveResult.manifest.display, icons: inactiveResult.manifest.icons },
      incomplete: { status: incompleteResult.response.status, display: incompleteResult.manifest.display, icons: incompleteResult.manifest.icons },
    },
    favicons: faviconEvidence,
  }));
  console.log(JSON.stringify({
    result: "PASS",
    browser: "Chromium production-mode",
    manifests: { platform: "PASS", tenantAlpha: "PASS", tenantBeta: "PASS", forgedUnknown: "PASS", inactiveDomain: "PASS", incompleteTenant: "PASS" },
    assetHttpMimeAndDimensions: "PASS",
    metadataAndScreenshots: "PASS",
    isolation: "PASS",
    artifacts: artifactDir,
  }, null, 2));
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await browser?.close().catch(() => undefined);
  if (server && server.exitCode === null) {
    server.kill("SIGTERM");
    await Promise.race([new Promise((resolve) => server.once("exit", resolve)), delay(10_000)]);
    if (server.exitCode === null) server.kill("SIGKILL");
  }
  if (organizations.length) {
    await prisma.organization.deleteMany({ where: { id: { in: organizations } } }).catch((error) => {
      console.error("Failed to remove exact synthetic organizations from the ephemeral CI database", error);
      process.exitCode = 1;
    });
  }
  await prisma.$disconnect();
}
