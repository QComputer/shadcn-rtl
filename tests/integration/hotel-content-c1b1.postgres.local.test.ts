import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { test } from "node:test";

const enabled = process.env.HOTEL_CONTENT_C1B1_PG_ACCEPTANCE === "1";

function readDisposableTarget() {
  assert.equal(process.env.NODE_ENV === "production", false, "refusing PostgreSQL acceptance in production mode");
  assert.equal(process.env.VERCEL_ENV === "production", false, "refusing PostgreSQL acceptance in Vercel Production");
  assert.equal(process.env.DIRECT_URL, process.env.DATABASE_URL, "DATABASE_URL and DIRECT_URL must identify the same disposable target");
  assert.ok(process.env.AI_MEDIA_LOCAL_DOCKER_E2E === "1", "explicit local Docker E2E runtime guard is required");

  const databaseUrl = process.env.DATABASE_URL;
  const runId = process.env.HOTEL_CONTENT_C1B1_RUN_ID;
  const containerId = process.env.HOTEL_CONTENT_C1B1_CONTAINER_ID;
  const volumeName = process.env.HOTEL_CONTENT_C1B1_VOLUME_NAME;
  assert.ok(databaseUrl && runId && containerId && volumeName, "loopback URL, run ID, exact container ID, and exact volume name are required");
  assert.match(runId, /^[a-f0-9]{8,16}$/i, "run ID must be random hexadecimal");
  assert.match(containerId, /^[a-f0-9]{64}$/i, "container identity must be the full exact Docker ID");
  assert.equal(volumeName, `hotel-content-c1b1-${runId.toLowerCase()}`, "volume must be uniquely bound to this task run");

  const url = new URL(databaseUrl);
  assert.equal(url.protocol, "postgresql:");
  assert.equal(url.hostname, "127.0.0.1", "PostgreSQL must be exposed only through IPv4 loopback");
  assert.ok(Number(url.port) >= 1024 && Number(url.port) <= 65535, "a dynamically assigned loopback port is required");
  const databaseName = decodeURIComponent(url.pathname.slice(1));
  assert.equal(databaseName, `bazarbaaz_hotel_c1b1_${runId.toLowerCase()}`);
  assert.equal(decodeURIComponent(url.username), "c1b1_test");

  const inspected = JSON.parse(execFileSync("docker", ["inspect", containerId], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] })) as Array<{
    Id: string;
    Config: { Image: string; Labels?: Record<string, string> };
    State: { Running: boolean };
    Mounts: Array<{ Type: string; Name?: string }>;
    NetworkSettings: { Ports: Record<string, Array<{ HostIp: string; HostPort: string }> | null> };
  }>;
  const container = inspected[0];
  assert.ok(container, "exact task container must exist");
  assert.equal(container.Id.replaceAll("-", ""), containerId.replaceAll("-", ""));
  assert.equal(container.Config.Image, "postgres:17-alpine");
  assert.equal(container.Config.Labels?.["codex.task"], "hotel-content-c1b1-db-acceptance");
  assert.equal(container.Config.Labels?.["codex.run_id"], runId.toLowerCase());
  assert.equal(container.State.Running, true);
  assert.ok(container.Mounts.some((mount) => mount.Type === "volume" && mount.Name === volumeName));
  assert.ok(container.NetworkSettings.Ports["5432/tcp"]?.some((binding) => binding.HostIp === "127.0.0.1" && binding.HostPort === url.port));

  const migrationNames = readdirSync("prisma/migrations", { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  assert.equal(migrationNames.length, 95, "expected 94 C1A migrations plus the C1B1 idempotency migration");
  assert.equal(migrationNames.at(-1), "20261013100000_hotel_website_operations_idempotency");
  return { databaseUrl, databaseName, runId: runId.toLowerCase(), migrationNames };
}

const content = (title: string) => ({
  title: { fa: title },
  hero: { heading: { fa: `${title} hero` } },
  introduction: { body: { fa: `${title} introduction` } },
  sections: [],
  contact: {},
});

test("C1B1 management authorization, idempotency, editorial transitions, and rollback on disposable PostgreSQL 17", { skip: !enabled, concurrency: false }, async (t) => {
  const target = readDisposableTarget();
  const [{ PrismaClient }, { HotelWebsiteManagementService, HotelWebsiteManagementConflictError }, { HotelWebsiteContentAuthorizationError }] = await Promise.all([
    import("@prisma/client"),
    import("@/lib/hotel/content/hotel-website-management.service"),
    import("@/lib/hotel/content/hotel-website-content.service"),
  ]);
  const prisma = new PrismaClient();
  const clients: InstanceType<typeof PrismaClient>[] = [];
  const suffix = target.runId;
  const service = new HotelWebsiteManagementService(prisma);

  async function createTenant(key: string) {
    const slug = `c1b1-${suffix}-${key}`;
    const organization = await prisma.organization.create({ data: { name: slug, slug, type: "SHOP", vertical: "HOTEL" } });
    const property = await prisma.hotelProperty.create({ data: { organizationId: organization.id, organizationSlug: organization.slug, slug: `property-${key}`, name: `Property ${key}` } });
    await prisma.organizationCapability.create({ data: { organizationId: organization.id, key: "HOTEL_WEBSITE", status: "ACTIVE", enabledAt: new Date() } });
    const createUser = async (role: "MANAGER" | "ADMIN" | "SUPER_ADMIN", name: string) => prisma.user.create({ data: { name: `c1b1-${suffix}-${name}`, password: "disposable-fixture-only", role } });
    const manager = await createUser("MANAGER", `${key}-manager`);
    const alternateManager = await createUser("MANAGER", `${key}-manager-2`);
    const admin = await createUser("ADMIN", `${key}-admin`);
    const alternateAdmin = await createUser("ADMIN", `${key}-admin-2`);
    for (const user of [manager, alternateManager, admin, alternateAdmin]) {
      await prisma.organizationMember.create({ data: { organizationId: organization.id, organizationSlug: organization.slug, userId: user.id, role: user.role, isActive: true } });
    }
    return { organization, property, manager, alternateManager, admin, alternateAdmin };
  }

  function principal(user: { id: string; role: string }, organizationId?: string) {
    return { userId: user.id, role: user.role as "MANAGER" | "ADMIN" | "SUPER_ADMIN", organizationId };
  }

  try {
    await prisma.$connect();
    const [identity] = await prisma.$queryRaw<Array<{ databaseName: string; schemaName: string; username: string; address: string; port: number; version: number }>>`
      SELECT current_database() AS "databaseName", current_schema() AS "schemaName", current_user AS username,
             inet_server_addr()::text AS address, inet_server_port() AS port, current_setting('server_version_num')::int AS version
    `;
    assert.equal(identity.databaseName, target.databaseName);
    assert.equal(identity.schemaName, "public");
    assert.equal(identity.username, "c1b1_test");
    assert.ok(identity.address && !["127.0.0.1", "::1"].includes(identity.address), "connection must terminate inside the verified task container");
    assert.equal(Number(identity.port), 5432);
    assert.ok(identity.version >= 170000 && identity.version < 180000, "PostgreSQL 17 is required");

    const ledger = await prisma.$queryRaw<Array<{ migration_name: string; finished_at: Date | null; rolled_back_at: Date | null }>>`
      SELECT migration_name, finished_at, rolled_back_at FROM "_prisma_migrations" ORDER BY migration_name
    `;
    assert.deepEqual(ledger.map((row) => row.migration_name), target.migrationNames);
    assert.ok(ledger.every((row) => row.finished_at !== null && row.rolled_back_at === null));
    assert.equal(ledger.length, 95);
    assert.equal(await prisma.organization.count(), 0, "acceptance database must contain no pre-existing organizations");
    assert.equal(await prisma.user.count(), 0, "acceptance database must contain no pre-existing users");
    assert.equal(await prisma.hotelProperty.count(), 0, "acceptance database must contain no pre-existing Hotel properties");
    assert.equal(await prisma.organizationCapability.count(), 0, "migration must not enable capabilities");

    const tenantA = await createTenant("a");
    const tenantB = await createTenant("b");
    assert.equal(await prisma.organizationCapability.count({ where: { organizationId: { in: [tenantA.organization.id, tenantB.organization.id] }, key: "HOTEL_BOOKING" } }), 0);
    const tenantBImage = await prisma.image.create({ data: { organizationId: tenantB.organization.id, filename: `c1b1-${suffix}-b.png`, mimeType: "image/png", url: `/uploads/c1b1-${suffix}-b.png`, access: "PUBLIC" } });
    const scopeA = { organizationId: tenantA.organization.id, propertyId: tenantA.property.id };
    const scopeB = { organizationId: tenantB.organization.id, propertyId: tenantB.property.id };
    const author = principal(tenantA.manager, tenantA.organization.id);
    const admin = principal(tenantA.admin, tenantA.organization.id);
    const tenantBManager = principal(tenantB.manager, tenantB.organization.id);
    const tenantBAdmin = principal(tenantB.admin, tenantB.organization.id);

    await t.test("tenant scope, persisted roles, and ownership fail closed", async () => {
      await assert.rejects(() => service.createDraft(author, scopeB, { content: content("foreign"), media: [] }, `scope-key-${suffix}`), HotelWebsiteContentAuthorizationError);
      await assert.rejects(() => service.createDraft(admin, { organizationId: scopeA.organizationId, propertyId: scopeB.propertyId }, { content: content("mismatch"), media: [] }, `scope-key-${suffix}-2`), HotelWebsiteContentAuthorizationError);
      await assert.rejects(() => service.createDraft(author, scopeA, { content: content("foreign image"), media: [{ imageId: tenantBImage.id, scope: "PROPERTY", roomTypeId: null, sortOrder: 0, altText: {} }] }, `scope-key-${suffix}-3`), HotelWebsiteContentAuthorizationError);
      const inactiveUser = await prisma.user.update({ where: { id: tenantA.manager.id }, data: { isActive: false } });
      await assert.rejects(() => service.listRevisions(author, scopeA), HotelWebsiteContentAuthorizationError);
      await prisma.user.update({ where: { id: inactiveUser.id }, data: { isActive: true } });
      await prisma.organizationMember.update({ where: { organizationId_userId: { organizationId: scopeA.organizationId, userId: tenantA.manager.id } }, data: { isActive: false } });
      await assert.rejects(() => service.listRevisions(author, scopeA), HotelWebsiteContentAuthorizationError);
      await prisma.organizationMember.update({ where: { organizationId_userId: { organizationId: scopeA.organizationId, userId: tenantA.manager.id } }, data: { isActive: true } });
      const superAdmin = await prisma.user.create({ data: { name: `c1b1-${suffix}-super-admin`, password: "disposable-fixture-only", role: "SUPER_ADMIN" } });
      await assert.rejects(() => service.createDraft(principal(superAdmin), { organizationId: scopeA.organizationId, propertyId: scopeB.propertyId }, { content: content("wrong property"), media: [] }, `scope-key-${suffix}-4`), HotelWebsiteContentAuthorizationError);
      assert.deepEqual(await service.listRevisions(principal(superAdmin), scopeA), [], "persisted platform SUPER_ADMIN can act only in an explicitly valid Hotel/property scope");
      assert.equal(await prisma.hotelWebsiteContentRevision.count(), 0);
    });

    await t.test("actor-bound idempotency replays only after fresh authorization", async () => {
      const input = { content: content("Replay"), media: [] };
      const key = `replay-key-${suffix}`;
      const first = await service.createDraft(author, scopeA, input, key);
      const replay = await service.createDraft(author, scopeA, input, key);
      assert.equal(replay.replayed, true);
      assert.equal(replay.result.id, first.result.id);
      assert.equal(await prisma.hotelWebsiteContentRevision.count({ where: scopeA }), 1);
      await assert.rejects(() => service.createDraft(author, scopeA, { content: content("Different"), media: [] }, key), HotelWebsiteManagementConflictError);
      await assert.rejects(() => service.createDraft(principal(tenantA.alternateManager, scopeA.organizationId), scopeA, input, key), HotelWebsiteManagementConflictError);
      await prisma.organizationMember.update({ where: { organizationId_userId: { organizationId: scopeA.organizationId, userId: tenantA.manager.id } }, data: { isActive: false } });
      await assert.rejects(() => service.createDraft(author, scopeA, input, key), HotelWebsiteContentAuthorizationError);
      await prisma.organizationMember.update({ where: { organizationId_userId: { organizationId: scopeA.organizationId, userId: tenantA.manager.id } }, data: { isActive: true } });
      await prisma.organizationCapability.update({ where: { organizationId_key: { organizationId: scopeA.organizationId, key: "HOTEL_WEBSITE" } }, data: { status: "INACTIVE", enabledAt: null, disabledAt: new Date() } });
      await assert.rejects(() => service.createDraft(author, scopeA, input, key), HotelWebsiteContentAuthorizationError);
      await prisma.organizationCapability.update({ where: { organizationId_key: { organizationId: scopeA.organizationId, key: "HOTEL_WEBSITE" } }, data: { status: "ACTIVE", enabledAt: new Date(), disabledAt: null } });
    });

    await t.test("independent review, publish, revoke, history, and new drafts preserve the published revision", async () => {
      const firstDraft = await service.createDraft(author, scopeA, { content: content("Published v1"), media: [] }, `create-v1-${suffix}`);
      await service.submit(author, scopeA, firstDraft.result.id, "review v1", `submit-v1-${suffix}`);
      await assert.rejects(() => service.decide(author, scopeA, firstDraft.result.id, "APPROVED", undefined, `self-approve-${suffix}`), HotelWebsiteContentAuthorizationError);
      await service.decide(admin, scopeA, firstDraft.result.id, "APPROVED", "approved", `approve-v1-${suffix}`);
      const firstPublication = await service.publish(admin, scopeA, firstDraft.result.id, `publish-v1-${suffix}`);
      await assert.rejects(() => prisma.$executeRaw`UPDATE "HotelWebsiteContentRevision" SET "content" = ${JSON.stringify(content("Tampered published"))}::jsonb WHERE "id" = ${firstDraft.result.id}`);
      await assert.rejects(() => prisma.hotelWebsiteContentRevision.update({ where: { id: firstDraft.result.id }, data: { status: "REJECTED" } }));
      const secondDraft = await service.createDraft(principal(tenantA.admin, scopeA.organizationId), scopeA, { content: content("Draft v2"), media: [] }, `create-v2-${suffix}`);
      assert.equal(secondDraft.result.revisionNumber, firstDraft.result.revisionNumber + 1);
      assert.equal((await prisma.hotelWebsitePublication.findUniqueOrThrow({ where: { id: firstPublication.result.publicationId } })).revisionId, firstDraft.result.id);
      await assert.rejects(() => service.publish(admin, scopeA, secondDraft.result.id, `publish-unapproved-${suffix}`), HotelWebsiteManagementConflictError);
      await service.submit(admin, scopeA, secondDraft.result.id, undefined, `submit-v2-${suffix}`);
      await assert.rejects(() => service.decide(admin, scopeA, secondDraft.result.id, "APPROVED", undefined, `self-approve-v2-${suffix}`), HotelWebsiteContentAuthorizationError);
      await service.decide(principal(tenantA.alternateAdmin, scopeA.organizationId), scopeA, secondDraft.result.id, "APPROVED", undefined, `approve-v2-${suffix}`);
      await assert.rejects(() => service.publish(admin, scopeA, secondDraft.result.id, `publish-active-${suffix}`), HotelWebsiteManagementConflictError);
      const beforeFailedReplacement = await prisma.hotelWebsitePublication.findUniqueOrThrow({ where: { id: firstPublication.result.publicationId } });
      assert.equal(beforeFailedReplacement.revokedAt, null);
      const revoked = await service.revoke(admin, scopeA, firstPublication.result.publicationId, "replace with approved revision", `revoke-v1-${suffix}`);
      assert.equal(revoked.result.revoked, true);
      const secondPublication = await service.publish(admin, scopeA, secondDraft.result.id, `publish-v2-${suffix}`);
      assert.equal(secondPublication.result.revisionId, secondDraft.result.id);
      const history = await service.history(admin, scopeA);
      assert.ok(history.reviews.some((entry) => entry.action === "APPROVED" && entry.revisionId === firstDraft.result.id));
      assert.ok(history.publications.some((entry) => entry.id === firstPublication.result.publicationId && entry.revokedAt !== null));
      assert.ok(history.publications.some((entry) => entry.id === secondPublication.result.publicationId && entry.revokedAt === null));
      assert.equal(await prisma.hotelWebsiteContentReview.count({ where: { revisionId: firstDraft.result.id, action: "APPROVED" } }), 1);
      await assert.rejects(() => service.decide(admin, scopeA, firstDraft.result.id, "REJECTED", undefined, `stale-review-${suffix}`), HotelWebsiteManagementConflictError);

      const rejectedDraft = await service.createDraft(author, scopeA, { content: content("Rejected revision"), media: [] }, `create-reject-${suffix}`);
      await service.submit(author, scopeA, rejectedDraft.result.id, undefined, `submit-reject-${suffix}`);
      await assert.rejects(() => service.decide(principal(tenantA.alternateManager, scopeA.organizationId), scopeA, rejectedDraft.result.id, "REJECTED", undefined, `manager-reject-${suffix}`), HotelWebsiteContentAuthorizationError);
      await service.decide(admin, scopeA, rejectedDraft.result.id, "REJECTED", "needs correction", `reject-${suffix}`);
      assert.equal((await prisma.hotelWebsiteContentRevision.findUniqueOrThrow({ where: { id: rejectedDraft.result.id } })).status, "REJECTED");
      await assert.rejects(() => service.decide(principal(tenantA.alternateAdmin, scopeA.organizationId), scopeA, rejectedDraft.result.id, "APPROVED", undefined, `approve-rejected-${suffix}`), HotelWebsiteManagementConflictError);
    });

    await t.test("media is revalidated after draft and approval before publication", async () => {
      const filename = `c1b1-${suffix}-mutable.png`;
      const image = await prisma.image.create({ data: { organizationId: scopeA.organizationId, filename, mimeType: "image/png", url: `/uploads/${filename}`, access: "PUBLIC" } });
      const draft = await service.createDraft(author, scopeA, { content: content("Media"), media: [{ imageId: image.id, scope: "PROPERTY", roomTypeId: null, sortOrder: 0, altText: { fa: "تصویر" } }] }, `media-draft-${suffix}`);
      await service.submit(author, scopeA, draft.result.id, undefined, `media-submit-${suffix}`);
      await prisma.image.update({ where: { id: image.id }, data: { access: "PRIVATE" } });
      await assert.rejects(() => service.preview(author, scopeA, draft.result.id, "fa"), HotelWebsiteContentAuthorizationError);
      await assert.rejects(() => service.decide(admin, scopeA, draft.result.id, "APPROVED", undefined, `media-approve-private-${suffix}`), HotelWebsiteContentAuthorizationError);
      await prisma.image.update({ where: { id: image.id }, data: { access: "PUBLIC" } });
      await service.decide(admin, scopeA, draft.result.id, "APPROVED", undefined, `media-approve-${suffix}`);
      await prisma.image.update({ where: { id: image.id }, data: { mimeType: "text/html" } });
      await assert.rejects(() => service.publish(admin, scopeA, draft.result.id, `media-publish-invalid-${suffix}`), HotelWebsiteContentAuthorizationError);
      assert.equal(await prisma.hotelWebsitePublication.count({ where: { revisionId: draft.result.id } }), 0);
    });

    await t.test("audit failure rolls back the complete draft and idempotency transaction", async () => {
      const before = {
        pages: await prisma.hotelWebsitePage.count({ where: scopeB }),
        revisions: await prisma.hotelWebsiteContentRevision.count({ where: scopeB }),
        associations: await prisma.hotelWebsiteMediaAssociation.count({ where: scopeB }),
        operations: await prisma.hotelWebsiteOperation.count({ where: scopeB }),
        audits: await prisma.auditLog.count({ where: { organizationId: scopeB.organizationId, entityType: "HotelWebsiteContentRevision" } }),
      };
      const functionName = `c1b1_fail_audit_${suffix}`;
      const triggerName = `c1b1_fail_audit_trigger_${suffix}`;
      await prisma.$executeRawUnsafe(`CREATE FUNCTION "${functionName}"() RETURNS trigger AS $$ BEGIN IF NEW."entityType" = 'HotelWebsiteContentRevision' THEN RAISE EXCEPTION 'forced C1B1 audit failure'; END IF; RETURN NEW; END; $$ LANGUAGE plpgsql`);
      await prisma.$executeRawUnsafe(`CREATE TRIGGER "${triggerName}" BEFORE INSERT ON "AuditLog" FOR EACH ROW EXECUTE FUNCTION "${functionName}"()`);
      try {
        await assert.rejects(() => service.createDraft(principal(tenantB.manager, scopeB.organizationId), scopeB, { content: content("rollback"), media: [{ imageId: tenantBImage.id, scope: "PROPERTY", roomTypeId: null, sortOrder: 0, altText: {} }] }, `rollback-key-${suffix}`));
      } finally {
        await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "${triggerName}" ON "AuditLog"`);
        await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS "${functionName}"()`);
      }
      assert.deepEqual({
        pages: await prisma.hotelWebsitePage.count({ where: scopeB }),
        revisions: await prisma.hotelWebsiteContentRevision.count({ where: scopeB }),
        associations: await prisma.hotelWebsiteMediaAssociation.count({ where: scopeB }),
        operations: await prisma.hotelWebsiteOperation.count({ where: scopeB }),
        audits: await prisma.auditLog.count({ where: { organizationId: scopeB.organizationId, entityType: "HotelWebsiteContentRevision" } }),
      }, before);
    });

    await t.test("audit failures roll back review, decision, publication, and revocation transitions", async () => {
      async function withAuditFailure<T>(entityType: string, key: string, action: () => Promise<T>) {
        const functionName = `c1b1_fail_${key.replace(/[^a-z0-9_]/gi, "_")}`;
        const triggerName = `${functionName}_trigger`;
        await prisma.$executeRawUnsafe(`CREATE FUNCTION "${functionName}"() RETURNS trigger AS $$ BEGIN IF NEW."entityType" = '${entityType}' THEN RAISE EXCEPTION 'forced C1B1 audit failure'; END IF; RETURN NEW; END; $$ LANGUAGE plpgsql`);
        await prisma.$executeRawUnsafe(`CREATE TRIGGER "${triggerName}" BEFORE INSERT ON "AuditLog" FOR EACH ROW EXECUTE FUNCTION "${functionName}"()`);
        try {
          await assert.rejects(action);
        } finally {
          await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "${triggerName}" ON "AuditLog"`);
          await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS "${functionName}"()`);
        }
      }

      const draft = await service.createDraft(tenantBManager, scopeB, { content: content("Audit transition rollback"), media: [] }, `audit-setup-${suffix}`);
      const submitKey = `audit-submit-${suffix}`;
      await withAuditFailure("HotelWebsiteContentRevision", submitKey, () => service.submit(tenantBManager, scopeB, draft.result.id, undefined, submitKey));
      assert.equal((await prisma.hotelWebsiteContentRevision.findUniqueOrThrow({ where: { id: draft.result.id } })).status, "DRAFT");
      assert.equal(await prisma.hotelWebsiteContentReview.count({ where: { revisionId: draft.result.id } }), 0);
      assert.equal(await prisma.hotelWebsiteOperation.count({ where: { ...scopeB, operation: "SUBMIT", idempotencyKey: submitKey } }), 0);

      await service.submit(tenantBManager, scopeB, draft.result.id, undefined, `audit-submit-success-${suffix}`);
      const approveKey = `audit-approve-${suffix}`;
      await withAuditFailure("HotelWebsiteContentRevision", approveKey, () => service.decide(tenantBAdmin, scopeB, draft.result.id, "APPROVED", undefined, approveKey));
      assert.equal((await prisma.hotelWebsiteContentRevision.findUniqueOrThrow({ where: { id: draft.result.id } })).status, "IN_REVIEW");
      assert.equal(await prisma.hotelWebsiteContentReview.count({ where: { revisionId: draft.result.id, action: "APPROVED" } }), 0);
      assert.equal(await prisma.hotelWebsiteOperation.count({ where: { ...scopeB, operation: "APPROVE", idempotencyKey: approveKey } }), 0);

      await service.decide(tenantBAdmin, scopeB, draft.result.id, "APPROVED", undefined, `audit-approve-success-${suffix}`);
      const publishKey = `audit-publish-${suffix}`;
      await withAuditFailure("HotelWebsitePublication", publishKey, () => service.publish(tenantBAdmin, scopeB, draft.result.id, publishKey));
      assert.equal(await prisma.hotelWebsitePublication.count({ where: { ...scopeB, revisionId: draft.result.id } }), 0);
      assert.equal(await prisma.hotelWebsiteOperation.count({ where: { ...scopeB, operation: "PUBLISH", idempotencyKey: publishKey } }), 0);

      const publication = await service.publish(tenantBAdmin, scopeB, draft.result.id, `audit-publish-success-${suffix}`);
      const revokeKey = `audit-revoke-${suffix}`;
      await withAuditFailure("HotelWebsitePublication", revokeKey, () => service.revoke(tenantBAdmin, scopeB, publication.result.publicationId, "test rollback", revokeKey));
      assert.equal((await prisma.hotelWebsitePublication.findUniqueOrThrow({ where: { id: publication.result.publicationId } })).revokedAt, null);
      assert.equal(await prisma.hotelWebsiteOperation.count({ where: { ...scopeB, operation: "REVOKE", idempotencyKey: revokeKey } }), 0);
    });

    await t.test("parallel same-key requests create one draft and one durable result", async () => {
      const otherClients = [new PrismaClient(), new PrismaClient()];
      clients.push(...otherClients);
      await Promise.all(otherClients.map((client) => client.$connect()));
      const key = `parallel-key-${suffix}`;
      const requestBody = { content: content("Concurrent idem"), media: [] };
      const revisionCountBefore = await prisma.hotelWebsiteContentRevision.count({ where: scopeB });
      const auditCountBefore = await prisma.auditLog.count({ where: { organizationId: scopeB.organizationId, entityType: "HotelWebsiteContentRevision" } });
      const responses = await Promise.all(otherClients.map((client) => new HotelWebsiteManagementService(client).createDraft(tenantBManager, scopeB, requestBody, key)));
      assert.equal(responses[0].result.id, responses[1].result.id);
      assert.equal(responses.filter((response) => response.replayed).length, 1);
      assert.equal(await prisma.hotelWebsiteContentRevision.count({ where: scopeB }), revisionCountBefore + 1);
      assert.equal(await prisma.hotelWebsiteOperation.count({ where: { ...scopeB, operation: "CREATE_DRAFT", idempotencyKey: key } }), 1);
      assert.equal(await prisma.auditLog.count({ where: { organizationId: scopeB.organizationId, entityType: "HotelWebsiteContentRevision" } }), auditCountBefore + 1);

      const revisionId = responses[0].result.id;
      const submissions = await Promise.allSettled(otherClients.map((client, index) => new HotelWebsiteManagementService(client).submit(tenantBManager, scopeB, revisionId, undefined, `submit-race-${suffix}-${index}`)));
      assert.equal(submissions.filter((result) => result.status === "fulfilled").length, 1);
      assert.equal(await prisma.hotelWebsiteContentReview.count({ where: { revisionId, action: "SUBMITTED" } }), 1);
      assert.equal(await prisma.hotelWebsiteOperation.count({ where: { ...scopeB, operation: "SUBMIT", idempotencyKey: { in: [`submit-race-${suffix}-0`, `submit-race-${suffix}-1`] } } }), 1);

      const decisions = await Promise.allSettled(otherClients.map((client, index) => new HotelWebsiteManagementService(client).decide(index === 0 ? tenantBAdmin : principal(tenantB.alternateAdmin, scopeB.organizationId), scopeB, revisionId, "APPROVED", undefined, `approve-race-${suffix}-${index}`)));
      assert.equal(decisions.filter((result) => result.status === "fulfilled").length, 1);
      assert.equal(await prisma.hotelWebsiteContentReview.count({ where: { revisionId, action: "APPROVED" } }), 1);

      const preexistingPublications = await prisma.hotelWebsitePublication.findMany({ where: { ...scopeB, revokedAt: null } });
      for (const publication of preexistingPublications) {
        await service.revoke(tenantBAdmin, scopeB, publication.id, "clear prior synthetic publication before concurrency case", `clear-publish-race-${suffix}-${publication.id}`);
      }
      const second = await service.createDraft(tenantBManager, scopeB, { content: content("Concurrent publish A"), media: [] }, `create-pub-a-${suffix}`);
      const third = await service.createDraft(tenantBManager, scopeB, { content: content("Concurrent publish B"), media: [] }, `create-pub-b-${suffix}`);
      for (const [index, candidate] of [second, third].entries()) {
        await service.submit(tenantBManager, scopeB, candidate.result.id, undefined, `submit-pub-${suffix}-${index}`);
        await service.decide(tenantBAdmin, scopeB, candidate.result.id, "APPROVED", undefined, `approve-pub-${suffix}-${index}`);
      }
      const publishResults = await Promise.allSettled(otherClients.map((client, index) => new HotelWebsiteManagementService(client).publish(index === 0 ? tenantBAdmin : principal(tenantB.alternateAdmin, scopeB.organizationId), scopeB, [second, third][index].result.id, `publish-race-${suffix}-${index}`)));
      assert.equal(publishResults.filter((result) => result.status === "fulfilled").length, 1);
      const active = await prisma.hotelWebsitePublication.findMany({ where: { ...scopeB, revokedAt: null } });
      assert.equal(active.length, 1);
      const next = await service.createDraft(tenantBManager, scopeB, { content: content("Concurrent revoke and replace"), media: [] }, `create-replace-${suffix}`);
      await service.submit(tenantBManager, scopeB, next.result.id, undefined, `submit-replace-${suffix}`);
      await service.decide(tenantBAdmin, scopeB, next.result.id, "APPROVED", undefined, `approve-replace-${suffix}`);
      const replaceRace = await Promise.allSettled([
        new HotelWebsiteManagementService(otherClients[0]).revoke(tenantBAdmin, scopeB, active[0].id, "concurrency acceptance", `revoke-race-${suffix}`),
        new HotelWebsiteManagementService(otherClients[1]).publish(principal(tenantB.alternateAdmin, scopeB.organizationId), scopeB, next.result.id, `publish-replace-race-${suffix}`),
      ]);
      assert.equal(replaceRace[0].status, "fulfilled");
      if (replaceRace[1].status === "rejected") assert.ok(replaceRace[1].reason instanceof HotelWebsiteManagementConflictError);
      assert.ok(await prisma.hotelWebsitePublication.count({ where: { ...scopeB, revokedAt: null } }) <= 1);
      assert.equal(await prisma.hotelBookingHold.count({ where: { organizationId: { in: [tenantA.organization.id, tenantB.organization.id] } } }), 0);
      assert.equal(await prisma.hotelReservation.count({ where: { organizationId: { in: [tenantA.organization.id, tenantB.organization.id] } } }), 0);
      assert.equal(await prisma.hotelInventory.count({ where: { organizationId: { in: [tenantA.organization.id, tenantB.organization.id] } } }), 0);
      assert.equal(await prisma.organizationCapability.count({ where: { organizationId: { in: [tenantA.organization.id, tenantB.organization.id] }, key: "HOTEL_BOOKING" } }), 0);
    });
  } finally {
    await Promise.all(clients.map((client) => client.$disconnect()));
    await prisma.$disconnect();
  }
});
