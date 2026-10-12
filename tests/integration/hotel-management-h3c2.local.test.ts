import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { prisma } from "@/lib/db-runtime";
import {
  HotelManagementAuthorizationError,
  HotelManagementService,
  HotelManagementValidationError,
} from "@/lib/hotel/management/hotel-management.service";

const EXPECTED_DB = "bazarbaaz_h3c2_verify";
let organizationId = "";
let propertyId = "";
let roomTypeId = "";
let adminId = "";
let managerId = "";
const principal = (userId: string, role: "ADMIN" | "MANAGER" | "STAFF" | "CUSTOMER" | "GUEST", organizationIdOverride = organizationId) => ({ userId, role, organizationId: organizationIdOverride });

describe("H3-C2 hotel management PostgreSQL acceptance", () => {
  before(async () => {
    const rows = await prisma.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`;
    assert.equal(rows[0]?.db, EXPECTED_DB, `must run against ${EXPECTED_DB}`);
    const org = await prisma.organization.create({ data: { name: "H3-C2 synthetic", slug: `h3c2-${Date.now()}`, type: "SHOP", vertical: "HOTEL" } });
    organizationId = org.id;
    const admin = await prisma.user.create({ data: { name: `h3c2-admin-${Date.now()}`, password: "synthetic", role: "ADMIN" } });
    const manager = await prisma.user.create({ data: { name: `h3c2-manager-${Date.now()}`, password: "synthetic", role: "MANAGER" } });
    adminId = admin.id; managerId = manager.id;
    await prisma.organizationMember.createMany({ data: [
      { userId: adminId, organizationId, organizationSlug: org.slug, role: "ADMIN" },
      { userId: managerId, organizationId, organizationSlug: org.slug, role: "MANAGER" },
    ] });
    await prisma.organizationCapability.create({ data: { organizationId, key: "HOTEL_BOOKING", status: "ACTIVE", enabledAt: new Date() } });
  });

  after(async () => {
    if (!organizationId) return;
    await prisma.hotelReservationRoom.deleteMany({ where: { organizationId } });
    await prisma.hotelReservation.deleteMany({ where: { organizationId } });
    await prisma.hotelBookingHold.deleteMany({ where: { organizationId } });
    await prisma.hotelInventoryAdjustment.deleteMany({ where: { organizationId } });
    await prisma.hotelInventory.deleteMany({ where: { organizationId } });
    await prisma.hotelNightlyRate.deleteMany({ where: { organizationId } });
    await prisma.hotelRatePlan.deleteMany({ where: { organizationId } });
    await prisma.hotelRoomTypeAmenity.deleteMany({ where: { organizationId } });
    await prisma.hotelAmenity.deleteMany({ where: { organizationId } });
    await prisma.hotelRoom.deleteMany({ where: { organizationId } });
    await prisma.hotelRoomType.deleteMany({ where: { organizationId } });
    await prisma.hotelCancellationPolicy.deleteMany({ where: { organizationId } });
    await prisma.hotelProperty.deleteMany({ where: { organizationId } });
    await prisma.organizationCapability.deleteMany({ where: { organizationId } });
    await prisma.organizationMember.deleteMany({ where: { organizationId } });
    await prisma.user.deleteMany({ where: { id: { in: [adminId, managerId] } } });
    await prisma.organization.delete({ where: { id: organizationId } });
  });

  it("authorizes ADMIN and MANAGER but rejects STAFF and cross-tenant scope", async () => {
    const service = new HotelManagementService(prisma);
    const property = await service.createProperty(principal(adminId, "ADMIN"), { organizationId, organizationSlug: "synthetic", slug: "main", name: "Synthetic hotel" });
    propertyId = property.id;
    await assert.rejects(() => service.createRoomType(principal("staff", "STAFF"), { organizationId }, { propertyId, slug: "standard", name: "Standard", maxAdults: 2, maxOccupancy: 2, beds: [{ kind: "queen", count: 1 }] }), HotelManagementAuthorizationError);
    await assert.rejects(() => service.updateProperty(principal(managerId, "MANAGER", "other-tenant"), { organizationId }, propertyId, { name: "spoof" }), HotelManagementAuthorizationError);
  });

  it("preserves active commitments during lifecycle changes and rejects stale inventory reductions", async () => {
    const service = new HotelManagementService(prisma);
    const roomType = await service.createRoomType(principal(managerId, "MANAGER"), { organizationId }, { propertyId, slug: "standard", name: "Standard", maxAdults: 2, maxOccupancy: 2, beds: [{ kind: "queen", count: 1 }] });
    roomTypeId = roomType.id;
    await prisma.hotelInventory.create({ data: { organizationId, propertyId, roomTypeId, date: new Date("2027-04-01T00:00:00Z"), allotment: 1, held: 1 } });
    await assert.rejects(() => service.adjustInventory(principal(adminId, "ADMIN"), { organizationId }, { propertyId, roomTypeId, date: new Date("2027-04-01T00:00:00Z"), allotmentDelta: -1, reason: "synthetic" }), HotelManagementValidationError);
    assert.equal(await prisma.hotelInventoryAdjustment.count({ where: { organizationId } }), 0);
    await prisma.hotelBookingHold.create({ data: { organizationId, propertyId, roomTypeId, reference: "H3C2-HOLD", quantity: 1, checkIn: new Date("2027-04-01T00:00:00Z"), checkOut: new Date("2027-04-02T00:00:00Z"), expiresAt: new Date("2027-04-02T00:00:00Z"), status: "ACTIVE" } });
    await assert.rejects(() => service.archiveRoomType(principal(adminId, "ADMIN"), { organizationId }, roomTypeId), HotelManagementValidationError);
  });

  it("enforces trusted authorization variants and capability state", async () => {
    const service = new HotelManagementService(prisma);
    const superAdmin = { userId: "trusted-super-admin", role: "SUPER_ADMIN", organizationId: "untrusted-client-org" } as never;
    const updated = await service.updateProperty(superAdmin, { organizationId }, propertyId, { description: "super-admin update" });
    assert.equal(updated.description, "super-admin update");
    await assert.rejects(() => service.updateProperty(principal("guest", "GUEST"), { organizationId }, propertyId, { name: "denied" }), HotelManagementAuthorizationError);
    await assert.rejects(() => service.updateProperty(principal("customer", "CUSTOMER"), { organizationId }, propertyId, { name: "denied" }), HotelManagementAuthorizationError);
    await prisma.organizationMember.updateMany({ where: { userId: managerId, organizationId }, data: { isActive: false } });
    await assert.rejects(() => service.updateProperty(principal(managerId, "MANAGER"), { organizationId }, propertyId, { name: "denied" }), HotelManagementAuthorizationError);
    await prisma.organizationMember.updateMany({ where: { userId: managerId, organizationId }, data: { isActive: true } });
    await prisma.organizationCapability.updateMany({ where: { organizationId, key: "HOTEL_BOOKING" }, data: { status: "INACTIVE", disabledAt: new Date(), enabledAt: null } });
    await assert.rejects(() => service.updateProperty(principal(adminId, "ADMIN"), { organizationId }, propertyId, { name: "denied" }), HotelManagementAuthorizationError);
    await prisma.organizationCapability.updateMany({ where: { organizationId, key: "HOTEL_BOOKING" }, data: { status: "ACTIVE", disabledAt: null, enabledAt: new Date() } });
  });

  it("updates and archives properties while preserving the historical row", async () => {
    const service = new HotelManagementService(prisma);
    const changed = await service.updateProperty(principal(adminId, "ADMIN"), { organizationId }, propertyId, { name: "Synthetic hotel updated", localizedContent: { fa: "هتل آزمایشی" }, checkInTime: "14:00" });
    assert.equal(changed.name, "Synthetic hotel updated");
    assert.deepEqual(changed.localizedContent, { fa: "هتل آزمایشی" });
    const archivalProperty = await service.createProperty(principal(adminId, "ADMIN"), { organizationId, organizationSlug: "synthetic", slug: "archive-me", name: "Archive me" });
    const archived = await service.archiveProperty(principal(adminId, "ADMIN"), { organizationId }, archivalProperty.id);
    assert.equal(archived.isActive, false);
    const persisted = await prisma.hotelProperty.findUnique({ where: { id: archivalProperty.id } });
    assert.equal(persisted?.isActive, false);
    assert.ok(persisted?.deletedAt);
  });

  it("manages rooms, duplicate codes, reassignment, and safe deactivation", async () => {
    const service = new HotelManagementService(prisma);
    const secondType = await service.createRoomType(principal(managerId, "MANAGER"), { organizationId }, { propertyId, slug: "superior", name: "Superior", maxAdults: 2, maxOccupancy: 3, beds: [{ kind: "king", count: 1 }], localizedContent: { en: "Superior" } });
    const room = await service.createPhysicalRoom(principal(managerId, "MANAGER"), { organizationId }, { propertyId, roomTypeId, code: "101", isOutOfService: false });
    await assert.rejects(() => service.createPhysicalRoom(principal(managerId, "MANAGER"), { organizationId }, { propertyId, roomTypeId, code: "101" }), /code/i);
    const moved = await service.updatePhysicalRoom(principal(managerId, "MANAGER"), { organizationId }, room.id, { code: "102", roomTypeId: secondType.id, isOutOfService: true });
    assert.equal(moved.code, "102");
    const inactive = await service.archivePhysicalRoom(principal(managerId, "MANAGER"), { organizationId }, room.id);
    assert.equal(inactive.count, 1);
    const historical = await prisma.hotelRoom.findUnique({ where: { id: room.id } });
    assert.equal(historical?.isActive, false);
    assert.ok(historical?.deletedAt);
  });

  it("replaces amenities, persists localized content, and rejects cross-property links", async () => {
    const service = new HotelManagementService(prisma);
    const otherProperty = await service.createProperty(principal(adminId, "ADMIN"), { organizationId, organizationSlug: "synthetic", slug: "other-property", name: "Other property" });
    const a = await service.createAmenity(principal(adminId, "ADMIN"), { organizationId }, { propertyId, key: "wifi", label: "Wi-Fi", localizedContent: { fa: "وای‌فای" } });
    const b = await service.createAmenity(principal(adminId, "ADMIN"), { organizationId }, { propertyId, key: "spa", label: "Spa" });
    const foreign = await service.createAmenity(principal(adminId, "ADMIN"), { organizationId }, { propertyId: otherProperty.id, key: "pool", label: "Pool" });
    await service.setRoomTypeAmenities(principal(adminId, "ADMIN"), { organizationId }, roomTypeId, [a.id, a.id, b.id]);
    assert.equal(await prisma.hotelRoomTypeAmenity.count({ where: { roomTypeId } }), 2);
    await service.setRoomTypeAmenities(principal(adminId, "ADMIN"), { organizationId }, roomTypeId, [b.id]);
    assert.equal(await prisma.hotelRoomTypeAmenity.count({ where: { roomTypeId } }), 1);
    await assert.rejects(() => service.setRoomTypeAmenities(principal(adminId, "ADMIN"), { organizationId }, roomTypeId, [foreign.id]), HotelManagementAuthorizationError);
    const stored = await prisma.hotelAmenity.findUnique({ where: { id: a.id } });
    assert.deepEqual(stored?.localizedContent, { fa: "وای‌فای" });
  });

  it("serializes concurrent adjustments and records exactly one audit row each", async () => {
    const date = new Date("2027-04-02T00:00:00Z");
    await prisma.hotelInventory.create({ data: { organizationId, propertyId, roomTypeId, date, allotment: 2 } });
    const first = new HotelManagementService(prisma).adjustInventory(principal(adminId, "ADMIN"), { organizationId }, { propertyId, roomTypeId, date, allotmentDelta: 1, reason: "concurrent-a" });
    const second = new HotelManagementService(prisma).adjustInventory(principal(managerId, "MANAGER"), { organizationId }, { propertyId, roomTypeId, date, allotmentDelta: 1, reason: "concurrent-b" });
    await Promise.all([first, second]);
    const row = await prisma.hotelInventory.findUnique({ where: { roomTypeId_date: { roomTypeId, date } } });
    assert.equal(row?.allotment, 4);
    assert.equal(await prisma.hotelInventoryAdjustment.count({ where: { organizationId, roomTypeId, date } }), 2);
    await assert.rejects(() => new HotelManagementService(prisma).adjustInventory(principal(adminId, "ADMIN"), { organizationId }, { propertyId, roomTypeId, date, allotmentDelta: -5, reason: "rollback" }), HotelManagementValidationError);
    const afterReject = await prisma.hotelInventory.findUnique({ where: { roomTypeId_date: { roomTypeId, date } } });
    assert.equal(afterReject?.allotment, 4);
    assert.equal(await prisma.hotelInventoryAdjustment.count({ where: { organizationId, roomTypeId, date } }), 2);
  });

  it("validates policy ownership, rate windows, activation, and historical snapshots", async () => {
    const service = new HotelManagementService(prisma);
    const policy = await service.createCancellationPolicy(principal(adminId, "ADMIN"), { organizationId }, { propertyId, key: "flexible", name: "Flexible", freeCancellationCutoffHours: 48, fullCancellationRetention: 0.5, cancellationTiers: [{ cutoffHours: 24, retentionBasisPoints: 10000, penaltyBasis: "FIRST_NIGHT" }] });
    const plan = await service.createRatePlan(principal(adminId, "ADMIN"), { organizationId }, { propertyId, roomTypeId, code: "flex", name: "Flexible", baseNightlyRate: BigInt(100000), cancellationPolicyId: policy.id });
    const rateDate = new Date("2027-05-01T00:00:00Z");
    await service.upsertNightlyRate(principal(adminId, "ADMIN"), { organizationId }, { ratePlanId: plan.id, from: rateDate, to: new Date("2027-05-03T00:00:00Z"), nightlyRate: BigInt(120000) });
    const upserted = await service.upsertNightlyRate(principal(adminId, "ADMIN"), { organizationId }, { ratePlanId: plan.id, from: rateDate, to: new Date("2027-05-03T00:00:00Z"), nightlyRate: BigInt(130000) });
    assert.equal(upserted.nightlyRate, BigInt(130000));
    await assert.rejects(() => service.upsertNightlyRate(principal(adminId, "ADMIN"), { organizationId }, { ratePlanId: plan.id, from: new Date("2027-05-02T00:00:00Z"), to: new Date("2027-05-04T00:00:00Z"), nightlyRate: BigInt(140000) }), HotelManagementValidationError);
    const otherProperty = await service.createProperty(principal(adminId, "ADMIN"), { organizationId, organizationSlug: "synthetic", slug: "policy-other", name: "Policy other" });
    const foreignPolicy = await service.createCancellationPolicy(principal(adminId, "ADMIN"), { organizationId }, { propertyId: otherProperty.id, key: "foreign", name: "Foreign", freeCancellationCutoffHours: 24 });
    await assert.rejects(() => service.updateRatePlan(principal(adminId, "ADMIN"), { organizationId }, plan.id, { cancellationPolicyId: foreignPolicy.id }), HotelManagementAuthorizationError);
    await service.updateCancellationPolicy(principal(adminId, "ADMIN"), { organizationId }, policy.id, { name: "Changed" });
    const stored = await prisma.hotelCancellationPolicy.findUnique({ where: { id: policy.id } });
    assert.equal(stored?.name, "Changed");
    assert.equal(stored?.version, 2);
    assert.equal((await prisma.hotelRatePlan.findUnique({ where: { id: plan.id } }))?.cancellationPolicyId, policy.id);
    await service.updateRatePlan(principal(adminId, "ADMIN"), { organizationId }, plan.id, { isActive: false });
    await assert.rejects(() => service.updateRatePlan(principal(adminId, "ADMIN"), { organizationId }, plan.id, { cancellationPolicyId: foreignPolicy.id }), HotelManagementAuthorizationError);
    const snapshot = { policyKey: "flexible", version: 1, freeCancellationCutoffHours: 48, fullCancellationRetention: 5000 };
    const reservation = await prisma.hotelReservation.create({ data: { organizationId, propertyId, roomTypeId, ratePlanId: plan.id, reference: "H3C2-HISTORICAL", status: "CONFIRMED", checkIn: new Date("2027-06-01T00:00:00Z"), checkOut: new Date("2027-06-03T00:00:00Z"), totalAmount: BigInt(260000), cancellationPolicyKey: "flexible", cancellationPolicySnapshot: snapshot, idempotencyKey: "H3C2-HISTORICAL-IDEMP" } });
    await service.updateCancellationPolicy(principal(adminId, "ADMIN"), { organizationId }, policy.id, { fullCancellationRetention: 1 });
    const historical = await prisma.hotelReservation.findUnique({ where: { id: reservation.id }, select: { totalAmount: true, cancellationPolicySnapshot: true } });
    assert.equal(historical?.totalAmount, BigInt(260000));
    assert.deepEqual(historical?.cancellationPolicySnapshot, snapshot);
  });
});
