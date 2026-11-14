import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mock, test } from "node:test";
import type { PrismaClient } from "@prisma/client";

const enabled = process.env.ORGANIZATION_BUSINESS_HOURS_PG_ACCEPTANCE === "1";

mock.module("next/cache", { namedExports: { revalidatePath: () => undefined, revalidateTag: () => undefined } });

function assertGuardedDatabase() {
  assert.equal(process.env.DATABASE_URL, process.env.DIRECT_URL, "both Prisma URLs must target the same disposable database");
  const url = new URL(process.env.DATABASE_URL ?? "");
  assert.equal(process.env.NODE_ENV, "test");
  assert.equal(process.env.CI, "true");
  assert.notEqual(process.env.VERCEL_ENV, "production");
  assert.equal(process.env.DATABASE_RUNTIME_ADAPTER, "postgresql");
  assert.equal(url.protocol, "postgresql:");
  assert.equal(url.hostname, "127.0.0.1");
  assert.equal(url.port, "5432");
  assert.equal(url.pathname, "/organization_business_hours_test");
  assert.equal(decodeURIComponent(url.username), "organization_business_hours_test");
  assert.equal(decodeURIComponent(url.password), "local_only_synthetic_fixture");
}

test("organization business-hours replacement is atomic, scoped and includes inactive memberships on PostgreSQL 17", {
  skip: !enabled,
  concurrency: false,
}, async (t) => {
  assertGuardedDatabase();
  const { PrismaClient: Client } = await import("@prisma/client");
  const db: PrismaClient = new Client({ log: ["error"] });
  (globalThis as unknown as { bazarBazPrisma: PrismaClient | undefined }).bazarBazPrisma = db;
  const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
  const functionName = `test_org_hours_fail_${suffix}`;
  const triggerName = `test_org_hours_fail_${suffix}`;
  let organizationId: string | undefined;
  let otherOrganizationId: string | undefined;
  const userIds: string[] = [];

  try {
    const identity = await db.$queryRaw<Array<{ database: string; role: string; version_num: number }>>`
      SELECT current_database() AS database, current_user AS role, current_setting('server_version_num')::int AS version_num`;
    assert.equal(identity[0]?.database, "organization_business_hours_test");
    assert.equal(identity[0]?.role, "organization_business_hours_test");
    assert.ok((identity[0]?.version_num ?? 0) >= 170000 && (identity[0]?.version_num ?? 0) < 180000, "fixture must be PostgreSQL 17");

    const organization = await db.organization.create({ data: { type: "APPOINTMENT", name: `Hours ${suffix}`, slug: `hours-${suffix}` } });
    organizationId = organization.id;
    const otherOrganization = await db.organization.create({ data: { type: "APPOINTMENT", name: `Other hours ${suffix}`, slug: `other-hours-${suffix}` } });
    otherOrganizationId = otherOrganization.id;
    const users = await Promise.all(["active-a", "active-b", "inactive", "foreign"].map((key) => db.user.create({
      data: { name: `hours-${suffix}-${key}`, password: "synthetic-fixture-only", role: "STAFF" },
    })));
    userIds.push(...users.map(({ id }) => id));
    const [activeA, activeB, inactive, foreign] = users;
    await db.organizationMember.createMany({ data: [
      { organizationId, organizationSlug: organization.slug, userId: activeA.id, isActive: true },
      { organizationId, organizationSlug: organization.slug, userId: activeB.id, isActive: true },
      { organizationId, organizationSlug: organization.slug, userId: inactive.id, isActive: false },
      { organizationId: otherOrganizationId, organizationSlug: otherOrganization.slug, userId: foreign.id, isActive: true },
    ] });

    const seedHours = async (orgId: string, userId: string | null, openTime: string) => db.businessHour.create({
      data: { organizationId: orgId, userId, day: "MONDAY", openTime, closeTime: "12:00", isOpen: true },
    });
    await Promise.all([
      seedHours(organizationId, null, "08:00"),
      seedHours(organizationId, activeA.id, "08:00"),
      seedHours(organizationId, activeB.id, "08:00"),
      seedHours(organizationId, inactive.id, "07:00"),
      seedHours(otherOrganizationId, foreign.id, "06:00"),
    ]);

    const { organizationService } = await import("@/lib/services/organization.service");
    const replacement = [{ day: "MONDAY", openTime: "09:00", closeTime: "17:00", isOpen: true }];
    const rowsFor = async (orgId: string) => (await db.businessHour.findMany({ where: { organizationId: orgId } }))
      .map(({ userId, openTime }) => ({ userId, openTime }))
      .sort((left, right) => (left.userId ?? "").localeCompare(right.userId ?? ""));

    await t.test("writes organization and every member together, including inactive members; foreign tenant rows are preserved", async () => {
      await organizationService.updateBusinessHours(organizationId!, replacement);
      const actual = await rowsFor(organizationId!);
      assert.deepEqual(actual, [
        { userId: null, openTime: "09:00" },
        { userId: activeA.id, openTime: "09:00" },
        { userId: activeB.id, openTime: "09:00" },
        { userId: inactive.id, openTime: "09:00" },
      ].sort((left, right) => (left.userId ?? "").localeCompare(right.userId ?? "")));
      assert.deepEqual(await rowsFor(otherOrganizationId!), [
        { userId: foreign.id, openTime: "06:00" },
      ]);
    });

    await t.test("a later member insert failure rolls back organization and earlier-member writes in PostgreSQL", async () => {
      const before = await rowsFor(organizationId!);
      const members = await db.organizationMember.findMany({ where: { organizationId }, orderBy: { userId: "asc" }, select: { userId: true } });
      assert.ok(members.length >= 2, "fixture must have earlier member writes before the injected failure");
      const failingUserId = members.at(-1)!.userId;
      await db.$executeRawUnsafe(`CREATE FUNCTION "${functionName}"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."organizationId" = TG_ARGV[0] AND NEW."userId" = TG_ARGV[1] THEN IF NOT EXISTS (SELECT 1 FROM "BusinessHour" WHERE "organizationId" = TG_ARGV[0] AND "userId" <> TG_ARGV[1] AND "openTime" = TG_ARGV[2]) THEN RAISE EXCEPTION 'prior member write was not visible'; END IF; RAISE EXCEPTION 'intentional disposable integration failure'; END IF; RETURN NEW; END $$`);
      await db.$executeRawUnsafe(`CREATE TRIGGER "${triggerName}" BEFORE INSERT ON "BusinessHour" FOR EACH ROW EXECUTE FUNCTION "${functionName}"('${organizationId}', '${failingUserId}', '10:00')`);
      try {
        await assert.rejects(organizationService.updateBusinessHours(organizationId!, [{ ...replacement[0]!, openTime: "10:00" }]), /intentional disposable integration failure/);
        assert.deepEqual(await rowsFor(organizationId!), before, "PostgreSQL must roll back the deleted and inserted organization and member rows");
        assert.deepEqual(await rowsFor(otherOrganizationId!), [
          { userId: foreign.id, openTime: "06:00" },
        ]);
      } finally {
        await db.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "${triggerName}" ON "BusinessHour"`);
        await db.$executeRawUnsafe(`DROP FUNCTION IF EXISTS "${functionName}"()`);
      }
    });

    await t.test("empty schedule clears organization and all member rows while preserving the foreign tenant", async () => {
      await organizationService.updateBusinessHours(organizationId!, []);
      const actual = await rowsFor(organizationId!);
      assert.deepEqual(actual, []);
      assert.deepEqual(await rowsFor(otherOrganizationId!), [
        { userId: foreign.id, openTime: "06:00" },
      ]);
    });
  } finally {
    const fixtureOrganizationIds = [organizationId, otherOrganizationId].filter((value): value is string => Boolean(value));
    if (fixtureOrganizationIds.length) {
      await db.businessHour.deleteMany({ where: { organizationId: { in: fixtureOrganizationIds } } });
      await db.organizationMember.deleteMany({ where: { organizationId: { in: fixtureOrganizationIds } } });
      await db.organization.deleteMany({ where: { id: { in: fixtureOrganizationIds } } });
    }
    if (userIds.length) await db.user.deleteMany({ where: { id: { in: userIds } } });
    await db.$disconnect();
  }
});
