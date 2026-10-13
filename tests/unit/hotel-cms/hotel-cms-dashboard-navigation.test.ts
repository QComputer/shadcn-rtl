import test from "node:test";
import assert from "node:assert/strict";
import { isDashboardNavigationItemVisible } from "@/lib/dashboard/navigation-policy";

test("Hotel CMS navigation requires a management role and active Hotel website capability", () => {
  assert.equal(isDashboardNavigationItemVisible("hotelWebsite", "ADMIN", ["HOTEL_WEBSITE"]), true);
  assert.equal(isDashboardNavigationItemVisible("hotelWebsite", "MANAGER", ["HOTEL_WEBSITE"]), true);
  assert.equal(isDashboardNavigationItemVisible("hotelWebsite", "ADMIN", []), false);
  assert.equal(isDashboardNavigationItemVisible("hotelWebsite", "STAFF", ["HOTEL_WEBSITE"]), false);
  assert.equal(isDashboardNavigationItemVisible("hotelWebsite", "SUPER_ADMIN", []), true);
});
