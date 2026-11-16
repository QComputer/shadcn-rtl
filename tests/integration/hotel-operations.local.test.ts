import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { test } from "node:test";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  HotelManagementAuthorizationError,
  HotelManagementConflictError,
  HotelManagementService,
  HotelManagementValidationError,
} from "../../lib/hotel/management/hotel-management.service";

const enabled = process.env.HOTEL_OPERATIONS_PG_ACCEPTANCE === "1";

function guardedConnection() {
  let url: URL;
  try { url = new URL(process.env.DATABASE_URL ?? ""); }
  catch { throw new Error("invalid isolated local database configuration"); }
  assert.ok(["postgres:", "postgresql:"].includes(url.protocol), "requires PostgreSQL");
  assert.equal(url.hostname, "127.0.0.1", "refuses non-loopback database");
  assert.equal(url.port, "55439", "refuses other local database ports");
  assert.equal(url.pathname, "/retail_hero_test", "refuses other databases");
  assert.equal(decodeURIComponent(url.username), "hero_test", "refuses other database users");
  assert.equal(url.search, "", "refuses inherited connection options");
  assert.equal(url.hash, "", "refuses inherited connection fragments");
  return url;
}

const principal = (userId: string, role: "ADMIN" | "MANAGER" | "STAFF", organizationId: string) => ({ userId, role, organizationId });
const date = (value: string) => new Date(`${value}T00:00:00.000Z`);
const days = (from: string, to: string) => ({ from: date(from), to: date(to) });

test("Hotel operations read model and inventory initialization are tenant-scoped and idempotent on disposable PostgreSQL", {
  skip: !enabled,
  concurrency: false,
}, async () => {
  const connection = guardedConnection();
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: connection.toString(), max: 8 }), log: [] });
  const suffix = randomUUID().replaceAll("-", "").slice(0, 14);
  const organizationIds: string[] = [];
  const userIds: string[] = [];
  let service: HotelManagementService;

  try {
    // The guarded loopback port is Docker's published port; PostgreSQL sees its
    // container address and internal port, not the host-side transport address.
    const identity = await db.$queryRaw<Array<{ database: string; role: string; port: number }>>`
      SELECT current_database()::text AS database, current_user::text AS role, inet_server_port() AS port`;
    assert.deepEqual(identity, [{ database: "retail_hero_test", role: "hero_test", port: 5432 }]);
    service = new HotelManagementService(db);

    const createOrganization = async (label: string, input: { active?: boolean; capability?: "ENABLED" | "NOT_ENABLED" | "MISSING" } = {}) => {
      const slug = `hotel-ops-${label}-${suffix}`;
      const organization = await db.organization.create({ data: {
        type: "SHOP", vertical: "HOTEL", name: `Hotel operations ${label} ${suffix}`, slug,
        ...(input.active === false ? { isActive: false } : {}),
      } });
      organizationIds.push(organization.id);
      if (input.capability === "ENABLED" || input.capability === "NOT_ENABLED") {
        await db.organizationCapability.create({ data: {
          organizationId: organization.id, key: "HOTEL_BOOKING", status: "ACTIVE",
          enabledAt: input.capability === "ENABLED" ? new Date() : null,
        } });
      }
      return organization;
    };
    const createUser = async (label: string, role: "ADMIN" | "MANAGER" | "STAFF", organization: { id: string; slug: string }, membershipRole: "ADMIN" | "MANAGER" | "STAFF" = role) => {
      const user = await db.user.create({ data: { name: `hotel-ops-${label}-${suffix}`, password: "synthetic-only", role } });
      userIds.push(user.id);
      await db.organizationMember.create({ data: { userId: user.id, organizationId: organization.id, organizationSlug: organization.slug, role: membershipRole } });
      return user;
    };

    const organizationA = await createOrganization("a", { capability: "ENABLED" });
    const organizationB = await createOrganization("b", { capability: "ENABLED" });
    const inactiveOrganization = await createOrganization("inactive", { active: false, capability: "ENABLED" });
    const unenabledOrganization = await createOrganization("unenabled", { capability: "NOT_ENABLED" });
    const noCapabilityOrganization = await createOrganization("no-capability", { capability: "MISSING" });
    const adminA = await createUser("admin-a", "ADMIN", organizationA);
    const managerA = await createUser("manager-a", "MANAGER", organizationA);
    const staffA = await createUser("staff-a", "STAFF", organizationA);
    const adminB = await createUser("admin-b", "ADMIN", organizationB);
    const inactiveAdmin = await createUser("inactive-admin", "ADMIN", organizationA);
    const inactiveOrgAdmin = await createUser("inactive-org-admin", "ADMIN", inactiveOrganization);
    const unenabledAdmin = await createUser("unenabled-admin", "ADMIN", unenabledOrganization);
    const noCapabilityAdmin = await createUser("no-capability-admin", "ADMIN", noCapabilityOrganization);
    await db.user.update({ where: { id: inactiveAdmin.id }, data: { isActive: false } });

    const property = await service.createProperty(principal(adminA.id, "ADMIN", organizationA.id), {
      organizationId: organizationA.id, organizationSlug: organizationA.slug,
      slug: `main-${suffix}`, name: "Synthetic operations hotel", timezone: "Asia/Tehran",
    });
    const foreignProperty = await service.createProperty(principal(adminB.id, "ADMIN", organizationB.id), {
      organizationId: organizationB.id, organizationSlug: organizationB.slug,
      slug: `foreign-${suffix}`, name: "Foreign synthetic hotel",
    });
    const roomType = await service.createRoomType(principal(adminA.id, "ADMIN", organizationA.id), { organizationId: organizationA.id }, {
      propertyId: property.id, slug: `standard-${suffix}`, name: "Standard room", maxAdults: 2, maxChildren: 1, maxOccupancy: 3,
      beds: [{ kind: "queen", count: 1 }],
    });
    const physicalRoom = await service.createPhysicalRoom(principal(managerA.id, "MANAGER", organizationA.id), { organizationId: organizationA.id }, {
      propertyId: property.id, roomTypeId: roomType.id, code: `201-${suffix}`, floor: "2",
    });
    const ratePlan = await service.createRatePlan(principal(managerA.id, "MANAGER", organizationA.id), { organizationId: organizationA.id }, {
      propertyId: property.id, roomTypeId: roomType.id, code: `flex-${suffix}`, name: "Flexible",
      baseNightlyRate: BigInt(125000), minNights: 1, isRefundable: true,
    });
    await service.upsertNightlyRate(principal(managerA.id, "MANAGER", organizationA.id), { organizationId: organizationA.id }, {
      ratePlanId: ratePlan.id, from: date("2027-08-01"), to: date("2027-08-15"), nightlyRate: BigInt(130000),
    });

    const initialize = (range: { from: Date; to: Date }, allotment: number, key: string, actor = adminA) => {
      const input = { propertyId: property.id, roomTypeId: roomType.id, ...range, allotment, reason: "Synthetic initial inventory" };
      const requestFingerprint = createHash("sha256").update(JSON.stringify({ organizationId: organizationA.id, ...input, actorUserId: actor.id, operation: "HOTEL_INVENTORY_INITIALIZE" })).digest("hex");
      return service.initializeInventoryIdempotent(principal(actor.id, actor === managerA ? "MANAGER" : "ADMIN", organizationA.id), { organizationId: organizationA.id }, {
        ...input, idempotencyKey: key, requestFingerprint,
      });
    };

    const initialRange = days("2027-08-01", "2027-08-04");
    const initialKey = `hotel-ops-init-${suffix}`;
    const initial = await initialize(initialRange, 5, initialKey);
    assert.equal(initial.createdCount, 3);
    assert.equal(initial.skippedExistingCount, 0);
    assert.deepEqual(await initialize(initialRange, 5, initialKey), initial, "same key and payload replays the original result");
    await assert.rejects(() => initialize(initialRange, 9, initialKey), HotelManagementConflictError, "same key with a changed payload conflicts");
    assert.equal(await db.hotelInventoryAdjustment.count({ where: { organizationId: organizationA.id, roomTypeId: roomType.id } }), 3, "replay/conflict must not duplicate audit rows");

    const committedDate = date("2027-08-02");
    await db.hotelInventory.update({ where: { roomTypeId_date: { roomTypeId: roomType.id, date: committedDate } }, data: {
      booked: 1, held: 2, outOfService: 1, closedToArrival: true, closedToDeparture: true,
    } });
    const overlapping = await initialize(days("2027-08-02", "2027-08-05"), 99, `hotel-ops-overlap-${suffix}`);
    assert.equal(overlapping.createdCount, 1);
    assert.equal(overlapping.skippedExistingCount, 2);
    const preserved = await db.hotelInventory.findUniqueOrThrow({ where: { roomTypeId_date: { roomTypeId: roomType.id, date: committedDate } } });
    assert.deepEqual({ allotment: preserved.allotment, booked: preserved.booked, held: preserved.held, outOfService: preserved.outOfService, closedToArrival: preserved.closedToArrival, closedToDeparture: preserved.closedToDeparture }, {
      allotment: 5, booked: 1, held: 2, outOfService: 1, closedToArrival: true, closedToDeparture: true,
    }, "initialization leaves existing commitments and flags unchanged");

    const concurrent = await Promise.all([
      initialize(days("2027-08-10", "2027-08-13"), 4, `hotel-ops-concurrent-a-${suffix}`),
      initialize(days("2027-08-11", "2027-08-14"), 8, `hotel-ops-concurrent-b-${suffix}`),
    ]);
    assert.equal(concurrent[0].createdCount + concurrent[1].createdCount, 4, "overlapping concurrent requests create each missing date once");
    assert.equal(concurrent[0].skippedExistingCount + concurrent[1].skippedExistingCount, 2);
    const concurrentRows = await db.hotelInventory.findMany({ where: { organizationId: organizationA.id, roomTypeId: roomType.id, date: { gte: date("2027-08-10"), lt: date("2027-08-14") } } });
    assert.equal(concurrentRows.length, 4);
    assert.equal(await db.hotelInventoryAdjustment.count({ where: { organizationId: organizationA.id, roomTypeId: roomType.id, date: { gte: date("2027-08-10"), lt: date("2027-08-14") } } }), 4, "only created rows receive initialization audit entries");

    const operations = await service.getOperations(principal(managerA.id, "MANAGER", organizationA.id), { organizationId: organizationA.id }, property.id, days("2027-08-01", "2027-08-15"));
    assert.deepEqual(Object.keys(operations).sort(), ["inventory", "property", "range", "ratePlans", "roomTypes"]);
    assert.deepEqual(operations.range, { from: "2027-08-01", to: "2027-08-15", nights: 14 });
    assert.equal(operations.property.timezone, "Asia/Tehran");
    const resultRoomType = operations.roomTypes.find((row) => row.id === roomType.id);
    assert.ok(resultRoomType?.rooms.some((room) => room.id === physicalRoom.id && room.code === physicalRoom.code));
    const resultPlan = operations.ratePlans.find((row) => row.id === ratePlan.id);
    assert.equal(resultPlan?.baseNightlyRate, "125000");
    assert.equal(resultPlan?.nightlyRates[0]?.nightlyRate, "130000");
    const committedNight = operations.inventory.find((night) => night.date === "2027-08-02");
    assert.equal(committedNight?.available, 1, "closed-to-arrival/departure stay-through flags do not erase remaining capacity");
    assert.equal(committedNight?.closedToArrival, true);
    assert.equal(committedNight?.closedToDeparture, true);
    const serialized = JSON.stringify(operations);
    assert.doesNotMatch(serialized, /email|phone|guest|reservation|payment|password|token/i, "read model excludes PII and reservation/payment details");

    await assert.rejects(() => service.getOperations(principal(managerA.id, "MANAGER", organizationA.id), { organizationId: organizationB.id }, foreignProperty.id, days("2027-08-01", "2027-08-02")), HotelManagementAuthorizationError, "cross-tenant scope is denied");
    await assert.rejects(() => service.getOperations(principal(managerA.id, "MANAGER", organizationA.id), { organizationId: organizationA.id }, foreignProperty.id, days("2027-08-01", "2027-08-02")), HotelManagementAuthorizationError, "foreign property in an owned organization scope is denied");
    await assert.rejects(() => service.getOperations(principal(staffA.id, "STAFF", organizationA.id), { organizationId: organizationA.id }, property.id, days("2027-08-01", "2027-08-02")), HotelManagementAuthorizationError, "staff role is not an operations manager");
    await assert.rejects(() => service.getOperations(principal(inactiveAdmin.id, "ADMIN", organizationA.id), { organizationId: organizationA.id }, property.id, days("2027-08-01", "2027-08-02")), HotelManagementAuthorizationError, "inactive user is denied");
    await assert.rejects(() => service.getOperations(principal(inactiveOrgAdmin.id, "ADMIN", inactiveOrganization.id), { organizationId: inactiveOrganization.id }, property.id, days("2027-08-01", "2027-08-02")), HotelManagementAuthorizationError, "inactive organization is denied");
    await assert.rejects(() => service.getOperations(principal(unenabledAdmin.id, "ADMIN", unenabledOrganization.id), { organizationId: unenabledOrganization.id }, property.id, days("2027-08-01", "2027-08-02")), HotelManagementAuthorizationError, "capability without enabledAt is denied");
    await assert.rejects(() => service.getOperations(principal(noCapabilityAdmin.id, "ADMIN", noCapabilityOrganization.id), { organizationId: noCapabilityOrganization.id }, property.id, days("2027-08-01", "2027-08-02")), HotelManagementAuthorizationError, "missing capability is denied");
    await assert.rejects(() => service.getOperations(principal(managerA.id, "MANAGER", organizationA.id), { organizationId: organizationA.id }, property.id, days("2027-08-01", "2027-09-02")), HotelManagementValidationError, "read range is capped at 31 nights");
    await assert.rejects(() => service.getOperations(principal(managerA.id, "MANAGER", organizationA.id), { organizationId: organizationA.id }, property.id, { from: new Date(Number.NaN), to: date("2027-03-02") }), HotelManagementValidationError, "invalid calendar date is rejected");
  } finally {
    try {
      if (organizationIds.length) {
        await db.hotelInventoryIdempotency.deleteMany({ where: { organizationId: { in: organizationIds }, operationScope: "HOTEL_INVENTORY_INITIALIZE" } });
        await db.hotelInventoryAdjustment.deleteMany({ where: { organizationId: { in: organizationIds } } });
        await db.hotelInventory.deleteMany({ where: { organizationId: { in: organizationIds } } });
        await db.hotelNightlyRate.deleteMany({ where: { organizationId: { in: organizationIds } } });
        await db.hotelRatePlan.deleteMany({ where: { organizationId: { in: organizationIds } } });
        await db.hotelRoom.deleteMany({ where: { organizationId: { in: organizationIds } } });
        await db.hotelRoomType.deleteMany({ where: { organizationId: { in: organizationIds } } });
        await db.hotelProperty.deleteMany({ where: { organizationId: { in: organizationIds } } });
        await db.organizationCapability.deleteMany({ where: { organizationId: { in: organizationIds } } });
        await db.organizationMember.deleteMany({ where: { organizationId: { in: organizationIds } } });
        await db.user.deleteMany({ where: { id: { in: userIds } } });
        await db.organization.deleteMany({ where: { id: { in: organizationIds } } });
      }
    } finally {
      await db.$disconnect();
    }
  }
});
