import test from "node:test";
import assert from "node:assert/strict";
import { getDashboardRouteAccessDecision, isDashboardNavigationItemVisible } from "@/lib/dashboard/navigation-policy";
import { checkRouteAccess } from "@/lib/access-control";

test("Hotel operations requires its own capability and a management role at both route policies", () => {
  for (const role of ["ADMIN", "MANAGER"] as const) {
    assert.equal(isDashboardNavigationItemVisible("hotelOperations", role, ["HOTEL_BOOKING"]), true);
    assert.equal(isDashboardNavigationItemVisible("hotelOperations", role, ["HOTEL_WEBSITE"]), false);
    for (const path of ["/hotel-operations", "/hotel-operations/org/property"]) {
      assert.equal(getDashboardRouteAccessDecision({ locale: "fa", pathname: `/fa/dashboard${path}`, role, capabilities: ["HOTEL_BOOKING"] }).isAllowed, true);
      assert.equal(getDashboardRouteAccessDecision({ locale: "fa", pathname: `/fa/dashboard${path}`, role, capabilities: ["HOTEL_WEBSITE"] }).isAllowed, false);
      assert.equal(checkRouteAccess(`/dashboard${path}`, { userId: "manager", userRole: role, organizationId: "org", organizationCapabilities: ["HOTEL_BOOKING"] }).hasAccess, true);
      assert.equal(checkRouteAccess(`/dashboard${path}`, { userId: "manager", userRole: role, organizationId: "org", organizationCapabilities: ["HOTEL_WEBSITE"] }).hasAccess, false);
    }
  }
  assert.equal(isDashboardNavigationItemVisible("hotelOperations", "STAFF", ["HOTEL_BOOKING"]), false);
  assert.equal(isDashboardNavigationItemVisible("hotelOperations", "SUPER_ADMIN", []), true);
});

test("reservation center dashboard route admits authorized reception roles while preserving hotel capability gating", () => {
  const path = "/fa/dashboard/hotel-operations/org/property/reservations";
  for (const role of ["ADMIN", "MANAGER", "STAFF"] as const) {
    assert.equal(getDashboardRouteAccessDecision({ locale: "fa", pathname: path, role, capabilities: ["HOTEL_BOOKING"] }).isAllowed, true);
    assert.equal(getDashboardRouteAccessDecision({ locale: "fa", pathname: path, role, capabilities: [] }).isAllowed, false);
    assert.equal(checkRouteAccess("/dashboard/hotel-operations/org/property/reservations", { userId: "staff", userRole: role, organizationId: "org", organizationCapabilities: ["HOTEL_BOOKING"] }).hasAccess, true);
  }
  assert.equal(getDashboardRouteAccessDecision({ locale: "fa", pathname: path, role: "STAFF", capabilities: ["HOTEL_WEBSITE"] }).isAllowed, false);
  assert.equal(getDashboardRouteAccessDecision({ locale: "fa", pathname: path, role: "USER", capabilities: ["HOTEL_BOOKING"] }).isAllowed, false);
});
