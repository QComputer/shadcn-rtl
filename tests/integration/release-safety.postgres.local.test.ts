import assert from "node:assert/strict";
import { test } from "node:test";
import { execFileSync } from "node:child_process";
import { setTimeout as pause } from "node:timers/promises";
import { PrismaClient } from "@prisma/client";
import { OrganizationMembershipService } from "@/lib/services/organization-membership.service";
import { userService } from "@/lib/services/user.service";
import { organizationService } from "@/lib/services/organization.service";
import { prisma as sharedDb } from "@/lib/db";
import { ApiError } from "@/lib/api-guards";

const enabled = process.env.HOTEL_ONBOARDING_PG_ACCEPTANCE === "1";
test("release safety on the identified disposable PostgreSQL target", { skip: !enabled }, async (t) => {
  const runId = process.env.HOTEL_ONBOARDING_RUN_ID;
  assert.match(runId ?? "", /^[a-f0-9]{12}$/);
  const target = new URL(process.env.DATABASE_URL ?? "");
  assert.equal(target.hostname, "127.0.0.1");
  assert.equal(target.pathname, `/hotel_onboarding_${runId}`);
  assert.equal(target.username, "hotel_onboarding_test");
  assert.equal(process.env.DIRECT_URL, process.env.DATABASE_URL);
  assert.notEqual(process.env.NODE_ENV, "production");
  const id = process.env.HOTEL_ONBOARDING_CONTAINER_ID;
  assert.match(id ?? "", /^[a-f0-9]{64}$/);
  const [container] = JSON.parse(execFileSync("docker", ["inspect", id!], { encoding: "utf8" }));
  assert.equal(container.Config.Labels["codex.run_id"], runId);
  assert.equal(container.Config.Labels["codex.task"], "hotel-secure-onboarding");
  const db = new PrismaClient();
  const db2 = new PrismaClient();
  const service = new OrganizationMembershipService(db);
  const service2 = new OrganizationMembershipService(db2);
  const org = await db.organization.create({ data: { name: "Synthetic safety A", slug: `safety-a-${runId}`, type: "SHOP" } });
  const foreign = await db.organization.create({ data: { name: "Synthetic safety B", slug: `safety-b-${runId}`, type: "SHOP" } });
  const user = async (key: string, role: "CUSTOMER" | "SUPER_ADMIN" = "CUSTOMER") => db.user.create({ data: { name: `safety-${key}-${runId}`, password: "NOT_A_LOGIN_FIXTURE", role } });
  const [operator, admin, admin2, manager, staff, other] = await Promise.all([user("operator", "SUPER_ADMIN"), user("admin"), user("admin2"), user("manager"), user("staff"), user("foreign")]);
  const add = (userId: string, role: "ADMIN" | "MANAGER" | "STAFF", organization = org) => db.organizationMember.create({ data: { organizationId: organization.id, organizationSlug: organization.slug, userId, role } });
  const [a, a2, m, s, b] = await Promise.all([add(admin.id, "ADMIN"), add(admin2.id, "ADMIN"), add(manager.id, "MANAGER"), add(staff.id, "STAFF"), add(other.id, "ADMIN", foreign)]);
  const platform = { userId: operator.id };
  const tenantManager = { userId: manager.id, organizationId: org.id };
  const tenantAdmin = { userId: admin.id, organizationId: org.id };
  const denied = (status: number) => (error: unknown) => error instanceof ApiError && error.status === status;
  try {
    await t.test("manager cannot deactivate/demote Admin, grant Admin, or mutate foreign membership", async () => {
      await assert.rejects(service.change(tenantManager, org.id, a.id, { isActive: false }), denied(403));
      await assert.rejects(service.change(tenantManager, org.id, a.id, { role: "STAFF" }), denied(403));
      await assert.rejects(service.change(tenantManager, org.id, s.id, { role: "ADMIN" }), denied(403));
      await assert.rejects(service.add(tenantManager, org.id, other.id, "ADMIN"), denied(403));
      await assert.rejects(service.change(tenantManager, foreign.id, b.id, { isActive: false }), denied(403));
      await assert.rejects(service.change(tenantAdmin, org.id, b.id, { isActive: false }), denied(404));
      await assert.rejects(userService.updateMembershipIsActive(a.id, false, tenantManager, org.id), denied(403));
      assert.equal((await db.organizationMember.findUniqueOrThrow({ where: { id: a.id } })).isActive, true);
    });
    await t.test("scoped role changes preserve global roles and other memberships", async () => {
      const second = await add(staff.id, "STAFF", foreign);
      await organizationService.updateMemberRole(org.id, staff.id, "MANAGER", tenantAdmin);
      assert.equal((await db.user.findUniqueOrThrow({ where: { id: staff.id } })).role, "CUSTOMER");
      assert.equal((await db.organizationMember.findUniqueOrThrow({ where: { id: second.id } })).role, "STAFF");
      assert.equal((await db.organizationMember.findUniqueOrThrow({ where: { id: s.id } })).role, "MANAGER");
    });
    await t.test("independent concurrent Admin removals leave one active Admin", async () => {
      let unlock!: () => void;
      let locked!: () => void;
      const barrier = new Promise<void>((resolve) => { unlock = resolve; });
      const ready = new Promise<void>((resolve) => { locked = resolve; });
      const holder = db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "Organization" WHERE "id"=${org.id} FOR UPDATE`;
        locked(); await barrier;
      }, { timeout: 15000 });
      await ready;
      const operations = [service.change(platform, org.id, a.id, { isActive: false }), service2.change(platform, org.id, a2.id, { isActive: false })];
      const settled = Promise.allSettled(operations);
      try {
        let observed = false;
        for (let attempt = 0; attempt < 100; attempt++) {
          const [row] = await sharedDb.$queryRaw<Array<{ count: number }>>`SELECT count(*)::int AS count FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND position('Organization' in query)>0`;
          if (row.count >= 2) { observed = true; break; }
          await pause(30);
        }
        assert.equal(observed, true, "two actual independent writers must overlap on the organization lock");
      } finally { unlock(); await holder; }
      const result = await settled;
      assert.equal(result.filter((item) => item.status === "fulfilled").length, 1);
      assert.equal(result.filter((item) => item.status === "rejected").length, 1);
      assert.equal(await db.organizationMember.count({ where: { organizationId: org.id, role: "ADMIN", isActive: true } }), 1);
      assert.equal((await db.user.findUniqueOrThrow({ where: { id: admin.id } })).role, "CUSTOMER");
    });
    await t.test("alternate services and global disable/delete cannot remove the last Admin", async () => {
      const last = await db.organizationMember.findFirstOrThrow({ where: { organizationId: org.id, role: "ADMIN", isActive: true } });
      await assert.rejects(userService.updateMembershipIsActive(last.id, false, platform, org.id), denied(409));
      await assert.rejects(organizationService.removeMember(org.id, last.userId, platform), denied(409));
      await assert.rejects(service.changeGlobalUser(platform, last.userId, { isActive: false }), denied(409));
      await assert.rejects(userService.delete(last.userId, platform), denied(409));
      assert.equal((await db.user.findUniqueOrThrow({ where: { id: last.userId } })).deletedAt, null);
    });
    await t.test("Hotel privileged additions must use identity-bound activation", async () => {
      const hotel = await db.organization.create({ data: { name: "Synthetic Hotel", slug: `safety-hotel-${runId}`, type: "SHOP", vertical: "HOTEL" } });
      await assert.rejects(service.add(platform, hotel.id, staff.id, "ADMIN"), denied(403));
      assert.equal(await db.organizationMember.count({ where: { organizationId: hotel.id } }), 0);
      const inactive = await db.organizationMember.create({ data: { organizationId: hotel.id, organizationSlug: hotel.slug, userId: staff.id, role: "ADMIN", isActive: false } });
      await assert.rejects(service.change(platform, hotel.id, inactive.id, { isActive: true }), denied(403));
      assert.equal((await db.organizationMember.findUniqueOrThrow({ where: { id: inactive.id } })).isActive, false);
    });
    await t.test("audit failure rolls back membership, flags and new associations", async () => {
      const target = await user("audit");
      const before = await db.organizationMember.findUniqueOrThrow({ where: { id: m.id } });
      await db.$executeRawUnsafe(`CREATE FUNCTION release_safety_audit_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."entityType"='OrganizationMember' THEN RAISE EXCEPTION 'synthetic audit failure'; END IF; RETURN NEW; END $$`);
      await db.$executeRawUnsafe(`CREATE TRIGGER release_safety_audit_failure BEFORE INSERT ON "AuditLog" FOR EACH ROW EXECUTE FUNCTION release_safety_audit_failure()`);
      try {
        await assert.rejects(service.change(platform, org.id, m.id, { isActive: false }));
        await assert.rejects(service.add(platform, org.id, target.id, "STAFF"));
        assert.equal((await db.organizationMember.findUniqueOrThrow({ where: { id: m.id } })).isActive, before.isActive);
        assert.equal(await db.organizationMember.count({ where: { userId: target.id } }), 0);
        assert.equal((await db.user.findUniqueOrThrow({ where: { id: target.id } })).isTeamMember, false);
      } finally {
        await db.$executeRawUnsafe(`DROP TRIGGER release_safety_audit_failure ON "AuditLog"`);
        await db.$executeRawUnsafe(`DROP FUNCTION release_safety_audit_failure()`);
      }
    });
    await t.test("user projections omit authentication material and foreign memberships", async () => {
      const profile = await userService.getById(staff.id, org.id);
      assert.ok(profile);
      assert.equal(profile.memberOf.every((member) => member.organizationId === org.id), true);
      const serialized = JSON.stringify(profile);
      for (const field of ["password", "lockedUntil", "failedLoginAttempts", "passwordResets", "emailVerified"]) assert.equal(serialized.includes(`"${field}"`), false);
    });
    await t.test("platform self-demotion is denied and global audit failures roll back", async () => {
      await assert.rejects(service.changeGlobalUser(platform, operator.id, { role: "CUSTOMER" }), denied(403));
      const target = await user("global-audit");
      await db.$executeRawUnsafe(`CREATE FUNCTION release_safety_global_audit_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."entityType"='User' THEN RAISE EXCEPTION 'synthetic global audit failure'; END IF; RETURN NEW; END $$`);
      await db.$executeRawUnsafe(`CREATE TRIGGER release_safety_global_audit_failure BEFORE INSERT ON "AuditLog" FOR EACH ROW EXECUTE FUNCTION release_safety_global_audit_failure()`);
      try {
        await assert.rejects(service.changeGlobalUser(platform, target.id, { isActive: false }));
        assert.equal((await db.user.findUniqueOrThrow({ where: { id: target.id } })).isActive, true);
        assert.equal(await db.auditLog.count({ where: { entityType: "User", entityId: target.id } }), 0);
      } finally {
        await db.$executeRawUnsafe(`DROP TRIGGER release_safety_global_audit_failure ON "AuditLog"`);
        await db.$executeRawUnsafe(`DROP FUNCTION release_safety_global_audit_failure()`);
      }
    });
  } finally { await Promise.all([db.$disconnect(), db2.$disconnect(), sharedDb.$disconnect()]); }
});
