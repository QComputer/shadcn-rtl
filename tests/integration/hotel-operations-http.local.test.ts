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
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { chromium } from "playwright";
import { PrismaHotelRepositories } from "../../lib/hotel/persistence/prisma-hotel-repositories";
import { searchPublicHotelAvailability } from "../../lib/hotel/services/public-availability.service";
import { priceHotelStay } from "../../lib/hotel/services/booking-quote";
import { propertyCalendarDate, offsetPropertyDate } from "../../lib/hotel/domain/property-calendar";

// Real local HTTP acceptance for the Hotel operations APIs and their persisted view.
// Only the guarded disposable PostgreSQL fixture is used; external providers are disabled.
const dbUrl = new URL(process.env.DATABASE_URL ?? "https://missing.invalid");
assert.ok(["postgres:", "postgresql:"].includes(dbUrl.protocol));
assert.equal(dbUrl.hostname, "127.0.0.1");
assert.equal(dbUrl.port, "55439");
assert.equal(dbUrl.pathname, "/retail_hero_test");
assert.equal(decodeURIComponent(dbUrl.username), "hero_test");
assert.equal(decodeURIComponent(dbUrl.password), "local_admin_fixture_only");
assert.equal(dbUrl.search, "", "Prisma URL must not carry query parameters");
assert.equal(process.env.DIRECT_URL, dbUrl.toString());
assert.equal(process.env.LOCAL_PRISMA_EXPECTED_PORT, "55439");
assert.equal(process.env.RETAIL_HERO_EXPECTED_DATABASE, "retail_hero_test");
assert.equal(process.env.DATABASE_RUNTIME_ADAPTER, "postgresql");

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: dbUrl.toString(), max: 6 }), log: [] });
const port = "3034";
const loopback = "127.0.0.1";
const baseUrl = `http://${loopback}:${port}`;
const suffix = randomUUID().replaceAll("-", "");
const prefix = `hotel-ops-${suffix}`;
const hostA = `hotel-ops-a-${suffix}.localhost`;
const hostB = `hotel-ops-b-${suffix}.localhost`;
const originA = `http://${hostA}:${port}`;
const password = `HotelFixture-${randomUUID()}-${randomUUID()}`;
const username = `hotel-ops-admin-${suffix}`;
const platformUsername = `hotel-ops-platform-${suffix}`;
const platformPassword = `HotelPlatformFixture-${randomUUID()}-${randomUUID()}`;
const managerUsername = `hotel-ops-manager-${suffix}`;
const managerPassword = `HotelManagerFixture-${randomUUID()}-${randomUUID()}`;
const staffUsername = `hotel-ops-staff-${suffix}`;
const staffPassword = `HotelStaffFixture-${randomUUID()}-${randomUUID()}`;
const ownedOrgIds: string[] = [];
const ownedDomainOrgIds: string[] = [];
let userId = "";
let platformUserId = "";
let managerUserId = "";
let staffUserId = "";
let propertyAId = "";
let demoPropertyId = "";
let propertyBId = "";
let activationOrgId = "";
let activationPropertyId = "";
let server: ChildProcess | undefined;
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
let testPassed = false;
let browserPassed = false;
let browserStopped = true;
let fixtureCleanupPassed = false;
let serverStopped = true;
let stage = "module-load";

const resultPath = join(process.cwd(), ".tmp", "hotel-operations-p0", "hotel-operations-http.result.json");
process.on("exit", () => {
  const exitCode = process.exitCode ?? (testPassed && fixtureCleanupPassed ? 0 : 1);
  const passed = exitCode === 0 && testPassed && fixtureCleanupPassed && serverStopped && browserStopped && browserPassed;
  try {
    mkdirSync(join(process.cwd(), ".tmp", "hotel-operations-p0"), { recursive: true });
    writeFileSync(resultPath, `${JSON.stringify({
      test: "hotel-operations-http.local.test.ts",
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
    HOTEL_INVENTORY_IDEMPOTENCY_ENABLED: "1",
    HOTEL_MANUAL_ROOM_MANAGEMENT_ENABLED: "1",
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

async function waitForServer() {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    if (server?.exitCode !== null && server?.exitCode !== undefined) throw new Error("isolated Next server exited before readiness");
    try {
      const response = await request("/api/auth/csrf", hostA);
      if (response.status === 200) return;
    } catch { /* wait for Next */ }
    await delay(500);
  }
  throw new Error("isolated Next server did not become ready in 120 seconds");
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
        for (let i = 0; i < incoming.rawHeaders.length; i += 2) responseHeaders.append(incoming.rawHeaders[i]!, incoming.rawHeaders[i + 1]!);
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
    .flatMap((value) => value.split(/,(?=[^;]+=[^;]+)/))
    .map((value) => value.split(";", 1)[0]!)
    .filter(Boolean);
}

function cookieHeader(cookies: string[]) { return cookies.join("; "); }

function mergeCookies(existing: string[], response: Response) {
  const map = new Map(existing.map((cookie) => [cookie.split("=", 1)[0]!, cookie]));
  for (const cookie of setCookies(response)) map.set(cookie.split("=", 1)[0]!, cookie);
  return [...map.values()];
}

async function passwordLogin(loginUsername = username, loginPassword = password) {
  const csrf = await request("/api/auth/csrf");
  assert.equal(csrf.status, 200);
  const initialCookies = setCookies(csrf);
  const { csrfToken } = await csrf.json() as { csrfToken: string };
  const callback = await request("/api/auth/callback/credentials?json=true", hostA, originA, {
    method: "POST",
    redirect: "manual",
    headers: { cookie: cookieHeader(initialCookies), "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ csrfToken, callbackUrl: originA, username: loginUsername, password: loginPassword }),
  });
  const cookies = mergeCookies(initialCookies, callback);
  const sessionResponse = await request("/api/auth/session", hostA, undefined, { headers: { cookie: cookieHeader(cookies) } });
  assert.equal(sessionResponse.status, 200);
  return { callback, cookies, session: await sessionResponse.json() as { user?: { id?: string; role?: string; organizationId?: string | null } } };
}

async function apiJson<T>(path: string, cookie: string, method = "GET", body?: unknown, extraHeaders: Record<string, string> = {}) {
  const response = await request(path, hostA, method === "GET" ? undefined : originA, {
    method,
    headers: { cookie, ...(body === undefined ? {} : { "content-type": "application/json" }), ...extraHeaders },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const text = await response.text();
  let data: T | null = null;
  if (text) {
    try { data = JSON.parse(text) as T; } catch { /* preserve status for caller */ }
  }
  return { response, data };
}

async function readPreviewMutationSnapshot(organizationId: string) {
  const orderBy = { id: "asc" as const };
  const [inventory, holds, reservations, payments, allocations, adjustments, stayQuotes, stayRequests, guestRequests, holdIdempotency, reservationNights, paymentEvents, inventoryIdempotency] = await Promise.all([
    db.hotelInventory.findMany({ where: { organizationId }, orderBy }),
    db.hotelBookingHold.findMany({ where: { organizationId }, orderBy }),
    db.hotelReservation.findMany({ where: { organizationId }, orderBy }),
    db.hotelOfflinePayment.findMany({ where: { organizationId }, orderBy }),
    db.hotelPaymentAllocation.findMany({ where: { organizationId }, orderBy }),
    db.hotelInventoryAdjustment.findMany({ where: { organizationId }, orderBy }),
    db.hotelStayQuote.findMany({ where: { organizationId }, orderBy }),
    db.hotelStayRequest.findMany({ where: { organizationId }, orderBy }),
    db.hotelGuestBookingRequest.findMany({ where: { organizationId }, orderBy }),
    db.hotelBookingHoldIdempotency.findMany({ where: { organizationId }, orderBy }),
    db.hotelReservationRoom.findMany({ where: { organizationId }, orderBy }),
    db.hotelOfflinePaymentAuditEvent.findMany({ where: { organizationId }, orderBy }),
    db.hotelInventoryIdempotency.findMany({ where: { organizationId }, orderBy }),
  ]);
  return { inventory, holds, reservations, payments, allocations, adjustments, stayQuotes, stayRequests, guestRequests, holdIdempotency, reservationNights, paymentEvents, inventoryIdempotency };
}

before(async () => {
  stage = "database-identity-guard";
  const identity = await db.$queryRaw<Array<{ database: string; role: string }>>`SELECT current_database()::text AS database, current_user::text AS role`;
  assert.deepEqual(identity, [{ database: "retail_hero_test", role: "hero_test" }]);

  stage = "fixture-creation";
  const orgA = await db.organization.create({ data: { name: `${prefix}-a`, slug: "damoon-hotel", type: "SHOP", vertical: "HOTEL", locale: "fa", capabilitiesInitializedAt: new Date() } });
  ownedOrgIds.push(orgA.id);
  const orgB = await db.organization.create({ data: { name: `${prefix}-b`, slug: `${prefix}-b`, type: "SHOP", vertical: "HOTEL", locale: "fa", capabilitiesInitializedAt: new Date() } });
  ownedOrgIds.push(orgB.id);
  const activationOrg = await db.organization.create({ data: { name: `${prefix}-activation`, slug: `${prefix}-activation`, type: "SHOP", vertical: "HOTEL", locale: "fa", capabilitiesInitializedAt: new Date() } });
  activationOrgId = activationOrg.id;
  ownedOrgIds.push(activationOrg.id);
  await db.organizationCapability.create({ data: { organizationId: activationOrg.id, key: "HOTEL_WEBSITE", status: "ACTIVE", enabledAt: new Date() } });
  const activationProperty = await db.hotelProperty.create({ data: { organizationId: activationOrg.id, organizationSlug: activationOrg.slug, slug: `${prefix}-activation-property`, name: `${prefix} activation property` } });
  activationPropertyId = activationProperty.id;
  await db.organizationCapability.createMany({ data: [orgA, orgB].map((organization) => ({ organizationId: organization.id, key: "HOTEL_BOOKING", status: "ACTIVE", enabledAt: new Date() })) });
  await db.organizationDomain.createMany({ data: [
    { organizationId: orgA.id, domain: hostA, normalizedDomain: hostA, status: "ACTIVE", providerVerified: true, dnsConfigured: true, sslReady: true, verifiedAt: new Date() },
    { organizationId: orgB.id, domain: hostB, normalizedDomain: hostB, status: "ACTIVE", providerVerified: true, dnsConfigured: true, sslReady: true, verifiedAt: new Date() },
  ] });
  ownedDomainOrgIds.push(...ownedOrgIds);
  const user = await db.user.create({ data: { name: username, password: await bcrypt.hash(password, 10), role: "ADMIN", isTeamMember: true } });
  userId = user.id;
  await db.organizationMember.create({ data: { organizationId: orgA.id, organizationSlug: orgA.slug, userId, role: "ADMIN", isActive: true } });
  const platformUser = await db.user.create({ data: { name: platformUsername, password: await bcrypt.hash(platformPassword, 10), role: "SUPER_ADMIN", isTeamMember: true } });
  platformUserId = platformUser.id;
  const manager = await db.user.create({ data: { name: managerUsername, password: await bcrypt.hash(managerPassword, 10), role: "MANAGER", isTeamMember: true } });
  managerUserId = manager.id;
  await db.organizationMember.create({ data: { organizationId: orgA.id, organizationSlug: orgA.slug, userId: managerUserId, role: "MANAGER", isActive: true } });
  const staff = await db.user.create({ data: { name: staffUsername, password: await bcrypt.hash(staffPassword, 10), role: "STAFF", isTeamMember: true } });
  staffUserId = staff.id;
  await db.organizationMember.create({ data: { organizationId: orgA.id, organizationSlug: orgA.slug, userId: staffUserId, role: "STAFF", isActive: true } });

  await assertPortFree();
  server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "--hostname", loopback, "--port", port], {
    cwd: process.cwd(), env: isolatedServerEnv(), stdio: "ignore", windowsHide: true,
  });
  serverStopped = false;
  await waitForServer();
});

after(async () => {
  let cleanupError = false;
  try {
    if (browser) {
      try { await browser.close(); browserStopped = true; }
      catch { cleanupError = true; browserStopped = false; }
    }
    if (server && server.exitCode === null) {
      const serverExit = once(server, "exit").then(() => true);
      server.kill();
      const exited = await Promise.race([serverExit, delay(10_000).then(() => false)]);
      if (!exited) {
        server.kill("SIGKILL");
        const forcedExit = await Promise.race([serverExit, delay(5_000).then(() => false)]);
        if (!forcedExit) throw new Error("isolated Next server did not stop");
      }
    }
    serverStopped = !server || server.exitCode !== null || server.signalCode !== null;
    if (ownedOrgIds.length) {
      await db.hotelReservation.deleteMany({ where: { organizationId: { in: ownedOrgIds } } });
      await db.hotelBookingHold.deleteMany({ where: { organizationId: { in: ownedOrgIds } } });
      await db.hotelStayQuote.deleteMany({ where: { organizationId: { in: ownedOrgIds } } });
      await db.hotelStayRequest.deleteMany({ where: { organizationId: { in: ownedOrgIds } } });
      await db.hotelInventoryAdjustment.deleteMany({ where: { organizationId: { in: ownedOrgIds } } });
      await db.hotelInventory.deleteMany({ where: { organizationId: { in: ownedOrgIds } } });
      await db.hotelInventoryIdempotency.deleteMany({ where: { organizationId: { in: ownedOrgIds } } });
      await db.hotelNightlyRate.deleteMany({ where: { organizationId: { in: ownedOrgIds } } });
      await db.hotelRatePlan.deleteMany({ where: { organizationId: { in: ownedOrgIds } } });
      await db.hotelRoomMaintenanceBlock.deleteMany({ where: { organizationId: { in: ownedOrgIds } } });
      await db.hotelRoom.deleteMany({ where: { organizationId: { in: ownedOrgIds } } });
      await db.hotelRoomType.deleteMany({ where: { organizationId: { in: ownedOrgIds } } });
      await db.hotelProperty.deleteMany({ where: { organizationId: { in: ownedOrgIds } } });
      await db.organizationMember.deleteMany({ where: { organizationId: { in: ownedOrgIds }, userId: { in: [userId, managerUserId, staffUserId] } } });
      await db.organizationDomain.deleteMany({ where: { organizationId: { in: ownedDomainOrgIds } } });
      await db.organizationCapability.deleteMany({ where: { organizationId: { in: ownedOrgIds } } });
      await db.auditLog.deleteMany({ where: { organizationId: { in: ownedOrgIds } } });
      await db.organization.deleteMany({ where: { id: { in: ownedOrgIds } } });
      if (userId) await db.user.deleteMany({ where: { id: userId } });
      if (platformUserId) await db.user.deleteMany({ where: { id: platformUserId } });
      if (managerUserId) await db.user.deleteMany({ where: { id: managerUserId } });
      if (staffUserId) await db.user.deleteMany({ where: { id: staffUserId } });
      assert.equal(await db.organization.count({ where: { id: { in: ownedOrgIds } } }), 0);
      assert.equal(await db.hotelInventory.count({ where: { organizationId: { in: ownedOrgIds } } }), 0);
      assert.equal(await db.hotelReservation.count({ where: { organizationId: { in: ownedOrgIds } } }), 0);
      assert.equal(await db.hotelBookingHold.count({ where: { organizationId: { in: ownedOrgIds } } }), 0);
      assert.equal(await db.hotelProperty.count({ where: { organizationId: { in: ownedOrgIds } } }), 0);
      if (userId) assert.equal(await db.user.count({ where: { id: userId } }), 0);
      if (platformUserId) assert.equal(await db.user.count({ where: { id: platformUserId } }), 0);
      if (managerUserId) assert.equal(await db.user.count({ where: { id: managerUserId } }), 0);
      if (staffUserId) assert.equal(await db.user.count({ where: { id: staffUserId } }), 0);
    }
    fixtureCleanupPassed = true;
  } catch {
    cleanupError = true;
  } finally {
    await db.$disconnect();
    console.log("HOTEL_OPERATIONS_HTTP_SERVER_OUTPUT_SUPPRESSED");
    console.log(`HOTEL_OPERATIONS_HTTP_CLEANUP=${fixtureCleanupPassed && serverStopped ? "PASSED" : "FAILED"}`);
  }
  if (cleanupError || !fixtureCleanupPassed || !serverStopped) throw new Error("Hotel operations HTTP fixture cleanup failed");
});

it("persists Hotel operations changes, reloads the scoped operations view, and denies another tenant", async () => {
  stage = "admin-password-login";
  const login = await passwordLogin();
  assert.ok([200, 302].includes(login.callback.status));
  assert.equal(login.session.user?.id, userId);
  assert.equal(login.session.user?.role, "ADMIN");
  const orgAId = login.session.user?.organizationId;
  assert.ok(orgAId);
  const cookie = cookieHeader(login.cookies);

  stage = "create-property";
  const propertyResult = await apiJson<{ property: { id: string; slug: string; name: string } }>(`/api/organizations/${orgAId}/hotels`, cookie, "POST", { slug: `${prefix}-property-a`, name: `${prefix} Property A`, timezone: "Asia/Tehran" });
  assert.equal(propertyResult.response.status, 201);
  assert.ok(propertyResult.data?.property.id);
  propertyAId = propertyResult.data!.property.id;
  const demoProperty = await db.hotelProperty.create({ data: { organizationId: orgAId, organizationSlug: "damoon-hotel", slug: "damoon-demo", name: `${prefix} Demo property`, timezone: "Asia/Tehran" } });
  demoPropertyId = demoProperty.id;
  const propertyB = await db.hotelProperty.create({ data: { organizationId: ownedOrgIds[1]!, organizationSlug: `${prefix}-b`, slug: `${prefix}-property-b`, name: `${prefix} Property B` } });
  propertyBId = propertyB.id;

  stage = "create-room-type";
  const roomTypeResult = await apiJson<{ roomType: { id: string; slug: string; name: string } }>(`/api/organizations/${orgAId}/hotels/${propertyAId}/room-types`, cookie, "POST", {
    slug: `${prefix}-standard`, name: `${prefix} Standard`, description: "HTTP fixture room type", maxAdults: 2, maxChildren: 1, maxOccupancy: 3, beds: [{ kind: "queen", count: 1 }],
  });
  assert.equal(roomTypeResult.response.status, 201);
  assert.ok(roomTypeResult.data?.roomType.id);
  const roomTypeId = roomTypeResult.data!.roomType.id;

  stage = "create-physical-room";
  const roomResult = await apiJson<{ room: { id: string; code: string } }>(`/api/organizations/${orgAId}/hotels/${propertyAId}/rooms`, cookie, "POST", { roomTypeId, code: `${suffix.slice(0, 5)}-101`, floor: "1" });
  assert.equal(roomResult.response.status, 201);
  assert.ok(roomResult.data?.room.id);
  const secondRoomResult = await apiJson<{ room: { id: string; code: string } }>(`/api/organizations/${orgAId}/hotels/${propertyAId}/rooms`, cookie, "POST", { roomTypeId, code: `${suffix.slice(0, 5)}-102`, floor: "1" });
  assert.equal(secondRoomResult.response.status, 201);
  assert.ok(secondRoomResult.data?.room.id);
  await db.hotelRoomMaintenanceBlock.create({ data: {
    organizationId: orgAId, propertyId: propertyAId, roomId: roomResult.data!.room.id,
    from: new Date("2027-08-08T00:00:00.000Z"), to: new Date("2027-08-10T00:00:00.000Z"),
    reason: "Synthetic browser acceptance maintenance", idempotencyKey: `browser-maintenance-${suffix}`,
    requestFingerprint: `browser-maintenance-fingerprint-${suffix}`, createdBy: managerUserId,
  } });

  stage = "create-cancellation-policy";
  const policyResult = await apiJson<{ policy: { id: string; key: string } }>(`/api/organizations/${orgAId}/hotels/${propertyAId}/cancellation-policies`, cookie, "POST", { key: `${suffix.slice(0, 8)}-preview`, name: `${prefix} Preview cancellation`, freeCancellationCutoffHours: 48, fullCancellationRetention: 0 });
  assert.equal(policyResult.response.status, 201);
  assert.ok(policyResult.data?.policy.id);

  stage = "create-rate-plan-and-nightly-rate";
  const ratePlanResult = await apiJson<{ ratePlan: { id: string; code: string; baseNightlyRate: string } }>(`/api/organizations/${orgAId}/hotels/${propertyAId}/rate-plans`, cookie, "POST", {
    roomTypeId, code: `${suffix.slice(0, 6)}-FLEX`, name: `${prefix} Flexible`, baseNightlyRate: "250000", minNights: 1, isRefundable: true, cancellationPolicyId: policyResult.data!.policy.id,
  });
  assert.equal(ratePlanResult.response.status, 201);
  assert.ok(ratePlanResult.data?.ratePlan.id);
  const ratePlanId = ratePlanResult.data!.ratePlan.id;
  stage = "update-rate-plan-base-nightly-rate";
  const updatedRatePlan = await apiJson<{ ratePlan: { id: string; baseNightlyRate: string } }>(`/api/organizations/${orgAId}/hotels/${propertyAId}/rate-plans/${ratePlanId}`, cookie, "PATCH", {
    baseNightlyRate: "260000",
  });
  assert.equal(updatedRatePlan.response.status, 200);
  assert.equal(updatedRatePlan.data?.ratePlan.id, ratePlanId);
  assert.equal(updatedRatePlan.data?.ratePlan.baseNightlyRate, "260000");
  const from = "2027-06-10";
  const to = "2027-06-12";
  const rateResult = await apiJson<{ nightlyRate: { id: string; nightlyRate: string } }>(`/api/organizations/${orgAId}/hotels/${propertyAId}/rate-plans/${ratePlanId}/nightly-rates`, cookie, "PUT", { from, to, nightlyRate: "275000", minNights: 1 });
  assert.equal(rateResult.response.status, 200);
  assert.ok(rateResult.data?.nightlyRate.id);

  stage = "initialize-inventory-idempotently";
  const initializePath = `/api/organizations/${orgAId}/hotels/${propertyAId}/inventory/initialize`;
  const initBody = { roomTypeId, from, to, allotment: 3, reason: "local HTTP acceptance fixture" };
  const idempotencyKey = `hotel-operations-${suffix}`;
  const initialized = await apiJson<{ inventoryInitialization: { createdCount: number; skippedExistingCount: number; requestedNights: number } }>(initializePath, cookie, "POST", initBody, { "idempotency-key": idempotencyKey });
  assert.equal(initialized.response.status, 201);
  assert.equal(initialized.data?.inventoryInitialization.createdCount, 2);
  assert.equal(initialized.data?.inventoryInitialization.requestedNights, 2);
  const replay = await apiJson<{ inventoryInitialization: { createdCount: number; skippedExistingCount: number } }>(initializePath, cookie, "POST", initBody, { "idempotency-key": idempotencyKey });
  assert.equal(replay.response.status, 201);
  assert.deepEqual(replay.data, initialized.data);

  stage = "operations-reload-and-tenant-isolation";
  const operationsPath = `/api/organizations/${orgAId}/hotels/${propertyAId}/operations?from=${from}&to=${to}`;
  const operations = await apiJson<{ property: { id: string }; range: { nights: number }; roomTypes: Array<{ id: string; rooms: Array<{ id: string }>; physicalCapacity: { configuredRooms: number; sellableRooms: number } }>; ratePlans: Array<{ id: string; baseNightlyRate: string; nightlyRates: Array<{ nightlyRate: string }> }>; inventory: Array<{ roomTypeId: string; allotment: number; available: number }>; cancellationPolicies: Array<{ id: string; isActive: boolean }> }>(operationsPath, cookie);
  assert.equal(operations.response.status, 200);
  assert.equal(operations.data?.property.id, propertyAId);
  assert.equal(operations.data?.range.nights, 2);
  assert.ok(operations.data?.roomTypes.some((roomType) => roomType.id === roomTypeId && roomType.rooms.length === 2), "operations reload includes both configured physical rooms");
  assert.deepEqual(operations.data?.roomTypes.find((roomType) => roomType.id === roomTypeId)?.physicalCapacity, { configuredRooms: 2, sellableRooms: 2 });
  assert.ok(operations.data?.ratePlans.some((plan) => plan.id === ratePlanId && plan.baseNightlyRate === "260000" && plan.nightlyRates.some((rate) => rate.nightlyRate === "275000")));
  assert.equal(operations.data?.inventory.length, 2);
  assert.ok(operations.data?.inventory.every((night) => night.roomTypeId === roomTypeId && night.allotment === 3 && night.available === 2));
  assert.ok(operations.data?.cancellationPolicies.some((policy) => policy.id === policyResult.data!.policy.id && policy.isActive));
  const reloaded = await apiJson<typeof operations.data>(operationsPath, cookie);
  assert.equal(reloaded.response.status, 200);
  assert.deepEqual(reloaded.data, operations.data);

  stage = "manager-configuration-drives-guest-availability-and-quote";
  const repository = new PrismaHotelRepositories(db);
  const guestSearch = await searchPublicHotelAvailability({ scope: { organizationId: orgAId }, propertySlug: `${prefix}-property-a`, query: { propertyId: propertyAId, window: { checkIn: from, checkOut: to }, occupancy: { adults: 2, children: 0, childAges: [] } } }, repository);
  const guestOption = guestSearch?.options.find((option) => option.roomType.id === roomTypeId && option.ratePlan.id === ratePlanId);
  assert.ok(guestOption?.isAvailable, "manager-created inventory and rate must appear in guest availability");
  assert.deepEqual(guestOption.nightlyRates, [275000, 275000], "guest search uses the manager's dated nightly rate, not a silent example price");
  assert.equal(guestOption.availableRoomCount, 2);

  stage = "owner-only-read-only-availability-preview";
  const previewPath = `/api/organizations/${orgAId}/hotels/${propertyAId}/availability-preview?checkIn=${from}&checkOut=${to}&adults=2&children=0`;
  const beforePreview = await readPreviewMutationSnapshot(orgAId);
  const anonymousPreview = await apiJson(previewPath, "");
  assert.equal(anonymousPreview.response.status, 401, "availability preview requires an authenticated owner");
  const invalidDatePreview = await apiJson(`/api/organizations/${orgAId}/hotels/${propertyAId}/availability-preview?checkIn=${from}&checkOut=${from}&adults=2&children=0`, cookie);
  assert.equal(invalidDatePreview.response.status, 422, "same-day check-in and check-out follows the established Hotel validation contract");
  const invalidChildrenPreview = await apiJson(`/api/organizations/${orgAId}/hotels/${propertyAId}/availability-preview?checkIn=${from}&checkOut=${to}&adults=2&children=1&childAges=`, cookie);
  assert.equal(invalidChildrenPreview.response.status, 400, "child occupancy requires one valid age per child");
  assert.equal(invalidChildrenPreview.response.headers.get("cache-control"), "private, no-store", "invalid private preview responses are not cached");
  const crossTenantPreview = await apiJson(`/api/organizations/${ownedOrgIds[1]}/hotels/${propertyBId}/availability-preview?checkIn=${from}&checkOut=${to}&adults=2&children=0`, cookie);
  assert.equal(crossTenantPreview.response.status, 403, "owner authority is scoped to the active tenant and property");
  const managerLogin = await passwordLogin(managerUsername, managerPassword);
  assert.equal(managerLogin.session.user?.role, "MANAGER");
  const managerCookie = cookieHeader(managerLogin.cookies);
  const managerOperations = await apiJson(operationsPath, managerCookie);
  assert.equal(managerOperations.response.status, 200, "manager's existing operational access remains unchanged");
  const managerPreview = await apiJson(previewPath, managerCookie);
  assert.equal(managerPreview.response.status, 403, "a manager may use operations but cannot access owner-only preview");
  const staffLogin = await passwordLogin(staffUsername, staffPassword);
  assert.equal(staffLogin.session.user?.role, "STAFF");
  const staffPreview = await apiJson(previewPath, cookieHeader(staffLogin.cookies));
  assert.equal(staffPreview.response.status, 403, "staff membership cannot access owner-only preview");
  const ownerPreview = await apiJson<{ inventoryReserved: false; nights: string[]; options: Array<{ roomType: { id: string }; ratePlan: { id: string }; nightlyRates: string[]; totalRate: string; availableRoomCount: number; isAvailable: boolean }> }>(previewPath, cookie);
  assert.equal(ownerPreview.response.status, 200);
  assert.equal(ownerPreview.response.headers.get("cache-control"), "private, no-store");
  assert.equal(ownerPreview.data?.inventoryReserved, false);
  assert.deepEqual(ownerPreview.data?.nights, guestSearch?.nights);
  const ownerOption = ownerPreview.data?.options.find((option) => option.roomType.id === roomTypeId && option.ratePlan.id === ratePlanId);
  assert.ok(ownerOption?.isAvailable);
  assert.equal(ownerOption.availableRoomCount, guestOption.availableRoomCount);
  assert.deepEqual(ownerOption.nightlyRates, guestOption.nightlyRates.map(String));
  assert.equal(ownerOption.totalRate, String(guestOption.totalRate));
  const platformLogin = await passwordLogin(platformUsername, platformPassword);
  assert.ok([200, 302].includes(platformLogin.callback.status));
  assert.equal(platformLogin.session.user?.role, "SUPER_ADMIN");
  const platformPreview = await apiJson<typeof ownerPreview.data>(previewPath, cookieHeader(platformLogin.cookies));
  assert.equal(platformPreview.response.status, 200, "verified active platform super-admin may preview an authorized tenant property");

  stage = "audited-additive-hotel-booking-capability-activation";
  const activationPath = `/api/platform/hotel-organizations/${activationOrgId}/booking-capability`;
  const platformCookie = cookieHeader(platformLogin.cookies);
  const activationBeforeRejectedRequests = await db.organizationCapability.findMany({ where: { organizationId: activationOrgId }, orderBy: { key: "asc" } });
  const adminActivation = await apiJson(activationPath, cookie, "POST", { organizationSlug: `${prefix}-activation`, propertyId: activationPropertyId });
  assert.equal(adminActivation.response.status, 403, "organization ADMIN cannot grant platform capabilities");
  const wrongSlugActivation = await apiJson(activationPath, platformCookie, "POST", { organizationSlug: `${prefix}-wrong`, propertyId: activationPropertyId });
  assert.equal(wrongSlugActivation.response.status, 409, "activation fails closed when the confirmed tenant slug differs");
  const wrongPropertyActivation = await apiJson(activationPath, platformCookie, "POST", { organizationSlug: `${prefix}-activation`, propertyId: propertyAId });
  assert.equal(wrongPropertyActivation.response.status, 409, "activation fails closed for a property belonging to another tenant");
  assert.deepEqual(await db.organizationCapability.findMany({ where: { organizationId: activationOrgId }, orderBy: { key: "asc" } }), activationBeforeRejectedRequests, "rejected activation attempts do not mutate capabilities");
  const activationBefore = await db.organizationCapability.findMany({ where: { organizationId: activationOrgId }, orderBy: { key: "asc" } });
  assert.deepEqual(activationBefore.map((row) => row.key), ["HOTEL_WEBSITE"], "fixture begins with the unrelated capability active and HOTEL_BOOKING missing");
  const capabilityResult = await apiJson<{ changed: boolean; auditId: string | null; capabilityId: string; status: string; disabledAt: string | null }>(activationPath, platformCookie, "POST", { organizationSlug: `${prefix}-activation`, propertyId: activationPropertyId });
  assert.equal(capabilityResult.response.status, 200);
  assert.equal(capabilityResult.data?.changed, true);
  assert.equal(capabilityResult.data?.status, "ACTIVE");
  assert.equal(capabilityResult.data?.disabledAt, null);
  assert.ok(capabilityResult.data?.auditId);
  const activationAfter = await db.organizationCapability.findMany({ where: { organizationId: activationOrgId }, orderBy: { key: "asc" } });
  assert.deepEqual(activationAfter.map((row) => row.key), ["HOTEL_BOOKING", "HOTEL_WEBSITE"], "additive activation preserves HOTEL_WEBSITE");
  assert.equal(activationAfter.find((row) => row.key === "HOTEL_WEBSITE")?.status, "ACTIVE");
  assert.equal((await db.organization.findUniqueOrThrow({ where: { id: activationOrgId } })).type, "SHOP", "legacy organization type is unchanged");
  const activationAudit = await db.auditLog.findUniqueOrThrow({ where: { id: capabilityResult.data!.auditId } });
  assert.equal(activationAudit.userId, platformUserId);
  assert.equal(activationAudit.organizationId, activationOrgId);
  const auditCount = await db.auditLog.count({ where: { organizationId: activationOrgId } });
  const idempotentActivation = await apiJson<typeof capabilityResult.data>(activationPath, platformCookie, "POST", { organizationSlug: `${prefix}-activation`, propertyId: activationPropertyId });
  assert.equal(idempotentActivation.response.status, 200);
  assert.equal(idempotentActivation.data?.changed, false);
  assert.equal(await db.auditLog.count({ where: { organizationId: activationOrgId } }), auditCount, "idempotent retry does not duplicate the audit event");

  const publicSearchResponse = await request("/api/hotel/v1/availability/search", hostA, originA, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ property: `${prefix}-property-a`, checkIn: from, checkOut: to, occupancy: { adults: 2, children: 0, childAges: [] } }) });
  assert.notEqual(publicSearchResponse.status, 200, "the owner preview does not bypass the separate public publication/booking gate");
  assert.deepEqual(await readPreviewMutationSnapshot(orgAId), beforePreview, "owner preview performs no inventory, hold, reservation, payment, quote, request, idempotency, allocation, or audit mutations");

  const quoteProperty = await db.hotelProperty.findUniqueOrThrow({ where: { id: propertyAId } });
  const quoteResult = await db.$transaction((tx) => priceHotelStay(tx, quoteProperty, userId, { action: "quote", roomTypeId, ratePlanId, checkIn: from, checkOut: to, adults: 2, childAges: [] }, new Date("2027-01-01T00:00:00.000Z")));
  assert.equal(quoteResult.quote?.totalAmount, "550000", "quote matches the visible nightly rates");
  assert.deepEqual(quoteResult.quote?.nightlyRates, [275000, 275000]);

  stage = "nightly-inventory-difference-across-stay";
  const adjustmentPath = `/api/organizations/${orgAId}/hotels/${propertyAId}/inventory/adjustments`;
  const adjustment = await apiJson(adjustmentPath, cookie, "POST", { roomTypeId, date: "2027-06-11", outOfServiceDelta: 2, reason: "test a single constrained night" }, { "idempotency-key": `hotel-oos-${suffix}` });
  assert.equal(adjustment.response.status, 200, `isolated inventory adjustment should succeed: ${JSON.stringify(adjustment.data)}`);
  const constrainedSearch = await searchPublicHotelAvailability({ scope: { organizationId: orgAId }, propertySlug: `${prefix}-property-a`, query: { propertyId: propertyAId, window: { checkIn: from, checkOut: to }, occupancy: { adults: 2, children: 0, childAges: [] } } }, repository);
  const constrainedOption = constrainedSearch?.options.find((option) => option.roomType.id === roomTypeId && option.ratePlan.id === ratePlanId);
  assert.equal(constrainedOption?.availableRoomCount, 1, "the stay uses the lowest per-night capacity across consecutive nights");
  const constrainedPreview = await apiJson<typeof ownerPreview.data>(previewPath, cookie);
  assert.equal(constrainedPreview.response.status, 200);
  assert.equal(constrainedPreview.data?.options.find((option) => option.roomType.id === roomTypeId && option.ratePlan.id === ratePlanId)?.availableRoomCount, 1, "preview enforces the same multi-night physical capacity minimum as guest search");
  const constrainedQuote = await db.$transaction((tx) => priceHotelStay(tx, quoteProperty, userId, { action: "quote", roomTypeId, ratePlanId, checkIn: from, checkOut: to, adults: 2, childAges: [] }, new Date("2027-01-01T00:00:00.000Z")));
  assert.equal(constrainedQuote.quote?.totalAmount, "550000");

  stage = "physical-out-of-service-and-disabled-room-capacity";
  const roomPath = `/api/organizations/${orgAId}/hotels/${propertyAId}/rooms`;
  const roomIds = [roomResult.data!.room.id, secondRoomResult.data!.room.id];
  const disableSecond = await apiJson(`${roomPath}/${roomIds[1]}`, cookie, "PATCH", { isOutOfService: true });
  assert.equal(disableSecond.response.status, 200);
  const partialPhysical = await searchPublicHotelAvailability({ scope: { organizationId: orgAId }, propertySlug: `${prefix}-property-a`, query: { propertyId: propertyAId, window: { checkIn: from, checkOut: "2027-06-11" }, occupancy: { adults: 2, children: 0, childAges: [] } } }, repository);
  const partialOption = partialPhysical?.options.find((option) => option.roomType.id === roomTypeId);
  assert.equal(partialOption?.availableRoomCount, 1, "inactive physical capacity constrains the higher aggregate inventory");

  const disableFirst = await apiJson(`${roomPath}/${roomIds[0]}`, cookie, "PATCH", { isOutOfService: true });
  assert.equal(disableFirst.response.status, 200);
  const noRooms = await searchPublicHotelAvailability({ scope: { organizationId: orgAId }, propertySlug: `${prefix}-property-a`, query: { propertyId: propertyAId, window: { checkIn: from, checkOut: "2027-06-11" }, occupancy: { adults: 2, children: 0, childAges: [] } } }, repository);
  assert.equal(noRooms?.options.find((option) => option.roomType.id === roomTypeId)?.availableRoomCount, 0, "configured but disabled physical rooms are not treated as legacy unconfigured inventory");
  await assert.rejects(() => db.$transaction((tx) => priceHotelStay(tx, quoteProperty, userId, { action: "quote", roomTypeId, ratePlanId, checkIn: from, checkOut: "2027-06-11", adults: 2, childAges: [] }, new Date("2027-01-01T00:00:00.000Z"))), /No inventory/i);

  const restoreFirst = await apiJson(`${roomPath}/${roomIds[0]}`, cookie, "PATCH", { isOutOfService: false });
  assert.equal(restoreFirst.response.status, 200);
  const tenantLeak = await repository.getPhysicalRoomCapacities({ organizationId: ownedOrgIds[1]! }, propertyAId, [roomTypeId]);
  assert.deepEqual(tenantLeak, [], "physical capacity reads remain property and tenant scoped");

  stage = "concurrent-holds-and-room-capacity-serialization";
  const attemptHold = (index: number) => {
    const id = randomUUID(), now = new Date("2027-01-01T00:00:00.000Z");
    return repository.claimInventoryAndCreateHold({ scope: { organizationId: orgAId }, propertyId: propertyAId, roomTypeId, nights: [from], quantity: 1, now, hold: { id, organizationId: orgAId, propertyId: propertyAId, roomTypeId, reference: `H-${index}-${id}`, checkIn: from, checkOut: "2027-06-11", nights: [from], quantity: 1, expiresAt: new Date("2027-01-01T00:15:00.000Z"), status: "ACTIVE", createdAt: now } });
  };
  const racingHolds = await Promise.all([attemptHold(0), attemptHold(1)]);
  assert.equal(racingHolds.filter((result) => result.isClaimed).length, 1, "only one concurrent hold may claim the final physical room");
  const claimedHold = racingHolds.find((result) => result.isClaimed);
  assert.ok(claimedHold?.hold?.id);
  const cannotDisableCommittedRoom = await apiJson(`${roomPath}/${roomIds[0]}`, cookie, "PATCH", { isOutOfService: true });
  assert.equal(cannotDisableCommittedRoom.response.status, 422, "manager cannot remove capacity beneath an active hold");
  const released = await repository.releaseHold({ organizationId: orgAId }, claimedHold!.hold!.id, new Date("2027-01-01T00:01:00.000Z"));
  assert.equal(released.isReleased, true);

  const [racingHold, racingRoomDeactivation] = await Promise.all([
    attemptHold(2),
    apiJson(`${roomPath}/${roomIds[0]}`, cookie, "PATCH", { isOutOfService: true }),
  ]);
  assert.ok(
    (racingHold.isClaimed && racingRoomDeactivation.response.status === 422) ||
      (!racingHold.isClaimed && racingHold.reason === "NO_INVENTORY" && racingRoomDeactivation.response.status === 200),
    "a final-room hold and physical-room deactivation serialize under READ COMMITTED without overselling",
  );
  if (racingHold.isClaimed && racingHold.hold?.id) {
    assert.equal((await repository.releaseHold({ organizationId: orgAId }, racingHold.hold.id, new Date("2027-01-01T00:02:00.000Z"))).isReleased, true);
  } else {
    assert.equal((await apiJson(`${roomPath}/${roomIds[0]}`, cookie, "PATCH", { isOutOfService: false })).response.status, 200);
  }

  stage = "missing-inventory-is-not-synthesized";
  const missingInventoryRange = await searchPublicHotelAvailability({ scope: { organizationId: orgAId }, propertySlug: `${prefix}-property-a`, query: { propertyId: propertyAId, window: { checkIn: "2027-06-12", checkOut: "2027-06-13" }, occupancy: { adults: 2, children: 0, childAges: [] } } }, repository);
  const missingNightOption = missingInventoryRange?.options.find((option) => option.roomType.id === roomTypeId && option.ratePlan.id === ratePlanId);
  assert.equal(missingNightOption?.isAvailable, false, "missing inventory remains unavailable rather than inheriting adjacent configured nights");
  assert.equal(missingNightOption?.availableRoomCount, 0);

  const crossTenantOperations = await apiJson(`/api/organizations/${ownedOrgIds[1]}/hotels/${propertyBId}/operations?from=${from}&to=${to}`, cookie);
  assert.equal(crossTenantOperations.response.status, 403);
  const crossTenantCreate = await apiJson(`/api/organizations/${ownedOrgIds[1]}/hotels/${propertyBId}/room-types`, cookie, "POST", {
    slug: `${prefix}-foreign`, name: `${prefix} Foreign`, description: "must be denied", maxAdults: 2, maxChildren: 0, maxOccupancy: 2, beds: [{ kind: "queen", count: 1 }],
  });
  assert.equal(crossTenantCreate.response.status, 403);

  stage = "browser-room-type-create-and-reload";
  browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--no-sandbox"] });
  browserStopped = false;
  const context = await browser.newContext({ viewport: { width: 1280, height: 850 } });
  const browserCookies = login.cookies.map((value) => {
    const separator = value.indexOf("=");
    return { name: value.slice(0, separator), value: value.slice(separator + 1), url: baseUrl };
  }).filter((entry) => entry.name && entry.value);
  await context.addCookies(browserCookies);
  const page = await context.newPage();
  page.setDefaultNavigationTimeout(120_000); // First dashboard compile is cold in the isolated Next server.
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.name));
  await page.goto(`${baseUrl}/en/dashboard/hotel-operations/${orgAId}/${propertyAId}`, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "Hotel operations" }).waitFor({ state: "visible", timeout: 30_000 });
  assert.equal(await page.getByRole("link", { name: "Open guest request page" }).getAttribute("href"), `/en/hotel/${orgAId}/${propertyAId}`, "ordinary operational property keeps its existing guest link");
  const uiSlug = `${prefix}-ui-deluxe`;
  const uiName = `${prefix} UI Deluxe`;
  const roomTypeForm = page.locator("form").filter({ has: page.getByLabel("Room type slug") });
  await roomTypeForm.getByLabel("Room type slug").fill(uiSlug);
  await roomTypeForm.getByLabel("Name").fill(uiName);
  await roomTypeForm.getByLabel("Description").fill("Created through authenticated Hotel operations UI");
  await roomTypeForm.getByLabel("Adults").fill("2");
  await roomTypeForm.getByLabel("Children").fill("1");
  await roomTypeForm.getByLabel("Max occupancy").fill("3");
  await roomTypeForm.getByLabel("Bed type").selectOption("queen");
  await roomTypeForm.getByLabel("Count").fill("1");
  await roomTypeForm.getByRole("button", { name: "Add", exact: true }).click();
  await page.getByText(`${uiName} (${uiSlug})`, { exact: true }).waitFor({ state: "visible", timeout: 30_000 });
  const persistedUiType = await db.hotelRoomType.findFirst({ where: { organizationId: orgAId, propertyId: propertyAId, slug: uiSlug } });
  assert.ok(persistedUiType, "UI submission must create a persisted room type");
  assert.equal(persistedUiType.name, uiName);
  assert.equal(persistedUiType.maxOccupancy, 3);

  stage = "browser-create-and-attach-room-type-amenity";
  const uiAmenityKey = `ui-amenity-${suffix.slice(0, 8)}`;
  const uiAmenityLabel = `${prefix} UI verified amenity`;
  const amenityForm = page.locator("form").filter({ has: page.getByLabel("Amenity key") });
  await amenityForm.getByLabel("Amenity key").fill(uiAmenityKey);
  await amenityForm.getByLabel("Amenity name").fill(uiAmenityLabel);
  const amenityCreateResponse = page.waitForResponse((response) => response.url().endsWith("/amenities") && response.request().method() === "POST");
  await amenityForm.getByRole("button", { name: "Add amenity" }).click();
  const amenityCreateResult = await amenityCreateResponse;
  assert.equal(amenityCreateResult.status(), 201, `amenity creation should succeed: ${await amenityCreateResult.text()}`);
  const persistedAmenity = await db.hotelAmenity.findFirst({ where: { organizationId: orgAId, propertyId: propertyAId, key: uiAmenityKey } });
  assert.ok(persistedAmenity, "manager-created property amenity persists in the tenant and property scope");
  const roomTypeSection = page.getByRole("heading", { name: "Room types" }).locator("xpath=ancestor::section[1]");
  const uiTypeItem = roomTypeSection.getByRole("listitem").filter({ hasText: uiName });
  await uiTypeItem.getByRole("button", { name: "Edit" }).click();
  const amenityCheckbox = roomTypeSection.getByLabel(uiAmenityLabel);
  await amenityCheckbox.check();
  assert.equal(await amenityCheckbox.isChecked(), true, "selected amenity checkbox reflects manager input");
  const amenityLinkResponse = page.waitForResponse((response) => response.url().includes(`/room-types/${persistedUiType.id}/amenities`) && response.request().method() === "PUT");
  await roomTypeSection.getByRole("button", { name: "Save changes" }).click();
  const amenityLinkResult = await amenityLinkResponse;
  assert.equal(amenityLinkResult.status(), 200, `room-type amenity association should succeed: ${await amenityLinkResult.text()}`);
  const persistedAmenityLink = await db.hotelRoomTypeAmenity.findFirst({ where: { organizationId: orgAId, roomTypeId: persistedUiType.id, amenityId: persistedAmenity.id } });
  assert.ok(persistedAmenityLink, "room-type amenity assignment persists through the management UI");
  const operationsAmenities = await apiJson<{ roomTypes: Array<{ id: string; amenities: Array<{ id: string; label: string }> }> }>(operationsPath, cookie);
  assert.equal(operationsAmenities.response.status, 200);
  assert.ok(operationsAmenities.data?.roomTypes.find((roomType) => roomType.id === persistedUiType.id)?.amenities.some((amenity) => amenity.id === persistedAmenity.id && amenity.label === uiAmenityLabel), "authorized operations reload includes the scoped amenity assignment");

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "Hotel operations" }).waitFor({ state: "visible", timeout: 30_000 });
  await page.getByText(`${uiName} (${uiSlug})`, { exact: true }).waitFor({ state: "visible", timeout: 30_000 });
  const persistedAfterReload = await db.hotelRoomType.findFirst({ where: { id: persistedUiType.id, organizationId: orgAId, propertyId: propertyAId } });
  assert.ok(persistedAfterReload, "UI-created room type must survive a full browser reload");
  assert.deepEqual(pageErrors, [], "Hotel operations page must not raise browser runtime errors");

  stage = "browser-policy-and-rate-plan-configuration";
  const policyForm = page.locator("form").filter({ has: page.getByLabel("Cancellation policy key") });
  const uiPolicyKey = `ui-policy-${suffix.slice(0, 8)}`;
  await policyForm.getByLabel("Cancellation policy key").fill(uiPolicyKey);
  await policyForm.getByLabel("Cancellation policy name").fill(`${prefix} UI cancellation`);
  await policyForm.getByLabel("Free cancellation cutoff (hours)").fill("36");
  await policyForm.getByLabel("Late cancellation retention (0 to 1)").fill("0.25");
  await policyForm.getByRole("button", { name: "Create cancellation policy" }).click();
  await page.locator("ul li").filter({ hasText: new RegExp(`${prefix} UI cancellation`) }).waitFor({ state: "visible", timeout: 30_000 });
  const persistedPolicy = await db.hotelCancellationPolicy.findFirst({ where: { organizationId: orgAId, propertyId: propertyAId, key: uiPolicyKey } });
  assert.ok(persistedPolicy, "manager-created cancellation policy persists");
  assert.equal(persistedPolicy.fullCancellationRetention, 2500);
  const uiRateForm = page.locator("form").filter({ has: page.getByLabel("Rate plan code") });
  await uiRateForm.getByLabel("Room type").selectOption({ label: uiName });
  await uiRateForm.getByLabel("Rate plan code").fill(`ui-rate-${suffix.slice(0, 8)}`);
  await uiRateForm.getByLabel("Rate plan name").fill(`${prefix} UI flexible`);
  await uiRateForm.getByLabel("Base nightly rate (Toman)").fill("325000");
  await uiRateForm.getByLabel("Cancellation policies").selectOption(persistedPolicy.id);
  await uiRateForm.getByRole("button", { name: "Create rate plan" }).click();
  await page.locator("ul li").filter({ hasText: new RegExp(`${prefix} UI flexible`) }).waitFor({ state: "visible", timeout: 30_000 });
  const persistedUiRate = await db.hotelRatePlan.findFirst({ where: { organizationId: orgAId, propertyId: propertyAId, code: `ui-rate-${suffix.slice(0, 8)}` } });
  assert.ok(persistedUiRate, "manager-created rate plan persists");
  assert.equal(persistedUiRate.cancellationPolicyId, persistedPolicy.id, "the rate cannot become guest-reservable without an explicitly selected active policy");

  stage = "browser-owner-availability-preview-is-read-only";
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "Hotel operations" }).waitFor({ state: "visible", timeout: 30_000 });
  await page.getByRole("listitem").filter({ hasText: `${prefix} UI flexible · 325000 TOMAN` }).waitFor({ state: "visible", timeout: 30_000 });
  const rangeSection = page.getByRole("heading", { name: "Date range" }).locator("xpath=ancestor::section[1]");
  const rangeDates = rangeSection.locator('input[type="date"]');
  await rangeDates.nth(0).fill(from);
  await rangeDates.nth(1).fill(to);
  await rangeSection.getByRole("button", { name: "Load range" }).click();
  await page.getByRole("heading", { name: "Guest availability preview (owner only)" }).waitFor({ state: "visible" });
  const beforeBrowserPreview = await readPreviewMutationSnapshot(orgAId);
  await page.getByRole("button", { name: "Check availability and rates" }).click();
  const previewPanel = page.getByRole("region", { name: "Guest availability preview (owner only)" });
  await previewPanel.getByText(`${prefix} Standard`, { exact: true }).waitFor({ state: "visible", timeout: 30_000 });
  const nightlyPriceLines = previewPanel.getByText("Nightly rates: 275000 TOMAN", { exact: true });
  await nightlyPriceLines.first().waitFor({ state: "visible" });
  assert.equal(await nightlyPriceLines.count(), 2, "each stay night shows the actual configured rate");
  await previewPanel.getByText("Stay total: 550000 TOMAN", { exact: true }).waitFor({ state: "visible" });

  let occupancyRequestUrl = "";
  const capturePreviewRequest = (request: import("playwright").Request) => { if (request.url().includes("/availability-preview?")) occupancyRequestUrl = request.url(); };
  page.on("request", capturePreviewRequest);
  await previewPanel.getByLabel("Adults").fill("1");
  await previewPanel.getByLabel("Children").fill("1");
  await previewPanel.getByLabel("Child age 1").fill("7");
  const childOccupancyResponse = page.waitForResponse((response) => response.url().includes("/availability-preview?") && response.status() === 200);
  await page.getByRole("button", { name: "Check availability and rates" }).click();
  await childOccupancyResponse;
  assert.equal(new URL(occupancyRequestUrl).searchParams.get("adults"), "1");
  assert.equal(new URL(occupancyRequestUrl).searchParams.get("children"), "1");
  assert.equal(new URL(occupancyRequestUrl).searchParams.get("childAges"), "7");
  await page.getByText(/Guests: 1 Adults, 1 Children/).waitFor({ state: "visible" });
  page.off("request", capturePreviewRequest);
  await previewPanel.getByLabel("Adults").fill("2");
  await previewPanel.getByLabel("Children").fill("0");
  assert.deepEqual(await readPreviewMutationSnapshot(orgAId), beforeBrowserPreview, "multi-occupancy preview requests remain read-only");

  let signalDelayedResponse: (() => void) | undefined;
  let releaseDelayedResponse: (() => void) | undefined;
  const delayedResponseStarted = new Promise<void>((resolve) => { signalDelayedResponse = resolve; });
  const delayedResponseRelease = new Promise<void>((resolve) => { releaseDelayedResponse = resolve; });
  await page.route("**/availability-preview?*", async (route) => {
    const response = await route.fetch();
    signalDelayedResponse?.();
    await delayedResponseRelease;
    await route.fulfill({ response });
  });
  const delayedPreviewResponse = page.waitForResponse((response) => response.url().includes("/availability-preview?") && response.status() === 200);
  await page.getByRole("button", { name: "Check availability and rates" }).click();
  await delayedResponseStarted;
  await previewPanel.getByLabel("Adults").fill("1");
  releaseDelayedResponse?.();
  await delayedPreviewResponse;
  await page.waitForFunction(() => Array.from(document.querySelectorAll("button")).some((button) => button.textContent?.trim() === "Check availability and rates" && !(button as HTMLButtonElement).disabled));
  assert.equal(await page.getByRole("status", { name: "Result for current configuration" }).count(), 0, "a delayed response for the prior occupancy cannot appear under changed guest inputs");
  await page.unroute("**/availability-preview?*");
  await page.getByRole("button", { name: "Check availability and rates" }).click();
  await previewPanel.getByText(`${prefix} Standard`, { exact: true }).waitFor({ state: "visible", timeout: 30_000 });
  assert.equal(await page.getByRole("status", { name: "Result for current configuration" }).count(), 1, "the new occupancy request renders its matching response");
  await previewPanel.getByLabel("Adults").fill("2");

  let failPreviewOnce = true;
  await page.route("**/availability-preview?*", async (route) => {
    if (failPreviewOnce) {
      failPreviewOnce = false;
      await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "controlled test failure" }) });
      return;
    }
    await route.continue();
  });
  const failedPreviewResponse = page.waitForResponse((response) => response.url().includes("/availability-preview?") && response.status() === 503);
  await page.getByRole("button", { name: "Check availability and rates" }).click();
  await failedPreviewResponse;
  await page.getByRole("alert").filter({ hasText: "Could not load the preview" }).waitFor({ state: "visible" });
  const retriedPreviewResponse = page.waitForResponse((response) => response.url().includes("/availability-preview?") && response.status() === 200);
  await previewPanel.getByRole("button", { name: "Retry preview" }).click();
  await retriedPreviewResponse;
  await previewPanel.getByText(`${prefix} Standard`, { exact: true }).waitFor({ state: "visible", timeout: 30_000 });
  await page.unroute("**/availability-preview?*");
  assert.deepEqual(await readPreviewMutationSnapshot(orgAId), beforeBrowserPreview, "successful, failed, delayed, and retry preview UI requests do not create holds, reservations, payments, or inventory changes");
  const desktopLayout = await page.evaluate(() => ({
    documentFits: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    workspaceDirection: document.querySelector("main")?.getAttribute("dir") ?? document.documentElement.getAttribute("dir"),
  }));
  assert.equal(desktopLayout.documentFits, true, "desktop owner preview has no horizontal overflow");
  assert.equal(desktopLayout.workspaceDirection, "ltr", "English desktop workspace follows its locale direction");

  stage = "browser-fa-manual-reception-reservation-with-public-gates-off";
  await page.goto(`${baseUrl}/fa/hotel-reservations/${orgAId}/${propertyAId}`, { waitUntil: "domcontentloaded" });
  const manualSection = page.getByRole("region", { name: "رزروهای هتل" });
  await manualSection.waitFor({ state: "visible", timeout: 30_000 });
  assert.equal(await manualSection.getAttribute("dir"), "rtl", "manual reception form is Persian-first and RTL");
  const manualProperty = await db.hotelProperty.findUniqueOrThrow({ where: { id: propertyAId }, select: { timezone: true } });
  const arrivalDay = propertyCalendarDate(manualProperty.timezone);
  const nextDay = offsetPropertyDate(arrivalDay, 1);
  const departureDay = offsetPropertyDate(arrivalDay, 2);
  await db.hotelInventory.createMany({ data: [arrivalDay, nextDay].map(date => ({ organizationId: orgAId, propertyId: propertyAId, roomTypeId, date: new Date(date + "T00:00:00Z"), allotment: 2 })), skipDuplicates: true });
  await manualSection.getByLabel("تاریخ ورود").fill(arrivalDay);
  await manualSection.getByLabel("تاریخ خروج").fill(departureDay);
  await manualSection.getByLabel("نوع اتاق").selectOption(roomTypeId);
  await manualSection.getByLabel("طرح نرخ").selectOption(ratePlanId);
  await manualSection.getByLabel("بزرگسالان").fill("1");
  await manualSection.getByLabel("کودکان").fill("0");
  const manualRoom = await db.hotelRoom.findFirstOrThrow({ where: { id: roomIds[0], organizationId: orgAId, propertyId: propertyAId } });
  await manualSection.getByLabel("اتاق فیزیکی").selectOption(manualRoom.id);
  await manualSection.getByLabel("روش دریافت").selectOption("PHONE");
  await manualSection.getByLabel("نام کامل مهمان 1").fill(`Manual Guest ${suffix.slice(0, 8)}`);
  const manualCreateButton = manualSection.getByRole("button", { name: "ثبت رزرو و تخصیص اتاق" });
  const manualFormState = {
    checkIn: await manualSection.getByLabel("تاریخ ورود").inputValue(),
    checkOut: await manualSection.getByLabel("تاریخ خروج").inputValue(),
    roomType: await manualSection.getByLabel("نوع اتاق").inputValue(),
    ratePlan: await manualSection.getByLabel("طرح نرخ").inputValue(),
    adults: await manualSection.getByLabel("بزرگسالان").inputValue(),
    children: await manualSection.getByLabel("کودکان").inputValue(),
    physicalRoom: await manualSection.getByLabel("اتاق فیزیکی").inputValue(),
    guestName: await manualSection.getByLabel("نام کامل مهمان 1").inputValue(),
    submitDisabled: await manualCreateButton.isDisabled(),
  };
  assert.equal(manualFormState.submitDisabled, false, `valid manual reception form must be enabled: ${JSON.stringify(manualFormState)}`);
  const manualCreateResponse = page.waitForResponse((response) => response.url().includes("/reservations/manual") && response.request().method() === "POST");
  await manualCreateButton.click();
  const manualResponse = await manualCreateResponse;
  assert.equal(manualResponse.status(), 200, "manual reception entry must succeed while public booking gates remain unset");
  await manualSection.getByRole("status").filter({ hasText: "رزرو پذیرش ثبت شد و اتاق تخصیص یافت." }).waitFor({ state: "visible", timeout: 30_000 });
  const manualDbRow = await db.hotelReservation.findFirstOrThrow({ where: { organizationId: orgAId, propertyId: propertyAId, guests: { some: { fullName: `Manual Guest ${suffix.slice(0, 8)}` } } }, include: { nights: true } });
  assert.equal(manualDbRow.status, "CONFIRMED"); assert.equal(manualDbRow.paidAmount, BigInt(0), "manual reception entry never records a payment");
  assert.ok(manualDbRow.nights.every((night) => night.roomId === manualRoom.id), "the selected physical room is assigned on every occupied night");
  const manualAudit = await db.hotelInventoryIdempotency.findFirstOrThrow({ where: { organizationId: orgAId, operationScope: "HOTEL_MANUAL_RESERVATION", resultJson: { path: ["reservationId"], equals: manualDbRow.id } } });
  assert.equal((manualAudit.resultJson as { source?: string }).source, "PHONE", "reservation source is retained in staff-only history");
  const manualItem = manualSection.getByRole("listitem").filter({ hasText: manualDbRow.reference });
  await manualItem.getByRole("button", { name: "ثبت ورود" }).click();
  await manualItem.getByText("ورود ثبت‌شده").waitFor({ state: "visible", timeout: 30_000 });
  await manualItem.getByRole("button", { name: "پیش‌نمایش مبلغ خروج زودهنگام", exact: true }).click();
  await manualItem.getByRole("button", { name: "تأیید مبلغ و ثبت خروج", exact: true }).click();
  await manualItem.getByText("خروج ثبت‌شده").waitFor({ state: "visible", timeout: 30_000 });
  const departedManual = await db.hotelReservation.findUniqueOrThrow({ where: { id: manualDbRow.id }, include: { nights: true } });
  assert.equal(departedManual.checkOut.toISOString().slice(0,10), nextDay);
  assert.equal(departedManual.nights.length, 1);
  assert.ok(departedManual.checkedInAt && departedManual.checkedOutAt);

  stage = "browser-reservation-center-search-details-and-calendar";
  await page.goto(`${baseUrl}/fa/dashboard/hotel-operations/${orgAId}/${propertyAId}/reservations`, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "مرکز رزرواسیون", exact: true }).waitFor({ state: "visible", timeout: 30_000 });
  const center = page.getByRole("region", { name: "مرکز رزرواسیون" });
  const receptionSearch = center.getByRole("searchbox", { name: "جست‌وجوی نام مهمان یا همراه، کد رزرو یا اتاق", exact: true });
  await receptionSearch.fill(`Manual Guest ${suffix.slice(0, 8)}`);
  assert.equal(await receptionSearch.inputValue(), `Manual Guest ${suffix.slice(0, 8)}`);
  const centerItem = center.getByRole("listitem").filter({ hasText: manualDbRow.reference });
  await centerItem.getByRole("button", { name: "جزئیات" }).click();
  const details = page.getByRole("complementary", { name: "جزئیات رزرو انتخاب‌شده" });
  await details.getByRole("heading", { name: "پرونده مهمانان این رزرو", exact: true }).waitFor({ state: "visible" });
  const primaryGuest = details.getByRole("listitem").filter({ hasText: "مهمان اصلی" }).getByText(`Manual Guest ${suffix.slice(0, 8)}`, { exact: true });
  await primaryGuest.waitFor({ state: "visible" });
  await center.getByLabel("فیلتر وضعیت").selectOption("CHECKED_OUT");
  await centerItem.getByText("خروج ثبت‌شده").waitFor({ state: "visible" });

  const calendar = page.getByRole("region", { name: "تقویم اشغال اتاق‌ها" });
  await calendar.getByLabel("تاریخ شروع").fill("2027-08-08");
  await calendar.getByRole("button", { name: "تقویم شمسی", exact: true }).click();
  const jalaliDialog = page.getByRole("dialog", { name: "تقویم شمسی", exact: true });
  await jalaliDialog.waitFor({ state: "visible" });
  assert.equal(await jalaliDialog.locator('button[data-date="2027-08-08"]').getAttribute("aria-pressed"), "true");
  await jalaliDialog.locator('button[data-date="2027-08-07"]').click();
  assert.equal(await calendar.getByLabel("تاریخ شروع").inputValue(), "2027-08-07", "Jalali selection preserves Gregorian ISO date");
  await calendar.getByRole("button", { name: "تقویم شمسی", exact: true }).click();
  await jalaliDialog.locator('button[data-date="2027-08-08"]').click();
  assert.equal(await calendar.getByLabel("تاریخ شروع").inputValue(), "2027-08-08");
  await calendar.getByRole("cell").filter({ hasText: "تعمیرات" }).first().waitFor({ state: "visible", timeout: 30_000 });
  await calendar.getByRole("row").filter({ hasText: manualRoom.code }).waitFor({ state: "visible" });
  assert.equal(await calendar.getAttribute("dir"), "rtl", "the reservation calendar uses Persian RTL presentation");
  for (const locale of ["en", "ar"] as const) {
    await page.goto(`${baseUrl}/${locale}/dashboard/hotel-operations/${orgAId}/${propertyAId}/reservations`, { waitUntil: "domcontentloaded" });
    await page.getByRole("heading", { name: locale === "en" ? "Reservation center" : "مركز الحجوزات", exact: true }).waitFor({ state: "visible", timeout: 30_000 });
    const localizedCenter = page.getByRole("region", { name: locale === "en" ? "Reservation center" : "مركز الحجوزات" });
    assert.equal(await localizedCenter.getAttribute("dir"), locale === "en" ? "ltr" : "rtl", `${locale} reservation center uses the expected direction`);
    const localizedSearchName = locale === "en" ? "Search guest, companion, reference or room" : "البحث عن الضيف أو المرافق أو المرجع أو الغرفة";
    await localizedCenter.getByRole("searchbox", { name: localizedSearchName, exact: true }).waitFor({ state: "visible" });
    await page.getByRole("region", { name: locale === "en" ? "Room occupancy calendar" : "تقويم إشغال الغرف" }).waitFor({ state: "visible", timeout: 30_000 });
  }
  stage = "browser-demo-guest-link-fa-en-ar";
  for (const locale of ["fa", "en", "ar"] as const) {
    await page.goto(`${baseUrl}/${locale}/dashboard/hotel-operations/${orgAId}/${demoPropertyId}`, { waitUntil: "domcontentloaded" });
    const label = locale === "fa" ? "مشاهده رزرو آزمایشی مهمان" : locale === "en" ? "Open the guest booking demo" : "فتح عرض الحجز للضيف";
    const demoLink = page.getByRole("link", { name: label, exact: true });
    await demoLink.waitFor({ state: "visible", timeout: 30_000 });
    assert.equal(await demoLink.getAttribute("href"), `https://damoon-hotel.ir/${locale}/hotel-reservations/start?mode=DEMO_BOOKING`, `${locale} demo link uses the approved booking route`);
    assert.equal(await demoLink.getAttribute("target"), "_blank");
  }
  stage = "browser-center-explains-empty-operational-setup";
  await page.route(`**/api/organizations/${orgAId}/hotels/${propertyAId}/reservations*`, async (route) => {
    if (route.request().method() !== "GET") { await route.continue(); return; }
    const response = await route.fetch();
    const snapshot = await response.json() as Record<string, unknown>;
    await route.fulfill({ response, json: { ...snapshot, roomTypes: [], ratePlans: [], rooms: [], manualRoomManagementEnabled: false } });
  });
  await page.goto(`${baseUrl}/fa/dashboard/hotel-operations/${orgAId}/${propertyAId}/reservations`, { waitUntil: "domcontentloaded" });
  const readiness = page.getByRole("status", { name: "آمادگی ثبت رزرو دستی" });
  await readiness.getByText("نوع اتاقی برای رزرو تنظیم نشده است؛ لطفاً با پذیرش تماس بگیرید.").waitFor({ state: "visible", timeout: 30_000 });
  await readiness.getByText("ثبت رزرو تلفنی و حضوری برای این ملک غیرفعال است. از مدیر مجاز بخواهید تنظیم موجود را بررسی کند.").waitFor({ state: "visible" });
  assert.equal(await page.getByLabel("تاریخ ورود").count(), 0, "the center hides inactive reservation-entry fields when manual intake is disabled");
  await page.unroute(`**/api/organizations/${orgAId}/hotels/${propertyAId}/reservations*`);
  const staffContext = await browser.newContext({ viewport: { width: 1280, height: 850 } });
  await staffContext.addCookies(staffLogin.cookies.map((value) => {
    const separator = value.indexOf("=");
    return { name: value.slice(0, separator), value: value.slice(separator + 1), url: baseUrl };
  }).filter((entry) => entry.name && entry.value));
  const staffPage = await staffContext.newPage();
  await staffPage.goto(`${baseUrl}/fa/dashboard/hotel-operations/${orgAId}/${propertyAId}/reservations`, { waitUntil: "domcontentloaded" });
  await staffPage.getByRole("heading", { name: "مرکز رزرواسیون", exact: true }).waitFor({ state: "visible", timeout: 30_000 });
  await staffPage.getByRole("region", { name: "تقویم اشغال اتاق‌ها" }).waitFor({ state: "visible", timeout: 30_000 });
  await staffContext.close();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${baseUrl}/fa/dashboard/hotel-operations/${orgAId}/${propertyAId}/reservations`, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "مرکز رزرواسیون", exact: true }).waitFor({ state: "visible", timeout: 30_000 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), true, "reservation center avoids page-level horizontal overflow on mobile");

  stage = "browser-mobile-fa-ar-layout";
  await page.setViewportSize({ width: 390, height: 844 });
  for (const locale of ["fa", "ar"] as const) {
    await page.goto(`${baseUrl}/${locale}/dashboard/hotel-operations/${orgAId}/${propertyAId}`, { waitUntil: "domcontentloaded" });
    await page.getByRole("heading", { name: locale === "fa" ? "عملیات هتل" : "عمليات الفندق" }).waitFor({ state: "visible", timeout: 30_000 });
    await page.getByText(`${uiName} (${uiSlug})`, { exact: true }).waitFor({ state: "visible", timeout: 30_000 });
    const layout = await page.evaluate(() => ({
      documentFits: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      workspaceDirection: document.querySelector("main [dir]")?.getAttribute("dir") ?? document.querySelector("main")?.getAttribute("dir") ?? document.documentElement.getAttribute("dir"),
      overflowing: Array.from(document.querySelectorAll("main *")).filter((element) => element.getBoundingClientRect().width > innerWidth).slice(0, 12).map((element) => ({ tag: element.tagName, classes: element.className, width: Math.round(element.getBoundingClientRect().width) })),
    }));
    assert.equal(layout.documentFits, true, `${locale} mobile page has no horizontal document overflow: ${JSON.stringify(layout.overflowing)}`);
    assert.equal(layout.workspaceDirection, "rtl", `${locale} Hotel workspace uses RTL direction`);
  }
  await context.close();
  browserPassed = true;

  stage = "complete";
  testPassed = true;
});
