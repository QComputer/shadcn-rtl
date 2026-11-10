import assert from "node:assert/strict";
import { randomInt, randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import { PrismaClient, type CustomerAccessLink, type Organization } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { CustomerPhoneAuthError, CustomerPhoneAuthService, validateCustomerPhoneSession } from "../../lib/customer-auth/core.server";
import { customerAuthDigest, decryptCustomerAuthPayload } from "../../lib/customer-auth/crypto";
import { processCustomerAuthSmsOutbox } from "../../lib/customer-auth/sms-outbox.server";

// Deliberately no dotenv/config, app Prisma singleton, inherited provider configuration or schema reset.
const connection = (() => { try { return new URL(process.env.DATABASE_URL ?? "https://missing.invalid"); } catch { throw new Error("invalid isolated local database configuration"); } })();
assert.ok(["postgres:", "postgresql:"].includes(connection.protocol));
assert.ok(["127.0.0.1", "localhost"].includes(connection.hostname), "refuses non-loopback database");
assert.equal(connection.port, "55439", "refuses other local database ports");
assert.equal(connection.pathname, "/retail_hero_test", "refuses other databases");
assert.ok(decodeURIComponent(connection.username) === "hero_test", "refuses other database users");
assert.ok(decodeURIComponent(connection.password) === "local_admin_fixture_only", "requires explicit synthetic fixture credential");
assert.equal(connection.search, "", "refuses inherited connection options");
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: connection.toString(), max: 6 }), log: [] });
const prefix = `phone-auth-${randomUUID()}`;
const secret = `fixture-only-${randomUUID()}-${randomUUID()}`;
const ownedUserIds = new Set<string>();
const quotaKeys = new Set<string>();
const ownedOrgIds: string[] = [];
const phones = new Set<string>();
let organizations: [Organization, Organization];
let requestSequence = 0;
const service = new CustomerPhoneAuthService(db, { enabled: true, secret, senderAvailable: () => true });
const origin = (organization: Organization) => `https://${organization.slug}.example.test`;

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

async function issue(phone: string, organization = organizations[0]) {
  const ip = `2001:db8:${prefix.slice(-4)}::${++requestSequence}`;
  quotaKeys.add(`ip:${customerAuthDigest(ip, secret)}`);
  const issuanceKey = randomUUID();
  assert.deepEqual(await service.request({ phone, organizationId: organization.id, origin: origin(organization), ip, source: "WEB", idempotencyKey: issuanceKey }), { accepted: true });
  const link = await db.customerAccessLink.findUnique({ where: { issuanceKey: customerAuthDigest(`WEB:${organization.id}:${phone}:${issuanceKey}`, secret) }, include: { smsOutbox: true } });
  assert.ok(link?.smsOutbox, "request must persist link and encrypted outbox on actual PostgreSQL");
  const payload = decryptCustomerAuthPayload(link.smsOutbox.encryptedPayload, secret, link.id);
  assert.ok(payload.url.startsWith("OTP:"), "outbox must carry an OTP payload");
  assert.match(payload.url.slice(4), /^\d{4}$/, "exactly one four-digit OTP code");
  return { link, otp: payload.url.slice(4), payload };
}

async function consumeOtp(phone: string, otp: string, organization = organizations[0]) {
  const result = await service.consume({ otp, phone, organizationId: organization.id, origin: origin(organization) });
  ownedUserIds.add(result.id);
  return result;
}

function workerDatabase(link: CustomerAccessLink): PrismaClient {
  // Scope every worker mutation, including lease recovery, to the exact owned fixture link.
  return {
    organization: db.organization,
    organizationDomain: db.organizationDomain,
    customerAuthSmsOutbox: {
      findFirst: (args: Parameters<typeof db.customerAuthSmsOutbox.findFirst>[0]) => db.customerAuthSmsOutbox.findFirst({ ...args, where: { AND: [args?.where ?? {}, { linkId: link.id }] } }),
      updateMany: (args: Parameters<typeof db.customerAuthSmsOutbox.updateMany>[0]) => db.customerAuthSmsOutbox.updateMany({ ...args, where: { AND: [args?.where ?? {}, { linkId: link.id }] } }),
    },
  } as unknown as PrismaClient;
}

before(async () => {
  const target = await db.$queryRaw<Array<{ name: string; role: string }>>`SELECT current_database()::text AS name, current_user::text AS role`;
  assert.deepEqual(target, [{ name: "retail_hero_test", role: "hero_test" }]);
  const created: Organization[] = [];
  for (const label of ["a", "b"]) {
    const organization = await db.organization.create({ data: { name: `${prefix}-${label}`, slug: `${prefix}-${label}`, type: "SHOP", locale: "fa" } });
    ownedOrgIds.push(organization.id);
    quotaKeys.add(`org:${organization.id}`);
    created.push(organization);
    await db.organizationDomain.create({ data: { organizationId: organization.id, domain: `${organization.slug}.example.test`, normalizedDomain: `${organization.slug}.example.test`, status: "ACTIVE", providerVerified: true, dnsConfigured: true, sslReady: true, verifiedAt: new Date() } });
  }
  organizations = created as [Organization, Organization];
  const alternateHost = `alt-${organizations[0].slug}.example.test`;
  await db.organizationDomain.create({ data: { organizationId: organizations[0].id, domain: alternateHost, normalizedDomain: alternateHost, status: "ACTIVE", providerVerified: true, dnsConfigured: true, sslReady: true, verifiedAt: new Date() } });
});

after(async () => {
  try {
    // Only IDs created by this run; never reset, broad prefix-match or touch seeded fixture data.
    // Recover an owned identity if a test was interrupted immediately after a successful DB commit.
    const committedIdentities = await db.customerPhoneIdentity.findMany({ where: { phone: { in: [...phones] }, user: { customerClubMemberships: { some: { organizationId: { in: ownedOrgIds } } } } }, select: { userId: true } });
    for (const identity of committedIdentities) ownedUserIds.add(identity.userId);
    await db.organizationMember.deleteMany({ where: { organizationId: { in: ownedOrgIds } } });
    await db.organizationDomain.deleteMany({ where: { organizationId: { in: ownedOrgIds } } });
    await db.organization.deleteMany({ where: { id: { in: ownedOrgIds } } });
    await db.user.deleteMany({ where: { id: { in: [...ownedUserIds] } } });
    await db.customerPhoneAuthQuota.deleteMany({ where: { key: { in: [...quotaKeys] } } });
    assert.equal(await db.organization.count({ where: { id: { in: ownedOrgIds } } }), 0);
    assert.equal(await db.user.count({ where: { id: { in: [...ownedUserIds] } } }), 0);
    assert.equal(await db.customerAccessLink.count({ where: { organizationId: { in: ownedOrgIds } } }), 0);
    console.log("CUSTOMER_PHONE_AUTH_LOCAL_CLEANUP_PASSED");
  } finally { await db.$disconnect(); }
});

describe("customer phone authentication on explicitly guarded local PostgreSQL", { concurrency: false }, () => {
  it("serializes concurrent request deduplication and phone quotas in PostgreSQL", async () => {
    const phone = await freshPhone();
    let fixedNow = new Date(Math.floor(Date.now() / 900_000) * 900_000 + 5000);
    const fixedClockService = new CustomerPhoneAuthService(db, { enabled: true, secret, senderAvailable: () => true, now: () => fixedNow });
    const organization = organizations[0];
    const ip = `2001:db8:${prefix.slice(-4)}::ff`;
    quotaKeys.add(`ip:${customerAuthDigest(ip, secret)}`);
    const sameIngress = { phone, organizationId: organization.id, origin: origin(organization), ip, source: "WEB" as const, idempotencyKey: randomUUID() };
    await Promise.all([fixedClockService.request(sameIngress), fixedClockService.request(sameIngress), fixedClockService.request(sameIngress)]);
    assert.equal(await db.customerAccessLink.count({ where: { phone, organizationId: organization.id } }), 1);
    // New requests inside the 60-second resend cooldown must not consume quota.
    await Promise.all(Array.from({ length: 4 }, () => fixedClockService.request({ ...sameIngress, idempotencyKey: randomUUID() })));
    assert.equal(await db.customerAccessLink.count({ where: { phone, organizationId: organization.id } }), 1);
    for (let round = 0; round < 3; round++) {
      fixedNow = new Date(fixedNow.getTime() + 61_000);
      await Promise.all(Array.from({ length: 4 }, () => fixedClockService.request({ ...sameIngress, idempotencyKey: randomUUID() })));
    }
    assert.equal(await db.customerAccessLink.count({ where: { phone, organizationId: organization.id } }), 3);
    const windowStart = new Date(Math.floor(fixedNow.getTime() / 900_000) * 900_000);
    const quota = await db.customerPhoneAuthQuota.findUniqueOrThrow({ where: { key_windowStart: { key: `phone:${customerAuthDigest(phone, secret)}`, windowStart } } });
    assert.equal(quota.count, 3);
    assert.equal(await db.customerPhoneIdentity.count({ where: { phone } }), 0);
  });

  it("uses one verified phone identity across two separate customer clubs without staff membership", async () => {
    const phone = await freshPhone();
    const first = await issue(phone);
    assert.equal(await db.customerPhoneIdentity.count({ where: { phone } }), 0, "request cannot create identity");
    const firstUser = await consumeOtp(first.link.phone, first.otp);
    const second = await issue(phone, organizations[1]);
    const secondUser = await consumeOtp(second.link.phone, second.otp, organizations[1]);
    assert.equal(firstUser.id, secondUser.id);
    assert.equal(await db.customerPhoneIdentity.count({ where: { phone } }), 1);
    assert.equal(await db.customerClubMembership.count({ where: { customerId: firstUser.id, status: "ACTIVE", organizationId: { in: ownedOrgIds } } }), 2);
    assert.equal(await db.organizationMember.count({ where: { userId: firstUser.id } }), 0);
    const user = await db.user.findUniqueOrThrow({ where: { id: firstUser.id } });
    assert.equal(user.role, "CUSTOMER");
    assert.equal(user.isTeamMember, false);
    assert.equal(user.name, phone);
    assert.ok(/^\$2[aby]\$/.test(user.password), "generated credential must be bcrypt");
    assert.equal(await validateCustomerPhoneSession({ sessionId: firstUser.phoneSessionId, userId: user.id, organizationId: organizations[0].id }, db), true);
    assert.equal(await validateCustomerPhoneSession({ sessionId: firstUser.phoneSessionId, userId: user.id, organizationId: organizations[1].id }, db), false);
  });

  it("concurrent consumption atomically permits exactly one successful session", async () => {
    const phone = await freshPhone();
    const { otp, link } = await issue(phone);
    const results = await Promise.allSettled([consumeOtp(link.phone, otp), consumeOtp(link.phone, otp)]);
    assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
    assert.equal(results.filter(result => result.status === "rejected").length, 1);
    const identity = await db.customerPhoneIdentity.findUniqueOrThrow({ where: { phone } });
    ownedUserIds.add(identity.userId);
    assert.equal(await db.customerPhoneSession.count({ where: { userId: identity.userId } }), 1);
    assert.ok((await db.customerAccessLink.findUniqueOrThrow({ where: { id: link.id } })).consumedAt);
    await assert.rejects(consumeOtp(link.phone, otp), CustomerPhoneAuthError);
  });

  it("rejects cross-organization, cross-origin, expired and consumed replay", async () => {
    const { otp, link } = await issue(await freshPhone());
    await assert.rejects(service.consume({ otp, phone: link.phone, organizationId: organizations[1].id, origin: origin(organizations[1]) }), CustomerPhoneAuthError);
    await assert.rejects(service.consume({ otp, phone: link.phone, organizationId: organizations[0].id, origin: `https://alt-${organizations[0].slug}.example.test` }), CustomerPhoneAuthError);
    assert.equal((await db.customerAccessLink.findUniqueOrThrow({ where: { id: link.id } })).consumedAt, null);
    const domainWhere = { normalizedDomain: `${organizations[0].slug}.example.test` };
    await db.organizationDomain.update({ where: domainWhere, data: { sslReady: false } });
    try { await assert.rejects(consumeOtp(link.phone, otp), CustomerPhoneAuthError); }
    finally { await db.organizationDomain.update({ where: domainWhere, data: { sslReady: true } }); }
    await db.organization.update({ where: { id: organizations[0].id }, data: { isActive: false } });
    try { await assert.rejects(consumeOtp(link.phone, otp), CustomerPhoneAuthError); }
    finally { await db.organization.update({ where: { id: organizations[0].id }, data: { isActive: true } }); }
    await db.customerAccessLink.update({ where: { id: link.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    await assert.rejects(consumeOtp(link.phone, otp), CustomerPhoneAuthError);
    assert.equal(await db.customerPhoneIdentity.count({ where: { phone: link.phone } }), 0);
  });

  it("does not link a matching unverified legacy phone or username", async () => {
    for (const collision of ["phone", "username"]) {
      const phone = await freshPhone();
      const legacy = await db.user.create({ data: { name: collision === "username" ? phone : `${prefix}-legacy`, phone: collision === "phone" ? phone : null, password: "synthetic-legacy-credential", role: "CUSTOMER" } });
      ownedUserIds.add(legacy.id);
      const { otp, link } = await issue(phone);
      await assert.rejects(consumeOtp(link.phone, otp), CustomerPhoneAuthError);
      assert.equal(await db.customerPhoneIdentity.count({ where: { phone } }), 0);
      assert.equal(await db.customerPhoneSession.count({ where: { userId: legacy.id } }), 0);
    }
  });

  it("preserves blocked/left/paused club states and denies both consumption and existing session access", async () => {
    const phone = await freshPhone();
    const { link: initialLink, otp: initialOtp } = await issue(phone);
    const initial = await consumeOtp(initialLink.phone, initialOtp);
    const membershipWhere = { organizationId_customerId: { organizationId: organizations[0].id, customerId: initial.id } };
    const { link: secondLink, otp: secondOtp } = await issue(phone);
    for (const status of ["BLOCKED", "LEFT", "PAUSED"] as const) {
      await db.customerClubMembership.update({ where: membershipWhere, data: { status } });
      await assert.rejects(consumeOtp(secondLink.phone, secondOtp), CustomerPhoneAuthError);
      assert.equal((await db.customerClubMembership.findUniqueOrThrow({ where: membershipWhere })).status, status);
      assert.equal(await validateCustomerPhoneSession({ sessionId: initial.phoneSessionId, userId: initial.id, organizationId: organizations[0].id }, db), false);
    }
    assert.equal(await db.customerPhoneSession.count({ where: { userId: initial.id } }), 1);
  });

  it("global user promotion trigger revokes sessions permanently after demotion", async () => {
    const phone = await freshPhone();
    const { link: firstLink, otp: firstOtp } = await issue(phone);
    const user = await consumeOtp(firstLink.phone, firstOtp);
    await db.user.update({ where: { id: user.id }, data: { role: "ADMIN" } });
    assert.ok((await db.customerPhoneSession.findUniqueOrThrow({ where: { id: user.phoneSessionId } })).revokedAt);
    await db.user.update({ where: { id: user.id }, data: { role: "CUSTOMER" } });
    assert.equal(await validateCustomerPhoneSession({ sessionId: user.phoneSessionId, userId: user.id, organizationId: organizations[0].id }, db), false);
    const { link: freshLink, otp: freshOtp } = await issue(phone);
    const fresh = await consumeOtp(freshLink.phone, freshOtp);
    assert.notEqual(fresh.phoneSessionId, user.phoneSessionId);
  });

  it("active staff membership trigger revokes sessions and prevents phone login until removed", async () => {
    const phone = await freshPhone();
    const { link: firstLink, otp: firstOtp } = await issue(phone);
    const user = await consumeOtp(firstLink.phone, firstOtp);
    const staff = await db.organizationMember.create({ data: { organizationId: organizations[1].id, organizationSlug: organizations[1].slug, userId: user.id, role: "STAFF", isActive: true } });
    assert.ok((await db.customerPhoneSession.findUniqueOrThrow({ where: { id: user.phoneSessionId } })).revokedAt);
    const { link: secondLink, otp: secondOtp } = await issue(phone);
    await assert.rejects(consumeOtp(secondLink.phone, secondOtp), CustomerPhoneAuthError);
    await db.organizationMember.delete({ where: { id: staff.id } });
    assert.equal(await validateCustomerPhoneSession({ sessionId: user.phoneSessionId, userId: user.id, organizationId: organizations[0].id }, db), false);
    assert.ok((await consumeOtp(secondLink.phone, secondOtp)).phoneSessionId);
  });

  it("concurrent real-DB workers deliver one injected SMS and purge encrypted payload", async () => {
    const { link, payload } = await issue(await freshPhone());
    const captured: Array<{ phone: string; url: string; idempotencyKey: string }> = [];
    const options = { db: workerDatabase(link), secret, enabled: true, transport: { reviewedForAuthentication: true as const, available: () => true, send: async (input: { phone: string; url: string; idempotencyKey: string }) => { captured.push(input); return "SENT" as const; } } };
    await Promise.all([processCustomerAuthSmsOutbox(options), processCustomerAuthSmsOutbox(options)]);
    assert.equal(captured.length, 1);
    assert.ok(captured[0].url === payload.url, "injected SMS URL matches the encrypted fixture payload");
    assert.ok(captured[0].phone === payload.phone, "injected SMS phone matches the encrypted fixture payload");
    assert.equal(captured[0].idempotencyKey, link.id);
    const outbox = await db.customerAuthSmsOutbox.findUniqueOrThrow({ where: { linkId: link.id } });
    assert.equal(outbox.status, "SENT");
    assert.equal(outbox.attempts, 1);
    assert.equal(outbox.encryptedPayload, "");
  });

  it("commits failed OTP attempts on PostgreSQL, exhausts after three, and prevents reuse of a consumed OTP", async () => {
    const phone = await freshPhone();
    const { otp, link } = await issue(phone);
    const wrong = otp === "0000" ? "0001" : "0000";
    for (let i = 0; i < 3; i++) await assert.rejects(consumeOtp(phone, wrong), CustomerPhoneAuthError);
    assert.equal((await db.customerAccessLink.findUniqueOrThrow({ where: { id: link.id } })).otpAttempts, 3);
    await assert.rejects(consumeOtp(phone, wrong), CustomerPhoneAuthError);

    // Age only the owned fixture past resend cooldown; no real-time sleep or provider call.
    await db.customerAccessLink.update({ where: { id: link.id }, data: { createdAt: new Date(Date.now() - 61_000) } });
    const { otp: good, link: goodLink } = await issue(phone);
    const user = await consumeOtp(phone, good);
    ownedUserIds.add(user.id);
    await assert.rejects(consumeOtp(phone, good), CustomerPhoneAuthError);
    assert.ok((await db.customerAccessLink.findUniqueOrThrow({ where: { id: goodLink.id } })).consumedAt);
  });
});
