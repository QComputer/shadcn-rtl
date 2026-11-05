import assert from "node:assert/strict";
import { randomInt, randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import { PrismaClient, type Organization } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { CustomerSsoError, CustomerSsoService, createCustomerSsoVerifier, customerSsoChallenge } from "../../lib/customer-auth/sso.server";
import { validateCustomerPhoneSession } from "../../lib/customer-auth/core.server";

// Explicit synthetic loopback fixture only; never load dotenv or use the application's singleton.
const connection = new URL(process.env.DATABASE_URL ?? "https://missing.invalid");
assert.ok(["postgres:", "postgresql:"].includes(connection.protocol));
assert.ok(["127.0.0.1", "localhost"].includes(connection.hostname), "refuses non-loopback database");
assert.equal(connection.port, "55439"); assert.equal(connection.pathname, "/retail_hero_test");
assert.equal(decodeURIComponent(connection.username), "hero_test");
assert.equal(decodeURIComponent(connection.password), "local_admin_fixture_only");
assert.equal(connection.search, "");
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: connection.toString(), max: 6 }), log: [] });
const prefix = `sso-${randomUUID()}`;
const secret = `fixture-only-${randomUUID()}-${randomUUID()}`;
const orgIds: string[] = []; const userIds: string[] = [];
let organizations: [Organization, Organization, Organization];
const service = new CustomerSsoService(db, { enabled: true, secret });
const origin = (organization: Organization) => `https://${organization.slug}.example.test`;

async function principal() {
  const user = await db.user.create({ data: { name: `${prefix}-${randomUUID()}`, password: "synthetic-unused-hash", role: "CUSTOMER", isTeamMember: false } });
  userIds.push(user.id);
  for (let attempt = 0; attempt < 20; attempt++) {
    const phone = `09${randomInt(100_000_000, 1_000_000_000)}`;
    if (!await db.customerPhoneIdentity.findUnique({ where: { phone } })) {
      await db.customerPhoneIdentity.create({ data: { userId: user.id, phone, verifiedAt: new Date() } }); break;
    }
    if (attempt === 19) assert.fail("synthetic phone allocation exhausted");
  }
  for (const organization of organizations.slice(0, 2)) await db.customerClubMembership.create({ data: { organizationId: organization.id, customerId: user.id } });
  const source = await db.customerPhoneSession.create({ data: { userId: user.id, organizationId: organizations[0].id, expiresAt: new Date(Date.now() + 86_400_000) } });
  return { user, source };
}
async function ticketFor(p: Awaited<ReturnType<typeof principal>>, customService = service) {
  const verifier = createCustomerSsoVerifier();
  const input = { userId: p.user.id, sourceSessionId: p.source.id, sourceOrganizationId: organizations[0].id, targetOrganizationId: organizations[1].id, targetOrigin: origin(organizations[1]), challenge: customerSsoChallenge(verifier) };
  const { ticket } = await customService.issue(input);
  return { input, ticket, verifier, redeem: { ticket, verifier, organizationId: organizations[1].id, origin: origin(organizations[1]) } };
}

before(async () => {
  const identity = await db.$queryRaw`SELECT current_database()::text AS name, current_user::text AS role`;
  assert.deepEqual(identity, [{ name: "retail_hero_test", role: "hero_test" }]);
  const created: Organization[] = [];
  for (const label of ["a", "b", "c"]) {
    const org = await db.organization.create({ data: { name: `${prefix}-${label}`, slug: `${prefix}-${label}`, type: "SHOP" } });
    orgIds.push(org.id); created.push(org);
    await db.organizationDomain.create({ data: { organizationId: org.id, domain: `${org.slug}.example.test`, normalizedDomain: `${org.slug}.example.test`, status: "ACTIVE", providerVerified: true, dnsConfigured: true, sslReady: true, verifiedAt: new Date() } });
  }
  organizations = created as [Organization, Organization, Organization];
});
after(async () => {
  try {
    await db.organizationMember.deleteMany({ where: { userId: { in: userIds } } });
    await db.organization.deleteMany({ where: { id: { in: orgIds } } });
    await db.user.deleteMany({ where: { id: { in: userIds } } });
    assert.equal(await db.organization.count({ where: { id: { in: orgIds } } }), 0);
    assert.equal(await db.user.count({ where: { id: { in: userIds } } }), 0);
    assert.equal(await db.customerSsoTicket.count({ where: { userId: { in: userIds } } }), 0);
    assert.equal(await db.customerPhoneSession.count({ where: { userId: { in: userIds } } }), 0);
    console.log("CUSTOMER_SSO_LOCAL_CLEANUP_PASSED");
  } finally { await db.$disconnect(); }
});

describe("customer SSO on guarded local PostgreSQL", { concurrency: false }, () => {
  it("persists only digest and sixty-second binding; concurrent redemption commits exactly one independent session", async () => {
    const p = await principal(); const issued = await ticketFor(p);
    const row = await db.customerSsoTicket.findFirstOrThrow({ where: { userId: p.user.id } });
    assert.equal(row.expiresAt.getTime() - row.createdAt.getTime(), 60_000);
    assert.equal(row.sourceSessionId, p.source.id); assert.equal(row.targetOrigin, issued.redeem.origin);
    assert.ok(!JSON.stringify(row).includes(issued.ticket)); assert.ok(!JSON.stringify(row).includes(issued.verifier));
    const results = await Promise.allSettled(Array.from({ length: 6 }, () => service.redeem(issued.redeem)));
    const passed = results.filter((result): result is PromiseFulfilledResult<Awaited<ReturnType<typeof service.redeem>>> => result.status === "fulfilled");
    assert.equal(passed.length, 1); assert.equal(results.filter(r => r.status === "rejected").length, 5);
    const target = passed[0].value;
    assert.equal(target.id, p.user.id); assert.notEqual(target.phoneSessionId, p.source.id);
    assert.equal(await db.customerPhoneSession.count({ where: { userId: p.user.id } }), 2);
    assert.equal(await validateCustomerPhoneSession({ sessionId: target.phoneSessionId, userId: p.user.id, organizationId: organizations[1].id }, db), true);
    await db.customerPhoneSession.update({ where: { id: p.source.id }, data: { revokedAt: new Date() } });
    assert.equal(await validateCustomerPhoneSession({ sessionId: target.phoneSessionId, userId: p.user.id, organizationId: organizations[1].id }, db), true, "target session is independent of source logout");
  });

  it("rejects missing/wrong browser binding, exact-origin/tenant confusion and replay without claiming valid ticket", async () => {
    const p = await principal(); const issued = await ticketFor(p);
    for (const mutation of [{ verifier: "" }, { verifier: createCustomerSsoVerifier() }, { organizationId: organizations[2].id }, { origin: "https://unowned.example.test" }, { origin: `${issued.redeem.origin}:444` }]) await assert.rejects(service.redeem({ ...issued.redeem, ...mutation }), CustomerSsoError);
    assert.equal((await db.customerSsoTicket.findFirstOrThrow({ where: { userId: p.user.id } })).consumedAt, null);
    assert.equal(await db.customerPhoneSession.count({ where: { userId: p.user.id } }), 1);
    await service.redeem(issued.redeem);
    await assert.rejects(service.redeem(issued.redeem), CustomerSsoError);
  });

  it("rolls back the atomic ticket claim when target session persistence fails", async () => {
    const p = await principal(); const issued = await ticketFor(p);
    const failingDb = {
      $transaction: (callback: (tx: unknown) => Promise<unknown>, options: object) => db.$transaction(async tx => {
        const scoped = new Proxy(tx, { get(target, property) {
          if (property === "customerPhoneSession") return {
            findFirst: tx.customerPhoneSession.findFirst.bind(tx.customerPhoneSession),
            create: async () => { throw new CustomerSsoError(); },
          };
          return Reflect.get(target, property);
        } });
        return callback(scoped);
      }, options),
    } as unknown as PrismaClient;
    await assert.rejects(new CustomerSsoService(failingDb, { enabled: true, secret }).redeem(issued.redeem), CustomerSsoError);
    assert.equal((await db.customerSsoTicket.findFirstOrThrow({ where: { userId: p.user.id } })).consumedAt, null);
    assert.equal(await db.customerPhoneSession.count({ where: { userId: p.user.id } }), 1);
    assert.ok((await service.redeem(issued.redeem)).phoneSessionId);
  });

  it("expires at sixty seconds and source revocation or source expiration prevents redemption", async () => {
    const p = await principal(); const base = new Date(); let clock = base;
    const fixed = new CustomerSsoService(db, { enabled: true, secret, now: () => clock });
    const expired = await ticketFor(p, fixed); clock = new Date(base.getTime() + 60_000);
    await assert.rejects(fixed.redeem(expired.redeem), CustomerSsoError);
    const revoked = await ticketFor(p);
    await db.customerPhoneSession.update({ where: { id: p.source.id }, data: { revokedAt: new Date() } });
    await assert.rejects(service.redeem(revoked.redeem), CustomerSsoError);
    await assert.rejects(service.issue(revoked.input), CustomerSsoError);
    await db.customerPhoneSession.update({ where: { id: p.source.id }, data: { revokedAt: null, expiresAt: new Date(0) } });
    await assert.rejects(service.redeem(revoked.redeem), CustomerSsoError);
    assert.equal(await db.customerPhoneSession.count({ where: { userId: p.user.id } }), 1);
  });

  it("requires existing active target club membership and never enrolls or reactivates", async () => {
    for (const status of ["BLOCKED", "LEFT", "PAUSED", "MISSING"] as const) {
      const p = await principal(); const issued = await ticketFor(p);
      const where = { organizationId_customerId: { organizationId: organizations[1].id, customerId: p.user.id } };
      if (status === "MISSING") await db.customerClubMembership.delete({ where });
      else await db.customerClubMembership.update({ where, data: { status } });
      await assert.rejects(service.issue(issued.input), CustomerSsoError);
      await assert.rejects(service.redeem(issued.redeem), CustomerSsoError);
      assert.equal((await db.customerClubMembership.findUnique({ where }))?.status, status === "MISSING" ? undefined : status);
      assert.equal(await db.customerPhoneSession.count({ where: { userId: p.user.id } }), 1);
    }
  });

  it("requires current verified nonstaff CUSTOMER and refuses source-session/user substitution", async () => {
    const other = await principal();
    for (const change of ["identity", "role", "staff", "inactive", "deleted", "membership"] as const) {
      const p = await principal(); const issued = await ticketFor(p);
      await assert.rejects(service.issue({ ...issued.input, sourceSessionId: other.source.id }), CustomerSsoError);
      if (change === "identity") await db.customerPhoneIdentity.delete({ where: { userId: p.user.id } });
      if (change === "role") await db.user.update({ where: { id: p.user.id }, data: { role: "ADMIN" } });
      if (change === "staff") await db.user.update({ where: { id: p.user.id }, data: { isTeamMember: true } });
      if (change === "inactive") await db.user.update({ where: { id: p.user.id }, data: { isActive: false } });
      if (change === "deleted") await db.user.update({ where: { id: p.user.id }, data: { deletedAt: new Date() } });
      if (change === "membership") await db.organizationMember.create({ data: { organizationId: organizations[2].id, organizationSlug: organizations[2].slug, userId: p.user.id, role: "STAFF" } });
      await assert.rejects(service.redeem(issued.redeem), CustomerSsoError);
      await assert.rejects(service.issue(issued.input), CustomerSsoError);
      assert.equal(await db.customerPhoneSession.count({ where: { userId: p.user.id } }), 1);
    }
  });

  it("revalidates domain verification, active organization, source membership and rejects unowned origins", async () => {
    const p = await principal(); const issued = await ticketFor(p);
    await assert.rejects(service.issue({ ...issued.input, targetOrigin: "https://unowned.example.test" }), CustomerSsoError);
    const domain = await db.organizationDomain.findFirstOrThrow({ where: { organizationId: organizations[1].id } });
    try {
      await db.organizationDomain.update({ where: { id: domain.id }, data: { providerVerified: false } });
      await assert.rejects(service.issue(issued.input), CustomerSsoError);
      await assert.rejects(service.redeem(issued.redeem), CustomerSsoError);
    } finally { await db.organizationDomain.update({ where: { id: domain.id }, data: { providerVerified: true } }); }
    try {
      await db.organization.update({ where: { id: organizations[1].id }, data: { isActive: false } });
      await assert.rejects(service.redeem(issued.redeem), CustomerSsoError);
    } finally { await db.organization.update({ where: { id: organizations[1].id }, data: { isActive: true } }); }
    await db.customerClubMembership.update({ where: { organizationId_customerId: { organizationId: organizations[0].id, customerId: p.user.id } }, data: { status: "BLOCKED" } });
    await assert.rejects(service.redeem(issued.redeem), CustomerSsoError);
    assert.equal(await db.customerPhoneSession.count({ where: { userId: p.user.id } }), 1);
  });
});
