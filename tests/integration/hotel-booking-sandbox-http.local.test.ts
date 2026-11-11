import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { createServer } from "node:net";
import { request as httpRequest } from "node:http";
import { spawn, type ChildProcess } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { after, before, it } from "node:test";
import bcrypt from "bcryptjs";
import { PrismaClient, type Organization } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { chromium, type Page, type Locator } from "playwright";

// Browser and HTTP acceptance for the Hotel booking sandbox. All database and
// Next.js traffic stays on the guarded disposable loopback fixture.
assert.notEqual(process.env.NODE_ENV, "production");
assert.notEqual(process.env.VERCEL_ENV, "production");
assert.ok(!process.env.VERCEL, "hosted execution is forbidden");
assert.equal(process.env.HOTEL_BOOKING_SANDBOX_ENABLED, "1");
assert.equal(process.env.CUSTOMER_PHONE_AUTH_ENABLED, "1");
assert.notEqual(process.env.HOTEL_CRON_SCHEDULER_ENABLED, "1");
const dbUrl = new URL(process.env.DATABASE_URL ?? "https://missing.invalid");
assert.ok(["postgres:", "postgresql:"].includes(dbUrl.protocol));
assert.equal(dbUrl.hostname, "127.0.0.1");
assert.equal(dbUrl.port, "55439");
assert.equal(dbUrl.pathname, "/retail_hero_test");
assert.equal(decodeURIComponent(dbUrl.username), "hero_test");
assert.equal(decodeURIComponent(dbUrl.password), "local_admin_fixture_only");
assert.equal(dbUrl.search, "");
assert.equal(dbUrl.hash, "");
assert.equal(process.env.DIRECT_URL, dbUrl.toString());
assert.equal(process.env.LOCAL_PRISMA_EXPECTED_PORT, "55439");
assert.equal(process.env.RETAIL_HERO_EXPECTED_DATABASE, "retail_hero_test");
assert.equal(process.env.DATABASE_RUNTIME_ADAPTER, "postgresql");

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: dbUrl.toString(), max: 8 }), log: [] });
const port = "3035";
const loopback = "127.0.0.1";
const baseUrl = `http://${loopback}:${port}`;
const suffix = randomUUID().replaceAll("-", "");
const prefix = `hotel-booking-${suffix}`;
const hostA = `hotel-booking-a-${suffix}.localhost`;
const hostB = `hotel-booking-b-${suffix}.localhost`;
const originA = `http://${hostA}:${port}`;
const originB = `http://${hostB}:${port}`;
const adminName = `hotel-booking-admin-${suffix}`;
const customerName = `hotel-booking-customer-${suffix}`;
const adminPassword = `HotelFixture-${randomUUID()}-${randomUUID()}`;
const customerPassword = `CustomerFixture-${randomUUID()}-${randomUUID()}`;
const ownedOrgIds: string[] = [];
const ownedDomainOrgIds: string[] = [];
const ownedUserIds: string[] = [];
const ownedPropertyIds: string[] = [];
const ownedPolicyIds: string[] = [];
let orgA: Organization;
let orgB: Organization;
let adminId = "";
let customerId = "";
let propertyAId = "";
let propertyBId = "";
let roomTypeId = "";
let ratePlanId = "";
let server: ChildProcess | undefined;
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
let serverStopped = true;
let browserStopped = true;
let browserPassed = false;
let testPassed = false;
let fixtureCleanupPassed = false;
let stage = "module-load";
let serverLog = "";

const resultDirectory = join(process.cwd(), ".tmp", "hotel-booking-sandbox-p0");
const resultPath = join(resultDirectory, "hotel-booking-sandbox-http.result.json");
process.on("exit", () => {
  const exitCode = process.exitCode ?? (testPassed && fixtureCleanupPassed ? 0 : 1);
  const passed = exitCode === 0 && testPassed && fixtureCleanupPassed && serverStopped && browserStopped && browserPassed;
  try {
    mkdirSync(resultDirectory, { recursive: true });
    writeFileSync(join(resultDirectory, "next-server.log"), serverLog);
    writeFileSync(resultPath, `${JSON.stringify({
      test: "hotel-booking-sandbox-http.local.test.ts",
      status: passed ? "PASSED" : "FAILED",
      exitCode,
      stage,
      database: { host: "127.0.0.1", port: 55439, database: "retail_hero_test", role: "hero_test" },
      server: { port: Number(port), stopped: serverStopped },
      browser: { channel: "chrome", status: browserPassed ? "PASSED" : "FAILED", stopped: browserStopped },
      cleanup: fixtureCleanupPassed && serverStopped && browserStopped ? "PASSED" : "FAILED",
    }, null, 2)}\n`, "utf8");
  } catch {
    process.exitCode = 1;
  }
});

function isolatedServerEnv(): NodeJS.ProcessEnv {
  const allowed = ["PATH", "PATHEXT", "SystemRoot", "SYSTEMROOT", "windir", "ComSpec", "TEMP", "TMP", "USERPROFILE", "APPDATA", "LOCALAPPDATA"];
  const env = Object.fromEntries(allowed.flatMap((key) => process.env[key] === undefined ? [] : [[key, process.env[key]]])) as NodeJS.ProcessEnv;
  Object.assign(env, {
    DATABASE_URL: dbUrl.toString(),
    DIRECT_URL: dbUrl.toString(),
    LOCAL_PRISMA_EXPECTED_PORT: "55439",
    RETAIL_HERO_EXPECTED_DATABASE: "retail_hero_test",
    DATABASE_RUNTIME_ADAPTER: "postgresql",
    NODE_ENV: "development",
    NEXT_TELEMETRY_DISABLED: "1",
    NEXTAUTH_URL: baseUrl,
    NEXTAUTH_URL_INTERNAL: baseUrl,
    NEXTAUTH_SECRET: `fixture-${randomUUID()}-${randomUUID()}`,
    CUSTOMER_SSO_SECRET: `fixture-${randomUUID()}-${randomUUID()}`,
    CUSTOMER_SSO_ENABLED: "1",
    CUSTOMER_PHONE_AUTH_ENABLED: "1",
    HOTEL_BOOKING_SANDBOX_ENABLED: "1",
    HOTEL_INVENTORY_IDEMPOTENCY_ENABLED: "1",
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
    probe.listen(Number(port), loopback, () => probe.close((error) => error ? reject(error) : resolve()));
  });
}

async function request(path: string, host = hostA, origin?: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("host", `${host}:${port}`);
  if (origin) headers.set("origin", origin);
  return new Promise<Response>((resolve, reject) => {
    const outgoing = httpRequest({ hostname: loopback, port: Number(port), path, method: init.method ?? "GET", headers: Object.fromEntries(headers) }, incoming => {
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
function cookieHeader(cookies: string[]) { return cookies.join("; "); }
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

async function apiJson<T>(path: string, host: string, origin: string | undefined, cookie: string, method = "GET", body?: unknown, idempotencyKey?: string) {
  const response = await request(path, host, method === "GET" ? undefined : origin, {
    method,
    headers: { cookie, ...(body === undefined ? {} : { "content-type": "application/json" }), ...(idempotencyKey ? { "idempotency-key": idempotencyKey } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const text = await response.text();
  let data: T | null = null;
  if (text) { try { data = JSON.parse(text) as T; } catch { /* caller can still inspect HTTP status */ } }
  return { response, data };
}

function browserCookies(cookies: string[], origin: string) {
  return cookies.map(value => {
    const separator = value.indexOf("=");
    return { name: value.slice(0, separator), value: value.slice(separator + 1), url: origin };
  }).filter(value => value.name && value.value);
}

async function waitForServer() {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    if (server?.exitCode !== null && server?.exitCode !== undefined) throw new Error("isolated Next server exited before readiness");
    try { if ((await request("/api/auth/csrf", hostA)).status === 200) return; }
    catch { /* wait for cold Next startup */ }
    await delay(500);
  }
  throw new Error("isolated Next server did not become ready in 120 seconds");
}

async function fillSandboxDates(page: Page | Locator, guestCount: number) {
  await page.getByLabel("Check-in").fill("2027-12-10");
  await page.getByLabel("Check-out").fill("2027-12-12");
  await page.getByLabel("Adults").fill(String(guestCount));
}

async function createHttpReservation(cookie: string, outcome: "SUCCESS" | "FAILED" | "EXPIRED", keyPrefix: string) {
  const endpoint = `/api/organizations/${orgA.id}/hotels/${propertyAId}/sandbox-booking`;
  const command = { action: "quote", roomTypeId, ratePlanId, checkIn: "2027-12-10", checkOut: "2027-12-12", adults: 1, childAges: [] };
  const quoteResult = await apiJson<{ quote: { id: string } }>(endpoint, hostA, originA, cookie, "POST", command, `${keyPrefix}-quote-${suffix}`);
  assert.equal(quoteResult.response.status, 200);
  const quoteId = quoteResult.data?.quote.id;
  assert.ok(quoteId);
  const holdResult = await apiJson<{ hold: { id: string } }>(endpoint, hostA, originA, cookie, "POST", { action: "hold", quoteId }, `${keyPrefix}-hold-${suffix}`);
  assert.equal(holdResult.response.status, 200);
  const holdId = holdResult.data?.hold.id;
  assert.ok(holdId);
  const reservationResult = await apiJson<{ reservation: { id: string; status: string } }>(endpoint, hostA, originA, cookie, "POST", {
    action: "reserve", quoteId, holdId, guests: [{ fullName: `${outcome} HTTP guest ${suffix}`, isPrimary: true }],
  }, `${keyPrefix}-reserve-${suffix}`);
  assert.equal(reservationResult.response.status, 200);
  assert.equal(reservationResult.data?.reservation.status, "PENDING_PAYMENT");
  const reservationId = reservationResult.data?.reservation.id;
  assert.ok(reservationId);
  const key = `${keyPrefix}-payment-${suffix}`;
  const payload = { action: "pay", reservationId, outcome };
  const first = await apiJson<{ payment: { status: string; simulated: boolean }; reservation: { status: string } }>(endpoint, hostA, originA, cookie, "POST", payload, key);
  const replay = await apiJson<typeof first.data>(endpoint, hostA, originA, cookie, "POST", payload, key);
  assert.equal(first.response.status, 200);
  assert.equal(replay.response.status, 200);
  assert.deepEqual(replay.data, first.data, `${outcome} callback replay must be idempotent`);
  assert.equal(first.data?.payment.simulated, true);
  assert.equal(first.data?.payment.status, outcome);
  assert.equal(first.data?.reservation.status, outcome === "SUCCESS" ? "CONFIRMED" : outcome === "FAILED" ? "CANCELLED" : "EXPIRED");
  return reservationId;
}

before(async () => {
  stage = "database-identity-guard";
  const identity = await db.$queryRaw<Array<{ database: string; role: string; port: number }>>`SELECT current_database()::text AS database,current_user::text AS role,inet_server_port() AS port`;
  assert.deepEqual(identity, [{ database: "retail_hero_test", role: "hero_test", port: 5432 }]);

  stage = "tenant-fixtures";
  orgA = await db.organization.create({ data: { type: "SHOP", vertical: "HOTEL", name: `${prefix}-a`, slug: `${prefix}-a`, locale: "en", capabilitiesInitializedAt: new Date() } });
  ownedOrgIds.push(orgA.id);
  orgB = await db.organization.create({ data: { type: "SHOP", vertical: "HOTEL", name: `${prefix}-b`, slug: `${prefix}-b`, locale: "en", capabilitiesInitializedAt: new Date() } });
  ownedOrgIds.push(orgB.id);
  await db.organizationCapability.createMany({ data: [orgA, orgB].map(organization => ({ organizationId: organization.id, key: "HOTEL_BOOKING", status: "ACTIVE", enabledAt: new Date() })) });
  await db.organizationDomain.createMany({ data: [
    { organizationId: orgA.id, domain: hostA, normalizedDomain: hostA, status: "ACTIVE", providerVerified: true, dnsConfigured: true, sslReady: true, verifiedAt: new Date() },
    { organizationId: orgB.id, domain: hostB, normalizedDomain: hostB, status: "ACTIVE", providerVerified: true, dnsConfigured: true, sslReady: true, verifiedAt: new Date() },
  ] });
  ownedDomainOrgIds.push(...ownedOrgIds);

  stage = "customer-and-staff-memberships";
  const admin = await db.user.create({ data: { name: adminName, password: await bcrypt.hash(adminPassword, 10), role: "ADMIN", isTeamMember: true } });
  adminId = admin.id;
  ownedUserIds.push(admin.id);
  await db.organizationMember.create({ data: { organizationId: orgA.id, organizationSlug: orgA.slug, userId: admin.id, role: "ADMIN", isActive: true } });
  const customer = await db.user.create({ data: { name: customerName, password: await bcrypt.hash(customerPassword, 10), role: "CUSTOMER", phone: `555${suffix.slice(0, 10)}`, isTeamMember: false } });
  customerId = customer.id;
  ownedUserIds.push(customer.id);
  await db.customerClubMembership.createMany({ data: [orgA, orgB].map(organization => ({ organizationId: organization.id, customerId, status: "ACTIVE", source: "PUBLIC_SHOP" })) });

  stage = "property-and-policy-fixtures";
  const propertyA = await db.hotelProperty.create({ data: { organizationId: orgA.id, organizationSlug: orgA.slug, slug: `${prefix}-hotel-a`, name: `${prefix} Hotel A`, timezone: "Asia/Tehran" } });
  const propertyB = await db.hotelProperty.create({ data: { organizationId: orgB.id, organizationSlug: orgB.slug, slug: `${prefix}-hotel-b`, name: `${prefix} Hotel B`, timezone: "Asia/Tehran" } });
  propertyAId = propertyA.id;
  propertyBId = propertyB.id;
  ownedPropertyIds.push(propertyA.id, propertyB.id);
  const policyA = await db.hotelCancellationPolicy.create({ data: { organizationId: orgA.id, propertyId: propertyA.id, key: `${prefix}-flex-a`, name: "Fixture flexible", freeCancellationCutoffHours: 24, fullCancellationRetention: 0, version: 1 } });
  ownedPolicyIds.push(policyA.id);
  const policyB = await db.hotelCancellationPolicy.create({ data: { organizationId: orgB.id, propertyId: propertyB.id, key: `${prefix}-flex-b`, name: "Fixture flexible", freeCancellationCutoffHours: 24, fullCancellationRetention: 0, version: 1 } });
  ownedPolicyIds.push(policyB.id);

  await assertPortFree();
  mkdirSync(resultDirectory, { recursive: true });
  server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "--webpack", "--hostname", loopback, "--port", port], {
    cwd: process.cwd(), env: isolatedServerEnv(), stdio: ["ignore", "pipe", "pipe"], windowsHide: true,
  });
  const capture = (chunk: Buffer) => { serverLog = (serverLog + chunk.toString()).slice(-100_000); };
  server.stdout?.on("data", capture);
  server.stderr?.on("data", capture);
  serverStopped = false;
  await waitForServer();
});

after(async () => {
  let cleanupError = false;
  try {
    if (browser) {
      try { await browser.close(); browserStopped = true; }
      catch { browserStopped = false; cleanupError = true; }
    }
    if (server && server.exitCode === null) {
      const serverExit = once(server, "exit").then(() => true);
      server.kill();
      const stopped = await Promise.race([serverExit, delay(10_000).then(() => false)]);
      if (!stopped) {
        server.kill("SIGKILL");
        if (!await Promise.race([serverExit, delay(5_000).then(() => false)])) throw new Error("isolated Next server did not stop");
      }
    }
    serverStopped = !server || server.exitCode !== null || server.signalCode !== null;

    if (ownedOrgIds.length) {
      const hotelSessionIds = ownedOrgIds.map(organizationId => `hotel-sandbox:${organizationId}:${customerId}`);
      await db.hotelInventoryIdempotency.deleteMany({ where: { organizationId: { in: ownedOrgIds } } });
      await db.hotelReservationGuest.deleteMany({ where: { reservation: { organizationId: { in: ownedOrgIds } } } });
      await db.hotelReservationRoom.deleteMany({ where: { reservation: { organizationId: { in: ownedOrgIds } } } });
      await db.hotelPaymentAllocation.deleteMany({ where: { organizationId: { in: ownedOrgIds } } });
      await db.hotelReservation.deleteMany({ where: { organizationId: { in: ownedOrgIds } } });
      await db.hotelBookingHold.deleteMany({ where: { organizationId: { in: ownedOrgIds } } });
      await db.hotelInventoryAdjustment.deleteMany({ where: { organizationId: { in: ownedOrgIds } } });
      await db.hotelInventory.deleteMany({ where: { organizationId: { in: ownedOrgIds } } });
      await db.hotelNightlyRate.deleteMany({ where: { organizationId: { in: ownedOrgIds } } });
      await db.hotelRoom.deleteMany({ where: { organizationId: { in: ownedOrgIds } } });
      await db.hotelRatePlan.deleteMany({ where: { organizationId: { in: ownedOrgIds } } });
      await db.hotelCancellationPolicy.deleteMany({ where: { id: { in: ownedPolicyIds } } });
      await db.hotelRoomType.deleteMany({ where: { organizationId: { in: ownedOrgIds } } });
      await db.hotelProperty.deleteMany({ where: { id: { in: ownedPropertyIds } } });
      await db.customerIdentity.deleteMany({ where: { organizationId: { in: ownedOrgIds }, userId: customerId } });
      await db.guestCustomer.deleteMany({ where: { sessionId: { in: hotelSessionIds } } });
      await db.customerPhoneSession.deleteMany({ where: { userId: { in: ownedUserIds }, organizationId: { in: ownedOrgIds } } });
      await db.customerClubMembership.deleteMany({ where: { organizationId: { in: ownedOrgIds }, customerId: { in: ownedUserIds } } });
      await db.organizationMember.deleteMany({ where: { organizationId: { in: ownedOrgIds }, userId: { in: ownedUserIds } } });
      await db.organizationDomain.deleteMany({ where: { organizationId: { in: ownedDomainOrgIds } } });
      await db.organizationCapability.deleteMany({ where: { organizationId: { in: ownedOrgIds } } });
      await db.organization.deleteMany({ where: { id: { in: ownedOrgIds } } });
      await db.user.deleteMany({ where: { id: { in: ownedUserIds } } });
      assert.equal(await db.organization.count({ where: { id: { in: ownedOrgIds } } }), 0);
      assert.equal(await db.hotelReservation.count({ where: { organizationId: { in: ownedOrgIds } } }), 0);
      assert.equal(await db.hotelInventoryIdempotency.count({ where: { organizationId: { in: ownedOrgIds } } }), 0);
      assert.equal(await db.guestCustomer.count({ where: { sessionId: { in: hotelSessionIds } } }), 0);
      assert.equal(await db.customerIdentity.count({ where: { organizationId: { in: ownedOrgIds }, userId: customerId } }), 0);
      assert.equal(await db.user.count({ where: { id: { in: ownedUserIds } } }), 0);
    }
    fixtureCleanupPassed = true;
  } catch {
    cleanupError = true;
  } finally {
    await db.$disconnect();
    console.log("HOTEL_BOOKING_SANDBOX_HTTP_SERVER_OUTPUT_SUPPRESSED");
    console.log(`HOTEL_BOOKING_SANDBOX_HTTP_CLEANUP=${fixtureCleanupPassed && serverStopped && browserStopped ? "PASSED" : "FAILED"}`);
  }
  if (cleanupError || !fixtureCleanupPassed || !serverStopped || !browserStopped) throw new Error("Hotel booking sandbox HTTP fixture cleanup failed");
});

it("completes tenant-bound Hotel sandbox bookings through Chrome and replays local payment callbacks", async () => {
  stage = "host-bound-password-logins";
  const adminLogin = await passwordLogin(loopback, baseUrl, adminName, adminPassword);
  assert.ok([200, 302].includes(adminLogin.callback.status));
  assert.equal(adminLogin.session.user?.id, adminId);
  assert.equal(adminLogin.session.user?.role, "ADMIN");
  assert.equal(adminLogin.session.user?.organizationId, orgA.id);
  const customerLoginA = await passwordLogin(hostA, originA, customerName, customerPassword);
  const customerLoginB = await passwordLogin(hostB, originB, customerName, customerPassword);
  assert.ok([200, 302].includes(customerLoginA.callback.status));
  assert.ok([200, 302].includes(customerLoginB.callback.status));
  for (const login of [customerLoginA, customerLoginB]) {
    assert.equal(login.session.user?.id, customerId);
    assert.equal(login.session.user?.role, "CUSTOMER");
  }
  assert.equal(customerLoginA.session.user?.organizationId, orgA.id, "customer login on verified Hotel A domain resolves tenant A");
  assert.equal(customerLoginB.session.user?.organizationId, orgB.id, "the same customer resolves tenant B after a separate verified-domain login");
  const customerCookieA = cookieHeader(customerLoginA.cookies);
  const customerCookieB = cookieHeader(customerLoginB.cookies);
  const endpointA = `/api/organizations/${orgA.id}/hotels/${propertyAId}/sandbox-booking`;
  const endpointB = `/api/organizations/${orgB.id}/hotels/${propertyBId}/sandbox-booking`;
  const guestViewA = await apiJson<{ enabled: boolean; roomTypes: unknown[] }>(endpointA, hostA, undefined, customerCookieA);
  assert.equal(guestViewA.response.status, 200);
  assert.equal(guestViewA.data?.enabled, true);
  const guestViewB = await apiJson<{ enabled: boolean }>(endpointB, hostB, undefined, customerCookieB);
  assert.equal(guestViewB.response.status, 200);
  assert.equal(guestViewB.data?.enabled, true);
  const wrongTenantByContext = await apiJson(endpointB, hostA, originA, customerCookieA, "GET");
  assert.equal(wrongTenantByContext.response.status, 403, "tenant A customer context cannot read tenant B sandbox");
  const wrongTenantByHost = await apiJson(endpointB, hostB, originB, customerCookieA, "GET");
  assert.equal(wrongTenantByHost.response.status, 403, "tenant A login context stays bound after the request host changes");

  stage = "browser-admin-operations-setup";
  browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--no-sandbox"] });
  browserStopped = false;
  const adminContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await adminContext.addCookies(browserCookies(adminLogin.cookies, baseUrl));
  const adminPage = await adminContext.newPage();
  adminPage.setDefaultNavigationTimeout(120_000);
  const browserErrors: string[] = [];
  adminPage.on("pageerror", error => browserErrors.push(error.name));
  await adminPage.goto(`${baseUrl}/en/dashboard/hotel-operations/${orgA.id}/${propertyAId}`, { waitUntil: "domcontentloaded" });
  await adminPage.getByRole("heading", { name: "Hotel operations" }).waitFor({ state: "visible", timeout: 120_000 }).catch(async error => {
    mkdirSync(resultDirectory, { recursive: true });
    writeFileSync(join(resultDirectory, "admin-page-diagnostic.json"), JSON.stringify({ url: adminPage.url(), text: (await adminPage.locator("body").innerText()).slice(0, 3000) }, null, 2));
    throw error;
  });

  const roomTypeSection = adminPage.locator("section").filter({ has: adminPage.getByRole("heading", { name: "Room types", exact: true }) });
  const roomTypeForm = roomTypeSection.locator("form");
  const roomTypeSlug = `${prefix}-standard`;
  const roomTypeName = `${prefix} Standard`;
  await roomTypeForm.getByLabel("Room type slug").fill(roomTypeSlug);
  await roomTypeForm.getByLabel("Name").fill(roomTypeName);
  await roomTypeForm.getByLabel("Description").fill("Created through the authenticated Hotel operations UI");
  await roomTypeForm.getByLabel("Adults").fill("2");
  await roomTypeForm.getByLabel("Children").fill("1");
  await roomTypeForm.getByLabel("Max occupancy").fill("3");
  await roomTypeForm.getByLabel("Bed type").selectOption("queen");
  await roomTypeForm.getByLabel("Count").fill("1");
  await roomTypeForm.getByRole("button", { name: "Add", exact: true }).click();
  await roomTypeSection.getByText(`${roomTypeName} (${roomTypeSlug})`, { exact: true }).waitFor({ state: "visible", timeout: 30_000 });
  const persistedRoomType = await db.hotelRoomType.findFirst({ where: { organizationId: orgA.id, propertyId: propertyAId, slug: roomTypeSlug } });
  assert.ok(persistedRoomType);
  roomTypeId = persistedRoomType.id;

  const roomSection = adminPage.locator("section").filter({ has: adminPage.getByRole("heading", { name: "Physical rooms", exact: true }) });
  const roomForm = roomSection.locator("form");
  await roomForm.getByLabel("Room type").selectOption(roomTypeId);
  await roomForm.getByLabel("Room code").fill(`${suffix.slice(0, 6)}-101`);
  await roomForm.getByLabel("Floor").fill("1");
  await roomForm.getByRole("button", { name: "Add", exact: true }).click();
  await roomSection.getByText(`${suffix.slice(0, 6)}-101 · 1`, { exact: true }).waitFor({ state: "visible", timeout: 30_000 });

  const ratesSection = adminPage.locator("section").filter({ has: adminPage.getByRole("heading", { name: "Rates", exact: true }) });
  const ratePlanForm = ratesSection.locator("form").nth(0);
  const ratePlanCode = `${suffix.slice(0, 8)}-FLEX`;
  const ratePlanName = `${prefix} Flexible`;
  await ratePlanForm.getByLabel("Room type").selectOption(roomTypeId);
  await ratePlanForm.getByLabel("Rate plan code").fill(ratePlanCode);
  await ratePlanForm.getByLabel("Rate plan name").fill(ratePlanName);
  await ratePlanForm.getByLabel("Base nightly rate (Toman)").fill("250000");
  await ratePlanForm.getByRole("button", { name: "Create rate plan" }).click();
  await ratesSection.getByText(`${ratePlanName} · 250000 TOMAN`, { exact: true }).waitFor({ state: "visible", timeout: 30_000 });
  const persistedPlan = await db.hotelRatePlan.findFirst({ where: { organizationId: orgA.id, propertyId: propertyAId, code: ratePlanCode } });
  assert.ok(persistedPlan);
  ratePlanId = persistedPlan.id;
  await db.hotelRatePlan.update({ where: { id: ratePlanId }, data: { cancellationPolicyId: ownedPolicyIds[0] } });

  const inventorySection = adminPage.locator("section").filter({ has: adminPage.getByRole("heading", { name: "Nightly inventory", exact: true }) });
  const initializeForm = inventorySection.locator("form").nth(0);
  await initializeForm.getByLabel("Room type").selectOption(roomTypeId);
  await initializeForm.getByLabel("From (inclusive)").fill("2027-12-10");
  await initializeForm.getByLabel("To (exclusive)").fill("2027-12-12");
  await initializeForm.getByLabel("Allotment").fill("8");
  await initializeForm.getByLabel("Reason").fill("Hotel booking sandbox browser fixture");
  await initializeForm.getByRole("button", { name: "Initialize missing nights" }).click();
  await adminPage.getByRole("status").filter({ hasText: "Changes saved." }).waitFor({ state: "visible", timeout: 30_000 });
  const inventory = await db.hotelInventory.findMany({ where: { organizationId: orgA.id, propertyId: propertyAId, roomTypeId }, orderBy: { date: "asc" } });
  assert.equal(inventory.length, 2);
  assert.ok(inventory.every(row => row.allotment === 8));

  stage = "customer-browser-search-quote-hold-reserve-and-pay";
  const customerContextA = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await customerContextA.addCookies(browserCookies(customerLoginA.cookies, originA));
  const guestPage = await customerContextA.newPage();
  guestPage.setDefaultNavigationTimeout(120_000);
  guestPage.on("pageerror", error => browserErrors.push(error.name));
  await guestPage.goto(`${originA}/en/hotel-sandbox/${orgA.id}/${propertyAId}`, { waitUntil: "domcontentloaded" });
  const sandbox = guestPage.getByRole("region", { name: "Hotel booking sandbox" });
  await sandbox.getByRole("heading", { name: "Hotel booking sandbox" }).waitFor({ state: "visible", timeout: 120_000 }).catch(async error => {
    mkdirSync(resultDirectory, { recursive: true });
    writeFileSync(join(resultDirectory, "guest-page-diagnostic.json"), JSON.stringify({ url: guestPage.url(), text: (await guestPage.locator("body").innerText()).slice(0, 3000) }, null, 2));
    throw error;
  });
  await guestPage.waitForLoadState("networkidle");
  await sandbox.getByLabel("Room type").selectOption(roomTypeId);
  await sandbox.getByLabel("Rate plan").selectOption(ratePlanId);
  await fillSandboxDates(sandbox, 2);
  assert.equal(await sandbox.getByLabel("Check-in").inputValue(), "2027-12-10");
  assert.equal(await sandbox.getByLabel("Check-out").inputValue(), "2027-12-12");
  await sandbox.getByRole("button", { name: "Search availability" }).click();
  await sandbox.getByRole("status").filter({ hasText: "Available" }).waitFor({ state: "visible", timeout: 30_000 });
  await sandbox.getByRole("button", { name: "Get quote" }).click();
  await sandbox.getByText("Display total:").waitFor({ state: "visible", timeout: 30_000 });
  await sandbox.getByRole("button", { name: "Create temporary hold" }).click();
  await sandbox.getByLabel("Guest full name 1").fill(`${prefix} Primary Guest`);
  await sandbox.getByLabel("Guest full name 2").fill(`${prefix} Second Guest`);
  await sandbox.getByRole("button", { name: "Create simulated reservation" }).click();
  await sandbox.getByRole("status").filter({ hasText: "Simulated" }).waitFor({ state: "visible", timeout: 30_000 });
  const customerReservation = await db.hotelReservation.findFirstOrThrow({ where: { organizationId: orgA.id, propertyId: propertyAId, guestCustomerId: { not: null } }, orderBy: { createdAt: "desc" }, include: { guests: true } });
  assert.equal(customerReservation.status, "PENDING_PAYMENT");
  assert.ok(customerReservation.guestCustomerId, "reservation is linked to a server-derived GuestCustomer");
  const guestSessionId = `hotel-sandbox:${orgA.id}:${customerId}`;
  const boundGuest = await db.guestCustomer.findUniqueOrThrow({ where: { id: customerReservation.guestCustomerId } });
  assert.equal(boundGuest.sessionId, guestSessionId);
  const identity = await db.customerIdentity.findFirstOrThrow({ where: { organizationId: orgA.id, userId: customerId, guestCustomerId: boundGuest.id } });
  assert.ok(identity.id);
  assert.deepEqual(customerReservation.guests.map(guest => guest.fullName), [`${prefix} Primary Guest`, `${prefix} Second Guest`]);
  assert.equal(customerReservation.guests.filter(guest => guest.isPrimary).length, 1);

  await sandbox.getByRole("button", { name: "Simulate payment: Success" }).click();
  await sandbox.getByText(`${customerReservation.reference} · CONFIRMED`, { exact: true }).waitFor({ state: "visible", timeout: 30_000 });
  const confirmed = await db.hotelReservation.findUniqueOrThrow({ where: { id: customerReservation.id } });
  assert.equal(confirmed.status, "CONFIRMED");
  const successReplayKey = `success-callback-replay-${suffix}`;
  const successCommand = { action: "pay", reservationId: customerReservation.id, outcome: "SUCCESS" };
  const successFirst = await apiJson<{ payment: { status: string; simulated: boolean }; reservation: { status: string } }>(endpointA, hostA, originA, customerCookieA, "POST", successCommand, successReplayKey);
  const successReplay = await apiJson<typeof successFirst.data>(endpointA, hostA, originA, customerCookieA, "POST", successCommand, successReplayKey);
  assert.equal(successFirst.response.status, 200);
  assert.equal(successReplay.response.status, 200);
  assert.deepEqual(successReplay.data, successFirst.data);
  assert.equal(successFirst.data?.payment.status, "SUCCESS");
  assert.equal(successFirst.data?.payment.simulated, true);

  stage = "reception-list-and-cancel";
  await adminPage.reload({ waitUntil: "domcontentloaded" });
  await adminPage.getByRole("heading", { name: "Hotel operations" }).waitFor({ state: "visible", timeout: 30_000 });
  const reception = adminPage.getByRole("region", { name: "Hotel booking sandbox" });
  await reception.getByText(`${customerReservation.reference} · CONFIRMED`, { exact: true }).waitFor({ state: "visible", timeout: 30_000 });
  const physicalRoom = await db.hotelRoom.findFirstOrThrow({ where: { organizationId: orgA.id, propertyId: propertyAId, roomTypeId } });
  const customerAssignment = await apiJson(endpointA, hostA, originA, customerCookieA, "POST", { action: "assign-room", reservationId: customerReservation.id, roomId: physicalRoom.id }, `customer-assignment-denied-${suffix}`);
  assert.equal(customerAssignment.response.status, 403);
  await reception.getByLabel("Physical room").selectOption(physicalRoom.id);
  await reception.getByRole("button", { name: "Assign room", exact: true }).click();
  await reception.getByRole("button", { name: "Check in", exact: true }).waitFor({ state: "visible" });
  await adminPage.waitForFunction(() => [...document.querySelectorAll("button")].some(button => button.textContent === "Check in" && !button.disabled));
  assert.ok((await db.hotelReservationRoom.findMany({ where: { reservationId: customerReservation.id } })).every(night => night.roomId === physicalRoom.id));
  await reception.getByRole("button", { name: "Cancel reservation" }).first().click();
  await reception.getByText(`${customerReservation.reference} · CANCELLED`, { exact: true }).waitFor({ state: "visible", timeout: 30_000 });
  assert.equal((await db.hotelReservation.findUniqueOrThrow({ where: { id: customerReservation.id } })).status, "CANCELLED");
  assert.ok((await db.hotelReservationRoom.findMany({ where: { reservationId: customerReservation.id } })).every(night => night.roomId === null));

  stage = "reception-room-reuse-check-in-and-check-out";
  const arrivalId = await createHttpReservation(customerCookieA, "SUCCESS", "arrival");
  const arrival = await db.hotelReservation.findUniqueOrThrow({ where: { id: arrivalId } });
  await adminPage.reload({ waitUntil: "networkidle" });
  const arrivalRow = reception.locator("li").filter({ hasText: arrival.reference });
  await arrivalRow.getByLabel("Physical room").selectOption(physicalRoom.id);
  await arrivalRow.getByRole("button", { name: "Assign room", exact: true }).click();
  await arrivalRow.getByRole("button", { name: "Check in", exact: true }).click();
  await arrivalRow.getByText(`${arrival.reference} · CHECKED_IN`, { exact: true }).waitFor({ state: "visible", timeout: 30_000 });
  await arrivalRow.getByRole("button", { name: "Check out", exact: true }).click();
  await arrivalRow.getByText(`${arrival.reference} · CHECKED_OUT`, { exact: true }).waitFor({ state: "visible", timeout: 30_000 });
  assert.equal((await db.hotelReservation.findUniqueOrThrow({ where: { id: arrivalId } })).status, "CHECKED_OUT");

  stage = "http-failed-expired-bookings-and-callback-replays";
  const failedReservationId = await createHttpReservation(customerCookieA, "FAILED", "failed");
  const expiredReservationId = await createHttpReservation(customerCookieA, "EXPIRED", "expired");
  assert.equal((await db.hotelReservation.findUniqueOrThrow({ where: { id: failedReservationId } })).status, "CANCELLED");
  assert.equal((await db.hotelReservation.findUniqueOrThrow({ where: { id: expiredReservationId } })).status, "EXPIRED");

  stage = "tenant-a-customer-history-isolation";
  const customerReservationsA = await apiJson<{ reservations: Array<{ id: string }> }>(endpointA, hostA, undefined, customerCookieA);
  assert.equal(customerReservationsA.response.status, 200);
  assert.ok(customerReservationsA.data?.reservations.some(row => row.id === customerReservation.id));
  assert.ok(customerReservationsA.data?.reservations.some(row => row.id === failedReservationId));
  assert.ok(customerReservationsA.data?.reservations.some(row => row.id === expiredReservationId));
  const customerReservationsB = await apiJson<{ reservations: Array<{ id: string }> }>(endpointB, hostB, undefined, customerCookieB);
  assert.equal(customerReservationsB.response.status, 200);
  assert.deepEqual(customerReservationsB.data?.reservations, [], "the shared customer has no reservations in tenant B");

  await customerContextA.close();
  await adminContext.close();
  assert.deepEqual(browserErrors, [], "Hotel booking sandbox and operations pages have no browser runtime errors");
  browserPassed = true;
  stage = "complete";
  testPassed = true;
});
