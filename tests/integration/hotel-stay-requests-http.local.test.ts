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
import { chromium } from "playwright";

const enabled = process.env.HOTEL_STAY_REQUESTS_HTTP_ACCEPTANCE === "1";
const loopback = "127.0.0.1";
const port = 3036;
const baseUrl = `http://${loopback}:${port}`;
const suffix = randomUUID().replaceAll("-", "").slice(0, 14);
const prefix = `hotel-stay-http-${suffix}`;
const hostA = `hotel-stay-a-${suffix}.localhost`;
const hostB = `hotel-stay-b-${suffix}.localhost`;
const originA = `http://${hostA}:${port}`;
const originB = `http://${hostB}:${port}`;
const adminName = `${prefix}-admin`;
const customerName = `${prefix}-customer`;
const adminPassword = `Fixture-${randomUUID()}-${randomUUID()}`;
const customerPassword = `Fixture-${randomUUID()}-${randomUUID()}`;
const resultDirectory = join(process.cwd(), ".tmp", "hotel-stay-requests");
const resultPath = join(resultDirectory, "http.result.json");

let resultStage = "not-started";
let passed = false;
let cleanupPassed = false;
let serverStopped = true;
let browserStopped = true;
let browserPassed = false;

if (enabled) process.on("exit", () => {
  const exitCode = process.exitCode ?? (passed && cleanupPassed ? 0 : 1);
  const ok = exitCode === 0 && passed && cleanupPassed && serverStopped && browserStopped && browserPassed;
  try {
    mkdirSync(resultDirectory, { recursive: true });
    writeFileSync(resultPath, `${JSON.stringify({
      test: "hotel-stay-requests-http.local.test.ts",
      status: ok ? "PASSED" : "FAILED",
      exitCode,
      stage: resultStage,
      database: { host: loopback, port: 55439, database: "retail_hero_test", role: "hero_test" },
      server: { port, stopped: serverStopped },
      browser: { channel: "chrome", status: browserPassed ? "PASSED" : "FAILED", stopped: browserStopped },
      cleanup: cleanupPassed && serverStopped && browserStopped ? "PASSED" : "FAILED",
    }, null, 2)}\n`, "utf8");
  } catch {
    process.exitCode = 1;
  }
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
    NEXTAUTH_SECRET: "hotel-stay-requests-http-fixture-only-secret-not-for-other-environments",
    CUSTOMER_PHONE_AUTH_ENABLED: "1",
    CUSTOMER_SSO_ENABLED: "1",
    HOTEL_GUEST_PORTAL_ENABLED: "1",
    HOTEL_ANONYMOUS_HOLD_OPERATIONAL_ENABLED: "0",
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

async function apiJson<T>(path: string, host: string, origin: string | undefined, cookie: string, method = "GET", body?: unknown, idempotencyKey?: string) {
  const response = await request(path, host, method === "GET" ? undefined : origin, {
    method,
    headers: { cookie, ...(body === undefined ? {} : { "content-type": "application/json" }), ...(idempotencyKey ? { "idempotency-key": idempotencyKey } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const raw = await response.text();
  let data: T | null = null;
  if (raw) { try { data = JSON.parse(raw) as T; } catch { /* status remains available to assertions */ } }
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
    catch { /* cold Next startup */ }
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

async function operationalState(db: PrismaClient, organizationIds: string[]) {
  const [inventory, adjustments, holds, reservations, paymentAllocations, paymentRequests] = await Promise.all([
    db.hotelInventory.findMany({ where: { organizationId: { in: organizationIds } }, orderBy: [{ organizationId: "asc" }, { date: "asc" }], select: { id: true, allotment: true, booked: true, held: true, outOfService: true, closedToArrival: true, closedToDeparture: true } }),
    db.hotelInventoryAdjustment.count({ where: { organizationId: { in: organizationIds } } }),
    db.hotelBookingHold.count({ where: { organizationId: { in: organizationIds } } }),
    db.hotelReservation.count({ where: { organizationId: { in: organizationIds } } }),
    db.hotelPaymentAllocation.count({ where: { organizationId: { in: organizationIds } } }),
    db.paymentRequest.count({ where: { organizationId: { in: organizationIds } } }),
  ]);
  return { inventory, adjustments, holds, reservations, paymentAllocations, paymentRequests };
}

test("request-only Hotel stay coordination works through authenticated browser and tenant-bound HTTP", {
  skip: !enabled,
  concurrency: false,
}, async () => {
  resultStage = "fixture-guard";
  const connection = guardedConnection();
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: connection.toString(), max: 8 }), log: [] });
  const ownedOrgIds: string[] = [];
  const ownedDomainOrgIds: string[] = [];
  const ownedUserIds: string[] = [];
  const ownedPropertyIds: string[] = [];
  const ownedRoomTypeIds: string[] = [];
  const ownedPolicyIds: string[] = [];
  let server: ChildProcess | undefined;
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  const browserErrors: string[] = [];
  let inventoryBefore: Awaited<ReturnType<typeof operationalState>> | undefined;
  let fixtureFinalized = false;

  try {
    resultStage = "database-identity-guard";
    const identity = await db.$queryRaw<Array<{ database: string; role: string; port: number }>>`SELECT current_database()::text AS database,current_user::text AS role,inet_server_port() AS port`;
    assert.deepEqual(identity, [{ database: "retail_hero_test", role: "hero_test", port: 5432 }]);

    resultStage = "tenant-fixtures";
    const orgA = await db.organization.create({ data: { type: "SHOP", vertical: "HOTEL", name: `${prefix}-a`, slug: `${prefix}-a`, locale: "en", capabilitiesInitializedAt: new Date() } });
    ownedOrgIds.push(orgA.id);
    const orgB = await db.organization.create({ data: { type: "SHOP", vertical: "HOTEL", name: `${prefix}-b`, slug: `${prefix}-b`, locale: "en", capabilitiesInitializedAt: new Date() } });
    ownedOrgIds.push(orgB.id);
    await db.organizationCapability.createMany({ data: [orgA, orgB].map(org => ({ organizationId: org.id, key: "HOTEL_BOOKING", status: "ACTIVE" as const, enabledAt: new Date() })) });
    await db.organizationDomain.createMany({ data: [
      { organizationId: orgA.id, domain: hostA, normalizedDomain: hostA, status: "ACTIVE", providerVerified: true, dnsConfigured: true, sslReady: true, verifiedAt: new Date() },
      { organizationId: orgB.id, domain: hostB, normalizedDomain: hostB, status: "ACTIVE", providerVerified: true, dnsConfigured: true, sslReady: true, verifiedAt: new Date() },
    ] });
    assert.equal(await db.organizationDomain.findUnique({ where: { normalizedDomain: "damoon-hotel.ir" } }), null, "the canonical Damoon host must be unclaimed in this disposable fixture");
    await db.organizationDomain.create({ data: {
      organizationId: orgA.id, domain: "damoon-hotel.ir", normalizedDomain: "damoon-hotel.ir", kind: "APEX", type: "CUSTOM",
      status: "ACTIVE", providerVerified: true, dnsConfigured: true, sslReady: true, verifiedAt: new Date(),
    } });
    ownedDomainOrgIds.push(orgA.id, orgB.id);

    resultStage = "authenticated-fixtures";
    const admin = await db.user.create({ data: { name: adminName, password: await bcrypt.hash(adminPassword, 10), role: "ADMIN", isTeamMember: true } });
    ownedUserIds.push(admin.id);
    await db.organizationMember.create({ data: { organizationId: orgA.id, organizationSlug: orgA.slug, userId: admin.id, role: "ADMIN", isActive: true } });
    const customer = await db.user.create({ data: { name: customerName, password: await bcrypt.hash(customerPassword, 10), role: "CUSTOMER", phone: `555${suffix.slice(0, 10)}`, isTeamMember: false } });
    ownedUserIds.push(customer.id);
    await db.customerClubMembership.createMany({ data: [orgA, orgB].map(org => ({ organizationId: org.id, customerId: customer.id, status: "ACTIVE" as const, source: "PUBLIC_SHOP" as const })) });

    resultStage = "hotel-fixtures";
    const propertyA = await db.hotelProperty.create({ data: { organizationId: orgA.id, organizationSlug: orgA.slug, slug: `${prefix}-property-a`, name: `${prefix} Hotel A`, operationalMode: "REQUEST_ONLY" } });
    const propertyB = await db.hotelProperty.create({ data: { organizationId: orgB.id, organizationSlug: orgB.slug, slug: `${prefix}-property-b`, name: `${prefix} Hotel B`, operationalMode: "REQUEST_ONLY" } });
    ownedPropertyIds.push(propertyA.id, propertyB.id);
    const policyA = await db.hotelCancellationPolicy.create({ data: { organizationId: orgA.id, propertyId: propertyA.id, key: `${prefix}-flex-a`, name: "Fixture flexible", freeCancellationCutoffHours: 24, fullCancellationRetention: 0, version: 5 } });
    const policyB = await db.hotelCancellationPolicy.create({ data: { organizationId: orgB.id, propertyId: propertyB.id, key: `${prefix}-flex-b`, name: "Fixture flexible", freeCancellationCutoffHours: 24, fullCancellationRetention: 0, version: 3 } });
    ownedPolicyIds.push(policyA.id, policyB.id);
    const roomA = await db.hotelRoomType.create({ data: { organizationId: orgA.id, propertyId: propertyA.id, slug: `${prefix}-room-a`, name: "Request room A", maxAdults: 2, maxChildren: 2, maxOccupancy: 4, beds: [{ kind: "queen", count: 1 }], totalAllotment: 4 } });
    const roomB = await db.hotelRoomType.create({ data: { organizationId: orgB.id, propertyId: propertyB.id, slug: `${prefix}-room-b`, name: "Request room B", maxAdults: 2, maxChildren: 2, maxOccupancy: 4, beds: [{ kind: "queen", count: 1 }], totalAllotment: 4 } });
    ownedRoomTypeIds.push(roomA.id, roomB.id);
    const planA = await db.hotelRatePlan.create({ data: { organizationId: orgA.id, propertyId: propertyA.id, roomTypeId: roomA.id, code: `${suffix}-FLEX-A`, name: "Fixture flexible A", baseNightlyRate: BigInt(125000), cancellationPolicyId: policyA.id } });
    const planB = await db.hotelRatePlan.create({ data: { organizationId: orgB.id, propertyId: propertyB.id, roomTypeId: roomB.id, code: `${suffix}-FLEX-B`, name: "Fixture flexible B", baseNightlyRate: BigInt(175000), cancellationPolicyId: policyB.id } });
    await db.hotelInventory.createMany({ data: [orgA, orgB].flatMap(org => ["2027-12-10", "2027-12-11"].map(date => ({
      organizationId: org.id,
      propertyId: org.id === orgA.id ? propertyA.id : propertyB.id,
      roomTypeId: org.id === orgA.id ? roomA.id : roomB.id,
      date: new Date(`${date}T00:00:00.000Z`), allotment: 4,
    }))) });
    assert.equal(planA.currency, "TOMAN");
    assert.equal(planB.currency, "TOMAN");
    inventoryBefore = await operationalState(db, ownedOrgIds);

    resultStage = "isolated-server";
    await assertPortFree();
    server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "--webpack", "--hostname", loopback, "--port", String(port)], {
      cwd: process.cwd(), env: isolatedServerEnv(connection.toString()), stdio: ["ignore", "ignore", "ignore"], windowsHide: true,
    });
    serverStopped = false;
    await waitForServer(server);

    resultStage = "public-guest-portal-entry-api";
    const publicPortalA = await apiJson<{ enabled: boolean; organizationId?: string; propertyId?: string }>("/api/hotel/v1/guest-portal", hostA, undefined, "");
    assert.equal(publicPortalA.response.status, 200);
    assert.deepEqual(publicPortalA.data, { enabled: true, organizationId: orgA.id, propertyId: propertyA.id });
    const publicPortalB = await apiJson<{ enabled: boolean; organizationId?: string; propertyId?: string }>("/api/hotel/v1/guest-portal", hostB, undefined, "");
    assert.equal(publicPortalB.response.status, 200);
    assert.deepEqual(publicPortalB.data, { enabled: true, organizationId: orgB.id, propertyId: propertyB.id });

    resultStage = "tenant-bound-authentication";
    const adminLogin = await passwordLogin(hostA, originA, adminName, adminPassword);
    const customerLoginA = await passwordLogin(hostA, originA, customerName, customerPassword);
    const customerLoginB = await passwordLogin(hostB, originB, customerName, customerPassword);
    assert.ok([200, 302].includes(adminLogin.callback.status));
    assert.equal(adminLogin.session.user?.id, admin.id);
    assert.equal(adminLogin.session.user?.role, "ADMIN");
    assert.equal(adminLogin.session.user?.organizationId, orgA.id);
    for (const login of [customerLoginA, customerLoginB]) {
      assert.ok([200, 302].includes(login.callback.status));
      assert.equal(login.session.user?.id, customer.id);
      assert.equal(login.session.user?.role, "CUSTOMER");
    }
    assert.equal(customerLoginA.session.user?.organizationId, orgA.id);
    assert.equal(customerLoginB.session.user?.organizationId, orgB.id);
    const customerCookieA = cookieHeader(customerLoginA.cookies);
    const customerCookieB = cookieHeader(customerLoginB.cookies);
    const adminCookieA = cookieHeader(adminLogin.cookies);
    const endpointA = `/api/organizations/${orgA.id}/hotels/${propertyA.id}/stay-requests`;
    const endpointB = `/api/organizations/${orgB.id}/hotels/${propertyB.id}/stay-requests`;

    resultStage = "http-guest-reception-views-and-isolation";
    const guestViewA = await apiJson<{ enabled: boolean; mode: string; view: string; requests: unknown[] }>(endpointA, hostA, undefined, customerCookieA);
    assert.equal(guestViewA.response.status, 200);
    assert.deepEqual({ enabled: guestViewA.data?.enabled, mode: guestViewA.data?.mode, view: guestViewA.data?.view, requests: guestViewA.data?.requests }, { enabled: true, mode: "REQUEST_ONLY", view: "guest", requests: [] });
    const guestViewB = await apiJson<{ enabled: boolean; mode: string; view: string; requests: unknown[] }>(endpointB, hostB, undefined, customerCookieB);
    assert.equal(guestViewB.response.status, 200);
    assert.deepEqual({ enabled: guestViewB.data?.enabled, mode: guestViewB.data?.mode, view: guestViewB.data?.view, requests: guestViewB.data?.requests }, { enabled: true, mode: "REQUEST_ONLY", view: "guest", requests: [] });
    const adminReceptionEmpty = await apiJson<{ enabled: boolean; mode: string; view: string; requests: unknown[] }>(endpointA, hostA, undefined, adminCookieA);
    assert.equal(adminReceptionEmpty.response.status, 200);
    assert.deepEqual({ enabled: adminReceptionEmpty.data?.enabled, mode: adminReceptionEmpty.data?.mode, view: adminReceptionEmpty.data?.view, requests: adminReceptionEmpty.data?.requests }, { enabled: true, mode: "REQUEST_ONLY", view: "reception", requests: [] });
    const deniedCustomerConfiguration = await apiJson(endpointA, hostA, originA, customerCookieA, "PATCH", { mode: "DISABLED" });
    assert.equal(deniedCustomerConfiguration.response.status, 403);
    const disablePortal = await apiJson<{ mode: string }>(endpointA, hostA, originA, adminCookieA, "PATCH", { mode: "DISABLED" });
    assert.equal(disablePortal.response.status, 200);
    assert.equal(disablePortal.data?.mode, "DISABLED");
    const disabledRead = await apiJson(endpointA, hostA, undefined, customerCookieA);
    assert.equal(disabledRead.response.status, 403, "property disablement immediately gates guest reads");
    const reenablePortal = await apiJson<{ mode: string }>(endpointA, hostA, originA, adminCookieA, "PATCH", { mode: "REQUEST_ONLY" });
    assert.equal(reenablePortal.response.status, 200);
    assert.equal(reenablePortal.data?.mode, "REQUEST_ONLY");
    const wrongTenantPath = await apiJson(endpointB, hostA, undefined, customerCookieA);
    assert.equal(wrongTenantPath.response.status, 403, "tenant A customer cannot read tenant B path");
    const wrongTenantSession = await apiJson(endpointB, hostB, undefined, customerCookieA);
    assert.equal(wrongTenantSession.response.status, 403, "tenant A login cookie cannot cross to tenant B host");

    resultStage = "browser-request-flow-and-query-rehydration";
    browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--no-sandbox", "--host-resolver-rules=MAP damoon-hotel.ir 127.0.0.1"] });
    browserStopped = false;
    const customerContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await customerContext.addCookies(browserCookies(customerLoginA.cookies, originA));
    const guestPage = await customerContext.newPage();
    guestPage.setDefaultNavigationTimeout(120_000);
    guestPage.on("pageerror", error => browserErrors.push(error.name));
    await guestPage.goto(`${originA}/en/hotel/${orgA.id}/${propertyA.id}?checkIn=2027-12-10&checkOut=2027-12-12&adults=1`, { waitUntil: "domcontentloaded" });
    const guestPortal = guestPage.getByRole("region", { name: "Stay coordination requests" });
    await guestPortal.getByRole("heading", { name: "Stay coordination requests" }).waitFor({ state: "visible", timeout: 120_000 });
    assert.equal(await guestPortal.getByLabel("Check-in").inputValue(), "2027-12-10");
    assert.equal(await guestPortal.getByLabel("Check-out").inputValue(), "2027-12-12");
    assert.equal(await guestPortal.getByLabel("Adults").inputValue(), "1");

    const roomType = await db.hotelRoomType.findFirstOrThrow({ where: { organizationId: orgA.id, propertyId: propertyA.id } });
    const ratePlan = await db.hotelRatePlan.findFirstOrThrow({ where: { organizationId: orgA.id, propertyId: propertyA.id, roomTypeId: roomType.id } });
    await guestPortal.getByLabel("Room type").selectOption(roomType.id);
    await guestPortal.getByLabel("Rate plan").selectOption(ratePlan.id);
    const browserRequestNames = [`${prefix} Guest contacted`, `${prefix} Guest declined`, `${prefix} Guest cancelled`];
    const browserRequestIds: string[] = [];
    for (const [index, name] of browserRequestNames.entries()) {
      resultStage = `browser-create-request-${index + 1}`;
      await guestPortal.getByRole("button", { name: "Get estimate" }).click();
      await guestPortal.getByText("Display estimate:").waitFor({ state: "visible", timeout: 30_000 });
      await guestPortal.getByLabel("Guest name").fill(name);
      await guestPortal.getByLabel("Message for reception (optional)").fill(`Synthetic enquiry ${index + 1}`);
      await guestPortal.getByRole("button", { name: "Send coordination request" }).click();
      await guestPortal.getByText(name, { exact: false }).waitFor({ state: "visible", timeout: 30_000 });
      const stored = await db.hotelStayRequest.findFirstOrThrow({ where: { organizationId: orgA.id, propertyId: propertyA.id, userId: customer.id, guestName: name }, orderBy: { createdAt: "desc" } });
      browserRequestIds.push(stored.id);
      const snapshot = stored.snapshot as { checkIn?: string; checkOut?: string; adults?: number; totalAmount?: string; currency?: string; policyVersion?: number; propertyId?: string; actorUserId?: string };
      assert.equal(snapshot.checkIn, "2027-12-10");
      assert.equal(snapshot.checkOut, "2027-12-12");
      assert.equal(snapshot.adults, 1);
      assert.equal(snapshot.totalAmount, "250000");
      assert.equal(snapshot.currency, "TOMAN");
      assert.equal(snapshot.policyVersion, 5);
      assert.equal(snapshot.propertyId, propertyA.id);
      assert.equal(snapshot.actorUserId, customer.id);
    }
    assert.equal(browserRequestIds.length, 3);

    resultStage = "damoon-public-contact-to-guest-portal-link";
    const damoonPage = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    damoonPage.setDefaultNavigationTimeout(120_000);
    damoonPage.on("pageerror", error => browserErrors.push(error.name));
    await damoonPage.goto("http://damoon-hotel.ir:3036/en/contact?checkIn=2027-12-10&checkOut=2027-12-12&adults=1&children=0", { waitUntil: "domcontentloaded" });
    const guestPortalLink = damoonPage.getByRole("link", { name: "Continue in guest portal" });
    await guestPortalLink.waitFor({ state: "visible", timeout: 30_000 });
    const damoonGuestPortalHref = await guestPortalLink.getAttribute("href");
    assert.ok(damoonGuestPortalHref);
    const damoonGuestPortalUrl = new URL(damoonGuestPortalHref, "http://damoon-hotel.ir:3036");
    assert.equal(damoonGuestPortalUrl.origin, "http://damoon-hotel.ir:3036");
    assert.equal(damoonGuestPortalUrl.pathname, `/en/hotel/${orgA.id}/${propertyA.id}`);
    assert.equal(damoonGuestPortalUrl.searchParams.get("checkIn"), "2027-12-10");
    assert.equal(damoonGuestPortalUrl.searchParams.get("checkOut"), "2027-12-12");
    assert.equal(damoonGuestPortalUrl.searchParams.get("adults"), "1");
    assert.equal(damoonGuestPortalUrl.searchParams.get("children"), "0");

    resultStage = "customer-review-denial-and-guest-history";
    const requestForReview = browserRequestIds[0]!;
    const deniedReview = await apiJson(endpointA, hostA, originA, customerCookieA, "POST", { action: "review-request", requestId: requestForReview, status: "CONTACTED" }, `${prefix}-customer-review-denied`);
    assert.equal(deniedReview.response.status, 403, "customers cannot mark requests as contacted");
    const guestHistory = await apiJson<{ enabled: boolean; view: string; requests: Array<{ id: string; status: string }> }>(endpointA, hostA, undefined, customerCookieA);
    assert.equal(guestHistory.response.status, 200);
    assert.equal(guestHistory.data?.view, "guest");
    assert.deepEqual(new Set(guestHistory.data?.requests.map(row => row.id)), new Set(browserRequestIds));
    const guestHistoryB = await apiJson<{ requests: unknown[] }>(endpointB, hostB, undefined, customerCookieB);
    assert.deepEqual(guestHistoryB.data?.requests, [], "same account has separate request history per tenant");

    resultStage = "admin-reception-ui";
    const adminReception = await apiJson<{ enabled: boolean; mode: string; view: string; requests: Array<{ id: string; status: string }> }>(endpointA, hostA, undefined, adminCookieA);
    assert.equal(adminReception.response.status, 200);
    assert.equal(adminReception.data?.view, "reception");
    assert.deepEqual(new Set(adminReception.data?.requests.map(row => row.id)), new Set(browserRequestIds));
    const adminContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await adminContext.addCookies(browserCookies(adminLogin.cookies, originA));
    const adminPage = await adminContext.newPage();
    adminPage.setDefaultNavigationTimeout(120_000);
    adminPage.on("pageerror", error => browserErrors.push(error.name));
    await adminPage.goto(`${originA}/en/hotel/${orgA.id}/${propertyA.id}?checkIn=2027-12-10&checkOut=2027-12-12&adults=1`, { waitUntil: "domcontentloaded" });
    const receptionPortal = adminPage.getByRole("region", { name: "Stay coordination requests" });
    await receptionPortal.getByRole("heading", { name: "Stay coordination requests" }).waitFor({ state: "visible", timeout: 120_000 });
    const contactedRow = receptionPortal.locator("li").filter({ hasText: browserRequestNames[0]! });
    await contactedRow.getByRole("button", { name: "Mark contacted" }).click();
    await contactedRow.getByText(/CONTACTED/).waitFor({ state: "visible", timeout: 30_000 });
    const declinedRow = receptionPortal.locator("li").filter({ hasText: browserRequestNames[1]! });
    await declinedRow.getByRole("button", { name: "Decline request" }).click();
    await declinedRow.getByText(/DECLINED/).waitFor({ state: "visible", timeout: 30_000 });
    assert.equal((await db.hotelStayRequest.findUniqueOrThrow({ where: { id: browserRequestIds[0]! } })).status, "CONTACTED");
    assert.equal((await db.hotelStayRequest.findUniqueOrThrow({ where: { id: browserRequestIds[1]! } })).status, "DECLINED");

    resultStage = "customer-cancels-own-request";
    await guestPage.reload({ waitUntil: "domcontentloaded" });
    const cancelledRow = guestPortal.locator("li").filter({ hasText: browserRequestNames[2]! });
    await cancelledRow.getByRole("button", { name: "Cancel request" }).click();
    await cancelledRow.getByText(/CANCELLED/).waitFor({ state: "visible", timeout: 30_000 });
    assert.equal((await db.hotelStayRequest.findUniqueOrThrow({ where: { id: browserRequestIds[2]! } })).status, "CANCELLED");

    resultStage = "request-only-no-booking-mutations";
    const inventoryAfter = await operationalState(db, ownedOrgIds);
    assert.deepEqual(inventoryAfter, inventoryBefore, "request-only interactions leave inventory, holds, reservations and payment state unchanged");
    assert.deepEqual(browserErrors, [], "guest and reception portal pages have no browser runtime errors");
    await adminContext.close();
    await customerContext.close();
    browserPassed = true;
    resultStage = "complete";
    passed = true;
  } catch (error) {
    const failure = error instanceof Error ? error : new Error(String(error));
    console.error(`HOTEL_STAY_REQUESTS_HTTP_FAILURE=${failure.name}: ${failure.message}`);
    throw error;
  } finally {
    resultStage = passed ? "cleanup" : resultStage;
    if (browser) {
      try { await browser.close(); browserStopped = true; }
      catch { browserStopped = false; }
    }
    serverStopped = await stopServer(server);
    try {
      if (ownedOrgIds.length) {
        await db.hotelInventoryIdempotency.deleteMany({ where: { organizationId: { in: ownedOrgIds }, operationScope: "HOTEL_STAY_REQUEST_ACTION" } });
        await db.hotelStayRequest.deleteMany({ where: { organizationId: { in: ownedOrgIds } } });
        await db.hotelStayQuote.deleteMany({ where: { organizationId: { in: ownedOrgIds } } });
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
        await db.hotelRoomType.deleteMany({ where: { id: { in: ownedRoomTypeIds } } });
        await db.hotelProperty.deleteMany({ where: { id: { in: ownedPropertyIds } } });
        await db.customerPhoneSession.deleteMany({ where: { userId: { in: ownedUserIds }, organizationId: { in: ownedOrgIds } } });
        await db.customerClubMembership.deleteMany({ where: { organizationId: { in: ownedOrgIds }, customerId: { in: ownedUserIds } } });
        await db.organizationMember.deleteMany({ where: { organizationId: { in: ownedOrgIds }, userId: { in: ownedUserIds } } });
        await db.organizationDomain.deleteMany({ where: { organizationId: { in: ownedDomainOrgIds } } });
        await db.organizationCapability.deleteMany({ where: { organizationId: { in: ownedOrgIds } } });
        await db.organization.deleteMany({ where: { id: { in: ownedOrgIds } } });
        await db.user.deleteMany({ where: { id: { in: ownedUserIds } } });
        assert.equal(await db.organization.count({ where: { id: { in: ownedOrgIds } } }), 0);
        assert.equal(await db.hotelStayRequest.count({ where: { organizationId: { in: ownedOrgIds } } }), 0);
        assert.equal(await db.hotelStayQuote.count({ where: { organizationId: { in: ownedOrgIds } } }), 0);
        assert.equal(await db.hotelBookingHold.count({ where: { organizationId: { in: ownedOrgIds } } }), 0);
        assert.equal(await db.hotelReservation.count({ where: { organizationId: { in: ownedOrgIds } } }), 0);
        assert.equal(await db.paymentRequest.count({ where: { organizationId: { in: ownedOrgIds } } }), 0);
      }
      fixtureFinalized = true;
      cleanupPassed = true;
    } catch (error) {
      cleanupPassed = false;
      const failure = error instanceof Error ? error : new Error(String(error));
      console.error(`HOTEL_STAY_REQUESTS_HTTP_CLEANUP_FAILURE=${failure.name}: ${failure.message}`);
    } finally {
      await db.$disconnect();
    }
    if (!fixtureFinalized || !serverStopped || !browserStopped) throw new Error("Hotel stay request fixture cleanup failed");
  }
});
