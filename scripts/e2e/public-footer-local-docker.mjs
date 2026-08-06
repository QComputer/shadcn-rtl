#!/usr/bin/env node
import "dotenv/config";
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { chromium } from "playwright";

const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
const containerName = `bazar-baz-public-footer-${stamp}`;
const databaseName = `bazar_baz_public_footer_${stamp}`;
const tenantA = `footer-shop-a-${stamp}`;
const tenantB = `footer-shop-b-${stamp}`;
const tenantHost = "footer-a.lvh.me";
let nextProcess = null;
let customDomainProxy = null;
let browser = null;
let customContext = null;

function getFreePort() {
  const script = "const net=require('net');const s=net.createServer();s.listen(0,'127.0.0.1',()=>{console.log(s.address().port);s.close();});";
  return Number(capture(process.execPath, ["-e", script]));
}

function run(name, args, env = process.env) {
  const result = spawnSync(name, args, { stdio: "inherit", env, shell: false });
  if (result.error) throw new Error(result.error.message);
  if (result.status !== 0) throw new Error(`${name} ${args.join(" ")} failed with exit code ${result.status ?? 1}`);
}

function runPnpm(args, env = process.env) {
  if (process.env.npm_execpath) return run(process.execPath, [process.env.npm_execpath, ...args], env);
  return run(process.platform === "win32" ? "pnpm.cmd" : "pnpm", args, env);
}

function capture(name, args) {
  const result = spawnSync(name, args, { encoding: "utf8" });
  if (result.status !== 0) throw new Error(`${name} ${args.join(" ")} failed: ${result.stderr || result.stdout}`);
  return result.stdout.trim();
}

function databaseIdentity(databaseUrl) {
  const parsed = new URL(databaseUrl);
  return {
    protocol: parsed.protocol.replace(":", ""),
    host: parsed.hostname,
    port: parsed.port,
    database: parsed.pathname.replace(/^\//, ""),
  };
}

function logDatabaseIdentity(label, databaseUrl) {
  const identity = databaseIdentity(databaseUrl);
  console.log(`${label} database: ${identity.protocol}://${identity.host}:${identity.port}/${identity.database}`);
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function createDockerDatabase() {
  capture("docker", [
    "run", "--rm", "-d", "--name", containerName,
    "-e", "POSTGRES_PASSWORD=postgres",
    "-e", "POSTGRES_USER=postgres",
    "-e", `POSTGRES_DB=${databaseName}`,
    "-p", "127.0.0.1::5432",
    "postgres:16-alpine",
  ]);

  let portLine = "";
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      portLine = capture("docker", ["port", containerName, "5432/tcp"]);
      if (portLine) break;
    } catch {}
    sleep(500);
  }
  const port = portLine.split(":").pop();
  if (!port) throw new Error("Unable to determine disposable PostgreSQL port");

  for (let attempt = 0; attempt < 120; attempt += 1) {
    const ready = spawnSync("docker", ["exec", containerName, "pg_isready", "-U", "postgres", "-d", databaseName], { stdio: "ignore" });
    if (ready.status === 0) return `postgresql://postgres:postgres@127.0.0.1:${port}/${databaseName}?schema=public`;
    sleep(500);
  }
  throw new Error("Disposable PostgreSQL did not become ready");
}

function cleanup() {
  if (customDomainProxy) customDomainProxy.close();
  if (nextProcess && !nextProcess.killed) nextProcess.kill();
  spawnSync("docker", ["rm", "-f", containerName], { stdio: "ignore" });
  fs.rmSync(path.join(process.cwd(), ".tmp", "public-footer"), { recursive: true, force: true });
}

function readNextLogTail() {
  const logFile = path.join(process.cwd(), ".tmp", "public-footer", "next.log");
  if (!fs.existsSync(logFile)) return "";
  const log = fs.readFileSync(logFile, "utf8");
  return log.split(/\r?\n/).slice(-120).join("\n");
}

function buildEnv(databaseUrl) {
  if (!/127\.0\.0\.1|localhost/.test(databaseUrl) || /neon|render|onrender/i.test(databaseUrl)) {
    throw new Error("Refusing to run public footer E2E against a non-local database.");
  }
  return {
    ...process.env,
    DATABASE_URL: databaseUrl,
    DIRECT_URL: databaseUrl,
    NODE_ENV: "development",
    NEXT_TELEMETRY_DISABLED: "1",
    AUTH_TRUST_HOST: "true",
    SMS_DRY_RUN: "true",
    EMAIL_DRY_RUN: "true",
    WEB_PUSH_REAL_SEND_ENABLED: "false",
    DOMAIN_PROVIDER_MUTATION_ENABLED: "false",
    CUSTOM_DOMAIN_REAL_MUTATION_ENABLED: "false",
    TENANT_PROVISIONING_EXECUTION_ENABLED: "false",
    AI_MEDIA_PAID_PROVIDER_ENABLED: "false",
    AI_MEDIA_REAL_GENERATION_ENABLED: "false",
    AI_MEDIA_PREVIEW_PROVIDER: "MOCK",
    INTERNAL_API_SECRET: "local-public-footer-secret",
    CUSTOM_DOMAIN_RESOLVER_SECRET: "local-public-footer-secret",
    AI_MEDIA_LOCAL_DOCKER_E2E: "1",
    AI_MEDIA_APPLICATION_STORAGE_ADAPTER: "local-test",
    AI_MEDIA_LOCAL_STORAGE_ROOT: path.join(process.cwd(), ".tmp", "public-footer", "storage"),
    NODE_OPTIONS: [process.env.NODE_OPTIONS, "--require=./scripts/e2e/register-server-only.cjs"].filter(Boolean).join(" "),
  };
}

function seed(env) {
  fs.mkdirSync(path.join(process.cwd(), ".tmp", "public-footer"), { recursive: true });
  const script = `
    import { PrismaClient } from "@prisma/client";
    const prisma = new PrismaClient();
    async function createShop(input) {
      await prisma.organization.create({
        data: {
          id: input.id,
          type: "SHOP",
          locale: "fa",
          timezone: "Asia/Tehran",
          name: input.name,
          slug: input.slug,
          description: input.description,
          address: input.address,
          phone: input.phone,
          email: input.email,
          isActive: true,
          isOpen: true
        }
      });
      await prisma.organizationSettings.create({ data: { organizationSlug: input.slug, currency: "IRR", enablePickup: true, enableDelivery: true } });
      const category = await prisma.productCategory.create({
        data: { id: input.categoryId, name: input.categoryName, slug: input.categorySlug, organizationId: input.id, organizationSlug: input.slug, sortOrder: 1 }
      });
      await prisma.product.create({
        data: {
          id: input.productId,
          name: input.productName,
          slug: input.productSlug,
          description: input.productName,
          basePrice: 100000,
          trackInventory: false,
          isActive: true,
          organizationId: input.id,
          organizationSlug: input.slug,
          categoryId: category.id,
          variants: { create: { id: input.variantId, name: "Default", sku: input.productId, price: 100000, inventory: 5 } }
        }
      });
    }
    await createShop({
      id: "org_footer_a_${stamp}",
      slug: ${JSON.stringify(tenantA)},
      name: "Footer Tenant Alpha",
      description: "Alpha public shop footer",
      address: "Alpha Address",
      phone: "+989111111111",
      email: "alpha@example.test",
      categoryId: "cat_footer_a_${stamp}",
      categoryName: "Alpha Category",
      categorySlug: "alpha-category-${stamp}",
      productId: "prod_footer_a_${stamp}",
      productName: "Alpha Product",
      productSlug: "alpha-product-${stamp}",
      variantId: "var_footer_a_${stamp}"
    });
    await createShop({
      id: "org_footer_b_${stamp}",
      slug: ${JSON.stringify(tenantB)},
      name: "Footer Tenant Beta",
      description: "Beta public shop footer",
      address: null,
      phone: null,
      email: null,
      categoryId: "cat_footer_b_${stamp}",
      categoryName: "Beta Category",
      categorySlug: "beta-category-${stamp}",
      productId: "prod_footer_b_${stamp}",
      productName: "Beta Product",
      productSlug: "beta-product-${stamp}",
      variantId: "var_footer_b_${stamp}"
    });
    await prisma.organizationDomain.create({
      data: {
        organizationId: "org_footer_a_${stamp}",
        domain: ${JSON.stringify(tenantHost)},
        normalizedDomain: ${JSON.stringify(tenantHost)},
        status: "ACTIVE",
        isPrimary: true,
        providerVerified: true,
        dnsConfigured: true,
        sslReady: true,
        activatedAt: new Date()
      }
    });
    const count = await prisma.organization.count({ where: { slug: { in: [${JSON.stringify(tenantA)}, ${JSON.stringify(tenantB)}] }, type: "SHOP", isActive: true, deletedAt: null } });
    if (count !== 2) throw new Error("Seeded footer tenants were not persisted");
    await prisma.$disconnect();
  `;
  const seedFile = path.join(process.cwd(), ".tmp", "public-footer", `seed-${stamp}.mts`);
  fs.writeFileSync(seedFile, script, "utf8");
  runPnpm(["exec", "tsx", seedFile], env);
}

function verifySeed(env, label, slug) {
  fs.mkdirSync(path.join(process.cwd(), ".tmp", "public-footer"), { recursive: true });
  const script = `
    import { PrismaClient } from "@prisma/client";
    const prisma = new PrismaClient();
    const organization = await prisma.organization.findFirst({
      where: { slug: ${JSON.stringify(slug)}, type: "SHOP", isActive: true, deletedAt: null },
      select: { slug: true, type: true, locale: true, isActive: true, isOpen: true, settings: { select: { organizationSlug: true } } }
    });
    console.log(JSON.stringify({
      found: Boolean(organization),
      slug: organization?.slug || null,
      type: organization?.type || null,
      locale: organization?.locale || null,
      isActive: organization?.isActive ?? null,
      isOpen: organization?.isOpen ?? null,
      hasSettings: Boolean(organization?.settings)
    }));
    await prisma.$disconnect();
  `;
  const verifyFile = path.join(process.cwd(), ".tmp", "public-footer", `verify-${label}-${stamp}.mts`);
  fs.writeFileSync(verifyFile, script, "utf8");
  const command = process.env.npm_execpath ? process.execPath : (process.platform === "win32" ? "pnpm.cmd" : "pnpm");
  const args = process.env.npm_execpath
    ? [process.env.npm_execpath, "exec", "tsx", "--require=./scripts/e2e/register-server-only.cjs", verifyFile]
    : ["exec", "tsx", "--require=./scripts/e2e/register-server-only.cjs", verifyFile];
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    env,
    stdio: "inherit",
    shell: false,
  });
  if (result.status !== 0) throw new Error(`${label} seed verification failed`);
}

function startNext(env, appPort) {
  fs.mkdirSync(path.join(process.cwd(), ".tmp", "public-footer"), { recursive: true });
  const out = fs.openSync(path.join(process.cwd(), ".tmp", "public-footer", "next.log"), "w");
  nextProcess = spawn(process.execPath, [
    path.join(process.cwd(), "node_modules", "next", "dist", "bin", "next"),
    "dev", "--webpack", "-p", String(appPort), "-H", "127.0.0.1",
  ], { cwd: process.cwd(), env, stdio: ["ignore", out, out], shell: false });
}

async function waitForApp(baseUrl) {
  for (let attempt = 0; attempt < 90; attempt += 1) {
    if (nextProcess?.exitCode != null) {
      throw new Error(`Local Next.js process exited before readiness with code ${nextProcess.exitCode}`);
    }
    try {
      const response = await fetch(baseUrl, { signal: AbortSignal.timeout(2000) });
      if (response.status < 500) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error("Local Next.js app did not become ready");
}

function startCustomDomainForwarder({ appPort, proxyPort }) {
  customDomainProxy = http.createServer((request, response) => {
    const headers = { ...request.headers, host: tenantHost, "x-forwarded-proto": "http" };
    const upstream = http.request({
      hostname: "127.0.0.1",
      port: appPort,
      path: request.url || "/",
      method: request.method,
      headers,
    }, (upstreamResponse) => {
      response.writeHead(upstreamResponse.statusCode || 502, upstreamResponse.headers);
      upstreamResponse.pipe(response);
    });

    upstream.on("error", (error) => {
      response.statusCode = 502;
      response.end(error.message);
    });

    request.pipe(upstream);
  });
  return new Promise((resolve, reject) => {
    customDomainProxy.once("error", reject);
    customDomainProxy.listen(proxyPort, "127.0.0.1", () => {
      customDomainProxy.off("error", reject);
      resolve();
    });
  });
}

async function expectOneFooter(page, expectedText, absentText) {
  try {
    await page.waitForSelector("footer");
  } catch (error) {
    const bodyText = await page.locator("body").innerText({ timeout: 5000 }).catch(() => "");
    throw new Error(`Footer not found at ${page.url()}. Body excerpt: ${bodyText.slice(0, 500)}`, { cause: error });
  }
  const footerCount = await page.locator("footer").count();
  if (footerCount !== 1) throw new Error(`Expected one footer, found ${footerCount}`);
  if (expectedText) await page.locator("footer").filter({ hasText: expectedText }).waitFor();
  if (absentText && await page.locator("footer", { hasText: absentText }).count()) {
    throw new Error(`Footer unexpectedly contained ${absentText}`);
  }
}

function trackPageDiagnostics(page, diagnostics) {
  page.on("requestfailed", (request) => {
    diagnostics.failedRequests.push(`${request.method()} ${request.url()} ${request.failure()?.errorText || ""}`.trim());
  });
  page.on("response", (response) => {
    if (response.status() >= 400) {
      diagnostics.errorResponses.push(`${response.status()} ${response.url()}`);
    }
  });
}

async function gotoSettled(page, url) {
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
}

function isIgnorableLocalAuthConsoleError(message) {
  return message.includes("ClientFetchError: Failed to fetch") &&
    message.includes("next-auth");
}

async function main() {
  let databaseUrl = "";
  try {
    databaseUrl = createDockerDatabase();
    const appPort = getFreePort();
    const customProxyPort = getFreePort();
    const env = buildEnv(databaseUrl);
    logDatabaseIdentity("migration", databaseUrl);
    runPnpm(["prisma", "migrate", "deploy"], env);
    logDatabaseIdentity("seed", databaseUrl);
    seed(env);
    verifySeed(env, "before-next-a", tenantA);
    verifySeed(env, "before-next-b", tenantB);
    startNext({ ...env, PORT: String(appPort), HOSTNAME: "127.0.0.1" }, appPort);
    await startCustomDomainForwarder({ appPort, proxyPort: customProxyPort });
    const baseUrl = `http://127.0.0.1:${appPort}`;
    await waitForApp(`${baseUrl}/fa`);
    verifySeed(env, "after-next-a", tenantA);
    verifySeed(env, "after-next-b", tenantB);
    const apiCheck = await fetch(`${baseUrl}/api/public/organizations/${tenantB}/shop`, { signal: AbortSignal.timeout(60000) });
    const apiText = await apiCheck.text();
    console.log(`public shop API check: status=${apiCheck.status} body=${apiText.slice(0, 240)}`);

    if (!apiCheck.ok) throw new Error(`Public shop API check failed: status=${apiCheck.status} body=${apiText.slice(0, 500)}`);

    const customProxyCheck = await fetch(`http://127.0.0.1:${customProxyPort}/`, {
      redirect: "manual",
      signal: AbortSignal.timeout(60000),
    });
    const customProxyText = await customProxyCheck.text();
    console.log(
      `custom-domain proxy check: status=${customProxyCheck.status} location=${customProxyCheck.headers.get("location") || ""} body=${customProxyText.slice(0, 240)}`,
    );
    if (customProxyCheck.status >= 500) {
      throw new Error(`Custom-domain proxy check failed: status=${customProxyCheck.status} body=${customProxyText.slice(0, 500)}`);
    }

    browser = await chromium.launch({
      headless: true,
      executablePath: process.platform === "win32" ? "C:/Program Files/Google/Chrome/Application/chrome.exe" : undefined,
    });
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    page.setDefaultNavigationTimeout(90000);
    page.setDefaultTimeout(90000);
    const consoleErrors = [];
    const diagnostics = { failedRequests: [], errorResponses: [] };
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    trackPageDiagnostics(page, diagnostics);

    await gotoSettled(page, `${baseUrl}/fa`);
    await expectOneFooter(page, null, "Footer Tenant Alpha");
    if (await page.locator('footer a[href="/fa/features"]').count() !== 1) {
      throw new Error("Platform footer did not render expected platform navigation.");
    }

    await gotoSettled(page, `${baseUrl}/fa/shop/${tenantB}`);
    await expectOneFooter(page, "Footer Tenant Beta", "Footer Tenant Alpha");

    await gotoSettled(page, `${baseUrl}/fa/shop/${tenantB}/product/beta-product-${stamp}`);
    await expectOneFooter(page, "Footer Tenant Beta", "Footer Tenant Alpha");

    await gotoSettled(page, `${baseUrl}/fa/shop/${tenantB}/category/beta-category-${stamp}`);
    await expectOneFooter(page, "Footer Tenant Beta", "Footer Tenant Alpha");

    customContext = await browser.newContext({
      baseURL: `http://127.0.0.1:${customProxyPort}`,
      viewport: { width: 390, height: 844 },
    });
    const customPage = await customContext.newPage();
    customPage.setDefaultNavigationTimeout(90000);
    customPage.setDefaultTimeout(90000);
    customPage.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    trackPageDiagnostics(customPage, diagnostics);
    await gotoSettled(customPage, "/");
    await expectOneFooter(customPage, "Footer Tenant Alpha", "Footer Tenant Beta");
    const customFooterLinks = await customPage.locator("footer a").evaluateAll((links) => links.map((link) => link.getAttribute("href")));
    if (!customFooterLinks.includes("/") || !customFooterLinks.includes("/checkout")) {
      throw new Error(`Custom-domain footer links were not tenant-root relative: ${customFooterLinks.join(", ")}`);
    }

    const actionableConsoleErrors = consoleErrors.filter((message) => !isIgnorableLocalAuthConsoleError(message));
    if (consoleErrors.length !== actionableConsoleErrors.length) {
      console.log(`ignored local auth console noise: ${consoleErrors.length - actionableConsoleErrors.length}`);
    }
    if (actionableConsoleErrors.length > 0) {
      throw new Error(
        [
          `Console errors detected: ${actionableConsoleErrors.join(" | ")}`,
          `Failed requests: ${diagnostics.failedRequests.join(" | ") || "none"}`,
          `Error responses: ${diagnostics.errorResponses.join(" | ") || "none"}`,
        ].join("\n"),
      );
    }
    await customContext.close();
    await browser.close();
    console.log("Public footer local Docker E2E passed.");
  } catch (error) {
    const nextLogTail = readNextLogTail();
    if (nextLogTail) console.error(`Local Next.js log tail:\n${nextLogTail}`);
    throw error;
  } finally {
    if (customContext) await customContext.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});
    cleanup();
  }
}

main().catch((error) => {
  cleanup();
  console.error(error);
  process.exit(1);
});
