import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { randomInt, randomUUID } from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { after, before, describe, it } from "node:test";
import { PrismaClient, type Organization } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { CustomerPhoneAuthService } from "../../lib/customer-auth/core.server";
import { customerAuthDigest, decryptCustomerAuthPayload } from "../../lib/customer-auth/crypto";

// Local HTTP acceptance only. Never loads dotenv/config or uses provider transport.
const dbUrl = new URL(process.env.DATABASE_URL ?? "https://missing.invalid");
assert.ok(["postgres:", "postgresql:"].includes(dbUrl.protocol));
assert.equal(dbUrl.hostname, "127.0.0.1");
assert.equal(dbUrl.port, "55439");
assert.equal(dbUrl.pathname, "/retail_hero_test");
assert.equal(decodeURIComponent(dbUrl.username), "hero_test");
assert.equal(decodeURIComponent(dbUrl.password), "local_admin_fixture_only");
assert.equal(dbUrl.search, "");
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: dbUrl.toString(), max: 6 }), log: [] });
const port = "3028";
const baseHost = "127.0.0.1";
const tenantHost = "phone-auth.localhost";
const baseUrl = `http://${baseHost}:${port}`;
const tenantUrl = `http://${tenantHost}:${port}`;
const keepBrowserFixture = process.env.CUSTOMER_PHONE_HTTP_KEEP_SERVER === "1";
const prefix = `phone-http-${randomUUID()}`;
const secret = `fixture-http-${randomUUID()}-${randomUUID()}`;
const ownedOrgIds: string[] = [];
const ownedPhones = new Set<string>();
const ownedUserIds = new Set<string>();
const ownedQuotaKeys = new Set<string>();
let organization: Organization;
let server: ChildProcess | undefined;
let serverOutput = "";
let serverStartupOutput = "";

function isolatedServerEnv() {
  const allowedSystem = ["PATH", "PATHEXT", "SystemRoot", "SYSTEMROOT", "windir", "ComSpec", "TEMP", "TMP", "USERPROFILE", "APPDATA", "LOCALAPPDATA"];
  const env = Object.fromEntries(allowedSystem.flatMap((key) => process.env[key] === undefined ? [] : [[key, process.env[key]]])) as NodeJS.ProcessEnv;
  Object.assign(env, {
    DATABASE_URL: dbUrl.toString(), DIRECT_URL: dbUrl.toString(),
    LOCAL_PRISMA_EXPECTED_PORT: "55439", RETAIL_HERO_EXPECTED_DATABASE: "retail_hero_test", DATABASE_RUNTIME_ADAPTER: "postgresql",
    NODE_ENV: "development", NEXT_TELEMETRY_DISABLED: "1", NEXTAUTH_URL: baseUrl, NEXTAUTH_URL_INTERNAL: baseUrl,
    NEXTAUTH_SECRET: secret, AUTH_TRUST_HOST: "true", NEXT_PUBLIC_APP_URL: baseUrl, NEXT_PUBLIC_DEPLOYED_APP_URL: baseUrl,
    BAZAR_BAZ_PLATFORM_HOSTS: "localhost,127.0.0.1", CUSTOMER_PHONE_AUTH_ENABLED: "1", RETAIL_GUEST_CHECKOUT_ENABLED: "1",
    SMS_PROVIDER: "DRY_RUN", SMS_DRY_RUN: "true", SMS_REAL_SEND_ENABLED: "false", SMS_GUEST_REAL_SEND_ENABLED: "false",
    EMAIL_PROVIDER: "DRY_RUN", EMAIL_REAL_SEND_ENABLED: "false", CUSTOM_DOMAIN_PROVIDER_ENABLED: "false",
    CUSTOM_DOMAIN_REAL_MUTATION_ENABLED: "false", VERCEL_DOMAIN_AUTOMATION_DRY_RUN: "true", RUNFLARE_DOMAIN_AUTOMATION_DRY_RUN: "true",
    WEB_PUSH_ENABLED: "false", WEB_PUSH_REAL_SEND_ENABLED: "false", BLOB_READ_WRITE_TOKEN: "", VERCEL_API_TOKEN: "",
    VERCEL_ACCESS_TOKEN: "", STRIPE_SECRET_KEY: "", STRIPE_WEBHOOK_SECRET: "",
    NODE_OPTIONS: `--require=${`${process.cwd()}/scripts/dev/isolated-next-env.cjs`.replaceAll("\\", "/")}`,
  });
  return env;
}

async function waitForServer() {
  const deadline = Date.now() + 120_000;
  let lastProbe = "not attempted";
  while (Date.now() < deadline) {
    if (server?.exitCode !== null && server?.exitCode !== undefined || server?.signalCode) break;
    try {
      const response = await fetch(`${baseUrl}/api/auth/csrf`, { signal: AbortSignal.timeout(Math.max(1, deadline - Date.now())) });
      if (response.ok) return;
      lastProbe = `HTTP ${response.status}`;
    } catch (error) { lastProbe = error instanceof Error ? error.name : "network failure"; }
    await delay(500);
  }
  // Synthetic startup only: redact fixture secrets; report the actual Next startup failure,
  // never response bodies, cookies, or OTPs. Preserve the 120s acceptance deadline.
  const diagnostic = (serverStartupOutput + "\n--- recent server output ---\n" + serverOutput.split(/\r?\n/).slice(-35).join("\n")).replaceAll(secret, "[fixture-secret]").replaceAll(dbUrl.toString(), "[fixture-db]").replaceAll(decodeURIComponent(dbUrl.password), "[fixture-password]");
  throw new Error(`isolated Next server readiness failed: ${lastProbe}; exit=${server?.exitCode ?? "none"}; signal=${server?.signalCode ?? "none"}\n${diagnostic || "No startup output captured"}`);
}

function appendOutput(chunk: Buffer) {
  const text = chunk.toString("utf8");
  serverStartupOutput = (serverStartupOutput + text).slice(0, 12_000);
  serverOutput = (serverOutput + text).slice(-12_000);
}

async function request(path: string, init: RequestInit = {}, host = tenantHost) {
  return fetch(`http://${host}:${port}${path}`, { ...init, headers: { ...(init.headers ?? {}), host: `${host}:${port}` } });
}

function cookiesFrom(response: Response) {
  return (response.headers.getSetCookie?.() ?? [response.headers.get("set-cookie") ?? ""]).flatMap((value) => value.split(/,(?=[^;]+=[^;]+)/)).map((value) => value.split(";", 1)[0]).filter(Boolean);
}
function cookieHeader(cookies: string[]) { return cookies.join("; "); }

before(async () => {
  const identity = await db.$queryRaw<Array<{ database: string; role: string }>>`SELECT current_database()::text AS database, current_user::text AS role`;
  assert.deepEqual(identity, [{ database: "retail_hero_test", role: "hero_test" }]);
  organization = await db.organization.create({ data: { name: `${prefix}-tenant`, slug: prefix, type: "SHOP", locale: "fa" } });
  ownedOrgIds.push(organization.id);
  await db.organizationDomain.create({ data: { organizationId: organization.id, domain: tenantHost, normalizedDomain: tenantHost, status: "ACTIVE", providerVerified: true, dnsConfigured: true, sslReady: true, verifiedAt: new Date() } });
  server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "--webpack", "--hostname", baseHost, "--port", port], { cwd: process.cwd(), env: isolatedServerEnv(), stdio: keepBrowserFixture ? "ignore" : ["ignore", "pipe", "pipe"], windowsHide: true });
  if (!keepBrowserFixture) {
    server.stdout?.on("data", appendOutput);
    server.stderr?.on("data", appendOutput);
  }
  server.on("error", error => appendOutput(Buffer.from(`\nNext spawn error: ${error.message}\n`)));
  await waitForServer();
});

after(async () => {
  try {
    if (keepBrowserFixture) {
      server?.unref();
      console.log("CUSTOMER_PHONE_AUTH_HTTP_BROWSER_FIXTURE_PRESERVED");
      console.log(`CUSTOMER_PHONE_AUTH_HTTP_BROWSER_URL=${tenantUrl}/fa/login/phone?organization=${encodeURIComponent(prefix)}`);
      console.log("CUSTOMER_PHONE_AUTH_HTTP_BROWSER_URL_HAS_NO_TOKEN=true");
      return;
    }
    if (server && server.exitCode === null) { server.kill(); await Promise.race([new Promise<void>((resolve) => server?.once("exit", () => resolve())), delay(10_000)]); }
    const identities = await db.customerPhoneIdentity.findMany({ where: { phone: { in: [...ownedPhones] } }, select: { userId: true } });
    for (const identity of identities) ownedUserIds.add(identity.userId);
    const retailOrders = await db.order.findMany({ where: { organizationSlug: prefix }, select: { id: true, guestCustomerId: true } });
    const retailOrderIds = retailOrders.map(o => o.id);
    await db.retailPaymentReport.deleteMany({ where: { orderId: { in: retailOrderIds } } });
    await db.paymentEvent.deleteMany({ where: { orderId: { in: retailOrderIds } } });
    await db.orderStatusHistory.deleteMany({ where: { orderId: { in: retailOrderIds } } });
    await db.inventoryMovement.deleteMany({ where: { orderId: { in: retailOrderIds } } });
    await db.payment.deleteMany({ where: { orderId: { in: retailOrderIds } } });
    await db.orderItem.deleteMany({ where: { orderId: { in: retailOrderIds } } });
    await db.order.deleteMany({ where: { id: { in: retailOrderIds } } });
    await db.guestCustomer.deleteMany({ where: { id: { in: retailOrders.flatMap(o => o.guestCustomerId ? [o.guestCustomerId] : []) } } });
    await db.paymentSettings.deleteMany({ where: { organizationSlug: prefix } });
    await db.organizationSettings.deleteMany({ where: { organizationSlug: prefix } });
    await db.shopCart.deleteMany({ where: { organizationSlug: prefix } });
    await db.product.deleteMany({ where: { organizationId: { in: ownedOrgIds } } });
    await db.productCategory.deleteMany({ where: { organizationId: { in: ownedOrgIds } } });
    await db.organizationCapability.deleteMany({ where: { organizationId: { in: ownedOrgIds } } });
    await db.organizationMember.deleteMany({ where: { organizationId: { in: ownedOrgIds } } });
    await db.customerClubMembership.deleteMany({ where: { organizationId: { in: ownedOrgIds } } });
    await db.organizationDomain.deleteMany({ where: { organizationId: { in: ownedOrgIds } } });
    await db.organization.deleteMany({ where: { id: { in: ownedOrgIds } } });
    await db.user.deleteMany({ where: { id: { in: [...ownedUserIds] } } });
    await db.customerPhoneAuthQuota.deleteMany({ where: { key: { in: [...ownedQuotaKeys] } } });
    assert.equal(await db.organization.count({ where: { id: { in: ownedOrgIds } } }), 0);
    console.log("CUSTOMER_PHONE_AUTH_HTTP_LOCAL_CLEANUP_PASSED");
  } finally {
    await db.$disconnect();
    if (serverOutput && process.env.CUSTOMER_PHONE_HTTP_DEBUG === "1") console.log("HTTP_SERVER_OUTPUT_SUPPRESSED");
  }
});

describe("customer phone auth through isolated local HTTP", { concurrency: false }, () => {
  it("fails closed for the real HTTP request gate and rejects an unowned tenant host", async () => {
    const good = await request("/api/auth/customer/config");
    assert.equal(good.status, 200);
    const config = await good.json() as { available: boolean; progressiveEnrollment?: boolean; organization?: { id: string; slug: string } | null };
    assert.equal(config.available, false, "provider singleton has no configured sender");
    assert.equal(config.progressiveEnrollment, false, "progressive gate defaults OFF");
    const disabled = await request("/api/auth/customer/progressive/request", { method: "POST", headers: { origin: tenantUrl, "content-type": "application/json" }, body: JSON.stringify({ phone: "09000000000", organization: prefix, purpose: "ACCOUNT_SIGN_IN" }) });
    assert.equal(disabled.status, 404);
    assert.equal(config.organization?.id, organization.id, "synthetic tenant host resolves through HTTP");
    const malformedOrDisabled = await request("/api/auth/customer/request", { method: "POST", headers: { origin: tenantUrl, "content-type": "application/json" }, body: JSON.stringify({ phone: "09000000000", organization: prefix }) });
    assert.equal(malformedOrDisabled.status, 202);
    assert.equal(await db.customerAccessLink.count({ where: { organizationId: organization.id } }), 0, "no request is issued while the singleton sender is unavailable");
    const wrongHost = await request("/api/auth/customer/config", {}, "wrong-phone-auth.localhost");
    assert.equal(wrongHost.status, 200);
    assert.equal((await wrongHost.json()).available, false);
  });

  it("signs in by HTTP, persists and revokes the session, then rejects replay", async () => {
    const identity = await db.$queryRaw<Array<{ database: string; role: string }>>`SELECT current_database()::text AS database, current_user::text AS role`;
    assert.deepEqual(identity, [{ database: "retail_hero_test", role: "hero_test" }]);
    let phone = "";
    for (let attempt = 0; attempt < 20; attempt++) {
      const candidate = `09${randomInt(100_000_000, 1_000_000_000)}`;
      if (!await db.user.findFirst({ where: { OR: [{ name: candidate }, { phone: candidate }] }, select: { id: true } }) && !await db.customerPhoneIdentity.findUnique({ where: { phone: candidate } })) { phone = candidate; break; }
    }
    assert.ok(phone);
    ownedPhones.add(phone);
    const issuer = new CustomerPhoneAuthService(db, { enabled: true, secret, senderAvailable: () => true });
    ownedQuotaKeys.add(`phone:${customerAuthDigest(phone, secret)}`);
    ownedQuotaKeys.add(`ip:${customerAuthDigest("2001:db8::28", secret)}`);
    ownedQuotaKeys.add(`org:${organization.id}`);
    await issuer.request({ phone, organizationId: organization.id, origin: tenantUrl, ip: "2001:db8::28", source: "WEB" });
    const link = await db.customerAccessLink.findFirstOrThrow({ where: { organizationId: organization.id, phone }, include: { smsOutbox: true } });
    assert.ok(link.smsOutbox);
    const payload = decryptCustomerAuthPayload(link.smsOutbox.encryptedPayload, secret, link.id);
    assert.ok(payload.url.startsWith("OTP:"), "outbox must carry an OTP payload");
    const otp = payload.url.slice(4);
    assert.match(otp, /^\d{4}$/, "exactly one four-digit OTP code");

    const csrf = await request("/api/auth/csrf");
    assert.equal(csrf.status, 200);
    const csrfCookies = cookiesFrom(csrf);
    const csrfToken = (await csrf.json() as { csrfToken: string }).csrfToken;
    const signIn = await request("/api/auth/callback/customer-phone", { method: "POST", redirect: "manual", headers: { origin: tenantUrl, cookie: cookieHeader(csrfCookies), "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ csrfToken, callbackUrl: tenantUrl, otp, phone, organization: prefix }) });
    assert.ok([200, 302].includes(signIn.status), `credentials callback should complete; status=${signIn.status}`);
    const authCookies = [...csrfCookies, ...cookiesFrom(signIn)];
    const cookie = cookieHeader(authCookies);
    const sessionResponse = await request("/api/auth/session", { headers: { cookie } });
    assert.equal(sessionResponse.status, 200);
    const session = await sessionResponse.json() as { user?: { role?: string; organizationId?: string }; expires?: string } | null;
    const persisted = await db.customerAccessLink.findUniqueOrThrow({ where: { id: link.id } });
    const callbackLocation = signIn.headers.get("location");
    const locationInfo = callbackLocation ? (() => { const parsed = new URL(callbackLocation, tenantUrl); return `${parsed.pathname};queryKeys=${[...parsed.searchParams.keys()].join(",")}`; })() : "none";
    const serverDiagnostic = serverOutput.replace(/09\d{9}/g, "[PHONE]").replace(/[A-Za-z0-9_-]{43}/g, "[TOKEN]").split(/\r?\n/).slice(-28).join(" | ");
    assert.ok(session, `callback did not establish a session (consumed=${Boolean(persisted.consumedAt)}; callback=${signIn.status}; csrfCookieNames=${csrfCookies.map((value) => value.split("=", 1)[0]).join(",")}; sessionCookieNames=${cookiesFrom(signIn).map((value) => value.split("=", 1)[0]).join(",")}; location=${locationInfo}; server=${serverDiagnostic})`);
    assert.equal(session.user?.role, "CUSTOMER");
    assert.ok(session.user?.organizationId === organization.id);
    assert.ok(persisted.consumedAt);
    const identityRow = await db.customerPhoneIdentity.findUniqueOrThrow({ where: { phone } });
    ownedUserIds.add(identityRow.userId);
    assert.equal(await db.customerClubMembership.count({ where: { customerId: identityRow.userId } }), 0, "OTP login must not enroll in the club");
    const persistedSession = await db.customerPhoneSession.findFirstOrThrow({ where: { userId: identityRow.userId, organizationId: organization.id } });
    assert.equal(persistedSession.revokedAt, null);
    const reloaded = await request("/api/auth/session", { headers: { cookie } });
    assert.equal((await reloaded.json() as { user?: { role?: string } }).user?.role, "CUSTOMER");

    const signOutCsrf = await request("/api/auth/csrf", { headers: { cookie } });
    const signOutToken = (await signOutCsrf.json() as { csrfToken: string }).csrfToken;
    const signOut = await request("/api/auth/signout", { method: "POST", redirect: "manual", headers: { origin: tenantUrl, cookie, "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ csrfToken: signOutToken, callbackUrl: tenantUrl }) });
    assert.ok([200, 302].includes(signOut.status));
    const cleared = [...authCookies, ...cookiesFrom(signOut)].join("; ");
    const noSession = await request("/api/auth/session", { headers: { cookie: cleared } });
    assert.equal((await noSession.json() as { user?: unknown } | null)?.user, undefined);
    const revoked = await db.customerPhoneSession.findUniqueOrThrow({ where: { id: persistedSession.id } });
    assert.ok(revoked.revokedAt);
    const replay = await request("/api/auth/callback/customer-phone", { method: "POST", redirect: "manual", headers: { origin: tenantUrl, cookie: cookieHeader(csrfCookies), "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ csrfToken, callbackUrl: tenantUrl, otp, phone, organization: prefix }) });
    assert.ok([200, 302, 401].includes(replay.status));
    const replaySession = await request("/api/auth/session", { headers: { cookie: cookieHeader([...csrfCookies, ...cookiesFrom(replay)]) } });
    assert.equal((await replaySession.json() as { user?: unknown } | null)?.user, undefined);
  });
  it("password login without a club creates only a scoped session, and the legacy hotel join flag cannot enroll", async () => {
    const username = `fixture-${randomUUID()}`;
    const password = `local-fixture-${randomUUID()}`;
    const user = await db.user.create({ data: { name: username, password: await bcrypt.hash(password, 12), role: "CUSTOMER", isTeamMember: false } });
    ownedUserIds.add(user.id);
    const csrf = await request("/api/auth/csrf");
    const csrfCookies = cookiesFrom(csrf);
    const csrfToken = (await csrf.json() as { csrfToken: string }).csrfToken;
    const response = await request("/api/auth/callback/credentials", { method: "POST", redirect: "manual", headers: { origin: tenantUrl, cookie: cookieHeader(csrfCookies), "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ csrfToken, callbackUrl: tenantUrl, username, password, hotelGuestJoin: "true" }) });
    const session = await request("/api/auth/session", { headers: { cookie: cookieHeader([...csrfCookies, ...cookiesFrom(response)]) } });
    const body = await session.json() as { user?: { id?: string; organizationId?: string } } | null;
    assert.equal(body?.user?.id, user.id);
    assert.equal(body?.user?.organizationId, organization.id);
    assert.equal(await db.customerClubMembership.count({ where: { customerId: user.id } }), 0);
    assert.equal(await db.customerPhoneSession.count({ where: { userId: user.id, organizationId: organization.id, revokedAt: null } }), 1);
  });
  it("guest carts share legacy and modern APIs, isolate owners and merge once by explicit authenticated POST", async () => {
    await db.organizationCapability.create({ data: { organizationId: organization.id, key: "SHOP", status: "ACTIVE", enabledAt: new Date() } });
    const foreignOrg = await db.organization.create({ data: { name: `Other ${prefix}`, slug: `not-${prefix}`, type: "SHOP" } });
    ownedOrgIds.push(foreignOrg.id);
    await db.organizationCapability.create({ data: { organizationId: foreignOrg.id, key: "SHOP", status: "ACTIVE", enabledAt: new Date() } });
    const userCount = await db.user.count();
    const category = await db.productCategory.create({ data: { name: "Synthetic cart category", organizationId: organization.id, organizationSlug: prefix } });
    const product = await db.product.create({ data: { name: "Synthetic cart product", basePrice: 10000, organizationId: organization.id, organizationSlug: prefix, categoryId: category.id, trackInventory: true } });
    const variant = await db.productVariant.create({ data: { productId: product.id, name: "Synthetic option", inventory: 10 } });
    const path = `/api/retail/v1/cart?organization=${encodeURIComponent(prefix)}`;
    const init = await request(path);
    assert.equal(init.status, 200);
    assert.equal((await init.json()).cart, null);
    const setCookie = init.headers.getSetCookie().find(value => value.startsWith("guest_session_id="));
    assert.ok(setCookie && /HttpOnly/i.test(setCookie) && /SameSite=Lax/i.test(setCookie) && !/;\s*Domain=/i.test(setCookie));
    const guest = setCookie.split(";", 1)[0];
    const guestValue = guest.slice(guest.indexOf("=") + 1);
    const mutate = (method: string, body: unknown, cookie = guest, origin = tenantUrl) => request("/api/retail/v1/cart", { method, headers: { cookie, origin, "content-type": "application/json" }, body: JSON.stringify(body) });
    const added = await mutate("POST", { organization: prefix, variantId: variant.id, quantity: 2 });
    assert.equal(added.status, 201);
    const item = (await added.json()).item;
    assert.equal(item.quantity, 2);
    const legacy = await request(`/api/cart?organizationSlug=${encodeURIComponent(prefix)}`, { headers: { cookie: guest } });
    assert.equal(legacy.status, 200);
    const legacyText = await legacy.text();
    assert.ok(!legacyText.includes(guestValue), "cart response must not disclose bearer cookie");
    assert.equal(JSON.parse(legacyText).items[0].id, item.id);
    const other = await request(path);
    assert.equal((await other.json()).cart, null);
    const otherCookie = cookiesFrom(other).find(value => value.startsWith("guest_session_id="));
    assert.ok(otherCookie && otherCookie !== guest);
    assert.equal((await mutate("PATCH", { organization: prefix, itemId: item.id, quantity: 3 }, otherCookie)).status, 404);
    assert.equal((await mutate("DELETE", { organization: prefix, itemId: item.id }, "")).status, 404);
    assert.equal((await mutate("PATCH", { organization: prefix, itemId: item.id, quantity: 3 }, guest, "https://foreign.example.test")).status, 403);
    assert.equal((await request(`/api/retail/v1/cart?organization=not-${prefix}`, { headers: { cookie: guest } })).status, 404);
    assert.equal((await mutate("PATCH", { organization: prefix, itemId: item.id, quantity: 3 })).status, 200);
    const invalid = await request(path, { headers: { cookie: "guest_session_id=invalid-session" } });
    assert.equal((await invalid.json()).cart, null);
    assert.ok(invalid.headers.getSetCookie().some(value => value.startsWith("guest_session_id=") && !value.includes("invalid-session")));
    assert.equal(await db.user.count(), userCount, "guest cart must not create an account");
    const unavailable = await db.productVariant.create({ data: { productId: product.id, name: "Later unavailable", inventory: 2 } });
    assert.equal((await mutate("POST", { organization: prefix, variantId: unavailable.id, quantity: 1 })).status, 201);
    await db.productVariant.update({ where: { id: unavailable.id }, data: { manuallyUnavailable: true } });
    const username = `cart-${randomUUID()}`, password = `fixture-${randomUUID()}`;
    const user = await db.user.create({ data: { name: username, password: await bcrypt.hash(password, 12), role: "CUSTOMER", isTeamMember: false } });
    ownedUserIds.add(user.id);
    const csrf = await request("/api/auth/csrf");
    const csrfToken = (await csrf.json() as { csrfToken: string }).csrfToken;
    const signIn = await request("/api/auth/callback/credentials", { method: "POST", redirect: "manual", headers: { origin: tenantUrl, cookie: cookieHeader(cookiesFrom(csrf)), "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ csrfToken, callbackUrl: tenantUrl, username, password }) });
    const accountCookie = cookieHeader([...cookiesFrom(csrf), ...cookiesFrom(signIn), guest]);
    await db.shopCart.create({ data: { organizationSlug: prefix, customerId: user.id, items: { create: { variantId: variant.id, quantity: 4 } } } });
    const before = await request(path, { headers: { cookie: accountCookie } });
    assert.equal(before.status, 200);
    const beforeBody = await before.json();
    assert.equal(beforeBody.cart.items[0].quantity, 4); assert.equal(beforeBody.mergePending, true);
    assert.equal(await db.shopCartItem.count({ where: { cart: { organizationSlug: prefix, customerId: user.id } } }), 1, "GET must not merge guest cart");
    const [first, second] = await Promise.all([mutate("POST", { organization: prefix, action: "merge" }, accountCookie), mutate("POST", { organization: prefix, action: "merge" }, accountCookie)]);
    assert.equal(first.status, 200); assert.equal(second.status, 200);
    const saved = await db.shopCart.findUniqueOrThrow({ where: { organizationSlug_customerId: { organizationSlug: prefix, customerId: user.id } }, include: { items: true } });
    assert.equal(saved.items.length, 2);
    const mergedItem = saved.items.find(line => line.variantId === variant.id);
    assert.ok(mergedItem); assert.equal(mergedItem.quantity, 7);
    assert.equal(saved.items.find(line => line.variantId === unavailable.id)?.quantity, 1, "unavailable selection must survive merge");
    assert.equal((await mutate("PATCH", { organization: prefix, itemId: item.id, quantity: 1 }, guest)).status, 404);
    assert.equal(await db.shopCart.count({ where: { organizationSlug: prefix, sessionId: guestValue } }), 0);
    assert.equal(await db.customerClubMembership.count({ where: { customerId: user.id } }), 0);
    assert.equal((await request(path, { headers: { cookie: guest } }).then(r => r.json())).cart, null);
    const final = await mutate("DELETE", { organization: prefix, itemId: mergedItem.id }, accountCookie);
    assert.equal(final.status, 200);
  });

  it("guest checkout binds reviewed order, recovery and bank report to the same tenant browser without an account", async () => {
    const users = await db.user.count(), memberships = await db.customerClubMembership.count();
    await db.organizationSettings.create({ data: { organizationSlug: prefix, enablePickup: true, enableDelivery: true, deliveryFee: 500 } });
    await db.paymentSettings.create({ data: { organizationSlug: prefix, settings: { retailR4: {
      bankTransferEnabled: true, cashEnabled: true, inotiUssdEnabled: false, bankCardNumber: "6037990000000000", bankAccountOwner: "Synthetic", cashModes: ["COUNTER", "PICKUP", "COURIER"], cashBeforeConfirmation: false } } } });
    const category = await db.productCategory.create({ data: { name: "Guest checkout fixture", organizationId: organization.id, organizationSlug: prefix } });
    const product = await db.product.create({ data: { name: "Guest checkout item", basePrice: 15000, organizationId: organization.id, organizationSlug: prefix, categoryId: category.id, trackInventory: true } });
    const variant = await db.productVariant.create({ data: { productId: product.id, name: "Guest fixture", inventory: 10 } });
    const cartPath = `/api/retail/v1/cart?organization=${encodeURIComponent(prefix)}`;
    const init = await request(cartPath), other = await request(cartPath);
    const guest = cookiesFrom(init).find(c => c.startsWith("guest_session_id="))!, foreign = cookiesFrom(other).find(c => c.startsWith("guest_session_id="))!;
    assert.ok(guest && foreign && guest !== foreign);
    const post = (path: string, body: unknown, cookie = guest, origin = tenantUrl) => request(path, { method: "POST", headers: { cookie, origin, "content-type": "application/json" }, body: JSON.stringify(body) });
    const get = (path: string, cookie = guest) => request(path, { headers: { cookie } });
    assert.equal((await post("/api/retail/v1/cart", { organization: prefix, variantId: variant.id, quantity: 2 })).status, 201);
    const quotePath = "/api/retail/v1/checkout/quote", checkoutPath = "/api/retail/v1/checkout";
    const data = { organization: prefix, type: "PICK_UP", recipientName: "Synthetic Guest", recipientMobile: "09120000000", paymentMethod: "BANK_TRANSFER" };
    const quoteResponse = await post(quotePath, data);
    assert.equal(quoteResponse.status, 200); const { quote } = await quoteResponse.json();
    assert.equal(quote.total, 30000); assert.equal(quote.customer.name, null);
    const key = randomUUID(), body = { ...data, idempotencyKey: key, reviewToken: quote.reviewToken };
    assert.equal((await post(checkoutPath, { ...body, reviewToken: undefined })).status, 400);
    assert.equal((await post(checkoutPath, { ...body, couponCode: "ACCOUNT" })).status, 409);
    assert.equal((await post(checkoutPath, { ...body, paymentMethod: "INOTI_USSD" })).status, 409);
    assert.equal((await post(checkoutPath, body, guest, "https://foreign.example.test")).status, 403);
    assert.equal((await post(checkoutPath, { ...body, recipientName: "Changed name" })).status, 409);
    const [a, b] = await Promise.all([post(checkoutPath, body), post(checkoutPath, body)]);
    assert.equal(a.status, 201); assert.equal(b.status, 201);
    const first = await a.json(), second = await b.json(); assert.equal(first.orderNumber, second.orderNumber);
    assert.equal(first.paymentStatus, "PENDING");
    const saved = await db.order.findUniqueOrThrow({ where: { orderNumber: first.orderNumber }, include: { guestCustomer: true, payment: true } });
    assert.equal(saved.customerId, null); assert.ok(saved.guestCustomerId); assert.equal(saved.guestCustomer?.name, data.recipientName);
    assert.ok(!saved.guestCustomer?.sessionId.includes(guest.split("=")[1]!), "raw cookie must not be persisted as order ownership");
    assert.equal(saved.payment?.status, "PENDING"); assert.equal((await db.productVariant.findUniqueOrThrow({ where: { id: variant.id } })).inventory, 8);
    assert.equal(await db.order.count({ where: { retailCheckoutKey: key } }), 1);
    const orderPath = `/api/retail/v1/orders/${first.orderNumber}?organization=${encodeURIComponent(prefix)}`;
    const recovery = `${checkoutPath}?organization=${encodeURIComponent(prefix)}&idempotencyKey=${key}`;
    const listPath = `/api/retail/v1/orders?organization=${encodeURIComponent(prefix)}`;
    assert.equal((await get(orderPath)).status, 200); assert.equal((await get(recovery)).status, 200);
    assert.equal((await get(orderPath, foreign)).status, 404); assert.equal((await get(recovery, foreign)).status, 404);
    assert.equal((await get(orderPath, "")).status, 404);
    const forgedCookie = `guest_session_id=${saved.guestCustomer!.sessionId}`;
    assert.equal((await get(orderPath, forgedCookie)).status, 404);
    assert.equal((await get(`/api/public/orders/${first.orderNumber}`, forgedCookie)).status, 403);
    assert.equal((await get(orderPath.replace(encodeURIComponent(prefix), `not-${prefix}`))).status, 404);
    assert.equal((await get(listPath).then(r => r.json())).orders.length, 1);
    assert.equal((await get(listPath, foreign).then(r => r.json())).orders.length, 0);
    const bankPath = `/api/retail/v1/orders/${first.orderNumber}/bank-report?organization=${encodeURIComponent(prefix)}`;
    const report = { method: "TIME", reportedAt: new Date().toISOString(), submittedLocalTime: "Synthetic time" };
    assert.equal((await post(bankPath, report, foreign)).status, 404);
    assert.equal((await post(bankPath, report)).status, 201);
    assert.equal((await post(bankPath, report)).status, 409);
    const paymentReport = await db.retailPaymentReport.findFirstOrThrow({ where: { orderId: saved.id } });
    assert.equal(paymentReport.submittedById, `guest:${saved.guestCustomerId}`); assert.equal(paymentReport.status, "PENDING_REVIEW");
    assert.equal((await db.order.findUniqueOrThrow({ where: { id: saved.id } })).paymentStatus, "PENDING");
    assert.equal(await db.user.count(), users); assert.equal(await db.customerClubMembership.count(), memberships);
    // A second order using the same browser but cash has an independent contact record.
    assert.equal((await post("/api/retail/v1/cart", { organization: prefix, variantId: variant.id, quantity: 1 })).status, 201);
    const cash = { ...data, paymentMethod: "CASH", cashMode: "PICKUP", recipientName: "Second Guest" };
    const cashQuote = await post(quotePath, cash); assert.equal(cashQuote.status, 200);
    const cashOrder = await post(checkoutPath, { ...cash, idempotencyKey: randomUUID(), reviewToken: (await cashQuote.json()).quote.reviewToken });
    assert.equal(cashOrder.status, 201); assert.equal((await cashOrder.json()).paymentStatus, "PENDING");
    assert.equal((await db.guestCustomer.findUniqueOrThrow({ where: { id: saved.guestCustomerId! } })).name, data.recipientName);
    // A foreign browser cannot reuse a key to obtain or overwrite the first order.
    assert.equal((await post("/api/retail/v1/cart", { organization: prefix, variantId: variant.id, quantity: 1 }, foreign)).status, 201);
    const foreignQuote = await post(quotePath, cash, foreign); assert.equal(foreignQuote.status, 200);
    assert.equal((await post(checkoutPath, { ...cash, idempotencyKey: key, reviewToken: (await foreignQuote.json()).quote.reviewToken }, foreign)).status, 409);
    assert.equal(await db.order.count({ where: { retailCheckoutKey: key } }), 1);
    assert.equal((await db.productVariant.findUniqueOrThrow({ where: { id: variant.id } })).inventory, 7);
    const third = await post(checkoutPath, { ...cash, idempotencyKey: randomUUID(), reviewToken: (await post(quotePath, cash, foreign).then(r => r.json())).quote.reviewToken }, foreign);
    assert.equal(third.status, 201);
    const rotated = `guest_session_id=${randomUUID()}`;
    assert.equal((await post("/api/retail/v1/cart", { organization: prefix, variantId: variant.id, quantity: 1 }, rotated)).status, 201);
    const rotatedQuote = await post(quotePath, cash, rotated); assert.equal(rotatedQuote.status, 200);
    const rejected = await post(checkoutPath, { ...cash, idempotencyKey: randomUUID(), reviewToken: (await rotatedQuote.json()).quote.reviewToken }, rotated);
    assert.equal(rejected.status, 429);
    assert.equal((await db.productVariant.findUniqueOrThrow({ where: { id: variant.id } })).inventory, 6);
    assert.equal((await post(checkoutPath, body)).status, 201, "existing idempotent replay remains available at the contact limit");
  });

  it("creates and tracks guest appointments without an account; rejects foreign tenant and cookie rotation abuse", async () => {
    const slug = `${prefix}-appointment`;
    const host = "appointment-auth.localhost", origin = `http://${host}:${port}`;
    const org = await db.organization.create({ data: { name: slug, slug, type: "APPOINTMENT", timezone: "UTC" } });
    try {
      await db.organizationDomain.create({ data: { organizationId: org.id, domain: host, normalizedDomain: host, status: "ACTIVE", providerVerified: true, dnsConfigured: true, sslReady: true, verifiedAt: new Date() } });
      const category = await db.serviceCategory.create({ data: { organizationId: org.id, name: "Fixture services" } });
      const service = await db.service.create({ data: { organizationId: org.id, categoryId: category.id, name: "Fixture appointment", duration: 30, price: 1000 } });
      const date = new Date(); date.setUTCDate(date.getUTCDate() + 2); date.setUTCHours(10, 0, 0, 0);
      const days = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"] as const;
      await db.businessHour.create({ data: { organizationId: org.id, day: days[date.getUTCDay()]!, openTime: "08:00", closeTime: "20:00", isOpen: true } });
      await db.bookingSettings.create({ data: { organizationSlug: slug, autoConfirm: false } });
      const users = await db.user.count(); const memberships = await db.customerClubMembership.count();
      const booking = { serviceId: service.id, date: date.toISOString(), startTime: date.toISOString(), customerName: "Fixture Guest", customerPhone: "09120000000", notes: "private note" };
      const submit = (body: unknown, cookie = "", target = host, targetOrigin = origin) => request("/api/appointments", { method: "POST", headers: { cookie, origin: targetOrigin, "content-type": "application/json" }, body: JSON.stringify(body) }, target);
      assert.equal((await submit(booking, "", tenantHost, tenantUrl)).status, 404);
      assert.equal((await submit(booking, "", host, "https://foreign.example.test")).status, 403);
      const first = await submit(booking); assert.equal(first.status, 201);
      const data = await first.json(); assert.deepEqual(Object.keys(data).sort(), ["bookingReference", "id", "status"]); assert.equal(data.status, "PENDING");
      const guest = cookiesFrom(first).find(c => c.startsWith("guest_session_id_local="))!;
      assert.ok(guest); const raw = guest.split("=")[1]!;
      const saved = await db.appointment.findUniqueOrThrow({ where: { id: data.id }, include: { guestCustomer: true } });
      assert.equal(saved.customerId, null); assert.ok(saved.guestCustomer); assert.ok(!saved.guestCustomer.sessionId.includes(raw));
      const detail = `/api/public/appointments/${data.id}?organizationSlug=${encodeURIComponent(slug)}`;
      assert.equal((await request(detail, { headers: { cookie: guest } }, host)).status, 200);
      assert.equal((await request(detail, { headers: { cookie: `guest_session_id_local=appointment-${randomUUID()}` } }, host)).status, 404);
      assert.equal((await request(detail, { headers: { cookie: `guest_session_id_local=${saved.guestCustomer.sessionId}` } }, host)).status, 403);
      assert.equal((await request(detail, { headers: { cookie: guest } }, tenantHost)).status, 404);
      const lookup = await request("/api/public/appointments/lookup", { method: "POST", headers: { cookie: guest, origin, "content-type": "application/json" }, body: JSON.stringify({ organizationSlug: slug }) }, host);
      assert.equal(lookup.status, 200); assert.equal((await lookup.json()).appointments[0].id, data.id);
      for (let i = 1; i <= 3; i++) {
        const later = new Date(date.getTime() + i * 60 * 60_000);
        const result = await submit({ ...booking, customerPhone: "+98 9120000000", customerName: `Guest ${i}`, startTime: later.toISOString() }, `guest_session_id_local=appointment-${randomUUID()}`);
        assert.equal(result.status, i < 3 ? 201 : 429);
      }
      assert.equal(await db.appointment.count({ where: { serviceId: service.id } }), 3);
      assert.equal(await db.user.count(), users); assert.equal(await db.customerClubMembership.count(), memberships);
      assert.equal((await db.guestCustomer.findUniqueOrThrow({ where: { id: saved.guestCustomerId! } })).name, booking.customerName);
    } finally {
      const records = await db.appointment.findMany({ where: { service: { organizationId: org.id } }, select: { id: true, guestCustomerId: true } });
      await db.appointment.deleteMany({ where: { id: { in: records.map(r => r.id) } } });
      await db.guestCustomer.deleteMany({ where: { id: { in: records.flatMap(r => r.guestCustomerId ? [r.guestCustomerId] : []) } } });
      await db.bookingSettings.deleteMany({ where: { organizationSlug: slug } });
      await db.businessHour.deleteMany({ where: { organizationId: org.id } });
      await db.service.deleteMany({ where: { organizationId: org.id } });
      await db.serviceCategory.deleteMany({ where: { organizationId: org.id } });
      await db.organizationDomain.deleteMany({ where: { organizationId: org.id } });
      await db.organization.delete({ where: { id: org.id } });
    }
  });

});
