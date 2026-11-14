import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaHotelRepositories, HotelReservationIntegrityError, HotelIdempotencyConflictError } from "../../lib/hotel/persistence/prisma-hotel-repositories";
import type { ReservationRecord } from "../../lib/hotel/persistence/hotel-repositories";

const enabled = process.env.HOTEL_RESERVATION_PG_ACCEPTANCE === "1";
const nights = ["2027-12-10", "2027-12-11"];
const day = (value: string) => new Date(`${value}T00:00:00.000Z`);

function guardedConnection() {
  let url: URL;
  try { url = new URL(process.env.DATABASE_URL ?? ""); }
  catch { throw new Error("invalid isolated local database configuration"); }
  assert.ok(["postgres:", "postgresql:"].includes(url.protocol));
  assert.equal(url.hostname, "127.0.0.1");
  assert.equal(url.port, "55439");
  assert.equal(url.pathname, "/retail_hero_test");
  assert.equal(decodeURIComponent(url.username), "hero_test");
  assert.equal(url.search, "");
  assert.equal(url.hash, "");
  return url;
}

test("Hotel reservation atomically consumes its scoped hold on disposable PostgreSQL", {
  skip: !enabled,
  concurrency: false,
}, async () => {
  const connection = guardedConnection();
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: connection.toString(), max: 8 }), log: [] });
  const token = randomUUID().replaceAll("-", "").slice(0, 12);
  const orgIds: string[] = [];
  const userIds: string[] = [];
  const reservationIds: string[] = [];
  const holdIds: string[] = [];
  const propertyIds: string[] = [];
  const roomTypeIds: string[] = [];
  const ratePlanIds: string[] = [];
  try {
    const identity = await db.$queryRaw<Array<{ database: string; role: string; port: number }>>`
      SELECT current_database()::text AS database, current_user::text AS role, inet_server_port() AS port`;
    assert.deepEqual(identity, [{ database: "retail_hero_test", role: "hero_test", port: 5432 }]);

    const orgA = await db.organization.create({ data: { type: "SHOP", vertical: "HOTEL", name: `Atomic reservation A ${token}`, slug: `hotel-res-a-${token}` } });
    orgIds.push(orgA.id);
    const orgB = await db.organization.create({ data: { type: "SHOP", vertical: "HOTEL", name: `Atomic reservation B ${token}`, slug: `hotel-res-b-${token}` } });
    orgIds.push(orgB.id);
    const user = await db.user.create({ data: { name: `hotel-res-${token}`, password: "synthetic-only", role: "ADMIN" } }); userIds.push(user.id);
    const pA = await db.hotelProperty.create({ data: { organizationId: orgA.id, organizationSlug: orgA.slug, slug: `hotel-a-${token}`, name: "Synthetic hotel A" } });
    const pB = await db.hotelProperty.create({ data: { organizationId: orgB.id, organizationSlug: orgB.slug, slug: `hotel-b-${token}`, name: "Synthetic hotel B" } }); propertyIds.push(pA.id, pB.id);
    const rtA = await db.hotelRoomType.create({ data: { organizationId: orgA.id, propertyId: pA.id, slug: `room-a-${token}`, name: "Synthetic room A", maxAdults: 2, maxChildren: 0, maxOccupancy: 2, beds: [] } });
    const rtB = await db.hotelRoomType.create({ data: { organizationId: orgB.id, propertyId: pB.id, slug: `room-b-${token}`, name: "Synthetic room B", maxAdults: 2, maxChildren: 0, maxOccupancy: 2, beds: [] } }); roomTypeIds.push(rtA.id, rtB.id);
    const rpA = await db.hotelRatePlan.create({ data: { organizationId: orgA.id, propertyId: pA.id, roomTypeId: rtA.id, code: `flex-${token}`, name: "Synthetic flexible", baseNightlyRate: BigInt(125000) } });
    const rpB = await db.hotelRatePlan.create({ data: { organizationId: orgB.id, propertyId: pB.id, roomTypeId: rtB.id, code: `flex-b-${token}`, name: "Synthetic foreign", baseNightlyRate: BigInt(125000) } }); ratePlanIds.push(rpA.id, rpB.id);

    const now = day("2027-12-01");
    const createHold = async (label: string, overrides: Record<string, unknown> = {}) => {
      const id = `hold-${label}-${token}`; holdIds.push(id);
      return db.hotelBookingHold.create({ data: {
        id, organizationId: orgA.id, propertyId: pA.id, roomTypeId: rtA.id, reference: id,
        quantity: 1, checkIn: day(nights[0]), checkOut: day("2027-12-12"), expiresAt: day("2027-12-05"), status: "ACTIVE", ...overrides,
      } });
    };
    const setInventory = async (held: number, booked = 0, allotment = 1) => {
      await db.hotelInventory.deleteMany({ where: { organizationId: orgA.id, roomTypeId: rtA.id } });
      await db.hotelInventory.createMany({ data: nights.map((date) => ({ organizationId: orgA.id, propertyId: pA.id, roomTypeId: rtA.id, date: day(date), allotment, held, booked })) });
    };
    const recordFor = (holdId: string, label: string, patch: Partial<ReservationRecord> = {}): ReservationRecord => ({
      id: `reservation-${label}-${token}`, organizationId: orgA.id, propertyId: pA.id, reference: holdId,
      idempotencyKey: `idem-${label}-${token}`, roomTypeId: rtA.id, ratePlanId: rpA.id, status: "PENDING_PAYMENT",
      checkIn: nights[0], checkOut: "2027-12-12", nights, guests: [{ fullName: `Guest ${token}`, isPrimary: true }],
      nightlyRates: [125000, 130000], totalAmount: 255000, currency: "TOMAN", cancellationPolicySnapshot: null,
      holdId, createdAt: now, updatedAt: now, ...patch,
    });
    const repo = new PrismaHotelRepositories(db);

    const legacy = recordFor(`legacy-${token}`, "legacy", { holdId: undefined });
    const legacyCreated = await repo.createReservation(legacy);
    assert.deepEqual(legacyCreated.nights, nights, "legacy trusted no-hold creation retains its night snapshots");
    await assert.rejects(() => repo.createReservation({ ...legacy, id: `${legacy.id}-retry`, totalAmount: legacy.totalAmount + 1 }), HotelIdempotencyConflictError);

    await setInventory(1);
    const hold = await createHold("valid");
    const created = await repo.createReservation(recordFor(hold.id, "valid")); reservationIds.push(created.id);
    assert.equal(created.status, "PENDING_PAYMENT");
    assert.equal((await db.hotelBookingHold.findUniqueOrThrow({ where: { id: hold.id } })).status, "CONSUMED");
    assert.deepEqual((await db.hotelInventory.findMany({ where: { organizationId: orgA.id, roomTypeId: rtA.id }, orderBy: { date: "asc" } })).map((row) => [row.held, row.booked]), [[0, 1], [0, 1]]);

    await setInventory(1);
    const concurrentHold = await createHold("concurrent");
    const concurrentRecord = recordFor(concurrentHold.id, "concurrent");
    const concurrent = await Promise.allSettled([repo.createReservation(concurrentRecord), repo.createReservation(concurrentRecord)]);
    const successes = concurrent.filter((item) => item.status === "fulfilled");
    assert.equal(successes.length, 2, "same-key concurrent retries return the single durable result");
    const reservations = await db.hotelReservation.findMany({ where: { organizationId: orgA.id, idempotencyKey: concurrentRecord.idempotencyKey }, include: { nights: true } });
    reservationIds.push(...reservations.map((row) => row.id));
    assert.equal(reservations.length, 1);
    assert.equal(reservations[0].nights.length, 2);
    assert.deepEqual((await db.hotelInventory.findMany({ where: { organizationId: orgA.id, roomTypeId: rtA.id }, orderBy: { date: "asc" } })).map((row) => [row.held, row.booked]), [[0, 1], [0, 1]]);
    await assert.rejects(() => repo.createReservation({ ...concurrentRecord, ratePlanId: rpB.id }), HotelIdempotencyConflictError, "same-key replay with a different rate plan is denied");
    await assert.rejects(() => repo.createReservation({ ...concurrentRecord, guests: [{ fullName: "Changed guest", isPrimary: true }] }), HotelIdempotencyConflictError, "same-key replay with changed guests is denied");
    await assert.rejects(() => repo.createReservation({ ...concurrentRecord, nightlyRates: [1, 2], totalAmount: 3 }), HotelIdempotencyConflictError, "same-key replay with changed nightly rates is denied");
    const otherHold = await createHold("other-key");
    await assert.rejects(() => repo.createReservation({ ...concurrentRecord, holdId: otherHold.id }), HotelIdempotencyConflictError, "same-key replay with a different hold is denied");

    const rejected = async (label: string, holdId: string, patch: Partial<ReservationRecord> = {}) => {
      await assert.rejects(() => repo.createReservation(recordFor(holdId, label, patch)), HotelReservationIntegrityError);
      assert.equal(await db.hotelReservation.count({ where: { organizationId: orgA.id, idempotencyKey: `idem-${label}-${token}` } }), 0);
    };
    await setInventory(1); const mismatchHold = await createHold("mismatch");
    await rejected("mismatch-plan", mismatchHold.id, { ratePlanId: rpB.id });
    await rejected("mismatch-property", mismatchHold.id, { propertyId: pB.id });
    await rejected("mismatch-room-type", mismatchHold.id, { roomTypeId: rtB.id });
    await rejected("mismatch-organization", mismatchHold.id, { organizationId: orgB.id, propertyId: pB.id, roomTypeId: rtB.id, ratePlanId: rpB.id });
    await rejected("mismatch-dates", mismatchHold.id, { checkIn: "2027-12-11", checkOut: "2027-12-13", nights: ["2027-12-11", "2027-12-12"] });
    await rejected("mismatch-rates", mismatchHold.id, { nightlyRates: [1, 2], totalAmount: 4 });
    await setInventory(0);
    await rejected("underheld", mismatchHold.id);
    await setInventory(1);
    await db.hotelInventory.deleteMany({ where: { organizationId: orgA.id, roomTypeId: rtA.id, date: day(nights[1]) } });
    await rejected("missing-night", mismatchHold.id);
    assert.equal((await db.hotelBookingHold.findUniqueOrThrow({ where: { id: mismatchHold.id } })).status, "ACTIVE");
    assert.deepEqual((await db.hotelInventory.findMany({ where: { organizationId: orgA.id, roomTypeId: rtA.id } })).map(row => [row.held, row.booked]), [[1, 0]], "missing night must not partly move available rows");

    await setInventory(1); const expired = await createHold("expired", { expiresAt: day("2027-11-30") });
    await rejected("expired", expired.id);
    const foreign = await createHold("foreign", { organizationId: orgB.id, propertyId: pB.id, roomTypeId: rtB.id });
    await rejected("foreign-scope", foreign.id);

    await setInventory(1); const consumed = await createHold("consumed");
    const first = recordFor(consumed.id, "consumed-first");
    await repo.createReservation(first).then((row) => reservationIds.push(row.id));
    await assert.rejects(() => repo.createReservation(recordFor(consumed.id, "consumed-other-key")), HotelReservationIntegrityError);

    // A child insert error must roll back the parent, hold transition, and both inventory movements.
    await setInventory(1); const rollback = await createHold("rollback");
    await assert.rejects(() => repo.createReservation(recordFor(rollback.id, "rollback", {
      guests: [{ fullName: "Duplicate fixture guest", isPrimary: true }, { fullName: "Duplicate fixture guest", isPrimary: false }],
    })), "duplicate guest child violates the existing unique constraint");
    assert.equal((await db.hotelBookingHold.findUniqueOrThrow({ where: { id: rollback.id } })).status, "ACTIVE");
    assert.deepEqual((await db.hotelInventory.findMany({ where: { organizationId: orgA.id, roomTypeId: rtA.id }, orderBy: { date: "asc" } })).map((row) => [row.held, row.booked]), [[1, 0], [1, 0]]);
  } finally {
    try {
      if (orgIds.length) {
        await db.hotelReservationGuest.deleteMany({ where: { reservation: { organizationId: { in: orgIds } } } });
        await db.hotelReservationRoom.deleteMany({ where: { reservation: { organizationId: { in: orgIds } } } });
        await db.hotelPaymentAllocation.deleteMany({ where: { organizationId: { in: orgIds } } });
        await db.hotelReservation.deleteMany({ where: { organizationId: { in: orgIds } } });
        await db.hotelBookingHold.deleteMany({ where: { organizationId: { in: orgIds } } });
        await db.hotelInventory.deleteMany({ where: { organizationId: { in: orgIds } } });
        await db.hotelNightlyRate.deleteMany({ where: { organizationId: { in: orgIds } } });
        await db.hotelRatePlan.deleteMany({ where: { organizationId: { in: orgIds } } });
        await db.hotelRoomType.deleteMany({ where: { organizationId: { in: orgIds } } });
        await db.hotelProperty.deleteMany({ where: { organizationId: { in: orgIds } } });
        await db.organizationMember.deleteMany({ where: { organizationId: { in: orgIds } } });
        await db.organizationCapability.deleteMany({ where: { organizationId: { in: orgIds } } });
        await db.user.deleteMany({ where: { id: { in: userIds } } });
        await db.organization.deleteMany({ where: { id: { in: orgIds } } });
        assert.equal(await db.organization.count({ where: { id: { in: orgIds } } }), 0);
        assert.equal(await db.hotelReservation.count({ where: { organizationId: { in: orgIds } } }), 0);
        console.log("HOTEL_RESERVATION_ATOMIC_CLEANUP=PASSED");
      }
    } finally { await db.$disconnect(); }
  }
});
