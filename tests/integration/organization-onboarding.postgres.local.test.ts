import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { test } from "node:test";
import { setTimeout as pause } from "node:timers/promises";
import { PrismaClient } from "@prisma/client";
import { OrganizationOnboardingError, OrganizationOnboardingService } from "@/lib/organization-onboarding/service";
import { HotelWebsiteManagementService } from "@/lib/hotel/content/hotel-website-management.service";
import { getPublishedHotelWebsite, resolveHotelWebsiteTenantForHost } from "@/lib/hotel/content/hotel-website-public.service";

const enabled = process.env.HOTEL_ONBOARDING_PG_ACCEPTANCE === "1";

function guardTarget() {
  const runId = process.env.HOTEL_ONBOARDING_RUN_ID;
  const url = new URL(process.env.DATABASE_URL ?? "http://invalid");
  assert.match(runId ?? "", /^[a-f0-9]{12}$/);
  assert.equal(process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production", false);
  assert.equal(url.protocol, "postgresql:");
  assert.equal(url.hostname, "127.0.0.1");
  assert.equal(url.pathname, `/hotel_onboarding_${runId}`);
  assert.equal(url.username, "hotel_onboarding_test");
  assert.equal(process.env.DIRECT_URL, process.env.DATABASE_URL);
  const id = process.env.HOTEL_ONBOARDING_CONTAINER_ID;
  assert.match(id ?? "", /^[a-f0-9]{64}$/);
  const [container] = JSON.parse(execFileSync("docker", ["inspect", id!], { encoding: "utf8" }));
  assert.equal(container.Config.Labels["codex.task"], "hotel-secure-onboarding");
  assert.equal(container.Config.Labels["codex.run_id"], runId);
  assert.deepEqual(container.NetworkSettings.Ports["5432/tcp"], [{ HostIp: "127.0.0.1", HostPort: url.port }]);
  return runId!;
}

test("secure organization onboarding on an identified disposable PostgreSQL 17", { skip: !enabled, concurrency: false }, async (t) => {
  const runId = guardTarget();
  const db = new PrismaClient();
  const service = new OrganizationOnboardingService(db);
  const management = new HotelWebsiteManagementService(db);
  const operator = await db.user.create({ data: { name: `operator-${runId}`, role: "SUPER_ADMIN", password: "not-a-login-fixture" } });
  const actor = { userId: operator.id, role: "SUPER_ADMIN" as const };
  const payload = { name: "Synthetic Hotel A", slug: `synthetic-hotel-${runId}`, property: { name: "Synthetic property", slug: "main" }, locale: "fa" as const };
  let hotel: Awaited<ReturnType<typeof service.bootstrapHotel>>;
  const expectCode = (code: string) => (error: unknown) => error instanceof OrganizationOnboardingError && error.code === code;
  async function waitForLockWaiters(expected: number, table: string) {
    for (let attempt = 0; attempt < 100; attempt++) {
      const [{ count }] = await db.$queryRaw<Array<{ count: number }>>`SELECT count(*)::int AS count FROM pg_stat_activity WHERE datname = current_database() AND pid <> pg_backend_pid() AND wait_event_type = 'Lock' AND position(${table} in query) > 0`;
      if (count >= expected) return;
      await pause(30);
    }
    assert.fail(`Did not observe ${expected} overlapping operations waiting on ${table}`);
  }
  async function recipient(key: string, verified = true) {
    const email = `${runId}-${key}@example.invalid`;
    const user = await db.user.create({ data: { name: `${runId}-${key}`, password: "not-a-login-fixture", email, emailVerified: verified ? new Date() : null } });
    if (verified) await db.emailVerification.create({ data: { userId: user.id, email, token: randomBytes(32).toString("hex"), verifiedAt: new Date(), expiresAt: new Date(Date.now() + 3600000) } });
    return user;
  }
  async function invite(user: Awaited<ReturnType<typeof recipient>>, role: "ADMIN" | "MANAGER", key: string, organizationId = hotel.organizationId) {
    return service.issueInvitation(actor, { organizationId, recipientUserId: user.id, recipientEmail: user.email!, recipientUsername: user.name, invitedRole: role, ttlHours: 24 }, `${runId}-${key}`);
  }
  try {
    await t.test("real target identity and no pre-existing organization data", async () => {
      const [identity] = await db.$queryRaw<Array<{ db: string; role: string; major: number }>>`SELECT current_database()::text AS db, current_user::text AS role, current_setting('server_version_num')::int / 10000 AS major`;
      assert.deepEqual(identity, { db: `hotel_onboarding_${runId}`, role: "hotel_onboarding_test", major: 17 });
      assert.equal(await db.organization.count(), 0);
    });
    await t.test("concurrent independent connections create exactly one organization, property, capability and audit", async () => {
      const clients = Array.from({ length: 5 }, () => new PrismaClient());
      const blocker = new PrismaClient();
      let release!: () => void;
      let ready!: () => void;
      const gate = new Promise<void>((resolve) => { release = resolve; });
      const held = new Promise<void>((resolve) => { ready = resolve; });
      const lock = blocker.$transaction(async (tx) => {
        await tx.$executeRawUnsafe('LOCK TABLE "Organization" IN SHARE MODE');
        ready();
        await gate;
      }, { timeout: 15000 });
      try {
        await held;
        const pending = Promise.allSettled(clients.map((client) => new OrganizationOnboardingService(client).bootstrapHotel(actor, payload, `${runId}-bootstrap`)));
        try { await waitForLockWaiters(5, "Organization"); }
        finally { release(); }
        const settled = await pending;
        for (const result of settled) if (result.status === "rejected") throw result.reason;
        const results = settled.map((result) => { assert.equal(result.status, "fulfilled"); return result.value; });
        hotel = results[0];
        assert.equal(new Set(results.map((item) => item.organizationId)).size, 1);
        assert.equal(results.filter((item) => !item.replayed).length, 1);
        assert.equal(await db.organization.count({ where: { slug: payload.slug } }), 1);
        assert.equal(await db.hotelProperty.count({ where: { organizationId: hotel.organizationId } }), 1);
        assert.equal(await db.auditLog.count({ where: { entityType: "HotelOrganizationOnboarding", organizationId: hotel.organizationId } }), 1);
        const caps = await db.organizationCapability.findMany({ where: { organizationId: hotel.organizationId } });
        assert.equal(caps.length, 1);
        assert.equal(caps[0].key, "HOTEL_WEBSITE");
        assert.ok(caps[0].enabledAt);
      } finally { release(); await lock; await Promise.all([...clients, blocker].map((client) => client.$disconnect())); }
    });
    await t.test("retries preserve edits, and conflicting slugs, keys and actors cannot seize a tenant", async () => {
      await db.organization.update({ where: { id: hotel.organizationId }, data: { description: "preserve owner data" } });
      assert.equal((await service.bootstrapHotel(actor, payload, `${runId}-bootstrap`)).replayed, true);
      assert.equal((await db.organization.findUniqueOrThrow({ where: { id: hotel.organizationId } })).description, "preserve owner data");
      await assert.rejects(service.bootstrapHotel(actor, { ...payload, name: "Different" }, `${runId}-bootstrap`), expectCode("ORGANIZATION_IDENTITY_CONFLICT"));
      const legacy = await db.organization.create({ data: { name: "Legacy organization", slug: `legacy-${runId}`, type: "SHOP" } });
      await assert.rejects(service.bootstrapHotel(actor, { ...payload, slug: legacy.slug }, `${runId}-legacy`), expectCode("ORGANIZATION_IDENTITY_CONFLICT"));
      await assert.rejects(service.bootstrapHotel(actor, { ...payload, slug: `other-${runId}` }, `${runId}-bootstrap`), expectCode("IDEMPOTENCY_CONFLICT"));
      const user = await recipient("not-operator");
      await assert.rejects(service.bootstrapHotel({ userId: user.id, role: "SUPER_ADMIN" }, payload, `${runId}-bootstrap`), expectCode("PLATFORM_ADMIN_REQUIRED"));
    });
    const admin = await recipient("admin");
    const manager = await recipient("manager");
    await t.test("verified identity is required, not a matching username or historical verification timestamp", async () => {
      const unverified = await recipient("unverified", false);
      await assert.rejects(invite(unverified, "ADMIN", "unverified"), expectCode("VERIFIED_RECIPIENT_IDENTITY_REQUIRED"));
      await db.user.update({ where: { id: unverified.id }, data: { emailVerified: new Date() } });
      await assert.rejects(invite(unverified, "ADMIN", "stale-proof"), expectCode("VERIFIED_RECIPIENT_IDENTITY_REQUIRED"));
      await assert.rejects(service.issueInvitation(actor, { organizationId: hotel.organizationId, recipientUserId: admin.id, recipientEmail: manager.email!, recipientUsername: admin.name, invitedRole: "ADMIN", ttlHours: 24 }, `${runId}-wrong-email`), expectCode("VERIFIED_RECIPIENT_IDENTITY_REQUIRED"));
    });
    await t.test("issuance is actor-bound/idempotent and never recovers a raw token", async () => {
      const issued = await invite(admin, "ADMIN", "admin-invite");
      assert.match(issued.oneTimeToken ?? "", /^[A-Za-z0-9_-]{43}$/);
      const row = await db.organizationInvitation.findUniqueOrThrow({ where: { id: issued.invitationId } });
      assert.notEqual(row.tokenHash, issued.oneTimeToken);
      assert.equal((await invite(admin, "ADMIN", "admin-invite")).oneTimeToken, null);
      await assert.rejects(invite(admin, "MANAGER", "admin-invite"), expectCode("IDEMPOTENCY_CONFLICT"));
      await assert.rejects(service.redeemInvitation({ userId: manager.id, role: "CUSTOMER" }, issued.oneTimeToken!), expectCode("INVITATION_INVALID"));
      await service.redeemInvitation({ userId: admin.id, role: "CUSTOMER" }, issued.oneTimeToken!);
      await assert.rejects(service.redeemInvitation({ userId: admin.id, role: "CUSTOMER" }, issued.oneTimeToken!), expectCode("INVITATION_ALREADY_USED"));
      assert.equal((await db.user.findUniqueOrThrow({ where: { id: admin.id } })).role, "CUSTOMER");
    });
    await t.test("parallel redemption is single-use and creates exactly one scoped manager membership and audit", async () => {
      const invitation = await invite(manager, "MANAGER", "manager-invite");
      const otherDb = new PrismaClient();
      const blocker = new PrismaClient();
      let release!: () => void;
      let ready!: () => void;
      const gate = new Promise<void>((resolve) => { release = resolve; });
      const held = new Promise<void>((resolve) => { ready = resolve; });
      const lock = blocker.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "OrganizationInvitation" WHERE id=${invitation.invitationId} FOR UPDATE`;
        ready();
        await gate;
      }, { timeout: 15000 });
      try {
        await held;
        const pending = Promise.allSettled([service.redeemInvitation({ userId: manager.id, role: "CUSTOMER" }, invitation.oneTimeToken!), new OrganizationOnboardingService(otherDb).redeemInvitation({ userId: manager.id, role: "CUSTOMER" }, invitation.oneTimeToken!)]);
        try { await waitForLockWaiters(2, "OrganizationInvitation"); }
        finally { release(); }
        const results = await pending;
        assert.equal(results.filter((item) => item.status === "fulfilled").length, 1);
        assert.equal(await db.organizationMember.count({ where: { organizationId: hotel.organizationId, userId: manager.id } }), 1);
        assert.equal(await db.auditLog.count({ where: { entityId: invitation.invitationId, action: "UPDATE" } }), 1);
        assert.equal((await db.user.findUniqueOrThrow({ where: { id: manager.id } })).role, "CUSTOMER");
      } finally { release(); await lock; await Promise.all([otherDb, blocker].map((client) => client.$disconnect())); }
    });
    await t.test("invalid, legacy-unbound, expired and revoked invitations fail without membership writes", async (context) => {
      const user = await recipient("negative");
      await assert.rejects(service.redeemInvitation({ userId: user.id, role: "CUSTOMER" }, randomBytes(32).toString("base64url")), expectCode("INVITATION_INVALID"));
      const expired = await invite(user, "MANAGER", "expired");
      // Advance only the service clock; do not mutate the immutable expiry.
      context.mock.timers.enable({ apis: ["Date"], now: Date.now() + 48 * 3600000 });
      try { await assert.rejects(service.redeemInvitation({ userId: user.id, role: "CUSTOMER" }, expired.oneTimeToken!), expectCode("INVITATION_EXPIRED")); }
      finally { context.mock.timers.reset(); }
      const revoked = await invite(user, "MANAGER", "revoked");
      await service.revokeInvitation(actor, revoked.invitationId);
      await assert.rejects(service.redeemInvitation({ userId: user.id, role: "CUSTOMER" }, revoked.oneTimeToken!), expectCode("INVITATION_REVOKED"));
      const token = randomBytes(32).toString("base64url");
      const { createHash } = await import("node:crypto");
      await db.organizationInvitation.create({ data: { organizationId: hotel.organizationId, invitedRole: "ADMIN", tokenHash: createHash("sha256").update(token).digest("hex"), expiresAt: new Date(Date.now() + 3600000) } });
      await assert.rejects(service.redeemInvitation({ userId: user.id, role: "CUSTOMER" }, token), expectCode("INVITATION_INVALID"));
      assert.equal(await db.organizationMember.count({ where: { userId: user.id } }), 0);
    });
    await t.test("database binding, recipient FK and terminal-state constraints cannot be bypassed", async () => {
      const user = await recipient("binding");
      const invitation = await invite(user, "ADMIN", "binding");
      await assert.rejects(db.organizationInvitation.update({ where: { id: invitation.invitationId }, data: { recipientUserId: manager.id } }));
      await assert.rejects(db.organizationInvitation.update({ where: { id: invitation.invitationId }, data: { status: "CLAIMED", claimedByUserId: null } }));
      await assert.rejects(db.user.delete({ where: { id: user.id } }));
      await service.revokeInvitation(actor, invitation.invitationId);
      await assert.rejects(db.organizationInvitation.update({ where: { id: invitation.invitationId }, data: { status: "CREATED" } }));
    });
    await t.test("current identity and capability revocation block activation and cached issuance", async () => {
      const user = await recipient("current");
      const invitation = await invite(user, "ADMIN", "current");
      await db.user.update({ where: { id: user.id }, data: { emailVerified: null } });
      await assert.rejects(service.redeemInvitation({ userId: user.id, role: "CUSTOMER" }, invitation.oneTimeToken!), expectCode("VERIFIED_RECIPIENT_IDENTITY_REQUIRED"));
      await db.user.update({ where: { id: user.id }, data: { emailVerified: new Date() } });
      await db.organizationCapability.update({ where: { organizationId_key: { organizationId: hotel.organizationId, key: "HOTEL_WEBSITE" } }, data: { status: "INACTIVE", disabledAt: new Date() } });
      await assert.rejects(service.redeemInvitation({ userId: user.id, role: "CUSTOMER" }, invitation.oneTimeToken!), expectCode("ACTIVE_HOTEL_WEBSITE_REQUIRED"));
      await assert.rejects(invite(user, "ADMIN", "current"), expectCode("ACTIVE_HOTEL_WEBSITE_REQUIRED"));
      await db.organizationCapability.update({ where: { organizationId_key: { organizationId: hotel.organizationId, key: "HOTEL_WEBSITE" } }, data: { status: "ACTIVE", disabledAt: null } });
    });
    const other = await service.bootstrapHotel(actor, { ...payload, slug: `second-${runId}` }, `${runId}-second`);
    await t.test("existing foreign memberships cannot be silently reassigned", async () => {
      await assert.rejects(invite(manager, "MANAGER", "foreign-member", other.organizationId), expectCode("RECIPIENT_MEMBERSHIP_CONFLICT"));
      assert.equal(await db.organizationMember.count({ where: { userId: manager.id, organizationId: other.organizationId } }), 0);
    });
    await t.test("manager cannot provision, grant membership, review or publish; tenant admin remains organization-scoped", async () => {
      const principal = { userId: manager.id, role: "CUSTOMER" as const, organizationId: hotel.organizationId };
      const scope = { organizationId: hotel.organizationId, propertyId: hotel.propertyId };
      const content = { title: { fa: "نمونهٔ مصنوعی آزمون" }, hero: { heading: { fa: "نمونه" } }, introduction: { body: { fa: "صرفاً دادهٔ مصنوعی آزمون" } }, sections: [], contact: {} };
      const draft = await management.createDraft(principal, scope, { content, media: [] }, `${runId}-draft`);
      await assert.rejects(service.bootstrapHotel({ userId: manager.id, role: "MANAGER" }, payload, `${runId}-manager-bootstrap`), expectCode("PLATFORM_ADMIN_REQUIRED"));
      await assert.rejects(management.decide(principal, scope, draft.result.id, "APPROVED", undefined, `${runId}-manager-review`));
      await assert.rejects(management.publish(principal, scope, draft.result.id, `${runId}-manager-publish`));
      await assert.rejects(management.listRevisions({ ...principal, organizationId: other.organizationId }, { organizationId: other.organizationId, propertyId: other.propertyId }));
      const preview = await management.preview(principal, scope, draft.result.id, "fa");
      assert.equal(preview.mode, "PREVIEW");
      const unpublished = await getPublishedHotelWebsite({ host: "bazarbaaz.ir", organizationSlug: hotel.organizationSlug, propertySlug: hotel.propertySlug, locale: "fa", db });
      assert.equal(unpublished?.mode, "UNPUBLISHED");
      await management.submit(principal, scope, draft.result.id, undefined, `${runId}-submit`);
      const adminPrincipal = { userId: admin.id, role: "CUSTOMER" as const, organizationId: hotel.organizationId };
      await management.decide(adminPrincipal, scope, draft.result.id, "APPROVED", undefined, `${runId}-approve`);
      const publication = await management.publish(adminPrincipal, scope, draft.result.id, `${runId}-publish`);
      assert.equal((await getPublishedHotelWebsite({ host: "bazarbaaz.ir", organizationSlug: hotel.organizationSlug, propertySlug: hotel.propertySlug, locale: "fa", db }))?.mode, "PUBLISHED");
      assert.equal(await resolveHotelWebsiteTenantForHost("foreign.invalid", db, hotel.organizationSlug), null);
      await management.revoke(adminPrincipal, scope, publication.result.publicationId, "Synthetic test", `${runId}-revoke-publication`);
      assert.equal((await getPublishedHotelWebsite({ host: "bazarbaaz.ir", organizationSlug: hotel.organizationSlug, propertySlug: hotel.propertySlug, locale: "fa", db }))?.mode, "UNPUBLISHED");
    });
    await t.test("audit insertion failure rolls back bootstrap, invitation issuance, redemption and revocation", async () => {
      await db.$executeRawUnsafe(`CREATE TABLE onboarding_test_audit_failure (entity text PRIMARY KEY)`);
      await db.$executeRawUnsafe(`CREATE FUNCTION onboarding_test_audit_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF EXISTS (SELECT 1 FROM onboarding_test_audit_failure WHERE entity=NEW."entityType") THEN RAISE EXCEPTION 'synthetic audit failure'; END IF; RETURN NEW; END $$`);
      await db.$executeRawUnsafe(`CREATE TRIGGER onboarding_test_audit_failure BEFORE INSERT ON "AuditLog" FOR EACH ROW EXECUTE FUNCTION onboarding_test_audit_failure()`);
      try {
        await db.$executeRaw`INSERT INTO onboarding_test_audit_failure VALUES ('HotelOrganizationOnboarding')`;
        const slug = `rollback-${runId}`;
        await assert.rejects(service.bootstrapHotel(actor, { ...payload, slug }, `${runId}-rollback`));
        assert.equal(await db.organization.count({ where: { slug } }), 0);
        await db.$executeRaw`DELETE FROM onboarding_test_audit_failure`;
        const user = await recipient("audit");
        await db.$executeRaw`INSERT INTO onboarding_test_audit_failure VALUES ('BoundOrganizationInvitation')`;
        await assert.rejects(invite(user, "ADMIN", "audit-issue"));
        assert.equal(await db.organizationInvitation.count({ where: { issuanceKey: `${runId}-audit-issue` } }), 0);
        await db.$executeRaw`DELETE FROM onboarding_test_audit_failure`;
        const invitation = await invite(user, "ADMIN", "audit-issue");
        await db.$executeRaw`INSERT INTO onboarding_test_audit_failure VALUES ('BoundOrganizationInvitation')`;
        await assert.rejects(service.redeemInvitation({ userId: user.id, role: "CUSTOMER" }, invitation.oneTimeToken!));
        assert.equal(await db.organizationMember.count({ where: { userId: user.id } }), 0);
        assert.equal((await db.user.findUniqueOrThrow({ where: { id: user.id } })).isTeamMember, false);
        assert.equal((await db.organizationInvitation.findUniqueOrThrow({ where: { id: invitation.invitationId } })).status, "CREATED");
        await assert.rejects(service.revokeInvitation(actor, invitation.invitationId));
        assert.equal((await db.organizationInvitation.findUniqueOrThrow({ where: { id: invitation.invitationId } })).status, "CREATED");
        assert.equal(await db.auditLog.count({ where: { entityId: invitation.invitationId, action: "UPDATE" } }), 0);
      } finally {
        await db.$executeRawUnsafe(`DROP TRIGGER onboarding_test_audit_failure ON "AuditLog"`);
        await db.$executeRawUnsafe(`DROP FUNCTION onboarding_test_audit_failure()`);
        await db.$executeRawUnsafe(`DROP TABLE onboarding_test_audit_failure`);
      }
    });
    await t.test("booking, inventory, holds, reservations and payments remain absent", async () => {
      for (const count of [await db.hotelInventory.count(), await db.hotelBookingHold.count(), await db.hotelReservation.count(), await db.order.count(), await db.paymentRequest.count(), await db.organizationCapability.count({ where: { key: "HOTEL_BOOKING" } })]) assert.equal(count, 0);
    });
  } finally { await db.$disconnect(); }
});
