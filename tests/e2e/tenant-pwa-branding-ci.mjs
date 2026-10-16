import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { request as httpRequest } from "node:http";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import os from "node:os";
import { setTimeout as delay } from "node:timers/promises";
import bcrypt from "bcryptjs";
import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";
import { genericAssetDirectory, genericAssetRoot } from "../../scripts/e2e/prepare-tenant-pwa-fixtures.mjs";
import { cleanupNativeInstalls, verifyNativeInstall } from "./pwa-native-install.mjs";
import { verifyRetailAccount } from "./pwa-account-acceptance.mjs";
import { verifyWorkerAcceptance } from "./pwa-worker-acceptance.mjs";

const require = createRequire(import.meta.url);
const prisma = new PrismaClient();
const localPwaAcceptance = process.env.LOCAL_PWA_ACCEPTANCE === "1";
const runId = localPwaAcceptance ? process.env.HOTEL_ONBOARDING_RUN_ID : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const artifactDir = path.resolve(process.env.PWA_BROWSER_ARTIFACTS || process.env.TENANT_PWA_ARTIFACTS || process.env.HOTEL_ONBOARDING_ARTIFACTS || ".tmp/tenant-pwa-ci");
mkdirSync(artifactDir, { recursive: true });
const logPath = `${artifactDir}/next-start.log`;
const port = await reservePort();
const hosts = {
  alpha: "tenant-alpha.pwa-ci.test",
  beta: "tenant-beta.pwa-ci.test",
  gamma: "tenant-gamma.pwa-ci.test",
  inactive: "tenant-inactive.pwa-ci.test",
  unverified: "tenant-unverified.pwa-ci.test",
  incomplete: "tenant-incomplete.pwa-ci.test",
  unknown: "tenant-unknown.pwa-ci.test",
  broken: "tenant-broken.pwa-ci.test",
};
const organizations = [];
let server;
let browser;
let nativeProfileDirectory;

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

function assertExplicitLocalDatabaseTarget() {
  assert.equal(process.env.LOCAL_PWA_ACCEPTANCE, "1");
  assert.equal(process.env.HOTEL_ONBOARDING_PG_ACCEPTANCE, "1");
  assert.equal(process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production", false);
  assert.match(runId ?? "", /^[a-f0-9]{12}$/);
  assert.match(process.env.HOTEL_ONBOARDING_CONTAINER_ID ?? "", /^[a-f0-9]{64}$/);
  const expectedDatabase = `hotel_onboarding_${runId}`;
  for (const key of ["DATABASE_URL", "DIRECT_URL"]) {
    const raw = process.env[key];
    assert.ok(raw, `${key} must be explicitly configured for guarded local PWA acceptance`);
    const target = new URL(raw);
    assert.equal(target.protocol, "postgresql:", `${key} must use PostgreSQL`);
    assert.equal(target.hostname, "127.0.0.1", `${key} must target the guarded loopback database`);
    assert.ok(Number(target.port) > 1024 && Number(target.port) < 65536, `${key} must use the run's dynamic loopback port`);
    assert.equal(decodeURIComponent(target.username), "hotel_onboarding_test", `${key} must use the synthetic local role`);
    assert.equal(target.pathname.slice(1), expectedDatabase, `${key} must target this run's exact disposable database`);
  }
  assert.equal(process.env.DIRECT_URL, process.env.DATABASE_URL, "direct and pooled URLs must identify the same local target");
}

async function verifyDatabaseIdentity(expectedDatabase, expectedUser) {
  const [identity] = await prisma.$queryRaw`SELECT current_database()::text AS database, current_user::text AS "user", current_setting('server_version_num')::int AS version_num`;
  assert.equal(identity.database, expectedDatabase);
  assert.equal(identity.user, expectedUser);
  assert.ok(identity.version_num >= 170000 && identity.version_num < 180000, "PostgreSQL 17 is required");
}

const nativeInstallEvidence = [];

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
  if (host) {
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
  }
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

async function responseFor(host, resourcePath, extraHeaders = {}) {
  // Core HTTP preserves the exact Host header; undici may replace it with the
  // socket hostname. A deliberate favicon 404 is not a browser navigation.
  let target = new URL(resourcePath, `http://${host}:${port}`);
  for (let redirect = 0; redirect < 6; redirect++) {
    assert.equal(target.origin, `http://${host}:${port}`, "fixture response must not redirect across origins");
    const result = await new Promise((resolve, reject) => {
      const request = httpRequest({ hostname: "127.0.0.1", port, path: target.pathname + target.search, headers: { ...extraHeaders, host: target.host } }, response => {
        const chunks = [];
        response.on("data", chunk => chunks.push(chunk));
        response.on("end", () => resolve({ status: response.statusCode, headers: response.headers, url: target.href, body: Buffer.concat(chunks) }));
        response.on("error", reject);
      });
      request.setTimeout(30000, () => request.destroy(new Error("fixture HTTP timeout")));
      request.once("error", reject);
      request.end();
    });
    if (result.status >= 300 && result.status < 400 && result.headers.location) { target = new URL(result.headers.location, target); continue; }
    return result;
  }
  throw new Error("fixture HTTP redirect loop");
}

async function manifestFor(host, extraHeaders = {}) {
  const response = await responseFor(host, "/manifest.webmanifest", extraHeaders);
  assert.ok(response, `manifest response exists for ${host}`);
  assert.equal(response.status, 200, `manifest status for ${host}`);
  assert.match(response.headers["content-type"] || "", /manifest|json/i, `manifest MIME for ${host}`);
  // Next metadata routes emit max-age=0,must-revalidate even with force-dynamic.
  // This forbids unvalidated reuse; explicit tenant API routes additionally use no-store.
  assert.match(response.headers["cache-control"] || "", /no-store|max-age=0,\s*must-revalidate/i, `manifest requires fresh resolution for ${host}`);
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

async function installInvitationFor({ host, locale = "fa", path = null, nextPath = null, title, iconPath, screenshot, viewport, theme = "light" }) {
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
    if (nextPath) {
      await page.evaluate(value => history.pushState(null, "", value), nextPath);
      await delay(1000);
      assert.equal(await invitation.count(), 0, "a deferred install event cannot be reused after switching tenant paths");
    }
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

async function verifySameOriginPathCustomerAccess({ browser, first, second, origin, runId }) {
  const suffix = randomBytes(6).toString("hex");
  const username = `pwa-path-customer-${runId}-${suffix}`.toLowerCase();
  const email = `${username}@example.invalid`;
  const password = randomBytes(24).toString("base64url");
  const user = await prisma.user.create({
    data: { name: username, email, password: await bcrypt.hash(password, 12), role: "CUSTOMER", emailVerified: new Date(), firstName: "Synthetic", lastName: suffix, isActive: true },
  });
  const context = await browser.newContext();
  try {
    await prisma.emailVerification.create({ data: {
      userId: user.id,
      email,
      token: randomBytes(32).toString("hex"),
      verifiedAt: new Date(),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    } });
    const page = await context.newPage();
    const checks = [];
    for (const tenant of [first, second]) {
      const profilePath = `/fa/${tenant.slug}/shop/profile`;
      const login = new URL("/fa/login", origin);
      login.searchParams.set("callbackUrl", profilePath);
      if (tenant === first) {
        await page.goto(login.toString(), { waitUntil: "domcontentloaded" });
        await page.locator("#username").fill(username);
        await page.locator("#password").fill(password);
        await page.locator('button[type="submit"]').click();
      } else {
        await page.goto(new URL(profilePath, origin).toString(), { waitUntil: "domcontentloaded" });
      }
      await page.waitForURL((url) => url.origin === origin && url.pathname === profilePath, { waitUntil: "domcontentloaded" });
      await page.getByRole("heading", { name: tenant.name, exact: true }).waitFor();
      const ownProfile = await page.evaluate(async () => {
        const response = await fetch("/api/users/me", { credentials: "same-origin", cache: "no-store" });
        return { status: response.status, body: await response.json().catch(() => ({})) };
      });
      assert.equal(ownProfile.status, 200, "the same-origin customer session remains authenticated");
      assert.equal(ownProfile.body.id, user.id);
      assert.equal(ownProfile.body.name, username);
      assert.equal(ownProfile.body.email, email);
      const publicOrganization = await page.evaluate(async (slug) => {
        const response = await fetch(`/api/public/organizations/${encodeURIComponent(slug)}`, { cache: "no-store" });
        return { status: response.status, body: await response.json().catch(() => ({})) };
      }, tenant.slug);
      assert.equal(publicOrganization.status, 200);
      const organization = publicOrganization.body.organization || publicOrganization.body;
      assert.equal(organization.slug, tenant.slug);
      assert.equal(organization.name, tenant.name);
      checks.push({ slug: tenant.slug, profilePath, renderedOrganization: tenant.name, authenticatedUserId: ownProfile.body.id, customerDtoSafe: !Object.hasOwn(ownProfile.body, "password") });
    }
    const cookieMetadata = (await context.cookies(origin)).map(({ name, domain, path, httpOnly, secure, sameSite }) => ({ name, domain, path, httpOnly, secure, sameSite }));
    assert.ok(cookieMetadata.some(({ name }) => /(?:auth|session)/i.test(name)), "the same-origin profile carries an authentication cookie");
    return { status: "PASSED", origin, sharedOriginCookieStorage: true, cookieMetadata, checks, note: "Same-origin tenants share browser cookies by design; tenant data resolution was verified against each persisted path organization." };
  } finally {
    await context.close();
    await prisma.user.deleteMany({ where: { id: user.id, name: username, email } });
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
    const navigation = await page.locator('a[href$="/profile"], a[href$="/checkout"]').evaluateAll(links => links.map(link => ({ href: link.href, path: new URL(link.href).pathname })));
    const resolvedNavigation = [];
    for (const link of navigation.filter((link, index, all) => all.findIndex(other => other.path === link.path) === index)) {
      assert.equal(new URL(link.href).origin, `http://${host}:${port}`);
      const result = await responseFor(host, link.path);
      assert.equal(result.status, 200, `tenant account/cart navigation resolves: ${link.path}`);
      const finalPath = new URL(result.url).pathname;
      assert.ok(["/shop/profile", "/shop/checkout", "/fa/shop/profile", "/fa/shop/checkout"].includes(finalPath), `legacy alias resolves to canonical tenant navigation: ${finalPath}`);
      resolvedNavigation.push({ requested: link.path, finalPath, status: result.status });
    }
    writeFileSync(`${artifactDir}/navigation-${host}.json`, JSON.stringify(resolvedNavigation, null, 2));
    assert.ok(navigation.some(link => link.path.endsWith("/profile")));
    assert.ok(navigation.some(link => link.path.endsWith("/checkout")));
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
    const missingAsset = host === hosts.broken
      ? page.waitForResponse(response => new URL(response.url()).pathname.endsWith("/missing-512.png"))
      : null;
    await page.goto(`http://${host}:${port}/${locale}`, { waitUntil: "domcontentloaded" });
    if (missingAsset) assert.equal((await missingAsset).status(), 404, "missing configured 512 icon is actually requested and rejected");
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
  if (localPwaAcceptance) {
    assertExplicitLocalDatabaseTarget();
    await verifyDatabaseIdentity(`hotel_onboarding_${runId}`, "hotel_onboarding_test");
  } else {
    assertExplicitCiDatabaseTarget();
    await verifyDatabaseIdentity("bazarbaaz_tenant_pwa_ci", "tenant_pwa_ci");
  }
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
  await createTenant({
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
  const delta = await createTenant({
    suffix: "delta",
    label: "آکا شوز مسیر",
    shortName: "آکا مسیر",
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
  const epsilon = await createTenant({
    suffix: "epsilon",
    label: "برند آزمایشی مسیر",
    shortName: "آزمایشی",
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
  await createTenant({ suffix: "broken", host: hosts.broken, label: "Unavailable assets", assets: {
    favicon: `${gammaAssetRoot}/icon-192.png`, apple: `${gammaAssetRoot}/apple-180.png`, icon192: `${gammaAssetRoot}/icon-192.png`, icon512: `${gammaAssetRoot}/missing-512.png`, maskable192: `${gammaAssetRoot}/maskable-192.png`, maskable512: `${gammaAssetRoot}/maskable-512.png`,
  } });
  await createTenant({ suffix: "inactive", host: hosts.inactive, active: false, label: "Inactive", assets: {} });
  await createTenant({ suffix: "unverified", host: hosts.unverified, verified: false, label: "Unverified", assets: {} });
  await createTenant({ suffix: "incomplete", host: hosts.incomplete, label: "Incomplete", assets: {}, withBranding: false });

  const nextBin = require.resolve("next/dist/bin/next");
  const nextOrigin = `http://localhost:${port}`;
  server = spawn(process.execPath, [nextBin, "start", "--hostname", "127.0.0.1", "--port", String(port)], {
    env: { ...process.env, NODE_ENV: "production", PORT: String(port), AUTH_TRUST_HOST: "true", NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET || randomBytes(32).toString("hex"), NEXTAUTH_URL: nextOrigin, NEXT_PUBLIC_APP_URL: nextOrigin },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  const databaseUrlForRedaction = process.env.DATABASE_URL || "";
  const databasePasswordForRedaction = databaseUrlForRedaction ? new URL(databaseUrlForRedaction).password : "";
  const safeLogChunk = (chunk) => {
    let text = chunk.toString();
    if (databaseUrlForRedaction) text = text.replaceAll(databaseUrlForRedaction, "<task-db>");
    if (databasePasswordForRedaction) text = text.replaceAll(databasePasswordForRedaction, "<redacted>");
    return text;
  };
  server.stdout.on("data", (chunk) => appendFileSync(logPath, safeLogChunk(chunk)));
  server.stderr.on("data", (chunk) => appendFileSync(logPath, safeLogChunk(chunk)));
  await waitForServer();

  const chromeExecutable = process.env.CHROME_EXECUTABLE_PATH || process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || process.env.CHROME_EXECUTABLE || process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";
  const insecureFixtureOrigins = [...Object.values(hosts).map((host) => `http://${host}:${port}`), `http://localhost:${port}`].join(",");
  const launchOptions = {
    headless: process.env.PWA_HEADED !== "1",
    ...(existsSync(chromeExecutable) ? { executablePath: chromeExecutable } : {}),
    args: ["--no-proxy-server", "--host-resolver-rules=MAP *.pwa-ci.test 127.0.0.1, EXCLUDE localhost", `--unsafely-treat-insecure-origin-as-secure=${insecureFixtureOrigins}`],
  };
  if (localPwaAcceptance && process.env.PWA_HEADED === "1") {
    nativeProfileDirectory = path.resolve(os.tmpdir(), `bb-pwa-r6-${runId}`);
    assert.equal(existsSync(nativeProfileDirectory), false, "native install testing requires a fresh task-only Chrome profile");
    const context = await chromium.launchPersistentContext(nativeProfileDirectory, launchOptions);
    browser = context.browser();
    assert.ok(browser, "persistent Chrome exposes the default application context");
  } else browser = await chromium.launch(launchOptions);

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

  await prisma.organizationBranding.update({ where: { organizationId: alpha.id }, data: { displayName: "آکا شوز — آزمون به‌روزرسانی" } });
  assert.equal((await manifestFor(hosts.alpha)).manifest.name, "آکا شوز — آزمون به‌روزرسانی", "manifest revalidates current persisted branding");
  assert.equal((await manifestFor(hosts.gamma)).manifest.name, "برند آزمایشی سوم", "branding refresh does not contaminate the other tenant");
  await prisma.organizationBranding.update({ where: { organizationId: alpha.id }, data: { displayName: "آکا شوز" } });
  assert.equal((await manifestFor(hosts.alpha)).manifest.name, "آکا شوز", "restored synthetic branding is immediately served");
  const pathManifests = [];
  for (const tenant of [
    { org: delta, logoPath: "aka-shoes/brand/aka-shoes-logo-square-brand-1024.png", expectedName: "آکا شوز مسیر" },
    { org: epsilon, logoPath: "__pwa-ci-generic/icon-192.png", expectedName: "برند آزمایشی مسیر" },
  ]) {
    const response = await responseFor("localhost", `/api/public/v1/organizations/${encodeURIComponent(tenant.org.slug)}/pwa-manifest?locale=fa&entry=retail`);
    assert.equal(response?.status, 200, `tenant path manifest resolves for ${tenant.expectedName}`);
    const manifest = JSON.parse(response.body.toString("utf8"));
    assert.equal(manifest.name, tenant.expectedName);
    assert.equal(manifest.start_url, `/fa/${tenant.org.slug}/shop`);
    assert.equal(manifest.scope, `/fa/${tenant.org.slug}/shop`);
    assert.equal(manifest.id, manifest.start_url);
    assert.match(response.headers["cache-control"], /no-store/);
    pathManifests.push({ slug: tenant.org.slug, manifest, headers: response.headers });
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
  retailStorefronts.push(await retailStorefrontEvidence({ host: hosts.alpha, path: "/fa/shop", name: "آکا شوز", logoPath: "aka-shoes/brand/aka-shoes-logo-square-brand-1024.png", screenshot: "retail-aka-shoes-desktop.png", viewport: { width: 1440, height: 1000 } }));
  retailStorefronts.push(await retailStorefrontEvidence({ host: hosts.gamma, path: "/fa/shop", name: "برند آزمایشی سوم", logoPath: "__pwa-ci-generic/icon-192.png", screenshot: "retail-synthetic-electronics-mobile.png", viewport: { width: 390, height: 844 } }));
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

  const assetByteEvidence = [];
  const publicRoot = path.resolve("public");
  for (const [host, manifest] of [["localhost", platformResult.manifest], [hosts.alpha, alphaManifest], [hosts.beta, betaManifest], [hosts.gamma, gammaResult.manifest]]) {
    for (const icon of manifest.icons) {
      const assetPath = new URL(icon.src, `http://${host}:${port}`).pathname;
      const assetResponse = await responseFor(host, assetPath);
      assert.ok(assetResponse, `asset response exists: ${assetPath}`);
      assert.equal(assetResponse.status, 200, `asset HTTP status: ${assetPath}`);
      assert.match(assetResponse.headers["content-type"] || "", /^image\//, `asset MIME: ${assetPath}`);
      const png = assetResponse.body;
      const approvedFile = path.resolve(publicRoot, `.${assetPath}`);
      assert.ok(approvedFile.startsWith(`${publicRoot}${path.sep}`), `manifest asset stays under public/: ${assetPath}`);
      const approvedBytes = readFileSync(approvedFile);
      assert.deepEqual(png, approvedBytes, `HTTP-served icon bytes match approved repository asset: ${assetPath}`);
      assetByteEvidence.push({ host, path: assetPath, bytes: png.length, sha256: createHash("sha256").update(png).digest("hex") });
      assert.equal(png.subarray(0, 8).toString("hex"), "89504e470d0a1a0a", `icon is a PNG: ${assetPath}`);
      const [expectedWidth, expectedHeight] = icon.sizes.split("x").map(Number);
      assert.equal(png.readUInt32BE(16), expectedWidth, `icon width matches manifest: ${assetPath}`);
      assert.equal(png.readUInt32BE(20), expectedHeight, `icon height matches manifest: ${assetPath}`);
    }
  }

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
    { host: "localhost", path: `/fa/retail/${alpha.slug}`, nextPath: `/fa/retail/${gamma.slug}`, title: "نصب اپ آکا شوز", iconPath: "/brand/tenants/aka-shoes/pwa/icon-192x192.png", screenshot: "install-aka-path-retail-desktop.png", viewport: { width: 1280, height: 900 } },
    { host: hosts.beta, title: "نصب اپ رستوران 13", iconPath: "/brand/tenants/restaurant-13/brand/production-ready/icon-192.png", screenshot: "install-restaurant-fa-desktop.png", viewport: { width: 1280, height: 900 } },
    { host: hosts.gamma, path: "/fa/shop", title: "نصب اپ برند آزمایشی سوم", iconPath: `${gammaAssetRoot}/icon-192.png`, screenshot: "install-synthetic-electronics-fa-mobile.png", viewport: { width: 390, height: 844 } },
    { host: hosts.alpha, locale: "en", title: "Install app آکا شوز", iconPath: "/brand/tenants/aka-shoes/pwa/icon-192x192.png", screenshot: "install-aka-en-desktop.png", viewport: { width: 1280, height: 900 } },
    { host: hosts.beta, locale: "ar", title: "تثبيت تطبيق رستوران 13", iconPath: "/brand/tenants/restaurant-13/brand/production-ready/icon-192.png", screenshot: "install-restaurant-ar-mobile.png", viewport: { width: 390, height: 844 }, theme: "dark" },
  ]) {
    invitations.push(await installInvitationFor(scenario));
  }
  for (const host of [hosts.unknown, hosts.inactive, hosts.unverified, hosts.incomplete, hosts.broken]) {
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

  writeFileSync(`${artifactDir}/asset-http-bytes.json`, JSON.stringify({ status: "PASSED", assets: assetByteEvidence }, null, 2));
  const workerEvidence = [];
  for (const scenario of [{ host: hosts.alpha, name: "آکا شوز", label: "aka" }, { host: hosts.gamma, name: "برند آزمایشی سوم", label: "electronics" }]) {
    workerEvidence.push(await verifyWorkerAcceptance({ browser, origin: `http://${scenario.host}:${port}`, startPath: "/fa/shop", expectedName: scenario.name, artifactDir, label: scenario.label }));
  }
  writeFileSync(`${artifactDir}/service-worker.json`, JSON.stringify(workerEvidence, null, 2));
  const accountEvidence = await verifyRetailAccount({ browser, prisma, origin: `http://localhost:${port}`, slug: alpha.slug, artifactDir, runId });
  writeFileSync(`${artifactDir}/retail-account.json`, JSON.stringify(accountEvidence, null, 2));
  const sameOriginCustomerEvidence = await verifySameOriginPathCustomerAccess({
    browser,
    first: await prisma.organization.findUniqueOrThrow({ where: { id: delta.id }, select: { slug: true, name: true } }),
    second: await prisma.organization.findUniqueOrThrow({ where: { id: epsilon.id }, select: { slug: true, name: true } }),
    origin: `http://localhost:${port}`,
    runId,
  });
  writeFileSync(`${artifactDir}/same-origin-customer-session.json`, JSON.stringify(sameOriginCustomerEvidence, null, 2));
  nativeInstallEvidence.push(await verifyNativeInstall({ browser, origin: `http://${hosts.alpha}:${port}`, manifest: alphaManifest, startPath: alphaManifest.start_url, artifactDir, label: "alpha-custom-host" }));
  nativeInstallEvidence.push(await verifyNativeInstall({ browser, origin: `http://${hosts.gamma}:${port}`, manifest: gammaResult.manifest, startPath: gammaResult.manifest.start_url, artifactDir, label: "gamma-custom-host" }));
  const platformPathOrigin = `http://localhost:${port}`;
  const alphaPathManifest = pathManifests.find(({ slug }) => slug === delta.slug)?.manifest;
  const gammaPathManifest = pathManifests.find(({ slug }) => slug === epsilon.slug)?.manifest;
  assert.ok(alphaPathManifest && gammaPathManifest, "two persisted tenant path manifests are required for same-origin installation");
  assert.notEqual(alphaPathManifest.id, gammaPathManifest.id, "path tenants must have distinct install identities");
  assert.notEqual(alphaPathManifest.scope, gammaPathManifest.scope, "path tenants must have distinct app scopes");
  nativeInstallEvidence.push(await verifyNativeInstall({ browser, origin: platformPathOrigin, manifest: alphaPathManifest, startPath: alphaPathManifest.start_url, artifactDir, label: "alpha-platform-path" }));
  nativeInstallEvidence.push(await verifyNativeInstall({ browser, origin: platformPathOrigin, manifest: gammaPathManifest, startPath: gammaPathManifest.start_url, artifactDir, label: "gamma-platform-path" }));
  writeFileSync(`${artifactDir}/native-installation.json`, JSON.stringify(nativeInstallEvidence, null, 2));
  const pathApps = nativeInstallEvidence.filter(({ label }) => label.endsWith("-platform-path"));
  if (pathApps.every(({ status }) => status === "INSTALLED_AND_LAUNCHED_STANDALONE")) {
    assert.equal(new URL(pathApps[0].launch.url).origin, new URL(pathApps[1].launch.url).origin, "both path apps must share one origin");
    assert.notEqual(pathApps[0].manifestId, pathApps[1].manifestId, "same-origin installed apps must retain separate manifest IDs");
    assert.notEqual(pathApps[0].processedManifest.scope, pathApps[1].processedManifest.scope, "same-origin installed apps must retain separate manifest scopes");
    assert.deepEqual(pathApps[0].coexistingManifestIds.filter((id) => id.startsWith(platformPathOrigin)), [pathApps[0].manifestId], "the first same-origin install is registered under its own identity");
    assert.deepEqual(pathApps[1].coexistingManifestIds.filter((id) => id.startsWith(platformPathOrigin)).sort(), pathApps.map(({ manifestId }) => manifestId).sort(), "the second same-origin install coexists with the first under a distinct identity");
  }
  assert.ok(nativeInstallEvidence.every(({ status }) => status !== "APPLICATION_ASSERTION_FAILED" && status !== "INSTALL_FAILED"), "supported native installations must pass application assertions");

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

  const httpEvidence = {
    pathManifests,
    retailStorefronts,
    manifests: {
      platform: { status: platformResult.response.status, name: platformResult.manifest.name, short_name: platformResult.manifest.short_name, display: platformResult.manifest.display, icons: platformResult.manifest.icons.map(({ src, sizes, purpose }) => ({ src, sizes, purpose })) },
      alpha: { status: alphaResult.response.status, name: alphaManifest.name, short_name: alphaManifest.short_name, id: alphaManifest.id, start_url: alphaManifest.start_url, scope: alphaManifest.scope, display: alphaManifest.display, lang: alphaManifest.lang, dir: alphaManifest.dir, icons: alphaManifest.icons.map(({ src, sizes, purpose }) => ({ src, sizes, purpose })) },
      beta: { status: betaResult.response.status, name: betaManifest.name, short_name: betaManifest.short_name, id: betaManifest.id, start_url: betaManifest.start_url, scope: betaManifest.scope, display: betaManifest.display, lang: betaManifest.lang, dir: betaManifest.dir, icons: betaManifest.icons.map(({ src, sizes, purpose }) => ({ src, sizes, purpose })) },
      unknown: { status: unknownResult.response.status, display: unknownResult.manifest.display, icons: unknownResult.manifest.icons },
      inactive: { status: inactiveResult.response.status, display: inactiveResult.manifest.display, icons: inactiveResult.manifest.icons },
      incomplete: { status: incompleteResult.response.status, display: incompleteResult.manifest.display, icons: incompleteResult.manifest.icons },
      unverified: { status: unverifiedResult.response.status, display: unverifiedResult.manifest.display, icons: unverifiedResult.manifest.icons },
      gamma: { status: gammaResult.response.status, name: gammaResult.manifest.name, id: gammaResult.manifest.id, start_url: gammaResult.manifest.start_url, scope: gammaResult.manifest.scope, icons: gammaResult.manifest.icons },
    },
    favicons: faviconEvidence,
  };
  writeFileSync(`${artifactDir}/manifest-http.json`, JSON.stringify(httpEvidence, null, 2));
  console.log("tenant-pwa-http-evidence", JSON.stringify(httpEvidence));
  console.log(JSON.stringify({
    result: "PASS",
    browser: "Chromium production-mode",
    manifests: { platform: "PASS", tenantAlpha: "PASS", tenantBeta: "PASS", genericTenant: "PASS", forgedUnknown: "PASS", inactiveDomain: "PASS", unverifiedDomain: "PASS", incompleteTenant: "PASS" },
    assetHttpMimeAndDimensions: "PASS",
    assetHttpBytesMatchApprovedFiles: "PASS",
    retailAccount: accountEvidence.status || "RECORDED",
    sameOriginCustomerAccess: sameOriginCustomerEvidence.status,
    nativeInstallAttempts: nativeInstallEvidence.map(({ label, status, android }) => ({ label, status, android })),
    metadataAndScreenshots: "PASS",
    visibleInstallInvitations: "PASS",
    isolation: "PASS",
    artifacts: artifactDir,
  }, null, 2));
} catch (error) {
  console.error(String(error?.stack || error).replaceAll(process.env.DATABASE_URL || "\u0000", "<task-db>"));
  process.exitCode = 1;
} finally {
  try {
    const nativeCleanup = await cleanupNativeInstalls();
    writeFileSync(`${artifactDir}/native-install-cleanup.json`, JSON.stringify(nativeCleanup, null, 2));
    if (nativeCleanup.some(({ cleanup }) => cleanup !== "PASSED")) process.exitCode = 1;
  } catch (error) {
    console.error("Native PWA cleanup failed", String(error?.message || error));
    process.exitCode = 1;
  }
  await browser?.close().catch(() => undefined);
  if (nativeProfileDirectory) {
    assert.equal(path.dirname(nativeProfileDirectory), path.resolve(os.tmpdir()));
    assert.equal(path.basename(nativeProfileDirectory), `bb-pwa-r6-${runId}`);
    try { rmSync(nativeProfileDirectory, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }); }
    catch { console.error("Exact task Chrome profile cleanup failed"); process.exitCode = 1; }
  }
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
