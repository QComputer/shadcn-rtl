import assert from "node:assert/strict";
import { before, mock, test } from "node:test";
import { NextRequest } from "next/server";

class TestApiError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

type TestSession = { user: { id: string; role: string; organizationId: string } };
let session: TestSession | null = null;
let scopedMembershipRole = "ADMIN";
const writes: string[] = [];
const serviceCalls: Array<{ method: string; args: unknown[] }> = [];
const getByIdCalls: Array<{ id: string; organizationId?: string }> = [];
let usersById: Record<string, unknown> = {};

const membershipRows = [
  { id: "member-org-a", userId: "target-user", organizationId: "org-a", organizationSlug: "org-a", role: "STAFF", isActive: true },
  { id: "member-org-b", userId: "target-user", organizationId: "org-b", organizationSlug: "org-b", role: "ADMIN", isActive: true },
];

const prisma = {
  organizationMember: {
    findFirst: async (args: { where?: Record<string, unknown> }) => {
      const where = args.where ?? {};
      if (where.id === "member-org-a") return { ...membershipRows[0], user: { id: "target-user", name: "Target", email: "target@example.test", firstName: "Target", lastName: "User", phone: null, role: "CUSTOMER", isActive: true, isTeamMember: false }, organization: { id: "org-a", name: "Org A", slug: "org-a", type: "SHOP" } };
      if (where.userId === "target-user" && where.organizationId === "org-a") return { id: "member-org-a", organizationId: "org-a" };
      return null;
    },
  },
  organization: { findUnique: async () => ({ id: "org-a", slug: "org-a" }) },
  organizationCapability: {},
  organizationSettings: {},
  auditLog: {},
  user: { update: async (...args: unknown[]) => { writes.push("user.update"); return args; } },
  $transaction: async (...args: unknown[]) => { writes.push("$transaction"); return args; },
};

mock.module("@/lib/api-guards", { namedExports: {
  ApiError: TestApiError,
  jsonError: (error: unknown) => {
    const status = error instanceof TestApiError ? error.status : 500;
    return Response.json({ error: status >= 500 ? "Internal server error" : error instanceof Error ? error.message : "Request failed" }, { status });
  },
  requireAuthSession: async () => {
    if (!session) throw new TestApiError(401, "Unauthorized");
    return session;
  },
  requireOrgAccess: async (current: TestSession, organizationId: string, allowedRoles: string[]) => {
    if (current.user.role === "SUPER_ADMIN") return null;
    if (current.user.organizationId !== organizationId) throw new TestApiError(403, "Tenant context mismatch");
    if (!allowedRoles.includes(scopedMembershipRole)) throw new TestApiError(403, "Forbidden");
    return { organizationId, role: scopedMembershipRole };
  },
  requireCurrentOrgAdminOrManager: async (current: TestSession) => {
    if (!current.user.organizationId || !["ADMIN", "MANAGER"].includes(scopedMembershipRole)) throw new TestApiError(403, "Forbidden");
    return { organizationId: current.user.organizationId, role: scopedMembershipRole };
  },
  requireRole: (current: TestSession, allowedRoles: string[]) => {
    if (!allowedRoles.includes(current.user.role)) throw new TestApiError(403, "Forbidden");
  },
  requireSameOriginMutation: (request: Request) => {
    if (request.headers.get("origin") !== new URL(request.url).origin) throw new TestApiError(403, "Cross-origin request rejected");
  },
} });

mock.module("@/lib/db", { namedExports: { prisma, default: prisma } });
mock.module("@/lib/services/organization.service", { namedExports: {
  organizationService: {
    getMembers: async (...args: unknown[]) => { serviceCalls.push({ method: "getMembers", args }); return [{ id: "member-org-a", userId: "target-user", organizationId: "org-a", role: "STAFF" }]; },
    addMember: async (...args: unknown[]) => { serviceCalls.push({ method: "addMember", args }); return { id: "member-new" }; },
  },
} });
mock.module("@/lib/services/organization-membership.service", { namedExports: {
  organizationMembershipService: {
    change: async (...args: unknown[]) => { serviceCalls.push({ method: "change", args }); return { id: "member-org-a", ...args[3] as object }; },
    changeGlobalUser: async (...args: unknown[]) => { serviceCalls.push({ method: "changeGlobalUser", args }); return { id: args[1], success: true }; },
  },
  parseManagedMemberRole: (role: unknown) => role,
} });
mock.module("@/lib/services/user.service", { namedExports: {
  userService: {
    getById: async (id: string, organizationId?: string) => {
      getByIdCalls.push({ id, organizationId });
      const user = usersById[id] as { memberOf: typeof membershipRows } | undefined;
      if (!user) return null;
      return { ...user, memberOf: organizationId ? user.memberOf.filter((member) => member.organizationId === organizationId) : user.memberOf };
    },
  },
} });
mock.module("@/lib/tenant-context", { namedExports: {
  requireTenantContext: async (_current: TestSession, organizationId: string) => ({ organizationId, organizationSlug: "org-a", actorUserId: session?.user.id, role: scopedMembershipRole }),
} });
mock.module("next/cache", { namedExports: { revalidatePath: () => undefined } });

let membersCollection: typeof import("../../app/api/organizations/[id]/members/route");
let memberDetail: typeof import("../../app/api/organizations/[id]/members/[mId]/route");
let userDetail: typeof import("../../app/api/users/[id]/route");
let capabilities: typeof import("../../app/api/organizations/[id]/capabilities/route");

before(async () => {
  [membersCollection, memberDetail, userDetail, capabilities] = await Promise.all([
    import("../../app/api/organizations/[id]/members/route"),
    import("../../app/api/organizations/[id]/members/[mId]/route"),
    import("../../app/api/users/[id]/route"),
    import("../../app/api/organizations/[id]/capabilities/route"),
  ]);
});

const orgParams = (id = "org-a") => ({ params: Promise.resolve({ id }) });
const memberParams = (id = "org-a", mId = "member-org-a") => ({ params: Promise.resolve({ id, mId }) });
const userParams = (id = "target-user") => ({ params: Promise.resolve({ id }) });
const request = (url: string, method: string, body?: unknown, origin = "https://platform.example") => new NextRequest(url, {
  method,
  headers: { origin, "content-type": "application/json" },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});
const sessionFor = (role: string, organizationId = "org-a", id = "actor") => ({ user: { id, role, organizationId } });

function reset() {
  writes.length = 0;
  serviceCalls.length = 0;
  getByIdCalls.length = 0;
  session = null;
  scopedMembershipRole = "ADMIN";
  usersById = {};
}

test("anonymous callers receive 401 on member collection, member detail, and user detail reads", async () => {
  reset();
  assert.equal((await membersCollection.GET(request("https://platform.example/api/organizations/org-a/members", "GET"), orgParams())).status, 401);
  assert.equal((await memberDetail.GET(request("https://platform.example/api/organizations/org-a/members/member-org-a", "GET"), memberParams())).status, 401);
  assert.equal((await userDetail.GET(request("https://platform.example/api/users/target-user", "GET"), userParams())).status, 401);
  assert.deepEqual(serviceCalls, []);
  assert.deepEqual(getByIdCalls, []);
});

test("member collection permits a global CUSTOMER with scoped ADMIN and scoped ADMIN or MANAGER", async () => {
  for (const [globalRole, membershipRole] of [["CUSTOMER", "ADMIN"], ["ADMIN", "ADMIN"], ["MANAGER", "MANAGER"]]) {
    reset();
    session = sessionFor(globalRole);
    scopedMembershipRole = membershipRole;
    const response = await membersCollection.GET(request("https://platform.example/api/organizations/org-a/members", "GET"), orgParams());
    assert.equal(response.status, 200, `${globalRole} with scoped ${membershipRole} can list members`);
    assert.deepEqual(serviceCalls, [{ method: "getMembers", args: ["org-a"] }]);
    assert.equal(response.headers.get("cache-control"), "private, no-store");
  }
});

test("member collection denies a foreign organization before reading members", async () => {
  reset();
  session = sessionFor("CUSTOMER");
  scopedMembershipRole = "ADMIN";
  const response = await membersCollection.GET(request("https://platform.example/api/organizations/org-b/members", "GET"), orgParams("org-b"));
  assert.equal(response.status, 403);
  assert.deepEqual(serviceCalls, []);
});

test("cross-origin mutations are rejected before membership or capability writes", async () => {
  reset();
  session = sessionFor("ADMIN");
  scopedMembershipRole = "ADMIN";
  const foreignOrigin = "https://attacker.example";
  const responses = await Promise.all([
    membersCollection.POST(request("https://platform.example/api/organizations/org-a/members", "POST", { userId: "target-user", role: "STAFF" }, foreignOrigin), orgParams()),
    memberDetail.PUT(request("https://platform.example/api/organizations/org-a/members/member-org-a", "PUT", { isActive: false }, foreignOrigin), memberParams()),
    userDetail.PUT(request("https://platform.example/api/users/target-user", "PUT", { isActive: false }, foreignOrigin), userParams()),
    capabilities.PUT(request("https://platform.example/api/organizations/org-a/capabilities", "PUT", { capabilities: [] }, foreignOrigin), orgParams()),
  ]);
  assert.deepEqual(responses.map((response) => response.status), [403, 403, 403, 403]);
  assert.deepEqual(writes, []);
  assert.deepEqual(serviceCalls, []);
});

const userDto = (memberOf: typeof membershipRows) => ({
  id: "target-user", name: "target@example.test", role: "CUSTOMER", isActive: true, isTeamMember: false,
  email: "target@example.test", firstName: "Target", lastName: "User", phone: null, avatar: null, image: null,
  locale: "en", theme: "system", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-02T00:00:00.000Z", memberOf,
});

test("self user DTO exposes only current-organization membership and no sensitive fields", async () => {
  reset();
  session = sessionFor("CUSTOMER", "org-a", "target-user");
  usersById["target-user"] = userDto(membershipRows);
  const response = await userDetail.GET(request("https://platform.example/api/users/target-user", "GET"), userParams("target-user"));
  assert.equal(response.status, 200);
  assert.deepEqual(getByIdCalls, [{ id: "target-user", organizationId: "org-a" }]);
  const dto = await response.json();
  assert.deepEqual(dto.memberships.map((member: { organizationId: string }) => member.organizationId), ["org-a"]);
  assert.deepEqual(Object.keys(dto).sort(), ["id", "name", "role", "isActive", "isTeamMember", "email", "firstName", "lastName", "phone", "avatar", "image", "locale", "theme", "createdAt", "updatedAt", "memberOf", "memberships"].sort());
  assert.equal("password" in dto, false);
  assert.equal("businessHours" in dto, false);
});

test("same-organization target user DTO remains scoped and excludes secrets", async () => {
  reset();
  session = sessionFor("CUSTOMER");
  scopedMembershipRole = "MANAGER";
  usersById["target-user"] = userDto(membershipRows);
  const response = await userDetail.GET(request("https://platform.example/api/users/target-user", "GET"), userParams());
  assert.equal(response.status, 200);
  assert.deepEqual(getByIdCalls, [{ id: "target-user", organizationId: "org-a" }]);
  const dto = await response.json();
  assert.deepEqual(dto.memberships.map((member: { organizationId: string }) => member.organizationId), ["org-a"]);
  assert.equal("password" in dto, false);
});

test("non-SUPER_ADMIN cannot change a global role", async () => {
  reset();
  session = sessionFor("ADMIN");
  const response = await userDetail.PUT(request("https://platform.example/api/users/target-user", "PUT", { role: "ADMIN" }), userParams());
  assert.equal(response.status, 403);
  assert.deepEqual(serviceCalls, []);
  assert.deepEqual(writes, []);
});

test("user active-state route delegates to the organization membership service without raw user mutation", async () => {
  reset();
  session = sessionFor("MANAGER");
  scopedMembershipRole = "MANAGER";
  const response = await userDetail.PUT(request("https://platform.example/api/users/target-user", "PUT", { isActive: false }), userParams());
  assert.equal(response.status, 200);
  assert.equal(writes.includes("user.update"), false);
  assert.deepEqual(serviceCalls, [{ method: "change", args: [{ userId: "actor", organizationId: "org-a" }, "org-a", "member-org-a", { isActive: false }] }]);
});

test("scoped ADMIN and MANAGER cannot replace organization capabilities", async () => {
  for (const role of ["ADMIN", "MANAGER"]) {
    reset();
    session = sessionFor(role);
    scopedMembershipRole = role;
    const response = await capabilities.PUT(request("https://platform.example/api/organizations/org-a/capabilities", "PUT", { capabilities: [] }), orgParams());
    assert.equal(response.status, 403, `${role} is not platform SUPER_ADMIN`);
    assert.equal(writes.includes("$transaction"), false);
    assert.deepEqual(writes, []);
  }
});
