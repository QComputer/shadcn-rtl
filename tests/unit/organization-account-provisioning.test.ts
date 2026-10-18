import assert from "node:assert/strict";
import test from "node:test";
import { OrganizationAccountProvisioningService } from "../../lib/user-provisioning/service";

type FakeUser = { id: string; name: string; role: string; isActive: boolean; deletedAt: Date | null; lockedUntil: Date | null };

function makeService(options: {
  actor?: Partial<FakeUser>;
  existing?: Partial<FakeUser>;
  membershipRole?: string;
  targetUserRole?: string;
  actorMembershipRole?: string;
  actorOrganizationId?: string;
  organizationVertical?: string;
} = {}) {
  const actor: FakeUser = { id: "actor-1", name: "operator", role: "SUPER_ADMIN", isActive: true, deletedAt: null, lockedUntil: null, ...options.actor };
  let existing = options.existing ? { id: "user-existing", name: "existing", role: "CUSTOMER", isActive: true, deletedAt: null, lockedUntil: null, ...options.existing } : null;
  const writes: { user?: Record<string, unknown>; membership?: Record<string, unknown>; audits: Record<string, unknown>[]; update?: Record<string, unknown>; hashes: string[] } = { audits: [], hashes: [] };
  const tx = {
    $queryRaw: async () => [{ id: "org-damoon" }],
    organization: { findFirst: async () => ({ id: "org-damoon", slug: "damoon-hotel", vertical: options.organizationVertical ?? "HOTEL" }) },
    user: {
      findFirst: async ({ where }: { where: Record<string, unknown> }) => {
        if (where.id === actor.id) return actor;
        const nameFilter = where.name as { equals?: string } | undefined;
        if (existing && nameFilter?.equals?.toLowerCase() === existing.name.toLowerCase()) return existing;
        if (where.id && existing?.id === where.id) return existing;
        return null;
      },
      create: async ({ data }: { data: Record<string, unknown> }) => {
        writes.user = data;
        existing = { id: "user-created", name: String(data.name), role: String(data.role), isActive: true, deletedAt: null, lockedUntil: null };
        return { id: existing.id, name: existing.name };
      },
      update: async ({ data }: { data: Record<string, unknown> }) => { writes.update = data; return { id: "user-target" }; },
    },
    organizationMember: {
      findFirst: async ({ where }: { where: Record<string, unknown> }) => {
        if (where.userId === actor.id) return options.actorMembershipRole === "ADMIN" ? { id: "admin-membership" } : null;
        return options.membershipRole ? { id: "target-membership", role: options.membershipRole, isActive: true, user: { role: options.targetUserRole ?? "CUSTOMER" } } : null;
      },
      findUnique: async () => options.membershipRole ? { id: "existing-membership", role: options.membershipRole, isActive: true } : null,
      create: async ({ data }: { data: Record<string, unknown> }) => { writes.membership = data; return { id: "membership-created", role: data.role }; },
    },
    auditLog: { create: async ({ data }: { data: Record<string, unknown> }) => { writes.audits.push(data); return data; } },
  };
  const db = { $transaction: async (callback: (arg: unknown) => unknown) => callback(tx) };
  const service = new OrganizationAccountProvisioningService(db as never, async (password) => { writes.hashes.push(password); return `hashed:${password}`; });
  return { service, writes };
}

const superAdmin = { userId: "actor-1", sessionRole: "SUPER_ADMIN" as const };
const input = { username: "Damoon-Manager", password: "demo-secret", role: "MANAGER" as const };

test("SUPER_ADMIN creates an email-free account with only an organization-scoped role and durable audit", async () => {
  const { service, writes } = makeService();
  const result = await service.provision(superAdmin, "org-damoon", { ...input, username: input.username.toLowerCase() });
  assert.equal(result.created, true);
  assert.equal(result.role, "MANAGER");
  assert.equal(writes.user?.role, "CUSTOMER");
  assert.equal(writes.user?.email, undefined);
  assert.equal(writes.user?.password, "hashed:demo-secret");
  assert.equal(writes.membership?.role, "MANAGER");
  assert.equal(writes.membership?.organizationId, "org-damoon");
  assert.equal(writes.audits.length, 1);
  const audit = JSON.stringify(writes.audits[0]);
  assert.doesNotMatch(audit, /demo-secret|hashed:/);
  assert.match(audit, /OrganizationAccount/);
});

test("organization ADMIN can create a scoped manager but cannot grant ADMIN or cross tenant", async () => {
  const { service } = makeService({ actor: { role: "CUSTOMER" }, actorMembershipRole: "ADMIN" });
  const actor = { userId: "actor-1", sessionRole: "CUSTOMER" as const, sessionOrganizationId: "org-damoon" };
  assert.equal((await service.provision(actor, "org-damoon", { ...input, username: "team-manager" })).role, "MANAGER");
  await assert.rejects(service.provision(actor, "org-damoon", { ...input, username: "another-admin", role: "ADMIN" }), /Only SUPER_ADMIN/);
  await assert.rejects(service.provision(actor, "foreign-org", { ...input, username: "foreign-manager" }), /Tenant context mismatch/);
});

test("existing matching account is idempotent and does not reset its password", async () => {
  const { service, writes } = makeService({
    actor: { role: "SUPER_ADMIN" },
    existing: { id: "user-existing", name: "damoon-manager" },
    membershipRole: "MANAGER",
  });
  const result = await service.provision(superAdmin, "org-damoon", { ...input, username: "damoon-manager" });
  assert.equal(result.created, false);
  assert.equal(result.userId, "user-existing");
  assert.equal(writes.hashes.length, 0);
  assert.equal(writes.user, undefined);
});

test("inactive, soft-deleted, or differently cased username collisions remain reserved", async () => {
  for (const existing of [
    { name: "damoon", deletedAt: new Date() },
    { name: "DAMOON", deletedAt: null },
  ]) {
    const { service, writes } = makeService({ existing });
    await assert.rejects(service.provision(superAdmin, "org-damoon", { ...input, username: "damoon" }), /Username is reserved/);
    assert.equal(writes.user, undefined);
  }
});

test("password reset is organization-scoped, rejects self-service misuse, and never audits secret data", async () => {
  const { service, writes } = makeService({ actorMembershipRole: "ADMIN", membershipRole: "MANAGER", actor: { role: "CUSTOMER" } });
  const actor = { userId: "actor-1", sessionRole: "CUSTOMER" as const, sessionOrganizationId: "org-damoon" };
  assert.deepEqual(await service.resetPassword(actor, "org-damoon", "user-target", "new-secret"), { success: true, userId: "user-target", organizationId: "org-damoon" });
  assert.equal(writes.update?.password, "hashed:new-secret");
  assert.equal(writes.update?.failedLoginAttempts, 0);
  assert.doesNotMatch(JSON.stringify(writes.audits), /new-secret|hashed:/);
  await assert.rejects(service.resetPassword(actor, "org-damoon", "actor-1", "new-secret"), /account password-change flow/);
  const { service: otherOrgService } = makeService({ actor: { role: "CUSTOMER" }, actorMembershipRole: "ADMIN" });
  await assert.rejects(otherOrgService.resetPassword(actor, "other-org", "user-target", "new-secret"), /Tenant context mismatch/);
  const { service: targetAdminService } = makeService({ actor: { role: "CUSTOMER" }, actorMembershipRole: "ADMIN", membershipRole: "ADMIN" });
  await assert.rejects(targetAdminService.resetPassword(actor, "org-damoon", "other-admin", "new-secret"), /cannot reset another administrator/);
  const platformTarget = makeService({ actor: { role: "SUPER_ADMIN" }, membershipRole: "ADMIN", targetUserRole: "SUPER_ADMIN" });
  await assert.rejects(platformTarget.service.resetPassword(superAdmin, "org-damoon", "user-target", "new-secret"), /Platform administrator credentials/);
});
