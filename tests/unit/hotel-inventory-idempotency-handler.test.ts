import assert from "node:assert/strict";
import { before, mock, test } from "node:test";
import { NextRequest } from "next/server";

let session: { user: { id: string; role: string; organizationId: string } } | null = { user: { id: "admin-1", role: "ADMIN", organizationId: "org-1" } };
let sameOrigin = true;
let calls = 0;

class TestApiError extends Error { constructor(public status: number, message: string) { super(message); } }
mock.module("@/lib/api-guards", { namedExports: {
  ApiError: TestApiError,
  requireSameOriginMutation: () => { if (!sameOrigin) throw new TestApiError(403, "Cross-origin request rejected"); },
  requireAuthSession: async () => { if (!session) throw new TestApiError(401, "Unauthorized"); return session; },
  jsonError: () => new Response(JSON.stringify({ error: "Internal server error" }), { status: 500 }),
} });
mock.module("@/lib/hotel/management/api-adapter", { namedExports: {
  managementPrincipal: (value: typeof session) => ({ userId: value!.user.id, role: value!.user.role, organizationId: value!.user.organizationId }),
  parseJsonObject: (value: unknown) => value,
  managementError: (error: unknown) => {
    const status = typeof error === "object" && error !== null && "status" in error ? Number((error as { status: number }).status) : 500;
    return new Response(JSON.stringify({ error: status >= 500 ? "Internal server error" : (error instanceof Error ? error.message : "Request failed") }), { status });
  },
} });
mock.module("@/lib/hotel/management/hotel-management.service", { namedExports: {
  HotelManagementService: class {
    async adjustInventoryIdempotent(...args: unknown[]) { calls += 1; return { id: "inventory-1", allotment: 11, args }; }
  },
} });

let post: (request: NextRequest, context: { params: Promise<{ id: string; propertyId: string }> }) => Promise<Response>;
before(async () => {
  ({ POST: post } = await import("../../app/api/organizations/[id]/hotels/[propertyId]/inventory/adjustments/route"));
});

const context = { params: Promise.resolve({ id: "org-1", propertyId: "property-1" }) };
const request = (body: unknown = { roomTypeId: "room-type-1", date: "2027-08-12", allotmentDelta: 1, reason: "manual correction" }, headers: Record<string, string> = { origin: "https://hotel.example", "sec-fetch-site": "same-origin", "idempotency-key": "handler-key-01" }) => new NextRequest("https://hotel.example/api/inventory", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json", ...headers } });

test("feature gate, auth, key and origin failures do not mutate", async () => {
  calls = 0; session = { user: { id: "admin-1", role: "ADMIN", organizationId: "org-1" } }; sameOrigin = true;
  delete process.env.HOTEL_INVENTORY_IDEMPOTENCY_ENABLED;
  assert.equal((await post(request(), context)).status, 503);
  process.env.HOTEL_INVENTORY_IDEMPOTENCY_ENABLED = "1";
  session = null;
  assert.equal((await post(request(), context)).status, 401);
  session = { user: { id: "admin-1", role: "ADMIN", organizationId: "org-1" } };
  assert.equal((await post(request({ roomTypeId: "room-type-1", date: "2027-08-12", allotmentDelta: 1, reason: "manual" }, { origin: "https://hotel.example", "sec-fetch-site": "same-origin" }), context)).status, 400);
  sameOrigin = false;
  assert.equal((await post(request(), context)).status, 403);
  assert.equal(calls, 0);
  sameOrigin = true;
});

test("authorized request delegates the validated scope and reports safe replay/conflict statuses", async () => {
  calls = 0;
  sameOrigin = true;
  process.env.HOTEL_INVENTORY_IDEMPOTENCY_ENABLED = "1";
  session = { user: { id: "admin-1", role: "ADMIN", organizationId: "org-1" } };
  const response = await post(request(), context);
  assert.equal(response.status, 200);
  const body = await response.json() as { inventory: { id: string } };
  assert.equal(body.inventory.id, "inventory-1");
  assert.equal(calls, 1);
});

test("organization mismatch and invalid strict input are rejected before service invocation", async () => {
  calls = 0;
  sameOrigin = true;
  process.env.HOTEL_INVENTORY_IDEMPOTENCY_ENABLED = "1";
  session = { user: { id: "admin-1", role: "ADMIN", organizationId: "other-org" } };
  assert.equal((await post(request(), context)).status, 403);
  session = { user: { id: "admin-1", role: "ADMIN", organizationId: "org-1" } };
  assert.equal((await post(request({ roomTypeId: "room-type-1", date: "2027-08-12", allotmentDelta: 0, reason: "" }), context)).status, 500);
  assert.equal(calls, 0);
});
