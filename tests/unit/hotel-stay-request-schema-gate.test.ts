import assert from "node:assert/strict";
import test from "node:test";
import type { PrismaClient } from "@prisma/client";
import { HotelStayRequestService } from "../../lib/hotel/services/hotel-stay-request.service";

const actor = { userId: "user-1", role: "ADMIN", organizationId: "org-1" } as const;

function missingSchemaError(code = "P2021") {
  const error = new Error("missing schema") as Error & { code?: string };
  error.code = code;
  return error;
}

test("stay-request configure fails closed before writing when pending migration schema is absent", async () => {
  let updateCalled = false;
  const db = {
    user: { findFirst: async () => ({ id: actor.userId }) },
    organizationMember: { findFirst: async () => ({ id: "membership-1" }) },
    hotelProperty: {
      findFirst: async () => ({ id: "prop-1", organizationId: "org-1", isActive: true, deletedAt: null, organizationSlug: "damoon", slug: "damoon", name: "Damoon", description: null, localizedContent: null, timezone: "Asia/Tehran", currency: "IRR", checkInTime: "14:00", checkOutTime: "12:00", minStayNights: 1, maxStayNights: 30, addressLine1: null, city: null, latitude: null, longitude: null, createdAt: new Date(), updatedAt: new Date() }),
      update: async () => { updateCalled = true; return { id: "prop-1" }; },
    },
    $queryRaw: async () => { throw missingSchemaError(); },
  } as unknown as PrismaClient;
  const service = new HotelStayRequestService(db);
  await assert.rejects(() => service.configure(actor, "org-1", "prop-1", { mode: "REQUEST_ONLY" }), (error: unknown) => {
    assert.equal((error as { status?: number }).status, 503);
    assert.match((error as Error).message, /pending Hotel migrations/i);
    return true;
  });
  assert.equal(updateCalled, false, "must not attempt operationalMode update on pre-migration schema");
});

test("stay-request guest read fails closed when guest portal flag is off without querying pending schema", async () => {
  const previous = process.env.HOTEL_GUEST_PORTAL_ENABLED;
  delete process.env.HOTEL_GUEST_PORTAL_ENABLED;
  let queried = false;
  const db = {
    user: { findFirst: async () => ({ id: actor.userId }) },
    organizationMember: { findFirst: async () => ({ id: "membership-1" }) },
    hotelProperty: { findFirst: async () => ({ id: "prop-1" }) },
    $queryRaw: async () => { queried = true; return [{ ready: true }]; },
  } as unknown as PrismaClient;
  try {
    const service = new HotelStayRequestService(db);
    await assert.rejects(() => service.get(actor, "org-1", "prop-1"), (error: unknown) => {
      assert.equal((error as { status?: number }).status, 403);
      return true;
    });
    assert.equal(queried, false);
  } finally {
    if (previous === undefined) delete process.env.HOTEL_GUEST_PORTAL_ENABLED; else process.env.HOTEL_GUEST_PORTAL_ENABLED = previous;
  }
});
