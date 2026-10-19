import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { prisma } from "@/lib/db-runtime";
import {
  HotelManagementAuthorizationError,
  HotelManagementConflictError,
  HotelManagementService,
  HotelManagementValidationError,
} from "@/lib/hotel/management/hotel-management.service";

const EXPECTED_DB = "bazarbaaz_h3d2c_verify";
const OPERATION = "HOTEL_INVENTORY_ADJUSTMENT";
const date = new Date("2027-08-12T00:00:00.000Z");
let organizationId = "";
let propertyId = "";
let roomTypeId = "";
let adminId = "";
let otherOrganizationId = "";
let otherPropertyId = "";
let otherRoomTypeId = "";

const principal = (userId: string, role: "ADMIN" | "MANAGER" | "STAFF", scopedOrganizationId = organizationId) => ({
  userId,
  role,
  organizationId: scopedOrganizationId,
});

function input(key: string, delta = 1, reason = "h3d2c acceptance") {
  return {
    propertyId,
    roomTypeId,
    date,
    allotmentDelta: delta,
    reason,
    idempotencyKey: key,
    requestFingerprint: `fingerprint:${key}:${delta}:${reason}`,
  };
}

describe("H3-D2-C isolated PostgreSQL idempotency acceptance", () => {
  before(async () => {
    const rows = await prisma.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`;
    assert.equal(rows[0]?.db, EXPECTED_DB, `must run against ${EXPECTED_DB}`);

    const organization = await prisma.organization.create({
      data: { name: `H3-D2-C ${Date.now()}`, slug: `h3d2c-${Date.now()}`, type: "SHOP", vertical: "HOTEL" },
    });
    organizationId = organization.id;
    const otherOrganization = await prisma.organization.create({
      data: { name: `H3-D2-C other ${Date.now()}`, slug: `h3d2c-other-${Date.now()}`, type: "SHOP", vertical: "HOTEL" },
    });
    otherOrganizationId = otherOrganization.id;

    const admin = await prisma.user.create({ data: { name: `h3d2c-admin-${Date.now()}`, password: "synthetic", role: "ADMIN" } });
    const staff = await prisma.user.create({ data: { name: `h3d2c-staff-${Date.now()}`, password: "synthetic", role: "STAFF" } });
    adminId = admin.id;
    await prisma.organizationMember.createMany({ data: [
      { userId: admin.id, organizationId, organizationSlug: organization.slug, role: "ADMIN" },
      { userId: staff.id, organizationId, organizationSlug: organization.slug, role: "STAFF" },
    ] });
    await prisma.organizationCapability.create({ data: { organizationId, key: "HOTEL_BOOKING", status: "ACTIVE", enabledAt: new Date() } });

    const service = new HotelManagementService(prisma);
    const property = await service.createProperty(principal(admin.id, "ADMIN"), { organizationId, organizationSlug: organization.slug, slug: "main", name: "Synthetic hotel" });
    propertyId = property.id;
    const roomType = await service.createRoomType(principal(admin.id, "ADMIN"), { organizationId }, { propertyId, slug: "standard", name: "Standard", maxAdults: 2, maxOccupancy: 2, beds: [{ kind: "queen", count: 1 }] });
    roomTypeId = roomType.id;
    await prisma.hotelInventory.create({ data: { organizationId, propertyId, roomTypeId, date, allotment: 10 } });

    const otherProperty = await prisma.hotelProperty.create({ data: { organizationId: otherOrganizationId, organizationSlug: otherOrganization.slug, slug: "other", name: "Other" } });
    otherPropertyId = otherProperty.id;
    const otherRoomType = await prisma.hotelRoomType.create({ data: { organizationId: otherOrganizationId, propertyId: otherProperty.id, slug: "other-standard", name: "Other standard", maxAdults: 2, maxOccupancy: 2, beds: [{ kind: "queen", count: 1 }] } });
    otherRoomTypeId = otherRoomType.id;
    await prisma.hotelInventory.create({ data: { organizationId: otherOrganizationId, propertyId: otherProperty.id, roomTypeId: otherRoomType.id, date, allotment: 10 } });
  });

  after(async () => {
    await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS "h3d2c_fail_audit" ON "HotelInventoryAdjustment"');
    await prisma.$executeRawUnsafe('DROP FUNCTION IF EXISTS h3d2c_fail_audit()');
    for (const orgId of [organizationId, otherOrganizationId]) {
      if (!orgId) continue;
      await prisma.$executeRaw`DELETE FROM "HotelInventoryIdempotency" WHERE "organizationId" = ${orgId}`;
      await prisma.hotelInventoryAdjustment.deleteMany({ where: { organizationId: orgId } });
      await prisma.hotelInventory.deleteMany({ where: { organizationId: orgId } });
      await prisma.hotelRoomType.deleteMany({ where: { organizationId: orgId } });
      await prisma.hotelProperty.deleteMany({ where: { organizationId: orgId } });
      await prisma.organizationCapability.deleteMany({ where: { organizationId: orgId } });
      await prisma.organizationMember.deleteMany({ where: { organizationId: orgId } });
      await prisma.organization.delete({ where: { id: orgId } });
    }
    if (adminId) await prisma.user.delete({ where: { id: adminId } });
    await prisma.user.deleteMany({ where: { name: { startsWith: "h3d2c-staff-" } } });
    await prisma.$disconnect();
  });

  it("applies one adjustment, writes one audit row, and replays the committed result", async () => {
    const service = new HotelManagementService(prisma);
    const first = await service.adjustInventoryIdempotent(principal(adminId, "ADMIN"), { organizationId }, input("h3d2c-replay-001"));
    const replay = await service.adjustInventoryIdempotent(principal(adminId, "ADMIN"), { organizationId }, input("h3d2c-replay-001"));
    assert.equal((first as { allotment: number }).allotment, 11);
    assert.equal((replay as { allotment: number }).allotment, 11);
    assert.equal((await prisma.hotelInventory.findUnique({ where: { roomTypeId_date: { roomTypeId, date } } }))?.allotment, 11);
    assert.equal(await prisma.hotelInventoryAdjustment.count({ where: { organizationId, roomTypeId, date } }), 1);
    const idempotency = await prisma.$queryRaw<{ count: bigint }[]>`SELECT count(*) FROM "HotelInventoryIdempotency" WHERE "organizationId"=${organizationId} AND "operationScope"=${OPERATION} AND "idempotencyKey"='h3d2c-replay-001'`;
    assert.equal(Number(idempotency[0]?.count), 1);
  });

  it("rejects a fingerprint mismatch without mutating inventory or audit state", async () => {
    const service = new HotelManagementService(prisma);
    await assert.rejects(() => service.adjustInventoryIdempotent(principal(adminId, "ADMIN"), { organizationId }, input("h3d2c-replay-001", 2)), HotelManagementConflictError);
    assert.equal((await prisma.hotelInventory.findUnique({ where: { roomTypeId_date: { roomTypeId, date } } }))?.allotment, 11);
    assert.equal(await prisma.hotelInventoryAdjustment.count({ where: { organizationId, roomTypeId, date } }), 1);
  });

  it("serializes genuinely concurrent identical requests into one mutation", async () => {
    const service = new HotelManagementService(prisma);
    const request = input("h3d2c-concurrent-01");
    const [first, second] = await Promise.all([
      service.adjustInventoryIdempotent(principal(adminId, "ADMIN"), { organizationId }, request),
      service.adjustInventoryIdempotent(principal(adminId, "ADMIN"), { organizationId }, request),
    ]);
    assert.equal((first as { allotment: number }).allotment, 12);
    assert.equal((second as { allotment: number }).allotment, 12);
    assert.equal((await prisma.hotelInventory.findUnique({ where: { roomTypeId_date: { roomTypeId, date } } }))?.allotment, 12);
    assert.equal(await prisma.hotelInventoryAdjustment.count({ where: { organizationId, roomTypeId, date } }), 2);
  });

  it("authorizes before replay and rejects foreign resources", async () => {
    const service = new HotelManagementService(prisma);
    await assert.rejects(() => service.adjustInventoryIdempotent(principal("not-a-member", "STAFF"), { organizationId }, input("h3d2c-replay-001")), HotelManagementAuthorizationError);
    await assert.rejects(() => service.adjustInventoryIdempotent(principal(adminId, "ADMIN"), { organizationId }, { ...input("h3d2c-foreign-01"), propertyId: otherPropertyId, roomTypeId: otherRoomTypeId }), HotelManagementValidationError);
  });

  it("rolls back idempotency, inventory, and audit state after a post-update failure", async () => {
    await prisma.$executeRawUnsafe(`CREATE OR REPLACE FUNCTION h3d2c_fail_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.reason = 'H3D2C_FAIL' THEN RAISE EXCEPTION 'test-owned audit failure'; END IF; RETURN NEW; END; $$`);
    await prisma.$executeRawUnsafe('CREATE TRIGGER "h3d2c_fail_audit" BEFORE INSERT ON "HotelInventoryAdjustment" FOR EACH ROW EXECUTE FUNCTION h3d2c_fail_audit()');
    const service = new HotelManagementService(prisma);
    const request = input("h3d2c-rollback-01", 1, "H3D2C_FAIL");
    await assert.rejects(() => service.adjustInventoryIdempotent(principal(adminId, "ADMIN"), { organizationId }, request));
    assert.equal((await prisma.hotelInventory.findUnique({ where: { roomTypeId_date: { roomTypeId, date } } }))?.allotment, 12);
    assert.equal(await prisma.hotelInventoryAdjustment.count({ where: { organizationId, roomTypeId, date } }), 2);
    const failedRecord = await prisma.$queryRaw<{ count: bigint }[]>`SELECT count(*) FROM "HotelInventoryIdempotency" WHERE "organizationId"=${organizationId} AND "idempotencyKey"='h3d2c-rollback-01'`;
    assert.equal(Number(failedRecord[0]?.count), 0);
    await prisma.$executeRawUnsafe('DROP TRIGGER "h3d2c_fail_audit" ON "HotelInventoryAdjustment"');
    await prisma.$executeRawUnsafe('DROP FUNCTION h3d2c_fail_audit()');
    const retried = await service.adjustInventoryIdempotent(principal(adminId, "ADMIN"), { organizationId }, request);
    assert.equal((retried as { allotment: number }).allotment, 13);
  });

  it("preserves commitment constraints and leaves no idempotency record on rejection", async () => {
    const service = new HotelManagementService(prisma);
    await prisma.hotelInventory.update({ where: { roomTypeId_date: { roomTypeId, date } }, data: { held: 13 } });
    await assert.rejects(() => service.adjustInventoryIdempotent(principal(adminId, "ADMIN"), { organizationId }, input("h3d2c-capacity-01", -1)), HotelManagementValidationError);
    assert.equal((await prisma.hotelInventory.findUnique({ where: { roomTypeId_date: { roomTypeId, date } } }))?.allotment, 13);
    const rejected = await prisma.$queryRaw<{ count: bigint }[]>`SELECT count(*) FROM "HotelInventoryIdempotency" WHERE "organizationId"=${organizationId} AND "idempotencyKey"='h3d2c-capacity-01'`;
    assert.equal(Number(rejected[0]?.count), 0);
  });
});
