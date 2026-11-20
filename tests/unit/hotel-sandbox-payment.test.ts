import assert from "node:assert/strict";
import { after, test } from "node:test";
import { hotelSandboxPaymentsEnabled, issueHotelSandboxPaymentTicket, verifyHotelSandboxPaymentTicket } from "@/lib/hotel/services/hotel-sandbox-payment";

const priorNodeEnv = process.env.NODE_ENV;
const priorGate = process.env.HOTEL_PAYMENT_SIMULATOR_ENABLED;
const priorSecret = process.env.HOTEL_SANDBOX_PAYMENT_SECRET;
after(() => {
  if (priorNodeEnv === undefined) Reflect.deleteProperty(process.env, "NODE_ENV"); else Reflect.set(process.env, "NODE_ENV", priorNodeEnv);
  if (priorGate === undefined) delete process.env.HOTEL_PAYMENT_SIMULATOR_ENABLED; else process.env.HOTEL_PAYMENT_SIMULATOR_ENABLED = priorGate;
  if (priorSecret === undefined) delete process.env.HOTEL_SANDBOX_PAYMENT_SECRET; else process.env.HOTEL_SANDBOX_PAYMENT_SECRET = priorSecret;
});

test("sandbox payment tickets are signed, expiring, and forbidden in Production", () => {
  Reflect.set(process.env, "NODE_ENV", "test");
  process.env.HOTEL_PAYMENT_SIMULATOR_ENABLED = "1";
  process.env.HOTEL_SANDBOX_PAYMENT_SECRET = "test-only-sandbox-secret-that-is-long-enough";
  assert.equal(hotelSandboxPaymentsEnabled(), true);
  const ticket = issueHotelSandboxPaymentTicket({ paymentId: "pay-public", reservationId: "reservation-1", organizationId: "tenant-1", expiresAt: Date.now() + 60_000 });
  assert.deepEqual(verifyHotelSandboxPaymentTicket(ticket), { paymentId: "pay-public", reservationId: "reservation-1", organizationId: "tenant-1", expiresAt: JSON.parse(Buffer.from(ticket.split(".")[0], "base64url").toString("utf8")).expiresAt });
  assert.equal(verifyHotelSandboxPaymentTicket(`${ticket}x`), null);
  assert.equal(verifyHotelSandboxPaymentTicket(ticket, Date.now() + 61_000), null);
  Reflect.set(process.env, "NODE_ENV", "production");
  assert.equal(hotelSandboxPaymentsEnabled(), false);
});
