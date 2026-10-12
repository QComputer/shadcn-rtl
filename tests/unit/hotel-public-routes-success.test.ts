import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { NextRequest } from "next/server";

let receivedHost = "";
mock.module("@/lib/hotel/management/api-adapter", { namedExports: { parseJsonObject: (value: unknown) => value } });
mock.module("@/lib/hotel/services/public-availability.service", { namedExports: {
  searchPublishedHotelAvailability: async (host: string) => { receivedHost = host; return { property: { id: "p1", slug: "hotel", name: "Approved", currency: "TOMAN" }, nights: ["2027-08-12"], nightCount: 1, inventoryReserved: false, options: [{ roomType: { id: "r1", slug: "standard", name: "Standard", capacity: {}, amenities: [] }, ratePlan: { id: "rp1", code: "flex", name: "Flexible", currency: "TOMAN", mealPlan: "none" }, nights: ["2027-08-12"], nightlyRates: [125000], totalRate: 125000, averageNightlyRate: 125000, availableRoomCount: 1, isAvailable: true, unavailableNights: [] }] }; },
  serializePublicAvailability: (value: unknown) => value,
} });

test("approved publication path returns a read-only integer-safe response from both handlers", async () => {
  process.env.HOTEL_PUBLICATION_OPERATIONAL_ENABLED = "1";
  const availability = await import("../../app/api/hotel/v1/availability/search/route");
  const quotes = await import("../../app/api/hotel/v1/quotes/route");
  const request = () => new NextRequest("https://damoon-hotel.ir/api", { method: "POST", body: JSON.stringify({ property: "hotel", checkIn: "2027-08-12", checkOut: "2027-08-13", occupancy: { adults: 2, children: 0 } }), headers: { host: "damoon-hotel.ir" } });
  const first = await availability.POST(request());
  const second = await quotes.POST(request());
  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  assert.equal((await first.json()).inventoryReserved, false);
  assert.equal((await second.json()).options[0].totalRate, 125000);
  assert.equal(receivedHost, "damoon-hotel.ir");
  delete process.env.HOTEL_PUBLICATION_OPERATIONAL_ENABLED;
});
