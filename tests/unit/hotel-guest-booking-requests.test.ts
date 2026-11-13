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
