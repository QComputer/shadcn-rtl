import assert from "node:assert/strict";
import { before, mock, test } from "node:test";
import type { PrismaClient } from "@prisma/client";

mock.module("@/lib/db-runtime", { namedExports: { prisma: {} } });

let HotelManagementService: typeof import("@/lib/hotel/management/hotel-management.service").HotelManagementService;
let HotelManagementValidationError: typeof import("@/lib/hotel/management/hotel-management.service").HotelManagementValidationError;

before(async () => {
  ({ HotelManagementService, HotelManagementValidationError } = await import("@/lib/hotel/management/hotel-management.service"));
});

const organizationId = "org-test";
const propertyId = "property-test";
const principal = { userId: "manager-test", role: "ADMIN" as const, organizationId };

test("guest request status filtering stays property scoped and paginates within the selected status", async () => {
  const queries: Array<Record<string, unknown>> = [];
  let rows = Array.from({ length: 50 }, (_, index) => ({ id: `request-${index + 1}` }));
  const db = {
    organizationMember: { findFirst: async () => ({ id: "membership-test" }) },
    organizationCapability: { findFirst: async () => ({ id: "capability-test" }) },
    hotelProperty: { findFirst: async () => ({ id: propertyId }) },
    hotelGuestBookingRequest: {
      findMany: async (query: Record<string, unknown>) => {
        queries.push(query);
        return rows;
      },
    },
  } as unknown as PrismaClient;
  const service = new HotelManagementService(db);

  const firstPage = await service.listGuestBookingRequests(principal, { organizationId }, propertyId, { status: "IN_REVIEW" });
  assert.equal(firstPage.requests.length, 50);
  assert.equal(firstPage.nextCursor, "request-50");

  rows = [{ id: "request-51" }];
  const nextPage = await service.listGuestBookingRequests(principal, { organizationId }, propertyId, {
    status: "IN_REVIEW",
    cursor: firstPage.nextCursor ?? undefined,
  });
  assert.equal(nextPage.requests[0]?.id, "request-51");
  assert.equal(nextPage.nextCursor, null);

  for (const query of queries) {
    assert.deepEqual(query.where, { organizationId, propertyId, status: "IN_REVIEW" });
    assert.equal(query.take, 50);
  }
  assert.equal(queries[1]?.cursor && (queries[1].cursor as { id: string }).id, "request-50");
  assert.equal(queries[1]?.skip, 1);
});

test("guest request list rejects unknown status filters", async () => {
  let queried = false;
  const db = {
    organizationMember: { findFirst: async () => ({ id: "membership-test" }) },
    organizationCapability: { findFirst: async () => ({ id: "capability-test" }) },
    hotelProperty: { findFirst: async () => ({ id: propertyId }) },
    hotelGuestBookingRequest: { findMany: async () => { queried = true; return []; } },
  } as unknown as PrismaClient;

  await assert.rejects(
    () => new HotelManagementService(db).listGuestBookingRequests(principal, { organizationId }, propertyId, { status: "UNKNOWN" }),
    HotelManagementValidationError,
  );
  assert.equal(queried, false);
});

test("guest request search matches name or phone within the property and status filters", async () => {
  let query: Record<string, unknown> | undefined;
  const db = {
    organizationMember: { findFirst: async () => ({ id: "membership-test" }) },
    organizationCapability: { findFirst: async () => ({ id: "capability-test" }) },
    hotelProperty: { findFirst: async () => ({ id: propertyId }) },
    hotelGuestBookingRequest: { findMany: async (value: Record<string, unknown>) => { query = value; return []; } },
  } as unknown as PrismaClient;

  await new HotelManagementService(db).listGuestBookingRequests(principal, { organizationId }, propertyId, {
    status: "RECEIVED",
    search: "  Ali  ",
  });

  assert.deepEqual(query?.where, {
    organizationId,
    propertyId,
    status: "RECEIVED",
    OR: [
      { guestName: { contains: "Ali", mode: "insensitive" } },
      { guestPhone: { contains: "Ali" } },
    ],
  });
});

test("guest request search rejects too-short or oversized terms before querying", async () => {
  let queried = false;
  const db = {
    organizationMember: { findFirst: async () => ({ id: "membership-test" }) },
    organizationCapability: { findFirst: async () => ({ id: "capability-test" }) },
    hotelProperty: { findFirst: async () => ({ id: propertyId }) },
    hotelGuestBookingRequest: { findMany: async () => { queried = true; return []; } },
  } as unknown as PrismaClient;
  const service = new HotelManagementService(db);

  await assert.rejects(() => service.listGuestBookingRequests(principal, { organizationId }, propertyId, { search: "x" }), HotelManagementValidationError);
  await assert.rejects(() => service.listGuestBookingRequests(principal, { organizationId }, propertyId, { search: "x".repeat(81) }), HotelManagementValidationError);
  assert.equal(queried, false);
});


test("needs action search and pagination remain scoped to the property", async () => {
  const queries: Array<Record<string, unknown>> = [];
  const db = {
    organizationMember: { findFirst: async () => ({ id: "member" }) },
    organizationCapability: { findFirst: async () => ({ id: "capability" }) },
    hotelProperty: { findFirst: async () => ({ id: propertyId }) },
    hotelGuestBookingRequest: { findMany: async (query: Record<string, unknown>) => { queries.push(query); return []; } },
  } as unknown as PrismaClient;
  const service = new HotelManagementService(db);
  await service.listGuestBookingRequests(principal, { organizationId }, propertyId, { status: "NEEDS_ACTION", search: "Ali" });
  await service.listGuestBookingRequests(principal, { organizationId }, propertyId, { status: "NEEDS_ACTION", search: "Ali", cursor: "page-1" });
  for (const query of queries) {
    assert.deepEqual(query.where, { organizationId, propertyId, status: { in: ["RECEIVED", "IN_REVIEW"] }, OR: [{ guestName: { contains: "Ali", mode: "insensitive" } }, { guestPhone: { contains: "Ali" } }] });
    assert.equal(query.take, 50);
  }
  assert.deepEqual(queries[1]?.cursor, { id: "page-1" });
  assert.equal(queries[1]?.skip, 1);
});

test("oldest-first sorting keeps needs-action search and cursor scoped", async () => {
  let query: { where: unknown; orderBy: unknown; cursor?: unknown } | undefined;
  const db = {
    organizationMember: { findFirst: async () => ({ id: "member" }) },
    organizationCapability: { findFirst: async () => ({ id: "capability" }) },
    hotelProperty: { findFirst: async () => ({ id: propertyId }) },
    hotelGuestBookingRequest: { findMany: async (value: typeof query) => { query = value; return []; } },
  } as unknown as PrismaClient;
  const service = new HotelManagementService(db);
  await service.listGuestBookingRequests(principal, { organizationId }, propertyId, { status: "NEEDS_ACTION", search: "Ali", cursor: "last", sort: "oldest" });
  assert.deepEqual(query?.orderBy, [{ createdAt: "asc" }, { id: "asc" }]);
  assert.deepEqual(query?.cursor, { id: "last" });
  assert.deepEqual(query?.where, { organizationId, propertyId, status: { in: ["RECEIVED", "IN_REVIEW"] }, OR: [{ guestName: { contains: "Ali", mode: "insensitive" } }, { guestPhone: { contains: "Ali" } }] });
  await assert.rejects(() => service.listGuestBookingRequests(principal, { organizationId }, propertyId, { sort: "invalid" }), HotelManagementValidationError);
});

test("note-only update preserves closed status and checks version and tenant scope", async () => {
  const current = { id: "req", status: "CLOSED", version: 4, managerMessage: "old", roomTypeSlug: null, ratePlanCode: null };
  let update: { where: unknown; data: { status: string; managerMessage: string | null } } | undefined;
  let lookup: { where: unknown } | undefined;
  const tx = {
    hotelGuestBookingRequest: {
      findFirst: async (query: { where: unknown }) => { lookup = query; return current; },
      updateMany: async (query: { where: unknown; data: { status: string; managerMessage: string | null } }) => { update = query; return { count: 1 }; },
      findFirstOrThrow: async () => ({ id: "req", status: "CLOSED", version: 5, managerMessage: "note" }),
    },
    auditLog: { create: async () => ({}) },
  };
  const db = {
    organizationMember: { findFirst: async () => ({ id: "member" }) },
    organizationCapability: { findFirst: async () => ({ id: "capability" }) },
    hotelProperty: { findFirst: async () => ({ id: propertyId }) },
    $transaction: async (callback: (value: typeof tx) => unknown) => callback(tx),
  } as unknown as PrismaClient;
  const service = new HotelManagementService(db);
  const result = await service.updateGuestBookingRequestStatus(principal, { organizationId }, propertyId, "req", { expectedVersion: 4, managerMessage: " note " });
  assert.equal(result.status, "CLOSED");
  assert.deepEqual(lookup?.where, { id: "req", organizationId, propertyId });
  assert.deepEqual(update?.where, { id: "req", organizationId, propertyId, version: 4, status: "CLOSED" });
  assert.equal(update?.data.status, "CLOSED");
  assert.equal(update?.data.managerMessage, "note");
  await assert.rejects(() => service.updateGuestBookingRequestStatus(principal, { organizationId }, propertyId, "req", { expectedVersion: 3, managerMessage: "later" }), /changed/);
});

test("activity is scoped, bounded, ordered and excludes audit payloads", async () => {
  let query: { where: unknown; take: number } | undefined;
  const db = {
    organizationMember: { findFirst: async () => ({ id: "member" }) },
    organizationCapability: { findFirst: async () => ({ id: "capability" }) },
    hotelProperty: { findFirst: async () => ({ id: propertyId, timezone: "Asia/Tehran" }) },
    hotelGuestBookingRequest: { findFirst: async ({ where }: { where: { propertyId: string } }) => where.propertyId === propertyId ? { id: "req" } : null },
    auditLog: { findMany: async (value: { where: unknown; take: number }) => { query = value; return [
      { id: "3", action: "UPDATE", createdAt: new Date("2026-01-03"), previousValue: { status: "CLOSED", hasManagerMessage: true }, newValue: { status: "CLOSED", hasManagerMessage: true, secret: "private" } },
      { id: "2", action: "UPDATE", createdAt: new Date("2026-01-02"), previousValue: { availabilityHint: "UNKNOWN" }, newValue: { availabilityHint: "AVAILABLE" } },
      { id: "1", action: "CHANGE_STATUS", createdAt: new Date("2026-01-01"), previousValue: { status: "RECEIVED" }, newValue: { status: "CLOSED" } },
    ]; } },
  } as unknown as PrismaClient;
  const service = new HotelManagementService(db);
  const result = await service.listGuestBookingRequestActivity(principal, { organizationId }, propertyId, "req");
  assert.deepEqual(result.events.map((event) => event.type), ["status", "note"]);
  assert.equal(JSON.stringify(result).includes("private"), false);
  assert.equal(query?.take, 50);
  assert.deepEqual(query?.where, { organizationId, entityType: "HotelGuestBookingRequest", entityId: "req", action: { in: ["UPDATE", "CHANGE_STATUS"] } });
  await assert.rejects(() => service.listGuestBookingRequestActivity(principal, { organizationId }, "other-property", "req"));
});
