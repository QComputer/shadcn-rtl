#!/usr/bin/env node
import "dotenv/config";
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";

const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
const containerName = `bazar-baz-shop-filter-${stamp}`;
const databaseName = `bazar_baz_shop_filter_${stamp}`;
const shopSlug = `filter-shop-${stamp}`;
const customHost = "cafechakme.lvh.me";
let nextProcess = null;

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
  if (process.env.npm_execpath) {
    run(process.execPath, [process.env.npm_execpath, ...args], env);
    return;
  }
  const corepackPnpm = path.join(path.dirname(process.execPath), "node_modules", "corepack", "dist", "pnpm.js");
  if (process.platform === "win32" && fs.existsSync(corepackPnpm)) {
    run(process.execPath, [corepackPnpm, ...args], env);
    return;
  }
  run("pnpm", args, env);
}

function capture(name, args, opts = {}) {
  const result = spawnSync(name, args, { encoding: "utf8", ...opts });
  if (result.status !== 0) throw new Error(`${name} ${args.join(" ")} failed: ${result.stderr || result.stdout}`);
  return result.stdout.trim();
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
  if (!port) throw new Error("Unable to determine disposable Postgres port");

  for (let attempt = 0; attempt < 60; attempt += 1) {
    const ready = spawnSync("docker", ["exec", containerName, "pg_isready", "-U", "postgres", "-d", databaseName], { stdio: "ignore" });
    if (ready.status === 0) {
      return `postgresql://postgres:postgres@127.0.0.1:${port}/${databaseName}?schema=public`;
    }
    sleep(500);
  }
  throw new Error("Disposable Postgres did not become ready");
}

function cleanupDockerDatabase() {
  spawnSync("docker", ["rm", "-f", containerName], { stdio: "ignore" });
}

function buildEnv(databaseUrl) {
  if (!/127\.0\.0\.1|localhost/.test(databaseUrl) || /neon|render|onrender/i.test(databaseUrl)) {
    throw new Error("Refusing to run shop filter E2E against non-local database.");
  }
  return {
    ...process.env,
    DATABASE_URL: databaseUrl,
    DIRECT_URL: databaseUrl,
    NODE_ENV: "production",
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
    AI_MEDIA_LOCAL_DOCKER_E2E: "1",
    AI_MEDIA_APPLICATION_STORAGE_ADAPTER: "local-test",
    AI_MEDIA_LOCAL_STORAGE_ROOT: path.join(process.cwd(), ".tmp", "shop-in-page-category-filter", "storage"),
    NODE_OPTIONS: [process.env.NODE_OPTIONS, "--require=./scripts/e2e/register-server-only.cjs"].filter(Boolean).join(" "),
  };
}

function seedShop(env) {
  fs.mkdirSync(path.join(process.cwd(), ".tmp", "shop-in-page-category-filter"), { recursive: true });
  const script = `
    import { PrismaClient } from "@prisma/client";
    const prisma = new PrismaClient();
    const orgId = "org_shop_filter_${stamp}";
    const categories = [
      { id: "cat_pizza_${stamp}", name: "پیتزا", slug: "پیتزا-${stamp}" },
      { id: "cat_drinks_${stamp}", name: "نوشیدنی", slug: "نوشیدنی-${stamp}" },
      { id: "cat_ar_${stamp}", name: "مشروبات", slug: "مشروبات-${stamp}" },
      { id: "cat_en_${stamp}", name: "Dessert", slug: "dessert-${stamp}" }
    ];
    await prisma.organization.create({
      data: {
        id: orgId,
        type: "SHOP",
        locale: "fa",
        timezone: "Asia/Tehran",
        name: "Filter Test Shop",
        slug: ${JSON.stringify(shopSlug)},
        description: "Disposable shop for in-page category filter E2E",
        isActive: true,
        isOpen: true
      }
    });
    await prisma.organizationSettings.create({
      data: {
        organizationSlug: ${JSON.stringify(shopSlug)},
        currency: "IRR",
        enablePickup: true,
        enableDelivery: true
      }
    });
    await prisma.organizationDomain.create({
      data: {
        organizationId: orgId,
        domain: ${JSON.stringify(customHost)},
        normalizedDomain: ${JSON.stringify(customHost)},
        status: "ACTIVE",
        isPrimary: false,
        providerVerified: true,
        dnsConfigured: true,
        sslReady: true,
        activatedAt: new Date()
      }
    });
    for (const [index, category] of categories.entries()) {
      await prisma.productCategory.create({
        data: {
          ...category,
          organizationId: orgId,
          organizationSlug: ${JSON.stringify(shopSlug)},
          sortOrder: 100 - index
        }
      });
    }
    const products = [
      { id: "prod_margherita_${stamp}", name: "پیتزا مارگاریتا", slug: "margherita-${stamp}", categoryId: categories[0].id, sortOrder: 40, price: 410000 },
      { id: "prod_pepperoni_${stamp}", name: "پیتزا پپرونی", slug: "pepperoni-${stamp}", categoryId: categories[0].id, sortOrder: 30, price: 450000 },
      { id: "prod_juice_${stamp}", name: "آب پرتقال", slug: "juice-${stamp}", categoryId: categories[1].id, sortOrder: 20, price: 150000 },
      { id: "prod_ar_${stamp}", name: "عصير تفاح", slug: "apple-juice-${stamp}", categoryId: categories[2].id, sortOrder: 10, price: 160000 },
      { id: "prod_cake_${stamp}", name: "Chocolate Cake", slug: "cake-${stamp}", categoryId: categories[3].id, sortOrder: 5, price: 180000 }
    ];
    for (const item of products) {
      await prisma.product.create({
        data: {
          id: item.id,
          name: item.name,
          slug: item.slug,
          description: item.name,
          basePrice: item.price,
          image: null,
          trackInventory: false,
          sortOrder: item.sortOrder,
          isActive: true,
          organizationId: orgId,
          organizationSlug: ${JSON.stringify(shopSlug)},
          categoryId: item.categoryId,
          variants: {
            create: {
              id: item.id.replace("prod_", "var_"),
              name: "Default",
              sku: item.id,
              price: item.price,
              inventory: 10
            }
          }
        }
      });
    }
    await prisma.product.create({
      data: {
        id: "prod_hidden_${stamp}",
        name: "Hidden Product",
        basePrice: 1000,
        trackInventory: false,
        isActive: false,
        organizationId: orgId,
        organizationSlug: ${JSON.stringify(shopSlug)},
        categoryId: categories[0].id
      }
    });
    await prisma.$disconnect();
  `;
  const seedFile = path.join(process.cwd(), ".tmp", "shop-in-page-category-filter", `seed-${stamp}.mts`);
  fs.writeFileSync(seedFile, script, "utf8");
  runPnpm(["exec", "tsx", seedFile], env);
}

function verifyShop(env, label) {
  fs.mkdirSync(path.join(process.cwd(), ".tmp", "shop-in-page-category-filter"), { recursive: true });
  const script = `
    import { PrismaClient } from "@prisma/client";
    const prisma = new PrismaClient();
    const organization = await prisma.organization.findFirst({
      where: { slug: ${JSON.stringify(shopSlug)}, type: "SHOP", isActive: true, deletedAt: null },
      select: {
        slug: true,
        type: true,
        isActive: true,
        isOpen: true,
        products: { select: { name: true, isActive: true, categoryId: true }, orderBy: { sortOrder: "desc" } },
        productCategories: { select: { name: true, slug: true }, orderBy: { sortOrder: "desc" } },
        domains: { select: { normalizedDomain: true, status: true, isPrimary: true } }
      }
    });
    console.log(JSON.stringify({
      found: Boolean(organization),
      slug: organization?.slug || null,
      type: organization?.type || null,
      isActive: organization?.isActive ?? null,
      isOpen: organization?.isOpen ?? null,
      categories: organization?.productCategories?.map((category) => category.name) || [],
      products: organization?.products?.map((product) => ({ name: product.name, isActive: product.isActive, categoryId: product.categoryId })) || [],
      domains: organization?.domains || []
    }));
    await prisma.$disconnect();
  `;
  const verifyFile = path.join(process.cwd(), ".tmp", "shop-in-page-category-filter", `verify-${label}-${stamp}.mts`);
  fs.writeFileSync(verifyFile, script, "utf8");
  runPnpm(["exec", "tsx", verifyFile], env);
}

async function waitForApp(baseUrl) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(baseUrl);
      if (response.status < 500) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error("Local Next.js app did not become ready");
}

function startNext(env) {
  fs.mkdirSync(path.join(process.cwd(), ".tmp", "shop-in-page-category-filter"), { recursive: true });
  const out = fs.openSync(path.join(process.cwd(), ".tmp", "shop-in-page-category-filter", "next.log"), "a");
  const command = process.env.npm_execpath
    ? { name: process.execPath, args: [process.env.npm_execpath, "exec", "next", "start", "-p", String(env.APP_PORT), "-H", "127.0.0.1"] }
    : { name: process.execPath, args: [path.join(path.dirname(process.execPath), "node_modules", "corepack", "dist", "pnpm.js"), "exec", "next", "start", "-p", String(env.APP_PORT), "-H", "127.0.0.1"] };
  nextProcess = spawn(command.name, command.args, {
    env,
    stdio: ["ignore", out, out],
    shell: false,
  });
}

function stopNext() {
  if (!nextProcess?.pid) return;
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(nextProcess.pid), "/T", "/F"], { stdio: "ignore" });
  } else {
    nextProcess.kill();
  }
}

async function assertVisibleProducts(page, expectedVisible, expectedHidden) {
  for (const name of expectedVisible) {
    try {
      await page.getByText(name, { exact: false }).first().waitFor({ state: "visible", timeout: 30000 });
    } catch (error) {
      const bodyText = await page.locator("body").innerText({ timeout: 5000 }).catch(() => "");
      throw new Error(`Expected visible product ${name} at ${page.url()}. Body excerpt: ${bodyText.slice(0, 1000)}`, { cause: error });
    }
  }
  for (const name of expectedHidden) {
    const count = await page.getByText(name, { exact: false }).count();
    if (count !== 0) throw new Error(`Expected ${name} to be hidden, but found ${count} matches`);
  }
}

async function runBrowserFlow(baseUrl, label) {
  const browser = await chromium.launch({
    headless: true,
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    args: ["--disable-features=HttpsFirstBalancedModeAutoEnable,HttpsUpgrades"],
  });
  const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
  const consoleErrors = [];
  const failedRequests = [];
  const errorResponses = [];
  const categoryRequests = [];
  page.on("console", (message) => {
    const text = message.text();
    if (
      message.type() === "error"
      && !text.includes("Cross-Origin-Opener-Policy header has been ignored")
      && !text.includes("Failed to load resource: the server responded with a status of 404 (Not Found)")
    ) {
      consoleErrors.push(text);
    }
  });
  page.on("pageerror", (error) => {
    consoleErrors.push(error.message);
  });
  page.on("request", (request) => {
    const url = request.url();
    if (url.includes("/category/")) categoryRequests.push(url);
  });
  page.on("requestfailed", (request) => {
    const failure = { url: request.url(), error: request.failure()?.errorText || "" };
    failedRequests.push(failure);
  });
  page.on("response", (response) => {
    if (response.status() >= 400) {
      errorResponses.push({ url: response.url(), status: response.status() });
    }
  });

  const response = await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
  if (!response?.ok()) throw new Error(`${label}: root returned ${response?.status()}`);
  await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
  const initialPathname = new URL(page.url()).pathname;
  await assertVisibleProducts(page, ["پیتزا مارگاریتا", "پیتزا پپرونی", "آب پرتقال", "عصير تفاح", "Chocolate Cake"], ["Hidden Product"]);

  await page.getByRole("button", { name: /پیتزا/ }).first().click();
  if (new URL(page.url()).pathname !== initialPathname) throw new Error(`${label}: pathname stays unchanged after Persian category click`);
  await assertVisibleProducts(page, ["پیتزا مارگاریتا", "پیتزا پپرونی"], ["آب پرتقال", "عصير تفاح", "Chocolate Cake"]);

  await page.getByRole("button", { name: /نوشیدنی/ }).first().click();
  if (new URL(page.url()).pathname !== initialPathname) throw new Error(`${label}: pathname stays unchanged after second category click`);
  await assertVisibleProducts(page, ["آب پرتقال"], ["پیتزا مارگاریتا", "عصير تفاح", "Chocolate Cake"]);

  await page.getByRole("button", { name: /مشروبات/ }).first().click();
  await assertVisibleProducts(page, ["عصير تفاح"], ["پیتزا مارگاریتا", "آب پرتقال", "Chocolate Cake"]);

  await page.getByRole("button", { name: /Dessert/ }).first().click();
  await assertVisibleProducts(page, ["Chocolate Cake"], ["پیتزا مارگاریتا", "آب پرتقال", "عصير تفاح"]);

  await page.getByRole("button", { name: /All products|همه محصولات|كل المنتجات/ }).first().click();
  if (new URL(page.url()).pathname !== initialPathname) throw new Error(`${label}: pathname stays unchanged after all-products click`);
  await assertVisibleProducts(page, ["پیتزا مارگاریتا", "پیتزا پپرونی", "آب پرتقال", "عصير تفاح", "Chocolate Cake"], ["Hidden Product"]);

  const href = await page.locator("a[href*='/product/']").first().getAttribute("href");
  if (!href || !href.includes("/product/")) throw new Error(`${label}: product card link missing`);
  if (categoryRequests.length > 0) throw new Error(`${label}: normal category click generated category requests: ${categoryRequests.join(", ")}`);
  const actionableFailedRequests = failedRequests.filter((request) => !(request.error === "net::ERR_ABORTED" && request.url.includes("_rsc=")));
  if (actionableFailedRequests.length > 0) throw new Error(`${label}: failed requests: ${JSON.stringify(actionableFailedRequests)}`);
  const actionableErrorResponses = errorResponses.filter((response) => (
    !response.url.includes("/favicon.ico")
    && !(response.status === 404 && response.url.includes("/fa/login") && response.url.includes("_rsc="))
  ));
  if (actionableErrorResponses.length > 0) throw new Error(`${label}: error responses: ${JSON.stringify(actionableErrorResponses)}`);
  if (consoleErrors.length > 0) throw new Error(`${label}: console errors: ${consoleErrors.join(" | ")}`);
  await browser.close();
}

async function verifyLegacyCategory(baseUrl, segment) {
  const browser = await chromium.launch({
    headless: true,
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    args: ["--disable-features=HttpsFirstBalancedModeAutoEnable,HttpsUpgrades"],
  });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const response = await page.goto(`${baseUrl}/category/${encodeURIComponent(segment)}`, { waitUntil: "domcontentloaded", timeout: 60000 });
  if (!response?.ok()) throw new Error(`legacy category route returned ${response?.status()}`);
  await page.getByText("پیتزا مارگاریتا", { exact: false }).first().waitFor({ state: "visible", timeout: 10000 });
  await page.reload({ waitUntil: "domcontentloaded", timeout: 60000 });
  await page.getByText("پیتزا مارگاریتا", { exact: false }).first().waitFor({ state: "visible", timeout: 10000 });
  await browser.close();
}

export async function main() {
try {
  console.log("Shop in-page category filter local Docker E2E starting.");
  const databaseUrl = createDockerDatabase();
  const appPort = getFreePort();
  const env = buildEnv(databaseUrl);
  env.APP_PORT = String(appPort);
  runPnpm(["exec", "prisma", "migrate", "deploy", "--schema=prisma/schema.prisma"], env);
  seedShop(env);
  verifyShop(env, "before-next");
  runPnpm(["exec", "next", "build"], env);
  startNext(env);
  await waitForApp(`http://127.0.0.1:${appPort}/fa`);
  verifyShop(env, "after-next");
  const apiCheck = await fetch(`http://127.0.0.1:${appPort}/api/public/organizations/${shopSlug}/shop`, { signal: AbortSignal.timeout(60000) });
  const apiText = await apiCheck.text();
  console.log(`public shop API check: status=${apiCheck.status} body=${apiText.slice(0, 500)}`);
  if (!apiCheck.ok) throw new Error(`Public shop API check failed: status=${apiCheck.status} body=${apiText.slice(0, 1000)}`);

  await runBrowserFlow(`http://127.0.0.1:${appPort}/fa/shop/${shopSlug}`, "platform");
  await runBrowserFlow(`http://${customHost}:${appPort}/`, "custom-domain");
  await verifyLegacyCategory(`http://${customHost}:${appPort}`, `پیتزا-${stamp}`);

  console.log("Shop in-page category filter local Docker E2E passed.");
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  const nextLogPath = path.join(process.cwd(), ".tmp", "shop-in-page-category-filter", "next.log");
  if (fs.existsSync(nextLogPath)) {
    console.error("\n--- local Next.js log ---");
    console.error(fs.readFileSync(nextLogPath, "utf8").slice(-6000));
  }
  process.exitCode = 1;
} finally {
  stopNext();
  cleanupDockerDatabase();
  try { fs.rmSync(path.join(process.cwd(), ".tmp", "shop-in-page-category-filter"), { recursive: true, force: true }); } catch {}
}
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.stack || error.message : error);
    process.exit(1);
  });
}
