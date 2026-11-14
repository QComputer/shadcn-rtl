import assert from "node:assert/strict";
import { before, mock, test } from "node:test";
import { NextRequest } from "next/server";

type MockSession = { user: { id: string; role: string; organizationId: string | null }; customerContext?: { organizationId: string; origin?: string } } | null;
let session: MockSession = { user: { id: "guest-1", role: "CUSTOMER", organizationId: "org-hotel" }, customerContext: { organizationId: "org-hotel" } };
let resolvedTenant: { organizationId: string } | null = { organizationId: "org-hotel" };
let propertyExists = true;
const calls: Array<{ name: string; args: unknown[] }> = [];
class TestApiError extends Error { constructor(public status: number, message: string) { super(message); } }

const prisma = {
  hotelProperty: {
    findFirst: async (args: unknown) => { calls.push({ name: "property.findFirst", args: [args] }); return propertyExists ? { id: "property-id-1" } : null; },
  },
};

mock.module("@/lib/api-guards", { namedExports: {
  ApiError: TestApiError,
  jsonError: (error: unknown) => Response.json({ error: error instanceof TestApiError ? error.message : "Internal server error" }, { status: error instanceof TestApiError ? error.status : 500 }),
  requireAuthSession: async (request: Request) => { calls.push({ name: "requireAuthSession", args: [request] }); if (!session) throw new TestApiError(401, "Unauthorized"); return session; },
  requireSameOriginMutation: (request: Request) => { calls.push({ name: "requireSameOriginMutation", args: [request] }); if (request.headers.get("origin") !== new URL(request.url).origin) throw new TestApiError(403, "Cross-origin request rejected"); },
} });
mock.module("@/lib/db-runtime", { namedExports: { prisma } });
mock.module("@/lib/hotel/services/hotel-publication.service", { namedExports: {
  resolveHotelTenantForHost: async (host: string | null) => { calls.push({ name: "resolveTenant", args: [host] }); return host === "hotel.example" ? resolvedTenant : null; },
} });
mock.module("@/lib/hotel/services/hotel-operational-reservation.service", { namedExports: {
  HotelOperationalReservationService: class {
    get(...args: unknown[]) { calls.push({ name: "service.get", args }); return Promise.resolve({ view: "guest", reservations: [] }); }
    execute(...args: unknown[]) { calls.push({ name: "service.execute", args }); return Promise.resolve({ outcome: "APPLIED", action: "search" }); }
  },
} });
mock.module("@/lib/security/bounded-json", { namedExports: {
  readBoundedJson: async (request: Request, options: unknown) => { calls.push({ name: "readBoundedJson", args: [options] }); return request.json(); },
} });

let GET: typeof import("../../app/api/hotel/v1/guest-reservations/route").GET;
let POST: typeof import("../../app/api/hotel/v1/guest-reservations/route").POST;
before(async () => {
  process.env.HOTEL_OPERATIONAL_RESERVATIONS_ENABLED = "1";
  process.env.HOTEL_GUEST_PORTAL_ENABLED = "1";
  ({ GET, POST } = await import("../../app/api/hotel/v1/guest-reservations/route"));
});

function reset() {
  process.env.HOTEL_OPERATIONAL_RESERVATIONS_ENABLED = "1";
  process.env.HOTEL_GUEST_PORTAL_ENABLED = "1";
  session = { user: { id: "guest-1", role: "CUSTOMER", organizationId: "org-hotel" }, customerContext: { organizationId: "org-hotel" } };
  resolvedTenant = { organizationId: "org-hotel" };
  propertyExists = true;
  calls.length = 0;
}
function getRequest(path = "/api/hotel/v1/guest-reservations?property=blue-hotel", host = "hotel.example") {
  return new NextRequest(`https://${host}${path}`, { headers: { host } });
}
function postRequest(body: unknown = { property: "blue-hotel", command: { action: "search", checkIn: "2027-02-01", checkOut: "2027-02-03" } }, origin = "https://hotel.example") {
  return new NextRequest("https://hotel.example/api/hotel/v1/guest-reservations", {
    method: "POST",
    headers: { host: "hotel.example", origin, "content-type": "application/json", "idempotency-key": "guest-reserve-001" },
    body: JSON.stringify(body),
  });
}

test("both operational gates are required", async () => {
  reset();
  delete process.env.HOTEL_OPERATIONAL_RESERVATIONS_ENABLED;
  assert.equal((await GET(getRequest())).status, 503);
  process.env.HOTEL_OPERATIONAL_RESERVATIONS_ENABLED = "1";
  delete process.env.HOTEL_GUEST_PORTAL_ENABLED;
  assert.equal((await POST(postRequest())).status, 503);
  assert.equal(calls.some((call) => call.name === "resolveTenant"), false);
});

test("missing session, staff role, and cross-tenant customer context are denied", async () => {
  reset();
  session = null;
  assert.equal((await GET(getRequest())).status, 401);
  session = { user: { id: "manager-1", role: "MANAGER", organizationId: "org-hotel" } };
  assert.equal((await GET(getRequest())).status, 403);
  session = { user: { id: "guest-1", role: "CUSTOMER", organizationId: "org-other" }, customerContext: { organizationId: "org-other" } };
  assert.equal((await GET(getRequest())).status, 403);
  assert.equal(calls.some((call) => call.name === "service.get"), false);
});

test("tenant is resolved only from Host and property lookup is tenant-scoped and active", async () => {
  reset();
  const request = getRequest("/api/hotel/v1/guest-reservations?property=blue-hotel");
  const response = await GET(request);
  assert.equal(response.status, 200);
  assert.deepEqual(calls.find((call) => call.name === "resolveTenant")?.args, ["hotel.example"]);
  assert.deepEqual(calls.find((call) => call.name === "property.findFirst")?.args[0], {
    where: { organizationId: "org-hotel", slug: "blue-hotel", isActive: true, deletedAt: null, operationalMode: "RESERVATION" },
    select: { id: true },
  });
  const getCall = calls.find((call) => call.name === "service.get");
  assert.deepEqual(getCall?.args, [
    { userId: "guest-1", role: "CUSTOMER", organizationId: "org-hotel", customerContextVerified: true },
    "org-hotel",
    "property-id-1",
  ]);
  assert.equal(response.headers.get("cache-control"), "private, no-store");

  reset();
  propertyExists = false;
  const missingProperty = await GET(getRequest());
  assert.equal(missingProperty.status, 404);
  assert.equal(calls.some((call) => call.name === "service.get"), false);
});

test("POST enforces same origin and sends bounded command plus idempotency key to guest service scope", async () => {
  reset();
  assert.equal((await POST(postRequest(undefined, "https://attacker.example"))).status, 403);
  assert.equal(calls.some((call) => call.name === "service.execute"), false);

  reset();
  const response = await POST(postRequest());
  assert.equal(response.status, 200);
  const readCall = calls.find((call) => call.name === "readBoundedJson");
  assert.deepEqual(readCall?.args, [{ maxBytes: 64 * 1024 }]);
  assert.deepEqual(calls.find((call) => call.name === "service.execute")?.args, [
    { userId: "guest-1", role: "CUSTOMER", organizationId: "org-hotel", customerContextVerified: true },
    "org-hotel",
    "property-id-1",
    { action: "search", checkIn: "2027-02-01", checkOut: "2027-02-03" },
    "guest-reserve-001",
  ]);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
});

test("unknown host, missing property, and invalid idempotency key fail closed", async () => {
  reset();
  assert.equal((await GET(getRequest("/api/hotel/v1/guest-reservations?property=blue-hotel", "unknown.example"))).status, 404);
  assert.equal((await GET(getRequest("/api/hotel/v1/guest-reservations"))).status, 400);
  reset();
  const invalidKeyRequest = new NextRequest("https://hotel.example/api/hotel/v1/guest-reservations", {
    method: "POST", headers: { host: "hotel.example", origin: "https://hotel.example", "content-type": "application/json", "idempotency-key": "x" },
    body: JSON.stringify({ property: "blue-hotel", command: { action: "cancel", reservationId: "reservation-1" } }),
  });
  assert.equal((await POST(invalidKeyRequest)).status, 400);
  assert.equal(calls.some((call) => call.name === "service.execute"), false);
});
