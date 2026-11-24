import assert from "node:assert/strict";
import test from "node:test";
import { Prisma } from "@prisma/client";
import { damoonDemoBookingUrl } from "@/lib/hotel/services/damoon-demo-booking";
import { resolveGuestPortalPropertyId } from "@/lib/hotel/services/guest-portal-discovery";
import { isMissingHotelMaintenanceTableError } from "@/lib/hotel/services/hotel-maintenance-schema";

test("legacy guest discovery selects the sole operational property and excludes Damoon demo", () => {
  const properties = [
    { id: "operational", slug: "damoon-hotel" },
    { id: "demo", slug: "damoon-demo" },
  ];
  assert.equal(resolveGuestPortalPropertyId("damoon-hotel", properties), "operational");
});

test("discovery fails closed when no unique operational property exists", () => {
  assert.equal(resolveGuestPortalPropertyId("damoon-hotel", [{ id: "demo", slug: "damoon-demo" }]), null);
  assert.equal(resolveGuestPortalPropertyId("damoon-hotel", [
    { id: "one", slug: "north" }, { id: "two", slug: "south" }, { id: "demo", slug: "damoon-demo" },
  ]), null);
});

test("a demo-like slug in another tenant is not implicitly excluded", () => {
  assert.equal(resolveGuestPortalPropertyId("another-hotel", [{ id: "property", slug: "damoon-demo" }]), "property");
});

test("Damoon demo links use only approved locales and host", () => {
  assert.equal(damoonDemoBookingUrl("fa"), "https://damoon-hotel.ir/fa/hotel-reservations/start?mode=DEMO_BOOKING");
  assert.equal(damoonDemoBookingUrl("en"), "https://damoon-hotel.ir/en/hotel-reservations/start?mode=DEMO_BOOKING");
  assert.equal(damoonDemoBookingUrl("ar"), "https://damoon-hotel.ir/ar/hotel-reservations/start?mode=DEMO_BOOKING");
  assert.equal(damoonDemoBookingUrl("../../evil"), null);
});

test("maintenance degradation recognizes only the exact missing table", () => {
  const missingMaintenance = new Prisma.PrismaClientKnownRequestError("missing relation", {
    code: "P2021", clientVersion: "unit-test", meta: { table: "public.HotelRoomMaintenanceBlock" },
  });
  const missingRoom = new Prisma.PrismaClientKnownRequestError("missing relation", {
    code: "P2021", clientVersion: "unit-test", meta: { table: "public.HotelRoom" },
  });
  const missingMaintenanceRaw = new Prisma.PrismaClientKnownRequestError("raw query failed", {
    code: "P2010", clientVersion: "unit-test", meta: { code: "42P01", message: 'relation "public.HotelRoomMaintenanceBlock" does not exist' },
  });
  assert.equal(isMissingHotelMaintenanceTableError(missingMaintenance), true);
  assert.equal(isMissingHotelMaintenanceTableError(missingMaintenanceRaw), true);
  assert.equal(isMissingHotelMaintenanceTableError(missingRoom), false);
  assert.equal(isMissingHotelMaintenanceTableError(new Error("connection refused")), false);
});
