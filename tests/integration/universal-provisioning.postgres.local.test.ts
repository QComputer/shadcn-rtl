import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { test } from "node:test";
import { setTimeout as pause } from "node:timers/promises";
import { PrismaClient } from "@prisma/client";
import { OrganizationOnboardingService } from "@/lib/organization-onboarding/service";
import { UniversalProvisioningService } from "@/lib/tenant-provisioning/universal-provisioning.service";

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

type Actor = { userId: string; role: "SUPER_ADMIN" | "MANAGER" };
type RecipientInput = { recipientUserId: string; recipientUsername: string; recipientEmail: string; invitedRole: "ADMIN" | "MANAGER"; ttlHours: 24 };
type ProvisioningConfig = {
  name: string;
  slug: string;
  locale: "fa";
  vertical: "HOTEL" | "RESTAURANT" | null;
  type: "SHOP" | "APPOINTMENT";
  entitledCapabilities: string[];
  enabledCapabilities: string[];
  property?: { name: string; slug: string };
  recipients: RecipientInput[];
};

const deniedStatus = (status: number) => (error: unknown) => Boolean(
  error && typeof error === "object" && "status" in error && Number(error.status) === status,
);

test("universal tenant provisioning on the identified disposable PostgreSQL 17", { skip: !enabled, concurrency: false }, async (t) => {
  const runId = guardTarget();
  const db = new PrismaClient();
  const secondDb = new PrismaClient();
  const thirdDb = new PrismaClient();
  const blockerDb = new PrismaClient();
  const service = new UniversalProvisioningService(db);
  const operator = await db.user.create({ data: { name: `p14-operator-${runId}`, role: "SUPER_ADMIN", password: "P14_NONLOGIN_FIXTURE" } });
  const manager = await db.user.create({ data: { name: `p14-manager-${runId}`, role: "MANAGER", password: "P14_NONLOGIN_FIXTURE" } });
  const actor: Actor = { userId: operator.id, role: "SUPER_ADMIN" };
  const customerA = await createVerifiedCustomer("a");
  const customerB = await createVerifiedCustomer("b");

  async function createVerifiedCustomer(key: string) {
    const name = `p14-customer-${key}-${runId}`;
    const email = `${name}@example.invalid`;
    const user = await db.user.create({ data: { name, email, emailVerified: new Date(), role: "CUSTOMER", password: "P14_NONLOGIN_FIXTURE" } });
    await db.emailVerification.create({ data: { userId: user.id, email, token: randomBytes(32).toString("hex"), verifiedAt: new Date(), expiresAt: new Date(Date.now() + 3600000) } });
    return user;
  }

  const recipient = (user: { id: string; name: string; email: string | null }, invitedRole: "ADMIN" | "MANAGER" = "ADMIN"): RecipientInput => {
    assert.ok(user.email);
    return { recipientUserId: user.id, recipientUsername: user.name, recipientEmail: user.email!, invitedRole, ttlHours: 24 };
  };

  const config = (key: string, options: Partial<ProvisioningConfig> = {}): ProvisioningConfig => ({
    name: `P14 synthetic ${key}`,
    slug: `p14-${key}-${runId}`,
    locale: "fa",
    vertical: null,
    type: "SHOP",
    entitledCapabilities: ["SHOP"],
    enabledCapabilities: ["SHOP"],
    recipients: [recipient(customerA)],
    ...options,
  });

  async function prepare(configuration: ProvisioningConfig, key: string) {
    const plan = await service.create(actor, configuration, `${runId}-${key}-create`);
    const validation = await service.validate(actor, plan.id);
    const validationStatus = typeof validation === "string" ? validation : validation.status;
    assert.equal(validationStatus, "READY", `${key} validates READY`);
    const approval = await service.approve(actor, plan.id);
    assert.match(approval.approvedExecutionSha256, /^[a-f0-9]{64}$/);
    return { plan, approvedSha256: approval.approvedExecutionSha256 };
  }

  async function provision(configuration: ProvisioningConfig, key: string) {
    const prepared = await prepare(configuration, key);
    const result = await service.execute(actor, prepared.plan.id, { approvedSha256: prepared.approvedSha256 }, `${runId}-${key}-execute`);
    assert.equal(result.replayed, false);
    assert.equal(result.receipt.activationState, "AWAITING_ADMIN_ACTIVATION");
    assert.equal(result.receipt.bookingEnabled, false);
    assert.equal(result.receipt.paymentsEnabled, false);
    return { ...prepared, result };
  }

  async function waitForPlanLockWaiters(expected: number) {
    for (let attempt = 0; attempt < 150; attempt++) {
      const [row] = await db.$queryRaw<Array<{ count: number }>>`SELECT count(*)::int AS count FROM pg_stat_activity WHERE datname = current_database() AND pid <> pg_backend_pid() AND wait_event_type = 'Lock' AND position('TenantProvisioningPlan' in query) > 0`;
      if (row.count >= expected) return;
      await pause(30);
    }
    assert.fail(`Did not observe ${expected} real independent execution requests waiting on TenantProvisioningPlan`);
  }

  async function assertPersistedTenant(configuration: ProvisioningConfig, organizationId: string, expectedCapabilities: string[]) {
    const organization = await db.organization.findUniqueOrThrow({ where: { id: organizationId } });
    assert.equal(organization.slug, configuration.slug);
    assert.equal(organization.name, configuration.name);
    assert.equal(organization.type, configuration.type);
    assert.equal(organization.vertical, configuration.vertical);
    assert.equal(organization.locale, configuration.locale);
      assert.equal(await db.organizationSettings.count({ where: { organizationSlug: configuration.slug } }), 1);
      assert.equal(await db.bookingSettings.count({ where: { organizationSlug: configuration.slug } }), expectedCapabilities.includes("APPOINTMENT") ? 1 : 0);
    if (expectedCapabilities.includes("APPOINTMENT")) assert.equal((await db.bookingSettings.findUniqueOrThrow({ where: { organizationSlug: configuration.slug } })).autoConfirm, false);
    assert.equal(await db.paymentSettings.count({ where: { organizationSlug: configuration.slug } }), 1);
    assert.equal(await db.organizationBranding.count({ where: { organizationId } }), 1);
    const capabilities = await db.organizationCapability.findMany({ where: { organizationId }, orderBy: { key: "asc" } });
    assert.deepEqual(capabilities.map(({ key }) => key).sort(), [...configuration.entitledCapabilities].sort());
    assert.deepEqual(capabilities.filter(({ status }) => status === "ACTIVE").map(({ key }) => key).sort(), [...expectedCapabilities].sort());
    assert.ok(capabilities.every(({ key, status, enabledAt, disabledAt }) => configuration.enabledCapabilities.includes(key)
      ? status === "ACTIVE" && Boolean(enabledAt) && !disabledAt
      : status === "INACTIVE" && !enabledAt));
    assert.deepEqual(capabilities.map(({ key }) => key).filter((key) => ["HOTEL_BOOKING", "SMS", "USSD"].includes(key)), []);
    if (configuration.property) {
      assert.equal(await db.hotelProperty.count({ where: { organizationId, slug: configuration.property.slug } }), 1);
    } else {
      assert.equal(await db.hotelProperty.count({ where: { organizationId } }), 0);
    }
  }

  try {
    await t.test("identified disposable target and persisted synthetic identities", async () => {
      const [identity] = await db.$queryRaw<Array<{ db: string; role: string; major: number }>>`SELECT current_database()::text AS db, current_user::text AS role, current_setting('server_version_num')::int / 10000 AS major`;
      assert.deepEqual(identity, { db: `hotel_onboarding_${runId}`, role: "hotel_onboarding_test", major: 17 });
      assert.equal(await db.organization.count({ where: { slug: { startsWith: "p14-", contains: runId } } }), 0);
      const [persistedOperator, persistedA, persistedB] = await Promise.all([
        db.user.findUniqueOrThrow({ where: { id: operator.id } }),
        db.user.findUniqueOrThrow({ where: { id: customerA.id } }),
        db.user.findUniqueOrThrow({ where: { id: customerB.id } }),
      ]);
      assert.equal(persistedOperator.role, "SUPER_ADMIN");
      assert.ok([persistedA, persistedB].every((user) => user.role === "CUSTOMER" && user.isActive && user.emailVerified));
      assert.equal(await db.emailVerification.count({ where: { userId: { in: [customerA.id, customerB.id] }, verifiedAt: { not: null } } }), 2);
    });

    let shop!: Awaited<ReturnType<typeof provision>>;
    await t.test("SHOP preserves nullable vertical, exact enabled capability and baseline settings", async () => {
      const shopConfig = config("shop", {
        // Entitlement is advisory; only explicitly enabled capabilities are provisioned.
        entitledCapabilities: ["SHOP", "APPOINTMENT"],
        enabledCapabilities: ["SHOP"],
        recipients: [recipient(customerA)],
      });
      shop = await provision(shopConfig, "shop");
      assert.equal(shop.result.receipt.propertyId, null);
      assert.deepEqual([...shop.result.receipt.capabilities].sort(), ["SHOP"]);
      await assertPersistedTenant(shopConfig, shop.result.receipt.organizationId, ["SHOP"]);
      assert.equal(shop.result.invitations.length, 1);
      assert.equal(typeof shop.result.invitations[0]?.oneTimeToken, "string");
      assert.equal((await db.user.findUniqueOrThrow({ where: { id: customerA.id } })).role, "CUSTOMER");
    });

    await t.test("APPOINTMENT organization stays unclassified when vertical is null", async () => {
      const appointmentConfig = config("appointment", {
        type: "APPOINTMENT",
        vertical: null,
        entitledCapabilities: ["APPOINTMENT"],
        enabledCapabilities: ["APPOINTMENT"],
        recipients: [recipient(customerA), recipient(customerB, "MANAGER")],
      });
      const appointment = await provision(appointmentConfig, "appointment");
      assert.deepEqual(appointment.result.receipt.capabilities, ["APPOINTMENT"]);
      await assertPersistedTenant(appointmentConfig, appointment.result.receipt.organizationId, ["APPOINTMENT"]);
    });

    let hotel!: Awaited<ReturnType<typeof provision>>;
    await t.test("HOTEL_WEBSITE creates one hotel property without enabling booking or live operations", async () => {
      const hotelConfig = config("hotel", {
        vertical: "HOTEL",
        property: { name: "Synthetic property", slug: "main" },
        entitledCapabilities: ["HOTEL_WEBSITE"],
        enabledCapabilities: ["HOTEL_WEBSITE"],
        recipients: [recipient(customerA)],
      });
      hotel = await provision(hotelConfig, "hotel");
      assert.ok(hotel.result.receipt.propertyId);
      assert.deepEqual(hotel.result.receipt.capabilities, ["HOTEL_WEBSITE"]);
      await assertPersistedTenant(hotelConfig, hotel.result.receipt.organizationId, ["HOTEL_WEBSITE"]);
    });

    await t.test("combined SHOP and APPOINTMENT enable only both selected capabilities", async () => {
      const combinedConfig = config("combined", {
        entitledCapabilities: ["SHOP", "APPOINTMENT"],
        enabledCapabilities: ["SHOP", "APPOINTMENT"],
      });
      const combined = await provision(combinedConfig, "combined");
      assert.deepEqual([...combined.result.receipt.capabilities].sort(), ["APPOINTMENT", "SHOP"]);
      await assertPersistedTenant(combinedConfig, combined.result.receipt.organizationId, ["APPOINTMENT", "SHOP"]);
    });

    await t.test("an existing global CUSTOMER can redeem a second-organization HOTEL invitation", async () => {
      const priorMembership = await db.organizationMember.create({ data: {
        organizationId: shop.result.receipt.organizationId,
        organizationSlug: shop.result.receipt.organizationSlug,
        userId: customerA.id,
        role: "CUSTOMER",
      } });
      assert.ok(priorMembership.id);
      const invitation = hotel.result.invitations[0];
      assert.ok(invitation?.oneTimeToken);
      const redeemed = await new OrganizationOnboardingService(db).redeemInvitation({ userId: customerA.id, role: "CUSTOMER" }, invitation.oneTimeToken);
      assert.equal(redeemed.organizationId, hotel.result.receipt.organizationId);
      assert.equal(await db.organizationMember.count({ where: { userId: customerA.id } }), 2);
      assert.equal((await db.user.findUniqueOrThrow({ where: { id: customerA.id } })).role, "CUSTOMER");
    });

    await t.test("slug collision, inactive recipient and missing current verification proof block validation", async () => {
      const collisionSlug = `p14-collision-${runId}`;
      const collisionOrganization = await db.organization.create({ data: { name: "Existing synthetic collision", slug: collisionSlug, type: "SHOP" } });
      const collisionConfig = config("collision", { slug: collisionSlug });
      const collisionPlan = await service.create(actor, collisionConfig, `${runId}-collision-create`);
      await assert.rejects(service.validate(actor, collisionPlan.id));
      assert.equal((await db.tenantProvisioningPlan.findUniqueOrThrow({ where: { id: collisionPlan.id } })).status, "DRAFT");
      assert.equal((await db.organization.findUniqueOrThrow({ where: { id: collisionOrganization.id } })).name, "Existing synthetic collision");
      assert.equal(await db.organization.count({ where: { slug: collisionSlug } }), 1);
      assert.equal(await db.organizationSettings.count({ where: { organizationSlug: collisionSlug } }), 0);
      assert.equal(await db.organizationCapability.count({ where: { organizationId: collisionOrganization.id } }), 0);
      assert.equal(await db.organizationAcquisition.count({ where: { organizationId: collisionOrganization.id } }), 0);

      const inactive = await createVerifiedCustomer("inactive");
      await db.user.update({ where: { id: inactive.id }, data: { isActive: false } });
      const unverified = await db.user.create({ data: { name: `p14-unverified-${runId}`, email: `p14-unverified-${runId}@example.invalid`, role: "CUSTOMER", password: "P14_NONLOGIN_FIXTURE" } });
      const recipientConfig = config("invalid-recipients", { recipients: [recipient(inactive), recipient(unverified)] });
      const recipientPlan = await service.create(actor, recipientConfig, `${runId}-invalid-recipients-create`);
      await assert.rejects(service.validate(actor, recipientPlan.id));
      assert.equal(await db.organization.count({ where: { slug: recipientConfig.slug } }), 0);
      assert.equal(await db.organizationInvitation.count({ where: { recipientUserId: { in: [inactive.id, unverified.id] } } }), 0);
      assert.equal((await db.user.findUniqueOrThrow({ where: { id: unverified.id } })).emailVerified, null);
    });

    await t.test("manager execution is denied and approval is bound to the exact persisted configuration", async () => {
      const configuration = config("tamper", { recipients: [recipient(customerB)] });
      const prepared = await prepare(configuration, "tamper");
      await assert.rejects(
        service.execute({ userId: manager.id, role: "MANAGER" }, prepared.plan.id, { approvedSha256: prepared.approvedSha256 }, `${runId}-manager-execute`),
        deniedStatus(403),
      );
      const persistedPlan = await db.tenantProvisioningPlan.findUniqueOrThrow({ where: { id: prepared.plan.id } });
      const originalConfiguration = persistedPlan.executionConfiguration as Record<string, unknown>;
      await assert.rejects(db.tenantProvisioningPlan.update({ where: { id: prepared.plan.id }, data: { executionConfiguration: { ...originalConfiguration, name: "Tampered after approval" } } }));
      assert.equal((await db.tenantProvisioningPlan.findUniqueOrThrow({ where: { id: prepared.plan.id } })).status, "APPROVED");
      assert.deepEqual((await db.tenantProvisioningPlan.findUniqueOrThrow({ where: { id: prepared.plan.id } })).executionConfiguration, persistedPlan.executionConfiguration);
      assert.equal(await db.organization.count({ where: { slug: configuration.slug } }), 0);
      assert.equal(await db.organizationSettings.count({ where: { organizationSlug: configuration.slug } }), 0);
      assert.equal(await db.organizationCapability.count({ where: { organization: { slug: configuration.slug } } }), 0);
      assert.equal(await db.organizationAcquisition.count({ where: { organization: { slug: configuration.slug } } }), 0);
      assert.equal(await db.organizationInvitation.count({ where: { recipientUserId: customerB.id, organization: { slug: configuration.slug } } }), 0);
    });

    await t.test("execute replays only for the same actor and request payload", async () => {
      const prepared = await prepare(config("replay", { recipients: [recipient(customerB)] }), "replay");
      const key = `${runId}-replay-execute`;
      const first = await service.execute(actor, prepared.plan.id, { approvedSha256: prepared.approvedSha256 }, key);
      const replay = await service.execute(actor, prepared.plan.id, { approvedSha256: prepared.approvedSha256 }, key);
      assert.equal(first.replayed, false);
      assert.equal(replay.replayed, true);
      assert.equal(replay.receipt.organizationId, first.receipt.organizationId);
      assert.equal(replay.invitations.length, 0, "replay does not reissue recoverable invitation tokens");
      await db.user.update({ where: { id: operator.id }, data: { role: "CUSTOMER" } });
      try {
        await assert.rejects(service.execute(actor, prepared.plan.id, { approvedSha256: prepared.approvedSha256 }, key), /PLATFORM_ADMIN_REQUIRED/);
      } finally { await db.user.update({ where: { id: operator.id }, data: { role: "SUPER_ADMIN" } }); }
      await assert.rejects(service.execute({ userId: customerA.id, role: "SUPER_ADMIN" }, prepared.plan.id, { approvedSha256: prepared.approvedSha256 }, key));
      await assert.rejects(service.execute(actor, prepared.plan.id, { approvedSha256: "0".repeat(64) }, key));
      assert.equal(await db.organization.count({ where: { slug: "p14-replay-" + runId } }), 1);
      assert.equal(await db.organizationCapability.count({ where: { organizationId: first.receipt.organizationId } }), 1);
      assert.equal(await db.organizationInvitation.count({ where: { organizationId: first.receipt.organizationId } }), 1);
      const [{ count: sameKeyReceipts }] = await db.$queryRaw<Array<{ count: number }>>`SELECT count(*)::int AS count FROM "TenantProvisioningPlan" WHERE "executionReceipt"->>'key'=${key}`;
      assert.equal(sameKeyReceipts, 1);
    });

    await t.test("independent same-key executions overlap on the plan row and commit one receipt", async () => {
      const configuration = config("concurrent", { recipients: [recipient(customerB)] });
      const prepared = await prepare(configuration, "concurrent");
      const clients = [secondDb, thirdDb];
      let release!: () => void;
      let ready!: () => void;
      const barrier = new Promise<void>((resolve) => { release = resolve; });
      const locked = new Promise<void>((resolve) => { ready = resolve; });
      const holder = blockerDb.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "TenantProvisioningPlan" WHERE "id"=${prepared.plan.id} FOR UPDATE`;
        ready();
        await barrier;
      }, { timeout: 20000 });
      const key = `${runId}-concurrent-execute`;
      try {
        await locked;
        const operations = clients.map((client) => new UniversalProvisioningService(client).execute(actor, prepared.plan.id, { approvedSha256: prepared.approvedSha256 }, key));
        const settledPromise = Promise.allSettled(operations);
        try { await waitForPlanLockWaiters(2); }
        finally { release(); }
        const settled = await settledPromise;
        for (const operation of settled) if (operation.status === "rejected") throw operation.reason;
        assert.equal(settled.filter((result) => result.status === "fulfilled").length, 2);
        const outcomes = settled.map((result) => {
          if (result.status === "rejected") throw result.reason;
          return result.value;
        });
        assert.equal(outcomes.filter((result) => !result.replayed).length, 1);
        assert.equal(outcomes.filter((result) => result.replayed).length, 1);
        assert.equal(new Set(outcomes.map((result) => result.receipt.organizationId)).size, 1);
        const organizationId = outcomes[0]!.receipt.organizationId;
        assert.equal(await db.organization.count({ where: { slug: configuration.slug } }), 1);
        assert.equal(await db.organizationCapability.count({ where: { organizationId } }), 1);
        assert.equal(await db.organizationSettings.count({ where: { organizationSlug: configuration.slug } }), 1);
        assert.equal(await db.organizationInvitation.count({ where: { organizationId } }), 1);
        const [{ count: sameKeyReceipts }] = await db.$queryRaw<Array<{ count: number }>>`SELECT count(*)::int AS count FROM "TenantProvisioningPlan" WHERE "executionReceipt"->>'key'=${key}`;
        assert.equal(sameKeyReceipts, 1);
        const committedPlan = await db.tenantProvisioningPlan.findUniqueOrThrow({ where: { id: prepared.plan.id } });
        assert.equal(committedPlan.status, "COMPLETED");
        assert.equal((committedPlan.executionReceipt as { key?: string } | null)?.key, key);
      } finally { release(); await holder; }
    });

    await t.test("TenantProvisioningExecution audit failure rolls back every created record and keeps approval", async () => {
      const configuration = config("audit-rollback", { recipients: [recipient(customerB)] });
      const prepared = await prepare(configuration, "audit-rollback");
      const before = {
        invitations: await db.organizationInvitation.count(),
        settings: await db.organizationSettings.count(),
        paymentSettings: await db.paymentSettings.count(),
        branding: await db.organizationBranding.count(),
        acquisitions: await db.organizationAcquisition.count(),
        audits: await db.auditLog.count({ where: { entityType: "TenantProvisioningExecution" } }),
      };
      await db.$executeRawUnsafe(`CREATE FUNCTION p14_universal_audit_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."entityType" = 'TenantProvisioningExecution' THEN RAISE EXCEPTION 'synthetic provisioning audit failure'; END IF; RETURN NEW; END $$`);
      await db.$executeRawUnsafe(`CREATE TRIGGER p14_universal_audit_failure BEFORE INSERT ON "AuditLog" FOR EACH ROW EXECUTE FUNCTION p14_universal_audit_failure()`);
      try {
        await assert.rejects(service.execute(actor, prepared.plan.id, { approvedSha256: prepared.approvedSha256 }, `${runId}-audit-rollback-execute`), (error: unknown) => String(error).includes("synthetic provisioning audit failure"));
        assert.equal(await db.organization.count({ where: { slug: configuration.slug } }), 0);
        assert.equal(await db.organizationSettings.count({ where: { organizationSlug: configuration.slug } }), 0);
        assert.equal(await db.paymentSettings.count({ where: { organizationSlug: configuration.slug } }), 0);
        assert.equal(await db.organizationCapability.count({ where: { organization: { slug: configuration.slug } } }), 0);
        assert.equal(await db.organizationAcquisition.count({ where: { organization: { slug: configuration.slug } } }), 0);
        assert.equal(await db.hotelProperty.count({ where: { organizationSlug: configuration.slug } }), 0);
        assert.equal(await db.organizationInvitation.count(), before.invitations);
        assert.equal(await db.organizationSettings.count(), before.settings);
        assert.equal(await db.paymentSettings.count(), before.paymentSettings);
        assert.equal(await db.organizationBranding.count(), before.branding);
        assert.equal(await db.organizationAcquisition.count(), before.acquisitions);
        assert.equal(await db.auditLog.count({ where: { entityType: "TenantProvisioningExecution" } }), before.audits);
        assert.equal((await db.tenantProvisioningPlan.findUniqueOrThrow({ where: { id: prepared.plan.id } })).status, "APPROVED");
        const detail = await service.detail(actor, prepared.plan.id);
        assert.equal(detail.executionReceipt, null, "failed execution exposes no committed receipt");
      } finally {
        await db.$executeRawUnsafe(`DROP TRIGGER p14_universal_audit_failure ON "AuditLog"`);
        await db.$executeRawUnsafe(`DROP FUNCTION p14_universal_audit_failure()`);
      }
      const recovered = await service.execute(actor, prepared.plan.id, { approvedSha256: prepared.approvedSha256 }, `${runId}-audit-rollback-execute`);
      assert.equal(recovered.replayed, false, "same request can recover after the failed transaction without manual repair");
      assert.equal(await db.organization.count({ where: { slug: configuration.slug } }), 1);
      assert.equal(await db.organizationInvitation.count({ where: { organizationId: recovered.receipt.organizationId } }), configuration.recipients.length);
    });

    await t.test("TenantProvisioningPlan audit failures roll back create, configure, validate and approve", async () => {
      const createConfig = config("plan-audit-create", { recipients: [recipient(customerB)] });
      const configureConfig = config("plan-audit-configure", { recipients: [recipient(customerB)] });
      const validateConfig = config("plan-audit-validate", { recipients: [recipient(customerB)] });
      const approveConfig = config("plan-audit-approve", { recipients: [recipient(customerB)] });
      const configurePlan = await service.create(actor, configureConfig, `${runId}-plan-audit-configure-create`);
      const validatePlan = await service.create(actor, validateConfig, `${runId}-plan-audit-validate-create`);
      const approvePlan = await service.create(actor, approveConfig, `${runId}-plan-audit-approve-create`);
      await service.validate(actor, approvePlan.id);
      const readyApprovePlan = await db.tenantProvisioningPlan.findUniqueOrThrow({ where: { id: approvePlan.id } });
      assert.equal(readyApprovePlan.status, "READY");

      const triggerName = `p14_up_plan_audit_${runId}`;
      const functionName = `p14_up_plan_audit_fn_${runId}`;
      await db.$executeRawUnsafe(`CREATE FUNCTION "${functionName}"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."entityType" = 'TenantProvisioningPlan' THEN RAISE EXCEPTION 'synthetic provisioning plan audit failure'; END IF; RETURN NEW; END $$`);
      await db.$executeRawUnsafe(`CREATE TRIGGER "${triggerName}" BEFORE INSERT ON "AuditLog" FOR EACH ROW EXECUTE FUNCTION "${functionName}"()`);
      try {
        await assert.rejects(
          service.create(actor, createConfig, `${runId}-plan-audit-create-create`),
          (error: unknown) => String(error).includes("synthetic provisioning plan audit failure"),
        );
        assert.equal(await db.tenantProvisioningPlan.count({ where: { proposedSlug: createConfig.slug } }), 0, "failed plan creation leaves no plan");

        const changedConfig = { ...configureConfig, name: "Changed synthetic configuration", slug: `p14-plan-audit-configured-${runId}` };
        await assert.rejects(
          service.configure(actor, configurePlan.id, changedConfig),
          (error: unknown) => String(error).includes("synthetic provisioning plan audit failure"),
        );
        const afterConfigure = await db.tenantProvisioningPlan.findUniqueOrThrow({ where: { id: configurePlan.id } });
        assert.equal(afterConfigure.status, "DRAFT");
        assert.deepEqual(afterConfigure.executionConfiguration, configureConfig, "failed configure preserves original configuration");

        await assert.rejects(
          service.validate(actor, validatePlan.id),
          (error: unknown) => String(error).includes("synthetic provisioning plan audit failure"),
        );
        const afterValidate = await db.tenantProvisioningPlan.findUniqueOrThrow({ where: { id: validatePlan.id } });
        assert.equal(afterValidate.status, "DRAFT");
        assert.equal(afterValidate.validationResult, null);

        await assert.rejects(
          service.approve(actor, approvePlan.id),
          (error: unknown) => String(error).includes("synthetic provisioning plan audit failure"),
        );
        const afterApprove = await db.tenantProvisioningPlan.findUniqueOrThrow({ where: { id: approvePlan.id } });
        assert.equal(afterApprove.status, "READY");
        assert.equal(afterApprove.approvedExecutionSha256, null);
        assert.equal(afterApprove.approvedExecutionSnapshot, null);
      } finally {
        await db.$executeRawUnsafe(`DROP TRIGGER "${triggerName}" ON "AuditLog"`);
        await db.$executeRawUnsafe(`DROP FUNCTION "${functionName}"()`);
      }
    });
  } finally {
    await Promise.all([db, secondDb, thirdDb, blockerDb].map((client) => client.$disconnect()));
  }
});
