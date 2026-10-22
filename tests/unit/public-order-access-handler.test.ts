import assert from "node:assert/strict";
import { test, mock } from "node:test";
import { NextRequest } from "next/server";

test("public order handler denies nonstaff membership and preserves scoped staff/owner/token access", async () => {
  let session: { user: { id: string; role: string } } | null = { user: { id: "other-customer", role: "CUSTOMER" } };
  let role: string | null = "CUSTOMER";
  const order = { id: "order-a", orderNumber: "READ-A", customerId: "owner-a", organizationSlug: "tenant-a", publicTrackingToken: "test-bearer-only", guestCustomer: null, deliveryAddress: "synthetic private address", items: [] };
  mock.module("@/lib/auth", { namedExports: { auth: async () => session } });
  mock.module("@/lib/rate-limit", { namedExports: { getClientIp: () => "127.0.0.1", checkRateLimit: () => ({ allowed: true, retryAfterSeconds: 0 }) } });
  mock.module("@/lib/db", { namedExports: { prisma: {
    order: { findFirst: async () => order },
    organizationMember: { findFirst: async (input: { where: { organizationSlug: string; isActive: boolean; role: { in: string[] }; user: { isActive: boolean; deletedAt: null }; organization: { isActive: boolean; deletedAt: null } } }) => {
      assert.equal(input.where.organizationSlug, "tenant-a");
      assert.equal(input.where.isActive, true);
      assert.deepEqual(input.where.role.in, ["ADMIN", "MANAGER", "STAFF"]);
      assert.deepEqual(input.where.user, { isActive: true, deletedAt: null });
      assert.deepEqual(input.where.organization, { isActive: true, deletedAt: null });
      return role ? { role } : null;
    } },
  } } });
  const { GET } = await import("../../app/api/public/orders/[orderNumber]/route");
  const read = (query = "") => GET(new NextRequest(`https://store.example.test/api/public/orders/READ-A${query}`), { params: Promise.resolve({ orderNumber: "READ-A" }) });
  for (const deniedRole of ["CUSTOMER", "USER", "DRIVER"]) {
    role = deniedRole; const response = await read(); assert.equal(response.status, 403);
    assert.equal(JSON.stringify(await response.json()).includes(order.deliveryAddress), false);
  }
  role = null; assert.equal((await read()).status, 403, "other-tenant staff without target membership is denied");
  for (const allowedRole of ["ADMIN", "MANAGER", "STAFF"]) { role = allowedRole; assert.equal((await read()).status, 200); }
  role = null; session = { user: { id: "owner-a", role: "CUSTOMER" } }; const own = await read(); assert.equal(own.status, 200); assert.equal("publicTrackingToken" in await own.json(), false);
  session = null; assert.equal((await read()).status, 403); assert.equal((await read("?token=wrong")).status, 403); assert.equal((await read("?token=test-bearer-only")).status, 200);
  session = { user: { id: "platform-admin", role: "SUPER_ADMIN" } }; assert.equal((await read()).status, 200);
});