import assert from "node:assert/strict";
import { before, mock, test } from "node:test";

class TestApiError extends Error { constructor(public status: number, message: string) { super(message); } }
let knownHost = true;
let rateCalls = 0;
let blocked = false;
let storeUnavailable = false;
const observedBuckets: Array<{ organizationId: string; endpoint: string }> = [];
mock.module("@/lib/api-guards", { namedExports: {
  ApiError: TestApiError,
  requireSameOriginMutation: (request: Request) => {
    if (request.headers.get("origin") !== new URL(request.url).origin) throw new TestApiError(403, "Cross-origin mutation rejected");
  },
  jsonError: (error: unknown) => new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Request failed" }), { status: error instanceof TestApiError ? error.status : 500 }),
} });
mock.module("@/lib/hotel/services/hotel-publication.service", { namedExports: {
  resolveHotelTenantForHost: async (host: string | null) => knownHost && host === "hotel.example" ? { organizationId: "verified-org" } : null,
} });
mock.module("@/lib/hotel/guest-request-rate-limit.server", { namedExports: {
  checkHotelGuestRequestRateLimit: async ({ organizationId, endpoint }: { organizationId: string; endpoint: string }) => {
    rateCalls++;
    assert.equal(organizationId, "verified-org");
    observedBuckets.push({ organizationId, endpoint });
    return { allowed: !blocked && !storeUnavailable, remaining: blocked || storeUnavailable ? 0 : 59, resetAt: Date.now() + 60_000, retryAfterSeconds: blocked ? 30 : 0, storeUnavailable };
  },
} });
mock.module("@/lib/hotel/validation/hotel-contracts", { namedExports: {
  hotelGuestBookingRequestSchema: { parse: (value: unknown) => value },
  hotelGuestBookingRequestStatusSchema: { parse: (value: unknown) => value },
} });
mock.module("@/lib/hotel/management/api-adapter", { namedExports: { parseJsonObject: (value: unknown) => value } });
mock.module("@/lib/hotel/guest-booking-request.server", { namedExports: {
  submitHotelGuestBookingRequest: async () => ({ reference: "ref", status: "RECEIVED", availabilityHint: "AVAILABLE", replay: false }),
  readHotelGuestBookingRequestStatus: async () => ({ status: "RECEIVED" }),
} });

let createPost: (request: Request) => Promise<Response>;
let statusPost: (request: Request) => Promise<Response>;
before(async () => {
  ({ POST: createPost } = await import("../../app/api/hotel/v1/requests/route"));
  ({ POST: statusPost } = await import("../../app/api/hotel/v1/requests/status/route"));
});

function request(path: string, body: string, host = "hotel.example", extraHeaders: Record<string, string> = {}) {
  return new Request(`https://${host}${path}`, {
    method: "POST",
    headers: { host, origin: `https://${host}`, "content-type": "application/json", "idempotency-key": "hotel-request-key-0001", ...extraHeaders },
    body,
  });
}

test("unknown tenant hosts are rejected before writing a rate counter", async () => {
  knownHost = false;
  const beforeCalls = rateCalls;
  const response = await createPost(request("/api/hotel/v1/requests", "{}", "unknown.example"));
  assert.equal(response.status, 404);
  assert.equal(rateCalls, beforeCalls);
  knownHost = true;
});

test("guest request endpoints reject bodies over 24 KiB before rate limiting", async () => {
  const beforeCalls = rateCalls;
  const body = JSON.stringify({ payload: "x".repeat(24 * 1024) });
  const create = await createPost(request("/api/hotel/v1/requests", body));
  const status = await statusPost(request("/api/hotel/v1/requests/status", body));
  assert.equal(create.status, 413);
  assert.equal(status.status, 413);
  assert.equal(rateCalls, beforeCalls);
});

test("guest endpoint preserves enforced rate-limit rejection and cache safety", async () => {
  blocked = true;
  const response = await statusPost(request("/api/hotel/v1/requests/status", JSON.stringify({ reference: "some-reference" })));
  assert.equal(response.status, 429);
  assert.equal(response.headers.get("retry-after"), "30");
  assert.equal(response.headers.get("cache-control"), "no-store");
  blocked = false;
});

test("guest endpoint returns a no-store 503 when shared counters are unavailable", async () => {
  storeUnavailable = true;
  const response = await createPost(request("/api/hotel/v1/requests", JSON.stringify({ any: "bounded body" })));
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("retry-after"), "1");
  assert.equal(response.headers.get("cache-control"), "no-store");
  storeUnavailable = false;
});

test("rotated, multi-value, and malformed forwarding headers cannot evade tenant endpoint limits", async () => {
  const spoofed = [
    { "x-forwarded-for": "198.51.100.1", "x-real-ip": "198.51.100.1" },
    { "x-forwarded-for": "203.0.113.7, 10.0.0.1", "x-real-ip": "203.0.113.8" },
    { "x-forwarded-for": "999.999.999.999, not-an-ip", "x-real-ip": "<malformed>" },
  ];
  blocked = true;
  const beforeCalls = rateCalls;
  for (const headers of spoofed) {
    const create = await createPost(request("/api/hotel/v1/requests", "{}", "hotel.example", headers));
    const status = await statusPost(request("/api/hotel/v1/requests/status", JSON.stringify({ reference: "tracking-reference" }), "hotel.example", headers));
    assert.equal(create.status, 429);
    assert.equal(status.status, 429);
  }
  blocked = false;
  const attempts = observedBuckets.slice(beforeCalls);
  assert.equal(attempts.length, 6);
  assert.deepEqual(attempts.map(({ organizationId, endpoint }) => [organizationId, endpoint]), [
    ["verified-org", "create"], ["verified-org", "status"],
    ["verified-org", "create"], ["verified-org", "status"],
    ["verified-org", "create"], ["verified-org", "status"],
  ]);
});

test("both guest routes preserve same-origin rejection before rate limiting", async () => {
  const beforeCalls = rateCalls;
  const createRequest = request("/api/hotel/v1/requests", "{}", "hotel.example", { origin: "https://attacker.example" });
  const statusRequest = request("/api/hotel/v1/requests/status", JSON.stringify({ reference: "tracking-reference" }), "hotel.example", { origin: "https://attacker.example" });
  assert.equal((await createPost(createRequest)).status, 403);
  assert.equal((await statusPost(statusRequest)).status, 403);
  assert.equal(rateCalls, beforeCalls);
});
