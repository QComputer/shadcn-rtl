import { guestClaimEligible } from "../../lib/customer-auth/guest-claim.server";
import assert from "node:assert/strict";
import { buildHotelGuestReservationProof } from "../../lib/hotel/domain/guest-reservation-proof";
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

const prefix = `hotel-claim-http-${randomUUID()}`;
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
    BAZAR_BAZ_PLATFORM_HOSTS: "localhost,127.0.0.1", CUSTOMER_PHONE_AUTH_ENABLED: "1", CUSTOMER_PROGRESSIVE_ENROLLMENT_ENABLED: "1", CUSTOMER_GUEST_CLAIM_ENABLED: "1", HOTEL_GUEST_RESERVATION_CLAIM_ENABLED: "1", CUSTOMER_AUTH_SMS_WORKER_ENABLED: "1", INOTI_ALLOW_LIVE_SMS: "true", INOTI_RUNTIME_MUTATIONS_APPROVED: "true", INOTI_PLATFORM_SMS_TOKEN: "synthetic-fixture-token", INOTI_PLATFORM_SMS_LINE_NO: "1000", RETAIL_GUEST_CHECKOUT_ENABLED: "0",
    SMS_PROVIDER: "DRY_RUN", SMS_DRY_RUN: "true", SMS_REAL_SEND_ENABLED: "false", SMS_GUEST_REAL_SEND_ENABLED: "false",
    EMAIL_PROVIDER: "DRY_RUN", EMAIL_REAL_SEND_ENABLED: "false", CUSTOM_DOMAIN_PROVIDER_ENABLED: "false",
    CUSTOM_DOMAIN_REAL_MUTATION_ENABLED: "false", VERCEL_DOMAIN_AUTOMATION_DRY_RUN: "true", RUNFLARE_DOMAIN_AUTOMATION_DRY_RUN: "true",
    WEB_PUSH_ENABLED: "false", WEB_PUSH_REAL_SEND_ENABLED: "false", BLOB_READ_WRITE_TOKEN: "", VERCEL_API_TOKEN: "",
    VERCEL_ACCESS_TOKEN: "", STRIPE_SECRET_KEY: "", STRIPE_WEBHOOK_SECRET: "",
    NODE_OPTIONS: `--require=${`${process.cwd()}/scripts/dev/isolated-next-env.cjs`.replaceAll("\\", "/")} --require=${`${process.cwd()}/scripts/e2e/hotel-claim-network-guard.cjs`.replaceAll("\\", "/")}`,
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
  organization = await db.organization.create({ data: { name: `${prefix}-tenant`, slug: prefix, type: "SHOP", vertical: "HOTEL", capabilitiesInitializedAt: new Date(), locale: "fa" } });
  ownedOrgIds.push(organization.id);
  await db.organizationCapability.create({ data: { organizationId: organization.id, key: "HOTEL_BOOKING", status: "ACTIVE", enabledAt: new Date() } });
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
    await db.auditLog.deleteMany({ where: { organizationId: { in: ownedOrgIds }, entityType: { in: ["GuestOrderClaim", "GuestAppointmentClaim", "HotelGuestReservationClaim"] } } });
    await db.hotelReservationOwnership.deleteMany({ where: { organizationId: { in: ownedOrgIds } } });
    await db.hotelReservation.deleteMany({ where: { organizationId: { in: ownedOrgIds } } });
    await db.hotelRoomType.deleteMany({ where: { organizationId: { in: ownedOrgIds } } });
    await db.hotelProperty.deleteMany({ where: { organizationId: { in: ownedOrgIds } } });
    await db.payment.deleteMany({ where: { orderId: { in: claimOrders } } });
    await db.order.deleteMany({ where: { id: { in: claimOrders } } });
    await db.appointment.deleteMany({ where: { id: { in: claimAppointments } } });
    await db.guestCustomer.deleteMany({ where: { id: { in: claimGuests } } });
    await db.service.deleteMany({ where: { id: { in: claimServices } } });
    await db.serviceCategory.deleteMany({ where: { id: { in: claimCategories } } });
    await db.customerClubMembership.deleteMany({ where: { organizationId: { in: ownedOrgIds } } });
    await db.organizationCapability.deleteMany({ where: { organizationId: { in: ownedOrgIds } } });
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

describe("hotel ownership claim isolated browser", { concurrency: false }, () => {
  it("requires consent and original provenance; OTP atomically claims and exposes only minimal history", async () => {
    process.env.HOTEL_GUEST_RESERVATION_CLAIM_ENABLED = "1";
    const browser = await chromium.launch({ headless: true, args: ["--host-resolver-rules=MAP phone-auth.localhost 127.0.0.1", "--no-proxy-server"] });
    try {
      const ctx = await browser.newContext({ serviceWorkers: "block" });
      await ctx.route("**/*", route => [tenantUrl, baseUrl].includes(new URL(route.request().url()).origin) ? route.continue() : route.abort());
      const login = await ctx.newPage(), phone = await freshPhone(); let enrollmentOtp = "";
      await login.route("**/api/auth/customer/progressive/request", async route => { const issued = await issue(phone, "ACCOUNT_ENROLL"); enrollmentOtp = issued.otp; await route.fulfill({ status: 202, json: { accepted: true, challengeId: issued.challengeId } }); });
      assert.equal((await login.goto(`${tenantUrl}/fa/login/phone?organization=${encodeURIComponent(prefix)}`, { waitUntil: "domcontentloaded", timeout: 120000 }))?.status(), 200);
      await login.getByTestId("progressive-enroll").waitFor({ timeout: 120000 }); await login.getByTestId("progressive-phone").fill(phone); await login.getByTestId("progressive-enroll").check(); await login.getByTestId("progressive-consent").check(); await login.getByTestId("progressive-request").click(); await login.getByTestId("progressive-otp").waitFor(); await login.getByTestId("progressive-otp").fill(enrollmentOtp);
      const callbackResponse = login.waitForResponse(r => new URL(r.url()).pathname === "/api/auth/callback/customer-phone" && r.request().method() === "POST"); await login.getByTestId("progressive-verify").click(); assert.ok((await callbackResponse).ok());
      const probe = await ctx.newPage(); let session: { user?: { id?: string; phoneSessionId?: string; organizationId?: string } } | null = null;
      for (let i=0;i<30;i++) { const r=await probe.goto(`${tenantUrl}/api/auth/session`); assert.equal(r?.status(),200); session=await r!.json(); if(session?.user?.id)break; await delay(500); }
      await probe.close(); const userId=session?.user?.id, sessionId=session?.user?.phoneSessionId; assert.ok(userId && sessionId); assert.equal(session?.user?.organizationId,organization.id);
      const token=Buffer.alloc(32,5).toString("base64url"); await ctx.addCookies([{name:"bazarbaaz_hotel_claim_dev",value:token,url:tenantUrl,httpOnly:true,sameSite:"Strict"}]);
      const property=await db.hotelProperty.create({data:{organizationId:organization.id,organizationSlug:organization.slug,slug:"fixture-hotel",name:"Fixture hotel",operationalMode:"RESERVATION"}});
      const room=await db.hotelRoomType.create({data:{organizationId:organization.id,propertyId:property.id,slug:"room",name:"Room",maxAdults:2,maxOccupancy:2,beds:[]}});
      const reservation=await db.hotelReservation.create({data:{organizationId:organization.id,propertyId:property.id,roomTypeId:room.id,ratePlanId:"fixture",reference:`HOTEL-${randomUUID()}`,checkIn:new Date("2025-01-01"),checkOut:new Date("2025-01-02"),status:"CHECKED_OUT",checkedOutAt:new Date(Date.now()-1000),totalAmount:BigInt(100),cancellationPolicyKey:"fixture",cancellationPolicySnapshot:{},idempotencyKey:randomUUID()}});
      const provenance=buildHotelGuestReservationProof({reservationId:reservation.id,organizationId:organization.id,propertyId:property.id,origin:tenantUrl},token,phone,secret,new Date()); assert.ok(provenance); await db.hotelGuestReservationProof.create({data:provenance});
      assert.equal(await db.$transaction(tx => guestClaimEligible(tx,{kind:"HOTEL",recordId:reservation.id,userId,sessionId,organizationId:organization.id,origin:tenantUrl,guestSessionId:token,phone,claimConfirmed:true},new Date(),secret)),true);
      // More than 20 newer tenant stays must not hide the exact proof-bound record.
      let otherReference = "";
      for (let i=0;i<21;i++) {
        const other=await db.hotelReservation.create({data:{organizationId:organization.id,propertyId:property.id,roomTypeId:room.id,ratePlanId:"fixture",reference:`OTHER-${randomUUID()}`,checkIn:new Date("2025-01-01"),checkOut:new Date("2025-01-02"),status:"CHECKED_OUT",checkedOutAt:new Date(Date.now()-1000),totalAmount:BigInt(100),cancellationPolicyKey:"fixture",cancellationPolicySnapshot:{},idempotencyKey:randomUUID(),createdAt:new Date(Date.now()+1000+i)}});
        otherReference = other.reference;
        const otherProof=buildHotelGuestReservationProof({reservationId:other.id,organizationId:organization.id,propertyId:property.id,origin:tenantUrl},Buffer.alloc(32,6).toString("base64url"),phone,secret,new Date()); assert.ok(otherProof); await db.hotelGuestReservationProof.create({data:otherProof});
      }
      const browserCookies=(await ctx.cookies(tenantUrl)).map(c => `${c.name}=${c.value}`);
      const authCookies=browserCookies.filter(c => !c.startsWith("bazarbaaz_hotel_claim_dev="));
      const listBody=JSON.stringify({action:"LIST",kind:"HOTEL",reference:reservation.reference});
      const negative = async (cookie: string, origin?: string) => request("/api/auth/customer/guest-claim", { method:"POST",headers:{cookie,"content-type":"application/json",...(origin ? {origin} : {})},body:listBody });
      assert.equal((await negative(cookieHeader(authCookies),tenantUrl)).status,403, "missing browser proof must fail");
      assert.equal((await negative(cookieHeader(browserCookies),"http://foreign.localhost")).status,403, "foreign origin must fail");
      assert.equal((await negative(cookieHeader(browserCookies))).status,403, "missing origin must fail");
      assert.equal((await negative(`${cookieHeader(browserCookies)}; bazarbaaz_hotel_claim_dev=${token}`,tenantUrl)).status,403, "duplicate proof cookie must fail");
      const lookup = async (reference: string) => request("/api/auth/customer/guest-claim", { method:"POST", headers:{cookie:cookieHeader(browserCookies),origin:tenantUrl,"content-type":"application/json"}, body: JSON.stringify({action:"LIST",kind:"HOTEL",reference}) });
      const foreignRecord = await lookup(otherReference), missingRecord = await lookup(`MISSING-${randomUUID()}`);
      assert.equal(foreignRecord.status, 200); assert.equal(missingRecord.status, 200);
      assert.deepEqual(await foreignRecord.json(), { items: [] }); assert.deepEqual(await missingRecord.json(), { items: [] });
      const page=await ctx.newPage();
      page.on("framenavigated", frame => { if (frame === page.mainFrame()) console.log("HOTEL_NAV", new URL(frame.url()).pathname); });
      page.on("requestfailed", req => { if (new URL(req.url()).pathname === "/api/auth/customer/guest-claim") console.log("HOTEL_FAILED", req.failure()?.errorText); });
      page.on("response", r => { if (new URL(r.url()).pathname === "/api/auth/customer/guest-claim") console.log("HOTEL_RESPONSE", r.status(), r.request().method()); });
      const doc=await page.goto(`${tenantUrl}/fa/hotel-reservations/claims`,{waitUntil:"domcontentloaded",timeout:120000}); assert.equal(doc?.status(),200); await page.waitForLoadState("networkidle", { timeout: 120000 });
      const panel=page.getByTestId("guest-claim-panel"); await panel.waitFor({timeout:120000}); await panel.getByTestId("hotel-claim-reference").fill(reservation.reference); const listing=page.waitForResponse(r=>new URL(r.url()).pathname==="/api/auth/customer/guest-claim" && r.request().method()==="POST" && r.request().postDataJSON()?.action==="LIST"); await panel.getByTestId("guest-claim-load").click(); const listed=await listing; const listData=await listed.json(); console.log("HOTEL_CLAIM_LIST_DIAG",JSON.stringify({status:listed.status(),items:Array.isArray(listData.items)?listData.items.length:-1,origin:new URL(page.url()).origin,cookies:(await ctx.cookies(tenantUrl)).filter(c=>c.name==="bazarbaaz_hotel_claim_dev").length})); assert.equal(listed.status(),200); const radio=panel.getByTestId("guest-claim-record"); await radio.waitFor({timeout:30000}); assert.equal(await radio.count(),1); await radio.check(); assert.equal(await panel.getByTestId("guest-claim-request").isDisabled(),true);
      // The actual HTTP REQUEST creates an encrypted outbox row; no worker is started.
      // Synthetic provider credentials enable availability, while the fixture preload blocks all external sockets.
      const ip="unknown"; for(const key of [`phone:${customerAuthDigest(phone,secret)}`,`ip:${customerAuthDigest(ip,secret)}`,`org:${organization.id}`])ownedQuotaKeys.add(key);
      await panel.getByTestId("guest-claim-consent").check();
      const issuance=page.waitForResponse(r=>new URL(r.url()).pathname==="/api/auth/customer/guest-claim" && r.request().method()==="POST" && r.request().postDataJSON()?.action==="REQUEST", {timeout:90000});
      await panel.getByTestId("guest-claim-request").click(); const issuanceResponse=await issuance; assert.equal(issuanceResponse.status(),202); const issued=await issuanceResponse.json() as {accepted:boolean;challengeId:string}; assert.equal(issued.accepted,true);
      const challenge=issued.challengeId; const link=await db.customerAccessLink.findUniqueOrThrow({where:{id:challenge},include:{smsOutbox:true}}); assert.ok(link.smsOutbox); assert.equal(link.smsOutbox.status, "PENDING"); assert.equal(link.smsOutbox.attempts, 0); assert.equal(link.smsOutbox.sentAt, null);
      const payload=decryptCustomerAuthPayload(link.smsOutbox.encryptedPayload,secret,link.id); assert.match(payload.url,/^OTP:\d{4}$/); const otp=payload.url.slice(4);
      await panel.getByTestId("guest-claim-otp").waitFor(); await panel.getByTestId("guest-claim-otp").fill(otp);
      const completed=page.waitForResponse(r=>new URL(r.url()).pathname==="/api/auth/customer/guest-claim" && r.request().method()==="POST" && r.request().postDataJSON()?.action==="CLAIM", { timeout: 90000 }); await panel.getByTestId("guest-claim-verify").click(); assert.equal((await completed).status(),200);
      assert.equal((await db.hotelReservationOwnership.findUniqueOrThrow({where:{reservationId:reservation.id}})).userId,userId); assert.equal(await db.auditLog.count({where:{entityType:"HotelGuestReservationClaim",entityId:reservation.id}}),1);
      const historyPage = await ctx.newPage();
      const historyResponse = await historyPage.goto(`${tenantUrl}/api/auth/customer/guest-claim`, { waitUntil: "domcontentloaded", timeout: 120000 }); assert.equal(historyResponse?.status(), 200);
      const history = await historyResponse!.json(); assert.deepEqual(history.items.map((x:{reference:string})=>x.reference),[reservation.reference]); assert.deepEqual(Object.keys(history.items[0]).sort(),["checkIn","checkOut","reference","status"]);
      const replay=await historyPage.evaluate(async input=>{const r=await fetch("/api/auth/customer/guest-claim",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(input)});return r.status},{action:"CLAIM",kind:"HOTEL",recordId:reservation.id,claimConfirmed:true,challengeId:challenge,otp}); assert.equal(replay,403);
      await historyPage.close();
    } finally { await browser.close(); delete process.env.HOTEL_GUEST_RESERVATION_CLAIM_ENABLED; }
  });
});
