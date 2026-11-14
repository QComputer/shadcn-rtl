import assert from "node:assert/strict";
import { before, mock, test } from "node:test";
import { NextRequest } from "next/server";

type TestSession = { user: { id: string; role: "ADMIN" | "MANAGER" | "STAFF" | "CUSTOMER"; organizationId: string | null } };
class TestApiError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

let currentSession: TestSession | null = {
  user: { id: "manager-a", role: "MANAGER", organizationId: "org-a" },
};
let businessHoursCalls: Array<{ operation: "get" | "update"; organizationId: string }> = [];

mock.module("@/lib/api-guards", { namedExports: {
  ApiError: TestApiError,
  requireAuthSession: async () => {
    if (!currentSession) throw new TestApiError(401, "Unauthorized");
    return currentSession;
  },
  requireOrgAccess: async (session: TestSession, organizationId: string, allowedRoles: string[]) => {
    if (!session.user.id || session.user.organizationId !== organizationId || !allowedRoles.includes(session.user.role)) {
      throw new TestApiError(403, "Forbidden");
    }
    return { organizationId, role: session.user.role };
  },
  requireSameOriginMutation: (request: Request) => {
    if (request.headers.get("origin") !== new URL(request.url).origin) {
      throw new TestApiError(403, "Cross-origin request rejected");
    }
  },
} });

mock.module("@/lib/services/organization.service", { namedExports: {
  organizationService: {
    getBusinessHours: async (organizationId: string) => {
      businessHoursCalls.push({ operation: "get", organizationId });
      return [];
    },
    updateBusinessHours: async (organizationId: string) => {
      businessHoursCalls.push({ operation: "update", organizationId });
      return [];
    },
  },
} });

let GET: typeof import("../../app/api/organizations/[id]/business-hours/route").GET;
let PUT: typeof import("../../app/api/organizations/[id]/business-hours/route").PUT;
before(async () => {
  ({ GET, PUT } = await import("../../app/api/organizations/[id]/business-hours/route"));
});

const context = (id: string) => ({ params: Promise.resolve({ id }) });
const getRequest = () => new NextRequest("https://app.example/api/organizations/org-b/business-hours");
const putRequest = (origin = "https://app.example") => new NextRequest("https://app.example/api/organizations/org-b/business-hours", {
  method: "PUT",
  headers: { origin, "content-type": "application/json" },
  body: "[]",
});

test("organization business-hours GET denies a foreign tenant before reading data", async () => {
  businessHoursCalls = [];
  currentSession = { user: { id: "manager-a", role: "MANAGER", organizationId: "org-a" } };

  const response = await GET(getRequest(), context("org-b"));

  assert.equal(response.status, 403);
  assert.deepEqual(businessHoursCalls, []);
});

test("organization business-hours PUT denies a foreign tenant before updating data", async () => {
  businessHoursCalls = [];
  currentSession = { user: { id: "manager-a", role: "MANAGER", organizationId: "org-a" } };

  const response = await PUT(putRequest(), context("org-b"));

  assert.equal(response.status, 403);
  assert.deepEqual(businessHoursCalls, []);
});

test("organization business-hours PUT keeps origin protection and requires same-tenant manager access", async () => {
  businessHoursCalls = [];
  currentSession = { user: { id: "manager-a", role: "MANAGER", organizationId: "org-a" } };
  const foreignOrigin = await PUT(putRequest("https://attacker.example"), context("org-a"));
  assert.equal(foreignOrigin.status, 403);
  assert.deepEqual(businessHoursCalls, []);

  currentSession = { user: { id: "manager-a", role: "MANAGER", organizationId: "org-a" } };
  const sameTenant = await PUT(new NextRequest("https://app.example/api/organizations/org-a/business-hours", {
    method: "PUT",
    headers: { origin: "https://app.example", "content-type": "application/json" },
    body: "[]",
  }), context("org-a"));

  assert.equal(sameTenant.status, 200);
  assert.deepEqual(businessHoursCalls, [{ operation: "update", organizationId: "org-a" }]);
});
