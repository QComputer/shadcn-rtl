import assert from "node:assert/strict";
import { before, mock, test } from "node:test";
import { NextRequest } from "next/server";
import { updateOrganizationSchema } from "@/lib/validators";

class TestApiError extends Error { constructor(readonly status: number, message: string) { super(message); } }
class TestAssignmentError extends Error { constructor(readonly code: "NOT_FOUND" | "CONFLICT", message: string) { super(message); } }
let session: { user: { id: string; role: string } } | null;
let serviceMode: "success" | "same" | "missing" | "conflict";
const calls: unknown[][] = [];

mock.module("@/lib/api-guards", { namedExports: {
  ApiError: TestApiError,
  jsonError: (error: unknown) => {
    const status = error instanceof TestApiError ? error.status : 500;
    return Response.json({ error: error instanceof Error ? error.message : "Error" }, { status });
  },
  requireAuthSession: async () => {
    if (!session) throw new TestApiError(401, "Unauthorized");
    return session;
  },
  requireRole: (current: { user: { role: string } }, roles: string[]) => {
    if (!roles.includes(current.user.role)) throw new TestApiError(403, "Forbidden");
  },
  requireSameOriginMutation: (request: Request) => {
    if (request.headers.get("origin") !== new URL(request.url).origin) throw new TestApiError(403, "Cross-origin request rejected");
  },
} });
mock.module("@/lib/services/organization.service", { namedExports: {
  BusinessVerticalAssignmentError: TestAssignmentError,
  organizationService: {
    setBusinessVertical: async (...args: unknown[]) => {
      calls.push(args);
      if (serviceMode === "missing") throw new TestAssignmentError("NOT_FOUND", "Organization not found");
      if (serviceMode === "conflict") throw new TestAssignmentError("CONFLICT", "Organization already has a different business vertical");
      return { organization: { id: args[0], slug: "tenant-one", vertical: args[1], type: "SHOP" }, changed: serviceMode !== "same" };
    },
  },
} });

let PATCH: typeof import("../../app/api/dashboard/organizations/[organizationId]/vertical/route").PATCH;
before(async () => {
  ({ PATCH } = await import("../../app/api/dashboard/organizations/[organizationId]/vertical/route"));
});

const orgId = "c12345678901234567890123";
const request = (body: unknown, origin = "https://platform.example") => new NextRequest(`https://platform.example/api/dashboard/organizations/${orgId}/vertical`, {
  method: "PATCH",
  headers: { origin, "content-type": "application/json" },
  body: JSON.stringify(body),
});
const invoke = (req = request({ vertical: "HOTEL" }), id = orgId) => PATCH(req, { params: Promise.resolve({ organizationId: id }) });

test("route rejects unauthenticated and non-platform users before calling the service", async () => {
  calls.length = 0; session = null;
  assert.equal((await invoke()).status, 401);
  session = { user: { id: "tenant-admin", role: "ADMIN" } };
  assert.equal((await invoke()).status, 403);
  assert.deepEqual(calls, []);
});

test("route enforces same origin, organization ID, canonical vertical, and strict body", async () => {
  calls.length = 0; session = { user: { id: "platform-admin", role: "SUPER_ADMIN" } };
  assert.equal((await invoke(request({ vertical: "HOTEL" }, "https://evil.example"))).status, 403);
  assert.equal((await invoke(request({ vertical: "HOTEL" }), "invalid-id")).status, 400);
  assert.equal((await invoke(request({ vertical: "NOT_A_VERTICAL" }))).status, 400);
  assert.equal((await invoke(request({ vertical: "HOTEL", organizationId: "other" }))).status, 400);
  assert.deepEqual(calls, []);
});

test("ordinary tenant organization updates cannot assign or clear a vertical", () => {
  assert.equal(updateOrganizationSchema.safeParse({ vertical: "HOTEL" }).success, false);
  assert.equal(updateOrganizationSchema.safeParse({ vertical: null }).success, false);
  assert.deepEqual(updateOrganizationSchema.parse({ name: "Updated tenant name" }), { name: "Updated tenant name" });
});

test("platform assignment passes trusted actor and route organization to the service", async () => {
  calls.length = 0; session = { user: { id: "platform-admin", role: "SUPER_ADMIN" } }; serviceMode = "success";
  const response = await invoke();
  assert.equal(response.status, 200);
  assert.deepEqual(calls, [[orgId, "HOTEL", "SUPER_ADMIN", "platform-admin"]]);
  assert.deepEqual(await response.json(), { organization: { id: orgId, slug: "tenant-one", vertical: "HOTEL", type: "SHOP" }, changed: true });
});

test("route returns idempotent, missing-organization and conflict outcomes distinctly", async () => {
  session = { user: { id: "platform-admin", role: "SUPER_ADMIN" } };
  serviceMode = "same";
  assert.deepEqual(await (await invoke()).json(), { organization: { id: orgId, slug: "tenant-one", vertical: "HOTEL", type: "SHOP" }, changed: false });
  serviceMode = "missing";
  assert.equal((await invoke()).status, 404);
  serviceMode = "conflict";
  assert.equal((await invoke()).status, 409);
});
