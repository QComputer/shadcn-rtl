import assert from "node:assert/strict";
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

function isolatedServerEnv() {
  const allowedSystem = ["PATH", "PATHEXT", "SystemRoot", "SYSTEMROOT", "windir", "ComSpec", "TEMP", "TMP", "USERPROFILE", "APPDATA", "LOCALAPPDATA"];
  const env = Object.fromEntries(allowedSystem.flatMap((key) => process.env[key] === undefined ? [] : [[key, process.env[key]]])) as NodeJS.ProcessEnv;
  Object.assign(env, {
    DATABASE_URL: dbUrl.toString(), DIRECT_URL: dbUrl.toString(),
    LOCAL_PRISMA_EXPECTED_PORT: "55439", RETAIL_HERO_EXPECTED_DATABASE: "retail_hero_test", DATABASE_RUNTIME_ADAPTER: "postgresql",
    NODE_ENV: "development", NEXT_TELEMETRY_DISABLED: "1", NEXTAUTH_URL: baseUrl, NEXTAUTH_URL_INTERNAL: baseUrl,
    NEXTAUTH_SECRET: secret, AUTH_TRUST_HOST: "true", NEXT_PUBLIC_APP_URL: baseUrl, NEXT_PUBLIC_DEPLOYED_APP_URL: baseUrl,
    BAZAR_BAZ_PLATFORM_HOSTS: "localhost,127.0.0.1", CUSTOMER_PHONE_AUTH_ENABLED: "1",
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
  while (Date.now() < deadline) {
    if (server?.exitCode !== null && server?.exitCode !== undefined) throw new Error("isolated Next server exited before becoming ready");
    try { if ((await fetch(`${baseUrl}/api/auth/csrf`)).ok) return; } catch { /* startup in progress */ }
    await delay(500);
  }
  throw new Error("isolated Next server did not become ready within 120 seconds");
}

function appendOutput(chunk: Buffer) {
  serverOutput = (serverOutput + chunk.toString("utf8")).slice(-12_000);
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
  server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "--hostname", baseHost, "--port", port], { cwd: process.cwd(), env: isolatedServerEnv(), stdio: keepBrowserFixture ? "ignore" : ["ignore", "pipe", "pipe"], windowsHide: true });
  if (!keepBrowserFixture) {
    server.stdout?.on("data", appendOutput);
    server.stderr?.on("data", appendOutput);
  }
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
    const config = await good.json() as { available: boolean; organization?: { id: string; slug: string } | null };
    assert.equal(config.available, false, "provider singleton has no configured sender");
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
    const rawToken = new URLSearchParams(new URL(payload.url).hash.slice(1)).get("token");
    assert.ok(rawToken && /^[A-Za-z0-9_-]{43}$/.test(rawToken));
    assert.equal(link.tokenDigest, customerAuthDigest(rawToken, secret));

    const csrf = await request("/api/auth/csrf");
    assert.equal(csrf.status, 200);
    const csrfCookies = cookiesFrom(csrf);
    const csrfToken = (await csrf.json() as { csrfToken: string }).csrfToken;
    const signIn = await request("/api/auth/callback/customer-phone", { method: "POST", redirect: "manual", headers: { origin: tenantUrl, cookie: cookieHeader(csrfCookies), "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ csrfToken, callbackUrl: tenantUrl, token: rawToken, organization: prefix }) });
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
    const replay = await request("/api/auth/callback/customer-phone", { method: "POST", redirect: "manual", headers: { origin: tenantUrl, cookie: cookieHeader(csrfCookies), "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ csrfToken, callbackUrl: tenantUrl, token: rawToken, organization: prefix }) });
    assert.ok([200, 302, 401].includes(replay.status));
    const replaySession = await request("/api/auth/session", { headers: { cookie: cookieHeader([...csrfCookies, ...cookiesFrom(replay)]) } });
    assert.equal((await replaySession.json() as { user?: unknown } | null)?.user, undefined);
  });
});
