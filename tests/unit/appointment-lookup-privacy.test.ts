import assert from "node:assert/strict";
import { before, mock, test } from "node:test";
import { NextRequest } from "next/server";

const recoveryRateLimit = { allowed: true, remaining: 9, resetAt: Date.now() + 60_000, retryAfterSeconds: 0 };
mock.module("@/lib/rate-limit", { namedExports: {
  getClientIp: () => "127.0.0.1",
  checkRateLimit: () => recoveryRateLimit,
} });

let lookupRoute: typeof import("../../app/api/public/appointments/lookup/route");

before(async () => {
  lookupRoute = await import("../../app/api/public/appointments/lookup/route");
});

const request = (body: unknown) => new NextRequest("https://tenant.example/api/public/appointments/lookup", {
  method: "POST",
  headers: { "content-type": "application/json", host: "tenant.example" },
  body: JSON.stringify(body),
});

function assertSecureHeaders(response: Response) {
  assert.match(response.headers.get("cache-control") || "", /no-store/);
  assert.equal(response.headers.get("pragma"), "no-cache");
  assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
}

test("phone-only lookup returns no PII and a non-authorizing generic response", async () => {
  const response = await lookupRoute.POST(request({ phone: "09123456789", organizationSlug: "valid-org" }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    message: "Tracking credentials are provided at booking. Phone based recovery is unavailable.",
  });
  assertSecureHeaders(response);
});

test("unknown tenant and known tenant produce the same recovery response", async () => {
  const known = await lookupRoute.POST(request({ phone: "09123456789", organizationSlug: "valid-org" }));
  const unknown = await lookupRoute.POST(request({ phone: "09123456789", organizationSlug: "unknown-org" }));
  assert.deepEqual(await known.json(), await unknown.json());
  assertSecureHeaders(unknown);
});

test("booking reference alone and a supplied OTP never authorize or reveal an appointment", async () => {
  const referenceOnly = await lookupRoute.POST(request({ bookingReference: "VALID-REF", organizationSlug: "valid-org" }));
  const withOtp = await lookupRoute.POST(request({ bookingReference: "VALID-REF", phone: "09123456789", otpCode: "123456", organizationSlug: "valid-org" }));
  const wrongPhone = await lookupRoute.POST(request({ bookingReference: "VALID-REF", phone: "09999999999", otpCode: "123456", organizationSlug: "valid-org" }));
  const invalidOtp = await lookupRoute.POST(request({ bookingReference: "VALID-REF", phone: "09123456789", otpCode: "invalid", organizationSlug: "valid-org" }));
  const bodies = await Promise.all([referenceOnly, withOtp, wrongPhone, invalidOtp].map((response) => response.json()));

  assert.deepEqual(bodies[0], bodies[1]);
  assert.deepEqual(bodies[1], bodies[2]);
  assert.deepEqual(bodies[2], bodies[3]);
  for (const [response, body] of [referenceOnly, withOtp, wrongPhone, invalidOtp].map((item, index) => [item, bodies[index]] as const)) {
    assert.equal("appointment" in body, false);
    assert.equal("trackingToken" in body, false);
    assertSecureHeaders(response);
  }
});

test("missing organization is rejected with hardened response headers", async () => {
  const response = await lookupRoute.POST(request({ phone: "09123456789" }));
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, "Organization slug is required");
  assertSecureHeaders(response);
});

test("rate limit response is hardened and preserves Retry-After", async () => {
  recoveryRateLimit.allowed = false;
  recoveryRateLimit.retryAfterSeconds = 17;
  try {
    const response = await lookupRoute.POST(request({ phone: "09123456789", organizationSlug: "valid-org" }));
    assert.equal(response.status, 429);
    assert.equal(response.headers.get("retry-after"), "17");
    assertSecureHeaders(response);
  } finally {
    recoveryRateLimit.allowed = true;
    recoveryRateLimit.retryAfterSeconds = 0;
  }
});

test("malformed request returns a generic hardened error", async () => {
  const requestWithBadJson = new NextRequest("https://tenant.example/api/public/appointments/lookup", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "not-json",
  });
  const response = await lookupRoute.POST(requestWithBadJson);
  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { error: "Internal server error" });
  assertSecureHeaders(response);
});
