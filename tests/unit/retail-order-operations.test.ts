import assert from "node:assert/strict";
import { test } from "node:test";
import { isRetailOrderTransitionAllowed, retailOrderActions } from "@/lib/retail/order-operations";

test("Retail pickup and delivery expose only the fulfillment transitions for their type", () => {
  const pickup = { type: "PICK_UP" as const, paymentStatus: "PENDING" as const };
  const delivery = { type: "DELIVERY" as const, paymentStatus: "PENDING" as const };

  assert.deepEqual(retailOrderActions({ ...pickup, status: "PENDING" }).map(({ status }) => status), ["ACCEPTED", "CANCELLED"]);
  assert.deepEqual(retailOrderActions({ ...pickup, status: "ACCEPTED" }).map(({ status }) => status), ["PREPARING", "CANCELLED"]);
  assert.deepEqual(retailOrderActions({ ...pickup, status: "PREPARING" }).map(({ status }) => status), ["READY", "CANCELLED"]);
  assert.deepEqual(retailOrderActions({ ...pickup, status: "READY" }).map(({ status }) => status), ["PICKED_UP", "CANCELLED"]);
  assert.deepEqual(retailOrderActions({ ...pickup, status: "PICKED_UP" }), []);
  assert.equal(isRetailOrderTransitionAllowed({ ...pickup, status: "PENDING" }, "READY"), false);
  assert.equal(isRetailOrderTransitionAllowed({ ...pickup, status: "PICKED_UP" }, "DELIVERED"), false);

  assert.deepEqual(retailOrderActions({ ...delivery, status: "READY" }).map(({ status }) => status), ["PICKED_UP", "CANCELLED"]);
  assert.deepEqual(retailOrderActions({ ...delivery, status: "PICKED_UP" }).map(({ status }) => status), ["DELIVERED"]);
  assert.equal(isRetailOrderTransitionAllowed({ ...delivery, status: "READY" }, "DELIVERED"), false);
});

test("completed payment removes cancellation while fulfillment leaves payment unchanged", () => {
  const paid = { type: "PICK_UP" as const, paymentStatus: "COMPLETED" as const, status: "READY" as const };
  assert.deepEqual(retailOrderActions(paid).map(({ status }) => status), ["PICKED_UP"]);
  assert.equal(isRetailOrderTransitionAllowed(paid, "CANCELLED"), false);
  assert.equal(isRetailOrderTransitionAllowed({ ...paid, status: "PICKED_UP" }, "DELIVERED"), false);
});

import { checkRouteAccess } from "@/lib/access-control";

test("Retail order dashboard has an explicit SHOP-scoped ADMIN/MANAGER route policy", () => {
  const base = {userId: "qa", organizationId: "qa-store", organizationCapabilities: ["SHOP"]};
  for (const userRole of ["ADMIN", "MANAGER"] as const) {
    assert.equal(checkRouteAccess("/fa/dashboard/retail-orders", {...base, userRole}).hasAccess, true);
    assert.equal(checkRouteAccess("/fa/dashboard/retail-orders", {...base, userRole, organizationCapabilities: []}).hasAccess, false);
  }
  for (const userRole of ["STAFF", "DRIVER", "CUSTOMER"] as const) {
    assert.equal(checkRouteAccess("/fa/dashboard/retail-orders", {...base, userRole}).hasAccess, false);
  }
  assert.equal(checkRouteAccess("/dashboard/unknown-order-actions", {...base, userRole: "ADMIN"}).hasAccess, false);
});
