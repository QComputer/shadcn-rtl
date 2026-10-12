import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { prisma } from "@/lib/db-runtime";
import { PrismaHotelRepositories } from "@/lib/hotel/persistence/prisma-hotel-repositories";
import { HotelIdempotencyConflictError } from "@/lib/hotel/persistence/prisma-hotel-repositories";

const EXPECTED_DB = "bazarbaaz_h3c1_verify";
let organizationId = "";
let propertyId = "";
let roomTypeId = "";
const dates = ["2027-01-10", "2027-01-11", "2027-01-12"] as const;
const concurrentDates = ["2027-01-20", "2027-01-21", "2027-01-22"] as const;
const extraDates = ["2027-02-10", "2027-02-11", "2027-02-12"] as const;
const dateOnly = (value: Date) => value.toISOString().slice(0, 10);

describe("H3-C1 PostgreSQL booking engine", () => {
  before(async () => {
    const rows = await prisma.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`;
    assert.equal(rows[0]?.db, EXPECTED_DB, `must run against ${EXPECTED_DB}`);
    const org = await prisma.organization.create({ data: { name: "H3-C1 synthetic", slug: `h3c1-${Date.now()}`, type: "SHOP" } });
    organizationId = org.id;
    const property = await prisma.hotelProperty.create({ data: { organizationId, organizationSlug: org.slug, slug: "test-property", name: "Synthetic property" } });
    propertyId = property.id;
    const roomType = await prisma.hotelRoomType.create({ data: { organizationId, propertyId, slug: "standard", name: "Synthetic room", maxAdults: 2, maxOccupancy: 2, beds: [{ kind: "queen", count: 1 }], totalAllotment: 1 } });
    roomTypeId = roomType.id;
    await prisma.hotelInventory.createMany({ data: [...dates, ...concurrentDates, ...extraDates].map((date) => ({ organizationId, propertyId, roomTypeId, date: new Date(`${date}T00:00:00.000Z`), allotment: 1 })) });
  });

  after(async () => {
    if (!organizationId) return;
    await prisma.hotelBookingHold.deleteMany({ where: { organizationId } });
    await prisma.hotelInventory.deleteMany({ where: { organizationId } });
    await prisma.hotelRoomType.deleteMany({ where: { organizationId } });
    await prisma.hotelProperty.deleteMany({ where: { organizationId } });
    await prisma.organization.delete({ where: { id: organizationId } });
  });

  it("claims all nights and persists the hold atomically", async () => {
    const repo = new PrismaHotelRepositories(prisma);
    const result = await repo.claimInventoryAndCreateHold({
      scope: { organizationId }, propertyId, roomTypeId, nights: dates, quantity: 1, now: new Date("2027-01-01T00:00:00Z"),
      hold: { id: "h3c1-hold-atomic", organizationId, propertyId, roomTypeId, reference: "h3c1-ref-atomic", checkIn: dates[0], checkOut: "2027-01-13", nights: dates, quantity: 1, expiresAt: new Date("2027-01-01T00:15:00Z"), status: "ACTIVE", createdAt: new Date("2027-01-01T00:00:00Z") },
    });
    assert.equal(result.isClaimed, true);
    assert.ok(result.hold);
    const inventory = await prisma.hotelInventory.findMany({ where: { organizationId }, orderBy: { date: "asc" } });
    assert.deepEqual(inventory.filter((row) => dates.includes(dateOnly(row.date) as typeof dates[number])).map((row) => row.held), [1, 1, 1]);
  });

  it("allows exactly one concurrent claimant for the final room", async () => {
    const repoA = new PrismaHotelRepositories(prisma);
    const repoB = new PrismaHotelRepositories(prisma);
    const input = (suffix: string) => ({ scope: { organizationId }, propertyId, roomTypeId, nights: concurrentDates, quantity: 1, now: new Date("2027-01-02T00:00:00Z"), hold: { id: `h3c1-concurrent-${suffix}`, organizationId, propertyId, roomTypeId, reference: `h3c1-ref-${suffix}`, checkIn: concurrentDates[0], checkOut: "2027-01-23", nights: concurrentDates, quantity: 1, expiresAt: new Date("2027-01-02T00:15:00Z"), status: "ACTIVE" as const, createdAt: new Date("2027-01-02T00:00:00Z") } });
    const results = await Promise.all([repoA.claimInventoryAndCreateHold(input("a")), repoB.claimInventoryAndCreateHold(input("b"))]);
    assert.equal(results.filter((result) => result.isClaimed).length, 1);
  });

  it("releases a hold exactly once and makes capacity available", async () => {
    const repo = new PrismaHotelRepositories(prisma);
    const hold = await repo.findHoldByReference({ organizationId }, "h3c1-ref-atomic");
    assert.ok(hold);
    const first = await repo.releaseHold({ organizationId }, hold.id, new Date("2027-01-01T00:16:00Z"));
    const second = await repo.releaseHold({ organizationId }, hold.id, new Date("2027-01-01T00:17:00Z"));
    assert.equal(first.isReleased, true);
    assert.equal(second.isReleased, false);
    const inventory = await prisma.hotelInventory.findMany({ where: { organizationId }, orderBy: { date: "asc" } });
    assert.deepEqual(inventory.filter((row) => dates.includes(dateOnly(row.date) as typeof dates[number])).map((row) => row.held), [0, 0, 0]);
  });

  it("rejects cross-tenant claims without changing inventory", async () => {
    const other = await prisma.organization.create({ data: { name: "H3-C1 other", slug: `h3c1-other-${Date.now()}`, type: "SHOP" } });
    try {
      const repo = new PrismaHotelRepositories(prisma);
      const result = await repo.claimInventoryAndCreateHold({ scope: { organizationId: other.id }, propertyId, roomTypeId, nights: dates, quantity: 1, now: new Date(), hold: { id: "h3c1-cross", organizationId: other.id, propertyId, roomTypeId, reference: "h3c1-cross", checkIn: dates[0], checkOut: "2027-01-13", nights: dates, quantity: 1, expiresAt: new Date(Date.now() + 60_000), status: "ACTIVE", createdAt: new Date() } });
      assert.equal(result.isClaimed, false);
      assert.equal(result.reason, "TENANT_MISMATCH");
    } finally {
      await prisma.organization.delete({ where: { id: other.id } });
    }
  });

  it("rejects a conflicting persisted reservation idempotency replay", async () => {
    const ratePlan = await prisma.hotelRatePlan.create({ data: { organizationId, propertyId, roomTypeId, code: `H3C1-TEST-${Date.now()}`, name: "Synthetic rate", baseNightlyRate: BigInt(100) } });
    const repo = new PrismaHotelRepositories(prisma);
    const record = {
      id: "h3c1-reservation-a", organizationId, propertyId, roomTypeId, ratePlanId: ratePlan.id,
      reference: "h3c1-res-a", idempotencyKey: "h3c1-retry-key", status: "PENDING_PAYMENT" as const,
      checkIn: extraDates[0], checkOut: "2027-02-13", nights: extraDates, guests: [{ fullName: "Synthetic guest", isPrimary: true }],
      nightlyRates: [100, 100, 100], totalAmount: 300, currency: "TOMAN", cancellationPolicySnapshot: null,
      createdAt: new Date("2027-02-01T00:00:00Z"), updatedAt: new Date("2027-02-01T00:00:00Z"),
    };
    await repo.createReservation(record);
    await assert.rejects(() => repo.createReservation({ ...record, id: "h3c1-reservation-b", reference: "h3c1-res-b", totalAmount: 301 }), HotelIdempotencyConflictError);
    assert.equal(await prisma.hotelReservation.count({ where: { organizationId, idempotencyKey: record.idempotencyKey } }), 1);
    await prisma.hotelReservation.delete({ where: { id: record.id } });
    await prisma.hotelRatePlan.delete({ where: { id: ratePlan.id } });
  });

  it("rolls back every night when a multi-night request includes an unavailable night", async () => {
    await prisma.hotelInventory.update({ where: { roomTypeId_date: { roomTypeId, date: new Date(`${extraDates[1]}T00:00:00.000Z`) } }, data: { allotment: 1, outOfService: 1 } });
    const repo = new PrismaHotelRepositories(prisma);
    const result = await repo.claimInventoryAndCreateHold({
      scope: { organizationId }, propertyId, roomTypeId, nights: extraDates, quantity: 1, now: new Date("2027-02-01T00:00:00Z"),
      hold: { id: "h3c1-rollback", organizationId, propertyId, roomTypeId, reference: "h3c1-rollback", checkIn: extraDates[0], checkOut: "2027-02-13", nights: extraDates, quantity: 1, expiresAt: new Date("2027-02-01T00:15:00Z"), status: "ACTIVE", createdAt: new Date("2027-02-01T00:00:00Z") },
    });
    assert.equal(result.isClaimed, false);
    assert.equal(await prisma.hotelBookingHold.count({ where: { id: "h3c1-rollback" } }), 0);
    const rows = await prisma.hotelInventory.findMany({ where: { organizationId, roomTypeId, date: { in: extraDates.map((date) => new Date(`${date}T00:00:00.000Z`)) } }, orderBy: { date: "asc" } });
    assert.deepEqual(rows.map((row) => row.held), [0, 0, 0]);
  });

  it("rejects a sibling-property claim and does not sell out-of-service inventory", async () => {
    const sibling = await prisma.hotelProperty.create({ data: { organizationId, organizationSlug: `h3c1-sibling-${Date.now()}`, slug: `sibling-${Date.now()}`, name: "Sibling synthetic property" } });
    const siblingRoom = await prisma.hotelRoomType.create({ data: { organizationId, propertyId: sibling.id, slug: "standard", name: "Sibling room", maxAdults: 2, maxOccupancy: 2, beds: [{ kind: "queen", count: 1 }], totalAllotment: 1 } });
    await prisma.hotelInventory.create({ data: { organizationId, propertyId: sibling.id, roomTypeId: siblingRoom.id, date: new Date("2027-02-20T00:00:00Z"), allotment: 1, outOfService: 1 } });
    try {
      const repo = new PrismaHotelRepositories(prisma);
      const foreign = await repo.claimInventoryAndCreateHold({ scope: { organizationId }, propertyId, roomTypeId: siblingRoom.id, nights: ["2027-02-20"], quantity: 1, now: new Date(), hold: { id: "h3c1-cross-property", organizationId, propertyId, roomTypeId: siblingRoom.id, reference: "h3c1-cross-property", checkIn: "2027-02-20", checkOut: "2027-02-21", nights: ["2027-02-20"], quantity: 1, expiresAt: new Date(Date.now() + 60000), status: "ACTIVE", createdAt: new Date() } });
      assert.equal(foreign.isClaimed, false);
      assert.equal(foreign.reason, "TENANT_MISMATCH");
      const outOfService = await repo.claimInventoryAndCreateHold({ scope: { organizationId }, propertyId: sibling.id, roomTypeId: siblingRoom.id, nights: ["2027-02-20"], quantity: 1, now: new Date(), hold: { id: "h3c1-out-of-service", organizationId, propertyId: sibling.id, roomTypeId: siblingRoom.id, reference: "h3c1-out-of-service", checkIn: "2027-02-20", checkOut: "2027-02-21", nights: ["2027-02-20"], quantity: 1, expiresAt: new Date(Date.now() + 60000), status: "ACTIVE", createdAt: new Date() } });
      assert.equal(outOfService.isClaimed, false);
      assert.equal(outOfService.reason, "NO_INVENTORY");
      assert.equal(await prisma.hotelBookingHold.count({ where: { organizationId, reference: { in: ["h3c1-cross-property", "h3c1-out-of-service"] } } }), 0);
    } finally {
      await prisma.hotelInventory.deleteMany({ where: { propertyId: sibling.id } });
      await prisma.hotelRoomType.delete({ where: { id: siblingRoom.id } });
      await prisma.hotelProperty.delete({ where: { id: sibling.id } });
    }
  });
});
