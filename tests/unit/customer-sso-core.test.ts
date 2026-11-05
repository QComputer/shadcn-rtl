import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import type { PrismaClient, Prisma, CustomerSsoTicket } from "@prisma/client";
import { CustomerSsoError, CustomerSsoService, createCustomerSsoVerifier, customerSsoChallenge } from "../../lib/customer-auth/sso.server";

const secret = "local-customer-sso-unit-secret-at-least-32-characters";
const now = new Date("2026-11-05T00:00:00Z");
const origin = "https://target.example.test";
const verifier = createCustomerSsoVerifier();
const challenge = customerSsoChallenge(verifier);
const options = { secret, enabled: true, now: () => now, platformOrigins: [origin] };
const input = { userId: "user", sourceSessionId: "session", sourceOrganizationId: "source", targetOrganizationId: "target", targetOrigin: origin, challenge };
const asDb = (db: unknown) => db as PrismaClient;

function fixture() {
  let saved: CustomerSsoTicket | undefined;
  let claims = 0;
  let sessions = 0;
  let eligible = true;
  let source = true;
  let membership: string | undefined = "ACTIVE";
  const tx = {
    $queryRaw: async () => [],
    organization: { findFirst: async () => ({ id: "target" }) },
    organizationDomain: { findFirst: async () => ({ id: "domain" }) },
    user: { findFirst: async ({ where }: { where: Prisma.UserWhereInput }) => {
      assert.equal(where.role, "CUSTOMER"); assert.equal(where.isTeamMember, false);
      assert.deepEqual(where.customerPhoneIdentity, { isNot: null });
      assert.deepEqual(where.memberOf, { none: { isActive: true, role: { in: ["SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF", "DRIVER"] } } });
      return eligible ? { id: "user", name: "synthetic", password: "hash", locale: "fa", theme: "system", customerPhoneIdentity: { verifiedAt: now } } : null;
    } },
    customerPhoneSession: {
      findFirst: async ({ where }: { where: Prisma.CustomerPhoneSessionWhereInput }) => {
        assert.equal(where.revokedAt, null); assert.equal(where.organizationId, "source");
        return source ? { id: "session" } : null;
      },
      create: async () => { sessions++; return { id: "target-session" }; },
    },
    customerClubMembership: { findUnique: async () => membership ? { status: membership } : null },
    customerSsoTicket: {
      create: async ({ data }: { data: Prisma.CustomerSsoTicketUncheckedCreateInput }) => { saved = { id: "ticket", consumedAt: null, ...data } as CustomerSsoTicket; },
      findUnique: async () => saved,
      updateMany: async () => { claims++; return { count: claims === 1 ? 1 : 0 }; },
    },
  };
  return { db: asDb({ $transaction: async (fn: (transaction: typeof tx) => unknown) => fn(tx) }),
    saved: () => saved!, claims: () => claims, sessions: () => sessions,
    eligibility: (value: boolean) => { eligible = value; }, source: (value: boolean) => { source = value; }, membership: (value?: string) => { membership = value; } };
}

test("browser verifier has 256 random bits and challenge is SHA256 base64url", () => {
  const other = createCustomerSsoVerifier();
  assert.match(other, /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(other, verifier);
  assert.equal(challenge, createHash("sha256").update(verifier).digest("base64url"));
  assert.throws(() => customerSsoChallenge("short"), CustomerSsoError);
});

test("disabled or missing secret fails before persistence", async () => {
  const db = asDb({ $transaction() { assert.fail("disabled feature must not use DB"); } });
  for (const config of [{ enabled: false, secret }, { enabled: true, secret: "short" }]) {
    const service = new CustomerSsoService(db, config);
    await assert.rejects(service.issue(input), CustomerSsoError);
    await assert.rejects(service.redeem({ ticket: verifier, verifier, organizationId: "target", origin }), CustomerSsoError);
  }
});

test("ticket is opaque, hash persisted, sixty second TTL and independent target session", async () => {
  const f = fixture(); const service = new CustomerSsoService(f.db, options);
  const { ticket } = await service.issue(input);
  assert.match(ticket, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(f.saved().expiresAt.getTime() - f.saved().createdAt.getTime(), 60_000);
  assert.equal(f.saved().sourceSessionId, input.sourceSessionId);
  assert.equal(f.saved().challenge, challenge);
  assert.ok(!JSON.stringify(f.saved()).includes(ticket));
  assert.ok(!JSON.stringify(f.saved()).includes(verifier));
  const result = await service.redeem({ ticket, verifier, organizationId: "target", origin });
  assert.equal(result.phoneSessionId, "target-session"); assert.equal(result.id, "user");
  await assert.rejects(service.redeem({ ticket, verifier, organizationId: "target", origin }), CustomerSsoError);
  assert.equal(f.sessions(), 1);
});

test("wrong tenant, exact origin, browser verifier, expiration and replay fail before claim", async () => {
  const f = fixture(); const service = new CustomerSsoService(f.db, options);
  const { ticket } = await service.issue(input);
  const valid = { ticket, verifier, organizationId: "target", origin };
  for (const mutation of [{ organizationId: "other" }, { origin: "https://www.target.example.test" }, { verifier: createCustomerSsoVerifier() }, { verifier: "" }, { ticket: "" }]) await assert.rejects(service.redeem({ ...valid, ...mutation }), CustomerSsoError);
  f.saved().expiresAt = now;
  await assert.rejects(service.redeem(valid), CustomerSsoError);
  f.saved().expiresAt = new Date(now.getTime() + 1000); f.saved().consumedAt = now;
  await assert.rejects(service.redeem(valid), CustomerSsoError);
  assert.equal(f.claims(), 0); assert.equal(f.sessions(), 0);
});

test("rechecks current customer, source revocation and target membership without enrollment", async () => {
  for (const condition of ["customer", "source", "BLOCKED", "PAUSED", "LEFT", "missing"]) {
    const f = fixture(); const service = new CustomerSsoService(f.db, options);
    const { ticket } = await service.issue(input);
    if (condition === "customer") f.eligibility(false);
    else if (condition === "source") f.source(false);
    else f.membership(condition === "missing" ? undefined : condition);
    await assert.rejects(service.redeem({ ticket, verifier, organizationId: "target", origin }), CustomerSsoError);
    assert.equal(f.sessions(), 0); assert.equal(f.claims(), 0);
    await assert.rejects(service.issue(input), CustomerSsoError);
  }
});

test("origin syntax requires HTTPS exact origin; loopback HTTP only outside production", async () => {
  const environment = process.env as Record<string, string | undefined>; const previous = environment.NODE_ENV;
  try {
    for (const mode of ["production", "test"]) {
      environment.NODE_ENV = mode;
      for (const targetOrigin of ["https://target.example.test/path", "https://target.example.test/", "https://user@target.example.test", "https://target.example.test:444", "http://target.example.test", "ftp://localhost"]) await assert.rejects(new CustomerSsoService(fixture().db, options).issue({ ...input, targetOrigin }), CustomerSsoError);
      const local = { ...input, targetOrigin: "http://target.localhost:3028" };
      if (mode === "production") await assert.rejects(new CustomerSsoService(fixture().db, options).issue(local), CustomerSsoError);
      else assert.ok((await new CustomerSsoService(fixture().db, options).issue(local)).ticket);
    }
  } finally { if (previous === undefined) delete environment.NODE_ENV; else environment.NODE_ENV = previous; }
});
