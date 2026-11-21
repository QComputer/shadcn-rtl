import assert from "node:assert/strict";
import { test } from "node:test";
import type { PrismaClient } from "@prisma/client";
import {
  DraftAccommodationService,
} from "../../lib/hotel/management/draft-accommodation.service";
import type { HotelManagementPrincipal } from "../../lib/hotel/management/hotel-management.service";

const principal: HotelManagementPrincipal = { userId: "manager-1", role: "MANAGER", organizationId: "org-1" };
const scope = { organizationId: "org-1", propertyId: "property-1" };
const request = { draftId: "draft-1", expectedVersion: 4, roomTypeId: "type-1", physicalRoomCode: "A-101", confirmPhysicalRoomCode: true };

function fixture(options: { archivedAt?: Date | null; promotedRoomId?: string | null; version?: number; incomplete?: boolean; failAudit?: boolean; inactiveRoomType?: boolean } = {}) {
  const state = {
    draft: {
      ...scope,
      id: "draft-1",
      temporaryCode: options.incomplete ? " " : "TMP-1",
      category: "Provisional room",
      version: options.version ?? 4,
      archivedAt: options.archivedAt ?? null,
      promotedRoomId: options.promotedRoomId ?? null,
      promotedAt: null as Date | null,
    },
    rooms: [] as Array<Record<string, unknown>>,
    audits: [] as Array<Record<string, unknown>>,
  };
  let queue: Promise<unknown> = Promise.resolve();
  const db = {
    hotelProperty: { findFirst: async () => ({ id: scope.propertyId }) },
    $transaction: async (work: (tx: Record<string, any>) => Promise<unknown>) => {
      let release!: () => void;
      const previous = queue;
      queue = new Promise<void>((resolve) => { release = resolve; });
      await previous;
      const workingDraft = { ...state.draft };
      const workingRooms = [...state.rooms];
      const workingAudits = [...state.audits];
      let query = 0;
      const tx = {
        $queryRaw: async () => {
          query++;
          if (query === 1) return workingDraft.id ? [{ ...workingDraft }] : [];
          if (query === 2) return options.inactiveRoomType ? [] : [{ id: request.roomTypeId }];
          if (query === 3) return [{ configuredRooms: workingRooms.length, availableRooms: workingRooms.filter((room) => room.isOutOfService !== true).length }];
          return [{ maxCommitted: 0 }];
        },
        hotelRoom: { create: async ({ data }: { data: Record<string, unknown> }) => {
          if (workingRooms.some((room) => room.code === data.code)) throw new Error("duplicate room code");
          const room = { id: `room-${workingRooms.length + 1}`, ...data };
          workingRooms.push(room);
          return room;
        } },
        hotelDraftAccommodation: {
          updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Record<string, any> }) => {
            if (workingDraft.id !== where.id || workingDraft.version !== where.version || workingDraft.archivedAt !== null || workingDraft.promotedRoomId !== null) return { count: 0 };
            Object.assign(workingDraft, { promotedRoomId: data.promotedRoomId, promotedAt: data.promotedAt, version: workingDraft.version + 1 });
            return { count: 1 };
          },
          findFirst: async () => ({ ...workingDraft }),
        },
        auditLog: { create: async ({ data }: { data: Record<string, unknown> }) => {
          if (options.failAudit) throw new Error("audit unavailable");
          workingAudits.push(data);
          return data;
        } },
      };
      try {
        const result = await work(tx);
        Object.assign(state.draft, workingDraft);
        state.rooms.splice(0, state.rooms.length, ...workingRooms);
        state.audits.splice(0, state.audits.length, ...workingAudits);
        return result;
      } finally { release(); }
    },
  } as unknown as PrismaClient;
  const service = new DraftAccommodationService(db);
  (service as unknown as { authorizeOperations: () => Promise<void> }).authorizeOperations = async () => undefined;
  return { service, state };
}

test("promotion creates an out-of-service physical room and atomically marks and audits the draft", async () => {
  const { service, state } = fixture();

  const result = await service.promote(principal, scope, request);

  assert.equal(result.room.code, "A-101");
  assert.equal(result.room.isOutOfService, true);
  assert.equal(result.room.floor, undefined);
  assert.equal(result.room.description, undefined);
  assert.equal(result.draft.promotedRoomId, result.room.id);
  assert.ok(result.draft.promotedAt instanceof Date);
  assert.equal(result.draft.version, 5);
  assert.equal(state.rooms.length, 1);
  assert.equal(state.audits.length, 1);
  assert.equal(state.audits[0].organizationId, scope.organizationId);
  assert.equal(state.audits[0].userId, principal.userId);
});

test("promotion requires explicit room-code confirmation and rejects invalid draft state", async () => {
  const { service } = fixture();
  await assert.rejects(service.promote(principal, scope, { ...request, confirmPhysicalRoomCode: false }));
  await assert.rejects(service.promote(principal, scope, { ...request, physicalRoomCode: " " }));
  await assert.rejects(fixture({ inactiveRoomType: true }).service.promote(principal, scope, request));
  await assert.rejects(fixture({ archivedAt: new Date() }).service.promote(principal, scope, request));
  await assert.rejects(fixture({ promotedRoomId: "room-existing" }).service.promote(principal, scope, request));
  await assert.rejects(fixture({ version: 3 }).service.promote(principal, scope, request));
  await assert.rejects(fixture({ incomplete: true }).service.promote(principal, scope, request));
});

test("concurrent promotion is one-use and an audit failure rolls back room and marker", async () => {
  const concurrent = fixture();
  const outcomes = await Promise.allSettled([
    concurrent.service.promote(principal, scope, request),
    concurrent.service.promote(principal, scope, request),
  ]);
  assert.equal(outcomes.filter((outcome) => outcome.status === "fulfilled").length, 1);
  assert.equal(concurrent.state.rooms.length, 1);
  assert.equal(concurrent.state.audits.length, 1);

  const failing = fixture({ failAudit: true });
  await assert.rejects(failing.service.promote(principal, scope, request));
  assert.equal(failing.state.rooms.length, 0);
  assert.equal(failing.state.draft.promotedRoomId, null);
  assert.equal(failing.state.audits.length, 0);
});
