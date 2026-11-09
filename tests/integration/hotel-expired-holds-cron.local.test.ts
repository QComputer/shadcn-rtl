import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db-runtime";
import { PrismaHotelRepositories } from "@/lib/hotel/persistence/prisma-hotel-repositories";
import { approveHotelPublication } from "@/lib/hotel/services/hotel-publication.service";
import { GET, POST } from "@/app/api/cron/expire-holds/route";

const EXPECTED_DB = process.env.HOTEL_EXPIRED_HOLDS_TEST_DATABASE ?? "bazarbaaz_hotel_expired_holds_verify";

const checkIn = "2028-01-10";
const checkOut = "2028-01-12";

const organizations: Record<"a" | "b", {
  id: string;
  propertyId: string;
  roomTypeId: string;
  ratePlanId: string;
  policyId: string;
  adminId: string;
  domain: string;
}> = {
  a: { id: "", propertyId: "", roomTypeId: "", ratePlanId: "", policyId: "", adminId: "", domain: "expired-a.local" },
  b: { id: "", propertyId: "", roomTypeId: "", ratePlanId: "", policyId: "", adminId: "", domain: "expired-b.local" },
};

const CRON_SECRET = "test-cron-secret-verify-123";

function dateValue(date: Date | string) {
  if (typeof date === "string") return date;
  return date.toISOString().slice(0, 10);
}

async function createHoldDirect(repo: PrismaHotelRepositories, orgKey: "a" | "b", holdId: string, reference: string, expiresAt: Date, status: "ACTIVE" | "CONSUMED" | "EXPIRED" | "RELEASED" = "ACTIVE") {
  const org = organizations[orgKey];
  const nights = [checkIn, "2028-01-11"];
  const now = new Date("2028-01-01T00:00:00Z");
  const hold = {
    id: holdId,
    organizationId: org.id,
    propertyId: org.propertyId,
    roomTypeId: org.roomTypeId,
    reference,
    quantity: 1,
    checkIn,
    checkOut,
    nights,
    expiresAt,
    status,
    createdAt: now,
  };
  await repo.createHold(hold);
  for (const date of nights) {
    await prisma.hotelInventory.updateMany({
      where: { organizationId: org.id, propertyId: org.propertyId, roomTypeId: org.roomTypeId, date: dateValue(date) },
      data: { held: { increment: 1 } },
    });
  }
  return hold;
}

function makeCronRequest(method: "GET" | "POST", authHeader?: string, xCronSecret?: string) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (authHeader) headers["authorization"] = authHeader;
  if (xCronSecret) headers["x-cron-secret"] = xCronSecret;
  return new NextRequest("https://test.local/api/cron/expire-holds", { method, headers });
}

describe("Hotel Expired Holds Cron Integration", () => {
  let repoA: PrismaHotelRepositories;
  let repoB: PrismaHotelRepositories;
  const now = new Date("2028-01-01T00:00:00Z");
  const expiredAt = new Date("2027-12-31T23:00:00Z");
  const futureAt = new Date("2028-01-02T00:00:00Z");

  before(async () => {
    process.env.CRON_SECRET = CRON_SECRET;
    process.env.HOTEL_ANONYMOUS_HOLD_OPERATIONAL_ENABLED = "1";

    const identity = await prisma.$queryRaw<Array<{ db: string }>>`SELECT current_database()::text AS db`;
    assert.equal(identity[0]?.db, EXPECTED_DB);

    for (const key of ["a", "b"] as const) {
      const org = await prisma.organization.create({
        data: { name: `Expired Holds ${key}`, slug: `expired-${key}-${Date.now()}`, type: "SHOP", vertical: "HOTEL" },
      });
      organizations[key].id = org.id;

      const admin = await prisma.user.create({ data: { name: `expired-admin-${key}-${Date.now()}`, password: "synthetic", role: "ADMIN" } });
      organizations[key].adminId = admin.id;
      await prisma.organizationMember.create({ data: { organizationId: org.id, organizationSlug: org.slug, userId: admin.id, role: "ADMIN" } });
      await prisma.organizationCapability.create({ data: { organizationId: org.id, key: "HOTEL_BOOKING", status: "ACTIVE", enabledAt: new Date() } });
      await prisma.organizationDomain.create({ data: { organizationId: org.id, domain: organizations[key].domain, normalizedDomain: organizations[key].domain, status: "ACTIVE", providerVerified: true, dnsConfigured: true, sslReady: true } });

      const property = await prisma.hotelProperty.create({ data: { organizationId: org.id, organizationSlug: org.slug, slug: `hotel-${key}`, name: `Expired Hotel ${key}` } });
      organizations[key].propertyId = property.id;

      const room = await prisma.hotelRoomType.create({ data: { organizationId: org.id, propertyId: property.id, slug: "standard", name: "Standard", maxAdults: 2, maxChildren: 1, maxOccupancy: 3, beds: [{ kind: "queen", count: 1 }] } });
      organizations[key].roomTypeId = room.id;

      const policy = await prisma.hotelCancellationPolicy.create({ data: { organizationId: org.id, propertyId: property.id, key: "flex", name: "Flexible", freeCancellationCutoffHours: 24 } });
      organizations[key].policyId = policy.id;

      const plan = await prisma.hotelRatePlan.create({ data: { organizationId: org.id, propertyId: property.id, roomTypeId: room.id, code: "flex", name: "Flexible", baseNightlyRate: BigInt(120000), cancellationPolicyId: policy.id } });
      organizations[key].ratePlanId = plan.id;

      await prisma.hotelNightlyRate.create({ data: { organizationId: org.id, propertyId: property.id, ratePlanId: plan.id, from: new Date(`${checkIn}T00:00:00Z`), to: new Date(`${checkOut}T00:00:00Z`), nightlyRate: BigInt(125000) } });

      await prisma.hotelInventory.createMany({
        data: [checkIn, "2028-01-11"].map((date) => ({ organizationId: org.id, propertyId: property.id, roomTypeId: room.id, date: new Date(`${date}T00:00:00Z`), allotment: 5 })),
      });

      const scopeApproval = { availability: true, quote: true, policies: true };
      await approveHotelPublication({ organizationId: org.id, propertyId: property.id, resourceType: "PROPERTY", resourceId: property.id, scope: scopeApproval, userId: admin.id, role: "ADMIN" });
      await approveHotelPublication({ organizationId: org.id, propertyId: property.id, resourceType: "ROOM_TYPE", resourceId: room.id, scope: scopeApproval, userId: admin.id, role: "ADMIN" });
      await approveHotelPublication({ organizationId: org.id, propertyId: property.id, resourceType: "RATE_PLAN", resourceId: plan.id, scope: scopeApproval, userId: admin.id, role: "ADMIN" });
      await approveHotelPublication({ organizationId: org.id, propertyId: property.id, resourceType: "CANCELLATION_POLICY", resourceId: policy.id, scope: scopeApproval, userId: admin.id, role: "ADMIN" });
    }

    repoA = new PrismaHotelRepositories(prisma);
    repoB = new PrismaHotelRepositories(prisma);
  });

  after(async () => {
    for (const key of ["a", "b"] as const) {
      const id = organizations[key].id;
      if (!id) continue;
      await prisma.$executeRaw`DELETE FROM "HotelBookingHoldIdempotency" WHERE "organizationId"=${id}`;
      await prisma.hotelBookingHold.deleteMany({ where: { organizationId: id } });
      await prisma.hotelInventory.deleteMany({ where: { organizationId: id } });
      await prisma.hotelNightlyRate.deleteMany({ where: { organizationId: id } });
      await prisma.hotelRatePlan.deleteMany({ where: { organizationId: id } });
      await prisma.hotelCancellationPolicy.deleteMany({ where: { organizationId: id } });
      await prisma.hotelRoomType.deleteMany({ where: { organizationId: id } });
      await prisma.hotelProperty.deleteMany({ where: { organizationId: id } });
      await prisma.organizationDomain.deleteMany({ where: { organizationId: id } });
      await prisma.organizationCapability.deleteMany({ where: { organizationId: id } });
      await prisma.organizationMember.deleteMany({ where: { organizationId: id } });
      await prisma.user.deleteMany({ where: { id: organizations[key].adminId } });
      await prisma.organization.delete({ where: { id } });
    }
    delete process.env.CRON_SECRET;
    delete process.env.HOTEL_ANONYMOUS_HOLD_OPERATIONAL_ENABLED;
    await prisma.$disconnect();
  });

  describe("Authentication", () => {
    it("rejects missing Authorization header with 401", async () => {
      const req = makeCronRequest("GET");
      const res = await GET(req);
      assert.equal(res.status, 401);
      const body = await res.json();
      assert.equal(body.error, "Unauthorized");
    });

    it("rejects missing x-cron-secret header with 401 on POST", async () => {
      const req = makeCronRequest("POST");
      const res = await POST(req);
      assert.equal(res.status, 401);
      const body = await res.json();
      assert.equal(body.error, "Unauthorized");
    });

    it("rejects invalid Bearer token with 401", async () => {
      const req = makeCronRequest("GET", "Bearer invalid-token");
      const res = await GET(req);
      assert.equal(res.status, 401);
    });

    it("rejects invalid x-cron-secret with 401", async () => {
      const req = makeCronRequest("POST", undefined, "wrong-secret");
      const res = await POST(req);
      assert.equal(res.status, 401);
    });

    it("accepts valid Bearer token on GET", async () => {
      const req = makeCronRequest("GET", `Bearer ${CRON_SECRET}`);
      const res = await GET(req);
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.ok(body.ok);
    });

    it("accepts valid x-cron-secret on POST", async () => {
      const req = makeCronRequest("POST", undefined, CRON_SECRET);
      const res = await POST(req);
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.ok(body.ok);
    });

    it("valid auth does not mutate database when no expired holds exist", async () => {
      const beforeCount = await prisma.hotelBookingHold.count({ where: { organizationId: organizations.a.id } });
      const req = makeCronRequest("GET", `Bearer ${CRON_SECRET}`);
      const res = await GET(req);
      assert.equal(res.status, 200);
      const afterCount = await prisma.hotelBookingHold.count({ where: { organizationId: organizations.a.id } });
      assert.equal(afterCount, beforeCount);
    });
  });

  describe("Expired Hold Release", () => {
    it("releases expired ACTIVE holds and restores inventory", async () => {
      await prisma.hotelBookingHold.deleteMany({ where: { organizationId: organizations.a.id } });
      await prisma.hotelInventory.updateMany({ where: { organizationId: organizations.a.id }, data: { held: 0 } });

      await createHoldDirect(repoA, "a", "expired-hold-1", "EXP-1", expiredAt, "ACTIVE");

      const inventoryBefore = await prisma.hotelInventory.findMany({ where: { organizationId: organizations.a.id }, orderBy: { date: "asc" } });
      const heldBefore = inventoryBefore.map((r) => r.held);

      const req = makeCronRequest("GET", `Bearer ${CRON_SECRET}`);
      const res = await GET(req);
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.results[0].expired, 1);
      assert.equal(body.results[0].skipped, 0);

      const hold = await prisma.hotelBookingHold.findUnique({ where: { id: "expired-hold-1" } });
      assert.equal(hold?.status, "EXPIRED");

      const inventoryAfter = await prisma.hotelInventory.findMany({ where: { organizationId: organizations.a.id }, orderBy: { date: "asc" } });
      const heldAfter = inventoryAfter.map((r) => r.held);
      assert.deepEqual(heldAfter, heldBefore.map((h) => h - 1));
    });

    it("skips nonexpired ACTIVE holds", async () => {
      await prisma.hotelBookingHold.deleteMany({ where: { organizationId: organizations.a.id } });
      await prisma.hotelInventory.updateMany({ where: { organizationId: organizations.a.id }, data: { held: 0 } });

      await createHoldDirect(repoA, "a", "nonexpired-hold-1", "NONEXP-1", futureAt, "ACTIVE");

      const req = makeCronRequest("GET", `Bearer ${CRON_SECRET}`);
      const res = await GET(req);
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.results[0].expired, 0);
      assert.equal(body.results[0].skipped, 1);

      const hold = await prisma.hotelBookingHold.findUnique({ where: { id: "nonexpired-hold-1" } });
      assert.equal(hold?.status, "ACTIVE");
    });

    it("skips CONSUMED holds", async () => {
      await prisma.hotelBookingHold.deleteMany({ where: { organizationId: organizations.a.id } });
      await prisma.hotelInventory.updateMany({ where: { organizationId: organizations.a.id }, data: { held: 0 } });

      await createHoldDirect(repoA, "a", "consumed-hold-1", "CONS-1", expiredAt, "CONSUMED");

      const req = makeCronRequest("GET", `Bearer ${CRON_SECRET}`);
      const res = await GET(req);
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.results[0].expired, 0);
      assert.equal(body.results[0].skipped, 1);

      const hold = await prisma.hotelBookingHold.findUnique({ where: { id: "consumed-hold-1" } });
      assert.equal(hold?.status, "CONSUMED");
    });

    it("skips previously RELEASED holds", async () => {
      await prisma.hotelBookingHold.deleteMany({ where: { organizationId: organizations.a.id } });
      await prisma.hotelInventory.updateMany({ where: { organizationId: organizations.a.id }, data: { held: 0 } });

      await createHoldDirect(repoA, "a", "released-hold-1", "REL-1", expiredAt, "RELEASED");

      const req = makeCronRequest("GET", `Bearer ${CRON_SECRET}`);
      const res = await GET(req);
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.results[0].expired, 0);
      assert.equal(body.results[0].skipped, 1);

      const hold = await prisma.hotelBookingHold.findUnique({ where: { id: "released-hold-1" } });
      assert.equal(hold?.status, "RELEASED");
    });

    it("skips already EXPIRED holds", async () => {
      await prisma.hotelBookingHold.deleteMany({ where: { organizationId: organizations.a.id } });
      await prisma.hotelInventory.updateMany({ where: { organizationId: organizations.a.id }, data: { held: 0 } });

      await createHoldDirect(repoA, "a", "already-expired-1", "ALREXP-1", expiredAt, "EXPIRED");

      const req = makeCronRequest("GET", `Bearer ${CRON_SECRET}`);
      const res = await GET(req);
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.results[0].expired, 0);
      assert.equal(body.results[0].skipped, 1);

      const hold = await prisma.hotelBookingHold.findUnique({ where: { id: "already-expired-1" } });
      assert.equal(hold?.status, "EXPIRED");
    });
  });

  describe("Idempotency and Concurrency", () => {
    it("repeated invocation does not double-decrement inventory", async () => {
      await prisma.hotelBookingHold.deleteMany({ where: { organizationId: organizations.a.id } });
      await prisma.hotelInventory.updateMany({ where: { organizationId: organizations.a.id }, data: { held: 0 } });

      await createHoldDirect(repoA, "a", "idempotent-hold-1", "IDEMP-1", expiredAt, "ACTIVE");

      const req = makeCronRequest("GET", `Bearer ${CRON_SECRET}`);
      await GET(req);
      await GET(req);

      const inventory = await prisma.hotelInventory.findMany({ where: { organizationId: organizations.a.id }, orderBy: { date: "asc" } });
      const held = inventory.map((r) => r.held);
      assert.deepEqual(held, [0, 0]);

      const hold = await prisma.hotelBookingHold.findUnique({ where: { id: "idempotent-hold-1" } });
      assert.equal(hold?.status, "EXPIRED");
    });

    it("concurrent invocations do not double-decrement inventory", async () => {
      await prisma.hotelBookingHold.deleteMany({ where: { organizationId: organizations.a.id } });
      await prisma.hotelInventory.updateMany({ where: { organizationId: organizations.a.id }, data: { held: 0 } });

      await createHoldDirect(repoA, "a", "concurrent-hold-1", "CONC-1", expiredAt, "ACTIVE");
      await createHoldDirect(repoA, "a", "concurrent-hold-2", "CONC-2", expiredAt, "ACTIVE");

      const req = makeCronRequest("GET", `Bearer ${CRON_SECRET}`);
      const results = await Promise.all([GET(req), GET(req), GET(req)]);
      for (const res of results) assert.equal(res.status, 200);

      const inventory = await prisma.hotelInventory.findMany({ where: { organizationId: organizations.a.id }, orderBy: { date: "asc" } });
      const held = inventory.map((r) => r.held);
      assert.deepEqual(held, [0, 0]);

      const holds = await prisma.hotelBookingHold.findMany({ where: { id: { in: ["concurrent-hold-1", "concurrent-hold-2"] } } });
      for (const hold of holds) assert.equal(hold.status, "EXPIRED");
    });
  });

  describe("Multi-Tenant Isolation", () => {
    it("two organizations remain strictly isolated", async () => {
      await prisma.hotelBookingHold.deleteMany({});
      await prisma.hotelInventory.updateMany({ data: { held: 0 } });

      await createHoldDirect(repoA, "a", "org-a-hold-1", "ORGA-1", expiredAt, "ACTIVE");
      await createHoldDirect(repoB, "b", "org-b-hold-1", "ORGB-1", expiredAt, "ACTIVE");

      const req = makeCronRequest("GET", `Bearer ${CRON_SECRET}`);
      const res = await GET(req);
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.results.length, 2);
      assert.equal(body.results[0].expired, 1);
      assert.equal(body.results[1].expired, 1);

      const holdA = await prisma.hotelBookingHold.findUnique({ where: { id: "org-a-hold-1" } });
      const holdB = await prisma.hotelBookingHold.findUnique({ where: { id: "org-b-hold-1" } });
      assert.equal(holdA?.status, "EXPIRED");
      assert.equal(holdB?.status, "EXPIRED");

      const invA = await prisma.hotelInventory.findMany({ where: { organizationId: organizations.a.id }, orderBy: { date: "asc" } });
      const invB = await prisma.hotelInventory.findMany({ where: { organizationId: organizations.b.id }, orderBy: { date: "asc" } });
      assert.deepEqual(invA.map((r) => r.held), [0, 0]);
      assert.deepEqual(invB.map((r) => r.held), [0, 0]);
    });

    it("failed organization does not prevent processing others", async () => {
      await prisma.hotelBookingHold.deleteMany({});
      await prisma.hotelInventory.updateMany({ data: { held: 0 } });

      await createHoldDirect(repoA, "a", "good-hold-1", "GOOD-1", expiredAt, "ACTIVE");
      await createHoldDirect(repoB, "b", "good-hold-2", "GOOD-2", expiredAt, "ACTIVE");

      await prisma.hotelProperty.deleteMany({ where: { organizationId: organizations.b.id } });

      const req = makeCronRequest("GET", `Bearer ${CRON_SECRET}`);
      const res = await GET(req);
      assert.equal(res.status, 200);
      const body = await res.json();

      const orgAResult = body.results.find((r: any) => r.organizationId === organizations.a.id);
      const orgBResult = body.results.find((r: any) => r.organizationId === organizations.b.id);

      assert.equal(orgAResult?.expired, 1);
      assert.ok(orgBResult?.error);

      const holdA = await prisma.hotelBookingHold.findUnique({ where: { id: "good-hold-1" } });
      assert.equal(holdA?.status, "EXPIRED");
    });
  });

  describe("Multiple-Night Consistency", () => {
    it("releases inventory for all nights of a multi-night stay", async () => {
      await prisma.hotelBookingHold.deleteMany({ where: { organizationId: organizations.a.id } });
      await prisma.hotelInventory.updateMany({ where: { organizationId: organizations.a.id }, data: { held: 0 } });

      const longCheckIn = "2028-01-10";
      const longCheckOut = "2028-01-15";
      const longNights = [longCheckIn, "2028-01-11", "2028-01-12", "2028-01-13", "2028-01-14"];

      await prisma.hotelInventory.createMany({
        data: longNights.map((date) => ({ organizationId: organizations.a.id, propertyId: organizations.a.propertyId, roomTypeId: organizations.a.roomTypeId, date: new Date(`${date}T00:00:00Z`), allotment: 5 })),
      });

      const hold = {
        id: "multi-night-hold-1",
        organizationId: organizations.a.id,
        propertyId: organizations.a.propertyId,
        roomTypeId: organizations.a.roomTypeId,
        reference: "MULTI-1",
        quantity: 1,
        checkIn: longCheckIn,
        checkOut: longCheckOut,
        nights: longNights,
        expiresAt: expiredAt,
        status: "ACTIVE" as const,
        createdAt: now,
      };
      await repoA.createHold(hold);
      for (const date of longNights) {
        await prisma.hotelInventory.updateMany({ where: { organizationId: organizations.a.id, propertyId: organizations.a.propertyId, roomTypeId: organizations.a.roomTypeId, date: dateValue(date) }, data: { held: { increment: 1 } } });
      }

      const req = makeCronRequest("GET", `Bearer ${CRON_SECRET}`);
      const res = await GET(req);
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.results[0].expired, 1);

      const inventory = await prisma.hotelInventory.findMany({ where: { organizationId: organizations.a.id, propertyId: organizations.a.propertyId, roomTypeId: organizations.a.roomTypeId }, orderBy: { date: "asc" } });
      const held = inventory.map((r) => r.held);
      assert.deepEqual(held, longNights.map(() => 0));
    });
  });

  describe("Backlog Handling", () => {
    it("processes more than 100 expired holds with bounded continuation", async () => {
      await prisma.hotelBookingHold.deleteMany({ where: { organizationId: organizations.a.id } });
      await prisma.hotelInventory.updateMany({ where: { organizationId: organizations.a.id }, data: { held: 0 } });

      const holdCount = 150;
      for (let i = 0; i < holdCount; i++) {
        const holdId = `backlog-hold-${i}`;
        await createHoldDirect(repoA, "a", holdId, `BACKLOG-${i}`, expiredAt, "ACTIVE");
      }

      const req = makeCronRequest("GET", `Bearer ${CRON_SECRET}`);
      const res = await GET(req);
      assert.equal(res.status, 200);
      const body = await res.json();

      assert.ok(body.results[0].expired >= 100);
      assert.ok(body.results[0].expired <= holdCount);

      const remainingActive = await prisma.hotelBookingHold.count({ where: { organizationId: organizations.a.id, status: "ACTIVE", expiresAt: { lte: now } } });
      assert.equal(remainingActive, holdCount - body.results[0].expired);

      const inventory = await prisma.hotelInventory.findMany({ where: { organizationId: organizations.a.id }, orderBy: { date: "asc" } });
      const totalHeld = inventory.reduce((sum, r) => sum + r.held, 0);
      assert.equal(totalHeld, remainingActive * 2);
    });
  });

  describe("releaseHold Consistency", () => {
    it("updateMany does not silently succeed with zero affected rows", async () => {
      await prisma.hotelBookingHold.deleteMany({ where: { organizationId: organizations.a.id } });
      await prisma.hotelInventory.updateMany({ where: { organizationId: organizations.a.id }, data: { held: 0 } });

      const holdId = "consistency-check-hold";
      await createHoldDirect(repoA, "a", holdId, "CONSIST-1", expiredAt, "ACTIVE");

      await prisma.hotelInventory.updateMany({ where: { organizationId: organizations.a.id }, data: { held: 0 } });

      const released = await repoA.releaseHold({ organizationId: organizations.a.id }, holdId, now);
      assert.equal(released.isReleased, true);

      const hold = await prisma.hotelBookingHold.findUnique({ where: { id: holdId } });
      assert.equal(hold?.status, "EXPIRED");
    });

    it("releasing already-released hold returns NOT_FOUND and does not decrement", async () => {
      await prisma.hotelBookingHold.deleteMany({ where: { organizationId: organizations.a.id } });
      await prisma.hotelInventory.updateMany({ where: { organizationId: organizations.a.id }, data: { held: 0 } });

      const holdId = "double-release-hold";
      await createHoldDirect(repoA, "a", holdId, "DBL-REL-1", expiredAt, "ACTIVE");

      const first = await repoA.releaseHold({ organizationId: organizations.a.id }, holdId, now);
      assert.equal(first.isReleased, true);

      const second = await repoA.releaseHold({ organizationId: organizations.a.id }, holdId, now);
      assert.equal(second.isReleased, false);
      assert.equal(second.reason, "NOT_FOUND");

      const inventory = await prisma.hotelInventory.findMany({ where: { organizationId: organizations.a.id }, orderBy: { date: "asc" } });
      const held = inventory.map((r) => r.held);
      assert.deepEqual(held, [0, 0]);
    });
  });
});