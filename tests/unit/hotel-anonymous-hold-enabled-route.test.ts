import assert from "node:assert/strict";
import { before, mock, test } from "node:test";
import { NextRequest } from "next/server";

class TestApiError extends Error { constructor(public status: number, message: string) { super(message); } }
let replayMode: "none" | "replay" | "conflict" | "inactive" | "unapproved" | "failure" = "none";
let createCalls = 0;
mock.module("@/lib/api-guards", { namedExports: {
  ApiError: TestApiError,
  jsonError: (error: unknown) => { const status = error instanceof TestApiError ? error.status : error instanceof Error && error.name === "ZodError" ? 400 : 500; return new Response(JSON.stringify({ error: status < 500 ? (error instanceof Error ? error.message : "Request failed") : "Internal server error" }), { status }); },
} });
mock.module("@/lib/hotel/management/api-adapter", { namedExports: { parseJsonObject: (value: unknown) => value } });
mock.module("@/lib/hotel/services/hotel-publication.service", { namedExports: { resolveHotelTenantForHost: async (host: string | null) => host === "hotel.example" ? { organizationId: "org-1" } : null } });
mock.module("@/lib/hotel/services/public-availability.service", { namedExports: { searchPublishedHotelAvailability: async () => ({ property: { id: "property-1" }, options: [{ roomType: { id: "room-1", slug: "standard" }, ratePlan: { id: "rate-1", code: "flex" }, isAvailable: true }] }) } });
mock.module("@/lib/hotel/persistence/prisma-hotel-repositories", { namedExports: { createPrismaHotelRepositories: () => ({
  findAnonymousHoldReplay: async () => replayMode === "conflict" ? { isConflict: true } : replayMode === "replay" ? { isReplay: true, result: { holdId: "hold-1", reference: "H-1", status: "ACTIVE", expiresAt: new Date("2027-10-01T01:00:00Z"), currency: "TOMAN", totalAmount: 250000, nightlyRates: [125000, 125000], policySnapshot: null, inventoryReserved: true } } : null,
  createAnonymousHoldAtomically: async () => { createCalls += 1; if (replayMode === "failure") throw new Error("secret database detail"); return replayMode === "none" ? { isHeld: true, holdId: "hold-1", reference: "H-1", expiresAt: new Date("2027-10-01T01:00:00Z"), currency: "TOMAN", totalAmount: 250000, nightlyRates: [125000, 125000], policySnapshot: null } : { isHeld: false, reason: replayMode === "inactive" ? "IDEMPOTENCY_REPLAY_INACTIVE" : "PUBLICATION_NOT_APPROVED" }; },
}) } });

process.env.HOTEL_ANONYMOUS_HOLD_OPERATIONAL_ENABLED = "1";
let POST: (request: Request) => Promise<Response>;
before(async () => { ({ POST } = await import("../../app/api/hotel/v1/holds/route")); });
const payload = { property: "hotel", roomType: "standard", ratePlan: "flex", checkIn: "2027-09-30", checkOut: "2027-10-02", occupancy: { adults: 2, children: 0 }, guests: [{ fullName: "Guest", isPrimary: true }], contact: { fullName: "Guest", phone: "09120000000" }, acceptedCancellationPolicyKey: "flex", idempotencyKey: "body-must-not-win" };
const request = (key = "header-key-01") => new NextRequest("https://hotel.example/api/hotel/v1/holds", { method: "POST", headers: { host: "hotel.example", "content-type": "application/json", "idempotency-key": key }, body: JSON.stringify(payload) });

test("enabled handler returns 201 for creation and 200 for stored replay without availability dependency", async () => {
  replayMode = "none"; createCalls = 0;
  const created = await POST(request());
  assert.equal(created.status, 201);
  replayMode = "replay";
  const replay = await POST(request());
  assert.equal(replay.status, 200);
  assert.equal((await replay.json()).holdId, "hold-1");
  assert.equal(createCalls, 1);
});

test("enabled handler rejects missing and malformed keys, conflicts, and unknown hosts safely", async () => {
  replayMode = "none";
  assert.equal((await POST(new NextRequest("https://hotel.example/api", { method: "POST", headers: { host: "hotel.example" }, body: JSON.stringify(payload) }))).status, 400);
  assert.equal((await POST(request("bad"))).status, 400);
  replayMode = "conflict";
  assert.equal((await POST(request("header-key-02"))).status, 409);
  assert.equal((await POST(new NextRequest("https://foreign.example/api", { method: "POST", headers: { host: "foreign.example", "idempotency-key": "header-key-03" }, body: JSON.stringify(payload) }))).status, 404);
});

test("body idempotency value cannot override the header", async () => {
  replayMode = "none"; createCalls = 0;
  await POST(request("authoritative-header-01"));
  assert.equal(createCalls, 1);
});

test("inactive replay, unapproved resources, invalid input, and repository failures fail safely", async () => {
  createCalls = 0;
  replayMode = "inactive";
  assert.equal((await POST(request("expired-key-01"))).status, 409);
  assert.equal((await POST(request("released-key-01"))).status, 409);
  replayMode = "unapproved";
  assert.equal((await POST(request("unapproved-key-01"))).status, 409);
  const before = createCalls;
  assert.equal((await POST(new NextRequest("https://hotel.example/api", { method: "POST", headers: { host: "hotel.example", "idempotency-key": "invalid-input-01" }, body: JSON.stringify({ ...payload, checkOut: "2027-09-29" }) }))).status, 400);
  assert.equal(createCalls, before);
  replayMode = "failure";
  const failure = await POST(request("failure-key-01"));
  assert.equal(failure.status, 500);
  assert.doesNotMatch(await failure.text(), /secret database detail|Prisma|SELECT/i);
});
