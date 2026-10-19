import assert from "node:assert/strict";
import { before, mock, test } from "node:test";
import { NextRequest } from "next/server";

type Role = "CUSTOMER" | "MANAGER" | "SUPER_ADMIN";
type TestSession = { user: { id: string; role: Role } } | null;
let session: TestSession = { user: { id: "operator-1", role: "SUPER_ADMIN" } };
let calls: Array<{ method: string; args: unknown[] }> = [];

class TestApiError extends Error { constructor(public status: number, message: string) { super(message); } }

mock.module("@/lib/api-guards", { namedExports: {
  ApiError: TestApiError,
  requireSameOriginMutation: (request: Request) => {
    if (request.headers.get("origin") !== new URL(request.url).origin) throw new TestApiError(403, "Cross-origin request rejected");
  },
  requireAuthSession: async () => {
    if (!session) throw new TestApiError(401, "Unauthorized");
    return session;
  },
} });

mock.module("@/lib/organization-onboarding/service", { namedExports: {
  OrganizationOnboardingError: class extends Error { constructor(public status: number, public code: string) { super(code); } },
  OrganizationOnboardingService: class {
    bootstrapHotel(...args: unknown[]) { calls.push({ method: "bootstrapHotel", args }); return Promise.resolve({ organizationId: "org-1", propertyId: "property-1", replayed: false }); }
    issueInvitation(...args: unknown[]) { calls.push({ method: "issueInvitation", args }); return Promise.resolve({ invitationId: "invitation-1", oneTimeToken: "b".repeat(43), replayed: false }); }
    revokeInvitation(...args: unknown[]) { calls.push({ method: "revokeInvitation", args }); return Promise.resolve({ invitationId: args[1], status: "REVOKED" }); }
    redeemInvitation(...args: unknown[]) { calls.push({ method: "redeemInvitation", args }); return Promise.resolve({ organizationId: "org-1", role: "ADMIN", reauthenticationRequired: true }); }
  },
} });

let bootstrap: typeof import("../../app/api/platform/organization-onboarding/hotel/route").POST;
let issue: typeof import("../../app/api/platform/organization-onboarding/invitations/route").POST;
let revoke: typeof import("../../app/api/platform/organization-onboarding/invitations/revoke/route").POST;
let redeem: typeof import("../../app/api/organization-invitations/redeem/route").POST;
before(async () => {
  ({ POST: bootstrap } = await import("../../app/api/platform/organization-onboarding/hotel/route"));
  ({ POST: issue } = await import("../../app/api/platform/organization-onboarding/invitations/route"));
  ({ POST: revoke } = await import("../../app/api/platform/organization-onboarding/invitations/revoke/route"));
  ({ POST: redeem } = await import("../../app/api/organization-invitations/redeem/route"));
});

const orgId = "cabcdefghijklmnopqrstuvwx";
const userId = "cbbbbbbbbbbbbbbbbbbbbbbbb";
const invitationId = "cccccccccccccccccccccccc";
function request(path: string, body: unknown, headers: Record<string, string> = { origin: "https://app.example", "content-type": "application/json", "idempotency-key": "onboarding-key-1" }) {
  return new NextRequest(`https://app.example${path}`, { method: "POST", headers, body: JSON.stringify(body) });
}

test("all mutations reject cross-origin requests and missing authentication before calling services", async () => {
  calls = [];
  assert.equal((await bootstrap(request("/hotel", {}, { "content-type": "application/json", "idempotency-key": "onboarding-key-1" }))).status, 403);
  session = null;
  assert.equal((await redeem(request("/redeem", { token: "A".repeat(43) }))).status, 401);
  session = { user: { id: "operator-1", role: "SUPER_ADMIN" } };
  assert.equal(calls.length, 0);
});

test("platform mutations reject a manager and malformed idempotency keys without service calls", async () => {
  calls = [];
  session = { user: { id: "manager-1", role: "MANAGER" } };
  assert.equal((await issue(request("/invitations", {}))).status, 403);
  session = { user: { id: "operator-1", role: "SUPER_ADMIN" } };
  assert.equal((await bootstrap(request("/hotel", {}, { origin: "https://app.example", "content-type": "application/json", "idempotency-key": "short" }))).status, 400);
  assert.equal((await issue(request("/invitations", {}, { origin: "https://app.example", "content-type": "application/json", "idempotency-key": "x".repeat(129) }))).status, 400);
  assert.equal(calls.length, 0);
});

test("Hotel bootstrap passes only validated input and trusted session actor, with private response headers", async () => {
  calls = [];
  session = { user: { id: "operator-1", role: "SUPER_ADMIN" } };
  const response = await bootstrap(request("/hotel", {
    name: "Damoon Hotel", slug: "damoon-hotel", locale: "fa", property: { name: "Main Building", slug: "main" }, userId: "spoofed",
  }));
  assert.equal(response.status, 400);
  assert.equal(calls.length, 0);
  const valid = await bootstrap(request("/hotel", {
    name: "Damoon Hotel", slug: "damoon-hotel", property: { name: "Main Building", slug: "main" },
  }));
  assert.equal(valid.status, 200);
  assert.equal(valid.headers.get("cache-control"), "private, no-store, max-age=0");
  assert.equal(valid.headers.get("referrer-policy"), "no-referrer");
  assert.equal(valid.headers.get("x-content-type-options"), "nosniff");
  assert.deepEqual(calls[0], {
    method: "bootstrapHotel",
    args: [
      { userId: "operator-1", role: "SUPER_ADMIN" },
      { name: "Damoon Hotel", slug: "damoon-hotel", property: { name: "Main Building", slug: "main" }, locale: "fa" },
      "onboarding-key-1",
    ],
  });
});

test("invitation issuance, revocation, and redemption pass parsed values with trusted actors", async () => {
  calls = [];
  session = { user: { id: "operator-1", role: "SUPER_ADMIN" } };
  const issued = await issue(request("/invitations", {
    organizationId: orgId, recipientUserId: userId, recipientEmail: "Owner@Example.com", recipientUsername: "hotel-owner", invitedRole: "ADMIN",
  }));
  assert.equal(issued.status, 200);
  assert.deepEqual(calls[0], {
    method: "issueInvitation",
    args: [
      { userId: "operator-1", role: "SUPER_ADMIN" },
      { organizationId: orgId, recipientUserId: userId, recipientEmail: "owner@example.com", recipientUsername: "hotel-owner", invitedRole: "ADMIN", ttlHours: 24 },
      "onboarding-key-1",
    ],
  });
  assert.equal((await issued.json()).oneTimeToken, "b".repeat(43));

  const revoked = await revoke(request("/revoke", { invitationId }));
  assert.equal(revoked.status, 200);
  assert.deepEqual(calls[1], { method: "revokeInvitation", args: [{ userId: "operator-1", role: "SUPER_ADMIN" }, invitationId] });

  session = { user: { id: userId, role: "CUSTOMER" } };
  const token = "A".repeat(43);
  const redeemed = await redeem(request("/redeem", { token }));
  assert.equal(redeemed.status, 200);
  assert.deepEqual(calls[2], { method: "redeemInvitation", args: [{ userId, role: "CUSTOMER" }, token] });
  assert.doesNotMatch(await redeemed.text(), new RegExp(token));
  assert.equal(redeemed.headers.get("cache-control"), "private, no-store, max-age=0");
});

test("validation failures return safe uncached errors and do not invoke services", async () => {
  calls = [];
  session = { user: { id: "operator-1", role: "SUPER_ADMIN" } };
  const invalid = await issue(request("/invitations", { organizationId: orgId, recipientUserId: userId, recipientEmail: "bad", recipientUsername: "hotel-owner", invitedRole: "ADMIN" }));
  assert.equal(invalid.status, 400);
  const body = await invalid.text();
  assert.deepEqual(JSON.parse(body), { error: "INVALID_ONBOARDING_REQUEST" });
  assert.equal(invalid.headers.get("cache-control"), "private, no-store, max-age=0");
  assert.doesNotMatch(body, /stack|Prisma|DATABASE_URL|tokenHash/i);
  assert.equal(calls.length, 0);
});

test("oversized, malformed and non-JSON bodies fail safely before service execution", async () => {
  calls = [];
  session = { user: { id: "operator-1", role: "SUPER_ADMIN" } };
  assert.equal((await redeem(request("/redeem", { token: "x".repeat(9000) }))).status, 413);
  const malformed = new Request("https://app.example/redeem", { method: "POST", headers: { origin: "https://app.example", "content-type": "application/json" }, body: "{" });
  assert.equal((await redeem(malformed)).status, 400);
  assert.equal((await redeem(request("/redeem", {}, { origin: "https://app.example", "content-type": "text/plain" }))).status, 400);
  assert.equal(calls.length, 0);
});
