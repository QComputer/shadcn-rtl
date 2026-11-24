import assert from "node:assert/strict";
import test from "node:test";
import { DAMOON_DEMO_BOOKING_ACTIVATION, DAMOON_PUBLIC_BOOKING_ACTIVATION, getDamoonDemoBookingCopy, getDamoonReservationPageCopy, isDamoonDemoBookingActivated, isDamoonPublicBookingActivated } from "../booking-activation.js";

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

test("owner-authorized demo booking is restricted to Damoon demo property hosts", () => {
  assert.equal(isDamoonDemoBookingActivated("damoon-hotel.ir"), true);
  assert.equal(isDamoonDemoBookingActivated("www.damoon-hotel.ir"), true);
  assert.equal(isDamoonDemoBookingActivated("bazarbaaz.ir"), false);
  assert.equal(isDamoonDemoBookingActivated("damoon-hotel.ir.evil.test"), false);
  assert.equal(isDamoonDemoBookingActivated("damoon-hotel.ir", { ...DAMOON_DEMO_BOOKING_ACTIVATION, property: "damoon-hotel" }), false);
  assert.equal(isDamoonPublicBookingActivated(), false, "normal public booking gate remains closed");
});

test("demo booking copy is localized and requires both the demo URL mode and an approved Damoon host", () => {
  const expected = {
    fa: ["نمایش رزرو آنلاین هتل دامون", "ساختگی", "شبیه‌سازی"],
    en: ["Damoon Hotel booking demo", "synthetic", "simulated"],
    ar: ["عرض الحجز التجريبي لفندق دامون", "اصطناعية", "محاكاة"],
  };
  for (const [locale, [title, synthetic, simulated]] of Object.entries(expected)) {
    const result = getDamoonReservationPageCopy({ mode: "DEMO_BOOKING", hostname: "damoon-hotel.ir", locale });
    assert.equal(result.isDemo, true);
    assert.equal(result.title, title);
    assert.match(result.description, new RegExp(synthetic));
    assert.match(result.description, new RegExp(simulated));
    assert.ok(result.badge && result.start && result.search);
    assert.match(getDamoonDemoBookingCopy(locale).planning, /.+/);
  }
  for (const input of [
    { mode: "DEMO_BOOKING", hostname: "bazarbaaz.ir", locale: "en" },
    { mode: "DEMO_BOOKING", hostname: "damoon-hotel.ir.evil.test", locale: "en" },
    { mode: "REQUEST_ONLY", hostname: "damoon-hotel.ir", locale: "en" },
  ]) {
    const result = getDamoonReservationPageCopy(input);
    assert.equal(result.isDemo, false);
    assert.equal(result.title, "Request stay coordination");
    assert.match(result.description, /does not check availability/);
    assert.equal("badge" in result, false);
  }
});
