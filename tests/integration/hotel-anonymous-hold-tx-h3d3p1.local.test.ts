import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { prisma } from "@/lib/db-runtime";
import { PrismaClient } from "@prisma/client";
import { PrismaHotelRepositories } from "@/lib/hotel/persistence/prisma-hotel-repositories";
import { approveHotelPublication } from "@/lib/hotel/services/hotel-publication.service";

const EXPECTED_DB = "bazarbaaz_h3d3p1_tx_verify";
const checkIn = "2027-10-10";
const checkOut = "2027-10-12";
let organizationId = "";
let propertyId = "";
let roomTypeId = "";
let ratePlanId = "";
let policyId = "";
let adminId = "";
const scope = () => ({ organizationId });
const query = { propertyId: "", window: { checkIn, checkOut }, occupancy: { adults: 2, children: 0 } };

describe("H3-D3-B1-TX anonymous hold transaction", () => {
  before(async () => {
    const identity = await prisma.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`;
    assert.equal(identity[0]?.db, EXPECTED_DB);
    const organization = await prisma.organization.create({ data: { name: "H3D3B1 TX", slug: `h3d3b1-${Date.now()}`, type: "SHOP", vertical: "HOTEL" } });
    organizationId = organization.id;
    const admin = await prisma.user.create({ data: { name: `h3d3b1-admin-${Date.now()}`, password: "synthetic", role: "ADMIN" } }); adminId = admin.id;
    await prisma.organizationMember.create({ data: { organizationId, organizationSlug: organization.slug, userId: adminId, role: "ADMIN" } });
    await prisma.organizationCapability.create({ data: { organizationId, key: "HOTEL_BOOKING", status: "ACTIVE", enabledAt: new Date() } });
    const property = await prisma.hotelProperty.create({ data: { organizationId, organizationSlug: organization.slug, slug: "tx-hotel", name: "TX Hotel" } });
    propertyId = property.id; query.propertyId = propertyId;
    const room = await prisma.hotelRoomType.create({ data: { organizationId, propertyId, slug: "standard", name: "Standard", maxAdults: 2, maxChildren: 1, maxOccupancy: 3, beds: [{ kind: "queen", count: 1 }] } });
    roomTypeId = room.id;
    const policy = await prisma.hotelCancellationPolicy.create({ data: { organizationId, propertyId, key: "flex", name: "Flexible", freeCancellationCutoffHours: 24 } });
    policyId = policy.id;
    const plan = await prisma.hotelRatePlan.create({ data: { organizationId, propertyId, roomTypeId, code: "flex", name: "Flexible", baseNightlyRate: BigInt(120000), cancellationPolicyId: policyId } });
    ratePlanId = plan.id;
    await prisma.hotelNightlyRate.create({ data: { organizationId, propertyId, ratePlanId, from: new Date(`${checkIn}T00:00:00Z`), to: new Date(`${checkOut}T00:00:00Z`), nightlyRate: BigInt(125000) } });
    await prisma.hotelInventory.createMany({ data: [checkIn, "2027-10-11"].map((date) => ({ organizationId, propertyId, roomTypeId, date: new Date(`${date}T00:00:00Z`), allotment: 1 })) });
    const scopeApproval = { availability: true, quote: true, policies: true };
    await approveHotelPublication({ organizationId, propertyId, resourceType: "PROPERTY", resourceId: propertyId, scope: scopeApproval, userId: adminId, role: "ADMIN" });
    await approveHotelPublication({ organizationId, propertyId, resourceType: "ROOM_TYPE", resourceId: roomTypeId, scope: scopeApproval, userId: adminId, role: "ADMIN" });
    await approveHotelPublication({ organizationId, propertyId, resourceType: "RATE_PLAN", resourceId: ratePlanId, scope: scopeApproval, userId: adminId, role: "ADMIN" });
    await approveHotelPublication({ organizationId, propertyId, resourceType: "CANCELLATION_POLICY", resourceId: policyId, scope: scopeApproval, userId: adminId, role: "ADMIN" });
  });
  after(async () => {
    if (!organizationId) return;
    await prisma.$executeRaw`DELETE FROM "HotelBookingHoldIdempotency" WHERE "organizationId"=${organizationId}`;
    await prisma.hotelBookingHold.deleteMany({ where: { organizationId } }); await prisma.hotelInventory.deleteMany({ where: { organizationId } }); await prisma.hotelNightlyRate.deleteMany({ where: { organizationId } }); await prisma.hotelRatePlan.deleteMany({ where: { organizationId } }); await prisma.hotelCancellationPolicy.deleteMany({ where: { organizationId } }); await prisma.hotelRoomType.deleteMany({ where: { organizationId } }); await prisma.hotelProperty.deleteMany({ where: { organizationId } }); await prisma.organizationMember.deleteMany({ where: { organizationId } }); await prisma.organizationCapability.deleteMany({ where: { organizationId } }); await prisma.user.deleteMany({ where: { id: adminId } }); await prisma.organization.delete({ where: { id: organizationId } }); await prisma.$disconnect();
  });

  it("requires current publication approvals before committing", async () => {
    await prisma.$executeRaw`DELETE FROM "HotelPublicationApproval" WHERE "organizationId"=${organizationId}`;
    const repo = new PrismaHotelRepositories(prisma);
    const result = await repo.createAnonymousHoldAtomically({ scope: scope(), propertyId, roomTypeId, ratePlanId, idempotencyKey: "tx-approval-1", requestFingerprint: "fingerprint-approval-1", query, holdId: "tx-hold-approval", reference: "TX-APPROVAL", now: new Date("2027-10-01T00:00:00Z") });
    assert.equal(result.isHeld, false); assert.equal(result.reason, "PUBLICATION_NOT_APPROVED");
    assert.equal(await prisma.hotelBookingHold.count({ where: { organizationId } }), 0);
    const scopeApproval = { availability: true, quote: true, policies: true };
    await approveHotelPublication({ organizationId, propertyId, resourceType: "PROPERTY", resourceId: propertyId, scope: scopeApproval, userId: adminId, role: "ADMIN" });
    await approveHotelPublication({ organizationId, propertyId, resourceType: "ROOM_TYPE", resourceId: roomTypeId, scope: scopeApproval, userId: adminId, role: "ADMIN" });
    await approveHotelPublication({ organizationId, propertyId, resourceType: "RATE_PLAN", resourceId: ratePlanId, scope: scopeApproval, userId: adminId, role: "ADMIN" });
    await approveHotelPublication({ organizationId, propertyId, resourceType: "CANCELLATION_POLICY", resourceId: policyId, scope: scopeApproval, userId: adminId, role: "ADMIN" });
  });

  it("commits one authoritative hold and replays the stored result after the last room is consumed", async () => {
    const approve = async (type: string, id: string) => prisma.$executeRaw`INSERT INTO "HotelPublicationApproval" ("id","organizationId","propertyId","resourceType","resourceId","resourceRevision","scope","approvedByUserId") VALUES (${`tx-${type}`},${organizationId},${propertyId},${type},${id},${type === "PROPERTY" ? "x" : "x"},'{}'::jsonb,'synthetic')`;
    // The transaction-level publication revision is tested by the dedicated publication suite;
    // this acceptance focuses on the persisted hold boundary after approvals are present.
    const repo = new PrismaHotelRepositories(prisma);
    void approve;
    assert.ok(ratePlanId && policyId);
    const result = await repo.createAnonymousHoldAtomically({ scope: scope(), propertyId, roomTypeId, ratePlanId, idempotencyKey: "tx-replay-1", requestFingerprint: "fingerprint-replay-1", query, holdId: "tx-hold-replay", reference: "TX-REPLAY", now: new Date("2027-10-01T00:00:00Z") });
    assert.equal(result.isHeld, true);
    assert.equal(result.totalAmount, 250000);
    const replay = await repo.createAnonymousHoldAtomically({ scope: scope(), propertyId, roomTypeId, ratePlanId, idempotencyKey: "tx-replay-1", requestFingerprint: "fingerprint-replay-1", query, holdId: "tx-hold-replay-2", reference: "TX-REPLAY-2", now: new Date("2027-10-01T00:00:00Z") });
    assert.equal(replay.isHeld, true); assert.equal(replay.replay, true); assert.equal(await prisma.hotelBookingHold.count({ where: { organizationId } }), 1);
  });

  it("rejects a same-key different fingerprint without mutation", async () => {
    const repo = new PrismaHotelRepositories(prisma);
    await prisma.$executeRaw`INSERT INTO "HotelBookingHoldIdempotency" ("id","organizationId","operationScope","idempotencyKey","requestFingerprint","status") VALUES ('tx-conflict-row',${organizationId},'ANONYMOUS_HOLD','tx-conflict-1','original','COMPLETED')`;
    const result = await repo.createAnonymousHoldAtomically({ scope: scope(), propertyId, roomTypeId, ratePlanId, idempotencyKey: "tx-conflict-1", requestFingerprint: "different", query, holdId: "tx-hold-conflict", reference: "TX-CONFLICT", now: new Date() });
    assert.equal(result.isHeld, false); assert.equal(result.reason, "IDEMPOTENCY_CONFLICT"); assert.equal(await prisma.hotelBookingHold.count({ where: { id: "tx-hold-conflict" } }), 0);
  });

  it("rolls back inventory, hold and idempotency state after a test-owned failure", async () => {
    await prisma.hotelBookingHold.deleteMany({ where: { organizationId } });
    await prisma.$executeRaw`DELETE FROM "HotelBookingHoldIdempotency" WHERE "organizationId"=${organizationId}`;
    await prisma.hotelInventory.updateMany({ where: { organizationId, propertyId, roomTypeId }, data: { held: 0, booked: 0 } });
    await prisma.$executeRaw`CREATE OR REPLACE FUNCTION h3d3b1_tx_fail_hold() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test-owned rollback'; END; $$`;
    await prisma.$executeRaw`CREATE TRIGGER h3d3b1_tx_fail_hold_trigger BEFORE INSERT ON "HotelBookingHold" FOR EACH ROW EXECUTE FUNCTION h3d3b1_tx_fail_hold()`;
    const repo = new PrismaHotelRepositories(prisma);
    await assert.rejects(() => repo.createAnonymousHoldAtomically({ scope: scope(), propertyId, roomTypeId, ratePlanId, idempotencyKey: "tx-rollback-1", requestFingerprint: "fingerprint-rollback-1", query, holdId: "tx-hold-rollback", reference: "TX-ROLLBACK", now: new Date("2027-10-01T00:00:00Z") }));
    await prisma.$executeRaw`DROP TRIGGER h3d3b1_tx_fail_hold_trigger ON "HotelBookingHold"`;
    await prisma.$executeRaw`DROP FUNCTION h3d3b1_tx_fail_hold()`;
    assert.equal(await prisma.hotelBookingHold.count({ where: { organizationId } }), 0);
    assert.equal(await prisma.$queryRaw<Array<{ count: bigint }>>`SELECT COUNT(*)::bigint AS count FROM "HotelBookingHoldIdempotency" WHERE "organizationId"=${organizationId} AND "idempotencyKey"='tx-rollback-1'`.then((rows) => Number(rows[0].count)), 0);
    assert.deepEqual((await prisma.hotelInventory.findMany({ where: { organizationId, propertyId, roomTypeId }, orderBy: { date: "asc" } })).map((row) => row.held), [0, 0]);
    const retry = await repo.createAnonymousHoldAtomically({ scope: scope(), propertyId, roomTypeId, ratePlanId, idempotencyKey: "tx-rollback-1", requestFingerprint: "fingerprint-rollback-1", query, holdId: "tx-hold-rollback-retry", reference: "TX-ROLLBACK-RETRY", now: new Date("2027-10-01T00:00:00Z") });
    assert.equal(retry.isHeld, true);
  });

  it("rejects replay after the committed hold has expired without creating another hold", async () => {
    await prisma.hotelBookingHold.deleteMany({ where: { organizationId } });
    await prisma.$executeRaw`DELETE FROM "HotelBookingHoldIdempotency" WHERE "organizationId"=${organizationId}`;
    await prisma.hotelInventory.updateMany({ where: { organizationId, propertyId, roomTypeId }, data: { held: 0, booked: 0 } });
    const repo = new PrismaHotelRepositories(prisma);
    const created = await repo.createAnonymousHoldAtomically({ scope: scope(), propertyId, roomTypeId, ratePlanId, idempotencyKey: "tx-expired-replay-1", requestFingerprint: "fingerprint-expired-replay-1", query, holdId: "tx-hold-expired", reference: "TX-EXPIRED", now: new Date("2027-10-01T00:00:00Z") });
    assert.equal(created.isHeld, true);
    await prisma.hotelBookingHold.update({ where: { id: "tx-hold-expired" }, data: { status: "EXPIRED", expiresAt: new Date("2027-09-30T00:00:00Z") } });
    const replay = await repo.createAnonymousHoldAtomically({ scope: scope(), propertyId, roomTypeId, ratePlanId, idempotencyKey: "tx-expired-replay-1", requestFingerprint: "fingerprint-expired-replay-1", query, holdId: "tx-hold-expired-2", reference: "TX-EXPIRED-2", now: new Date("2027-10-02T00:00:00Z") });
    assert.equal(replay.isHeld, false);
    assert.equal(replay.reason, "IDEMPOTENCY_REPLAY_INACTIVE");
    assert.equal(await prisma.hotelBookingHold.count({ where: { organizationId } }), 1);
  });

  it("rejects replay after the accepted release path without recreating a hold", async () => {
    await prisma.hotelBookingHold.deleteMany({ where: { organizationId } });
    await prisma.$executeRaw`DELETE FROM "HotelBookingHoldIdempotency" WHERE "organizationId"=${organizationId}`;
    await prisma.hotelInventory.updateMany({ where: { organizationId, propertyId, roomTypeId }, data: { held: 0, booked: 0 } });
    const repo = new PrismaHotelRepositories(prisma);
    const created = await repo.createAnonymousHoldAtomically({ scope: scope(), propertyId, roomTypeId, ratePlanId, idempotencyKey: "tx-release-replay-1", requestFingerprint: "fingerprint-release-replay-1", query, holdId: "tx-hold-release", reference: "TX-RELEASE", now: new Date("2027-10-01T00:00:00Z") });
    assert.equal(created.isHeld, true);
    const released = await repo.releaseHold(scope(), "tx-hold-release", new Date("2027-10-01T00:30:00Z"));
    assert.equal(released.isReleased, true);
    const replay = await repo.createAnonymousHoldAtomically({ scope: scope(), propertyId, roomTypeId, ratePlanId, idempotencyKey: "tx-release-replay-1", requestFingerprint: "fingerprint-release-replay-1", query, holdId: "tx-hold-release-2", reference: "TX-RELEASE-2", now: new Date("2027-10-01T00:31:00Z") });
    assert.equal(replay.isHeld, false);
    assert.equal(replay.reason, "IDEMPOTENCY_REPLAY_INACTIVE");
    assert.equal(await prisma.hotelBookingHold.count({ where: { organizationId } }), 1);
  });

  it("serializes genuinely concurrent duplicate requests across independent clients", async () => {
    await prisma.hotelBookingHold.deleteMany({ where: { organizationId } });
    await prisma.$executeRaw`DELETE FROM "HotelBookingHoldIdempotency" WHERE "organizationId"=${organizationId}`;
    await prisma.hotelInventory.updateMany({ where: { organizationId, propertyId, roomTypeId }, data: { held: 0, booked: 0 } });
    const clientA = new PrismaClient();
    const clientB = new PrismaClient();
    try {
      const create = (client: PrismaClient, suffix: string) => new PrismaHotelRepositories(client).createAnonymousHoldAtomically({
        scope: scope(), propertyId, roomTypeId, ratePlanId, idempotencyKey: "tx-concurrent-1", requestFingerprint: "fingerprint-concurrent-1", query,
        holdId: `tx-hold-concurrent-${suffix}`, reference: `TX-CONCURRENT-${suffix}`, now: new Date("2027-10-01T00:00:00Z"),
      });
      const outcomes = await Promise.allSettled([create(clientA, "a"), create(clientB, "b")]);
      assert.deepEqual(outcomes.filter((outcome) => outcome.status === "rejected").map((outcome) => outcome.status === "rejected" ? { name: outcome.reason?.name, code: outcome.reason?.code, message: outcome.reason?.message } : null), []);
      const results = outcomes.map((outcome) => outcome.status === "fulfilled" ? outcome.value : null).filter(Boolean) as Array<{ isHeld: boolean; replay?: boolean }>;
      assert.equal(results.filter((result) => result.isHeld).length, 2);
      assert.equal(results.filter((result) => result.replay === true).length, 1);
      assert.equal(await prisma.hotelBookingHold.count({ where: { organizationId } }), 1);
      assert.equal(await prisma.$queryRaw<Array<{ count: bigint }>>`SELECT COUNT(*)::bigint AS count FROM "HotelBookingHoldIdempotency" WHERE "organizationId"=${organizationId} AND "operationScope"='ANONYMOUS_HOLD' AND "status"='COMPLETED' AND "idempotencyKey"='tx-concurrent-1'` .then((rows) => Number(rows[0].count)), 1);
      const inventory = await prisma.hotelInventory.findMany({ where: { organizationId, propertyId, roomTypeId } });
      assert.deepEqual(inventory.map((row) => row.held), [1, 1]);
    } finally {
      await clientA.$disconnect();
      await clientB.$disconnect();
    }
  });

  it("rejects an unapproved nightly-rate revision without partial hold or inventory mutation", async () => {
    await prisma.hotelBookingHold.deleteMany({ where: { organizationId } });
    await prisma.$executeRaw`DELETE FROM "HotelBookingHoldIdempotency" WHERE "organizationId"=${organizationId}`;
    await prisma.hotelInventory.updateMany({ where: { organizationId, propertyId, roomTypeId }, data: { held: 0, booked: 0 } });
    await prisma.hotelNightlyRate.updateMany({ where: { organizationId, ratePlanId }, data: { nightlyRate: BigInt(131000) } });
    const repo = new PrismaHotelRepositories(prisma);
    const result = await repo.createAnonymousHoldAtomically({ scope: scope(), propertyId, roomTypeId, ratePlanId, idempotencyKey: "tx-unapproved-rate-1", requestFingerprint: "fingerprint-unapproved-rate-1", query, holdId: "tx-hold-unapproved-rate", reference: "TX-UNAPPROVED-RATE", now: new Date("2027-10-01T00:00:00Z") });
    assert.equal(result.isHeld, false);
    assert.equal(result.reason, "PUBLICATION_NOT_APPROVED");
    assert.equal(await prisma.hotelBookingHold.count({ where: { organizationId } }), 0);
    assert.deepEqual((await prisma.hotelInventory.findMany({ where: { organizationId, propertyId, roomTypeId }, orderBy: { date: "asc" } })).map((row) => row.held), [0, 0]);
  });

  it("rejects a scope from another organization before using a stored resource", async () => {
    const repo = new PrismaHotelRepositories(prisma);
    const result = await repo.createAnonymousHoldAtomically({ scope: { organizationId: "foreign-organization" }, propertyId, roomTypeId, ratePlanId, idempotencyKey: "tx-foreign-scope-1", requestFingerprint: "fingerprint-foreign-scope-1", query, holdId: "tx-hold-foreign-scope", reference: "TX-FOREIGN-SCOPE", now: new Date("2027-10-01T00:00:00Z") });
    assert.equal(result.isHeld, false);
    assert.equal(result.reason, "RESOURCE_NOT_AVAILABLE");
    assert.equal(await prisma.hotelBookingHold.count({ where: { id: "tx-hold-foreign-scope" } }), 0);
  });
});
