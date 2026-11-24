import assert from "node:assert/strict";
import { before, mock, test } from "node:test";
import { Prisma, type PrismaClient } from "@prisma/client";

mock.module("@/lib/db-runtime", { namedExports: { prisma: {} } });
class TestApiError extends Error { constructor(public status: number, message: string) { super(message); } }
mock.module("@/lib/api-guards", { namedExports: { ApiError: TestApiError } });

let HotelManagementService: typeof import("@/lib/hotel/management/hotel-management.service").HotelManagementService;
before(async () => {
  ({ HotelManagementService } = await import("@/lib/hotel/management/hotel-management.service"));
});

const organizationId = "org-test";
const propertyId = "property-test";
const principal = { userId: "manager-test", role: "ADMIN" as const, organizationId };
const missingMaintenance = () => new Prisma.PrismaClientKnownRequestError("missing table", {
  code: "P2021", clientVersion: "unit-test", meta: { table: "public.HotelRoomMaintenanceBlock" },
});

function fakeDb(maintenanceError: Error) {
  return {
    organizationMember: { findFirst: async () => ({ id: "member" }) },
    organizationCapability: { findFirst: async () => ({ id: "capability" }) },
    user: { findFirst: async () => ({ id: principal.userId }) },
    organization: { findFirst: async () => ({ id: organizationId }) },
    hotelProperty: { findFirst: async () => ({ id: propertyId, slug: "damoon-hotel", name: "Damoon", timezone: "Asia/Tehran", currency: "IRR", checkInTime: "14:00", checkOutTime: "12:00", minStayNights: 1, maxStayNights: 31 }) },
    hotelRoomType: { findMany: async () => [] },
    hotelRatePlan: { findMany: async () => [] },
    hotelInventory: { findMany: async () => [] },
    hotelCancellationPolicy: { findMany: async () => [] },
    hotelReservation: { findMany: async () => [] },
    hotelAmenity: { findMany: async () => [] },
    hotelRoomMaintenanceBlock: { findMany: async () => { throw maintenanceError; } },
    $queryRaw: async () => [],
  } as unknown as PrismaClient;
}

test("missing maintenance table preserves independent Hotel Operations reads and reports unknown sellable state", async () => {
  const service = new HotelManagementService(fakeDb(missingMaintenance()));
  const result = await service.getOperations(principal, { organizationId }, propertyId, {
    from: new Date("2027-08-01T00:00:00.000Z"), to: new Date("2027-08-02T00:00:00.000Z"),
  });
  assert.deepEqual(result.roomTypes, []);
  assert.deepEqual(result.ratePlans, []);
  assert.deepEqual(result.amenities, []);
  assert.deepEqual(result.maintenanceStatus, { state: "UNAVAILABLE", code: "HOTEL_MAINTENANCE_SCHEMA_NOT_READY" });
  assert.equal(result.roomBoard, null);
  assert.equal(result.maintenanceBlocks, null);
});

test("unrelated maintenance database failures are not suppressed", async () => {
  const service = new HotelManagementService(fakeDb(new Error("connection timeout")));
  await assert.rejects(() => service.getOperations(principal, { organizationId }, propertyId, {
    from: new Date("2027-08-01T00:00:00.000Z"), to: new Date("2027-08-02T00:00:00.000Z"),
  }), /connection timeout/);
});
