import assert from "node:assert/strict";
import test from "node:test";
import { dashboardOrganizationCapabilities, organizationPublicRouteCapabilities } from "@/lib/organization-capabilities";
import { isDashboardNavigationItemVisible } from "@/lib/dashboard/navigation-policy";

const activeHotel = [{ key: "HOTEL_BOOKING", status: "ACTIVE", enabledAt: new Date() }] as const;

test("internal dashboard projection exposes active Hotel booking without changing public capabilities", () => {
  const input = { legacyType: "SHOP" as const, vertical: "HOTEL", capabilitiesInitializedAt: new Date(), capabilities: [...activeHotel] };
  assert.deepEqual(dashboardOrganizationCapabilities(input), ["HOTEL_BOOKING"]);
  assert.deepEqual(organizationPublicRouteCapabilities(input), []);
});

test("Hotel operations navigation follows membership role and active internal capability", () => {
  for (const role of ["ADMIN", "MANAGER"] as const) assert.equal(isDashboardNavigationItemVisible("hotelOperations", role, ["HOTEL_BOOKING"]), true);
  assert.equal(isDashboardNavigationItemVisible("hotelOperations", "STAFF", ["HOTEL_BOOKING"]), false);
  assert.equal(isDashboardNavigationItemVisible("hotelOperations", "ADMIN", []), false);
  assert.equal(isDashboardNavigationItemVisible("hotelOperations", "SUPER_ADMIN", []), true);
});

test("inactive, unenabled, or non-Hotel booking capability is not projected", () => {
  const base = { legacyType: "SHOP" as const, vertical: "HOTEL", capabilitiesInitializedAt: new Date() };
  assert.deepEqual(dashboardOrganizationCapabilities({ ...base, capabilities: [{ key: "HOTEL_BOOKING", status: "INACTIVE", enabledAt: new Date() }] }), []);
  assert.deepEqual(dashboardOrganizationCapabilities({ ...base, capabilities: [{ key: "HOTEL_BOOKING", status: "ACTIVE", enabledAt: null }] }), []);
  assert.deepEqual(dashboardOrganizationCapabilities({ ...base, vertical: "SHOP", capabilities: [...activeHotel] }), []);
});

test("Shop, appointment, and mixed public dashboard projections remain unchanged", () => {
  const base = { capabilitiesInitializedAt: new Date(), vertical: "SHOP", legacyType: "SHOP" as const };
  assert.deepEqual(dashboardOrganizationCapabilities({ ...base, capabilities: [{ key: "SHOP", status: "ACTIVE" }] }), ["SHOP"]);
  assert.deepEqual(dashboardOrganizationCapabilities({ ...base, capabilities: [{ key: "APPOINTMENT", status: "ACTIVE" }] }), ["APPOINTMENT"]);
  assert.deepEqual(dashboardOrganizationCapabilities({ ...base, vertical: "HOTEL", capabilities: [{ key: "SHOP", status: "ACTIVE" }, ...activeHotel] }), ["SHOP", "HOTEL_BOOKING"]);
});
