import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { prisma } from "@/lib/db";

/**
 * H3-B1 Hotel persistence integrity — DATABASE-BACKED.
 *
 * Runs against the isolated disposable database `bazarbaaz_h3b1_verify`, built
 * from the full committed migration history (86 baseline + H3-B0 + H3-B1).
 *
 * The suite FAILS FAST if the database identity is not exactly that, so it can
 * never silently execute against production or a shared development database.
 *
 * These tests assert real PostgreSQL constraints (CHECK, UNIQUE, composite FK,
 * EXCLUDE), not merely application validation. All data is synthetic.
 */

const EXPECTED_DB = "bazarbaaz_h3b1_verify";

let orgA = "";
let orgB = "";
let propA1 = "";
let propA2 = "";
let propB = "";
let roomTypeA = "";
let roomTypeA2 = "";
let seq = 0;

const runToken = Math.random().toString(36).slice(2, 8);
const uniq = (label: string) => {
  seq += 1;
  // Collision-proof across repeated runs: a re-run must not inherit rows from a
  // previous execution that has not been cleaned up yet.
  return `${label}${seq}${runToken}`.slice(0, 40);
};

async function newOrg(name: string) {
  return prisma.organization.create({
    data: { name, slug: uniq("h"), type: "SHOP", vertical: "HOTEL" },
  });
}

async function newProperty(organizationId: string, organizationSlug: string, slug: string) {
  return prisma.hotelProperty.create({
    data: {
      organizationId,
      organizationSlug,
      slug,
      name: `Property ${slug}`,
      timezone: "Asia/Tehran",
    },
  });
}

async function newRoomType(organizationId: string, propertyId: string, slug: string) {
  return prisma.hotelRoomType.create({
    data: {
      organizationId,
      propertyId,
      slug,
      name: `Room type ${slug}`,
      maxAdults: 2,
      maxChildren: 1,
      maxOccupancy: 3,
      beds: [{ kind: "queen", count: 1 }],
    },
  });
}

describe("H3-B1 hotel persistence integrity", () => {
  before(async () => {
    const rows = await prisma.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`;
    assert.equal(rows[0]?.db, EXPECTED_DB, `must run against ${EXPECTED_DB}`);

    const a = await newOrg("Hotel Org A");
    const b = await newOrg("Hotel Org B");
    orgA = a.id;
    orgB = b.id;

    // Two properties under ONE organization (multi-property support).
    propA1 = (await newProperty(orgA, a.slug, uniq("pa1"))).id;
    propA2 = (await newProperty(orgA, a.slug, uniq("pa2"))).id;
    propB = (await newProperty(orgB, b.slug, uniq("pb"))).id;

    roomTypeA = (await newRoomType(orgA, propA1, uniq("rta"))).id;
    // A second room type for the org's OTHER property. Room types are scoped to
    // their property, so tests that create rows against propA2 must use this.
    roomTypeA2 = (await newRoomType(orgA, propA2, uniq("rta2"))).id;
  });

  after(async () => {
    // Scoped strictly to the two synthetic organizations created above, and
    // deleted child-first: HotelReservation -> property is ON DELETE RESTRICT,
    // so a plain organization delete would be rejected by the database.
    if (orgA && orgB) {
      const organizations = await prisma.organization.findMany({
        where: { id: { in: [orgA, orgB] } },
        select: { id: true },
      });
      const ids = organizations.map((organization) => organization.id);
      if (ids.length === 0) return;

      const reservations = await prisma.hotelReservation.findMany({
        where: { organizationId: { in: ids } },
        select: { id: true },
      });
      const reservationIds = reservations.map((reservation) => reservation.id);
      if (reservationIds.length > 0) {
        await prisma.hotelReservationRoom.deleteMany({ where: { reservationId: { in: reservationIds } } });
        await prisma.hotelReservationGuest.deleteMany({ where: { reservationId: { in: reservationIds } } });
        await prisma.hotelPaymentAllocation.deleteMany({ where: { hotelReservationId: { in: reservationIds } } });
        await prisma.hotelReservation.deleteMany({ where: { id: { in: reservationIds } } });
      }
      await prisma.hotelBookingHold.deleteMany({ where: { organizationId: { in: ids } } });
      await prisma.hotelInventoryAdjustment.deleteMany({ where: { organizationId: { in: ids } } });
      await prisma.hotelInventory.deleteMany({ where: { organizationId: { in: ids } } });
      await prisma.hotelNightlyRate.deleteMany({ where: { organizationId: { in: ids } } });
      await prisma.hotelRatePlan.deleteMany({ where: { organizationId: { in: ids } } });
      await prisma.hotelRoomTypeAmenity.deleteMany({ where: { organizationId: { in: ids } } });
      await prisma.hotelAmenity.deleteMany({ where: { organizationId: { in: ids } } });
      await prisma.hotelCancellationPolicy.deleteMany({ where: { organizationId: { in: ids } } });
      await prisma.hotelRoom.deleteMany({ where: { organizationId: { in: ids } } });
      await prisma.hotelRoomType.deleteMany({ where: { organizationId: { in: ids } } });
      await prisma.hotelProperty.deleteMany({ where: { organizationId: { in: ids } } });
      await prisma.organizationCapability.deleteMany({ where: { organizationId: { in: ids } } });
      await prisma.organization.deleteMany({ where: { id: { in: ids } } });
    }
  });

  it("1. supports multiple hotel properties under one organization", async () => {
    const properties = await prisma.hotelProperty.findMany({ where: { organizationId: orgA } });
    assert.equal(properties.length, 2);
    assert.notEqual(properties[0]!.slug, properties[1]!.slug);
  });

  it("2. isolates properties between organizations", async () => {
    const a = await prisma.hotelProperty.findMany({ where: { organizationId: orgA } });
    const b = await prisma.hotelProperty.findMany({ where: { organizationId: orgB } });
    assert.equal(a.length, 2);
    assert.equal(b.length, 1);
    assert.ok(!a.some((property) => property.id === propB));
  });

  it("3. rejects a room type attached to a property owned by another organization", async () => {
    // Composite FK (propertyId, organizationId) must reject the mismatch.
    await assert.rejects(
      () =>
        prisma.hotelRoomType.create({
          data: {
            organizationId: orgB, // property belongs to orgA
            propertyId: propA1,
            slug: uniq("bad"),
            name: "cross tenant",
            maxAdults: 1,
            maxOccupancy: 1,
            beds: [],
          },
        }),
    );
  });

  it("4. rejects a physical room whose room type belongs to another organization", async () => {
    await assert.rejects(() =>
      prisma.hotelRoom.create({
        data: { organizationId: orgB, propertyId: propB, roomTypeId: roomTypeA, code: uniq("x") },
      }),
    );
  });

  it("5. rejects a duplicate room code within the same property", async () => {
    const code = uniq("dup");
    await prisma.hotelRoom.create({
      data: { organizationId: orgA, propertyId: propA2, roomTypeId: roomTypeA2, code },
    });
    await assert.rejects(() =>
      prisma.hotelRoom.create({
        data: { organizationId: orgA, propertyId: propA2, roomTypeId: roomTypeA2, code },
      }),
    );
  });

  it("5b. allows the same room code in a different property", async () => {
    // Room numbers are unique per property, never globally.
    const code = uniq("shared");
    await prisma.hotelRoom.create({
      data: { organizationId: orgA, propertyId: propA1, roomTypeId: roomTypeA, code },
    });
    const other = await prisma.hotelRoom.create({
      data: { organizationId: orgA, propertyId: propA2, roomTypeId: roomTypeA2, code },
    });
    assert.ok(other.id);
  });

  it("6. rejects an invalid date range on a reservation (checkOut must be after checkIn)", async () => {
    await assert.rejects(() =>
      prisma.hotelReservation.create({
        data: {
          organizationId: orgA,
          propertyId: propA1,
          roomTypeId: roomTypeA,
          ratePlanId: "rp_placeholder",
          reference: uniq("ref"),
          checkIn: new Date("2026-05-10T00:00:00Z"),
          checkOut: new Date("2026-05-08T00:00:00Z"),
          totalAmount: BigInt(1000),
          cancellationPolicyKey: "flexible",
          cancellationPolicySnapshot: {},
          idempotencyKey: uniq("idem"),
        },
      }),
    );
  });

  it("7. rejects negative inventory", async () => {
    for (const bad of [-1, -5]) {
      await assert.rejects(() =>
        prisma.hotelInventory.create({
          data: {
            organizationId: orgA,
            propertyId: propA1,
            roomTypeId: roomTypeA,
            date: new Date("2026-06-01T00:00:00Z"),
            allotment: bad,
          },
        }),
      );
    }
  });

  it("7b. rejects over-committed inventory (booked + held + outOfService > allotment)", async () => {
    await assert.rejects(() =>
      prisma.hotelInventory.create({
        data: {
          organizationId: orgA,
          propertyId: propA1,
          roomTypeId: roomTypeA,
          date: new Date("2026-06-02T00:00:00Z"),
          allotment: 2,
          booked: 2,
          held: 1,
        },
      }),
    );
  });

  it("8. rejects invalid occupancy", async () => {
    await assert.rejects(() =>
      prisma.hotelRoomType.create({
        data: {
          organizationId: orgA,
          propertyId: propA1,
          slug: uniq("badocc"),
          name: "bad occupancy",
          maxAdults: 4,
          maxChildren: 0,
          maxOccupancy: 2, // < maxAdults
          beds: [],
        },
      }),
    );
  });

  it("9. rejects invalid monetary values", async () => {
    await assert.rejects(() =>
      prisma.hotelRatePlan.create({
        data: {
          organizationId: orgA,
          propertyId: propA1,
          roomTypeId: roomTypeA,
          code: uniq("negrate"),
          name: "negative rate",
          baseNightlyRate: -BigInt(1),
        },
      }),
    );

    await assert.rejects(() =>
      prisma.hotelCancellationPolicy.create({
        data: {
          organizationId: orgA,
          propertyId: propA1,
          key: uniq("badpol"),
          name: "bad retention",
          freeCancellationCutoffHours: 24,
          fullCancellationRetention: 10001, // basis points must be 0..10000
        },
      }),
    );
  });

  it("10. rejects duplicate nightly inventory for the same room type and date", async () => {
    const date = new Date("2026-07-01T00:00:00Z");
    await prisma.hotelInventory.create({
      data: { organizationId: orgA, propertyId: propA1, roomTypeId: roomTypeA, date, allotment: 5 },
    });
    await assert.rejects(() =>
      prisma.hotelInventory.create({
        data: { organizationId: orgA, propertyId: propA1, roomTypeId: roomTypeA, date, allotment: 9 },
      }),
    );
  });

  it("11. rejects a cross-tenant inventory row", async () => {
    await assert.rejects(() =>
      prisma.hotelInventory.create({
        data: {
          organizationId: orgB,
          propertyId: propA1,
          roomTypeId: roomTypeA,
          date: new Date("2026-07-05T00:00:00Z"),
          allotment: 1,
        },
      }),
    );
  });

  it("12. rejects a cross-property room type reference", async () => {
    const roomTypeOnA2 = await newRoomType(orgA, propA2, uniq("rta2"));
    // propA1 inventory may not reference a room type belonging to propA2.
    await assert.rejects(() =>
      prisma.hotelInventory.create({
        data: {
          organizationId: orgA,
          propertyId: propA1,
          roomTypeId: roomTypeOnA2.id,
          date: new Date("2026-07-06T00:00:00Z"),
          allotment: 1,
        },
      }),
    );
  });

  it("13. prevents overlapping allocation of the same physical room on one night (EXCLUDE)", async () => {
    const room = await prisma.hotelRoom.create({
      data: { organizationId: orgA, propertyId: propA1, roomTypeId: roomTypeA, code: uniq("excl") },
    });
    const night = new Date("2026-08-01T00:00:00Z");

    const makeReservation = async (reference: string, idempotencyKey: string) =>
      prisma.hotelReservation.create({
        data: {
          organizationId: orgA,
          propertyId: propA1,
          roomTypeId: roomTypeA,
          ratePlanId: "rp_placeholder",
          reference,
          checkIn: new Date("2026-07-31T00:00:00Z"),
          checkOut: new Date("2026-08-03T00:00:00Z"),
          totalAmount: BigInt(3000),
          paidAmount: BigInt(3000),
          cancellationPolicyKey: "flexible",
          cancellationPolicySnapshot: { key: "flexible" },
          idempotencyKey,
          nights: {
            create: [
              { date: night, roomTypeId: roomTypeA, roomId: room.id, rate: BigInt(1000) },
            ],
          },
        },
      });

    const first = await makeReservation(uniq("r1"), uniq("i1"));
    assert.equal(
      await prisma.hotelReservationRoom.count({ where: { reservationId: first.id } }),
      1,
    );

    // Second reservation claiming the SAME room on the SAME night must fail.
    await assert.rejects(() => makeReservation(uniq("r2"), uniq("i2")));
  });

  it("14. allows adjacent stays that share a checkout/check-in boundary", async () => {
    const room = await prisma.hotelRoom.create({
      data: { organizationId: orgA, propertyId: propA1, roomTypeId: roomTypeA, code: uniq("adj") },
    });
    const boundary = new Date("2026-09-01T00:00:00Z");

    // A occupies the night of 2026-09-01 (checkOut 2026-09-02).
    await prisma.hotelReservation.create({
      data: {
        organizationId: orgA,
        propertyId: propA1,
        roomTypeId: roomTypeA,
        ratePlanId: "rp_placeholder",
        reference: uniq("adjA"),
        checkIn: new Date("2026-08-31T00:00:00Z"),
        checkOut: new Date("2026-09-02T00:00:00Z"),
        totalAmount: BigInt(1000),
        cancellationPolicyKey: "flexible",
        cancellationPolicySnapshot: {},
        idempotencyKey: uniq("adjI1"),
        nights: {
          create: [{ date: boundary, roomTypeId: roomTypeA, roomId: room.id, rate: BigInt(1000) }],
        },
      },
    });

    // B checks in on 2026-09-02, so 2026-09-02 is NOT an occupied night for B.
    // The half-open convention makes this legal; the EXCLUDE constraint must not fire.
    const second = await prisma.hotelReservation.create({
      data: {
        organizationId: orgA,
        propertyId: propA1,
        roomTypeId: roomTypeA,
        ratePlanId: "rp_placeholder",
        reference: uniq("adjB"),
        checkIn: new Date("2026-09-02T00:00:00Z"),
        checkOut: new Date("2026-09-04T00:00:00Z"),
        totalAmount: BigInt(2000),
        cancellationPolicyKey: "flexible",
        cancellationPolicySnapshot: {},
        idempotencyKey: uniq("adjI2"),
        nights: {
          create: [
            { date: new Date("2026-09-02T00:00:00Z"), roomTypeId: roomTypeA, roomId: room.id, rate: BigInt(1000) },
            { date: new Date("2026-09-03T00:00:00Z"), roomTypeId: roomTypeA, roomId: room.id, rate: BigInt(1000) },
          ],
        },
      },
    });
    assert.equal(
      await prisma.hotelReservationRoom.count({ where: { reservationId: second.id } }),
      2,
    );
  });

  it("15. persists the cancellation-policy snapshot verbatim", async () => {
    const snapshot = {
      key: "advance-50",
      name: "Advance purchase",
      freeCancellationCutoffHours: 72,
      fullCancellationRetention: 0.5,
      description: "50% retained inside 72h",
      organizationId: orgA,
      policyVersion: 4,
      capturedAt: "2026-03-01T00:00:00.000Z",
    };
    const policy = await prisma.hotelCancellationPolicy.create({
      data: {
        organizationId: orgA,
        propertyId: propA1,
        key: uniq("pol"),
        name: snapshot.name,
        freeCancellationCutoffHours: snapshot.freeCancellationCutoffHours,
        fullCancellationRetention: 5000,
        version: snapshot.policyVersion,
      },
    });

    const reservation = await prisma.hotelReservation.create({
      data: {
        organizationId: orgA,
        propertyId: propA1,
        roomTypeId: roomTypeA,
        ratePlanId: "rp_placeholder",
        reference: uniq("snap"),
        checkIn: new Date("2026-10-01T00:00:00Z"),
        checkOut: new Date("2026-10-03T00:00:00Z"),
        totalAmount: BigInt(5000),
        cancellationPolicyKey: policy.key,
        cancellationPolicySnapshot: snapshot,
        idempotencyKey: uniq("snapI"),
      },
    });

    const stored = await prisma.hotelReservation.findUniqueOrThrow({ where: { id: reservation.id } });
    const persisted = stored.cancellationPolicySnapshot as unknown as typeof snapshot;
    assert.equal(persisted.key, "advance-50");
    assert.equal(persisted.fullCancellationRetention, 0.5);
    assert.equal(persisted.policyVersion, 4);

    // Editing the LIVE policy must not alter the already-captured snapshot.
    await prisma.hotelCancellationPolicy.update({
      where: { id: policy.id },
      data: { fullCancellationRetention: 10000, freeCancellationCutoffHours: 0 },
    });
    const afterEdit = await prisma.hotelReservation.findUniqueOrThrow({ where: { id: reservation.id } });
    const stillPersisted = afterEdit.cancellationPolicySnapshot as unknown as typeof snapshot;
    assert.equal(stillPersisted.fullCancellationRetention, 0.5, "snapshot must be immutable");
    assert.equal(stillPersisted.freeCancellationCutoffHours, 72);
  });

  it("16. persists a hold with its expiry timestamp and enforces idempotent reference", async () => {
    const reference = uniq("hold");
    const expiresAt = new Date("2026-11-01T10:15:00.000Z");
    const hold = await prisma.hotelBookingHold.create({
      data: {
        organizationId: orgA,
        propertyId: propA1,
        roomTypeId: roomTypeA,
        reference,
        checkIn: new Date("2026-11-01T00:00:00Z"),
        checkOut: new Date("2026-11-03T00:00:00Z"),
        expiresAt,
        status: "ACTIVE",
      },
    });
    const stored = await prisma.hotelBookingHold.findUniqueOrThrow({ where: { id: hold.id } });
    assert.equal(stored.expiresAt.toISOString(), expiresAt.toISOString());
    assert.equal(stored.status, "ACTIVE");

    await assert.rejects(() =>
      prisma.hotelBookingHold.create({
        data: {
          organizationId: orgA,
          propertyId: propA1,
          roomTypeId: roomTypeA,
          reference,
          checkIn: new Date("2026-11-01T00:00:00Z"),
          checkOut: new Date("2026-11-03T00:00:00Z"),
          expiresAt,
        },
      }),
    );
  });

  it("16b. rejects a hold whose checkOut is not after checkIn", async () => {
    await assert.rejects(() =>
      prisma.hotelBookingHold.create({
        data: {
          organizationId: orgA,
          propertyId: propA1,
          roomTypeId: roomTypeA,
          reference: uniq("badhold"),
          checkIn: new Date("2026-11-05T00:00:00Z"),
          checkOut: new Date("2026-11-04T00:00:00Z"),
          expiresAt: new Date("2026-11-05T10:15:00.000Z"),
        },
      }),
    );
  });

  it("17. coexists with existing organization and capability records", async () => {
    const organization = await prisma.organization.findUniqueOrThrow({ where: { id: orgA } });
    assert.equal(organization.type, "SHOP");
    assert.equal(organization.vertical, "HOTEL");

    const capability = await prisma.organizationCapability.create({
      data: {
        organizationId: orgA,
        key: "HOTEL_BOOKING",
        status: "ACTIVE",
        enabledAt: new Date(),
      },
    });
    assert.equal(capability.key, "HOTEL_BOOKING");

    // Assigning a vertical earlier must not have created it implicitly.
    const beforeExplicit = await prisma.organizationCapability.count({ where: { organizationId: orgA } });
    assert.equal(beforeExplicit, 1, "only the explicitly created capability exists");
  });

  it("18. enforces the reservation idempotency key per organization", async () => {
    const key = uniq("idem");
    const base = {
      organizationId: orgA,
      propertyId: propA1,
      roomTypeId: roomTypeA,
      ratePlanId: "rp_placeholder",
      checkIn: new Date("2026-12-01T00:00:00Z"),
      checkOut: new Date("2026-12-02T00:00:00Z"),
      totalAmount: BigInt(1000),
      cancellationPolicyKey: "flexible",
      cancellationPolicySnapshot: {},
    };
    await prisma.hotelReservation.create({ data: { ...base, reference: uniq("r"), idempotencyKey: key } });
    await assert.rejects(() =>
      prisma.hotelReservation.create({ data: { ...base, reference: uniq("r"), idempotencyKey: key } }),
    );
  });

  it("19. refuses a refund larger than the amount paid (CHECK constraint)", async () => {
    await assert.rejects(() =>
      prisma.hotelReservation.create({
        data: {
          organizationId: orgA,
          propertyId: propA1,
          roomTypeId: roomTypeA,
          ratePlanId: "rp_placeholder",
          reference: uniq("ref"),
          checkIn: new Date("2026-12-05T00:00:00Z"),
          checkOut: new Date("2026-12-06T00:00:00Z"),
          totalAmount: BigInt(1000),
          paidAmount: BigInt(100),
          refundedAmount: BigInt(500), // refunded > paid
          cancellationPolicyKey: "flexible",
          cancellationPolicySnapshot: {},
          idempotencyKey: uniq("refi"),
        },
      }),
    );
  });
});