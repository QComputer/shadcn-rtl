import assert from "node:assert/strict";
import { randomInt, randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import { PrismaClient, type CustomerAccessLink, type Organization } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { CustomerPhoneAuthService } from "../../lib/customer-auth/core.server";
import { customerAuthDigest, decryptCustomerAuthPayload, encryptCustomerAuthPayload } from "../../lib/customer-auth/crypto";
import { InotiTokenSmsTransport } from "../../lib/customer-auth/inoti-token-transport.server";
import { processCustomerAuthSmsOutbox } from "../../lib/customer-auth/sms-outbox.server";

// This acceptance test is pinned to the disposable loopback fixture. It never loads dotenv,
// inherits the app Prisma singleton, opens global fetch, or calls the real provider.
const connection = (() => { try { return new URL(process.env.DATABASE_URL ?? "https://missing.invalid"); } catch { throw new Error("invalid isolated local database configuration"); } })();
assert.ok(["postgres:", "postgresql:"].includes(connection.protocol));
assert.ok(["127.0.0.1", "localhost"].includes(connection.hostname), "refuses non-loopback database");
assert.equal(connection.port, "55439", "refuses other local database ports");
assert.equal(connection.pathname, "/retail_hero_test", "refuses other databases");
assert.equal(decodeURIComponent(connection.username), "hero_test", "refuses other database users");
assert.equal(decodeURIComponent(connection.password), "local_admin_fixture_only", "requires synthetic fixture credential");
assert.equal(connection.search, "", "refuses inherited connection options");
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: connection.toString(), max: 6 }), log: [] });
const prefix = `inoti-auth-${randomUUID()}`;
const secret = `fixture-only-${randomUUID()}-${randomUUID()}`;
const syntheticToken = `synthetic-${randomUUID()}`;
const ownedOrgIds: string[] = [];
const phones = new Set<string>();
const quotaKeys = new Set<string>();
let organization!: Organization;
let requestSequence = 0;
let cleanupPassed = false;
const origin = () => `https://${organization.slug}.example.test`;
const service = new CustomerPhoneAuthService(db, { enabled: true, secret, senderAvailable: () => true });

async function freshPhone() {
  for (let attempt = 0; attempt < 20; attempt++) {
    const phone = `09${randomInt(100_000_000, 1_000_000_000)}`;
    if (!phones.has(phone) && !await db.user.findFirst({ where: { OR: [{ name: phone }, { phone }] }, select: { id: true } }) && !await db.customerPhoneIdentity.findUnique({ where: { phone } })) {
      phones.add(phone);
      quotaKeys.add(`phone:${customerAuthDigest(phone, secret)}`);
      return phone;
    }
  }
  throw new Error("synthetic phone allocation exhausted");
}

async function issue(phone?: string) {
  phone ??= await freshPhone();
  const ip = `2001:db8:${prefix.slice(-4)}::${++requestSequence}`;
  quotaKeys.add(`ip:${customerAuthDigest(ip, secret)}`);
  const idempotencyKey = randomUUID();
  assert.deepEqual(await service.request({ phone, organizationId: organization.id, origin: origin(), ip, source: "WEB", idempotencyKey }), { accepted: true });
  const issuanceKey = customerAuthDigest(`WEB:${organization.id}:${phone}:${idempotencyKey}`, secret);
  const link = await db.customerAccessLink.findUnique({ where: { issuanceKey }, include: { smsOutbox: true } });
  assert.ok(link?.smsOutbox, "request persists link and encrypted outbox in actual PostgreSQL");
  const payload = decryptCustomerAuthPayload(link.smsOutbox.encryptedPayload, secret, link.id);
  return { link, payload };
}

function workerDatabase(link: CustomerAccessLink): PrismaClient {
  // The test adapter adds the exact link ID to every outbox read and mutation, including lease cleanup.
  return {
    organization: db.organization,
    organizationDomain: db.organizationDomain,
    customerAuthSmsOutbox: {
      findFirst: (args: Parameters<typeof db.customerAuthSmsOutbox.findFirst>[0]) => db.customerAuthSmsOutbox.findFirst({ ...args, where: { AND: [args?.where ?? {}, { linkId: link.id }] } }),
      updateMany: (args: Parameters<typeof db.customerAuthSmsOutbox.updateMany>[0]) => db.customerAuthSmsOutbox.updateMany({ ...args, where: { AND: [args?.where ?? {}, { linkId: link.id }] } }),
    },
  } as unknown as PrismaClient;
}

function acceptedResponse(phone: string) {
  return new Response(JSON.stringify({ ResultCode: 1, BatchID: "987654321", deliveryLists: [{ Mobile: phone, Status: 1 }] }), { status: 200, headers: { "content-type": "application/json" } });
}

function fakeTransport(fetcher: typeof fetch) {
  return new InotiTokenSmsTransport({ token: syntheticToken, lineNo: "0", fetcher });
}

async function run(link: CustomerAccessLink, transport: InotiTokenSmsTransport) {
  return processCustomerAuthSmsOutbox({ db: workerDatabase(link), secret, enabled: true, transport });
}

before(async () => {
  const target = await db.$queryRaw<Array<{ name: string; role: string }>>`SELECT current_database()::text AS name, current_user::text AS role`;
  assert.deepEqual(target, [{ name: "retail_hero_test", role: "hero_test" }]);
  organization = await db.organization.create({ data: { name: `${prefix}-display`, slug: prefix, type: "SHOP", locale: "fa" } });
  ownedOrgIds.push(organization.id);
  quotaKeys.add(`org:${organization.id}`);
  await db.organizationDomain.create({ data: { organizationId: organization.id, domain: `${organization.slug}.example.test`, normalizedDomain: `${organization.slug}.example.test`, status: "ACTIVE", providerVerified: true, dnsConfigured: true, sslReady: true, verifiedAt: new Date() } });
});

after(async () => {
  try {
    // Cleanup is restricted to fixture IDs and hashed quotas recorded by this run.
    await db.organizationDomain.deleteMany({ where: { organizationId: { in: ownedOrgIds } } });
    await db.organization.deleteMany({ where: { id: { in: ownedOrgIds } } });
    await db.customerPhoneAuthQuota.deleteMany({ where: { key: { in: [...quotaKeys] } } });
    assert.equal(await db.organization.count({ where: { id: { in: ownedOrgIds } } }), 0);
    assert.equal(await db.customerAccessLink.count({ where: { organizationId: { in: ownedOrgIds } } }), 0);
    assert.equal(await db.customerAuthSmsOutbox.count({ where: { linkId: { startsWith: "never-match-fixture" } } }), 0);
    cleanupPassed = true;
    console.log("CUSTOMER_INOTI_SMS_LOCAL_CLEANUP_PASSED");
  } finally { await db.$disconnect(); }
});

describe("token-based iNoti transport on isolated local PostgreSQL", { concurrency: false }, () => {
  it("sends the exact bound SMS payload once under concurrent real DB workers and stores acceptance", async () => {
    const { link, payload } = await issue();
    const requests: Array<{ url: URL; init?: RequestInit }> = [];
    const transport = fakeTransport(async (input, init) => {
      const url = new URL(String(input));
      requests.push({ url, init });
      return acceptedResponse(payload.phone);
    });
    await Promise.all([run(link, transport), run(link, transport)]);
    assert.equal(requests.length, 1, "competing workers claim one outbox row");
    const request = requests[0];
    assert.equal(request.url.origin, "https://restful.inoti.com");
    assert.equal(request.url.pathname, "/api/SMSAPI/SendSMS");
    assert.equal(request.init?.method, "GET");
    assert.equal(request.init?.redirect, "error");
    assert.equal(request.url.searchParams.get("Token"), syntheticToken);
    assert.equal(request.url.searchParams.get("LineNo"), "0");
    assert.equal(request.url.searchParams.get("MobileNumbers"), payload.phone);
    assert.equal(request.url.searchParams.get("Message"), `${organization.name} | برای ورود امن به حساب خود، این پیوند را باز کنید: ${payload.url}`);
    assert.equal(request.url.searchParams.get("Message")?.includes(payload.url), true);
    assert.equal(request.url.searchParams.has("Token"), true, "URLSearchParams performs query encoding");
    const outbox = await db.customerAuthSmsOutbox.findUniqueOrThrow({ where: { linkId: link.id } });
    assert.equal(outbox.status, "ACCEPTED");
    assert.equal(outbox.providerMessageId, "987654321");
    assert.equal(outbox.attempts, 1);
    assert.equal(outbox.encryptedPayload, "");
  });

  it("marks definitive provider rejection failed without retry and quarantines network errors without leaking them", async () => {
    const rejected = await issue();
    const rejecting = fakeTransport(async () => new Response(JSON.stringify({ ResultCode: -20 }), { status: 200, headers: { "content-type": "application/json" } }));
    await run(rejected.link, rejecting);
    let row = await db.customerAuthSmsOutbox.findUniqueOrThrow({ where: { linkId: rejected.link.id } });
    assert.equal(row.status, "FAILED");
    assert.equal(row.lastErrorCode, "SEND_REJECTED");
    assert.equal(row.attempts, 1);
    assert.equal(row.encryptedPayload, "");

    const uncertain = await issue();
    const throwing = fakeTransport(async () => { throw new Error(`network failure ${syntheticToken} ${uncertain.payload.url}`); });
    await run(uncertain.link, throwing);
    row = await db.customerAuthSmsOutbox.findUniqueOrThrow({ where: { linkId: uncertain.link.id } });
    assert.equal(row.status, "UNCERTAIN");
    assert.equal(row.lastErrorCode, "SEND_UNCERTAIN");
    assert.equal(row.attempts, 1);
    assert.equal(row.encryptedPayload, "");
    assert.equal(JSON.stringify(row).includes(syntheticToken), false);
    assert.equal(JSON.stringify(row).includes(uncertain.payload.url), false);
    assert.equal(JSON.stringify(row).includes(uncertain.payload.phone), false);
  });

  it("cancels consumed, expired, invalid-domain and payload-binding failures before transport", async () => {
    const blocked: Array<{ link: CustomerAccessLink; change: () => Promise<void>; restore?: () => Promise<void> }> = [];
    const consumed = await issue();
    blocked.push({ link: consumed.link, change: async () => { await db.customerAccessLink.update({ where: { id: consumed.link.id }, data: { consumedAt: new Date() } }); } });
    const expired = await issue();
    blocked.push({ link: expired.link, change: async () => { await db.customerAccessLink.update({ where: { id: expired.link.id }, data: { expiresAt: new Date(Date.now() - 1_000) } }); } });
    const domain = await issue();
    const domainWhere = { normalizedDomain: `${organization.slug}.example.test` };
    blocked.push({ link: domain.link, change: async () => { await db.organizationDomain.update({ where: domainWhere, data: { sslReady: false } }); }, restore: async () => { await db.organizationDomain.update({ where: domainWhere, data: { sslReady: true } }); } });
    const phoneMismatch = await issue();
    blocked.push({ link: phoneMismatch.link, change: async () => { await db.customerAuthSmsOutbox.update({ where: { linkId: phoneMismatch.link.id }, data: { encryptedPayload: encryptCustomerAuthPayload({ ...phoneMismatch.payload, phone: "09123456789" }, secret, phoneMismatch.link.id) } }); } });
    const originMismatch = await issue();
    const changedUrl = new URL(originMismatch.payload.url);
    changedUrl.hostname = `other-${organization.slug}.example.test`;
    blocked.push({ link: originMismatch.link, change: async () => { await db.customerAuthSmsOutbox.update({ where: { linkId: originMismatch.link.id }, data: { encryptedPayload: encryptCustomerAuthPayload({ ...originMismatch.payload, url: changedUrl.toString() }, secret, originMismatch.link.id) } }); } });

    let fetches = 0;
    const transport = fakeTransport(async () => { fetches++; return acceptedResponse("09123456789"); });
    for (const fixture of blocked) {
      try {
        await fixture.change();
        await run(fixture.link, transport);
        const row = await db.customerAuthSmsOutbox.findUniqueOrThrow({ where: { linkId: fixture.link.id } });
        assert.equal(row.status, "CANCELLED");
        assert.equal(row.encryptedPayload, "");
        assert.equal(row.attempts, 1, "worker claim precedes cancellation checks but no transport call occurs");
      } finally { await fixture.restore?.(); }
    }
    assert.equal(fetches, 0);
  });
});

process.on("beforeExit", () => {
  if (!cleanupPassed) process.exitCode = 1;
});
