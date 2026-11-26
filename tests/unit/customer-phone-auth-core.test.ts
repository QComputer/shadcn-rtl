import test from "node:test";
import assert from "node:assert/strict";
import type { PrismaClient } from "@prisma/client";
import { CustomerPhoneAuthError, CustomerPhoneAuthService, validateCustomerPhoneSession } from "../../lib/customer-auth/core.server";
import { createCustomerAccessToken, customerAuthDigest, decryptCustomerAuthPayload } from "../../lib/customer-auth/crypto";

const secret = "test-only-customer-auth-secret-32-bytes-minimum";
const origin = "https://shop.example.test";
const now = new Date("2026-11-04T00:00:00Z");
const request = { phone: "+98 912-345-6789", organizationId: "org-a", origin, ip: "192.0.2.1", source: "WEB" as const };
const options = { enabled: true, secret, now: () => now, senderAvailable: () => true, platformOrigins: [origin] };
const asDb = (value: unknown) => value as PrismaClient;

test("disabled/unreviewed sender acknowledges without touching persistence", async () => {
  const db = asDb({ $transaction() { throw new Error("must not touch DB"); } });
  assert.deepEqual(await new CustomerPhoneAuthService(db, { enabled: false }).request(request), { accepted: true });
  assert.deepEqual(await new CustomerPhoneAuthService(db, { enabled: true, secret }).request(request), { accepted: true });
});

test("request persists an OTP challenge plus encrypted outbox; creates no user", async () => {
  let saved: Record<string, any> | undefined;
  const tx = {
    organization: { findFirst: async () => ({ id: "org-a", slug: "shop-a", locale: "fa" }) },
    $queryRaw: async () => [],
    customerPhoneAuthQuota: { findUnique: async () => null, upsert: async () => ({}) },
    customerAccessLink: { updateMany: async () => ({ count: 0 }), create: async ({ data }: { data: Record<string, any> }) => { saved = data; } },
    user: { create: async () => assert.fail("request must not create a user") },
  };
  const db = asDb({ $transaction: async (fn: (input: typeof tx) => unknown) => fn(tx) });
  await new CustomerPhoneAuthService(db, options).request(request);
  assert(saved);
  assert.equal(saved.phone, "09123456789");
  assert.equal(saved.expiresAt.getTime() - now.getTime(), 300_000);
  assert.equal(saved.otpAttempts, 0);
  assert.ok(typeof saved.otpCodeHash === "string" && saved.otpCodeHash.length > 0);
  assert.equal(saved.otpExpiresAt.getTime() - now.getTime(), 120_000);
  assert.equal(typeof saved.token, "undefined");
  assert.ok(typeof saved.tokenDigest === "string" && saved.tokenDigest.length > 0);
  const payload = decryptCustomerAuthPayload(saved.smsOutbox.create.encryptedPayload, secret, saved.id);
  assert.ok(payload.url.startsWith("OTP:"), "outbox must carry the OTP code prefixed payload");
  assert.match(payload.url.slice(4), /^\d{4}$/, "exactly one four-digit OTP code");
  assert.equal(payload.phone, "09123456789");
});

test("quota exhaustion and invalid tenant origins produce no issuance", async () => {
  let created = false;
  const tx = {
    organization: { findFirst: async () => ({ id: "org-a" }) },
    organizationDomain: { findFirst: async () => null },
    $queryRaw: async () => [],
    customerPhoneAuthQuota: { findUnique: async () => ({ count: 100 }), upsert: async () => assert.fail("quota must not increment") },
    customerAccessLink: { create: async () => { created = true; } },
  };
  const db = asDb({ $transaction: async (fn: (input: typeof tx) => unknown) => fn(tx) });
  assert.deepEqual(await new CustomerPhoneAuthService(db, options).request(request), { accepted: true });
  assert.deepEqual(await new CustomerPhoneAuthService(db, options).request({ ...request, origin: "https://attacker.example" }), { accepted: true });
  assert.equal(created, false);
});

test("canonical www domains retain exact origin binding; HTTP is limited to development loopback hosts", async () => {
  const environment = process.env as Record<string, string | undefined>;
  const previousMode = environment.NODE_ENV;
  const domains: string[] = [];
  const origins: string[] = [];
  const tx = {
    organization: { findFirst: async () => ({ id: "org-a", slug: "shop-a", locale: "fa" }) },
    organizationDomain: { findFirst: async ({ where }: { where: { normalizedDomain: string } }) => { domains.push(where.normalizedDomain); return { id: "domain-a" }; } },
    $queryRaw: async () => [],
    customerPhoneAuthQuota: { findUnique: async () => null, upsert: async () => ({}) },
    customerAccessLink: { updateMany: async () => ({ count: 0 }), create: async ({ data }: { data: { origin: string } }) => { origins.push(data.origin); } },
  };
  const db = asDb({ $transaction: async (fn: (input: typeof tx) => unknown) => fn(tx) });
  const service = new CustomerPhoneAuthService(db, { ...options, platformOrigins: [] });
  try {
    environment.NODE_ENV = "production";
    await service.request({ ...request, origin: "https://www.shop.example.test" });
    assert.deepEqual(domains, ["shop.example.test"]);
    assert.deepEqual(origins, ["https://www.shop.example.test"]);
    await service.request({ ...request, origin: "http://phone-auth.localhost:3028" });
    assert.equal(origins.length, 1, "production HTTP must not persist a link");
    environment.NODE_ENV = "test";
    await service.request({ ...request, origin: "http://phone-auth.localhost:3028" });
    assert.equal(domains.at(-1), "phone-auth.localhost");
    assert.equal(origins.at(-1), "http://phone-auth.localhost:3028");
    await service.request({ ...request, origin: "http://shop.example.test" });
    await service.request({ ...request, origin: "ftp://localhost" });
    assert.equal(origins.length, 2, "other HTTP hosts and non-HTTP protocols must not persist a link");
  } finally {
    if (previousMode === undefined) delete environment.NODE_ENV;
    else environment.NODE_ENV = previousMode;
  }
});

test("consume rejects cross-tenant token before claiming, and lost atomic claims", async () => {
  const token = createCustomerAccessToken();
  let claims = 0;
  const tx = {
    organization: { findFirst: async () => ({ id: "org-a" }) },
    $queryRaw: async () => [],
    customerAccessLink: {
      findUnique: async () => ({ id: "link-a", organizationId: "org-a", origin, phone: "09123456789", consumedAt: null, expiresAt: new Date(now.getTime() + 1000) }),
      updateMany: async () => { claims++; return { count: 0 }; },
    },
  };
  const db = asDb({ $transaction: async (fn: (input: typeof tx) => unknown) => fn(tx) });
  const service = new CustomerPhoneAuthService(db, options);
  await assert.rejects(service.consume({ token, organizationId: "org-b", origin }), CustomerPhoneAuthError);
  assert.equal(claims, 0);
  await assert.rejects(service.consume({ token, organizationId: "org-a", origin }), CustomerPhoneAuthError);
  assert.equal(claims, 1);
});

test("consume rejects LEFT, BLOCKED and PAUSED club memberships without reactivating or creating session", async () => {
  for (const status of ["LEFT", "BLOCKED", "PAUSED"]) {
    const token = createCustomerAccessToken();
    let sessions = 0;
    const tx = {
      organization: { findFirst: async () => ({ id: "org-a", slug: "shop-a", locale: "fa" }) },
      $queryRaw: async () => [],
      customerAccessLink: {
        findUnique: async () => ({ id: "link-a", organizationId: "org-a", origin, phone: "09123456789", consumedAt: null, expiresAt: new Date(now.getTime() + 1000) }),
        updateMany: async () => ({ count: 1 }),
      },
      customerPhoneIdentity: { findUnique: async () => ({ userId: "user-a" }) },
      user: { findFirst: async () => ({ id: "user-a", name: "09123456789" }) },
      customerClubMembership: { findUnique: async () => ({ status }) },
      customerPhoneSession: { create: async () => { sessions++; return { id: "session-a" }; } },
    };
    const db = asDb({ $transaction: async (fn: (input: typeof tx) => unknown) => fn(tx) });
    await assert.rejects(new CustomerPhoneAuthService(db, options).consume({ token, organizationId: "org-a", origin }), CustomerPhoneAuthError);
    assert.equal(sessions, 0);
  }
});

test("session validation rechecks tenant, active customer role and staff membership and fails closed on DB failure", async () => {
  let where: Record<string, any> | undefined;
  const input = { sessionId: "session-a", userId: "user-a", organizationId: "org-a" };
  const db = asDb({ customerPhoneSession: { findFirst: async (query: { where: Record<string, any> }) => { where = query.where; return { id: "session-a" }; } } });
  assert.equal(await validateCustomerPhoneSession(input, db), true);
  assert.equal(where?.organizationId, "org-a");
  assert.equal(where?.user.role, "CUSTOMER");
  assert.equal(where?.user.isTeamMember, false);
  assert.deepEqual(where?.user.customerClubMemberships.none, { organizationId: "org-a", status: { not: "ACTIVE" } });
  assert.deepEqual(where?.user.memberOf.none.role.in, ["SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF", "DRIVER"]);
  assert.equal(await validateCustomerPhoneSession(input, asDb({ customerPhoneSession: { findFirst: async () => { throw new Error("offline"); } } })), false);
});


test("wrong OTP commits a bounded increment inside the transaction before rejection", async () => {
  const calls: string[] = [];
  const tx = {
    organization: { findFirst: async () => ({ id: "org-a" }) },
    $queryRaw: async () => { calls.push("lock"); return []; },
    customerAccessLink: {
      findFirst: async () => { calls.push("read"); return { id: "link-a", phone: "09123456789", otpCodeHash: customerAuthDigest("otp:1234", secret), otpExpiresAt: new Date(now.getTime() + 1000), expiresAt: new Date(now.getTime() + 1000), otpAttempts: 0, otpConsumedAt: null, consumedAt: null }; },
      updateMany: async ({ where, data }: { where: { otpAttempts: { lt: number } }; data: { otpAttempts: { increment: number } } }) => { calls.push("increment"); assert.equal(where.otpAttempts.lt, 3); assert.equal(data.otpAttempts.increment, 1); return { count: 1 }; },
    },
  };
  const db = asDb({ $transaction: async (fn: (input: typeof tx) => Promise<unknown>) => { const result = await fn(tx); calls.push("commit"); return result; } });
  await assert.rejects(new CustomerPhoneAuthService(db, options).consume({ otp: "4321", phone: "09123456789", organizationId: "org-a", origin }), CustomerPhoneAuthError);
  assert.deepEqual(calls, ["lock", "read", "increment", "commit"]);
});


test("purpose issuance is generic when disabled and never accesses persistence", async () => {
  const db = asDb({ $transaction() { throw new Error("must not touch DB"); } });
  const service = new CustomerPhoneAuthService(db, { ...options, enabled: false });
  const a = await service.requestVerification(request, "PHONE_PROOF");
  const b = await service.requestVerification(request, "ACCOUNT_ENROLL");
  assert.deepEqual(Object.keys(a).sort(), ["accepted", "challengeId"]);
  assert.equal(a.accepted, true);
  assert.match(a.challengeId, /^[0-9a-f-]{36}$/);
  assert.notEqual(a.challengeId, b.challengeId);
  await assert.rejects(service.verifyPhone({ ...request, otp: "1234", challengeId: a.challengeId }), CustomerPhoneAuthError);
});

test("purpose challenge digest binds exact scope and proof consumes without any account delegate", async () => {
  let saved: { id: string; phone: string; organizationId: string; origin: string; otpCodeHash: string; tokenDigest: string; expiresAt: Date; otpExpiresAt: Date; otpAttempts: number; smsOutbox: { create: { encryptedPayload: string } } } | undefined;
  let consumed = false;
  const tx = {
    organization: { findFirst: async () => ({ id: "org-a", slug: "shop-a", locale: "fa" }) },
    $queryRaw: async () => [],
    customerPhoneAuthQuota: { findUnique: async () => null, upsert: async () => ({}) },
    customerAccessLink: {
      findFirst: async () => saved ? { ...saved, consumedAt: consumed ? now : null, otpConsumedAt: consumed ? now : null } : null,
      findUnique: async () => saved ? { ...saved, consumedAt: null, otpConsumedAt: null } : null,
      updateMany: async ({ where }: { where: { id?: string } }) => {
        if (where.id) { consumed = true; return { count: 1 }; }
        return { count: 0 };
      },
      create: async ({ data }: { data: NonNullable<typeof saved> }) => { saved = data; },
    },
  };
  const service = new CustomerPhoneAuthService(asDb({ $transaction: async (fn: (input: typeof tx) => unknown) => fn(tx) }), options);
  const issued = await service.requestVerification(request, "PHONE_PROOF");
  assert.ok(saved);
  assert.equal(saved.id, issued.challengeId);
  const otp = decryptCustomerAuthPayload(saved.smsOutbox.create.encryptedPayload, secret, saved.id).url.slice(4);
  const digest = customerAuthDigest(JSON.stringify(["g3:v1", "PHONE_PROOF", saved.id, saved.phone, saved.organizationId, saved.origin, otp]), secret);
  assert.equal(saved.otpCodeHash, `g3:v1:PHONE_PROOF:${digest}`);
  const input = { ...request, challengeId: issued.challengeId, otp };
  await assert.rejects(service.consume(input), CustomerPhoneAuthError);
  await assert.rejects(service.signInVerified(input), CustomerPhoneAuthError);
  await assert.rejects(service.enrollVerified({ ...input, enrollmentConfirmed: true }), CustomerPhoneAuthError);
  await assert.rejects(service.verifyPhone({ ...input, challengeId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }), CustomerPhoneAuthError);
  // Even a hypothetical matching compatibility-token lookup cannot convert a tagged OTP.
  await assert.rejects(service.consume({ token: createCustomerAccessToken(), organizationId: request.organizationId, origin }), CustomerPhoneAuthError);
  assert.equal(consumed, false);
  const proof = await service.verifyPhone(input);
  assert.deepEqual(proof, { purpose: "PHONE_PROOF", challengeId: issued.challengeId, phone: "09123456789", organizationId: "org-a", origin, verifiedAt: now });
  assert.equal(consumed, true);
  await assert.rejects(service.verifyPhone(input), CustomerPhoneAuthError);
});

test("enrollment rejects absent explicit confirmation and malformed challenge before persistence", async () => {
  const db = asDb({ $transaction() { throw new Error("must not touch DB"); } });
  let accesses = 0;
  const guarded = asDb({ $transaction() { accesses++; throw new Error("must not touch DB"); } });
  const service = new CustomerPhoneAuthService(guarded, options);
  const input = { ...request, challengeId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", otp: "1234" };
  await assert.rejects(service.enrollVerified({ ...input, enrollmentConfirmed: false as unknown as true }), CustomerPhoneAuthError);
  await assert.rejects(service.verifyPhone({ ...input, challengeId: "not-a-uuid" }), CustomerPhoneAuthError);
  await assert.rejects(new CustomerPhoneAuthService(db, { ...options, enabled: false }).signInVerified(input), CustomerPhoneAuthError);
  assert.equal(accesses, 0);
});
