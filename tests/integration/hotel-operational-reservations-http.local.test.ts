import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { once } from "node:events";
import { createServer } from "node:net";
import { request as httpRequest } from "node:http";
import { spawn, type ChildProcess } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { test } from "node:test";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { chromium, type Page } from "playwright";

const enabled = process.env.HOTEL_OPERATIONAL_RESERVATIONS_HTTP_ACCEPTANCE === "1";
const loopback = "127.0.0.1";
const port = 3037;
const baseUrl = `http://${loopback}:${port}`;
const suffix = randomUUID().replaceAll("-", "").slice(0, 14);
const prefix = `hotel-operational-http-${suffix}`;
const hostA = `hotel-operational-a-${suffix}.localhost`;
const hostB = `hotel-operational-b-${suffix}.localhost`;
const originA = `http://${hostA}:${port}`;
const originB = `http://${hostB}:${port}`;
const customerName = `${prefix}-customer`;
const customerPassword = `Fixture-${randomUUID()}-${randomUUID()}`;
const resultDirectory = join(process.cwd(), ".tmp", "hotel-operational-reservations");
const resultPath = join(resultDirectory, "http.result.json");
const browserFailureDirectory = join(resultDirectory, "browser-failure");

let stage = "not-started";
let passed = false;
let cleanupPassed = false;
let serverStopped = true;
let browserStopped = true;
let browserPassed = false;
let bufferedServerLog = "";
let browserFailureEvidence: { urlPath: string; title: string; bodyText: string; screenshot: string; serverErrorCategories: Record<string, number> } | null = null;

if (enabled) process.on("exit", () => {
  const exitCode = process.exitCode ?? (passed && cleanupPassed ? 0 : 1);
  const ok = exitCode === 0 && passed && cleanupPassed && serverStopped && browserStopped && browserPassed;
  try {
    mkdirSync(resultDirectory, { recursive: true });
    writeFileSync(resultPath, `${JSON.stringify({
      test: "hotel-operational-reservations-http.local.test.ts",
      status: ok ? "PASSED" : "FAILED",
      exitCode,
      stage,
      database: { host: loopback, port: 55439, database: "retail_hero_test", role: "hero_test" },
      server: { port, stopped: serverStopped, logCapturedChars: bufferedServerLog.length },
      browser: { channel: "chrome", status: browserPassed ? "PASSED" : "FAILED", stopped: browserStopped },
      browserFailureEvidence,
      cleanup: cleanupPassed && serverStopped && browserStopped ? "PASSED" : "FAILED",
    }, null, 2)}\n`, "utf8");
  } catch { process.exitCode = 1; }
});

function guardedConnection() {
  assert.notEqual(process.env.NODE_ENV, "production");
  assert.notEqual(process.env.VERCEL_ENV, "production");
  assert.ok(!process.env.VERCEL, "hosted execution is forbidden");
  assert.equal(process.env.HOTEL_GUEST_PORTAL_ENABLED, "1");
  assert.notEqual(process.env.HOTEL_CRON_SCHEDULER_ENABLED, "1");
  assert.equal(process.env.DATABASE_RUNTIME_ADAPTER, "postgresql");
  assert.equal(process.env.LOCAL_PRISMA_EXPECTED_PORT, "55439");
  assert.equal(process.env.RETAIL_HERO_EXPECTED_DATABASE, "retail_hero_test");
  const url = new URL(process.env.DATABASE_URL ?? "https://missing.invalid");
  assert.ok(["postgres:", "postgresql:"].includes(url.protocol));
  assert.equal(url.hostname, loopback);
  assert.equal(url.port, "55439");
  assert.equal(url.pathname, "/retail_hero_test");
  assert.equal(decodeURIComponent(url.username), "hero_test");
  assert.equal(decodeURIComponent(url.password), "local_admin_fixture_only");
  assert.equal(url.search, "");
  assert.equal(url.hash, "");
  assert.equal(process.env.DIRECT_URL, url.toString());
  assert.match(prefix, /^hotel-operational-/);
  return url;
}

function isolatedServerEnv(databaseUrl: string): NodeJS.ProcessEnv {
  const allowed = ["PATH", "PATHEXT", "SystemRoot", "SYSTEMROOT", "windir", "ComSpec", "TEMP", "TMP", "USERPROFILE", "APPDATA", "LOCALAPPDATA"];
  const env = Object.fromEntries(allowed.flatMap(key => process.env[key] === undefined ? [] : [[key, process.env[key]]])) as NodeJS.ProcessEnv;
  Object.assign(env, {
    DATABASE_URL: databaseUrl,
    DIRECT_URL: databaseUrl,
    LOCAL_PRISMA_EXPECTED_PORT: "55439",
    RETAIL_HERO_EXPECTED_DATABASE: "retail_hero_test",
    DATABASE_RUNTIME_ADAPTER: "postgresql",
    NODE_ENV: "development",
    NEXT_TELEMETRY_DISABLED: "1",
    NEXTAUTH_URL: baseUrl,
    NEXTAUTH_URL_INTERNAL: baseUrl,
    NEXTAUTH_SECRET: "isolated-p0-fixture-only-long-secret-20261111",
    CUSTOMER_PHONE_AUTH_ENABLED: "1",
    CUSTOMER_SSO_ENABLED: "1",
    HOTEL_GUEST_PORTAL_ENABLED: "1",
    HOTEL_OPERATIONAL_RESERVATIONS_ENABLED: "1",
    HOTEL_BOOKING_OPERATIONAL_ENABLED: "0",
    HOTEL_CRON_SCHEDULER_ENABLED: "0",
    AUTH_TRUST_HOST: "true",
    NEXT_PUBLIC_APP_URL: baseUrl,
    NEXT_PUBLIC_DEPLOYED_APP_URL: baseUrl,
    BAZAR_BAZ_PLATFORM_HOSTS: "localhost,127.0.0.1",
    SMS_PROVIDER: "DRY_RUN",
    SMS_DRY_RUN: "true",
    SMS_REAL_SEND_ENABLED: "false",
    SMS_GUEST_REAL_SEND_ENABLED: "false",
    EMAIL_PROVIDER: "DRY_RUN",
    EMAIL_REAL_SEND_ENABLED: "false",
    CUSTOM_DOMAIN_PROVIDER_ENABLED: "false",
    CUSTOM_DOMAIN_REAL_MUTATION_ENABLED: "false",
    VERCEL_DOMAIN_AUTOMATION_DRY_RUN: "true",
    RUNFLARE_DOMAIN_AUTOMATION_DRY_RUN: "true",
    WEB_PUSH_ENABLED: "false",
    WEB_PUSH_REAL_SEND_ENABLED: "false",
    BLOB_READ_WRITE_TOKEN: "",
    VERCEL_API_TOKEN: "",
    VERCEL_ACCESS_TOKEN: "",
    STRIPE_SECRET_KEY: "",
    STRIPE_WEBHOOK_SECRET: "",
    NODE_OPTIONS: `--require=${join(process.cwd(), "scripts/dev/isolated-next-env.cjs").replaceAll("\\", "/")}`,
  });
  return env;
}

async function assertPortFree() {
  await new Promise<void>((resolve, reject) => {
    const probe = createServer();
    probe.once("error", reject);
    probe.listen(port, loopback, () => probe.close(error => error ? reject(error) : resolve()));
  });
}

async function request(path: string, host: string, origin?: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("host", `${host}:${port}`);
  if (origin) headers.set("origin", origin);
  return new Promise<Response>((resolve, reject) => {
    const outgoing = httpRequest({ hostname: loopback, port, path, method: init.method ?? "GET", headers: Object.fromEntries(headers) }, incoming => {
      const chunks: Buffer[] = [];
      incoming.on("data", chunk => chunks.push(Buffer.from(chunk)));
      incoming.on("end", () => {
        const responseHeaders = new Headers();
        for (let index = 0; index < incoming.rawHeaders.length; index += 2) responseHeaders.append(incoming.rawHeaders[index]!, incoming.rawHeaders[index + 1]!);
        resolve(new Response(Buffer.concat(chunks), { status: incoming.statusCode, headers: responseHeaders }));
      });
      incoming.on("error", reject);
    });
    outgoing.on("error", reject);
    if (init.body !== undefined && init.body !== null) outgoing.write(String(init.body));
    outgoing.end();
  });
}

function setCookies(response: Response) {
  return (response.headers.getSetCookie?.() ?? [response.headers.get("set-cookie") ?? ""])
    .flatMap(value => value.split(/,(?=[^;]+=[^;]+)/))
    .map(value => value.split(";", 1)[0]!)
    .filter(Boolean);
}
const cookieHeader = (cookies: string[]) => cookies.join("; ");
function mergeCookies(existing: string[], response: Response) {
  const values = new Map(existing.map(cookie => [cookie.split("=", 1)[0]!, cookie]));
  for (const cookie of setCookies(response)) values.set(cookie.split("=", 1)[0]!, cookie);
  return [...values.values()];
}

async function passwordLogin(host: string, origin: string, username: string, password: string) {
  const csrf = await request("/api/auth/csrf", host);
  assert.equal(csrf.status, 200);
  const initialCookies = setCookies(csrf);
  const { csrfToken } = await csrf.json() as { csrfToken: string };
  const callback = await request("/api/auth/callback/credentials?json=true", host, origin, {
    method: "POST", redirect: "manual",
    headers: { cookie: cookieHeader(initialCookies), "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ csrfToken, callbackUrl: origin, username, password }),
  });
  const cookies = mergeCookies(initialCookies, callback);
  const sessionResponse = await request("/api/auth/session", host, undefined, { headers: { cookie: cookieHeader(cookies) } });
  assert.equal(sessionResponse.status, 200);
  return { callback, cookies, session: await sessionResponse.json() as { user?: { id?: string; role?: string; organizationId?: string | null } } };
}

async function apiJson<T>(path: string, host: string, origin: string | undefined, cookie: string, method = "GET", body?: unknown, key?: string) {
  const response = await request(path, host, method === "GET" ? undefined : origin, {
    method,
    headers: { cookie, ...(body === undefined ? {} : { "content-type": "application/json" }), ...(key ? { "idempotency-key": key } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const raw = await response.text();
  let data: T | null = null;
  if (raw) { try { data = JSON.parse(raw) as T; } catch { /* assertions report the HTTP status without response secrets */ } }
  return { response, data };
}

function browserCookies(cookies: string[], origin: string) {
  return cookies.map(value => {
    const separator = value.indexOf("=");
    return { name: value.slice(0, separator), value: value.slice(separator + 1), url: origin };
  }).filter(value => value.name && value.value);
}

async function waitForServer(server: ChildProcess) {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error("isolated Next server exited before readiness");
    try { if ((await request("/api/auth/csrf", hostA)).status === 200) return; }
    catch { /* waiting for the isolated Next server */ }
    await delay(500);
  }
  throw new Error("isolated Next server did not become ready in 120 seconds");
}

async function stopServer(server?: ChildProcess) {
  if (!server || server.exitCode !== null || server.signalCode !== null) return true;
  const stopped = once(server, "exit").then(() => true);
  server.kill();
  if (await Promise.race([stopped, delay(10_000).then(() => false)])) return true;
  server.kill("SIGKILL");
  return await Promise.race([stopped, delay(5_000).then(() => false)]);
}

function serverErrorCategories(log: string) {
  const rules: Record<string, RegExp> = {
    jwt: /jwt|jwe|decryption|invalid.?token/gi,
    auth: /auth|session|credential/gi,
    nextError: /\berror\b|uncaught|unhandled/gi,
    compilation: /compile|module not found|build failed/gi,
    database: /prisma|postgres|database|connection refused/gi,
  };
  return Object.fromEntries(Object.entries(rules).map(([name, pattern]) => [name, [...log.matchAll(pattern)].length]));
}

function scrubVisibleText(value: string) {
  return value.slice(0, 12_000)
    .replace(/\b[A-Za-z0-9_-]{80,}\b/g, "[redacted-long-token]")
    .replace(/(cookie|token|authorization|password)\s*[:=]\s*[^\s,;]+/gi, "$1=[redacted]");
}

test("operational Hotel reservation UI creates a pending-payment booking and isolates tenant sessions", {
  skip: !enabled,
  concurrency: false,
}, async () => {
  stage = "fixture-guard";
  const connection = guardedConnection();
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: connection.toString(), max: 8 }), log: [] });
  const orgIds: string[] = [];
  const domainOrgIds: string[] = [];
  const userIds: string[] = [];
  const propertyIds: string[] = [];
  const policyIds: string[] = [];
  const roomTypeIds: string[] = [];
  const ratePlanIds: string[] = [];
  let server: ChildProcess | undefined;
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  let guestPage: Page | undefined;
  const browserErrors: string[] = [];
  const ownedReservationIds: string[] = [];
  const ownedQuoteIds: string[] = [];

  try {
    stage = "database-identity-guard";
    const identity = await db.$queryRaw<Array<{ database: string; role: string; port: number }>>`SELECT current_database()::text AS database,current_user::text AS role,inet_server_port() AS port`;
    assert.deepEqual(identity, [{ database: "retail_hero_test", role: "hero_test", port: 5432 }]);

    stage = "tenant-fixtures";
    const orgA = await db.organization.create({ data: { type: "SHOP", vertical: "HOTEL", name: `${prefix}-a`, slug: `${prefix}-a`, locale: "en", capabilitiesInitializedAt: new Date() } });
    orgIds.push(orgA.id);
    const orgB = await db.organization.create({ data: { type: "SHOP", vertical: "HOTEL", name: `${prefix}-b`, slug: `${prefix}-b`, locale: "en", capabilitiesInitializedAt: new Date() } });
    orgIds.push(orgB.id);
    await db.organizationCapability.createMany({ data: [orgA, orgB].map(org => ({ organizationId: org.id, key: "HOTEL_BOOKING", status: "ACTIVE" as const, enabledAt: new Date() })) });
    await db.organizationDomain.createMany({ data: [
      { organizationId: orgA.id, domain: hostA, normalizedDomain: hostA, status: "ACTIVE", providerVerified: true, dnsConfigured: true, sslReady: true, verifiedAt: new Date() },
      { organizationId: orgB.id, domain: hostB, normalizedDomain: hostB, status: "ACTIVE", providerVerified: true, dnsConfigured: true, sslReady: true, verifiedAt: new Date() },
    ] });
    domainOrgIds.push(orgA.id, orgB.id);

    stage = "same-user-two-tenant-fixture";
    const customer = await db.user.create({ data: { name: customerName, password: await bcrypt.hash(customerPassword, 10), role: "CUSTOMER", phone: `555${suffix.slice(0, 10)}`, isTeamMember: false } });
    userIds.push(customer.id);
    await db.customerClubMembership.createMany({ data: [orgA, orgB].map(org => ({ organizationId: org.id, customerId: customer.id, status: "ACTIVE" as const, source: "PUBLIC_SHOP" as const })) });

    const adminName = prefix + "-admin";
    const adminPassword = "Fixture-" + randomUUID();
    const admin = await db.user.create({ data: { name: adminName, password: await bcrypt.hash(adminPassword, 10), role: "ADMIN", isTeamMember: true } });
    userIds.push(admin.id);
    await db.organizationMember.create({ data: { organizationId: orgA.id, organizationSlug: orgA.slug, userId: admin.id, role: "ADMIN", isActive: true } });

    stage = "hotel-fixtures";
    const propertyA = await db.hotelProperty.create({ data: { organizationId: orgA.id, organizationSlug: orgA.slug, slug: `${prefix}-property-a`, name: `${prefix} Hotel A`, operationalMode: "RESERVATION", timezone: "UTC" } });
    const propertyB = await db.hotelProperty.create({ data: { organizationId: orgB.id, organizationSlug: orgB.slug, slug: `${prefix}-property-b`, name: `${prefix} Hotel B`, operationalMode: "RESERVATION", timezone: "UTC" } });
    propertyIds.push(propertyA.id, propertyB.id);
    const policyA = await db.hotelCancellationPolicy.create({ data: { organizationId: orgA.id, propertyId: propertyA.id, key: `${prefix}-flex-a`, name: "Fixture flexible", freeCancellationCutoffHours: 24, fullCancellationRetention: 0, version: 1 } });
    const policyB = await db.hotelCancellationPolicy.create({ data: { organizationId: orgB.id, propertyId: propertyB.id, key: `${prefix}-flex-b`, name: "Fixture flexible", freeCancellationCutoffHours: 24, fullCancellationRetention: 0, version: 1 } });
    policyIds.push(policyA.id, policyB.id);
    const roomA = await db.hotelRoomType.create({ data: { organizationId: orgA.id, propertyId: propertyA.id, slug: `${prefix}-room-a`, name: "Operational room A", maxAdults: 2, maxChildren: 2, maxOccupancy: 4, beds: [{ kind: "queen", count: 1 }], totalAllotment: 2 } });
    const roomB = await db.hotelRoomType.create({ data: { organizationId: orgB.id, propertyId: propertyB.id, slug: `${prefix}-room-b`, name: "Operational room B", maxAdults: 2, maxChildren: 2, maxOccupancy: 4, beds: [{ kind: "queen", count: 1 }], totalAllotment: 2 } });
    roomTypeIds.push(roomA.id, roomB.id);
    const planA = await db.hotelRatePlan.create({ data: { organizationId: orgA.id, propertyId: propertyA.id, roomTypeId: roomA.id, code: `${suffix}-FLEX-A`, name: "Fixture flexible A", baseNightlyRate: BigInt(125000), cancellationPolicyId: policyA.id } });
    const planB = await db.hotelRatePlan.create({ data: { organizationId: orgB.id, propertyId: propertyB.id, roomTypeId: roomB.id, code: `${suffix}-FLEX-B`, name: "Fixture flexible B", baseNightlyRate: BigInt(175000), cancellationPolicyId: policyB.id } });
    ratePlanIds.push(planA.id, planB.id);
    await db.hotelInventory.createMany({ data: [orgA, orgB].flatMap(org => ["2027-12-10", "2027-12-11"].map(date => ({
      organizationId: org.id, propertyId: org.id === orgA.id ? propertyA.id : propertyB.id,
      roomTypeId: org.id === orgA.id ? roomA.id : roomB.id, date: new Date(`${date}T00:00:00.000Z`), allotment: 2,
    }))) });

    stage = "isolated-server";
    await assertPortFree();
    server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "--webpack", "--hostname", loopback, "--port", String(port)], {
      cwd: process.cwd(), env: isolatedServerEnv(connection.toString()), stdio: ["ignore", "pipe", "pipe"], windowsHide: true,
    });
    // Keep server output bounded in memory for diagnosis and never echo it (it may contain fixture data).
    server.stdout?.on("data", chunk => { if (bufferedServerLog.length < 64_000) bufferedServerLog += Buffer.from(chunk).toString("utf8").slice(0, 64_000 - bufferedServerLog.length); });
    server.stderr?.on("data", chunk => { if (bufferedServerLog.length < 64_000) bufferedServerLog += Buffer.from(chunk).toString("utf8").slice(0, 64_000 - bufferedServerLog.length); });
    serverStopped = false;
    await waitForServer(server);

    stage = "same-user-two-tenant-password-login";
    const loginA = await passwordLogin(hostA, originA, customerName, customerPassword);
    const loginB = await passwordLogin(hostB, originB, customerName, customerPassword);
    assert.ok([200, 302].includes(loginA.callback.status));
    assert.ok([200, 302].includes(loginB.callback.status));
    assert.equal(loginA.session.user?.id, customer.id);
    assert.equal(loginB.session.user?.id, customer.id);
    assert.equal(loginA.session.user?.organizationId, orgA.id);
    assert.equal(loginB.session.user?.organizationId, orgB.id);
    const cookieA = cookieHeader(loginA.cookies);
    const cookieB = cookieHeader(loginB.cookies);
    const endpointA = `/api/organizations/${orgA.id}/hotels/${propertyA.id}/reservations`;
    const endpointB = `/api/organizations/${orgB.id}/hotels/${propertyB.id}/reservations`;

    stage = "cross-tenant-post-denial";
    const foreignPost = await apiJson(endpointA, hostA, originA, cookieB, "POST", {
      action: "quote", roomTypeId: roomA.id, ratePlanId: planA.id, checkIn: "2027-12-10", checkOut: "2027-12-12", adults: 1, childAges: [],
    }, `${prefix}-foreign-post-001`);
    assert.equal(foreignPost.response.status, 403, "the same account's tenant B session cannot post into tenant A");

    stage = "browser-guest-quote-hold-reserve";
    browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--no-sandbox"] });
    browserStopped = false;
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await context.addCookies(browserCookies(loginA.cookies, originA));
    const page = await context.newPage();
    guestPage = page;
    page.setDefaultNavigationTimeout(120_000);
    page.on("pageerror", error => browserErrors.push(error.name));
    await page.goto(`${originA}/en/hotel-reservations/${orgA.id}/${propertyA.id}?checkIn=2027-12-10&checkOut=2027-12-12&adults=1`, { waitUntil: "domcontentloaded" });
    const reservationsUi = page.getByRole("region", { name: "Hotel reservations" });
    await reservationsUi.getByRole("heading", { name: "Hotel reservations" }).waitFor({ state: "visible", timeout: 120_000 });
    assert.equal(await reservationsUi.getByLabel("Check-in").inputValue(), "2027-12-10");
    assert.equal(await reservationsUi.getByLabel("Check-out").inputValue(), "2027-12-12");
    assert.equal(await reservationsUi.getByLabel("Adults").inputValue(), "1");
    await reservationsUi.getByLabel("Room type").selectOption(roomA.id);
    await reservationsUi.getByLabel("Rate plan").selectOption(planA.id);
    await reservationsUi.getByRole("button", { name: "Get quote" }).click();
    await reservationsUi.getByText("250000 TOMAN", { exact: false }).waitFor({ state: "visible", timeout: 30_000 });
    const quoteRow = await db.hotelStayQuote.findFirstOrThrow({ where: { organizationId: orgA.id, propertyId: propertyA.id, userId: customer.id }, orderBy: { createdAt: "desc" } });
    ownedQuoteIds.push(quoteRow.id);
    await reservationsUi.getByRole("button", { name: "Place temporary hold" }).click();
    await reservationsUi.getByText("Hold expires:").waitFor({ state: "visible", timeout: 30_000 });
    await reservationsUi.getByLabel("Guest full name 1").fill(`${prefix} Primary Guest`);
    await reservationsUi.getByRole("button", { name: "Create reservation" }).click();
    const reference = await reservationsUi.getByText(/HT-/).first().textContent({ timeout: 30_000 });
    assert.ok(reference);
    await reservationsUi.getByText("Payment pending; payment has not been confirmed.").waitFor({ state: "visible", timeout: 30_000 });
    const created = await db.hotelReservation.findFirstOrThrow({ where: { organizationId: orgA.id, propertyId: propertyA.id, reference: { contains: "HT-" } }, orderBy: { createdAt: "desc" } });
    ownedReservationIds.push(created.id);
    assert.equal(created.status, "PENDING_PAYMENT");

    stage = "guest-own-history-and-foreign-read-denial";
    const ownHistory = await apiJson<{ view: string; reservations: Array<{ id: string; status: string }> }>(endpointA, hostA, undefined, cookieA);
    assert.equal(ownHistory.response.status, 200);
    assert.equal(ownHistory.data?.view, "guest");
    assert.ok(ownHistory.data?.reservations.some(row => row.id === created.id && row.status === "PENDING_PAYMENT"));
    const foreignHistory = await apiJson(endpointA, hostA, undefined, cookieB);
    assert.equal(foreignHistory.response.status, 403, "tenant B session cannot read tenant A reservations");
    const tenantBHistory = await apiJson<{ view: string; reservations: Array<{ id: string }> }>(endpointB, hostB, undefined, cookieB);
    assert.equal(tenantBHistory.response.status, 200);
    assert.equal(tenantBHistory.data?.view, "guest");
    assert.deepEqual(tenantBHistory.data?.reservations, [], "the same account has separate reservation history per tenant");
    stage = "browser-reception-assignment-checkin-checkout";
    // Synthetic confirmed state exercises reception only; this is not payment/provider acceptance.
    await db.hotelReservation.update({ where: { id: created.id }, data: { status: "CONFIRMED", confirmedAt: new Date() } });
    const physical = await db.hotelRoom.create({ data: { organizationId: orgA.id, propertyId: propertyA.id, roomTypeId: roomA.id, code: "101-fixture" } });
    const adminLogin = await passwordLogin(hostA, originA, adminName, adminPassword);
    assert.equal(adminLogin.session.user?.role, "ADMIN");
    const receptionContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await receptionContext.addCookies(browserCookies(adminLogin.cookies, originA));
    const receptionPage = await receptionContext.newPage();
    await receptionPage.goto(originA + "/en/hotel-reservations/" + orgA.id + "/" + propertyA.id, { waitUntil: "networkidle", timeout: 120_000 });
    const row = receptionPage.getByRole("listitem").filter({ hasText: created.reference });
    await row.getByLabel("Physical room").selectOption(physical.id);
    await row.getByRole("button", { name: "Assign room", exact: true }).click();
    await row.getByRole("button", { name: "Check in", exact: true }).waitFor({ state: "visible", timeout: 30_000 });
    await row.getByRole("button", { name: "Check in", exact: true }).click();
    await row.getByRole("button", { name: "Check out", exact: true }).waitFor({ state: "visible", timeout: 30_000 });
    await row.getByRole("button", { name: "Check out", exact: true }).click();
    await row.getByText("CHECKED_OUT", { exact: false }).waitFor({ state: "visible", timeout: 30_000 });
    const checkedOut = await db.hotelReservation.findUniqueOrThrow({ where: { id: created.id } });
    assert.equal(checkedOut.status, "CHECKED_OUT");
    assert.ok(checkedOut.checkedInAt && checkedOut.checkedOutAt);
    assert.equal(checkedOut.paidAmount, BigInt(0), "reception fixture does not manufacture received money");
    await receptionContext.close();
    assert.deepEqual(browserErrors, [], "guest reservations page has no browser runtime errors");
    await context.close();
    browserPassed = true;
    stage = "complete";
    passed = true;
  } finally {
    stage = passed ? "cleanup" : stage;
    if (!passed && guestPage) {
      try {
        mkdirSync(browserFailureDirectory, { recursive: true });
        const screenshot = join(browserFailureDirectory, "guest-page.png");
        const urlPath = (() => { try { return new URL(guestPage!.url()).pathname; } catch { return "[invalid-url]"; } })();
        const title = scrubVisibleText(await guestPage.title().catch(() => ""));
        const bodyText = scrubVisibleText(await guestPage.locator("body").innerText({ timeout: 5_000 }).catch(() => ""));
        await guestPage.screenshot({ path: screenshot, fullPage: true, timeout: 10_000 }).catch(() => undefined);
        browserFailureEvidence = { urlPath, title, bodyText, screenshot, serverErrorCategories: serverErrorCategories(bufferedServerLog) };
      } catch {
        browserFailureEvidence = { urlPath: "[capture-failed]", title: "", bodyText: "", screenshot: "", serverErrorCategories: serverErrorCategories(bufferedServerLog) };
      }
    }
    if (browser) {
      try { await browser.close(); browserStopped = true; }
      catch { browserStopped = false; }
    }
    serverStopped = await stopServer(server);
    try {
      if (orgIds.length) {
        await db.hotelInventoryIdempotency.deleteMany({ where: { organizationId: { in: orgIds }, operationScope: { in: ["HOTEL_OPERATIONAL_ACTION", "HOTEL_OPERATIONAL_QUOTE"] } } });
        await db.hotelReservationGuest.deleteMany({ where: { reservation: { organizationId: { in: orgIds } } } });
        await db.hotelReservationRoom.deleteMany({ where: { reservation: { organizationId: { in: orgIds } } } });
        await db.hotelPaymentAllocation.deleteMany({ where: { organizationId: { in: orgIds } } });
        await db.hotelReservation.deleteMany({ where: { organizationId: { in: orgIds } } });
        await db.hotelBookingHold.deleteMany({ where: { organizationId: { in: orgIds } } });
        await db.hotelStayQuote.deleteMany({ where: { organizationId: { in: orgIds } } });
        await db.hotelInventoryAdjustment.deleteMany({ where: { organizationId: { in: orgIds } } });
        await db.hotelInventory.deleteMany({ where: { organizationId: { in: orgIds } } });
        await db.hotelRoom.deleteMany({ where: { organizationId: { in: orgIds } } });
        await db.hotelRatePlan.deleteMany({ where: { id: { in: ratePlanIds } } });
        await db.hotelCancellationPolicy.deleteMany({ where: { id: { in: policyIds } } });
        await db.hotelRoomType.deleteMany({ where: { id: { in: roomTypeIds } } });
        await db.hotelProperty.deleteMany({ where: { id: { in: propertyIds } } });
        await db.customerIdentity.deleteMany({ where: { organizationId: { in: orgIds }, userId: { in: userIds } } });
        await db.guestCustomer.deleteMany({ where: { sessionId: { in: orgIds.map(id => `hotel-operational:${id}:${userIds[0] ?? "missing"}`) } } });
        await db.customerClubMembership.deleteMany({ where: { organizationId: { in: orgIds }, customerId: { in: userIds } } });
        await db.organizationMember.deleteMany({ where: { organizationId: { in: orgIds }, userId: { in: userIds } } });
        await db.organizationDomain.deleteMany({ where: { organizationId: { in: domainOrgIds } } });
        await db.organizationCapability.deleteMany({ where: { organizationId: { in: orgIds } } });
        await db.organization.deleteMany({ where: { id: { in: orgIds } } });
        await db.user.deleteMany({ where: { id: { in: userIds } } });
        assert.equal(await db.hotelReservation.count({ where: { id: { in: ownedReservationIds } } }), 0);
        assert.equal(await db.hotelStayQuote.count({ where: { id: { in: ownedQuoteIds } } }), 0);
      }
      cleanupPassed = true;
    } catch (error) {
      cleanupPassed = false;
      // Preserve only a sanitized failure marker; never print fixture payloads or credentials.
      const name = error instanceof Error ? error.name : "CleanupError";
      process.stderr.write(`HOTEL_OPERATIONAL_RESERVATIONS_CLEANUP_FAILURE=${name}\n`);
    } finally {
      await db.$disconnect();
    }
    if (!cleanupPassed || !serverStopped || !browserStopped) throw new Error("Hotel operational reservation fixture cleanup failed");
  }
});
