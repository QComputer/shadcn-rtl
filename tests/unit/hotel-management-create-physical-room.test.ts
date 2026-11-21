import assert from "node:assert/strict";
import { test } from "node:test";
import type { PrismaClient } from "@prisma/client";
import {
  HotelManagementService,
  HotelManagementValidationError,
  type HotelManagementPrincipal,
} from "../../lib/hotel/management/hotel-management.service";

const principal: HotelManagementPrincipal = { userId: "manager-1", role: "MANAGER", organizationId: "org-1" };
const scope = { organizationId: "org-1" };
const input = { propertyId: "property-1", roomTypeId: "type-1", code: "  101  ", floor: "1" };

function serviceFixture(options: { availableRooms?: number; maxCommitted?: number } = {}) {
  const calls = { transactions: 0, locks: 0, counts: 0, commitments: 0, creates: 0, transactionOptions: undefined as unknown };
  let queryIndex = 0;
  const tx = {
    $queryRaw: async () => {
      if (queryIndex++ === 0) { calls.locks++; return [{ id: "type-1" }]; }
      if (queryIndex === 2) { calls.counts++; return [{ configuredRooms: 1, availableRooms: options.availableRooms ?? 1 }]; }
      calls.commitments++;
      return [{ maxCommitted: options.maxCommitted ?? 0 }];
    },
    hotelRoom: { create: async ({ data }: { data: Record<string, unknown> }) => { calls.creates++; return { id: "room-1", ...data }; } },
  };
  const db = {
    hotelRoomType: { findFirst: async () => ({ id: "type-1" }) },
    $transaction: async (work: (client: typeof tx) => Promise<unknown>, transactionOptions: unknown) => {
      calls.transactions++;
      calls.transactionOptions = transactionOptions;
      return work(tx);
    },
  } as unknown as PrismaClient;
  const service = new HotelManagementService(db);
  (service as unknown as { authorize: () => Promise<void> }).authorize = async () => undefined;
  return { service, calls };
}

test("createPhysicalRoom keeps its public behavior and runs room creation in one transaction", async () => {
  const { service, calls } = serviceFixture();

  const room = await service.createPhysicalRoom(principal, scope, input);

  assert.equal(room.code, "101");
  assert.equal(room.organizationId, "org-1");
  assert.equal(room.propertyId, "property-1");
  assert.equal(room.roomTypeId, "type-1");
  assert.equal(room.isOutOfService, false);
  assert.equal(calls.transactions, 1);
  assert.equal(calls.locks, 1);
  assert.equal(calls.counts, 1);
  assert.equal(calls.commitments, 1);
  assert.equal(calls.creates, 1);
  assert.deepEqual(calls.transactionOptions, { maxWait: 5000, timeout: 10000 });
});

test("createPhysicalRoom rejects capacity below existing bookings and holds", async () => {
  const { service, calls } = serviceFixture({ availableRooms: 0, maxCommitted: 1 });

  await assert.rejects(service.createPhysicalRoom(principal, scope, input), HotelManagementValidationError);

  assert.equal(calls.transactions, 1);
  assert.equal(calls.creates, 1);
  assert.equal(calls.commitments, 1);
});
