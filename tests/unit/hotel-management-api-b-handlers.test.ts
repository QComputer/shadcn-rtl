import assert from "node:assert/strict";
import { before, mock, test } from "node:test";
import { NextRequest } from "next/server";

const calls: string[] = [];
let session: { user: { id: string; role: string; organizationId: string } } | null = { user: { id: "u1", role: "ADMIN", organizationId: "org1" } };
let scopedResource = true;

class TestApiError extends Error { constructor(public status: number, message: string) { super(message); } }
mock.module("@/lib/api-guards", { namedExports: {
  ApiError: TestApiError,
  requireSameOriginMutation: () => undefined,
  requireAuthSession: async () => { if (!session) throw new TestApiError(401, "Unauthorized"); return session; },
} });
mock.module("@/lib/db", { namedExports: { prisma: new Proxy({}, { get: () => new Proxy({}, { get: () => async () => scopedResource ? { id: "resource-1" } : null }) }) } });
mock.module("@/lib/hotel/management/api-adapter", { namedExports: {
  managementPrincipal: (s: typeof session) => ({ userId: s!.user.id, role: s!.user.role, organizationId: s!.user.organizationId }),
  parseJsonObject: (v: unknown) => v,
  managementError: (e: unknown) => new Response(JSON.stringify({ error: (e as Error).message }), { status: (e as { status?: number }).status ?? 500 }),
} });
mock.module("@/lib/hotel/management/hotel-management.service", { namedExports: {
  HotelManagementService: class {
    async archiveProperty() { calls.push("archiveProperty"); return { id: "property-1" }; }
    async archiveRoomType() { calls.push("archiveRoomType"); return { id: "room-type-1" }; }
    async createPhysicalRoom() { calls.push("createPhysicalRoom"); return { id: "room-1" }; }
    async updatePhysicalRoom() { calls.push("updatePhysicalRoom"); return { id: "room-1" }; }
    async archivePhysicalRoom() { calls.push("archivePhysicalRoom"); return { count: 1 }; }
    async createAmenity() { calls.push("createAmenity"); return { id: "amenity-1" }; }
    async updateAmenity() { calls.push("updateAmenity"); return { count: 1 }; }
    async setRoomTypeAmenities() { calls.push("setRoomTypeAmenities"); return [{ id: "amenity-1" }]; }
    async createRatePlan() { calls.push("createRatePlan"); return { id: "plan-1" }; }
    async updateRatePlan() { calls.push("updateRatePlan"); return { id: "plan-1" }; }
    async upsertNightlyRate() { calls.push("upsertNightlyRate"); return { id: "nightly-1" }; }
    async createCancellationPolicy() { calls.push("createCancellationPolicy"); return { id: "policy-1" }; }
    async updateCancellationPolicy() { calls.push("updateCancellationPolicy"); return { id: "policy-1" }; }
    async setCancellationPolicyActive() { calls.push("setCancellationPolicyActive"); return { count: 1 }; }
  },
} });

type RouteModule = Record<string, (request: NextRequest, context: { params: Promise<Record<string, string>> }) => Promise<Response>>;
let routes: RouteModule[];
before(async () => {
  routes = await Promise.all([
    import("../../app/api/organizations/[id]/hotels/[propertyId]/archive/route"),
    import("../../app/api/organizations/[id]/hotels/[propertyId]/room-types/[roomTypeId]/archive/route"),
    import("../../app/api/organizations/[id]/hotels/[propertyId]/rooms/route"),
    import("../../app/api/organizations/[id]/hotels/[propertyId]/rooms/[roomId]/route"),
    import("../../app/api/organizations/[id]/hotels/[propertyId]/rooms/[roomId]/archive/route"),
    import("../../app/api/organizations/[id]/hotels/[propertyId]/amenities/route"),
    import("../../app/api/organizations/[id]/hotels/[propertyId]/amenities/[amenityId]/route"),
    import("../../app/api/organizations/[id]/hotels/[propertyId]/room-types/[roomTypeId]/amenities/route"),
    import("../../app/api/organizations/[id]/hotels/[propertyId]/rate-plans/route"),
    import("../../app/api/organizations/[id]/hotels/[propertyId]/rate-plans/[ratePlanId]/route"),
    import("../../app/api/organizations/[id]/hotels/[propertyId]/rate-plans/[ratePlanId]/nightly-rates/route"),
    import("../../app/api/organizations/[id]/hotels/[propertyId]/cancellation-policies/route"),
    import("../../app/api/organizations/[id]/hotels/[propertyId]/cancellation-policies/[policyId]/route"),
    import("../../app/api/organizations/[id]/hotels/[propertyId]/cancellation-policies/[policyId]/activation/route"),
  ]) as unknown as RouteModule[];
});
const request = (body: unknown = {}) => new NextRequest("https://hotel.example/api", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } });
const context = { id: "org1", propertyId: "property-1", roomTypeId: "room-type-1", roomId: "room-1", amenityId: "amenity-1", ratePlanId: "plan-1", policyId: "policy-1" };

test("all 14 non-inventory handlers delegate successfully", async () => {
  calls.length = 0;
  const cases: Array<[number, string, string]> = [
    [0, "POST", "archiveProperty"], [1, "POST", "archiveRoomType"], [2, "POST", "createPhysicalRoom"], [3, "PATCH", "updatePhysicalRoom"], [4, "POST", "archivePhysicalRoom"],
    [5, "POST", "createAmenity"], [6, "PATCH", "updateAmenity"], [7, "PUT", "setRoomTypeAmenities"], [8, "POST", "createRatePlan"], [9, "PATCH", "updateRatePlan"], [10, "PUT", "upsertNightlyRate"], [11, "POST", "createCancellationPolicy"], [12, "PATCH", "updateCancellationPolicy"], [13, "POST", "setCancellationPolicyActive"],
  ];
  const bodies = [{}, {}, { roomTypeId: "room-type-1", code: "101" }, { code: "102" }, {}, { key: "wifi", label: "Wi-Fi" }, { label: "Wi-Fi" }, { amenityIds: ["amenity-1"] }, { roomTypeId: "room-type-1", code: "flex", name: "Flexible", baseNightlyRate: "100000" }, { name: "Updated" }, { from: "2027-01-01", to: "2027-01-02", nightlyRate: "100000" }, { key: "flex", name: "Flexible", freeCancellationCutoffHours: 24 }, { name: "Updated" }, { isActive: true }];
  for (const [index, method, call] of cases) { const response = await routes[index][method](request(bodies[index]), { params: Promise.resolve(context) }); assert.ok(response.status === 200 || response.status === 201, `${call}: ${response.status} ${(await response.clone().text()).slice(0, 300)}`); }
  assert.deepEqual(calls, cases.map((x) => x[2]));
});

test("shared route context rejects authentication and organization mismatch before mutation", async () => {
  calls.length = 0; session = null;
  assert.equal((await routes[0].POST(request(), { params: Promise.resolve(context) })).status, 401);
  session = { user: { id: "u1", role: "ADMIN", organizationId: "other-org" } };
  assert.equal((await routes[5].POST(request({ key: "wifi", label: "Wi-Fi" }), { params: Promise.resolve(context) })).status, 403);
  assert.deepEqual(calls, []); session = { user: { id: "u1", role: "ADMIN", organizationId: "org1" } };
});

test("resource-specific prechecks reject sibling-property resources before service mutation", async () => {
  calls.length = 0; scopedResource = false;
  assert.equal((await routes[3].PATCH(request({ code: "102" }), { params: Promise.resolve({ ...context, propertyId: "sibling" }) })).status, 404);
  assert.equal((await routes[13].POST(request({ isActive: false }), { params: Promise.resolve({ ...context, propertyId: "sibling" }) })).status, 404);
  assert.deepEqual(calls, []); scopedResource = true;
});
