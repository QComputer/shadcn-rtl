import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { HotelReservationIntegrityError, PrismaHotelRepositories } from "../../lib/hotel/persistence/prisma-hotel-repositories";
import type { ReservationRecord } from "../../lib/hotel/persistence/hotel-repositories";
import { cancelReservation } from "../../lib/hotel/services/hotel-booking.service";

const enabled = process.env.HOTEL_ATOMIC_CANCELLATION_ACCEPTANCE === "1";
const stayNights = ["2027-12-10", "2027-12-11"] as const;
const day = (value: string) => new Date(`${value}T00:00:00.000Z`);
const expectedStatuses = ["PENDING_PAYMENT", "CONFIRMED"] as const;

function guardedConnection() {
  assert.notEqual(process.env.NODE_ENV, "production");
  assert.equal(process.env.DATABASE_RUNTIME_ADAPTER, "postgresql");
  assert.equal(process.env.LOCAL_PRISMA_EXPECTED_PORT, "55439");
  assert.equal(process.env.RETAIL_HERO_EXPECTED_DATABASE, "retail_hero_test");
  let url: URL;
  try { url = new URL(process.env.DATABASE_URL ?? ""); }
  catch { throw new Error("invalid isolated local database configuration"); }
  assert.ok(["postgres:", "postgresql:"].includes(url.protocol));
  assert.equal(url.hostname, "127.0.0.1");
  assert.equal(url.port, "55439");
  assert.equal(url.pathname, "/retail_hero_test");
  assert.equal(decodeURIComponent(url.username), "hero_test");
  assert.equal(decodeURIComponent(url.password), "local_admin_fixture_only");
  assert.equal(url.search, "");
  assert.equal(url.hash, "");
  assert.equal(process.env.DIRECT_URL, process.env.DATABASE_URL);
  return url;
}

test("Hotel cancellation releases all committed inventory atomically on disposable PostgreSQL", {
  skip: !enabled,
  concurrency: false,
}, async () => {
  const connection = guardedConnection();
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: connection.toString(), max: 8 }), log: [] });
  const token = randomUUID().replaceAll("-", "").slice(0, 12);
  const orgIds: string[] = [];
  const propertyIds: string[] = [];
  const roomTypeIds: string[] = [];
  const ratePlanIds: string[] = [];
  const physicalRoomIds: string[] = [];
  const holdIds: string[] = [];
  const reservationIds: string[] = [];
  const repo = new PrismaHotelRepositories(db);

  try {
    const identity = await db.$queryRaw<Array<{ database: string; role: string; port: number }>>`
      SELECT current_database()::text AS database, current_user::text AS role, inet_server_port() AS port`;
    assert.deepEqual(identity, [{ database: "retail_hero_test", role: "hero_test", port: 5432 }]);

    const orgA = await db.organization.create({ data: { type: "SHOP", vertical: "HOTEL", name: `Atomic cancel A ${token}`, slug: `hotel-cancel-a-${token}` } }); orgIds.push(orgA.id);
    const orgB = await db.organization.create({ data: { type: "SHOP", vertical: "HOTEL", name: `Atomic cancel B ${token}`, slug: `hotel-cancel-b-${token}` } }); orgIds.push(orgB.id);
    const property = await db.hotelProperty.create({ data: { organizationId: orgA.id, organizationSlug: orgA.slug, slug: `cancel-${token}`, name: "Synthetic cancellation hotel" } }); propertyIds.push(property.id);
    const foreignProperty = await db.hotelProperty.create({ data: { organizationId: orgB.id, organizationSlug: orgB.slug, slug: `foreign-cancel-${token}`, name: "Synthetic foreign cancellation hotel" } }); propertyIds.push(foreignProperty.id);
    const roomType = await db.hotelRoomType.create({ data: { organizationId: orgA.id, propertyId: property.id, slug: `room-${token}`, name: "Synthetic room", maxAdults: 2, maxChildren: 0, maxOccupancy: 2, beds: [] } }); roomTypeIds.push(roomType.id);
    const foreignRoomType = await db.hotelRoomType.create({ data: { organizationId: orgB.id, propertyId: foreignProperty.id, slug: `foreign-room-${token}`, name: "Synthetic foreign room", maxAdults: 2, maxChildren: 0, maxOccupancy: 2, beds: [] } }); roomTypeIds.push(foreignRoomType.id);
    const ratePlan = await db.hotelRatePlan.create({ data: { organizationId: orgA.id, propertyId: property.id, roomTypeId: roomType.id, code: `FLEX-${token}`, name: "Synthetic flexible", baseNightlyRate: BigInt(125000) } }); ratePlanIds.push(ratePlan.id);
    const foreignPlan = await db.hotelRatePlan.create({ data: { organizationId: orgB.id, propertyId: foreignProperty.id, roomTypeId: foreignRoomType.id, code: `FLEX-F-${token}`, name: "Synthetic foreign", baseNightlyRate: BigInt(125000) } }); ratePlanIds.push(foreignPlan.id);
    const room = await db.hotelRoom.create({ data: { organizationId: orgA.id, propertyId: property.id, roomTypeId: roomType.id, code: `101-${token}` } }); physicalRoomIds.push(room.id);
    const now = new Date();
    await db.hotelInventory.createMany({ data: stayNights.map(date => ({ organizationId: orgA.id, propertyId: property.id, roomTypeId: roomType.id, date: day(date), allotment: 20, held: 20, booked: 0 })) });

    const createReservation = async (label: string, status: "PENDING_PAYMENT" | "CONFIRMED" = "PENDING_PAYMENT", assignRoom = false) => {
      const holdId = `cancel-hold-${label}-${token}`; holdIds.push(holdId);
      await db.hotelBookingHold.create({ data: {
        id: holdId, organizationId: orgA.id, propertyId: property.id, roomTypeId: roomType.id,
        reference: holdId, quantity: 1, checkIn: day(stayNights[0]), checkOut: day("2027-12-12"),
        expiresAt: new Date(now.getTime() + 2 * 60 * 60_000), status: "ACTIVE",
      } });
      const record: ReservationRecord = {
        id: `cancel-res-${label}-${token}`, organizationId: orgA.id, propertyId: property.id,
        reference: holdId, idempotencyKey: `cancel-idem-${label}-${token}`, roomTypeId: roomType.id,
        ratePlanId: ratePlan.id, status: "PENDING_PAYMENT", checkIn: stayNights[0], checkOut: "2027-12-12",
        nights: stayNights, guests: [{ fullName: `Cancel guest ${label} ${token}`, isPrimary: true }],
        nightlyRates: [125000, 130000], totalAmount: 255000, currency: "TOMAN",
        cancellationPolicySnapshot: null, holdId, createdAt: now, updatedAt: now,
      };
      const created = await repo.createReservation(record);
      reservationIds.push(created.id);
      if (status === "CONFIRMED") await db.hotelReservation.update({ where: { id: created.id }, data: { status, paidAmount: BigInt(255000), confirmedAt: now } });
      if (assignRoom) await db.hotelReservationRoom.updateMany({ where: { reservationId: created.id }, data: { roomId: room.id } });
      return created;
    };
    const cancel = (reservationId: string, organizationId = orgA.id) => repo.cancelReservationAndReleaseInventory({
      scope: { organizationId }, reservationId, expectedStatus: expectedStatuses, now,
    });
    const inventoryRows = () => db.hotelInventory.findMany({ where: { organizationId: orgA.id, propertyId: property.id, roomTypeId: roomType.id }, orderBy: { date: "asc" } });

    // Cancellation clears physical assignments while preserving per-night price snapshots.
    const reusable = await createReservation("reuse", "PENDING_PAYMENT", true);
    const serviceResult = await cancelReservation({ booking: repo, payments: repo, now: () => now }, {
      scope: { organizationId: orgA.id }, reservationId: reusable.id, checkInAt: day(stayNights[0]),
    });
    assert.equal(serviceResult.isCancelled, true);
    if (!serviceResult.isCancelled) throw new Error("expected service cancellation to succeed");
    assert.equal(serviceResult.reservation.status, "CANCELLED");
    assert.equal(serviceResult.quote.refundableAmount, 0);
    assert.equal(serviceResult.quote.retainedAmount, 255000);
    assert.equal((await inventoryRows()).map(row => row.booked).join(","), "0,0");
    const releasedNights = await db.hotelReservationRoom.findMany({ where: { reservationId: reusable.id }, orderBy: { date: "asc" } });
    assert.equal(releasedNights.length, 2);
    assert.deepEqual(releasedNights.map(row => [row.roomId, row.rate]), [[null, BigInt(125000)], [null, BigInt(130000)]]);
    const next = await createReservation("reuse-next");
    await db.hotelReservationRoom.updateMany({ where: { reservationId: next.id }, data: { roomId: room.id } });
    assert.equal(await db.hotelReservationRoom.count({ where: { roomId: room.id } }), 2, "released room can be reused on both stay nights");

    // Two simultaneous retries yield one inventory release and one conflict.
    const duplicate = await createReservation("duplicate");
    const duplicateResults = await Promise.all([cancel(duplicate.id), cancel(duplicate.id)]);
    assert.equal(duplicateResults.filter(result => result.isUpdated).length, 1);
    assert.equal(duplicateResults.filter(result => !result.isUpdated && result.reason === "STATUS_CONFLICT").length, 1);
    const duplicateRow = await db.hotelReservation.findUniqueOrThrow({ where: { id: duplicate.id } });
    assert.equal(duplicateRow.status, "CANCELLED");
    assert.deepEqual((await inventoryRows()).map(row => row.booked), [1, 1], "duplicate cancellation cannot decrement another reservation's booked count");
    assert.equal((await cancel(duplicate.id)).isUpdated, false, "cancelled replay is a conflict");

    // A foreign tenant cannot cancel this row or change its counters.
    const foreignAttempt = await cancel(next.id, orgB.id);
    assert.equal(foreignAttempt.isUpdated, false);
    assert.equal((await db.hotelReservation.findUniqueOrThrow({ where: { id: next.id } })).status, "PENDING_PAYMENT");
    assert.deepEqual((await inventoryRows()).map(row => row.booked), [1, 1]);

    // All nightly inventory rows are validated before any decrement is applied.
    const missingNight = await createReservation("missing-night");
    await db.hotelInventory.delete({ where: { roomTypeId_date: { roomTypeId: roomType.id, date: day(stayNights[1]) } } });
    await assert.rejects(() => cancel(missingNight.id), HotelReservationIntegrityError);
    assert.equal((await db.hotelReservation.findUniqueOrThrow({ where: { id: missingNight.id } })).status, "PENDING_PAYMENT");
    assert.equal((await db.hotelInventory.findUniqueOrThrow({ where: { roomTypeId_date: { roomTypeId: roomType.id, date: day(stayNights[0]) } } })).booked, 2);

    // An insufficient later-night counter rolls back the earlier-night decrement too.
    await db.hotelInventory.upsert({ where: { roomTypeId_date: { roomTypeId: roomType.id, date: day(stayNights[1]) } }, create: { organizationId: orgA.id, propertyId: property.id, roomTypeId: roomType.id, date: day(stayNights[1]), allotment: 20, held: 19, booked: 0 }, update: { booked: 0 } });
    const insufficient = await createReservation("insufficient");
    await db.hotelInventory.update({ where: { roomTypeId_date: { roomTypeId: roomType.id, date: day(stayNights[1]) } }, data: { booked: 0 } });
    await assert.rejects(() => cancel(insufficient.id), HotelReservationIntegrityError);
    assert.equal((await db.hotelReservation.findUniqueOrThrow({ where: { id: insufficient.id } })).status, "PENDING_PAYMENT");
    assert.equal((await db.hotelInventory.findUniqueOrThrow({ where: { roomTypeId_date: { roomTypeId: roomType.id, date: day(stayNights[0]) } } })).booked, 3);

    // Cancelling a paid confirmed stay preserves payment history and reports no refund side effect.
    const confirmed = await createReservation("confirmed", "CONFIRMED");
    const confirmedCancel = await cancel(confirmed.id);
    assert.equal(confirmedCancel.isUpdated, true);
    if (!confirmedCancel.isUpdated) throw new Error("expected confirmed reservation cancellation to succeed");
    const confirmedAfter = await db.hotelReservation.findUniqueOrThrow({ where: { id: confirmed.id } });
    assert.equal(confirmedAfter.status, "CANCELLED");
    assert.equal(confirmedAfter.paidAmount, BigInt(255000));
    assert.equal(confirmedAfter.refundedAmount, BigInt(0), "cancellation does not fabricate a refund");

    // Lifecycle states outside the allowed cancellation set are rejected.
    const checkedIn = await createReservation("checked-in");
    await db.hotelReservation.update({ where: { id: checkedIn.id }, data: { status: "CHECKED_IN" } });
    const checkinResult = await cancel(checkedIn.id);
    assert.equal(checkinResult.isUpdated, false);
    assert.equal(checkinResult.reason, "STATUS_CONFLICT");
    assert.equal((await db.hotelReservation.findUniqueOrThrow({ where: { id: checkedIn.id } })).status, "CHECKED_IN");
  } catch (error) {
    const detail = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    console.error(`HOTEL_ATOMIC_CANCELLATION_TEST_FAILURE=${detail.slice(0, 500)}`);
    throw error;
  } finally {
    try {
      if (orgIds.length) {
        await db.hotelPaymentAllocation.deleteMany({ where: { organizationId: { in: orgIds } } });
        await db.hotelReservationRoom.deleteMany({ where: { reservation: { organizationId: { in: orgIds } } } });
        await db.hotelReservationGuest.deleteMany({ where: { reservation: { organizationId: { in: orgIds } } } });
        await db.hotelReservation.deleteMany({ where: { organizationId: { in: orgIds } } });
        await db.hotelBookingHold.deleteMany({ where: { organizationId: { in: orgIds } } });
        await db.hotelInventory.deleteMany({ where: { organizationId: { in: orgIds } } });
        await db.hotelRoom.deleteMany({ where: { id: { in: physicalRoomIds } } });
        await db.hotelRatePlan.deleteMany({ where: { id: { in: ratePlanIds } } });
        await db.hotelRoomType.deleteMany({ where: { id: { in: roomTypeIds } } });
        await db.hotelProperty.deleteMany({ where: { id: { in: propertyIds } } });
        await db.organization.deleteMany({ where: { id: { in: orgIds } } });
        assert.equal(await db.hotelReservation.count({ where: { organizationId: { in: orgIds } } }), 0);
        console.log("HOTEL_ATOMIC_CANCELLATION_CLEANUP=PASSED");
      }
    } finally { await db.$disconnect(); }
  }
});
