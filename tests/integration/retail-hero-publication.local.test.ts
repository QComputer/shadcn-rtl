import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import type { PrismaClient } from "@prisma/client";
import { initialRetailContent } from "@/lib/website-studio/retail-contract";

const enabled = process.env.RETAIL_HERO_PG_ACCEPTANCE === "1";

function assertGuardedDatabase() {
  assert.equal(process.env.DATABASE_URL, process.env.DIRECT_URL, "both Prisma URLs must point to the same disposable local database");
  const expected = new URL("postgresql://hero_test@127.0.0.1:55439/retail_hero_test");
  for (const key of ["DATABASE_URL", "DIRECT_URL"]) {
    const url = new URL(process.env[key] ?? "");
    assert.equal(url.protocol, expected.protocol);
    assert.equal(url.hostname, expected.hostname);
    assert.equal(url.port, expected.port);
    assert.equal(url.pathname, expected.pathname);
    assert.equal(decodeURIComponent(url.username), decodeURIComponent(expected.username));
  }
}

const statusIs = (expected: number) => (error: unknown) => typeof error === "object" && error !== null && "status" in error && error.status === expected;

test("Retail hero save, publication, isolation, rollback, media revocation, and tenant boundaries on local PostgreSQL", {
  skip: !enabled,
  concurrency: false,
}, async () => {
  assertGuardedDatabase();
  process.env.AI_MEDIA_LOCAL_DOCKER_E2E = "1";
  delete process.env.BLOB_READ_WRITE_TOKEN;
  const { PrismaClient: Client } = await import("@prisma/client");
  const db: PrismaClient = new Client({ log: ["error"] });
  (globalThis as unknown as { bazarBazPrisma: PrismaClient | undefined }).bazarBazPrisma = db;

  const identity = await db.$queryRaw<Array<{ database: string; version_num: number; current_user: string }>>`
    SELECT current_database() AS database, current_setting('server_version_num')::int AS version_num, current_user`;
  assert.equal(identity[0]?.database, "retail_hero_test");
  assert.ok((identity[0]?.version_num ?? 0) >= 170000 && (identity[0]?.version_num ?? 0) < 180000, "fixture must be PostgreSQL 17");
  assert.equal(identity[0]?.current_user, decodeURIComponent(new URL(process.env.DATABASE_URL!).username));

  const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
  const slug = `hero-test-${suffix}`;
  const otherSlug = `hero-other-${suffix}`;
  const orgIds: string[] = [];
  const userIds: string[] = [];
  const imageIds: string[] = [];
  let service: import("@/lib/website-studio/retail.service").RetailWebsiteService | undefined;

  try {
    const [{ RetailWebsiteService }, { getPublishedRetailHero }] = await Promise.all([
      import("@/lib/website-studio/retail.service"),
      import("@/lib/website-studio/retail-hero.server"),
    ]);
    service = new RetailWebsiteService(db);
    const [org, otherOrg] = await Promise.all([
      db.organization.create({ data: { type: "SHOP", name: `Hero fixture ${suffix}`, slug } }),
      db.organization.create({ data: { type: "SHOP", name: `Other hero fixture ${suffix}`, slug: otherSlug } }),
    ]);
    orgIds.push(org.id, otherOrg.id);
    const [manager, otherManager] = await Promise.all([
      db.user.create({ data: { name: `hero-manager-${suffix}`, password: "local-fixture-only", role: "ADMIN" } }),
      db.user.create({ data: { name: `hero-manager-other-${suffix}`, password: "local-fixture-only", role: "ADMIN" } }),
    ]);
    userIds.push(manager.id, otherManager.id);
    await db.organizationMember.createMany({ data: [
      { organizationId: org.id, organizationSlug: org.slug, userId: manager.id, role: "ADMIN" },
      { organizationId: otherOrg.id, organizationSlug: otherOrg.slug, userId: otherManager.id, role: "ADMIN" },
    ] });
    await db.organizationCapability.createMany({ data: [org, otherOrg].map(item => ({ organizationId: item.id, key: "SHOP" as const, status: "ACTIVE" as const, enabledAt: new Date() })) });

    const imageUrl = `/api/media/${org.id}/tenants/${org.id}/uploads/${slug}.webp`;
    const image = await db.image.create({ data: { url: imageUrl, filename: `${slug}.webp`, mimeType: "image/webp", purpose: "retail-hero-fixture", access: "PUBLIC", organizationId: org.id } });
    const otherImage = await db.image.create({ data: { url: `https://hero-fixtures.public.blob.vercel-storage.com/${otherSlug}.webp`, filename: `${otherSlug}.webp`, mimeType: "image/webp", purpose: "retail-hero-fixture", access: "PUBLIC", organizationId: otherOrg.id } });
    imageIds.push(image.id, otherImage.id);

    const baseContent = initialRetailContent(org);
    const firstContent = {
      ...baseContent,
      hero: { enabled: true, mode: "CAMPAIGN" as const, heading: "First published heading", description: "Published copy", ctaLabel: "Browse", ctaHref: "", desktopImageId: image.id, mobileImageId: "", imageAlt: "First campaign", imageFit: "cover" as const, focalX: 50, focalY: 50, productIds: [], autoplay: false },
    };
    const firstPrincipal = { userId: manager.id, role: "ADMIN" as const, organizationId: org.id };
    const otherPrincipal = { userId: otherManager.id, role: "ADMIN" as const, organizationId: otherOrg.id };

    await db.organizationSettings.create({ data: { organizationSlug: slug, settings: { theme: "dark", defaultPublicCapability: "SHOP", preservedPayload: { stamp: suffix } } } });
    const first = await service.save(firstPrincipal, org.id, { content: firstContent, baseRevisionId: null, requestId: randomUUID() });
    const reopened = await new RetailWebsiteService(db).load(firstPrincipal, org.id, first.id);
    assert.equal(reopened.revision?.id, first.id, "saved draft reopens by its immutable revision id");
    assert.deepEqual(reopened.content.hero, firstContent.hero, "reopened hero input matches the saved configuration");

    const authorizedImages = await db.image.findMany({ where: { id: image.id, organizationId: org.id, access: "PUBLIC" } });
    assert.equal(authorizedImages[0]?.url, imageUrl, "fixture uses the tenant persistent-disk upload URL shape");

    await assert.rejects(
      () => service!.save(firstPrincipal, org.id, { content: { ...firstContent, hero: { ...firstContent.hero!, desktopImageId: otherImage.id } }, baseRevisionId: first.id, requestId: randomUUID() }),
      statusIs(422),
      "foreign tenant media is rejected at save time",
    );

    const firstPublication = await service.changePublication(firstPrincipal, org.id, { action: "publish", revisionId: first.id, basePublishedRevisionId: null });
    assert.equal(firstPublication.revisionId, first.id);
    let settings = await db.organizationSettings.findUniqueOrThrow({ where: { organizationSlug: slug } });
    assert.deepEqual(settings.settings, {
      theme: "dark", defaultPublicCapability: "SHOP", preservedPayload: { stamp: suffix },
      retailHeroPublication: { revisionId: first.id, previousRevisionId: null, publishedAt: firstPublication.publishedAt },
    }, "atomic publication preserves neighboring JSON settings keys");
    assert.equal((await getPublishedRetailHero(slug))?.hero.heading, "First published heading");
    assert.equal((await getPublishedRetailHero(slug))?.hero.desktopImage, imageUrl, "published Hero resolves its tenant PUBLIC persistent-disk image");

    const secondContent = { ...firstContent, hero: { ...firstContent.hero, heading: "Second draft heading" } };
    const second = await service.save(firstPrincipal, org.id, { content: secondContent, baseRevisionId: first.id, requestId: randomUUID() });
    assert.equal((await getPublishedRetailHero(slug))?.hero.heading, "First published heading", "saving a draft does not alter public output");

    await assert.rejects(
      () => service!.changePublication(otherPrincipal, otherOrg.id, { action: "publish", revisionId: first.id, basePublishedRevisionId: null }),
      statusIs(404),
      "a tenant cannot publish a revision owned by another tenant",
    );
    await assert.rejects(() => service!.load(otherPrincipal, otherOrg.id, first.id), statusIs(404), "draft reads are tenant scoped");

    const secondPublication = await service.changePublication(firstPrincipal, org.id, { action: "publish", revisionId: second.id, basePublishedRevisionId: first.id });
    assert.equal(secondPublication.previousRevisionId, first.id);
    assert.equal((await getPublishedRetailHero(slug))?.hero.heading, "Second draft heading");
    settings = await db.organizationSettings.findUniqueOrThrow({ where: { organizationSlug: slug } });
    assert.equal((settings.settings as Record<string, unknown>).defaultPublicCapability, "SHOP");
    assert.deepEqual((settings.settings as Record<string, unknown>).preservedPayload, { stamp: suffix });

    const rollback = await service.changePublication(firstPrincipal, org.id, { action: "rollback", revisionId: second.id, basePublishedRevisionId: second.id });
    assert.equal(rollback.revisionId, first.id);
    assert.equal(rollback.previousRevisionId, second.id);
    assert.equal((await getPublishedRetailHero(slug))?.hero.heading, "First published heading");
    assert.equal((await getPublishedRetailHero(slug))?.hero.desktopImage, imageUrl, "rollback restores the preceding disk-backed Hero image");

    await db.image.update({ where: { id: image.id }, data: { access: "PRIVATE" } });
    assert.equal(await getPublishedRetailHero(slug), null, "revoking campaign media removes the published hero from public resolution");
    settings = await db.organizationSettings.findUniqueOrThrow({ where: { organizationSlug: slug } });
    assert.equal((settings.settings as Record<string, unknown>).retailHeroPublication && typeof (settings.settings as Record<string, unknown>).retailHeroPublication === "object", true, "media revocation leaves the publication pointer auditable");

    await db.image.update({ where: { id: image.id }, data: { access: "PUBLIC" } });
    assert.equal((await getPublishedRetailHero(slug))?.hero.heading, "First published heading", "restoring approved media restores the published hero");
    await db.image.delete({ where: { id: image.id } });
    assert.equal(await getPublishedRetailHero(slug), null, "deleting media also fails closed");
  } finally {
    if (orgIds.length) {
      await db.auditLog.deleteMany({ where: { organizationId: { in: orgIds } } });
      await db.tenantWebsiteRevision.deleteMany({ where: { organizationId: { in: orgIds } } });
      await db.organizationSettings.deleteMany({ where: { organizationSlug: { in: [slug, otherSlug] } } });
      await db.image.deleteMany({ where: { id: { in: imageIds } } });
      await db.organizationMember.deleteMany({ where: { organizationId: { in: orgIds } } });
      await db.organizationCapability.deleteMany({ where: { organizationId: { in: orgIds } } });
      await db.organization.deleteMany({ where: { id: { in: orgIds } } });
    }
    if (userIds.length) await db.user.deleteMany({ where: { id: { in: userIds } } });
    await db.$disconnect();
    (globalThis as unknown as { bazarBazPrisma?: PrismaClient }).bazarBazPrisma = undefined;
  }
});
