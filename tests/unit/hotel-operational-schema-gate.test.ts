import assert from "node:assert/strict";
import test from "node:test";
import type { PrismaClient } from "@prisma/client";
import { HotelOperationalReservationService } from "../../lib/hotel/services/hotel-operational-reservation.service";

const actor = { userId: "admin-1", role: "ADMIN", organizationId: "org-1" } as const;

function missingSchemaError(code = "P2022") {
  const error = new Error("missing schema") as Error & { code?: string };
  error.code = code;
  return error;
}

test("operational reservation configure fails closed before payment-policy writes when schema is absent", async () => {
  let updateCalled = false;
  const db = {
    user: { findFirst: async () => ({ id: actor.userId }) },
    organizationMember: { findFirst: async () => ({ id: "member-1" }) },
    hotelProperty: {
      findFirst: async () => ({ id: "prop-1", organizationId: "org-1", isActive: true, deletedAt: null, organizationSlug: "damoon", slug: "damoon", name: "Damoon", description: null, localizedContent: null, timezone: "Asia/Tehran", currency: "IRR", checkInTime: "14:00", checkOutTime: "12:00", minStayNights: 1, maxStayNights: 30, addressLine1: null, city: null, latitude: null, longitude: null, createdAt: new Date(), updatedAt: new Date() }),
      update: async () => { updateCalled = true; return { id: "prop-1" }; },
    },
    $queryRaw: async () => { throw missingSchemaError(); },
  } as unknown as PrismaClient;
  const service = new HotelOperationalReservationService(db);
  await assert.rejects(() => service.configure(actor, "org-1", "prop-1", {
    mode: "RESERVATION",
    manualConfirmationPolicy: "CASH_ON_ARRIVAL",
    allowedOfflinePaymentMethods: ["CASH"],
    minimumVerifiedDepositAmount: null,
    pendingPaymentMinutes: 15,
  }), (error: unknown) => {
    assert.equal((error as { status?: number }).status, 503);
    assert.match((error as Error).message, /pending Hotel migrations/i);
    return true;
  });
  assert.equal(updateCalled, false, "must not write reservation/payment-policy fields on pre-migration schema");
});

test("operational reservation get fails closed by feature flag without reading pending schema", async () => {
  const prevOp = process.env.HOTEL_OPERATIONAL_RESERVATIONS_ENABLED;
  const prevGuest = process.env.HOTEL_GUEST_PORTAL_ENABLED;
  delete process.env.HOTEL_OPERATIONAL_RESERVATIONS_ENABLED;
  delete process.env.HOTEL_GUEST_PORTAL_ENABLED;
  let queried = false;
  const db = { $queryRaw: async () => { queried = true; return [{ ready: true }]; } } as unknown as PrismaClient;
  try {
    const service = new HotelOperationalReservationService(db);
    await assert.rejects(() => service.get(actor, "org-1", "prop-1"), (error: unknown) => {
      assert.equal((error as { status?: number }).status, 403);
      return true;
    });
    assert.equal(queried, false);
  } finally {
    if (prevOp === undefined) delete process.env.HOTEL_OPERATIONAL_RESERVATIONS_ENABLED; else process.env.HOTEL_OPERATIONAL_RESERVATIONS_ENABLED = prevOp;
    if (prevGuest === undefined) delete process.env.HOTEL_GUEST_PORTAL_ENABLED; else process.env.HOTEL_GUEST_PORTAL_ENABLED = prevGuest;
  }
});

test("manual reception entry fails closed when its independent gate is disabled", async () => {
  const previous = process.env.HOTEL_MANUAL_ROOM_MANAGEMENT_ENABLED;
  delete process.env.HOTEL_MANUAL_ROOM_MANAGEMENT_ENABLED;
  const service = new HotelOperationalReservationService({} as PrismaClient);
  try {
    await assert.rejects(() => service.createManual(actor, "org-1", "prop-1", {}, "manual-key-123"), /manual room management is disabled/i);
  } finally {
    if (previous === undefined) delete process.env.HOTEL_MANUAL_ROOM_MANAGEMENT_ENABLED; else process.env.HOTEL_MANUAL_ROOM_MANAGEMENT_ENABLED = previous;
  }
});

test("manual reception entry rejects customer actors before querying tenant data", async () => {
  const previous = process.env.HOTEL_MANUAL_ROOM_MANAGEMENT_ENABLED;
  process.env.HOTEL_MANUAL_ROOM_MANAGEMENT_ENABLED = "1";
  const service = new HotelOperationalReservationService({} as PrismaClient);
  try {
    await assert.rejects(() => service.createManual({ ...actor, role: "CUSTOMER" }, "org-1", "prop-1", {}, "manual-key-123"), /reception role required/i);
  } finally {
    if (previous === undefined) delete process.env.HOTEL_MANUAL_ROOM_MANAGEMENT_ENABLED; else process.env.HOTEL_MANUAL_ROOM_MANAGEMENT_ENABLED = previous;
  }
});
