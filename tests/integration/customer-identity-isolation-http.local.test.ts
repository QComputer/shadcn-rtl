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

// Real local HTTP regression for domain-bound customer credentials and tenant isolation.
// It uses only the disposable loopback fixture database and never calls providers.
const dbUrl = new URL(process.env.DATABASE_URL ?? "https://missing.invalid");
assert.ok(["postgres:", "postgresql:"].includes(dbUrl.protocol));
assert.equal(dbUrl.hostname, "127.0.0.1");
assert.equal(dbUrl.port, "55439");
assert.equal(dbUrl.pathname, "/retail_hero_test");
assert.equal(decodeURIComponent(dbUrl.username), "hero_test");
assert.equal(decodeURIComponent(dbUrl.password), "local_admin_fixture_only");
assert.equal(dbUrl.search, "", "Prisma connection must not carry query parameters");
assert.equal(process.env.DIRECT_URL, dbUrl.toString());
assert.equal(process.env.LOCAL_PRISMA_EXPECTED_PORT, "55439");
assert.equal(process.env.RETAIL_HERO_EXPECTED_DATABASE, "retail_hero_test");
assert.equal(process.env.DATABASE_RUNTIME_ADAPTER, "postgresql");

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: dbUrl.toString(), max: 6 }), log: [] });
const port = "3033";
const loopback = "127.0.0.1";
const baseUrl = `http://${loopback}:${port}`;
const suffix = randomUUID().replaceAll("-", "");
const prefix = `customer-identity-${suffix}`;
const hostA = `identity-a-${suffix}.localhost`;
const hostB = `identity-b-${suffix}.localhost`;
const originA = `http://${hostA}:${port}`;
const platformOrigin = baseUrl;
const customerPassword = `CustomerFixture-${randomUUID()}`;
const staffPassword = `StaffFixture-${randomUUID()}`;
const ownedOrgIds: string[] = [];
const ownedOrgSlugs: string[] = [];
const ownedUserIds: string[] = [];
const ownedCategoryIds: string[] = [];
const ownedServiceIds: string[] = [];
const ownedOrderIds: string[] = [];
const ownedAppointmentIds: string[] = [];
const ownedNotificationIds: string[] = [];
let orgA: Organization;
let orgB: Organization;
let customerId = "";
let customerName = "";
let staffId = "";
let staffName = "";
let adminId = "";
let adminName = "";
let customerMembershipAId = "";
let customerMembershipBId = "";
let orderAId = "";
let orderBId = "";
let appointmentAId = "";
let appointmentBId = "";
let notificationAId = "";
let notificationBId = "";
let server: ChildProcess | undefined;
let testPassed = false;
let fixtureCleanupPassed = false;
let serverStopped = true;
let stage = "module-load";

const resultPath = join(process.cwd(), ".tmp", "customer-identity-p0", "customer-identity-isolation-http.result.json");
process.on("exit", () => {
  const exitCode = process.exitCode ?? (testPassed && fixtureCleanupPassed ? 0 : 1);
  const passed = exitCode === 0 && testPassed && fixtureCleanupPassed && serverStopped;
  try {
    mkdirSync(join(process.cwd(), ".tmp", "customer-identity-p0"), { recursive: true });
    writeFileSync(resultPath, `${JSON.stringify({
      test: "customer-identity-isolation-http.local.test.ts",
      status: passed ? "PASSED" : "FAILED",
      exitCode,
      stage,
      database: { host: "127.0.0.1", port: 55439, database: "retail_hero_test", role: "hero_test" },
      server: { port: Number(port), stopped: serverStopped },
      cleanup: fixtureCleanupPassed && serverStopped ? "PASSED" : "FAILED",
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
    AUTH_TRUST_HOST: "true",
    NEXT_PUBLIC_APP_URL: baseUrl,
    NEXT_PUBLIC_DEPLOYED_APP_URL: baseUrl,
    BAZAR_BAZ_PLATFORM_HOSTS: "localhost,127.0.0.1",
    CUSTOMER_PHONE_AUTH_ENABLED: "1",
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
    if (server?.exitCode !== null && server?.exitCode !== undefined) throw new Error("isolated Next server exited before ready");
    try {
      const response = await fetch(`${baseUrl}/api/auth/csrf`);
      if (response.ok) return;
    } catch { /* server startup */ }
    await delay(500);
  }
  throw new Error("isolated Next server did not become ready in 120 seconds");
}

async function request(path: string, host = hostA, origin?: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("host", `${host}:${port}`);
  if (origin) headers.set("origin", origin);
  // Preserve the real HTTP authority without relying on OS wildcard-localhost DNS.
  return new Promise<Response>((resolve, reject) => {
    const outgoing = httpRequest({ hostname: loopback, port, path, method: init.method ?? "GET", headers: Object.fromEntries(headers) }, incoming => {
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
    if (init.body) outgoing.write(String(init.body));
    outgoing.end();
  });
}

function cookiesFrom(response: Response) {
  return (response.headers.getSetCookie?.() ?? [response.headers.get("set-cookie") ?? ""])
    .flatMap((value) => value.split(/,(?=[^;]+=[^;]+)/))
    .map((value) => value.split(";", 1)[0])
    .filter(Boolean);
}

function cookieHeader(cookies: string[]) { return cookies.join("; "); }

function mergeCookies(existing: string[], response: Response) {
  const result = new Map(existing.map((value) => [value.split("=", 1)[0], value]));
  for (const value of cookiesFrom(response)) result.set(value.split("=", 1)[0], value);
  return [...result.values()];
}

async function passwordLogin(host: string, origin: string, username: string, password: string) {
  const csrfResponse = await request("/api/auth/csrf", host);
  assert.equal(csrfResponse.status, 200);
  const csrfCookies = cookiesFrom(csrfResponse);
  const csrfToken = (await csrfResponse.json() as { csrfToken: string }).csrfToken;
  const callback = await request("/api/auth/callback/credentials?json=true", host, origin, {
    method: "POST",
    redirect: "manual",
    headers: { cookie: cookieHeader(csrfCookies), "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ csrfToken, callbackUrl: origin, username, password }),
  });
  const cookies = mergeCookies(csrfCookies, callback);
  const sessionResponse = await request("/api/auth/session", host, undefined, { headers: { cookie: cookieHeader(cookies) } });
  assert.equal(sessionResponse.status, 200);
  const session = await sessionResponse.json() as { user?: { id?: string; role?: string; organizationId?: string; isTeamMember?: boolean } } | null;
  return { callback, cookies, session };
}

function jsonContains(value: unknown, id: string) { return JSON.stringify(value).includes(id); }

before(async () => {
  stage = "database-guard";
  const identity = await db.$queryRaw<Array<{ database: string; role: string }>>`SELECT current_database()::text AS database, current_user::text AS role`;
  assert.deepEqual(identity, [{ database: "retail_hero_test", role: "hero_test" }]);

  stage = "fixture-creation";
  const slugA = `identity-a-${suffix}`;
  const slugB = `identity-b-${suffix}`;
  orgA = await db.organization.create({ data: { name: `${prefix}-a`, slug: slugA, type: "SHOP", locale: "fa", capabilitiesInitializedAt: new Date() } });
  ownedOrgIds.push(orgA.id);
  ownedOrgSlugs.push(orgA.slug);
  orgB = await db.organization.create({ data: { name: `${prefix}-b`, slug: slugB, type: "SHOP", locale: "fa", capabilitiesInitializedAt: new Date() } });
  ownedOrgIds.push(orgB.id);
  ownedOrgSlugs.push(orgB.slug);
  await db.organizationCapability.createMany({ data: [orgA, orgB].flatMap((organization) => [
    { organizationId: organization.id, key: "SHOP", status: "ACTIVE", enabledAt: new Date() },
    { organizationId: organization.id, key: "APPOINTMENT", status: "ACTIVE", enabledAt: new Date() },
  ]) });
  await db.organizationDomain.createMany({ data: [
    { organizationId: orgA.id, domain: hostA, normalizedDomain: hostA, status: "ACTIVE", providerVerified: true, dnsConfigured: true, sslReady: true, verifiedAt: new Date() },
    { organizationId: orgB.id, domain: hostB, normalizedDomain: hostB, status: "ACTIVE", providerVerified: true, dnsConfigured: true, sslReady: true, verifiedAt: new Date() },
  ] });

  customerName = `cid-customer-${suffix}`;
  const customer = await db.user.create({ data: { name: customerName, password: await bcrypt.hash(customerPassword, 10), role: "CUSTOMER", phone: `555${suffix.slice(0, 10)}`, isTeamMember: false } });
  customerId = customer.id;
  ownedUserIds.push(customer.id);
  const membershipA = await db.customerClubMembership.create({ data: { organizationId: orgA.id, customerId, status: "ACTIVE", source: "PUBLIC_SHOP" } });
  const membershipB = await db.customerClubMembership.create({ data: { organizationId: orgB.id, customerId, status: "ACTIVE", source: "PUBLIC_SHOP" } });
  customerMembershipAId = membershipA.id;
  customerMembershipBId = membershipB.id;

  staffName = `cid-staff-${suffix}`;
  const staff = await db.user.create({ data: { name: staffName, password: await bcrypt.hash(staffPassword, 10), role: "STAFF", isTeamMember: true } });
  staffId = staff.id;
  ownedUserIds.push(staff.id);
  await db.organizationMember.create({ data: { organizationId: orgA.id, organizationSlug: orgA.slug, userId: staff.id, role: "STAFF", isActive: true } });

  adminName = `cid-admin-${suffix}`;
  const admin = await db.user.create({ data: { name: adminName, password: await bcrypt.hash(staffPassword, 10), role: "ADMIN", isTeamMember: true } });
  adminId = admin.id;
  ownedUserIds.push(admin.id);
  await db.organizationMember.create({ data: { organizationId: orgA.id, organizationSlug: orgA.slug, userId: admin.id, role: "ADMIN", isActive: true } });

  const categories = await Promise.all([orgA, orgB].map((organization, index) => db.serviceCategory.create({ data: { name: `${prefix}-service-${index}`, organizationId: organization.id } })));
  ownedCategoryIds.push(...categories.map((category) => category.id));
  const services = await Promise.all([
    db.service.create({ data: { name: `${prefix}-service-a`, price: 25, duration: 30, organizationId: orgA.id, categoryId: categories[0]!.id, serviceProviderId: staff.id } }),
    db.service.create({ data: { name: `${prefix}-service-b`, price: 30, duration: 30, organizationId: orgB.id, categoryId: categories[1]!.id, serviceProviderId: staff.id } }),
  ]);
  ownedServiceIds.push(...services.map((service) => service.id));

  const orderA = await db.order.create({ data: { orderNumber: `CID-${suffix}-A`, type: "PICK_UP", subtotal: 25, total: 25, organizationSlug: orgA.slug, customerId } });
  const orderB = await db.order.create({ data: { orderNumber: `CID-${suffix}-B`, type: "PICK_UP", subtotal: 30, total: 30, organizationSlug: orgB.slug, customerId } });
  orderAId = orderA.id;
  orderBId = orderB.id;
  ownedOrderIds.push(orderA.id, orderB.id);

  const appointmentDate = new Date(Date.now() + 2 * 86_400_000);
  const startTime = new Date(appointmentDate);
  startTime.setHours(11, 0, 0, 0);
  const endTime = new Date(startTime.getTime() + 30 * 60_000);
  const appointmentA = await db.appointment.create({ data: { date: appointmentDate, startTime, endTime, customerId, serviceId: services[0]!.id } });
  const appointmentB = await db.appointment.create({ data: { date: appointmentDate, startTime, endTime, customerId, serviceId: services[1]!.id } });
  appointmentAId = appointmentA.id;
  appointmentBId = appointmentB.id;
  ownedAppointmentIds.push(appointmentA.id, appointmentB.id);

  const notifications = await Promise.all([orgA, orgB].map((organization, index) => db.notification.create({
    data: { targetUserId: customerId, organizationId: organization.id, context: `${prefix}-notification-${index}`, type: "CUSTOMER_NOTICE" },
  })));
  notificationAId = notifications[0]!.id;
  notificationBId = notifications[1]!.id;
  ownedNotificationIds.push(...notifications.map((notification) => notification.id));
  await db.notificationPreference.createMany({ data: [
    { organizationId: orgA.id, customerId, channel: "IN_APP", marketingEnabled: true },
    { organizationId: orgB.id, customerId, channel: "IN_APP", marketingEnabled: false },
  ] });

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
    if (server && server.exitCode === null) {
      const serverExit = once(server, "exit").then(() => true);
      server.kill();
      const exited = await Promise.race([
        serverExit,
        delay(10_000).then(() => false),
      ]);
      if (!exited) {
        server.kill("SIGKILL");
        const forcedExit = await Promise.race([serverExit, delay(5_000).then(() => false)]);
        if (!forcedExit) throw new Error("isolated Next server did not stop");
      }
    }
    serverStopped = !server || server.exitCode !== null || server.signalCode !== null;

    if (ownedOrgIds.length > 0) {
      await db.auditLog.deleteMany({ where: { organizationId: { in: ownedOrgIds }, userId: { in: ownedUserIds } } });
      await db.notificationPreference.deleteMany({ where: { organizationId: { in: ownedOrgIds }, customerId: { in: ownedUserIds } } });
      await db.notification.deleteMany({ where: { id: { in: ownedNotificationIds } } });
      await db.appointment.deleteMany({ where: { id: { in: ownedAppointmentIds } } });
      await db.order.deleteMany({ where: { id: { in: ownedOrderIds } } });
      await db.service.deleteMany({ where: { id: { in: ownedServiceIds } } });
      await db.serviceCategory.deleteMany({ where: { id: { in: ownedCategoryIds } } });
      await db.customerPhoneSession.deleteMany({ where: { userId: { in: ownedUserIds }, organizationId: { in: ownedOrgIds } } });
      await db.customerClubMembership.deleteMany({ where: { organizationId: { in: ownedOrgIds }, customerId: { in: ownedUserIds } } });
      await db.organizationMember.deleteMany({ where: { organizationId: { in: ownedOrgIds }, userId: { in: ownedUserIds } } });
      await db.organizationCapability.deleteMany({ where: { organizationId: { in: ownedOrgIds } } });
      await db.organizationDomain.deleteMany({ where: { organizationId: { in: ownedOrgIds } } });
      await db.organization.deleteMany({ where: { id: { in: ownedOrgIds } } });
      await db.user.deleteMany({ where: { id: { in: ownedUserIds } } });
      assert.equal(await db.organization.count({ where: { id: { in: ownedOrgIds } } }), 0);
      assert.equal(await db.user.count({ where: { id: { in: ownedUserIds } } }), 0);
      assert.equal(await db.order.count({ where: { id: { in: ownedOrderIds } } }), 0);
      assert.equal(await db.appointment.count({ where: { id: { in: ownedAppointmentIds } } }), 0);
    }
    fixtureCleanupPassed = true;
  } catch {
    cleanupError = true;
  } finally {
    await db.$disconnect();
    console.log("CUSTOMER_IDENTITY_HTTP_SERVER_OUTPUT_SUPPRESSED");
    console.log(`CUSTOMER_IDENTITY_HTTP_CLEANUP=${fixtureCleanupPassed && serverStopped ? "PASSED" : "FAILED"}`);
  }
  if (cleanupError || !fixtureCleanupPassed || !serverStopped) throw new Error("customer identity HTTP fixture cleanup failed");
});

it("binds password customers and their HTTP reads and writes to one verified tenant", async () => {
  stage = "tenant-password-login";
  const customerLogin = await passwordLogin(hostA, originA, customerName, customerPassword);
  assert.ok([200, 302].includes(customerLogin.callback.status));
  assert.equal(customerLogin.session?.user?.id, customerId);
  assert.equal(customerLogin.session?.user?.role, "CUSTOMER");
  assert.equal(customerLogin.session?.user?.organizationId, orgA.id);
  assert.equal(customerLogin.session?.user?.isTeamMember, false);
  assert.doesNotMatch((customerLogin.callback.headers.getSetCookie?.() ?? []).join(";"), /(?:^|;)\s*Domain=/i);
  const customerCookie = cookieHeader(customerLogin.cookies);

  stage = "platform-password-denial";
  const platformLogin = await passwordLogin(loopback, platformOrigin, customerName, customerPassword);
  assert.ok(!platformLogin.session?.user?.id);

  stage = "customer-dashboard-scope";
  const customerDashboard = await request("/api/dashboard", hostA, undefined, { headers: { cookie: customerCookie } });
  assert.equal(customerDashboard.status, 200);
  const customerDashboardBody = await customerDashboard.json();
  assert.ok(jsonContains(customerDashboardBody, orderAId));
  assert.ok(jsonContains(customerDashboardBody, appointmentAId));
  assert.ok(!jsonContains(customerDashboardBody, orderBId));
  assert.ok(!jsonContains(customerDashboardBody, appointmentBId));
  const customerDashboardNotifications = await request("/api/dashboard/notifications?scope=all", hostA, undefined, { headers: { cookie: customerCookie } });
  assert.equal(customerDashboardNotifications.status, 200);
  const customerDashboardNotificationsBody = await customerDashboardNotifications.json();
  assert.ok(jsonContains(customerDashboardNotificationsBody, notificationAId));
  assert.ok(!jsonContains(customerDashboardNotificationsBody, notificationBId));
  const customerDashboardNotificationsB = await request("/api/dashboard/notifications?scope=all", hostA, originA, {
    method: "PATCH", headers: { cookie: customerCookie, "content-type": "application/json" },
    body: JSON.stringify({ ids: [notificationBId], seen: true }),
  });
  assert.ok([200, 403].includes(customerDashboardNotificationsB.status));
  if (customerDashboardNotificationsB.status === 200) {
    assert.equal((await customerDashboardNotificationsB.json() as { updated: number }).updated, 0);
  }
  assert.equal((await db.notification.findUniqueOrThrow({ where: { id: notificationBId } })).seen, false);
  const cookieOnTenantBDashboard = await request("/api/dashboard", hostB, undefined, { headers: { cookie: customerCookie } });
  assert.equal(cookieOnTenantBDashboard.status, 403);

  stage = "account-global-messaging-denial";
  for (const [path, method, body] of [
    ["/api/conversations", "GET", undefined],
    ["/api/conversations", "POST", JSON.stringify({ participantIds: [staffId] })],
    ["/api/conversations/nonexistent", "GET", undefined],
    ["/api/conversations/nonexistent/messages", "POST", JSON.stringify({ content: "fixture" })],
  ] as const) {
    const response = await request(path, hostA, originA, { method, headers: { cookie: customerCookie, "content-type": "application/json" }, body });
    assert.equal(response.status, 403);
  }

  stage = "customer-orders-scope";
  const ordersA = await request(`/api/orders?organizationId=${encodeURIComponent(orgA.id)}`, hostA, undefined, { headers: { cookie: customerCookie } });
  assert.equal(ordersA.status, 200);
  const ordersABody = await ordersA.json();
  assert.ok(jsonContains(ordersABody, orderAId));
  assert.ok(!jsonContains(ordersABody, orderBId));
  const explicitOrgB = await request(`/api/orders?organizationId=${encodeURIComponent(orgB.id)}`, hostA, undefined, { headers: { cookie: customerCookie } });
  assert.equal(explicitOrgB.status, 403);
  const spoofedHost = await request("/api/dashboard", hostA, undefined, { headers: { cookie: customerCookie, "x-forwarded-host": `${hostB}:${port}`, "x-organization-id": orgB.id } });
  assert.ok([200, 403].includes(spoofedHost.status));
  if (spoofedHost.status === 200) {
    const body = await spoofedHost.json();
    assert.ok(jsonContains(body, orderAId));
    assert.ok(!jsonContains(body, orderBId));
  }
  const orderARead = await request(`/api/orders/${encodeURIComponent(orderAId)}`, hostA, undefined, { headers: { cookie: customerCookie } });
  const orderBRead = await request(`/api/orders/${encodeURIComponent(orderBId)}`, hostA, undefined, { headers: { cookie: customerCookie } });
  assert.equal(orderARead.status, 200);
  assert.equal(orderBRead.status, 403);

  stage = "customer-appointments-scope";
  const appointmentsA = await request(`/api/appointments?organizationId=${encodeURIComponent(orgA.id)}`, hostA, undefined, { headers: { cookie: customerCookie } });
  assert.equal(appointmentsA.status, 200);
  const appointmentsABody = await appointmentsA.json();
  assert.ok(jsonContains(appointmentsABody, appointmentAId));
  assert.ok(!jsonContains(appointmentsABody, appointmentBId));
  const appointmentsBQuery = await request(`/api/appointments?organizationId=${encodeURIComponent(orgB.id)}`, hostA, undefined, { headers: { cookie: customerCookie } });
  const appointmentBRead = await request(`/api/appointments/${encodeURIComponent(appointmentBId)}`, hostA, undefined, { headers: { cookie: customerCookie } });
  assert.equal(appointmentsBQuery.status, 403);
  assert.equal(appointmentBRead.status, 403);
  const customerConfirm = await request(`/api/appointments/${encodeURIComponent(appointmentAId)}/confirm`, hostA, originA, {
    method: "POST", headers: { cookie: customerCookie, "content-type": "application/json" }, body: "{}",
  });
  assert.equal(customerConfirm.status, 403);
  const appointmentBCancel = await request(`/api/appointments/${encodeURIComponent(appointmentBId)}`, hostA, originA, {
    method: "DELETE", headers: { cookie: customerCookie },
  });
  assert.equal(appointmentBCancel.status, 403);
  assert.equal((await db.appointment.findUniqueOrThrow({ where: { id: appointmentBId } })).status, "PENDING");
  const orderCreateB = await request("/api/orders", hostA, originA, {
    method: "POST", headers: { cookie: customerCookie, "content-type": "application/json" },
    body: JSON.stringify({ organizationSlug: orgB.slug, type: "PICK_UP" }),
  });
  assert.equal(orderCreateB.status, 403);
  const appointmentCreateB = await request("/api/appointments", hostA, originA, {
    method: "POST", headers: { cookie: customerCookie, "content-type": "application/json" },
    body: JSON.stringify({ serviceId: ownedServiceIds[1], date: new Date(Date.now() + 2 * 86_400_000).toISOString(), startTime: new Date(Date.now() + 2 * 86_400_000).toISOString() }),
  });
  assert.equal(appointmentCreateB.status, 403);

  stage = "customer-notifications-scope";
  const notificationsA = await request("/api/customer/notifications?scope=all", hostA, undefined, { headers: { cookie: customerCookie } });
  assert.equal(notificationsA.status, 200);
  const notificationsABody = await notificationsA.json();
  assert.ok(jsonContains(notificationsABody, notificationAId));
  assert.ok(!jsonContains(notificationsABody, notificationBId));
  const cookieOnTenantB = await request("/api/customer/notifications?scope=all", hostB, undefined, { headers: { cookie: customerCookie } });
  assert.equal(cookieOnTenantB.status, 403);
  const crossTenantNotificationWrite = await request("/api/customer/notifications", hostA, originA, {
    method: "PATCH", headers: { cookie: customerCookie, "content-type": "application/json" },
    body: JSON.stringify({ ids: [notificationBId], seen: true }),
  });
  assert.ok([200, 403].includes(crossTenantNotificationWrite.status));
  if (crossTenantNotificationWrite.status === 200) assert.equal((await crossTenantNotificationWrite.json() as { updated: number }).updated, 0);
  assert.equal((await db.notification.findUniqueOrThrow({ where: { id: notificationBId } })).seen, false);

  stage = "membership-and-preference-scope";
  const membershipBRead = await request(`/api/customer-club/membership?organizationId=${encodeURIComponent(orgB.id)}`, hostA, undefined, { headers: { cookie: customerCookie } });
  assert.equal(membershipBRead.status, 403);
  const membershipBWrite = await request("/api/customer-club/membership", hostA, originA, {
    method: "PATCH", headers: { cookie: customerCookie, "content-type": "application/json" },
    body: JSON.stringify({ organizationId: orgB.id, membershipId: customerMembershipBId, status: "LEFT" }),
  });
  assert.equal(membershipBWrite.status, 403);
  assert.equal((await db.customerClubMembership.findUniqueOrThrow({ where: { id: customerMembershipBId } })).status, "ACTIVE");
  const preferenceBRead = await request(`/api/customer/notification-preferences?organizationSlug=${encodeURIComponent(orgB.slug)}`, hostA, undefined, { headers: { cookie: customerCookie } });
  assert.equal(preferenceBRead.status, 403);
  const preferenceBWrite = await request("/api/customer/notification-preferences", hostA, originA, {
    method: "PATCH", headers: { cookie: customerCookie, "content-type": "application/json" },
    body: JSON.stringify({ organizationSlug: orgB.slug, preferences: [{ channel: "IN_APP", marketingEnabled: true }] }),
  });
  assert.equal(preferenceBWrite.status, 403);
  assert.equal((await db.notificationPreference.findUniqueOrThrow({ where: { organizationId_customerId_channel: { organizationId: orgB.id, customerId, channel: "IN_APP" } } })).marketingEnabled, false);

  stage = "membership-revocation";
  await db.customerClubMembership.update({ where: { id: customerMembershipAId }, data: { status: "BLOCKED" } });
  const blockedCustomer = await request("/api/dashboard", hostA, undefined, { headers: { cookie: customerCookie } });
  assert.ok([401, 403].includes(blockedCustomer.status));
  await db.customerClubMembership.update({ where: { id: customerMembershipAId }, data: { status: "LEFT" } });
  const leftCustomer = await request("/api/dashboard", hostA, undefined, { headers: { cookie: customerCookie } });
  assert.ok([401, 403].includes(leftCustomer.status));
  await db.customerClubMembership.update({ where: { id: customerMembershipAId }, data: { status: "ACTIVE" } });

  stage = "staff-password-and-scope";
  const staffLogin = await passwordLogin(hostA, originA, staffName, staffPassword);
  assert.ok([200, 302].includes(staffLogin.callback.status));
  assert.equal(staffLogin.session?.user?.id, staffId);
  assert.equal(staffLogin.session?.user?.role, "STAFF");
  assert.equal(staffLogin.session?.user?.organizationId, orgA.id);
  const staffOwnClub = await request(`/api/customer-club/membership?organizationId=${encodeURIComponent(orgA.id)}`, hostA, undefined, { headers: { cookie: cookieHeader(staffLogin.cookies) } });
  assert.equal(staffOwnClub.status, 200);
  const staffForeignClub = await request(`/api/customer-club/membership?organizationId=${encodeURIComponent(orgB.id)}`, hostA, undefined, { headers: { cookie: cookieHeader(staffLogin.cookies) } });
  assert.equal(staffForeignClub.status, 403);
  const staffDashboard = await request("/api/dashboard", hostA, undefined, { headers: { cookie: cookieHeader(staffLogin.cookies) } });
  assert.equal(staffDashboard.status, 200);
  const staffDashboardBody = await staffDashboard.json();
  assert.equal((staffDashboardBody as { userContext?: { organizationId?: string } }).userContext?.organizationId, orgA.id);
  assert.ok(jsonContains(staffDashboardBody, orderAId));
  assert.ok(jsonContains(staffDashboardBody, appointmentAId));
  assert.ok(!jsonContains(staffDashboardBody, orderBId));
  assert.ok(!jsonContains(staffDashboardBody, appointmentBId));
  const staffConfirmB = await request(`/api/appointments/${encodeURIComponent(appointmentBId)}/confirm`, hostA, originA, {
    method: "POST", headers: { cookie: cookieHeader(staffLogin.cookies), "content-type": "application/json" }, body: "{}",
  });
  assert.equal(staffConfirmB.status, 403);
  assert.equal((await db.appointment.findUniqueOrThrow({ where: { id: appointmentBId } })).status, "PENDING");

  stage = "admin-password-and-scope";
  const adminLogin = await passwordLogin(hostA, originA, adminName, staffPassword);
  assert.ok([200, 302].includes(adminLogin.callback.status));
  assert.equal(adminLogin.session?.user?.id, adminId);
  assert.equal(adminLogin.session?.user?.role, "ADMIN");
  assert.equal(adminLogin.session?.user?.organizationId, orgA.id);
  const adminConfirmA = await request(`/api/appointments/${encodeURIComponent(appointmentAId)}/confirm`, hostA, originA, {
    method: "POST", headers: { cookie: cookieHeader(adminLogin.cookies), "content-type": "application/json" }, body: "{}",
  });
  assert.equal(adminConfirmA.status, 200);
  assert.equal((await db.appointment.findUniqueOrThrow({ where: { id: appointmentAId } })).status, "CONFIRMED");
  const adminConfirmB = await request(`/api/appointments/${encodeURIComponent(appointmentBId)}/confirm`, hostA, originA, {
    method: "POST", headers: { cookie: cookieHeader(adminLogin.cookies), "content-type": "application/json" }, body: "{}",
  });
  assert.equal(adminConfirmB.status, 403);
  assert.equal((await db.appointment.findUniqueOrThrow({ where: { id: appointmentBId } })).status, "PENDING");

  stage = "complete";
  testPassed = true;
});
