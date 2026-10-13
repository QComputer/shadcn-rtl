import assert from "node:assert/strict";
import { before, mock, test } from "node:test";
import { NextRequest } from "next/server";

let session: { user: { id: string; role: string; organizationId: string } } | null = {
  user: { id: "u1", role: "ADMIN", organizationId: "org1" },
};
const calls: string[] = [];
let scopedRoomTypePresent = true;

mock.module("@/lib/api-guards", {
  namedExports: {
    ApiError: class ApiError extends Error { status: number; constructor(status: number, message: string) { super(message); this.status = status; } },
    jsonError: (error: unknown) => {
      const message = error instanceof Error ? error.message : "Internal server error";
      const status = (error as { status?: number }).status ?? (message.toLowerCase().includes("invalid") ? 422 : 500);
      return new Response(JSON.stringify({ error: status >= 500 ? "Internal server error" : message }), { status });
    },
    requireAuthSession: async () => {
      if (!session) throw Object.assign(new Error("Unauthorized"), { status: 401 });
      return session;
    },
    requireSameOriginMutation: () => undefined,
  },
});
mock.module("@/lib/db", {
  namedExports: {
    prisma: {
      organization: { findFirst: async () => ({ slug: "org-one" }) },
      hotelRoomType: { findFirst: async () => (scopedRoomTypePresent ? { id: "room-type-1" } : null) },
    },
  },
});
mock.module("@/lib/hotel/management/hotel-management.service", {
  namedExports: {
    HotelManagementAuthorizationError: class extends Error {},
    HotelManagementConflictError: class extends Error {},
    HotelManagementValidationError: class extends Error {},
    HotelManagementService: class {
      async createProperty(_principal: unknown, input: unknown) { calls.push("createProperty"); return { id: "property-1", ...input as object }; }
      async updateProperty() { calls.push("updateProperty"); return { id: "property-1" }; }
      async createRoomType() { calls.push("createRoomType"); return { id: "room-type-1" }; }
      async updateRoomType() { calls.push("updateRoomType"); return { id: "room-type-1" }; }
    },
  },
});
let propertyPost: typeof import("../../app/api/organizations/[id]/hotels/route");
let propertyPatch: typeof import("../../app/api/organizations/[id]/hotels/[propertyId]/route");
let roomTypePost: typeof import("../../app/api/organizations/[id]/hotels/[propertyId]/room-types/route");
let roomTypePatch: typeof import("../../app/api/organizations/[id]/hotels/[propertyId]/room-types/[roomTypeId]/route");

before(async () => {
  propertyPost = await import("../../app/api/organizations/[id]/hotels/route");
  propertyPatch = await import("../../app/api/organizations/[id]/hotels/[propertyId]/route");
  roomTypePost = await import("../../app/api/organizations/[id]/hotels/[propertyId]/room-types/route");
  roomTypePatch = await import("../../app/api/organizations/[id]/hotels/[propertyId]/room-types/[roomTypeId]/route");
});

const req = (body: unknown) => new NextRequest("https://hotel.example.test/api", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } });

test("all four handlers invoke the accepted service operations", async () => {
  calls.length = 0;
  assert.equal((await propertyPost.POST(req({ slug: "main", name: "Main" }), { params: Promise.resolve({ id: "org1" }) })).status, 201);
  assert.equal((await propertyPatch.PATCH(req({ name: "Updated" }), { params: Promise.resolve({ id: "org1", propertyId: "property-1" }) })).status, 200);
  assert.equal((await roomTypePost.POST(req({ slug: "standard", name: "Standard", maxAdults: 2, maxOccupancy: 2, beds: [{ kind: "queen" }] }), { params: Promise.resolve({ id: "org1", propertyId: "property-1" }) })).status, 201);
  assert.equal((await roomTypePatch.PATCH(req({ name: "Updated" }), { params: Promise.resolve({ id: "org1", propertyId: "property-1", roomTypeId: "room-type-1" }) })).status, 200);
  assert.deepEqual(calls, ["createProperty", "updateProperty", "createRoomType", "updateRoomType"]);
});

test("missing authentication is rejected before a mutating service call", async () => {
  calls.length = 0;
  session = null;
  const response = await propertyPost.POST(req({ slug: "main", name: "Main" }), { params: Promise.resolve({ id: "org1" }) });
  assert.equal(response.status, 401);
  assert.deepEqual(calls, []);
  session = { user: { id: "u1", role: "ADMIN", organizationId: "org1" } };
});

test("client-controlled organization mismatch is rejected", async () => {
  calls.length = 0;
  const response = await propertyPost.POST(req({ slug: "main", name: "Main", organizationId: "other", role: "SUPER_ADMIN" }), { params: Promise.resolve({ id: "other" }) });
  assert.equal(response.status, 403);
  assert.deepEqual(calls, []);
});

test("invalid request input is rejected before service invocation", async () => {
  calls.length = 0;
  const response = await propertyPost.POST(req({ slug: "Not valid", name: "" }), { params: Promise.resolve({ id: "org1" }) });
  assert.equal(response.status, 422);
  assert.deepEqual(calls, []);
});

test("room-type patch requires the route property scope", async () => {
  calls.length = 0;
  scopedRoomTypePresent = false;
  const response = await roomTypePatch.PATCH(req({ name: "Updated" }), { params: Promise.resolve({ id: "org1", propertyId: "sibling-property", roomTypeId: "room-type-1" }) });
  assert.equal(response.status, 404);
  assert.deepEqual(calls, []);
  scopedRoomTypePresent = true;
});
