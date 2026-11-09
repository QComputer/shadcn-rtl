import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db-runtime";
import { PrismaHotelRepositories } from "@/lib/hotel/persistence/prisma-hotel-repositories";
import { approveHotelPublication } from "@/lib/hotel/services/hotel-publication.service";
import { GET, POST } from "@/app/api/cron/expire-holds/route";

const EXPECTED_DB = process.env.HOTEL_EXPIRED_HOLDS_TEST_DATABASE ?? "bazarbaaz_hotel_expired_holds_verify";

const CRON_SECRET = "test-cron-secret-verify-123";

function dateValue(date: Date | string) {
  if (typeof date === "string") {
    // If it's already a full ISO datetime, return as-is
    if (date.includes("T")) return date;
    // Otherwise assume it's YYYY-MM-DD and convert to ISO datetime at midnight UTC
    return `${date}T00:00:00.000Z`;
  }
  // For Date objects, return full ISO datetime at midnight UTC
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function dateStr(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function makeCronRequest(method: "GET" | "POST", authHeader?: string, xCronSecret?: string) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (authHeader) headers["authorization"] = authHeader;
  if (xCronSecret) headers["x-cron-secret"] = xCronSecret;
  return new NextRequest("https://test.local/api/cron/expire-holds", { method, headers });
}

const organizations: Record<"a" | "b" | "c", {
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
  c: { id: "", propertyId: "", roomTypeId: "", ratePlanId: "", policyId: "", adminId: "", domain: "expired-c.local" },
};

async function createHoldDirect(
  repo: PrismaHotelRepositories,
  orgKey: "a" | "b" | "c",
  holdId: string,
  reference: string,
  expiresAt: Date,
  checkIn: Date,
  checkOut: Date,
  status: "ACTIVE" | "CONSUMED" | "EXPIRED" | "RELEASED" = "ACTIVE"
) {
  const org = organizations[orgKey];
  const nights: Date[] = [];
  let current = new Date(checkIn);
  while (current < checkOut) {
    nights.push(new Date(current));
    current = addDays(current, 1);
  }
  const nightStrs = nights.map(dateStr);
  const createdAt = new Date("2028-01-01T00:00:00Z");
  const hold = {
    id: holdId,
    organizationId: org.id,
    propertyId: org.propertyId,
    roomTypeId: org.roomTypeId,
    reference,
    quantity: 1,
    checkIn: dateStr(checkIn),
    checkOut: dateStr(checkOut),
    nights: nightStrs,
    expiresAt,
    status,
    createdAt,
  };
  await repo.createHold(hold);
  for (const date of nightStrs) {
    await prisma.hotelInventory.updateMany({
      where: { organizationId: org.id, propertyId: org.propertyId, roomTypeId: org.roomTypeId, date: dateValue(date) },
      data: { held: { increment: 1 } },
    });
  }
  return hold;
}

async function ensureInventory(orgKey: "a" | "b" | "c", dates: Date[], allotment = 5) {
  const org = organizations[orgKey];
  const nightStrs = dates.map(dateStr);
  for (const date of nightStrs) {
    await prisma.hotelInventory.upsert({
      where: {
        roomTypeId_date: { roomTypeId: org.roomTypeId, date: dateValue(date) },
      },
      create: { organizationId: org.id, propertyId: org.propertyId, roomTypeId: org.roomTypeId, date: dateValue(date), allotment },
      update: { allotment },
    });
  }
}

async function resetInventory(orgKey: "a" | "b" | "c") {
  const org = organizations[orgKey];
  await prisma.hotelInventory.updateMany({ where: { organizationId: org.id }, data: { held: 0 } });
}

async function clearOrgData(orgKey: "a" | "b" | "c") {
  const org = organizations[orgKey];
  await prisma.hotelBookingHold.deleteMany({ where: { organizationId: org.id } });
  await resetInventory(orgKey);
}

async function clearAllOrgData() {
  await clearOrgData("a");
  await clearOrgData("b");
  await clearOrgData("c");
}

function findOrgResult(results: Array<{ organizationId: string; expired: number; skipped: number; error?: string }>, orgId: string) {
  return results.find((r) => r.organizationId === orgId);
}

describe("Hotel Expired Holds Cron Integration", () => {
  let repoA: PrismaHotelRepositories;
  let repoB: PrismaHotelRepositories;
  let repoC: PrismaHotelRepositories;

  const testBase = new Date();
  const checkIn = addDays(testBase, 5);
  const checkOut = addDays(testBase, 7);
  const expiredAt = addDays(testBase, -2);
  const futureAt = addDays(testBase, 10);

  before(async () => {
    process.env.CRON_SECRET = CRON_SECRET;
    process.env.HOTEL_CRON_SCHEDULER_ENABLED = "1";

    const identity = await prisma.$queryRaw<Array<{ db: string }>>`SELECT current_database()::text AS db`;
    assert.equal(identity[0]?.db, EXPECTED_DB);

    for (const key of ["a", "b", "c"] as const) {
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

      await prisma.hotelNightlyRate.create({ data: { organizationId: org.id, propertyId: property.id, ratePlanId: plan.id, from: checkIn, to: checkOut, nightlyRate: BigInt(125000) } });

      await ensureInventory(key, [checkIn, addDays(checkIn, 1)]);

      const scopeApproval = { availability: true, quote: true, policies: true };
      await approveHotelPublication({ organizationId: org.id, propertyId: property.id, resourceType: "PROPERTY", resourceId: property.id, scope: scopeApproval, userId: admin.id, role: "ADMIN" });
      await approveHotelPublication({ organizationId: org.id, propertyId: property.id, resourceType: "ROOM_TYPE", resourceId: room.id, scope: scopeApproval, userId: admin.id, role: "ADMIN" });
      await approveHotelPublication({ organizationId: org.id, propertyId: property.id, resourceType: "RATE_PLAN", resourceId: plan.id, scope: scopeApproval, userId: admin.id, role: "ADMIN" });
      await approveHotelPublication({ organizationId: org.id, propertyId: property.id, resourceType: "CANCELLATION_POLICY", resourceId: policy.id, scope: scopeApproval, userId: admin.id, role: "ADMIN" });
    }

    repoA = new PrismaHotelRepositories(prisma);
    repoB = new PrismaHotelRepositories(prisma);
    repoC = new PrismaHotelRepositories(prisma);
  });

  after(async () => {
    for (const key of ["a", "b", "c"] as const) {
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
    delete process.env.HOTEL_CRON_SCHEDULER_ENABLED;
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
      await clearOrgData("a");

      await createHoldDirect(repoA, "a", "expired-hold-1", "EXP-1", expiredAt, checkIn, checkOut, "ACTIVE");

      const inventoryBefore = await prisma.hotelInventory.findMany({ where: { organizationId: organizations.a.id }, orderBy: { date: "asc" } });
      const heldBefore = inventoryBefore.map((r) => r.held);

      const req = makeCronRequest("GET", `Bearer ${CRON_SECRET}`);
      const res = await GET(req);
      assert.equal(res.status, 200);
      const body = await res.json();
      const orgAResult = findOrgResult(body.results, organizations.a.id);
      assert.equal(orgAResult?.expired, 1);
      assert.equal(orgAResult?.skipped, 0);

      const hold = await prisma.hotelBookingHold.findUnique({ where: { id: "expired-hold-1" } });
      assert.equal(hold?.status, "EXPIRED");

      const inventoryAfter = await prisma.hotelInventory.findMany({ where: { organizationId: organizations.a.id }, orderBy: { date: "asc" } });
      const heldAfter = inventoryAfter.map((r) => r.held);
      assert.deepEqual(heldAfter, heldBefore.map((h) => h - 1));
    });

    it("skips nonexpired ACTIVE holds (not in expired list)", async () => {
      await clearOrgData("a");

      await createHoldDirect(repoA, "a", "nonexpired-hold-1", "NONEXP-1", futureAt, checkIn, checkOut, "ACTIVE");

      const req = makeCronRequest("GET", `Bearer ${CRON_SECRET}`);
      const res = await GET(req);
      assert.equal(res.status, 200);
      const body = await res.json();
      const orgAResult = findOrgResult(body.results, organizations.a.id);
      assert.equal(orgAResult?.expired, 0);
      assert.equal(orgAResult?.skipped, 0);

      const hold = await prisma.hotelBookingHold.findUnique({ where: { id: "nonexpired-hold-1" } });
      assert.equal(hold?.status, "ACTIVE");
    });

    it("skips CONSUMED holds (not in expired list)", async () => {
      await clearOrgData("a");

      await createHoldDirect(repoA, "a", "consumed-hold-1", "CONS-1", expiredAt, checkIn, checkOut, "CONSUMED");

      const req = makeCronRequest("GET", `Bearer ${CRON_SECRET}`);
      const res = await GET(req);
      assert.equal(res.status, 200);
      const body = await res.json();
      const orgAResult = findOrgResult(body.results, organizations.a.id);
      assert.equal(orgAResult?.expired, 0);
      assert.equal(orgAResult?.skipped, 0);

      const hold = await prisma.hotelBookingHold.findUnique({ where: { id: "consumed-hold-1" } });
      assert.equal(hold?.status, "CONSUMED");
    });

    it("skips previously RELEASED holds (not in expired list)", async () => {
      await clearOrgData("a");

      await createHoldDirect(repoA, "a", "released-hold-1", "REL-1", expiredAt, checkIn, checkOut, "RELEASED");

      const req = makeCronRequest("GET", `Bearer ${CRON_SECRET}`);
      const res = await GET(req);
      assert.equal(res.status, 200);
      const body = await res.json();
      const orgAResult = findOrgResult(body.results, organizations.a.id);
      assert.equal(orgAResult?.expired, 0);
      assert.equal(orgAResult?.skipped, 0);

      const hold = await prisma.hotelBookingHold.findUnique({ where: { id: "released-hold-1" } });
      assert.equal(hold?.status, "RELEASED");
    });

    it("skips already EXPIRED holds (not in expired list)", async () => {
      await clearOrgData("a");

      await createHoldDirect(repoA, "a", "already-expired-1", "ALREXP-1", expiredAt, checkIn, checkOut, "EXPIRED");

      const req = makeCronRequest("GET", `Bearer ${CRON_SECRET}`);
      const res = await GET(req);
      assert.equal(res.status, 200);
      const body = await res.json();
      const orgAResult = findOrgResult(body.results, organizations.a.id);
      assert.equal(orgAResult?.expired, 0);
      assert.equal(orgAResult?.skipped, 0);

      const hold = await prisma.hotelBookingHold.findUnique({ where: { id: "already-expired-1" } });
      assert.equal(hold?.status, "EXPIRED");
    });
  });

  describe("Idempotency and Concurrency", () => {
    it("repeated invocation does not double-decrement inventory", async () => {
      await clearOrgData("a");

      await createHoldDirect(repoA, "a", "idempotent-hold-1", "IDEMP-1", expiredAt, checkIn, checkOut, "ACTIVE");

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
      await clearOrgData("a");

      await createHoldDirect(repoA, "a", "concurrent-hold-1", "CONC-1", expiredAt, checkIn, checkOut, "ACTIVE");
      await createHoldDirect(repoA, "a", "concurrent-hold-2", "CONC-2", expiredAt, checkIn, checkOut, "ACTIVE");

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
      await clearAllOrgData();

      await createHoldDirect(repoA, "a", "org-a-hold-1", "ORGA-1", expiredAt, checkIn, checkOut, "ACTIVE");
      await createHoldDirect(repoB, "b", "org-b-hold-1", "ORGB-1", expiredAt, checkIn, checkOut, "ACTIVE");

      const req = makeCronRequest("GET", `Bearer ${CRON_SECRET}`);
      const res = await GET(req);
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.results.length, 3);

      const orgAResult = findOrgResult(body.results, organizations.a.id);
      const orgBResult = findOrgResult(body.results, organizations.b.id);
      assert.equal(orgAResult?.expired, 1);
      assert.equal(orgBResult?.expired, 1);

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
      await clearAllOrgData();

      await createHoldDirect(repoA, "a", "good-hold-1", "GOOD-1", expiredAt, checkIn, checkOut, "ACTIVE");
      await createHoldDirect(repoC, "c", "good-hold-2", "GOOD-2", expiredAt, checkIn, checkOut, "ACTIVE");

      // Corrupt org C's inventory so releaseHold fails with INSUFFICIENT_INVENTORY (counts as skipped)
      const orgCNights: Date[] = [];
      let current = new Date(checkIn);
      while (current < checkOut) {
        orgCNights.push(new Date(current));
        current = addDays(current, 1);
      }
      const orgCNightStrs = orgCNights.map(dateStr);
      for (const date of orgCNightStrs) {
        await prisma.hotelInventory.updateMany({
          where: { organizationId: organizations.c.id, propertyId: organizations.c.propertyId, roomTypeId: organizations.c.roomTypeId, date: dateValue(date) },
          data: { held: 0 },
        });
      }

      const req = makeCronRequest("GET", `Bearer ${CRON_SECRET}`);
      const res = await GET(req);
      assert.equal(res.status, 200);
      const body = await res.json() as { results: Array<{ organizationId: string; expired: number; skipped: number; error?: string }> };

      const orgAResult = findOrgResult(body.results, organizations.a.id);
      const orgCResult = findOrgResult(body.results, organizations.c.id);

      assert.equal(orgAResult?.expired, 1);
      // org C's hold fails due to insufficient inventory -> skipped, not error
      assert.ok(orgCResult!.skipped > 0, "org C should have skipped holds");

      const holdA = await prisma.hotelBookingHold.findUnique({ where: { id: "good-hold-1" } });
      assert.equal(holdA?.status, "EXPIRED");
    });
  });

  describe("Multiple-Night Consistency", () => {
    it("releases inventory for all nights of a multi-night stay", async () => {
      await clearOrgData("a");

      const longCheckIn = addDays(testBase, 5);
      const longCheckOut = addDays(testBase, 10);
      const longNights: Date[] = [];
      let current = new Date(longCheckIn);
      while (current < longCheckOut) {
        longNights.push(new Date(current));
        current = addDays(current, 1);
      }

      await ensureInventory("a", longNights);

      await createHoldDirect(repoA, "a", "multi-night-hold-1", "MULTI-1", expiredAt, longCheckIn, longCheckOut, "ACTIVE");

      const req = makeCronRequest("GET", `Bearer ${CRON_SECRET}`);
      const res = await GET(req);
      assert.equal(res.status, 200);
      const body = await res.json();
      const orgAResult = findOrgResult(body.results, organizations.a.id);
      assert.equal(orgAResult?.expired, 1);

      const inventory = await prisma.hotelInventory.findMany({ where: { organizationId: organizations.a.id, propertyId: organizations.a.propertyId, roomTypeId: organizations.a.roomTypeId }, orderBy: { date: "asc" } });
      const held = inventory.map((r) => r.held);
      assert.deepEqual(held, longNights.map(() => 0));
    });
  });

  describe("Backlog Handling", () => {
    it("processes more than 100 expired holds with bounded continuation", async () => {
      await clearOrgData("a");
      // Ensure sufficient allotment for 150 holds x 2 nights
      await ensureInventory("a", [checkIn, addDays(checkIn, 1)], 200);

      const holdCount = 150;
      for (let i = 0; i < holdCount; i++) {
        const holdId = `backlog-hold-${i}`;
        await createHoldDirect(repoA, "a", holdId, `BACKLOG-${i}`, expiredAt, checkIn, checkOut, "ACTIVE");
      }

      const req = makeCronRequest("GET", `Bearer ${CRON_SECRET}`);
      const res = await GET(req);
      assert.equal(res.status, 200);
      const body = await res.json();
      const orgAResult = findOrgResult(body.results, organizations.a.id);

      assert.ok(orgAResult!.expired >= 100);
      assert.ok(orgAResult!.expired <= holdCount);

      const remainingActive = await prisma.hotelBookingHold.count({ where: { organizationId: organizations.a.id, status: "ACTIVE", expiresAt: { lte: new Date() } } });
      assert.equal(remainingActive, holdCount - orgAResult!.expired);

      const inventory = await prisma.hotelInventory.findMany({ where: { organizationId: organizations.a.id }, orderBy: { date: "asc" } });
      const totalHeld = inventory.reduce((sum, r) => sum + r.held, 0);
      assert.equal(totalHeld, remainingActive * 2);
    });

    it("multiple invocations drain backlog completely", async () => {
      await clearOrgData("a");
      // Ensure sufficient allotment for 150 holds x 2 nights
      await ensureInventory("a", [checkIn, addDays(checkIn, 1)], 200);

      const holdCount = 150;
      for (let i = 0; i < holdCount; i++) {
        const holdId = `drain-hold-${i}`;
        await createHoldDirect(repoA, "a", holdId, `DRAIN-${i}`, expiredAt, checkIn, checkOut, "ACTIVE");
      }

      let totalExpired = 0;
      for (let i = 0; i < 3; i++) {
        const req = makeCronRequest("GET", `Bearer ${CRON_SECRET}`);
        const res = await GET(req);
        assert.equal(res.status, 200);
        const body = await res.json();
        const orgAResult = findOrgResult(body.results, organizations.a.id);
        totalExpired += orgAResult!.expired;
        if (orgAResult!.expired === 0) break;
      }

      assert.equal(totalExpired, holdCount);

      const remainingActive = await prisma.hotelBookingHold.count({ where: { organizationId: organizations.a.id, status: "ACTIVE", expiresAt: { lte: new Date() } } });
      assert.equal(remainingActive, 0);

      const inventory = await prisma.hotelInventory.findMany({ where: { organizationId: organizations.a.id }, orderBy: { date: "asc" } });
      const totalHeld = inventory.reduce((sum, r) => sum + r.held, 0);
      assert.equal(totalHeld, 0);
    });
  });

  describe("releaseHold Consistency", () => {
    it("fails when inventory held is insufficient (zero affected rows)", async () => {
      await clearOrgData("a");

      const holdId = "consistency-check-hold";
      await createHoldDirect(repoA, "a", holdId, "CONSIST-1", expiredAt, checkIn, checkOut, "ACTIVE");

      await resetInventory("a");

      const released = await repoA.releaseHold({ organizationId: organizations.a.id }, holdId, new Date());
      assert.equal(released.isReleased, false);
      assert.equal(released.reason, "INSUFFICIENT_INVENTORY");

      const hold = await prisma.hotelBookingHold.findUnique({ where: { id: holdId } });
      assert.equal(hold?.status, "ACTIVE");
    });

    it("rolls back first night decrement when second night fails", async () => {
      await clearOrgData("a");

      const longCheckIn = addDays(testBase, 5);
      const longCheckOut = addDays(testBase, 8);
      const longNights: Date[] = [];
      let current = new Date(longCheckIn);
      while (current < longCheckOut) {
        longNights.push(new Date(current));
        current = addDays(current, 1);
      }
      const longNightStrs = longNights.map(dateStr);

      await ensureInventory("a", longNights);

      const holdId = "rollback-test-hold";
      await createHoldDirect(repoA, "a", holdId, "ROLLBACK-1", expiredAt, longCheckIn, longCheckOut, "ACTIVE");

      // Corrupt second night: set held to 0 so updateMany affects 0 rows
      await prisma.hotelInventory.updateMany({
        where: { organizationId: organizations.a.id, propertyId: organizations.a.propertyId, roomTypeId: organizations.a.roomTypeId, date: dateValue(longNightStrs[1]) },
        data: { held: 0 },
      });

      const released = await repoA.releaseHold({ organizationId: organizations.a.id }, holdId, new Date());
      assert.equal(released.isReleased, false);
      assert.equal(released.reason, "INSUFFICIENT_INVENTORY");

      const hold = await prisma.hotelBookingHold.findUnique({ where: { id: holdId } });
      assert.equal(hold?.status, "ACTIVE");

      const inventory = await prisma.hotelInventory.findMany({
        where: { organizationId: organizations.a.id, propertyId: organizations.a.propertyId, roomTypeId: organizations.a.roomTypeId, date: { in: longNightStrs.map(dateValue) } },
        orderBy: { date: "asc" }
      });
      const held = inventory.map((r) => r.held);
      // First night was decremented then rolled back (back to 1)
      // Second night was 0, failed, rolled back (stays 0)
      // Third night was never decremented (stays 1)
      assert.deepEqual(held, [1, 0, 1]);
    });

    it("releasing already-released hold returns NOT_FOUND and does not decrement", async () => {
      await clearOrgData("a");

      const holdId = "double-release-hold";
      await createHoldDirect(repoA, "a", holdId, "DBL-REL-1", expiredAt, checkIn, checkOut, "ACTIVE");

      const first = await repoA.releaseHold({ organizationId: organizations.a.id }, holdId, new Date());
      assert.equal(first.isReleased, true);

      const second = await repoA.releaseHold({ organizationId: organizations.a.id }, holdId, new Date());
      assert.equal(second.isReleased, false);
      assert.equal(second.reason, "NOT_FOUND");

      const nightStrs = [dateStr(checkIn), dateStr(addDays(checkIn, 1))];
      const inventory = await prisma.hotelInventory.findMany({
        where: { organizationId: organizations.a.id, propertyId: organizations.a.propertyId, roomTypeId: organizations.a.roomTypeId, date: { in: nightStrs.map(dateValue) } },
        orderBy: { date: "asc" }
      });
      const held = inventory.map((r) => r.held);
      assert.deepEqual(held, [0, 0]);
    });
  });

  describe("Scheduler Gate", () => {
    it("returns 403 when HOTEL_CRON_SCHEDULER_ENABLED is not set", async () => {
      delete process.env.HOTEL_CRON_SCHEDULER_ENABLED;

      const req = makeCronRequest("GET", `Bearer ${CRON_SECRET}`);
      const res = await GET(req);
      assert.equal(res.status, 403);
      const body = await res.json();
      assert.equal(body.error, "Scheduler disabled");
    });

    it("allows execution when HOTEL_CRON_SCHEDULER_ENABLED=1 alone", async () => {
      process.env.HOTEL_CRON_SCHEDULER_ENABLED = "1";
      delete process.env.HOTEL_ANONYMOUS_HOLD_OPERATIONAL_ENABLED;

      await clearOrgData("a");

      await createHoldDirect(repoA, "a", "gate-check-hold", "GATE-1", expiredAt, checkIn, checkOut, "ACTIVE");

      const req = makeCronRequest("GET", `Bearer ${CRON_SECRET}`);
      const res = await GET(req);
      assert.equal(res.status, 200);
      const body = await res.json();
      const orgAResult = findOrgResult(body.results, organizations.a.id);
      assert.equal(orgAResult?.expired, 1);
    });
  });
});