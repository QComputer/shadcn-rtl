import assert from "node:assert/strict";
import { appendFileSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";
import { genericAssetDirectory, genericAssetRoot } from "../../scripts/e2e/prepare-tenant-pwa-fixtures.mjs";

const prisma = new PrismaClient();
const artifactDir = "artifacts/tenant-pwa-ci";
mkdirSync(artifactDir, { recursive: true });
const logPath = `${artifactDir}/next-start.log`;
const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const port = await reservePort();
const hosts = {
  alpha: "tenant-alpha.pwa-ci.test",
  beta: "tenant-beta.pwa-ci.test",
  gamma: "tenant-gamma.pwa-ci.test",
  inactive: "tenant-inactive.pwa-ci.test",
  unverified: "tenant-unverified.pwa-ci.test",
  incomplete: "tenant-incomplete.pwa-ci.test",
  unknown: "tenant-unknown.pwa-ci.test",
};
const organizations = [];
let server;
let browser;

function assertExplicitCiDatabaseTarget() {
  const expectedDatabase = "bazarbaaz_tenant_pwa_ci";
  const expectedUser = "tenant_pwa_ci";
  for (const key of ["DATABASE_URL", "DIRECT_URL"]) {
    const raw = process.env[key];
    assert.ok(raw, `${key} must be explicitly configured for the disposable PWA CI database`);
    const target = new URL(raw);
    assert.equal(target.protocol, "postgresql:", `${key} must use PostgreSQL`);
    assert.equal(target.hostname, "127.0.0.1", `${key} must target the CI loopback service`);
    assert.equal(target.port, "5432", `${key} must target the isolated CI port`);
    assert.equal(decodeURIComponent(target.username), expectedUser, `${key} must use the synthetic CI role`);
    assert.equal(target.pathname.slice(1), expectedDatabase, `${key} must target the exact disposable database`);
  }
}

async function verifyCiDatabaseIdentity() {
  const [identity] = await prisma.$queryRaw`SELECT current_database() AS database, current_user AS "user", current_setting('server_version_num')::int AS version_num`;
  assert.equal(identity.database, "bazarbaaz_tenant_pwa_ci");
  assert.equal(identity.user, "tenant_pwa_ci");
  assert.ok(identity.version_num >= 170000 && identity.version_num < 180000, "PostgreSQL 17 is required");
}

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

async function createTenant({ suffix, host, active = true, verified = true, label, shortName = label, assets, withBranding = true, retailTheme = null, logoUrl = null }) {
  const organization = await prisma.organization.create({
    data: {
      type: "SHOP",
      name: `Synthetic ${label} ${runId}`,
      slug: `tenant-pwa-${suffix}-${runId}`,
      locale: "fa",
      isActive: true,
    },
    select: { id: true, slug: true },
  });
  organizations.push(organization.id);
  if (retailTheme) {
    await prisma.organizationCapability.create({ data: { organizationId: organization.id, key: "SHOP", status: "ACTIVE", enabledAt: new Date() } });
  }
  await prisma.organizationDomain.create({
    data: {
      organizationId: organization.id,
      domain: host,
      normalizedDomain: host,
      status: active ? (verified ? "ACTIVE" : "VERIFYING") : "DISABLED",
      type: "CUSTOM",
      providerVerified: active && verified,
      dnsConfigured: active && verified,
      sslReady: active && verified,
      activatedAt: active && verified ? new Date() : null,
      isPrimary: true,
    },
  });
  if (active && withBranding) {
    await prisma.organizationBranding.create({
      data: {
        organizationId: organization.id,
        displayName: label,
        shortName,
        logoUrl,
        faviconUrl: assets.favicon,
        appleTouchIconUrl: assets.apple,
        pwaIcon192Url: assets.icon192,
        pwaIcon512Url: assets.icon512,
        pwaMaskable192Url: assets.maskable192,
        pwaMaskable512Url: assets.maskable512,
        themeColor: suffix === "alpha" ? "#13579B" : "#9B5713",
        backgroundColor: "#FFFFFF",
        ...(retailTheme ? { retailPresentationTheme: retailTheme, retailPreviewOnly: false } : {}),
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

async function installInvitationFor({ host, locale = "fa", path = null, title, iconPath, screenshot, viewport, theme = "light" }) {
  const page = await browser.newPage({ viewport });
  try {
    await page.addInitScript((value) => localStorage.setItem("shadcn-rtl-theme", value), theme);
    const response = await page.goto(`http://${host}:${port}${path || `/${locale}`}`, { waitUntil: "domcontentloaded" });
    assert.equal(response?.status(), 200, `install page loads for ${host}`);
    await page.waitForFunction((value) =>
      document.documentElement.classList.contains(value) && document.documentElement.dataset.theme === value,
    theme);
    const invitation = page.getByTestId("pwa-install-invitation");
    for (let attempt = 0; attempt < 12 && !(await invitation.isVisible().catch(() => false)); attempt += 1) {
      await page.evaluate(() => {
        const event = new Event("beforeinstallprompt", { cancelable: true });
        Object.assign(event, { prompt: async () => {}, userChoice: Promise.resolve({ outcome: "dismissed", platform: "web" }) });
        window.dispatchEvent(event);
      });
      await delay(500);
    }
    await invitation.waitFor({ state: "visible", timeout: 5_000 });
    assert.equal(await page.getByTestId("pwa-install-title").textContent(), title);
    assert.equal(await invitation.getAttribute("dir"), locale === "en" ? "ltr" : "rtl");
    const icon = page.getByTestId("pwa-install-brand-icon");
    const iconState = await icon.evaluate((element) => ({
      src: element.getAttribute("src"),
      alt: element.getAttribute("alt"),
      complete: element.complete,
      naturalWidth: element.naturalWidth,
      naturalHeight: element.naturalHeight,
    }));
    assert.ok(iconState.src?.includes(iconPath), `correct brand icon URL for ${host}: ${iconState.src}`);
    assert.equal(iconState.complete, true);
    assert.ok(iconState.naturalWidth >= 192 && iconState.naturalWidth === iconState.naturalHeight);
    assert.ok(iconState.alt?.length);
    const invitationColors = await invitation.evaluate((element) => ({
      background: getComputedStyle(element).backgroundColor,
      foreground: getComputedStyle(element.querySelector('[data-testid="pwa-install-title"]')).color,
    }));
    assert.notEqual(invitationColors.background, invitationColors.foreground);
    await page.screenshot({ path: `${artifactDir}/${screenshot}`, fullPage: false });
    if (host === "localhost") {
      await page.evaluate(() => window.dispatchEvent(new Event("appinstalled")));
    } else {
      const closeLabel = locale === "en" ? "Close" : locale === "ar" ? "إغلاق" : "بستن";
      await invitation.getByRole("button", { name: closeLabel }).click();
    }
    await invitation.waitFor({ state: "detached" });
    return { host, locale, title, icon: iconState, resolvedTheme: theme, colors: invitationColors, viewport };
  } finally {
    await page.close();
  }
}

async function retailStorefrontEvidence({ host, path, name, logoPath, screenshot, viewport }) {
  const page = await browser.newPage({ viewport });
  try {
    const response = await page.goto(`http://${host}:${port}${path}`, { waitUntil: "domcontentloaded" });
    assert.equal(response?.status(), 200, `Retail storefront route loads for ${host}${path}`);
    await page.locator('[data-retail-display-mode="browser"]').waitFor({ state: "visible" });
    const brand = page.locator(`header img[alt="${name}"]`);
    await brand.waitFor({ state: "visible" });
    const image = await brand.evaluate((element) => ({ src: element.getAttribute("src"), complete: element.complete, width: element.naturalWidth, height: element.naturalHeight }));
    assert.ok(image.src?.includes(logoPath), `correct tenant logo on Retail storefront: ${image.src}`);
    assert.equal(image.complete, true);
    assert.ok(image.width > 0 && image.height > 0);
    const manifestHref = await page.locator('link[rel="manifest"]').getAttribute("href");
    assert.ok(manifestHref?.includes("pwa-manifest"), `Retail page advertises its tenant manifest: ${manifestHref}`);
    const mobileNavigation = page.getByRole("navigation", { name: "پیمایش موبایل فروشگاه" });
    if (viewport.width < 768) await mobileNavigation.waitFor({ state: "visible" });
    await page.screenshot({ path: `${artifactDir}/${screenshot}`, fullPage: true });
    await page.context().setOffline(true);
    await page.getByRole("status").filter({ hasText: "اتصال اینترنت قطع است" }).waitFor({ state: "visible" });
    await page.context().setOffline(false);
    await page.getByRole("status").filter({ hasText: "اتصال برقرار شد" }).waitFor({ state: "visible" });
    return { host, path, title: await page.title(), logo: image.src, viewport, screenshot, offlineReconnect: "PASS" };
  } finally {
    await page.close();
  }
}

async function assertNoInstallInvitation(host, locale = "fa", extraHTTPHeaders = {}) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, extraHTTPHeaders });
  try {
    await page.goto(`http://${host}:${port}/${locale}`, { waitUntil: "domcontentloaded" });
    await page.evaluate(() => {
      const event = new Event("beforeinstallprompt", { cancelable: true });
      Object.assign(event, { prompt: async () => {}, userChoice: Promise.resolve({ outcome: "dismissed", platform: "web" }) });
      window.dispatchEvent(event);
    });
    await delay(500);
    assert.equal(await page.getByTestId("pwa-install-invitation").count(), 0, `no misleading install offer for ${host}`);
  } finally {
    await page.close();
  }
}

try {
  assertExplicitCiDatabaseTarget();
  await verifyCiDatabaseIdentity();
  const gammaAssetRoot = genericAssetRoot;
  const alpha = await createTenant({
    suffix: "alpha",
    host: hosts.alpha,
    label: "آکا شوز",
    shortName: "آکا",
    retailTheme: "FASHION",
    logoUrl: "/brand/tenants/aka-shoes/brand/aka-shoes-logo-square-brand-1024.png",
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
    label: "رستوران 13",
    shortName: "رستوران 13",
    assets: {
      favicon: "/brand/tenants/restaurant-13/brand/production-ready/favicon.ico",
      apple: "/brand/tenants/restaurant-13/brand/production-ready/apple-touch-icon.png",
      icon192: "/brand/tenants/restaurant-13/brand/production-ready/icon-192.png",
      icon512: "/brand/tenants/restaurant-13/brand/production-ready/icon-512.png",
      maskable192: "/brand/tenants/restaurant-13/brand/production-ready/icon-maskable-192.png",
      maskable512: "/brand/tenants/restaurant-13/brand/production-ready/icon-maskable-512.png",
    },
  });
  const gamma = await createTenant({
    suffix: "gamma",
    host: hosts.gamma,
    label: "برند آزمایشی سوم",
    shortName: "سوم",
    retailTheme: "ELECTRONICS",
    logoUrl: `${gammaAssetRoot}/icon-192.png`,
    assets: {
      favicon: `${gammaAssetRoot}/icon-192.png`,
      apple: `${gammaAssetRoot}/apple-180.png`,
      icon192: `${gammaAssetRoot}/icon-192.png`,
      icon512: `${gammaAssetRoot}/icon-512.png`,
      maskable192: `${gammaAssetRoot}/maskable-192.png`,
      maskable512: `${gammaAssetRoot}/maskable-512.png`,
    },
  });
  await createTenant({ suffix: "inactive", host: hosts.inactive, active: false, label: "Inactive", assets: {} });
  await createTenant({ suffix: "unverified", host: hosts.unverified, verified: false, label: "Unverified", assets: {} });
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
  assert.equal(alphaManifest.name, "آکا شوز");
  assert.equal(alphaManifest.short_name, "آکا");
  assert.equal(alphaManifest.lang, "fa");
  assert.equal(alphaManifest.dir, "rtl");
  assert.equal(alphaManifest.display, "standalone");
  assert.equal(alphaManifest.start_url, "/fa/shop", "custom-domain Aka PWA opens the canonical tenant shop route");
  assert.equal(alphaManifest.id, "/fa/shop", "Aka installed-app identity is organization storefront scoped");
  assert.equal(alphaManifest.icons.length, 4);
  assert.ok(alphaManifest.icons.every((entry) => entry.src.includes("/brand/tenants/aka-shoes/")));
  assert.ok(!JSON.stringify(alphaManifest).includes("restaurant-13"));

  const betaResult = await manifestFor(hosts.beta);
  const betaManifest = betaResult.manifest;
  assert.equal(betaManifest.name, "رستوران 13");
  assert.equal(betaManifest.short_name, "رستوران 13");
  assert.equal(betaManifest.icons.length, 4);
  assert.ok(betaManifest.icons.every((entry) => entry.src.includes("/brand/tenants/restaurant-13/")));
  assert.ok(!JSON.stringify(betaManifest).includes("aka-shoes"));
  assert.equal(betaManifest.start_url, "/fa", "restaurant manifest retains its existing public entry route");

  const gammaResult = await manifestFor(hosts.gamma);
  assert.equal(gammaResult.manifest.name, "برند آزمایشی سوم");
  assert.equal(gammaResult.manifest.icons.length, 4);
  assert.ok(gammaResult.manifest.icons.every((entry) => entry.src.includes(gammaAssetRoot)));
  assert.equal(gammaResult.manifest.start_url, "/fa/shop", "synthetic Electronics tenant opens its own custom-domain shop route");
  assert.equal(gammaResult.manifest.name, "برند آزمایشی سوم");
  assert.ok(!JSON.stringify(gammaResult.manifest).includes("aka-shoes"));

  for (const tenant of [
    { org: alpha, logoPath: "aka-shoes/brand/aka-shoes-logo-square-brand-1024.png", expectedName: "آکا شوز" },
    { org: gamma, logoPath: "__pwa-ci-generic/icon-192.png", expectedName: "برند آزمایشی سوم" },
  ]) {
    const response = await responseFor("localhost", `/api/public/v1/organizations/${encodeURIComponent(tenant.org.slug)}/pwa-manifest?locale=fa&entry=retail`);
    assert.equal(response?.status, 200, `tenant path manifest resolves for ${tenant.expectedName}`);
    const manifest = JSON.parse(response.body.toString("utf8"));
    assert.equal(manifest.name, tenant.expectedName);
    assert.equal(manifest.start_url, `/fa/${tenant.org.slug}/shop`);
  }
  const crossTenantManifest = await responseFor(hosts.alpha, `/api/public/v1/organizations/${encodeURIComponent(gamma.slug)}/pwa-manifest?locale=fa&entry=retail`);
  assert.equal(crossTenantManifest?.status, 404, "a tenant host cannot request another tenant's install identity");
  const retailStorefronts = [];
  retailStorefronts.push(await retailStorefrontEvidence({
    host: hosts.alpha,
    path: "/fa/shop",
    name: "آکا شوز",
    logoPath: "aka-shoes/brand/aka-shoes-logo-square-brand-1024.png",
    screenshot: "retail-aka-shoes-mobile.png",
    viewport: { width: 390, height: 844 },
  }));
  retailStorefronts.push(await retailStorefrontEvidence({
    host: hosts.gamma,
    path: "/fa/shop",
    name: "برند آزمایشی سوم",
    logoPath: "__pwa-ci-generic/icon-192.png",
    screenshot: "retail-synthetic-electronics-desktop.png",
    viewport: { width: 1440, height: 1000 },
  }));

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
  const unverifiedResult = await manifestFor(hosts.unverified);
  assert.deepEqual(unverifiedResult.manifest.icons, []);
  assert.equal(unverifiedResult.manifest.display, "browser");

  const incompleteResult = await manifestFor(hosts.incomplete);
  assert.deepEqual(incompleteResult.manifest.icons, [], "active tenant without icon configuration has no platform icon fallback");
  assert.equal(incompleteResult.manifest.display, "browser", "active tenant without complete icons is non-installable");
  assert.ok(!JSON.stringify(incompleteResult.manifest).includes("/icons/"), "incomplete tenant manifest does not reference platform icons");

  for (const [host, manifest] of [["localhost", platformResult.manifest], [hosts.alpha, alphaManifest], [hosts.beta, betaManifest], [hosts.gamma, gammaResult.manifest]]) {
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
  const gammaApple = await responseFor(hosts.gamma, `${gammaAssetRoot}/apple-180.png`);
  assert.equal(gammaApple?.status, 200, "generic tenant Apple Touch Icon is served");
  assert.equal(gammaApple.body.readUInt32BE(16), 180);
  const gammaFavicon = await responseFor(hosts.gamma, "/favicon.ico");
  assert.equal(gammaFavicon?.status, 200, "generic tenant favicon resolves");
  assert.match(gammaFavicon.headers["content-type"] || "", /^image\//);
  assert.ok(gammaFavicon.url.includes(gammaAssetRoot));

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
  assert.match(metadata.title, /آکا شوز/, "tenant root renders the expected organization's metadata");
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

  const invitations = [];
  for (const scenario of [
    { host: "localhost", title: "نصب اپ بازارباز", iconPath: "/icons/icon-192x192.png", screenshot: "install-platform-fa-mobile.png", viewport: { width: 390, height: 844 } },
    { host: hosts.alpha, path: "/fa/shop", title: "نصب اپ آکا شوز", iconPath: "/brand/tenants/aka-shoes/pwa/icon-192x192.png", screenshot: "install-aka-fa-mobile.png", viewport: { width: 390, height: 844 }, theme: "dark" },
    { host: "localhost", path: `/fa/retail/${alpha.slug}`, title: "نصب اپ آکا شوز", iconPath: "/brand/tenants/aka-shoes/pwa/icon-192x192.png", screenshot: "install-aka-path-retail-desktop.png", viewport: { width: 1280, height: 900 } },
    { host: hosts.beta, title: "نصب اپ رستوران 13", iconPath: "/brand/tenants/restaurant-13/brand/production-ready/icon-192.png", screenshot: "install-restaurant-fa-desktop.png", viewport: { width: 1280, height: 900 } },
    { host: hosts.gamma, path: "/fa/shop", title: "نصب اپ برند آزمایشی سوم", iconPath: `${gammaAssetRoot}/icon-192.png`, screenshot: "install-synthetic-electronics-fa-mobile.png", viewport: { width: 390, height: 844 } },
    { host: hosts.alpha, locale: "en", title: "Install app آکا شوز", iconPath: "/brand/tenants/aka-shoes/pwa/icon-192x192.png", screenshot: "install-aka-en-desktop.png", viewport: { width: 1280, height: 900 } },
    { host: hosts.beta, locale: "ar", title: "تثبيت تطبيق رستوران 13", iconPath: "/brand/tenants/restaurant-13/brand/production-ready/icon-192.png", screenshot: "install-restaurant-ar-mobile.png", viewport: { width: 390, height: 844 }, theme: "dark" },
  ]) {
    invitations.push(await installInvitationFor(scenario));
  }
  for (const host of [hosts.unknown, hosts.inactive, hosts.unverified, hosts.incomplete]) {
    await assertNoInstallInvitation(host);
  }
  await assertNoInstallInvitation(hosts.unknown, "fa", forgedHeaders);
  writeFileSync(`${artifactDir}/install-invitations.json`, JSON.stringify({ status: "PASSED", invitations }, null, 2));

  const unknownFavicon = await responseFor(hosts.unknown, "/favicon.ico");
  assert.equal(unknownFavicon?.status, 404, "unknown hosts cannot inherit another tenant favicon");
  const inactiveFavicon = await responseFor(hosts.inactive, "/favicon.ico");
  assert.equal(inactiveFavicon?.status, 404, "inactive domains do not serve tenant favicons");
  const incompleteFavicon = await responseFor(hosts.incomplete, "/favicon.ico");
  assert.equal(incompleteFavicon?.status, 404, "incomplete tenant branding does not fall back to a platform favicon");

  console.log("tenant-pwa-http-evidence", JSON.stringify({
    retailStorefronts,
    manifests: {
      platform: { status: platformResult.response.status, name: platformResult.manifest.name, short_name: platformResult.manifest.short_name, display: platformResult.manifest.display, icons: platformResult.manifest.icons.map(({ src, sizes, purpose }) => ({ src, sizes, purpose })) },
      alpha: { status: alphaResult.response.status, name: alphaManifest.name, short_name: alphaManifest.short_name, id: alphaManifest.id, start_url: alphaManifest.start_url, scope: alphaManifest.scope, display: alphaManifest.display, lang: alphaManifest.lang, dir: alphaManifest.dir, icons: alphaManifest.icons.map(({ src, sizes, purpose }) => ({ src, sizes, purpose })) },
      beta: { status: betaResult.response.status, name: betaManifest.name, short_name: betaManifest.short_name, id: betaManifest.id, start_url: betaManifest.start_url, scope: betaManifest.scope, display: betaManifest.display, lang: betaManifest.lang, dir: betaManifest.dir, icons: betaManifest.icons.map(({ src, sizes, purpose }) => ({ src, sizes, purpose })) },
      unknown: { status: unknownResult.response.status, display: unknownResult.manifest.display, icons: unknownResult.manifest.icons },
      inactive: { status: inactiveResult.response.status, display: inactiveResult.manifest.display, icons: inactiveResult.manifest.icons },
      incomplete: { status: incompleteResult.response.status, display: incompleteResult.manifest.display, icons: incompleteResult.manifest.icons },
      unverified: { status: unverifiedResult.response.status, display: unverifiedResult.manifest.display, icons: unverifiedResult.manifest.icons },
      gamma: { status: gammaResult.response.status, name: gammaResult.manifest.name, icons: gammaResult.manifest.icons },
    },
    favicons: faviconEvidence,
  }));
  console.log(JSON.stringify({
    result: "PASS",
    browser: "Chromium production-mode",
    manifests: { platform: "PASS", tenantAlpha: "PASS", tenantBeta: "PASS", genericTenant: "PASS", forgedUnknown: "PASS", inactiveDomain: "PASS", unverifiedDomain: "PASS", incompleteTenant: "PASS" },
    assetHttpMimeAndDimensions: "PASS",
    metadataAndScreenshots: "PASS",
    visibleInstallInvitations: "PASS",
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
  // CI-only synthetic artwork belongs to this run and is never published as a tenant asset.
  rmSync(genericAssetDirectory, { recursive: true, force: true });
}
