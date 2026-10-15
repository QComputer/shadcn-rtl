import assert from "node:assert/strict";
import { before, mock, test } from "node:test";

type JwtSession = { user?: { id?: string; role?: string; name?: string | null; email?: string | null; locale?: string | null; isTeamMember?: boolean | null; theme?: string | null; organizationId?: string | null } } | null;
let jwtSession: JwtSession = null;
let persistedRole: string | null = "CUSTOMER";
let persistedActive = true;
let membershipRole: string | null = "ADMIN";
let membershipActive = true;
let organizationActive = true;
let organizationDeletedAt: Date | null = null;
let memberUserActive = true;
let memberUserDeletedAt: Date | null = null;
const userQueries: Array<{ where: Record<string, unknown>; select?: Record<string, unknown> }> = [];
const membershipQueries: Array<Record<string, unknown>> = [];

const prisma = {
  user: {
    findFirst: async (query: { where: Record<string, unknown>; select?: Record<string, unknown> }) => {
      userQueries.push(query);
      if (!persistedActive || query.where.isActive !== true || query.where.deletedAt !== null) return null;
      if (query.where.role && query.where.role !== persistedRole) return null;
      return query.where.role ? { id: "actor" } : { role: persistedRole };
    },
  },
  organizationMember: {
    findFirst: async (query: Record<string, unknown>) => {
      membershipQueries.push(query);
      if (!membershipActive) return null;
      const include = query.include as { organization?: { select?: object }; user?: { select?: object } } | undefined;
      return {
        id: "membership-1",
        organizationId: "org-a",
        organizationSlug: "org-a",
        userId: "actor",
        role: membershipRole,
        isActive: membershipActive,
        joinedAt: new Date("2026-01-01T00:00:00.000Z"),
        organization: include?.organization ? { id: "org-a", slug: "org-a", type: "SHOP", name: "Org A", isActive: organizationActive, deletedAt: organizationDeletedAt } : undefined,
        user: include?.user ? { id: "actor", role: persistedRole, isActive: memberUserActive, deletedAt: memberUserDeletedAt } : undefined,
      };
    },
  },
};

mock.module("@/lib/auth", { namedExports: { auth: async () => jwtSession } });
mock.module("@/lib/db", { namedExports: { prisma, default: prisma } });

let guards: typeof import("@/lib/api-guards");
before(async () => { guards = await import("@/lib/api-guards"); });

function reset() {
  jwtSession = { user: { id: "actor", role: "CUSTOMER", name: "Actor", email: "actor@example.test", organizationId: "org-a" } };
  persistedRole = "CUSTOMER";
  persistedActive = true;
  membershipRole = "ADMIN";
  membershipActive = true;
  organizationActive = true;
  organizationDeletedAt = null;
  memberUserActive = true;
  memberUserDeletedAt = null;
  userQueries.length = 0;
  membershipQueries.length = 0;
}

const session = (role: string, organizationId: string | null = "org-a") => ({ user: { id: "actor", role, organizationId } }) as Parameters<typeof guards.requireOrgAccess>[0];
function hasStatus(status: number) {
  return (error: unknown) => error instanceof guards.ApiError && error.status === status;
}

test("requireAuthSession uses the persisted role instead of the JWT role", async () => {
  reset();
  jwtSession = { user: { id: "actor", role: "CUSTOMER", name: "Actor", email: "actor@example.test", organizationId: "org-a" } };
  persistedRole = "MANAGER";
  const current = await guards.requireAuthSession();
  assert.equal(current.user.role, "MANAGER");
  assert.equal(current.user.organizationId, "org-a");
  assert.deepEqual(userQueries[0], { where: { id: "actor", isActive: true, deletedAt: null }, select: { role: true } });
});

test("requireAuthSession rejects inactive persisted users", async () => {
  reset();
  persistedActive = false;
  await assert.rejects(guards.requireAuthSession(), hasStatus(401));
});

test("scoped CUSTOMER can exercise active organization ADMIN and MANAGER membership grants", async () => {
  for (const role of ["ADMIN", "MANAGER"]) {
    reset();
    membershipRole = role;
    const result = await guards.requireOrgAccess(session("CUSTOMER"), "org-a", ["ADMIN", "MANAGER"]);
    assert.equal(result?.role, role);
    assert.equal(guards.getMembershipRole(result), role);
  }
});

test("requireOrgAccess rejects a foreign tenant before membership lookup", async () => {
  reset();
  await assert.rejects(guards.requireOrgAccess(session("CUSTOMER"), "org-b"), hasStatus(403));
  assert.deepEqual(membershipQueries, []);
});

test("stale SUPER_ADMIN claims require persisted global authority", async () => {
  reset();
  persistedRole = "CUSTOMER";
  await assert.rejects(guards.requireOrgAccess(session("SUPER_ADMIN", null), "org-a"), hasStatus(403));
  assert.deepEqual(userQueries[0], { where: { id: "actor", role: "SUPER_ADMIN", isActive: true, deletedAt: null }, select: { id: true } });
});

test("current organization admin guard rejects sessions without explicit tenant context", async () => {
  reset();
  await assert.rejects(guards.requireCurrentOrgAdminOrManager(session("CUSTOMER", null)), hasStatus(403));
  assert.deepEqual(membershipQueries, []);
});

test("membership role helper does not fall back to the user's global role", () => {
  assert.equal(guards.getMembershipRole({ user: { role: "SUPER_ADMIN" } }), undefined);
  assert.equal(guards.getMembershipRole({ role: null, user: { role: "ADMIN" } }), undefined);
});

test("active membership resolution is deterministic by join time then id", async () => {
  reset();
  await guards.getActiveMembership("actor", "org-a");
  assert.deepEqual(membershipQueries[0], {
    where: { userId: "actor", isActive: true, organizationId: "org-a" },
    orderBy: [{ joinedAt: "asc" }, { id: "asc" }],
    include: {
      organization: { select: { id: true, slug: true, type: true, name: true, isActive: true, deletedAt: true } },
      user: { select: { id: true, role: true, isActive: true, deletedAt: true } },
    },
  });
});

test("manageable organization resolution rejects a mismatched requested tenant", async () => {
  reset();
  const current = session("CUSTOMER");
  await assert.rejects(guards.resolveManageableOrganizationId(current, "org-b"), hasStatus(403));
});
