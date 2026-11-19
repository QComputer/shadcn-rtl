import assert from "node:assert/strict";
import test from "node:test";
import { hotelStayRequestCommand } from "../../lib/hotel/services/hotel-stay-request.service";

test("operational guest requests cannot carry simulated payment or client authority", () => {
  const quote = { action: "quote", roomTypeId: "room", ratePlanId: "rate", checkIn: "2027-12-10", checkOut: "2027-12-12", adults: 1, childAges: [] };
  assert.equal(hotelStayRequestCommand.safeParse(quote).success, true);
  for (const extra of [{ organizationId: "other" }, { totalAmount: 1 }, { currency: "USD" }, { policyVersion: 99 }]) assert.equal(hotelStayRequestCommand.safeParse({ ...quote, ...extra }).success, false);
  for (const action of ["pay", "hold", "reserve", "confirm", "check-in"]) assert.equal(hotelStayRequestCommand.safeParse({ action, outcome: "SUCCESS", verified: true }).success, false);
});
