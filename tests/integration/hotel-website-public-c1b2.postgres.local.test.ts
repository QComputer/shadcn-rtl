import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { test } from "node:test";

const enabled = process.env.HOTEL_WEBSITE_C1B2_PG_ACCEPTANCE === "1";

function verifyTarget() {
  assert.notEqual(process.env.NODE_ENV, "production");
  assert.notEqual(process.env.VERCEL_ENV, "production");
  assert.equal(process.env.AI_MEDIA_LOCAL_DOCKER_E2E, "1");
  assert.equal(process.env.DATABASE_URL, process.env.DIRECT_URL);
  const runId = process.env.HOTEL_WEBSITE_C1B2_RUN_ID?.toLowerCase();
  const containerId = process.env.HOTEL_WEBSITE_C1B2_CONTAINER_ID?.toLowerCase();
  const volume = process.env.HOTEL_WEBSITE_C1B2_VOLUME_NAME;
  assert.ok(runId && /^[a-f0-9]{8,16}$/.test(runId));
  assert.ok(containerId && /^[a-f0-9]{64}$/.test(containerId));
  assert.equal(volume, `hotel-website-c1b2-${runId}`);
  const url = new URL(process.env.DATABASE_URL ?? "");
  const databaseName = `bazarbaaz_hotel_c1b2_${runId}`;
  assert.equal(url.protocol, "postgresql:");
  assert.equal(url.hostname, "127.0.0.1");
  assert.equal(decodeURIComponent(url.username), "c1b2_test");
  assert.equal(decodeURIComponent(url.pathname.slice(1)), databaseName);
  const containers = JSON.parse(execFileSync("docker", ["inspect", containerId], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] })) as Array<{
    Id: string;
    Config: { Image: string; Labels?: Record<string, string> };
    State: { Running: boolean };
    Mounts: Array<{ Type: string; Name?: string; Destination: string }>;
    NetworkSettings: { Ports: Record<string, Array<{ HostIp: string; HostPort: string }> | null> };
  }>;
  assert.equal(containers.length, 1);
  const container = containers[0]!;
  assert.equal(container.Id.toLowerCase(), containerId);
  assert.equal(container.Config.Image, "postgres:17-alpine");
  assert.equal(container.Config.Labels?.["codex.task"], "hotel-website-c1b2-db-acceptance");
  assert.equal(container.Config.Labels?.["codex.run_id"], runId);
  assert.equal(container.State.Running, true);
  assert.ok(container.Mounts.some((mount) => mount.Type === "volume" && mount.Name === volume && mount.Destination === "/var/lib/postgresql/data"));
  const bindings = container.NetworkSettings.Ports["5432/tcp"];
  assert.ok(bindings?.length === 1 && bindings[0]?.HostIp === "127.0.0.1" && bindings[0]?.HostPort === url.port);
  const migrations = readdirSync("prisma/migrations", { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
  assert.equal(migrations.length, 95);
  return { runId, containerId, volume, databaseName, migrations };
}

const pageContent = (title: string) => ({
  title: { fa: `${title} فارسی`, en: title },
  hero: { heading: { fa: `خوش آمدید ${title}`, en: `Welcome ${title}` } },
  introduction: { body: { fa: `معرفی ${title}`, en: `${title} introduction` } },
  sections: [{ key: "story", order: 1, visible: true, kind: "TEXT", heading: { en: "Story" }, body: { en: `${title} story` } }],
  contact: { phone: "+10000000000", address: { en: "Do not publish this address" } },
});

test("C1B2 public website reads enforce host, website capability, exact publication and current media eligibility in PostgreSQL", { skip: !enabled, concurrency: false }, async () => {
  const target = verifyTarget();
  const [{ PrismaClient }, { HotelWebsiteManagementService }, { approveHotelPublication }, { getPublishedHotelWebsite, listPublishedHotelWebsiteRoomCategories, getPublishedHotelWebsiteMedia }] = await Promise.all([
    import("@prisma/client"),
    import("@/lib/hotel/content/hotel-website-management.service"),
    import("@/lib/hotel/services/hotel-publication.service"),
    import("@/lib/hotel/content/hotel-website-public.service"),
  ]);
  const prisma = new PrismaClient();
  const suffix = target.runId;
  const management = new HotelWebsiteManagementService(prisma);

  async function tenant(key: string) {
    const slug = `c1b2-${suffix}-${key}`;
    const organization = await prisma.organization.create({ data: { name: slug, slug, type: "SHOP", vertical: "HOTEL" } });
    const property = await prisma.hotelProperty.create({ data: { organizationId: organization.id, organizationSlug: organization.slug, slug: "damoon", name: `Public hotel ${key}` } });
    await prisma.organizationCapability.create({ data: { organizationId: organization.id, key: "HOTEL_WEBSITE", status: "ACTIVE", enabledAt: new Date() } });
    const domainName = `${slug}.test.example`;
    await prisma.organizationDomain.create({ data: { organizationId: organization.id, domain: domainName, normalizedDomain: domainName, status: "ACTIVE", providerVerified: true, dnsConfigured: true, sslReady: true } });
    const manager = await prisma.user.create({ data: { name: `${slug}-manager`, password: "disposable-fixture-only", role: "MANAGER" } });
    const admin = await prisma.user.create({ data: { name: `${slug}-admin`, password: "disposable-fixture-only", role: "ADMIN" } });
    for (const user of [manager, admin]) await prisma.organizationMember.create({ data: { organizationId: organization.id, organizationSlug: organization.slug, userId: user.id, role: user.role, isActive: true } });
    return { organization, property, manager, admin, domainName };
  }

  const principal = (user: { id: string; role: string }, organizationId: string) => ({ userId: user.id, role: user.role as "MANAGER" | "ADMIN", organizationId });

  try {
    await prisma.$connect();
    const [identity] = await prisma.$queryRaw<Array<{ databaseName: string; userName: string; schemaName: string; version: number; address: string; port: number }>>`
      SELECT current_database() AS "databaseName", current_user AS "userName", current_schema() AS "schemaName",
             current_setting('server_version_num')::int AS version, inet_server_addr()::text AS address, inet_server_port() AS port
    `;
    assert.equal(identity?.databaseName, target.databaseName);
    assert.equal(identity?.userName, "c1b2_test");
    assert.equal(identity?.schemaName, "public");
    assert.ok(identity && identity.version >= 170000 && identity.version < 180000);
    assert.ok(identity?.address && !["127.0.0.1", "::1"].includes(identity.address));
    assert.equal(Number(identity?.port), 5432);
    const ledger = await prisma.$queryRaw<Array<{ migration_name: string; finished_at: Date | null; rolled_back_at: Date | null }>>`SELECT migration_name, finished_at, rolled_back_at FROM "_prisma_migrations" ORDER BY migration_name`;
    assert.deepEqual(ledger.map((row) => row.migration_name), target.migrations);
    assert.ok(ledger.every((row) => row.finished_at && !row.rolled_back_at));
    assert.equal(ledger.length, 95);
    assert.equal(await prisma.organization.count(), 0, "target must have no pre-existing organizations");
    assert.equal(await prisma.user.count(), 0, "target must have no pre-existing users");
    assert.equal(await prisma.hotelProperty.count(), 0, "target must have no pre-existing Hotel properties");
    assert.equal(await prisma.organizationCapability.count(), 0, "target must have no pre-existing capabilities");

    const a = await tenant("a");
    const b = await tenant("b");
    assert.equal(await prisma.organizationCapability.count({ where: { organizationId: { in: [a.organization.id, b.organization.id] }, key: "HOTEL_BOOKING" } }), 0);
    const room = await prisma.hotelRoomType.create({ data: { organizationId: a.organization.id, propertyId: a.property.id, slug: "suite", name: "Suite", maxAdults: 2, maxChildren: 1, maxOccupancy: 3, beds: [{ kind: "queen", count: 1 }], sizeSqm: 30 } });
    const image = await prisma.image.create({ data: { organizationId: a.organization.id, filename: `c1b2-${suffix}-a.png`, mimeType: "image/png", url: `/uploads/c1b2-${suffix}-a.png`, access: "PUBLIC" } });
    const scope = { organizationId: a.organization.id, propertyId: a.property.id };
    const draft = await management.createDraft(principal(a.manager, a.organization.id), scope, {
      content: pageContent("Tenant A"),
      media: [
        { imageId: image.id, scope: "PROPERTY", roomTypeId: null, slot: "GALLERY", sortOrder: 0, altText: { en: "Tenant A exterior" } },
        { imageId: image.id, scope: "ROOM_CATEGORY", roomTypeId: room.id, slot: "GALLERY", sortOrder: 0, altText: { en: "Suite" } },
      ],
    }, `c1b2-create-${suffix}`);
    const revisionId = draft.result.id;
    await management.submit(principal(a.manager, a.organization.id), scope, revisionId, undefined, `c1b2-submit-${suffix}`);
    await management.decide(principal(a.admin, a.organization.id), scope, revisionId, "APPROVED", undefined, `c1b2-review-${suffix}`);
    await management.publish(principal(a.admin, a.organization.id), scope, revisionId, `c1b2-publish-${suffix}`);
    await approveHotelPublication({ organizationId: a.organization.id, propertyId: a.property.id, resourceType: "ROOM_TYPE", resourceId: room.id, scope: { availability: true, quote: false, policies: false }, userId: a.admin.id, role: "ADMIN" }, prisma);

    const scopeB = { organizationId: b.organization.id, propertyId: b.property.id };
    const draftB = await management.createDraft(principal(b.manager, b.organization.id), scopeB, { content: pageContent("Tenant B"), media: [] }, `c1b2-create-${suffix}-b`);
    await management.submit(principal(b.manager, b.organization.id), scopeB, draftB.result.id, undefined, `c1b2-submit-${suffix}-b`);
    await management.decide(principal(b.admin, b.organization.id), scopeB, draftB.result.id, "APPROVED", undefined, `c1b2-review-${suffix}-b`);
    await management.publish(principal(b.admin, b.organization.id), scopeB, draftB.result.id, `c1b2-publish-${suffix}-b`);

    const beforeReads = {
      revisions: await prisma.hotelWebsiteContentRevision.count(),
      associations: await prisma.hotelWebsiteMediaAssociation.count(),
      publications: await prisma.hotelWebsitePublication.count(),
      holds: await prisma.hotelBookingHold.count(),
      reservations: await prisma.hotelReservation.count(),
      inventory: await prisma.hotelInventory.count(),
      capabilities: await prisma.organizationCapability.count(),
      approvals: await prisma.hotelPublicationApproval.count(),
    };
    const published = await getPublishedHotelWebsite({ host: a.domainName, propertySlug: "damoon", locale: "en", db: prisma });
    assert.equal(published?.mode, "PUBLISHED");
    if (!published || published.mode !== "PUBLISHED") throw new Error("published website unexpectedly absent");
    assert.equal((published.content as { title: string }).title, "Tenant A");
    assert.equal("address" in (published.content as { contact: object }).contact, false);
    assert.equal(published.propertyGallery.length, 1);
    assert.ok(published.propertyGallery[0]?.src.startsWith("/api/hotel/v1/website/media/"));
    assert.equal(JSON.stringify(published).includes(image.id), false);
    assert.equal(JSON.stringify(published).includes("Do not publish this address"), false);
    const roomResponse = await listPublishedHotelWebsiteRoomCategories({ host: a.domainName, propertySlug: "damoon", locale: "en", db: prisma });
    assert.equal(roomResponse?.mode, "PUBLISHED");
    assert.equal(roomResponse?.roomCategories.length, 1);
    assert.equal(JSON.stringify(roomResponse).includes("totalAllotment"), false);
    const association = await prisma.hotelWebsiteMediaAssociation.findFirstOrThrow({ where: { revisionId, imageId: image.id, scope: "PROPERTY" }, select: { id: true } });
    assert.equal((await getPublishedHotelWebsiteMedia({ host: a.domainName, associationId: association.id, db: prisma }))?.url, image.url);
    const tenantBWebsite = await getPublishedHotelWebsite({ host: b.domainName, propertySlug: "damoon", locale: "en", db: prisma });
    assert.equal(tenantBWebsite?.mode, "PUBLISHED");
    if (tenantBWebsite?.mode === "PUBLISHED") assert.equal((tenantBWebsite.content as { title: string }).title, "Tenant B");
    assert.equal(await getPublishedHotelWebsiteMedia({ host: b.domainName, associationId: association.id, db: prisma }), null);
    assert.equal(await getPublishedHotelWebsite({ host: "unknown.test.example", propertySlug: "damoon", locale: "en", db: prisma }), null);

    const websiteCapability = await prisma.organizationCapability.findUniqueOrThrow({ where: { organizationId_key: { organizationId: a.organization.id, key: "HOTEL_WEBSITE" } } });
    await prisma.organizationCapability.update({ where: { id: websiteCapability.id }, data: { status: "INACTIVE", disabledAt: new Date() } });
    assert.equal(await getPublishedHotelWebsite({ host: a.domainName, propertySlug: "damoon", locale: "en", db: prisma }), null);
    await prisma.organizationCapability.update({ where: { id: websiteCapability.id }, data: { status: "ACTIVE", disabledAt: null } });

    await prisma.image.update({ where: { id: image.id }, data: { access: "PRIVATE" } });
    const invalidated = await getPublishedHotelWebsite({ host: a.domainName, propertySlug: "damoon", locale: "en", db: prisma });
    assert.equal(invalidated?.mode, "PUBLISHED");
    if (invalidated?.mode === "PUBLISHED") assert.equal(invalidated.propertyGallery.length, 0);
    assert.equal(await getPublishedHotelWebsiteMedia({ host: a.domainName, associationId: association.id, db: prisma }), null);

    const tenantBImage = await prisma.image.create({ data: { organizationId: b.organization.id, filename: `c1b2-${suffix}-b.png`, mimeType: "image/png", url: `/uploads/c1b2-${suffix}-b.png`, access: "PUBLIC" } });
    await assert.rejects(() => management.createDraft(principal(a.manager, a.organization.id), scope, { content: pageContent("Foreign media"), media: [{ imageId: tenantBImage.id, scope: "PROPERTY", roomTypeId: null, sortOrder: 0, altText: {} }] }, `c1b2-foreign-${suffix}`));
    assert.equal(await prisma.hotelWebsiteMediaAssociation.count({ where: { imageId: tenantBImage.id, organizationId: a.organization.id } }), 0);
    const afterReads = {
      revisions: await prisma.hotelWebsiteContentRevision.count(),
      associations: await prisma.hotelWebsiteMediaAssociation.count(),
      publications: await prisma.hotelWebsitePublication.count(),
      holds: await prisma.hotelBookingHold.count(),
      reservations: await prisma.hotelReservation.count(),
      inventory: await prisma.hotelInventory.count(),
      capabilities: await prisma.organizationCapability.count(),
      approvals: await prisma.hotelPublicationApproval.count(),
    };
    assert.deepEqual(afterReads, beforeReads, "public read calls do not mutate content, capability, approval, booking or inventory state");

    const raceLabels = ["race-one", "race-two"];
    const createResults = await Promise.allSettled(raceLabels.map((label) => management.createDraft(principal(a.manager, a.organization.id), scope, { content: pageContent(label), media: [] }, `c1b2-create-${suffix}-${label}`)));
    const raceDrafts = await Promise.all(createResults.map((result, index) => {
      if (result.status === "fulfilled") return result.value;
      assert.match(String(result.reason?.message), /Concurrent content change/, "serialization conflict is explicit and safely retryable");
      const label = raceLabels[index]!;
      return management.createDraft(principal(a.manager, a.organization.id), scope, { content: pageContent(label), media: [] }, `c1b2-create-${suffix}-${label}`);
    }));
    assert.notEqual(raceDrafts[0]?.result.id, raceDrafts[1]?.result.id);
    assert.notEqual(raceDrafts[0]?.result.revisionNumber, raceDrafts[1]?.result.revisionNumber);
    for (const [index, draftResult] of raceDrafts.entries()) {
      await management.submit(principal(a.manager, a.organization.id), scope, draftResult.result.id, undefined, `c1b2-submit-${suffix}-race-${index}`);
      await management.decide(principal(a.admin, a.organization.id), scope, draftResult.result.id, "APPROVED", undefined, `c1b2-review-${suffix}-race-${index}`);
    }
    const activePublication = await prisma.hotelWebsitePublication.findFirstOrThrow({ where: { organizationId: a.organization.id, propertyId: a.property.id, revokedAt: null }, select: { id: true } });
    await management.revoke(principal(a.admin, a.organization.id), scope, activePublication.id, "Concurrent publication acceptance", `c1b2-revoke-${suffix}`);
    const competingPublishes = await Promise.allSettled(raceDrafts.map((draftResult, index) => management.publish(principal(a.admin, a.organization.id), scope, draftResult.result.id, `c1b2-publish-${suffix}-race-${index}`)));
    assert.equal(competingPublishes.filter((result) => result.status === "fulfilled").length, 1, "exactly one concurrent publication wins");
    assert.equal(competingPublishes.filter((result) => result.status === "rejected").length, 1, "the conflicting concurrent publication fails closed");
    assert.equal(await prisma.hotelWebsitePublication.count({ where: { organizationId: a.organization.id, propertyId: a.property.id, revokedAt: null } }), 1);
    assert.equal(await prisma.hotelBookingHold.count({ where: { organizationId: a.organization.id } }), 0);
    assert.equal(await prisma.hotelReservation.count({ where: { organizationId: a.organization.id } }), 0);
    assert.equal(await prisma.hotelInventory.count({ where: { organizationId: a.organization.id } }), 0);

  } finally {
    await prisma.$disconnect();
  }
});
