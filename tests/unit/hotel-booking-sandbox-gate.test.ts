import assert from "node:assert/strict";
import test from "node:test";
import { hotelBookingSandboxEnabled, LocalHotelPaymentAdapter, hotelSandboxCommand } from "../../lib/hotel/sandbox/booking-sandbox.service";
const local = { NODE_ENV: "test", HOTEL_BOOKING_SANDBOX_ENABLED: "1", DATABASE_URL: "postgresql://hero_test:fixture@127.0.0.1:55439/retail_hero_test" };
test("Hotel sandbox cannot be enabled in Production or against any other database tuple", () => {
  assert.equal(hotelBookingSandboxEnabled(local), true);
  assert.equal(hotelBookingSandboxEnabled({ ...local, NODE_ENV: "production" }), false);
  assert.equal(hotelBookingSandboxEnabled({ ...local, HOTEL_BOOKING_SANDBOX_ENABLED: "0" }), false);
  for (const DATABASE_URL of [local.DATABASE_URL.replace("127.0.0.1", "remote.invalid"), local.DATABASE_URL.replace("55439", "5432"), local.DATABASE_URL.replace("retail_hero_test", "production"), local.DATABASE_URL.replace("hero_test", "admin"), `${local.DATABASE_URL}?options=x`, `${local.DATABASE_URL}#x`, local.DATABASE_URL.replace("postgresql:", "https:")]) assert.equal(hotelBookingSandboxEnabled({ ...local, DATABASE_URL }), false);
});
test("sandbox outcomes carry no financial transaction or provider-verification claim", () => {
  for (const outcome of ["SUCCESS", "FAILED", "EXPIRED"] as const) assert.deepEqual(new LocalHotelPaymentAdapter().settle(outcome), { status: outcome, simulated: true, financialTransaction: false });
  assert.equal(hotelSandboxCommand.safeParse({ action: "pay", reservationId: "r", outcome: "SUCCESS", verified: true, totalAmount: 1, organizationId: "other" }).success, false);
});
