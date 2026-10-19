import test from "node:test";
import assert from "node:assert/strict";
import { getDashboardRouteAccessDecision, isDashboardNavigationItemVisible } from "@/lib/dashboard/navigation-policy";

test("Hotel CMS navigation requires a management role and active Hotel website capability", () => {
  assert.equal(isDashboardNavigationItemVisible("hotelWebsite", "ADMIN", ["HOTEL_WEBSITE"]), true);
  assert.equal(isDashboardNavigationItemVisible("hotelWebsite", "MANAGER", ["HOTEL_WEBSITE"]), true);
  assert.equal(isDashboardNavigationItemVisible("hotelWebsite", "ADMIN", []), false);
  assert.equal(isDashboardNavigationItemVisible("hotelWebsite", "STAFF", ["HOTEL_WEBSITE"]), false);
  assert.equal(isDashboardNavigationItemVisible("hotelWebsite", "SUPER_ADMIN", []), true);
});

test("private Hotel revision previews remain reachable inside the explicit Hotel dashboard scope", () => {
  const path = "/fa/dashboard/hotel-website/org-1/property-1/preview/revision-1";
  assert.deepEqual(getDashboardRouteAccessDecision({ locale: "fa", pathname: path, role: "SUPER_ADMIN" }), {
    isDashboardPath: true,
    isKnownRoute: true,
    isAllowed: true,
    routePath: "/hotel-website/org-1/property-1/preview/revision-1",
    routeKey: "/hotel-website/[organizationId]/[propertyId]/preview/[revisionId]",
    role: "SUPER_ADMIN",
    requiredCapability: null,
  });
  assert.equal(getDashboardRouteAccessDecision({ locale: "fa", pathname: path, role: "ADMIN" }).isAllowed, true);
  assert.equal(getDashboardRouteAccessDecision({ locale: "fa", pathname: path, role: "STAFF" }).isAllowed, false);
});
