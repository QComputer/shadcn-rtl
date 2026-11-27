import assert from "node:assert/strict";
import { chromium } from "playwright";
import { randomInt, randomUUID } from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { after, before, describe, it } from "node:test";
import { PrismaClient, type Organization } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { CustomerPhoneAuthService } from "../../lib/customer-auth/core.server";
import { customerAuthDigest, decryptCustomerAuthPayload } from "../../lib/customer-auth/crypto";
import { isProgressiveChallengeId } from "../../lib/customer-auth/progressive-contract";
import { guestOrderScope } from "../../lib/retail/guest-order-scope";
import { appointmentGuestScope } from "../../lib/appointments/guest-scope";
import type { GuestClaimScope, GuestClaimKind } from "../../lib/customer-auth/guest-claim.contract";
import type { CustomerVerificationPurpose } from "../../lib/customer-auth/core.server";

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
const port = "3030";
const baseHost = "127.0.0.1";
const tenantHost = "phone-auth.localhost";
const baseUrl = `http://${baseHost}:${port}`;
const tenantUrl = `http://${tenantHost}:${port}`;

const prefix = `progressive-http-${randomUUID()}`;
const secret = `fixture-http-${randomUUID()}-${randomUUID()}`;
const ownedOrgIds: string[] = [];
const ownedPhones = new Set<string>();

const ownedQuotaKeys = new Set<string>();
const claimOrders: string[] = [], claimAppointments: string[] = [], claimGuests: string[] = [], claimServices: string[] = [], claimCategories: string[] = [];
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
    NODE_ENV: "development", PORT: port, NEXT_TELEMETRY_DISABLED: "1", NEXTAUTH_URL: baseUrl, NEXTAUTH_URL_INTERNAL: baseUrl,
    NEXTAUTH_SECRET: secret, AUTH_TRUST_HOST: "true", NEXT_PUBLIC_APP_URL: baseUrl, NEXT_PUBLIC_DEPLOYED_APP_URL: baseUrl,
    BAZAR_BAZ_PLATFORM_HOSTS: "localhost,127.0.0.1", CUSTOMER_PHONE_AUTH_ENABLED: "1", CUSTOMER_PROGRESSIVE_ENROLLMENT_ENABLED: "1", CUSTOMER_GUEST_CLAIM_ENABLED: "1", RETAIL_GUEST_CHECKOUT_ENABLED: "0",
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
  server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "--webpack", "--hostname", baseHost, "--port", port], { cwd: process.cwd(), env: isolatedServerEnv(), stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
  server.stdout?.on("data", appendOutput); server.stderr?.on("data", appendOutput);
  server.on("error", error => appendOutput(Buffer.from(`Next spawn error: ${error.message}`)));
  await waitForServer();
  // Auth API requests bypass storefront routing. Prove the independent page
  // resolver is available on this fixture's own port before browser acceptance.
  const resolver = await fetch(`${baseUrl}/api/internal/domain-resolver?host=${encodeURIComponent(tenantHost)}`, { signal: AbortSignal.timeout(120_000) });
  assert.equal(resolver.status, 200, "isolated custom-domain resolver must resolve the fixture tenant");
  const resolved = await resolver.json() as { organizationId?: string; slug?: string };
  assert.equal(resolved.organizationId, organization.id);
  assert.equal(resolved.slug, prefix);
});
after(async () => {
  try {
    if (server && server.exitCode === null) { server.kill(); await Promise.race([new Promise<void>(resolve => server?.once("exit", () => resolve())), delay(10_000)]); }
    const ids = await db.customerPhoneIdentity.findMany({ where: { phone: { in: [...ownedPhones] } }, select: { userId: true } });
    await db.auditLog.deleteMany({ where: { organizationId: { in: ownedOrgIds }, entityType: { in: ["GuestOrderClaim", "GuestAppointmentClaim"] } } });
    await db.payment.deleteMany({ where: { orderId: { in: claimOrders } } });
    await db.order.deleteMany({ where: { id: { in: claimOrders } } });
    await db.appointment.deleteMany({ where: { id: { in: claimAppointments } } });
    await db.guestCustomer.deleteMany({ where: { id: { in: claimGuests } } });
    await db.service.deleteMany({ where: { id: { in: claimServices } } });
    await db.serviceCategory.deleteMany({ where: { id: { in: claimCategories } } });
    await db.customerClubMembership.deleteMany({ where: { organizationId: { in: ownedOrgIds } } });
    await db.organizationDomain.deleteMany({ where: { organizationId: { in: ownedOrgIds } } });
    await db.organization.deleteMany({ where: { id: { in: ownedOrgIds } } });
    await db.user.deleteMany({ where: { id: { in: ids.map(x => x.userId) } } });
    await db.customerPhoneAuthQuota.deleteMany({ where: { key: { in: [...ownedQuotaKeys] } } });
    assert.equal(await db.organization.count({ where: { id: { in: ownedOrgIds } } }), 0);
  } finally { await db.$disconnect(); }
});
async function freshPhone() {
  for (let attempt = 0; attempt < 20; attempt++) {
    const phone = `09${randomInt(100_000_000, 1_000_000_000)}`;
    if (!ownedPhones.has(phone) && !await db.user.findFirst({ where: { OR: [{ name: phone }, { phone }] }, select: { id: true } }) && !await db.customerPhoneIdentity.findUnique({ where: { phone } })) { ownedPhones.add(phone); return phone; }
  }
  throw new Error("Could not allocate synthetic phone");
}
async function issue(phone: string, purpose: CustomerVerificationPurpose | "LEGACY") {
  const issuer = new CustomerPhoneAuthService(db, { enabled: true, secret, senderAvailable: () => true });
  const ip = "2001:db8::30";
  for (const key of [`phone:${customerAuthDigest(phone, secret)}`, `ip:${customerAuthDigest(ip, secret)}`, `org:${organization.id}`]) ownedQuotaKeys.add(key);
  const scope = { phone, organizationId: organization.id, origin: tenantUrl, ip };
  const issued = purpose === "LEGACY" ? (await issuer.request({ ...scope, source: "WEB" }), null) : await issuer.requestVerification(scope, purpose);
  const link = await db.customerAccessLink.findFirstOrThrow({ where: { organizationId: organization.id, phone, ...(issued ? { id: issued.challengeId } : {}) }, orderBy: { createdAt: "desc" }, include: { smsOutbox: true } });
  assert.ok(link.smsOutbox);
  const payload = decryptCustomerAuthPayload(link.smsOutbox.encryptedPayload, secret, link.id);
  assert.match(payload.url, /^OTP:\d{4}$/);
  return { phone, challengeId: link.id, otp: payload.url.slice(4), organization: prefix };
}
async function callback(fields: Record<string, string>, origin = tenantUrl) {
  const csrf = await request("/api/auth/csrf");
  assert.equal(csrf.status, 200);
  const cookies = cookiesFrom(csrf);
  const csrfToken = (await csrf.json() as { csrfToken: string }).csrfToken;
  const response = await request("/api/auth/callback/customer-phone", { method: "POST", redirect: "manual", headers: { origin, cookie: cookieHeader(cookies), "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ csrfToken, callbackUrl: tenantUrl, ...fields }) });
  const session = await request("/api/auth/session", { headers: { cookie: cookieHeader([...cookies, ...cookiesFrom(response)]) } });
  assert.equal(session.status, 200);
  return await session.json() as { user?: { id?: string; role?: string; organizationId?: string } } | null;
}
async function notConsumed(challengeId: string) {
  const row = await db.customerAccessLink.findUniqueOrThrow({ where: { id: challengeId } });
  assert.equal(row.consumedAt, null);
}
function assertNoSession(session: Awaited<ReturnType<typeof callback>>) { assert.equal(session?.user, undefined); }
async function noAccount(phone: string) {
  assert.equal(await db.customerPhoneIdentity.count({ where: { phone } }), 0);
  assert.equal(await db.user.count({ where: { OR: [{ name: phone }, { phone }] } }), 0);
}
async function postRequest(body: unknown, origin: string | null = tenantUrl, host = tenantHost) {
  return request("/api/auth/customer/progressive/request", { method: "POST", headers: { "content-type": "application/json", ...(origin ? { origin } : {}) }, body: JSON.stringify(body) }, host);
}
describe("progressive enrollment isolated HTTP and browser", { concurrency: false }, () => {
  it("gates issuance, rejects cross-origin, malformed and cross-tenant requests and returns opaque suppression", async () => {
    const config = await request("/api/auth/customer/config");
    const data = await config.json();
    assert.equal(data.progressiveEnrollment, true); assert.equal(data.available, false); assert.equal(data.organization.id, organization.id);
    const phone = await freshPhone(); const input = { phone, organization: prefix, purpose: "ACCOUNT_SIGN_IN" };
    for (const response of [await postRequest(input, null), await postRequest(input, "http://foreign.localhost"), await postRequest({ ...input, organization: "not-owned" }), await postRequest(input, tenantUrl, "wrong-phone-auth.localhost")]) assert.equal(response.status, 403);
    for (const body of [{ ...input, purpose: "PHONE_PROOF" }, { ...input, purpose: "ACCOUNT_ENROLL" }, { ...input, claim: true }, { ...input, phone: "x".repeat(5000) }]) assert.equal((await postRequest(body)).status, 400);
    const first = await postRequest(input); const second = await postRequest({ ...input, purpose: "ACCOUNT_ENROLL", enrollmentConfirmed: true });
    for (const response of [first, second]) { assert.equal(response.status, 202); assert.match(response.headers.get("cache-control") ?? "", /no-store/); }
    const a = await first.json(); const b = await second.json(); assert.deepEqual(Object.keys(a).sort(), ["accepted", "challengeId"]); assert.equal(a.accepted, true); assert.ok(isProgressiveChallengeId(a.challengeId)); assert.ok(isProgressiveChallengeId(b.challengeId)); assert.notEqual(a.challengeId, b.challengeId);
    assert.equal(await db.customerAccessLink.count({ where: { organizationId: organization.id, phone } }), 0);
    const legacy = await request("/api/auth/customer/request", { method: "POST", headers: { origin: tenantUrl, "content-type": "application/json" }, body: JSON.stringify(input) }); assert.equal(legacy.status, 409);
    await noAccount(phone);
  });
  it("sign-in for an unknown verified number never implicitly creates a customer", async () => {
    const phone = await freshPhone(); const data = await issue(phone, "ACCOUNT_SIGN_IN");
    assertNoSession(await callback({ ...data, purpose: "ACCOUNT_SIGN_IN" })); await noAccount(phone);
  });
  it("enrolls only with explicit confirmation and matching purpose, origin and challenge; replay fails", async () => {
    const phone = await freshPhone(); const data = await issue(phone, "ACCOUNT_ENROLL");
    assertNoSession(await callback({ ...data, purpose: "ACCOUNT_ENROLL" }));
    assertNoSession(await callback({ ...data, purpose: "ACCOUNT_SIGN_IN" }));
    assertNoSession(await callback({ ...data, challengeId: randomUUID(), purpose: "ACCOUNT_ENROLL", enrollmentConfirmed: "true" }));
    assertNoSession(await callback({ ...data, purpose: "ACCOUNT_ENROLL", enrollmentConfirmed: "true" }, "http://foreign.localhost"));
    assertNoSession(await callback({ ...data, organization: "not-owned", purpose: "ACCOUNT_ENROLL", enrollmentConfirmed: "true" }));
    await notConsumed(data.challengeId); await noAccount(phone);
    const success = await callback({ ...data, purpose: "ACCOUNT_ENROLL", enrollmentConfirmed: "true" });
    assert.equal(success?.user?.role, "CUSTOMER"); assert.equal(success?.user?.organizationId, organization.id);
    const identity = await db.customerPhoneIdentity.findUniqueOrThrow({ where: { phone } }); assert.equal(success?.user?.id, identity.userId);
    assert.equal(await db.customerClubMembership.count({ where: { customerId: identity.userId } }), 0);
    assertNoSession(await callback({ ...data, purpose: "ACCOUNT_ENROLL", enrollmentConfirmed: "true" }));
  });
  it("signs in an existing verified account with a fresh explicit sign-in challenge", async () => {
    const phone = await freshPhone(); const first = await issue(phone, "ACCOUNT_ENROLL");
    const enrolled = await callback({ ...first, purpose: "ACCOUNT_ENROLL", enrollmentConfirmed: "true" }); assert.ok(enrolled?.user?.id);
    const second = await issue(phone, "ACCOUNT_SIGN_IN");
    const signed = await callback({ ...second, purpose: "ACCOUNT_SIGN_IN" }); assert.equal(signed?.user?.id, enrolled.user.id);
    assert.equal(await db.customerPhoneIdentity.count({ where: { phone } }), 1);
    assert.equal(await db.customerClubMembership.count({ where: { customerId: enrolled.user.id } }), 0);
  });
  it("legacy and proof-only challenges cannot create a browser session at cutover", async () => {
    const legacyPhone = await freshPhone(); const legacy = await issue(legacyPhone, "LEGACY");
    assertNoSession(await callback({ phone: legacy.phone, otp: legacy.otp, organization: prefix }));
    assertNoSession(await callback({ ...legacy, purpose: "ACCOUNT_ENROLL", enrollmentConfirmed: "true" })); await notConsumed(legacy.challengeId); await noAccount(legacyPhone);
    const proofPhone = await freshPhone(); const proof = await issue(proofPhone, "PHONE_PROOF");
    assertNoSession(await callback({ ...proof, purpose: "PHONE_PROOF" }));
    assertNoSession(await callback({ ...proof, purpose: "ACCOUNT_ENROLL", enrollmentConfirmed: "true" })); await notConsumed(proof.challengeId); await noAccount(proofPhone);
  });
  it("browser requires separate account consent and submits exact challenge to the real callback", async () => {
    const browser = await chromium.launch({ headless: true, args: ["--host-resolver-rules=MAP phone-auth.localhost 127.0.0.1", "--no-proxy-server"] });
    try {
      const ctx = await browser.newContext({ serviceWorkers: "block" });
      await ctx.route("**/*", async route => { const url = new URL(route.request().url()); if (url.origin !== tenantUrl && url.origin !== baseUrl) await route.abort(); else await route.continue(); });
      const page = await ctx.newPage(); const phone = await freshPhone();
      let code = ""; let requests = 0;
      // Only issuance is mocked: create a real encrypted challenge via the fixture service, never enable a live transport.
      await page.route("**/api/auth/customer/progressive/request", async route => {
        const input = route.request().postDataJSON(); requests++;
        assert.deepEqual(input, { phone, organization: prefix, purpose: "ACCOUNT_ENROLL", enrollmentConfirmed: true });
        const issued = await issue(phone, "ACCOUNT_ENROLL"); code = issued.otp;
        await route.fulfill({ status: 202, json: { accepted: true, challengeId: issued.challengeId } });
      });
      const diagnostics: { documentStatus: number | null; configStatus: number | null; scriptFailures: number; pageErrors: string[] } = { documentStatus: null, configStatus: null, scriptFailures: 0, pageErrors: [] };
      page.on("response", response => {
        const pathname = new URL(response.url()).pathname;
        if (pathname === "/api/auth/customer/config") diagnostics.configStatus = response.status();
        if (pathname.startsWith("/_next/") && response.status() >= 400) diagnostics.scriptFailures++;
      });
      page.on("requestfailed", req => { if (new URL(req.url()).pathname.startsWith("/_next/")) diagnostics.scriptFailures++; });
      page.on("pageerror", error => { if (diagnostics.pageErrors.length < 5) diagnostics.pageErrors.push(error.name); });
      const enroll = page.getByTestId("progressive-enroll");
      try {
        const document = await page.goto(`${tenantUrl}/fa/login/phone?organization=${encodeURIComponent(prefix)}`, { waitUntil: "domcontentloaded", timeout: 120_000 });
        diagnostics.documentStatus = document?.status() ?? null;
        assert.equal(diagnostics.documentStatus, 200, "tenant phone login document must be reachable");
        await page.getByTestId("progressive-customer-login").waitFor({ timeout: 30_000 });
        await enroll.waitFor({ timeout: 120_000 });
      } catch (error) {
        // Synthetic diagnostics only: no bodies, cookies, queries, phone or OTP.
        console.error("G3A2_BROWSER_ROUTING_DIAGNOSTIC", JSON.stringify({ ...diagnostics, finalPath: new URL(page.url()).pathname, progressiveShell: await page.getByTestId("progressive-customer-login").count().catch(() => -1) }));
        throw error;
      }
      await page.getByTestId("progressive-phone").fill(phone); assert.equal(await page.getByTestId("progressive-request").isDisabled(), true);
      await enroll.check(); assert.equal(await page.getByTestId("progressive-consent").isChecked(), false); assert.equal(await page.getByTestId("progressive-request").isDisabled(), true); assert.equal(requests, 0);
      await page.getByTestId("progressive-consent").check(); await page.getByTestId("progressive-request").click();
      const otp = page.getByTestId("progressive-otp"); await otp.waitFor({ timeout: 30_000 }); assert.match(code, /^\d{4}$/); assert.equal(requests, 1);
      // BrowserContext.request uses a separate Node HTTP transport, not Chromium's
      // resolver rules. Inspect the actual browser cookie jar via a second page
      // so SPA navigation after signIn cannot destroy the polling context.
      const sessionDiagnostics: { callbackStatus: number | null; sessionStatus: number | null; sessionProbes: number } = { callbackStatus: null, sessionStatus: null, sessionProbes: 0 };
      try {
        await otp.fill(code);
        const response = page.waitForResponse(r => new URL(r.url()).origin === tenantUrl && new URL(r.url()).pathname === "/api/auth/callback/customer-phone" && r.request().method() === "POST", { timeout: 30_000 });
        await page.getByTestId("progressive-verify").click();
        const callbackResponse = await response;
        sessionDiagnostics.callbackStatus = callbackResponse.status();
        const sessionPage = await ctx.newPage();
        let session: { user?: { role?: string; organizationId?: string; id?: string } } | null = null;
        try {
          const deadline = Date.now() + 30_000;
          for (let i = 0; i < 30 && Date.now() < deadline; i++) {
            sessionDiagnostics.sessionProbes++;
            const result = await sessionPage.goto(`${tenantUrl}/api/auth/session`, { waitUntil: "domcontentloaded", timeout: Math.max(1, deadline - Date.now()) });
            assert.ok(result, "browser session document must return a response");
            sessionDiagnostics.sessionStatus = result.status();
            assert.equal(new URL(result.url()).origin, tenantUrl, "session must stay on the tenant origin");
            assert.equal(new URL(result.url()).pathname, "/api/auth/session");
            assert.equal(result.status(), 200);
            session = await result.json();
            if (session?.user?.id) break;
            await delay(500);
          }
        } finally { await sessionPage.close(); }
        assert.equal(session?.user?.role, "CUSTOMER"); assert.equal(session?.user?.organizationId, organization.id);
        assert.ok(session?.user?.id);
        assert.equal(await db.customerClubMembership.count({ where: { customerId: session.user.id } }), 0);
      } catch (error) {
        console.error("G3A2_BROWSER_SESSION_DIAGNOSTIC", JSON.stringify({ ...sessionDiagnostics, errorType: error instanceof Error ? error.name : "unknown" }));
        throw error;
      }
    } finally { await browser.close(); }
  });
  it("guest claim API rejects anonymous, cross-origin and authority injection", async () => {
    const config = await request("/api/auth/customer/config"); assert.equal((await config.json()).guestClaim, true);
    const post = (body: unknown, origin = tenantUrl) => request("/api/auth/customer/guest-claim", { method: "POST", headers: { origin, "content-type": "application/json", cookie: `guest_session_id=${randomUUID()}` }, body: JSON.stringify(body) });
    const denied = await post({ action: "LIST", kind: "ORDER" }); assert.equal(denied.status, 403); assert.match(denied.headers.get("cache-control") ?? "", /no-store/);
    assert.equal((await post({ action: "LIST", kind: "ORDER" }, "http://foreign.localhost")).status, 403);
    for (const field of ["phone", "guestSessionId", "organizationId", "userId", "sessionId", "origin"]) assert.equal((await post({ action: "LIST", kind: "ORDER", [field]: "x" })).status, 400);
    assert.equal((await post({ action: "REQUEST", kind: "ORDER", recordId: "x", claimConfirmed: false })).status, 400);
  });
  it("real tenant browser lists only its records and explicitly claims order and appointment with a record-bound proof", async () => {
    // Preserve earlier legacy SHOP fixture behavior; opt into dual capability only for this final test.
    await db.organization.update({ where: { id: organization.id }, data: { capabilitiesInitializedAt: new Date(), capabilities: { create: [{ key: "SHOP", status: "ACTIVE", enabledAt: new Date() }, { key: "APPOINTMENT", status: "ACTIVE", enabledAt: new Date() }] } } });
    const browser = await chromium.launch({ headless: true, args: ["--host-resolver-rules=MAP phone-auth.localhost 127.0.0.1", "--no-proxy-server"] });
    let stage = "login";
    try {
      const ctx = await browser.newContext({ serviceWorkers: "block" });
      await ctx.route("**/*", route => [tenantUrl, baseUrl].includes(new URL(route.request().url()).origin) ? route.continue() : route.abort());
      const page = await ctx.newPage(); const phone = await freshPhone();
      let enrollmentOtp = "";
      await page.route("**/api/auth/customer/progressive/request", async route => {
        const issued = await issue(phone, "ACCOUNT_ENROLL"); enrollmentOtp = issued.otp;
        await route.fulfill({ status: 202, json: { accepted: true, challengeId: issued.challengeId } });
      });
      const document = await page.goto(`${tenantUrl}/fa/login/phone?organization=${encodeURIComponent(prefix)}`, { waitUntil: "domcontentloaded", timeout: 120_000 });
      assert.equal(document?.status(), 200);
      await page.getByTestId("progressive-enroll").waitFor({ timeout: 120_000 });
      await page.getByTestId("progressive-phone").fill(phone); await page.getByTestId("progressive-enroll").check(); await page.getByTestId("progressive-consent").check();
      await page.getByTestId("progressive-request").click(); await page.getByTestId("progressive-otp").waitFor({ timeout: 30_000 });
      assert.match(enrollmentOtp, /^\d{4}$/); await page.getByTestId("progressive-otp").fill(enrollmentOtp);
      const callbackResponse = page.waitForResponse(r => new URL(r.url()).origin === tenantUrl && new URL(r.url()).pathname === "/api/auth/callback/customer-phone" && r.request().method() === "POST", { timeout: 30_000 });
      await page.getByTestId("progressive-verify").click(); await callbackResponse;
      const probe = await ctx.newPage(); let session: { user?: { id?: string; role?: string; organizationId?: string; phoneSessionId?: string } } | null = null;
      try {
        const deadline = Date.now() + 30_000;
        while (Date.now() < deadline) {
          const r = await probe.goto(`${tenantUrl}/api/auth/session`, { waitUntil: "domcontentloaded", timeout: Math.max(1, deadline - Date.now()) });
          assert.equal(r?.status(), 200); assert.equal(new URL(r!.url()).origin, tenantUrl); session = await r!.json();
          if (session?.user?.id) break; await delay(500);
        }
      } finally { await probe.close(); }
      assert.equal(session?.user?.role, "CUSTOMER"); assert.equal(session?.user?.organizationId, organization.id);
      const userId = session?.user?.id, sessionId = session?.user?.phoneSessionId; assert.ok(userId && sessionId);
      // Synthetic original-browser fixture cookies only. Account authentication was obtained via real NextAuth callback.
      const guestSessionId = randomUUID();
      await ctx.addCookies([{ name: "guest_session_id", value: guestSessionId, url: tenantUrl, httpOnly: true, sameSite: "Lax" }, { name: "guest_session_id_local", value: guestSessionId, url: tenantUrl, httpOnly: true, sameSite: "Lax" }]);
      const old = new Date(Date.now() - 3_600_000);
      async function makeOrder(cookie: string) {
        const key = randomUUID(); const guest = await db.guestCustomer.create({ data: { name: "fixture guest", phone, sessionId: `${guestOrderScope(organization.slug, cookie)}${key}` } }); claimGuests.push(guest.id);
        const row = await db.order.create({ data: { orderNumber: `G3B2-${randomUUID()}`, retailCheckoutKey: key, organizationSlug: organization.slug, guestCustomerId: guest.id, type: "PICK_UP", status: "PICKED_UP", subtotal: 100, total: 100, paymentMethod: "CASH", paymentStatus: "COMPLETED", createdAt: old, payment: { create: { amount: 100, method: "CASH", status: "COMPLETED" } } } }); claimOrders.push(row.id); return row;
      }
      const order = await makeOrder(guestSessionId), other = await makeOrder(randomUUID());
      const category = await db.serviceCategory.create({ data: { name: prefix, organizationId: organization.id } }); claimCategories.push(category.id);
      const service = await db.service.create({ data: { name: prefix, organizationId: organization.id, categoryId: category.id, price: 10, duration: 30 } }); claimServices.push(service.id);
      const guest = await db.guestCustomer.create({ data: { name: "fixture appointment guest", phone, sessionId: `${appointmentGuestScope(organization.id, guestSessionId)}${randomUUID()}` } }); claimGuests.push(guest.id);
      const appointment = await db.appointment.create({ data: { serviceId: service.id, guestCustomerId: guest.id, status: "COMPLETED", date: old, startTime: old, endTime: old, createdAt: old, customerPhoneAtBooking: phone, customerNameAtBooking: "fixture" } }); claimAppointments.push(appointment.id);
      const issuer = new CustomerPhoneAuthService(db, { enabled: true, guestClaimEnabled: true, secret, senderAvailable: () => true });
      const ip = "2001:db8::31"; for (const key of [`phone:${customerAuthDigest(phone, secret)}`, `ip:${customerAuthDigest(ip, secret)}`, `org:${organization.id}`]) ownedQuotaKeys.add(key);
      let expectedKind: GuestClaimKind = "ORDER", expectedId = order.id, proof: { challengeId: string; otp: string } | null = null;
      const realPost = (body: unknown) => page.evaluate(async input => { const r = await fetch("/api/auth/customer/guest-claim", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) }); return { status: r.status, body: await r.json(), cache: r.headers.get("cache-control") }; }, body);
      stage = "order-discovery";
      const orderDoc = await page.goto(`${tenantUrl}/fa/shop/profile`, { waitUntil: "domcontentloaded", timeout: 120_000 }); assert.equal(orderDoc?.status(), 200);
      const list = await realPost({ action: "LIST", kind: "ORDER" }); assert.equal(list.status, 200); assert.match(list.cache ?? "", /no-store/);
      assert.deepEqual(list.body.items.map((row: { recordId: string }) => row.recordId), [order.id]);
      const suppressed = await realPost({ action: "REQUEST", kind: "ORDER", recordId: other.id, claimConfirmed: true }); assert.equal(suppressed.status, 202); assert.equal(await db.customerAccessLink.count({ where: { id: suppressed.body.challengeId } }), 0);
      const cookieHeaderValue = cookieHeader((await ctx.cookies(tenantUrl)).map(c => `${c.name}=${c.value}`));
      const crossOrigin = await request("/api/auth/customer/guest-claim", { method: "POST", headers: { origin: "http://foreign.localhost", cookie: cookieHeaderValue, "content-type": "application/json" }, body: JSON.stringify({ action: "LIST", kind: "ORDER" }) }); assert.equal(crossOrigin.status, 403);
      // Only real delivery is suppressed. Issue a real encrypted proof in the disposable fixture when UI requests it.
      await page.route("**/api/auth/customer/guest-claim", async route => {
        const input = route.request().postDataJSON(); if (input.action !== "REQUEST") { await route.continue(); return; }
        assert.deepEqual(input, { action: "REQUEST", kind: expectedKind, recordId: expectedId, claimConfirmed: true });
        const scope: GuestClaimScope = { kind: expectedKind, recordId: expectedId, userId, sessionId, organizationId: organization.id, origin: tenantUrl, guestSessionId, phone, claimConfirmed: true };
        const result = await issuer.requestGuestClaim(scope, ip); const link = await db.customerAccessLink.findUniqueOrThrow({ where: { id: result.challengeId }, include: { smsOutbox: true } }); assert.ok(link.smsOutbox);
        const decoded = decryptCustomerAuthPayload(link.smsOutbox.encryptedPayload, secret, link.id); assert.match(decoded.url, /^OTP:\d{4}$/); proof = { challengeId: link.id, otp: decoded.url.slice(4) };
        await route.fulfill({ status: 202, json: result });
      });
      async function transfer() {
        const panel = page.getByTestId("guest-claim-panel"); await panel.waitFor({ timeout: 120_000 });
        await panel.getByTestId("guest-claim-load").click(); const radio = panel.getByTestId("guest-claim-record"); await radio.waitFor({ timeout: 30_000 }); assert.equal(await radio.count(), 1); await radio.check();
        assert.equal(await panel.getByTestId("guest-claim-request").isDisabled(), true);
        await panel.getByTestId("guest-claim-consent").check(); await panel.getByTestId("guest-claim-request").click();
        await panel.getByTestId("guest-claim-otp").waitFor({ timeout: 30_000 });
        const issued = proof as { challengeId: string; otp: string } | null; assert.ok(issued);
        const wrong = await realPost({ action: "CLAIM", kind: expectedKind, recordId: expectedKind === "ORDER" ? other.id : randomUUID(), claimConfirmed: true, ...issued }); assert.equal(wrong.status, 403); await notConsumed(issued.challengeId);
        await panel.getByTestId("guest-claim-otp").fill(issued.otp);
        const completed = page.waitForResponse(r => new URL(r.url()).pathname === "/api/auth/customer/guest-claim" && r.request().method() === "POST" && r.request().postDataJSON()?.action === "CLAIM", { timeout: 30_000 });
        await panel.getByTestId("guest-claim-verify").click(); const r = await completed; assert.equal(r.status(), 200); assert.deepEqual(await r.json(), { outcome: "CLAIMED", kind: expectedKind, recordId: expectedId });
        await panel.getByTestId("guest-claim-otp").waitFor({ state: "hidden", timeout: 30_000 });
        const replay = await realPost({ action: "CLAIM", kind: expectedKind, recordId: expectedId, claimConfirmed: true, ...issued }); assert.equal(replay.status, 403);
        const after = await realPost({ action: "LIST", kind: expectedKind }); assert.equal(after.status, 200); assert.deepEqual(after.body.items, []);
      }
      stage = "order-claim"; await transfer();
      assert.equal((await db.order.findUniqueOrThrow({ where: { id: order.id } })).customerId, userId);
      assert.equal((await db.order.findUniqueOrThrow({ where: { id: other.id } })).customerId, null);
      assert.equal((await db.payment.findUniqueOrThrow({ where: { orderId: order.id } })).status, "COMPLETED");
      assert.equal(await db.auditLog.count({ where: { entityType: "GuestOrderClaim", entityId: order.id, userId } }), 1);
      expectedKind = "APPOINTMENT"; expectedId = appointment.id; proof = null;
      stage = "appointment-claim"; const apptDoc = await page.goto(`${tenantUrl}/fa/appointment/my-appointments`, { waitUntil: "domcontentloaded", timeout: 120_000 }); assert.equal(apptDoc?.status(), 200); await transfer();
      assert.equal((await db.appointment.findUniqueOrThrow({ where: { id: appointment.id } })).customerId, userId);
      assert.equal(await db.auditLog.count({ where: { entityType: "GuestAppointmentClaim", entityId: appointment.id, userId } }), 1);
      assert.equal(await db.customerClubMembership.count({ where: { customerId: userId } }), 0);
      assert.equal(await db.customerPhoneIdentity.count({ where: { userId } }), 1);
      stage = "account-owned-projection";
      await ctx.clearCookies({ name: "guest_session_id" }); await ctx.clearCookies({ name: "guest_session_id_local" });
      const appointmentHistory = await page.evaluate(async slug => { const response = await fetch("/api/public/appointments/lookup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ organizationSlug: slug }) }); return { status: response.status, body: await response.json() }; }, prefix);
      assert.equal(appointmentHistory.status, 200); assert.ok(appointmentHistory.body.appointments.some((row: { id: string }) => row.id === appointment.id));
      const orderHistory = await page.evaluate(async orderNumber => { const response = await fetch(`/api/public/orders/${encodeURIComponent(orderNumber)}`, { cache: "no-store" }); return response.status; }, order.orderNumber);
      assert.equal(orderHistory, 200);
    } catch (error) { console.error("G3B2_BROWSER_DIAGNOSTIC", JSON.stringify({ stage, errorType: error instanceof Error ? error.name : "unknown" })); throw error; } finally { await browser.close(); }
  });
});
