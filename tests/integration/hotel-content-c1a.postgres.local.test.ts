import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { PrismaClient } from "@prisma/client";
import { createHotelWebsiteDraftRevision } from "@/lib/hotel/content/hotel-website-content.service";

const prisma = new PrismaClient();
const suffix = randomUUID().replaceAll("-", "").slice(0, 10);
const allowSyntheticReplay = process.env.HOTEL_CONTENT_C1A_PG_ACCEPTANCE_REPEAT === "1";
const content = (title: string) => ({
  title: { fa: title },
  hero: { heading: { fa: `${title} hero` } },
  introduction: { body: { fa: `${title} introduction` } },
  sections: [],
  contact: {},
});

function assertDisposableTarget() {
  assert.equal(process.env.HOTEL_CONTENT_C1A_PG_ACCEPTANCE, "1", "set the explicit disposable-database acceptance guard");
  const rawUrl = process.env.DATABASE_URL;
  assert.ok(rawUrl, "DATABASE_URL is required for the guarded PostgreSQL suite");
  const url = new URL(rawUrl);
  assert.equal(url.hostname, "127.0.0.1", "database must use an explicit loopback endpoint");
  assert.equal(url.username, "c1a_test", "database user must identify the disposable test role");
  assert.match(decodeURIComponent(url.pathname.slice(1)), /^bazarbaaz_hotel_c1a_[a-f0-9]{8,}$/i, "database name must be task-scoped and random");
}

async function createTenant(slug: string) {
  const organization = await prisma.organization.create({
    data: { name: `C1A ${slug}`, slug, type: "SHOP", vertical: "HOTEL" },
  });
  const manager = await prisma.user.create({
    data: { name: `c1a-${slug}`, password: "disposable-fixture-only", role: "MANAGER" },
  });
  await prisma.organizationMember.create({
    data: { organizationId: organization.id, organizationSlug: slug, userId: manager.id, role: "MANAGER" },
  });
  return { organization, manager };
}

async function createProperty(organizationId: string, organizationSlug: string, suffixValue: string) {
  return prisma.hotelProperty.create({
    data: { organizationId, organizationSlug, slug: `property-${suffixValue}`, name: `Property ${suffixValue}` },
  });
}

async function createRoom(organizationId: string, propertyId: string, suffixValue: string) {
  return prisma.hotelRoomType.create({
    data: { organizationId, propertyId, slug: `room-${suffixValue}`, name: `Room ${suffixValue}`, maxAdults: 2, maxOccupancy: 2, beds: [] },
  });
}

async function createImage(organizationId: string | null, suffixValue: string, options: { access?: "PUBLIC" | "PRIVATE"; mimeType?: string | null; url?: string; filename?: string | null } = {}) {
  const filename = options.filename === undefined ? `c1a-${suffix}-${suffixValue}.png` : options.filename;
  return prisma.image.create({
    data: {
      organizationId,
      filename,
      mimeType: options.mimeType === undefined ? "image/png" : options.mimeType,
      url: options.url ?? (filename ? `/uploads/${filename}` : "https://untrusted.example/image.png"),
      access: options.access ?? "PUBLIC",
    },
  });
}

test("C1A PostgreSQL acceptance (requires one fresh disposable local PostgreSQL 17 database)", async (t) => {
  assertDisposableTarget();
  await prisma.$connect();

  try {
    const [identity] = await prisma.$queryRaw<Array<{ database: string; schema: string; username: string; address: string; port: number; version: string }>>`
      SELECT current_database() AS database, current_schema() AS schema,
             current_user AS username, inet_server_addr()::text AS address,
             inet_server_port() AS port, current_setting('server_version_num') AS version
    `;
    assert.equal(identity.database, decodeURIComponent(new URL(process.env.DATABASE_URL!).pathname.slice(1)));
    assert.equal(identity.schema, "public");
    assert.equal(identity.username, "c1a_test");
    assert.match(identity.address, /^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/, "PostgreSQL must be reached through the isolated container network");
    assert.equal(Number(identity.port), 5432, "the database listener must be the container's PostgreSQL port");
    assert.ok(Number(identity.version) >= 170000 && Number(identity.version) < 180000, "PostgreSQL 17 is required");

    const [ledger] = await prisma.$queryRaw<Array<{ total: bigint; successful: bigint; unfinished: bigint; failed: bigint }>>`
      SELECT count(*) AS total,
             count(*) FILTER (WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL) AS successful,
             count(*) FILTER (WHERE finished_at IS NULL AND rolled_back_at IS NULL) AS unfinished,
             count(*) FILTER (WHERE logs IS NOT NULL AND finished_at IS NULL AND rolled_back_at IS NULL) AS failed
      FROM "_prisma_migrations"
    `;
    assert.equal(Number(ledger.total), 94, "expected 92 committed R1 migrations followed by the two C1A migrations");
    assert.equal(Number(ledger.successful), 94);
    assert.equal(Number(ledger.unfinished), 0);
    assert.equal(Number(ledger.failed), 0);
    const tail = await prisma.$queryRaw<Array<{ migration_name: string }>>`
      SELECT migration_name FROM "_prisma_migrations" ORDER BY migration_name DESC LIMIT 2
    `;
    assert.deepEqual(tail.map((row) => row.migration_name), [
      "20261012140000_hotel_website_content_foundation",
      "20261012130000_add_hotel_website_capability",
    ]);

    const freshDatabaseCounts = {
      organizations: await prisma.organization.count(),
      users: await prisma.user.count(),
      hotelProperties: await prisma.hotelProperty.count(),
      images: await prisma.image.count(),
      websitePages: await prisma.hotelWebsitePage.count(),
      websiteRevisions: await prisma.hotelWebsiteContentRevision.count(),
    };
    if (!allowSyntheticReplay) {
      for (const [name, count] of Object.entries(freshDatabaseCounts)) assert.equal(count, 0, `fresh acceptance database must have no pre-existing ${name}`);
    } else {
      const priorOrganizations = await prisma.organization.findMany({ select: { id: true, slug: true } });
      assert.ok(priorOrganizations.length > 0 && priorOrganizations.every(({ slug }) => /^[ab]-[a-f0-9]+$/i.test(slug)), "repeat mode permits only synthetic C1A fixture organizations from the same disposable run");
      assert.equal(await prisma.user.count({ where: { name: { not: { startsWith: "c1a-" } } } }), 0);
      assert.equal(await prisma.hotelProperty.count({ where: { organizationId: { notIn: priorOrganizations.map(({ id }) => id) } } }), 0);
      assert.equal(await prisma.hotelWebsitePage.count({ where: { organizationId: { notIn: priorOrganizations.map(({ id }) => id) } } }), 0);
      assert.equal(await prisma.image.count({ where: { AND: [{ filename: { not: { startsWith: "c1a-" } } }, { organizationId: { not: null } }] } }), 0);
    }

    const [capsBefore] = await prisma.$queryRaw<Array<{ website: bigint; booking: bigint }>>`
      SELECT count(*) FILTER (WHERE "key" = 'HOTEL_WEBSITE') AS website,
             count(*) FILTER (WHERE "key" = 'HOTEL_BOOKING') AS booking
      FROM "OrganizationCapability"
    `;
    if (!allowSyntheticReplay) {
      assert.equal(Number(capsBefore.website), 0, "migrations must not enable Hotel websites for any tenant");
      assert.equal(Number(capsBefore.booking), 0, "fresh migration chain must not create booking grants");
    }

    const tenantA = await createTenant(`a-${suffix}`);
    const tenantB = await createTenant(`b-${suffix}`);
    assert.equal(await prisma.organizationCapability.count({ where: { organizationId: { in: [tenantA.organization.id, tenantB.organization.id] } } }), 0, "creating tenants must not implicitly grant a capability");
    const websiteCapability = await prisma.organizationCapability.create({
      data: { organizationId: tenantA.organization.id, key: "HOTEL_WEBSITE", status: "ACTIVE", enabledAt: new Date() },
    });
    assert.equal(websiteCapability.key, "HOTEL_WEBSITE");
    assert.equal(await prisma.organizationCapability.count({ where: { organizationId: tenantA.organization.id, key: "HOTEL_BOOKING" } }), 0);
    await t.test("active website grants require an explicit enabledAt and remain independent of booking", async () => {
      await assert.rejects(() => prisma.organizationCapability.create({
        data: { organizationId: tenantB.organization.id, key: "HOTEL_WEBSITE", status: "ACTIVE" },
      }));
      const inactive = await prisma.organizationCapability.create({
        data: { organizationId: tenantB.organization.id, key: "HOTEL_WEBSITE", status: "INACTIVE", disabledAt: new Date() },
      });
      assert.equal(inactive.enabledAt, null);
      assert.equal(await prisma.organizationCapability.count({ where: { organizationId: tenantB.organization.id, key: "HOTEL_BOOKING" } }), 0);
    });

    const propertyA = await createProperty(tenantA.organization.id, tenantA.organization.slug, `a-${suffix}`);
    const propertyA2 = await createProperty(tenantA.organization.id, tenantA.organization.slug, `a2-${suffix}`);
    const propertyA3 = await createProperty(tenantA.organization.id, tenantA.organization.slug, `a3-${suffix}`);
    const propertyA4 = await createProperty(tenantA.organization.id, tenantA.organization.slug, `a4-${suffix}`);
    const propertyA5 = await createProperty(tenantA.organization.id, tenantA.organization.slug, `a5-${suffix}`);
    const propertyB = await createProperty(tenantB.organization.id, tenantB.organization.slug, `b-${suffix}`);
    const roomA = await createRoom(tenantA.organization.id, propertyA.id, `a-${suffix}`);
    const roomA2 = await createRoom(tenantA.organization.id, propertyA2.id, `a2-${suffix}`);
    const roomB = await createRoom(tenantB.organization.id, propertyB.id, `b-${suffix}`);
    const imageA = await createImage(tenantA.organization.id, "owned-a");
    const imageB = await createImage(tenantB.organization.id, "owned-b");
    const privateImage = await createImage(tenantA.organization.id, "private", { access: "PRIVATE" });
    const unsupportedImage = await createImage(tenantA.organization.id, "unsupported", { mimeType: "text/html" });
    const unownedImage = await createImage(null, "unowned");
    const invalidUrlImage = await createImage(tenantA.organization.id, "invalid-url", { url: "https://untrusted.example/not-platform-media.png" });

    const draft = await createHotelWebsiteDraftRevision({
      organizationId: tenantA.organization.id,
      propertyId: propertyA.id,
      actorUserId: tenantA.manager.id,
      content: content("Approved candidate"),
      media: [{ imageId: imageA.id, scope: "ROOM_CATEGORY", roomTypeId: roomA.id, sortOrder: 0, altText: { fa: "اتاق" } }],
    }, prisma);
    const page = await prisma.hotelWebsitePage.findUniqueOrThrow({ where: { id: draft.pageId } });
    const association = await prisma.hotelWebsiteMediaAssociation.findFirstOrThrow({ where: { revisionId: draft.id } });
    assert.equal(association.organizationId, tenantA.organization.id);
    assert.equal(association.propertyId, propertyA.id);
    assert.equal(association.roomTypeId, roomA.id);
    assert.equal(association.sortOrder, 0);

    await t.test("service rejects cross-tenant property, room, image, unowned, private and invalid-serving media", async () => {
      const before = await prisma.hotelWebsiteContentRevision.count({ where: { organizationId: tenantA.organization.id } });
      const attempt = (propertyId: string, imageId: string, roomTypeId: string | null = null, scope: "PROPERTY" | "ROOM_CATEGORY" = "PROPERTY") =>
        createHotelWebsiteDraftRevision({ organizationId: tenantA.organization.id, propertyId, actorUserId: tenantA.manager.id, content: content("Rejected"), media: [{ imageId, scope, roomTypeId, sortOrder: 9, altText: {} }] }, prisma);
      await assert.rejects(() => attempt(propertyB.id, imageA.id));
      await assert.rejects(() => attempt(propertyA.id, imageB.id));
      await assert.rejects(() => attempt(propertyA.id, imageA.id, roomA2.id, "ROOM_CATEGORY"));
      await assert.rejects(() => attempt(propertyA.id, privateImage.id));
      await assert.rejects(() => attempt(propertyA.id, unsupportedImage.id));
      await assert.rejects(() => attempt(propertyA.id, unownedImage.id));
      await assert.rejects(() => attempt(propertyA.id, invalidUrlImage.id));
      await assert.rejects(() => attempt(propertyA.id, `missing-${suffix}`));
      await assert.rejects(() => createHotelWebsiteDraftRevision({ organizationId: tenantB.organization.id, propertyId: propertyB.id, actorUserId: tenantB.manager.id, content: content("Disabled tenant"), media: [] }, prisma));
      assert.equal(await prisma.hotelWebsiteContentRevision.count({ where: { organizationId: tenantA.organization.id } }), before);
      assert.equal(await prisma.hotelWebsitePage.count({ where: { organizationId: tenantA.organization.id, propertyId: propertyB.id } }), 0);
    });

    await t.test("all accepted image MIME types and platform serving URL shapes are eligible", async () => {
      const mimeTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
      const acceptedImages = await Promise.all(mimeTypes.map((mimeType, index) => {
        const extension = ["jpg", "png", "webp", "gif"][index];
        const filename = `c1a-${suffix}-accepted-${index}.${extension}`;
        return createImage(tenantA.organization.id, `accepted-${index}`, {
          mimeType,
          filename,
          url: index === 0 ? `/uploads/${filename}` : `https://tenant.public.blob.vercel-storage.com/${filename}`,
        });
      }));
      const accepted = await createHotelWebsiteDraftRevision({
        organizationId: tenantA.organization.id,
        propertyId: propertyA5.id,
        actorUserId: tenantA.manager.id,
        content: content("Accepted image formats"),
        media: acceptedImages.map((image, index) => ({ imageId: image.id, scope: "PROPERTY" as const, roomTypeId: null, sortOrder: index, altText: {} })),
      }, prisma);
      assert.equal(accepted.mediaCount, mimeTypes.length);
      assert.deepEqual((await prisma.hotelWebsiteMediaAssociation.findMany({ where: { revisionId: accepted.id }, orderBy: { sortOrder: "asc" } })).map((item) => item.sortOrder), [0, 1, 2, 3]);
    });

    await t.test("composite foreign keys reject cross-tenant content, foreign properties and foreign-property room categories", async () => {
      const before = await prisma.hotelWebsiteMediaAssociation.count();
      const baseData = {
        organizationId: tenantA.organization.id,
        propertyId: propertyA.id,
        pageId: page.id,
        revisionId: draft.id,
        imageId: imageA.id,
        scope: "PROPERTY" as const,
        roomTypeId: null,
        sortOrder: 20,
        altText: { fa: "تصویر" },
      };
      await assert.rejects(() => prisma.hotelWebsiteMediaAssociation.create({ data: { ...baseData, organizationId: tenantB.organization.id, propertyId: propertyB.id } }));
      await assert.rejects(() => prisma.hotelWebsiteMediaAssociation.create({ data: { ...baseData, propertyId: propertyA2.id } }));
      await assert.rejects(() => prisma.hotelWebsiteMediaAssociation.create({ data: { ...baseData, scope: "ROOM_CATEGORY", roomTypeId: roomA2.id } }));
      await assert.rejects(() => prisma.hotelWebsiteMediaAssociation.create({ data: { ...baseData, scope: "ROOM_CATEGORY", roomTypeId: roomB.id } }));
      assert.equal(await prisma.hotelWebsiteMediaAssociation.count(), before);
    });

    await t.test("revision snapshots and attached media are immutable; image deletion is restricted", async () => {
      const snapshot = await prisma.hotelWebsiteContentRevision.findUniqueOrThrow({ where: { id: draft.id } });
      await assert.rejects(() => prisma.$executeRaw`UPDATE "HotelWebsiteContentRevision" SET "content" = ${JSON.stringify(content("Tampered"))}::jsonb WHERE "id" = ${draft.id}`);
      await assert.rejects(() => prisma.$executeRaw`UPDATE "HotelWebsiteMediaAssociation" SET "sortOrder" = 7 WHERE "id" = ${association.id}`);
      await assert.rejects(() => prisma.$executeRaw`DELETE FROM "HotelWebsiteMediaAssociation" WHERE "id" = ${association.id}`);
      await assert.rejects(() => prisma.image.delete({ where: { id: imageA.id } }));
      const after = await prisma.hotelWebsiteContentRevision.findUniqueOrThrow({ where: { id: draft.id } });
      assert.deepEqual(after.content, snapshot.content);
      assert.equal(await prisma.hotelWebsiteMediaAssociation.count({ where: { id: association.id } }), 1);
      assert.equal(await prisma.image.count({ where: { id: imageA.id } }), 1);
      await prisma.image.update({ where: { id: imageA.id }, data: { access: "PRIVATE" } });
      assert.equal(await prisma.image.count({ where: { id: imageA.id, access: "PUBLIC" } }), 0);
      assert.equal(await prisma.hotelWebsiteMediaAssociation.count({ where: { id: association.id } }), 1, "asset eligibility changes do not rewrite the historical revision link");
      await assert.rejects(() => createHotelWebsiteDraftRevision({ organizationId: tenantA.organization.id, propertyId: propertyA.id, actorUserId: tenantA.manager.id, content: content("Private asset"), media: [{ imageId: imageA.id, scope: "ROOM_CATEGORY", roomTypeId: roomA.id, sortOrder: 4, altText: {} }] }, prisma));
      await prisma.image.update({ where: { id: imageA.id }, data: { access: "PUBLIC" } });
      await prisma.image.update({ where: { id: imageA.id }, data: { url: "https://untrusted.example/replaced.png" } });
      await assert.rejects(() => createHotelWebsiteDraftRevision({ organizationId: tenantA.organization.id, propertyId: propertyA.id, actorUserId: tenantA.manager.id, content: content("Invalid serving URL"), media: [{ imageId: imageA.id, scope: "ROOM_CATEGORY", roomTypeId: roomA.id, sortOrder: 4, altText: {} }] }, prisma));
      await prisma.image.update({ where: { id: imageA.id }, data: { url: `/uploads/${imageA.filename}` } });
      await prisma.image.update({ where: { id: imageA.id }, data: { mimeType: "text/html" } });
      await assert.rejects(() => createHotelWebsiteDraftRevision({ organizationId: tenantA.organization.id, propertyId: propertyA.id, actorUserId: tenantA.manager.id, content: content("Invalid MIME"), media: [{ imageId: imageA.id, scope: "ROOM_CATEGORY", roomTypeId: roomA.id, sortOrder: 4, altText: {} }] }, prisma));
      await prisma.image.update({ where: { id: imageA.id }, data: { mimeType: "image/png" } });
    });

    await t.test("publication accepts only approved revisions, preserves old publications, and revokes safely", async () => {
      const publicationData = { organizationId: tenantA.organization.id, propertyId: propertyA.id, pageId: page.id, revisionId: draft.id, publishedByUserId: tenantA.manager.id };
      await assert.rejects(() => prisma.hotelWebsitePublication.create({ data: publicationData }));
      assert.equal(await prisma.hotelWebsitePublication.count({ where: { pageId: page.id } }), 0);
      await prisma.hotelWebsiteContentRevision.update({ where: { id: draft.id }, data: { status: "APPROVED" } });
      const published = await prisma.hotelWebsitePublication.create({ data: publicationData });
      await assert.rejects(() => prisma.hotelWebsiteContentRevision.update({ where: { id: draft.id }, data: { status: "REJECTED" } }));
      await assert.rejects(() => prisma.hotelWebsitePublication.create({ data: publicationData }));
      const newDraft = await createHotelWebsiteDraftRevision({ organizationId: tenantA.organization.id, propertyId: propertyA.id, actorUserId: tenantA.manager.id, content: content("Next draft"), media: [] }, prisma);
      assert.equal(newDraft.revisionNumber, 2);
      assert.equal((await prisma.hotelWebsitePublication.findUniqueOrThrow({ where: { id: published.id } })).revisionId, draft.id);
      assert.equal((await prisma.hotelWebsiteContentRevision.findUniqueOrThrow({ where: { id: draft.id } })).contentSha256, draft.contentSha256);
      await prisma.hotelWebsitePublication.update({ where: { id: published.id }, data: { revokedAt: new Date(), revokedByUserId: tenantA.manager.id, revocationReason: "acceptance test" } });
      assert.equal(await prisma.hotelWebsitePublication.count({ where: { pageId: page.id, revokedAt: null } }), 0);
      assert.equal((await prisma.hotelWebsitePublication.findUniqueOrThrow({ where: { id: published.id } })).revisionId, draft.id);
    });

    await t.test("concurrent drafts receive distinct revision numbers and concurrent publications preserve the one-active constraint", async () => {
      const draftClients = [new PrismaClient(), new PrismaClient()];
      let concurrentDrafts: Array<PromiseSettledResult<Awaited<ReturnType<typeof createHotelWebsiteDraftRevision>>>> = [];
      try {
        await Promise.all(draftClients.map((client) => client.$connect()));
        concurrentDrafts = await Promise.allSettled(draftClients.map((client, index) => createHotelWebsiteDraftRevision({ organizationId: tenantA.organization.id, propertyId: propertyA3.id, actorUserId: tenantA.manager.id, content: content(`Concurrent ${index}`), media: [] }, client)));
      } finally {
        await Promise.all(draftClients.map((client) => client.$disconnect()));
      }
      const draftIds = concurrentDrafts.flatMap((item) => item.status === "fulfilled" ? [item.value.id] : []);
      assert.ok(draftIds.length >= 1);
      const storedDrafts = await prisma.hotelWebsiteContentRevision.findMany({ where: { propertyId: propertyA3.id }, select: { id: true, revisionNumber: true } });
      assert.equal(storedDrafts.length, draftIds.length, "failed concurrent transactions must not leave orphan revisions");
      const numbers = storedDrafts.map((row) => row.revisionNumber);
      assert.equal(new Set(numbers).size, numbers.length);
      assert.equal((await prisma.hotelWebsitePage.findUniqueOrThrow({ where: { organizationId_propertyId_pageKey: { organizationId: tenantA.organization.id, propertyId: propertyA3.id, pageKey: "HOME" } } })).revisionCounter, storedDrafts.length);
      const candidate = await createHotelWebsiteDraftRevision({ organizationId: tenantA.organization.id, propertyId: propertyA2.id, actorUserId: tenantA.manager.id, content: content("Race publication"), media: [] }, prisma);
      await prisma.hotelWebsiteContentRevision.update({ where: { id: candidate.id }, data: { status: "APPROVED" } });
      const candidatePage = await prisma.hotelWebsitePage.findUniqueOrThrow({ where: { id: candidate.pageId } });
      const clients = [new PrismaClient(), new PrismaClient()];
      try {
        await Promise.all(clients.map((client) => client.$connect()));
        const races = await Promise.allSettled(clients.map((client) => client.hotelWebsitePublication.create({ data: { organizationId: tenantA.organization.id, propertyId: propertyA2.id, pageId: candidatePage.id, revisionId: candidate.id, publishedByUserId: tenantA.manager.id } })));
        assert.equal(races.filter((item) => item.status === "fulfilled").length, 1);
        assert.equal(await prisma.hotelWebsitePublication.count({ where: { pageId: candidatePage.id, revokedAt: null } }), 1);
      } finally {
        await Promise.all(clients.map((client) => client.$disconnect()));
      }
    });

    await t.test("audit insertion failure rolls back page, revision and media in the real transaction", async () => {
      const auditBaseline = await prisma.auditLog.count({ where: { organizationId: tenantA.organization.id, entityType: "HotelWebsiteContentRevision" } });
      await prisma.$executeRawUnsafe(`
        CREATE FUNCTION "c1a_fail_website_audit"() RETURNS trigger AS $$
        BEGIN
          IF NEW."entityType" = 'HotelWebsiteContentRevision' THEN
            RAISE EXCEPTION 'forced C1A audit failure';
          END IF;
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql
      `);
      await prisma.$executeRawUnsafe(`CREATE TRIGGER "c1a_fail_website_audit_trigger" BEFORE INSERT ON "AuditLog" FOR EACH ROW EXECUTE FUNCTION "c1a_fail_website_audit"()`);
      try {
        await assert.rejects(() => createHotelWebsiteDraftRevision({ organizationId: tenantA.organization.id, propertyId: propertyA4.id, actorUserId: tenantA.manager.id, content: content("Must rollback"), media: [{ imageId: imageA.id, scope: "PROPERTY", roomTypeId: null, sortOrder: 0, altText: {} }] }, prisma));
      } finally {
        await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS "c1a_fail_website_audit_trigger" ON "AuditLog"');
        await prisma.$executeRawUnsafe('DROP FUNCTION IF EXISTS "c1a_fail_website_audit"()');
      }
      assert.equal(await prisma.hotelWebsitePage.count({ where: { propertyId: propertyA4.id } }), 0);
      assert.equal(await prisma.hotelWebsiteContentRevision.count({ where: { propertyId: propertyA4.id } }), 0);
      assert.equal(await prisma.hotelWebsiteMediaAssociation.count({ where: { propertyId: propertyA4.id } }), 0);
      assert.equal(await prisma.auditLog.count({ where: { organizationId: tenantA.organization.id, entityType: "HotelWebsiteContentRevision" } }), auditBaseline);
    });
  } finally {
    await prisma.$disconnect();
  }
});
