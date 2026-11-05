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

test("request persists a digest plus encrypted fragment URL; creates no user", async () => {
  let saved: Record<string, any> | undefined;
  const tx = {
    organization: { findFirst: async () => ({ id: "org-a", slug: "shop-a", locale: "fa" }) },
    $queryRaw: async () => [],
    customerPhoneAuthQuota: { findUnique: async () => null, upsert: async () => ({}) },
    customerAccessLink: { create: async ({ data }: { data: Record<string, any> }) => { saved = data; } },
    user: { create: async () => assert.fail("request must not create a user") },
  };
  const db = asDb({ $transaction: async (fn: (input: typeof tx) => unknown) => fn(tx) });
  await new CustomerPhoneAuthService(db, options).request(request);
  assert(saved);
  assert.equal(saved.phone, "09123456789");
  assert.equal(saved.expiresAt.getTime() - now.getTime(), 300_000);
  const payload = decryptCustomerAuthPayload(saved.smsOutbox.create.encryptedPayload, secret, saved.id);
  const url = new URL(payload.url);
  assert.equal(url.pathname, "/fa/login/phone");
  assert.equal(url.searchParams.get("organization"), "shop-a");
  assert.equal(url.searchParams.has("token"), false);
  const token = new URLSearchParams(url.hash.slice(1)).get("token")!;
  assert.equal(saved.tokenDigest, customerAuthDigest(token, secret));
  assert(!JSON.stringify(saved).includes(token));
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
    customerAccessLink: { create: async ({ data }: { data: { origin: string } }) => { origins.push(data.origin); } },
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
      customerClubMembership: { upsert: async ({ update }: { update: unknown }) => { assert.deepEqual(update, {}); return { status }; } },
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
  assert.deepEqual(where?.user.customerClubMemberships.some, { organizationId: "org-a", status: "ACTIVE" });
  assert.deepEqual(where?.user.memberOf.none.role.in, ["SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF", "DRIVER"]);
  assert.equal(await validateCustomerPhoneSession(input, asDb({ customerPhoneSession: { findFirst: async () => { throw new Error("offline"); } } })), false);
});
