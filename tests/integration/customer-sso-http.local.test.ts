import assert from "node:assert/strict";
import { randomInt, randomUUID } from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { after, before, describe, it } from "node:test";
import { PrismaClient, type Organization } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { CustomerPhoneAuthService } from "../../lib/customer-auth/core.server";
import { customerAuthDigest, decryptCustomerAuthPayload } from "../../lib/customer-auth/crypto";

// Isolated local HTTP acceptance. No dotenv files, SMS/provider calls, or non-loopback DB.
const dbUrl = new URL(process.env.DATABASE_URL ?? "https://missing.invalid");
assert.ok(["postgres:", "postgresql:"].includes(dbUrl.protocol));
assert.equal(dbUrl.hostname, "127.0.0.1");
assert.equal(dbUrl.port, "55439");
assert.equal(dbUrl.pathname, "/retail_hero_test");
assert.equal(decodeURIComponent(dbUrl.username), "hero_test");
assert.equal(decodeURIComponent(dbUrl.password), "local_admin_fixture_only");
assert.equal(dbUrl.search, "");

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: dbUrl.toString(), max: 6 }), log: [] });
const port = "3029";
const loopback = "127.0.0.1";
const prefix = `customer-sso-http-${randomUUID()}`;
const sourceHost = "source-sso.localhost";
const targetHost = "target-sso.localhost";
const sourceOrigin = `http://${sourceHost}:${port}`;
const targetOrigin = `http://${targetHost}:${port}`;
const baseUrl = `http://${loopback}:${port}`;
const secret = `fixture-sso-${randomUUID()}-${randomUUID()}`;
const ownedOrgIds: string[] = [];
const ownedPhones = new Set<string>();
const ownedUserIds = new Set<string>();
const ownedQuotaKeys = new Set<string>();
let sourceOrg: Organization;
let targetOrg: Organization;
let server: ChildProcess | undefined;
let serverOutput = "";

function isolatedServerEnv() {
  const allowed = ["PATH", "PATHEXT", "SystemRoot", "SYSTEMROOT", "windir", "ComSpec", "TEMP", "TMP", "USERPROFILE", "APPDATA", "LOCALAPPDATA"];
  const env = Object.fromEntries(allowed.flatMap(key => process.env[key] === undefined ? [] : [[key, process.env[key]]])) as NodeJS.ProcessEnv;
  Object.assign(env, {
    DATABASE_URL: dbUrl.toString(), DIRECT_URL: dbUrl.toString(), LOCAL_PRISMA_EXPECTED_PORT: "55439",
    RETAIL_HERO_EXPECTED_DATABASE: "retail_hero_test", DATABASE_RUNTIME_ADAPTER: "postgresql",
    NODE_ENV: "development", NEXT_TELEMETRY_DISABLED: "1", NEXTAUTH_URL: baseUrl, NEXTAUTH_URL_INTERNAL: baseUrl,
    NEXTAUTH_SECRET: secret, CUSTOMER_SSO_SECRET: secret, CUSTOMER_SSO_ENABLED: "1", AUTH_TRUST_HOST: "true",
    NEXT_PUBLIC_APP_URL: baseUrl, NEXT_PUBLIC_DEPLOYED_APP_URL: baseUrl, BAZAR_BAZ_PLATFORM_HOSTS: "localhost,127.0.0.1",
    CUSTOMER_PHONE_AUTH_ENABLED: "1", SMS_PROVIDER: "DRY_RUN", SMS_DRY_RUN: "true", SMS_REAL_SEND_ENABLED: "false",
    SMS_GUEST_REAL_SEND_ENABLED: "false", EMAIL_PROVIDER: "DRY_RUN", EMAIL_REAL_SEND_ENABLED: "false",
    CUSTOM_DOMAIN_PROVIDER_ENABLED: "false", CUSTOM_DOMAIN_REAL_MUTATION_ENABLED: "false",
    VERCEL_DOMAIN_AUTOMATION_DRY_RUN: "true", RUNFLARE_DOMAIN_AUTOMATION_DRY_RUN: "true",
    WEB_PUSH_ENABLED: "false", WEB_PUSH_REAL_SEND_ENABLED: "false", BLOB_READ_WRITE_TOKEN: "",
    VERCEL_API_TOKEN: "", VERCEL_ACCESS_TOKEN: "", STRIPE_SECRET_KEY: "", STRIPE_WEBHOOK_SECRET: "",
    NODE_OPTIONS: `--require=${`${process.cwd()}/scripts/dev/isolated-next-env.cjs`.replaceAll("\\", "/")}`,
  });
  return env;
}

function appendOutput(chunk: Buffer) { serverOutput = (serverOutput + chunk.toString("utf8")).slice(-12_000); }

async function request(path: string, host: string, origin?: string, init: RequestInit = {}) {
  return fetch(`http://${host}:${port}${path}`, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      host: `${host}:${port}`,
      ...(origin ? { origin } : {}),
    },
  });
}

function cookiesFrom(response: Response) {
  return (response.headers.getSetCookie?.() ?? [response.headers.get("set-cookie") ?? ""])
    .flatMap(value => value.split(/,(?=[^;]+=[^;]+)/)).map(value => value.split(";", 1)[0]).filter(Boolean);
}
function cookieHeader(cookies: string[]) { return cookies.join("; "); }
function mergeCookies(existing: string[], response: Response) {
  const result = new Map(existing.map(value => [value.split("=", 1)[0], value]));
  for (const value of cookiesFrom(response)) result.set(value.split("=", 1)[0], value);
  return [...result.values()];
}

async function waitForServer() {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    if (server?.exitCode !== null && server?.exitCode !== undefined) throw new Error("isolated Next server exited before ready");
    try { if ((await fetch(`${baseUrl}/api/auth/csrf`)).ok) return; } catch { /* startup */ }
    await delay(500);
  }
  throw new Error("isolated Next server did not become ready in 120 seconds");
}

before(async () => {
  const identity = await db.$queryRaw<Array<{ database: string; role: string }>>`SELECT current_database()::text AS database, current_user::text AS role`;
  assert.deepEqual(identity, [{ database: "retail_hero_test", role: "hero_test" }]);
  sourceOrg = await db.organization.create({ data: { name: `${prefix}-source`, slug: `${prefix}-source`, type: "SHOP", locale: "fa" } });
  targetOrg = await db.organization.create({ data: { name: `${prefix}-target`, slug: `${prefix}-target`, type: "SHOP", locale: "fa" } });
  ownedOrgIds.push(sourceOrg.id, targetOrg.id);
  await db.organizationDomain.createMany({ data: [
    { organizationId: sourceOrg.id, domain: sourceHost, normalizedDomain: sourceHost, status: "ACTIVE", providerVerified: true, dnsConfigured: true, sslReady: true, verifiedAt: new Date() },
    { organizationId: targetOrg.id, domain: targetHost, normalizedDomain: targetHost, status: "ACTIVE", providerVerified: true, dnsConfigured: true, sslReady: true, verifiedAt: new Date() },
  ] });
  server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "--hostname", loopback, "--port", port], { cwd: process.cwd(), env: isolatedServerEnv(), stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
  server.stdout?.on("data", appendOutput);
  server.stderr?.on("data", appendOutput);
  await waitForServer();
});

after(async () => {
  let cleanupPassed = false;
  try {
    if (server && server.exitCode === null) {
      server.kill();
      await Promise.race([new Promise<void>(resolve => server?.once("exit", () => resolve())), delay(10_000)]);
    }
    const identities = await db.customerPhoneIdentity.findMany({ where: { phone: { in: [...ownedPhones] } }, select: { userId: true } });
    for (const row of identities) ownedUserIds.add(row.userId);
    await db.customerSsoTicket.deleteMany({ where: { targetOrganizationId: { in: ownedOrgIds } } });
    await db.customerPhoneSession.deleteMany({ where: { organizationId: { in: ownedOrgIds } } });
    await db.customerClubMembership.deleteMany({ where: { organizationId: { in: ownedOrgIds } } });
    await db.organizationDomain.deleteMany({ where: { organizationId: { in: ownedOrgIds } } });
    await db.organization.deleteMany({ where: { id: { in: ownedOrgIds } } });
    await db.customerAccessLink.deleteMany({ where: { organizationId: { in: ownedOrgIds } } });
    await db.customerPhoneIdentity.deleteMany({ where: { userId: { in: [...ownedUserIds] } } });
    await db.user.deleteMany({ where: { id: { in: [...ownedUserIds] } } });
    await db.customerPhoneAuthQuota.deleteMany({ where: { key: { in: [...ownedQuotaKeys] } } });
    assert.equal(await db.organization.count({ where: { id: { in: ownedOrgIds } } }), 0);
    cleanupPassed = true;
    console.log("CUSTOMER_SSO_HTTP_LOCAL_CLEANUP_PASSED");
  } finally {
    await db.$disconnect();
    if (serverOutput) console.log("HTTP_SERVER_OUTPUT_SUPPRESSED");
    console.log(`CUSTOMER_SSO_CLEANUP=${cleanupPassed ? "PASSED" : "FAILED"}`);
  }
});

describe("cross-domain customer SSO through isolated local HTTP", { concurrency: false }, () => {
  it("moves an authenticated customer into a separate host-only target session and rejects invalid exchanges", async () => {
    let phone = "";
    for (let attempt = 0; attempt < 20; attempt++) {
      const candidate = `09${randomInt(100_000_000, 1_000_000_000)}`;
      if (!await db.user.findFirst({ where: { OR: [{ name: candidate }, { phone: candidate }] }, select: { id: true } }) && !await db.customerPhoneIdentity.findUnique({ where: { phone: candidate } })) { phone = candidate; break; }
    }
    assert.ok(phone);
    ownedPhones.add(phone);
    const issuer = new CustomerPhoneAuthService(db, { enabled: true, secret, senderAvailable: () => true });
    ownedQuotaKeys.add(`phone:${customerAuthDigest(phone, secret)}`);
    ownedQuotaKeys.add(`ip:${customerAuthDigest("2001:db8::29", secret)}`);
    ownedQuotaKeys.add(`org:${sourceOrg.id}`);
    await issuer.request({ phone, organizationId: sourceOrg.id, origin: sourceOrigin, ip: "2001:db8::29", source: "WEB" });
    const link = await db.customerAccessLink.findFirstOrThrow({ where: { organizationId: sourceOrg.id, phone }, include: { smsOutbox: true } });
    const payload = decryptCustomerAuthPayload(link.smsOutbox!.encryptedPayload, secret, link.id);
    const phoneToken = new URLSearchParams(new URL(payload.url).hash.slice(1)).get("token");
    assert.ok(phoneToken);

    const sourceCsrfResponse = await request("/api/auth/csrf", sourceHost);
    const sourceCsrfCookies = cookiesFrom(sourceCsrfResponse);
    const sourceCsrfToken = (await sourceCsrfResponse.json() as { csrfToken: string }).csrfToken;
    const phoneCallback = await request("/api/auth/callback/customer-phone", sourceHost, sourceOrigin, { method: "POST", redirect: "manual", headers: { cookie: cookieHeader(sourceCsrfCookies), "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ csrfToken: sourceCsrfToken, callbackUrl: sourceOrigin, token: phoneToken!, organization: sourceOrg.slug }) });
    const sourceCookies = mergeCookies(sourceCsrfCookies, phoneCallback);
    const sourceSessionResponse = await request("/api/auth/session", sourceHost, undefined, { headers: { cookie: cookieHeader(sourceCookies) } });
    const sourceSession = await sourceSessionResponse.json() as { user?: { id?: string; role?: string; organizationId?: string } } | null;
    assert.ok(sourceSession, `source callback lacked session JSON: callback=${phoneCallback.status}; callbackCookieNames=${cookiesFrom(phoneCallback).map(value => value.split("=", 1)[0]).join(",")}; location=${phoneCallback.headers.get("location") ?? "none"}; sessionStatus=${sourceSessionResponse.status}; server=${serverOutput.split(/\r?\n/).slice(-20).join(" | ")}`);
    assert.equal(sourceSession.user?.role, "CUSTOMER");
    assert.equal(sourceSession.user?.organizationId, sourceOrg.id);
    const userId = sourceSession.user?.id;
    assert.ok(userId);
    ownedUserIds.add(userId!);
    await db.customerClubMembership.create({ data: { organizationId: targetOrg.id, customerId: userId!, source: "PUBLIC_SHOP" } });

    for (const source of ["https://attacker.example.test/", `https://${sourceHost}/redirect?next=evil`, `https://user:secret@${sourceHost}`]) {
      const rejected = await request("/api/auth/customer/sso/start", targetHost, targetOrigin, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ source }) });
      assert.equal(rejected.status, 400);
      assert.equal(cookiesFrom(rejected).length, 0);
    }
    const targetStart = await request("/api/auth/customer/sso/start", targetHost, targetOrigin, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ source: sourceHost }) });
    assert.equal(targetStart.status, 200);
    const startBody = await targetStart.json() as { next: string };
    const startUrl = new URL(startBody.next);
    assert.equal(startUrl.origin, sourceOrigin);
    const verifierCookie = cookiesFrom(targetStart).find(value => value.startsWith("bazar-customer-sso="));
    assert.ok(verifierCookie);
    assert.match(targetStart.headers.get("set-cookie") ?? "", /HttpOnly/i);
    assert.doesNotMatch(targetStart.headers.get("set-cookie") ?? "", /(?:^|;)\s*Domain=/i);
    const challenge = startUrl.searchParams.get("challenge");

    const targetIssueCsrf = await request("/api/auth/csrf", targetHost);
    const targetCookies = mergeCookies(cookiesFrom(targetIssueCsrf), targetStart);

    const sourceIssueInfo = await request(`/api/auth/customer/sso/issue?target=${encodeURIComponent(targetOrg.slug)}`, sourceHost, undefined, { headers: { cookie: cookieHeader(sourceCookies) } });
    assert.equal(sourceIssueInfo.status, 200);
    assert.equal((await sourceIssueInfo.json() as { available: boolean }).available, true);
    const issue = await request("/api/auth/customer/sso/issue", sourceHost, sourceOrigin, { method: "POST", headers: { cookie: cookieHeader(sourceCookies), "content-type": "application/json" }, body: JSON.stringify({ target: targetOrg.slug, challenge }) });
    assert.equal(issue.status, 200);
    const issueBody = await issue.json() as { next: string };
    const callbackUrl = new URL(issueBody.next);
    assert.equal(callbackUrl.origin, targetOrigin);
    assert.equal(callbackUrl.searchParams.get("organization"), targetOrg.slug);
    const ticket = new URLSearchParams(callbackUrl.hash.slice(1)).get("ticket");
    assert.ok(ticket);
    const ticketRow = await db.customerSsoTicket.findFirstOrThrow({ where: { userId: userId!, targetOrganizationId: targetOrg.id } });
    assert.equal(ticketRow.sourceSessionId, (await db.customerPhoneSession.findFirstOrThrow({ where: { userId: userId!, organizationId: sourceOrg.id } })).id);

    const targetCsrfResponse = await request("/api/auth/csrf", targetHost);
    const targetCsrfToken = (await targetCsrfResponse.json() as { csrfToken: string }).csrfToken;
    const callbackCookies = mergeCookies(targetCookies, targetCsrfResponse);
    const badVerifier = `${verifierCookie!.slice(0, -1)}${verifierCookie!.endsWith("A") ? "B" : "A"}`;
    const wrongVerifier = await request("/api/auth/callback/customer-sso", targetHost, targetOrigin, { method: "POST", redirect: "manual", headers: { cookie: cookieHeader(callbackCookies).replace(verifierCookie!, badVerifier), "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ csrfToken: targetCsrfToken, callbackUrl: targetOrigin, ticket: ticket!, organization: targetOrg.slug }) });
    const wrongVerifierSession = await request("/api/auth/session", targetHost, undefined, { headers: { cookie: cookieHeader(mergeCookies(callbackCookies, wrongVerifier)) } });
    assert.equal((await wrongVerifierSession.json() as { user?: unknown } | null)?.user, undefined);
    assert.equal((await db.customerSsoTicket.findUniqueOrThrow({ where: { id: ticketRow.id } })).consumedAt, null);

    const wrongOrigin = await request("/api/auth/callback/customer-sso", targetHost, "https://wrong-sso.localhost", { method: "POST", redirect: "manual", headers: { cookie: cookieHeader(callbackCookies), "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ csrfToken: targetCsrfToken, callbackUrl: targetOrigin, ticket: ticket!, organization: targetOrg.slug }) });
    assert.equal((await db.customerSsoTicket.findUniqueOrThrow({ where: { id: ticketRow.id } })).consumedAt, null);

    const targetCallback = await request("/api/auth/callback/customer-sso", targetHost, targetOrigin, { method: "POST", redirect: "manual", headers: { cookie: cookieHeader(callbackCookies), "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ csrfToken: targetCsrfToken, callbackUrl: targetOrigin, ticket: ticket!, organization: targetOrg.slug }) });
    assert.ok([200, 302].includes(targetCallback.status));
    const targetSessionCookies = mergeCookies(callbackCookies, targetCallback);
    const targetSessionResponse = await request("/api/auth/session", targetHost, undefined, { headers: { cookie: cookieHeader(targetSessionCookies) } });
    const targetSession = await targetSessionResponse.json() as { user?: { id?: string; role?: string; organizationId?: string } };
    assert.equal(targetSession.user?.id, userId);
    assert.equal(targetSession.user?.role, "CUSTOMER");
    assert.equal(targetSession.user?.organizationId, targetOrg.id);
    assert.equal((await db.customerSsoTicket.findUniqueOrThrow({ where: { id: ticketRow.id } })).consumedAt instanceof Date, true);
    assert.doesNotMatch((targetCallback.headers.getSetCookie?.() ?? []).join(";"), /(?:^|;)\s*Domain=/i);
    const targetPhoneSession = await db.customerPhoneSession.findFirstOrThrow({ where: { userId: userId!, organizationId: targetOrg.id } });
    const sourcePhoneSession = await db.customerPhoneSession.findFirstOrThrow({ where: { userId: userId!, organizationId: sourceOrg.id } });
    assert.notEqual(targetPhoneSession.id, sourcePhoneSession.id, "each host gets an independent persistent customer session");

    const sourceStillValid = await request("/api/auth/session", sourceHost, undefined, { headers: { cookie: cookieHeader(sourceCookies) } });
    assert.equal(((await sourceStillValid.json() as { user?: { id?: string } }).user)?.id, userId);
    const replay = await request("/api/auth/callback/customer-sso", targetHost, targetOrigin, { method: "POST", redirect: "manual", headers: { cookie: cookieHeader(callbackCookies), "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ csrfToken: targetCsrfToken, callbackUrl: targetOrigin, ticket: ticket!, organization: targetOrg.slug }) });
    const replaySession = await request("/api/auth/session", targetHost, undefined, { headers: { cookie: cookieHeader(mergeCookies(callbackCookies, replay)) } });
    assert.equal((await replaySession.json() as { user?: unknown } | null)?.user, undefined);

    const targetSignoutCsrf = await request("/api/auth/csrf", targetHost, undefined, { headers: { cookie: cookieHeader(targetSessionCookies) } });
    const signoutToken = (await targetSignoutCsrf.json() as { csrfToken: string }).csrfToken;
    const targetSignout = await request("/api/auth/signout", targetHost, targetOrigin, { method: "POST", redirect: "manual", headers: { cookie: cookieHeader(targetSessionCookies), "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ csrfToken: signoutToken, callbackUrl: targetOrigin }) });
    const targetAfterLogout = await request("/api/auth/session", targetHost, undefined, { headers: { cookie: cookieHeader(mergeCookies(targetSessionCookies, targetSignout)) } });
    assert.equal((await targetAfterLogout.json() as { user?: unknown } | null)?.user, undefined);
    const sourceAfterTargetLogout = await request("/api/auth/session", sourceHost, undefined, { headers: { cookie: cookieHeader(sourceCookies) } });
    assert.equal(((await sourceAfterTargetLogout.json() as { user?: { id?: string } }).user)?.id, userId);
    assert.ok(await db.customerPhoneSession.findFirst({ where: { userId: userId!, organizationId: targetOrg.id, revokedAt: { not: null } } }));
    assert.ok(await db.customerPhoneSession.findFirst({ where: { userId: userId!, organizationId: sourceOrg.id, revokedAt: null } }));
    assert.match(wrongOrigin.headers.get("location") ?? "", /error=CredentialsSignin/);
    console.log("CUSTOMER_SSO_HTTP_FLOW_PASSED");
  });
});
