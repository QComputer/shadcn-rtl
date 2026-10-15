import assert from "node:assert/strict";
import { before, mock, test } from "node:test";
import { NextRequest } from "next/server";
import { executionRequestSchema } from "../../lib/tenant-provisioning/universal-provisioning-contract";

type Role = "CUSTOMER" | "MANAGER" | "SUPER_ADMIN";
let session: { user: { id: string; role: Role } } | null = { user: { id: "platform-operator", role: "SUPER_ADMIN" } };
let calls: Array<{ method: string; args: unknown[] }> = [];
let serviceFailure = false;
let databaseCalls = 0;

class TestApiError extends Error { constructor(public status: number, message: string) { super(message); } }
class TestOnboardingError extends Error { constructor(public status: number, public code: string) { super(code); } }

mock.module("@/lib/api-guards", { namedExports: {
  ApiError: TestApiError,
  requireAuthSession: async () => {
    if (!session) throw new TestApiError(401, "Unauthorized");
    return session;
  },
  requireRole: (current: { user: { role: Role } }, roles: Role[]) => {
    if (!roles.includes(current.user.role)) throw new TestApiError(403, "Forbidden");
  },
  requireSameOriginMutation: (request: Request) => {
    if (request.headers.get("origin") !== new URL(request.url).origin) throw new TestApiError(403, "Cross-origin request rejected");
  },
} });

mock.module("@/lib/organization-onboarding/service", { namedExports: {
  OrganizationOnboardingError: TestOnboardingError,
} });

mock.module("@/lib/tenant-provisioning/universal-provisioning.service", { namedExports: {
  UniversalProvisioningService: class {},
  universalProvisioningService: {
    execute: async (...args: unknown[]) => {
      executionRequestSchema.parse(args[2]);
      calls.push({ method: "execute", args });
      if (serviceFailure) throw new Error("sensitive internal database detail");
      return { receipt: { organizationId: "org-test" }, invitations: [], replayed: false };
    },
  },
} });

mock.module("@/lib/db", { namedExports: {
  prisma: {
    user: { findMany: async () => { databaseCalls++; return []; } },
    emailVerification: { findFirst: async () => { databaseCalls++; return null; } },
  },
} });

let execute: typeof import("../../app/api/dashboard/tenant-provisioning-plans/[planId]/execute/route").POST;
let lookupRecipients: typeof import("../../app/api/dashboard/tenant-provisioning-recipients/route").GET;
let provisioningError: typeof import("../../lib/tenant-provisioning/http").provisioningError;
before(async () => {
  ({ POST: execute } = await import("../../app/api/dashboard/tenant-provisioning-plans/[planId]/execute/route"));
  ({ GET: lookupRecipients } = await import("../../app/api/dashboard/tenant-provisioning-recipients/route"));
  ({ provisioningError } = await import("../../lib/tenant-provisioning/http"));
});

const planId = "c12345678901234567890123";
const approvedSha256 = "a".repeat(64);
const executionBody = { approvedSha256 };
function mutationRequest(body: unknown, headers: Record<string, string> = {
  origin: "https://platform.example",
  "content-type": "application/json",
  "idempotency-key": "p14-execute-001",
}) {
  return new NextRequest(`https://platform.example/api/dashboard/tenant-provisioning-plans/${planId}/execute`, {
    method: "POST", headers, body: JSON.stringify(body),
  });
}
const invokeExecute = (request = mutationRequest(executionBody)) => execute(request, { params: Promise.resolve({ planId }) });

test("execute rejects cross-origin, anonymous and non-platform sessions before service execution", async () => {
  calls = [];
  session = { user: { id: "platform-operator", role: "SUPER_ADMIN" } };
  assert.equal((await invokeExecute(mutationRequest(executionBody, { origin: "https://evil.example", "content-type": "application/json", "idempotency-key": "p14-execute-001" }))).status, 403);
  session = null;
  assert.equal((await invokeExecute()).status, 401);
  for (const role of ["CUSTOMER", "MANAGER"] as const) {
    session = { user: { id: `user-${role.toLowerCase()}`, role } };
    assert.equal((await invokeExecute()).status, 403);
  }
  assert.deepEqual(calls, []);
});

test("execute validates idempotency and approved hash, then passes the trusted actor", async () => {
  calls = [];
  session = { user: { id: "platform-operator", role: "SUPER_ADMIN" } };
  assert.equal((await invokeExecute(mutationRequest(executionBody, {
    origin: "https://platform.example", "content-type": "application/json",
  }))).status, 400, "missing idempotency key is rejected");
  assert.equal((await invokeExecute(mutationRequest({ approvedSha256: "invalid" }))).status, 400, "malformed execution hash is rejected");
  assert.deepEqual(calls, []);

  const response = await invokeExecute();
  assert.equal(response.status, 200);
  assert.deepEqual(calls, [{
    method: "execute",
    args: [
      { userId: "platform-operator", role: "SUPER_ADMIN" },
      planId,
      executionBody,
      "p14-execute-001",
    ],
  }]);
});

test("execute sanitizes unexpected service failures", async () => {
  session = { user: { id: "platform-operator", role: "SUPER_ADMIN" } };
  serviceFailure = true;
  try {
    const response = await invokeExecute();
    assert.equal(response.status, 500);
    const body = await response.text();
    assert.doesNotMatch(body, /sensitive internal database detail|stack|DATABASE_URL/i);
    assert.deepEqual(JSON.parse(body), { error: "ONBOARDING_REQUEST_FAILED" });
    assert.equal(response.headers.get("cache-control"), "private, no-store, max-age=0");
    const safeProvisioningError = provisioningError(new Error("sensitive internal database detail"));
    assert.equal(safeProvisioningError.status, 500);
    assert.deepEqual(await safeProvisioningError.json(), { error: "عملیات انجام نشد؛ بدون تغییر اطلاعات دوباره تلاش کنید" });
  } finally { serviceFailure = false; }
});

test("recipient lookup is restricted to platform administrators", async () => {
  databaseCalls = 0;
  session = { user: { id: "manager-user", role: "MANAGER" } };
  const response = await lookupRecipients(new NextRequest("https://platform.example/api/dashboard/tenant-provisioning-recipients?query=owner"));
  assert.equal(response.status, 403);
  assert.equal(databaseCalls, 0);
});
