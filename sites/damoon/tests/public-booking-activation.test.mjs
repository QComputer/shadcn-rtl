import assert from "node:assert/strict";
import test from "node:test";
import { DAMOON_PUBLIC_BOOKING_ACTIVATION, isDamoonPublicBookingActivated } from "../booking-activation.js";

test("public Damoon booking activation is off by default and requires validated owner approval", () => {
  assert.equal(isDamoonPublicBookingActivated(), false);
  assert.equal(DAMOON_PUBLIC_BOOKING_ACTIVATION.enabled, false);
  assert.equal(isDamoonPublicBookingActivated({ enabled: true, property: "other-hotel", ownerApproval: { approvedBy: "property_owner", reference: "DAMOON-BOOKING-2026-11-22", approvedAt: "2026-11-22T12:00:00.000Z" } }), false);
  assert.equal(isDamoonPublicBookingActivated({ enabled: true, property: "damoon-hotel", ownerApproval: null }), false);
  assert.equal(isDamoonPublicBookingActivated({ enabled: true, property: "damoon-hotel", ownerApproval: { approvedBy: "guest", reference: "DAMOON-BOOKING-2026-11-22", approvedAt: "2026-11-22T12:00:00.000Z" } }), false);
  assert.equal(isDamoonPublicBookingActivated({ enabled: true, property: "damoon-hotel", ownerApproval: { approvedBy: "property_owner", reference: "missing-prefix", approvedAt: "2026-11-22T12:00:00.000Z" } }), false);
  assert.equal(isDamoonPublicBookingActivated({ enabled: true, property: "damoon-hotel", ownerApproval: { approvedBy: "property_owner", reference: "DAMOON-BOOKING-2026-11-22", approvedAt: "not-a-date" } }), false);
  assert.equal(isDamoonPublicBookingActivated({ enabled: true, property: "damoon-hotel", ownerApproval: { approvedBy: "property_owner", reference: "DAMOON-BOOKING-2026-11-22", approvedAt: "2026-11-22T12:00:00.000Z" } }), true);
});
