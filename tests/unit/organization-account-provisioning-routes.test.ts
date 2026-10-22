import assert from "node:assert/strict";
import { before, mock, test } from "node:test";
import { NextRequest, NextResponse } from "next/server";

type Role = "CUSTOMER" | "SUPER_ADMIN";
let session: { user: { id: string; role: Role; organizationId?: string | null } } | null = { user: { id: "platform-1", role: "SUPER_ADMIN" } };
const calls: Array<{ method: string; args: unknown[] }> = [];
class TestApiError extends Error { constructor(public status: number, message: string) { super(message); } }

mock.module("@/lib/api-guards", { namedExports: {
  ApiError: TestApiError,
  requireAuthSession: async () => { if (!session) throw new TestApiError(401, "Unauthorized"); return session; },
  requireSameOriginMutation: (request: Request) => { if (request.headers.get("origin") !== new URL(request.url).origin) throw new TestApiError(403, "Cross-origin request rejected"); },
  jsonError: (error: unknown) => NextResponse.json({ error: error instanceof Error ? error.message : "error" }, { status: error instanceof TestApiError ? error.status : 500 }),
} });
mock.module("@/lib/user-provisioning/service", { namedExports: {
  organizationAccountProvisioningService: {
    provision: (...args: unknown[]) => { calls.push({ method: "provision", args }); return Promise.resolve({ created: true, userId: "new-user", username: "damoon", organizationId: "org-damoon", role: "ADMIN" }); },
    resetPassword: (...args: unknown[]) => { calls.push({ method: "resetPassword", args }); return Promise.resolve({ success: true, userId: "target-user", organizationId: "org-damoon" }); },
  },
} });

let provision: typeof import("../../app/api/organizations/[id]/users/route").POST;
let reset: typeof import("../../app/api/organizations/[id]/users/[userId]/password/route").POST;
before(async () => {
  ({ POST: provision } = await import("../../app/api/organizations/[id]/users/route"));
  ({ POST: reset } = await import("../../app/api/organizations/[id]/users/[userId]/password/route"));
});

function request(url: string, body: unknown, origin = "https://app.example") {
  return new NextRequest(url, { method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify(body) });
}

test("provision route binds organization and actor to the authenticated session and returns private response", async () => {
  calls.length = 0;
  session = { user: { id: "platform-1", role: "SUPER_ADMIN" } };
  const response = await provision(request("https://app.example/api/organizations/org-damoon/users", { username: "DAMOON", password: "secret1", role: "ADMIN" }), { params: Promise.resolve({ id: "org-damoon" }) });
  assert.equal(response.status, 201);
  assert.equal(response.headers.get("cache-control"), "private, no-store, max-age=0");
  assert.deepEqual(calls[0], { method: "provision", args: [{ userId: "platform-1", sessionRole: "SUPER_ADMIN", sessionOrganizationId: undefined }, "org-damoon", { username: "damoon", password: "secret1", role: "ADMIN" }] });
});

test("provision and password reset reject unauthenticated, cross-origin, malformed, and extra-field requests before service execution", async () => {
  calls.length = 0;
  assert.equal((await provision(request("https://app.example/users", { username: "damoon", password: "secret1", role: "ADMIN" }, "https://attacker.example"), { params: Promise.resolve({ id: "org-damoon" }) })).status, 403);
  session = null;
  assert.equal((await provision(request("https://app.example/users", { username: "damoon", password: "secret1", role: "ADMIN" }), { params: Promise.resolve({ id: "org-damoon" }) })).status, 401);
  session = { user: { id: "platform-1", role: "SUPER_ADMIN" } };
  assert.equal((await provision(request("https://app.example/users", { username: "bad username", password: "secret1", role: "ADMIN" }), { params: Promise.resolve({ id: "org-damoon" }) })).status, 400);
  assert.equal((await provision(request("https://app.example/users", { username: "damoon", password: "secret1", role: "SUPER_ADMIN" }), { params: Promise.resolve({ id: "org-damoon" }) })).status, 400);
  assert.equal((await reset(request("https://app.example/users/target/password", { password: "short" }), { params: Promise.resolve({ id: "org-damoon", userId: "target-user" }) })).status, 400);
  assert.equal(calls.length, 0);
});

test("password-reset route passes only authorized scope and validated replacement value", async () => {
  calls.length = 0;
  session = { user: { id: "admin-13", role: "CUSTOMER", organizationId: "org-damoon" } };
  const response = await reset(request("https://app.example/api/organizations/org-damoon/users/target-user/password", { password: "test-secret2" }), { params: Promise.resolve({ id: "org-damoon", userId: "target-user" }) });
  assert.equal(response.status, 200);
  assert.deepEqual(calls[0], { method: "resetPassword", args: [{ userId: "admin-13", sessionRole: "CUSTOMER", sessionOrganizationId: "org-damoon" }, "org-damoon", "target-user", "test-secret2"] });
});
