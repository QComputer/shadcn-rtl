import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { checkHotelGuestRequestRateLimit } from "../../lib/hotel/guest-request-rate-limit.server";

// CI-only disposable PostgreSQL. The test injects independent clients into the
// limiter so it never imports or uses the default application DB singleton.
const connectionString = process.env.HOTEL_GUEST_REQUEST_LIMIT_TEST_DATABASE_URL;
if (connectionString) {
  const target = new URL(connectionString);
  assert.ok(["postgres:", "postgresql:"].includes(target.protocol));
  const approvedCi = process.env.CI === "true"
    && ["127.0.0.1", "localhost"].includes(target.hostname)
    && target.port === "5432"
    && target.pathname === "/hotel_guest_rate_limit_test"
    && decodeURIComponent(target.username) === "hotel_guest_rate_limit_test"
    && decodeURIComponent(target.password) === "ci_only_guest_request_limiter";
  assert.ok(approvedCi, "refuses every database except the exact disposable CI fixture");
  assert.equal(target.search, "", "refuses inherited connection options");
}

test("PostgreSQL guest request upsert enforces limits across independent Prisma clients", { skip: !connectionString }, async () => {
  const clientA = new PrismaClient({ adapter: new PrismaPg({ connectionString: connectionString!, max: 16 }), log: [] });
  const clientB = new PrismaClient({ adapter: new PrismaPg({ connectionString: connectionString!, max: 16 }), log: [] });
  const organizationIds: string[] = [];
  try {
    const identity = await clientA.$queryRaw<Array<{ name: string; role: string }>>`SELECT current_database()::text AS name, current_user::text AS role`;
    assert.deepEqual(identity, [{ name: "hotel_guest_rate_limit_test", role: "hotel_guest_rate_limit_test" }]);

    const suffix = randomUUID();
    const organizationA = await clientA.organization.create({ data: { name: `guest-rate-${suffix}-a`, slug: `guest-rate-${suffix}-a`, type: "SHOP", vertical: "HOTEL" } });
    organizationIds.push(organizationA.id);
    const organizationB = await clientA.organization.create({ data: { name: `guest-rate-${suffix}-b`, slug: `guest-rate-${suffix}-b`, type: "SHOP", vertical: "HOTEL" } });
    organizationIds.push(organizationB.id);

    const attempts = await Promise.all(Array.from({ length: 400 }, (_, index) => checkHotelGuestRequestRateLimit({
      organizationId: organizationA.id,
      endpoint: "create",
      db: index % 2 === 0 ? clientA : clientB,
    })));
    assert.equal(attempts.filter((attempt) => attempt.allowed).length, 60);
    assert.equal(attempts.filter((attempt) => !attempt.allowed).length, 340);
    const counter = await clientB.hotelGuestRequestRateLimit.findUniqueOrThrow({ where: { organizationId_endpoint: { organizationId: organizationA.id, endpoint: "create" } } });
    assert.equal(counter.count, 61, "over-limit increments are capped at limit plus one");

    await clientA.$transaction(async (tx) => {
      await tx.$executeRaw`SET LOCAL TIME ZONE 'Pacific/Honolulu'`;
      const rate = await checkHotelGuestRequestRateLimit({ organizationId: organizationA.id, endpoint: "status", db: tx });
      assert.equal(rate.allowed, true, "endpoint budgets are independent");
      const statusCounter = await tx.hotelGuestRequestRateLimit.findUniqueOrThrow({ where: { organizationId_endpoint: { organizationId: organizationA.id, endpoint: "status" } } });
      assert.equal(rate.resetAt, statusCounter.windowStartedAt.getTime() + 60_000, "timestamptz reset remains correct under a non-UTC DB session");
    });
    assert.equal((await checkHotelGuestRequestRateLimit({ organizationId: organizationB.id, endpoint: "create", db: clientA })).allowed, true, "tenant budgets are independent");
    assert.equal(await clientA.hotelGuestRequestRateLimit.count({ where: { organizationId: { in: organizationIds } } }), 3, "rows stay bounded to one per tenant and endpoint");
  } finally {
    try {
      if (organizationIds.length) await clientA.organization.deleteMany({ where: { id: { in: organizationIds } } });
      assert.equal(await clientA.hotelGuestRequestRateLimit.count({ where: { organizationId: { in: organizationIds } } }), 0);
    } finally {
      await Promise.all([clientA.$disconnect(), clientB.$disconnect()]);
    }
  }
});
